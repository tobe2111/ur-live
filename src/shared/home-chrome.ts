/**
 * 🏠 모바일 홈 머리(검색창·카테고리 원)와 섹션 가로 줄의 클래스 — **화면과 워커 첫 화면이 같은 상수를 쓴다**
 * (2026-10-26 대표 확정 "안 A" — 그루폰식 메인).
 *
 * 왜 상수인가: 워커(`worker/utils/home-first-screen.ts`)는 React 없이 같은 모양을 문자열로 그린다.
 * 클래스를 두 벌 적으면 한쪽만 고쳐지고, 마운트 때 그 자리가 튄다(에러는 안 난다).
 * import 하면 갈릴 수가 없다 — `PASS_HEAD`·`STRIP_CLS` 와 같은 처방이다.
 *
 * ⚠️ 이 파일은 워커가 읽는다 — React·아이콘·`@/` 경로를 import 하지 말 것(번들 게이트).
 */

/** 검색창 줄 — 머리(sticky) 안, 로고 줄 아래. 누르면 `/search` 로 간다(진짜 입력은 그 화면에 있다). */
export const HOME_SEARCH = {
  row: 'px-4 pb-3',
  pill: 'flex items-center gap-2 h-11 pl-4 pr-1 rounded-full bg-gray-100 dark:bg-surface',
  text: 'flex-1 min-w-0 truncate text-[15px] text-gray-500 dark:text-gray-400',
  button: 'shrink-0 w-9 h-9 rounded-full bg-brand text-white flex items-center justify-center',
  placeholder: '동네 맛집, 미용실, 숙소 검색',
} as const

/**
 * 카테고리 원 줄 — 머리 **밖**(스크롤하면 올라간다). 원 안 그림은 채색 아이콘(`category-icons`)이고
 * 워커는 원과 라벨만 그린다 — 원 크기가 고정이라 그림이 나중에 들어와도 높이가 안 바뀐다.
 */
export const HOME_CATS = {
  /**
   * 🎬 줄 = [카테고리 원(옆으로 스크롤)] + [유어쇼츠 원(고정)]. 유어쇼츠를 스크롤 **안**에 넣으면 원이 일곱이라
   *   첫 화면 오른쪽 밖으로 밀려 안 보인다 — 2026-09-09 대표 확정(진입점은 스크롤하지 않아도 보인다)을 어긴다.
   */
  row: 'flex items-start gap-1 pt-1 pb-4 pr-2',
  nav: 'flex min-w-0 flex-1 gap-1 pl-2 overflow-x-auto scrollbar-hide',
  item: 'shrink-0 w-16 flex flex-col items-center gap-2',
  circle: 'w-14 h-14 rounded-full flex items-center justify-center bg-gray-100 dark:bg-surface',
  // inset — 바깥 테두리는 스크롤 영역(overflow)에 잘린다(첫 원의 왼쪽이 실제로 잘렸다).
  circleOn: 'ring-2 ring-inset ring-brand',
  label: 'text-[12px] font-medium leading-tight whitespace-nowrap',
  labelOn: 'text-gray-900 dark:text-white',
  labelOff: 'text-gray-600 dark:text-gray-300',
  /** 유어쇼츠 원의 라벨 — 카테고리가 아니라 다른 화면으로 가는 문이다. */
  shortsLabel: '유어쇼츠',
} as const

/**
 * 섹션 가로 줄(모바일) — 카드가 한 장 반쯤 보여 "옆으로 넘긴다" 를 말한다.
 * 카드 폭 68%: 첫 화면 사진은 200px 폭으로 미리 받는데(`home-card-preload`) 2배 화면에서 400px 라
 * 이 폭(약 230px)까지 선명하다. 더 넓히면 사진이 흐려지고, 그 폭을 올리면 preload 와 URL 이 갈린다.
 *
 * 📏 상품명은 늘 두 줄 자리를 잡는다(`min-h-[2lh]`) — 카드가 넓어져 짧은 이름은 한 줄이 되는데,
 *   자리표시는 두 줄이라 응답 순간 아래 유어쇼츠 줄이 20px 올라왔다(layout-shift 실측). 줄 안 카드 높이도 같아진다.
 */
export const HOME_SECTION_RAIL =
  'flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide [&>*]:snap-start [&>*]:shrink-0 [&>*]:w-[68%] [&_.line-clamp-2]:min-h-[2lh]'
