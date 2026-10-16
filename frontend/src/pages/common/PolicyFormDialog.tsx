import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CalendarDays } from 'lucide-react';
import { createPolicy, updatePolicy, type IPolicyPayload } from '@/api/policy';
import { extractError } from '@/api/http';
import type { IPolicy } from '@/types';

interface PolicyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy?: IPolicy | null;
  onSaved: () => void;
}

interface IForm {
  title: string;
  category: string;
  source: string;
  source_url: string;
  published_at: string;
  summary: string;
  content: string;
}

const EMPTY: IForm = {
  title: '',
  category: '',
  source: '',
  source_url: '',
  published_at: '',
  summary: '',
  content: '',
};

export function PolicyFormDialog({ open, onOpenChange, policy, onSaved }: PolicyFormDialogProps) {
  const [form, setForm] = useState<IForm>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      if (policy) {
        setForm({
          title: policy.title,
          category: policy.category,
          source: policy.source,
          source_url: policy.source_url,
          published_at: policy.published_at ?? '',
          summary: policy.summary,
          content: policy.content,
        });
      } else {
        setForm(EMPTY);
      }
    });
  }, [open, policy]);

  const set = (key: keyof IForm) => (v: string) =>
    setForm((prev) => ({ ...prev, [key]: v }));

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('请填写政策标题');
      return;
    }
    const payload: IPolicyPayload = {
      title: form.title.trim(),
      category: form.category.trim(),
      source: form.source.trim(),
      source_url: form.source_url.trim(),
      published_at: form.published_at || null,
      summary: form.summary.trim(),
      content: form.content.trim(),
    };
    setSaving(true);
    try {
      if (policy) {
        await updatePolicy(policy.id, payload);
        toast.success('政策已更新');
      } else {
        await createPolicy(payload);
        toast.success('政策已发布');
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(extractError(err, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{policy ? '编辑政策资讯' : '新增政策资讯'}</DialogTitle>
          <DialogDescription>
            请填写真实政策信息，标题、发布机构与日期以官方发布为准
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pl-title">标题 *</Label>
            <Input
              id="pl-title"
              placeholder="政策文件全称"
              value={form.title}
              onChange={(e) => set('title')(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pl-cat">分类</Label>
              <Input
                id="pl-cat"
                placeholder="如：智慧养老 / 心脑血管防治"
                value={form.category}
                onChange={(e) => set('category')(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pl-date">发布日期</Label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="pl-date"
                  type="date"
                  value={form.published_at}
                  onChange={(e) => set('published_at')(e.target.value)}
                  className="border-input h-10 w-full rounded-md border bg-transparent pl-9 pr-3 text-sm outline-none transition-[color,box-shadow] enabled:hover:border-ring focus-visible:border-ring focus-visible:ring-ring/20 focus-visible:ring-[3px] [color-scheme:light]"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pl-source">发布机构</Label>
            <Input
              id="pl-source"
              placeholder="如：国务院办公厅"
              value={form.source}
              onChange={(e) => set('source')(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pl-url">原文链接</Label>
            <Input
              id="pl-url"
              type="url"
              placeholder="https://…"
              value={form.source_url}
              onChange={(e) => set('source_url')(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pl-summary">摘要</Label>
            <Textarea
              id="pl-summary"
              placeholder="一句话概括政策要点"
              value={form.summary}
              onChange={(e) => set('summary')(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pl-content">正文</Label>
            <Textarea
              id="pl-content"
              className="min-h-32"
              placeholder="政策背景性介绍（避免虚构具体条款编号与量化指标）"
              value={form.content}
              onChange={(e) => set('content')(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} type="button">
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
