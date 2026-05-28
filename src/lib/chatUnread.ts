import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminChatMessage, AppUser, supabase } from './supabase';

function readKey(userId: string) {
  return `truckmeet_chat_read_${userId}`;
}

function canReadMessage(message: AdminChatMessage, user: AppUser | null) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return message.user_id === user.id || message.target_role === 'all' || message.target_role === user.role;
}

function playChatPing() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(1320, ctx.currentTime);
    osc.frequency.setValueAtTime(990, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.28);
  } catch {
    // Audio not available
  }
}

async function getReadableUnreadCount(user: AppUser | null) {
  if (!user) return 0;
  const lastRead = localStorage.getItem(readKey(user.id)) || '';
  const { data } = await supabase
    .from('admin_chat_messages')
    .select('*')
    .order('created_at', { ascending: true });

  return (data || []).filter((chat: AdminChatMessage) =>
    chat.user_id !== user.id &&
    chat.created_at > lastRead &&
    canReadMessage(chat, user)
  ).length;
}

export function markChatRead(user: AppUser | null) {
  if (!user) return;
  localStorage.setItem(readKey(user.id), new Date().toISOString());
}

export function useUnreadChatCount(user: AppUser | null) {
  const [count, setCount] = useState(0);
  const previousCountRef = useRef(0);
  const initialLoadDoneRef = useRef(false);

  const refresh = useCallback(async () => {
    const nextCount = await getReadableUnreadCount(user);
    if (initialLoadDoneRef.current && nextCount > previousCountRef.current) {
      playChatPing();
    }
    previousCountRef.current = nextCount;
    initialLoadDoneRef.current = true;
    setCount(nextCount);
  }, [user]);

  useEffect(() => {
    refresh();

    const channel = supabase
      .channel('chat-unread-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'admin_chat_messages',
      }, () => {
        refresh();
      })
      .subscribe();

    const intervalId = window.setInterval(refresh, 3000);
    const storageListener = (event: StorageEvent) => {
      if (!event.key || event.key === readKey(user?.id || '')) refresh();
    };

    window.addEventListener('focus', refresh);
    window.addEventListener('storage', storageListener);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', storageListener);
      supabase.removeChannel(channel);
    };
  }, [refresh, user]);

  return count;
}
