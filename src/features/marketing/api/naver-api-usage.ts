/**
 * 📟 **네이버 오픈API 일일 호출 계측** (2026-08-03 — 대표 질문 *"무료 한도 안에서 쓰고 있는 게 맞나"*).
 *
 * ## 왜 필요했나
 * 유튜브는 `ads_yt_search_used`·`ads_yt_perf_units`, 카카오는 `ads_kakao_sweep_stats.day_lookups` 로
 * **일별 실사용을 센다.** 네이버만 카운터가 없어서, 한도 안이라는 답이 *측정*이 아니라 *추정*이었다
 * (수집 레인의 `naver.found` 로 역산). 추정으로 답하는 자리는 언젠가 틀린다 — 그래서 센다.
 *
 * ## 세는 방식 — 콜마다 D1 을 쓰지 않는다
 * 호출마다 D1 에 쓰면 **네이버 콜 1회가 서브리퀘스트 2회**가 되어 레인 예산(45)을 반토막 낸다.
 * ⇒ 인보케이션 안에서는 모듈 스코프에 **누적만** 하고, 레인이 회차 끝에 **한 번** flush 한다
 * (유튜브가 `ytUnitsUsed + ytUnits` 를 회차 끝에 1회 쓰는 것과 같은 형태).
 *
 * ⚠️ **못 하는 것 / 알고 쓸 것**
 * - **자동 레인만 센다.** 어드민 온디맨드 도구(`keyword-tools`·`rank-tracker`·`competitor-tracker`)는
 *   사람이 눌러야 돌고 볼륨이 낮아 계측 밖이다. ⇒ 이 값은 **실사용의 하한**이지 총계가 아니다.
 * - **키 단위 쿼터를 워커가 알 수는 없다.** 25,000 은 네이버가 공표한 기본값이고, 실제 한도는
 *   애플리케이션 설정에 따라 다를 수 있다. 초과 판정의 근거는 이 숫자가 아니라 **429/한도 에러 응답**이다.
 * - 아이솔레이트가 flush 전에 죽으면 그 회차 몫이 유실된다(다음 회차에 안 붙는다) — 과소계상 쪽으로 틀린다.
 *   과대계상보다 낫다: 이 값은 "여유가 있다"를 주장하는 데 쓰이므로 보수적이어야 한다.
 *
 * 📅 **KST 기준일** — 네이버는 한국 서비스이고 쿼터가 한국시간 자정에 리셋된다(유튜브의 PT 기준일과 다르다).
 */

/** 오픈API 호스트 — 이 문자열이 URL 에 있으면 쿼터를 먹는 호출이다. RSS(`rss.blog.naver.com`)는 아니다. */
export const NAVER_OPENAPI_HOST = 'openapi.naver.com'

/** 네이버가 공표한 검색 오픈API 기본 일일 한도(회). 실제 한도는 앱 설정에 따라 다를 수 있다 — 위 주석 참조. */
export const NAVER_DAILY_QUOTA_CALLS = 25_000

/** `platform_settings` 키 — 값 형식 `"YYYY-MM-DD:count"`(KST 기준일). */
export const NAVER_USED_KEY = 'ads_naver_api_used'

/**
 * 🎯 **일일 사용 목표 90%** (2026-08-04 대표 지시 *"유료 api 각각 90%씩은 쓰자"*).
 *
 * 90% 는 **늘리는 값이 아니라 멈추는 값**이다. 지금 실사용은 396/25,000(1.6%)이고 병목은 쿼터가
 * 아니라 Cloudflare CPU·서브리퀘스트다 — 이 상수를 올려도 오늘의 수집량은 1건도 안 는다.
 * 이게 필요한 건 **유료 전환 이후**다: 서브리퀘스트 천장이 60→900(×15)이 되면 쿼터를 넘겨
 * 429 를 받기 시작하는데, 그때는 회차 중간에 남은 작업이 통째로 버려진다(실패 호출도 쿼터를 먹는다).
 *
 * ⚠️ 10% 를 남기는 이유: ① 이 카운터는 **자동 레인만** 세므로 실사용의 하한이다(어드민 수동 도구는 밖) —
 *   100% 를 겨누면 실제로는 넘긴다. ② 초과 판정의 진짜 근거는 이 숫자가 아니라 **429 응답**이다.
 */
export const NAVER_DAILY_TARGET_PCT = 0.9
/** 하루에 여기까지만 쏜다 — 22,500회. */
export const NAVER_DAILY_TARGET_CALLS = Math.floor(NAVER_DAILY_QUOTA_CALLS * NAVER_DAILY_TARGET_PCT)

/** 인보케이션 내 누적. flush 로만 비운다. */
let pending = 0
/**
 * 남은 허용량. **`null` = 미설정 = 무제한**(게이트 이전 동작 그대로).
 * 레인이 `armNaverDailyAllowance` 로 무장해야만 산다 — 무장을 잊은 레인이 조용히 멈추는 일은 없다.
 * (반대 방향의 위험 — 무장을 잊어 쿼터를 넘기는 것 — 은 429 로 드러나지만, 조용한 정지는 안 드러난다.)
 */
let allowance: number | null = null

/**
 * 🔫 오늘 쓴 만큼을 빼고 남은 허용량을 장전한다. 레인이 회차 **시작**에 한 번 부른다.
 * @param usedToday `parseNaverUsed(settings[NAVER_USED_KEY], kstDayKey(now))` 값.
 */
export function armNaverDailyAllowance(usedToday: number, target = NAVER_DAILY_TARGET_CALLS): void {
  allowance = Math.max(0, target - Math.max(0, usedToday))
}

/** 남은 허용량(진단·상태줄용). `null` = 무장 안 됨. */
export function naverAllowanceLeft(): number | null {
  return allowance
}

