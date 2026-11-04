/**
 * 🚪 로그인 전 탭 화면(이용권 · 유어샵 · 마이)의 **문구와 모양 SSOT** (2026-10-19).
 *
 * 워커가 같은 화면을 서버 첫 화면으로 그린다(`worker/utils/guest-first-screen.ts`). 문구·클래스를 두 벌로 두면
 * 하나만 고치는 날 서버 화면과 앱 화면이 갈리고, 마운트 때 화면이 바뀐다(에러는 0). 그래서 페이지와 워커가
 * **이 파일 하나**를 읽는다. 페이지는 문구를 `t(key, { defaultValue: GUEST_COPY.… })` 로 쓴다(다국어 유지).
 */

export const GUEST_CLS = {
  /** 🧷 2026-11-03 — 아래 고정 카카오 버튼(`dock`) 높이만큼 끝을 비워 마지막 줄이 버튼에 가리지 않게 한다. */
  root: 'min-h-[100dvh] bg-warm pb-32',
  title: 'px-4 pt-4 pb-2 text-[16px] font-bold tracking-tight text-gray-900 dark:text-white',
  /** 머리 — 큰 문장 두 줄 + 한 줄 설명. 세 탭이 같은 모양이다(2026-11-03 대표 "제안대로"). */
  hero: 'px-4 pt-2',
  headline: 'text-[20px] font-semibold leading-tight tracking-tight text-gray-900 dark:text-white',
  sub: 'mt-2 text-[15px] text-gray-500 dark:text-gray-400',
  /**
   * 🎫 이용권 탭 미리보기 — "산 이용권이 지갑에 이렇게 들어온다". 2026-11-04 대표 *"이용권 티켓 이제 저렇게 안생겼잖아"*
   *   *"가라로 매장 이용권 모습을 보여줘야 하는거 아니야?"* → 옛 QR 띠 티켓을 버리고 **지금 지갑 줄(`WalletRow`) 모양**
   *   (사진 · 가게 · 메뉴 · 남은 기간 · [사용] 알약)의 예시 두 장으로 그린다. 바탕은 옅은 면 하나(그림이라 — 판이 아니다).
   *   🎬 `ur-gp-*` 는 모션 표식 — 모양은 없고 움직임 CSS 는 GuestPassPage 가 앱에서만 꽂는다(서버 첫 화면은 정지 그림).
   */
  ticket: 'ur-gp-ticket mt-5 rounded-2xl bg-gray-100 dark:bg-white/5 divide-y divide-rule',
  walletRow: 'ur-gp-wrow flex items-center gap-3 px-4 py-3',
  walletThumb: 'w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-brand-tint',
  walletImg: 'w-full h-full object-cover',
  walletText: 'flex-1 min-w-0',
  walletStore: 'block text-[13px] text-gray-500 dark:text-gray-400 truncate',
  walletName: 'block text-[16px] font-semibold tracking-tight text-gray-900 dark:text-white truncate',
  walletDue: 'mt-1 flex items-center gap-1 text-[12px] tabular-nums text-gray-500 dark:text-gray-400',
  walletClock: 'w-[13px] h-[13px] shrink-0',
  walletUse: 'ur-gp-use shrink-0 inline-flex items-center h-8 px-3 rounded-full bg-brand text-white text-[13px] font-medium',
  /** 1 · 2 · 3 단계 — 혜택 목록(아이콘 상자 4줄)을 대신한다. */
  steps: 'mt-5 grid grid-cols-3 divide-x divide-rule border-y border-rule',
  step: 'px-1 py-3 text-center',
  stepNum: 'ur-gp-num block text-[12px] font-medium text-brand-text',
  stepText: 'block mt-1 text-[13px] font-medium leading-snug text-gray-900 dark:text-white',
  /**
   * 🧷 아래 고정 카카오 버튼 — 하단 탭(56px + 선 1px) 바로 위. 스크롤해도 늘 보인다.
   *   `app-frame-bar` 로 PC 액자 폭에 맞추고, 키보드가 열리면 하단 탭과 같이 숨는다.
   */
  dock: 'fixed left-0 right-0 bottom-[calc(57px+env(safe-area-inset-bottom,0px))] z-30 app-frame-bar hide-on-keyboard bg-warm px-4 pt-3 pb-3',
  dockNote: 'mt-2 text-center text-[12px] text-gray-500 dark:text-gray-400',
  kakao: 'w-full h-[52px] rounded-xl bg-[#FEE500] text-[#3C1E1E] text-[15px] font-bold flex items-center justify-center gap-2 active:opacity-80',
  kakaoIcon: 'w-[18px] h-[18px]',
  /** 🎬 2026-11-03 카카오 버튼을 지나가는 빛 칸 — 앱과 서버 첫 화면이 같은 모양이어야 해서 여기 둔다(CSS 는 GuestKakaoButton). */
  kakaoShine: 'ur-gk-shine absolute inset-0 pointer-events-none',
  /** 마이 탭 머리 — 마스코트 + 인사. */
  myHead: 'flex items-center gap-3',
  myHeadText: 'min-w-0',
  myHello: 'text-[16px] font-semibold text-gray-900 dark:text-white',
  myHelloSub: 'mt-1 text-[13px] text-gray-500 dark:text-gray-400',
} as const

