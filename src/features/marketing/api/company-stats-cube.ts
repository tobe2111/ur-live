/**
 * 📊 **파트너 풀 집계를 한 번의 스캔으로** (2026-08-31 — 라이브 실측이 시킨 재작성).
 *
 * ## 무엇이 문제였나
 * `companyStats()` 는 같은 39만 행 테이블을 **8번 훑었다**(총계·카테고리·tier·종류·소스·세그먼트·
 * 대행사 퍼널·일자별). 통제 실험으로 잰 값이 **호출 1회 3,317,537행** — D1 무료 한도(500만/일)의 66%.
 *
 * ## 왜 8번일 필요가 없나
 * 여덟 쿼리가 **전부 같은 행들**을 보고 다른 축으로 접을 뿐이다. 그러면 **한 번 훑으면서
 * (카테고리, tier, 종류, 소스, 병합여부)로 묶고 나머지는 조건부 합계로 들고 나오면** 끝이다.
 * 그 결과는 몇백 줄짜리 작은 표(라이브 실측 **175줄**)라, 나머지 접기는 코드에서 공짜로 한다.
 *
 * ```
 *   예전 : 8 쿼리          →  3,317,537행
 *   지금 : 큐브 1 + 일자별 1 →    약 86만행   (라이브 실측 797,182 + 61k)
 * ```
 *
 * ## ⚠️ 왜 플래그를 **차원이 아니라 합계**로 두는가
 * 이메일·전화·홈페이지·크롤시도·파이프라인·최근7일까지 차원에 넣으면 조합이 2^6 배로 터져
 * **묶음 수가 원본 행 수를 넘는다**(그러면 고치기 전보다 느리다). 축은 다섯 개로 묶고 나머지는
 * 조건부 `SUM` 으로 들고 나오는 것이 이 설계의 전부다.
 *
 * ## ⚠️ 이 모듈이 지켜야 하는 것 — **숫자가 예전과 한 자리도 달라지면 안 된다**
 * 화면 카드가 이 값들이다. 빠르기만 하고 값이 달라지면 그건 고친 게 아니라 바꾼 것이다.
 * 그래서 유닛이 **예전 8쿼리와 새 큐브를 같은 SQLite 에 태워 결과를 통째로 대조**한다.
 */

/** 큐브 한 줄 — 다섯 축 + 조건부 합계들. */
export interface CubeRow {
  c: string; t: number | null; lt: string; src: string; live: number
  n: number
  with_email: number; with_phone: number; with_any: number
  held_no_contact: number; pipeline: number; recent7: number; needs_review: number
  seg_payback: number; seg_agency: number
  af_email: number; af_site_no_email: number; af_site_tried: number; af_no_site: number
}

/**
 * 🧊 한 번의 스캔. 축 다섯(카테고리·tier·종류·소스·병합여부) + 나머지는 조건부 합계.
 * ⚠️ 축을 늘리지 말 것 — 묶음 수가 곱으로 늘어 원본 행 수를 넘는 순간 이 설계는 무의미해진다.
 */
export const COMPANY_CUBE_SQL = `SELECT
    COALESCE(category,'?') AS c, tier AS t, COALESCE(NULLIF(lead_type,''),'unknown') AS lt,
    COALESCE(NULLIF(source,''),'?') AS src, (merged_into IS NULL) AS live,
    COUNT(*) AS n,
    SUM(CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) AS with_email,
    SUM(CASE WHEN phone IS NOT NULL AND phone != '' THEN 1 ELSE 0 END) AS with_phone,
    SUM(CASE WHEN (email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != '') THEN 1 ELSE 0 END) AS with_any,
    SUM(CASE WHEN active = 0 AND merged_into IS NULL THEN 1 ELSE 0 END) AS held_no_contact,
    SUM(CASE WHEN status NOT IN ('new','rejected') THEN 1 ELSE 0 END) AS pipeline,
    SUM(CASE WHEN collected_at >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS recent7,
    -- ⚠️ **차원에서 유도하면 안 된다.** 축 \`lt\` 는 빈 문자열도 'unknown' 으로 접지만(예전 byLeadType 이
    --   그랬다), 예전 needs_review 는 \`lead_type IS NULL OR = 'unknown'\` 이라 **빈 문자열을 안 센다.**
    --   그 비대칭은 예전 코드의 성질이고, 여기서 '고치면' 화면 숫자가 조용히 달라진다(유닛이 잡았다).
    SUM(CASE WHEN lead_type IS NULL OR lead_type = 'unknown' THEN 1 ELSE 0 END) AS needs_review,
    SUM(CASE WHEN merged_into IS NULL AND active = 1 AND category = '온라인판매' AND email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) AS seg_payback,
    SUM(CASE WHEN merged_into IS NULL AND active = 1 AND category = '대행사' AND ((email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != '')) THEN 1 ELSE 0 END) AS seg_agency,
    SUM(CASE WHEN merged_into IS NULL AND category = '대행사' AND email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) AS af_email,
    SUM(CASE WHEN merged_into IS NULL AND category = '대행사' AND (email IS NULL OR email = '') AND website IS NOT NULL AND website != '' THEN 1 ELSE 0 END) AS af_site_no_email,
    SUM(CASE WHEN merged_into IS NULL AND category = '대행사' AND (email IS NULL OR email = '') AND website IS NOT NULL AND website != '' AND enrich_checked_at IS NOT NULL THEN 1 ELSE 0 END) AS af_site_tried,
    SUM(CASE WHEN merged_into IS NULL AND category = '대행사' AND (email IS NULL OR email = '') AND (website IS NULL OR website = '') THEN 1 ELSE 0 END) AS af_no_site
  FROM ad_company_leads GROUP BY 1,2,3,4,5`

