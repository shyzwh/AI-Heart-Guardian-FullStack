import { useEffect, useState } from 'react';
import Plot from '@/components/PlotlyChart';
import { getShap, type ShapKind } from '@/api/ecg';
import type { IShapEnvelope } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ShapChartsProps {
  recordId: number;
}

const KINDS: { key: ShapKind; label: string }[] = [
  { key: 'summary', label: '特征重要性' },
  { key: 'beeswarm', label: '蜂群图' },
  { key: 'interaction', label: '交互图' },
  { key: 'decision', label: '决策图' },
];

const PRIMARY = '#1d7d8c';
const CHART_GRID = '#e5eaed';

function asNumArray(v: unknown): number[] {
  return Array.isArray(v) ? (v as unknown[]).map((x) => Number(x)) : [];
}
function asStrArray(v: unknown): string[] {
  return Array.isArray(v) ? (v as unknown[]).map((x) => String(x)) : [];
}

/** 把后端各 kind 的 chart 数据转成 Plotly data + layout。不可用时返回 null。 */
function buildFigure(env: IShapEnvelope): { data: unknown[]; layout: Record<string, unknown> } | null {
  if (!env.available || !env.chart) return null;
  const c = env.chart as Record<string, unknown>;
  const axisX = { gridcolor: CHART_GRID, zerolinecolor: CHART_GRID };
  const axisY = { gridcolor: CHART_GRID, automargin: true };
  const baseLayout: Record<string, unknown> = {
    margin: { l: 56, r: 20, t: 28, b: 48 },
    autosize: true,
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { family: 'inherit', size: 12, color: '#475569' },
    xaxis: axisX,
    yaxis: axisY,
  };

  switch (true) {
    case Array.isArray(c.features) && Array.isArray(c.importance) && !Array.isArray(c.values): {
      // summary: 水平条形图
      const features = asStrArray(c.features);
      const importance = asNumArray(c.importance);
      return {
        data: [
          {
            type: 'bar',
            orientation: 'h',
            x: importance,
            y: features,
            marker: { color: PRIMARY },
            hovertemplate: '%{y}: %{x:.3f}<extra></extra>',
          },
        ],
        layout: {
          ...baseLayout,
          title: { text: '平均 |SHAP| 特征重要性', font: { size: 13 } },
          yaxis: { ...axisY, categoryorder: 'total ascending' },
        },
      };
    }
    case Array.isArray(c.shap_values) &&
      Array.isArray((c.shap_values as unknown[])[0]): {
      // beeswarm: 后端 values / shap_values 均为二维 [样本×特征]。
      // 展平为逐点：x=该样本该特征 SHAP 值，y=特征名，颜色=该特征标准化取值。
      const features = asStrArray(c.features);
      const values2d = (c.values as unknown[]) as unknown[];
      const shap2d = (c.shap_values as unknown[]) as unknown[];

      // 大背景集时按样本抽样，避免一次渲染上万点；47 个样本会全部保留。
      const MAX_SAMPLES = 300;
      let sampleIdx = shap2d.map((_, i) => i);
      if (sampleIdx.length > MAX_SAMPLES) {
        sampleIdx = sampleIdx
          .map((i) => ({ i, r: Math.random() }))
          .sort((a, b) => a.r - b.r)
          .slice(0, MAX_SAMPLES)
          .map((o) => o.i);
      }

      const xVals: number[] = [];
      const yLabels: string[] = [];
      const colorVals: number[] = [];
      const featCount = features.length;

      // 后端 values 是各特征【原始】量纲（如 HR≈74、QTc≈400），直接做颜色会被
      // 大量纲特征主导。这里按特征列做 z-score 归一化，使颜色反映“该样本在该
      // 特征上的相对高低”（标准蜂群图语义，色条约 -2~2）。
      const colMean = new Array(featCount).fill(0);
      const colStd = new Array(featCount).fill(0);
      for (let fi = 0; fi < featCount; fi += 1) {
        const col = sampleIdx
          .map((si) => asNumArray(values2d[si])[fi])
          .filter((v) => v != null && Number.isFinite(v));
        if (!col.length) continue;
        const mean = col.reduce((a, b) => a + b, 0) / col.length;
        const variance =
          col.reduce((a, b) => a + (b - mean) ** 2, 0) / (col.length - 1 || 1);
        colMean[fi] = mean;
        colStd[fi] = Math.sqrt(variance);
      }

      sampleIdx.forEach((si) => {
        const shapRow = asNumArray(shap2d[si]);
        const valRow = asNumArray(values2d[si]);
        features.forEach((fName, fi) => {
          const sv = shapRow[fi];
          if (sv == null || !Number.isFinite(sv)) return;
          const raw = Number(valRow[fi]);
          const norm =
            Number.isFinite(raw) && colStd[fi] > 1e-9
              ? (raw - colMean[fi]) / colStd[fi]
              : 0;
          xVals.push(sv);
          yLabels.push(fName);
          colorVals.push(norm);
        });
      });

      return {
        data: [
          {
            type: 'scattergl',
            mode: 'markers',
            x: xVals,
            y: yLabels,
            marker: {
              color: colorVals,
              cmin: -2,
              cmax: 2,
              colorscale: [
                [0, '#7fb7c2'],
                [0.5, PRIMARY],
                [1, '#0e4c57'],
              ],
              size: 6,
              opacity: 0.7,
              colorbar: { title: { text: '特征值高低（z-score）' }, thickness: 10 },
            },
            hovertemplate:
              '%{y}<br>SHAP %{x:.3f}<br>相对取值 %{marker.color:.2f}σ<extra></extra>',
          },
        ],
        layout: {
          ...baseLayout,
          title: {
            text: `SHAP 蜂群分布（${sampleIdx.length} 个背景样本）`,
            font: { size: 13 },
          },
          xaxis: { ...axisX, title: { text: 'SHAP 值（对预测的推动方向）' }, zeroline: true },
          yaxis: { ...axisY, automargin: true },
        },
      };
    }
    case Array.isArray(c.points): {
      // interaction: x/y 散点，颜色映射第三维
      const points = c.points as { x?: number; y?: number; color?: number }[];
      return {
        data: [
          {
            type: 'scattergl',
            mode: 'markers',
            x: points.map((p) => Number(p.x)),
            y: points.map((p) => Number(p.y)),
            marker: {
              color: points.map((p) => Number(p.color)),
              colorscale: 'Tealgrn',
              size: 6,
              opacity: 0.7,
              showscale: true,
            },
            hovertemplate: 'x %{x:.2f}<br>y %{y:.3f}<extra></extra>',
          },
        ],
        layout: {
          ...baseLayout,
          title: {
            text: `${String(c.feature ?? '')} × ${String(c.interaction_feature ?? '')} 交互`,
            font: { size: 13 },
          },
          xaxis: { ...axisX, title: { text: String(c.feature ?? 'x') } },
          yaxis: { ...axisY, title: { text: 'SHAP 交互值' } },
        },
      };
    }
    case Array.isArray(c.features) && Array.isArray(c.contributions): {
      // decision: 瀑布/累计折线
      const features = asStrArray(c.features);
      const contrib = asNumArray(c.contributions);
      const base = Number(env.base_value ?? 0);
      const cum: number[] = [];
      contrib.reduce((acc, v, i) => {
        const next = i === 0 ? base + v : acc + v;
        cum.push(next);
        return next;
      }, base);
      return {
        data: [
          {
            type: 'bar',
            name: '贡献',
            x: features,
            y: contrib,
            marker: { color: contrib.map((v) => (v >= 0 ? '#d9413b' : '#2f9e6e')) },
          },
          {
            type: 'scatter',
            mode: 'lines+markers',
            name: '累计',
            x: features,
            y: cum,
            line: { color: PRIMARY, width: 2 },
          },
        ],
        layout: {
          ...baseLayout,
          title: { text: '单样本 SHAP 决策路径', font: { size: 13 } },
          barmode: 'relative',
          xaxis: { ...axisX, tickangle: -35 },
          yaxis: { ...axisY, title: { text: '模型输出' } },
          legend: { orientation: 'h', y: -0.25 },
        },
      };
    }
    default:
      return null;
  }
}

