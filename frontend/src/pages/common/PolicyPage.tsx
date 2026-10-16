import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Newspaper,
  ExternalLink,
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { listPolicies, deletePolicy } from '@/api/policy';
import { extractError } from '@/api/http';
import { useAuthStore } from '@/store/auth';
import type { IPolicy } from '@/types';
import { PolicyFormDialog } from './PolicyFormDialog';

function fmtDate(d: string | null): string {
  if (!d) return '';
  const dt = parseISO(d);
  return isValid(dt) ? format(dt, 'yyyy-MM-dd') : d;
}

export default function PolicyPage() {
  const role = useAuthStore((s) => s.role);
  const canManage = role === 'doctor';

  const [items, setItems] = useState<IPolicy[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<IPolicy | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<IPolicy | null>(null);
  const [removing, setRemoving] = useState<IPolicy | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    return listPolicies()
      .then((data) => {
        setItems(data);
        setCategories([...new Set(data.map((p) => p.category).filter(Boolean))]);
      })
      .catch((err) => toast.error(extractError(err, '政策资讯加载失败')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(
    () => (category === 'all' ? items : items.filter((p) => p.category === category)),
    [items, category],
  );

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (p: IPolicy) => {
    setActive(null);
    setEditing(p);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!removing) return;
    setDeleting(true);
    try {
      await deletePolicy(removing.id);
      toast.success('政策已删除');
      setRemoving(null);
      setActive(null);
      await load();
    } catch (err) {
      toast.error(extractError(err, '删除失败'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="政策资讯"
        description="国家康养、智慧养老与心脑血管防治政策汇编"
        actions={
          <div className="flex items-center gap-2">
            <div className="w-44">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="全部分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部分类</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {canManage && (
              <Button size="sm" onClick={openCreate}>
                <Plus className="mr-1 h-4 w-4" />
                新增
              </Button>
            )}
          </div>
        }
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">加载中…</div>
      ) : shown.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
          <Newspaper className="h-8 w-8 opacity-40" />
          <p className="text-sm">暂无政策资讯</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shown.map((p) => (
            <Card
              key={p.id}
              className="group cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => setActive(p)}
            >
              <CardContent className="p-5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{p.category}</Badge>
                    {p.published_at && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />
                        {fmtDate(p.published_at)}
                      </span>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(p);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRemoving(p);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                  {p.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                  {p.summary}
                </p>
                <p className="mt-3 text-xs text-primary">{p.source}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <DialogContent className="max-w-2xl">
          {active && (
            <>
              <DialogHeader>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{active.category}</Badge>
                  <span className="text-xs text-muted-foreground">{active.source}</span>
                  {active.published_at && (
                    <span className="text-xs text-muted-foreground">
                      {fmtDate(active.published_at)}
                    </span>
                  )}
                </div>
                <DialogTitle className="leading-snug">{active.title}</DialogTitle>
                <DialogDescription className="sr-only">政策正文</DialogDescription>
              </DialogHeader>
              <div className="max-h-[60vh] overflow-auto">
                <p className="mb-3 text-sm font-medium text-foreground">{active.summary}</p>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                  {active.content}
                </div>
                {active.source_url && (
                  <a
                    href={active.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    查看原文
                  </a>
                )}
              </div>
              {canManage && (
                <div className="flex justify-end gap-2 border-t border-border pt-3">
                  <Button variant="outline" size="sm" onClick={() => openEdit(active)}>
                    <Pencil className="mr-1 h-4 w-4" />
                    编辑
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setRemoving(active)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    删除
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <PolicyFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        policy={editing}
        onSaved={load}
      />

      <AlertDialog open={!!removing} onOpenChange={(v) => !v && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除政策资讯</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除「{removing?.title}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? '删除中…' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
