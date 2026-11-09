/**
 * 🖥️ PC 홈 첫 화면 **클래스·사진 폭 SSOT** (2026-11-09 대표 "1~4번 모두 진행" 의 ③ — PC 홈 서버 첫 화면).
 *
 * 라이브 실측(1440px, 데스크톱 UA): 첫 글자 2.25초 — 폰 홈은 서버가 첫 화면을 그리는데 PC 홈은 `#root` 가 로더뿐이었다.
 * 워커(`worker/utils/pc-home-first-screen.ts`)와 화면(`pages/pc-home/PcHeroBanners.tsx`)이 **같은 상수**로 같은 상자를 그린다 —
 * 한 토큰이라도 갈리면 마운트 때 그 자리가 튄다(시험이 컴포넌트를 렌더해 대조한다).
 *
 * 그리는 것: [상단 네비 **높이만**(68 + 1 + 44 — 글리프 없음)] + [색면 + 큰 배너 1 · 작은 배너 2]. 그 아래는 로더.
 * 안 그리는 것: 어드민 섹션 줄·지역 4칸·목록 — 서버가 모르는 상태(위치·카테고리)에 달려 있거나 화면 아래다.
 */
export const PC_HOME_FS = {
  /** `DesktopTopNav` 헤더(홈): 1행 68px + 경계선 + 카테고리 행 44px. 글리프는 안 그린다(두 벌이 갈리는 클래스). */
  topnav: 'hidden md:block bg-white/95 dark:bg-[#11141C]/95 border-b border-gray-100 dark:border-[#2C2F35]',
  topnavRow1: 'h-[68px]',
  topnavRow2: 'border-t border-gray-100 dark:border-[#2C2F35] h-11',
  /** `PcHomePage` 루트·컨테이너 */
  field: 'bg-[var(--home-field)] min-h-[100dvh]',
  container: 'max-w-[1440px] mx-auto px-5 lg:px-8 pt-6 pb-10 flex flex-col gap-5',
  /** `PcHeroBanners` */
  sectionBase: 'grid gap-3 h-[clamp(240px,24vw,340px)]',
  sectionCols2: 'grid-cols-[minmax(0,2fr)_minmax(0,1fr)]',
  sectionCols1: 'grid-cols-1',
  bigWrap: 'relative min-w-0',
  slide: 'absolute inset-0 flex flex-col justify-end isolate overflow-hidden rounded-2xl px-6 pb-5',
  img: 'absolute inset-0 -z-10 w-full h-full object-cover',
  grad: 'absolute inset-x-0 bottom-0 h-[70%] -z-10 bg-gradient-to-t from-black/70 via-black/30 to-transparent',
  titleBase: 'block max-w-[70%] font-semibold leading-[1.25] tracking-[-.02em] line-clamp-2 text-white dark:text-white [text-shadow:0_1px_8px_rgba(0,0,0,.25)]',
  titleBig: 'text-[20px]',
  titleSmall: 'text-[16px]',
  descBase: 'block max-w-[70%] mt-1 line-clamp-1 text-white/90 dark:text-white/90',
  descBig: 'text-[15px]',
  descSmall: 'text-[12px]',
  sideGrid: 'grid gap-3 min-w-0',
  sideRows2: 'grid-rows-2',
  sideRows1: 'grid-rows-1',
  sideCell: 'relative min-h-0',
} as const

/** 사진 폭·화질 — 카드와 preload 가 같은 주소를 만들어야 한다(다르면 브라우저가 preload 를 버린다). */
export const PC_HERO_IMG = { big: { width: 1100, quality: 76 }, small: { width: 560, quality: 76 } } as const
/** 큰 자리 하나 + 오른쪽 둘까지 돌리는 배너 수 상한(`PcHeroBanners` 의 slice). */
export const PC_HERO_MAX = 5

export interface PcHeroBanner { id: number; title: string; image_url: string; link_url?: string | null; description?: string | null; banner_slot?: string | null; display_order?: number }

/** `/api/banners` 응답 원문 → PC 맨 위가 도는 `strip` 배너(최대 5). 화면(`useHomeBanners('strip')`)과 같은 거름망. */
export function pcHeroBannersFromPayload(payload: string | null | undefined): PcHeroBanner[] {
  try {
    if (!payload) return []
    const parsed = JSON.parse(payload) as { success?: boolean; data?: PcHeroBanner[] }
    if (!parsed?.success || !Array.isArray(parsed.data)) return []
    return parsed.data.filter((b) => b && b.banner_slot === 'strip' && typeof b.title === 'string').slice(0, PC_HERO_MAX)
  } catch { return [] }
}
