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
import { csvResponse, parseCompanyExportFilter } from './pool-export'
import { intParam } from '@/shared/pagination'
import {
  ensureCompanySchema, listCompanyLeads, countCompanyLeads, saveCompanyLeads, updateCompanyLead, deleteCompanyLead, deleteCompanyLeads, companyStats,
  reclassifyCompanyLeads,
  parsePartnerPaste, COMPANY_CATEGORIES, COMPANY_STATUSES, COMPANY_CONTACT_CHANNELS, COMPANY_TIER_MIN, COMPANY_TIER_MAX,
  type CompanyLead, type CompanyLeadFilter,
} from './company-discovery'
import { getCompanyStatsCached, invalidateStatsOnWrite } from './company-stats-cache'
import { LEAD_TYPES, LEAD_TYPE_LABEL } from './company-classify'
import tradeRoutes from './partner-pool-trades.routes'
import { partnerPoolDedupeRoutes } from './partner-pool-dedupe.routes'
import { partnerPoolKeywordRoutes } from './partner-pool-keywords.routes'
import { judgeLanes } from './lane-yield-health'
import { adsLeadsDb } from '../../../shared/ads/leads-db'

const app = new Hono<{ Bindings: Env }>()

app.use('*', requireAdmin())
// 🧹 데이터를 바꿨으면 통계 캐시를 버린다(근거·이유는 `company-stats-cache.ts`).
app.use('*', invalidateStatsOnWrite(adsLeadsDb as never) as never)
// 🧬 중복 병합 라우트(별도 모듈 — 600줄 래칫 우회 대신 추출).
//   ⚠️ **반드시 requireAdmin() 뒤에 마운트**한다 — 앞에 두면 이 라우트만 인증을 안 거친다(라이브 데이터 수정 경로).
app.route('/', partnerPoolDedupeRoutes)
// 🔑 수집 키워드 라우트(같은 이유로 추출 — 부모가 600 캡 코앞). 인증 뒤 마운트는 위 경고와 동일하게 필수.
app.route('/', partnerPoolKeywordRoutes)

/* 🔔 작업 완료 알림벨 공용(2026-07-27) — 백그라운드(waitUntil) 작업은 페이지를 떠나도 계속되지만
 *   완료 토스트는 페이지와 함께 사라진다 → 결과를 알림벨에 남겨 어디서든/나중에 확인 가능하게. */
const JOB_NUM_LABEL: Record<string, string> = {
  found: '발견', saved: '저장', matched: '적합', enriched: '연락처 확보', processed: '처리', emailed: '이메일',
  checked: '검증', cleared: '정리', crawls: '크롤', removed: '제거', updated: '갱신', scanned: '검사',
}
async function notifyJobDone(DB: D1Database, label: string, stats: Record<string, unknown> | null): Promise<void> {
  try {
    const nums = stats ? Object.entries(stats).filter(([k, v]) => typeof v === 'number' && JOB_NUM_LABEL[k])
      .map(([k, v]) => `${JOB_NUM_LABEL[k]} ${(v as number).toLocaleString()}`).join(' · ') : ''
    const err = (stats?.diag as { error?: string } | undefined)?.error
    const { createDashboardNotification } = await import('../../notifications/api/dashboard-notifications.routes')
    await createDashboardNotification(DB, 'admin', null, 'partner_pool_job', `${label} 완료`,
      err ? `⚠️ ${err}` : (nums || '결과 없음'), '/admin/partner-pool')
  } catch { /* 알림 실패가 작업 자체를 막지 않음 */ }
}

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
    listCompanyLeads(adsLeadsDb(c.env), { ...filter, limit, offset }),
    countCompanyLeads(adsLeadsDb(c.env), filter),
  ])
  return c.json({ success: true, leads, total, limit, offset })
})

// POST /api/admin/partner-pool/:id/bounce — 📵 반송 마킹: 이메일을 억제 목록에 등록 + 행에서 제거.
//   수동 발송(mailto) 체계라 반송은 대표 메일함에서 사람이 확인 → 이 버튼이 유일한 억제 쓰기 경로.
app.post('/:id/bounce', async (c) => {
  const id = intParam(c.req.param('id'), 0)
  if (!id) return c.json({ success: false, error: 'invalid id' }, 400)
  await ensureCompanySchema(adsLeadsDb(c.env))
  // merged-filter-ok — id 지정 단건 조회(어드민이 명시한 행).
  const row = await adsLeadsDb(c.env).prepare('SELECT email, phone FROM ad_company_leads WHERE id = ?').bind(id).first<{ email: string | null; phone: string | null }>().catch(() => null)
  const email = (row?.email || '').trim().toLowerCase()
  if (!email) return c.json({ success: false, error: '이 리드에 이메일이 없습니다' }, 400)
  await adsLeadsDb(c.env).prepare("INSERT OR IGNORE INTO ad_email_suppress (email, reason) VALUES (?, 'bounce')").bind(email).run().catch(() => null)
  await adsLeadsDb(c.env).prepare("UPDATE ad_company_leads SET email = NULL, contact_source = CASE WHEN phone IS NOT NULL AND phone != '' THEN contact_source ELSE NULL END, active = CASE WHEN phone IS NOT NULL AND phone != '' THEN active ELSE 0 END WHERE id = ?").bind(id).run().catch(() => null)
  return c.json({ success: true })
})

