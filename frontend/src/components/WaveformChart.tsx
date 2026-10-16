import { useEffect, useState } from 'react';
import Plot from '@/components/PlotlyChart';
import { getWaveform } from '@/api/ecg';
import type { IWaveform } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface WaveformChartProps {
  recordId: number;
}

export function WaveformChart({ recordId }: WaveformChartProps) {
  const [wave, setWave] = useState<IWaveform | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getWaveform(recordId)
      .then((d) => {
        if (alive) {
          setWave(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) {
          setWave(null);
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [recordId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          正在加载波形…
        </CardContent>
      </Card>
    );
  }
  if (!wave || !wave.signal.length) {
    return (
      <Card>
        <CardContent className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          波形数据不可用
        </CardContent>
      </Card>
    );
  }

  const fs = wave.fs || 360;
  const t = wave.signal.map((_, i) => i / fs);
  const rTime = wave.r_peaks.map((idx) => idx / fs);
  const rAmp = wave.r_peaks.map((idx) => wave.signal[idx] ?? 0);
  const abTime = wave.abnormal_positions.map((idx) => idx / fs);
  const abAmp = wave.abnormal_positions.map((idx) => wave.signal[idx] ?? 0);

  const data: unknown[] = [
    {
      type: 'scattergl',
      mode: 'lines',
      x: t,
      y: wave.signal,
      line: { color: '#1d7d8c', width: 1 },
      name: '心电信号',
      hovertemplate: '%{x:.2f}s: %{y:.3f} mV<extra></extra>',
    },
    {
      type: 'scattergl',
      mode: 'markers',
      x: rTime,
      y: rAmp,
      marker: { color: '#2f9e6e', size: 5, symbol: 'triangle-up' },
      name: 'R 峰',
      hovertemplate: 'R峰 %{x:.2f}s<extra></extra>',
    },
    {
      type: 'scattergl',
      mode: 'markers',
      x: abTime,
      y: abAmp,
      marker: { color: '#d9413b', size: 8, symbol: 'x' },
      name: '异常心拍',
      hovertemplate: '异常 %{x:.2f}s<extra></extra>',
    },
  ];

  const layout: Record<string, unknown> = {
    margin: { l: 56, r: 20, t: 28, b: 44 },
    autosize: true,
    height: 300,
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { family: 'inherit', size: 12, color: '#475569' },
    xaxis: { title: { text: '时间 (s)' }, gridcolor: '#e5eaed' },
    yaxis: { title: { text: '幅值 (mV)' }, gridcolor: '#e5eaed' },
    legend: { orientation: 'h', y: -0.18 },
    hovermode: 'closest',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">心电波形（预处理后）</CardTitle>
      </CardHeader>
      <CardContent>
        <Plot
          data={data}
          layout={layout}
          config={{ displayModeBar: false, responsive: true, locale: 'zh-CN' }}
          useResizeHandler
          style={{ width: '100%', height: 300 }}
        />
      </CardContent>
    </Card>
  );
}
