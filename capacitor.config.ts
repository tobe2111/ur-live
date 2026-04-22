import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.urteam.yourdeal',
  appName: '유어딜',
  webDir: 'dist/client',
  server: {
    url: process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : undefined,
    // 🛡️ 2026-04-22: production 에선 HTTPS 강제 (MITM 방어)
    cleartext: process.env.NODE_ENV === 'development',
    // 와일드카드 축소 — 특정 서브도메인만 허용 (DNS rebinding 방어)
    allowNavigation: [
      'live.ur-team.com',
      'ur-team.com',
      'kauth.kakao.com',
      'k.kakaocdn.net',
      'www.youtube.com',
      'youtube.com',
      'm.youtube.com',
      'js.tosspayments.com',
      'api.tosspayments.com',
      'accounts.google.com',
    ],
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
    // 🛡️ 2026-04-22: HTTP 리소스 로딩 차단 (MITM 방어)
    // dev 빌드는 env 로 덮어쓰기 가능
    allowMixedContent: false,
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
