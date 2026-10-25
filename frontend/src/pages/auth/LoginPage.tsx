import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Stethoscope, UserRound, ShieldCheck, PhoneCall } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { extractError } from '@/api/http';
import type { Role } from '@/types';

interface ILocationState {
  from?: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, login, register } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<Role>('doctor');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.querySelectorAll<HTMLInputElement>('input').forEach((el) => {
      el.value = '';
    });
  }, []);

  if (token) {
    return <Navigate to="/" replace />;
  }

  const redirectFor = (r: Role) => {
    const requestedPath = (location.state as ILocationState | null)?.from;
    if (
      requestedPath &&
      requestedPath !== '/policy' &&
      requestedPath !== '/login' &&
      requestedPath !== '/'
    ) {
      return requestedPath;
    }
    return r === 'doctor' ? '/doctor/analysis' : '/patient/reports';
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = String(formData.get('username') ?? '');
    const password = String(formData.get('password') ?? '');
    const displayName = String(formData.get('displayName') ?? '');
    if (username.trim().length < 3) {
      toast.error('用户名至少 3 个字符');
      return;
    }
    if (password.length < 6) {
      toast.error('密码至少 6 位');
      return;
    }
    setSubmitting(true);
    try {
      const r =
        mode === 'login'
          ? await login({ username: username.trim(), password })
          : await register({
              username: username.trim(),
              password,
              role,
              display_name: displayName.trim(),
            });
      toast.success(mode === 'login' ? '登录成功' : '注册成功，已自动登录');
      navigate(redirectFor(r), { replace: true });
    } catch (err) {
      toast.error(extractError(err, mode === 'login' ? '登录失败' : '注册失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-end',
          overflow: 'hidden',
          height: '100vh',
          width: '100%',
          backgroundImage: 'url(/assets/login-bg.jpg)',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundColor: '#f8fafc',
          color: '#fff',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/15 to-teal-950/10" />
        <div className="relative z-10 max-w-xl p-12">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/30 bg-white/15 backdrop-blur">
            <Activity className="h-8 w-8" />
          </div>
          <p className="text-sm font-medium tracking-[0.2em] text-teal-100">
            SMART CARDIAC CARE
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">AI护心镜</h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-white/85">
            全龄心电风险与医患协同平台，提供心电风险筛查与医患管理服务。
          </p>
        </div>
      </div>

      <main
        style={{
          display: 'flex',
          width: '50%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          overflowY: 'auto',
          backgroundColor: '#f8fafc',
          padding: '2.5rem 2rem',
        }}
      >
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg lg:hidden">
            <Activity className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground lg:hidden">
            AI护心镜
          </h1>
          <p className="mt-1 text-sm text-muted-foreground lg:hidden">
            全龄心电风险与医患协同平台
          </p>
        </div>

        <Card className="border-card-border bg-white shadow-xl">
          <CardHeader>
            <Tabs
              value={mode}
              onValueChange={(v) => setMode(v as 'login' | 'register')}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">登录</TabsTrigger>
                <TabsTrigger value="register">注册</TabsTrigger>
              </TabsList>
            </Tabs>
            <CardTitle className="mt-4 text-lg">
              {mode === 'login' ? '欢迎回来' : '创建账号'}
            </CardTitle>
            <CardDescription>
              {mode === 'login'
                ? '选择身份并登录工作台'
                : '选择医生或患者身份完成注册'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} noValidate autoComplete="off" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('doctor')}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                    role === 'doctor'
                      ? 'border-primary bg-accent text-primary font-medium'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Stethoscope className="h-4 w-4" />
                  医生
                </button>
                <button
                  type="button"
                  onClick={() => setRole('patient')}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                    role === 'patient'
                      ? 'border-primary bg-accent text-primary font-medium'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <UserRound className="h-4 w-4" />
                  患者
                </button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <input
                  id="username"
                  type="text"
                  autoComplete="new-password"
                  name="username"
                  placeholder="请输入用户名"
                  className="file:text-foreground placeholder:text-slate-400 selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-10 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-50 md:text-sm enabled:hover:border-ring focus-visible:border-ring focus-visible:ring-ring/20 focus-visible:ring-[3px]"
                />
              </div>

              {mode === 'register' && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">姓名（选填）</Label>
                  <input
                    id="displayName"
                    placeholder="用于界面展示"
                    name="displayName"
                    autoComplete="off"
                    className="file:text-foreground placeholder:text-slate-400 selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-10 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-50 md:text-sm enabled:hover:border-ring focus-visible:border-ring focus-visible:ring-ring/20 focus-visible:ring-[3px]"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <input
                  id="password"
                  type="password"
                  autoComplete="off"
                  name="password"
                  placeholder="请输入密码"
                  className="file:text-foreground placeholder:text-slate-400 selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-10 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-50 md:text-sm enabled:hover:border-ring focus-visible:border-ring focus-visible:ring-ring/20 focus-visible:ring-[3px]"
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting
                  ? '请稍候…'
                  : mode === 'login'
                    ? `以${role === 'doctor' ? '医生' : '患者'}身份登录`
                    : '注册并登录'}
              </Button>
            </form>

            <p className="mt-4 flex items-start gap-1.5 text-xs text-slate-400">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="italic">
                本系统为医疗辅助软件，分析结果不作为最终临床诊断依据。
              </span>
            </p>

            <Link
              to="/sos"
              className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <PhoneCall className="h-4 w-4" />
              紧急呼救（无需登录，点击进入）
            </Link>
          </CardContent>
        </Card>
      </div>
      </main>
    </div>
  );
}
