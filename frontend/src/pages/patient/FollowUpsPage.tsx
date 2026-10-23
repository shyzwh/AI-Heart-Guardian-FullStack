import { useEffect, useState } from 'react';
import { CalendarClock, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import { format, isValid, parseISO } from 'date-fns';
import { listFollowUps } from '@/api/wellness';
import { extractError } from '@/api/http';
import type { IFollowUp } from '@/types';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

function formatDate(value: string | null): string {
  if (!value) return '未设定';
  const date = parseISO(value);
  return isValid(date) ? format(date, 'yyyy-MM-dd HH:mm') : value;
}

export default function PatientFollowUpsPage() {
  const [items, setItems] = useState<IFollowUp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void listFollowUps()
      .then((result) => {
        if (active) setItems(result);
      })
      .catch((error: unknown) => {
        if (active) toast.error(extractError(error, '随访计划加载失败'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <PageHeader title="随访计划" description="查看医生安排的随访和随访结果" />
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            加载中…
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <CalendarClock className="h-8 w-8 opacity-40" />
            <p className="text-sm">暂无相关记录</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{formatDate(item.due_date)}</span>
                    {item.status === 'done' ? (
                      <Badge variant="secondary" className="text-success">已完成</Badge>
                    ) : (
                      <Badge variant="outline">待随访</Badge>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-foreground">
                    {item.content || '医生尚未填写随访内容'}
                  </p>
                  {item.result && (
                    <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/30">
                      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        随访结果
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                        {item.result}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
