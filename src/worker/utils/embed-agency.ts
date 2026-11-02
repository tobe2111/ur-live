/**
 * 🎬 에이전시 위젯 전용 화면 (2026-11-02 대표 *"에이전시 위젯에는 모션그래픽도 넣어서 최대한 고급지게 만들어주고"*)
 *
 * 유어샵·매장·지역 위젯은 `renderStrip` 의 담백한 한 줄 그대로 두고, **에이전시만** 이 파일이 그린다.
 * 에이전시 위젯은 남의 상품을 진열하는 게 아니라 *그 회사의 포트폴리오*라서 회사 간판처럼 보여야 한다.
 *
 * 구성(높이 330 고정 — 붙여 넣는 코드의 iframe 높이가 그대로다):
 *   머리줄  [urdeal × 회사 이름] ............ [● 지금 판매 중]
 *   빛 선   머리줄 아래 가는 선 위로 빛이 한 번씩 지나간다
 *   왼쪽    브랜드 블루 간판 칸 — 운영 매장 N곳 · 판매 중 이용권 N개 (숫자가 0부터 차오른다)
 *   오른쪽  이용권 카드 — 하나씩 떠오르며 들어오고, 4장 이상이면 천천히 흐르는 띠(마우스를 올리면 멈춘다)
 *
 * ## 모션은 전부 CSS 다 — 스크립트 0 줄
 * 위젯 문서는 CSP nonce 를 몰라서 스크립트가 막힌다(`embed-widget.ts` 머리말). 숫자 차오름은
 * `@property --n`(정수) 을 애니메이션하고 `counter()` 로 그린다. 그걸 모르는 오래된 브라우저에서는
 * 애니메이션이 끝값으로 바로 가므로 **숫자는 언제나 맞다**(실제 숫자는 화면 읽기용 글자로도 들어 있다).
 * `prefers-reduced-motion` 이면 움직임을 전부 끈다.
 *
 * ⚠️ 이 파일은 워커가 import 한다 — React·lucide 를 끌어오지 말 것(순수 함수만).
 */
import { doc, esc, won, LOGO, type EmbedCard, type EmbedTheme } from './embed-widget'

/** 카드가 이 장수 이상이면 흐르는 띠가 된다. 그보다 적으면 그냥 놓는다(3장이 빙빙 돌면 허전해 보인다). */
export const AGENCY_MARQUEE_MIN = 4

export interface AgencyInput {
  theme: EmbedTheme
  title: string
  /** 회사 이름 — 머리줄에 유어딜과 나란히 선다. */
  brand: string
  /** 맡아 운영 중인 매장 수. 0 이면 그 줄을 **안 그린다**(신뢰 자리에 0 이 서면 없느니만 못하다). */
  storeCount: number
  /** 지금 판매 중인 이용권 수(위젯에 실린 장수가 아니라 전체). 0 이면 그 줄을 안 그린다. */
  liveCount: number
  cards: EmbedCard[]
}

