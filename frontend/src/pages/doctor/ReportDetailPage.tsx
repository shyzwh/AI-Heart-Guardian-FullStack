import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, FileType2, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getReport, downloadReport, saveBlob } from '@/api/reports';
import { extractError } from '@/api/http';
import type { IReport } from '@/types';
import { RiskBadge } from '@/components/RiskBadge';
import { WaveformChart } from '@/components/WaveformChart';
import { ShapCharts } from '@/components/ShapCharts';
import { AiInsightPanel } from './AiInsightPanel';
import ReactMarkdown from 'react-markdown';

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const recordId = Number(id);
  const [report, setReport] = useState<IReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(recordId)) {
      toast.error('报告 ID 无效');
      navigate('/doctor/reports');
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

  return (
    <div>
      <PageHeader
        title={`报告 · ${report.patient_name}`}
        description={`记录号 ${report.record_id}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate('/doctor/reports')}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回列表
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
              <CardTitle className="text-base">基本信息</CardTitle>
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
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
              <div>
                <p className="text-xs text-muted-foreground">SHAP</p>
                <p className="mt-0.5 text-lg font-semibold">{report.has_shap ? '已生成' : '未生成'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">筛查报告正文</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none prose-teal max-h-[420px] overflow-auto rounded-lg border border-border bg-background/60 p-4 text-foreground">
              <ReactMarkdown>{report.report_text}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>

        <WaveformChart recordId={recordId} />
        <ShapCharts recordId={recordId} />
        <AiInsightPanel recordId={recordId} />
      </div>
    </div>
  );
}
