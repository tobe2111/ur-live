/**
 * 소개비(promo%) 는 **등록 후에도 바꿀 수 있어야 한다** (2026-09-05)
 *
 * 배경: 이 레버가 `POST /products`(등록)에만 있었다. 이용권을 한 번 올리면 소개비를 영영 못
 * 바꿨다는 뜻 — 가격·재고는 다 고칠 수 있는데 마케팅 예산만 못 고쳤다.
 *
 * ⚠️ 이 테스트가 **못 막는 것**:
 *   - 실제 렌더/저장. 소스 배선과 순수 함수만 본다.
 *   - 게이트를 켜도 되는 시점인지(그건 `promo_funding_source` 문제 — 아래 마지막 케이스가
 *     "게이트가 살아 있는가"만 지킨다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { promoPctFromProduct, promoRateForSubmit } from '@/pages/seller-product-edit/PromoRateField'

const read = (p: string) => readFileSync(p, 'utf8')
const ROUTES = 'src/features/seller/api/seller-orders.routes.ts'
const EDIT = 'src/pages/SellerProductEditPage.tsx'
const HELPER = 'src/worker/utils/seller-promo-rate.ts'

describe('단위 변환 — 화면은 퍼센트, 저장은 분수', () => {
  it('서버 분수 → 화면 퍼센트', () => {
    expect(promoPctFromProduct({ referral_commission_rate: 0.05 })).toBe(5)
    expect(promoPctFromProduct({ referral_commission_rate: null })).toBe(0)
  })
  it('적립이 꺼진 상품은 0 으로 보인다', () => {
    expect(promoPctFromProduct({ referral_enabled: 0, referral_commission_rate: 0.1 })).toBe(0)
  })
  it('화면 퍼센트 → 저장 분수, 0~0.5 clamp', () => {
    expect(promoRateForSubmit(5)).toBeCloseTo(0.05, 6)
    expect(promoRateForSubmit(99)).toBe(0.5)   // 서버 상한과 같은 값
    expect(promoRateForSubmit(-3)).toBe(0)
    expect(promoRateForSubmit('')).toBe(0)
  })
})

describe('배선 — 관리 화면에서도 바꿀 수 있다', () => {
  it('수정 라우트가 소개비를 저장한다', () => {
    const s = read(ROUTES)
    // 등록·수정 **둘 다** 같은 헬퍼를 부른다(게이트가 두 벌이 되면 반드시 갈린다)
    expect(s.match(/applySellerPromoRate\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('수정 화면이 현재 소개비를 읽어와 다시 보낸다', () => {
    const s = read(EDIT)
    expect(s).toContain('promoPctFromProduct')      // 프리필 — 없으면 열 때마다 0 으로 보인다
    expect(s).toContain('promoRateForSubmit')       // 저장
    expect(s).toContain('<PromoRateField')          // import 만으론 안 그려진다
  })

  it('살아 있는 GET 이 소개비를 내려준다 (프리필의 전제)', () => {
    const s = read(ROUTES)
    expect(/p\.referral_commission_rate, COALESCE\(p\.referral_enabled, 0\) AS referral_enabled/.test(s)).toBe(true)
    // 🪦 같은 경로가 두 번 정의돼 있으면 뒤엣것은 영원히 안 돈다 — 그 상태로 되돌아가지 않게.
    expect(s.match(/sellerOrdersRoutes\.get\('\/products\/:id'/g)?.length ?? 0).toBe(1)
  })
})

describe('⚠️ 이중 게이트가 살아 있다 (이게 없으면 유어딜이 소개비를 문다)', () => {
  it('서버는 seller_promo_field_enabled 가 true 일 때만 저장한다', () => {
    const s = read(HELPER)
    expect(s).toContain("key = 'seller_promo_field_enabled'")
    expect(/gate\?\.value !== 'true'[\s\S]{0,120}return/.test(s)).toBe(true)
  })

  it('서버 clamp 는 0~0.5 — 클라 플래그를 우회해도 막힌다', () => {
    const s = read(HELPER)
    expect(/rate < 0 \|\| rate > 0\.5/.test(s)).toBe(true)
  })

  it('화면 게이트도 그대로 (플래그 OFF 면 아예 안 그린다)', () => {
    const s = read('src/pages/seller-product-edit/PromoRateField.tsx')
    expect(/if \(!SELLER_PROMO_FIELD_ENABLED\) return null/.test(s)).toBe(true)
  })

  it('소개비 저장 실패가 상품 수정을 깨지 않는다 (fail-soft)', () => {
    const s = read(HELPER)
    expect(/} catch \{ \/\* 게이트 OFF/.test(s)).toBe(true)
  })
})
