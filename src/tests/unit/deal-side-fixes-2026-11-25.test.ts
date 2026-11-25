/**
 * 💬 딜·유저 쪽 다섯 가지 (2026-11-25 대표 *"끝까지 다 고쳐줘"*)
 *
 * ① 리뷰 보상이 장부에 '충전(charge)' 으로 적혀 딜 환급 한도(충전 합)를 부풀렸다
 * ② 무상 보상(초대·부트캠프)이 `total_charged` 를 올려 같은 한도를 부풀렸다
 * ③ 다섯 화면이 꺼진 길(친구 초대·유어샵 추천)로 딜을 모으라고 안내했다
 * ④ 라이브가 영구 중단인데 후원(딜 → 셀러 현금 정산) 서버 경로가 열려 있었다
 * ⑤ 리뷰어 레벨을 올릴 길이 꺼져 있는데 레벨 잠금은 살아 있었다(걸리면 영영 못 산다)
 * ⑥ 환불이 이미 지급된 소개비에 닿으면 아무 흔적이 없었다 → 어드민 알림
 *
 * 못 막는 것: 환급 한도 식 자체는 그대로다(충전 합 = `type='charge'`). 결제 키 없는 옛 'charge' 행은 여전히 센다.
 */
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { readFileSync } from 'node:fs'
import { d1, openLiveSchema, insert, q, userToken, makeCtx, SECRET } from '../helpers/live-d1'
import { REFUNDABLE_SQL, refundableBinds } from '@/worker/utils/deal-refund'
import { requiredReviewLevel } from '@/worker/utils/review-level'
import { KAKAO_REVIEW_BONUS_ENABLED, LIVE_COMMERCE_SUSPENDED } from '@/shared/feature-flags'
import { DEAL_EARN_HINT, DEAL_SHORT_MESSAGE } from '@/shared/deal-earn-hint'
import { clawbackVoucherCommission } from '@/features/group-buy/api/voucher-clawback'
import { pointsRoutes } from '@/features/points/api/points.routes'

const src = (p: string) => readFileSync(p, 'utf8')

