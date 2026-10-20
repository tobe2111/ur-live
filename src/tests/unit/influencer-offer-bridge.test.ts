/**
 * 📣 인플루언서 제안 수락 다리 + 심플 커미션 모델 — 2026-08-22 대표 확정
 *   ① "어필리에이트 전략은 빼려고 해. 심플하게" — 유저/큐레이터 링크 커미션 종료(스위치 기본 OFF)
 *   ② 인플루언서 수익 = 매장 제안 딜 % 하나 — 딜 % 는 플랫폼 캡에 잘리지 않는다
 *   ③ 수락 다리: CAS 선점 후에만 딜 발효(재사용·동시수락 차단) — 머니 룰 #1
 *
 * ⚠️ 이 테스트가 못 막는 것: 실제 D1 동작(수락→적립→지급 E2E — staging 판정),
 *   라이브 platform_settings 값(어드민 설정은 코드 밖).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { calcInfluencerCommissionPct, type CommissionRates } from '../../features/group-buy/api/commission-rates'

const read = (p: string) => readFileSync(p, 'utf8')
const invites = read('src/features/marketing/api/influencer-offer-invites.routes.ts')
const affiliate = read('src/worker/utils/affiliate-credit.ts')
const rates = read('src/features/group-buy/api/commission-rates.ts')
const sellerList = read('src/features/seller/api/seller-influencers.routes.ts')

const RATES: CommissionRates = {
  platform_pct: 5, influencer_pct: 0, user_referral_bonus_pct: 0,
  seller_referral_bonus_pct: 1, max_influencer_commission_pct: 2,
} as CommissionRates

describe('② 딜 % 는 캡에 잘리지 않는다 (제안서 % 그대로)', () => {
  it('딜 15% + 캡 2% → 15% (이게 깨지면 제안서와 다른 돈이 적립된다)', () => {
    expect(calcInfluencerCommissionPct(RATES, {
      is_referred_by_this_influencer: false, referral_bonus_active: false, deal_commission_pct: 15,
    })).toBe(15)
  })
  // 🛑 2026-08-30 대표 *"자동분은 빼줘"* — 이 자리엔 원래 `자동분은 여전히 캡 적용`(→2) 이 있었다.
  //   자동분 자체가 없어졌으므로 그 단언은 옛 정책을 고정하는 셈이라 **반대 방향으로 뒤집어** 둔다.
  //   (지우면 "자동분이 슬쩍 되살아나는" 회귀를 아무도 못 잡는다.)
  //   왜 뺐나: 정산식이 `매장 몫 = 총액 − 유어딜 − 인플 − 유저보너스` 라 자동분은 **매장 지갑**에서
  //   나갔다 — 매장이 동의한 적 없는 차감이다. 상세는 `deal-only-commission.test.ts`.
  it('자동분은 아예 없다 — 딜이 없으면 0 (influencer_pct 가 5 여도)', () => {
    expect(calcInfluencerCommissionPct({ ...RATES, influencer_pct: 5 }, {
      is_referred_by_this_influencer: true, referral_bonus_active: true, deal_commission_pct: null,
    })).toBe(0)
  })
  it('딜 % 상한 90 (입력검증선과 동일)', () => {
    expect(calcInfluencerCommissionPct(RATES, {
      is_referred_by_this_influencer: false, referral_bonus_active: false, deal_commission_pct: 200,
    })).toBe(90)
  })
})

describe('① 어필리에이트 종료 — 심플 모델', () => {
  it('affiliate-credit 에 프로그램 스위치가 있고, 기본(행 부재)은 꺼짐', () => {
    expect(affiliate).toContain("affiliate_program_enabled")
    // 스위치 판정이 !== 'true' (행 부재 = 꺼짐) — === 'false' 로 쓰면 행 부재 시 켜진 것이 된다.
    expect(affiliate).toMatch(/sw\?\.value !== 'true'/)
    expect(affiliate).toContain("'PROGRAM_DISABLED'")
  })
  it('기본 요율도 0 — influencer 자동분·구매자 보너스(링크만 붙이면 받던 돈)', () => {
    const m = rates.match(/const DEFAULTS: CommissionRates = \{[\s\S]*?\}/)
    expect(m, 'DEFAULTS 블록을 못 찾았다').toBeTruthy()
    expect(m![0]).toMatch(/influencer_pct: 0,/)
    expect(m![0]).toMatch(/user_referral_bonus_pct: 0,/)
  })
})

describe('①-확장 심플 모델 (2026-08-23 대표 "3번도 끄자") — 멀티티어·초대보상 종료', () => {
  it('멀티티어 트리: multi_tier_enabled 스위치, 행 부재 = 꺼짐 (빈 배열 반환)', () => {
    const tree = readFileSync('src/features/referral/api/referral-tree.routes.ts', 'utf8')
    expect(tree).toContain("multi_tier_enabled")
    expect(tree).toMatch(/sw\?\.value !== 'true'\) return \[\]/)
    // 스위치가 compute 보다 앞이어야 한다 — 뒤면 계산은 돌고 INSERT 만 막는 반쪽이 된다
    const swIdx = tree.indexOf("multi_tier_enabled")
    const computeIdx = tree.indexOf('await computeMultiTierEntries(DB, orderId')
    expect(swIdx).toBeGreaterThan(0)
    expect(swIdx, '스위치가 compute 뒤에 있다').toBeLessThan(computeIdx)
  })
  it('초대 보상: invite_reward_enabled 스위치, 행 부재 = 꺼짐', () => {
    const inv = readFileSync('src/worker/utils/invite-reward.ts', 'utf8')
    expect(inv).toContain("invite_reward_enabled")
    expect(inv).toMatch(/sw\?\.value !== 'true'/)
    expect(inv).toContain("'program_disabled'")
  })
  it('라이브 시드 치유 — 과거 0.5% 기본 시드를 0 으로 (repair-schema)', () => {
    const rep = readFileSync('src/worker/routes/repair-schema/column-repairs.ts', 'utf8')
    expect(rep).toMatch(/SET value='0'[^\n]*influencer_commission_pct' AND value='0\.5'/)
    expect(rep).toMatch(/SET value='0'[^\n]*user_referral_bonus_pct' AND value='0\.5'/)
  })
})

describe('③ 수락 다리 — CAS 선점 후 딜 발효', () => {
  it('accept 는 pending→accepted CAS 를 지나야 딜 INSERT 에 닿는다', () => {
    const casIdx = invites.indexOf("AND status = 'pending'")
    const dealIdx = invites.indexOf('INSERT INTO seller_influencer_deals')
    expect(casIdx, 'CAS UPDATE 가 없다').toBeGreaterThan(0)
    expect(dealIdx, '딜 INSERT 가 없다').toBeGreaterThan(0)
    expect(casIdx, '딜 발효가 CAS 앞에 있다 — 토큰 재사용으로 딜이 덧씌워진다').toBeLessThan(dealIdx)
    // CAS 실패(changes 0) 시 반드시 이탈
    expect(invites).toMatch(/if \(!cas\.meta\?\.changes\)/)
  })
  it('딜 발효는 status=active + 제안서 % (0~90 클램프)', () => {
    expect(invites).toMatch(/VALUES \(\?, \?, \?, 'active', 'outreach', \?\)/)
    expect(invites).toMatch(/Math\.max\(0, Math\.min\(90, Number\(inv\.commission_pct\)/)
  })
})

describe('🔒 연락처 비공개(셀러) — 대표 명시 정책의 회귀 가드', () => {
  it('셀러 탐색 SELECT 에 email 컬럼이 없다', () => {
    // 탐색 쿼리 블록으로 앵커 — 파일 전체 검색은 주석에 걸린다.
    const block = sellerList.slice(sellerList.indexOf('SELECT id, platform, handle'), sellerList.indexOf('FROM ad_influencer_leads'))
    expect(block.length).toBeGreaterThan(10)
    expect(block).not.toMatch(/\bemail\b/)
    expect(block).not.toMatch(/\binstagram\b/)
  })
})
