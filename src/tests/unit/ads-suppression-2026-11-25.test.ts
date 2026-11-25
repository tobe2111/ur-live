/**
 * 🚫 유어애즈 — 보내지 말아야 할 사람이 다시 "보낼 수 있는 리드" 가 되는 길들 (2026-11-25 대표 *"나머지 빠짐없이 모두 해줘야지."*)
 *
 * 인플루언서 DB(공용 풀 60만 건)의 수신거부·반송·거절 표시가 사라지거나 무시되던 경로를 실제 DB(sqlite)로 돌려 본다.
 *   ① 야간 병합이 지워지는 행의 수신거부·반송·거절·발송 이력을 버렸다.
 *   ② 운영 문서가 쓰라고 한 수신거부 기록(PATCH `{opted_out:1}`)이 아무것도 안 적었다.
 *   ③ '발송함' 결과 업로드가 반송·신고 표시를 덮었다.
 *   ④ 어드민 발송 버튼 둘이 수신거부를 안 봤다(지금은 메일 키가 없어 실제로 안 나간다).
 *   ⑤ 판매자 제안 메일 드립만 야간 금지를 안 봤다.
 *   ⑥ 읽기 전용 어드민이 명단을 통째로 내려받고, 그 GET 이 '내보냄' 도장을 찍었다.
 * 못 보는 것: 실제 메일 발송 · 수집기(ur-ads 워커)가 지워진 채널을 다시 주워 오는 사이의 하루 · 업체 리드(`ad_company_leads`)에는 수신거부 칸 자체가 없다(인계에 열림으로 남김).
 */
import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { readFileSync } from 'node:fs'
import { d1, openLiveSchema, insert, q1, makeCtx, SECRET } from '../helpers/live-d1'
import { mergedSuppression, ensureSuppressionColumns } from '@/features/marketing/api/influencer-merge-suppression'
import { mergeDuplicatePool } from '@/features/marketing/api/influencer-maintenance'
import { ensureInfluencerSchema } from '@/features/marketing/api/influencer-discovery'
import { outreachSetClause } from '@/features/marketing/api/outreach-status-ingest'
import { NOT_SUPPRESSED_SQL } from '@/features/marketing/api/influencer-send-guard'
import { adminAdsInfluencerRoutes } from '@/features/marketing/api/admin-ads-influencers.routes'
import { adminRbacMiddleware, isLeadExportPath } from '@/worker/middleware/admin-rbac'
import { drainOutreachEmails } from '@/features/marketing/api/outreach-email'
import { stripComments } from '../helpers/source-text'

const now = () => Math.floor(Date.now() / 1000)
async function leadsDb() {
  const raw = openLiveSchema()
  const DB = d1(raw)
  await ensureInfluencerSchema(DB)
  await ensureSuppressionColumns(DB)
  for (const c of ['opened_at TEXT', 'replied_at TEXT', 'last_event_at TEXT']) { try { raw.exec(`ALTER TABLE ad_influencer_leads ADD COLUMN ${c}`) } catch { /* 이미 있음 */ } }
  const lead = (v: Record<string, unknown>) => insert(raw, 'ad_influencer_leads', { account_id: 0, platform: 'youtube', name: '시험리드', status: 'new', ...v })
  const row = (id: number) => q1<Record<string, unknown>>(raw, 'SELECT id, email, status, opted_out, email_status, campaign_sent_at, exported_at, is_brand, contacted_at FROM ad_influencer_leads WHERE id = ?', id)
  return { raw, DB, lead, row }
}

