/**
 * 🔐 로그인 화면(`/login`) — 서버 첫 화면과 React 가 **같은 클래스·문구**를 쓰는 SSOT (2026-11-09).
 *
 * 라이브 실측(아이폰13 · 느린 4G · CPU 4배): HTML 0.29s 도착인데 첫 글자 **1.6s** — 화면 전부가 고정 문구(유달이·로고·
 * 한 줄·카카오 버튼·약관·링크 한 줄)인데 앱 코드가 다 와야 그려졌다. 로그인 전 탭(이용권·유어샵·마이)과 알림·찜 같은
 * 보호 경로가 전부 이 화면으로 보내므로, 새로 온 사람이 **가장 자주 처음 보는 화면**이다. ⇒ `guest-first-screen.ts` 의
 * 네 번째 탭(`login`)으로 서버가 그린다. 모양 값은 전부 여기서 가져간다(`LoginPage.tsx` 가 손으로 다시 적지 않는다 — 가드).
 *
 * 🎬 들어올 때 모션(`ur-lg-h`·`ur-lg-btn`)은 React 가 **서버 첫 화면이 없었을 때만** 붙인다 — 이미 보이는 글자가
 * 마운트 때 다시 0 에서 떠오르면 깜빡임이다(`boot-first-screen.ts` 가 그 사실을 안다).
 */
export const LOGIN_CLS = {
  root: 'min-h-[100dvh] bg-white dark:bg-[#11141C] flex flex-col items-center px-6 pt-12 pb-10',
  frame: 'w-full max-w-[360px] md:max-w-[400px] flex-1 flex flex-col',
  center: 'flex-1 flex flex-col items-center justify-center pb-10',
  /** 유달이 `<Udal mood="hello" size={64} priority motion className="block mb-5">` — 서버는 같은 속성의 <img>. */
  udal: 'block mb-5',
  h1: 'mt-3 text-[15px] font-normal text-gray-500 dark:text-gray-400 text-center leading-snug',
  kakao: 'w-full h-[52px] bg-[#FEE500] hover:bg-[#FDD835] text-[#3C1E1E] rounded-xl text-[15px] font-medium tracking-tight transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2',
  kakaoIcon: 'w-[18px] h-[18px]',
  terms: 'mt-3 text-center text-[12px] text-gray-500 dark:text-gray-400',
  termsLink: 'underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300',
  links: 'mt-8 flex items-center justify-center gap-3 text-[13px] text-gray-500 dark:text-gray-400',
  link: 'hover:text-gray-900 dark:hover:text-white transition-colors',
  linkSep: 'text-gray-300 dark:text-gray-500',
} as const

/** 유달이 가로 px · 로고 크기 — 둘 다 `LoginPage` 의 값 그대로. */
export const LOGIN_UDAL_SIZE = 64
export const LOGIN_LOGO_SIZE = 34

/** i18n 기본값 — 서버는 한국어 기본값을 그린다(첫 화면은 기기 언어를 모른다 · 로그인 전 탭과 같은 전제). */
export const LOGIN_COPY = {
  heroTitle: '우리 동네 가게, 미리 사면 더 싸게',
  kakaoStart: '카카오로 시작하기',
  termsLink: '이용약관',
  termsAnd: '및',
  privacyLink: '개인정보처리방침',
  loginWithEmail: '이메일로 로그인',
  agencyLogin: '에이전시 로그인',
} as const
