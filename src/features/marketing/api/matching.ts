/**
 * 🤝 유어애즈 — 인플루언서↔업체 성과기반 매칭 엔진 (읽기 전용 집계).
 *
 * 설계: docs/design/influencer-matching-service-2026-07.md
 * 차별화: 팔로워 수가 아니라 **실제 전환**(유입→방문→재방문)으로 매칭.
 *
 * 데이터 원천(전부 읽기 전용):
 *   - inflow_clicks   : 인플루언서 링크 클릭(ref_id=인플루언서 users.id, user_id=로그인 후 귀속 방문자)
 *   - voucher_visits  : 이용권 사용(=매장 방문) 이벤트(user_id, seller_id, product_id, amount)
 *   - products        : category(업종)
 *   - product_regions : region_dong_code(상권 — 구 단위 = 앞 5자리)
 *
 * ⚠️ 규율:
 *   - **읽기 전용** — CREATE/INSERT/UPDATE 없음. 테이블이 없으면(감사 2단계 미머지) 빈 결과로 우아하게.
 *   - **n<5 억제** — 재식별 방지 + 신뢰성. 표본 < N_MIN 셀은 값 숨김('표본 부족').
 *   - **가명/집계** — 개인 식별 불가. 인플루언서는 공개 프로필(handle/name)만 노출(PII 금지).
 *   - 데이터 0/희소여도 엔진이 안 깨짐(빈/부분 결과 graceful).
 *
 * 매칭 엔진 자체는 게이트 무관(순수 집계). 노출/활성은 라우트의 MATCHING_ENABLED 게이트가 담당.
 */
import { VOUCHER_CATEGORY_LABEL } from '@/shared/constants/voucher-categories'

// ── 상수 ────────────────────────────────────────────────────────────────
/** n<5 셀 억제 임계값(재식별 방지 · 신뢰성). 이 미만 표본은 값 숨김. */
export const N_MIN = 5

// ── 데이터 계약(프론트 prop 과 1:1 — 방배 후 실측이 이 형태로 채워짐) ─────────
export interface CategoryStat {
  category: string
  label: string
  visits: number
  visitors: number
  cvr: number          // 방문/유입 전환율(%) — 표본 부족이면 0 + suppressed
  suppressed: boolean  // 표본 < N_MIN → 값 신뢰불가(UI '표본 부족')
}
export interface RegionStat {
  code: string         // 구 코드(행정동코드 앞 5자리)
  visits: number
  visitors: number
  strength: number     // 0~100 상대 강세(그룹 내 정규화)
  suppressed: boolean
}
export interface InfluencerMetrics {
  influencerId: string
  handle: string | null       // 공개 링크샵 핸들(공개 식별자 — PII 아님)
  displayName: string | null  // 공개 프로필 표시명
  inflowClicks: number        // 유입(distinct anon_id)
  signups: number             // 가입/귀속(distinct user_id)
  visitors: number            // 매장 방문자수(distinct)
  visits: number              // 매장 방문(사용) 건수
  repeatVisitors: number      // 2회+ 방문자수
  repeatRate: number          // 재방문율(%)
  gmv: number                 // 발생 매출(원)
  aov: number                 // 객단가(원)
  categoryStats: CategoryStat[]
  regionStats: RegionStat[]
  sample: number              // 신뢰 표본 = 방문자수
  confidence: Confidence
}
export type Confidence = 'measured' | 'sparse' | 'cold'
export type MatchBadge = 'measured' | 'repeat' | 'cold'

export interface MatchCandidate {
  influencerId: string
  handle: string | null
  displayName: string | null
  visits: number
  visitors: number
  repeatRate: number
  gmv: number
  categoryCvr: number         // 요청 업종 전환율(%) — 표본 부족이면 0
  fitScore: number            // 0~100 적합도
  fitReason: string           // 추천 근거 한 줄
  badge: MatchBadge
  confidence: Confidence
  suppressed: boolean         // 요청 업종/상권 셀 표본 부족(값 참고용)
}

export interface StoreDealRec {
  productId: number
  title: string | null
  category: string | null
  categoryLabel: string
  regionCode: string | null
  price: number | null
}

