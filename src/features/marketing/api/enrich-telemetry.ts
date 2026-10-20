/**
 * 📟 보강 레인 계측 — `ads_enrich_last` 기록 전담 (2026-07-28 분리).
 *
 *   왜 별 모듈인가: 2026-07-28 라이브에서 보강 라운드가 **한 번도 정상 종료되지 않는데**
 *   (`partial:true` 고정 · `crawls:0` · `limit_hit:false`) **왜 안 끝나는지 알 신호가 어디에도 없었다.**
 *   호출부(ur-ads)는 예외를 `catch { 'FAILED' }` 로 버렸고, 스냅샷엔 단계 표식이 없었으며,
 *   대상 1건당 도는 `stamp()` 의 D1 오류는 `.catch(() => null)` 이 삼켰다
 *   (**D1 쿼리도 서브리퀘스트를 소모**하므로 그 신호를 잃으면 한도 도달을 영영 못 본다).
 *   ⇒ 계측을 수집 로직에서 떼어내 "증거를 남기는 책임"을 한곳에 모은다.
 *
 *   원칙: 기록 실패가 **원래 작업이나 원래 예외를 가리지 않는다**(전부 fail-soft).
 */
import type { Env } from '@/worker/types/env'

/** 보강 스냅샷 키 — 어드민 상태줄(`/api/admin/partner-pool/stats` → `enrichLast`)이 그대로 읽는다. */
export const ENRICH_SNAPSHOT_KEY = 'ads_enrich_last'
/** 📝 인플루언서 풀 보강 레인 스냅샷 키(2026-07-28 신설 — `influencer-enrich-lane.ts`).
 *  ⚠️ 키만 여기 두는 이유: 어드민 통계 모듈이 **수집 엔진을 import 하지 않고** 이 값을 읽어야 한다
 *  (메인 번들 경량 유지 — `admin-ads-influencers.routes.ts` 헤더 규칙). */
export const INFLUENCER_ENRICH_SNAPSHOT_KEY = 'ads_influencer_enrich_last'

const nowStamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ')

/** 🧮 누적 집계 키 — 스냅샷은 **라운드마다 덮이므로** 이것 없이는 아래를 구분할 수 없다(2026-07-29 신설):
 *    ⓐ 모든 라운드가 3건에서 죽는다  ⓑ 마지막 라운드만 부모 크론 종료에 잘렸다
 *  둘의 처방이 정반대인데(코드 수리 vs 스케줄 수리) 스냅샷 한 장으로는 **판정 자체가 불가능**했다. */
export const ENRICH_ROLLUP_KEY = 'ads_enrich_rollup'
/** 매장 후보 보강 레인의 누적(같은 구조, 다른 키). */
export const PROSPECT_ROLLUP_KEY = 'ads_prospect_enrich_rollup'

