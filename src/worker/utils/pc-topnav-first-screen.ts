/**
 * 🖥️ PC 상단 네비(`DesktopTopNav`, 풀너비 표면) **서버 첫 화면** — 로고 · 검색창 · 둘째 줄 메뉴 글자.
 *   2026-11-12 PC 홈(#2343)에서 시작해 교환권 상세(`/vouchers/:id`)도 같이 쓰게 뗐다.
 *   클래스 SSOT `shared/pc-topnav-first.ts`(DesktopTopNav 소스와 글자 대조 시험). 아이콘은 같은 16px 빈 칸.
 *   켜짐 표시는 앱의 `isActivePath` 와 같은 규칙: 서비스 축은 경로 일치 · 딜 카테고리는 홈(`/`)에서 '전체'만.
 *   ⚠️ 이 파일은 홈 첫 화면 모듈을 import 하지 않는다 — 표면별 critical CSS 생성기가 import 를 따라가므로
 *   교환권 상세 표면에 홈 카드 클래스가 끌려오면 상한(40KB)을 넘는다.
 */
import { PC_TOPNAV_CLS as TN, PC_TOPNAV_SERVICES, PC_TOPNAV_SEARCH_PLACEHOLDER } from '../../shared/pc-topnav-first'
import { PC_TOPNAV_FRAME as FR } from '../../shared/pc-topnav-frame'
import { DEAL_CAT_LABELS } from '../../shared/deal-cats'
import { HOME_TOP_LOGO } from './home-top-markup'

const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** `<UrDealLogo size={20} />` — 폰 머리의 17px 판(HOME_TOP_LOGO)과 같은 마크업에서 크기만 바꾼다(점 = 0.18·0.08 비율). */
const PC_LOGO = HOME_TOP_LOGO.replace('font-size:17px', 'font-size:20px').replace('width:3.06px;height:3.06px', 'width:3.6px;height:3.6px').replace('margin-left:1.36px', 'margin-left:1.6px')
const SEARCH_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-[18px] h-[18px]"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>'

/** `DesktopTopNav.isActivePath` 와 같은 규칙. */
export function topNavActive(path: string, cur: string): boolean {
  if (path === '/') return cur === '/'
  return cur === path || cur.startsWith(path + '/')
}

/** 두 줄 HTML(`\u0000` 으로 구분). `activePath` = 지금 주소의 pathname. */
export function pcTopNavRowsHtml(activePath: string, opts: { hideDealCats?: boolean } = {}): string {
  const item = (label: string, href: string, on: boolean) =>
    `<a href="${esc(href)}" class="${TN.itemBase} ${on ? TN.itemOn : TN.itemOff}"><span class="w-4 h-4" aria-hidden="true"></span>${esc(label)}` +
    (on ? `<span aria-hidden="true" class="${TN.dot}"></span>` : '') + '</a>'
  const services = PC_TOPNAV_SERVICES.map((x) => item(x.label, x.path, topNavActive(x.path, activePath))).join('')
  const onHome = activePath === '/'
  const cats = DEAL_CAT_LABELS.map(({ key, label }) => item(label, key === 'home_voucher' ? '/life' : key === 'all' ? '/' : `/?category=${key}`, onHome && key === 'all')).join('')
  const row1 = `<div class="${TN.row1}"><a href="/" class="${TN.logoLink}">${PC_LOGO}</a>` +
    `<form action="/search" method="get" class="${TN.searchForm}"><div class="relative"><span class="${TN.searchIcon}" aria-hidden="true">${SEARCH_SVG}</span>` +
    `<input type="search" name="q" placeholder="${esc(PC_TOPNAV_SEARCH_PLACEHOLDER)}" class="${TN.searchInput}">` +
    `<button type="submit" aria-label="검색" class="${TN.searchBtn}">${SEARCH_SVG}</button></div></form><div class="${TN.right}"></div></div>`
  // 🗺️ 지도(/map)는 앱이 딜 카테고리와 구분선을 숨긴다(`hideDealCats`) — 같은 모양이어야 마운트 때 안 바뀐다.
  const tail = opts.hideDealCats ? '' : `<span aria-hidden="true" class="${TN.sep}"></span>${cats}`
  const row2 = `<div class="${TN.row2Wrap}"><div class="${TN.row2Inner}"><nav aria-label="카테고리" class="${TN.row2Nav}">${services}${tail}</nav></div></div>`
  return row1 + '\u0000' + row2
}

/** 틀까지 포함한 상단 네비 한 덩어리. */
export function pcTopNavBlockHtml(activePath: string, opts: { hideDealCats?: boolean } = {}): string {
  const [r1, r2] = pcTopNavRowsHtml(activePath, opts).split('\u0000')
  return `<div class="${FR.outer}"><div class="${FR.row1}">${r1}</div><div class="${FR.row2}">${r2}</div></div>`
}