// POST /api/admin/partner-pool/reclassify — 기존 리드 소급 재분류 **풀가동**(2026-07-27 대표
//   "이런 것들 어떻게 정리할거냐" — 시간당 500행이면 전량 8일. DB-only 라 한 요청 안에서 루프 가능:
//   응답은 즉시 반환하고 waitUntil 로 최대 25패스×1000행(≈2.5만 행/클릭)을 소진. 남으면 재클릭/시간당
//   cron 이 이어받음. 이중 실행 잠금(4분 하트비트). 진행률은 상태줄(ads_reclassify_stats)이 매 패스 갱신.
app.post('/reclassify', async (c) => {
  const lockRow = await adsLeadsDb(c.env).prepare("SELECT value FROM platform_settings WHERE key = 'ads_reclassify_burst_lock'").first<{ value: string }>().catch(() => null)
  try {
    const lock = lockRow?.value ? JSON.parse(lockRow.value) as { at?: string } : null
    if (lock?.at && Date.now() - Date.parse(lock.at) < 240_000) return c.json({ success: false, error: '분류 정리가 이미 진행 중입니다 — 상태줄 확인' }, 409)
  } catch { /* 손상 잠금은 무시 */ }
  const heartbeat = () => adsLeadsDb(c.env).prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind('ads_reclassify_burst_lock', JSON.stringify({ at: new Date().toISOString() })).run().catch(() => null)
  const burn = async () => {
    const startedAt = Date.now()
    let passes = 0, scanned = 0, updated = 0, removed = 0, done = false
    for (let i = 0; i < 25; i++) {
      if (Date.now() - startedAt > 200_000) break // 잔여는 cron/재클릭이 이어받음
      await heartbeat()
      const r = await reclassifyCompanyLeads(adsLeadsDb(c.env), 1000, i === 0).catch(() => null) // 억제 스윕은 첫 패스만(처리량 3×)
      if (!r) break
      passes++; scanned += r.scanned; updated += r.updated; removed += r.removed
      if (r.done) { done = true; break } // 재검사 대상 소진(전량 현행 규칙 통과)
    }
    await adsLeadsDb(c.env).prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind('ads_reclassify_burst_last', JSON.stringify({ at: new Date().toISOString(), passes, scanned, updated, removed, done })).run().catch(() => null)
    await adsLeadsDb(c.env).prepare("DELETE FROM platform_settings WHERE key = 'ads_reclassify_burst_lock'").run().catch(() => null)
    // 🔔 완료 알림벨(결과 포함) — 페이지를 닫아도 결과가 남는다(대표 "완료되었다고 알람 + 결과값").
    try {
      const remRow = await adsLeadsDb(c.env).prepare("SELECT value FROM platform_settings WHERE key = 'ads_reclassify_stats'").first<{ value: string }>()
      let rem = -1; try { rem = Number((remRow?.value ? JSON.parse(remRow.value) : {}).remaining_unclassified ?? -1) } catch { /* 표시 생략 */ }
      const { createDashboardNotification } = await import('../../notifications/api/dashboard-notifications.routes')
      await createDashboardNotification(adsLeadsDb(c.env), 'admin', null, 'partner_pool_job', '🧭 분류 정리 풀가동 완료',
        `검사 ${scanned.toLocaleString()} · 갱신 ${updated.toLocaleString()} · 제거 ${removed.toLocaleString()}${done ? ' · 재검사 전량 소진 ✅' : rem >= 0 ? ` · 잔여 ${rem.toLocaleString()}건(재클릭 또는 시간당 자동)` : ''}`,
        '/admin/partner-pool')
    } catch { /* 알림 실패가 정리 자체를 막지 않음 */ }
  }
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(burn()); return c.json({ success: true, started: true }) }
  await burn().catch(() => null)
  return c.json({ success: true, started: false })
})

