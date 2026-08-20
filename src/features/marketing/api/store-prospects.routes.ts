/**
 * 🏪 매장 후보(store_prospects) 어드민 — 유어딜 입점 대상 매장 발굴/큐레이션. /api/admin/store-prospects/*.
 *   메인 어드민 JWT(requireAdmin). 소스: 지방행정 인허가정보(localdata-collect, ur-ads 위임).
 *   ⚠️ 수집 ≠ 발송 — 공개 인허가 정보만. 자동 발송 경로 부존재.
 */
import { csvResponse } from './pool-export'
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import { intParam } from '@/shared/pagination'
import { judgeLanes } from './lane-yield-health'
import {
  listProspects, countProspects, prospectStats, updateProspect,
  LICENSE_CATEGORIES, PROSPECT_STATUSES, PROSPECT_CONTACT_CHANNELS,
  type ProspectFilter,
} from './store-prospects'
import { listStoreTrades, setStoreTradeActive, addStoreTrade, getStoreConfig, setStoreConfig } from './store-trades'
import { REGION_GROUPS } from './company-keyword-grid'
import { adsLeadsDb } from '../../../shared/ads/leads-db'

const app = new Hono<{ Bindings: Env }>()
app.use('*', requireAdmin())

// GET /api/admin/store-prospects?category=&region=&status=&newOpen=1&includeClosed=1&hasPhone=1&q=&limit=
app.get('/', async (c) => {
  const limit = Math.min(500, Math.max(1, intParam(c.req.query('limit'), 100)))
  const offset = Math.max(0, intParam(c.req.query('offset'), 0))
  const filter: ProspectFilter = {
    category: c.req.query('category') || undefined,
    region: (c.req.query('region') || '').trim() || undefined,
    status: c.req.query('status') || undefined,
    newOpenOnly: c.req.query('newOpen') === '1',
    includeClosed: c.req.query('includeClosed') === '1',
    hasPhone: c.req.query('hasPhone') === '1',
    hasEmail: c.req.query('hasEmail') === '1',
    q: (c.req.query('q') || '').trim() || undefined,
  }
  const [prospects, total] = await Promise.all([
    listProspects(adsLeadsDb(c.env), { ...filter, limit, offset }),
    countProspects(adsLeadsDb(c.env), filter),
  ])
  return c.json({ success: true, prospects, total, limit, offset })
})

// GET /api/admin/store-prospects/meta
app.get('/meta', (c) => c.json({
  success: true,
  categories: LICENSE_CATEGORIES,
  statuses: PROSPECT_STATUSES,
  channels: PROSPECT_CONTACT_CHANNELS,
}))