const AGENCY_CSS = `
@property --n{syntax:'<integer>';inherits:false;initial-value:0}
.ag{position:relative;height:100vh;min-height:300px;padding:14px 16px 12px;display:flex;flex-direction:column;gap:12px;overflow:hidden}
.ag .hd{gap:8px}
.ag .x{flex:none;font-size:13px;color:var(--faint)}
.ag .tt{font-size:15px}
.ag .live{flex:none;display:flex;align-items:center;gap:6px;font-size:12px;color:var(--soft)}
.ag .live i{position:relative;width:6px;height:6px;border-radius:50%;background:#22C55E}
.ag .live i::after{content:'';position:absolute;inset:-1px;border-radius:50%;background:#22C55E;opacity:.35;animation:ag-ping 2s cubic-bezier(0,0,.2,1) infinite}
.ag .ln{position:relative;height:1px;margin-top:-4px;background:var(--rule);overflow:hidden}
.ag .ln::after{content:'';position:absolute;top:0;bottom:0;width:30%;left:-30%;background:linear-gradient(90deg,transparent,var(--brand),transparent);animation:ag-sweep 4.5s cubic-bezier(.6,0,.2,1) 1s infinite}
.ag .bd{flex:1;min-height:0;display:flex;gap:12px}
/* 간판 칸 — 테마와 무관하게 브랜드 블루. 빛 덩어리 둘이 천천히 떠다니고, 결이 한 번씩 훑고 지나간다. */
.ag .hero{position:relative;flex:none;width:176px;border-radius:16px;overflow:hidden;color:#fff;padding:18px 16px;display:flex;flex-direction:column;justify-content:space-between;background:#1C69EF;isolation:isolate;animation:ag-rise .8s cubic-bezier(.2,.7,.2,1) both}
.ag .hero::before{content:'';position:absolute;z-index:-1;inset:-40%;background:radial-gradient(closest-side at 30% 30%,rgba(120,180,255,.75),transparent),radial-gradient(closest-side at 75% 70%,rgba(8,40,140,.85),transparent);animation:ag-drift 12s ease-in-out infinite alternate}
.ag .hero::after{content:'';position:absolute;z-index:-1;top:-10%;bottom:-10%;width:60%;left:-70%;transform:skewX(-14deg);background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.2),rgba(255,255,255,0));animation:ag-sweep-wide 6s ease-in-out 1.6s infinite}
.ag .hero .by{font-size:12px;opacity:.82;line-height:1.5;word-break:keep-all}
.ag .hero .by b{display:block;font-size:15px;font-weight:700;opacity:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ag .st2{display:flex;flex-direction:column;gap:12px}
.ag .k{display:flex;flex-direction:column;gap:2px}
.ag .k small{font-size:12px;opacity:.82}
.ag .k span{font:800 34px/1 Poppins,'Arial Black',Arial,sans-serif;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.ag .k span u{text-decoration:none;font:500 15px/1 -apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;margin-left:3px}
.ag .k .ct::before{content:counter(n);counter-reset:n var(--n);animation:ag-count 1.6s cubic-bezier(.2,.7,.2,1) .3s both}
.ag .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
/* 카드 칸 */
.ag .vp{flex:1;min-width:0;overflow:hidden}
.ag .vp.mq{-webkit-mask-image:linear-gradient(90deg,transparent,#000 24px,#000 calc(100% - 40px),transparent);mask-image:linear-gradient(90deg,transparent,#000 24px,#000 calc(100% - 40px),transparent)}
.ag .tr{display:flex;gap:12px;width:max-content}
.ag .vp:not(.mq){overflow-x:auto;scrollbar-width:none}
.ag .vp:not(.mq)::-webkit-scrollbar{display:none}
.ag .vp.mq .tr{animation:ag-flow var(--dur) linear 1.2s infinite}
.ag .vp.mq:hover .tr{animation-play-state:paused}
.ag .c{animation:ag-rise .7s cubic-bezier(.2,.7,.2,1) both;animation-delay:calc(.15s + var(--i) * 90ms)}
.ag .ph{position:relative;border-radius:14px;transform:translateZ(0)}
.ag .ph img{transition:transform 1.2s cubic-bezier(.2,.7,.2,1)}
.ag .ph::after{content:'';position:absolute;inset:0;background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,.38) 50%,transparent 65%);transform:translateX(-120%);transition:transform .9s cubic-bezier(.2,.7,.2,1)}
.ag .c:hover .ph img{transform:scale(1.07)}
.ag .c:hover .ph::after{transform:translateX(120%)}
.ag .ph .tag{position:absolute;z-index:1;left:8px;top:8px;padding:3px 7px;border-radius:999px;background:rgba(255,255,255,.94);color:#DC2626;font-size:12px;font-weight:500;font-variant-numeric:tabular-nums;box-shadow:0 1px 4px rgba(0,0,0,.12)}
.ag .empty{flex:1;align-self:center}
@keyframes ag-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes ag-count{from{--n:0}to{--n:var(--to)}}
@keyframes ag-sweep{0%{left:-30%}60%,100%{left:100%}}
@keyframes ag-sweep-wide{0%{left:-70%}45%,100%{left:120%}}
@keyframes ag-drift{0%{transform:translate(0,0) rotate(0)}100%{transform:translate(12%,-8%) rotate(25deg)}}
@keyframes ag-ping{0%{transform:scale(1);opacity:.45}80%,100%{transform:scale(2.6);opacity:0}}
@keyframes ag-flow{to{transform:translateX(calc(-50% - 6px))}}
@media (prefers-reduced-motion:reduce){.ag *,.ag *::before,.ag *::after{animation:none!important;transition:none!important}.ag .k .ct::before{counter-reset:n var(--to)}}
@media (max-width:420px){.ag .hero{width:132px;padding:14px 12px}.ag .k span{font-size:28px}}`

