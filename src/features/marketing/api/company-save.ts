/**
 * 💾 파트너 리드 저장(upsert) — `company-discovery.ts` 에서 분리 (2026-07-29, god 파일 래칫 600줄).
 *
 *   여기 모인 것은 하나다: **모든 수집 소스가 지나는 단 하나의 저장 관문**.
 *   네이버/webkr/상가정보/통신판매/공정위/나라장터/고용24 가 전부 이 함수를 통과하므로,
 *   판별(업체가 맞나)·분류(카테고리 권위 위계)·중복 병합(company_key)이 여기서 한 번에 결정된다.
 *
 *   ⚠️ 호출부 호환: `company-discovery.ts` 가 그대로 re-export 하므로 기존 import 경로는 바뀌지 않는다.
 */
import { classifyLead, suspectCompanyName, REGISTRY_CATEGORY_SOURCES, CLASSIFY_RULES_VERSION } from './company-classify'
import { normalizeCompanyName } from './registry-email-match'
import {
  ensureCompanySchema, hasContact, companyKey,
  COMPANY_TIER_MIN, COMPANY_TIER_MAX, type CompanyLead,
} from './company-discovery'

/**
 * 리드 저장(upsert). @returns **실제로 새로 들어온 행 수**.
 *
 *   ⚠️ 2026-07-29 의미 정정: 예전엔 *시도한* 행 수를 돌려줬다. `ON CONFLICT DO UPDATE` 라 이미 아는 업체를
 *   다시 긁어도 그대로 세어져, 상태줄의 `저장 24,412` 가 "신규 2.4만"으로 읽혔다 — 대부분 재확인이었다.
 *   (대표가 "이미 확보한 걸 빼면 수집량이 줄지 않냐"고 지적해 드러났다. 지적이 맞았다.)
 *   ⇒ 저장 전후 COUNT 차이로 신규만 센다. 재확인분은 `saveCompanyLeadsCounted` 의 `upserted`.
 *   📉 원부를 다 훑으면 이 값은 0 에 수렴한다 — '고장'이 아니라 '완주'다. 둘의 구분엔 `upserted` 가 필요하다.
 */
export async function saveCompanyLeads(DB: D1Database, leads: CompanyLead[], opts: { requireContact?: boolean } = {}): Promise<number> {
  return (await saveCompanyLeadsCounted(DB, leads, opts)).inserted
}