export interface EnrichRollup {
  /** KST 기준 하루 — 날짜가 바뀌면 카운터가 리셋된다(하루 단위 추세를 본다). */
  day: string
  rounds: number; partial: number; deadline: number; limit: number; crash: number
  processed: number; enriched: number; crawls: number; fetches: number; d1: number; spent: number
  /** 라운드가 **어디서 끝났는지**의 분포(p1_done/p2/p3_done…) — ⓐ/ⓑ 판정의 핵심. */
  phase: Record<string, number>
  /**
   * 💀 중도 사망한 라운드의 **마지막 체크포인트**(`snap.at`) 최근 8개 (2026-08-03 신설).
   *
   *   `phase` 는 "2단계에서 죽었다"까지만 말한다. 그런데 실측에서 남은 물음은 그 다음이었다 —
   *   ```
   *     ads_enrich_last: processed 3 · spent 15/60 · limit_hit false · deadline_hit false
   *                      crash 0 · partial true · at "cr:https://www.busan.com"
   *   ```
   *   한도도·시간제한도·예외도 아닌 **예외 없이 사라지는 죽음**인데, 처방이 둘로 갈린다:
   *   **한 주소에 몰리면** 그 사이트가 응답을 안 줘 벽시계를 태운 것(그 호스트만 차단하면 끝) ·
   *   **흩어지면** 부모 CPU 한도(레인 배치를 고쳐야 한다). 정반대다.
   *
   *   그런데 `at` 은 **스냅샷에만 있고 라운드마다 덮인다** → 판정하려면 하루 2회차씩 며칠을 기다려야 했다.
   *   여기 모으면 **조회 한 번**으로 갈린다. 비용 0 — 이미 쓰는 누적 레코드에 문자열 몇 개를 얹을 뿐이고,
   *   추가 SELECT·UPDATE 가 없다(무료 플랜의 서브리퀘스트 지갑을 건드리지 않는다).
   */
  deaths?: string[]
  /**
   * 🎯 **하루치 손실 분포** — "연락처 수율을 어디서 올리나"의 유일한 근거 (2026-08-12 신설).
   *
   * ## 왜 (오늘 대표가 *"연락처 수율도 올려줘"* 라고 했을 때 답을 못 한 이유)
   * 수율은 실측 **12~13%**(오늘 620건 처리 → 76건 획득)인데, **어디서 버려지는지는 회차 1건만 남는다** —
   * `crawl_reason` 은 스냅샷 필드라 라운드마다 덮인다. 그래서 표본이 이렇게 흔들린다:
   * ```
   *   어떤 회차:  blocked_host 3 · deadline 3 · no_contact 2 · http_5xx 1 · ok 1   (크롤 10)
   *   다른 회차:  no_name 3 · deadline 2 · blocked_host 1                          (크롤 6)
   * ```
   * 6~10건 표본으로 처방을 고르면 **이 세션에서 두 번 겪은 오진**과 같은 실수다(발굴량 하락을
   * 30시간 창으로 보고 단정했다가 3주로 보니 17배 진폭이었던 건, 그리고 "예산이 못 막는다"를
   * 무죄 증거로 읽었던 건). ⇒ 하루로 묶어야 처방이 갈린다:
   *
   * | 우세한 사유 | 처방 |
   * |---|---|
   * | `deadline`/`subreq_limit` | 무료 플랜 천장 — 코드가 아니라 **유료 전환** 판단 |
   * | `blocked_host`/`bad_url` | 저장된 website 품질 — **발견 경로**로 우회 |
   * | `no_name` | 상호 가드가 과하다 → 아래 `name_loose` 로 회수 가능분을 잰다 |
   * | `no_contact` | 사이트에 정말 없다 — 크롤로는 못 올린다(다른 소스가 필요) |
   *
   * 💰 비용 0 — 이미 매 라운드 쓰는 누적 레코드에 정수 몇 개를 얹을 뿐이다(추가 쿼리 없음).
   *   회차가 예산을 100% 쓰는 것이 실측이라, 여기서 쓰기를 하나라도 늘리면 그만큼 보강이 잘린다.
   */
  crawl_reason?: Record<string, number>
  /**
   * 🔎 **회수 가능분** — `no_name` 으로 버려졌지만 **느슨한 상호**(지점·법인격·괄호 제거)로는 맞았던 수.
   *
   * 상호 가드는 **웹검색으로 발견한 사이트에만** 걸린다(등록된 홈페이지는 무검사) — 설계가 맞다.
   * 남의 사이트 연락처를 이 리드에 붙이면 **대표가 엉뚱한 회사에 제휴 제안을 보내게 된다.**
   * 그래서 느슨한 일치는 지금 **채택하지 않고 세기만** 한다(`contact-enrich.ts` 의 `nameLoose`).
   *
   * ⚠️ **이 수가 크다고 바로 가드를 풀지 말 것.** 느슨한 일치는 *"강남점"↔"본점"* 도 통과시켜
   *   프랜차이즈 본사에 오귀속될 수 있다. 이 값의 용도는 *"가드를 손볼 가치가 있는가"* 의 크기 판정이고,
   *   실제로 풀 때는 표본을 눈으로 확인한 뒤 **출처별로**(place 등록 링크 vs 웹검색) 갈라야 한다.
   */
  name_loose?: number
  /**
   * 🏷️ **이름 치유 진행률** — 2026-08-13 대표 *"연락처는 실재하는데 업체명이 틀린 경우도 많아"*.
   *
   * 커버리지(**몇 건이 대상인가**)는 쿼리로 셀 수 있지만 *"언제 다 없어지나"* 는 답할 수 없었다 —
   * Phase 3(`enrich-name-heal`)는 **회차당 8건 캡 + 잔여 예산이 있을 때만** 도는데 계측이 0이었다.
   * `heal_picked`(도달 회차) · `heal_try`(크롤 시도) · `heal_renamed`(**실제 개명**) ·
   * `heal_no_sitename`(사이트가 이름을 안 밝혀 못 고침)을 하루로 묶는다.
   *
   * 🔑 이 넷이 있으면 대표 질문에 숫자로 답한다: 남은 대상 ÷ 하루 `heal_renamed` = **며칠**.
   *   그리고 `heal_no_sitename` 이 크면 **크롤로는 영영 못 고치는 몫**이라 다른 처방이 필요하다.
   */
  p2?: Record<string, number>
  last_run_id?: string; updated_at?: string
}

