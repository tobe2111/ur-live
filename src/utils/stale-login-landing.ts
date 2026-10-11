/**
 * 🕰️ 옛 로그인 착지 주소 판정 (2026-10-11 대표 "모두 가장 이상적으로 고치자" — 아이폰 로그인 실패 기록 추적)
 *
 * 카카오 콜백은 `/어딘가?login=success&userId=…#st=<120초 티켓>` 으로 착지시킨다. 앱은 그 주소를 보면
 * 로그인 상태를 새로 깔고(이전 사용자 데이터 wipe 포함) 티켓을 세션으로 바꾼다.
 *
 * 그런데 그 주소가 **나중에 다시 열릴 수 있다** — 사파리 방문 기록·주소창 자동완성·탭 복원이 착지
 * 주소를 그대로 기억한다(앱이 곧바로 주소를 지우지만 기록은 이미 남은 뒤다). 라이브 실측 2026-10-10:
 * 아이폰 사파리에서 세션 교환이 3번 연속 거절됐는데, **그 시각 카카오 콜백은 0건**이었다 — 로그인을
 * 한 게 아니라 몇 달 전 착지 주소가 다시 열린 것이다. 그때 앱은 ① 남의(혹은 옛) 사용자로 화면을 깔고
 * ② 이미 죽은 티켓을 세 번 서버에 던졌다.
 *
 * 판정은 **티켓의 만료 시각(exp)** 하나로 한다. 서명 검증은 서버의 일이고(여기선 못 한다), 여기서는
 * "이미 한참 지난 착지인가" 만 본다. 폰 시계가 틀린 경우를 위해 여유를 크게 둔다(STALE_GRACE_SEC).
 * 판정이 애매하면(티켓 없음·해독 실패) **옛날로 보지 않는다** — 정상 로그인을 막는 쪽이 더 나쁘다.
 */

/** 서버 티켓 수명은 120초. 폰 시계 오차를 넉넉히 덮도록 만료 뒤 10분까지는 정상으로 본다. */
export const STALE_GRACE_SEC = 600

/** `#st=` 티켓의 exp(초). 없거나 못 읽으면 null. 서명은 확인하지 않는다(서버 몫). */
export function landingTicketExp(hash: string): number | null {
  try {
    const m = (hash || '').match(/[#&]st=([^&]+)/)
    if (!m) return null
    const parts = decodeURIComponent(m[1]).split('.')
    if (parts.length !== 3) return null
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '='))
    const exp = (JSON.parse(json) as { exp?: unknown }).exp
    return typeof exp === 'number' && Number.isFinite(exp) ? exp : null
  } catch {
    return null
  }
}

/** 착지 주소의 티켓이 만료 + 여유까지 지났으면 true — 이 로드는 로그인으로 취급하지 않는다. */
export function isStaleLoginLanding(hash: string, nowSec: number): boolean {
  const exp = landingTicketExp(hash)
  return exp !== null && nowSec > exp + STALE_GRACE_SEC
}
