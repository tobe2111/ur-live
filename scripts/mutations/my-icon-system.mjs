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
    find: "import { ChevronDown, ChevronRight, Loader2, Plus, Search } from 'lucide-react'",
    replace: "import { ChevronDown, ChevronRight, Loader2, Plus, Search, Wallet } from 'lucide-react'",
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
    // 🔁 2026-09-30 재조준: `SettingsGroup` 이 접이식을 버리면서(대표 *"왜 굳이 열고 닫게"*)
    //   그 파일의 아이콘 import 가 통째로 사라졌다. 불변식(*세트에 없는 이름은 런타임에 빈 자리*)은
    //   그대로라 같은 구역의 형제 파일로 옮긴다.
    name: '🎨 세트에 없는 이름을 import 한다',
    file: 'src/pages/user-profile/ShoppingGroup.tsx',
    find: "  TicketStubIcon, CouponIcon, GiftBoxIcon,",
    replace: "  TicketStubIcon, CouponIcon, GiftBoxIcon, GearIcon,",
    test: TEST,
    why: '이름만 맞고 실물이 없으면 런타임에 빈 자리가 된다(번들러가 조용히 undefined 를 준다).',
  },
  {
    name: '👤 PC 헤더만 회색 프로필 편집 알약으로 되돌아간다',
    file: 'src/pages/user-profile/AccountPcPane.tsx',
    find: "          aria-label={t('userProfile.editProfile', { defaultValue: '프로필 편집' })}\n",
    replace: "",
    test: TEST,
    why: '모바일만 고치고 PC 를 빠뜨리면 같은 뜻의 줄이 기기마다 다르게 생긴다 — 09-28 에 실제로 그랬다.',
  },
  {
    name: '👤 PC 이메일만 다른 크기로 새어 나간다',
    file: 'src/pages/user-profile/AccountPcPane.tsx',
    find: '<span className="block text-[13px] text-gray-500 dark:text-gray-400 truncate mt-1">{localStorage.getItem(\'user_email\')',
    replace: '<span className="block text-[12px] text-gray-500 dark:text-gray-400 truncate mt-1">{localStorage.getItem(\'user_email\')',
    test: TEST,
    why: '같은 줄이 모바일 13 / PC 12 면 두 벌이 갈린 것이고, 눈으로는 거의 안 보여서 영영 안 고쳐진다.',
  },
]
