/**
 * 📣 2026-08-09 캠페인 신청 API (마운트: /api/campaign) — 방배 등 상권 캠페인 인플루언서 모집.
 *
 *   "신청 = 유어딜 인플루언서 파트너 등록": 로그인(카카오 = users 행)한 유저가 프로필을 제출하면
 *   ① campaign_applications 에 신청 행(어드민 조회/CSV 의 SSOT)
 *   ② ad_influencer_leads 인바운드 upsert(유어애즈 풀 — 제안 발송 대상, fail-soft)
 *   ③ 응답으로 ref 링크(users.id 기반 — 가입 즉시 유효, inflow_clicks 로 클릭 적재).
 *
 *   💸 머니 무접촉 — 결제/정산/적립 경로를 일절 건드리지 않는다(신청 데이터 수집만).
 *   동의 2종(개인정보 수집·이용 / 마케팅 수신)은 서버가 강제하고 시각을 증적으로 남긴다.
 *   멱등: UNIQUE(campaign_code, user_id) + upsert — 재제출은 프로필 갱신(중복 행 0).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'
import { resolveUserIdString } from '@/worker/utils/resolve-user-id'
import { getSignupCampaign, CAMPAIGN_CATEGORIES, buildCampaignRefLink } from '@/shared/campaign-signup'
import { ensureInfluencerSchema } from './influencer-discovery'
import { ensureClaimSchema } from './lead-claim'
import { adsLeadsDb } from '../../../shared/ads/leads-db'

const app = new Hono<{ Bindings: Env }>()
const POOL = 0 // ad_influencer_leads 공용 풀 센티넬(influencer-apply.routes 와 동일)

const PLATFORMS = ['youtube', 'instagram', 'naver_blog', 'tistory', 'tiktok', 'etc']
const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

const _tableDone = new WeakSet<object>()
export async function ensureCampaignApplicationsTable(DB: D1Database): Promise<void> {
  if (_tableDone.has(DB)) return
  _tableDone.add(DB)
  // 자기신고 프로필은 텍스트로 보존(측정 컬럼에 쓰지 않는 기존 규칙 — influencer-apply.routes :33-34).
  await DB.prepare(`CREATE TABLE IF NOT EXISTS campaign_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_code TEXT NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT,
    phone TEXT,
    email TEXT,
    contact TEXT,
    platform TEXT,
    account_url TEXT NOT NULL,
    category TEXT,
    region TEXT,
    follower_size TEXT,
    collab_terms TEXT,
    privacy_agreed_at TEXT,
    marketing_agreed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(campaign_code, user_id)
  )`).run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_campaign_apps_code ON campaign_applications(campaign_code, created_at DESC)')
    .run().catch(() => null)
}

// GET /api/campaign/:code/me — 재방문 시 내 신청 여부(완료 화면 복원용). 로그인 필수.
app.get('/:code/me', requireAuth(), async (c) => {
  const campaign = getSignupCampaign(c.req.param('code'))
  if (!campaign) return c.json({ success: false, error: '알 수 없는 캠페인입니다' }, 404)
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  await ensureCampaignApplicationsTable(adsLeadsDb(c.env))
  const uid = await resolveUserIdString(adsLeadsDb(c.env), user.id, user.isDbId)
  const row = await adsLeadsDb(c.env).prepare(
    'SELECT id, created_at FROM campaign_applications WHERE campaign_code = ? AND user_id = ?',
  ).bind(campaign.code, uid).first<{ id: number; created_at: string }>().catch(() => null)
  return c.json({
    success: true,
    data: { applied: !!row, applied_at: row?.created_at ?? null, ref_link: row ? buildCampaignRefLink(uid, campaign.code) : null },
  })
})

// POST /api/campaign/:code/apply — 신청 접수(로그인 필수). 재제출 = 프로필 갱신(멱등).
app.post('/:code/apply', rateLimit({ action: 'campaign-apply', max: 10, windowSec: 3600 }), requireAuth(), async (c) => {
  const campaign = getSignupCampaign(c.req.param('code'))
  if (!campaign) return c.json({ success: false, error: '알 수 없는 캠페인입니다' }, 404)
  if (!campaign.active) return c.json({ success: false, error: '접수가 종료된 캠페인입니다' }, 400)
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const platform = PLATFORMS.includes(String(b.platform)) ? String(b.platform) : 'etc'
  const accountUrl = clean(b.account_url, 300)
  const category = CAMPAIGN_CATEGORIES.includes(String(b.category)) ? String(b.category) : '기타'
  const region = clean(b.region, 60)
  const followers = clean(b.follower_size, 20).replace(/[^\d]/g, '').slice(0, 9) // 자기신고 — 텍스트 보존
  const collabTerms = clean(b.collab_terms, 500)
  const contact = clean(b.contact, 120)
  if (!/^https?:\/\/.{3,}/i.test(accountUrl)) return c.json({ success: false, error: '활동 계정 주소(URL)를 정확히 입력해주세요' }, 400)
  // 동의 2종 — 캠페인 신청의 목적 자체가 선정 안내·다음 캠페인 안내라 둘 다 필수(철회 안내는 폼에 명시).
  if (b.privacy_agree !== true) return c.json({ success: false, error: '개인정보 수집·이용에 동의해주세요' }, 400)
  if (b.marketing_agree !== true) return c.json({ success: false, error: '캠페인 안내 수신에 동의해주세요' }, 400)

  const DB = adsLeadsDb(c.env)
  await ensureCampaignApplicationsTable(DB)
  const uid = await resolveUserIdString(DB, user.id, user.isDbId)
  // 연락처 스냅샷 — 어드민 목록/CSV 에서 바로 쓰도록 users 값을 복사(카카오 가입은 phone 이 없을 수 있어 폼 contact 병행).
  const u = await DB.prepare('SELECT name, phone, email FROM users WHERE id = ?')
    .bind(uid).first<{ name: string | null; phone: string | null; email: string | null }>().catch(() => null)

  await DB.prepare(`INSERT INTO campaign_applications
      (campaign_code, user_id, name, phone, email, contact, platform, account_url, category, region,
       follower_size, collab_terms, privacy_agreed_at, marketing_agreed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(campaign_code, user_id) DO UPDATE SET
      contact = excluded.contact,
      platform = excluded.platform,
      account_url = excluded.account_url,
      category = excluded.category,
      region = excluded.region,
      follower_size = excluded.follower_size,
      collab_terms = excluded.collab_terms,
      -- 동의 시각은 최초값 보존(증적) — 재제출로 갱신하지 않는다.
      privacy_agreed_at = COALESCE(campaign_applications.privacy_agreed_at, excluded.privacy_agreed_at),
      marketing_agreed_at = COALESCE(campaign_applications.marketing_agreed_at, excluded.marketing_agreed_at),
      updated_at = datetime('now')`)
    .bind(campaign.code, uid, u?.name ?? user.name ?? null, u?.phone ?? null, u?.email ?? user.email ?? null,
      contact || null, platform, accountUrl, category, region || null, followers || null, collabTerms || null)
    .run()

  // 유어애즈 인플루언서 풀 동기화(fail-soft) — 신청자가 제안 발송 대상 풀에도 잡히도록.
  //   influencer-apply.routes 의 인바운드 upsert 와 동일 멱등키(account_id, platform, channel_id).
  try {
    await ensureInfluencerSchema(DB)
    await ensureClaimSchema(DB)
    const channelId = accountUrl.replace(/\/+$/, '').toLowerCase().slice(0, 200)
    const selfProfile = [
      '[자기신고]', region && `지역: ${region}`, followers && `팔로워: ${Number(followers).toLocaleString()}`,
      collabTerms && `희망조건: ${collabTerms}`, `분야: ${category}`,
    ].filter(Boolean).join(' · ').slice(0, 400)
    await DB.prepare(`INSERT INTO ad_influencer_leads
        (account_id, platform, channel_id, name, url, email, category, source_keyword, source, description, consented_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'inbound', ?, datetime('now'), 'new')
      ON CONFLICT(account_id, platform, channel_id) DO UPDATE SET
        email = COALESCE(ad_influencer_leads.email, excluded.email),
        source = 'inbound',
        description = COALESCE(NULLIF(ad_influencer_leads.description, ''), excluded.description),
        consented_at = COALESCE(ad_influencer_leads.consented_at, excluded.consented_at)`)
      .bind(POOL, platform, channelId, u?.name ?? user.name ?? '캠페인 신청자', accountUrl, u?.email ?? null,
        category, `campaign-${campaign.code}`, selfProfile).run().catch(() => null)
    // 리드 ↔ 유저 연결(측정 전용, 덮어쓰기 없음 — lead-claim 규칙과 동일). 부분 UNIQUE 인덱스가 이중 방어.
    const numericUid = Number(uid)
    if (Number.isFinite(numericUid) && numericUid > 0) {
      await DB.prepare(`UPDATE ad_influencer_leads
          SET linked_user_id = ?, joined_at = COALESCE(joined_at, datetime('now'))
          WHERE account_id = ? AND platform = ? AND channel_id = ? AND linked_user_id IS NULL
            AND NOT EXISTS (SELECT 1 FROM ad_influencer_leads WHERE linked_user_id = ? AND account_id = ?)`)
        .bind(numericUid, POOL, platform, channelId, numericUid, POOL).run().catch(() => null)
    }
  } catch { /* 풀 동기화 실패가 신청 접수를 막지 않는다 */ }

  return c.json({
    success: true,
    message: '신청이 접수되었습니다.',
    data: { ref_link: buildCampaignRefLink(uid, campaign.code) },
  })
})

export { app as campaignApplyRoutes }
