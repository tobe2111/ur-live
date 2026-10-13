/**
 * 🚪 셀러 대시보드 제거 3단계 — 에이전시 직원 깊은 링크 → 콘솔 시트 (2026-10-12) — 주입 매니페스트.
 * 가드: src/tests/unit/agency-deep-link-2026-10-12.test.tsx
 *
 * 전부 에러가 안 나는 결함이다 — 화면이 오가며 깜빡이거나, 남의 좌석으로 열리거나, 옛 대시보드가 그대로 뜬다.
 */
const TEST = 'src/tests/unit/agency-deep-link-2026-10-12.test.tsx'
const LIB = 'src/lib/seller-deep-link.ts'
const LAYOUT = 'src/components/SellerLayout.tsx'
const PANEL = 'src/pages/agency-console/AgencyStoresPanel.tsx'
const PLATE = 'src/pages/agency-console/AgencyStorePlate.tsx'

export default [
  {
    name: '[에이전시링크] 깊은 링크를 매번 다시 쓴다',
    file: PANEL,
    find: '    deepDone.current = true\n',
    replace: '\n',
    test: TEST,
    why: '다른 매장을 골랐다 돌아오거나 목록이 다시 불리면 닫은 시트가 또 열린다.',
  },
]