/** 카카오 말풍선 — 버튼 아이콘(브랜드 규정 모양). 페이지와 서버가 같은 path 를 쓴다. */
export const KAKAO_BUBBLE_PATH = 'M12 3c5.5 0 10 3.58 10 8 0 4.42-4.5 8-10 8-1.15 0-2.25-.16-3.28-.45L3 21l1.45-5.72C3.55 14.2 3 12.66 3 11c0-4.42 4.5-8 9-8z'

/** 마이 탭 마스코트 — `Udal mood="hello" size={56}` (원본 332×487). 서버는 같은 크기의 빈 칸만 그린다. */
export const GUEST_MY_MASCOT = { width: 56, height: Math.round((56 * 487) / 332) } as const

export const GUEST_COPY = {
  kakaoStart: '카카오로 시작하기',
  pass: {
    title: '내 이용권',
    headline1: '동네 가게,',
    headline2: '미리 사면 더 싸요',
    /** 🎬 형광펜 구절(2026-11-04) — 앱 `MarkedLine` 과 서버 `markHtml` 이 같은 칸으로 감싼다. */
    headline2Mark: '더 싸요',
    sub: '산 이용권은 여기 지갑에 이렇게 들어와요',
    /** 예시 지갑 두 장 — 실제 가게·상품이 아니다. 사진은 `public/assets/guest/`(서버와 앱이 같은 주소). */
    wallet: [
      { store: '성수 브런치', name: '브런치 2인 세트', due: 'D-14', img: '/assets/guest/wallet-brunch.webp' },
      { store: '망원 네일', name: '젤 네일 기본', due: 'D-30', img: '/assets/guest/wallet-nail.webp' },
    ],
    use: '사용',
    steps: [['할인가로', '미리 사고'], ['가게에서', 'QR 보여주면 끝'], ['안 쓰면', '100% 자동환불']],
  },
  shop: {
    title: '유어샵',
    headline1: '팔아보고 싶은 가게 이용권,', // 2026-11-03 대표 "좋아하는 가게 이용권, 말고 팔아보고 싶은 가게 이용권 으로"
    headline2: '내 SNS 링크 하나에 모아요',
    /** 🎬 형광펜이 그어질 구절 — 앱(`GuestUrShopPage.MarkedLine`)과 서버 첫 화면(`markHtml`)이 같은 칸(`data-motion="mark"`)으로 감싼다. */
    headline2Mark: 'SNS 링크 하나',
    sub: '프로필에 걸어 두면 팔로워가 거기서 바로 사요',
    steps: [['마음에 드는', '이용권 담고'], ['내 링크를', '프로필에 걸면'], ['팔로워가', '거기서 바로 사요']],
    dockNote: '가입하면 내 유어샵이 바로 준비돼요',
  },
  my: {
    title: '마이',
    hello: '반가워요!',
    helloSub: '로그인하면 내 것이 여기 모여요',
    /** 로그인하면 모이는 것 — 값 대신 "로그인 후 보여요"(모르는 것을 0 이나 `-` 로 쓰지 않는다). */
    locked: ['내 딜', '내 이용권', '찜한 가게'],
    lockedHint: '로그인 후 보여요',
  },
} as const

/**
 * 🧪 로그인 전 화면의 **예시 이용권** (2026-11-03 대표 *"로그아웃 시에는 이용권도 이렇게 해야지, 실제 이용권으로 하면 어떡해"*).
 *
 * 로그인 전 탭(이용권·유어샵)은 실제 판매 중인 상품을 끌어다 쓰지 않는다 — 예시는 예시로 보여야 하고
 * (실제 가게 이름·사진이 "남의 진열대"처럼 보이면 안 된다), 데이터 요청이 없으니 화면이 늦게 밀리지도 않는다.
 * 사진은 AI 로 만든 예시 사진(`src/assets/guest/example-*.webp`, `kind` 로 고른다 — 부품 `GuestExampleRows`). 실제 가게 사진이 아니다. 누를 수 없다(`to` 없음).
 * ⚠️ 색 칸(`bg-lime-100` 등)으로 하지 말 것 — 이 디자인 시스템은 tailwind 색 이름을 회색(MONO)으로 접는다(첫 판이 회색 칸이 됐다).
 */
export const GUEST_EXAMPLE_PASSES = [
  { store: '성수 브런치', name: '브런치 2인 세트', pct: 32, price: 25000, kind: 'cafe' },
  { store: '망원 네일', name: '젤 네일 기본', pct: 25, price: 30000, kind: 'beauty' },
  { store: '합정 파스타', name: '파스타 세트 2인', pct: 20, price: 36000, kind: 'meal' },
] as const

/** 지갑 줄의 시계 그림 — `ClockIcon`(urdeal-icons)과 같은 획. 서버와 앱이 같은 path 를 쓴다. */
export const GUEST_CLOCK = { circle: { cx: 12, cy: 12, r: 8.4 }, path: 'M12 7.4v4.9l3.2 1.9' } as const
