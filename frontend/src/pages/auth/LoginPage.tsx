import { useState } from 'react';
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (token) {
    return <Navigate to="/" replace />;
  }

  const redirectFor = (r: Role) =>
    (location.state as ILocationState | null)?.from ||
    (r === 'doctor' ? '/doctor/analysis' : '/patient/reports');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[hsl(195_30%_95%)] via-background to-[hsl(187_40%_94%)]">
      {/* 背景心电纹理，克制处理 */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(90deg, hsl(187 65% 33%) 1px, transparent 1px), linear-gradient(hsl(187 65% 33%) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Activity className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            AI护心镜
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            智慧康养心电风险筛查平台
          </p>
        </div>

        <Card className="border-card-border shadow-xl backdrop-blur">
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
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
                <Input
                  id="username"
                  autoComplete="username"
                  placeholder="至少 3 个字符"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              {mode === 'register' && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">姓名（选填）</Label>
                  <Input
                    id="displayName"
                    placeholder="用于界面展示"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder="至少 6 位"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            <p className="mt-4 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              本平台提供心电风险辅助筛查，结果仅供临床参考，不能替代医生诊断。
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
    </div>
  );
}
