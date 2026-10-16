import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import AppLayout from '@/components/AppLayout';
import { RoleGuard } from '@/routes/RoleGuard';
import { useAuthStore } from '@/store/auth';
import LoginPage from '@/pages/auth/LoginPage';
import AnalysisPage from '@/pages/doctor/AnalysisPage';
import PatientsPage from '@/pages/doctor/PatientsPage';
import ReportsPage from '@/pages/doctor/ReportsPage';
import ReportDetailPage from '@/pages/doctor/ReportDetailPage';
import FollowUpsPage from '@/pages/doctor/FollowUpsPage';
import DashboardPage from '@/pages/doctor/DashboardPage';
import PolicyPage from '@/pages/common/PolicyPage';
import CasesPage from '@/pages/common/CasesPage';
import SosPage from '@/pages/common/SosPage';
import MyReportsPage from '@/pages/patient/MyReportsPage';
import MyReportDetailPage from '@/pages/patient/MyReportDetailPage';
import RehabPage from '@/pages/patient/RehabPage';
import CheckInPage from '@/pages/patient/CheckInPage';

function RootRedirect() {
  const role = useAuthStore((s) => s.role);
  return (
    <Navigate
      to={role === 'patient' ? '/patient/reports' : '/doctor/analysis'}
      replace
    />
  );
}

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      <span className="text-sm">正在加载…</span>
    </div>
  );
}

export default function App() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) return <FullScreenLoader />;

  return (
    <>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* 紧急呼救：公开页，未登录用 device_key，登录患者也可访问 */}
      <Route path="/sos" element={<SosPage />} />

      <Route
        element={
          <RoleGuard>
            <AppLayout />
          </RoleGuard>
        }
      >
        <Route index element={<RootRedirect />} />

        {/* 医生端 */}
        <Route
          path="doctor/analysis"
          element={
            <RoleGuard allow={['doctor']}><AnalysisPage /></RoleGuard>
          }
        />
        <Route
          path="doctor/patients"
          element={
            <RoleGuard allow={['doctor']}><PatientsPage /></RoleGuard>
          }
        />
        <Route
          path="doctor/reports"
          element={
            <RoleGuard allow={['doctor']}><ReportsPage /></RoleGuard>
          }
        />
        <Route
          path="doctor/reports/:id"
          element={
            <RoleGuard allow={['doctor']}><ReportDetailPage /></RoleGuard>
          }
        />
        <Route
          path="doctor/followups"
          element={
            <RoleGuard allow={['doctor']}><FollowUpsPage /></RoleGuard>
          }
        />
        <Route
          path="doctor/dashboard"
          element={
            <RoleGuard allow={['doctor']}><DashboardPage /></RoleGuard>
          }
        />

        {/* 患者端 */}
        <Route
          path="patient/reports"
          element={
            <RoleGuard allow={['patient']}><MyReportsPage /></RoleGuard>
          }
        />
        <Route
          path="patient/reports/:id"
          element={
            <RoleGuard allow={['patient']}><MyReportDetailPage /></RoleGuard>
          }
        />
        <Route
          path="patient/sos"
          element={<Navigate to="/sos" replace />}
        />
        <Route
          path="patient/rehab"
          element={
            <RoleGuard allow={['patient']}><RehabPage /></RoleGuard>
          }
        />
        <Route
          path="patient/checkin"
          element={
            <RoleGuard allow={['patient']}><CheckInPage /></RoleGuard>
          }
        />

        {/* 政策资讯：医生 / 患者共用 */}
        <Route path="policy" element={<PolicyPage />} />

        {/* 病例教学：医生 / 患者共用 */}
        <Route path="cases" element={<CasesPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <Toaster richColors={false} position="top-center" />
    </>
  );
}
