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

export function detectInAppBrowser(): InAppBrowserName | null {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent
  for (const { name, regex } of PATTERNS) {
    if (regex.test(ua)) return name
  }
  return null
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false
  return /android/i.test(navigator.userAgent)
}

/**
 * 🛡️ 2026-04-28: 카카오톡 인앱 → 외부 브라우저 *자동* redirect.
 *
 * 카카오톡 인앱은 무한 reload + 흰화면 발생 케이스가 많아서, detect 즉시 강제 이동.
 * (다른 인앱은 안내 배너로 사용자 선택)
 *
 * sessionStorage 로 1회만 시도 — 사용자가 외부 브라우저에서 다시 카톡 링크 클릭 시
 * 무한 redirect 안 일어나도록 가드.
 *
 * @returns redirect 시도했으면 true (호출자가 React 마운트 중단해야 함)
 */
const KAKAO_REDIRECT_KEY = 'ur_kakao_external_redirect_v1'

export function autoRedirectKakaoToExternal(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
  if (detectInAppBrowser() !== 'kakao') return false

  // 이미 한 번 시도했으면 스킵 (무한 루프 방지)
  try {
    if (sessionStorage.getItem(KAKAO_REDIRECT_KEY) === '1') return false
    sessionStorage.setItem(KAKAO_REDIRECT_KEY, '1')
  } catch { /* sessionStorage 차단된 경우에도 진행 */ }

  const url = window.location.href
  if (isIOS()) {
    window.location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url)
  } else {
    const target = url.replace(/^https?:\/\//, '')
    window.location.href = 'intent://' + target + '#Intent;scheme=https;package=com.android.chrome;end'
  }
  return true
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
      window.location.href = 'intent://' + target + '#Intent;scheme=https;package=com.android.chrome;end'
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
    window.location.href = 'intent://' + target + '#Intent;scheme=https;package=com.android.chrome;end'
    return true
  }

  // iOS 페이스북/인스타: 공식 스킴 없음 → 사용자에게 수동 안내 필요
  return false
}
