import type { CapacitorConfig } from '@capacitor/cli';
import { existsSync } from 'node:fs';

/**
 * 🩸 2026-11-03 첫 내부 테스트 앱이 켜자마자 1초 만에 꺼졌다.
 *   원인: Firebase 설정 파일(google-services.json) 없이 빌드한 앱에서 웹 코드가
 *   `PushNotifications.register()` 를 불렀다 → 네이티브가 "FirebaseApp 미초기화"로 죽는다.
 *   JS 의 try/catch 로는 못 잡는다(죽는 곳이 자바 쪽이다).
 *   앱 = 라이브 웹(server.url)이라 웹 코드는 "이 앱 빌드에 Firebase 가 있는지" 모른다 →
 *   **빌드 시점에** 설정 파일이 있으면 User-Agent 에 표식을 붙이고, 웹은 표식이 있을 때만 푸시를 켠다.
 *   표식 이름은 `src/lib/native.ts` 의 NATIVE_PUSH_UA_MARK 와 같아야 한다(테스트가 대조).
 */
const NATIVE_PUSH_UA_MARK = 'UrDealPush';
const ANDROID_PUSH_READY = existsSync('android/app/google-services.json');
const IOS_PUSH_READY = existsSync('ios/App/App/GoogleService-Info.plist');
const appUserAgent = (pushReady: boolean) => (pushReady ? `UrDealApp ${NATIVE_PUSH_UA_MARK}` : 'UrDealApp');

const config: CapacitorConfig = {
  appId: 'com.urteam.yourdeal',
  appName: '유어딜',
  webDir: 'dist/client',
  server: {
    // 🛡️ 2026-07-18 앱 출시 대비: production = live 사이트 직접 로드 (server.url 모드).
    //   이유: api.ts 가 same-origin(baseURL '/') + 세션이 httpOnly 쿠키(ur_session) 기반이라,
    //   번들(webDir) 모드면 capacitor://localhost ↔ urdeal.kr 이 cross-origin 이 되어
    //   API 와 로그인 쿠키가 전부 깨짐(iOS WKWebView 서드파티 쿠키 차단). server.url 모드는
    //   앱 = 라이브 사이트 + 네이티브 브릿지 주입 → 쿠키/OAuth/결제 웹과 동일 + 웹 배포가 곧 앱 업데이트.
    url: process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : 'https://urdeal.kr',
    // 🛡️ 2026-04-22: production 에선 HTTPS 강제 (MITM 방어)
    cleartext: process.env.NODE_ENV === 'development',
    // 와일드카드 축소 — 특정 서브도메인만 허용 (DNS rebinding 방어)
    allowNavigation: [
      'urdeal.kr',
      'www.urdeal.kr',
      // 전환기: 구 도메인 링크(카톡/문자로 이미 발송분)가 앱 안에서 301 을 타려면 구 호스트 허용 필요
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
      backgroundColor: '#1B2340',
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
    // 🛡️ 2026-05-14: WebView 비디오 재생 최적화.
    //   modern bridge (useLegacyBridge=false) = 메시지 처리 빠름.
    //   captureInput=false = 키보드 입력 가로채지 않음 (라이브 채팅 안정).
    useLegacyBridge: false,
    captureInput: false,
    // 🛡️ 2026-11-03: 푸시 준비 표식(위 NATIVE_PUSH_UA_MARK 설명)
    appendUserAgent: appUserAgent(ANDROID_PUSH_READY),
  },
  ios: {
    contentInset: 'automatic',
    scheme: 'yourdeal',
    backgroundColor: '#020202',
    preferredContentMode: 'mobile',
    // 🛡️ 2026-07-18: App-Bound Domains 해제 — true 면 Info.plist WKAppBoundDomains(최대 10개)에
    //   없는 도메인 네비게이션이 차단됨. server.url 모드(live 직접 로드) + 토스 결제(카드사 도메인 다수)
    //   + 카카오 OAuth 는 10개 한도와 양립 불가. Universal Links 는 entitlements(applinks)가 담당 — 무관.
    limitsNavigationsToAppBoundDomains: false,
    // 🛡️ 2026-05-14: WKWebView 비디오 재생 최적화.
    //   allowsLinkPreview=false = 길게 누름 preview 비활성화 (라이브 시청자 오작동 방지)
    //   YouTube embed 와 충돌 안 함.
    allowsLinkPreview: false,
    // 🛡️ 2026-11-03: 푸시 준비 표식(위 NATIVE_PUSH_UA_MARK 설명)
    appendUserAgent: appUserAgent(IOS_PUSH_READY),
    // hardware 가속은 WKWebView 기본 ON — 변경 불필요.
    // 비디오 inline 재생은 YouTube embed 의 playsinline=1 + allow="autoplay" 가 처리.
  },
};

export default config;