// ── 순수 함수(유닛 테스트 대상) ──────────────────────────────────────────
/** 업종 코드 → 짧은 한글 라벨(레거시 포함, 없으면 코드 그대로). */
export function categoryLabel(cat: string | null | undefined): string {
  if (!cat) return '기타'
  return VOUCHER_CATEGORY_LABEL[cat]?.short ?? cat
}

/** 행정동코드 → 상권(구) 코드 = 앞 5자리. 짧거나 없으면 null. */
export function guPrefix(dongCode: string | null | undefined): string | null {
  if (!dongCode) return null
  const s = String(dongCode)
  return s.length >= 5 ? s.slice(0, 5) : null
}

/** 표본 < N_MIN → 억제. */
export function isSuppressed(sampleCount: number): boolean {
  return !Number.isFinite(sampleCount) || sampleCount < N_MIN
}

/** 방문자수 → 신뢰도 등급. */
export function confidenceOf(visitors: number): Confidence {
  if (visitors >= N_MIN) return 'measured'
  if (visitors > 0) return 'sparse'
  return 'cold'
}

/** 재방문율(%) — 방문자 0 이면 0. */
export function repeatRatePct(repeatVisitors: number, visitors: number): number {
  if (!visitors || visitors <= 0) return 0
  return Math.round((repeatVisitors / visitors) * 1000) / 10
}

/** 전환율(%) — 분모 0 이면 0. */
export function cvrPct(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0) return 0
  return Math.round((numerator / denominator) * 1000) / 10
}

/** 객단가 — 방문 0 이면 0. */
export function aovOf(gmv: number, visits: number): number {
  if (!visits || visits <= 0) return 0
  return Math.round(gmv / visits)
}

/** 배지: 측정됐고 재방문율 높으면 재방문강세, 측정됐으면 실측, 아니면 콜드. */
export function badgeOf(confidence: Confidence, repeatRate: number): MatchBadge {
  if (confidence === 'cold') return 'cold'
  if (repeatRate >= 40) return 'repeat'
  return 'measured'
}

/**
 * 적합도 점수(0~100) — 우리 업종/상권에서의 실전환을 정규화.
 * 투명 산식: 업종전환(45%) + 상권강세(25%) + 재방문율(20%) + 표본신뢰(10%).
 * 표본 부족(cold)은 상한 55 로 clamp — 허수 상위노출 방지.
 */
export function computeFitScore(input: {
  categoryCvr: number      // 요청 업종 전환율(%)
  regionStrength: number   // 요청 상권 강세(0~100)
  repeatRate: number       // 재방문율(%)
  visitors: number         // 표본
}): number {
  const catPart = clamp01(input.categoryCvr / 12) * 45      // 12% 전환을 만점 기준
  const regPart = clamp01(input.regionStrength / 100) * 25
  const repPart = clamp01(input.repeatRate / 60) * 20       // 60% 재방문을 만점 기준
  const samplePart = clamp01(input.visitors / 30) * 10      // 30 표본을 만점 기준
  let score = Math.round(catPart + regPart + repPart + samplePart)
  if (input.visitors < N_MIN) score = Math.min(score, 55)   // 콜드 상한
  return Math.max(0, Math.min(100, score))
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(1, v))
}

/** 추천 근거 한 줄(가명·집계 표현). */
export function fitReasonOf(input: {
  categoryLabelKo: string
  categoryCvr: number
  regionStrength: number
  repeatRate: number
  confidence: Confidence
}): string {
  if (input.confidence === 'cold') return '성과 데이터 수집 중 — 발굴 프로필 기반 임시 추천(방배 후 실측 대체)'
  const parts: string[] = []
  if (input.categoryCvr > 0) parts.push(`${input.categoryLabelKo} 실전환 ${input.categoryCvr}%`)
  if (input.regionStrength >= 50) parts.push('이 상권 강세')
  if (input.repeatRate >= 40) parts.push(`재방문율 ${input.repeatRate}%`)
  return parts.length ? parts.join(' · ') : '실측 전환 이력 보유'
}

/** 그룹 내 상대 강세(0~100) 정규화 — 최대 visits 기준. */
export function normalizeStrength(visits: number, maxVisits: number): number {
  if (!maxVisits || maxVisits <= 0) return 0
  return Math.round(clamp01(visits / maxVisits) * 100)
}

