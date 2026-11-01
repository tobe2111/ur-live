/**
 * 🚪 로그인 전 탭 화면(이용권 · 유어샵 · 마이)의 **문구와 모양 SSOT** (2026-10-19).
 *
 * 워커가 같은 화면을 서버 첫 화면으로 그린다(`worker/utils/guest-first-screen.ts`). 문구·클래스를 두 벌로 두면
 * 하나만 고치는 날 서버 화면과 앱 화면이 갈리고, 마운트 때 화면이 바뀐다(에러는 0). 그래서 페이지와 워커가
 * **이 파일 하나**를 읽는다. 페이지는 문구를 `t(key, { defaultValue: GUEST_COPY.… })` 로 쓴다(다국어 유지).
 */

export const GUEST_CLS = {
  root: 'min-h-[100dvh] bg-warm pb-8',
  title: 'px-4 pt-4 pb-2 text-[17px] font-bold tracking-tight text-gray-900 dark:text-white',
  /**
   * 🤍 2026-11-01 — 바탕이 흰색이 되면서(대표 확정) 이 카드는 **바탕과 같은 색**이 됐다. 둘을 가르던
   *   밝기 차가 0 이라 남은 건 그림자 하나다. 대표가 시안 셋 중 **"처방 1 그림자"** 를 골라
   *   `--lift` 를 잉크 6% → 12% 로 올렸다(`index.css`) — 카드 구조는 그대로 두고 그림자만 진하게.
   */
  card: 'mx-4 mt-2 rounded-2xl bg-surface shadow-lift p-5',
  headline: 'text-[24px] font-bold leading-tight tracking-tight text-gray-900 dark:text-white',
  benefits: 'flex flex-col gap-4',
  benefit: 'flex items-start gap-3',
  benefitIcon: 'shrink-0 w-9 h-9 rounded-xl bg-brand-tint text-brand-text flex items-center justify-center',
  benefitText: 'min-w-0',
  benefitTitle: 'block text-[15px] font-bold text-gray-900 dark:text-white',
  benefitDesc: 'block mt-1 text-[13px] text-gray-500 dark:text-gray-400',
  kakao: 'w-full h-[52px] rounded-xl bg-[#FEE500] text-[#3C1E1E] text-[15px] font-bold flex items-center justify-center gap-2 active:opacity-80',
  kakaoIcon: 'w-[18px] h-[18px]',
  /** 유어샵 탭 — 카드가 아니라 바탕 위 문단이다. */
  shopBody: 'px-4',
  shopHeadline: 'mt-2 text-[24px] font-bold leading-tight tracking-tight text-gray-900 dark:text-white',
  shopSub: 'mt-2 text-[15px] text-gray-500 dark:text-gray-400',
  /** 마이 탭 카드 머리 — 마스코트 + 인사. */
  myHead: 'flex items-center gap-4',
  myHeadText: 'min-w-0',
  myHello: 'text-[17px] font-bold text-gray-900 dark:text-white',
  myHelloSub: 'mt-1 text-[13px] text-gray-500 dark:text-gray-400',
  myStats: 'mt-4 grid grid-cols-3 border-t border-rule pt-4 text-center',
  myStatValue: 'text-[17px] font-bold text-gray-400 dark:text-gray-500',
  myStatLabel: 'mt-1 text-[12px] text-gray-500 dark:text-gray-400',
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
    benefits: [
      ['정가보다 할인가로', '가게마다 정해 둔 할인가로 미리 사 둬요'],
      ['매장에선 QR만 보여주면 끝', '산 이용권은 여기 지갑에 바로 들어와요'],
      ['안 쓰면 100% 자동환불', '못 가게 돼도 걱정 없어요'],
      ['친구에게 선물하기', '산 이용권을 카톡으로 보낼 수 있어요'],
    ],
  },
  shop: {
    title: '유어샵',
    headline1: '좋아하는 가게 이용권,',
    headline2: '내 SNS 링크 하나에 모아요',
    sub: '프로필에 걸어 두면 팔로워가 거기서 바로 사요',
  },
  my: {
    title: '마이',
    hello: '반가워요!',
    helloSub: '산 이용권·딜·찜한 가게를 한곳에서',
    stats: ['보유 딜', '내 이용권', '찜한 가게'],
  },
} as const