// POST /api/admin/partner-pool/run-all — 🚀 **원클릭 전체 실행** (2026-07-27 대표 "버튼이 너무 많달까?
//   원클릭으로 모든 게 다 되게"). 수집 전 레인(병렬, 각자 ur-ads fresh 인보케이션) → 보강 버스트 +
//   정리 버스트(병렬 — 보강=외부크롤, 정리=DB-only 라 서로 무간섭) 순서로 한 사이클을 알아서 돌리고,
//   끝나면 **통합 결과 1개**를 알림벨+완료 토스트로. 개별 버튼은 특정 레인 재실행용으로 존치.
//   기존 버스트 잠금(enrich/reclassify)을 공유해 개별 버튼과의 동시 실행도 안전.
app.post('/run-all', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작' }, 503)
  const DB = adsLeadsDb(c.env)
  const getLock = async (k: string) => {
    const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(k).first<{ value: string }>().catch(() => null)
    try { const l = row?.value ? JSON.parse(row.value) as { at?: string } : null; return !!(l?.at && Date.now() - Date.parse(l.at) < 240_000) } catch { return false }
  }
  if (await getLock('ads_runall_lock')) return c.json({ success: false, error: '원클릭 전체 실행이 이미 진행 중입니다 — 완료되면 알림벨에 결과가 남습니다' }, 409)
  const beat = (k: string) => DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(k, JSON.stringify({ at: new Date().toISOString() })).run().catch(() => null)
  const unlock = (k: string) => DB.prepare('DELETE FROM platform_settings WHERE key = ?').bind(k).run().catch(() => null)
  const burn = async () => {
    const deadline = Date.now() + 230_000
    await beat('ads_runall_lock')
    const num = (o: unknown, k: string): number => { const v = (o as Record<string, unknown> | null)?.[k]; return typeof v === 'number' ? v : 0 }
    const call = async (path: string): Promise<unknown> => {
      try {
        const r = await ads.fetch(new Request(`https://ur-ads/__ads/${path}`, { method: 'POST', signal: AbortSignal.timeout(90_000) }))
        const j = await r.json().catch(() => null) as { stats?: unknown } | null
        return j?.stats ?? j
      } catch { return null }
    }
    // ① 수집 전 레인 병렬(각 호출 = ur-ads 의 독립 인보케이션 = 독립 예산 — 서로 안 갉아먹음).
    // ⚠️ 2026-07-28 실측 수리: **매장 후보(인허가) 수집·보강이 목록에서 빠져** 있어 전체 실행을 눌러도
    //   store_prospects 가 0건 → 소비자 공개면(/new-openings·/area-report)과 개업 웰컴 큐가 영구 빈 상태였음.
    const COLLECTORS = ['collect-company', 'collect-storeinfo', 'collect-commerce', 'collect-franchise', 'collect-market', 'collect-nara-contract', 'collect-nps', 'sweep-nts', 'sweep-mx', 'collect-localdata', 'enrich-prospects']
    const collected = await Promise.all(COLLECTORS.map(p => call(p)))
    const collectSaved = collected.reduce((s: number, r) => s + num(r, 'saved'), 0)
    const collectFound = collected.reduce((s: number, r) => s + num(r, 'found'), 0)
    await beat('ads_runall_lock')
    // ② 보강 버스트 ∥ 정리 버스트 — 각자 기존 잠금 키를 잡아 개별 버튼과 이중 실행 방지.
    let enriched = 0, scanned = 0, removed = 0
    const enrichLoop = (async () => {
      if (await getLock('ads_enrich_burst_lock')) return // 개별 보강 풀가동이 이미 도는 중 — 양보
      for (let i = 0; i < 12 && Date.now() < deadline; i++) {
        await beat('ads_enrich_burst_lock')
        const r = await call('enrich-company')
        enriched += num(r, 'enriched')
        if (num(r, 'processed') === 0) break
      }
      await unlock('ads_enrich_burst_lock')
    })()
    const reclassifyLoop = (async () => {
      if (await getLock('ads_reclassify_burst_lock')) return
      for (let i = 0; i < 30 && Date.now() < deadline; i++) {
        await beat('ads_reclassify_burst_lock')
        const r = await call(i === 0 ? 'reclassify-company' : 'reclassify-company?light=1')
        scanned += num(r, 'scanned'); removed += num(r, 'removed')
        if ((r as { done?: boolean } | null)?.done) break
      }
      await unlock('ads_reclassify_burst_lock')
    })()
    await Promise.all([enrichLoop.catch(() => null), reclassifyLoop.catch(() => null)])
    const summary = `수집 발견 ${collectFound.toLocaleString()} · 저장 ${collectSaved.toLocaleString()} · 연락처 확보 ${enriched.toLocaleString()} · 정리 검사 ${scanned.toLocaleString()} · 제거 ${removed.toLocaleString()}`
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind('ads_runall_last', JSON.stringify({ at: new Date().toISOString(), found: collectFound, saved: collectSaved, enriched, scanned, removed })).run().catch(() => null)
    await unlock('ads_runall_lock')
    try {
      const { createDashboardNotification } = await import('../../notifications/api/dashboard-notifications.routes')
      await createDashboardNotification(DB, 'admin', null, 'partner_pool_job', '🚀 원클릭 전체 실행 완료', summary, '/admin/partner-pool')
    } catch { /* 알림 실패가 실행 자체를 막지 않음 */ }
  }
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(burn()); return c.json({ success: true, started: true }) }
  await burn().catch(() => null)
  return c.json({ success: true, started: false })
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

// 📅 GET /api/admin/partner-pool/timeline?days=30 — 업체 풀의 일자별 수집(KST). 인플루언서와 같은 SSOT.
//   ⚠️ 이 테이블의 시각 컬럼은 `created_at` 이다(인플루언서는 `collected_at`) — pool-timeline.ts 표 참조.
app.get('/timeline', async (c) => {
  const { getPoolTimeline, resolveDays } = await import('./pool-timeline')
  return c.json({ success: true, timeline: await getPoolTimeline(adsLeadsDb(c.env), 'company', resolveDays(c.req.query('days'))) })
})