// ── 읽기 전용 DB 헬퍼(테이블 없거나 오류면 빈 결과 — graceful) ──────────────
async function safeAll<T = Record<string, unknown>>(DB: D1Database, sql: string, binds: unknown[] = []): Promise<T[]> {
  try {
    const stmt = binds.length ? DB.prepare(sql).bind(...binds) : DB.prepare(sql)
    const r = await stmt.all<T>()
    return r?.results ?? []
  } catch {
    // 테이블 미존재(감사 2단계 미머지) / 기타 오류 → 빈 결과(엔진 안 깨짐).
    return []
  }
}

/**
 * 첫 클릭(first-touch) 귀속 인플루언서별 방문 원장 CTE(개념).
 * inflow_clicks(user_id 귀속) → voucher_visits → products.category / product_regions(구).
 * CTE 이름: ft(first-touch), av(influencer_id, visitor, voucher_id, amount, category, gu).
 * ⚠️ 각 쿼리에 **리터럴로 인라인**한다 — 정적 테이블가드(check-sql-table-exists)가 CTE 이름을
 *    같은 문자열 리터럴에서만 인식하므로, `${...}` 보간으로 넣으면 av 를 미지 테이블로 오탐한다.
 */

interface RankRow { influencer_id: string; visits: number; visitors: number; gmv: number; repeat_visitors: number; cat_visitors: number }

/**
 * 업체용 매칭: 이 업종·상권에서 실제 전환이 높았던 인플루언서 랭킹.
 * @param category  업종 코드(voucher category) 또는 null(전체)
 * @param regionPrefix 상권(구) 코드 앞5자리 또는 null(전체)
 */
export async function rankInfluencersForStore(
  DB: D1Database,
  opts: { category?: string | null; regionPrefix?: string | null; limit?: number },
): Promise<MatchCandidate[]> {
  const limit = Math.max(1, Math.min(50, opts.limit ?? 20))
  const cat = opts.category || null
  const reg = opts.regionPrefix || null

  // 필터 절(선택) — 요청 업종/상권으로 좁힌 전환. 인플루언서 전체 방문자수도 함께(신뢰표본).
  const catFilter = cat ? 'AND av.category = ?' : ''
  const regFilter = reg ? 'AND av.gu = ?' : ''
  const filterBinds: unknown[] = []
  if (cat) filterBinds.push(cat)
  if (reg) filterBinds.push(reg)

  const sql = `WITH ft AS (
    SELECT user_id, ref_id FROM (
      SELECT user_id, ref_id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC, id ASC) AS rn
      FROM inflow_clicks WHERE user_id IS NOT NULL AND user_id != ''
    ) WHERE rn = 1
  ),
  av AS (
    SELECT ft.ref_id AS influencer_id, vv.user_id AS visitor, vv.voucher_id AS voucher_id,
           COALESCE(vv.amount, 0) AS amount, p.category AS category, substr(pr.region_dong_code, 1, 5) AS gu
    FROM voucher_visits vv
    JOIN ft ON ft.user_id = vv.user_id
    LEFT JOIN products p ON p.id = vv.product_id
    LEFT JOIN product_regions pr ON pr.product_id = vv.product_id
  ),
  scoped AS (
    SELECT influencer_id, visitor, voucher_id, amount
    FROM av
    WHERE 1=1 ${catFilter} ${regFilter}
  ),
  per_visitor AS (
    SELECT influencer_id, visitor, COUNT(DISTINCT voucher_id) AS v
    FROM scoped GROUP BY influencer_id, visitor
  )
  SELECT s.influencer_id AS influencer_id,
         COUNT(DISTINCT s.voucher_id) AS visits,
         COUNT(DISTINCT s.visitor) AS visitors,
         COALESCE(SUM(s.amount), 0) AS gmv,
         (SELECT COUNT(*) FROM per_visitor pv WHERE pv.influencer_id = s.influencer_id AND pv.v >= 2) AS repeat_visitors,
         (SELECT COUNT(DISTINCT ic.user_id) FROM inflow_clicks ic WHERE ic.ref_id = s.influencer_id AND ic.user_id IS NOT NULL AND ic.user_id != '') AS cat_visitors
  FROM scoped s
  GROUP BY s.influencer_id
  HAVING visitors >= ${N_MIN}
  ORDER BY visits DESC, gmv DESC
  LIMIT ${limit}`

  const rows = await safeAll<RankRow>(DB, sql, filterBinds)
  if (!rows.length) return []

  const maxVisits = Math.max(...rows.map((r) => Number(r.visits) || 0), 1)
  const profiles = await loadInfluencerProfiles(DB, rows.map((r) => String(r.influencer_id)))
  const catLabel = categoryLabel(cat)

  return rows.map((r) => {
    const visitors = Number(r.visitors) || 0
    const visits = Number(r.visits) || 0
    const gmv = Number(r.gmv) || 0
    const repeatRate = repeatRatePct(Number(r.repeat_visitors) || 0, visitors)
    // 요청 업종 전환율 = 이 업종 방문자 / 인플루언서 전체 귀속 유입(가입).
    const signups = Number(r.cat_visitors) || 0
    const categoryCvr = cvrPct(visitors, signups)
    const regionStrength = normalizeStrength(visits, maxVisits)
    const confidence = confidenceOf(visitors)
    const suppressed = isSuppressed(visitors)
    const fitScore = computeFitScore({ categoryCvr, regionStrength, repeatRate, visitors })
    const p = profiles[String(r.influencer_id)]
    return {
      influencerId: String(r.influencer_id),
      handle: p?.handle ?? null,
      displayName: p?.name ?? null,
      visits,
      visitors,
      repeatRate,
      gmv,
      categoryCvr: suppressed ? 0 : categoryCvr,
      fitScore,
      fitReason: fitReasonOf({ categoryLabelKo: catLabel, categoryCvr, regionStrength, repeatRate, confidence }),
      badge: badgeOf(confidence, repeatRate),
      confidence,
      suppressed,
    }
  })
}

