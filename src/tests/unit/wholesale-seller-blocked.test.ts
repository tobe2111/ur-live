import { describe, it, expect } from 'vitest'
import { isSellerBlocked } from '@/features/supply/api/wholesale-helpers'

/**
 * 🔐 2026-06-26 (대표 "도매몰은 Toss 안 쓰잖아, 확인 안돼?"): 도매 머니액션(발주·예치금충전·Plus구독·
 *   결제확정)은 외부 결제 없이 예치금 산술이라 staging 없이 단위테스트로 증명 가능.
 *   isSellerBlocked = 승인 후 정지/거부된 판매사를 요청시점 status 재검사로 차단하는 게이트.
 *   불변식: reject-list(정지/거부/대기/차단/삭제)만 차단, approved/active(정상)는 통과, 조회실패는 fail-open.
 */
function makeDB(status: string | null | undefined, opts: { throwOnQuery?: boolean } = {}) {
  const make = () => ({
    first: async () => {
      if (opts.throwOnQuery) throw new Error('db down')
      return status === undefined ? null : { status }   // undefined = 행 없음
    },
    run: async () => ({ meta: { changes: 0 } }),
    all: async () => ({ results: [] }),
  })
  return {
    prepare(_sql: string) {
      return { ...make(), bind: (..._a: unknown[]) => make() }
    },
  } as never
}

describe('isSellerBlocked — 정지/거부 판매사 머니액션 차단 게이트 (도매, Toss 무관)', () => {
  it('approved → 통과(차단 안 함)', async () => {
    expect(await isSellerBlocked(makeDB('approved'), 1)).toBe(false)
  })
  it('active → 통과', async () => {
    expect(await isSellerBlocked(makeDB('active'), 1)).toBe(false)
  })

  for (const bad of ['suspended', 'rejected', 'pending', 'banned', 'deleted']) {
    it(`${bad} → 차단(머니액션 403)`, async () => {
      expect(await isSellerBlocked(makeDB(bad), 1)).toBe(true)
    })
  }

  it('대소문자 무관(SUSPENDED) → 차단', async () => {
    expect(await isSellerBlocked(makeDB('SUSPENDED'), 1)).toBe(true)
  })
  it('행 없음(null) → fail-open 통과 (정상 거래를 데이터 누락으로 안 막음)', async () => {
    expect(await isSellerBlocked(makeDB(undefined), 1)).toBe(false)
  })
  it('미지의 status(예: vip) → 통과 (reject-list 만 차단 — happy-path 보호)', async () => {
    expect(await isSellerBlocked(makeDB('vip'), 1)).toBe(false)
  })
  it('DB 조회 실패 → fail-open 통과 (transient 오류로 정상 발주 안 막음)', async () => {
    expect(await isSellerBlocked(makeDB(null, { throwOnQuery: true }), 1)).toBe(false)
  })
})
