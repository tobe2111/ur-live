/** 🎨 다크 바탕 통일 (2026-11-03) — 주입 매니페스트. 가드: src/tests/unit/dark-page-tone-2026-11-03.test.ts */
const TEST = 'src/tests/unit/dark-page-tone-2026-11-03.test.ts'
export default [
  {
    name: '🎨다크바탕 지도 목록 시트가 다시 카드 색으로 밝게 뜬다',
    file: 'src/pages/RestaurantMapPage.tsx',
    find: 'absolute left-0 right-0 bottom-0 z-30 bg-warm rounded-t-3xl',
    replace: 'absolute left-0 right-0 bottom-0 z-30 bg-surface rounded-t-3xl',
    test: TEST,
    why: '대표 *"색 통일이 안됐어 다크모드에서"* — 시트만 #1D1F29 로 밝다.',
  },
  {
    name: '🎨다크바탕 홈 고정 막대가 다시 카드 색으로 밝게 뜬다',
    file: 'src/pages/mobile-home/MobileHomePage.tsx',
    find: 'fixed inset-x-0 top-0 z-30 bg-warm shadow-lift',
    replace: 'fixed inset-x-0 top-0 z-30 bg-surface shadow-lift',
    test: TEST,
    why: '스크롤하면 위 막대만 밝은 남색 띠가 된다.',
  },
]
