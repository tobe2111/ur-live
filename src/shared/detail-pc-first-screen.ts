/**
 * 🖥️ 이용권 상세 **PC(lg+) 서버 첫 화면** 의 클래스·문구 (2026-11-09 대표 승인 — "가장 이상적으로 진행").
 *
 * 2026-09-16 에 "PC 는 안 그린다" 로 정했던 이유 셋(`detail-ssr-body.ts` 머리말 옛 ❌)을 이렇게 푼다:
 *   1. 2열 그리드 — **그리드 통째로** 그린다(좌 열 + 우 360px `<aside>` 빈 칸). 반쪽만 그리지 않으니 마운트 때 가로가 안 줄어든다.
 *   2. 제목 헤더의 SVG(핀) — 같은 크기 빈 칸(15px). 별점은 React 도 글자 ★ 라 그대로 그린다(`StarRating`).
 *   3. "PC 는 빨리 파싱한다" — 라이브 실측(1440px·4G·CPU 4배) PC 상세 LCP **2.47s**(첫 글자 0.76s). 그림이 앱 뒤였다.
 *
 * 값은 React 원본(`GroupBuyDetailPage`·`DetailGallery`·`DetailTitleHeader`)의 className **그대로**다 — 시험이 원본 소스에서
 * 문자열을 뽑아 한 글자씩 대조한다(그 파일 셋 중 둘은 잠금표 파일이라 import 로 묶지 않고 대조만 한다).
 */
export const DETAIL_PC_FS = {
  /** `GroupBuyDetailPage` 2열 그리드 */
  grid: 'lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8 lg:max-w-[1200px] lg:mx-auto lg:items-start lg:pt-1',
  leftCol: 'lg:min-w-0',
  /** 갤러리 바깥(히어로 ref 가 걸린 상자) — `style="background:var(--gbd-card)"` 와 짝 */
  heroBox: 'relative lg:rounded-2xl lg:overflow-hidden',
  /** `DetailGallery` PC 블록 */
  pcWrap: 'hidden lg:block relative',
  pcGridMulti: 'grid grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)] gap-2',
  pcMain: 'relative block w-full text-[60px] flex items-center justify-center cursor-zoom-in',
  pcThumbCol: 'grid grid-rows-2 gap-2',
  pcThumb: 'relative w-full h-full cursor-pointer',
  pcRest: 'absolute inset-0 flex flex-col items-center justify-center bg-black/55 text-white text-[13px] font-medium',
  pcRestN: 'text-[16px] font-semibold',
  /** `DetailTitleHeader` */
  header: 'hidden lg:block lg:pt-6 lg:pb-2',
  store: 'text-[12px] font-medium tracking-[.01em] text-brand',
  onnuri: 'ml-2 px-2 py-[1px] rounded bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[12px] font-medium align-middle',
  h1: 'mt-2 text-[20px] leading-[1.3] font-semibold tracking-[-.02em] text-gray-900 dark:text-white',
  meta: 'mt-2 flex items-center gap-2 flex-wrap text-[13px] text-gray-500 dark:text-gray-400',
  metaGroup: 'inline-flex items-center gap-2',
  ratingB: 'font-bold text-gray-900 dark:text-white',
  ratingCount: 'text-gray-400 dark:text-gray-500',
  sep: 'text-gray-200 dark:text-[#2C2F35]',
  pin: 'w-[15px] h-[15px] shrink-0',
  phone: 'font-medium no-underline text-gray-700 dark:text-gray-200 border-b border-line',
  /** 우측 구매 박스 자리(`<aside>`) — 서버는 빈 칸만(내용은 상태가 있어야 그린다) */
  aside: 'hidden lg:block lg:sticky lg:top-[116px] lg:self-start lg:pb-10',
} as const

/** `DetailGallery` PC 썸네일 칸 수 · 배지 그라데이션 두 장(인라인 style 그대로) */
export const DETAIL_PC_THUMBS = 2
export const DETAIL_PC_SCRIM_TOP = 'position:absolute;inset:0 0 auto 0;height:110px;pointer-events:none;background:linear-gradient(180deg, rgba(0,0,0,.4), transparent)'
export const DETAIL_PC_SCRIM_BOTTOM = 'position:absolute;inset:auto 0 0 0;height:120px;pointer-events:none;background:linear-gradient(0deg, rgba(0,0,0,.32), transparent)'
/** `DetailTitleHeader` 의 i18n 기본 문구 */
export const DETAIL_PC_COPY = { registeredStore: ' · 정식 등록 매장', onnuri: '온누리 사용 가능', allPhotos: (n: number) => `전체 사진 ${n}장` } as const
