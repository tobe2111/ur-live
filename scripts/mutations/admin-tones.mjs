/**
 * 🧮 어드민 대시보드 D3 합류 — 색 정보상자·이모지·카드 그림자·버튼 가드 스코프 (2026-09-15) 주입 매니페스트.
 * 가드: src/tests/unit/admin-tones-2026-09-15.test.ts
 */
const TEST = 'src/tests/unit/admin-tones-2026-09-15.test.ts'

export default [
  {
    name: '🕳️ 버튼 체계 가드가 어드민 표면을 다시 빼놓는다 (셀러만 검사)',
    file: 'scripts/check-dashboard-button-system.mjs',
    find: " ':(glob)src/pages/Admin*.tsx' ':(glob)src/pages/admin/**/*.tsx' ':(glob)src/components/admin/**/*.tsx'",
    replace: '',
    test: TEST,
    why: '어드민 원시 버튼 175개를 체계로 옮긴 날, 가드가 어드민을 안 보면 다음 페이지부터 도로 회색 버튼이 자란다.',
  },
  {
    name: '🎨 어드민 홈 별점 시드 카드가 노란 정보상자로 되돌아간다',
    file: 'src/pages/AdminPage.tsx',
    find: 'className="bg-white rounded-xl p-3 sm:p-4 border border-rule flex items-center gap-3"',
    replace: 'className="bg-amber-50 rounded-xl p-3 sm:p-4 border border-amber-200 flex items-center gap-3"',
    test: TEST,
    why: '🎫 규칙 ⑥ 색깔 정보상자 0 — 어드민 홈이 첫 화면이라 여기부터 새면 전부 샌다.',
  },
  {
    name: '🎨 어드민 네비 섹션 라벨에 이모지가 돌아온다',
    file: 'src/components/admin/admin-nav-config.ts',
    find: "{ key: 'urdeal', label: '유어딜 · 소비자', accent: '#1C69EF' },",
    replace: "{ key: 'urdeal', label: '🎟️ 유어딜 · 소비자', accent: '#1C69EF' },",
    test: TEST,
    why: '대표 "아이콘은 모두 저 컨셉(선/면)" — 사이드바 라벨의 이모지는 그 규칙의 가장 눈에 띄는 위반이다.',
  },
  {
    name: '🎨 어드민 카드 모서리가 rounded-2xl 로 되돌아간다',
    file: 'src/pages/AdminBlogPage.tsx',
    find: 'text-center py-20 bg-white rounded-[var(--dash-radius,16px)]',
    replace: 'text-center py-20 bg-white rounded-2xl',
    test: TEST,
    why: 'D3 는 카드 모서리 8px 을 토큰 한 곳에서 정한다 — 페이지가 자기 값을 박으면 그 화면만 다른 밀도가 된다.',
  },
]
