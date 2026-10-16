import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, CheckCircle2, CalendarClock } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { listFollowUps, completeFollowUp } from '@/api/wellness';
import { listPatients } from '@/api/patients';
import { extractError } from '@/api/http';
import type { IFollowUp, IPatient } from '@/types';
import { FollowUpCreateDialog } from './FollowUpCreateDialog';

function fmt(dt: string | null): string {
  if (!dt) return '未设定';
  const d = parseISO(dt);
  return isValid(d) ? format(d, 'yyyy-MM-dd HH:mm') : dt;
}

export default function FollowUpsPage() {
  const [items, setItems] = useState<IFollowUp[]>([]);
  const [patients, setPatients] = useState<IPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'done' | 'all'>('pending');
  const [createOpen, setCreateOpen] = useState(false);
  // 用 initializer 取一次当前时刻，避免 render 期直接调用 Date.now()
  const [nowTs] = useState(() => Date.now());

  const load = () => {
    Promise.all([listFollowUps(), listPatients()])
      .then(([fs, ps]) => {
        setItems(fs);
        setPatients(ps);
      })
      .catch((err) => toast.error(extractError(err, '随访列表加载失败')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const patientName = (id: number) => patients.find((p) => p.id === id)?.name ?? `#${id}`;

  const shown = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      // 待办且有期限的按时间升序在前
      return (a.due_date ?? 'z').localeCompare(b.due_date ?? 'z');
    });
    if (tab === 'all') return sorted;
    return sorted.filter((f) => (tab === 'done' ? f.status === 'done' : f.status !== 'done'));
  }, [items, tab]);

  const overdue = (f: IFollowUp) =>
    f.status !== 'done' && f.due_date && new Date(f.due_date).getTime() < nowTs;

  const handleDone = async (f: IFollowUp) => {
    try {
      const updated = await completeFollowUp(f.id);
      setItems((prev) => prev.map((x) => (x.id === f.id ? updated : x)));
      toast.success('随访已完成');
    } catch (err) {
      toast.error(extractError(err, '操作失败'));
    }
  };

  return (
    <div>
      <PageHeader
        title="随访提醒"
        description="跟踪患者复查与康复随访"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            新建随访
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mb-4">
        <TabsList>
          <TabsTrigger value="pending">待随访</TabsTrigger>
          <TabsTrigger value="done">已完成</TabsTrigger>
          <TabsTrigger value="all">全部</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">患者</TableHead>
                  <TableHead className="whitespace-nowrap">随访时间</TableHead>
                  <TableHead>内容</TableHead>
                  <TableHead className="whitespace-nowrap">状态</TableHead>
                  <TableHead className="whitespace-nowrap text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">加载中…</TableCell>
                  </TableRow>
                ) : shown.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                        <CalendarClock className="h-8 w-8 opacity-40" />
                        <p className="text-sm">暂无随访安排</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  shown.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="whitespace-nowrap font-medium">{patientName(f.patient_id)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className={overdue(f) ? 'text-destructive font-medium' : ''}>
                          {fmt(f.due_date)}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        <span className="block truncate">{f.content || '—'}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {f.status === 'done' ? (
                          <Badge variant="secondary" className="text-success">已完成</Badge>
                        ) : overdue(f) ? (
                          <Badge variant="outline" className="border-destructive/40 text-destructive">已逾期</Badge>
                        ) : (
                          <Badge variant="outline">待随访</Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        {f.status !== 'done' && (
                          <Button variant="outline" size="sm" onClick={() => handleDone(f)}>
                            <CheckCircle2 className="mr-1 h-4 w-4" />
                            标记完成
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <FollowUpCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
    </div>
  );
}
