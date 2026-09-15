/**
 * 🩸 캐시 폴백이 **네트워크 오류를 "없음"으로 위장**하던 것 〔2026-09-15〕
 *
 * 대표: *"각 페이지들마다 접속 시 로딩들이 좀 불만이야. 계속 중간에 연관없는 페이지도 보이는 것 같고?"*
 *
 * 같은 함정에 문이 둘이었다.
 *   · **로딩 방향** — `initialData: () => readCache(key, [])` → PR #1451 에서 `cachedInitialData` 로 닫음.
 *   · **에러 방향** — `queryFn.catch(() => readCache(key, []))` → 2026-07-02 에 발견됐는데 **7개 훅에만**
 *     적용되고 **11개가 남아** 있었다. 이 파일이 그 나머지를 잠근다.
 *
 * 남아 있던 대가: `WishlistPage` 는 `isError` 로 에러 문구와 재시도 버튼을 만들어 놓고도
 * **그 분기가 죽어 있었다** — 훅이 에러를 삼켜 `isError` 가 영원히 false 였기 때문이다.
 * (2026-07-02 주석이 예고한 "페이지 에러 UI가 dead branch 화" 가 실제로 일어나 있었다.)
 *
 * ## 이 시험이 **못** 막는 것
 * - 실제 네트워크 실패 시 화면이 어떻게 보이는지(배포 후 눈으로)
 * - 에러 UI 문구의 적절성
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readCode } from '../helpers/source-text'
import { cacheOrRethrow, writeCache } from '@/hooks/queries/localCache'

/** 에러 방향을 고친 훅 전부. 하나라도 옛 폴백으로 돌아가면 그 화면이 다시 거짓말한다. */
const HOOKS = [
  'useAddresses', 'useCartCount', 'useFollowing', 'useGroupBuyProduct', 'useMyInterests',
  'useNotifications', 'useProduct', 'useSellerPublic', 'useUnreadCount', 'useUserProfile',
  'useWishlist', 'useDigitalLibrary', 'useMyCoupons', 'useMyData', 'useMyFollows',
  'useMyReturns', 'useMyStays',
]

describe('① cacheOrRethrow — 캐시가 있으면 주고, 없으면 던진다', () => {
  beforeEach(() => { try { localStorage.clear() } catch { /* private mode */ } })

  it('🔴 캐시가 없으면 **원래 에러를 그대로 던진다** (빈 목록으로 위장하지 않는다)', () => {
    const boom = new Error('network down')
    expect(() => cacheOrRethrow<number[]>('__absent_2026__', boom)).toThrow(boom)
  })

  it('캐시가 있으면 last-known 을 준다 (오프라인에서도 마지막 화면은 보인다)', () => {
    writeCache('__hit_2026__', [1, 2])
    expect(cacheOrRethrow<number[]>('__hit_2026__', new Error('x'))).toEqual([1, 2])
  })

  it('🔴 캐시된 **0** 을 버리지 않는다 — `if (cached)` 로 짜면 여기서 틀린다', () => {
    // 장바구니 0개·안 읽은 알림 0개가 정확히 이 값이다. falsy 판정이면 멀쩡한 0 을 버리고 던진다.
    writeCache('__zero_2026__', 0)
    expect(cacheOrRethrow<number>('__zero_2026__', new Error('x'))).toBe(0)
  })

  it('캐시된 **빈 목록**도 그대로 준다 (진짜로 비어 있던 것을 기억한 값이다)', () => {
    writeCache('__empty_2026__', [])
    expect(cacheOrRethrow<number[]>('__empty_2026__', new Error('x'))).toEqual([])
  })
})

describe('② 훅들이 옛 폴백으로 되돌아가지 않는다', () => {
  it(`🔴 ${HOOKS.length}개 훅 어디에도 \`catch(() => readCache(...))\` 가 없다`, () => {
    for (const h of HOOKS) {
      const src = readCode(`src/hooks/queries/${h}.ts`)
      expect(src, `${h}: 에러를 빈 목록/0/null 로 위장하는 폴백이 돌아왔다`)
        .not.toMatch(/\.catch\(\(\)\s*=>\s*readCache[<(]/)
    }
  })

  it('🔴 판정을 훅에서 손으로 다시 쓰지 않는다 — `if (cached)` 는 0 에서 틀린다', () => {
    for (const h of HOOKS) {
      const src = readCode(`src/hooks/queries/${h}.ts`)
      expect(src, `${h}: SSOT(cacheOrRethrow) 대신 손수 판정을 복제했다`)
        .not.toContain('if (cached) return cached')
    }
  })

  it('에러 폴백을 가진 훅은 전부 SSOT 를 쓴다', () => {
    for (const h of HOOKS) {
      const src = readCode(`src/hooks/queries/${h}.ts`)
      expect(src, `${h}: cacheOrRethrow 를 안 쓴다`).toContain('cacheOrRethrow')
    }
  })
})

describe('③ 죽어 있던 에러 UI 가 살아난다', () => {
  it('WishlistPage 의 재시도 분기는 이제 도달 가능하다 (훅이 더는 삼키지 않는다)', () => {
    expect(readCode('src/pages/WishlistPage.tsx')).toContain('isError ?')
    expect(readCode('src/hooks/queries/useWishlist.ts')).toContain('cacheOrRethrow')
  })

  it('에러 분기가 없던 화면 셋에 생겼다 — "못 불러옴"과 "없음"을 나눠 말한다', () => {
    for (const [f, anchor] of [
      ['src/pages/AddressManagementPage.tsx', 'if (isError)'],
      ['src/pages/InterestListPage.tsx', ') : isError ? ('],
      ['src/components/main/NotificationDropdown.tsx', ') : isError ? ('],
    ] as const) {
      expect(readCode(f), `${f}: 에러 분기가 사라졌다`).toContain(anchor)
    }
  })
})

describe('④ 같은 값을 두 번 받지 않는다 (useMyCounts)', () => {
  const src = () => readCode('src/pages/user-profile/useMyCounts.ts')

  it('🔴 위시리스트·쿠폰을 직접 fetch 하지 않는다 — RQ 훅을 재사용한다', () => {
    // 잠금표 규칙("별도 fetch 금지")이 이용권에만 적용돼 있었다. 실측: /api/wishlists 가 30ms 간격 2회.
    expect(src()).not.toMatch(/api\.get\(/)
    expect(src()).toContain('useWishlist()')
    expect(src()).toContain('useMyCoupons()')
  })

  it('🔴 모름(null)과 없음(0)을 계속 구분한다 — 못 받았으면 배지를 숨긴다', () => {
    expect(src()).toMatch(/wish: wishlist \? wishlist\.length : null/)
    expect(src()).toMatch(/coupon: coupons \? coupons\.length : null/)
  })
})