describe('① 병합 — 보내지 말아야 할 이유는 그룹 전체에서 모은다', () => {
  it('순수 판정: 하나라도 거부면 거부 · 가장 나쁜 메일 상태 · 최근 발송 · 가장 이른 내보내기 · 하나라도 브랜드', () => {
    expect(mergedSuppression([
      { opted_out: 0, email_status: 'sent', campaign_sent_at: '2026-11-01 00:00:00', exported_at: '2026-11-10 00:00:00', is_brand: 0 },
      { opted_out: 1, email_status: 'bounced', campaign_sent_at: '2026-11-20 00:00:00', exported_at: '2026-10-01 00:00:00', is_brand: 1 },
    ])).toEqual({ optedOut: 1, emailStatus: 'bounced', campaignSentAt: '2026-11-20 00:00:00', exportedAt: '2026-10-01 00:00:00', isBrand: 1 })
    expect(mergedSuppression([{ email_status: 'opened' }, { email_status: 'complained' }])).toMatchObject({ optedOut: 0, emailStatus: 'complained' })
    expect(mergedSuppression([{ email_status: 'opened' }, { email_status: 'opt_out' }]).optedOut).toBe(1)
    expect(mergedSuppression([{ email_status: 'opened' }, {}])).toEqual({ optedOut: 0, emailStatus: 'opened', campaignSentAt: null, exportedAt: null, isBrand: 0 })
  })

  it('실제 병합: 구독자가 많은 행이 대표가 돼도, 지워지는 행의 수신거부·반송·거절·발송 이력이 남는다', async () => {
    const { DB, lead, row, raw } = await leadsDb()
    const keep = lead({ email: 'same@example.test', subscriber_count: 90000, channel_id: 'yt-1' })
    lead({ email: 'same@example.test', platform: 'naver_blog', subscriber_count: 100, channel_id: 'blog-1', opted_out: 1, email_status: 'bounced', status: 'rejected', campaign_sent_at: '2026-11-20 00:00:00', exported_at: '2026-10-01 00:00:00', is_brand: 1 })
    const r = await mergeDuplicatePool(DB)
    expect(r.mergedEmail).toBe(1)
    expect(q1<{ n: number }>(raw, 'SELECT COUNT(*) n FROM ad_influencer_leads')?.n).toBe(1)
    expect(row(keep)).toMatchObject({ opted_out: 1, email_status: 'bounced', status: 'rejected', campaign_sent_at: '2026-11-20 00:00:00', exported_at: '2026-10-01 00:00:00', is_brand: 1 })
  })

  it('보낼 수 있는 리드 판정에서 빠진다(방향 문서의 정의)', async () => {
    const { DB, lead, raw } = await leadsDb()
    lead({ email: 'a@example.test', subscriber_count: 5000, channel_id: 'yt-2' })
    lead({ email: 'a@example.test', platform: 'naver_blog', channel_id: 'blog-2', opted_out: 1 })
    await mergeDuplicatePool(DB)
    const sendable = q1<{ n: number }>(raw, "SELECT COUNT(*) n FROM ad_influencer_leads WHERE email <> '' AND opted_out = 0 AND COALESCE(is_brand,0) = 0 AND contacted_at IS NULL")?.n
    expect(sendable).toBe(0)
  })
})

describe('② 수신거부 기록 — 문서가 가리키는 길이 실제로 적는다', () => {
  it('PATCH /influencer-pool/:id {opted_out:1} → opted_out=1 · 메일 상태 opt_out (종전: 400 "변경 항목 없음")', async () => {
    const { raw, DB, lead, row } = await leadsDb()
    const id = lead({ email: 'optout@example.test', channel_id: 'yt-3' })
    const adminId = insert(raw, 'admins', { username: 'sup', email: 'sup@example.test', password_hash: 'x', name: 'sup', role: 'super_admin' })
    const tok = await sign({ type: 'admin', sub: String(adminId), admin_id: adminId, userId: adminId, role: 'super_admin', iat: now(), exp: now() + 3600 }, SECRET)
    const app = new Hono()
    app.route('/api/admin/ads', adminAdsInfluencerRoutes)
    const { ctx, drain } = makeCtx()
    const res = await app.request(`/api/admin/ads/influencer-pool/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}`, 'CF-Connecting-IP': '203.0.113.9', 'User-Agent': 'Mozilla/5.0 adsup' }, body: JSON.stringify({ opted_out: 1 }) }, { DB, JWT_SECRET: SECRET, ENVIRONMENT: 'development' }, ctx)
    await drain()
    expect(res.status, await res.text()).toBe(200)
    expect(row(id)).toMatchObject({ opted_out: 1, email_status: 'opt_out' })
  })
  it('해제는 이 길로 받지 않는다(0 을 보내도 그대로)', () => {
    const src = stripComments(readFileSync('src/features/marketing/api/admin-ads-influencers.routes.ts', 'utf8'))
    expect(src).toContain("if (b.opted_out === 1 || b.opted_out === true) sets.push(\"opted_out = 1\", \"email_status = 'opt_out'\")")
    expect(src).not.toMatch(/opted_out\s*=\s*0/)
  })
})

