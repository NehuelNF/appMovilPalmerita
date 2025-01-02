import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'appMovilPalmerita',
  webDir: 'www',
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: 'TU_ID_CLIENTE_REAL.apps.googleusercontent.com', // Reemplaza esto con tu ID real
      androidClientId: 'TU_ID_CLIENTE_ANDROID.apps.googleusercontent.com', // Añade esto
      forceCodeForRefreshToken: true,
    },
  },
  server: {
    androidScheme: 'https'
  }
};

export default config;