interface Profile { handle: string | null; name: string | null }
/** 공개 프로필(handle/name)만 로드 — PII(email/phone) 미조회. */
async function loadInfluencerProfiles(DB: D1Database, ids: string[]): Promise<Record<string, Profile>> {
  const uniq = Array.from(new Set(ids.filter((x) => /^\d{1,12}$/.test(x))))
  if (!uniq.length) return {}
  const ph = uniq.map(() => '?').join(',')
  const rows = await safeAll<{ id: number; handle: string | null; name: string | null }>(
    DB, `SELECT id, handle, name FROM users WHERE id IN (${ph})`, uniq.map((x) => Number(x)),
  )
  const out: Record<string, Profile> = {}
  for (const r of rows) out[String(r.id)] = { handle: r.handle ?? null, name: r.name ?? null }
  return out
}

/** 귀속 방문 원장 raw 행(단일 인플루언서). */
export interface AvRow { visitor: string | null; voucher_id: number; amount: number; category: string | null; gu: string | null }

/**
 * 방문 원장 raw 행 → 종합 지표(순수 함수 · 유닛 테스트 대상).
 * 방문/재방문/GMV + 업종별·상권별 분해, 전부 n<5 억제. 집계·가명만(개인 식별 불가).
 */
export function aggregateInfluencerMetrics(input: {
  influencerId: string; handle: string | null; displayName: string | null
  inflowClicks: number; signups: number; rows: AvRow[]
}): InfluencerMetrics {
  const rows = input.rows || []
  const visitorSet = new Set<string>()
  const voucherSet = new Set<number>()
  const perVisitor = new Map<string, number>()
  let gmv = 0
  const catMap = new Map<string, { visitors: Set<string>; vouchers: Set<number> }>()
  const regMap = new Map<string, { visitors: Set<string>; vouchers: Set<number> }>()
  const bucket = (map: Map<string, { visitors: Set<string>; vouchers: Set<number> }>, key: string, v: string, voucher: number) => {
    const m = map.get(key) || { visitors: new Set<string>(), vouchers: new Set<number>() }
    if (v) m.visitors.add(v)
    if (Number.isFinite(voucher)) m.vouchers.add(voucher)
    map.set(key, m)
  }
  for (const r of rows) {
    const v = r.visitor != null ? String(r.visitor) : ''
    const voucher = Number(r.voucher_id)
    if (v) { visitorSet.add(v); perVisitor.set(v, (perVisitor.get(v) || 0) + 1) }
    if (Number.isFinite(voucher)) voucherSet.add(voucher)
    gmv += Number(r.amount) || 0
    if (r.category) bucket(catMap, r.category, v, voucher)
    if (r.gu) bucket(regMap, r.gu, v, voucher)
  }
  const visitors = visitorSet.size
  const visits = voucherSet.size
  let repeatVisitors = 0
  for (const c of perVisitor.values()) if (c >= 2) repeatVisitors++

  const categoryStats: CategoryStat[] = Array.from(catMap.entries())
    .map(([category, m]) => {
      const cVisitors = m.visitors.size
      const suppressed = isSuppressed(cVisitors)
      return { category, label: categoryLabel(category), visits: m.vouchers.size, visitors: cVisitors, cvr: suppressed ? 0 : cvrPct(cVisitors, input.signups), suppressed }
    })
    .sort((a, b) => b.visits - a.visits)

  const regEntries = Array.from(regMap.entries())
  const maxReg = Math.max(...regEntries.map(([, m]) => m.vouchers.size), 1)
  const regionStats: RegionStat[] = regEntries
    .map(([code, m]) => {
      const rVisitors = m.visitors.size
      const suppressed = isSuppressed(rVisitors)
      return { code, visits: m.vouchers.size, visitors: rVisitors, strength: suppressed ? 0 : normalizeStrength(m.vouchers.size, maxReg), suppressed }
    })
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 8)

  return {
    influencerId: input.influencerId,
    handle: input.handle,
    displayName: input.displayName,
    inflowClicks: input.inflowClicks,
    signups: input.signups,
    visitors, visits, repeatVisitors,
    repeatRate: repeatRatePct(repeatVisitors, visitors),
    gmv, aov: aovOf(gmv, visits),
    categoryStats, regionStats,
    sample: visitors, confidence: confidenceOf(visitors),
  }
}

