import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FileText, Search } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { listRecords } from '@/api/ecg';
import { listPatients } from '@/api/patients';
import { extractError } from '@/api/http';
import type { IEcgRecordSummary, IPatient } from '@/types';
import { RiskBadge } from '@/components/RiskBadge';
import { format } from 'date-fns';

export default function ReportsPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<IEcgRecordSummary[]>([]);
  const [patients, setPatients] = useState<IPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientFilter, setPatientFilter] = useState('all');
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    Promise.all([listRecords(), listPatients()])
      .then(([recs, ps]) => {
        setRecords(recs);
        setPatients(ps);
      })
      .catch((err) => toast.error(extractError(err, '报告列表加载失败')))
      .finally(() => setLoading(false));
  }, []);

  const patientName = (id: number) => patients.find((p) => p.id === id)?.name ?? `#${id}`;

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (patientFilter !== 'all' && r.patient_id !== Number(patientFilter)) return false;
      if (keyword && !r.file_name.includes(keyword) && !r.record_id.includes(keyword)) return false;
      return true;
    });
  }, [records, patientFilter, keyword]);

  return (
    <div>
      <PageHeader title="报告中心" description={`共 ${records.length} 份心电报告`} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-48">
          <Select value={patientFilter} onValueChange={setPatientFilter}>
            <SelectTrigger>
              <SelectValue placeholder="全部患者" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部患者</SelectItem>
              {patients.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索文件名 / 记录号"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">患者</TableHead>
                  <TableHead className="whitespace-nowrap">文件</TableHead>
                  <TableHead className="whitespace-nowrap">风险等级</TableHead>
                  <TableHead className="whitespace-nowrap">异常/总心拍</TableHead>
                  <TableHead className="whitespace-nowrap">症状</TableHead>
                  <TableHead className="whitespace-nowrap">分析时间</TableHead>
                  <TableHead className="whitespace-nowrap text-right">报告</TableHead>
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
                        <FileText className="h-8 w-8 opacity-40" />
                        <p className="text-sm">暂无报告记录</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/doctor/reports/${r.id}`)}
                    >
                      <TableCell className="whitespace-nowrap font-medium">
                        {patientName(r.patient_id)}
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <span className="block truncate">{r.file_name}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <RiskBadge level={r.risk_level} size="sm" />
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        <span className={r.abnormal_beats > 0 ? 'text-destructive font-medium' : ''}>
                          {r.abnormal_beats}
                        </span>
                        {' / '}
                        {r.total_beats}
                      </TableCell>
                      <TableCell className="max-w-[160px]">
                        {r.symptoms ? (
                          <span className="block truncate">{r.symptoms}</span>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">无</Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {format(new Date(r.created_at), 'yyyy-MM-dd HH:mm')}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/doctor/reports/${r.id}`);
                          }}
                        >
                          查看
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