const num = (v: unknown): number => Number(v) || 0

/**
 * 큐브를 예전 여덟 쿼리와 **같은 모양**으로 접는다.
 *
 * ⚠️ 정렬·상한이 예전과 같아야 한다 — 카테고리/소스는 `n DESC LIMIT 20`, tier 는 NULL 이 뒤,
 *   종류는 `n DESC`. 화면이 그 순서를 그대로 그리므로 여기서 흐트러지면 눈에 띄는 회귀다.
 * ⚠️ 카테고리·tier·종류 집계는 **병합된 행도 포함**한다(예전 쿼리에 WHERE 가 없었다).
 *   소스만 `merged_into IS NULL` 이다 — 이 비대칭은 의도된 것이라 그대로 옮긴다.
 */
export function foldCube(rows: CubeRow[]) {
  const acc = { total: 0, with_contact: 0, with_email: 0, held_no_contact: 0, merged_away: 0, active_pipeline: 0, recent7: 0, needs_review: 0 }
  const af = { total: 0, with_email: 0, site_no_email: 0, site_tried: 0, no_site: 0 }
  const seg = { payback_ready: 0, agency_ready: 0 }
  const cat = new Map<string, number>(), tier = new Map<string, number>(), type = new Map<string, number>()
  const src = new Map<string, { source: string; n: number; with_phone: number; with_email: number; with_any: number }>()

  for (const r of rows) {
    const n = num(r.n)
    acc.total += n
    acc.with_contact += num(r.with_any)
    acc.with_email += num(r.with_email)
    acc.held_no_contact += num(r.held_no_contact)
    acc.active_pipeline += num(r.pipeline)
    acc.recent7 += num(r.recent7)
    if (!num(r.live)) acc.merged_away += n
    acc.needs_review += num(r.needs_review) // 차원(lt)에서 유도 금지 — 위 SQL 주석 참조
    seg.payback_ready += num(r.seg_payback)
    seg.agency_ready += num(r.seg_agency)
    if (num(r.live) && r.c === '대행사') af.total += n
    af.with_email += num(r.af_email)
    af.site_no_email += num(r.af_site_no_email)
    af.site_tried += num(r.af_site_tried)
    af.no_site += num(r.af_no_site)

    cat.set(r.c, (cat.get(r.c) || 0) + n)
    const tk = r.t == null ? '' : String(r.t)
    tier.set(tk, (tier.get(tk) || 0) + n)
    type.set(r.lt, (type.get(r.lt) || 0) + n)
    if (num(r.live)) {
      const cur = src.get(r.src) || { source: r.src, n: 0, with_phone: 0, with_email: 0, with_any: 0 }
      cur.n += n; cur.with_phone += num(r.with_phone); cur.with_email += num(r.with_email); cur.with_any += num(r.with_any)
      src.set(r.src, cur)
    }
  }

  const byCategory = [...cat].map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n).slice(0, 20)
  const byTier = [...tier].map(([k, n]) => ({ k: k === '' ? null : Number(k), n }))
    .sort((a, b) => (a.k == null ? 1 : 0) - (b.k == null ? 1 : 0) || (a.k as number) - (b.k as number))
  const byLeadType = [...type].map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n)
  const bySource = [...src.values()].sort((a, b) => b.n - a.n).slice(0, 20)
  return { stats: acc, byCategory, byTier, byLeadType, bySource, seg, agencyEmailFunnel: af }
}