/**
 * 🧮 URL 이 오픈API 면 1 센다. 아니면 무시 — 호출부는 조건 없이 부르면 된다(판정을 한 곳에 모은다).
 * @returns **쏴도 되는가.** `false` 면 호출부가 fetch 를 하지 말아야 한다(일일 목표 소진).
 *   오픈API 가 아닌 URL 은 언제나 `true` — 이 게이트는 쿼터를 먹는 호출만 막는다.
 */
export function noteNaverCall(url: unknown): boolean {
  if (typeof url !== 'string' || !url.includes(NAVER_OPENAPI_HOST)) return true
  if (allowance !== null && allowance <= 0) return false
  pending += 1
  if (allowance !== null) allowance -= 1
  return true
}

/** 아직 flush 안 된 누적치(테스트·진단용). */
export function pendingNaverCalls(): number {
  return pending
}

/**
 * 🧺 누적을 **가져가면서 비운다** — 이미 settings 를 batch 로 읽고 쓰는 레인용.
 *   그 레인은 `NAVER_USED_KEY` 를 자기 read 목록에 넣고 이 값을 더해 batch 에 실으면
 *   **서브리퀘스트 추가 0** 으로 계측이 끝난다(아래 `flushNaverCalls` 는 읽기 1 + 쓰기 1을 더 쓴다).
 *   ⚠️ 가져간 쪽이 실제로 저장하지 못하면 그 몫은 사라진다 — 과소계상 쪽 오차(위 docblock 참조).
 */
export function takeNaverCalls(): number {
  const n = pending
  pending = 0
  return n
}

/** 테스트 전용 — 모듈 스코프 상태를 초기화한다. */
export function __resetNaverCallMeter(): void {
  pending = 0
  allowance = null
}

/** 📅 KST 기준일 `YYYY-MM-DD`. `+9h` 시프트 후 UTC 날짜를 읽는 표준 방식(D1 의 `DATE(x,'+9 hours')` 와 동일 규약). */
export function kstDayKey(nowMs: number): string {
  return new Date(nowMs + 9 * 3600_000).toISOString().slice(0, 10)
}

/** 저장값 `"YYYY-MM-DD:count"` 파싱 — 날짜가 다르면 0(새 날). 형식이 깨졌으면 0(추측하지 않는다). */
export function parseNaverUsed(raw: string | null | undefined, day: string): number {
  const s = String(raw || '')
  const at = s.indexOf(':')
  if (at < 0 || s.slice(0, at) !== day) return 0
  const n = parseInt(s.slice(at + 1), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * 🔫🧺 **장전 + 다른 설정값 읽기를 한 왕복으로** — 레인이 한 줄로 무장하게 만드는 진입점.
 *
 *   쿼터는 **앱 단위**라 레인 하나만 무장하면 나머지가 그 위에 얹혀 총합이 목표를 넘는다. 그런데
 *   무장에 D1 왕복이 하나 더 든다면 예산이 빠듯한 레인은 결국 안 하게 된다 — 그래서 **이미 하던
 *   설정 읽기에 네이버 키를 얹는다**(`key IN`). 서브리퀘스트 추가 0.
 *
 * @param extraKeys 레인이 원래 읽던 키들.
 * @returns 그 키들을 꺼내는 함수. 읽기 실패 시 전부 `undefined` + **무장 안 함**(=무제한) —
 *   계측 실패가 수집을 멈추면 안 된다(이 모듈의 다른 함수와 같은 방침).
 */
export async function armNaverAndReadSettings(
  DB: { prepare: (sql: string) => { bind: (...v: unknown[]) => { all: <T>() => Promise<{ results?: T[] } | null> } } },
  extraKeys: string[],
  nowMs: number = Date.now(),
): Promise<(key: string) => string | undefined> {
  const keys = [NAVER_USED_KEY, ...extraKeys]
  let rows: { key: string; value: string }[] = []
  try {
    const q = await DB.prepare(`SELECT key, value FROM platform_settings WHERE key IN (${keys.map(() => '?').join(', ')})`)
      .bind(...keys).all<{ key: string; value: string }>()
    rows = q?.results || []
    armNaverDailyAllowance(parseNaverUsed(rows.find(r => r.key === NAVER_USED_KEY)?.value, kstDayKey(nowMs)))
  } catch { /* 무장 실패 = 무제한(현행 동작) — 계측이 레인을 죽이면 안 된다 */ }
  return (k: string) => rows.find(r => r.key === k)?.value
}

type MinimalDB = {
  prepare: (sql: string) => {
    bind: (...v: unknown[]) => { first: <T>() => Promise<T | null>; run: () => Promise<unknown> }
  }
}

/**
 * 💾 누적분을 `platform_settings` 에 더하고 비운다. 누적이 0이면 **아무것도 안 한다**(D1 왕복 0).
 * 반환값은 진단/상태줄 노출용 — 실패해도 던지지 않는다(계측이 레인을 죽이면 안 된다).
 */
export async function flushNaverCalls(
  DB: MinimalDB,
  nowMs: number,
): Promise<{ day: string; calls: number; quota: number } | null> {
  const add = pending
  if (add <= 0) return null
  pending = 0
  const day = kstDayKey(nowMs)
  try {
    const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
      .bind(NAVER_USED_KEY).first<{ value?: string }>()
    const total = parseNaverUsed(row?.value, day) + add
    await DB.prepare(
      `INSERT INTO platform_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).bind(NAVER_USED_KEY, `${day}:${total}`).run()
    return { day, calls: total, quota: NAVER_DAILY_QUOTA_CALLS }
  } catch {
    return null // 계측 실패는 레인을 막지 않는다
  }
}
