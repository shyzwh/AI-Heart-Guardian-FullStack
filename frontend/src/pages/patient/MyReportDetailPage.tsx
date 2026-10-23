import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, FileType2, Loader2, Info } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getReport, downloadReport, saveBlob } from '@/api/reports';
import { extractError } from '@/api/http';
import type { IReport } from '@/types';
import { RiskBadge } from '@/components/RiskBadge';
import { WaveformChart } from '@/components/WaveformChart';
import { ShapCharts } from '@/components/ShapCharts';
import ReactMarkdown from 'react-markdown';

export default function MyReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const recordId = Number(id);
  const [report, setReport] = useState<IReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(recordId)) {
      toast.error('报告 ID 无效');
      navigate('/patient/reports');
      return;
    }
    getReport(recordId)
      .then(setReport)
      .catch((err) => toast.error(extractError(err, '报告加载失败')))
      .finally(() => setLoading(false));
  }, [recordId, navigate]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await downloadReport(recordId, 'pdf');
      const base = report?.record_id || `report-${recordId}`;
      saveBlob(blob, `${base}.pdf`);
      toast.success('PDF 报告已下载');
    } catch (err) {
      toast.error(extractError(err, '报告导出失败'));
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">加载中…</div>;
  }
  if (!report) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">报告不存在</div>;
  }

  const isHigh = report.risk_level === '高危';

  return (
    <div>
      <PageHeader
        title="我的筛查报告"
        description={`记录号 ${report.record_id}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate('/patient/reports')}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回
            </Button>
            <Button size="sm" onClick={() => void handleDownload()} disabled={downloading}>
              {downloading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileType2 className="mr-1 h-4 w-4" />}
              PDF
            </Button>
          </>
        }
      />

      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-base">筛查结论</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {report.patient_gender}
                {report.patient_age != null ? ` · ${report.patient_age}岁` : ''}
                {' · '}
                {report.file_name}
              </p>
            </div>
            <RiskBadge level={report.risk_level} size="lg" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">风险置信度</p>
                <p className="mt-0.5 text-lg font-semibold">{(report.risk_score * 100).toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">总心拍</p>
                <p className="mt-0.5 text-lg font-semibold">{report.total_beats}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">异常心拍</p>
                <p className={`mt-0.5 text-lg font-semibold ${report.abnormal_beats > 0 ? 'text-destructive' : ''}`}>
                  {report.abnormal_beats}
                </p>
              </div>
            </div>
            <div
              className={`mt-4 flex items-start gap-2 rounded-md border p-2.5 text-sm leading-relaxed ${
                isHigh
                  ? 'border-destructive/30 bg-destructive/5 text-destructive'
                  : 'border-primary/25 bg-primary/5 text-foreground/90'
              }`}
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {isHigh
                  ? '本次筛查风险较高，请尽快联系主治医生或到心内科就诊评估；如出现胸痛、呼吸困难等不适，请立即拨打 120。'
                  : '本结果为 AI 辅助筛查，不能替代医生诊断。请结合自身症状与医生建议，坚持规律作息、合理运动，并按时复查。'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">报告正文</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none prose-teal max-h-[420px] overflow-auto rounded-lg border border-border bg-background/60 p-4 text-foreground">
              <ReactMarkdown>{report.report_text}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>

        <WaveformChart recordId={recordId} />
        <ShapCharts recordId={recordId} />

        <p className="px-1 text-xs leading-relaxed text-muted-foreground">
          本报告由 AI 心电风险辅助筛查系统生成，仅供健康参考，不构成诊断结论；如有疑问请咨询主治医生。
        </p>
      </div>
    </div>
  );
}
