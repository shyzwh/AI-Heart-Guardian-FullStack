import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FileText, Search, HeartPulse, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { listRecords } from '@/api/ecg';
import { getMyProfile } from '@/api/patients';
import { extractError } from '@/api/http';
import type { IEcgRecordSummary, IPatient } from '@/types';
import { RiskBadge } from '@/components/RiskBadge';
import { format } from 'date-fns';

const RISK_OPTIONS = [
  { value: 'all', label: '全部风险' },
  { value: '低危', label: '低危' },
  { value: '中危', label: '中危' },
  { value: '高危', label: '高危' },
];

export default function MyReportsPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<IEcgRecordSummary[]>([]);
  const [profile, setProfile] = useState<IPatient | null>(null);
  const [loading, setLoading] = useState(true);
  const [noProfile, setNoProfile] = useState(false);
  const [riskFilter, setRiskFilter] = useState('all');
  const [keyword, setKeyword] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    getMyProfile()
      .then((p) => {
        setProfile(p);
        setNoProfile(false);
        return listRecords();
      })
      .then(setRecords)
      .catch((err) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          setNoProfile(true);
          setRecords([]);
        } else {
          toast.error(extractError(err, '报告加载失败'));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const filtered = useMemo(
    () =>
      records.filter((r) => {
        if (riskFilter !== 'all' && r.risk_level !== riskFilter) return false;
        if (keyword && !r.file_name.includes(keyword) && !r.record_id.includes(keyword)) return false;
        return true;
      }),
    [records, riskFilter, keyword],
  );

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">加载中…</div>;
  }

  if (noProfile) {
    return (
      <div>
        <PageHeader title="我的报告" description="查看本人的心电筛查报告" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <HeartPulse className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">尚未建立健康档案</p>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              您的账号还没有关联患者档案，因此暂无报告。请联系您的主治医生在「患者档案」中为您建档并完成心电筛查后，即可在此查看报告。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="我的报告"
        description={profile ? `${profile.name} · 共 ${records.length} 份心电报告` : `共 ${records.length} 份心电报告`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-40">
          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger>
              <SelectValue placeholder="全部风险" />
            </SelectTrigger>
            <SelectContent>
              {RISK_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索文件名 / 记录号"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <FileText className="h-9 w-9 opacity-40" />
            <p className="text-sm">{records.length === 0 ? '暂无心电报告，请在完成筛查后查看' : '没有符合条件的报告'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Card
              key={r.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => navigate(`/patient/reports/${r.id}`)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">{r.file_name}</span>
                    <RiskBadge level={r.risk_level} size="sm" />
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    记录号 {r.record_id} · {format(new Date(r.created_at), 'yyyy-MM-dd HH:mm')}
                    {r.symptoms ? ` · ${r.symptoms}` : ''}
                  </p>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="text-xs text-muted-foreground">异常 / 总心拍</p>
                  <p className="mt-0.5 text-sm tabular-nums">
                    <span className={r.abnormal_beats > 0 ? 'font-medium text-destructive' : ''}>
                      {r.abnormal_beats}
                    </span>
                    {' / '}
                    {r.total_beats}
                  </p>
                </div>
                {r.abnormal_beats > 0 && (
                  <Badge variant="outline" className="hidden shrink-0 border-destructive/30 text-destructive md:inline-flex">
                    建议关注
                  </Badge>
                )}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