/** `deaths` 링버퍼 길이 — 하루 회차가 적어(실측 2~4) 8이면 며칠치가 남는다. 값 자체가 짧아 저장비용 무시가능. */
export const DEATH_TRAIL_MAX = 8

/** KST 하루 경계 — 워커 TZ 는 UTC 라 +9h 후 날짜를 취한다(`docs/CURRENT_WORK.md` KST 규약). */
export const kstDay = (ms = Date.now()) => new Date(ms + 9 * 3_600_000).toISOString().slice(0, 10)

const emptyRollup = (day: string): EnrichRollup => ({
  day, rounds: 0, partial: 0, deadline: 0, limit: 0, crash: 0,
  processed: 0, enriched: 0, crawls: 0, fetches: 0, d1: 0, spent: 0, phase: {},
})

/**
 * 직전 라운드의 **마지막 스냅샷**을 누적에 접는다(순수 함수 — I/O 없음, 그래서 단위 검증 가능).
 *
 *   왜 '직전'인가: 중도 사망한 라운드는 자기 종료 코드에 도달하지 못하므로 **스스로는 누적할 수 없다.**
 *   그 라운드가 남긴 마지막 부분 스냅샷은 다음 라운드가 시작할 때까지 살아 있다 → 다음 라운드가 접는다.
 *   ⇒ 죽은 라운드도 빠짐없이 세어진다(그게 이 계측의 존재 이유다).
 *
 *   @returns 갱신된 누적 · 접을 것이 없으면 `null`(= 쓰지 않음, 서브리퀘스트 절약)
 */
