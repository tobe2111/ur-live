// 🪪 2026-10-19 — 판매자 마이가 나브 색인 봉투(lucide 포함)를 다시 받는 방향.
const T = 'src/tests/unit/seller-approval-shared-2026-10-19.test.ts'
export default [
  {
    name: '[seller-approval-shared] 승인 키가 다시 나브 색인 봉투로',
    file: 'vite.config.ts',
    find: "if (id.includes('/src/shared/seller-approval')) return 'app-shared'",
    replace: "if (id.includes('/src/shared/seller-approval')) return 'app-seller-nav'",
    test: T,
    why: '판매자 마이 첫 화면이 나브 색인 + lucide(br ~13KB)를 다시 받는다 — 에러 0.',
  },
  {
    name: '[seller-approval-shared] 승인 모듈이 무언가를 import 한다',
    file: 'src/shared/seller-approval.ts',
    find: 'export const SELLER_STATUS_KEY',
    replace: "import { Bell } from 'lucide-react'\nvoid Bell\nexport const SELLER_STATUS_KEY",
    test: T,
    why: 'app-shared 에 사는 모듈이 lucide 를 끌면 모든 화면 첫 페인트에 lucide 봉투가 실린다.',
  },
  {
    name: '[seller-approval-shared] 안내문이 상수 사본을 만든다',
    file: 'src/pages/user-profile/seller-section/store-status-note.ts',
    find: "import { SELLER_STATUS_KEY } from '@/shared/seller-approval'",
    replace: "const SELLER_STATUS_KEY = 'ur_seller_status'",
    test: T,
    why: '키가 두 벌이 되면 한쪽을 바꾸는 날 마이가 쓴 상태를 전체 도구가 못 읽는다.',
  },
  {
    name: '[seller-approval-shared] 약관 상수가 다시 판매자 대시보드 봉투로',
    file: 'vite.config.ts',
    find: "if (id.includes('/src/pages/terms/terms-types')) return 'app-shared'",
    replace: "if (id.includes('/src/pages/terms/terms-types')) return 'app-seller-components'",
    test: T,
    why: '에이전시 콘솔 첫 화면이 판매자 대시보드 봉투 + 의존(약 114KB)을 다시 받는다 — 에러 0.',
  },
  {
    name: '[seller-approval-shared] 어드민 활동 피드가 다시 CheckCircle2',
    file: 'src/pages/admin-page/AdminActivityFeed.tsx',
    find: 'Truck, CheckCircle, XCircle',
    replace: 'Truck, CheckCircle2, CheckCircle, XCircle',
    test: T,
    why: 'circle-check 아이콘 하나로 어드민 첫 화면이 이용권 상세 봉투를 다시 받는다.',
  },
]