describe('③ 결과 업로드·웹훅 — 나쁜 표시는 덮이지 않는다', () => {
  const apply = async (start: string | null, status: Parameters<typeof outreachSetClause>[0]) => {
    const { raw, lead, row } = await leadsDb()
    const id = lead({ email: 'r@example.test', channel_id: `c-${status}-${start}`, email_status: start })
    const set = outreachSetClause(status)
    const stmt = raw.prepare(`UPDATE ad_influencer_leads SET ${set.sql} WHERE id = ?`)
    if (set.usesAt) stmt.run('2026-11-25 00:00:00', id); else stmt.run(id)
    return row(id)!
  }
  it("반송된 주소에 '발송함'·'열람' 을 올려도 반송 그대로다", async () => {
    expect((await apply('bounced', 'sent')).email_status).toBe('bounced')
    expect((await apply('complained', 'opened')).email_status).toBe('complained')
    expect((await apply('opt_out', 'replied')).email_status).toBe('opt_out')
    expect((await apply(null, 'sent')).email_status).toBe('sent')
  })
  it('스팸 신고는 반송을 덮지만 수신거부는 덮지 않는다 · 수신거부는 반송으로 덮이지 않는다', async () => {
    expect((await apply('bounced', 'complained')).email_status).toBe('complained')
    expect((await apply('opt_out', 'complained')).email_status).toBe('opt_out')
    expect((await apply('complained', 'bounced')).email_status).toBe('complained')
    expect((await apply('opt_out', 'bounced')).email_status).toBe('opt_out')
  })
  it('웹훅의 거부 회신은 opted_out 을 켠다(스팸 신고는 메일 상태로 막는다 — 발송 조건이 그 상태를 뺀다)', () => {
    const src = stripComments(readFileSync('src/features/marketing/api/outreach-webhook.ts', 'utf8'))
    expect(NOT_SUPPRESSED_SQL).toContain("'complained'")
    expect(src).toContain("email_status='opt_out', opted_out=1")
  })
})

describe('④⑤ 발송 — 수신거부·야간', () => {
  it('어드민 발송 버튼 둘 다 수신거부 조건을 쓴다 · 콜드는 브랜드와 이미 연락한 리드도 뺀다', () => {
    const src = stripComments(readFileSync('src/features/marketing/api/admin-ads-influencers.routes.ts', 'utf8'))
    expect(src.split('${NOT_SUPPRESSED_SQL}').length - 1).toBe(2)
    expect(src).toContain('${NOT_SUPPRESSED_SQL} AND COALESCE(is_brand, 0) = 0 AND contacted_at IS NULL')
    expect(NOT_SUPPRESSED_SQL).toContain('COALESCE(opted_out, 0) = 0')
    expect(NOT_SUPPRESSED_SQL).toContain("'opt_out'")
  })
  it('판매자 제안 메일 드립은 밤(21~08시 KST)에 DB 에 손도 안 댄다', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-25T14:30:00Z')) // 23:30 KST
    let touched = 0
    const DB = new Proxy({}, { get: () => { touched++; return () => { throw new Error('DB touched at night') } } })
    await drainOutreachEmails({ RESEND_API_KEY: 'x', DB } as never)
    vi.useRealTimers()
    expect(touched).toBe(0)
  })
})

describe('⑥ 명단 내보내기 — 읽기 전용 어드민은 받을 수 없다', () => {
  it('내보내기 주소 판정', () => {
    expect(isLeadExportPath('/api/admin/ads/influencer-pool/export')).toBe(true)
    expect(isLeadExportPath('/api/admin/partner-pool/export?format=csv')).toBe(true)
    expect(isLeadExportPath('/api/admin/store-prospects/export')).toBe(true)
    expect(isLeadExportPath('/api/admin/ads/influencer-pool')).toBe(false)
    expect(isLeadExportPath('/api/admin/partner-pool/stats')).toBe(false)
  })
  it('viewer 의 GET 내보내기는 403 · 목록 조회는 통과 · super 는 내보내기 통과', async () => {
    const app = new Hono()
    app.use('/api/admin/*', adminRbacMiddleware())
    app.get('/api/admin/ads/influencer-pool/export', (c) => c.text('csv'))
    app.get('/api/admin/ads/influencer-pool', (c) => c.text('list'))
    const call = async (role: string, path: string) => {
      const tok = await sign({ type: 'admin', sub: '1', admin_id: 1, userId: 1, role, iat: now(), exp: now() + 3600 }, SECRET)
      return (await app.request(path, { headers: { Authorization: `Bearer ${tok}` } }, { JWT_SECRET: SECRET })).status
    }
    expect(await call('viewer', '/api/admin/ads/influencer-pool/export')).toBe(403)
    expect(await call('viewer', '/api/admin/ads/influencer-pool')).toBe(200)
    expect(await call('super_admin', '/api/admin/ads/influencer-pool/export')).toBe(200)
  })
})

describe('⑦ 셀러용 인플루언서 목록 — 공용 풀만 보인다', () => {
  it('목록·카테고리 집계 둘 다 account_id = 0 으로 묶는다(유어애즈 고객 계정이 따로 모은 리드가 섞이지 않는다)', () => {
    const src = stripComments(readFileSync('src/features/seller/api/seller-influencers.routes.ts', 'utf8'))
    expect(src).toContain('"account_id = 0",')
    expect(src).toContain("WHERE account_id = 0 AND category IS NOT NULL")
    expect(src.split('FROM ad_influencer_leads').length - 1).toBe(3)
  })
})
