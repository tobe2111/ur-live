/**
 * 🤝 유어애즈 — B2B 파트너(업체) 풀 어드민 (2026-07-21).
 *   격리 테이블 `ad_company_leads` 열람/큐레이션 + 수동입력 + CSV. /api/admin/partner-pool/*.
 *   메인 어드민 JWT(requireAdmin) — /api/admin/ads 와 동일하게 메인 워커가 직접 서빙(프록시 비위임).
 *   1단계(테이블·어드민·수동입력). 수집엔진(레인 A 네이버 지역검색 / B 레지스트리)은 후속 — 여기 없음.
 *   ⚠️ 수집 ≠ 발송 — 공개 비즈니스 연락처만. 자동 발송 경로 부존재(✉는 mailto 초안만).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import { intParam } from '@/shared/pagination'
import {
  ensureCompanySchema, listCompanyLeads, countCompanyLeads, saveCompanyLeads, updateCompanyLead, deleteCompanyLead, deleteCompanyLeads, companyStats,
  reclassifyCompanyLeads,
  parsePartnerPaste, COMPANY_CATEGORIES, COMPANY_STATUSES, COMPANY_CONTACT_CHANNELS, COMPANY_TIER_MIN, COMPANY_TIER_MAX,
  type CompanyLead, type CompanyLeadFilter,
} from './company-discovery'
import { LEAD_TYPES, LEAD_TYPE_LABEL } from './company-classify'
import { listCompanyKeywords, addCompanyKeyword } from './company-collect'

const app = new Hono<{ Bindings: Env }>()
app.use('*', requireAdmin())

// GET /api/admin/partner-pool?category=&subcategory=&region=&tier=&status=&hasContact=1&hasEmail=1&q=&limit=
app.get('/', async (c) => {
  const tierRaw = c.req.query('tier')
  // 페이지네이션: limit/offset + 같은 필터의 총건수(total) → 어드민이 **끝까지** 넘겨볼 수 있게(대표 2026-07-27).
  const limit = Math.min(500, Math.max(1, intParam(c.req.query('limit'), 100)))
  const offset = Math.max(0, intParam(c.req.query('offset'), 0))
  const filter: CompanyLeadFilter = {
    category: c.req.query('category') || undefined,
    subcategory: c.req.query('subcategory') || undefined,
    region: (c.req.query('region') || '').trim() || undefined,
    tier: tierRaw != null && tierRaw !== '' ? intParam(tierRaw, 0) : undefined,
    status: c.req.query('status') || undefined,
    hasContact: c.req.query('hasContact') === '1',
    hasEmail: c.req.query('hasEmail') === '1',
    includeHeld: c.req.query('includeHeld') === '1', // 연락처 없어 보류(active=0)된 리드까지 노출.
    heldOnly: c.req.query('heldOnly') === '1',        // 보류(active=0)만.
    pipeline: c.req.query('pipeline') === '1',        // 통계 '진행 중' 카드와 동일 조건.
    recentDays: c.req.query('recentDays') ? intParam(c.req.query('recentDays'), 0) : undefined,
    leadType: c.req.query('leadType') || undefined,   // partner/store/org/unknown
    q: (c.req.query('q') || '').trim() || undefined,
  }
  const [leads, total] = await Promise.all([
    listCompanyLeads(c.env.DB, { ...filter, limit, offset }),
    countCompanyLeads(c.env.DB, filter),
  ])
  return c.json({ success: true, leads, total, limit, offset })
})

// POST /api/admin/partner-pool/:id/bounce — 📵 반송 마킹: 이메일을 억제 목록에 등록 + 행에서 제거.
//   수동 발송(mailto) 체계라 반송은 대표 메일함에서 사람이 확인 → 이 버튼이 유일한 억제 쓰기 경로.
app.post('/:id/bounce', async (c) => {
  const id = intParam(c.req.param('id'), 0)
  if (!id) return c.json({ success: false, error: 'invalid id' }, 400)
  await ensureCompanySchema(c.env.DB)
  const row = await c.env.DB.prepare('SELECT email, phone FROM ad_company_leads WHERE id = ?').bind(id).first<{ email: string | null; phone: string | null }>().catch(() => null)
  const email = (row?.email || '').trim().toLowerCase()
  if (!email) return c.json({ success: false, error: '이 리드에 이메일이 없습니다' }, 400)
  await c.env.DB.prepare("INSERT OR IGNORE INTO ad_email_suppress (email, reason) VALUES (?, 'bounce')").bind(email).run().catch(() => null)
  await c.env.DB.prepare("UPDATE ad_company_leads SET email = NULL, contact_source = CASE WHEN phone IS NOT NULL AND phone != '' THEN contact_source ELSE NULL END, active = CASE WHEN phone IS NOT NULL AND phone != '' THEN active ELSE 0 END WHERE id = ?").bind(id).run().catch(() => null)
  return c.json({ success: true })
})

// POST /api/admin/partner-pool/reclassify — 기존 리드 소급 재분류(공고/정부페이지 제거 + 업종 근거 재적용).
app.post('/reclassify', async (c) => {
  const r = await reclassifyCompanyLeads(c.env.DB, 500)
  return c.json({ success: true, ...r })
})

// GET /api/admin/partner-pool/meta — UI 셀렉트용 분류/상태/채널/티어 어휘.
app.get('/meta', (c) => c.json({
  success: true,
  categories: COMPANY_CATEGORIES,
  statuses: COMPANY_STATUSES,
  channels: COMPANY_CONTACT_CHANNELS,
  tier: { min: COMPANY_TIER_MIN, max: COMPANY_TIER_MAX },
  leadTypes: LEAD_TYPES.map(k => ({ k, label: LEAD_TYPE_LABEL[k] })),
}))

// GET /api/admin/partner-pool/stats
app.get('/stats', async (c) => {
  const s = await companyStats(c.env.DB)
  // 🤝 레인 A 수집 상태 — 게이트 + 마지막 실행(ads_company_stats). ur-ads 서비스바인딩 존재여부.
  const runRow = await c.env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_company_stats'").first<{ value: string }>().catch(() => null)
  let run: unknown = null; try { run = runRow?.value ? JSON.parse(runRow.value) : null } catch { run = null }
  // 🏪 소스 ① 상가정보 수집 상태(ads_storeinfo_stats) — 게이트 + 마지막 실행.
  const siRow = await c.env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_storeinfo_stats'").first<{ value: string }>().catch(() => null)
  let storeinfoRun: unknown = null; try { storeinfoRun = siRow?.value ? JSON.parse(siRow.value) : null } catch { storeinfoRun = null }
  // 🛒 통신판매 수집 상태(ads_commerce_stats) — 원본 응답 필드 진단(이메일 필드 유무 확인용).
  const cmRow = await c.env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_commerce_stats'").first<{ value: string }>().catch(() => null)
  let commerceRun: Record<string, unknown> | null = null; try { commerceRun = cmRow?.value ? JSON.parse(cmRow.value) : null } catch { commerceRun = null }
  // 원본 첫 항목에서 필드명 목록 + 이메일 형태 값 존재여부를 뽑아 UI 에 노출(추측 대신 실제 확인).
  let commerceProbe: { keys?: string[]; hasEmail?: boolean; emailField?: string } | undefined
  const sample = (commerceRun?.diag as Record<string, unknown> | undefined)?.sample as Record<string, unknown> | undefined
  if (sample && typeof sample === 'object') {
    const keys = Object.keys(sample).slice(0, 40)
    // 이메일 필드 존재 = ① 키 이름이 이메일계열(eml/mail/emladr) 또는 ② 어떤 값이 이메일 형태.
    //   (대표자 이메일 rprsvEmladr 은 선택입력이라 첫 레코드 값이 비어도 필드는 존재 — 키로 판정.)
    const emailField = keys.find(k => /eml|email|mail/i.test(k))
    const hasEmailVal = Object.values(sample).some(v => /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i.test(String(v ?? '')))
    commerceProbe = { keys, hasEmail: !!emailField || hasEmailVal, emailField }
  }
  // 🏢 공정위 가맹(프랜차이즈) 수집 상태(ads_franchise_stats).
  const frRow = await c.env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_franchise_stats'").first<{ value: string }>().catch(() => null)
  let franchiseRun: unknown = null; try { franchiseRun = frRow?.value ? JSON.parse(frRow.value) : null } catch { franchiseRun = null }
  // 🏛️ 국세청 폐업 스윕 상태(ads_ntsstatus_stats) — 활용신청 검증(note 에 오류 노출).
  const ntsRow = await c.env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_ntsstatus_stats'").first<{ value: string }>().catch(() => null)
  let ntsRun: unknown = null; try { ntsRun = ntsRow?.value ? JSON.parse(ntsRow.value) : null } catch { ntsRun = null }
  // 👥 국민연금 규모 검증 상태(ads_nps_stats) — diag.sample 로 실응답 필드 검증(추측 대신 실제 확인).
  const npsRow = await c.env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_nps_stats'").first<{ value: string }>().catch(() => null)
  let npsRun: unknown = null; try { npsRun = npsRow?.value ? JSON.parse(npsRow.value) : null } catch { npsRun = null }
  // 💼 고용24 채용기업 수집 상태(ads_work24_stats) — diag.sample 로 실응답 필드 검증.
  const w24Row = await c.env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_work24_stats'").first<{ value: string }>().catch(() => null)
  let w24Run: unknown = null; try { w24Run = w24Row?.value ? JSON.parse(w24Row.value) : null } catch { w24Run = null }
  // 🧭 소급 정리(재분류) 진행률(ads_reclassify_stats) — 6만 행 청소가 며칠 걸려 가시화 필수.
  const rcRow = await c.env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_reclassify_stats'").first<{ value: string }>().catch(() => null)
  let rcRun: unknown = null; try { rcRun = rcRow?.value ? JSON.parse(rcRow.value) : null } catch { rcRun = null }
  return c.json({
    success: true, ...s,
    collect: { gate: c.env.ADS_COMPANY_COLLECT_ENABLED === 'true', adsBinding: !!c.env.ADS?.fetch, run },
    storeinfo: { gate: c.env.ADS_STOREINFO_ENABLED === 'true', run: storeinfoRun },
    commerce: { gate: (c.env as { ADS_COMMERCE_ENABLED?: string }).ADS_COMMERCE_ENABLED === 'true', run: commerceRun, probe: commerceProbe },
    franchise: { gate: (c.env as { ADS_FRANCHISE_ENABLED?: string }).ADS_FRANCHISE_ENABLED === 'true', run: franchiseRun },
    nts: { run: ntsRun },
    nps: { gate: (c.env as { ADS_NPS_ENABLED?: string }).ADS_NPS_ENABLED === 'true', run: npsRun },
    reclassify: { run: rcRun },
    work24: { gate: (c.env as { ADS_WORK24_ENABLED?: string }).ADS_WORK24_ENABLED === 'true', run: w24Run },
  })
})

// GET /api/admin/partner-pool/contact-list — 📬 오늘의 컨택(이메일 최우선). 업체+매장 후보를
//   [이메일 보유 → 전화만] 순으로 미접촉(new)만 추려 반환 — "누구부터 접촉?"의 원버튼 답.
app.get('/contact-list', async (c) => {
  const limit = Math.min(30, Math.max(3, intParam(c.req.query('limit'), 10)))
  const companies = (await c.env.DB.prepare(
    `SELECT id, company_name, category, subcategory, tier, region, email, phone, website FROM ad_company_leads
     WHERE active = 1 AND status = 'new' AND ((email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != ''))
     ORDER BY (CASE WHEN email IS NOT NULL AND email != '' THEN 0 ELSE 1 END), (tier IS NULL) ASC, tier ASC, id DESC LIMIT ?`
  ).bind(limit).all<Record<string, unknown>>().catch(() => null))?.results || []
  const stores = (await c.env.DB.prepare(
    `SELECT id, biz_name, category, region, email, phone, website, is_new_open FROM store_prospects
     WHERE active = 1 AND status = 'new' AND ((email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != ''))
     ORDER BY (CASE WHEN email IS NOT NULL AND email != '' THEN 0 ELSE 1 END), is_new_open DESC, apv_perm_ymd DESC, id DESC LIMIT ?`
  ).bind(limit).all<Record<string, unknown>>().catch(() => null))?.results || []
  return c.json({ success: true, companies, stores })
})

// POST /api/admin/partner-pool/collect-nara — 📑 나라장터 조달업체(대행사 계열) 수동 수집(ur-ads 위임).
app.post('/collect-nara', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작' }, 503)
  const kick = async () => { try { await ads.fetch(new Request('https://ur-ads/__ads/collect-nara-vendor', { method: 'POST' })) } catch { /* fail-soft */ } }
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(kick()); return c.json({ success: true, started: true }) }
  try { await kick(); return c.json({ success: true, started: false }) }
  catch { return c.json({ success: false, error: 'ur-ads 위임 오류' }, 502) }
})

