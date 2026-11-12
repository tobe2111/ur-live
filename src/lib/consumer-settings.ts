/**
 * 🎛️ 공개 손님 설정(`GET /api/consumer-settings`)을 **한 번만** 받는다 (2026-11-12 대표 승인 — 지도 첫 화면 중복 요청).
 *
 * 받는 곳이 둘이다 — 재방문 즉시 표시 서비스 워커의 켜짐 판정(`shell-sw.ts`, 모든 화면 한가할 때)과 지도의 할인 강조 임계값
 * (`useKakaoMap.ts`). 각자 부르던 탓에 지도 첫 화면에서 같은 요청이 두 번 나갔다(`check-duplicate-fetch` 의 `/map` 빨간불).
 * 한 탭 안에서는 같은 약속(promise)을 나눠 쓴다. 값이 바뀌어도 다음 새로고침에 반영되면 충분한 설정들이다.
 *
 * ⚠️ 아무것도 import 하지 않는다 — `shell-sw.ts` 가 부팅 직후 동적으로 부르므로 axios(`lib/api`) 청크를 끌어오지 않게 한다.
 */
export interface ConsumerSettings { shell_sw_enabled?: unknown; map_highlight_discount_pct?: number; [k: string]: unknown }

let pending: Promise<ConsumerSettings | null> | null = null

/** 실패하면 null(부르는 쪽이 코드 기본값을 쓴다). 실패도 기억한다 — 한 탭에서 다시 두드리지 않는다. */
export function loadConsumerSettings(): Promise<ConsumerSettings | null> {
  if (!pending) {
    pending = fetch('/api/consumer-settings', { credentials: 'same-origin' })
      .then((r) => (r.ok ? (r.json() as Promise<{ data?: ConsumerSettings }>) : null))
      .then((j) => j?.data ?? null)
      .catch(() => null)
  }
  return pending
}

/** 시험 전용 — 기억을 지운다. */
export function __resetConsumerSettingsForTest(): void { pending = null }