// GET /api/admin/partner-pool/stats
app.get('/stats', async (c) => {
  // 🧮 집계만 TTL 캐시(331만 행/호출 × 5초 폴링 36회 = 버튼 한 번 1.19억 행). 레인 상태는 매번 신선 — 폴러가 보는 건 그쪽이다.
  const statsDb = adsLeadsDb(c.env)
  const { stats: s, at: statsAt } = await getCompanyStatsCached(statsDb, c.req.query('fresh') === '1', () => companyStats(statsDb))
  // 🤝 레인 A 수집 상태 — 게이트 + 마지막 실행(ads_company_stats). ur-ads 서비스바인딩 존재여부.
  const runRow = await adsLeadsDb(c.env).prepare("SELECT value FROM platform_settings WHERE key = 'ads_company_stats'").first<{ value: string }>().catch(() => null)
  let run: unknown = null; try { run = runRow?.value ? JSON.parse(runRow.value) : null } catch { run = null }
  // 🏪 소스 ① 상가정보 수집 상태(ads_storeinfo_stats) — 게이트 + 마지막 실행.
  const siRow = await adsLeadsDb(c.env).prepare("SELECT value FROM platform_settings WHERE key = 'ads_storeinfo_stats'").first<{ value: string }>().catch(() => null)
  let storeinfoRun: unknown = null; try { storeinfoRun = siRow?.value ? JSON.parse(siRow.value) : null } catch { storeinfoRun = null }
  // 🛒 통신판매 수집 상태(ads_commerce_stats) — 원본 응답 필드 진단(이메일 필드 유무 확인용).
  const cmRow = await adsLeadsDb(c.env).prepare("SELECT value FROM platform_settings WHERE key = 'ads_commerce_stats'").first<{ value: string }>().catch(() => null)
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
  const frRow = await adsLeadsDb(c.env).prepare("SELECT value FROM platform_settings WHERE key = 'ads_franchise_stats'").first<{ value: string }>().catch(() => null)
  let franchiseRun: unknown = null; try { franchiseRun = frRow?.value ? JSON.parse(frRow.value) : null } catch { franchiseRun = null }
  // 🏛️ 국세청 폐업 스윕 상태(ads_ntsstatus_stats) — 활용신청 검증(note 에 오류 노출).
  const ntsRow = await adsLeadsDb(c.env).prepare("SELECT value FROM platform_settings WHERE key = 'ads_ntsstatus_stats'").first<{ value: string }>().catch(() => null)
  let ntsRun: unknown = null; try { ntsRun = ntsRow?.value ? JSON.parse(ntsRow.value) : null } catch { ntsRun = null }
  // 👥 국민연금 규모 검증 상태(ads_nps_stats) — diag.sample 로 실응답 필드 검증(추측 대신 실제 확인).
  const npsRow = await adsLeadsDb(c.env).prepare("SELECT value FROM platform_settings WHERE key = 'ads_nps_stats'").first<{ value: string }>().catch(() => null)
  let npsRun: unknown = null; try { npsRun = npsRow?.value ? JSON.parse(npsRow.value) : null } catch { npsRun = null }
  // 🧭 소급 정리(재분류) 진행률(ads_reclassify_stats) — 6만 행 청소가 며칠 걸려 가시화 필수.
  const rcRow = await adsLeadsDb(c.env).prepare("SELECT value FROM platform_settings WHERE key = 'ads_reclassify_stats'").first<{ value: string }>().catch(() => null)
  let rcRun: unknown = null; try { rcRun = rcRow?.value ? JSON.parse(rcRow.value) : null } catch { rcRun = null }
  // 🔔 버튼 완료 감지용(2026-07-27 대표 "된 건지 안 된 건지 알 수가 없어") — 나라장터/MX/보강/버스트 결과 스탬프.
  const readKey = async (k: string): Promise<unknown> => {
    const row = await adsLeadsDb(c.env).prepare('SELECT value FROM platform_settings WHERE key = ?').bind(k).first<{ value: string }>().catch(() => null)
    try { return row?.value ? JSON.parse(row.value) : null } catch { return null }
  }
  const [naraRun, mxRun, enrichLast, enrichBurst, reclassifyBurst, runAll, registryMatch, lkAll, lkEnrich, lkReclassify, localdataRun, enrichRollup, kakaoSweep] = await Promise.all([
    readKey('ads_naracontract_stats'), readKey('ads_mxsweep_stats'), readKey('ads_enrich_last'), readKey('ads_enrich_burst_last'), readKey('ads_reclassify_burst_last'), readKey('ads_runall_last'), readKey('ads_registry_match_stats'),
    readKey('ads_runall_lock'), readKey('ads_enrich_burst_lock'), readKey('ads_reclassify_burst_lock'), readKey('ads_localdata_stats'),
    // 🧮 누적(2026-07-29) — 스냅샷은 라운드마다 덮이므로 "모든 라운드가 죽는다"와 "마지막만 잘렸다"를
    //   한 장으로는 **구분할 수 없었다**. 하루치 rounds/partial/phase 분포를 함께 보여 판정 가능하게.
    readKey('ads_enrich_rollup'),
    // 📞 카카오 전화 스윕(2026-07-29) — 145k 무연락처 리드의 **주 전화 확보 레인인데 화면에 없었다**.
    //   `day_lookups` 는 self-chain 깊이를 올리기 전에 카카오 쿼터 소비를 실측하기 위한 값.
    readKey('ads_kakao_sweep_stats'),
  ])
  // ⏳ 백그라운드 실행 중 표시(2026-07-27 대표 "다른 페이지로 이동하면?") — 페이지를 떠났다 돌아와도
  //   무엇이 돌고 있는지 보이게. 하트비트 4분 이내면 살아있는 작업(잠금 키와 동일 기준).
  const fresh = (v: unknown): boolean => { const at = (v as { at?: string } | null)?.at; return !!at && Date.now() - Date.parse(at) < 240_000 }
  const running = { runAll: fresh(lkAll), enrich: fresh(lkEnrich), reclassify: fresh(lkReclassify) }
  // 🚦 게이트는 **ur-ads 워커 env** 가 진실(cron 이 거기서 돔) — 메인 env 를 읽어 표시하면 실제와 어긋난다
  //   (2026-07-28 실측: 어드민 전부 OFF 표시). health 로 실값을 물어보고, 실패 시 메인 env 로 폴백.
  let g: Record<string, boolean> | null = null
  if (c.env.ADS?.fetch) {
    try {
      const hr = await c.env.ADS.fetch(new Request('https://ur-ads/__ads/health'))
      g = ((await hr.json().catch(() => null)) as { gates?: Record<string, boolean> } | null)?.gates ?? null
    } catch { g = null }
  }
  const gate = (k: string, fallback: boolean): boolean => (g && typeof g[k] === 'boolean') ? g[k] : fallback
  return c.json({
    success: true, ...s, stats_at: statsAt, // 이 숫자가 언제 기준인지 — 캐시된 값을 최신으로 오해하지 않게
    collect: { gate: gate('company_collect', c.env.ADS_COMPANY_COLLECT_ENABLED === 'true'), adsBinding: !!c.env.ADS?.fetch, run },
    storeinfo: { gate: gate('storeinfo', c.env.ADS_STOREINFO_ENABLED === 'true'), run: storeinfoRun },
    commerce: { gate: gate('commerce', (c.env as { ADS_COMMERCE_ENABLED?: string }).ADS_COMMERCE_ENABLED === 'true'), run: commerceRun, probe: commerceProbe },
    franchise: { gate: gate('franchise', (c.env as { ADS_FRANCHISE_ENABLED?: string }).ADS_FRANCHISE_ENABLED === 'true'), run: franchiseRun },
    nts: { run: ntsRun },
    nps: { gate: gate('nps', (c.env as { ADS_NPS_ENABLED?: string }).ADS_NPS_ENABLED === 'true'), run: npsRun },
    reclassify: { run: rcRun },
    registryMatch,   // 🔗 원부 이메일 이식 결과(크롤 0회 레인)
    nara: { run: naraRun },
    mx: { run: mxRun },
    enrichLast, enrichRollup, enrichBurst, reclassifyBurst, runAll, running, kakaoSweep,
    // 🏪 매장 후보(인허가) — 소비자 공개면/개업 웰컴의 데이터원. 상태줄에 없어 0건인 걸 아무도 몰랐음(2026-07-28).
    localdata: { gate: gate('localdata', false), run: localdataRun },
    // 🩺 수확 0 이 지속되는 레인(매장 화면과 같은 판정기) — 규칙·근거는 `lane-yield-health.ts` 헤더.
    laneHealth: judgeLanes([
      { lane: 'collect-company', stat: run as never }, { lane: 'collect-storeinfo', stat: storeinfoRun as never },
      { lane: 'collect-commerce', stat: commerceRun as never }, { lane: 'collect-franchise', stat: franchiseRun as never },
      { lane: 'collect-nara-contract', stat: naraRun as never },
      { lane: 'collect-nps', stat: npsRun as never }]),
  })
})

