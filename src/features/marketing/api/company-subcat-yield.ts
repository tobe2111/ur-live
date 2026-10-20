/**
 * 🎯 **업체 발굴 업종의 자동 은퇴·승격** — "사람이 재서 고르기"를 기계에 넘긴다 (2026-08-24 대표
 *   *"남은거 다 해줘"*, 직전 질문 *"이제는 영구적이야?"*).
 *
 * ## 무엇이 영구하지 않았나
 * 2026-08-23 에 업종을 **손으로 재서** 골랐다 — 창업 컨설팅 34.8% 는 넣고 간판 9.4% 는 뺐다.
 * 그 판단은 맞았지만 **한 번 찍힌 사진**이다. 그 뒤로:
 * ```
 *   · 오늘 34.8% 인 업종이 반년 뒤 5% 가 돼도 아무 신호 없이 계속 돈다
 *   · 4 개 구에만 도는 매장 생태계 17 업종이 나중에 좋아져도 저절로 안 넓어진다
 *   ⇒ 다음에도 사람이 또 재야 한다 = 영구하지 않다
 * ```
 * 인플루언서 축은 이미 자동이다(`influencer-keyword-yield.ts`) — **업체 축에만 없었다.**
 * 이 파일은 그 검증된 패턴을 업체 쪽으로 옮긴 것이다(임계값과 안전장치의 정신을 그대로 승계).
 *
 * ## ⚠️ 분모가 이 설계의 핵심이다
 * webkr 리드는 **발굴 시점엔 이메일이 없다**(사이트만 있다). 이메일은 나중에 `enrich-company`
 * 크롤이 붙인다. 그래서 `COUNT(*)` 를 분모로 쓰면 **갓 넣은 업종이 무조건 0%** 로 찍혀
 * 태어나자마자 은퇴한다 — 우리 백로그를 업종 탓으로 돌리는 것이다.
 * ⇒ 분모는 **`enrich_checked_at IS NOT NULL`**(크롤이 실제로 가 본 행)만 센다. 안 가 본 행은
 *   분자에도 분모에도 없으므로 *낮게 나올 수가 없다*.
 *   실측(2026-08-24)이 이 분모가 살아 있음을 보여준다 — 간판은 64/64 전수 크롤에 이메일 6건이라
 *   "아직 안 훑어서"가 아니라 진짜 저수율이다.
 *
 * ## 판정 단위가 **키워드가 아니라 업종**인 이유
 * 업체 키워드는 `지역 × 업종` 4,555 개다. "단양 상권분석" 하나로는 증거가 몇 건뿐이라 영원히
 * 판정 불가다. 반면 업종으로 묶으면 400 행씩 모인다. 그리고 **격자를 정의하는 단위가 업종**이라,
 * 판정 결과가 곧 격자 수정으로 이어진다(은퇴 = 회차 건너뛰기, 승격 = 전국 확장).
 *
 * ⚠️ **이 모듈이 못 하는 것**: *새* 업종을 발명하지 못한다. 승격은 이미 격자에 있는(=지역이 좁은)
 *   업종을 넓힐 뿐이다. 세상에 없던 업종어를 찾아내는 것은 사람의 일로 남는다 — 그건 측정이 아니라
 *   시장 감각이고, 기계가 조용히 하면 안 되는 종류의 결정이다.
 */
import type { D1Database } from '@cloudflare/workers-types'

/** `platform_settings` 키 — 값은 JSON(업종별 집계 + 기준일). */
export const SUBCAT_YIELD_KEY = 'ads_company_subcat_yield'

/**
 * 이만큼 **크롤된 뒤에야** 판정한다. 미만이면 무조건 통과 —
 * ⚠️ 낮추면 갓 넣은 업종이 몇 건으로 낙인찍혀 **탐색이 죽는다**(`ROTATION_EVIDENCE_MIN` 과 같은 정신).
 */
