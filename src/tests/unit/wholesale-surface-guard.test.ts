import { describe, it, expect } from 'vitest'
import { isWholesaleSurface } from '@/utils/domain'

/**
 * 🏭 도매몰(B2B) surface 가드 — INVARIANT 고정 (2026-06-21 대표 신고).
 *
 * 배경: `live.ur-team.com/wholesale` 에 소비자몰 DesktopTopNav(검색바) + BottomNav
 * (홈/쇼핑/이용권/링크샵/마이)가 노출되는 회귀. 원인 = 소비자 nav 가 App.tsx 에 전역
 * 마운트되고 단일 경로 allowlist(hideBottomNav) 하나에만 의존 → 그 한 줄이 누락/회귀하면
 * 도매몰에 소비자 UI 가 샘.
 *
 * 영구 방어: `isWholesaleSurface` 를 SSOT 로 (1) App.tsx hideBottomNav (마운트 차단)
 * (2) BottomNav / DesktopTopNav 컴포넌트 self-guard (이중 방어) 에서 공유. 이 테스트가
 * 헬퍼의 판별 규칙을 고정해, 도매/제조사 경로가 소비자 surface 로 분류되는 회귀를 차단.
 *
 * worker(src/worker/index.ts `isWholesaleSurface` `/^\/(wholesale|supplier)(\/|$)/`)
 * 와 동일 규칙 — 한쪽 변경 시 같이 갱신.
 */
describe('isWholesaleSurface — 도매몰/제조사 경로 판별', () => {
  it('도매몰 루트/하위 경로 = true (소비자 nav 미표시 대상)', () => {
    expect(isWholesaleSurface('/wholesale')).toBe(true)
    expect(isWholesaleSurface('/wholesale/')).toBe(true)
    expect(isWholesaleSurface('/wholesale/product/6')).toBe(true)
    expect(isWholesaleSurface('/wholesale/dashboard')).toBe(true)
    expect(isWholesaleSurface('/wholesale/chat')).toBe(true)
    expect(isWholesaleSurface('/wholesale/login')).toBe(true)
  })

  it('제조사(supplier) 루트/하위 경로 = true', () => {
    expect(isWholesaleSurface('/supplier')).toBe(true)
    expect(isWholesaleSurface('/supplier/')).toBe(true)
    expect(isWholesaleSurface('/supplier/products')).toBe(true)
  })

  it('소비자몰 경로 = false (소비자 nav 정상 표시 대상)', () => {
    expect(isWholesaleSurface('/')).toBe(false)
    expect(isWholesaleSurface('/group-buy')).toBe(false)
    expect(isWholesaleSurface('/vouchers')).toBe(false)
    expect(isWholesaleSurface('/browse')).toBe(false)
    expect(isWholesaleSurface('/u/handle')).toBe(false)
    expect(isWholesaleSurface('/user/profile')).toBe(false)
  })

  it('prefix 충돌 방지 — wholesale/supplier 가 다른 단어의 접두여도 오판 X', () => {
    // 실재 경로는 아니지만, 정규식 경계(`(\/|$)`)가 부분일치를 막는지 고정.
    expect(isWholesaleSurface('/wholesaler')).toBe(false)
    expect(isWholesaleSurface('/suppliers-guide')).toBe(false)
    expect(isWholesaleSurface('/wholesalefoo')).toBe(false)
  })
})