// GET /api/admin/partner-pool/contact-list — 📬 오늘의 컨택(이메일 최우선). 업체+매장 후보를
//   [이메일 보유 → 전화만] 순으로 미접촉(new)만 추려 반환 — "누구부터 접촉?"의 원버튼 답.
app.get('/contact-list', async (c) => {
  const limit = Math.min(30, Math.max(3, intParam(c.req.query('limit'), 10)))
  const companies = (await adsLeadsDb(c.env).prepare(
    `SELECT id, company_name, category, subcategory, tier, region, email, phone, website FROM ad_company_leads
     WHERE active = 1 AND merged_into IS NULL AND status = 'new' AND ((email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != ''))
     ORDER BY (CASE WHEN email IS NOT NULL AND email != '' THEN 0 ELSE 1 END), (tier IS NULL) ASC, tier ASC, id DESC LIMIT ?`
  ).bind(limit).all<Record<string, unknown>>().catch(() => null))?.results || []
  const stores = (await adsLeadsDb(c.env).prepare(
    `SELECT id, biz_name, category, region, email, phone, website, is_new_open FROM store_prospects
     WHERE active = 1 AND status = 'new' AND ((email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != ''))
     ORDER BY (CASE WHEN email IS NOT NULL AND email != '' THEN 0 ELSE 1 END), is_new_open DESC, apv_perm_ymd DESC, id DESC LIMIT ?`
  ).bind(limit).all<Record<string, unknown>>().catch(() => null))?.results || []
  return c.json({ success: true, companies, stores })
})

// 위임 3종(나라장터 수집 · 이메일 재검증 · 폐업 정리) — 아래 delegateCollect 하나로 통일(같은 보일러플레이트였다).
//   ⚠️ 함수 선언은 호이스팅되므로 정의(아래)보다 위에서 호출해도 안전하다.
app.post('/collect-nara', delegateCollect('collect-nara-contract', '🏛️ 상권 용역 계약 수집'))
app.post('/sweep-mx', delegateCollect('sweep-mx', '📮 이메일 재검증'))
app.post('/sweep-nts', delegateCollect('sweep-nts', '🏛 폐업 정리'))