export const SUBCAT_EVIDENCE_MIN = 40
/**
 * 이 위는 손대지 않는다. 실측 기저(webkr 광고·대행 계열 크롤분 2,703 중 769 = **28.4%**)의
 * 절반쯤을 바닥으로 둔다 — 평균에 못 미친다고 자르면 절반이 늘 잘린다(평균은 문턱이 아니다).
 */
export const SUBCAT_OK_RATE = 0.15
/** 은퇴해도 이 주기마다 한 회차는 통과 — **증거 갱신 + 가역성**. 없으면 자동 조율이 아니라 영구 배제다. */
export const SUBCAT_PROBE_EVERY = 5

/**
 * 승격 문턱은 은퇴 문턱보다 **높다**(이력현상 — hysteresis). 같은 값을 쓰면 경계에 있는 업종이
 * 승격↔은퇴를 반복하며 격자를 흔든다. 승격은 되돌리기가 비싸므로(수천 행 삽입) 더 보수적으로 본다.
 */
export const SUBCAT_PROMOTE_RATE = 0.25
/** 승격은 이만큼 크롤된 근거가 있어야 한다 — 은퇴보다 많이 요구한다(같은 이유). */
export const SUBCAT_PROMOTE_EVIDENCE = 80

export interface SubcatYieldRow {
  /** 업종(subcategory). */
  s: string
  /** 크롤이 실제로 가 본 행 수(분모). */
  tried: number
  /** 그중 이메일을 얻은 행 수(분자). */
  got: number
}

export interface SubcatYieldBlob {
  /** KST 기준일 — 하루 한 번만 다시 센다. */
  day: string
  rows: SubcatYieldRow[]
}

/** 📅 KST 기준일 — 네이버·국내 데이터라 한국시간 기준(`naver-api-usage.kstDayKey` 와 같은 규약). */
export function kstDay(nowMs: number): string {
  return new Date(nowMs + 9 * 3600_000).toISOString().slice(0, 10)
}

/** 저장된 JSON 을 안전하게 읽는다. 형식이 깨졌으면 **빈 값**(추측하지 않는다 = 아무도 은퇴 안 함). */
export function parseSubcatYield(raw: string | null | undefined): SubcatYieldBlob | null {
  if (!raw) return null
  try {
    const j = JSON.parse(raw) as Partial<SubcatYieldBlob>
    if (!j || typeof j.day !== 'string' || !Array.isArray(j.rows)) return null
    return {
      day: j.day,
      rows: j.rows
        .filter((r): r is SubcatYieldRow => !!r && typeof r.s === 'string')
        .map(r => ({ s: r.s, tried: Math.max(0, Number(r.tried) || 0), got: Math.max(0, Number(r.got) || 0) })),
    }
  } catch { return null }
}

/** 이 업종이 "크롤해 봤더니 연락처가 안 나오는" 부류인가. **증거 부족이면 무조건 false**. */
export function isLowYieldSubcat(r: SubcatYieldRow): boolean {
  if (r.tried < SUBCAT_EVIDENCE_MIN) return false
  return r.got / r.tried < SUBCAT_OK_RATE
}

/** 이 업종이 전국으로 넓힐 만한가. 은퇴보다 **높은 문턱 + 많은 증거**를 요구한다(위 이력현상 주석). */
export function isPromotableSubcat(r: SubcatYieldRow): boolean {
  if (r.tried < SUBCAT_PROMOTE_EVIDENCE) return false
  return r.got / r.tried >= SUBCAT_PROMOTE_RATE
}

/**
 * 🚫 이번 회차에 **건너뛸 업종** 집합.
 *
 * ⚠️ 안전장치 셋이 **전부** 있어야 한다(하나라도 빠지면 자동 조율이 아니라 조용한 축 삭제가 된다):
 *   · **탐침 회차**({@link SUBCAT_PROBE_EVERY} 마다)엔 아무도 안 막는다 — 은퇴한 업종은 더 이상
 *     수집되지 않으므로 증거가 영영 안 갱신된다. 판정이 틀렸어도 스스로 못 뒤집으면 영구 배제다.
 *   · **증거 부족은 통과** — 모르는 것을 벌주지 않는다(`isLowYieldSubcat` 가 보장).
 *   · 호출부가 **풀이 통째로 비면 억제하지 않는다**(아래 `suppressCompanyPool` 이 보장).
 */
