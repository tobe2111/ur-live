/**
 * 📧 매장 후보(store_prospects) 연락처 보강 — **이메일 최우선** (2026-07-23, 대표 "이메일이 가장 중요").
 *   인허가 데이터엔 이메일이 없다(전화 sitetel 만) → 이메일은 **게시된 것만** 아래 경로로 확보(추측·조합 0):
 *     ① website 있음 → 홈페이지 크롤(mailto: 우선 → 본문 문맥선별)
 *     ② website 없음 → 네이버 지역검색으로 **매장 홈페이지 link 발견** → 크롤
 *     ③ 전화 없으면 카카오 로컬로 전화 보강(부가)
 *   각 연락처에 출처(contact_source: homepage/naver/kakao) 기록. 못 찾으면 비워둠(허위 0).
 *
 *   ⚠️ 위 "수율은 구조적으로 낮음(버그 아님)" 은 **한 번도 검증된 적이 없는 주장**이었다 —
 *      이 레인은 **계측이 아예 없었다**(결과를 반환만 하고 아무데도 안 남겼다). 라이브 매장 16,015곳의
 *      이메일이 0인데, 그게 ⓐ 안 도는 건지 ⓑ 한도에 눌리는 건지 ⓒ 진짜로 없는 건지 **알 방법이 없었다.**
 *      2026-07-28 실측에서 이 클래스가 반복 사고였음이 드러나(레인 5개) 여기도 같은 처방을 적용한다:
 *      ① 스냅샷 기록 ② 레인별 학습 상한 ③ 벽시계 마감 ④ D1 도 예산에서 지불.
 *      ⇒ 이제 위 주장은 데이터로 참/거짓이 판정된다.
 *   설계 SSOT: docs/design/partner-company-collection.md §12.
 */
import type { Env } from '@/worker/types/env'
import type { FetchBudget } from './influencer-discovery'
import { ensureProspectSchema } from './store-prospects'
import { subreqCapKey, resolveSubreqBudget, nextSubreqCap, isSubrequestLimitError, platformSubreqCap } from './collect-budget'
import { foldEnrichRollup, PROSPECT_ROLLUP_KEY } from './enrich-telemetry'

export interface ProspectEnrichResult {
  processed: number; email_found: number; phone_found: number; site_found: number; remaining_no_email: number
  /** 계측(2026-07-28 신설) — 이 레인이 왜 0건인지 판정 가능하게. */
  last_run?: string; spent?: number; budget_total?: number; limit_hit?: boolean; deadline_hit?: boolean
  elapsed_ms?: number; crawl_reason?: Record<string, number>; learned_cap?: number
  /** 누적(ads_prospect_enrich_rollup)의 멱등 키 — 다음 라운드가 이 스냅샷을 접는다. */
  run_id?: string
}

const STATS_KEY = 'ads_prospect_enrich_stats'

