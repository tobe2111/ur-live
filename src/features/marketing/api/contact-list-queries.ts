/**
 * 📬 **오늘의 컨택 — 이메일 줄 · 전화 줄을 따로 묻는다** (2026-11-18 대표 *"불러오는 속도 같은 최적화 말이야"*).
 *
 * 종전엔 업체·매장후보 각각 한 쿼리로 `ORDER BY (이메일 있으면 0 아니면 1), …` 를 걸었다. 그 정렬 키는 어느 인덱스에도
 * 없어서 **10행을 고르려고 표 전체를 정렬**했다(라이브 실측: 매장후보 69만 행 · 3.0초, 업체 20만 행). 화면을 열 때마다다.
 * ⇒ "이메일 있는 것 먼저" 를 정렬이 아니라 **두 번 묻기**로 바꾼다 — 이메일 줄을 먼저 받고, 모자라면 전화 줄로 채운다.
 *   결과 순서는 종전과 같다(이메일 그룹 → 전화 그룹, 그룹 안은 같은 정렬).
 *
 * 각 쿼리가 타는 인덱스(라이브 실측, 10행):
 *   · 매장 이메일 — `idx_prospects_email_mark`(이메일 있는 행만 담은 부분 인덱스) · 1.4만 행 · 14ms
 *   · 매장 전화 — `idx_prospects_newopen`(is_new_open, apv_perm_ymd) 정렬 순서 그대로 · 53행
 *   · 업체 두 줄 — `idx_company_leads_list_order`(정렬 키 그대로, 2026-11-18 신설)
 * ⚡ `+active` 의 단항 + 는 그 칸의 인덱스(`(active, …)`)를 못 쓰게 해 플래너가 위 인덱스를 고르게 한다 —
 *   안 붙이면 `active` 인덱스를 골라 69만 행을 읽는다(실측).
 * ⚠️ 업체 쪽 정렬이 종전(`tier → id`)에서 목록 화면과 같은 `tier → 수집일` 로 바뀌었다 — 인덱스를 타기 위해서다.
 *   "우선 티어 → 최근" 이라는 뜻은 같다.
 */
export function contactListQueries(_limit: number): { companyEmail: string; companyPhone: string; storeEmail: string; storePhone: string } {
  const coCols = 'id, company_name, category, subcategory, tier, region, email, phone, website'
  const coOrder = 'ORDER BY active DESC, (tier IS NULL) ASC, tier ASC, collected_at DESC, id DESC'
  const stCols = 'id, biz_name, category, region, email, phone, website, is_new_open'
  return {
    companyEmail: `SELECT ${coCols} FROM ad_company_leads
      WHERE active = 1 AND merged_into IS NULL AND status = 'new' AND email IS NOT NULL AND email != ''
      ${coOrder} LIMIT ?`,
    companyPhone: `SELECT ${coCols} FROM ad_company_leads
      WHERE active = 1 AND merged_into IS NULL AND status = 'new' AND (email IS NULL OR email = '') AND phone IS NOT NULL AND phone != ''
      ${coOrder} LIMIT ?`,
    storeEmail: `SELECT ${stCols} FROM store_prospects
      WHERE email IS NOT NULL AND email != '' AND +active = 1 AND +status = 'new'
      ORDER BY is_new_open DESC, apv_perm_ymd DESC, id DESC LIMIT ?`,
    storePhone: `SELECT ${stCols} FROM store_prospects
      WHERE +active = 1 AND status = 'new' AND (email IS NULL OR email = '') AND phone IS NOT NULL AND phone != ''
      ORDER BY is_new_open DESC, apv_perm_ymd DESC LIMIT ?`,
  }
}
