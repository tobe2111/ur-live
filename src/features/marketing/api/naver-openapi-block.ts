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
 * ## 회차를 넘는 백오프 (2026-08-24 추가)
 * 모듈 스코프는 인보케이션이 끝나면 사라진다 — 다음 회차는 아무것도 기억 못 하고 다시 쏜다.
 * 막힘이 몇 시간 가는 종류라면 매 회차 {@link OPENAPI_BLOCK_TRIP} 번씩 헛쏘고, 그 실패도 쿼터를 먹는다.
 * ⇒ 확정되면 저장된 블롭에 **다음 시도 시각**을 남긴다. 연속으로 다시 막히면 배수로 늘어나되
 *   {@link BACKOFF_MAX_MS} 에서 멈추고, **깨끗한 회차 한 번이면 0 으로 되돌아간다**
 *   (회복을 즉시 인정 — 이 모듈 전체의 방침).
 *
 * ⚠️ **이 모듈이 못 하는 것**: 200 + 빈 `items`(소프트 스로틀). 상태코드로 판정이 불가능하다.
 *   대신 **아무 결과도 못 얻은 회차의 연속 횟수**(`zero_streak`)를 남긴다 — 그것만으로 차단을
 *   단정할 수는 없지만(키워드가 정말 마른 것일 수도 있다), 수율 급락과 대조할 근거는 된다.
 *   ⚠️ 이 값으로 **자동 판단을 하지 말 것** — 근거가 두 가지 원인을 구분하지 못한다.
 */

/** 차단으로 세는 상태코드. 넓히기 전에 위 "좁게 잡는다" 를 읽을 것. */
export const OPENAPI_BLOCK_STATUSES: readonly number[] = [429, 403]
/** 연속 몇 번이면 차단으로 확정하는가. */
export const OPENAPI_BLOCK_TRIP = 3
/** `platform_settings` 키 — 값은 JSON(일별). */
export const OPENAPI_BLOCK_KEY = 'ads_naver_openapi_block'

/** 백오프 1단계 길이. 회차가 시간당 1회이므로 **다음 회차 하나를 건너뛰는** 크기다. */
export const BACKOFF_BASE_MS = 60 * 60_000
/** 아무리 길어도 여기서 멈춘다 — 상대가 풀었는데 우리가 반나절 자고 있으면 그게 더 큰 손해다. */
export const BACKOFF_MAX_MS = 6 * 60 * 60_000

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

/** 저장된 블롭의 모양. 전부 선택적 — 옛 형식(카운터만)을 읽어도 깨지지 않아야 한다. */
export interface OpenapiBlockBlob {
  day?: string; blocked?: number; ok?: number; last_status?: number | null; last_at?: string
  /** 연속 확정 횟수. 깨끗한 회차 한 번이면 0. */
  trips?: number
  /** 이 시각(epoch ms) 전에는 쏘지 않는다. */
  until?: number
  /** 결과를 하나도 못 얻은 회차의 연속 횟수 — **관측 전용**(소프트 스로틀 대조용). */
  zero_streak?: number
}

/** 저장값을 안전하게 읽는다. 깨졌으면 **빈 값**(추측하지 않는다 = 백오프 없음). */
export function parseOpenapiBlock(raw: string | null | undefined): OpenapiBlockBlob {
  if (!raw) return {}
  try {
    const j = JSON.parse(raw) as OpenapiBlockBlob
    return j && typeof j === 'object' ? j : {}
  } catch { return {} }
}

/** 연속 확정 `trips` 회일 때 다음 시도 시각. 1회=1시간, 2회=2시간 … 최대 {@link BACKOFF_MAX_MS}. */
export function backoffUntil(trips: number, nowMs: number): number {
  const n = Math.max(1, Math.floor(trips) || 1)
  return nowMs + Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * Math.pow(2, n - 1))
}

/** 지금 백오프 중인가 — 호출부는 참이면 **회차를 통째로 건너뛰어야** 한다. */
export function isBackedOff(blob: OpenapiBlockBlob, nowMs: number): boolean {
  const until = Number(blob.until) || 0
  return until > nowMs
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
export async function flushOpenapiBlock(DB: MinimalDB, nowMs: number, round?: { foundZero?: boolean }): Promise<void> {
  const tripped = naverOpenapiBlocked()
  if (blocked <= 0 && ok <= 0 && !round) return
  const day = kstDay(nowMs)
  const addB = blocked; const addOk = ok
  blocked = 0; ok = 0
  try {
    const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
      .bind(OPENAPI_BLOCK_KEY).first<{ value?: string }>()
    const prev = parseOpenapiBlock(row?.value)
    const sameDay = prev.day === day
    const prevB = sameDay ? Number(prev.blocked) || 0 : 0
    const prevOk = sameDay ? Number(prev.ok) || 0 : 0
    // 🔁 확정이면 연속 횟수를 올리고 백오프를 건다. 안 막힌 회차면 **둘 다 지운다** — 회복 즉시 인정.
    const trips = tripped ? (Number(prev.trips) || 0) + 1 : 0
    const until = tripped ? backoffUntil(trips, nowMs) : 0
    // 📉 관측 전용 — 결과 0 인 회차의 연속. 차단인지 키워드가 마른 것인지 **구분하지 못한다**.
    const zeroStreak = round?.foundZero ? (Number(prev.zero_streak) || 0) + 1 : (round ? 0 : Number(prev.zero_streak) || 0)
    await DB.prepare(
      `INSERT INTO platform_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).bind(OPENAPI_BLOCK_KEY, JSON.stringify({
      day, blocked: prevB + addB, ok: prevOk + addOk, last_status: lastStatus,
      trips, until, zero_streak: zeroStreak,
      last_at: new Date(nowMs).toISOString().slice(0, 19).replace('T', ' '),
    } satisfies OpenapiBlockBlob)).run()
  } catch { /* 계측 실패는 레인을 막지 않는다 */ }
}
