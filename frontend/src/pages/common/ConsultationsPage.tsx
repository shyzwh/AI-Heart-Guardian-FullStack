import { useEffect, useRef, useState } from 'react';
import { ImagePlus, MessageCircle, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/PageHeader';
import {
  createConsultation,
  getConsultationImage,
  listConsultationMessages,
  listConsultations,
  sendConsultationMessage,
  type IConsultation,
  type IConsultationMessage,
} from '@/api/consultations';
import { extractError } from '@/api/http';
import { useAuthStore } from '@/store/auth';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function formatTime(value: string): string {
  return new Date(value).toLocaleString([], {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ConsultationImage({
  consultationId,
  messageId,
}: {
  consultationId: number;
  messageId: number;
}) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let objectUrl = '';
    let active = true;
    void getConsultationImage(consultationId, messageId)
      .then((blob) => {
        if (active) {
          objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
        }
      })
      .catch((error: unknown) => {
        if (active) toast.error(extractError(error, '咨询图片加载失败'));
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [consultationId, messageId]);

  return src ? (
    <img src={src} alt="咨询图片" className="mt-2 max-h-64 max-w-full rounded-lg object-contain" />
  ) : (
    <div className="mt-2 flex h-28 w-40 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
      图片加载中…
    </div>
  );
}

function ConversationList({
  conversations,
  selectedId,
  onSelect,
  role,
}: {
  conversations: IConsultation[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  role: 'doctor' | 'patient' | null;
}) {
  return (
    <div className="divide-y divide-border">
      {conversations.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-muted-foreground">
          {role === 'doctor' ? '暂无患者咨询' : '暂无咨询会话'}
        </div>
      ) : (
        conversations.map((conversation) => (
          <button
            key={conversation.id}
            type="button"
            onClick={() => onSelect(conversation.id)}
            className={`flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/70 ${
              conversation.id === selectedId ? 'bg-primary/5' : ''
            }`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-800 dark:bg-teal-950 dark:text-teal-200">
              {(conversation.counterpart_name || '咨').slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{conversation.counterpart_name}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {formatTime(conversation.last_message_at)}
                </span>
              </span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">
                {conversation.last_message || '开始在线咨询'}
              </span>
            </span>
          </button>
        ))
      )}
    </div>
  );
}

export default function ConsultationsPage() {
  const role = useAuthStore((state) => state.role);
  const currentUser = useAuthStore((state) => state.user);
  const [conversations, setConversations] = useState<IConsultation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<IConsultationMessage[]>([]);
  const [text, setText] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeConversation = conversations.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (role === 'patient') await createConsultation();
        const result = await listConsultations();
        if (active) {
          setConversations(result);
          setSelectedId((current) =>
            current && result.some((item) => item.id === current)
              ? current
              : result[0]?.id ?? null,
          );
        }
      } catch (error) {
        if (active) toast.error(extractError(error, '咨询列表加载失败'));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [role]);

  useEffect(() => {
    if (selectedId === null) return;
    let active = true;
    const loadMessages = async () => {
      try {
        const result = await listConsultationMessages(selectedId);
        if (active) setMessages(result);
      } catch (error) {
        if (active) toast.error(extractError(error, '聊天记录加载失败'));
      }
    };
    void loadMessages();
    const timer = window.setInterval(() => void loadMessages(), 8_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const chooseImage = (file?: File) => {
    if (!file) {
      setImage(null);
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('仅支持 JPEG、PNG 或 WebP 图片');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('图片不能超过 8 MB');
      return;
    }
    setImage(file);
  };

  const send = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedId === null || (!text.trim() && !image)) return;
    setSending(true);
    try {
      await sendConsultationMessage(selectedId, text, image ?? undefined);
      setText('');
      setImage(null);
      const [updatedMessages, updatedConversations] = await Promise.all([
        listConsultationMessages(selectedId),
        listConsultations(),
      ]);
      setMessages(updatedMessages);
      setConversations(updatedConversations);
    } catch (error) {
      toast.error(extractError(error, '消息发送失败'));
    } finally {
      setSending(false);
    }
  };

  const selectConversation = (id: number) => {
    setMessages([]);
    setSelectedId(id);
    setMobileChatOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="在线咨询"
        description="与主治医生进行安全的图文沟通"
      />
      <Card className="flex min-h-[65vh] overflow-hidden">
        <aside
          className={`w-full shrink-0 border-r border-border md:block md:w-80 ${
            mobileChatOpen ? 'hidden' : 'block'
          }`}
        >
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">会话列表</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {conversations.length} 个咨询会话
            </p>
          </div>
          {loading ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">正在加载…</p>
          ) : (
            <ConversationList
              conversations={conversations}
              selectedId={selectedId}
              onSelect={selectConversation}
              role={role}
            />
          )}
        </aside>

        <section
          className={`min-w-0 flex-1 flex-col ${
            mobileChatOpen ? 'flex' : 'hidden md:flex'
          }`}
        >
          {activeConversation ? (
            <>
              <header className="flex h-16 items-center gap-3 border-b border-border px-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setMobileChatOpen(false)}
                  aria-label="返回会话列表"
                >
                  <X className="h-4 w-4" />
                </Button>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-800 dark:bg-teal-950 dark:text-teal-200">
                  {(activeConversation.counterpart_name || '咨').slice(0, 1)}
                </span>
                <div>
                  <p className="text-sm font-semibold">{activeConversation.counterpart_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {role === 'doctor' ? `患者：${activeConversation.patient_name}` : '主治医生 · 在线咨询'}
                  </p>
                </div>
              </header>

              <div className="flex-1 space-y-4 overflow-y-auto bg-muted/20 p-4 sm:p-6">
                {messages.length === 0 ? (
                  <div className="flex h-full min-h-48 flex-col items-center justify-center text-center text-muted-foreground">
                    <MessageCircle className="mb-2 h-8 w-8 opacity-40" />
                    <p className="text-sm">发送消息，开始咨询</p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const own = message.sender_id === currentUser?.id;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${own ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm sm:max-w-[70%] ${
                            own
                              ? 'rounded-br-md bg-primary text-primary-foreground'
                              : 'rounded-bl-md border border-border bg-card text-card-foreground'
                          }`}
                        >
                          {message.content && (
                            <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                          )}
                          {message.has_image && (
                            <ConsultationImage
                              consultationId={message.consultation_id}
                              messageId={message.id}
                            />
                          )}
                          <p
                            className={`mt-1 text-right text-[10px] ${
                              own ? 'text-primary-foreground/70' : 'text-muted-foreground'
                            }`}
                          >
                            {formatTime(message.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={send} className="border-t border-border bg-card p-3 sm:p-4">
                {image && (
                  <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <ImagePlus className="h-4 w-4" />
                    <span className="max-w-64 truncate">{image.name}</span>
                    <button
                      type="button"
                      onClick={() => setImage(null)}
                      className="rounded p-1 hover:bg-muted"
                      aria-label="移除图片"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <label className="cursor-pointer rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                    <ImagePlus className="h-5 w-5" />
                    <span className="sr-only">添加图片</span>
                    <input
                      type="file"
                      className="sr-only"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => {
                        chooseImage(event.target.files?.[0]);
                        event.target.value = '';
                      }}
                    />
                  </label>
                  <Input
                    value={text}
                    maxLength={5000}
                    onChange={(event) => setText(event.target.value)}
                    placeholder="输入消息…"
                    className="min-w-0 flex-1"
                  />
                  <Button type="submit" disabled={sending || (!text.trim() && !image)}>
                    <Send className="mr-1.5 h-4 w-4" />
                    发送
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  图片支持 JPEG、PNG、WebP，单张不超过 8 MB
                </p>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <MessageCircle className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm font-medium">选择一个会话开始咨询</p>
              <p className="mt-1 text-xs">
                {role === 'doctor' ? '患者发起咨询后会显示在这里' : '会话暂不可用，请联系医生'}
              </p>
            </div>
          )}
        </section>
      </Card>
    </div>
  );
}
