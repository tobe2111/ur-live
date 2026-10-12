/**
 * 🚪 셀러 대시보드 첫 화면 → 카카오 사장님은 마이로 (2026-10-11 — 대표 *"셀러 대시보드는 마이페이지로 가면서 안쓰지 않아?"*)
 *
 * 남는 사람은 둘뿐이다: ① 에이전시 직원 좌석(이메일 로그인 — 마이가 없다) ② 마이가 없는 옛 셀러 계정.
 * 그리고 마이 시트 안에서 이 화면이 열리면 보내지 않는다(시트가 자기 자신을 닫는다).
 *
 * 이 시험이 **못 보는 것**: 실제 라우터 이동(브라우저) · 하위 화면 깊은 링크(일부러 안 건드렸다).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { shouldSendOwnerToMy } from '@/pages/SellerPage'
import { stripComments } from '../helpers/source-text'

const seat = (claims: Record<string, unknown>) => `x.${btoa(JSON.stringify(claims)).replace(/=+$/, '')}.y`

describe('누구를 마이로 보내나', () => {
  beforeEach(() => localStorage.clear())

  it('카카오로 들어온 사장님(소비자 계정 + 일반 셀러 좌석)은 마이로', () => {
    localStorage.setItem('user_id', '3')
    localStorage.setItem('seller_token', seat({ sellerId: 14 }))
    expect(shouldSendOwnerToMy(false)).toBe(true)
  })

  it('🔴 에이전시 직원 좌석은 대시보드에 남는다 (마이가 없다 — 보내면 일을 못 한다)', () => {
    localStorage.setItem('user_id', '3')
    localStorage.setItem('seller_token', seat({ sellerId: 14, agency_staff_id: 7, agency_id: 2 }))
    expect(shouldSendOwnerToMy(false)).toBe(false)
  })

  it('마이가 없는 옛 셀러 계정은 남는다', () => {
    localStorage.setItem('seller_token', seat({ sellerId: 14 }))
    expect(shouldSendOwnerToMy(false)).toBe(false)
  })

  it('🔴 마이 시트 안에서는 보내지 않는다 (시트가 자기 자신을 닫는다)', () => {
    localStorage.setItem('user_id', '3')
    localStorage.setItem('seller_token', seat({ sellerId: 14 }))
    expect(shouldSendOwnerToMy(true)).toBe(false)
  })
})

describe('배선', () => {
  it('대시보드 첫 화면이 판정을 거쳐 마이로 보낸다', () => {
    const src = stripComments(readFileSync('src/pages/SellerPage.tsx', 'utf-8'))
    expect(src).toMatch(/if \(shouldSendOwnerToMy\(embedded\)\) return <Navigate to="\/user\/profile" replace \/>/)
  })
})
