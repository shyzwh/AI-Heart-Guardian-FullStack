import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import type { Role } from '@/types';

interface IRoleGuardProps {
  children: React.ReactNode;
  allow?: Role[];
}

/** 登录与角色守卫：未登录跳登录页；角色不符跳到各自首页。 */
export function RoleGuard({ children, allow }: IRoleGuardProps) {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (allow && role && !allow.includes(role)) {
    return <Navigate to={role === 'doctor' ? '/doctor/analysis' : '/patient/reports'} replace />;
  }
  return <>{children}</>;
}
