import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mismatched.app',
  appName: 'Mismatched',
  webDir: 'dist',
  server: {
    androidScheme: 'https',   // use HTTPS scheme so Supabase cookies work
    cleartext: false,
  },
  android: {
    buildOptions: {
      keystorePath: undefined,  // set when signing for release
      releaseType: 'APK',
    }
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0B0E14',
      showSpinner: false,
      androidSpinnerStyle: 'small',
    },
  },
};

export default config;
