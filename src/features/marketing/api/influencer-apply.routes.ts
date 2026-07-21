/**
 * 📥 2026-07-20 유어애즈 — 크리에이터 제휴 인바운드 신청 (공개, 비로그인).
 *   "유어딜 제휴 크리에이터 모집" 페이지에서 인플루언서가 **스스로 신청** → 공용 풀에 저장.
 *   ⚖️ 신청 = **사전 수신동의**(정보통신망법) → 이 리드는 이후 자유롭게 연락 가능(source='inbound', consented_at 기록).
 *   ⚠️ 공개 엔드포인트라 rate-limit + 입력검증 + 동의 필수. 스팸 방어(중복 URL 멱등).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { ensureInfluencerSchema } from './influencer-discovery'
import { welcomeEmail, textToHtml } from './outreach-send'
import { sendEmail } from '@/services/email'

const app = new Hono<{ Bindings: Env }>()
const POOL = 0 // 공용 풀 센티넬

const PLATFORMS = ['youtube', 'instagram', 'naver_blog', 'tistory', 'tiktok', 'etc']
const CATEGORIES = ['맛집', '카페', '뷰티', '네일', '숙소', '패션', '여행', '육아', '기타']
const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

// POST /api/creator-apply — 신청 접수(공개). body: { name, platform, url, category, email?, contact?, message?, agree }
app.post('/', rateLimit({ action: 'creator-apply', max: 10, windowSec: 3600 }), async (c) => {
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const name = clean(b.name, 80)
  const platform = PLATFORMS.includes(String(b.platform)) ? String(b.platform) : 'etc'
  const url = clean(b.url, 300)
  const category = CATEGORIES.includes(String(b.category)) ? String(b.category) : '기타'
  const email = clean(b.email, 120).toLowerCase()
  const contact = clean(b.contact, 120) // 인스타/카톡/전화 등 자유 연락처
  const message = clean(b.message, 500)
  if (!name || name.length < 2) return c.json({ success: false, error: '이름/채널명을 입력해주세요' }, 400)
  if (!/^https?:\/\/.{3,}/i.test(url)) return c.json({ success: false, error: '채널 주소(URL)를 정확히 입력해주세요' }, 400)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return c.json({ success: false, error: '이메일 형식을 확인해주세요' }, 400)
  if (!email && !contact) return c.json({ success: false, error: '이메일 또는 연락처(인스타·카톡 등) 중 하나는 입력해주세요' }, 400)
  if (b.agree !== true) return c.json({ success: false, error: '제휴 제안 수신에 동의해주세요' }, 400)

  await ensureInfluencerSchema(c.env.DB)
  const channelId = url.replace(/\/+$/, '').toLowerCase().slice(0, 200) // URL 기준 멱등(재신청 중복 방지)
  const memo = [message && `신청 메모: ${message}`, contact && `연락처: ${contact}`].filter(Boolean).join(' / ').slice(0, 500) || null
  // 신청 = 사전동의. 기존 리드면 컨택/동의만 보강(수동 상태·메모 불변), 신규면 삽입.
  await c.env.DB.prepare(`INSERT INTO ad_influencer_leads
      (account_id, platform, channel_id, name, url, email, category, source_keyword, source, memo, consented_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'inbound-신청', 'inbound', ?, datetime('now'), 'new')
    ON CONFLICT(account_id, platform, channel_id) DO UPDATE SET
      email = COALESCE(ad_influencer_leads.email, excluded.email),
      source = 'inbound',
      consented_at = COALESCE(ad_influencer_leads.consented_at, excluded.consented_at)`)
    .bind(POOL, platform, channelId, name, url, email || null, category, memo).run().catch(() => null)
  // 📨 접수 확인 메일(거래성 — 신청 행위에 대한 확인, 신청 = 사전동의라 발송 적법). fail-soft: 발송 실패가 접수를 안 막음.
  if (email && c.env.RESEND_API_KEY) {
    const send = async () => {
      const w = welcomeEmail(name)
      await sendEmail({ to: email, subject: w.subject, html: textToHtml(w.body) }, c.env.RESEND_API_KEY!, c.env.RESEND_FROM, c.env.DB).catch(() => null)
    }
    if (c.executionCtx?.waitUntil) c.executionCtx.waitUntil(send()); else await send().catch(() => null)
  }
  return c.json({ success: true, message: '신청이 접수되었습니다. 검토 후 제휴 담당자가 연락드립니다.' })
})

export { app as influencerApplyRoutes }
