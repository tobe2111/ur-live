/**
 * 🛡️ 2026-04-28: 인앱 브라우저 감지 + 외부 브라우저 안내
 *
 * 카카오톡/네이버/페이스북/인스타그램/라인 등 인앱 브라우저는 WebView 호환성
 * 이슈로 흰화면, third-party cookie 차단, OAuth redirect 실패 등 발생.
 *
 * 정책:
 *   - 강제 redirect 하지 않음 (사용자 이탈 위험)
 *   - 일단 정상 마운트 시도
 *   - 상단에 "외부 브라우저로 열기" 안내 배너 표시 (사용자 선택)
 */

// 🛡️ 2026-04-30 v3: Google app / TikTok / Twitter 추가.
//   주의: 일반 Chrome / Safari / Samsung Internet / Whale (PC) / Edge / Firefox 는
//   여기 매칭되지 않음 → null 반환 → 모든 기능 정상 사용.
//   Chrome Custom Tabs 도 풀 Chrome 이므로 detect 안 됨 (정상).
const PATTERNS: Array<{ name: InAppBrowserName; regex: RegExp }> = [
  { name: 'kakao', regex: /kakaotalk/i },
  // 네이버앱 인앱 (iOS/Android). Whale 의 모바일 인앱 UA 포함. PC Whale 은 매칭 X.
  { name: 'naver', regex: /naver\(inapp|whale\/.+mobile/i },
  { name: 'facebook', regex: /fb_iab|fbav|fban/i },
  { name: 'instagram', regex: /instagram/i },
  { name: 'line', regex: /\bline\//i },
  { name: 'wechat', regex: /micromessenger/i },
  { name: 'zalo', regex: /zalo/i },
  { name: 'kakaostory', regex: /kakaostory/i },
  { name: 'daum', regex: /daumapps/i },
  // Google Search App (iOS/Android) — 검색 → 외부 링크 클릭 시 인앱 진입
  { name: 'google', regex: /\bGSA\/|GoogleApp\//i },
  // TikTok — Bytedance webview (한국 점유율 ↑)
  { name: 'tiktok', regex: /Bytedance|musical_ly|TikTok/i },
  // Twitter / X
  { name: 'twitter', regex: /\bTwitter|TwitterAndroid|TwitteriPhone/i },
  // Threads (Meta) — barcelona 코드네임
  { name: 'threads', regex: /BarcelonaApp/i },
]

export type InAppBrowserName =
  | 'kakao' | 'naver' | 'facebook' | 'instagram'
  | 'line' | 'wechat' | 'zalo' | 'kakaostory' | 'daum'
  | 'google' | 'tiktok' | 'twitter' | 'threads'

export const IN_APP_LABELS: Record<InAppBrowserName, string> = {
  kakao: '카카오톡',
  naver: '네이버',
  facebook: '페이스북',
  instagram: '인스타그램',
  line: '라인',
  wechat: '위챗',
  zalo: '잘로',
  kakaostory: '카카오스토리',
  daum: '다음',
  google: '구글 앱',
  tiktok: '틱톡',
  twitter: 'Twitter',
  threads: 'Threads',
}

/**
 * 🛡️ 2026-07-18 앱 출시 대비 (app-ready-audit §2 선결과제): 자사 Capacitor 래퍼 감지.
 *   자사 앱의 WebView 는 '적대적 인앱 브라우저'가 아님 — 외부 브라우저 유도 배너/자동 redirect 를
 *   띄우면 안 됨(앱에서 앱 밖으로 쫓아내는 꼴). Capacitor 전역 객체로 판별(주입 전 아주 이른
 *   시점엔 UA 폴백 없음 — 배너 컴포넌트는 마운트 후 호출이라 안전).
 */
export function isOwnAppWebView(): boolean {
  if (typeof window === 'undefined') return false
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  try { return !!cap?.isNativePlatform?.() } catch { return false }
}

export function detectInAppBrowser(): InAppBrowserName | null {
  if (typeof navigator === 'undefined') return null
  // 자사 앱 래퍼는 인앱 브라우저 아님 — 배너/외부유도 대상에서 제외
  if (isOwnAppWebView()) return null
  const ua = navigator.userAgent
  for (const { name, regex } of PATTERNS) {
    if (regex.test(ua)) return name
  }
  return null
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/iphone|ipad|ipod/i.test(ua)) return true
  // 🛡️ 2026-06-20 (A3): iPadOS 13+ 사파리는 기본 '데스크톱' UA(Macintosh)라 ipad 미포함 →
  //   touch 가능한 Mac 으로 iPad 판별(데스크톱 Mac 은 maxTouchPoints 0~1). iPad 인앱→외부열기 경로 정상화.
  if (/Macintosh/i.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1) return true
  return false
}

export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false
  return /android/i.test(navigator.userAgent)
}

/**
 * 🛡️ 2026-07-23 (대표 지시 "카톡도 그냥 열리게"): 카카오톡 인앱도 자동 외부 이동하지 않음.
 *
 * 배경: 2026-04-28 도입 당시엔 카톡 인앱이 흰화면 + 무한 reload 가 잦아 detect 즉시 강제 이동했으나,
 *   ① 무한 reload 의 실제 원인은 리다이렉트를 가드 없이 매번 시도한 것(2026-04-29 sessionStorage
 *      가드로 해결) ② 흰화면의 근본 원인이던 Service Worker/PWA(카카오 OAuth 차단)는 2026-04-27 제거
 *   ③ 이후 부팅/청크 자가복구가 견고해짐 → 원래 사유가 대부분 해소. 게다가 카카오 로그인은 카카오톡
 *   인앱 브라우저(자체 세션) 안에서가 오히려 제일 잘 됨.
 *
 * 정책: 카톡 포함 모든 인앱은 앱을 그대로 렌더 + 상단 InAppBrowserBanner 의 "외부 브라우저로 열기"
 *   (openInExternalBrowser)로 수동 이동. 이 함수는 no-op(항상 false) 으로 유지 — main.tsx 의
 *   `if (!_kakaoRedirected)` 마운트 게이트가 항상 통과하도록.
 *
 * ⚠️ 회귀(카톡 인앱 흰화면) 발견 시 롤백: git 이력에서 kakao scheme 자동 이동 본문 복원 +
 *   index.html 인라인 스크립트의 카톡 scheme 복원(SSOT 쌍).
 *
 * @returns 항상 false (자동 이동 안 함)
 */
export function autoRedirectKakaoToExternal(): boolean {
  return false
}

/**
 * 외부 브라우저로 열기 시도. OS·인앱 종류별 분기.
 * @returns scheme 호출했으면 true. (실제 redirect 성공 여부는 OS 가 결정 — 알 수 없음)
 */
export function openInExternalBrowser(): boolean {
  const inApp = detectInAppBrowser()
  const url = window.location.href

  if (inApp === 'kakao') {
    if (isIOS()) {
      window.location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url)
    } else {
      const target = url.replace(/^https?:\/\//, '')
      // 🛡️ 2026-06-17: Chrome 미설치 폴백 (위 autoRedirect 와 동일).
      window.location.href = 'intent://' + target + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(url) + ';end'
    }
    return true
  }

  if (inApp === 'line') {
    // 라인 공식 외부 브라우저 스킴
    const sep = url.includes('?') ? '&' : '?'
    window.location.href = url + sep + 'openExternalBrowser=1'
    return true
  }

  if (isAndroid()) {
    // 안드로이드는 Chrome intent 로 강제 시도 (FB/IG/네이버 등)
    const target = url.replace(/^https?:\/\//, '')
    window.location.href = 'intent://' + target + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(url) + ';end'
    return true
  }

  // iOS 페이스북/인스타: 공식 스킴 없음 → 사용자에게 수동 안내 필요
  return false
}
