/**
 * 🚫 유어애즈 2차 (2026-11-25 대표 *"이어서 다 고쳐줘."* — 인계 표의 유어애즈 영역 '열림')
 *
 *  ① 수신거부·"보냄" 은 **주소(사람)** 단위다 — 같은 주소의 다른 채널 행도 같이 닫는다. "보냄" 은 묶어서 처리한다
 *     (종전엔 ID 가 98개를 넘으면 한 문장이 통째로 실패해 0건이 됐다).
 *  ② "지금 연락할 사람" 내보내기가 발송 대기열과 같은 사람을 뺀다(거절·보류 · 거부 회신 · 카페 · 뉴스/대행사 이름).
 *  ③ 업체 리드: 지운(보내면 안 되는) 이메일을 재수집이 다시 채우지 않는다 · 내보내기에 번호 열.
 *  ④ 카드로 결제된 광고 주문의 결제 상태는 손으로 못 바꾼다(환불 길이 막힌다).
 *  ⑤ 하루 발송 수 · 네이버 차단 수는 DB 가 더한다(읽고-더해-쓰기는 동시 실행 때 한쪽이 사라진다).
 *
 * DB 는 sqlite(라이브 구조 + 유어애즈 표). 못 보는 것: 실제 메일 발송 · 수집기(ur-ads 워커)의 실제 동시 실행 ·
 * 업체 리드에는 여전히 수신거부 **칸**이 없다(주소를 비우고 차단 표에 넣는 방식 그대로).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { d1, openLiveSchema, insert, q, q1, makeCtx, SECRET } from '../helpers/live-d1'
import { readCode } from '../helpers/source-text'
import { ensureInfluencerSchema } from '@/features/marketing/api/influencer-discovery'
import { ensureSuppressionColumns } from '@/features/marketing/api/influencer-merge-suppression'
import { markLeadsContacted, MARK_CONTACTED_CHUNK, normalizeContactChannel } from '@/features/marketing/api/influencer-mark-contacted'
import { contactableExportSql, buildSendQueueWhere, OUTREACH_NOISE_WORDS } from '@/features/marketing/api/outreach-queue'
import { suppressedEmails, _resetSuppressCache, SUPPRESS_CACHE_TTL_MS } from '@/features/marketing/api/email-suppress-cache'
import { adminUpdateOrder } from '@/features/marketing/api/ad-services'
import { noteCrawlStatus, flushCrawlBlock, CRAWL_BLOCK_KEY } from '@/features/marketing/api/naver-crawl-block'
import { influencerOfferInvitesRoutes } from '@/features/marketing/api/influencer-offer-invites.routes'

async function leadsDb() {
  const raw = openLiveSchema()
  const DB = d1(raw)
  await ensureInfluencerSchema(DB)
  await ensureSuppressionColumns(DB)
  const lead = (v: Record<string, unknown>) => insert(raw, 'ad_influencer_leads', { account_id: 0, platform: 'youtube', name: '시험리드', status: 'new', ...v })
  const row = (id: number) => q1<Record<string, unknown>>(raw, 'SELECT id, email, status, opted_out, contacted_at, contact_channel FROM ad_influencer_leads WHERE id = ?', id)
  return { raw, DB, lead, row }
}
beforeEach(() => { _resetSuppressCache() })

describe('① 수신거부·"보냄" 은 주소 단위', () => {
  it('"보냄" 처리: 붙여 넣은 행과 같은 주소의 형제 행도 닫힌다 · 남의 주소는 그대로', async () => {
    const { DB, lead, row } = await leadsDb()
    const yt = lead({ email: 'Same@Example.test', channel_id: 'yt-1' })
    const blog = lead({ email: 'same@example.test ', platform: 'naver_blog', channel_id: 'b-1' })
    const other = lead({ email: 'other@example.test', channel_id: 'yt-2' })
    const noEmail = lead({ channel_id: 'yt-3' })
    const noEmail2 = lead({ channel_id: 'yt-4' })
    const n = await markLeadsContacted(DB, 0, [yt, noEmail], 'email')
    expect(n).toBe(3)
    expect(row(yt)?.status).toBe('contacted')
    expect(row(blog)?.contacted_at, '같은 사람의 다른 채널이 다음 내보내기에 다시 올라온다').not.toBeNull()
    expect(row(other)?.contacted_at).toBeNull()
    expect(row(noEmail2)?.contacted_at, '이메일 없는 행끼리 한 사람으로 묶였다').toBeNull()
  })

  it('ID 를 한 번에 250개 넣어도 전부 처리된다(종전: 98개를 넘으면 0건)', async () => {
    const { DB, lead, raw } = await leadsDb()
    const ids: number[] = []
    for (let i = 0; i < 250; i++) ids.push(lead({ email: `m${i}@example.test`, channel_id: `c-${i}` }))
    expect(MARK_CONTACTED_CHUNK * 2 + 3, '한 문장의 바인드가 D1 한도(100)를 넘는다').toBeLessThanOrEqual(100)
    expect(await markLeadsContacted(DB, 0, ids, 'email')).toBe(250)
    expect(q1<{ n: number }>(raw, 'SELECT COUNT(*) n FROM ad_influencer_leads WHERE contacted_at IS NULL')?.n).toBe(0)
  })

  it('이미 보낸 날짜는 덮지 않는다 · 채널 값은 정해진 것만', async () => {
    const { DB, lead, row } = await leadsDb()
    const id = lead({ email: 'kept@example.test', channel_id: 'k-1', contacted_at: '2026-10-01 00:00:00', contact_channel: 'dm', status: 'interested' })
    await markLeadsContacted(DB, 0, [id], normalizeContactChannel('<script>'))
    expect(row(id)).toMatchObject({ contacted_at: '2026-10-01 00:00:00', contact_channel: 'dm', status: 'interested' })
    expect(normalizeContactChannel('kakao')).toBe('kakao')
    expect(normalizeContactChannel('nope')).toBe('email')
  })

  it('수신거부 링크: 누른 행과 같은 주소의 형제 행도 수신거부가 된다', async () => {
    const { raw, DB, lead, row } = await leadsDb()
    const yt = lead({ email: 'unsub@example.test', channel_id: 'u-1' })
    const blog = lead({ email: 'UNSUB@example.test', platform: 'naver_blog', channel_id: 'u-2' })
    const other = lead({ email: 'stay@example.test', channel_id: 'u-3' })
    const app = new Hono()
    app.route('/api/influencer-offers', influencerOfferInvitesRoutes)
    const token = 'a'.repeat(36) // 토큰은 16진수 36자
    // 초대 표는 라우트가 만든다 — 한 번 불러 표를 만든 뒤 초대 한 건을 넣는다
    const env = { DB, ADS_LEADS_DB: DB, JWT_SECRET: SECRET, ENVIRONMENT: 'development' } as Record<string, unknown>
    const call = async (path: string) => { const { ctx, drain } = makeCtx(); raw.exec('DELETE FROM rate_limit_attempts'); const r = await app.request(`https://urdeal.kr${path}`, { method: 'GET', headers: { 'CF-Connecting-IP': '203.0.113.9', 'User-Agent': 'Mozilla/5.0 ads2' } }, env, ctx); await drain(); return r.status }
    await call(`/api/influencer-offers/unsubscribe/${token}`)
    const cols = q<{ name: string }>(raw, "SELECT name FROM pragma_table_info('influencer_offer_invites')").map((c) => c.name)
    expect(cols, '초대 표가 없다 — 시험이 수신거부 경로를 못 탄다').toContain('token')
    // NOT NULL 인데 기본값이 없는 칸은 채워 넣는다(표 모양이 바뀌어도 시험이 따라간다)
    const info = q<{ name: string; notnull: number; dflt_value: unknown; pk: number }>(raw, "SELECT name, \"notnull\", dflt_value, pk FROM pragma_table_info('influencer_offer_invites')")
    const fill: Record<string, unknown> = { token, lead_id: yt }
    for (const c of info) if (c.notnull && c.dflt_value == null && !c.pk && !(c.name in fill)) fill[c.name] = 1
    insert(raw, 'influencer_offer_invites', fill)
    expect(await call(`/api/influencer-offers/unsubscribe/${token}`)).toBe(200)
    expect(row(yt)?.opted_out).toBe(1)
    expect(row(blog)?.opted_out, '같은 주소의 다른 채널 행이 그대로다').toBe(1)
    expect(row(other)?.opted_out ?? 0).toBe(0)
  })
})

describe('② "지금 연락할 사람" 내보내기 = 발송 대기열과 같은 사람', () => {
  it('거절·보류 · 거부 회신 · 카페 · 뉴스/대행사 이름 · 수신거부 · 브랜드 · 이미 연락한 사람은 빠진다', async () => {
    const { raw, lead } = await leadsDb()
    const keep = lead({ email: 'ok@example.test', channel_id: 'e-1' })
    lead({ email: 'rej@example.test', channel_id: 'e-2', status: 'rejected' })
    lead({ email: 'hold@example.test', channel_id: 'e-3', status: 'hold' })
    lead({ email: 'optout@example.test', channel_id: 'e-4', email_status: 'opt_out' })
    lead({ email: 'cafe@example.test', channel_id: 'e-5', platform: 'naver_cafe' })
    lead({ email: 'news@example.test', channel_id: 'e-6', name: `동네${OUTREACH_NOISE_WORDS[0]}` })
    lead({ email: 'out@example.test', channel_id: 'e-7', opted_out: 1 })
    lead({ email: 'brand@example.test', channel_id: 'e-8', is_brand: 1 })
    lead({ email: 'done@example.test', channel_id: 'e-9', contacted_at: '2026-11-01 00:00:00' })
    lead({ channel_id: 'e-10' }) // 이메일 없음
    const got = q<{ id: number }>(raw, `SELECT id FROM ad_influencer_leads WHERE account_id = 0${contactableExportSql()}`).map((r) => r.id)
    expect(got).toEqual([keep])
    // 발송 대기열(이메일만)과 같은 집합이다
    const w = buildSendQueueWhere(0, undefined, { emailOnly: true })
    const queue = (raw.prepare(`SELECT id FROM ad_influencer_leads WHERE ${w.where} AND email != ''`).all(...(w.binds as never[])) as Array<{ id: number }>).map((r) => r.id)
    expect(queue).toEqual(got)
  })

  it('내보내기가 그 조건을 쓴다(자기 조건을 따로 갖지 않는다)', () => {
    const src = readCode('src/features/marketing/api/influencer-pool-export.ts')
    expect(src).toContain('? contactableExportSql()')
    expect(src).not.toContain("NOT IN ('bounced','complained'))\"\n      + \" AND NOT (perf_checked_at")
  })
})

describe('③ 업체 리드 — 지운 이메일이 돌아오지 않는다', () => {
  it('차단 표의 주소는 메모리 사본으로 걸러진다 · 10분 안에는 다시 읽지 않는다', async () => {
    const raw = openLiveSchema()
    const DB = d1(raw)
    raw.exec("CREATE TABLE IF NOT EXISTS ad_email_suppress (email TEXT PRIMARY KEY, reason TEXT, created_at TEXT DEFAULT (datetime('now')))")
    raw.prepare("INSERT OR IGNORE INTO ad_email_suppress (email, reason) VALUES ('Bounced@Example.test', 'bounce')").run()
    const t0 = 1_700_000_000_000
    expect((await suppressedEmails(DB, t0)).has('bounced@example.test')).toBe(true)
    raw.prepare("INSERT OR IGNORE INTO ad_email_suppress (email, reason) VALUES ('later@example.test', 'bounce')").run()
    expect((await suppressedEmails(DB, t0 + 60_000)).has('later@example.test'), '10분 안인데 다시 읽었다').toBe(false)
    expect((await suppressedEmails(DB, t0 + SUPPRESS_CACHE_TTL_MS + 1)).has('later@example.test')).toBe(true)
  })

  it('표가 없거나 읽기가 실패해도 수집을 멈추지 않는다(빈 목록)', async () => {
    const broken = { prepare: () => ({ all: async () => { throw new Error('no such table: ad_email_suppress') } }) } as never
    expect((await suppressedEmails(broken, 1)).size).toBe(0)
  })

  it('저장 관문이 그 목록으로 이메일을 비운다 · 주간 정리는 차단 표를 끝까지 읽는다', () => {
    const save = readCode('src/features/marketing/api/company-save.ts')
    expect(save).toContain('const blocked = await suppressedEmails(DB)')
    expect(save).toContain("blocked.has(String(l.email).trim().toLowerCase())) ? { ...l, email: null } : l)")
    const sweep = readCode('src/features/marketing/api/company-contact-quality.ts')
    expect(sweep).toContain('FROM ad_email_suppress WHERE rowid > ? ORDER BY rowid LIMIT 5000')
    expect(sweep).not.toContain("'SELECT email FROM ad_email_suppress LIMIT 5000'")
  })

  it('업체·매장 내보내기에 번호 열이 있다(보낸 뒤 DB 로 되짚는다)', () => {
    expect(readCode('src/features/marketing/api/partner-pool.routes.ts')).toContain("header: ['id', 'tier', 'category'")
    expect(readCode('src/features/marketing/api/store-prospects.routes.ts')).toContain("header: ['id', 'category', 'biz_name'")
  })
})

describe('④ 카드로 결제된 광고 주문', () => {
  it('결제 상태를 손으로 못 바꾼다 — 무통장 주문은 종전대로 · 메모는 카드 주문도 바뀐다', async () => {
    const raw = openLiveSchema()
    const DB = d1(raw)
    await adminUpdateOrder(DB, 0, { admin_note: 'x' }) // 표를 만든다
    const cols = q<{ name: string; notnull: number; dflt_value: unknown }>(raw, "SELECT name, \"notnull\", dflt_value FROM pragma_table_info('ad_service_orders')")
    const need: Record<string, unknown> = {}
    for (const c of cols) if (c.notnull && c.dflt_value == null && c.name !== 'id') need[c.name] = /amount|price|quantity|pct|total|_id$|cost|margin/.test(c.name) ? 0 : 'x'
    const card = insert(raw, 'ad_service_orders', { ...need, payment_status: 'paid', toss_payment_key: 'pk_live_1' })
    const bank = insert(raw, 'ad_service_orders', { ...need, payment_status: 'paid' })
    const r1 = await adminUpdateOrder(DB, card, { payment_status: 'unpaid' })
    expect(r1.ok).toBe(false)
    expect(q1<{ s: string }>(raw, 'SELECT payment_status s FROM ad_service_orders WHERE id = ?', card)?.s, '카드 주문이 입금 대기가 됐다 — 환불 버튼이 사라진다').toBe('paid')
    expect((await adminUpdateOrder(DB, bank, { payment_status: 'unpaid' })).ok).toBe(true)
    expect(q1<{ s: string }>(raw, 'SELECT payment_status s FROM ad_service_orders WHERE id = ?', bank)?.s).toBe('unpaid')
    expect((await adminUpdateOrder(DB, card, { admin_note: '메모' })).ok).toBe(true)
  })

  it('화면의 토글이 카드 주문에서 잠긴다', () => {
    expect(readCode('src/pages/admin/AdminAdsServicesPage.tsx')).toContain('disabled={busy === o.id || !!o.toss_payment_key}')
  })
})

describe('⑤ 숫자는 DB 가 더한다', () => {
  it('네이버 차단 기록: 같은 날이면 더하고, 날이 바뀌면 새로 시작한다 · 깨진 값은 새 날로', async () => {
    const raw = openLiveSchema()
    const DB = d1(raw) as never
    const day1 = Date.UTC(2026, 10, 25, 3, 0, 0) // KST 11-25 12:00
    noteCrawlStatus(429); noteCrawlStatus(200); noteCrawlStatus(200)
    await flushCrawlBlock(DB, day1)
    const read = () => JSON.parse(String(q1<{ value: string }>(raw, 'SELECT value FROM platform_settings WHERE key = ?', CRAWL_BLOCK_KEY)?.value || '{}')) as { day: string; blocked: number; ok: number }
    const a = read()
    expect(a.blocked + a.ok, JSON.stringify(a)).toBe(3)
    noteCrawlStatus(429); noteCrawlStatus(200)
    await flushCrawlBlock(DB, day1 + 60_000)
    const b = read()
    expect(b).toMatchObject({ day: a.day, blocked: a.blocked + 1, ok: a.ok + 1 })
    noteCrawlStatus(200)
    await flushCrawlBlock(DB, day1 + 24 * 3600_000)
    const c = read()
    expect(c.day).not.toBe(a.day)
    expect(c).toMatchObject({ blocked: 0, ok: 1 })
    raw.prepare('UPDATE platform_settings SET value = ? WHERE key = ?').run('not-json', CRAWL_BLOCK_KEY)
    noteCrawlStatus(200)
    await flushCrawlBlock(DB, day1 + 24 * 3600_000 + 60_000)
    expect(read()).toMatchObject({ blocked: 0, ok: 1 })
  })

  it('차단 기록은 읽지 않고 한 문장으로 쓴다', () => {
    const src = readCode('src/features/marketing/api/naver-crawl-block.ts')
    const fn = src.slice(src.indexOf('export async function flushCrawlBlock'))
    expect(fn).not.toContain("'SELECT value FROM platform_settings WHERE key = ?'")
    expect(fn).toContain("COALESCE(json_extract(platform_settings.value, '$.blocked'), 0) + json_extract(excluded.value, '$.blocked')")
  })

  it('하루 발송 수는 읽은 값에 더해 쓰지 않는다(DB 가 더한다)', () => {
    const src = readCode('src/features/marketing/api/admin-ads-influencers.routes.ts')
    expect(src).toContain('ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + ? AS TEXT)')
    expect(src).not.toContain('String(used + sent)')
  })
})