app.route('/keyword-trades', tradeRoutes) // 🎛️ 업종 단위 일괄 on/off — 개별 키워드는 partner-pool-keywords.routes

// POST /api/admin/partner-pool/collect — 레인 A 수동 수집(ur-ads 워커에 서비스바인딩 위임 → 메인 번들 무영향).
//   백그라운드(waitUntil): 지역검색 순회는 수십 초 → 즉시 started 반환, 완료는 UI 가 stats(run.last_run) 폴링.
app.post('/collect', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작' }, 503)
  const kick = async () => { try {
    const r = await ads.fetch(new Request('https://ur-ads/__ads/collect-company', { method: 'POST' }))
    const b = (await r.json().catch(() => null)) as { stats?: Record<string, unknown> } | null
    await notifyJobDone(adsLeadsDb(c.env), '🔍 레인 A 수집', b?.stats ?? null) // 페이지 이탈해도 결과가 알림벨에 남음
  } catch { /* fail-soft */ } }
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(kick()); return c.json({ success: true, started: true }) }
  try { await kick(); return c.json({ success: true, started: false }) }
  catch { return c.json({ success: false, error: 'ur-ads 위임 오류' }, 502) }
})

// POST /api/admin/partner-pool/enrich — 보류(연락처 없음) 리드 이메일 보강(ur-ads 위임). 홈페이지 있는 것만.
// POST /api/admin/partner-pool/match-registry — 🔗 원부 이메일 이식(크롤 0회·서브리퀘스트 0).
//   전수조사 결과 이메일의 99.8%가 원부 직행분인데 타깃 카테고리는 조인 키(business_no)가 없어 못 쓰고 있었다.
//   상호(+주소) 확신 매칭만 이식 — 판단이 안 서면 비워둔다(허위 0). 여러 패스로 백로그를 순회.
app.post('/match-registry', async (c) => {
  const passes = Math.min(20, Math.max(1, intParam(c.req.query('passes'), 5)))
  const run = async () => {
    const { matchRegistryEmails } = await import('./registry-email-match')
    // 🪙 패스들이 **한 인보케이션을 공유**한다 — 예산도 공유해야 한다. 예전엔 패스마다 수백 쿼리를 날려
    //   서브리퀘스트 한도에 눌렸고, 그 실패를 `.catch(() => null)` 가 삼켜 통계엔 '원부에 없음' 으로 남았다.
    const budget = { left: 45 } // 플랫폼 한도(≈50) 안쪽. 부족하면 다음 호출/크론이 커서로 이어받는다.
    for (let i = 0; i < passes; i++) {
      const r = await matchRegistryEmails(c.env, 400, budget).catch(() => null)
      if (!r || r.done || budget.left <= 8) break
    }
  }
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(run()); return c.json({ success: true, started: true }) }
  await run()
  return c.json({ success: true, started: false })
})

app.post('/enrich', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정' }, 503)
  const kick = async () => { try {
    const r = await ads.fetch(new Request('https://ur-ads/__ads/enrich-company', { method: 'POST' }))
    const b = (await r.json().catch(() => null)) as { stats?: Record<string, unknown> } | null
    await notifyJobDone(adsLeadsDb(c.env), '📧 연락처 보강', b?.stats ?? null) // 페이지 이탈해도 결과가 알림벨에 남음
  } catch { /* fail-soft */ } }
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(kick()); return c.json({ success: true, started: true }) }
  try { await kick(); return c.json({ success: true, started: false }) }
  catch { return c.json({ success: false, error: 'ur-ads 위임 오류' }, 502) }
})

// 소스별 수동 수집 위임(ur-ads). 게이트 무관(수동=의도). storeinfo/commerce/franchise.
function delegateCollect(path: string, label: string) {
  return async (c: import('hono').Context<{ Bindings: Env }>) => {
    const ads = c.env.ADS
    if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작' }, 503)
    // 🔔 완료 알림벨(2026-07-27 대표 "실행 중 다른 페이지로 이동하면?") — 서버 작업은 waitUntil 로 계속되지만
    //   페이지를 떠나면 완료 토스트를 못 봄 → 결과를 알림벨에 남겨 돌아와서도 확인 가능하게(풀가동 3종과 동일).
    const kick = async () => {
      try {
        const r = await ads.fetch(new Request(`https://ur-ads/__ads/${path}`, { method: 'POST' }))
        const body = (await r.json().catch(() => null)) as { ok?: boolean; stats?: Record<string, unknown> } | null
        await notifyJobDone(adsLeadsDb(c.env), label, body?.stats ?? null)
      } catch { /* fail-soft */ }
    }
    if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(kick()); return c.json({ success: true, started: true }) }
    try { await kick(); return c.json({ success: true, started: false }) }
    catch { return c.json({ success: false, error: 'ur-ads 위임 오류' }, 502) }
  }
}
// 🔬 공공 API 한 방 프로브 — **결과를 그 자리에서 돌려준다**(위 delegateCollect 와 정반대로 fire-and-forget 아님).
//   그래야 하는 이유: 저 레인들은 D1 스탬프에 도달하기 전에 죽어서, 며칠째 원문을 한 번도 못 봤다
//   (08-01 실측 — 통신판매 수동 트리거 후 72초를 봤지만 `last_run` 이 07-29 그대로였다).
//   🔐 ur-ads 가 URL·본문의 서비스키를 이미 가려서 준다. 여기서는 그대로 전달만 한다(추가 가공 금지 —
//   가공하다 가림이 풀리면 public repo·어드민 화면에 키가 실린다).
app.post('/probe-public-data', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정' }, 503)
  const target = c.req.query('target') || 'all'
  try {
    const qs = new URLSearchParams({ target })
    for (const k of ['rows', 'page', 'ladder', 'path', 'host', 'params', 'body']) { const v = c.req.query(k); if (v) qs.set(k, v) }
    const r = await ads.fetch(new Request(`https://ur-ads/__ads/probe-public-data?${qs.toString()}`, { method: 'POST', signal: AbortSignal.timeout(120_000) }))
    const body = await r.json().catch(() => null)
    return c.json({ success: true, ...(body as Record<string, unknown> || {}) })
  } catch (e) {
    return c.json({ success: false, error: String((e as Error)?.message || e || '').slice(0, 200) }, 502)
  }
})

