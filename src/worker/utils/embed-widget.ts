/**
 * 🧩 홈페이지 삽입 위젯 — HTML 을 그리는 순수 모듈 (2026-10-31 대표 *"HTML 임베드를 여러개 만들어줘"*)
 *
 * 다른 사이트(에이전시·인플루언서·매장·지역 안내 사이트)가 `<iframe src="https://urdeal.kr/embed/...">` 한 줄로
 * 유어딜 이용권을 띄운다. 그 iframe 안의 문서를 **서버가 바로 그린다** — 앱(React) 번들을 남의 사이트에
 * 싣지 않으려고다(첫 화면 ~200KB 를 iframe 마다 받게 된다).
 *
 * ## 왜 스크립트가 0 줄인가
 * 우리 CSP 는 요청마다 nonce 를 만들어 **응답이 만들어진 뒤** 붙인다 — 이 문서 안의 인라인 스크립트는
 * 그 nonce 를 알 길이 없어 전부 막힌다. 그래서 위젯은 **스크립트 없이** 동작하게 만들었다: 카드는 가로로
 * 넘기는 한 줄(높이가 내용과 무관하게 고정 → 붙이는 쪽이 iframe 높이를 미리 안다), 링크는 새 창.
 *
 * ⚠️ 이 파일은 워커가 import 한다 — React·lucide 를 끌어오지 말 것(순수 함수만).
 */
import { priceDisplay } from '../../shared/price-display'
import { detailHref } from '../../shared/product-flow'
import { cfImage } from '../../utils/cf-image'

export type EmbedKind = 'ushop' | 'agency' | 'store' | 'region' | 'pass' | 'partner'
export type EmbedTheme = 'light' | 'dark' | 'auto'

/** 한 줄 카드에 들어가는 최대 장수. 이보다 많으면 전체 보기 링크로 넘긴다. */
export const EMBED_MAX_COUNT = 12
export const EMBED_DEFAULT_COUNT = 8

/** 붙이는 쪽에 권하는 iframe 높이(px). 위젯 높이는 내용과 무관하게 고정이라 이 값으로 충분하다. */
export const EMBED_HEIGHT: Record<'strip' | 'single' | 'partner', number> = { strip: 330, single: 172, partner: 360 }

export interface EmbedParams { count: number; theme: EmbedTheme }

/** 쿼리 → 파라미터. 모르는 값은 기본값으로(위젯이 남의 사이트에서 깨진 채 보이는 쪽이 더 나쁘다). */
export function parseEmbedParams(q: (k: string) => string | undefined): EmbedParams {
  const n = parseInt(String(q('count') ?? ''), 10)
  const count = Number.isFinite(n) ? Math.min(EMBED_MAX_COUNT, Math.max(1, n)) : EMBED_DEFAULT_COUNT
  const t = q('theme')
  const theme: EmbedTheme = t === 'dark' || t === 'auto' ? t : 'light'
  return { count, theme }
}

/** DB 한 행(필요한 칸만). */
export interface EmbedRow {
  id: number
  name?: string | null
  price?: number | null
  original_price?: number | null
  discount_rate?: number | null
  image_url?: string | null
  thumbnail?: string | null
  category?: string | null
  deal_only?: number | null
  restaurant_name?: string | null
  seller_name?: string | null
}

export interface EmbedCard {
  href: string
  img: string
  store: string
  name: string
  price: number
  discount: number
  originalPrice: number
  showOriginal: boolean
}

