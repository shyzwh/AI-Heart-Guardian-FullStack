import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Activity,
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
  ExternalLink,
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

const EXERCISE_GUIDES = [
  {
    title: '太极拳',
    icon: HeartPulse,
    accent: 'from-teal-50 to-emerald-100 text-teal-700 dark:from-teal-950/60 dark:to-emerald-950/50 dark:text-teal-200',
  },
  {
    title: '慢走',
    icon: Activity,
    accent: 'from-sky-50 to-cyan-100 text-sky-700 dark:from-sky-950/60 dark:to-cyan-950/50 dark:text-sky-200',
  },
  {
    title: '八段锦',
    icon: Dumbbell,
    accent: 'from-amber-50 to-orange-100 text-amber-700 dark:from-amber-950/60 dark:to-orange-950/50 dark:text-amber-200',
  },
];

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
        <PageHeader title="居家康复" description="按心电风险等级提供康复运动方案" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <HeartPulse className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">尚未建立健康档案</p>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              完成健康档案与心电筛查后可生成康复方案。
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
        description="按最新心电风险等级提供康复运动方案"
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
            <p className="text-sm font-medium text-foreground">暂无康复方案</p>
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

          <section>
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-foreground">运动教学</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {EXERCISE_GUIDES.map(({ title, icon: Icon, accent }) => (
                <Card
                  key={title}
                  className={`overflow-hidden border-0 bg-gradient-to-br ${accent}`}
                >
                  <svg
                    viewBox="0 0 100 100"
                    role="img"
                    aria-label={`${title}示意图`}
                    className={`w-24 h-24 mx-auto ${
                      title === '太极拳'
                        ? 'text-emerald-600'
                        : title === '慢走'
                          ? 'text-blue-600'
                          : 'text-amber-600'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={4}
                  >
                    {title === '太极拳' ? (
                      <>
                        <circle cx="50" cy="20" r="8" />
                        <path d="M50 28 L50 60" />
                        <path d="M50 40 Q30 45 20 55" />
                        <path d="M50 40 Q70 45 80 55" />
                        <path d="M50 60 L30 85" />
                        <path d="M50 60 L70 85" />
                      </>
                    ) : title === '慢走' ? (
                      <>
                        <circle cx="55" cy="20" r="8" />
                        <path d="M55 28 L45 55" />
                        <path d="M50 40 Q40 50 35 60" />
                        <path d="M50 40 Q60 45 70 40" />
                        <path d="M45 55 L30 80" />
                        <path d="M45 55 L65 85" />
                      </>
                    ) : (
                      <>
                        <circle cx="50" cy="25" r="8" />
                        <path d="M50 33 L50 65" />
                        <path d="M50 40 L40 15" />
                        <path d="M50 40 L60 15" />
                        <path d="M50 65 L40 85" />
                        <path d="M50 65 L60 85" />
                      </>
                    )}
                  </svg>
                  <CardContent className="flex h-full flex-col items-start p-4">
                    <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/75 shadow-sm dark:bg-black/20">
                      <Icon className="h-5 w-5" />
                    </span>
                    <p className="text-sm font-semibold">{title}</p>
                    <a
                      href={`https://search.bilibili.com/all?keyword=${encodeURIComponent(`${title} 老年人 健康教学`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
                    >
                      查看教学视频
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

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

      <p className="px-1 text-xs text-muted-foreground">
        运动中出现不适，立即停止并就医。
      </p>
    </div>
  );
}
