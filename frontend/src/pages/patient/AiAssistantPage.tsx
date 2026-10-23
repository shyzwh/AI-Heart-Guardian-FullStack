import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, BarChart3, Bot, Loader2, Send, Sparkles, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { aiAsk } from '@/api/ai';
import { getMyProfile } from '@/api/patients';
import { extractError } from '@/api/http';
import { MarkdownText } from '@/components/MarkdownText';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

interface IExchange {
  id: number;
  question: string;
  answer: string;
}

function getAnswer(data: Record<string, unknown>): string {
  for (const key of ['answer', 'text', 'result']) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

export default function AiAssistantPage() {
  const navigate = useNavigate();
  const [patientId, setPatientId] = useState<number | null>(null);
  const [question, setQuestion] = useState('');
  const [exchanges, setExchanges] = useState<IExchange[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    void getMyProfile()
      .then((profile) => {
        if (!active) return;
        setPatientId(profile.id);
        try {
          const saved = sessionStorage.getItem(`ai_history_${profile.id}`);
          if (saved) {
            const parsed: unknown = JSON.parse(saved);
            if (
              Array.isArray(parsed) &&
              parsed.every(
                (item): item is IExchange =>
                  typeof item === 'object' &&
                  item !== null &&
                  'id' in item &&
                  typeof item.id === 'number' &&
                  'question' in item &&
                  typeof item.question === 'string' &&
                  'answer' in item &&
                  typeof item.answer === 'string',
              )
            ) {
              setExchanges(parsed);
            }
          }
        } catch {
          toast.error('读取问答记录失败');
        }
      })
      .catch((error: unknown) => {
        if (active) toast.error(extractError(error, '患者档案加载失败'));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (patientId === null) return;
    try {
      sessionStorage.setItem(`ai_history_${patientId}`, JSON.stringify(exchanges));
    } catch {
      toast.error('保存问答记录失败');
    }
  }, [patientId, exchanges]);

  const keywords = useMemo(() => {
    const terms = [
      '心电图',
      '胸闷',
      '心悸',
      '心率',
      '血压',
      '失眠',
      '头晕',
      '用药',
      '运动',
      '睡眠',
    ];
    return terms
      .map((term) => ({
        term,
        count: exchanges.reduce((total, exchange) => {
          return total + exchange.question.split(term).length - 1;
        }, 0),
      }))
      .filter(({ count }) => count > 0)
      .sort((first, second) => second.count - first.count);
  }, [exchanges]);
  const maxKeywordCount = keywords[0]?.count ?? 1;

  const sendQuestion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanQuestion = question.trim();
    if (!cleanQuestion) {
      toast.error('请输入要发送的问题');
      return;
    }
    setSending(true);
    try {
      const result = await aiAsk(cleanQuestion);
      if (result.available === false) {
        toast.error(String(result.reason || 'AI 助手暂不可用，请稍后重试'));
        return;
      }
      const answer = getAnswer(result);
      if (!answer) {
        toast.error('AI 助手暂未返回答案，请稍后重试');
        return;
      }
      setExchanges((current) => [
        ...current,
        { id: Date.now(), question: cleanQuestion, answer },
      ]);
      setQuestion('');
    } catch (error) {
      toast.error(extractError(error, 'AI 助手暂不可用，请稍后重试'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="AI 智能问答"
        description="向 AI 助手了解心电健康相关信息"
      />
      <div className="grid gap-4 lg:grid-cols-3">
      <Card className="flex min-h-[60vh] flex-col overflow-hidden lg:col-span-2">
        <div className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-teal-50 to-emerald-50 px-5 py-4 dark:from-teal-950/50 dark:to-emerald-950/40">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-teal-700 shadow-sm dark:bg-card dark:text-teal-300">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">AI 助手</p>
            <p className="text-xs text-muted-foreground">健康信息辅助解读</p>
          </div>
        </div>

        <CardContent className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
          <div className="flex-1 space-y-5">
            {exchanges.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-teal-50/70 to-sky-50/70 px-6 text-center dark:from-teal-950/20 dark:to-sky-950/20">
                <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-teal-700 shadow-sm dark:bg-card dark:text-teal-300">
                  <Bot className="h-7 w-7" />
                </span>
                <h2 className="text-base font-semibold">有什么健康问题想了解？</h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  您可以询问心电报告中的术语或一般健康知识。AI 回复仅供参考，不能替代医生诊断。
                </p>
              </div>
            ) : (
              exchanges.map((exchange) => (
                <article key={exchange.id} className="space-y-4">
                  <div className="flex justify-end gap-2">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground">
                      {exchange.question}
                    </div>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <UserRound className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200">
                      <Bot className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 max-w-[90%] rounded-2xl rounded-bl-md border border-border bg-muted/40 px-4 py-3">
                      <MarkdownText content={exchange.answer} />
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          <form onSubmit={sendQuestion} className="space-y-2 border-t border-border pt-4">
            <Textarea
              value={question}
              maxLength={2000}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="输入您想了解的问题…"
              className="min-h-24 resize-y"
              disabled={sending}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
              AI 助手信息仅供参考，紧急情况请及时就医。
              </p>
              <Button type="submit" disabled={sending || !question.trim()}>
                {sending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1.5 h-4 w-4" />
                )}
                发送问题
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card className="h-fit overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-teal-50 to-emerald-50 p-4 dark:from-teal-950/50 dark:to-emerald-950/40">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-teal-700 shadow-sm dark:bg-card dark:text-teal-300">
            <Activity className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">提问统计</h2>
            <p className="text-xs text-muted-foreground">按历史问题关键词统计</p>
          </div>
        </div>
        <CardContent className="space-y-5 p-4">
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <BarChart3 className="h-3.5 w-3.5" />
              高频提问关键词
            </h3>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
              {exchanges.length}
              <span className="ml-1 text-xs font-normal text-muted-foreground">个问题</span>
            </p>
            <div className="mt-4 space-y-3">
              {keywords.length ? (
                keywords.map(({ term, count }) => (
                  <div
                    key={term}
                    className="space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-foreground">{term}</span>
                      <span className="tabular-nums text-muted-foreground">{count} 次</span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-muted"
                      role="meter"
                      aria-label={`${term}提问词频`}
                      aria-valuemin={0}
                      aria-valuemax={maxKeywordCount}
                      aria-valuenow={count}
                    >
                      <div
                        className="h-full rounded-full bg-primary transition-[width]"
                        style={{ width: `${(count / maxKeywordCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">暂无提问统计</p>
              )}
            </div>
          </div>
          <Button
            className="w-full"
            variant="outline"
            onClick={() => navigate('/consultations')}
          >
            一键转交医生
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
