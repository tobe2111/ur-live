/**
 * 🗺️ 동네딜 지도(`/map`)의 **서버가 그리는 첫 화면** (2026-11-09 대표 *"계속 최적화"*).
 *
 * 라이브 실측(폰 4G 흉내): first-paint 1.96s · 첫 글자 **2.93s** — 소비자 화면 중 가장 늦었다(다른 화면 0.5초대).
 * 게다가 그 첫 글자가 `restaurantMap.mapLoading` 같은 **번역 키 원문**이었다(사전 청크가 2.56s 에 와서, React 가 먼저 그렸다).
 * 지도 화면은 지도 SDK·타일이 어차피 늦게 오므로, 그 전까지 보일 **껍데기**(회색 지도 자리 + 상단 검색·칩 + 시트 머리)를
 * 서버가 그린다 — 화면이 마운트 때 같은 상자를 같은 자리에 그리므로 밀림이 없다.
 *
 * 그리는 것(폰만 — PC 는 좌측 패널 분할이라 모양이 다르다):
 *   1. 회색 지도 자리 + "지도를 불러오는 중..." (`RestaurantMapPage` 의 SDK 대기 블록과 같은 클래스·글자)
 *   2. 상단 플로팅 바(`MapTopBar variant='overlay'`): 뒤로 칸 · 검색 상자 · 칩 줄(필터·내 주변·전체(선택)·식사·뷰티·헬스·숙소·생활·기타)
 *   3. 하단 시트(peek) 껍데기: 손잡이 + 개수·정렬 줄(`SheetFilterBar hideChips`) — 목록은 안 그린다(앱이 받는다).
 * 아이콘(뒤로·검색·필터·나침반·카테고리·정렬 화살표)은 같은 크기의 빈 칸. 글자는 ko 사전의 값 그대로(시험이 대조).
 */
import { MAP_VOUCHER_DEFS } from '../../pages/restaurant-map/voucher-types'
import { SHEET_BASE_TOP, SHEET_SNAP_TRANSLATE } from '../../pages/restaurant-map/useSheetDrag'
import { pcTopNavBlockHtml } from './pc-topnav-first-screen'

/** 홈 첫 화면 모듈의 escText 와 같다 — 그 모듈을 import 하면 지도 표면 CSS 가 홈 카드 클래스까지 끌고 와 상한(40KB)을 넘는다(2026-11-12 실측 42.6KB). */
function escText(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;')
}

