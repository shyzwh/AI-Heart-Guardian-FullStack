import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RiskBadge } from '@/components/RiskBadge';
import { FEATURE_LABELS, FEATURE_ORDER, type IEcgRecord } from '@/types';
import { HeartPulse, Activity, Gauge, Cpu } from 'lucide-react';

interface AnalysisSummaryProps {
  record: IEcgRecord;
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={`mt-1 text-lg font-semibold ${tone ?? 'text-foreground'}`}>
        {value}
      </div>
    </div>
  );
}

export function AnalysisSummary({ record }: AnalysisSummaryProps) {
  const probs = record.risk_probs ?? [];
  const probLabels = ['低危', '中危', '高危'];
  const features = record.features ?? {};
  const cnnSucceeded = record.cnn_status === 'success' || record.cnn_status === 'ok';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-base">双通路风险评估</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              XGBoost 特征模型 + 1D-CNN 波形模型联合判读
            </p>
          </div>
          <RiskBadge level={record.risk_level} size="lg" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              icon={Gauge}
              label="XGBoost 置信度"
              value={`${(record.risk_score * 100).toFixed(1)}%`}
            />
            <StatTile
              icon={HeartPulse}
              label="总心拍数"
              value={String(record.total_beats)}
            />
            <StatTile
              icon={Activity}
              label="异常心拍"
              value={String(record.abnormal_beats)}
              tone={record.abnormal_beats > 0 ? 'text-destructive' : undefined}
            />
            <StatTile
              icon={Cpu}
              label="CNN 状态"
              value={cnnSucceeded ? 'success' : record.cnn_status || '未启用'}
              tone={
                cnnSucceeded
                  ? 'text-primary'
                  : record.cnn_status === 'error'
                    ? 'text-destructive'
                    : undefined
              }
            />
          </div>

          {probs.length === 3 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">三分类概率</p>
              <div className="space-y-2">
                {probLabels.map((lab, i) => {
                  const pct = (probs[i] ?? 0) * 100;
                  const color =
                    lab === '低危' ? '#2f9e6e' : lab === '中危' ? '#e08a12' : '#d9413b';
                  return (
                    <div key={lab} className="flex items-center gap-3">
                      <span className="w-10 text-xs text-foreground">{lab}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                      <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {record.cnn_confidence != null && (
            <p className="text-xs text-muted-foreground">
              CNN 异常置信度：{(record.cnn_confidence * 100).toFixed(1)}%
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">12 项心电特征</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
            {FEATURE_ORDER.map((key) => {
              const meta = FEATURE_LABELS[key];
              const val = features[key];
              return (
                <div key={key} className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground">
                    {meta.label}
                    <span className="ml-1 text-muted-foreground/70">({key})</span>
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium tabular-nums text-foreground">
                    {val == null ? '—' : Number(val).toFixed(2)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      {val == null ? '' : meta.unit}
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
