import { Construction } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

interface ComingSoonProps {
  title: string;
  description?: string;
}

/** 患者端页面占位：批次4实现。非死链，明确告知建设状态。 */
export default function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div>
      <PageHeader title={title} />
      <div className="flex h-72 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 text-muted-foreground">
        <Construction className="h-9 w-9 opacity-50" />
        <p className="text-sm font-medium">{description || '该模块将在患者端迭代中开放'}</p>
        <p className="text-xs">批次4：我的报告 · 紧急呼救 · 居家康复 · 健康打卡</p>
      </div>
    </div>
  );
}