export function suppressedSubcats(blob: SubcatYieldBlob | null, roundIndex: number): Set<string> {
  if (!blob || roundIndex % SUBCAT_PROBE_EVERY === 0) return new Set()
  return new Set(blob.rows.filter(isLowYieldSubcat).map(r => r.s))
}

export interface PoolItem { subcategory?: string | null; fresh?: boolean }

/**
 * 회전 풀에서 저수율 업종을 그 회차만 **건너뛴다**(제거 아님).
 *
 * ⚠️ **미실행(fresh) 키워드는 절대 막지 않는다** — 아직 한 번도 안 돌아 증거가 없는데, 같은 업종의
 *   기존 증거로 막으면 새 지역을 시험할 기회가 사라진다(탐색 소멸).
 * ⚠️ **전부 막히면 아무도 안 막는다** — 빈 회차는 축을 통째로 멈춘다. 고칠 건 업종이지 수집이 아니다.
 *
 * @returns 건너뛸 항목의 인덱스 집합. 호출부는 그 자리를 **커서에서는 소비된 것으로** 처리해야 한다
 *   (안 그러면 다음 회차에 같은 자리를 또 읽어 회전이 제자리에 갇힌다 — 2026-08-23 에 겪은 사고).
 */
export function suppressCompanyPool(pool: PoolItem[], suppress: Set<string>): Set<number> {
  if (!suppress.size) return new Set()
  const idx = new Set<number>()
  pool.forEach((k, i) => { if (!k.fresh && k.subcategory && suppress.has(k.subcategory)) idx.add(i) })
  // 회전 몫이 통째로 막히면 억제를 포기한다(위 안전장치 3).
  const rotationCount = pool.filter(k => !k.fresh).length
  return idx.size >= rotationCount ? new Set() : idx
}

type MinimalDB = Pick<D1Database, 'prepare'>

/**
 * 📊 리드 풀 → 업종별 수율. **하루 한 번**, 한 번 훑고 한 번 쓴다(서브리퀘스트 2).
 *
 * `source='webkr'` 로 좁히는 것은 성능이 아니라 **정합** 때문이다 — 이 판정이 지배하는 것이
 * 웹문서 레인이고, 지도(local)·등록부(commerce) 리드는 연락처가 붙는 경로가 아예 달라
 * 섞으면 다른 파이프라인의 성적으로 이 레인의 업종을 심판하게 된다.
 *
 * @returns 갱신된 업종 수. 실패해도 던지지 않는다 — 계측이 레인을 죽이면 안 된다.
 */
