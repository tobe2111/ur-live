/**
 * ⚡ 첫 렌더 CPU 다듬기 (2026-10-12) — 주입 매니페스트. 가드: src/tests/unit/boot-cpu-trims-2026-10-12.test.tsx
 */
const TEST = 'src/tests/unit/boot-cpu-trims-2026-10-12.test.tsx'
export default [
  {
    name: '⚡ 비로그인 카드도 찜 목록을 다시 구독한다',
    file: 'src/components/deal/WishlistHeart.tsx',
    find: 'return isLoggedInSync() ? <LiveHeart {...props} /> : <GuestHeart {...props} />',
    replace: 'return <LiveHeart {...props} />',
    test: TEST,
    why: '카드마다 쿼리 옵저버를 만들고 구독한다 — 비로그인은 받을 것도 없는데 홈 첫 렌더 CPU 를 쓴다.',
  },
  {
    name: '⚡ 비로그인 하트를 눌러도 로그인으로 안 간다',
    file: 'src/components/deal/WishlistHeart.tsx',
    find: "        navigate(`/login?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`)\n      }}",
    replace: '      }}',
    test: TEST,
    why: '눌러도 아무 일도 안 일어나는 버튼이 된다.',
  },
  {
    name: '⚡ formatNumber 가 다른 포매터 옵션을 쓴다(출력이 갈린다)',
    file: 'src/utils/format.ts',
    find: 'f = new Intl.NumberFormat(locale)',
    replace: 'f = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })',
    test: TEST,
    why: '캐시가 옵션을 바꾸면 소수 표시가 종전 toLocaleString 과 달라진다.',
  },
]
