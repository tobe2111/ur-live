/**
 * 🔗 **딜 링크로 팔리면 그 소개자에게 귀속된다** · 🛑 **영입 몫은 기본 꺼짐** (2026-10-10 대표 *"1. 고쳐줘 2. 몫 꺼줘"*)
 *
 * ## G1 — 무엇이 깨져 있었나
 * 딜 링크·유어샵·핀은 소개자를 `affiliate_ref`(localStorage + 쿠키)에 심고 `lib/api.ts` 가 모든 요청에
 * `X-Affiliate-Ref` 헤더로 싣는다. 그런데 이용권 구매(`/join`·`/confirm-toss`·장바구니)는 **본문 `ref`** 만
 * 읽었고, 화면은 본문에 다른 저장소(`?seller=`)만 넣었다 ⇒ 딜 커미션이 안 붙었다.
 *
 * ## G2 — 무엇을 없앴나 (대표 *"몫 꺼줘"* → 다음 날 *"마저 폐지해줘. 모두 다"*)
 * `recordIntroductionCommissionShare` 는 이용권 사용마다 유어딜 수수료의 20% 를 영입자에게 줬고
 * 직접 입점 여부를 보지 않았다. 처음엔 게이트로 껐다가, 대표 지시로 **함수·호출·어드민 입력을 통째로
 * 삭제**했다(결제 레일 영입 2% 는 2026-09 에 이미 폐지). 폐지 시점 라이브: 원장 0행 · 영입 매장 0곳.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - 실제 HTTP 요청에 헤더·쿠키가 실리는지(브라우저) — staging 실결제로 본다(STAGING_CHECKLIST S-MATCH).
 * - 커미션 금액 계산 자체(그건 `calcInfluencerCommissionPct` 시험의 몫).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { pickGbRefSource } from '@/features/group-buy/api/gb-purchase-guards'
import { stripComments } from '../helpers/source-text'

describe('🔗 pickGbRefSource — 본문 → 헤더 → 쿠키', () => {
  it('본문이 있으면 본문 그대로 (종전과 byte-동일)', () => {
    expect(pickGbRefSource('77', '11', '22')).toBe('77')
    expect(pickGbRefSource(' seller:5 ', '11', null)).toBe('seller:5')
  })
  it('🔴 본문이 없으면 헤더 — 딜 링크가 심은 소개자 (이게 깨져 있던 것)', () => {
    expect(pickGbRefSource(undefined, '11', '22')).toBe('11')
    expect(pickGbRefSource('', '11', null)).toBe('11')
  })
  it('헤더도 없으면 쿠키 (localStorage 가 유실된 재방문)', () => {
    expect(pickGbRefSource(null, null, '22')).toBe('22')
  })
  it('헤더·쿠키는 숫자 1~12자리만 — 클라 저장 규칙과 같은 모양', () => {
    expect(pickGbRefSource(null, 'abc', '22')).toBe('22')
    expect(pickGbRefSource(null, '1234567890123', 'x')).toBe('')
    expect(pickGbRefSource(undefined, undefined, undefined)).toBe('')
  })
})

describe('🔌 배선 — 이용권 구매 세 곳이 같은 출처·같은 자기귀속 판정을 쓴다', () => {
  const gb = stripComments(readFileSync('src/features/group-buy/api/group-buy.routes.ts', 'utf8'))
  const cart = stripComments(readFileSync('src/features/group-buy/api/cart-checkout.routes.ts', 'utf8'))
  const SRC = /pickGbRefSource\((?:ref|body\.ref), c\.req\.header\('X-Affiliate-Ref'\), getCookie\(c, 'affiliate_ref'\)\)/g

  it('/join 과 /confirm-toss 둘 다', () => {
    expect((gb.match(SRC) || []).length).toBe(2)
    expect(gb).not.toMatch(/body\.ref \? String\(body\.ref\)\.trim\(\)/)
  })
  it('/confirm-toss 도 isSelfReferral (연결 셀러 id 로 자기 커미션 차단 — /join 과 같은 판정)', () => {
    const fn = gb.slice(gb.indexOf("groupBuyRoutes.post('/confirm-toss'"))
    expect(fn).toMatch(/referralInfluencerId && await isSelfReferral\(DB, referralInfluencerId, userId\)\) referralInfluencerId = ''/)
    expect(fn).not.toMatch(/referralInfluencerId === userId\) referralInfluencerId = ''/)
  })
  it('장바구니 결제 시작도 같은 출처 + 같은 자기귀속 판정', () => {
    expect(cart).toMatch(/normalizeRef\(DB, pickGbRefSource\(body\.ref, c\.req\.header\('X-Affiliate-Ref'\), getCookie\(c, 'affiliate_ref'\)\), userId\)/)
    expect(cart).toMatch(/await isSelfReferral\(DB, s, userId\)\) return ''/)
  })
})

describe('🛑 영입 셰어 — 폐지 (함수·호출·어드민 입력 0)', () => {
  const ledger = stripComments(readFileSync('src/worker/utils/ledger.ts', 'utf8'))
  const use = stripComments(readFileSync('src/features/group-buy/api/group-buy-voucher.routes.ts', 'utf8'))
  it('ledger.ts 에 함수가 없다', () => {
    expect(ledger).not.toMatch(/export async function recordIntroductionCommissionShare/)
  })
  it('이용권 사용 처리 두 경로가 부르지 않는다', () => {
    expect(use).not.toMatch(/recordIntroductionCommissionShare/)
  })
  it('어드민에서 % 를 다시 넣을 길이 없다 (화면·API 둘 다)', () => {
    const page = stripComments(readFileSync('src/pages/AdminPayoutsPage.tsx', 'utf8'))
    const api = stripComments(readFileSync('src/features/admin/api/admin-payouts.routes.ts', 'utf8'))
    expect(page).not.toMatch(/influencer_intro_share_pct/)
    expect(api).not.toMatch(/\['influencer_intro_share_pct'/)
  })
  it('하루 쓰고 버린 게이트가 남아 "켜면 돈다" 는 오해를 만들지 않는다', () => {
    const ops = readFileSync('src/features/admin/api/admin-system-monitoring.routes.ts', 'utf8')
    expect(ops).not.toMatch(/influencer_intro_share_enabled/)
    expect(readFileSync('src/worker/utils/platform-settings-validation.ts', 'utf8')).not.toMatch(/influencer_intro_share_enabled/)
  })
})