/** 링크에 붙이는 유입 표시 — 어느 위젯에서 왔는지 나중에 셀 수 있게. */
export function withUtm(path: string, kind: EmbedKind): string {
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}utm_source=embed&utm_medium=${kind}`
}

/**
 * 행 → 카드. 목적지는 정본 주소 SSOT(`detailHref`)이고, 유어샵 핀처럼 귀속이 필요한 곳은
 * 호출부가 `hrefOf` 로 바꿔 낀다(서버 리다이렉트가 소개 값을 심는다).
 */
export function toEmbedCard(r: EmbedRow, kind: EmbedKind, hrefOf?: (r: EmbedRow) => string): EmbedCard {
  const pd = priceDisplay(r)
  const img = r.image_url || r.thumbnail || ''
  return {
    href: hrefOf ? hrefOf(r) : withUtm(detailHref({ id: r.id, deal_only: r.deal_only, category: r.category }), kind),
    img: img ? cfImage(img, { width: 320, height: 320, fit: 'cover', gravity: 'auto' }) : '',
    store: String(r.restaurant_name || r.seller_name || '').trim(),
    name: String(r.name || '').trim(),
    price: pd.price,
    discount: pd.discount,
    originalPrice: pd.originalPrice,
    showOriginal: pd.showOriginal,
  }
}

export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function won(n: number): string {
  return `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`
}

const LIGHT = '--tint:#E8F0FE;--bg:#FFFFFF;--card:#FFFFFF;--ink:#16181C;--soft:#666C72;--faint:#81868C;--rule:rgba(22,24,28,.08);--brand:#1C69EF;--sale:#DC2626;--ph:#EDEFF3;--pbg:#F8F7FC;--lift:0 2px 10px rgba(22,24,28,.06);--glow:0 2px 10px rgba(28,105,239,.28)'
const DARK = '--tint:#1B2A48;--bg:#11141C;--card:#1D1F29;--ink:#F8F7FC;--soft:#9FA3A8;--faint:#6F747A;--rule:rgba(255,255,255,.08);--brand:#4D8DF5;--sale:#FF5C69;--ph:#262A33;--pbg:#11141C;--lift:none;--glow:none'

function themeCss(theme: EmbedTheme): string {
  if (theme === 'dark') return `:root{${DARK};color-scheme:dark}`
  if (theme === 'auto') return `:root{${LIGHT}}@media (prefers-color-scheme:dark){:root{${DARK};color-scheme:dark}}`
  return `:root{${LIGHT}}`
}

const BASE_CSS = `*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
.w{padding:14px 16px 12px;display:flex;flex-direction:column;gap:12px}
.hd{display:flex;align-items:center;gap:10px;min-width:0}
.logo{font:800 17px/1 Poppins,'Arial Black',Arial,sans-serif;letter-spacing:-.04em;flex:none}
.logo i{display:inline-block;width:4px;height:4px;border-radius:50%;background:var(--brand);margin-left:1px}
.tt{flex:1;min-width:0;font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.more{flex:none;font-size:13px;font-weight:500;color:var(--brand)}
.row{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:6px;scrollbar-width:thin}
.c{flex:none;width:156px;scroll-snap-align:start;display:flex;flex-direction:column;gap:3px}
.ph{width:156px;height:156px;border-radius:12px;background:var(--ph);overflow:hidden}
.ph img{width:100%;height:100%;object-fit:cover;display:block}
.st{font-size:12px;color:var(--soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:5px}
.nm{font-size:13px;font-weight:500;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.7em}
.pr{font-size:15px;font-weight:700;font-variant-numeric:tabular-nums}
.pr em{font-style:normal;color:var(--sale);margin-right:4px}
.og{font-size:12px;color:var(--faint);text-decoration:line-through;font-variant-numeric:tabular-nums}
.empty{font-size:13px;color:var(--soft);padding:24px 0;text-align:center}
.one{display:flex;gap:14px;align-items:center;padding:12px 14px}
.one .ph{width:120px;height:120px;flex:none}
.one .b{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.one .nm{font-size:15px;min-height:0}
.one .go{align-self:flex-start;margin-top:6px;background:var(--brand);color:#fff;font-size:13px;font-weight:700;padding:7px 14px;border-radius:999px}
.one .logo{font-size:13px}
/* 🤝 제휴사 입점 위젯 — 2026-11-01 대표 확정 시안 B "나란히 선 두 브랜드".
   앞선 시안 A(파란 띠 + 절취선 + 회색/연파랑 비교 박스)를 대체한다. 바꾼 이유 셋:
   ① 통짜 파란 면이 화면 1/3 을 덮어 전단지로 읽혔다 ② 비교 두 칸이 색 덩어리라 논리가 안 보였다
   ③ 티켓 홈이 라이트에서 안 보였다(--bg 와 --card 가 둘 다 흰색이라 장치가 절반만 살아 있었다).
   ⚠️ 바깥 바탕은 --pbg(제휴 위젯 전용)다. --bg 를 바꾸면 strip·single 위젯이 남의 흰 사이트에서
      회색 사각형이 된다. */
.pt{padding:10px;background:var(--pbg);min-height:100vh}
.pt .k{background:var(--card);border-radius:18px;box-shadow:var(--lift);overflow:hidden;word-break:keep-all}
.pt .bar{display:flex;align-items:center;gap:12px;padding:16px 24px;border-bottom:1px solid var(--rule)}
.pt .bar .logo{font-size:15px}
.pt .sep{flex:none;width:1px;height:14px;background:var(--rule)}
.pt .co{min-width:0;font-size:13px;font-weight:500;color:var(--soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pt .in{padding:24px;display:flex;flex-direction:column}
.pt h1{margin:0;font-size:24px;font-weight:700;letter-spacing:-.02em;line-height:1.3}
.pt .sub{margin:8px 0 0;font-size:13px;line-height:1.6;color:var(--soft)}
.pt .cmp{margin:20px 0 20px;display:grid;grid-template-columns:1fr 1fr}
.pt .col{min-width:0;display:flex;flex-direction:column;gap:7px;padding-right:16px}
.pt .col b{margin-bottom:4px;font-size:12px;font-weight:500;letter-spacing:.02em}
.pt .col span{font-size:13px;line-height:1.4}
.pt .old b,.pt .old span{color:var(--faint)}
/* 비교 두 칸은 박스가 아니라 선 하나로 가른다 — 마크업은 col old/new 그대로다. */
.pt .new{padding:0 0 0 20px;border-left:1px solid var(--rule)}
.pt .new b{color:var(--brand)}
.pt .new span{color:var(--ink);font-weight:500}
.pt .foot{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.pt .foot small{font-size:12px;color:var(--faint)}
.pt .go{background:var(--brand);color:#fff;font-size:15px;font-weight:700;padding:12px 20px;border-radius:12px;box-shadow:var(--glow)}`

function cardHtml(c: EmbedCard): string {
  const img = c.img ? `<img src="${esc(c.img)}" alt="${esc(c.name)}" loading="lazy" width="156" height="156">` : ''
  const disc = c.discount > 0 ? `<em>${c.discount}%</em>` : ''
  const og = c.showOriginal ? `<span class="og">${won(c.originalPrice)}</span>` : ''
  return `<a class="c" href="${esc(c.href)}" target="_blank" rel="noopener"><div class="ph">${img}</div>`
    + (c.store ? `<span class="st">${esc(c.store)}</span>` : '')
    + `<span class="nm">${esc(c.name)}</span>${og}<span class="pr">${disc}${won(c.price)}</span></a>`
}

const LOGO = '<span class="logo" aria-label="유어딜">urdeal<i></i></span>'

export interface StripInput {
  kind: EmbedKind
  theme: EmbedTheme
  title: string
  moreHref: string
  cards: EmbedCard[]
  emptyText?: string
}

function doc(theme: EmbedTheme, title: string, body: string): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} - 유어딜</title><style>${themeCss(theme)}\n${BASE_CSS}</style></head><body>${body}</body></html>`
}

/** 가로로 넘기는 카드 한 줄 — 유어샵·에이전시·매장·지역 공용. */
export function renderStrip(i: StripInput): string {
  const more = `<a class="more" href="${esc(i.moreHref)}" target="_blank" rel="noopener">전체 보기 ›</a>`
  const list = i.cards.length
    ? `<div class="row">${i.cards.map(cardHtml).join('')}</div>`
    : `<p class="empty">${esc(i.emptyText || '지금 판매 중인 이용권이 없어요.')}</p>`
  return doc(i.theme, i.title, `<main class="w"><div class="hd">${LOGO}<span class="tt">${esc(i.title)}</span>${more}</div>${list}</main>`)
}

/** 이용권 하나 — 블로그 글 속에 넣는 가로 카드. */
export function renderSingle(theme: EmbedTheme, c: EmbedCard): string {
  const img = c.img ? `<img src="${esc(c.img)}" alt="${esc(c.name)}" width="120" height="120">` : ''
  const disc = c.discount > 0 ? `<em>${c.discount}%</em>` : ''
  const og = c.showOriginal ? `<span class="og">${won(c.originalPrice)}</span>` : ''
  const body = `<a class="one" href="${esc(c.href)}" target="_blank" rel="noopener"><div class="ph">${img}</div><div class="b">${LOGO}`
    + (c.store ? `<span class="st">${esc(c.store)}</span>` : '')
    + `<span class="nm">${esc(c.name)}</span>${og}<span class="pr">${disc}${won(c.price)}</span><span class="go">구매하기</span></div></a>`
  return doc(theme, c.name, body)
}

/** 대상이 없을 때(없는 아이디·내려간 이용권) — 남의 사이트에 깨진 칸 대신 짧은 안내. */
export function renderMissing(theme: EmbedTheme): string {
  return doc(theme, '유어딜', `<main class="w"><div class="hd">${LOGO}<span class="tt">유어딜</span><a class="more" href="/?utm_source=embed" target="_blank" rel="noopener">유어딜 가기 ›</a></div><p class="empty">이 위젯 주소를 찾을 수 없어요. 코드를 다시 복사해 주세요.</p></main>`)
}

/**
 * 🤝 제휴사 입점 위젯 — 제휴사(에이전시)가 **자기 사이트에서 사장님께 유어딜을 파는** 카드
 * (2026-10-31 대표 *"제휴사들이 우리 유어딜 서비스를 파는 위젯이 필요해"* → 확정 "사장님께 입점 영업 · 소개 + 가입 버튼").
 * 버튼은 `/store/partner/:id` 로 간다 — 거기서 사장님이 매장을 고르거나 등록하고, 이 제휴사에 운영을 **요청**한다.
 * ⚠️ 문구에 숫자(수수료율 등)를 적지 않는다 — 요율은 어드민이 바꾸는 값이라 남의 사이트에 박힌 숫자는 곧 거짓말이 된다.
 */
export function renderPartner(theme: EmbedTheme, agencyName: string, agencyId: number): string {
  // 🎫 2026-11-01 대표 확정 시안 B "나란히 선 두 브랜드" — 10-31 시안 A(파란 띠 + 절취선)를 대체한다.
  //   이 위젯의 목적은 *제휴사가 사장님을 데려오는 것*이라 두 브랜드가 **대등**해 보여야 제안에 무게가 실린다.
  //   A 는 유어딜 배너에 제휴사 이름이 곁다리로 붙은 모양이었다(대표: *"고급지고 세련되게"*).
  //   ⚠️ 비교 블록(col old/new)의 마크업은 A 와 byte-동일하다 — 칸을 가르는 건 박스가 아니라 CSS 선 하나다.
  //   비교 문구의 유어딜 쪽은 지금 정책과 맞는 것만(손님 선결제 · 매장 QR 사용 · 팔린 만큼 정산 · 가입비 0원).
  const href = withUtm(`/store/partner/${agencyId}`, 'partner')
  const body = `<main class="pt"><div class="k"><div class="bar">${LOGO}<span class="sep"></span>`
    + `<span class="co">${esc(agencyName)}</span></div><div class="in">`
    + '<h1>체험단에 지치셨나요?</h1>'
    + '<p class="sub">공짜로 내주는 홍보 대신, 손님이 먼저 결제하고 오는 할인 이용권</p><div class="cmp">'
    + '<div class="col old"><b>체험단</b><span>음식은 공짜로</span><span>후기만 남고</span><span>매출은 0원</span></div>'
    + '<div class="col new"><b>유어딜 이용권</b><span>손님이 선결제</span><span>QR로 바로 사용</span><span>팔린 만큼 정산</span></div>'
    + `</div><div class="foot"><a class="go" href="${esc(href)}" target="_blank" rel="noopener">유어딜 입점 신청</a>`
    + '<small>가입비·월 이용료 0원</small></div></div></div></main>'
  return doc(theme, `${agencyName} × 유어딜 입점`, body)
}