// POST /api/admin/partner-pool/sweep-mx — 📮 기존 이메일 재검증(죽은 도메인 정리, ur-ads 위임).
app.post('/sweep-mx', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작' }, 503)
  const kick = async () => { try { await ads.fetch(new Request('https://ur-ads/__ads/sweep-mx', { method: 'POST' })) } catch { /* fail-soft */ } }
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(kick()); return c.json({ success: true, started: true }) }
  try { await kick(); return c.json({ success: true, started: false }) }
  catch { return c.json({ success: false, error: 'ur-ads 위임 오류' }, 502) }
})

// POST /api/admin/partner-pool/sweep-nts — 국세청 폐업 스윕 수동 실행(활용신청 검증 겸, ur-ads 위임).
app.post('/sweep-nts', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작' }, 503)
  const kick = async () => { try { await ads.fetch(new Request('https://ur-ads/__ads/sweep-nts', { method: 'POST' })) } catch { /* fail-soft */ } }
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(kick()); return c.json({ success: true, started: true }) }
  try { await kick(); return c.json({ success: true, started: false }) }
  catch { return c.json({ success: false, error: 'ur-ads 위임 오류' }, 502) }
})

// GET /api/admin/partner-pool/keywords — 레인 A 지역검색 키워드 풀(방배/서초/강남 × 업종 시드).
app.get('/keywords', async (c) => c.json({ success: true, keywords: await listCompanyKeywords(c.env.DB) }))

