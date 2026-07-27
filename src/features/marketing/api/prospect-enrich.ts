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
  const { crawlContact, naverLocalLookup, naverHomepageSearch, kakaoLocalLookup } = await import('./contact-enrich')
  const nvId = env.NAVER_SEARCH_CLIENT_ID || env.NAVER_CLIENT_ID || ''
  const nvSecret = env.NAVER_SEARCH_CLIENT_SECRET || env.NAVER_CLIENT_SECRET || ''
  const kakaoKey = env.KAKAO_REST_API_KEY || ''
  const budget: FetchBudget = { left: Math.max(15, parseInt(env.ADS_ENRICH_BUDGET || env.ADS_COMPANY_SUBREQUEST_BUDGET || '', 10) || 80) }

  let processed = 0, emailFound = 0, phoneFound = 0, siteFound = 0
  const upd = async (id: number, patch: { email?: string | null; website?: string | null; phone?: string | null; source?: string | null }) => {
    // 📵 반송 억제 — 반송 확인 이메일 재부착 방지(회사 풀과 동일 루프).
    if (patch.email) {
      const sup = await DB.prepare('SELECT 1 AS x FROM ad_email_suppress WHERE email = ?').bind(patch.email.toLowerCase()).first<{ x: number }>().catch(() => null)
      if (sup) patch.email = null
    }
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
  // 시도 스탬프(성공/실패 무관) — 예산이 백로그 전체를 순회하게(회사 풀과 동일 처방, 7일 쿨다운).
  const stamp = async (id: number) => { await DB.prepare("UPDATE store_prospects SET enrich_checked_at = datetime('now') WHERE id = ?").bind(id).run().catch(() => null) }
  const COOL = "AND (enrich_checked_at IS NULL OR enrich_checked_at < datetime('now', '-7 days'))"

  // ── Pass 1: 홈페이지 보유 + 이메일 없음 → 크롤(가장 저렴·수율 높음) ──
  //   🚰 상한 = 예산 비례(2026-07-27 — 예산 800 인데 40+25 고정이라 매장 10만 순회가 수십 일 걸리던 병목).
  const cap1 = Math.min(120, Math.max(40, Math.floor(budget.left / 6)))
  const withSite = (await DB.prepare(
    `SELECT id, biz_name, region, addr_road, addr_lot, website, phone FROM store_prospects WHERE active = 1 AND website IS NOT NULL AND website != '' AND (email IS NULL OR email = '') ${COOL} ORDER BY is_new_open DESC, id DESC LIMIT ${cap1}`
  ).all<{ id: number; biz_name: string; region: string | null; addr_road: string | null; addr_lot: string | null; website: string; phone: string | null }>().catch(() => null))?.results || []
  for (const p of withSite) {
    if (budget.left <= 2) break
    processed++
    const c = await crawlContact(p.website, budget)
    if (c.email || (c.phone && !p.phone)) {
      const ok = await upd(p.id, { email: c.email, phone: p.phone ? null : c.phone, source: c.email ? 'homepage' : null })
      if (ok) { if (c.email) emailFound++; if (c.phone && !p.phone) phoneFound++ }
    }
    await stamp(p.id)
  }

  // ── Pass 2: 홈페이지 없음 → 네이버 지역검색으로 link 발견 → 크롤. 예산 남을 때만(1건당 비쌈). ──
  if (budget.left > 4 && (nvId && nvSecret)) {
    const cap2 = Math.min(60, Math.max(25, Math.floor(budget.left / 12)))
    const noSite = (await DB.prepare(
      `SELECT id, biz_name, region, addr_road, addr_lot, phone FROM store_prospects WHERE active = 1 AND (website IS NULL OR website = '') AND (email IS NULL OR email = '') ${COOL} ORDER BY is_new_open DESC, id DESC LIMIT ${cap2}`
    ).all<{ id: number; biz_name: string; region: string | null; addr_road: string | null; addr_lot: string | null; phone: string | null }>().catch(() => null))?.results || []
    for (const p of noSite) {
      if (budget.left <= 4) break
      processed++
      const nv = await naverLocalLookup(nvId, nvSecret, p.biz_name, p.region, addr(p), budget)
      let site = nv.website // 지역검색 등록 링크(업체가 직접 등록) — 신뢰
      let discovered = false
      if (!site && budget.left > 3) { site = await naverHomepageSearch(nvId, nvSecret, p.biz_name, p.region, budget); discovered = !!site } // 웹문서 검색 발견(제3자 도메인 제외)
      let email: string | null = null
      if (site) { siteFound++; const c = await crawlContact(site, budget, discovered ? p.biz_name : undefined); email = c.email } // 발견 사이트는 상호 존재 가드(오귀속 방지)
      // 전화가 없으면 네이버 → 카카오 순으로 보강(부가). 이메일이 주목적.
      let phone: string | null = p.phone ? null : nv.phone
      if (!p.phone && !phone && kakaoKey && budget.left > 1) { const k = await kakaoLocalLookup(kakaoKey, p.biz_name, p.region, addr(p), budget); phone = k.phone }
      if (email || site || phone) {
        const source = email ? 'homepage' : (site ? null : (phone ? (nv.phone ? 'naver' : 'kakao') : null))
        const ok = await upd(p.id, { email, website: site, phone, source })
        if (ok) { if (email) emailFound++; if (phone) phoneFound++ }
      }
      await stamp(p.id)
    }
  }

  const rem = await DB.prepare("SELECT COUNT(*) AS n FROM store_prospects WHERE active = 1 AND (email IS NULL OR email = '')").first<{ n: number }>().catch(() => null)
  return { processed, email_found: emailFound, phone_found: phoneFound, site_found: siteFound, remaining_no_email: Number(rem?.n) || 0 }
}
