import { AppUser, supabase } from './supabase';

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

export function canUseLockedScreenPush() {
  return Boolean(
    vapidPublicKey &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function enableLockedScreenPush(user: AppUser) {
  if (!canUseLockedScreenPush()) {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const registration = await navigator.serviceWorker.ready;
  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription = existingSubscription ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  const subscriptionJson = subscription.toJSON();
  const endpoint = subscription.endpoint;
  const p256dh = subscriptionJson.keys?.p256dh;
  const auth = subscriptionJson.keys?.auth;

  if (!endpoint || !p256dh || !auth) return false;

  await supabase.from('push_subscriptions').upsert({
    user_id: user.id,
    role: user.role,
    endpoint,
    p256dh,
    auth,
    user_agent: navigator.userAgent,
    active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });

  return true;
}

export async function notifyRequestCreated(requestId: string) {
  if (!supabase.functions?.invoke) return;

  try {
    await supabase.functions.invoke('notify-request', {
      body: { requestId },
    });
  } catch {
    // Ärendet ska fortfarande skickas även om pushservern inte svarar.
  }
}
