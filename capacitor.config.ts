import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.urteam.yourdeal',
  appName: '유어딜',
  webDir: 'dist/client',
  server: {
    url: process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : undefined,
    cleartext: true,
    // 앱 내 외부 링크는 시스템 브라우저로 열기
    allowNavigation: ['live.ur-team.com', '*.kakao.com', '*.youtube.com', '*.google.com', '*.toss.im'],
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#020202',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#020202',
    // 딥링크
    appendUrlPath: true,
  },
  ios: {
    contentInset: 'automatic',
    scheme: 'yourdeal',
    backgroundColor: '#020202',
    preferredContentMode: 'mobile',
    // 딥링크 지원을 위한 Associated Domains
    limitsNavigationsToAppBoundDomains: true,
  },
};

export default config;
