/**
 * 담아 팔면 몇 % — 화면과 서버가 **같은 숫자**를 말하는지 (2026-09-05)
 *
 * 배경(라이브 실측): 같은 컬럼 `products.referral_commission_rate` 를 네 자리가 서로 다른
 * 단위·기본값으로 읽어, **유어샵 담기/핀 화면의 적립 안내가 한 번도 뜬 적이 없었다**
 * (rate 는 활성 2,606개 전부 NULL · 화면은 NULL/0 을 '적립 없음' 으로 읽었다).
 * 상세 공유 문구와 어드민 정책 표는 반대로 **5%** 라고 말했다(실제 2%).
 *
 * ⚠️ 이 테스트가 **못 막는 것**:
 *   - 어드민이 `platform_settings.affiliate_commission_rate` 를 바꿨을 때의 화면 표시.
 *     클라이언트는 그 값을 모르고 코드 기본값을 쓴다(적립 자체는 서버가 맞게 준다).
 *   - 실제 렌더 결과. 여기서는 순수 함수 + 소스 배선만 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { DEFAULT_AFFILIATE_RATE, effectiveAffiliateRate, affiliateRatePct } from '@/shared/affiliate-rate'
import { COMMISSION_DEFAULTS } from '@/shared/constants/policy'

const read = (p: string) => readFileSync(p, 'utf8')

describe('적립률 해석 — 단위와 기본값', () => {
  it('rate 는 분수다 — 0.05 는 5% 이지 0% 가 아니다', () => {
    expect(affiliateRatePct({ referral_commission_rate: 0.05 })).toBe(5)
    expect(effectiveAffiliateRate({ referral_commission_rate: 0.05 })).toBeCloseTo(0.05, 6)
    // 회귀의 원래 모습: Math.round(0.05) === 0 → 배지가 사라진다
    expect(affiliateRatePct({ referral_commission_rate: 0.05 })).not.toBe(0)
  })

  it('기본값은 2% — 2026-06-17 대표 결정(5%→2%, 1인 치킨게임)', () => {
    // 값 자체를 못박는다. 이걸 안 박으면 상수를 5 로 되돌려도 아래 파생 검사들이 전부 통과한다
    // (2026-09-05: 실제로 주입해 보고서야 알았다 — 파생만 보는 가드는 헛돈다).
    expect(DEFAULT_AFFILIATE_RATE).toBe(0.02)
  })

  it('rate 없음(NULL) = 적립 없음이 아니라 플랫폼 기본', () => {
    expect(effectiveAffiliateRate({ referral_commission_rate: null })).toBe(DEFAULT_AFFILIATE_RATE)
    expect(effectiveAffiliateRate({})).toBe(DEFAULT_AFFILIATE_RATE)
    expect(affiliateRatePct({})).toBe(DEFAULT_AFFILIATE_RATE * 100)
  })

  it('referral_enabled=0 이면 적립 없음 — 꺼진 상품에 약속하지 않는다', () => {
    expect(effectiveAffiliateRate({ referral_enabled: 0 })).toBeNull()
    expect(affiliateRatePct({ referral_enabled: 0, referral_commission_rate: 0.1 })).toBeNull()
    // 미전달(undefined)은 '꺼짐'이 아니라 '모름' — 켜진 것으로 본다
    expect(effectiveAffiliateRate({ referral_enabled: undefined })).toBe(DEFAULT_AFFILIATE_RATE)
  })

  it('0% 는 NULL 과 다르다 — 어드민이 0 을 넣으면 정말 0', () => {
    expect(effectiveAffiliateRate({ referral_commission_rate: 0 })).toBe(0)
    expect(affiliateRatePct({ referral_commission_rate: 0 })).toBeNull() // 배지 안 뜸
  })

  it('서버 클램프와 동일 — 1 을 넘지 않는다', () => {
    expect(effectiveAffiliateRate({ referral_commission_rate: 5 })).toBe(1)
  })
})

describe('숫자가 한 곳에서만 온다', () => {
  it('worker 적립 경로가 자체 리터럴을 다시 만들지 않는다', () => {
    const s = read('src/worker/utils/affiliate-credit.ts')
    expect(s).toContain('DEFAULT_AFFILIATE_RATE')
    expect(/const DEFAULT_COMMISSION_RATE\s*=\s*0\.\d/.test(s)).toBe(false)
  })

  it('어드민 정책 표가 실제 기본값과 같다 (5 였다가 2 로 정정된 자리)', () => {
    expect(COMMISSION_DEFAULTS.AFFILIATE_COMMISSION_PCT).toBe(DEFAULT_AFFILIATE_RATE * 100)
  })
})

describe('화면 배선 — 옛 오독이 되살아나지 않게', () => {
  it('핀 관리: 분수를 100 으로 또 나누지 않는다', () => {
    const s = read('src/pages/curator-page/PinManageList.tsx')
    expect(s).toContain('effectiveAffiliateRate')
    // 분수를 다시 100 으로 나누는 어떤 형태도 금지 — 변수명이 바뀌어도 잡히게 계산식 자체를 본다.
    expect(/pin\.price \* estRate\)/.test(s)).toBe(true)
    expect(/(estRate|commission_rate)\s*\/\s*100/.test(s)).toBe(false)
  })

  it('담기 picker: 분수를 Math.round 로 퍼센트 취급하지 않는다', () => {
    const s = read('src/pages/curator-page/LinkshopPinPicker.tsx')
    expect(s).toContain('affiliateRatePct')
    expect(/Math\.round\(Number\(item\.referral_commission_rate\)/.test(s)).toBe(false)
  })

  it('상세 공유 문구: 기본값을 하드코딩하지 않는다', () => {
    const s = read('src/pages/ProductDetailPage.tsx')
    expect(s).toContain('effectiveAffiliateRate')
    expect(/:\s*0\.05\s*\/\/\s*platform default/.test(s)).toBe(false)
  })

  it('서버가 NULL 을 0 으로 뭉개지 않고 referral_enabled 를 함께 보낸다', () => {
    const s = read('src/worker/routes/curator.routes.ts')
    expect(/COALESCE\(p\.referral_commission_rate,\s*0\)/.test(s)).toBe(false)
    // 추천 + 핀 두 쿼리 모두
    expect(s.match(/p\.referral_commission_rate AS commission_rate/g)?.length ?? 0).toBe(2)
    expect(s.match(/COALESCE\(p\.referral_enabled, 0\) AS referral_enabled/g)?.length ?? 0).toBe(2)
  })

  it('목록 API 가 referral_enabled 를 실어 보낸다 (picker 가 꺼짐을 알 수 있게)', () => {
    const s = read('src/features/products/repositories/ProductRepository.ts')
    expect(/baseCols\.push\('referral_commission_rate',\s*'referral_enabled'\)/.test(s)).toBe(true)
  })
})
