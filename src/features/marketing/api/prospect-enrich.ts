/**
 * 📧 매장 후보(store_prospects) 연락처 보강 — **이메일 최우선** (2026-07-23, 대표 "이메일이 가장 중요").
 *   인허가 데이터엔 이메일이 없다(전화 sitetel 만) → 이메일은 **게시된 것만** 아래 경로로 확보(추측·조합 0):
 *     ① website 있음 → 홈페이지 크롤(mailto: 우선 → 본문 문맥선별)
 *     ② website 없음 → 네이버 지역검색으로 **매장 홈페이지 link 발견** → 크롤
 *     ③ 전화 없으면 카카오 로컬로 전화 보강(부가)
 *   각 연락처에 출처(contact_source: homepage/naver/kakao) 기록. 못 찾으면 비워둠(허위 0).
 *
 *   ⚠️ 현실: 식당·미용실·숙박 대다수는 홈페이지/게시 이메일이 없음 → 이메일 수율은 구조적으로 낮음(버그 아님).
 *      이메일이 많은 곳은 온라인 겸업(통신판매)·프랜차이즈·홈페이지 보유 매장 — 그쪽에서 확보된다.
 *   설계 SSOT: docs/design/partner-company-collection.md §12.
 */
import type { Env } from '@/worker/types/env'
import type { FetchBudget } from './influencer-discovery'
import { ensureProspectSchema } from './store-prospects'

export interface ProspectEnrichResult { processed: number; email_found: number; phone_found: number; site_found: number; remaining_no_email: number }

/** 보류 없이 active 매장 후보의 이메일/홈페이지/전화를 예산 내에서 채운다. 신규개업·홈페이지보유 우선. */
export async function enrichProspectContacts(env: Env): Promise<ProspectEnrichResult> {
  const DB = env.DB
  await ensureProspectSchema(DB)
  const { crawlContact, naverLocalLookup, kakaoLocalLookup } = await import('./contact-enrich')
  const nvId = env.NAVER_SEARCH_CLIENT_ID || env.NAVER_CLIENT_ID || ''
  const nvSecret = env.NAVER_SEARCH_CLIENT_SECRET || env.NAVER_CLIENT_SECRET || ''
  const kakaoKey = env.KAKAO_REST_API_KEY || ''
  const budget: FetchBudget = { left: Math.max(15, parseInt(env.ADS_ENRICH_BUDGET || env.ADS_COMPANY_SUBREQUEST_BUDGET || '', 10) || 80) }

  let processed = 0, emailFound = 0, phoneFound = 0, siteFound = 0
  const upd = async (id: number, patch: { email?: string | null; website?: string | null; phone?: string | null; source?: string | null }) => {
    const r = await DB.prepare(
      `UPDATE store_prospects SET
         email = COALESCE(email, ?),
         website = COALESCE(website, ?),
         phone = COALESCE(phone, ?),
         contact_source = COALESCE(?, contact_source),
         last_verified_at = datetime('now')
       WHERE id = ?`
    ).bind(patch.email || null, patch.website || null, patch.phone || null, patch.source || null, id).run().catch(() => null)
    return ((r as { meta?: { changes?: number } } | null)?.meta?.changes ?? 0) > 0
  }
  const addr = (r: { addr_road: string | null; addr_lot: string | null }) => r.addr_road || r.addr_lot || ''

  // ── Pass 1: 홈페이지 보유 + 이메일 없음 → 크롤(가장 저렴·수율 높음) ──
  const withSite = (await DB.prepare(
    "SELECT id, biz_name, region, addr_road, addr_lot, website, phone FROM store_prospects WHERE active = 1 AND website IS NOT NULL AND website != '' AND (email IS NULL OR email = '') ORDER BY is_new_open DESC, id DESC LIMIT 40"
  ).all<{ id: number; biz_name: string; region: string | null; addr_road: string | null; addr_lot: string | null; website: string; phone: string | null }>().catch(() => null))?.results || []
  for (const p of withSite) {
    if (budget.left <= 2) break
    processed++
    const c = await crawlContact(p.website, budget)
    if (c.email || (c.phone && !p.phone)) {
      const ok = await upd(p.id, { email: c.email, phone: p.phone ? null : c.phone, source: c.email ? 'homepage' : null })
      if (ok) { if (c.email) emailFound++; if (c.phone && !p.phone) phoneFound++ }
    }
  }

  // ── Pass 2: 홈페이지 없음 → 네이버 지역검색으로 link 발견 → 크롤. 예산 남을 때만(1건당 비쌈). ──
  if (budget.left > 4 && (nvId && nvSecret)) {
    const noSite = (await DB.prepare(
      "SELECT id, biz_name, region, addr_road, addr_lot, phone FROM store_prospects WHERE active = 1 AND (website IS NULL OR website = '') AND (email IS NULL OR email = '') ORDER BY is_new_open DESC, id DESC LIMIT 25"
    ).all<{ id: number; biz_name: string; region: string | null; addr_road: string | null; addr_lot: string | null; phone: string | null }>().catch(() => null))?.results || []
    for (const p of noSite) {
      if (budget.left <= 4) break
      processed++
      const nv = await naverLocalLookup(nvId, nvSecret, p.biz_name, p.region, addr(p), budget)
      let email: string | null = null
      if (nv.website) { siteFound++; const c = await crawlContact(nv.website, budget); email = c.email }
      // 전화가 없으면 네이버 → 카카오 순으로 보강(부가). 이메일이 주목적.
      let phone: string | null = p.phone ? null : nv.phone
      if (!p.phone && !phone && kakaoKey && budget.left > 1) { const k = await kakaoLocalLookup(kakaoKey, p.biz_name, p.region, addr(p), budget); phone = k.phone }
      if (email || nv.website || phone) {
        const source = email ? 'homepage' : (nv.website ? null : (phone ? (nv.phone ? 'naver' : 'kakao') : null))
        const ok = await upd(p.id, { email, website: nv.website, phone, source })
        if (ok) { if (email) emailFound++; if (phone) phoneFound++ }
      }
    }
  }

  const rem = await DB.prepare("SELECT COUNT(*) AS n FROM store_prospects WHERE active = 1 AND (email IS NULL OR email = '')").first<{ n: number }>().catch(() => null)
  return { processed, email_found: emailFound, phone_found: phoneFound, site_found: siteFound, remaining_no_email: Number(rem?.n) || 0 }
}
