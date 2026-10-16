import { useMemo, useState } from 'react';
import {
  GraduationCap,
  Activity,
  FileText,
  Stethoscope,
  Gauge,
  ListChecks,
  Pill,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { ECG_CASES, type IEcgCase } from '@/data/cases';

function riskClass(level: string): string {
  if (level.includes('高')) return 'border-destructive/30 bg-destructive/10 text-destructive';
  if (level.includes('中')) return 'border-warning/40 bg-warning/10 text-warning';
  return 'border-success/30 bg-success/10 text-success';
}

function difficultyClass(level: string): string {
  if (level.includes('高级')) return 'bg-destructive/10 text-destructive';
  if (level.includes('中级')) return 'bg-warning/10 text-warning';
  return 'bg-primary/10 text-primary';
}

function DetailSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </p>
      <div className="pl-5 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

export default function CasesPage() {
  const [category, setCategory] = useState('all');
  const [active, setActive] = useState<IEcgCase | null>(null);

  const categories = useMemo(
    () => [...new Set(ECG_CASES.map((c) => c.category).filter(Boolean))],
    [],
  );
  const shown = useMemo(
    () => (category === 'all' ? ECG_CASES : ECG_CASES.filter((c) => c.category === category)),
    [category],
  );

  return (
    <div>
      <PageHeader
        title="病例教学"
        description="常见心电异常病例的心电图特征、诊断要点与处置方案"
        actions={
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
        }
      />

      {shown.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
          <GraduationCap className="h-8 w-8 opacity-40" />
          <p className="text-sm">暂无病例</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shown.map((c) => (
            <Card
              key={c.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => setActive(c)}
            >
              <CardContent className="p-5">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{c.category}</Badge>
                  <Badge className={difficultyClass(c.difficulty)}>{c.difficulty}</Badge>
                  <Badge className={riskClass(c.risk_level)}>{c.risk_level}</Badge>
                </div>
                <h3 className="text-sm font-semibold leading-snug text-foreground">{c.title}</h3>
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                  {c.description}
                </p>
                <p className="mt-3 text-xs text-primary">查看病例详情</p>
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
                  <Badge className={difficultyClass(active.difficulty)}>{active.difficulty}</Badge>
                  <Badge className={riskClass(active.risk_level)}>
                    风险等级：{active.risk_level}
                  </Badge>
                </div>
                <DialogTitle className="leading-snug">{active.title}</DialogTitle>
                <DialogDescription className="sr-only">病例详情</DialogDescription>
              </DialogHeader>

              <div className="max-h-[62vh] space-y-4 overflow-auto pr-1">
                <DetailSection icon={FileText} title="疾病介绍">
                  {active.description}
                </DetailSection>

                <DetailSection icon={Activity} title="心电图特征">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                    {Object.entries(active.ecg_features).map(([k, v]) => (
                      <div
                        key={k}
                        className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-1.5"
                      >
                        <span className="text-xs text-muted-foreground">{k}</span>
                        <span className="text-xs font-medium text-foreground">{v}</span>
                      </div>
                    ))}
                  </div>
                </DetailSection>

                <DetailSection icon={Stethoscope} title="诊断要点">
                  {active.clinical_analysis}
                </DetailSection>

                <DetailSection icon={Gauge} title="模型可解释性（SHAP）">
                  {active.shap_explanation}
                </DetailSection>

                <DetailSection icon={ListChecks} title="学习要点">
                  <ul className="list-disc space-y-1 pl-4">
                    {active.learning_points.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </DetailSection>

                <DetailSection icon={Pill} title="治疗方案">
                  {active.treatment_advice}
                </DetailSection>

                <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                  本病例仅用于教学与科普，辅助筛查结果不能替代执业医师的临床诊断。
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
