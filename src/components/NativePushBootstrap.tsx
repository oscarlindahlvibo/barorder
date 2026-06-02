import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { AppUser } from '../lib/supabase';
import { enableLockedScreenPush } from '../lib/pushNotifications';

interface NativePushBootstrapProps {
  user: AppUser | null;
}

export default function NativePushBootstrap({ user }: NativePushBootstrapProps) {
  useEffect(() => {
    if (!user || !Capacitor.isNativePlatform()) return;

    const storageKey = `atm_native_push_attempted_${user.id}`;
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, 'true');

    enableLockedScreenPush(user).catch(() => {
      // Appen ska fortsätta även om native push inte kan registreras.
    });
  }, [user]);

  return null;
}
