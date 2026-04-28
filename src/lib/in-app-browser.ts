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

const PATTERNS: Array<{ name: InAppBrowserName; regex: RegExp }> = [
  { name: 'kakao', regex: /kakaotalk/i },
  { name: 'naver', regex: /naver\(inapp|whale\/.+mobile/i },
  { name: 'facebook', regex: /fb_iab|fbav|fban/i },
  { name: 'instagram', regex: /instagram/i },
  { name: 'line', regex: /\bline\//i },
  { name: 'wechat', regex: /micromessenger/i },
  { name: 'zalo', regex: /zalo/i },
  { name: 'kakaostory', regex: /kakaostory/i },
  { name: 'daum', regex: /daumapps/i },
]

export type InAppBrowserName =
  | 'kakao' | 'naver' | 'facebook' | 'instagram'
  | 'line' | 'wechat' | 'zalo' | 'kakaostory' | 'daum'

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