// POST /api/admin/partner-pool/keywords { keyword, category?, subcategory?, region? }
app.post('/keywords', async (c) => {
  const b = await c.req.json().catch(() => ({})) as { keyword?: string; category?: string; subcategory?: string; region?: string; tier?: number }
  const r = await addCompanyKeyword(c.env.DB, b.keyword || '', b.category, b.subcategory, b.region, b.tier)
  return c.json({ success: r.ok, error: r.error }, r.ok ? 200 : 400)
})

// POST /api/admin/partner-pool/collect — 레인 A 수동 수집(ur-ads 워커에 서비스바인딩 위임 → 메인 번들 무영향).
//   백그라운드(waitUntil): 지역검색 순회는 수십 초 → 즉시 started 반환, 완료는 UI 가 stats(run.last_run) 폴링.
app.post('/collect', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작' }, 503)
  const kick = async () => { try { await ads.fetch(new Request('https://ur-ads/__ads/collect-company', { method: 'POST' })) } catch { /* fail-soft */ } }
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(kick()); return c.json({ success: true, started: true }) }
  try { await kick(); return c.json({ success: true, started: false }) }
  catch { return c.json({ success: false, error: 'ur-ads 위임 오류' }, 502) }
})

// POST /api/admin/partner-pool/enrich — 보류(연락처 없음) 리드 이메일 보강(ur-ads 위임). 홈페이지 있는 것만.
app.post('/enrich', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정' }, 503)
  const kick = async () => { try { await ads.fetch(new Request('https://ur-ads/__ads/enrich-company', { method: 'POST' })) } catch { /* fail-soft */ } }
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(kick()); return c.json({ success: true, started: true }) }
  try { await kick(); return c.json({ success: true, started: false }) }
  catch { return c.json({ success: false, error: 'ur-ads 위임 오류' }, 502) }
})