export async function recomputeSubcatYield(DB: MinimalDB, nowMs: number): Promise<SubcatYieldBlob | null> {
  try {
    const agg = await DB.prepare(`
      SELECT subcategory AS s,
             SUM(CASE WHEN enrich_checked_at IS NOT NULL THEN 1 ELSE 0 END) AS tried,
             SUM(CASE WHEN enrich_checked_at IS NOT NULL AND email IS NOT NULL AND email <> '' THEN 1 ELSE 0 END) AS got
        FROM ad_company_leads
       WHERE source = 'webkr' AND subcategory IS NOT NULL AND subcategory <> ''
       GROUP BY subcategory`).all<SubcatYieldRow>()
    const rows = (agg?.results || [])
      .map(r => ({ s: String(r.s), tried: Math.max(0, Number(r.tried) || 0), got: Math.max(0, Number(r.got) || 0) }))
      .filter(r => r.tried > 0)
    if (!rows.length) return null // 집계가 비었으면 **덮어쓰지 않는다** — 빈 표는 전원 통과라 무해하지만, 옛 표를 지울 이유도 없다
    const blob: SubcatYieldBlob = { day: kstDay(nowMs), rows }
    await DB.prepare(
      `INSERT INTO platform_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).bind(SUBCAT_YIELD_KEY, JSON.stringify(blob)).run()
    return blob
  } catch {
    return null // 계측 실패는 레인을 막지 않는다
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * ⬆️ **승격 — 좁게 도는 업종을 전국으로** (2026-08-24)
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * ## 왜 이게 "영구"의 마지막 조각인가
 * 격자에는 **4 개 구에서만 도는 업종 17 개**가 있다(매장 생태계 — 주류·식자재·POS·인테리어…).
 * 2026-08-23 에 사람이 재 보고 *"수율이 낮으니 넓히지 않는다"* 고 결정했다. 그 판단은 옳았지만
 * **다시 재는 장치가 없으면 그 결정이 영원히 굳는다** — 나중에 좋아져도 아무도 모른다.
 *
 * ⇒ 여기서 자동으로 다시 본다: 좁게 돌던 업종이 {@link SUBCAT_PROMOTE_RATE} 이상을
 *   {@link SUBCAT_PROMOTE_EVIDENCE} 건의 크롤 근거로 보이면 **전국 시군구로 넓힌다**.
 *
 * ⚠️ **되돌리기는 자동이 아니다.** 승격은 수천 행을 넣는 일이고, 넣은 뒤 수율이 떨어지면
 *   위 은퇴 경로가 *회차 단위로* 건너뛴다(행을 지우지는 않는다). 지우는 것은 사람의 결정으로 남긴다 —
 *   행 삭제는 되돌릴 수 없고, 자동화가 조용히 할 일이 아니다.
 * ⚠️ 새 업종어를 **발명하지는 않는다**. 이미 격자에 있는 것을 넓힐 뿐이다.
 */
export const PROMOTE_KEY = 'ads_company_promote'
/** 1회 실행당 삽입 상한 — 시드와 같은 크기(회차 예산을 삽입에 다 쓰지 않게). */
export const PROMOTE_CHUNK = 500

export interface PromoteState { done: string[]; cursor: number; kw: string | null }

/** 저장된 진행값. 깨졌으면 처음부터(삽입은 `INSERT OR IGNORE` 라 재실행이 무해하다). */
export function parsePromoteState(raw: string | null | undefined): PromoteState {
  try {
    const j = JSON.parse(String(raw || '')) as Partial<PromoteState>
    return {
      done: Array.isArray(j?.done) ? j.done.filter(x => typeof x === 'string') : [],
      cursor: Math.max(0, Number(j?.cursor) || 0),
      kw: typeof j?.kw === 'string' ? j.kw : null,
    }
  } catch { return { done: [], cursor: 0, kw: null } }
}

export interface PromoteTrade { kw: string; category: string; subcategory: string; tier: number }

/**
 * 다음에 넓힐 업종 하나를 고른다. **한 번에 하나씩** — 여러 개를 동시에 넣으면 한 회차에
 * 수천 행이 들어가 그 회차의 수집이 통째로 굶는다(시드가 청크를 두는 것과 같은 이유).
 * @returns 승격 대상, 없으면 `null`.
 */
export function nextPromotion(
  candidates: readonly PromoteTrade[], blob: SubcatYieldBlob | null, state: PromoteState,
): PromoteTrade | null {
  if (state.kw) return candidates.find(t => t.kw === state.kw) || null // 진행 중인 것을 먼저 끝낸다
  if (!blob) return null
  const byS = new Map(blob.rows.map(r => [r.s, r]))
  for (const t of candidates) {
    if (state.done.includes(t.kw)) continue
    const r = byS.get(t.subcategory)
    if (r && isPromotableSubcat(r)) return t
  }
  return null
}
