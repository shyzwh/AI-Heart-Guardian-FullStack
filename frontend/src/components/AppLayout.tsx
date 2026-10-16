import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Activity,
  LogOut,
  Menu,
  X,
  Layers,
  Square,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import { useSurfaceStore, type SurfaceMode } from '@/store/surface';
import { navForRole } from '@/routes/navItems';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const SURFACE_OPTIONS: { value: SurfaceMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'solid', label: '纯色', icon: Square },
  { value: 'glass', label: '毛玻璃', icon: Layers },
  { value: 'frosted', label: '磨砂', icon: Sparkles },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, displayName, logout } = useAuthStore();
  const { mode, init, setMode } = useSurfaceStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = navForRole(role);

  useEffect(() => {
    init();
  }, [init]);

  const handleLogout = () => {
    logout();
    toast.success('已退出登录');
    navigate('/login', { replace: true });
  };

  const isActive = (path: string) =>
    path === '/policy'
      ? location.pathname.startsWith('/policy')
      : location.pathname.startsWith(path);

  const sideContent = (
    <nav className="flex h-full flex-col gap-1 p-3">
      <div className="mb-2 flex items-center gap-2 px-2 py-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Activity className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">AI护心镜</p>
          <p className="truncate text-xs text-muted-foreground">
            {role === 'doctor' ? '医生工作台' : '患者端'}
          </p>
        </div>
      </div>
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.path);
        return (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
              active
                ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
            )}
          >
            <Icon className={cn('h-4.5 w-4.5 shrink-0', active && 'text-primary')} />
            <span className="truncate">{item.label}</span>
            {active && <ChevronRight className="ml-auto h-4 w-4 opacity-60" />}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/70 bg-background/80 px-4 backdrop-blur-md">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="打开导航"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2 lg:hidden">
          <Activity className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">AI护心镜</span>
        </div>
        <span className="hidden text-sm text-muted-foreground lg:block">
          智慧康养心电风险筛查平台
        </span>

        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                {(() => {
                  const S = SURFACE_OPTIONS.find((o) => o.value === mode) ?? SURFACE_OPTIONS[0];
                  return (
                    <>
                      <S.icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{S.label}</span>
                    </>
                  );
                })()}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>界面质感</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {SURFACE_OPTIONS.map((o) => (
                <DropdownMenuItem key={o.value} onClick={() => setMode(o.value)}>
                  <o.icon className="mr-2 h-4 w-4" />
                  {o.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {(displayName || role || '?').slice(0, 1)}
                </span>
                <span className="hidden max-w-24 truncate sm:inline">
                  {displayName || (role === 'doctor' ? '医生' : '患者')}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                {role === 'doctor' ? '医生账号' : '患者账号'}
                {displayName ? ` · ${displayName}` : ''}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex">
        {/* 桌面侧边导航 */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
          {sideContent}
        </aside>

        {/* 移动端抽屉 */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute left-0 top-0 h-full w-64 bg-sidebar shadow-2xl">
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 z-10"
                onClick={() => setMobileOpen(false)}
                aria-label="关闭导航"
              >
                <X className="h-5 w-5" />
              </Button>
              {sideContent}
            </aside>
          </div>
        )}

        {/* 页面内容 */}
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
