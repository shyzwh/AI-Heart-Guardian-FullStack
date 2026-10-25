import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Activity,
  ArrowLeft,
  Phone,
  PhoneCall,
  Plus,
  Pencil,
  Trash2,
  Star,
  ShieldAlert,
  UserCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { listContacts, createContact, deleteContact, triggerSos } from '@/api/wellness';
import { useAuthStore } from '@/store/auth';
import { getDeviceKey } from '@/lib/deviceKey';
import type { IContact } from '@/types';

interface IFormState {
  name: string;
  relation: string;
  phone: string;
  is_primary: boolean;
}

const EMPTY_FORM: IFormState = { name: '', relation: '', phone: '', is_primary: false };

/** 宽松校验：大陆手机号 或 带区号座机（3-4位区号-7-8位号码）。 */
function isValidPhone(phone: string): boolean {
  const mobile = /^1[3-9]\d{9}$/;
  const landline = /^0\d{2,3}-?\d{7,8}$/;
  return mobile.test(phone) || landline.test(phone);
}

export default function SosPage() {
  const navigate = useNavigate();
  const { role, user, hydrated, logout } = useAuthStore();
  const isPatient = role === 'patient';

  // 登录患者也带上 device_key：既能看到本人档案联系人，也能看到本浏览器历史匿名联系人
  const deviceKey = useMemo(() => getDeviceKey(), []);
  // 新增联系人归属：登录患者归到本人档案（不带 device_key）；匿名则绑定本设备
  const deviceKeyForCreate = isPatient ? undefined : deviceKey;

  const [contacts, setContacts] = useState<IContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<IContact | null>(null);
  const [form, setForm] = useState<IFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<IContact | null>(null);

  const load = useCallback(
    async (showSpinner: boolean) => {
      // showSpinner 仅用于首次挂载（初始 loading 已为 true）；
      // 增删改后的刷新不重开全屏 loading，避免列表闪烁。
      if (showSpinner) setLoading(true);
      try {
        const data = await listContacts(deviceKey);
        setContacts(data);
      } catch {
        toast.error('联系人加载失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    },
    [deviceKey],
  );

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await listContacts(deviceKey);
        if (!cancelled) setContacts(data);
      } catch {
        if (!cancelled) toast.error('联系人加载失败，请稍后重试');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, deviceKey]);

  const primary = contacts.find((c) => c.is_primary) ?? contacts[0] ?? null;

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, is_primary: contacts.length === 0 });
    setFormOpen(true);
  };

  const openEdit = (c: IContact) => {
    setEditing(c);
    setForm({
      name: c.name,
      relation: c.relation ?? '',
      phone: c.phone,
      is_primary: !!c.is_primary,
    });
    setFormOpen(true);
  };

  const submit = async () => {
    const name = form.name.trim();
    const relation = form.relation.trim();
    const phone = form.phone.trim();
    if (!name) {
      toast.error('请填写联系人姓名');
      return;
    }
    if (!isValidPhone(phone)) {
      toast.error('请填写正确的手机号或座机号（如 13800138000）');
      return;
    }
    setSaving(true);
    try {
      // 编辑 = 删除旧联系人 + 用新内容重建（后端未提供 PUT，匿名/本人范围一致）
      if (editing) {
        await deleteContact(editing.id, deviceKey);
      }
      await createContact(
        { name, relation, phone, is_primary: form.is_primary },
        deviceKeyForCreate,
      );
      toast.success(editing ? '联系人已更新' : '联系人已添加');
      setFormOpen(false);
      await load(false);
    } catch {
      toast.error('保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteContact(target.id, deviceKey);
      toast.success('联系人已删除');
      await load(false);
    } catch {
      toast.error('删除失败，请稍后重试');
    }
  };

  /** 呼救：先经后端解析首选联系人，再由前端 tel: 唤起系统拨号（系统不代拨）。 */
  const callSos = async () => {
    try {
      const result = await triggerSos(deviceKey, undefined);
      const target = result.dial || (primary ? primary.phone : null);
      if (target) {
        window.location.href = `tel:${target.replace(/[^0-9+]/g, '')}`;
      } else {
        toast.message('尚未添加紧急联系人，已为你显示 120 急救入口');
      }
    } catch {
      // 后端不可用时仍允许直接拨打本地首选联系人
      if (primary) {
        window.location.href = `tel:${primary.phone.replace(/[^0-9+]/g, '')}`;
      } else {
        toast.error('暂时无法发起呼救，请直接拨打 120');
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部品牌条 */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border/70 bg-background/85 px-4 backdrop-blur-md">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/login')}
          aria-label="返回登录页"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          返回
        </Button>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Activity className="h-4.5 w-4.5" />
        </div>
        <span className="text-sm font-semibold">AI护心镜 · 紧急呼救</span>
        <div className="ml-auto flex items-center gap-2 text-sm">
          {isPatient ? (
            <>
              <span className="hidden items-center gap-1 text-muted-foreground sm:flex">
                <UserCircle2 className="h-4 w-4" />
                {user?.display_name || '患者'}
              </span>
              <Button variant="ghost" size="sm" onClick={logout}>
                退出
              </Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">紧急呼救</span>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        {/* 一键呼救主区 */}
        <Card className="overflow-hidden border-destructive/30">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center sm:p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <PhoneCall className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">一键紧急呼救</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {primary
                  ? `将优先呼叫${primary.relation ? `「${primary.relation}」` : ''} ${primary.name}`
                  : '尚未设置紧急联系人，请先在下方添加'}
              </p>
            </div>
            <Button
              size="lg"
              variant="destructive"
              className="h-14 w-full max-w-xs gap-2 text-base"
              onClick={callSos}
            >
              <Phone className="h-5 w-5" />
              {primary ? `立即呼救 · ${primary.phone}` : '立即呼救'}
            </Button>

            <div className="mt-1 flex w-full max-w-xs flex-col gap-2">
              <Button
                variant="outline"
                size="lg"
                className="h-12 gap-2 border-destructive/40 text-destructive"
                onClick={() => {
                  window.location.href = 'tel:120';
                }}
              >
                <ShieldAlert className="h-5 w-5" />
                拨打急救电话 120
              </Button>
              <p className="text-xs leading-relaxed text-muted-foreground">
                点击按钮将唤起本机拨号界面，由你确认后拨出，系统不会自动代拨。
                情况危急时请第一时间拨打 <span className="font-medium text-destructive">120</span>。
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 联系人管理 */}
        <Card className="mt-5">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">紧急联系人</CardTitle>
            <Button size="sm" onClick={openCreate} className="gap-1.5">
              <Plus className="h-4 w-4" />
              添加联系人
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">正在加载…</p>
            ) : contacts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Phone className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  暂无紧急联系人，至少添加一位联系人。
                </p>
                <Button size="sm" variant="outline" onClick={openCreate} className="mt-1 gap-1.5">
                  <Plus className="h-4 w-4" />
                  立即添加
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {contacts.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <UserCircle2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{c.name}</span>
                        {c.is_primary && (
                          <Badge variant="secondary" className="gap-0.5 text-xs">
                            <Star className="h-3 w-3 fill-current" />
                            首选
                          </Badge>
                        )}
                        {c.device_key && !c.patient_id && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            本机
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.relation ? `${c.relation} · ` : ''}
                        {c.phone}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`呼叫 ${c.name}`}
                      onClick={() => {
                        window.location.href = `tel:${c.phone.replace(/[^0-9+]/g, '')}`;
                      }}
                    >
                      <Phone className="h-4 w-4 text-success" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`编辑 ${c.name}`}
                      onClick={() => openEdit(c)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`删除 ${c.name}`}
                      onClick={() => setPendingDelete(c)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {!isPatient && (
              <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                未登录状态下，联系人保存在当前浏览器（设备标识已自动生成）。登录患者账号后，
                仍可在本页看到这些联系人。
              </p>
            )}
          </CardContent>
        </Card>
      </main>

      {/* 添加 / 编辑联系人 */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? '编辑联系人' : '添加紧急联系人'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="sos-name">
                姓名 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="sos-name"
                value={form.name}
                maxLength={30}
                placeholder="如：张女士"
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sos-relation">关系</Label>
              <Input
                id="sos-relation"
                value={form.relation}
                maxLength={20}
                placeholder="如：女儿 / 配偶 / 照护者"
                onChange={(e) => setForm((f) => ({ ...f, relation: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sos-phone">
                电话 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="sos-phone"
                inputMode="tel"
                value={form.phone}
                maxLength={13}
                placeholder="手机号或座机，如 13800138000"
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[hsl(187_65%_33%)]"
                checked={form.is_primary}
                onChange={(e) => setForm((f) => ({ ...f, is_primary: e.target.checked }))}
              />
              设为首选联系人（一键呼救优先拨打）
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              取消
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(v) => !v && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除该联系人？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除「{pendingDelete?.name} {pendingDelete?.phone}」，此操作不可撤销。
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