// GET /api/admin/store-prospects/stats — 통계 + 수집 게이트/최근실행.
app.get('/stats', async (c) => {
  const s = await prospectStats(adsLeadsDb(c.env))
  const readJson = async (k: string): Promise<unknown> => {
    const row = await adsLeadsDb(c.env).prepare('SELECT value FROM platform_settings WHERE key = ?').bind(k).first<{ value: string }>().catch(() => null)
    try { return row?.value ? JSON.parse(row.value) : null } catch { return null }
  }
  const run = await readJson('ads_localdata_stats')
  const neisRun = await readJson('ads_neis_stats')
  const hiraRun = await readJson('ads_hira_stats')
  // 📧 보강 레인 스냅샷(2026-07-28 신설) — 매장 이메일이 0 인 이유를 **묻지 않고 볼 수 있게**.
  const enrichRun = await readJson('ads_prospect_enrich_stats')
  // 🏪 카카오 로컬 매장 발굴(2026-08-02) — 인허가가 HTTP 500 으로 죽어 있는 동안 **매장 풀을 실제로
  //   늘리고 있는 유일한 레인**인데 이 화면 어디에도 안 나왔다. 무인 1,110건이 어디서 왔는지 물어야만
  //   알 수 있는 상태 = "부재는 침묵과 다르게 생겼다"의 반복. 스냅샷을 그대로 실어 보이게 한다.
  const kakaoRun = await readJson('ads_store_kakao_stats')
  // 🚩 게이트는 **cron 이 도는 워커(ur-ads) env** 가 진실이다. 여기서 `c.env.*` 를 읽으면
  //   **메인 워커** 값이라 실제와 어긋난다 — 라이브 실측(2026-07-28): 화면은 `gate:false` 인데
  //   `run.last_run` 은 그날 크론 시각이었다(= 실제로는 켜져서 돌고 있었다). 파트너풀 상태줄은
  //   이미 `/__ads/health` 로 실값을 묻는데 매장 쪽만 안 물어 **거짓 OFF** 를 보여줬다.
  //   ⚠️ 대표가 이걸 보고 "안 켜져 있네" 로 오판하면 진짜 원인(=예산 고갈)을 영영 못 찾는다.
  let g: Record<string, boolean> | null = null
  if (c.env.ADS?.fetch) {
    try {
      const hr = await c.env.ADS.fetch(new Request('https://ur-ads/__ads/health'))
      g = ((await hr.json().catch(() => null)) as { gates?: Record<string, boolean> } | null)?.gates ?? null
    } catch { /* health 실패 시 메인 env 폴백 */ }
  }
  const gate = (k: string, fallback: boolean): boolean => (g && typeof g[k] === 'boolean') ? g[k] : fallback
  return c.json({
    success: true, ...s,
    collect: { gate: gate('localdata', (c.env as { ADS_LOCALDATA_ENABLED?: string }).ADS_LOCALDATA_ENABLED === 'true'), adsBinding: !!c.env.ADS?.fetch, run },
    neis: { gate: gate('neis', (c.env as { ADS_NEIS_ENABLED?: string }).ADS_NEIS_ENABLED === 'true'), run: neisRun },
    hira: { gate: gate('hira', (c.env as { ADS_HIRA_ENABLED?: string }).ADS_HIRA_ENABLED === 'true'), run: hiraRun },
    storeKakao: { gate: gate('store_kakao', (c.env as { ADS_STORE_KAKAO_ENABLED?: string }).ADS_STORE_KAKAO_ENABLED === 'true'), run: kakaoRun },
    enrich: { run: enrichRun }, // 킬스위치는 ADS_ENRICH_DISABLED(전역) — 별도 게이트 없음
    // 🩺 **수확 0 이 지속되는 레인**을 화면이 물어보지 않아도 알 수 있게(2026-08-02).
    //   실측: `collect-hira` 는 60회 실행에 저장 0(timeout)인데 하트비트는 `ok=true` 로 초록이었다.
    //   죽은 레인도 살아 있는 레인과 **똑같이 회차 순번을 나눠 갖는다** — 대표 우선업종 레인이 그만큼 밀린다.
    //   ⚠️ 판정은 보여주기만 한다. 끄는 것은 사람의 결정이다(판정 규칙·오경보 방지는 lane-yield-health 헤더).
    laneHealth: judgeLanes([
      { lane: 'collect-localdata', stat: run as never },
      { lane: 'collect-neis', stat: neisRun as never },
      { lane: 'collect-hira', stat: hiraRun as never },
      { lane: 'collect-store-kakao', stat: kakaoRun as never },
    ]),
  })
})

// 🎛️ 수집 업태 제어 — 배포 없이 켜고 끈다(설계·폴백 규칙은 store-trades.ts 헤더).
//   ⚠️ `/:id` 보다 **위**에 둔다 — 아래에 두면 'trades' 가 :id 로 먹혀 조용히 404 가 된다.
app.get('/trades', async (c) => c.json({ success: true, trades: await listStoreTrades(adsLeadsDb(c.env)) }))
app.patch('/trades', async (c) => {
  const b = await c.req.json().catch(() => ({})) as { trade?: string; active?: boolean }
  const r = await setStoreTradeActive(adsLeadsDb(c.env), b.trade || '', b.active === true)
  return c.json(r.ok ? { success: true, changed: r.changed } : { success: false, error: r.error }, r.ok ? 200 : 400)
})
app.post('/trades', async (c) => {
  const b = await c.req.json().catch(() => ({})) as { block?: string; trade?: string; category?: string }
  const r = await addStoreTrade(adsLeadsDb(c.env), b.block || '', b.trade || '', b.category || '')
  return c.json(r.ok ? { success: true } : { success: false, error: r.error }, r.ok ? 200 : 400)
})