/** 신규/재확인을 분리해 돌려주는 판 — 상태줄이 "다 모았다"와 "수집이 죽었다"를 구분하려면 둘 다 필요하다. */
export async function saveCompanyLeadsCounted(DB: D1Database, leads: CompanyLead[], opts: { requireContact?: boolean } = {}): Promise<{ inserted: number; upserted: number }> {
  if (!leads.length) return { inserted: 0, upserted: 0 }
  await ensureCompanySchema(DB)
  const clamp = (v: unknown, n: number): string | null => { const s = v == null ? '' : String(v).trim(); return s ? s.slice(0, n) : null }
  const tierOf = (v: unknown): number | null => { const t = Math.round(Number(v)); return Number.isFinite(t) && t >= COMPANY_TIER_MIN && t <= COMPANY_TIER_MAX ? t : null }
  // 🧭 저장 전 판별·분류(SSOT company-classify) — 모든 소스(네이버/webkr/상가정보/통신판매/나라장터…)가 이 관문을 통과.
  //   ① 업체가 아닌 것(공고·모집글·기사제목·정부 도메인)은 여기서 **탈락**(저장 안 함) → 오수집 구조적 차단.
  //   ② 카테고리 권위 위계(2026-07-27 대표 "카테고리 분류 정확한가"): **정부 등록부 공식 업종(registry)
  //      > 리드 텍스트 근거(evidence) > 검색 키워드(keyword)**. 상가정보 업종코드·통신판매 신고업태·공정위
  //      가맹·나라장터 소스의 category 는 공식 업종이라 정규식이 못 덮어씀 — 발굴 소스(local/webkr)만 재분류.
  const rows = leads
    .map(l => ({ ...l, company_name: (l.company_name || '').trim() }))
    .filter(l => l.company_name.length >= 2)
    .map(l => {
      const c = classifyLead(l)
      if (!c.ok) return null
      const registry = REGISTRY_CATEGORY_SOURCES.has(String(l.source || '')) && !!l.category
      if (registry) {
        // 공식 업종 유지 + 등록부 실재 업체라 접촉가치 미상이면 파트너로(기관 어휘 감지는 존중).
        return { ...l, _type: c.lead_type === 'unknown' ? 'partner' : c.lead_type, _conf: 'registry' }
      }
      // webkr 제목-파편 의심 이름은 저장 시점부터 '분류 확인'(none) — 재분류에만 있던 강등을 입구에도 동일 적용.
      const conf = l.source === 'webkr' && c.confidence !== 'evidence' && suspectCompanyName(l.company_name, l.source_keyword) ? 'none' : c.confidence
      return { ...l, category: c.category, subcategory: c.subcategory, tier: c.tier, _type: c.lead_type, _conf: conf }
    })
    .filter((l): l is NonNullable<typeof l> => l !== null)
  if (!rows.length) return { inserted: 0, upserted: 0 }
  // 신규 판정용 스냅샷(위 주석) — 청크 루프 **바깥**이라 호출당 1회.
  const before = Number((await DB.prepare('SELECT COUNT(*) AS n FROM ad_company_leads').first<{ n: number }>().catch(() => null))?.n)
  const CHUNK = 50
  let saved = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK)
    const stmts = slice.map(l => {
      const active = opts.requireContact ? (hasContact(l) ? 1 : 0) : 1
      return DB.prepare(
      `INSERT INTO ad_company_leads (company_key, company_name, name_norm, category, subcategory, tier, region, website, email, phone, address, description, business_no, contact_source, source, source_keyword, active, lead_type, classify_confidence, classified_v)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(company_key) DO UPDATE SET
         name_norm = COALESCE(ad_company_leads.name_norm, excluded.name_norm),
         lead_type = COALESCE(ad_company_leads.lead_type, excluded.lead_type),
         classify_confidence = COALESCE(ad_company_leads.classify_confidence, excluded.classify_confidence),
         email = COALESCE(ad_company_leads.email, excluded.email),
         phone = COALESCE(ad_company_leads.phone, excluded.phone),
         website = COALESCE(ad_company_leads.website, excluded.website),
         address = COALESCE(ad_company_leads.address, excluded.address),
         -- 🗺️ region 도 채운다(2026-07-29) — 예전엔 conflict 시 갱신 대상이 아니라, 주소가 나중에
         --   채워져도 **지역은 영영 NULL** 이었다("N/A" 주소 31.7% 를 치유해도 필터가 안 살아나는 원인).
         region = COALESCE(ad_company_leads.region, excluded.region),
         -- 🏷️ subcategory: 비어 있으면 채우고, **원부의 총칭 자리표시자('통신판매')만** 더 구체적인 값으로 승격한다.
         --   왜 이 좁은 규칙인가: 온라인판매 151,277건이 전부 '통신판매' 로 굳어 분류가 없는데(실측 100%),
         --   그냥 excluded 로 덮으면 사람이 큐레이션한 값까지 원부 값이 밀어낸다. 총칭만 올린다.
         subcategory = CASE
           WHEN ad_company_leads.subcategory IS NULL OR ad_company_leads.subcategory = '' THEN excluded.subcategory
           WHEN ad_company_leads.subcategory = '통신판매' AND excluded.subcategory IS NOT NULL AND excluded.subcategory != '통신판매' THEN excluded.subcategory
           ELSE ad_company_leads.subcategory END,
         business_no = COALESCE(ad_company_leads.business_no, excluded.business_no),
         contact_source = COALESCE(ad_company_leads.contact_source, excluded.contact_source),
         active = CASE WHEN COALESCE(ad_company_leads.email, excluded.email) IS NOT NULL
                         OR COALESCE(ad_company_leads.phone, excluded.phone) IS NOT NULL
                       THEN 1 ELSE ad_company_leads.active END`
    ).bind(
      companyKey(l), l.company_name.slice(0, 120), normalizeCompanyName(l.company_name),
      clamp(l.category, 40), clamp(l.subcategory, 40), tierOf(l.tier), clamp(l.region, 60),
      clamp(l.website, 200), clamp(l.email, 120), clamp(l.phone, 40), clamp(l.address, 300),
      clamp(l.description, 800), clamp(l.business_no, 20), clamp(l.contact_source, 20), clamp(l.source, 20) || 'manual', clamp(l.source_keyword, 60), active,
      // 신규 행은 현행 규칙 버전으로 태어남(재검사 불필요). 기존 행(conflict)은 미스탬프 유지 → 소급 정리가 잡음.
      l._type, l._conf, CLASSIFY_RULES_VERSION
    )
    })
    // 🪦 폐업/말소로 확인된 업체는 접촉 풀에서 뺀다(`active=0`). **같은 배치 뒤에** 실행해야 한다 —
    //   위 ON CONFLICT 가 "이메일/전화가 있으면 active=1" 로 되살리기 때문(그 규칙 자체는 옳다,
    //   폐업만 예외다). 삭제가 아니라 플래그라 재개업 시 등록부가 알려주는 대로 되살아난다.
    //   ⚠️ 등록부가 '폐업'이라고 말한 경우에만 온다(`closed` 는 추측으로 세우지 않는다).
    const closedKeys = slice.filter(l => l.closed).map(l => companyKey(l))
    if (closedKeys.length) {
      stmts.push(DB.prepare(`UPDATE ad_company_leads SET active = 0 WHERE company_key IN (${closedKeys.map(() => '?').join(',')})`).bind(...closedKeys))
    }
    const res = await DB.batch(stmts).catch(() => null)
    if (res) saved += slice.length
  }
  const after = Number((await DB.prepare('SELECT COUNT(*) AS n FROM ad_company_leads').first<{ n: number }>().catch(() => null))?.n)
  // 카운트 조회가 실패하면 신규 수를 알 수 없다 — 그때는 **모른다고 0** 을 주는 대신 시도 수로 폴백한다
  //   (0 을 주면 "수집 죽음"으로 오독된다. 여기선 과대 보고가 과소 보고보다 덜 위험하다).
  const inserted = Number.isFinite(before) && Number.isFinite(after) ? Math.max(0, after - before) : saved
  return { inserted, upserted: saved }
}
