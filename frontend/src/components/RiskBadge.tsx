import { cn } from '@/lib/utils';
import { RISK_META, type RiskLevel } from '@/types';

interface RiskBadgeProps {
  level: RiskLevel;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASS = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base',
};

/** 风险等级徽章：低危绿 / 中危琥珀 / 高危红，颜色用语义色不硬编码业务样式。 */
export function RiskBadge({ level, size = 'md', className }: RiskBadgeProps) {
  const meta = RISK_META[level] ?? RISK_META['中危'];
  const toneClass =
    meta.tone === 'success'
      ? 'bg-success/12 text-success border-success/30'
      : meta.tone === 'warning'
        ? 'bg-warning/12 text-warning border-warning/30'
        : 'bg-destructive/12 text-destructive border-destructive/30';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        SIZE_CLASS[size],
        toneClass,
        className,
      )}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: meta.hex }}
      />
      {meta.label}
    </span>
  );
}
