/**
 * 🔄 **야간 재스캔 — 회차 마감선과 하위작업 선두 회전** (2026-08-03)
 *
 * `runNightlyRescan` 은 하위 작업 셋(`rescan`/`refetch`/`naver`)을 **순차** 실행한다.
 * 각자 예산(YT 쿼터·서브리퀘스트)은 갖고 있지만 **셋을 합친 시간**을 재는 것이 없어
 * 실측 **60초**를 썼다(`cpu_risk=danger`). 부모 cron 의 CPU 는 그 합계를 감당해야 한다.
 *
 * ## ⚠️ 마감선만 넣으면 마지막(`naver`)이 **영원히** 안 돈다
 *
 * 순서가 고정이면 앞의 둘이 시간을 다 쓸 때 마지막은 매 회차 잘린다.
 * 이 레인은 **하루 1회**라 그건 곧 영구 미실행이다 — `sweep-mx` 블록, `scan-notices` 키워드에서
 * 겪은 것과 같은 구조적 기아다.
 *
 * ⇒ **시작 위치를 회차마다 돌린다.** 3회면 셋 다 선두를 한 번씩 받는다.
 *
 * ## 🔇 함께 옮겨 둔 기록 — **진 쪽도 흔적을 남긴다** (2026-07-27, 다른 세션)
 *
 * 이 레인의 스냅샷이 07-27 19:00 이후 멈춰 있었다. 고장이 아니라 **시간별 정비 순환(07-28 도입)과
 * 같은 lease 를 다투다 매번 졌기 때문**인데, 진 경로가 조용히 돌아가서 어드민에는 *"never fired"* 로만
 * 보였다 — 원인 규명이 **이틀** 막힌 이유가 그 무음이다.
 *
 * 경합 자체는 스케줄러가 19시를 양보해 없앴다(`RESCAN_HOUR_UTC`). `runNightlyRescan` 의 busy 반환
 * 경로가 `ads_maintenance_rescan_last` 를 남기는 것은 **재발했을 때 즉시 알아보기 위한 것**이라,
 * 경합이 사라진 뒤에도 유지한다(하루 1회 쓰기 — 비용 무시 가능).
 * ⚠️ 원문은 `influencer-maintenance.ts` 에 있었으나 그 파일이 600줄 캡에 닿아 여기로 옮겼다(내용 무변경).
 *
 * 🧩 이 파일로 분리한 이유: `influencer-maintenance.ts` 가 600줄 캡에 닿았다(CLAUDE.md
 *   "600줄 넘어가면 **그 시점에** 추출"). 회전 정책은 자기완결이라 따로 두면 단위로도 검증된다.
 */

/** 회차 마감선 — 하위작업 셋의 **합계**를 묶는다(각자 예산과 별개). */
export const RESCAN_DEADLINE_MS = 20_000
export const RESCAN_DEADLINE_MS_PAID = 45_000
/** 선두 회전 커서 — 고정 순서면 마지막이 영구 미실행이 된다. */
export const RESCAN_ORDER_KEY = 'ads_maintenance_rescan_order'

/** 저장된 커서를 유효 범위로 정규화. 깨진 값(음수·NaN·문자)은 0 으로 본다. */
export function normalizeOrder(raw: string | null | undefined, len: number): number {
  if (len <= 0) return 0
  const n = parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(n) || n < 0) return 0
  return n % len
}

/** 이번 회차에 `ran` 개를 돌렸을 때 **다음 회차의 시작 위치**. */
export function nextOrder(from: number, ran: number, len: number): number {
  if (len <= 0) return 0
  return (from + Math.max(0, ran)) % len
}

/**
 * `from` 부터 한 바퀴 도는 인덱스 순서.
 * ⚠️ 길이만큼만 돈다 — 같은 작업을 두 번 돌리지 않는다.
 */
export function rotatedOrder(from: number, len: number): number[] {
  if (len <= 0) return []
  const start = normalizeOrder(String(from), len)
  return Array.from({ length: len }, (_, i) => (start + i) % len)
}
