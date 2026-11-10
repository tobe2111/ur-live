/**
 * ← 하위 화면 머리줄의 서버 HTML (2026-11-10) — `SubPageHeader` 의 **스크롤 0 상태**(h1 숨김 · 큰 제목 원래 크기).
 *   클래스는 `shared/sub-page-head.ts`(부품과 같은 상수). 뒤로 화살표는 같은 크기 빈 칸(아이콘 두 벌 금지).
 *   FAQ·알림 등 마이 아래 하위 화면의 서버 첫 화면이 이 한 줄로 머리줄을 얻는다.
 * @param wide `wideSides` — 오른쪽에 글자 버튼이 설 화면(알림의 '모두 읽음')은 양쪽 칸을 88px 로 넓힌다. 서버는 그 칸을 **비워** 둔다(버튼은 안 읽은 게 있을 때만 앱이 세운다 — 칸 폭이 고정이라 제목은 안 움직인다).
 */
import { SUB_PAGE_HEAD, subPageTitleTransform } from '../../shared/sub-page-head'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escAttr = (s: string) => esc(s).replace(/"/g, '&quot;')

export function subPageHeadHtml(title: string, wide = false): string {
  const t = subPageTitleTransform(0)
  return `<header class="${SUB_PAGE_HEAD.header} "><div class="${SUB_PAGE_HEAD.row} ${wide ? SUB_PAGE_HEAD.rowColsWide : SUB_PAGE_HEAD.rowCols} ${SUB_PAGE_HEAD.rowTail}">` +
    `<span class="${SUB_PAGE_HEAD.back}" aria-hidden="true"><span class="${SUB_PAGE_HEAD.backIcon} block"></span></span>` +
    `<h1 class="${SUB_PAGE_HEAD.h1} ${SUB_PAGE_HEAD.h1Hidden}">${esc(title)}</h1>` +
    `<div class="${SUB_PAGE_HEAD.right} ${wide ? SUB_PAGE_HEAD.rightWide : SUB_PAGE_HEAD.rightNarrow}"></div></div></header>` +
    `<div aria-hidden="true" class="${SUB_PAGE_HEAD.titleWrap}"><p class="${SUB_PAGE_HEAD.title}" style="transform:${escAttr(t.transform)};opacity:${t.opacity}">${esc(title)}</p></div>`
}
