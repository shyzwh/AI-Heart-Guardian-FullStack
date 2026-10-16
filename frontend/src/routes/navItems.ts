import {
  Activity,
  Users,
  FileText,
  CalendarClock,
  LayoutDashboard,
  HeartPulse,
  PhoneCall,
  Dumbbell,
  ClipboardCheck,
  Newspaper,
  GraduationCap,
} from 'lucide-react';
import type { Role } from '@/types';

export interface INavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** 医生端侧边导航。 */
export const DOCTOR_NAV: INavItem[] = [
  { path: '/doctor/analysis', label: '心电分析', icon: Activity },
  { path: '/doctor/patients', label: '患者档案', icon: Users },
  { path: '/doctor/reports', label: '报告中心', icon: FileText },
  { path: '/doctor/followups', label: '随访提醒', icon: CalendarClock },
  { path: '/doctor/dashboard', label: '统计看板', icon: LayoutDashboard },
  { path: '/cases', label: '病例教学', icon: GraduationCap },
  { path: '/policy', label: '政策资讯', icon: Newspaper },
];

/** 患者端侧边导航（患者端主体在批次4，这里先提供结构）。 */
export const PATIENT_NAV: INavItem[] = [
  { path: '/patient/reports', label: '我的报告', icon: HeartPulse },
  { path: '/sos', label: '紧急呼救', icon: PhoneCall },
  { path: '/patient/rehab', label: '居家康复', icon: Dumbbell },
  { path: '/patient/checkin', label: '健康打卡', icon: ClipboardCheck },
  { path: '/cases', label: '病例教学', icon: GraduationCap },
  { path: '/policy', label: '政策资讯', icon: Newspaper },
];

export function navForRole(role: Role | null): INavItem[] {
  return role === 'patient' ? PATIENT_NAV : DOCTOR_NAV;
}