export function foldRound(rollup: EnrichRollup | null, snap: Record<string, unknown> | null, day = kstDay()): EnrichRollup | null {
  if (!snap) return null
  const runId = typeof snap.run_id === 'string' ? snap.run_id : ''
  if (!runId) return null // run_id 없는 구형 스냅샷 — 중복 접기를 막을 수 없으므로 접지 않는다
  // 멱등: 같은 라운드를 두 번 세지 않는다. **날짜 경계와 무관하게** 검사한다
  //   (자정 직후 리셋 때 같은 스냅샷이 새 버킷에 다시 접히던 이중계상 방지).
  if (rollup?.last_run_id === runId) return null
  const r: EnrichRollup = rollup && rollup.day === day
    ? { ...rollup, phase: { ...rollup.phase } }
    : emptyRollup(day)
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  r.rounds++
  if (snap.partial === true) {
    r.partial++
    // 💀 사망 지점을 흔적으로 남긴다(위 `deaths` 주석 참조). 새 배열로 만들어 이전 누적본과 공유하지 않는다
    //   — 65행의 얕은 복사가 배열을 참조로 물고 오므로, 여기서 push 하면 원본까지 오염된다.
    const at = typeof snap.at === 'string' ? snap.at.slice(0, 60) : ''
    if (at) r.deaths = [...(r.deaths || []), at].slice(-DEATH_TRAIL_MAX)
  }
  if (snap.deadline_hit === true) r.deadline++
  if (snap.limit_hit === true) r.limit++
  if (snap.crash) r.crash++
  r.processed += n(snap.processed); r.enriched += n(snap.enriched); r.crawls += n(snap.crawls)
  r.fetches += n(snap.fetches); r.d1 += n(snap.d1); r.spent += n(snap.spent)
  // 🎯 손실 분포 합산 — 스냅샷의 사유별 계수를 하루로 누적(위 `crawl_reason` 주석의 판정표가 이 값을 쓴다).
  //   ⚠️ 얕은 복사(위 65행)가 객체를 **참조로** 물고 오므로 반드시 새 객체를 만든다 — `deaths` 가 같은
  //   함정으로 원본을 오염시킨 전례가 이 파일에 있다.
  const cr = snap.crawl_reason
  if (cr && typeof cr === 'object') {
    const acc: Record<string, number> = { ...(rollup?.day === day ? rollup.crawl_reason || {} : {}) }
    for (const [k, v] of Object.entries(cr as Record<string, unknown>)) acc[k] = (acc[k] || 0) + n(v)
    r.crawl_reason = acc
  } else if (rollup?.day === day && rollup.crawl_reason) {
    r.crawl_reason = { ...rollup.crawl_reason }
  }
  // ⚠️ **0 도 쓴다.** 이 필드가 없으면 "재 봤는데 0 건"과 "아직 안 잰다"가 구분되지 않는데,
  //   이 계측이 존재하는 이유가 정확히 그 모호함이다(유닛이 이 계약을 고정한다).
  r.name_loose = (rollup?.day === day ? n(rollup.name_loose) : 0) + n(snap.name_loose)
  // 🏷️ Phase 2/3 계수기(이름 치유 포함)를 하루로 누적 — `crawl_reason` 과 같은 방식·같은 주의점
  //   (얕은 복사가 객체를 참조로 물고 오므로 반드시 새 객체를 만든다).
  const sp2 = snap.p2
  if (sp2 && typeof sp2 === 'object') {
    const acc: Record<string, number> = { ...(rollup?.day === day ? rollup.p2 || {} : {}) }
    for (const [k, v] of Object.entries(sp2 as Record<string, unknown>)) acc[k] = (acc[k] || 0) + n(v)
    r.p2 = acc
  } else if (rollup?.day === day && rollup.p2) {
    r.p2 = { ...rollup.p2 }
  }
  const ph = typeof snap.phase === 'string' && snap.phase ? snap.phase : 'unknown'
  r.phase[ph] = (r.phase[ph] || 0) + 1
  r.last_run_id = runId
  r.updated_at = nowStamp()
  return r
}

/** `foldRound` 의 I/O 래퍼 — 원본 JSON 은 **호출부가 이미 읽은 것**을 넘긴다(추가 SELECT 0).
 *  @returns 실제로 썼으면 true(호출부가 서브리퀘스트 1을 계상하도록) */
export async function foldEnrichRollup(DB: Env['DB'], rollupKey: string, snapRaw: string | null, rollupRaw: string | null): Promise<boolean> {
  let snap: Record<string, unknown> | null = null
  let prev: EnrichRollup | null = null
  try { snap = snapRaw ? JSON.parse(snapRaw) as Record<string, unknown> : null } catch { snap = null }
  try { prev = rollupRaw ? JSON.parse(rollupRaw) as EnrichRollup : null } catch { prev = null }
  const next = foldRound(prev, snap)
  if (!next) return false
  const ok = await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(rollupKey, JSON.stringify(next)).run().then(() => true).catch(() => false)
  return ok
}

