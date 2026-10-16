import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createPatient, updatePatient } from '@/api/patients';
import { extractError } from '@/api/http';
import type { IPatient, IPatientPayload } from '@/types';

interface PatientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient?: IPatient | null;
  onSaved: () => void;
}

interface IFormState {
  name: string;
  gender: string;
  age: string;
  height_cm: string;
  weight_kg: string;
  medication: string;
  note: string;
}

const EMPTY: IFormState = {
  name: '',
  gender: '未指定',
  age: '',
  height_cm: '',
  weight_kg: '',
  medication: '',
  note: '',
};

export function PatientFormDialog({
  open,
  onOpenChange,
  patient,
  onSaved,
}: PatientFormDialogProps) {
  const [form, setForm] = useState<IFormState>(() =>
    patient
      ? {
          name: patient.name,
          gender: patient.gender,
          age: patient.age != null ? String(patient.age) : '',
          height_cm: patient.height_cm != null ? String(patient.height_cm) : '',
          weight_kg: patient.weight_kg != null ? String(patient.weight_kg) : '',
          medication: patient.medication,
          note: patient.note,
        }
      : EMPTY,
  );
  const [saving, setSaving] = useState(false);

  const set = (key: keyof IFormState) => (v: string) =>
    setForm((prev) => ({ ...prev, [key]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('请填写患者姓名');
      return;
    }
    const payload: IPatientPayload = {
      name: form.name.trim(),
      gender: form.gender,
      age: form.age ? Number(form.age) : null,
      height_cm: form.height_cm ? Number(form.height_cm) : null,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      medication: form.medication.trim(),
      note: form.note.trim(),
    };
    setSaving(true);
    try {
      if (patient) {
        await updatePatient(patient.id, payload);
        toast.success('档案已更新');
      } else {
        await createPatient(payload);
        toast.success('档案已创建');
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{patient ? '编辑患者档案' : '新建患者档案'}</DialogTitle>
          <DialogDescription>
            档案信息用于心电报告与康养方案生成
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">姓名 *</Label>
            <Input id="p-name" value={form.name} onChange={(e) => set('name')(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>性别</Label>
            <Select value={form.gender} onValueChange={set('gender')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="男">男</SelectItem>
                <SelectItem value="女">女</SelectItem>
                <SelectItem value="未指定">未指定</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-age">年龄</Label>
            <Input
              id="p-age"
              type="number"
              min={0}
              max={120}
              value={form.age}
              onChange={(e) => set('age')(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-height">身高 (cm)</Label>
            <Input
              id="p-height"
              type="number"
              value={form.height_cm}
              onChange={(e) => set('height_cm')(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-weight">体重 (kg)</Label>
            <Input
              id="p-weight"
              type="number"
              value={form.weight_kg}
              onChange={(e) => set('weight_kg')(e.target.value)}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="p-med">用药情况</Label>
            <Input
              id="p-med"
              placeholder="如：阿司匹林、美托洛尔…"
              value={form.medication}
              onChange={(e) => set('medication')(e.target.value)}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="p-note">备注</Label>
            <Textarea
              id="p-note"
              value={form.note}
              onChange={(e) => set('note')(e.target.value)}
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