describe('① ② 딜 환급 한도 — 무상 보상이 "충전" 으로 세어지지 않는다', () => {
  it('리뷰 보상은 review_reward 로 적힌다', () => {
    const s = src('src/features/reviews/api/reviews.routes.ts')
    expect(s).toMatch(/\.bind\(ptsUserId, 'review_reward', rewardAmount/)
    expect(s).not.toMatch(/\.bind\(ptsUserId, 'charge', rewardAmount/)
  })
  it('같은 잔액이라도: 보상이 charge 로 적히면 환급 300, review_reward 로 적히면 0', () => {
    const refundable = (type: string) => {
      const raw = openLiveSchema()
      // 유상 잔액 5,000(예: 옛 커미션이 유상 통에 들어간 경우) + 리뷰 보상 300(무상)
      insert(raw, 'user_points', { user_id: '7', balance: 5300, free_balance: 300, total_charged: 0 })
      insert(raw, 'point_transactions', { user_id: '7', type, amount: 300, points_amount: 300, balance_after: 5300, description: '[리뷰리워드] 사진 리뷰 작성 (product:1)', free_delta: 300 })
      return (raw.prepare(`SELECT ${REFUNDABLE_SQL} AS v`).get(...refundableBinds('7')) as { v: number }).v
    }
    expect(refundable('charge')).toBe(300)
    expect(refundable('review_reward')).toBe(0)
  })
  it('초대·부트캠프 보상은 total_charged 를 올리지 않는다', () => {
    for (const p of ['src/worker/utils/invite-reward.ts', 'src/features/seller/api/seller-onboarding.routes.ts']) {
      expect(src(p).split('\n').filter((l) => /^\s*bumpTotalCharged: true/.test(l)), p).toEqual([])
    }
  })
})

describe('③ 딜 안내 문구', () => {
  it('꺼진 길(초대·추천·충전)을 말하지 않는다', () => {
    for (const s of [DEAL_EARN_HINT, DEAL_SHORT_MESSAGE]) expect(s).not.toMatch(/초대|추천|충전/)
    expect(DEAL_SHORT_MESSAGE).toContain(DEAL_EARN_HINT)
  })
  it('다섯 화면이 그 한 줄을 쓴다', () => {
    for (const p of ['src/pages/ProductDetailPage.tsx', 'src/pages/group-buy/deal-join-error.ts', 'src/pages/VoucherDetailPage.tsx', 'src/pages/checkout/PaymentSection.tsx', 'src/components/IosTopupGate.tsx']) {
      const s = src(p)
      expect(s, p).toMatch(/from '@\/shared\/deal-earn-hint'/)
      expect(s, p).not.toMatch(/친구 초대·유어샵 추천/)
    }
  })
})

describe('④ 후원 경로', () => {
  it('라이브가 중단된 동안 POST /api/points/donate 는 410 이고 딜이 빠지지 않는다', async () => {
    expect(LIVE_COMMERCE_SUSPENDED).toBe(true)
    const raw = openLiveSchema()
    const uid = insert(raw, 'users', { name: '시험', email: 'd@example.test' })
    insert(raw, 'user_points', { user_id: String(uid), balance: 5000, free_balance: 5000, total_charged: 0 })
    const app = new Hono()
    app.route('/api/points', pointsRoutes)
    const { ctx, drain } = makeCtx()
    const res = await app.request('/api/points/donate', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await userToken(uid)}`, 'CF-Connecting-IP': '203.0.113.9', 'User-Agent': 'Mozilla/5.0 donate' },
      body: JSON.stringify({ stream_id: 1, amount: 1000 }),
    }, { DB: d1(raw), JWT_SECRET: SECRET, ENVIRONMENT: 'development' }, ctx)
    await drain()
    expect(res.status).toBe(410)
    expect(q(raw, 'SELECT balance FROM user_points WHERE user_id = ?', String(uid))).toEqual([{ balance: 5000 }])
  })
})

describe('⑤ 리뷰어 레벨 잠금', () => {
  it('후기 보너스가 꺼진 동안은 잠그지 않는다 (켜면 종전 규칙)', () => {
    expect(requiredReviewLevel(3)).toBe(KAKAO_REVIEW_BONUS_ENABLED ? 3 : 0)
    expect(requiredReviewLevel('')).toBe(0)
    expect(requiredReviewLevel(1)).toBe(0)
    expect(requiredReviewLevel(null)).toBe(0)
  })
  it('구매 세 곳이 같은 함수를 쓴다', () => {
    expect((src('src/features/group-buy/api/group-buy.routes.ts').match(/requiredReviewLevel\(mrlRaw\)/g) || []).length).toBe(2)
    expect((src('src/features/group-buy/api/cart-lines.ts').match(/requiredReviewLevel\(mrlRaw\)/g) || []).length).toBe(1)
  })
})

describe('⑥ 이미 지급된 소개비', () => {
  it('환불이 지급 완료된 소개비에 닿으면 어드민 알림이 남는다 (자동 회수는 하지 않는다)', async () => {
    const raw = openLiveSchema()
    const DB = d1(raw)
    const order = insert(raw, 'orders', { order_number: 'T-1', user_id: 1, total_amount: 10000, status: 'PAID' })
    const voucher = insert(raw, 'vouchers', { code: 'CLAW1', user_id: 1, product_id: 1, order_id: order, status: 'refunded', applied_price: 10000 })
    insert(raw, 'influencer_attributions', { influencer_id: '9', order_id: order, product_id: 1, seller_id: 1, commission_amount: 1000, status: 'paid', paid_at: '2026-11-10 00:00:00' })
    await clawbackVoucherCommission(DB, voucher, '시험 환불')
    const notes = q<{ type: string; message: string }>(raw, "SELECT type, message FROM dashboard_notifications WHERE recipient_type = 'admin'")
    expect(notes.map((n) => n.type)).toEqual(['commission_clawback_needed'])
    expect(notes[0].message).toContain('1,000원')
    expect(q(raw, 'SELECT status, commission_amount FROM influencer_attributions')).toEqual([{ status: 'paid', commission_amount: 1000 }])
  })
  it('미지급 소개비만 있으면 알림 없이 종전대로 회수한다', async () => {
    const raw = openLiveSchema()
    const DB = d1(raw)
    const order = insert(raw, 'orders', { order_number: 'T-2', user_id: 1, total_amount: 10000, status: 'PAID' })
    const voucher = insert(raw, 'vouchers', { code: 'CLAW2', user_id: 1, product_id: 1, order_id: order, status: 'refunded', applied_price: 10000 })
    insert(raw, 'influencer_attributions', { influencer_id: '9', order_id: order, product_id: 1, seller_id: 1, commission_amount: 1000, status: 'pending' })
    await clawbackVoucherCommission(DB, voucher, '시험 환불')
    const tables = q<{ name: string }>(raw, "SELECT name FROM sqlite_master WHERE name = 'dashboard_notifications'")
    const n = tables.length ? q(raw, "SELECT id FROM dashboard_notifications WHERE type = 'commission_clawback_needed'").length : 0
    expect(n).toBe(0)
  })
})
