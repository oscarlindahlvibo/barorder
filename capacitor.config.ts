import type { CapacitorConfig } from '@capacitor/cli';
import '@capacitor/push-notifications';

const config: CapacitorConfig = {
  appId: 'se.asedatruckmeet.barorder',
  appName: 'ÅTM Personal',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'banner', 'list'],
    },
  },
};

export default config;
