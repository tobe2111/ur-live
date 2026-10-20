/**
 * 🎁 이용권 상세의 소개 보상 배너 — 비로그인이면 서버에 묻지 않는다 (2026-10-15 라이브 실측).
 *   로그아웃 상태로 `/pass/2919` 를 열면 `/api/influencer-settlement/deal-for-seller/26` 가 **401** 이었다.
 *   딜은 로그인한 소개자에게만 있으므로 그 요청은 언제나 헛걸음이다.
 * ⚠️ 못 보는 것: 로그인 사용자의 배너 표시 자체(서버 판정) — 그건 결제 시점과 같은 SSOT 가 맡는다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const get = vi.fn(() => Promise.resolve({ data: { data: { active: false } } }))
vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => get(...(a as [])) } }))

import ShareRewardBanner from '@/pages/group-buy/ShareRewardBanner'

describe('비로그인 = 요청 0', () => {
  beforeEach(() => { get.mockClear(); localStorage.clear() })
  it('로그아웃이면 딜 조회를 안 한다', () => {
    render(<ShareRewardBanner sellerId={26} productId={2919} />)
    expect(get, '로그아웃 상태에서 401 을 받을 요청을 보냈다').not.toHaveBeenCalled()
  })
  it('로그인이면 그대로 묻는다(반대 방향)', () => {
    localStorage.setItem('user_id', '3')
    render(<ShareRewardBanner sellerId={26} productId={2919} />)
    expect(get).toHaveBeenCalledWith('/api/influencer-settlement/deal-for-seller/26')
  })
})