// 🎛️ 회차 조건(권역·비중·페이지·예산). ⚠️ 값은 **서버가 clamp** 한다 — 화면이 상한을 못 뚫는다.
app.get('/config', async (c) => c.json({
  success: true,
  config: await getStoreConfig(adsLeadsDb(c.env), Object.keys(REGION_GROUPS)),
  groups: Object.keys(REGION_GROUPS),
}))
app.patch('/config', async (c) => {
  const b = await c.req.json().catch(() => ({}))
  return c.json({ success: true, config: await setStoreConfig(adsLeadsDb(c.env), b, Object.keys(REGION_GROUPS)) })
})

// PATCH /api/admin/store-prospects/:id — 큐레이션(상태/메모/채널/팔로업).
app.patch('/:id', async (c) => {
  const id = intParam(c.req.param('id'), 0)
  if (!id) return c.json({ success: false, error: 'invalid id' }, 400)
  const b = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const r = await updateProspect(adsLeadsDb(c.env), id, {
    status: b.status !== undefined ? String(b.status) : undefined,
    memo: b.memo !== undefined ? String(b.memo) : undefined,
    contact_channel: b.contact_channel !== undefined ? (b.contact_channel === null ? null : String(b.contact_channel)) : undefined,
    follow_up_at: b.follow_up_at !== undefined ? (b.follow_up_at === null ? null : String(b.follow_up_at)) : undefined,
  })
  return c.json({ success: r.ok, error: r.error }, r.ok ? 200 : 400)
})

// POST /api/admin/store-prospects/collect — 인허가 변동분 수동 수집(ur-ads 위임). 게이트 무관(수동=의도).
app.post('/collect', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작' }, 503)
  const kick = async () => { try { await ads.fetch(new Request('https://ur-ads/__ads/collect-localdata', { method: 'POST' })) } catch { /* fail-soft */ } }
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(kick()); return c.json({ success: true, started: true }) }
  try { await kick(); return c.json({ success: true, started: false }) }
  catch { return c.json({ success: false, error: 'ur-ads 위임 오류' }, 502) }
})

// POST /api/admin/store-prospects/collect-{neis,hira,store-kakao} — 보조 소스 수동 수집(ur-ads 위임).
//
//   🎯 `collect-store-kakao` 가 여기 있는 이유: 이 레인은 dispatch 의 `prospect` 도메인(예산 1 / 레인 5)에
//   속해 **약 5회차에 한 번**만 돈다. 대표가 조건을 바꾸고(권역·비중·페이지) 그 효과를 보려면
//   최대 5시간을 기다려야 했다 — 학원·병원엔 있는 버튼이 정작 우선업종(음식점·카페·미용·숙박)을
//   채우는 유일한 레인에만 없었다. **수동=의도** 라 게이트 무관(같은 `/__ads/*` 위임 패턴).
//   ⚠️ 자동 회차와 겹칠 수 있다 — 저장은 upsert 라 오염은 없고 중복 조회만 생긴다(학원·병원과 동일).
for (const [path, target] of [
  ['/collect-neis', 'collect-neis'], ['/collect-hira', 'collect-hira'],
  ['/collect-store-kakao', 'collect-store-kakao'],
] as const) {
  app.post(path, async (c) => {
    const ads = c.env.ADS
    if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작' }, 503)
    const kick = async () => { try { await ads.fetch(new Request(`https://ur-ads/__ads/${target}`, { method: 'POST' })) } catch { /* fail-soft */ } }
    if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(kick()); return c.json({ success: true, started: true }) }
    try { await kick(); return c.json({ success: true, started: false }) }
    catch { return c.json({ success: false, error: 'ur-ads 위임 오류' }, 502) }
  })
}

