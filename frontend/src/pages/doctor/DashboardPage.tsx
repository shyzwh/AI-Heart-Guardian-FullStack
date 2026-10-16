import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { toast } from 'sonner';
import { FileHeart, HeartPulse, AlertTriangle, Users } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listRecords } from '@/api/ecg';
import { listPatients } from '@/api/patients';
import { extractError } from '@/api/http';
import type { IEcgRecordSummary } from '@/types';
import { format, parseISO, isValid } from 'date-fns';

// 与主题 --chart-1..5 / 风险语义色保持一致（hex 字面量，图表库不解析 CSS 变量）
const COLOR_LOW = '#2f9e6e';
const COLOR_MID = '#e08a12';
const COLOR_HIGH = '#d9413b';
const CHART_PRIMARY = '#1d7d8c';

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
          <Icon className="h-5.5 w-5.5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [records, setRecords] = useState<IEcgRecordSummary[]>([]);
  const [patientCount, setPatientCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listRecords(), listPatients()])
      .then(([rs, ps]) => {
        setRecords(rs);
        setPatientCount(ps.length);
      })
      .catch((err) => toast.error(extractError(err, '统计数据加载失败')))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const count = (level: string) => records.filter((r) => r.risk_level === level).length;
    const low = count('低危');
    const mid = count('中危');
    const high = count('高危');
    const abnormal = records.reduce((s, r) => s + r.abnormal_beats, 0);

    // 按日期聚合分析次数（最近按天）
    const byDate = new Map<string, number>();
    records.forEach((r) => {
      const d = parseISO(r.created_at);
      if (!isValid(d)) return;
      const key = format(d, 'yyyy-MM-dd');
      byDate.set(key, (byDate.get(key) ?? 0) + 1);
    });
    const trendKeys = [...byDate.keys()].sort();
    const trend = trendKeys.map((k) => byDate.get(k) ?? 0);

    return { low, mid, high, abnormal, trendKeys, trend };
  }, [records]);

  const pieOption = useMemo(
    () => ({
      color: [COLOR_LOW, COLOR_MID, COLOR_HIGH],
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0, icon: 'circle' },
      series: [
        {
          name: '风险分布',
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 4 },
          label: { show: true, formatter: '{b}\n{c} 例' },
          data: [
            { value: stats.low, name: '低危' },
            { value: stats.mid, name: '中危' },
            { value: stats.high, name: '高危' },
          ],
        },
      ],
    }),
    [stats],
  );

  const lineOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      grid: { left: 44, right: 20, top: 30, bottom: 40 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: stats.trendKeys,
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: { color: '#64748b' },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        splitLine: { lineStyle: { color: '#eef2f5' } },
        axisLabel: { color: '#64748b' },
      },
      series: [
        {
          name: '分析次数',
          type: 'line',
          smooth: true,
          data: stats.trend,
          symbolSize: 7,
          lineStyle: { width: 3, color: CHART_PRIMARY },
          itemStyle: { color: CHART_PRIMARY },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(29,125,140,0.25)' },
                { offset: 1, color: 'rgba(29,125,140,0.02)' },
              ],
            },
          },
        },
      ],
    }),
    [stats],
  );

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">统计加载中…</div>;
  }

  return (
    <div>
      <PageHeader title="统计看板" description="心电筛查风险分布与分析趋势" />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={Users} label="在管患者" value={patientCount} />
        <KpiCard icon={FileHeart} label="累计分析" value={records.length} sub="份心电记录" />
        <KpiCard
          icon={AlertTriangle}
          label="中/高危占比"
          value={records.length ? `${(((stats.mid + stats.high) / records.length) * 100).toFixed(0)}%` : '—'}
          sub={`中 ${stats.mid} · 高 ${stats.high}`}
        />
        <KpiCard icon={HeartPulse} label="异常心拍总数" value={stats.abnormal} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">风险等级分布</CardTitle>
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">暂无数据</div>
            ) : (
              <ReactECharts option={pieOption} style={{ height: 300 }} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">每日分析趋势</CardTitle>
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">暂无数据</div>
            ) : (
              <ReactECharts option={lineOption} style={{ height: 300 }} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
