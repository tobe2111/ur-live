/**
 * 🛡️ 2026-04-30: 인앱 webview 에서 차단되는 기능별 사용자 안내 helper.
 *
 * 카카오톡/네이버/FB/IG/라인 webview 에서 다음 기능은 silently 막힘:
 *   - getUserMedia (camera/mic) — 셀러 라이브 송출
 *   - Notification.requestPermission — 푸시 알림
 *   - WebSocket 안정성 — 라이브 채팅 (~30% reconnect)
 *   - window.open popup — Toss 결제
 *
 * 정책: 차단된 기능을 사용하려는 시점에만 안내 (사전 차단 X).
 */

import { detectInAppBrowser, openInExternalBrowser, IN_APP_LABELS, type InAppBrowserName } from './in-app-browser'

export type RestrictedFeature = 'camera' | 'notification' | 'popup' | 'websocket'

const FEATURE_INFO: Record<RestrictedFeature, { title: string; desc: string; icon: string }> = {
  camera: {
    icon: '📹',
    title: '라이브 방송은 카메라가 필요해요',
    desc: '인앱 브라우저에선 카메라 권한이 막혀있어 외부 브라우저에서 진행해야 합니다.',
  },
  notification: {
    icon: '🔔',
    title: '알림은 외부 브라우저에서 설정 가능해요',
    desc: '인앱 브라우저에선 푸시 알림 권한 요청이 차단됩니다. 알림톡으로 받기를 권장해요.',
  },
  popup: {
    icon: '💳',
    title: '결제창이 열리지 않아요',
    desc: '인앱 브라우저에선 결제 팝업이 차단될 수 있어요. 외부 브라우저에서 진행해주세요.',
  },
  websocket: {
    icon: '💬',
    title: '실시간 채팅이 자주 끊겨요',
    desc: '인앱 브라우저에선 채팅 연결이 불안정해요. 외부 브라우저에서 더 안정적으로 시청 가능합니다.',
  },
}

/** 인앱 webview 에서 해당 기능이 차단됐을 가능성이 있는지 */
export function isFeatureBlocked(feature: RestrictedFeature, inApp?: InAppBrowserName | null): boolean {
  const detected = inApp !== undefined ? inApp : detectInAppBrowser()
  if (!detected) return false
  // 카카오만 카메라/푸시/팝업 강력 차단. 나머지 인앱은 일부 작동.
  if (detected === 'kakao') return true
  // Naver/FB/IG/Line 도 popup/camera 자주 차단
  if (feature === 'camera' || feature === 'popup') {
    return ['naver', 'facebook', 'instagram', 'line', 'wechat'].includes(detected)
  }
  return false
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
