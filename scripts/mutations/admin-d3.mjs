/**
 * 🧮 어드민 D3 합류 (2026-09-15, 대표 "다른 대시보드들의 페이지들도 개선 계속") — 주입 매니페스트.
 * 가드: src/tests/unit/seller-d3-2026-09-15.test.ts
 */
const TEST = 'src/tests/unit/seller-d3-2026-09-15.test.ts'

export default [
  {
    name: '🧮 어드민 D3 블록이 사라져 어드민 카드가 종전 16px 로 되돌아간다',
    file: 'src/index.css',
    find: '.admin-light-theme {\n  --dash-radius: 8px;\n  --dash-h1: 17px;',
    replace: '.admin-light-theme {\n  --dash-h1: 17px;',
    test: TEST,
    why: '공용 부품은 변수 폴백으로 그린다 — 블록이 빠지면 에러 없이 어드민만 옛 밀도로 돌아가고 아무도 모른다.',
  },
  {
    name: '🧮 어드민 페이지 헤더의 장식 아이콘 칩이 되살아난다',
    file: 'src/index.css',
    find: '.seller-light-theme .dash-header-icon, .admin-light-theme .dash-header-icon { display: none; }',
    replace: '.seller-light-theme .dash-header-icon { display: none; }',
    test: TEST,
    why: 'D3 는 "제목 앞 40px 회색 칩" 을 뺀 밀도다 — 셀러만 빠지고 어드민에 남으면 두 대시보드가 다시 다르게 생긴다.',
  },
]
