/**
 * 🎨 마이 아이콘 체계 (2026-09-28, 대표 *"앞으로 아이콘은 모두 저 컨셉이야 명심해줘"*)
 * 가드: src/tests/unit/my-icon-system-2026-09-28.test.ts
 *
 * 되돌리려는 사고는 **한 칸씩 남의 세트로 새는 것**이다. 아이콘 하나를 lucide 로 쓰면
 * 빌드도 화면도 안 깨지고, 그 한 칸만 획이 2px 라 옆줄과 미세하게 다르다. 그렇게 36종까지 자랐다.
 */
const TEST = 'src/tests/unit/my-icon-system-2026-09-28.test.ts'

export default [
  {
    name: '🎨 뜻 아이콘 하나가 lucide 로 돌아간다 (찜 = Heart)',
    file: 'src/pages/user-profile/ShoppingGroup.tsx',
    find: "import type { LucideIcon } from 'lucide-react'",
    replace: "import { Heart, type LucideIcon } from 'lucide-react'",
    test: TEST,
    why: '한 칸만 lucide 면 그 줄의 획이 2px 라 위아래와 두께가 다르다 — 에러 없이 화면만 어긋난다.',
  },
  {
    name: '🎨 판매 도구가 lucide 로 돌아간다 (정산 = Wallet)',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: "import { ChevronDown, ChevronRight, Loader2, Search } from 'lucide-react'",
    replace: "import { ChevronDown, ChevronRight, Loader2, Search, Wallet } from 'lucide-react'",
    test: TEST,
    why: '판매 쪽만 남의 세트로 돌아가면 손님 쪽과 한 화면에서 갈린다(그게 원래 상태였다).',
  },
  {
    name: '🎨 유어딜 아이콘을 import 만 하고 안 쓴다 (배선 끊김)',
    file: 'src/pages/user-profile/ShoppingGroup.tsx',
    find: "  TicketStubIcon, CouponIcon, GiftBoxIcon, StayLineIcon, HeartIcon, StarIcon,\n  BellIcon, BoxIcon, PinIcon, ReviewIcon,\n}",
    replace: "  TicketStubIcon,\n}",
    test: TEST,
    why: '세트를 만들어 놓고 쓰지 않으면 화면은 종전 그대로다 — 종류 수 하한이 그 착각을 막는다.',
  },
  {
    name: '🎨 아이콘이 계약을 우회해 자기 획 두께를 박는다',
    file: 'src/components/icons/urdeal-icons.tsx',
    find: '      <path d="M12 19.9 5.1 13a4.4 4.4 0 0 1 6.2-6.2l.7.7.7-.7A4.4 4.4 0 0 1 18.9 13z"',
    replace: '      <path strokeWidth={2} d="M12 19.9 5.1 13a4.4 4.4 0 0 1 6.2-6.2l.7.7.7-.7A4.4 4.4 0 0 1 18.9 13z"',
    test: TEST,
    why: '획 두께가 이 세트의 정체성이다. 한 아이콘만 2px 면 lucide 를 섞은 것과 같은 결과가 된다.',
  },
  {
    name: '🎨 세트의 공통 계약(1.6)이 흔들린다',
    file: 'src/components/icons/urdeal-icons.tsx',
    find: '  strokeWidth: 1.6,',
    replace: '  strokeWidth: 2,',
    test: TEST,
    why: '`base` 한 줄이 32개 아이콘 전부를 정한다 — 여기가 2가 되면 한글 라벨 옆에서 아이콘만 튄다.',
  },
  {
    name: '🎨 세트에 없는 이름을 import 한다',
    file: 'src/pages/user-profile/SettingsGroup.tsx',
    find: "import { SettingsIcon } from '@/components/icons/urdeal-icons'",
    replace: "import { SettingsIcon, GearIcon } from '@/components/icons/urdeal-icons'",
    test: TEST,
    why: '이름만 맞고 실물이 없으면 런타임에 빈 자리가 된다(번들러가 조용히 undefined 를 준다).',
  },
]