// 소스별 수동 수집 위임(ur-ads). 게이트 무관(수동=의도). storeinfo/commerce/franchise.
function delegateCollect(path: string) {
  return async (c: import('hono').Context<{ Bindings: Env }>) => {
    const ads = c.env.ADS
    if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작' }, 503)
    const kick = async () => { try { await ads.fetch(new Request(`https://ur-ads/__ads/${path}`, { method: 'POST' })) } catch { /* fail-soft */ } }
    if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(kick()); return c.json({ success: true, started: true }) }
    try { await kick(); return c.json({ success: true, started: false }) }
    catch { return c.json({ success: false, error: 'ur-ads 위임 오류' }, 502) }
  }
}
app.post('/collect-storeinfo', delegateCollect('collect-storeinfo')) // 소스① 상가정보
app.post('/collect-commerce', delegateCollect('collect-commerce'))   // 통신판매사업자(전화+이메일)
app.post('/collect-franchise', delegateCollect('collect-franchise')) // 공정위 가맹정보(프랜차이즈 본사)
app.post('/collect-nps', delegateCollect('collect-nps'))             // 👥 국민연금 규모 검증(직원수)
app.post('/collect-work24', delegateCollect('collect-work24'))       // 💼 고용24 채용기업(성장 신호)

// ── 🤝 파트너 매장 소개(리퍼럴) 접수·추적 — 머니 무접촉(지급 배선은 별도 세션, partner-referrals.ts 주석) ──
app.get('/referrals', async (c) => {
  const { listReferrals } = await import('./partner-referrals')
  return c.json({ success: true, referrals: await listReferrals(c.env.DB) })
})
app.post('/referrals', async (c) => {
  const { addReferral } = await import('./partner-referrals')
  const b = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const r = await addReferral(c.env.DB, {
    partner_lead_id: b.partner_lead_id != null ? Number(b.partner_lead_id) : null,
    partner_name: String(b.partner_name || ''), store_name: String(b.store_name || ''),
    region: b.region != null ? String(b.region) : null, phone: b.phone != null ? String(b.phone) : null,
    memo: b.memo != null ? String(b.memo) : null,
  })
  return c.json({ success: r.ok, error: r.error }, r.ok ? 200 : 400)
})
app.patch('/referrals/:id', async (c) => {
  const { updateReferralStatus, updateReferralReward } = await import('./partner-referrals')
  const id = intParam(c.req.param('id'), 0)
  if (!id) return c.json({ success: false, error: 'invalid id' }, 400)
  const b = await c.req.json().catch(() => ({})) as { status?: string; reward_amount?: number | null; reward_memo?: string | null; mark_paid?: boolean }
  if (b.status !== undefined) {
    const r = await updateReferralStatus(c.env.DB, id, String(b.status || ''))
    if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  }
  if (b.reward_amount !== undefined || b.reward_memo !== undefined || b.mark_paid) {
    const r = await updateReferralReward(c.env.DB, id, { amount: b.reward_amount, memo: b.reward_memo, markPaid: !!b.mark_paid })
    if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  }
  return c.json({ success: true })
})

