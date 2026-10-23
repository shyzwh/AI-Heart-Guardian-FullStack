import { useState } from 'react';
import { toast } from 'sonner';
import {
  Sparkles,
  Loader2,
  Wand2,
  Stethoscope,
  MessageCircleQuestion,
  AlertTriangle,
  ClipboardList,
  Search,
  Lightbulb,
  Gauge,
  Siren,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { polishReport, aiDiagnosis, aiAsk } from '@/api/ai';
import { extractError } from '@/api/http';
import { MarkdownText } from '@/components/MarkdownText';

function pickText(data: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = data[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return '';
}

/** /ai/diagnosis 返回的结构化第二意见（字段对齐 src/llm_client）。 */
interface IAiDiagnosis {
  risk_summary?: string;
  etiology_analysis?: string;
  feature_explanations?: { feature?: string; value?: unknown; explanation?: string }[];
  shap_interpretation?: string;
  lifestyle_advice?: string;
  emergency_warning?: string;
}

const DIAG_SECTIONS: {
  key: keyof Pick<IAiDiagnosis, 'risk_summary' | 'etiology_analysis' | 'shap_interpretation' | 'lifestyle_advice'>;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: 'risk_summary', label: '风险总结', icon: ClipboardList },
  { key: 'etiology_analysis', label: '病因分析', icon: Search },
  { key: 'shap_interpretation', label: 'SHAP 关键归因', icon: Gauge },
  { key: 'lifestyle_advice', label: '生活建议', icon: Lightbulb },
];

function DiagnosisView({ data }: { data: IAiDiagnosis }) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-background/60 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <Stethoscope className="h-3.5 w-3.5" />
        智能诊断 · 结构化第二意见
      </p>

      {DIAG_SECTIONS.map(({ key, label, icon: Icon }) => {
        const text = data[key];
        if (!text || !text.trim()) return null;
        return (
          <div key={key} className="space-y-1">
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Icon className="h-3.5 w-3.5 text-primary" />
              {label}
            </p>
            <p className="pl-5 text-sm leading-relaxed text-muted-foreground">{text}</p>
          </div>
        );
      })}

      {Array.isArray(data.feature_explanations) && data.feature_explanations.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">关键特征解读</p>
          <ul className="space-y-1 pl-5">
            {data.feature_explanations.slice(0, 3).map((f, i) => (
              <li key={i} className="text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">
                  {f.feature}
                  {f.value != null && f.value !== '' ? `（${String(f.value)}）` : ''}
                </span>
                {f.explanation ? `：${f.explanation}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.emergency_warning && data.emergency_warning.trim() && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5">
          <Siren className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm leading-relaxed text-destructive">{data.emergency_warning}</p>
        </div>
      )}
    </div>
  );
}

/** AI 报告润色 / 智能诊断 / 自由问答。密钥缺失或失败时后端返回 available=false。 */
export function AiInsightPanel({ recordId }: { recordId: number }) {
  const [polish, setPolish] = useState('');
  const [diagnosis, setDiagnosis] = useState<IAiDiagnosis | null>(null);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState<'' | 'polish' | 'diag' | 'ask'>('');
  const [question, setQuestion] = useState('');
  const [notice, setNotice] = useState('');

  const run = async (kind: 'polish' | 'diag') => {
    setBusy(kind);
    setNotice('');
    try {
      const data = kind === 'polish' ? await polishReport(recordId) : await aiDiagnosis(recordId);
      if (data.available === false) {
        const reason = String(data.reason || 'AI 服务暂不可用');
        setNotice(reason);
        toast.error(reason);
        return;
      }
      if (kind === 'polish') {
        const text = pickText(data, ['text', 'polished', 'report']);
        if (text) setPolish(text);
        else {
          setNotice('未获取到润色内容，请稍后重试');
        }
      } else {
        // 智能诊断返回结构化对象（diagnosis 字段）
        const diag = (data.diagnosis as IAiDiagnosis | null) ?? null;
        if (diag && typeof diag === 'object') {
          setDiagnosis(diag);
        } else {
          // 兼容后端偶发返回纯文本的情况
          const fallbackText = pickText(data, ['text', 'result']);
          if (fallbackText) setDiagnosis({ risk_summary: fallbackText });
          else setNotice('未获取到诊断结果，请稍后重试');
        }
      }
    } catch (err) {
      const msg = extractError(err, 'AI 请求失败');
      setNotice(msg);
      toast.error(msg);
    } finally {
      setBusy('');
    }
  };

  const ask = async () => {
    if (!question.trim()) {
      toast.error('请输入要发送的问题');
      return;
    }
    setBusy('ask');
    setNotice('');
    try {
      const data = await aiAsk(question.trim());
      if (data.available === false) {
        const reason = String(data.reason || 'AI 服务暂不可用');
        setNotice(reason);
        toast.error(reason);
        return;
      }
      setAnswer(pickText(data, ['answer', 'text', 'result']));
    } catch (err) {
      const msg = extractError(err, 'AI 请求失败');
      setNotice(msg);
      toast.error(msg);
    } finally {
      setBusy('');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4.5 w-4.5 text-primary" />
          AI 智能解读
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => run('polish')} disabled={!!busy}>
            {busy === 'polish' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1 h-4 w-4" />}
            报告润色
          </Button>
          <Button variant="outline" size="sm" onClick={() => run('diag')} disabled={!!busy}>
            {busy === 'diag' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Stethoscope className="mr-1 h-4 w-4" />}
            智能诊断
          </Button>
        </div>

        {polish && (
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <p className="mb-1 text-xs font-medium text-primary">报告润色</p>
            <MarkdownText content={polish} />
          </div>
        )}
        {diagnosis && <DiagnosisView data={diagnosis} />}

        {notice && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-sm leading-relaxed text-foreground">{notice}</p>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MessageCircleQuestion className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">AI 智能问答</span>
          </div>
          <Textarea
            placeholder="如：该患者的 QT 间期是否需要关注？"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={ask} disabled={busy === 'ask'}>
              {busy === 'ask' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              发送问题
            </Button>
          </div>
          {answer && (
            <div className="rounded-lg border border-border bg-background/60 p-3">
              <MarkdownText content={answer} />
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          AI 解读由大模型生成，仅供参考，不能替代执业医师的临床判断。
        </p>
      </CardContent>
    </Card>
  );
}
