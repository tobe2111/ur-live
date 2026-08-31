/**
 * 🍽️ **화면에 내보내는 통계 — 캐시 + 오늘만 실시간** (2026-08-31).
 *
 * ## 왜 나눴나
 * 이 표의 숫자는 **수집 회차가 만든다.** 그 회차는 시간당 1회이므로 분포(업종·tier·소스)는
 * 시간 단위로만 바뀐다 ⇒ 1시간 캐시로 충분하고, 5분마다 다시 세는 것은 같은 답을 12번 구하는 짓이었다.
 *
 * **딱 하나 예외가 오늘 유입**이다 — 대표가 "수집이 살아 있나"를 보는 숫자라, 이게 낡으면
 * 캐시의 의미가 없어진다(멀쩡히 도는데 멈춘 것처럼 보인다). 그래서 그것만 **매번 실시간**으로 덮는다.
 *
 * ```
 *   전체 다시 세기   929,284행      ← 캐시가 만료된 회차에만
 *   오늘만 세기        7,234행      ← 매 요청 (인덱스로 오늘치만, 전체의 0.8%)
 *   캐시 적중 시           1행      ← 설정 한 줄
 * ```
 *
 * ⚠️ **덮어쓰기지 더하기가 아니다.** `total + 오늘` 식으로 추정하면 병합·삭제가 반영되지 않아
 *   조용히 어긋난다. 오늘 막대만 **다시 세어 그 자리에 넣는다** — 나머지 막대는 과거라 안 변한다.
 * ⚠️ 실패하면 캐시 값을 그대로 쓴다(던지지 않는다). 오늘 숫자가 잠깐 낡는 것이 화면이 죽는 것보다 낫다.
 */
import { companyStats } from './company-discovery'
import { getCompanyStatsCached } from './company-stats-cache'
import { todayInflow } from './company-breakdown'

type Stats = Awaited<ReturnType<typeof companyStats>>

/**
 * 캐시된 표를 가져와 **오늘 막대만 실시간 값으로 교체**한다.
 *
 * @param bg 응답 뒤 갱신을 태울 곳(`c.executionCtx.waitUntil`). 없으면 동기 계산 — 느릴 뿐 틀리지 않는다.
 */
export async function serveCompanyStats(
  DB: D1Database, fresh: boolean, bg?: (p: Promise<unknown>) => void,
): Promise<{ stats: Stats; at: number }> {
  const { stats, at } = await getCompanyStatsCached<Stats>(DB, fresh, () => companyStats(DB), bg)
  const today = await todayInflow(DB)
  if (!today) return { stats, at } // 실패 시 캐시 값 그대로 — 화면을 죽이지 않는다
  const byDay = stats.byDay.map(d => (d.d === today.d ? { ...d, n: today.n, reachable: today.reachable } : d))
  // 자정 직후처럼 **캐시에 오늘 막대가 아예 없을 때**는 앞에 끼워 넣는다(없으면 오늘이 0으로 보인다).
  if (!byDay.some(d => d.d === today.d)) byDay.unshift(today)
  return { stats: { ...stats, byDay, todayKst: today.d }, at }
}
