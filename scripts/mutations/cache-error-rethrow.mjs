/**
 * 🩸 캐시 폴백이 네트워크 오류를 "없음"으로 위장하던 것 (2026-09-15) — 주입 매니페스트.
 * 가드: src/tests/unit/cache-error-rethrow-2026-09-15.test.ts
 *
 * 이 결함 클래스는 **에러를 안 낸다**. 화면이 "받아둔 이용권이 없어요"라고 태연히 말하고,
 * 페이지가 만들어 둔 에러 UI 는 조용히 죽은 가지가 된다(WishlistPage 가 실제로 그랬다).
 */
const TEST = 'src/tests/unit/cache-error-rethrow-2026-09-15.test.ts'
const CACHE = 'src/hooks/queries/localCache.ts'
const WISH = 'src/hooks/queries/useWishlist.ts'
const CART = 'src/hooks/queries/useCartCount.ts'
const COUNTS = 'src/pages/user-profile/useMyCounts.ts'
const ADDR = 'src/pages/AddressManagementPage.tsx'
const INTEREST = 'src/pages/InterestListPage.tsx'

export default [
  {
    name: '[캐시] cacheOrRethrow 가 던지지 않고 빈 값으로 삼킨다',
    file: CACHE,
    find: '  if (cached !== null) return cached\n  throw err',
    replace: '  if (cached !== null) return cached\n  return [] as unknown as T',
    test: TEST,
    why: '이 PR 전체가 막으려는 바로 그 거짓말 — 오류가 "없음"이 된다.',
  },
  {
    name: '[캐시] 판정을 `if (cached)` 로 되돌린다 (캐시된 0 을 버린다)',
    file: CACHE,
    find: '  if (cached !== null) return cached',
    replace: '  if (cached) return cached',
    test: TEST,
    why: '장바구니 0개·안 읽은 알림 0개가 falsy 라 멀쩡한 값을 버리고 에러를 던진다.',
  },
  {
    name: '[훅] useWishlist 가 다시 에러를 삼킨다 (WishlistPage 의 재시도 버튼이 죽는다)',
    file: WISH,
    find: '.catch((err) => cacheOrRethrow<WishlistItem[]>(CACHE_KEY, err)),',
    replace: '.catch(() => readCache<WishlistItem[]>(CACHE_KEY, [])),',
    test: TEST,
    why: '2026-07-02 주석이 예고한 "에러 UI 가 dead branch 화" 가 실제로 벌어졌던 자리다.',
  },
  {
    name: '[훅] useCartCount 가 오류를 0 으로 위장한다',
    file: CART,
    find: '.catch((err) => cacheOrRethrow<number>(CACHE_KEY, err)),',
    replace: '.catch(() => readCache<number>(CACHE_KEY, 0)),',
    test: TEST,
    why: '담아 둔 물건이 있는데 장바구니 배지가 0 이면 사용자는 결제하러 안 간다.',
  },
  {
    name: '[마이] useMyCounts 가 위시리스트를 다시 직접 fetch 한다 (같은 요청 2회)',
    file: COUNTS,
    find: '  const { data: wishlist } = useWishlist()',
    replace: '  const wishlist = undefined as undefined | unknown[]\n  void (async () => { const { default: api } = await import(\'@/lib/api\'); await api.get(\'/api/wishlists\') })()',
    test: TEST,
    why: '실측 30ms 간격 2회 + 캐시가 갈려 /wishlist 목록과 어긋난다(2026-05-27 사고 구조).',
  },
  {
    name: '[마이] 못 받은 것을 0 으로 말한다 (배지가 거짓 0)',
    file: COUNTS,
    find: 'wish: wishlist ? wishlist.length : null,',
    replace: 'wish: wishlist ? wishlist.length : 0,',
    test: TEST,
    why: '2026-07-02 규칙("네트워크 오류를 0개로 위장하지 않는다")을 되돌린다.',
  },
  {
    name: '[화면] 배송지 화면의 에러 분기를 없앤다 (오류가 "배송지 없음"이 된다)',
    file: ADDR,
    find: '  if (isError) {',
    replace: '  if (false as boolean) {',
    test: TEST,
    why: '저장해 둔 주소가 멀쩡한데 지워진 줄 알고 다시 입력하게 된다.',
  },
  {
    name: '[화면] 관심 맛집의 에러 분기를 없앤다',
    file: INTEREST,
    find: '        ) : isError ? (',
    replace: '        ) : (false as boolean) ? (',
    test: TEST,
    why: '등록해 둔 알림이 사라진 줄 안다.',
  },
]
