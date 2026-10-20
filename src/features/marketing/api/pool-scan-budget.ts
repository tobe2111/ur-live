/**
 * ⏱️ **풀 전수 스캔의 인보케이션당 작업 상한** — 순수 판정(DB·fetch 무접촉).
 *
 *   `influencer-performance.ts` 에서 분리(2026-08-01). 재분류(performance)와 재추출(maintenance)이
 *   **같은 상한을 공유**해야 하는데, 한쪽 파일에 두면 다른 쪽이 그 파일을 import 하게 되어
 *   의존 방향이 어색해진다(성과 수집 ← 정비). 공용 규칙은 공용 자리에 둔다.
 *   ⚠️ 호환: `influencer-performance.ts` 가 재수출하므로 기존 import 경로는 그대로 산다.
 */

/**
 * 📐 상한값의 근거 — 라이브 실측(2026-07-31) — 순수 판정(유닛으로 고정).
 *
 * ## 왜 (2026-07-31 라이브 실측 — CF 대시보드가 확정)
 * ```
 *   Errors by invocation status → Exceeded CPU Time Limits: 168 (다른 항목 전부 0)
 *   Error Rate 30.3% · CPU P50 10.1ms / P90 64.78ms / P99 189ms (스파이크 ~1초)
 * ```
 * 실패 레인은 전부 **대량 파싱·직렬화**였고 재분류가 그중 가장 무겁다:
 * 루프가 `for(;;)` 로 **D1 예산이 바닥날 때까지** 돌아, 풀 40,375행을 한 인보케이션에서
 * 다 훑을 수 있다 → 행당 정규식 ~20개 = **80만 회**. CPU 한도를 넘는다.
 *
 * ⚠️ **페이지 크기(PAGE)를 줄이는 건 답이 아니다** — 루프가 더 돌 뿐 총량이 같다.
 *    막아야 하는 것은 페이지가 아니라 **인보케이션당 총 작업량**이다.
 *
 * ✅ 커서가 이미 이어받기를 지원하므로 **커버리지 손실 0** — 덜 하고 다음 회차가 잇는다.
 *    (그래서 조기 중단 시 `done` 을 false 로 남겨 커서를 0 으로 리셋하지 않는다.)
 */
export const POOL_SCAN_MAX_ROWS = 4000
export const POOL_SCAN_MAX_MS = 3000
export function poolScanShouldStop(scanned: number, startedMs: number, nowMs: number): boolean {
  const n = Number.isFinite(scanned) ? scanned : 0
  if (n >= POOL_SCAN_MAX_ROWS) return true
  const started = Number.isFinite(startedMs) ? startedMs : nowMs
  return nowMs - started >= POOL_SCAN_MAX_MS
}