function ShapPanel({ recordId, kind }: { recordId: number; kind: ShapKind }) {
  const [env, setEnv] = useState<IShapEnvelope | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    getShap(recordId, kind)
      .then((d) => {
        if (alive) {
          setEnv(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) {
          setError('SHAP 数据加载失败');
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [recordId, kind]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">正在计算 SHAP…</div>;
  }
  if (error || !env) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">{error || '暂无数据'}</div>;
  }
  const figure = buildFigure(env);
  if (!figure) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-1 text-center text-sm text-muted-foreground">
        <p>该图暂不可用</p>
        <p className="text-xs">{env.message || '样本量不足或缺少背景训练数据，已优雅降级'}</p>
      </div>
    );
  }
  return (
    <Plot
      data={figure.data}
      layout={{ ...figure.layout, height: 320 }}
      config={{ displayModeBar: false, responsive: true, locale: 'zh-CN' }}
      useResizeHandler
      style={{ width: '100%', height: 320 }}
    />
  );
}

export function ShapCharts({ recordId }: ShapChartsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">SHAP 模型可解释性</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="summary">
          <TabsList className="grid w-full grid-cols-4">
            {KINDS.map((k) => (
              <TabsTrigger key={k.key} value={k.key}>
                {k.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {KINDS.map((k) => (
            <TabsContent key={k.key} value={k.key}>
              <ShapPanel recordId={recordId} kind={k.key} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
