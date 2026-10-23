import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getMyProfile } from '@/api/patients';
import { listRecords } from '@/api/ecg';
import { listCheckIns } from '@/api/wellness';
import { extractError } from '@/api/http';
import type { ICheckIn, IEcgRecordSummary } from '@/types';

export function MascotAvatar({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <path
        d="M50 7 56 11 64 8 69 14 78 14 81 22 89 26 88 35 94 42 90 50 94 58 88 65 88 74 80 78 77 87 68 87 61 94 52 91 44 95 37 89 28 89 24 81 15 77 16 68 9 62 12 53 7 45 12 37 10 28 18 23 20 14 29 14 36 7 44 11Z"
        fill="#111"
      />
      <ellipse cx="39" cy="47" rx="10" ry="13" fill="#fff" />
      <ellipse cx="64" cy="47" rx="10" ry="13" fill="#fff" />
      <circle cx="42" cy="49" r="4" fill="#111" />
      <circle cx="61" cy="49" r="4" fill="#111" />
      <circle cx="43" cy="47" r="1.4" fill="#fff" />
      <circle cx="62" cy="47" r="1.4" fill="#fff" />
    </svg>
  );
}

export function AiMascot() {
  const [messages, setMessages] = useState<string[]>([]);
  const [visibleMessages, setVisibleMessages] = useState(0);
  const [loading, setLoading] = useState(false);
  const isOpen = visibleMessages > 0;

  useEffect(() => {
    if (!isOpen || visibleMessages >= messages.length) return;
    const timeout = window.setTimeout(
      () => setVisibleMessages((current) => current + 1),
      650,
    );
    return () => window.clearTimeout(timeout);
  }, [isOpen, messages.length, visibleMessages]);

  const handleMascotClick = async () => {
    if (isOpen) {
      setVisibleMessages(0);
      return;
    }
    if (loading) return;

    setLoading(true);
    try {
      const profile = await getMyProfile();
      const [checkIns, records] = await Promise.all([
        listCheckIns(profile.id),
        listRecords(profile.id),
      ]);
      const nextMessages = createCareMessages(checkIns, records);
      setMessages(nextMessages);
      setVisibleMessages(1);
    } catch (error) {
      toast.error(extractError(error, '无法读取健康记录'));
      setMessages([
        '今天也要保持好心情哦，心脏最喜欢你开心的样子啦！',
        '记得多喝水，小护会一直陪着您的。',
      ]);
      setVisibleMessages(2);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="关闭情绪关怀气泡"
          className="fixed inset-0 z-40 cursor-default"
          onClick={() => setVisibleMessages(0)}
        />
      )}
      <div className="fixed bottom-6 right-6 z-50">
        {isOpen && (
          <div className="absolute bottom-full right-0 mb-4 flex w-72 flex-col items-end gap-2">
            {messages.slice(0, visibleMessages).map((message, index) => (
              <div
                key={`${index}-${message}`}
                className="relative animate-in slide-in-from-bottom-2 fade-in rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-lg duration-300"
              >
                {message}
                {index === messages.slice(0, visibleMessages).length - 1 && (
                  <span className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 border-b border-r border-emerald-100 bg-white" />
                )}
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          aria-label={isOpen ? '关闭情绪关怀气泡' : '查看情绪关怀'}
          aria-expanded={isOpen}
          onClick={() => void handleMascotClick()}
          disabled={loading}
          className="group flex h-16 w-16 items-center justify-center rounded-full bg-transparent shadow-lg transition-transform hover:scale-105 hover:animate-bounce focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-70"
        >
          <MascotAvatar className="h-full w-full" />
        </button>
      </div>
    </>
  );
}

function consecutiveCheckInDays(checkIns: ICheckIn[]): number {
  const dayMilliseconds = 24 * 60 * 60 * 1000;
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const dates = [...new Set(
    checkIns
      .map((checkIn) => checkIn.checkin_date.slice(0, 10))
      .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)),
  )]
    .map((date) => Date.parse(`${date}T00:00:00Z`))
    .filter((date) => Number.isFinite(date))
    .sort((first, second) => second - first);

  if (
    dates.length === 0 ||
    todayUtc - dates[0] < 0 ||
    todayUtc - dates[0] > dayMilliseconds
  ) {
    return 0;
  }
  let streak = 1;
  for (let index = 1; index < dates.length; index += 1) {
    if (dates[index - 1] - dates[index] !== dayMilliseconds) break;
    streak += 1;
  }
  return streak;
}

function createCareMessages(
  checkIns: ICheckIn[],
  records: IEcgRecordSummary[],
): string[] {
  const messages: string[] = [];
  if (consecutiveCheckInDays(checkIns) >= 3) {
    messages.push(
      '主人，看到您连续打卡好几天了，看到您这么爱护心脏，小护真的特别开心！继续保持哦～',
    );
  }

  const recentRiskRecord = [...records]
    .filter((record) => record.risk_level === '中危' || record.risk_level === '高危')
    .sort(
      (first, second) =>
        Date.parse(second.created_at) - Date.parse(first.created_at),
    )[0];
  if (recentRiskRecord) {
    messages.push(
      '我注意到您最近的一份报告有些小状况。别太担心，注意休息，如果心里没底，随时去上方找医生聊聊好吗？',
    );
  }

  if (messages.length === 0) {
    return [
      '今天也要保持好心情哦，心脏最喜欢你开心的样子啦！',
      '记得多喝水，小护会一直陪着您的。',
    ];
  }
  if (messages.length === 1) {
    messages.push('记得照顾好自己，小护会一直陪着您的。');
  }
  return messages;
}