/**
 * 인플루언서 성과 상세(업체 상세 뷰 + 인플루언서 self-performance 공용).
 * 방문 원장 raw 행(av CTE) + 유입/가입 카운트 → 순수 aggregator. 테이블 없으면 빈 지표.
 */
export async function getInfluencerMetrics(DB: D1Database, influencerId: string): Promise<InfluencerMetrics | null> {
  const id = String(influencerId)
  if (!/^\d{1,12}$/.test(id)) return null

  const [rows, counts, profiles] = await Promise.all([
    safeAll<AvRow>(DB, `WITH ft AS (
        SELECT user_id, ref_id FROM (
          SELECT user_id, ref_id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC, id ASC) AS rn
          FROM inflow_clicks WHERE user_id IS NOT NULL AND user_id != ''
        ) WHERE rn = 1
      ),
      av AS (
        SELECT ft.ref_id AS influencer_id, vv.user_id AS visitor, vv.voucher_id AS voucher_id,
               COALESCE(vv.amount, 0) AS amount, p.category AS category, substr(pr.region_dong_code, 1, 5) AS gu
        FROM voucher_visits vv
        JOIN ft ON ft.user_id = vv.user_id
        LEFT JOIN products p ON p.id = vv.product_id
        LEFT JOIN product_regions pr ON pr.product_id = vv.product_id
      )
      SELECT visitor, voucher_id, amount, category, gu FROM av WHERE influencer_id = ?`, [id]),
    safeAll<{ inflow: number; signups: number }>(DB,
      `SELECT COUNT(DISTINCT anon_id) AS inflow,
              COUNT(DISTINCT CASE WHEN user_id IS NOT NULL AND user_id != '' THEN user_id END) AS signups
       FROM inflow_clicks WHERE ref_id = ?`, [id]),
    loadInfluencerProfiles(DB, [id]),
  ])

  const c = counts[0]
  const p = profiles[id]
  return aggregateInfluencerMetrics({
    influencerId: id,
    handle: p?.handle ?? null,
    displayName: p?.name ?? null,
    inflowClicks: Number(c?.inflow) || 0,
    signups: Number(c?.signups) || 0,
    rows,
  })
}

/**
 * 인플루언서용: 당신이 잘 파는 업종의 새 매장 딜 탐색.
 * 인플루언서의 강세 업종(성과 상세에서) 기준으로 활성 이용권 상품 추천(읽기 전용).
 */
