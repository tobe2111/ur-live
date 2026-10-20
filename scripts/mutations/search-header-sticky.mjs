/**
 * 🔍 /search 자체 헤더가 전역 네비를 덮던 것 (2026-09-15) — 주입 매니페스트.
 * 가드: src/tests/unit/search-header-sticky.test.ts
 */
export default [
  {
    name: '🔍 검색 헤더가 전역 네비를 덮음 (md+ 반쪽 바)',
    file: 'src/components/search/SearchHeader.tsx',
    find: 'className="sticky top-0 md:static z-50',
    replace: 'className="sticky top-0 z-50',
    test: 'src/tests/unit/search-header-sticky.test.ts',
    why:
      '네비와 페이지 헤더가 둘 다 `top-0` 에 붙는데 페이지 쪽 z-50 이 더 높다. 실측 @900(스크롤 500) 에서 ' +
      '네비 0~114 위로 검색바 0~65 가 올라앉아 **네비 아래 49px 만 남은 반쪽 바**가 됐다. ' +
      '에러가 없고 스크롤해야 보여서 라이브에서 한 달 넘게 안 잡혔다.',
  },
  {
    name: '🔍 네비 높이를 외운 오프셋으로 회귀 (드리프트 재발)',
    file: 'src/components/search/SearchHeader.tsx',
    find: 'className="sticky top-0 md:static z-50',
    replace: 'className="sticky top-0 md:top-[114px] z-50',
    test: 'src/tests/unit/search-header-sticky.test.ts',
    why:
      '2026-08 에 이 자리를 `md:top-[102px]` 로 고쳤다가 한 달 만에 네비가 114px 로 자라 조용히 틀어졌다. ' +
      '오프셋은 다른 파일의 높이를 복사하는 것이라 반드시 드리프트한다 — 그 회귀가 이 주입이다.',
  },
]
