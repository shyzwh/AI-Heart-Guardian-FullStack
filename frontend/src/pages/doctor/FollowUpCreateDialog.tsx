import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CalendarDays } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createFollowUp } from '@/api/wellness';
import { listPatients, listRecords } from '@/api';
import { extractError } from '@/api/http';
import type { IPatient, IEcgRecordSummary } from '@/types';

interface FollowUpCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function FollowUpCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: FollowUpCreateDialogProps) {
  const [patients, setPatients] = useState<IPatient[]>([]);
  const [records, setRecords] = useState<IEcgRecordSummary[]>([]);
  const [patientId, setPatientId] = useState('');
  const [recordId, setRecordId] = useState('none');
  const [dueDate, setDueDate] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      Promise.all([listPatients(), listRecords()])
        .then(([ps, rs]) => {
          setPatients(ps);
          setRecords(rs);
          if (ps.length) setPatientId(String(ps[0].id));
        })
        .catch((err) => toast.error(extractError(err, '数据加载失败')));
    }
  }, [open]);

  const patientRecords = records.filter((r) => r.patient_id === Number(patientId));

  const handleSave = async () => {
    if (!patientId) {
      toast.error('请选择患者');
      return;
    }
    setSaving(true);
    try {
      // datetime-local → ISO；不填则后端默认
      const iso = dueDate ? new Date(dueDate).toISOString() : undefined;
      await createFollowUp({
        patient_id: Number(patientId),
        ecg_record_id: recordId !== 'none' ? Number(recordId) : undefined,
        due_date: iso,
        content: content.trim(),
      });
      toast.success('随访已创建');
      setContent('');
      setDueDate('');
      setRecordId('none');
      onCreated();
      onOpenChange(false);
    } catch (err) {
      toast.error(extractError(err, '创建失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>新建随访提醒</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>
              患者 <span className="text-destructive">*</span>
            </Label>
            <Select value={patientId} onValueChange={(v) => { setPatientId(v); setRecordId('none'); }}>
              <SelectTrigger>
                <SelectValue placeholder="选择患者" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>关联心电记录（选填）</Label>
            <Select value={recordId} onValueChange={setRecordId}>
              <SelectTrigger>
                <SelectValue placeholder="不关联" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不关联</SelectItem>
                {patientRecords.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.file_name} · {r.risk_level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="due">随访时间（选填）</Label>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="due"
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="border-input h-10 w-full rounded-md border bg-transparent pl-9 pr-3 text-sm outline-none transition-[color,box-shadow] enabled:hover:border-ring focus-visible:border-ring focus-visible:ring-ring/20 focus-visible:ring-[3px] [color-scheme:light]"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fu-content">随访内容</Label>
            <Textarea
              id="fu-content"
              placeholder="如：两周后复查心电图，关注心悸症状变化…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} type="button">取消</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '创建中…' : '创建'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
