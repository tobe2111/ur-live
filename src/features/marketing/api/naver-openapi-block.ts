/**
 * 🚧 **네이버 오픈API — 차단(429/403) 감지** (2026-08-23).
 *
 * ## 왜 필요한가 — `naver-crawl-block.ts` 는 여기를 안 본다
 * 그 모듈은 **공개 페이지 크롤**(`m.blog.naver.com` · `rss.blog.naver.com`)만 센다. 발굴 레인이 쓰는
 * ```
 *   openapi.naver.com/v1/search/{webkr,local}.json
 * ```
 * 는 **아무도 안 세고 있었다**. 이쪽에 있는 방어는 일일 쿼터 게이트(`noteNaverCall` — 22,500회/일)뿐인데,
 * 그건 *우리가 얼마나 쐈나*를 볼 뿐 *상대가 막았나*는 못 본다. 실사용은 쿼터의 1% 미만이라
 * **그 게이트는 사실상 한 번도 발동하지 않는다** — 즉 429/403 방어는 0 이었다.
 *
 * ## 무엇이 문제였나 — 조용한 0
 * 호출부는 `if (!res || !res.ok) break` 로 끝난다. 429 를 받아도 **"결과 없음"과 구분이 안 된다.**
 * 그러면:
 * ```
 *   차단 → 키워드마다 0건 → saved_total 이 안 늘어남 → 수율 학습이 "이 키워드가 나쁘다"고 배움
 *   그리고 실패 호출도 쿼터를 먹는다 — 막힌 채로 계속 쏘면 쿼터만 태운다
 * ```
 * 크롤 쪽에서 이미 같은 사고를 겪고 만든 규칙(`naver-crawl-block.ts` docblock)을 여기에 그대로 적용한다.
 *
 * ## 판정 규칙 — 좁게 잡는다 (크롤 모듈과 동일)
 * - **429/403 만** 센다. 타임아웃·DNS·5xx 는 아니다 — *"느리다"·"저쪽이 아프다"는 "막혔다"가 아니다*.
 * - **연속(streak)** 으로 본다. 단발 403 은 잘못된 쿼리일 수 있다. 연속 {@link OPENAPI_BLOCK_TRIP}회면
 *   그건 그 호출의 사정이 아니라 **우리가 막힌 것**이다.
 * - 성공 한 번이면 연속을 0으로 되돌린다(회복 즉시 인정).
 *
 * ⚠️ **이 모듈이 못 하는 것**: 200 + 빈 `items`(소프트 스로틀). 상태코드로 판정 불가라
 *   일별 카운터(`ads_naver_openapi_block`)를 남겨 사람이 수율 급락과 대조할 수 있게만 한다.
 */

/** 차단으로 세는 상태코드. 넓히기 전에 위 "좁게 잡는다" 를 읽을 것. */
export const OPENAPI_BLOCK_STATUSES: readonly number[] = [429, 403]
/** 연속 몇 번이면 차단으로 확정하는가. */
export const OPENAPI_BLOCK_TRIP = 3
/** `platform_settings` 키 — 값은 JSON(일별). */
export const OPENAPI_BLOCK_KEY = 'ads_naver_openapi_block'

let streak = 0
let blocked = 0
let ok = 0
let lastStatus: number | null = null

/** 상태코드가 차단 신호인가. `null`(예외·타임아웃)은 **아니다**. */
export function isOpenapiBlockStatus(status: number | null | undefined): boolean {
  return typeof status === 'number' && OPENAPI_BLOCK_STATUSES.includes(status)
}

/**
 * 📟 오픈API 응답 1건 기록.
 * @param status HTTP 상태코드. 예외/타임아웃이면 `null` — **연속을 늘리지도 지우지도 않는다**.
 */
export function noteOpenapiStatus(status: number | null | undefined): void {
  if (isOpenapiBlockStatus(status)) { streak += 1; blocked += 1; lastStatus = status as number; return }
  if (typeof status === 'number') { streak = 0; ok += 1 }
}

/** 지금 막힌 상태인가 — 호출부는 참이면 **더 쏘지 말아야** 한다(실패분도 쿼터를 먹는다). */
export function naverOpenapiBlocked(): boolean {
  return streak >= OPENAPI_BLOCK_TRIP
}

/** 진단용 스냅샷(회차 상태줄). */
export function openapiBlockSnapshot(): { streak: number; blocked: number; ok: number; tripped: boolean; last_status: number | null } {
  return { streak, blocked, ok, tripped: naverOpenapiBlocked(), last_status: lastStatus }
}

/** 테스트 전용 — 모듈 스코프 초기화. */
export function __resetNaverOpenapiBlock(): void {
  streak = 0; blocked = 0; ok = 0; lastStatus = null
}

/** 📅 KST 기준일 — 네이버는 한국 서비스다(`naver-api-usage.kstDayKey` 와 같은 규약). */
function kstDay(nowMs: number): string {
  return new Date(nowMs + 9 * 3600_000).toISOString().slice(0, 10)
}

type MinimalDB = {
  prepare: (sql: string) => {
    bind: (...v: unknown[]) => { first: <T>() => Promise<T | null>; run: () => Promise<unknown> }
  }
}

/**
 * 💾 이번 인보케이션의 관측을 일별로 누적한다. 관측이 0이면 **왕복 0**.
 *   실패해도 던지지 않는다 — 계측이 레인을 죽이면 안 된다(이 레포의 공통 방침).
 */
export async function flushOpenapiBlock(DB: MinimalDB, nowMs: number): Promise<void> {
  if (blocked <= 0 && ok <= 0) return
  const day = kstDay(nowMs)
  const addB = blocked; const addOk = ok
  blocked = 0; ok = 0
  try {
    const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
      .bind(OPENAPI_BLOCK_KEY).first<{ value?: string }>()
    let prevB = 0; let prevOk = 0
    try {
      const j = row?.value ? JSON.parse(row.value) as { day?: string; blocked?: number; ok?: number } : {}
      if (j.day === day) { prevB = Number(j.blocked) || 0; prevOk = Number(j.ok) || 0 }
    } catch { /* 형식이 깨졌으면 새 날로 취급 — 추측하지 않는다 */ }
    await DB.prepare(
      `INSERT INTO platform_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).bind(OPENAPI_BLOCK_KEY, JSON.stringify({
      day, blocked: prevB + addB, ok: prevOk + addOk, last_status: lastStatus,
      last_at: new Date(nowMs).toISOString().slice(0, 19).replace('T', ' '),
    })).run()
  } catch { /* 계측 실패는 레인을 막지 않는다 */ }
}
