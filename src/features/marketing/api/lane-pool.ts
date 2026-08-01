/**
 * 🧵 **제한 동시성 풀** — 레인이 네트워크를 기다리느라 벽시계를 버리는 문제 (2026-07-29).
 *
 * ## 왜 (실측)
 * 회사 보강 레인은 리드를 **한 건씩 순서대로** 처리한다. 한 건은 robots.txt + 최대 5페이지를
 * 8초 타임아웃으로 가져오므로, 느린 사이트 하나가 라운드의 벽시계를 통째로 먹는다.
 * 2026-07-29 라이브 스냅샷:
 *
 *   `processed:3 · fetches:14 · spent:21/60 · deadline_hit:false · elapsed 9.7s · targets:120`
 *   당일 누적 `rounds:13 · deadline:7 · spent:300`(가능치 780)
 *
 * 즉 **예산은 2/3 이 남는데 시간이 먼저 끝난다.** 병목은 서브리퀘스트가 아니라 *대기*다.
 * 대기는 겹칠 수 있다 — 워커 K개가 서로 다른 리드(=서로 다른 호스트)를 동시에 물면,
 * **같은 예산·같은 벽시계로 K배 가까이** 들여다본다. 요청 총량은 그대로다(공짜가 아니라 재배치).
 *
 * ## 한계·안전 (과신 금지)
 * - **동시 연결 상한**: Workers 인보케이션은 동시 오픈 커넥션이 6개다. 그래서 K 를 5로 클램프한다
 *   (크롤 1건은 한 번에 fetch 1개만 열므로 K = 동시 커넥션 수).
 * - **예산 초과분**: 워커들이 각자 마지막 한 건을 물 수 있어 정지 시점에 최대 K건이 더 지출될 수 있다.
 *   그래서 호출부는 여유(`left <= 2`)를 두고 멈춘다. 진짜 천장은 런타임이 `limitHit` 으로 알려준다.
 * - **호스트 예의**: 동시에 도는 건 *서로 다른 리드*다. 한 사이트에 동시 요청을 넣지 않는다
 *   (한 건 안의 페이지 순회는 여전히 순차다).
 * - 이 모듈은 **순서를 보장하지 않는다**(완료 순서는 응답 속도 순). 집계는 순서에 의존하지 말 것.
 */

/** Workers 동시 오픈 커넥션 6 — 여유 1을 남긴다. */
export const MAX_LANE_CONCURRENCY = 5

/** env 문자열 → 안전한 동시성(기본 3, 1~5 클램프). 비숫자·부재는 기본값. */
export function resolveConcurrency(raw: unknown, fallback = 3): number {
  const n = parseInt(String(raw ?? ''), 10)
  const base = Number.isFinite(n) && n > 0 ? n : fallback
  return Math.max(1, Math.min(MAX_LANE_CONCURRENCY, base))
}

export interface PoolResult {
  /** 실제로 착수한 건수(중단으로 못 집은 건 제외). */
  started: number
  /** 핸들러가 던진 건수 — 한 건의 예외가 라운드를 죽이지 않게 삼키되, **세어서** 보고한다. */
  failed: number
}

/**
 * `items` 를 앞에서부터 집어 최대 `concurrency` 개를 동시에 처리한다.
 * 새 건을 집기 **직전마다** `shouldStop()` 을 확인한다 — 예산/시간/한도 신호를 그대로 존중한다.
 *
 * ⚠️ 진행 중인 작업은 중단하지 않는다(중간에 끊으면 그 리드가 '시도했는데 도장 없음'으로 남아
 *    다음 라운드가 또 집는다 — 백로그가 안 흐르던 그 실패). 시작한 건은 끝까지 간다.
 */
export async function runPooled<T>(
  items: readonly T[],
  concurrency: number,
  handle: (item: T) => Promise<void>,
  shouldStop: () => boolean,
): Promise<PoolResult> {
  const k = Math.max(1, Math.min(MAX_LANE_CONCURRENCY, Math.floor(concurrency) || 1))
  let cursor = 0
  const res: PoolResult = { started: 0, failed: 0 }

  const worker = async (): Promise<void> => {
    for (;;) {
      if (shouldStop()) return
      const idx = cursor++
      if (idx >= items.length) return
      res.started++
      try { await handle(items[idx] as T) } catch { res.failed++ }
    }
  }

  await Promise.all(Array.from({ length: Math.min(k, items.length) }, () => worker()))
  return res
}
