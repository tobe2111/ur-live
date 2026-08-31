/**
 * 📉 **파트너 풀 통계 캐시** — 화면 한 번에 330만 행을 읽던 것 (2026-08-31).
 *
 * ## 무엇이 문제였나 (라이브 실측)
 * `companyStats()` 는 `ad_company_leads` **전수 집계를 8번** 돈다(총계·카테고리별·일자별·tier별·
 * 종류별·소스별·대행사 퍼널·세그먼트). 통제된 실험으로 쟀다 — 호출 **1회에 3,317,537행**.
 * D1 무료 한도가 하루 500만 행이니 **화면 한 번이 그날 예산의 66%** 다.
 *
 * ## 그런데 진짜 사고는 화면이 아니라 **폴링**이었다
 * 관리자가 레인 실행 버튼을 누르면 `AdminPartnerPoolPage` 가 완료를 감지하려고
 * **5초마다 36번** `/stats` 를 부른다.
 * ```
 *   36회 × 3,317,537행  =  약 1억 1,900만 행   ← 버튼 한 번
 * ```
 * 업체 DB 의 하루 읽기가 ~1억 행이었던 것의 정체가 이것이다.
 *
 * ## 처방 — 무거운 절반만 캐시한다
 * 폴러가 완료를 판정할 때 보는 것은 **레인 상태 블롭**(`ads_*_stats` 의 `last_run`)이지 집계가 아니다.
 * ⇒ 집계만 TTL 캐시하고 **상태는 매번 신선하게** 둔다. 폴링은 계속 5초마다 돌지만 비용이 사라지고,
 *   완료 감지는 **동작이 그대로**다.
 *
 * ⚠️ 캐시가 늙지 않으면 화면 숫자가 굳는다 — TTL 이 그 상한이고, 데이터를 바꾸는 요청
 *   (추가·가져오기·삭제·재분류)은 **끝나고 캐시를 버린다**(`invalidateCompanyStatsCache`).
 * ⚠️ 지금 당장 정확한 값이 필요하면 `?fresh=1` 로 우회할 수 있다.
 */
export const COMPANY_STATS_CACHE_KEY = 'ads_company_stats_cache'
/**
 * ⏱️ **수명은 수집 주기에 맞춘다** (2026-08-31 — 5분에서 1시간으로).
 *
 * 이 표의 숫자는 **수집 회차가 만든다.** 그 회차는 시간당 1회다 ⇒ 5분마다 다시 세는 것은
 * *같은 답을 12번 구하는 것*이었다(회당 93만 행). 수명을 데이터가 실제로 바뀌는 주기에
 * 맞추면 낡음이 **의미를 갖지 않는다** — 5분 된 값과 55분 된 값이 같은 값이다.
 *
 * ⚠️ 유일한 예외가 **오늘 유입**이다(회차마다 는다). 그건 캐시에서 꺼내 쓰지 않고
 *   **매번 실시간으로 덮어쓴다** — 인덱스로 오늘치만 읽어 실측 7,234행(전체 93만의 0.8%).
 *   그래서 "수집이 살아 있나"는 항상 지금 값이고, 분포 표만 최대 1시간 낡는다.
 *   근거·배선: `company-stats-serve.ts`.
 */
export const COMPANY_STATS_TTL_MS = 60 * 60_000

export interface CachedStats<T> { at: number; data: T }

/** 캐시가 쓸 만한가. 모양이 이상하거나(시각 없음·미래 시각) TTL 을 넘겼으면 새로 계산한다. */
export function parseStatsCache<T>(raw: string | null | undefined): CachedStats<T> | null {
  if (!raw) return null
  try {
    const j = JSON.parse(raw) as { at?: unknown; data?: unknown }
    const at = Number(j.at)
    if (!Number.isFinite(at) || at <= 0) return null
    if (j.data == null || typeof j.data !== 'object') return null
    return { at, data: j.data as T }
  } catch { return null }
}

/** 지금 다시 계산해야 하는가 — 캐시가 없거나, 깨졌거나, TTL 을 넘겼거나, 시각이 미래면. */
export function shouldRecomputeStats(cached: CachedStats<unknown> | null, nowMs: number): boolean {
  if (!cached) return true
  const age = nowMs - cached.at
  return age < 0 || age >= COMPANY_STATS_TTL_MS
}

/** 데이터를 바꾼 요청이 호출한다 — 다음 조회가 즉시 다시 계산하게. 실패해도 던지지 않는다(TTL 이 백스톱). */
export async function invalidateCompanyStatsCache(DB: D1Database): Promise<void> {
  await DB.prepare('DELETE FROM platform_settings WHERE key = ?').bind(COMPANY_STATS_CACHE_KEY).run().catch(() => null)
}


