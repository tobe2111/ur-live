/**
 * 🏠 생활(`/life`) 첫 화면을 서버가 그린다 — 2026-11-08 대표 *"모두 최적화"*.
 *
 * 라이브 실측(느린 4G 흉내): FCP 1.9s — 화면 대부분이 고정 문구(머리 + 상황별 업종 묶음)인데 앱 코드가 다 와야 그려졌다.
 * 생활은 색인되는 진입점이다(구글 → 바로 들어온다).
 *
 * 그리는 것: [머리(안 5) + 상황별 묶음 넷(큰 줄 · 아이콘 줄)] — 모양 SSOT `shared/life-page.ts`(화면과 같은 상수).
 * 그리지 않는 것:
 *  - 아이콘(채색 일러스트·화살표) — 같은 크기의 빈 칸만(path 를 워커 문자열로 옮기면 두 벌이 갈린다).
 *  - 실시간 한 줄 · 바로 사기 · 질문 — 데이터가 마운트 뒤에 온다(화면도 그때 그린다 — 서버가 안 그린 것이 나중에 오는 것은
 *    종전과 같다). 그래서 그 아래(오른쪽 칸)는 PC 에서만 옆에 서고, 폰은 묶음 아래에 붙는다.
 * 폰만(호출부가 UA 로 가른다) — PC 는 두 칸 격자라 오른쪽 칸이 없으면 모양이 다르다.
 */
import { LIFE_CLS as C, LIFE_COPY as T, LIFE_GROUPS, LIFE_BIG_SUB, LIFE_ICON_ROW_MAX, LIFE_TILE_LABEL } from '../../shared/life-page'
import { categoryDef } from '../../shared/home-service-categories'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const slot = (w: number, h = w) => `<span class="block shrink-0" style="width:${w}px;height:${h}px" aria-hidden="true"></span>`

function heroHtml(): string {
  return `<section aria-label="사장님 생활 견적" class="${C.hero}">` +
    `<div class="${C.heroTop}"><span class="${C.eyebrow}">${esc(T.eyebrow)}</span>` +
    `<a href="/life/requests" class="${C.myLink}">${esc(T.myRequests)}${slot(16)}</a></div>` +
    `<h1 class="${C.h1}">${esc(T.title1)}<br class="lg:hidden">${esc(T.title2)}</h1>` +
    `<p class="${C.sub}">${esc(T.sub)}</p>` +
    `<button type="button" class="${C.cta}">${esc(T.cta)}</button>` +
    `</section>`
}

function bigRows(keys: readonly string[]): string {
  return `<ul class="${C.bigList}">` + keys.map((k) => {
    const def = categoryDef(k as never)
    return `<li><a href="/life/request/${k}" class="${C.bigLink}">${slot(44)}` +
      `<span class="${C.bigText}"><span class="${C.bigLabel}">${esc(String(def?.label ?? ''))} 업체 찾기</span>` +
      `<span class="${C.bigSub}">${esc(LIFE_BIG_SUB[k as keyof typeof LIFE_BIG_SUB] ?? '')}</span></span>${slot(20)}</a></li>`
  }).join('') + `</ul>`
}

function iconRow(keys: readonly string[]): string {
  const folded = keys.length > LIFE_ICON_ROW_MAX
  const shown = folded ? keys.slice(0, LIFE_ICON_ROW_MAX - 1) : keys
  const tiles = shown.map((k, i) =>
    `<li class="${C.tileLi}" style="--i:${Math.min(i, 10)}"><a href="/life/request/${k}" class="${C.tile}">` +
    `<span class="${C.tileIc}">${slot(40)}</span>` +
    `<span class="${C.tileLabel}">${esc(LIFE_TILE_LABEL[k as keyof typeof LIFE_TILE_LABEL] ?? '')}</span></a></li>`).join('')
  const more = folded
    ? `<li><span class="${C.tile} w-full"><span class="${C.moreIc}">${slot(20)}</span><span class="${C.moreLabel}">${esc(T.more)}</span></span></li>`
    : ''
  return `<ul class="${C.iconGrid}">${tiles}${more}</ul>`
}

/** `#root` 에 넣을 첫 화면 HTML. 로더는 첫 화면 **아래**(아직 오는 중이라는 정직한 신호). */
export function buildLifeFirstScreen(loaderHtml: string): string {
  const groups = LIFE_GROUPS.map((g) =>
    `<section class="${C.card}"><h2 class="${C.cardTitle}">${esc(g.title)}</h2>${g.big ? bigRows(g.keys) : iconRow(g.keys)}</section>`).join('')
  const body = `<div class="${C.page}"><div class="${C.wrap}">${heroHtml()}<div class="${C.cols}"><div class="${C.left}">${groups}</div></div></div></div>`
  return `<div id="ur-first-screen">${body}</div>${loaderHtml.replace('min-height:100dvh', 'min-height:34dvh')}`
}
