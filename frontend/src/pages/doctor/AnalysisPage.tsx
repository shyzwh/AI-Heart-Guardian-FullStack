import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { UploadCloud, FileHeart, Loader2, ArrowRight, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { listPatients } from '@/api/patients';
import { analyzeEcg } from '@/api/ecg';
import { extractError } from '@/api/http';
import type { IPatient, IEcgRecord } from '@/types';
import { AnalysisSummary } from '@/components/AnalysisSummary';
import { WaveformChart } from '@/components/WaveformChart';
import { ShapCharts } from '@/components/ShapCharts';

const ACCEPT = '.csv,.txt,.dat';

export default function AnalysisPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<IPatient[]>([]);
  const [patientId, setPatientId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [symptoms, setSymptoms] = useState('');
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<IEcgRecord | null>(null);

  useEffect(() => {
    listPatients()
      .then((list) => {
        setPatients(list);
        if (list.length) setPatientId(String(list[0].id));
      })
      .catch((err) => toast.error(extractError(err, '患者列表加载失败')))
      .finally(() => setLoadingPatients(false));
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ok = /\.(csv|txt|dat)$/i.test(f.name);
    if (!ok) {
      toast.error('仅支持 CSV / TXT / DAT 格式');
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleAnalyze = async () => {
    if (!patientId) {
      toast.error('请先选择患者');
      return;
    }
    if (!file) {
      toast.error('请上传心电数据文件');
      return;
    }
    setAnalyzing(true);
    try {
      const rec = await analyzeEcg({
        patientId: Number(patientId),
        file,
        symptoms: symptoms.trim(),
      });
      setResult(rec);
      toast.success('分析完成');
    } catch (err) {
      toast.error(extractError(err, '心电分析失败'));
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="心电分析"
        description="上传单导联心电数据，运行 XGBoost + 1D-CNN 双通路风险辅助筛查"
        actions={
          result && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/doctor/reports/${result.id}`)}>
              查看完整报告
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )
        }
      />

      <Card className="mb-5">
        <CardContent className="grid gap-4 p-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">选择患者</label>
            <Select value={patientId} onValueChange={setPatientId} disabled={loadingPatients}>
              <SelectTrigger>
                <SelectValue placeholder={loadingPatients ? '加载中…' : '请选择患者'} />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                    {p.age != null ? ` · ${p.age}岁` : ''}
                  </SelectItem>
                ))}
                {/* 快捷新建：放在选项末尾，点击跳转患者档案页（用非患者id避免被当成选中项） */}
                <div
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-primary hover:bg-accent"
                  onClick={() => navigate('/doctor/patients?new=1')}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <UserPlus className="h-4 w-4" />
                  新建患者
                </div>
              </SelectContent>
            </Select>
            {patients.length === 0 && !loadingPatients && (
              <button
                type="button"
                onClick={() => navigate('/doctor/patients?new=1')}
                className="flex w-full items-center gap-1.5 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-2 text-left text-xs font-medium text-warning transition-colors hover:bg-warning/15"
              >
                <UserPlus className="h-3.5 w-3.5 shrink-0" />
                新建患者档案
              </button>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-foreground">症状描述（选填）</label>
            <Textarea
              placeholder="如：偶发胸闷、心悸、活动后气促…"
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              className="min-h-[44px] resize-y"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block">
              <div className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-background/50 px-4 py-7 text-center transition-colors hover:border-primary/50 hover:bg-accent/40">
                {file ? (
                  <>
                    <FileHeart className="mb-2 h-7 w-7 text-primary" />
                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB · 点击可重新选择
                    </p>
                  </>
                ) : (
                  <>
                    <UploadCloud className="mb-2 h-7 w-7 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">
                      点击上传心电文件
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      支持 CSV / TXT / DAT
                    </p>
                  </>
                )}
                <input
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  onChange={onFileChange}
                />
              </div>
            </label>
          </div>

          <div className="md:col-span-3 flex justify-end">
            <Button onClick={handleAnalyze} disabled={analyzing || !file || !patientId}>
              {analyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  模型推理中，请稍候…
                </>
              ) : (
                '开始分析'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          <AnalysisSummary record={result} />
          <WaveformChart recordId={result.id} />
          <ShapCharts recordId={result.id} />
        </div>
      )}
    </div>
  );
}
