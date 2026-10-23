import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { extractError } from '@/api/http';
import { listNotifications, markNotificationRead } from '@/api/notifications';
import type { INotification } from '@/api/notifications';
import { useAuthStore } from '@/store/auth';

export function NotificationMenu() {
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.role);
  const [items, setItems] = useState<INotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    const result = await listNotifications();
    setItems(result.items);
    setUnreadCount(result.unread_count);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await listNotifications();
        if (active) {
          setItems(result.items);
          setUnreadCount(result.unread_count);
        }
      } catch (error) {
        if (active) toast.error(extractError(error, '通知加载失败'));
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const openNotification = async (notification: INotification) => {
    if (!notification.is_read) {
      try {
        await markNotificationRead(notification.id);
        setItems((current) =>
          current.map((item) =>
            item.id === notification.id ? { ...item, is_read: true } : item,
          ),
        );
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch (error) {
        toast.error(extractError(error, '消息状态更新失败'));
        return;
      }
    }
    if (notification.notification_type === 'consultation') {
      navigate('/consultations');
    } else if (notification.notification_type === 'risk_alert') {
      navigate(role === 'patient' ? '/patient/reports' : '/doctor/reports');
    } else if (notification.notification_type === 'followup') {
      navigate(role === 'patient' ? '/patient/followups' : '/doctor/followups');
    }
  };

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) void refresh().catch((error: unknown) => {
          toast.error(extractError(error, '通知加载失败'));
        });
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-white hover:bg-white/20 hover:text-white"
          aria-label={`通知${unreadCount ? `，${unreadCount} 条未读` : ''}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-emerald-600">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <DropdownMenuLabel className="flex items-center gap-2 px-4 py-3">
          <Bell className="h-4 w-4 text-primary" />
          消息通知
          {unreadCount > 0 && (
            <span className="ml-auto rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              {unreadCount} 条未读
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-0" />
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">暂无通知</p>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void openNotification(item)}
                className="flex w-full gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/70"
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    item.is_read ? 'bg-transparent' : 'bg-red-500'
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {item.title}
                    {item.is_read && <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />}
                  </span>
                  <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">
                    {item.content}
                  </span>
                  <span className="mt-1.5 block text-[11px] text-muted-foreground/80">
                    {new Date(item.created_at).toLocaleString()}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
