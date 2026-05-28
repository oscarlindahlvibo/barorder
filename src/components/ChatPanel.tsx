import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Loader2, MessageSquare, Send } from 'lucide-react';
import { AdminChatMessage, AppUser, supabase, UserRole } from '../lib/supabase';
import { useApp } from '../lib/store';
import { markChatRead } from '../lib/chatUnread';

type TargetRole = UserRole | 'all';

const TARGETS: { id: TargetRole; label: string }[] = [
  { id: 'all', label: 'Alla' },
  { id: 'admin', label: 'Admin' },
  { id: 'lager', label: 'Lager' },
  { id: 'barpersonal', label: 'Barer' },
  { id: 'personal', label: 'Tillkalla personal' },
];

const ROLE_LABELS: Record<TargetRole, string> = {
  all: 'Alla',
  admin: 'Admin',
  lager: 'Lager',
  barpersonal: 'Barer',
  personal: 'Tillkalla personal',
};

function canReadMessage(message: AdminChatMessage, user: AppUser | null) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return message.user_id === user.id || message.target_role === 'all' || message.target_role === user.role;
}

interface ChatPanelProps {
  embedded?: boolean;
}

export default function ChatPanel({ embedded = false }: ChatPanelProps) {
  const { currentUser, setView } = useApp();
  const [messages, setMessages] = useState<AdminChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [targetRole, setTargetRole] = useState<TargetRole>('all');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('admin_chat_messages')
      .select('*, users(id, name, role)')
      .order('created_at', { ascending: true });

    setMessages((data || []).filter((chat: AdminChatMessage) => canReadMessage(chat, currentUser)));
    markChatRead(currentUser);
  }, [currentUser]);

  useEffect(() => {
    load();

    const channel = supabase
      .channel('admin-chat-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'admin_chat_messages',
      }, () => {
        load();
      })
      .subscribe();

    const intervalId = window.setInterval(load, 3000);

    return () => {
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [load]);

  async function sendMessage() {
    const trimmed = message.trim();
    if (!trimmed || !currentUser || sending) return;
    setSending(true);
    await supabase.from('admin_chat_messages').insert({
      user_id: currentUser.id,
      target_role: targetRole,
      message: trimmed,
    });
    setMessage('');
    await load();
    setSending(false);
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  }

  const chatContent = (
    <>
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">Inga meddelanden än</p>
          </div>
        ) : (
          messages.map(chat => {
            const isMine = chat.user_id === currentUser?.id;
            return (
              <div key={chat.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[82%] rounded-xl border px-3 py-2 ${
                  isMine
                    ? 'bg-orange-500/15 border-orange-500/40'
                    : 'bg-gray-900 border-gray-800'
                }`}>
                  <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                    <span className={`text-xs font-semibold ${isMine ? 'text-orange-300' : 'text-gray-300'}`}>
                      {chat.users?.name || 'Admin'}
                    </span>
                    <span className="text-[11px] text-gray-600">{formatTime(chat.created_at)}</span>
                    <span className="text-[11px] text-gray-500">Till {ROLE_LABELS[chat.target_role] ?? 'Alla'}</span>
                  </div>
                  <p className="text-white text-sm whitespace-pre-wrap break-words">{chat.message}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="bg-gray-900 border-t border-gray-800 p-4 pb-safe-panel space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {TARGETS.map(target => (
            <button
              key={target.id}
              onClick={() => setTargetRole(target.id)}
              className={`flex-shrink-0 h-8 px-3 rounded-full text-xs font-semibold border transition-all ${
                targetRole === target.id
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400'
              }`}
            >
              {target.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={`Skriv till ${ROLE_LABELS[targetRole].toLowerCase()}...`}
            rows={1}
            className="flex-1 min-h-11 max-h-28 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 resize-none focus:outline-none focus:border-orange-500"
          />
          <button
            onClick={sendMessage}
            disabled={!message.trim() || sending}
            className="w-11 h-11 rounded-xl bg-orange-500 hover:bg-orange-400 text-white flex items-center justify-center disabled:opacity-50 disabled:hover:bg-orange-500"
            aria-label="Skicka meddelande"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </>
  );

  if (embedded) {
    return <div className="h-full flex flex-col">{chatContent}</div>;
  }

  const backView = currentUser?.role === 'barpersonal'
    ? 'request'
    : currentUser?.role === 'personal'
      ? 'staff-dashboard'
      : 'dashboard';

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 safe-area-inset-top">
        <button
          onClick={() => setView(backView)}
          className="p-2 -ml-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-white font-bold text-lg">Chatt</h1>
          <p className="text-gray-400 text-xs">{currentUser?.name}</p>
        </div>
      </div>
      {chatContent}
    </div>
  );
}