export async function rankStoresForInfluencer(
  DB: D1Database,
  opts: { categories: string[]; regionPrefix?: string | null; limit?: number },
): Promise<StoreDealRec[]> {
  const cats = (opts.categories || []).filter((c) => typeof c === 'string' && c)
  if (!cats.length) return []
  const limit = Math.max(1, Math.min(30, opts.limit ?? 12))
  const ph = cats.map(() => '?').join(',')
  const reg = opts.regionPrefix || null

  const sql = `SELECT p.id AS productId, p.title AS title, p.category AS category, p.price AS price,
                      substr(pr.region_dong_code, 1, 5) AS regionCode
  FROM products p
  LEFT JOIN product_regions pr ON pr.product_id = p.id
  WHERE p.is_active = 1 AND p.category IN (${ph})
    ${reg ? 'AND substr(pr.region_dong_code, 1, 5) = ?' : ''}
  ORDER BY p.created_at DESC
  LIMIT ${limit}`
  const binds: unknown[] = [...cats]
  if (reg) binds.push(reg)

  const rows = await safeAll<{ productId: number; title: string | null; category: string | null; price: number | null; regionCode: string | null }>(DB, sql, binds)
  return rows.map((r) => ({
    productId: Number(r.productId),
    title: r.title ?? null,
    category: r.category ?? null,
    categoryLabel: categoryLabel(r.category),
    regionCode: r.regionCode ?? null,
    price: r.price != null ? Number(r.price) : null,
  }))
}

// ── 데이터 준비도(커버리지) — 어드민이 매칭 신뢰도를 한눈에 ───────────────────
export interface MatchingCoverage {
  totalInflow: number          // 전체 유입 클릭(distinct anon_id)
  attributedUsers: number      // 로그인 귀속된 방문자(distinct user_id)
  influencersWithData: number  // 귀속 방문 1건+ 인플루언서 수
  measuredInfluencers: number  // 방문자 ≥ N_MIN(실측 신뢰) 인플루언서 수
  totalVisits: number          // 귀속 매장 방문 총건수
  categoriesCovered: number    // 데이터 있는 업종 수
  regionsCovered: number       // 데이터 있는 상권(구) 수
}

/** 매칭 데이터 준비도(읽기 전용·graceful). 테이블 없거나 비면 전부 0. */
export async function getMatchingCoverage(DB: D1Database): Promise<MatchingCoverage> {
  const inflow = (await safeAll<{ total: number; attributed: number }>(DB,
    `SELECT COUNT(DISTINCT anon_id) AS total,
            COUNT(DISTINCT CASE WHEN user_id IS NOT NULL AND user_id != '' THEN user_id END) AS attributed
     FROM inflow_clicks`))[0]
  const cov = (await safeAll<{ influencers: number; visits: number; categories: number; regions: number; measured: number }>(DB,
    `WITH ft AS (
        SELECT user_id, ref_id FROM (
          SELECT user_id, ref_id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC, id ASC) AS rn
          FROM inflow_clicks WHERE user_id IS NOT NULL AND user_id != ''
        ) WHERE rn = 1
      ),
      av AS (
        SELECT ft.ref_id AS influencer_id, vv.user_id AS visitor, vv.voucher_id AS voucher_id,
               p.category AS category, substr(pr.region_dong_code, 1, 5) AS gu
        FROM voucher_visits vv
        JOIN ft ON ft.user_id = vv.user_id
        LEFT JOIN products p ON p.id = vv.product_id
        LEFT JOIN product_regions pr ON pr.product_id = vv.product_id
      ),
      per_inf AS (SELECT influencer_id, COUNT(DISTINCT visitor) AS v FROM av GROUP BY influencer_id)
      SELECT
        (SELECT COUNT(DISTINCT influencer_id) FROM av) AS influencers,
        (SELECT COUNT(DISTINCT voucher_id) FROM av) AS visits,
        (SELECT COUNT(DISTINCT category) FROM av WHERE category IS NOT NULL) AS categories,
        (SELECT COUNT(DISTINCT gu) FROM av WHERE gu IS NOT NULL) AS regions,
        (SELECT COUNT(*) FROM per_inf WHERE v >= ${N_MIN}) AS measured`))[0]
  return {
    totalInflow: Number(inflow?.total) || 0,
    attributedUsers: Number(inflow?.attributed) || 0,
    influencersWithData: Number(cov?.influencers) || 0,
    measuredInfluencers: Number(cov?.measured) || 0,
    totalVisits: Number(cov?.visits) || 0,
    categoriesCovered: Number(cov?.categories) || 0,
    regionsCovered: Number(cov?.regions) || 0,
  }
}
