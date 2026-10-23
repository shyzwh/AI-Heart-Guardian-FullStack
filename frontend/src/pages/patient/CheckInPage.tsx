import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Loader2,
  Save,
  HeartPulse,
  CalendarCheck2,
  Plus,
  CheckCircle2,
  Activity,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { getMyProfile } from '@/api/patients';
import { createCheckIn, listCheckIns } from '@/api/wellness';
import { extractError } from '@/api/http';
import type { IPatient, ICheckIn } from '@/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const SYMPTOM_TAGS = ['胸闷', '心悸', '气短', '头晕', '乏力', '胸痛', '失眠', '水肿'];
const MOODS = ['良好', '一般', '焦虑', '较差'];
const MOOD_STYLE: Record<string, string> = {
  良好: 'border-primary/40 bg-primary/10 text-primary',
  一般: 'border-slate-300 bg-slate-100 text-slate-600',
  焦虑: 'border-warning/40 bg-warning/10 text-warning',
  较差: 'border-destructive/40 bg-destructive/10 text-destructive',
};

const todayStr = () => format(new Date(), 'yyyy-MM-dd');

export default function CheckInPage() {
  const [profile, setProfile] = useState<IPatient | null>(null);
  const [noProfile, setNoProfile] = useState(false);
  const [records, setRecords] = useState<ICheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // form
  const [tags, setTags] = useState<string[]>([]);
  const [symptoms, setSymptoms] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [bloodPressure, setBloodPressure] = useState('');
  const [mood, setMood] = useState('');
  const [note, setNote] = useState('');
  const [lastSavedDate, setLastSavedDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await getMyProfile();
      setProfile(p);
      const list = await listCheckIns(p.id);
      setRecords(list);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) setNoProfile(true);
      else toast.error(extractError(err, '打卡记录加载失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const todayRecord = useMemo(
    () => records.find((r) => r.checkin_date?.slice(0, 10) === todayStr()),
    [records],
  );

  // 若今天已打卡，回填表单（同日再次提交=更新）
  useEffect(() => {
    if (!todayRecord) return;
    queueMicrotask(() => {
      setTags(todayRecord.symptom_tags ?? []);
      setSymptoms(todayRecord.symptoms ?? '');
      setHeartRate(todayRecord.heart_rate != null ? String(todayRecord.heart_rate) : '');
      setBloodPressure(todayRecord.blood_pressure ?? '');
      setMood(todayRecord.mood ?? '');
      setNote(todayRecord.note ?? '');
      setLastSavedDate(todayRecord.checkin_date.slice(0, 10));
    });
  }, [todayRecord]);

  const toggleTag = (t: string) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const handleSubmit = async () => {
    if (!profile) return;
    const hr = heartRate.trim() ? Number(heartRate) : null;
    if (hr != null && (!Number.isFinite(hr) || hr < 20 || hr > 250)) {
      toast.error('心率请填写 20–250 之间的数值');
      return;
    }
    setSubmitting(true);
    try {
      await createCheckIn({
        patient_id: profile.id,
        symptom_tags: tags,
        symptoms: symptoms.trim(),
        heart_rate: hr,
        blood_pressure: bloodPressure.trim(),
        mood,
        note: note.trim(),
      });
      toast.success(todayRecord ? '今日打卡已更新' : '打卡成功');
      const list = await listCheckIns(profile.id);
      setRecords(list);
      setLastSavedDate(todayStr());
    } catch (err) {
      toast.error(extractError(err, '提交失败，请稍后重试'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">加载中…</div>;
  }

  if (noProfile) {
    return (
      <div>
        <PageHeader title="健康打卡" description="每日记录症状与身体状态，帮助医生了解居家康复情况" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <HeartPulse className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">尚未建立健康档案</p>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              当前账号未关联患者档案。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="健康打卡" description="每日记录症状与身体状态，帮助医生了解居家康复情况" />

      <div className="grid gap-4 lg:grid-cols-5">
        {/* 打卡表单 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck2 className="h-4 w-4 text-primary" />
              今日打卡
              {lastSavedDate === todayStr() && (
                <Badge variant="outline" className="ml-auto border-primary/40 text-primary">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  已打卡
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>今日症状（可多选）</Label>
              <div className="flex flex-wrap gap-2">
                {SYMPTOM_TAGS.map((t) => {
                  const active = tags.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTag(t)}
                      className={cn(
                        'inline-flex h-8 items-center rounded-full border px-3 text-xs transition-colors',
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground',
                      )}
                    >
                      {active && <Plus className="mr-0.5 h-3 w-3 rotate-45" />}
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ci-symptoms">症状描述</Label>
              <Textarea
                id="ci-symptoms"
                rows={2}
                placeholder="简单描述今天的不适，如：午后轻微胸闷，休息后缓解"
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ci-hr">静息心率（次/分）</Label>
                <Input
                  id="ci-hr"
                  type="number"
                  inputMode="numeric"
                  placeholder="如 72"
                  value={heartRate}
                  onChange={(e) => setHeartRate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ci-bp">血压（mmHg）</Label>
                <Input
                  id="ci-bp"
                  placeholder="如 120/80"
                  value={bloodPressure}
                  onChange={(e) => setBloodPressure(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>今日心情</Label>
              <div className="flex flex-wrap gap-2">
                {MOODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMood(mood === m ? '' : m)}
                    className={cn(
                      'inline-flex h-8 items-center rounded-full border px-3 text-xs transition-colors',
                      mood === m ? MOOD_STYLE[m] : 'border-border bg-background text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ci-note">其他备注</Label>
              <Textarea
                id="ci-note"
                rows={2}
                placeholder="用药、饮食、睡眠、运动等情况"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
              {todayRecord ? '更新今日打卡' : '提交今日打卡'}
            </Button>
          </CardContent>
        </Card>

        {/* 历史记录 */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" />
              历史打卡（近90天）
              <Badge variant="secondary" className="ml-auto">{records.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-14 text-muted-foreground">
                <CalendarCheck2 className="h-9 w-9 opacity-40" />
                <p className="text-sm">暂无打卡记录</p>
              </div>
            ) : (
              <ol className="relative space-y-4 border-l border-border pl-5">
                {records.map((r) => (
                  <li key={r.id} className="relative">
                    <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" />
                    <p className="text-sm font-medium text-foreground">
                      {format(new Date(r.checkin_date), 'yyyy-MM-dd')}
                      {r.mood && (
                        <Badge variant="outline" className={cn('ml-2', MOOD_STYLE[r.mood] ?? '')}>
                          {r.mood}
                        </Badge>
                      )}
                    </p>
                    {(r.symptom_tags?.length ?? 0) > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {r.symptom_tags?.map((t) => (
                          <Badge key={t} variant="outline" className="border-destructive/30 text-destructive">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {r.heart_rate != null && <span>心率 {r.heart_rate} 次/分</span>}
                      {r.blood_pressure && <span>血压 {r.blood_pressure}</span>}
                    </div>
                    {r.symptoms && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{r.symptoms}</p>}
                    {r.note && <p className="mt-0.5 text-xs leading-relaxed text-slate-400">备注：{r.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