// POST /api/admin/partner-pool/enrich-burst — 🚀 이메일 보강 풀가동(대표 "하루 1만콜 다 쓰기").
//   워커 1회 실행은 시간·서브요청 한도가 있어 한 번에 못 태움 → influencer collect-burst 와 동일 패턴:
//   ur-ads 를 **연달아 호출**(호출마다 fresh 인보케이션 = fresh 예산). 시간캡/무진전/백로그 소진 가드.
//   클릭 1회로 못 태운 잔여는 매시간 cron 이 이어받음(ADS_ENRICH_BUDGET × 24 가 일일 총량의 본체).
app.post('/enrich-burst', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작' }, 503)
  // 이중 실행 잠금(4분 하트비트) — 병렬 버스트는 같은 타깃(email IS NULL 상위 200)을 중복 크롤 → 쿼터 낭비.
  const lockRow = await c.env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_enrich_burst_lock'").first<{ value: string }>().catch(() => null)
  try {
    const lock = lockRow?.value ? JSON.parse(lockRow.value) as { at?: string } : null
    if (lock?.at && Date.now() - Date.parse(lock.at) < 240_000) return c.json({ success: false, error: '보강 풀가동이 이미 진행 중입니다 — 잠시 후 상태줄 확인' }, 409)
  } catch { /* 손상 잠금은 무시 */ }
  const heartbeat = () => c.env.DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind('ads_enrich_burst_lock', JSON.stringify({ at: new Date().toISOString() })).run().catch(() => null)
  const burn = async () => {
    const startedAt = Date.now()
    let rounds = 0, lastEnriched = 0, reason = 'loop_cap'
    for (let i = 0; i < 12; i++) {
      if (Date.now() - startedAt > 220_000) { reason = 'time_cap'; break } // 잔여는 cron/재클릭이 이어받음
      await heartbeat()
      type BurstResp = { ok?: boolean; stats?: { processed?: number; enriched?: number; remaining?: number } } | null
      let body: BurstResp = null
      try {
        const r = await ads.fetch(new Request('https://ur-ads/__ads/enrich-company', { method: 'POST' }))
        body = (await r.json().catch(() => null)) as BurstResp
      } catch { reason = 'fetch_error'; break }
      if (!body?.ok || !body.stats) { reason = 'bad_response'; break }
      rounds++
      lastEnriched = body.stats.enriched ?? 0
      if ((body.stats.processed ?? 0) === 0) { reason = 'backlog_done'; break } // 보강 대상 소진
    }
    await c.env.DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind('ads_enrich_burst_last', JSON.stringify({ at: new Date().toISOString(), rounds, lastEnriched, reason })).run().catch(() => null)
    await c.env.DB.prepare("DELETE FROM platform_settings WHERE key = 'ads_enrich_burst_lock'").run().catch(() => null)
  }
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(burn()); return c.json({ success: true, started: true }) }
  await burn().catch(() => null)
  return c.json({ success: true, started: false })
})

