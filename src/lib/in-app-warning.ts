/**
 * 🛡️ 2026-04-30 v2: 인앱 webview 차단 기능 안내 helper.
 *
 * 설계 원칙 (progressive enhancement):
 *   1. PWA standalone 이면 인앱 detect 무시 (홈 화면 설치 사용자는 풀 기능)
 *   2. navigator.permissions API 사용 가능하면 OS 가 실제 차단했는지 우선 체크
 *   3. UA 추측은 마지막 fallback (false positive 최소화)
 *   4. 사전 차단 X — try-first 패턴 권장. 실패 catch 에서 detect 후 안내.
 *
 * 차단 매트릭스 (현실 기준):
 *   카카오톡:    iOS/Android 모두 카메라/푸시/popup 강력 차단
 *   네이버앱:    iOS 카메라 차단, Android 카메라 가능. 푸시/popup 차단
 *   인스타/페북: 모든 OS 카메라/푸시/popup 차단
 *   라인:        카메라/popup 일부 가능 (iOS+Android)
 *   위챗:        모든 기능 차단
 */

import { detectInAppBrowser, openInExternalBrowser, IN_APP_LABELS, isAndroid, isIOS, type InAppBrowserName } from './in-app-browser'

export type RestrictedFeature = 'camera' | 'notification' | 'popup' | 'websocket'

const FEATURE_INFO: Record<RestrictedFeature, { title: string; desc: string; icon: string }> = {
  camera: {
    icon: '📹',
    title: '카메라가 작동하지 않아요',
    desc: '인앱 브라우저에서 카메라 권한이 거부됐어요. 외부 브라우저에서 다시 시도해주세요.',
  },
  notification: {
    icon: '🔔',
    title: '알림은 외부 브라우저에서 설정 가능해요',
    desc: '인앱 브라우저에선 푸시 알림을 받을 수 없어요. 알림톡으로 받기를 권장합니다.',
  },
  popup: {
    icon: '💳',
    title: '결제창이 열리지 않아요',
    desc: '인앱 브라우저에서 결제 팝업이 차단됐어요. 외부 브라우저에서 진행해주세요.',
  },
  websocket: {
    icon: '💬',
    title: '실시간 채팅이 자주 끊겨요',
    desc: '인앱 브라우저는 채팅 연결이 불안정해요. 외부 브라우저에서 더 안정적으로 시청 가능합니다.',
  },
}

// ── 1. PWA standalone 감지 ──────────────────────────────────────────
/** PWA 로 홈 화면에서 실행 중인지 — 풀 기능 사용 가능 */
export function isPWAStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // 표준 (iOS Safari + 최신 Android Chrome)
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  // iOS Safari 레거시
  const nav = window.navigator as Navigator & { standalone?: boolean }
  if (nav.standalone === true) return true
  return false
}

// ── 2. permissions API 활용 ─────────────────────────────────────────
/**
 * camera/microphone 권한 상태 체크 (브라우저가 실제 거부 상태 알려줌).
 * @returns 'granted' | 'denied' | 'prompt' | 'unknown' (API 미지원)
 */
export async function checkPermission(name: 'camera' | 'microphone' | 'notifications' | 'geolocation'): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unknown'
  try {
    const r = await navigator.permissions.query({ name: name as PermissionName })
    return r.state as 'granted' | 'denied' | 'prompt'
  } catch {
    // 일부 브라우저는 query 자체를 throw — webview 가능성 ↑
    return 'unknown'
  }
}

// ── 3. UA 기반 차단 매트릭스 (마지막 fallback) ────────────────────────
/** 인앱 webview 별 기능 차단 가능성 매트릭스 */
function uaBlockMatrix(inApp: InAppBrowserName, feature: RestrictedFeature): boolean {
  const ios = isIOS()
  const android = isAndroid()
  switch (inApp) {
    case 'kakao':
      // 카카오톡: 모든 OS 카메라/푸시/popup 차단. WebSocket 불안정.
      return true
    case 'naver':
      // 네이버앱: iOS 카메라 차단, Android 카메라 가능. 푸시/popup 차단.
      if (feature === 'camera') return ios && !android
      return feature === 'notification' || feature === 'popup'
    case 'facebook':
    case 'instagram':
      // FB/IG: 모든 OS 카메라/푸시/popup 차단
      return feature === 'camera' || feature === 'notification' || feature === 'popup'
    case 'line':
      // 라인: 카메라/popup 부분 가능. 푸시만 차단.
      return feature === 'notification'
    case 'wechat':
      // 위챗: 모든 기능 차단 (가장 엄격)
      return true
    case 'kakaostory':
    case 'daum':
    case 'zalo':
      // 보수적으로 차단 가정
      return feature !== 'websocket'
    default:
      return false
  }
}

// ── 4. 통합 판단 ──────────────────────────────────────────────────────
/**
 * 해당 기능이 차단됐는지 판단 (progressive enhancement).
 *
 * 우선순위:
 *   1. PWA standalone → 무조건 false (풀 기능)
 *   2. permissions API 가 'denied' → true (확실 차단)
 *   3. permissions API 가 'granted' → false (확실 가능)
 *   4. UA 매트릭스 → 추정 (마지막 fallback)
 *
 * 권장 사용: try-first 패턴의 catch 안에서 호출.
 *   try { getUserMedia() } catch (e) {
 *     if (e.name === 'NotAllowedError' && await isFeatureBlocked('camera')) showModal()
 *   }
 */
export async function isFeatureBlocked(
  feature: RestrictedFeature,
  options: { inApp?: InAppBrowserName | null; permissionState?: 'granted' | 'denied' | 'prompt' | 'unknown' } = {}
): Promise<boolean> {
  // 1. PWA standalone — 무조건 풀 기능
  if (isPWAStandalone()) return false

  // 2. permissions API 명시 (사용 가능한 경우)
  if (options.permissionState !== undefined) {
    if (options.permissionState === 'granted') return false
    if (options.permissionState === 'denied') return true
    // 'prompt' / 'unknown' 은 매트릭스로 fallback
  } else if (feature === 'camera') {
    const state = await checkPermission('camera')
    if (state === 'granted') return false
    if (state === 'denied') return true
  } else if (feature === 'notification') {
    const state = await checkPermission('notifications')
    if (state === 'granted') return false
    if (state === 'denied') return true
  }

  // 3. UA 매트릭스 fallback
  const detected = options.inApp !== undefined ? options.inApp : detectInAppBrowser()
  if (!detected) return false
  return uaBlockMatrix(detected, feature)
}

/**
 * 동기 버전 — async 안 되는 곳용. permissions API skip.
 * 정확도 ↓ 이지만 즉시 판단 가능.
 */
export function isFeatureBlockedSync(
  feature: RestrictedFeature,
  options: { inApp?: InAppBrowserName | null } = {}
): boolean {
  if (isPWAStandalone()) return false
  const detected = options.inApp !== undefined ? options.inApp : detectInAppBrowser()
  if (!detected) return false
  return uaBlockMatrix(detected, feature)
}

/** 안내 모달용 컨텐츠 */
export function getFeatureInfo(feature: RestrictedFeature) {
  return FEATURE_INFO[feature]
}

/** 사용자가 '외부 브라우저로 열기' 클릭 시 처리 */
export function handleOpenExternal(): boolean {
  return openInExternalBrowser()
}

/** 인앱 브라우저 이름 (한국어) — 모달 안내용 */
export function getInAppLabel(): string | null {
  const detected = detectInAppBrowser()
  return detected ? IN_APP_LABELS[detected] : null
}