// POST /api/admin/store-prospects/enrich-contacts — 이메일 우선 연락처 보강(ur-ads 위임). 게이트 무관(수동).
app.post('/enrich-contacts', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작' }, 503)
  const kick = async () => { try { await ads.fetch(new Request('https://ur-ads/__ads/enrich-prospects', { method: 'POST' })) } catch { /* fail-soft */ } }
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(kick()); return c.json({ success: true, started: true }) }
  try { await kick(); return c.json({ success: true, started: false }) }
  catch { return c.json({ success: false, error: 'ur-ads 위임 오류' }, 502) }
})

// GET /api/admin/store-prospects/new-open-digest — 🎉 개업 웰컴 큐(최근 개업 + 지역 집계).
app.get('/new-open-digest', async (c) => {
  const { newOpenDigest } = await import('./opening-briefing')
  const days = Math.min(90, Math.max(1, intParam(c.req.query('days'), 14)))
  const d = await newOpenDigest(adsLeadsDb(c.env), days, 30)
  return c.json({ success: true, ...d })
})

// GET /api/admin/store-prospects/:id/briefing — 📊 개업 컨설팅 브리핑(상권 수치 + 멘트 초안, 전부 자체 집계).
app.get('/:id/briefing', async (c) => {
  const id = intParam(c.req.param('id'), 0)
  if (!id) return c.json({ success: false, error: 'invalid id' }, 400)
  const { openingBriefing } = await import('./opening-briefing')
  const b = await openingBriefing(adsLeadsDb(c.env), id)
  if (!b) return c.json({ success: false, error: '매장을 찾을 수 없습니다' }, 404)
  return c.json({ success: true, ...b })
})

// GET /api/admin/store-prospects/export — 엑셀 호환 CSV(BOM + 수식 인젝션 방어). 인증 blob 다운로드용.
/** 내보내기 상한 — `listProspects` 가 2,000 으로 클램프한다(그 이상은 그쪽부터). */
const EXPORT_MAX = 2000

/**
 * 🩸 **화면 필터를 그대로 따른다** (2026-08-03 실측 수리 — 이전엔 필터를 **통째로 무시**했다).
 *   이 풀은 **95%가 학원**이라(인허가 레인 사망으로 음식점·카페·미용·숙박 0), 필터가 파일까지 안 이어지면
 *   대표 우선업종은 **내보내기로 도달 자체가 불가능**했다.
 *   📞 도달 채널도 이메일이 아니라 **전화**다(이메일 8건 · 전화 27,831건) — `hasPhone=1` 이 이제 파일까지 간다.
 */
app.get('/export', async (c) => {
  const filter: ProspectFilter = {
    category: c.req.query('category') || undefined,
    region: (c.req.query('region') || '').trim() || undefined,
    status: c.req.query('status') || undefined,
    newOpenOnly: c.req.query('newOpen') === '1',
    includeClosed: c.req.query('includeClosed') === '1',
    hasPhone: c.req.query('hasPhone') === '1',
    hasEmail: c.req.query('hasEmail') === '1',
    q: (c.req.query('q') || '').trim() || undefined,
  }
  const rows = await listProspects(adsLeadsDb(c.env), { ...filter, limit: EXPORT_MAX })
  return csvResponse({
    filename: 'store-prospects.csv',
    header: ['category', 'biz_name', 'region', 'phone', 'email', 'website', 'addr_road', 'status', 'is_new_open', 'apv_perm_ymd', 'collected_at'],
    rows: rows.map(r => [r.category, r.biz_name, r.region, r.phone, r.email, r.website, r.addr_road, r.status, r.is_new_open ? '개업' : '', r.apv_perm_ymd, (r.collected_at || '').slice(0, 10)]),
    cap: EXPORT_MAX,
  })
})

export const storeProspectsRoutes = app