// POST /api/admin/partner-pool — 수동 업체 추가(대표 방배 리드 손입력). 멱등 저장(website/회사명|지역 키).
app.post('/', async (c) => {
  const b = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const company_name = String(b.company_name || '').trim()
  if (company_name.length < 2) return c.json({ success: false, error: '회사명을 입력하세요' }, 400)
  const lead: CompanyLead = {
    company_name,
    category: b.category ? String(b.category) : null,
    subcategory: b.subcategory ? String(b.subcategory) : null,
    tier: b.tier != null && b.tier !== '' ? Number(b.tier) : null,
    region: b.region ? String(b.region) : null,
    website: b.website ? String(b.website) : null,
    email: b.email ? String(b.email) : null,
    phone: b.phone ? String(b.phone) : null,
    address: b.address ? String(b.address) : null,
    description: b.description ? String(b.description) : null,
    source: 'manual',
    source_keyword: b.source_keyword ? String(b.source_keyword) : 'manual',
  }
  const saved = await saveCompanyLeads(c.env.DB, [lead]).catch(() => 0)
  return c.json({ success: saved > 0, saved })
})

// POST /api/admin/partner-pool/import { text } — 레인 B(공정위 정보공개서)·C(상인회 명부) 붙여넣기 일괄 추가.
//   헤더(회사명 포함) 있는 CSV/TSV 자동 파싱 → 멱등 저장(company_key). 즉시 동작(API 키 대기 없음).
app.post('/import', async (c) => {
  const b = await c.req.json().catch(() => ({})) as { text?: string }
  const leads = parsePartnerPaste(String(b.text || ''))
  if (!leads.length) return c.json({ success: false, error: '헤더(회사명 포함)가 있는 표(CSV/TSV)를 붙여넣어 주세요', parsed: 0, saved: 0 }, 400)
  const saved = await saveCompanyLeads(c.env.DB, leads).catch(() => 0)
  return c.json({ success: true, parsed: leads.length, saved })
})

// PATCH /api/admin/partner-pool/:id { status?, memo?, tier?, follow_up_at?, contact_channel? }
app.patch('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'INVALID_ID' }, 400)
  const b = await c.req.json().catch(() => ({})) as {
    status?: string; memo?: string; tier?: number | null; follow_up_at?: string | null; contact_channel?: string | null
  }
  const r = await updateCompanyLead(c.env.DB, id, b)
  return c.json({ success: r.ok, error: r.error }, r.ok ? 200 : 400)
})

// DELETE /api/admin/partner-pool/:id
app.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'INVALID_ID' }, 400)
  const r = await deleteCompanyLead(c.env.DB, id)
  return c.json({ success: r.ok, error: r.error }, r.ok ? 200 : 400)
})

// POST /api/admin/partner-pool/delete-bulk { ids: number[] } — 체크박스 선택 삭제(최대 500).
app.post('/delete-bulk', async (c) => {
  const b = await c.req.json().catch(() => ({})) as { ids?: unknown }
  const ids = Array.isArray(b.ids) ? b.ids.map(n => Number(n)) : []
  if (!ids.length) return c.json({ success: false, error: '선택된 항목이 없습니다' }, 400)
  const deleted = await deleteCompanyLeads(c.env.DB, ids)
  return c.json({ success: true, deleted })
})

// GET /api/admin/partner-pool/export?format=csv — 엑셀 호환(수식 인젝션 방어). 대표 동선표용.
app.get('/export', async (c) => {
  await ensureCompanySchema(c.env.DB)
  const rows = await listCompanyLeads(c.env.DB, { limit: 5000, includeHeld: true }) // 전체(보류 포함) — 엑셀 원본용
  const esc = (v: unknown): string => {
    let s = v == null ? '' : String(v)
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
    return s
  }
  const header = ['tier', 'category', 'subcategory', 'company_name', 'region', 'phone', 'email', 'website', 'address', 'status', 'contact_channel', 'follow_up_at', 'memo', 'source', 'source_keyword', 'collected_at']
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push([r.tier ?? '', r.category, r.subcategory, r.company_name, r.region, r.phone, r.email, r.website, r.address, r.status, r.contact_channel, r.follow_up_at, r.memo, r.source, r.source_keyword, (r.collected_at || '').slice(0, 10)].map(esc).join(','))
  }
  return new Response('﻿' + lines.join('\n'), {
    headers: { 'Content-Type': 'text/csv;charset=utf-8', 'Content-Disposition': 'attachment; filename="partner-leads.csv"' },
  })
})

export { app as partnerPoolRoutes }