/**
 * ⏳ **낡았어도 이만큼까지는 먼저 보여준다** (2026-08-31 — 배포 후 실측이 시킨 후속).
 *
 * TTL 만 두면 만료된 첫 방문자가 계산을 **기다린다** — 라이브 실측 **10.4초**(큐브가 큰 GROUP BY 라
 * 정렬 비용이 붙는다. 캐시 적중은 0.5초). 화면 카드가 10초 비어 있는 건 고친 게 아니다.
 *
 * ⇒ TTL 을 넘겨도 이 한계 안이면 **낡은 값을 즉시 주고 갱신은 응답 뒤에** 돌린다.
 *   다음 방문자는 새 값을 본다. 그 사이 숫자는 최대 이만큼 낡고, 응답의 `at` 이 그걸 말해 준다.
 *
 * ⚠️ 무한대로 두면 안 된다 — 아무도 안 오다가 온 사람이 **몇 시간 전 숫자**를 최신인 줄 보게 된다.
 *   그 한계를 넘으면 기다리더라도 정확한 값을 준다(느린 것보다 틀린 게 나쁘다).
 */
export const COMPANY_STATS_MAX_STALE_MS = 2 * 60 * 60_000

/** 낡은 값을 먼저 주고 뒤에서 갱신할 수 있는가 — TTL 은 넘겼지만 한계 안일 때. */
export function canServeStale(cached: CachedStats<unknown> | null, nowMs: number): boolean {
  if (!cached) return false
  const age = nowMs - cached.at
  return age >= COMPANY_STATS_TTL_MS && age < COMPANY_STATS_MAX_STALE_MS
}

/**
 * 집계를 캐시 경유로 얻는다. 라우트는 이 함수만 부른다 — 읽기·판정·저장이 한 자리에 있어야
 * 셋 중 하나만 바뀌는 사고가 안 난다(캐시는 그 조합이 어긋날 때 조용히 무의미해진다).
 *
 * @param fresh `?fresh=1` — 지금 당장 정확한 값이 필요할 때의 우회로(낡은 값도 안 쓴다).
 * @param bg 응답 뒤 갱신을 태울 곳(`c.executionCtx.waitUntil`). **없으면 동기 계산으로 떨어진다** —
 *   느려질 뿐 틀리지 않는다(cron·테스트처럼 waitUntil 이 없는 자리를 위한 안전한 기본값).
 * @returns `at` 은 이 숫자가 **언제 기준인지**. 화면이 "N분 전 기준"을 보여줄 수 있어야
 *   캐시된 값을 최신값으로 오해하지 않는다.
 */
export async function getCompanyStatsCached<T>(
  DB: D1Database, fresh: boolean, compute: () => Promise<T>,
  bg?: (p: Promise<unknown>) => void,
): Promise<{ stats: T; at: number }> {
  const row = fresh ? null : await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
    .bind(COMPANY_STATS_CACHE_KEY).first<{ value: string }>().catch(() => null)
  const cached = parseStatsCache<T>(row?.value)
  const now = Date.now()
  if (!fresh && !shouldRecomputeStats(cached, now)) return { stats: cached!.data, at: cached!.at }
  const store = async (stats: T, at: number) => {
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind(COMPANY_STATS_CACHE_KEY, JSON.stringify({ at, data: stats })).run().catch(() => null)
  }
  // 🚀 낡았지만 쓸 만하면 **먼저 주고** 갱신은 뒤에서. 실패해도 던지지 않는다 — 갱신 실패가
  //   화면을 깨면 안 되고, 실패하면 다음 방문자가 다시 시도한다(캐시는 그대로 낡아 있을 뿐).
  if (!fresh && bg && canServeStale(cached, now)) {
    bg(compute().then(s => store(s, Date.now())).catch(() => null))
    return { stats: cached!.data, at: cached!.at }
  }
  const stats = await compute()
  const at = Date.now()
  await store(stats, at)
  return { stats, at }
}


/**
 * 🧹 비-GET 요청이 끝나면 캐시를 버리는 미들웨어. **라우트별로 넣지 않는다** — 새 라우트에서
 * 반드시 빠지고, 그 누락은 "화면 숫자가 가끔 안 바뀐다"로만 드러나 아무도 원인을 못 찾는다.
 * ⚠️ 레인 위임(킥)은 데이터가 나중에 바뀌므로 이걸로 안 잡힌다 — 그건 TTL 이 받는다.
 */
export function invalidateStatsOnWrite(dbOf: (env: never) => D1Database) {
  return async (c: { req: { method: string }; env: never }, next: () => Promise<void>): Promise<void> => {
    await next()
    if (c.req.method !== 'GET') await invalidateCompanyStatsCache(dbOf(c.env))
  }
}