function agencyCard(c: EmbedCard, i: number, hidden: boolean): string {
  const img = c.img ? `<img src="${esc(c.img)}" alt="${hidden ? '' : esc(c.name)}" loading="lazy" width="156" height="156">` : ''
  const tag = c.discount > 0 ? `<span class="tag">${c.discount}%</span>` : ''
  const og = c.showOriginal ? `<span class="og">${won(c.originalPrice)}</span>` : ''
  const aria = hidden ? ' aria-hidden="true" tabindex="-1"' : ''
  return `<a class="c" style="--i:${i}" href="${esc(c.href)}" target="_blank" rel="noopener"${aria}><div class="ph">${img}${tag}</div>`
    + (c.store ? `<span class="st">${esc(c.store)}</span>` : '')
    + `<span class="nm">${esc(c.name)}</span>${og}<span class="pr">${won(c.price)}</span></a>`
}

function stat(label: string, n: number, unit: string): string {
  // 실제 숫자는 화면 읽기용 글자로, 보이는 숫자는 CSS 카운터로(0 → n 으로 차오른다).
  return `<div class="k"><small>${label}</small><span aria-hidden="true"><b class="ct" style="--to:${n}"></b><u>${unit}</u></span>`
    + `<span class="sr">${n}${unit}</span></div>`
}

/** 에이전시 위젯 문서 한 장. */
export function renderAgency(i: AgencyInput): string {
  const stats = [
    i.storeCount > 0 ? stat('운영 매장', i.storeCount, '곳') : '',
    i.liveCount > 0 ? stat('판매 중 이용권', i.liveCount, '개') : '',
  ].join('')
  const hero = `<div class="hero"><div class="by">운영사<b>${esc(i.brand)}</b></div>`
    + (stats ? `<div class="st2">${stats}</div>` : '') + '</div>'
  const mq = i.cards.length >= AGENCY_MARQUEE_MIN
  const set = (hidden: boolean) => i.cards.map((c, n) => agencyCard(c, hidden ? 0 : n, hidden)).join('')
  // 흐르는 띠는 같은 줄을 한 번 더 이어 붙여 이음매 없이 돈다. 사본은 화면 읽기·탭 이동에서 뺀다.
  const track = mq ? set(false) + set(true) : set(false)
  const list = i.cards.length
    ? `<div class="vp${mq ? ' mq' : ''}"${mq ? ` style="--dur:${i.cards.length * 4}s"` : ''}><div class="tr">${track}</div></div>`
    : '<p class="empty">지금 판매 중인 이용권이 없어요.</p>'
  const live = i.liveCount > 0 ? '<span class="live"><i></i>지금 판매 중</span>' : ''
  const head = `<div class="hd">${LOGO}<span class="x">×</span><span class="tt">${esc(i.brand)}</span>${live}</div>`
  return doc(i.theme, i.title, `<main class="ag">${head}<div class="ln"></div><div class="bd">${hero}${list}</div></main>`, AGENCY_CSS)
}