app.post('/collect-storeinfo', delegateCollect('collect-storeinfo', '🏪 상가정보 수집')) // 소스① 상가정보
app.post('/collect-commerce', delegateCollect('collect-commerce', '🛒 통신판매 수집'))   // 통신판매사업자(전화+이메일)
app.post('/collect-franchise', delegateCollect('collect-franchise', '🏢 프랜차이즈 수집')) // 공정위 가맹정보(프랜차이즈 본사)
app.post('/collect-market', delegateCollect('collect-market', '🏪 전통시장 수집'))     // 상권 축 — 상인회(연락처 有)
app.post('/collect-nps', delegateCollect('collect-nps', '👥 국민연금 규모 조회'))         // 👥 국민연금 규모 검증(직원수)

// ── 🤝 파트너 매장 소개(리퍼럴) 접수·추적 — 머니 무접촉(지급 배선은 별도 세션, partner-referrals.ts 주석) ──
app.get('/referrals', async (c) => {
  const { listReferrals } = await import('./partner-referrals')
  return c.json({ success: true, referrals: await listReferrals(adsLeadsDb(c.env)) })
})
app.post('/referrals', async (c) => {
  const { addReferral } = await import('./partner-referrals')
  const b = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const r = await addReferral(adsLeadsDb(c.env), {
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
    const r = await updateReferralStatus(adsLeadsDb(c.env), id, String(b.status || ''))
    if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  }
  if (b.reward_amount !== undefined || b.reward_memo !== undefined || b.mark_paid) {
    const r = await updateReferralReward(adsLeadsDb(c.env), id, { amount: b.reward_amount, memo: b.reward_memo, markPaid: !!b.mark_paid })
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
  const lockRow = await adsLeadsDb(c.env).prepare("SELECT value FROM platform_settings WHERE key = 'ads_enrich_burst_lock'").first<{ value: string }>().catch(() => null)
  try {
    const lock = lockRow?.value ? JSON.parse(lockRow.value) as { at?: string } : null
    if (lock?.at && Date.now() - Date.parse(lock.at) < 240_000) return c.json({ success: false, error: '보강 풀가동이 이미 진행 중입니다 — 잠시 후 상태줄 확인' }, 409)
  } catch { /* 손상 잠금은 무시 */ }
  const heartbeat = () => adsLeadsDb(c.env).prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind('ads_enrich_burst_lock', JSON.stringify({ at: new Date().toISOString() })).run().catch(() => null)
  const burn = async () => {
    const startedAt = Date.now()
    let rounds = 0, lastEnriched = 0, enriched = 0, processed = 0, crawls = 0, hits = 0, reason = 'loop_cap'
    for (let i = 0; i < 12; i++) {
      if (Date.now() - startedAt > 220_000) { reason = 'time_cap'; break } // 잔여는 cron/재클릭이 이어받음
      await heartbeat()
      type BurstResp = { ok?: boolean; stats?: { processed?: number; enriched?: number; remaining?: number; crawls?: number; hit_rate?: number } } | null
      let body: BurstResp = null
      try {
        const r = await ads.fetch(new Request('https://ur-ads/__ads/enrich-company', { method: 'POST' }))
        body = (await r.json().catch(() => null)) as BurstResp
      } catch { reason = 'fetch_error'; break }
      if (!body?.ok || !body.stats) { reason = 'bad_response'; break }
      rounds++
      lastEnriched = body.stats.enriched ?? 0
      enriched += body.stats.enriched ?? 0
      processed += body.stats.processed ?? 0
      crawls += body.stats.crawls ?? 0
      hits += Math.round(((body.stats.crawls ?? 0) * (body.stats.hit_rate ?? 0)) / 100) // 라운드 크롤×적중률 → 적중수 누적
      if ((body.stats.processed ?? 0) === 0) { reason = 'backlog_done'; break } // 보강 대상 소진
    }
    const hitRate = crawls ? Math.round((hits / crawls) * 100) : 0
    await adsLeadsDb(c.env).prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind('ads_enrich_burst_last', JSON.stringify({ at: new Date().toISOString(), rounds, processed, enriched, lastEnriched, crawls, hit_rate: hitRate, reason })).run().catch(() => null)
    await adsLeadsDb(c.env).prepare("DELETE FROM platform_settings WHERE key = 'ads_enrich_burst_lock'").run().catch(() => null)
    // 🔔 완료 알림벨(결과 포함) — 페이지를 닫아도 결과가 남는다. 크롤 적중률로 다음 개선 방향(시도량 vs 추출력) 판단.
    try {
      const reasonLabel = reason === 'backlog_done' ? '백로그 소진 ✅' : reason === 'time_cap' ? '시간 상한 — 잔여는 자동/재클릭' : reason === 'loop_cap' ? '라운드 상한 — 잔여는 자동/재클릭' : '중단(응답 오류)'
      const { createDashboardNotification } = await import('../../notifications/api/dashboard-notifications.routes')
      await createDashboardNotification(adsLeadsDb(c.env), 'admin', null, 'partner_pool_job', '🚀 보강 풀가동 완료',
        `${rounds}라운드 · 처리 ${processed.toLocaleString()} · 연락처 확보 ${enriched.toLocaleString()} · 크롤 ${crawls.toLocaleString()}(이메일 적중 ${hitRate}%) · ${reasonLabel}`, '/admin/partner-pool')
    } catch { /* 알림 실패가 보강 자체를 막지 않음 */ }
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
  const saved = await saveCompanyLeads(adsLeadsDb(c.env), [lead]).catch(() => 0)
  return c.json({ success: saved > 0, saved })
})

// POST /api/admin/partner-pool/import { text } — 레인 B(공정위 정보공개서)·C(상인회 명부) 붙여넣기 일괄 추가.
//   헤더(회사명 포함) 있는 CSV/TSV 자동 파싱 → 멱등 저장(company_key). 즉시 동작(API 키 대기 없음).
app.post('/import', async (c) => {
  const b = await c.req.json().catch(() => ({})) as { text?: string }
  const leads = parsePartnerPaste(String(b.text || ''))
  if (!leads.length) return c.json({ success: false, error: '헤더(회사명 포함)가 있는 표(CSV/TSV)를 붙여넣어 주세요', parsed: 0, saved: 0 }, 400)
  const saved = await saveCompanyLeads(adsLeadsDb(c.env), leads).catch(() => 0)
  return c.json({ success: true, parsed: leads.length, saved })
})

// PATCH /api/admin/partner-pool/:id { status?, memo?, tier?, follow_up_at?, contact_channel? }
app.patch('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'INVALID_ID' }, 400)
  const b = await c.req.json().catch(() => ({})) as {
    status?: string; memo?: string; tier?: number | null; follow_up_at?: string | null; contact_channel?: string | null
  }
  const r = await updateCompanyLead(adsLeadsDb(c.env), id, b)
  return c.json({ success: r.ok, error: r.error }, r.ok ? 200 : 400)
})

// DELETE /api/admin/partner-pool/:id
app.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'INVALID_ID' }, 400)
  const r = await deleteCompanyLead(adsLeadsDb(c.env), id)
  return c.json({ success: r.ok, error: r.error }, r.ok ? 200 : 400)
})

