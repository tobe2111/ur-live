/** 🗺️ 모바일 홈 지도 알약 (2026-10-14 대표 확정 다안·A) — 주입 매니페스트. */
const T = 'src/tests/unit/mobile-home-map-pill-2026-10-14.test.ts'
export default [
  {
    name: '🗺️지도 알약이 홈에서 빠진다 (지도로 가는 길이 사라진다)',
    file: 'src/pages/mobile-home/MobileHomePage.tsx',
    find: '      <MapPill />\n',
    replace: '',
    test: T,
    why: '하단 탭에 지도가 없어 알약이 유일한 통로다. 빠져도 화면은 멀쩡해 보인다.',
  },
  {
    name: '🗺️지도 알약이 다시 커진다 (h-8 → h-12)',
    file: 'src/pages/mobile-home/MapPill.tsx',
    find: 'inline-flex h-8 items-center',
    replace: 'inline-flex h-12 items-center',
    test: T,
    why: '대표 "지금 시안의 지도 버튼은 좀 큰데?" — 32px 로 확정.',
  },
  {
    name: '🗺️다크에서 알약이 검정 그대로라 바탕에 묻힌다',
    file: 'src/pages/mobile-home/MapPill.tsx',
    find: 'bg-ink px-4',
    replace: 'bg-gray-900 px-4',
    test: T,
    why: '다크 바탕(#11141C) 위 검정 알약은 안 보인다(시안에서 확인). 바탕의 반대여야 한다.',
  },
]
