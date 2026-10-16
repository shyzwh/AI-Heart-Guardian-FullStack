import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dumbbell,
  Loader2,
  RefreshCw,
  Gauge,
  Clock,
  CalendarDays,
  HeartPulse,
  ListChecks,
  AlertTriangle,
  Siren,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getMyProfile } from '@/api/patients';
import { getRehabPlans, generateRehab } from '@/api/wellness';
import { extractError } from '@/api/http';
import type { IPatient, IRehabPlan } from '@/types';
import { RiskBadge } from '@/components/RiskBadge';

export default function RehabPage() {
  const [profile, setProfile] = useState<IPatient | null>(null);
  const [noProfile, setNoProfile] = useState(false);
  const [plan, setPlan] = useState<IRehabPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await getMyProfile();
      setProfile(p);
      const plans = await getRehabPlans(p.id, 1);
      setPlan(plans[0] ?? null);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        setNoProfile(true);
      } else {
        toast.error(extractError(err, '康复方案加载失败'));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const handleGenerate = async () => {
    if (!profile) return;
    setGenerating(true);
    try {
      const created = await generateRehab(profile.id);
      setPlan(created);
      toast.success('已根据最新心电结果生成康复方案');
    } catch (err) {
      toast.error(extractError(err, '生成失败，请稍后重试'));
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">加载中…</div>;
  }

  if (noProfile) {
    return (
      <div>
        <PageHeader title="居家康复" description="根据心电风险等级获取个性化康养运动指导" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <HeartPulse className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">尚未建立健康档案</p>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              请联系主治医生完成建档与心电筛查后，即可在此获取与您风险等级匹配的居家康复方案。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isHigh = plan?.risk_level === '高危';

  return (
    <div>
      <PageHeader
        title="居家康复"
        description="根据您最新的心电风险等级推荐安全适宜的康养运动"
        actions={
          <Button size="sm" variant={plan ? 'outline' : 'default'} onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-4 w-4" />
            )}
            {plan ? '按最新结果重新生成' : '生成我的康复方案'}
          </Button>
        }
      />

      {!plan ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Dumbbell className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">还没有康复方案</p>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              点击右上角「生成我的康复方案」，系统将依据您最近一次心电筛查的风险等级，推荐八段锦、太极拳或慢走等适宜运动。
            </p>
            <Button size="sm" className="mt-1" onClick={handleGenerate} disabled={generating}>
              {generating && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              立即生成
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
                  <Dumbbell className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{plan.exercise_type}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {profile?.name} 的个性化居家康复方案
                  </p>
                </div>
              </div>
              <RiskBadge level={plan.risk_level} size="lg" />
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="space-y-1.5 p-4">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Gauge className="h-3.5 w-3.5" />
                  运动强度
                </p>
                <p className="text-sm font-medium leading-relaxed text-foreground">{plan.intensity}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1.5 p-4">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  单次时长
                </p>
                <p className="text-sm font-medium text-foreground">约 {plan.duration_min} 分钟</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1.5 p-4">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  锻炼频率
                </p>
                <p className="text-sm font-medium leading-relaxed text-foreground">{plan.frequency}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <ListChecks className="h-4 w-4 text-primary" />
                  康复指导
                </p>
                <p className="pl-6 text-sm leading-relaxed text-muted-foreground">{plan.guidance}</p>
              </div>

              <div
                className={`flex items-start gap-2 rounded-lg border p-3 ${
                  isHigh
                    ? 'border-destructive/30 bg-destructive/5'
                    : 'border-warning/30 bg-warning/5'
                }`}
              >
                {isHigh ? (
                  <Siren className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                )}
                <div className="space-y-1">
                  <p className={`text-sm font-medium ${isHigh ? 'text-destructive' : 'text-foreground'}`}>
                    {isHigh ? '安全警示' : '注意事项'}
                  </p>
                  <p className={`text-sm leading-relaxed ${isHigh ? 'text-destructive/90' : 'text-muted-foreground'}`}>
                    {plan.cautions}
                  </p>
                </div>
              </div>

              {isHigh && (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-destructive/30 text-destructive">
                    暂不建议自行运动
                  </Badge>
                  <a
                    href="tel:120"
                    className="inline-flex items-center gap-1 text-sm font-medium text-destructive hover:underline"
                  >
                    紧急情况拨打 120
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <p className="mt-4 px-1 text-xs leading-relaxed text-muted-foreground">
        康复方案由系统依据心电风险等级与年龄自动生成，仅供居家康养参考；运动前请遵医嘱，出现不适立即停止并就医。
      </p>
    </div>
  );
}
