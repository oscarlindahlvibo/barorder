import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { AppUser, supabase } from './supabase';

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
let nativeListenersReady = false;
let nativeRegistrationUser: AppUser | null = null;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

export function canUseLockedScreenPush() {
  if (Capacitor.isNativePlatform()) return true;

  return Boolean(
    vapidPublicKey &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

async function saveNativeToken(user: AppUser, token: string) {
  await supabase.from('native_push_tokens').upsert({
    user_id: user.id,
    role: user.role,
    platform: Capacitor.getPlatform(),
    token,
    user_agent: navigator.userAgent,
    active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'token' });
}

async function ensureNativeListeners(user: AppUser) {
  nativeRegistrationUser = user;
  if (nativeListenersReady) return;
  nativeListenersReady = true;

  await PushNotifications.addListener('registration', token => {
    if (!nativeRegistrationUser) return;
    saveNativeToken(nativeRegistrationUser, token.value).catch(() => {
      // Notisregistreringen får inte stoppa appen.
    });
  });

  await PushNotifications.addListener('registrationError', error => {
    console.warn('Native push registration failed', error.error);
  });

  await PushNotifications.addListener('pushNotificationReceived', notification => {
    console.info('Push notification received', notification);
  });

  await PushNotifications.addListener('pushNotificationActionPerformed', notification => {
    console.info('Push notification opened', notification.notification?.data);
  });
}

async function enableNativePush(user: AppUser) {
  await ensureNativeListeners(user);

  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === 'prompt') {
    permission = await PushNotifications.requestPermissions();
  }

  if (permission.receive !== 'granted') return false;

  if (Capacitor.getPlatform() === 'android') {
    try {
      await PushNotifications.createChannel({
        id: 'urgent',
        name: 'Viktiga varningar',
        description: 'Akuta order och tillkallningar',
        importance: 5,
        visibility: 1,
        sound: 'default',
        vibration: true,
      });
    } catch {
      // Kanalen kan redan finnas.
    }
  }

  await PushNotifications.register();
  return true;
}

export async function enableLockedScreenPush(user: AppUser) {
  if (Capacitor.isNativePlatform()) {
    try {
      return await enableNativePush(user);
    } catch {
      return false;
    }
  }

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