// POST /api/admin/partner-pool/delete-bulk { ids: number[] } — 체크박스 선택 삭제(최대 500).
app.post('/delete-bulk', async (c) => {
  const b = await c.req.json().catch(() => ({})) as { ids?: unknown }
  const ids = Array.isArray(b.ids) ? b.ids.map(n => Number(n)) : []
  if (!ids.length) return c.json({ success: false, error: '선택된 항목이 없습니다' }, 400)
  const deleted = await deleteCompanyLeads(adsLeadsDb(c.env), ids)
  return c.json({ success: true, deleted })
})

// GET /api/admin/partner-pool/export?format=csv — 엑셀 호환(수식 인젝션 방어). 대표 동선표용.
/** 내보내기 상한. 이스케이프·절단 고지·필터 파싱은 `pool-export.ts`(두 풀 공용) 에 있다. */
const EXPORT_MAX = 5000

// 🩸 화면 필터를 그대로 따른다(2026-08-03 수리 — 이전엔 무시했다). 배경·근거는 `pool-export.ts` 헤더.
app.get('/export', async (c) => {
  await ensureCompanySchema(adsLeadsDb(c.env))
  const filter = parseCompanyExportFilter(k => c.req.query(k), intParam) as CompanyLeadFilter
  const rows = await listCompanyLeads(adsLeadsDb(c.env), { ...filter, limit: EXPORT_MAX })
  return csvResponse({
    filename: 'partner-leads.csv',
    header: ['tier', 'category', 'subcategory', 'company_name', 'region', 'phone', 'email', 'website', 'address', 'status', 'contact_channel', 'follow_up_at', 'memo', 'source', 'source_keyword', 'collected_at'],
    rows: rows.map(r => [r.tier ?? '', r.category, r.subcategory, r.company_name, r.region, r.phone, r.email, r.website, r.address, r.status, r.contact_channel, r.follow_up_at, r.memo, r.source, r.source_keyword, (r.collected_at || '').slice(0, 10)]),
    cap: EXPORT_MAX,
  })
})

export { app as partnerPoolRoutes }
