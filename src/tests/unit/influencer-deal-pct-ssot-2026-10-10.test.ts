/**
 * 🎯 **매장의 인플루언서 커미션 상한이 협업 코드에서만 지켜졌다** (2026-10-10 감사)
 *
 * ■ 무엇이 깨져 있었나
 *   중개 매장 요율의 `influencer_pct_cap` 은 협업 코드 발급·딜 조정·코드 입력에서만 검사됐다. 매장이 직접
 *   제안하는 딜(`/deals/propose` 양방향)·아웃리치 제안(접수·수락)은 `≤ 90` 만 봐서 상한을 넘는 딜이
 *   그대로 계약됐고, 중개사 몫이 있는 매장에선 `중개사 몫 + 인플 %` 가 90 을 넘는 딜(매장이 팔수록
 *   손해)도 만들어졌다.
 *
 * ■ 고친 방법 — 검증 SSOT 하나(`validateInfluencerDealPct` / `checkStoreInfluencerPct` / `influencerPctCeiling`)
 *   를 모든 딜 작성 경로가 부른다. 이 시험은 ① 규칙 경계를 순수 함수로 ② 각 경로가 **실제로 부르는지**를
 *   호출 형태로(import 줄이 아니라) 본다.
 *
 * ■ 못 보는 것
 *   - 결제 시점 % 계산(`findActiveDealPct`)은 **작성 시점에 막힌 값**을 믿는다 — 딜을 만든 뒤 매장이 상한을
 *     낮추면 기존 딜은 그대로다(종전 동작, 별건).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { validateInfluencerDealPct, influencerPctCeiling } from '@/worker/utils/broker-share'

describe('① 규칙 경계', () => {
  const none = { sharePct: 0, influencerCapPct: null }
  it('범위 0 < pct ≤ 90 (정산 clamp 와 같은 값) — 큰 % 도 상한이 없으면 통과한다', () => {
    expect(validateInfluencerDealPct(50, none)).toEqual({ ok: true, pct: 50 })
    expect(validateInfluencerDealPct(90, none).ok).toBe(true)
    expect(validateInfluencerDealPct(90.5, none).ok).toBe(false)
    expect(validateInfluencerDealPct(0, none).ok).toBe(false)
    expect(validateInfluencerDealPct('abc', none).ok).toBe(false)
  })
  it('allowZero 면 0 을 받는다(아웃리치 무커미션 제안) — 음수는 여전히 거절', () => {
    expect(validateInfluencerDealPct(0, none, { allowZero: true }).ok).toBe(true)
    expect(validateInfluencerDealPct(-1, none, { allowZero: true }).ok).toBe(false)
  })
  it('매장 상한이 있으면 그 위는 거절', () => {
    const t = { sharePct: 10, influencerCapPct: 5 }
    expect(validateInfluencerDealPct(5, t).ok).toBe(true)
    const r = validateInfluencerDealPct(6, t)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toMatch(/상한은 5%/)
  })
  it('상한이 없어도 중개사 몫과의 합은 90 을 넘지 못한다', () => {
    const t = { sharePct: 30, influencerCapPct: null }
    expect(validateInfluencerDealPct(60, t).ok).toBe(true)
    const r = validateInfluencerDealPct(61, t)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toMatch(/최대 60%/)
  })
  it('천장 = min(90, 90 − 중개사 몫, 상한)', () => {
    expect(influencerPctCeiling({ sharePct: 0, influencerCapPct: null })).toBe(90)
    expect(influencerPctCeiling({ sharePct: 30, influencerCapPct: null })).toBe(60)
    expect(influencerPctCeiling({ sharePct: 10, influencerCapPct: 5 })).toBe(5)
  })
})

describe('② 배선 — 딜 % 를 쓰는 모든 경로가 SSOT 를 부른다', () => {
  const src = (p: string) => stripComments(readFileSync(p, 'utf8'))
  it('매장·인플루언서 제안 양방향', () => {
    const s = src('src/features/group-buy/api/marketing.routes.ts')
    expect((s.match(/const pv = await checkStoreInfluencerPct\(c\.env\.DB, sellerId, body\.commission_pct\)/g) || []).length).toBe(2)
    expect((s.match(/if \(!pv\.ok\) return c\.json\(\{ success: false, error: pv\.error \}, 400\)/g) || []).length).toBe(2)
  })
  it('아웃리치 제안 접수·수락', () => {
    const accept = src('src/features/marketing/api/influencer-offer-invites.routes.ts')
    const at = accept.indexOf('await checkStoreInfluencerPct(db, Number(inv.seller_id), inv.commission_pct, { allowZero: true })')
    expect(at).toBeGreaterThan(0)
    expect(accept.indexOf("SET status = 'accepted'"), 'CAS 전에 검증해야 막힌 토큰이 pending 으로 남는다').toBeGreaterThan(at)
    expect(accept, '검증만 하고 막지 않으면 헛도는 가드다')
      .toMatch(/if \(!pv\.ok\) \{\s*return c\.json\(\{ success: false, code: 'OFFER_PCT_OVER_STORE_TERMS'/)
    expect(src('src/features/seller/api/seller-influencers.routes.ts'))
      .toMatch(/await checkStoreInfluencerPct\(db, Number\(sellerId\), b\.commission_pct, \{ allowZero: true \}\)/)
  })
  it('협업 코드 발급·딜 조정은 SSOT 에 위임하고, 코드 입력·미리보기는 천장으로 자른다', () => {
    const codes = src('src/features/group-buy/api/marketing/collab-codes.ts')
    expect(codes).toMatch(/return validateInfluencerDealPct\(raw, terms\)/)
    expect((codes.match(/const v = checkPct\(b\.commission_pct, terms\)/g) || []).length).toBe(2)
    expect(codes).toMatch(/influencerPctCeiling\(terms\)\)/)
    expect(src('src/worker/utils/influencer-code-redeem.ts'))
      .toMatch(/Math\.min\(resolveCodeCommissionPct\(c\.commission_pct, terms\.influencerCapPct\), influencerPctCeiling\(terms\)\)/)
  })
})
