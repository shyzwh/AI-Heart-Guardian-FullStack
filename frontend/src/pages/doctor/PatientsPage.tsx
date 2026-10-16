import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search, Users } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { listPatients, deletePatient } from '@/api/patients';
import { extractError } from '@/api/http';
import type { IPatient } from '@/types';
import { PatientFormDialog } from './PatientFormDialog';

export default function PatientsPage() {
  const [patients, setPatients] = useState<IPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<IPatient | null>(null);
  const [deleting, setDeleting] = useState<IPatient | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const load = () => {
    listPatients()
      .then(setPatients)
      .catch((err) => toast.error(extractError(err, '患者列表加载失败')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint 仅允许在异步回调中 setState；此处订阅外部接口
  }, []);

  // 从分析页“点这里新建”跳入（?new=1）：自动打开新建对话框，并清掉参数避免重复弹出
  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    // 微任务中执行，避免在 effect 同步阶段触发级联渲染
    queueMicrotask(() => {
      setEditing(null);
      setFormOpen(true);
      setSearchParams({}, { replace: true });
    });
  }, [searchParams, setSearchParams]);

  const filtered = useMemo(() => {
    const k = keyword.trim();
    if (!k) return patients;
    return patients.filter(
      (p) => p.name.includes(k) || (p.note || '').includes(k) || p.medication.includes(k),
    );
  }, [patients, keyword]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (p: IPatient) => {
    setEditing(p);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deletePatient(deleting.id);
      toast.success(`已删除患者「${deleting.name}」`);
      setPatients((prev) => prev.filter((p) => p.id !== deleting.id));
    } catch (err) {
      toast.error(extractError(err, '删除失败'));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="患者档案"
        description={`共 ${patients.length} 位患者`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            新建患者
          </Button>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜索姓名 / 用药 / 备注"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">姓名</TableHead>
                  <TableHead className="whitespace-nowrap">性别</TableHead>
                  <TableHead className="whitespace-nowrap">年龄</TableHead>
                  <TableHead className="whitespace-nowrap">身高/体重</TableHead>
                  <TableHead className="whitespace-nowrap">用药情况</TableHead>
                  <TableHead className="whitespace-nowrap">备注</TableHead>
                  <TableHead className="whitespace-nowrap text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      加载中…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                        <Users className="h-8 w-8 opacity-40" />
                        <p className="text-sm">{keyword ? '未找到匹配患者' : '暂无患者档案'}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap font-medium">{p.name}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.gender}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.age ?? '—'}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {p.height_cm != null || p.weight_kg != null
                          ? `${p.height_cm ?? '—'} / ${p.weight_kg ?? '—'}`
                          : '—'}
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <span className="block truncate">{p.medication || '—'}</span>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <span className="block truncate">{p.note || '—'}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label="编辑">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleting(p)}
                            aria-label="删除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <PatientFormDialog
        key={editing?.id ?? 'new'}
        open={formOpen}
        onOpenChange={setFormOpen}
        patient={editing}
        onSaved={load}
      />

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除患者档案</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除患者「{deleting?.name}」吗？该操作不可撤销，其关联的历史记录可能受到影响。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