/** 보류 없이 active 매장 후보의 이메일/홈페이지/전화를 예산 내에서 채운다. 신규개업·홈페이지보유 우선. */
export async function enrichProspectContacts(env: Env): Promise<ProspectEnrichResult> {
  const DB = env.DB
  await ensureProspectSchema(DB)
  const { crawlContact, naverLocalLookup, naverHomepageSearch, kakaoLocalLookup, CRAWL_RULES_VERSION } = await import('./contact-enrich')
  const nvId = env.NAVER_SEARCH_CLIENT_ID || env.NAVER_CLIENT_ID || ''
  const nvSecret = env.NAVER_SEARCH_CLIENT_SECRET || env.NAVER_CLIENT_SECRET || ''
  const kakaoKey = env.KAKAO_REST_API_KEY || ''
  // 🪙 레인별 학습 상한 — 예전엔 회사 풀 예산(ADS_ENRICH_BUDGET, 기본 300)을 그대로 빌려 썼다.
  //   실효 한도는 그 훨씬 아래라 cap1 = left/6 = 50 크롤 × 약 4 fetch = 200 요청을 시도했고,
  //   중간에 죽어도 **아무 기록이 없어** 아무도 몰랐다. 이제 부딪히면 다음 실행부터 낮춘다.
  const envBudget = Math.min(300, Math.max(15, parseInt(env.ADS_ENRICH_BUDGET || env.ADS_COMPANY_SUBREQUEST_BUDGET || '', 10) || 80))
  // 부팅 조회 1회로 3개(학습 상한 + 직전 스냅샷 + 누적) — 회사 보강 레인과 동일 처방(그 파일 주석 참조).
  const boot = (await DB.prepare('SELECT key, value FROM platform_settings WHERE key IN (?, ?, ?)')
    .bind(subreqCapKey('prospect_enrich'), STATS_KEY, PROSPECT_ROLLUP_KEY)
    .all<{ key: string; value: string }>().catch(() => null))?.results || []
  const bootVal = (k: string) => boot.find(r => r.key === k)?.value || null
  const learnedCap = Math.max(0, parseInt(bootVal(subreqCapKey('prospect_enrich')) || '', 10) || 0)
  // 🧱 플랫폼 천장 — 학습 상한이 이 값을 넘지 못한다(기본 60, 근거·조정법은 collect-budget 주석).
  const pcap = platformSubreqCap(env.ADS_SUBREQ_PLATFORM_CAP)
  const budgetTotal = resolveSubreqBudget(envBudget, learnedCap, pcap)
  // ⏱️ 벽시계 마감 — 서브리퀘스트가 남아도 시간이 인보케이션을 끝낸다(보강 레인에서 실측된 실패 모드).
  const deadlineMs = Math.min(120_000, Math.max(5_000, parseInt(env.ADS_ENRICH_DEADLINE_MS || '', 10) || 20_000))
  const t0 = Date.now()
  const budget: FetchBudget = { left: budgetTotal, deadline: t0 + deadlineMs }
  let d1 = 0
  const spendD1 = (n = 1) => { budget.left -= n; d1 += n }
  spendD1() // 위 boot SELECT
  if (await foldEnrichRollup(DB, PROSPECT_ROLLUP_KEY, bootVal(STATS_KEY), bootVal(PROSPECT_ROLLUP_KEY))) spendD1()
  const runId = (globalThis.crypto?.randomUUID?.() || `t${Date.now()}`).slice(0, 8)
  const crawlReason: Record<string, number> = {}
  const outOfTime = () => !!budget.deadline && Date.now() >= budget.deadline

  let processed = 0, emailFound = 0, phoneFound = 0, siteFound = 0
  const upd = async (id: number, patch: { email?: string | null; website?: string | null; phone?: string | null; source?: string | null }) => {
    // 📵 반송 억제 — 반송 확인 이메일 재부착 방지(회사 풀과 동일 루프).
    if (patch.email) {
      spendD1()
      const sup = await DB.prepare('SELECT 1 AS x FROM ad_email_suppress WHERE email = ?').bind(patch.email.toLowerCase()).first<{ x: number }>().catch(() => null)
      if (sup) patch.email = null
    }
    spendD1()
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
  //   ⚠️ 한도로 못 해본 행에는 도장을 찍지 않는다(NPS 레인에서 데이터를 영구 오염시킨 그 패턴).
  const stamp = async (id: number) => {
    spendD1()
    try { await DB.prepare(`UPDATE store_prospects SET enrich_checked_at = datetime('now'), enrich_v = ${CRAWL_RULES_VERSION} WHERE id = ?`).bind(id).run() }
    catch (err) { if (isSubrequestLimitError((err as { message?: string } | null)?.message)) budget.limitHit = true }
  }
  // 쿨다운 + 크롤러 버전 — 크롤 개선 시 이전 실패분 전량 즉시 재시도(회사 풀과 동일 처방).
  const COOL = `AND (enrich_checked_at IS NULL OR enrich_checked_at < datetime('now', '-7 days') OR COALESCE(enrich_v, 0) < ${CRAWL_RULES_VERSION})`

  // ── Pass 1: 홈페이지 보유 + 이메일 없음 → 크롤(가장 저렴·수율 높음) ──
  //   🚰 상한 = 예산 비례(2026-07-27 — 예산 800 인데 40+25 고정이라 매장 10만 순회가 수십 일 걸리던 병목).
  const cap1 = Math.min(120, Math.max(40, Math.floor(budget.left / 6)))
  const withSite = (await DB.prepare(
    `SELECT id, biz_name, region, addr_road, addr_lot, website, phone FROM store_prospects WHERE active = 1 AND website IS NOT NULL AND website != '' AND (email IS NULL OR email = '') ${COOL} ORDER BY is_new_open DESC, id DESC LIMIT ${cap1}`
  ).all<{ id: number; biz_name: string; region: string | null; addr_road: string | null; addr_lot: string | null; website: string; phone: string | null }>().catch(() => null))?.results || []
  spendD1()
  for (const p of withSite) {
    if (budget.left <= 2 || budget.limitHit || outOfTime()) break
    processed++
    const c = await crawlContact(p.website, budget)
    crawlReason[c.reason] = (crawlReason[c.reason] || 0) + 1
    if (c.email || (c.phone && !p.phone)) {
      const ok = await upd(p.id, { email: c.email, phone: p.phone ? null : c.phone, source: c.email ? 'homepage' : null })
      if (ok) { if (c.email) emailFound++; if (c.phone && !p.phone) phoneFound++ }
    }
    await stamp(p.id)
  }

  // ── Pass 2: 홈페이지 없음 → 네이버 지역검색으로 link 발견 → 크롤. 예산 남을 때만(1건당 비쌈). ──
  if (budget.left > 4 && (nvId && nvSecret)) {
    const cap2 = Math.min(60, Math.max(25, Math.floor(budget.left / 12)))
    spendD1()
    const noSite = (await DB.prepare(
      `SELECT id, biz_name, region, addr_road, addr_lot, phone FROM store_prospects WHERE active = 1 AND (website IS NULL OR website = '') AND (email IS NULL OR email = '') ${COOL} ORDER BY is_new_open DESC, id DESC LIMIT ${cap2}`
    ).all<{ id: number; biz_name: string; region: string | null; addr_road: string | null; addr_lot: string | null; phone: string | null }>().catch(() => null))?.results || []
    for (const p of noSite) {
      if (budget.left <= 4 || budget.limitHit || outOfTime()) break
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

  spendD1()
  const rem = await DB.prepare("SELECT COUNT(*) AS n FROM store_prospects WHERE active = 1 AND (email IS NULL OR email = '')").first<{ n: number }>().catch(() => null)
  // 🩹 학습 상한 갱신 — 부딪혔으면 낮추고, 무사히 다 썼으면 조금 올린다(다른 레인과 동일 SSOT).
  const nextCap = nextSubreqCap(budgetTotal - budget.left, !!budget.limitHit, learnedCap, envBudget, pcap)
  if (nextCap != null) {
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind(subreqCapKey('prospect_enrich'), String(nextCap)).run().catch(() => null)
  }
  const out: ProspectEnrichResult = {
    processed, email_found: emailFound, phone_found: phoneFound, site_found: siteFound,
    remaining_no_email: Number(rem?.n) || 0,
    last_run: new Date().toISOString().slice(0, 19).replace('T', ' '),
    spent: budgetTotal - budget.left, budget_total: budgetTotal, limit_hit: !!budget.limitHit,
    deadline_hit: outOfTime(), elapsed_ms: Date.now() - t0, crawl_reason: crawlReason,
    learned_cap: nextCap ?? learnedCap, run_id: runId,
  }
  // 📝 스냅샷 — 이 레인이 왜 0건인지 다음 사람이 **묻지 않고 볼 수 있게**(이 파일 상단 참조).
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(STATS_KEY, JSON.stringify(out)).run().catch(() => null)
  return out
}