export const MAP_FS_CLASS = {
  screen: 'h-[100dvh] relative w-full bg-gray-100 dark:bg-[#1D1F29] overflow-hidden pb-16 lg:h-[calc(100dvh-102px)]',
  mapWait: 'absolute inset-0 lg:left-[400px] bg-gray-100 dark:bg-[#1D1F29] flex flex-col items-center justify-center pointer-events-none',
  mapWaitIcon: 'w-12 h-12 text-gray-300 dark:text-gray-600 mb-3',
  mapWaitTitle: 'text-[15px] text-gray-500 dark:text-gray-400 font-medium',
  mapWaitSub: 'text-[12px] text-gray-400 dark:text-gray-500 mt-1',
  bar: 'light-island lg:hidden absolute top-0 left-0 right-0 z-40 px-3 pt-3 pointer-events-none',
  barInner: 'ur-content-wide pointer-events-auto space-y-2',
  row1: 'flex items-center gap-2',
  overlaySurf: 'bg-white text-gray-800 shadow-[0_2px_8px_rgba(22,24,28,0.14)]',
  overlayOn: 'bg-brand text-white shadow-[0_2px_8px_rgba(22,24,28,0.14)]',
  overlayNear: 'bg-white text-brand shadow-[0_2px_8px_rgba(22,24,28,0.14)]',
  back: 'w-11 h-11 flex items-center justify-center rounded-2xl shrink-0',
  searchWrap: 'flex-1 relative',
  searchIcon: 'absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400',
  input: 'w-full h-11 pl-11 pr-9 rounded-2xl text-[15px] text-ellipsis focus:outline-none focus:ring-2 focus:ring-brand',
  inputOverlay: 'text-gray-900 placeholder:text-gray-400',
  chips: 'flex gap-2 items-center overflow-x-auto scrollbar-hide',
  chipBase: 'flex items-center gap-1 h-[30px] px-2 rounded-full text-[12px] font-medium shrink-0 transition-colors',
  sheet: 'absolute left-0 right-0 bottom-0 z-30 bg-warm rounded-t-3xl shadow-[0_-4px_24px_rgba(0,0,0,0.08)] flex flex-col lg:top-0 lg:w-[400px] lg:right-auto lg:rounded-none lg:shadow-none lg:border-r lg:border-gray-100 dark:lg:border-[#2C2F35]',
  handleWrap: 'flex justify-center py-3 cursor-grab active:cursor-grabbing select-none touch-none lg:hidden',
  handle: 'h-1 rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none w-10 bg-gray-300',
  filterBar: 'px-3 pb-2 border-b border-gray-100 dark:border-[#2C2F35] shrink-0',
  countRow: 'flex items-center justify-between mt-2 px-1',
  countLeft: 'flex items-center gap-2',
  countText: 'text-[12px] text-gray-500 dark:text-gray-400',
  countNum: 'ur-count-in font-bold text-gray-900 dark:text-white',
  sortBtn: 'flex items-center gap-1 text-[12px] font-medium text-gray-700 dark:text-gray-200 px-2 py-1 rounded-lg active:bg-gray-100 dark:active:bg-[#1D1F29]',
  sortIcon: 'w-3 h-3 text-gray-400 dark:text-gray-500',
  /** 🖥️ 2026-11-12 PC 패널 머리(`MapTopBar variant='panel'`) — 그 파일의 문자열과 글자 대조(시험). */
  panel: 'hidden lg:block px-3 pt-3 pb-2 space-y-2 border-b border-gray-100 dark:border-[#2C2F35]',
  panelInner: 'space-y-2',
  panelSearchIcon: 'absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 dark:text-gray-500',
  panelInput: 'bg-white dark:bg-[#11141C] border border-gray-200 dark:border-[#2C2F35] shadow-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500',
  panelGrid: 'grid grid-cols-7 gap-1',
  panelBtnOff: 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.05]',
  panelBtnOn: 'text-brand-text bg-brand-tint font-bold',
  panelBtn: 'flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition-colors',
  panelLabel: 'text-[12px] font-medium leading-none',
  panelCatLabel: 'text-[12px] leading-none whitespace-nowrap',
} as const
const C = MAP_FS_CLASS
/** ko 사전 값 그대로(`public/locales/ko/translation.json`) — 시험이 대조한다. */
export const MAP_FS_TEXT = { mapLoading: '지도를 불러오는 중...', sdkLoading: '카카오맵 SDK 로딩 중', searchPlaceholder: '맛집 이름·지역 검색', searchAria: '검색', nearMe: '내 주변', count: '곳', sortDefault: '할인율순', filterAria: '지역·카테고리 필터 열기', sortAria: '정렬' } as const
export const MAP_FS_CHIP_LABELS: Record<string, string> = { all: '전체', meal_voucher: '식사', beauty_voucher: '뷰티·헬스', stay_voucher: '숙소', home_voucher: '생활', etc_voucher: '기타' }

const blank = (cls: string) => `<span class="${cls}" aria-hidden="true"></span>`

/**
 * @param pcPath 데스크톱 요청이면 그 pathname. 🖥️ 2026-11-12 PC 는 첫 글자 2.8~4.3s(로더뿐)였다 — PC 는 [상단 네비(딜 카테고리 숨김)] +
 *   [왼쪽 400px 패널: 검색 · 칩 7칸 그리드 · 개수/정렬 줄] + [오른쪽 지도 자리] 를 그린다. 폰(`undefined`)은 종전 그대로.
 */
