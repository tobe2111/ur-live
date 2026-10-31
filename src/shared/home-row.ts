/**
 * 🧾 홈 이용권 **한 줄 카드**(Y2) — 화면(`GroupBuyFeedCard layout="row"`)과 워커 첫 화면이 같이 쓰는 규칙
 * (2026-10-31 대표 확정 — 시안 `FeedY2*` *"y2대로 해줘 모두"*).
 *
 * [사진 120 정사각 왼쪽] · [종류·거리 / 가게 이름 / 메뉴 두 줄 / ★ 별점 / 구매 수 · 가격 오른쪽 아래]
 *
 * 왜 상수인가: 워커는 React 없이 같은 모양을 문자열로 그린다. 클래스를 두 벌 적으면 한쪽만 고쳐지고
 * 마운트 때 줄이 튄다(에러는 안 난다). `HOME_SECTION_RAIL`·`PASS_HEAD` 와 같은 처방.
 *
 * ⚠️ 이 파일은 워커가 읽는다 — React·아이콘·`@/` 경로를 import 하지 말 것(번들 게이트).
 */
import { DEAL_CAT_LABELS } from './deal-cats'

export const HOME_ROW_CLS = {
  /** 줄 하나 — 위아래 16 · 줄 사이 가는 선(마지막 줄은 선 없음). */
  link: 'flex gap-3 py-4 border-b border-rule last:border-b-0 group active:opacity-80',
  /** 사진 칸 — 폭 고정. 안의 사진 상자는 카드 미디어(`DealCardMedia`)가 그린다. */
  thumb: 'w-[120px] shrink-0',
  /** 사진 상자 모양 — `DealCardMedia` 의 `aspectClass` + `className`. */
  mediaAspect: 'aspect-square',
  mediaBox: 'rounded-xl bg-gray-100 dark:bg-wash',
  /**
   * 📏 본문 높이를 사진과 같은 120 으로 **고정**한다 — 줄 높이가 상품마다 갈리면 자리표시(로딩)와
   *   실제 줄의 높이가 달라 응답 순간 아래가 밀린다. 그래서 메뉴는 별점이 있으면 한 줄, 없으면 두 줄
   *   (`menuLines`)이고, 어느 쪽이든 120 안에 들어간다(종류 15 · 가게 23 · 메뉴 18/35 · 별점 22 · 가격 41).
   */
  body: 'flex-1 min-w-0 h-[120px] overflow-hidden flex flex-col',
  meta: 'text-[12px] leading-tight text-gray-500 dark:text-gray-400 truncate',
  store: 'mt-1 flex items-center gap-1 min-w-0 text-[15px] font-medium leading-tight text-gray-900 dark:text-white',
  onnuri: 'shrink-0 px-1 py-[1px] rounded bg-brand-tint text-brand-text text-[12px] font-medium',
  menu: 'mt-0.5 text-[13px] leading-tight text-gray-700 dark:text-gray-300',
  menu1: 'line-clamp-1',
  menu2: 'line-clamp-2',
  rateRow: 'flex items-center gap-1 mt-1 text-[12px] leading-[18px] text-gray-500 dark:text-gray-400',
  /** 별 — 글자 ★ 하나(워커가 SVG path 를 두 벌 갖지 않게). */
  star: 'text-yellow-400 leading-none',
  rateNum: 'font-medium text-gray-900 dark:text-white',
  foot: 'mt-auto pt-2 flex items-end justify-between gap-2',
  sold: 'text-[12px] text-gray-400 dark:text-gray-500 whitespace-nowrap',
  priceBox: 'text-right min-w-0',
  orig: 'text-[12px] leading-none line-through text-gray-500 dark:text-gray-400',
  priceRow: 'flex items-baseline justify-end gap-1 mt-1 leading-none whitespace-nowrap',
  discount: 'text-[15px] font-bold text-sale',
  price: 'text-[17px] font-bold tracking-tight text-gray-900 dark:text-white',
  perNight: 'text-[12px] font-medium text-gray-500 dark:text-gray-400',
} as const

/** 홈 탭과 같은 낱말(같은 화면에서 '미용'·'뷰티' 가 갈리지 않게). 탭에 없는 종류만 아래 표. */
const EXTRA_LABEL: Record<string, string> = { health_voucher: '건강', pet_voucher: '반려', activity_voucher: '액티비티' }

export function homeRowCategoryLabel(cat: string | null | undefined): string {
  const c = cat || ''
  return DEAL_CAT_LABELS.find((x) => x.key === c && x.key !== 'all')?.label ?? EXTRA_LABEL[c] ?? '이용권'
}

/** 주소 앞 두 마디 — `서울 마포구`. 행정 접미사는 떼서 짧게. */
export function homeRowRegion(address: string | null | undefined): string {
  return String(address || '')
    .replace(/특별자치도|특별자치시|특별시|광역시/g, '')
    .trim().split(/\s+/).filter(Boolean).slice(0, 2).join(' ')
}

/**
 * 맨 윗줄 — `식사 · 0.8km`. 거리를 모르면(위치 꺼짐 · 서버 첫 화면) 지역 이름.
 * 한 줄 말줄임이라 거리 ↔ 지역이 바뀌어도 줄 높이는 같다(마운트 때 안 튄다).
 */
export function homeRowMeta(cat: string | null | undefined, distKm: string | null, address: string | null | undefined): string {
  const where = distKm != null ? `${distKm}km` : homeRowRegion(address)
  return where ? `${homeRowCategoryLabel(cat)} · ${where}` : homeRowCategoryLabel(cat)
}

/** `251명 구매` · `1.2천명 구매` — 0 이면 빈 값(0명을 적지 않는다). */
export function homeRowSold(n: number | null | undefined): string {
  const v = Number(n) || 0
  if (v <= 0) return ''
  const s = v >= 10_000 ? `${Math.floor(v / 1000) / 10}만` : v >= 1000 ? `${Math.floor(v / 100) / 10}천` : String(v)
  return `${s}명 구매`
}