/** 스냅샷 1회 기록. 부분(`partial:true`)/최종(`false`) 모두 이 경로. */
/**
 * ⏳ **잔여 백로그 카운트를 이번 회차에 다시 세야 하나** (2026-08-27 읽기 증폭 수리).
 *
 * ## 왜 아끼는가 (실측)
 * `SELECT COUNT(*) … WHERE active = 0 AND merged_into IS NULL` 은 **회당 321,945행**을 읽는다.
 * 보강 레인은 하루 105회차를 도니 **3,380만 행/일** — 그리고 그 대가로 얻는 것은 상태줄에 찍히는
 * *숫자 하나*다. 그 숫자는 하루에 수십~수백씩 움직이는 백로그 게이지라 **14분마다 정확할 이유가 없다.**
 *
 * ⇒ 마지막 계산으로부터 {@link REMAINING_TTL_MS} 가 지났을 때만 다시 센다(하루 105회 → 24회).
 *
 * ⚠️ **끄는 게 아니라 늦추는 것**이다 — 0 으로 만들면 백로그가 언제 마르는지 볼 수 없다.
 * ⚠️ 이전 값이 없거나(첫 실행·스냅샷 파손) 시각이 이상하면 **다시 센다**(모르면 재는 쪽이 안전).
 */
export const REMAINING_TTL_MS = 60 * 60_000

export function shouldRecountRemaining(prevSnapshot: string | null, nowMs: number): boolean {
  if (!prevSnapshot) return true
  type Snap = { remaining?: unknown; remaining_at?: unknown }
  let prev: Snap | null = null
  try { prev = JSON.parse(prevSnapshot) as Snap } catch { return true }
  if (!prev || typeof prev.remaining !== 'number') return true
  const at = Number(prev.remaining_at)
  if (!Number.isFinite(at) || at <= 0) return true
  if (at > nowMs) return true // 미래 시각 = 신뢰 불가(시계 이상·수기 편집) → 다시 센다
  return nowMs - at >= REMAINING_TTL_MS
}

/** 직전 스냅샷의 잔여값(다시 세지 않는 회차가 이어 쓸 값). 없으면 `null`. */
export function prevRemaining(prevSnapshot: string | null): { remaining: number; at: number } | null {
  if (!prevSnapshot) return null
  try {
    const p = JSON.parse(prevSnapshot) as { remaining?: unknown; remaining_at?: unknown }
    const n = Number(p?.remaining); const at = Number(p?.remaining_at)
    if (!Number.isFinite(n) || !Number.isFinite(at) || at <= 0) return null
    return { remaining: n, at }
  } catch { return null }
}

export async function writeEnrichSnapshot(DB: Env['DB'], payload: Record<string, unknown>): Promise<void> {
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(ENRICH_SNAPSHOT_KEY, JSON.stringify({ last_run: nowStamp(), ...payload })).run().catch(() => null)
}

/**
 * 💥 예외를 **증거로 남긴다** — 마지막 부분 스냅샷을 보존한 채 `crash` 원문만 덧붙인다.
 *   → 다음 조회 한 번으로 "라운드가 왜 안 끝났는가"의 사인이 드러난다(추측 금지 룰의 도구).
 */
export async function recordEnrichCrash(DB: Env['DB'], err: unknown): Promise<void> {
  const e = err as { name?: string; message?: string } | null
  const crash = `${e?.name || 'Error'}: ${String(e?.message || '').slice(0, 200)}`
  try {
    const row = await DB.prepare(`SELECT value FROM platform_settings WHERE key = '${ENRICH_SNAPSHOT_KEY}'`).first<{ value: string }>()
    const prev = row?.value ? JSON.parse(row.value) as Record<string, unknown> : {}
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind(ENRICH_SNAPSHOT_KEY, JSON.stringify({ ...prev, crash, crash_at: nowStamp() })).run()
  } catch { /* 기록 실패가 원래 예외를 가리지 않게 */ }
}
