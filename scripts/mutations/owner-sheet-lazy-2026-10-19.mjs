// 2026-10-19 — 주인 관리 시트가 손님 첫 화면에 실리지 않는다(화면 무게 예산 · 마이·어드민 무증가).
export default [
  {
    name: '🏪 관리 시트를 다시 정적 import 한다',
    file: 'src/components/deal/useOwnerManage.tsx',
    find: "const OwnerManageSheet = lazy(() => import('./OwnerManageSheet'))",
    replace: "import OwnerManageSheet from './OwnerManageSheet'",
    why: '정적이면 시트·목록 부품이 상세 첫 화면에 실려 화면 무게 예산(gbDetail·product·stayDetail)을 넘긴다.',
    test: 'src/tests/unit/owner-manage-sheet-2026-10-19.test.tsx',
  },
  {
    name: '🏪 관리 시트 봉투를 묶음기 보호에서 뺀다',
    file: 'scripts/surface-chunks.mjs',
    find: "'app-notification-panel', 'app-owner-sheet',", // 2026-10-25 재조준 — 목록에 app-life-banner 가 붙었다
    replace: "'app-notification-panel',",
    why: '보호가 없으면 묶음기가 시트를 공용 봉투(lz-common)로 옮겨 lazy 경계가 무의미해진다.',
    test: 'src/tests/unit/owner-manage-sheet-2026-10-19.test.tsx',
  },
  {
    name: '🏪 마이 목록 부품 고정 봉투를 지운다',
    file: 'vite.config.ts',
    find: "if (OWNER_KIT_MODULES.some((p) => id.includes(p))) return 'app-owner-kit'",
    replace: "if (false) return 'app-owner-kit'",
    why: '고정 봉투가 없으면 목록 부품이 상세 lazy 봉투로 옮겨져 마이·어드민이 상세 코드를 받는다(실측 +3.7/+5.6).',
    test: 'src/tests/unit/owner-manage-sheet-2026-10-19.test.tsx',
  },
]