export function buildMapFirstScreen(pcPath?: string): string {
  const mapWait = `<div class="${C.mapWait}">${blank(C.mapWaitIcon + ' block')}<p class="${C.mapWaitTitle}">${escText(MAP_FS_TEXT.mapLoading)}</p><p class="${C.mapWaitSub}">${escText(MAP_FS_TEXT.sdkLoading)}</p></div>`
  const chip = (cls: string, iconCls: string, label?: string) => `<span class="${C.chipBase} ${cls}">${blank(iconCls + ' block')}${label ? `<span>${escText(label)}</span>` : ''}</span>`
  const chips = `<div class="${C.chips}">` +
    chip(C.overlaySurf, 'w-3.5 h-3.5') + // 필터(아이콘만)
    chip(C.overlayNear, 'w-3.5 h-3.5', MAP_FS_TEXT.nearMe) +
    MAP_VOUCHER_DEFS.map((v) => chip(v.key === 'all' ? C.overlayOn : C.overlaySurf, 'w-[15px] h-[15px]', MAP_FS_CHIP_LABELS[v.key] ?? v.defaultLabel)).join('') +
    '</div>'
  const bar = `<div class="${C.bar}"><div class="${C.barInner}"><div class="${C.row1}">${blank(`${C.back} ${C.overlaySurf}`)}<div class="${C.searchWrap}">${blank(C.searchIcon + ' block')}<input readonly placeholder="${escText(MAP_FS_TEXT.searchPlaceholder)}" aria-label="${escText(MAP_FS_TEXT.searchAria)}" class="${C.input} ${C.overlaySurf} ${C.inputOverlay}"></div></div>${chips}</div></div>`
  const sheet = `<div class="${C.sheet}" role="dialog" aria-label="맛집 목록" style="top:${SHEET_BASE_TOP};transform:${SHEET_SNAP_TRANSLATE.peek};will-change:transform">` +
    `<div class="${C.handleWrap}"><div class="${C.handle}"></div></div>` +
    `<div class="${C.filterBar}"><div class="${C.countRow}"><div class="${C.countLeft}"><span class="${C.countText}"><span class="${C.countNum}">…</span>${MAP_FS_TEXT.count}</span></div>` +
    `<span class="${C.sortBtn}">${blank(C.sortIcon + ' block')}<span>${escText(MAP_FS_TEXT.sortDefault)}</span>${blank(C.sortIcon + ' block')}</span></div></div></div>`
  if (!pcPath) return `<div id="ur-first-screen"><div class="lg:hidden"><div class="${C.screen}">${mapWait}${bar}${sheet}</div></div></div>`
  const pBtn = (on: boolean, rel: string, iconCls: string, label: string, labelCls: string) =>
    `<span class="${rel}${C.panelBtn} ${on ? C.panelBtnOn : C.panelBtnOff}">${blank(iconCls + ' block')}<span class="${labelCls}">${escText(label)}</span></span>`
  const panel = `<div class="${C.panel}"><div class="${C.panelInner}"><div class="${C.row1}"><div class="${C.searchWrap}">${blank(C.panelSearchIcon + ' block')}` +
    `<input readonly placeholder="${escText(MAP_FS_TEXT.searchPlaceholder)}" aria-label="${escText(MAP_FS_TEXT.searchAria)}" class="${C.input} ${C.panelInput}"></div></div>` +
    `<div class="${C.panelGrid}">` +
      pBtn(false, 'relative ', 'w-[17px] h-[17px]', '필터', C.panelLabel) +
      pBtn(false, '', 'w-[17px] h-[17px]', MAP_FS_TEXT.nearMe, C.panelLabel) +
      MAP_VOUCHER_DEFS.map((v) => pBtn(v.key === 'all', '', 'w-[17px] h-[17px]', v.shortLabel ?? MAP_FS_CHIP_LABELS[v.key] ?? v.defaultLabel, C.panelCatLabel)).join('') +
    '</div></div></div>'
  const pcSheet = `<div class="${C.sheet}" role="dialog" aria-label="맛집 목록" style="top:0">` +
    `<div class="${C.handleWrap}"><div class="${C.handle}"></div></div>` + panel +
    `<div class="${C.filterBar}"><div class="${C.countRow}"><div class="${C.countLeft}"><span class="${C.countText}"><span class="${C.countNum}">…</span>${MAP_FS_TEXT.count}</span></div>` +
    `<span class="${C.sortBtn}">${blank(C.sortIcon + ' block')}<span>${escText(MAP_FS_TEXT.sortDefault)}</span>${blank(C.sortIcon + ' block')}</span></div></div></div>`
  return `<div id="ur-first-screen">${pcTopNavBlockHtml(pcPath, { hideDealCats: true })}<div class="${C.screen}">${mapWait}${pcSheet}</div></div>`
}
