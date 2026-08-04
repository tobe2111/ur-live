/**
 * 🚧 **네이버 공개 페이지 크롤 — 차단 감지** (2026-08-04).
 *
 * ## 왜 필요한가 — 연락처는 오픈API 가 아니라 이걸로 캔다
 * ```
 *   rss.blog.naver.com/{handle}.xml   글 본문·발행일
 *   m.blog.naver.com/{handle}         프로필·위젯 ← 이메일이 여기 있다 (브라우저 UA)
 * ```
 * **쿼터 0 · 승인 0 · 계측 0.** 실측(2026-08-04) naver_blog 측정 4,157건/일 × 최대 2 fetch ≈
 * **하루 8천 요청**. 네이버 리드가 전체의 78%(39,833/51,345)라 막히면 연락처 수집의 주 경로가 멎는다.
 *
 * ## 진짜 위험은 "멎는 것"이 아니라 **잘못 배우는 것**
 * 차단당해도 호출부는 빈 문자열을 받는다(`if (!res.ok) return ''`) — "본문 없음"과 구분이 안 된다.
 * 그러면:
 * ```
 *   차단 → 연락처 0 → nb_contacts/nb_measured 하락 → suppressLowRotationYield 가
 *   "이 키워드가 나쁘다"고 학습 → 멀쩡한 키워드가 영구히 꺼진다
 * ```
 * 네이버가 막았을 뿐인데 **우리 학습이 오염되고, 차단이 풀려도 안 돌아온다**(억제된 키워드는
 * 증거가 갱신되지 않으므로). 그래서 차단은 *관측*만으로 부족하고 **학습에서 빼야** 한다.
 *
 * ## 판정 규칙 — 좁게 잡는다
 * - **429/403 만** 차단으로 센다. 타임아웃·DNS·연결거부는 **아니다** — *"느리다"는 "없다"가 아니다*
 *   (2026-07-29 `shouldNoindexMissingEntity` 에서 배운 것과 같은 규칙: 넓게 잡으면 멀쩡한 걸 죽인다).
 * - **연속(streak)** 으로 본다. 403 하나는 비공개 블로그일 수 있다. 서로 다른 핸들에서 연속
 *   {@link BLOCK_STREAK_TRIP}회면 그건 그쪽 사정이 아니라 **우리가 막힌 것**이다.
 * - 성공 한 번이면 연속을 0으로 되돌린다(회복을 즉시 인정 — 보수적으로 멈춰 있지 않는다).
 *
 * ⚠️ **이 모듈이 못 하는 것**: 네이버가 200 + 빈 페이지(소프트 차단)로 응답하는 경우. 그건
 *   상태코드로 판정 불가라 **수율 급락**으로만 보인다 — 그래서 일별 카운터를 남긴다(사람이 볼 근거).
 */

/** 차단으로 세는 상태코드. 넓히기 전에 위 "좁게 잡는다" 를 읽을 것. */
export const BLOCK_STATUSES: readonly number[] = [429, 403]
/** 연속 몇 번이면 차단으로 확정하는가. 1이면 비공개 블로그 하나에 레인이 멈춘다. */
export const BLOCK_STREAK_TRIP = 3
/** `platform_settings` 키 — 값은 JSON(일별). */
export const CRAWL_BLOCK_KEY = 'ads_naver_crawl_block'

let streak = 0
let blocked = 0
let ok = 0

/** 상태코드가 차단 신호인가. `null`(예외·타임아웃)은 **아니다**. */
export function isBlockStatus(status: number | null | undefined): boolean {
  return typeof status === 'number' && BLOCK_STATUSES.includes(status)
}

/**
 * 📟 크롤 응답 1건 기록.
 * @param status HTTP 상태코드. 예외/타임아웃이면 `null` — **연속을 늘리지도 지우지도 않는다**
 *   (상대 무응답은 차단의 증거도, 회복의 증거도 아니다).
 */
export function noteCrawlStatus(status: number | null | undefined): void {
  if (isBlockStatus(status)) { streak += 1; blocked += 1; return }
  if (typeof status === 'number') { streak = 0; ok += 1 }
}

/** 지금 막힌 상태인가 — 호출부는 이게 참이면 **더 쏘지 말고 스탬프도 찍지 말아야** 한다. */
export function naverCrawlBlocked(): boolean {
  return streak >= BLOCK_STREAK_TRIP
}

/** 진단용 스냅샷(회차 상태줄). */
export function crawlBlockSnapshot(): { streak: number; blocked: number; ok: number; tripped: boolean } {
  return { streak, blocked, ok, tripped: naverCrawlBlocked() }
}

/** 테스트 전용 — 모듈 스코프 초기화. */
export function __resetNaverCrawlBlock(): void {
  streak = 0; blocked = 0; ok = 0
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
 * 💾 이번 인보케이션의 차단 관측을 일별로 누적한다. 관측이 0이면 **왕복 0**.
 *   실패해도 던지지 않는다 — 계측이 레인을 죽이면 안 된다(이 레포의 공통 방침).
 */
export async function flushCrawlBlock(DB: MinimalDB, nowMs: number): Promise<void> {
  if (blocked <= 0 && ok <= 0) return
  const day = kstDay(nowMs)
  const addB = blocked; const addOk = ok
  blocked = 0; ok = 0
  try {
    const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
      .bind(CRAWL_BLOCK_KEY).first<{ value?: string }>()
    let prevB = 0; let prevOk = 0
    try {
      const j = row?.value ? JSON.parse(row.value) as { day?: string; blocked?: number; ok?: number } : {}
      if (j.day === day) { prevB = Number(j.blocked) || 0; prevOk = Number(j.ok) || 0 }
    } catch { /* 형식이 깨졌으면 새 날로 취급 — 추측하지 않는다 */ }
    await DB.prepare(
      `INSERT INTO platform_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).bind(CRAWL_BLOCK_KEY, JSON.stringify({
      day, blocked: prevB + addB, ok: prevOk + addOk, last_at: new Date(nowMs).toISOString().slice(0, 19).replace('T', ' '),
    })).run()
  } catch { /* 계측 실패는 레인을 막지 않는다 */ }
}
