/**
 * 🏪 **"저장이 안되어있나?" — 저장은 돼 있었다. 다른 테이블에.** (2026-09-03 재현 완료)
 *
 * 매장 등록(`POST /api/seller/stores`)은 사업자번호·상호·전화·주소를 **`sellers` 행**에 넣는데,
 * 사업자 정보 화면은 `seller_business_info` 만 읽어 404 → 빈 칸이 떴다. 같은 정보를 두 곳이 따로
 * 갖고 있고 한쪽만 보여 주고 있었다.
 *
 * 라이브 실측(셀러 14 홍대돈까스, 2026-08-26 등록): `sellers.business_number='4790902930'` ·
 * `business_name='홍대돈까스'` · 전화·주소 전부 있음 ↔ `seller_business_info` 행 **없음**.
 *
 * ⚠️ 이 테스트가 **못 막는 것**: 실제 D1 조회와 화면 렌더. 여기서 고정하는 것은 **채우는 규칙**이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { formatBusinessNumber } from '@/features/seller/api/business-info-seed'

const SEED = readFileSync('src/features/seller/api/business-info-seed.ts', 'utf8')
const ROUTE = readFileSync('src/features/seller/api/seller-profile.routes.ts', 'utf8')
const PAGE = readFileSync('src/pages/SellerBusinessInfoPage.tsx', 'utf8')

describe('① 번호 형식 — 등록은 하이픈 없이, 화면·검증은 하이픈으로', () => {
  it('10자리를 XXX-XX-XXXXX 로 맞춘다', () => {
    // 안 맞추면 채워 준 값 그대로 저장을 눌렀을 때 형식 오류로 튕긴다(대표가 겪을 다음 벽).
    expect(formatBusinessNumber('4790902930')).toBe('479-09-02930')
    expect(formatBusinessNumber('479-09-02930')).toBe('479-09-02930')
  })

  it('10자리가 아니면 손대지 않는다 — 추측해서 모양만 만들지 않는다', () => {
    expect(formatBusinessNumber('12345')).toBe('12345')
    expect(formatBusinessNumber('')).toBe('')
    expect(formatBusinessNumber(null)).toBe('')
  })
})

describe('② 채우되, 채웠다는 사실을 숨기지 않는다', () => {
  it('🔒 심사 상태를 0 으로 준다 — 여기서 1을 주면 미심사 매장이 현금 정산 자격을 갖는다', () => {
    expect(SEED).toMatch(/is_verified: 0/)
    expect(SEED).not.toMatch(/is_verified: 1/)
  })

  it('출처 플래그를 붙인다', () => {
    expect(SEED).toContain('from_registration: true')
  })

  it('🔒 화면이 그 사실을 알린다 — 조용히 채우면 "이미 등록됐다"고 오해한다', () => {
    expect(PAGE).toContain('businessInfo?.from_registration')
    expect(PAGE).toContain('bizFromRegistration')
  })
})

describe('③ 배선 — 404 자리에서만 채운다', () => {
  it('행이 있으면 건드리지 않는다(채우기는 !businessInfo 안에서만)', () => {
    const block = ROUTE.slice(ROUTE.indexOf('if (!businessInfo) {'), ROUTE.indexOf('mail_order_number'))
    expect(block).toContain('buildBusinessInfoSeed')
  })

  it('채울 게 없으면 종전대로 404 — 빈 껍데기를 만들지 않는다', () => {
    expect(ROUTE).toMatch(/seeded \?[\s\S]{0,120}'Not found'/)
    expect(SEED).toMatch(/if \(!bno && !bname\) return null/)
  })
})
