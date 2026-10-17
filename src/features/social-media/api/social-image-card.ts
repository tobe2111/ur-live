/**
 * 🖼️ 2026-10-17 소셜 카드 이미지 — 인스타(피드는 이미지 필수)용 1080×1350 카드를 그릴 **HTML** 을 만든다.
 *
 * 대표: *"이미지를 만드는 것까지 해줘야지. 퀄리티는 상당해야해"*. 그 전엔 인스타 초안의 이미지 칸이
 * 비어 있어 게시 버튼이 "인스타는 이미지/영상 URL 이 필요합니다" 로 막혔다(라이브 id 2·5).
 *
 * 이 파일은 **순수 모듈**이다(네트워크·DB 없음) — 픽셀은 `social-image-render.ts` 가 브라우저로 찍는다.
 * 같은 HTML 을 로컬 Playwright 로도 그려 볼 수 있어서 디자인을 눈으로 확인하며 고칠 수 있다.
 *
 * 규율
 *  - 색은 디자인 시스템 실측값(브랜드 #1C69EF · 바탕 #F8F7FC · 잉크 #16181C · 딥네이비 #0F1A33 — 공유 카드 유달이 바탕과 같은 값).
 *  - 글자는 그 초안이 **이미 말한 것만** 쓴다(제목 · 본문 첫 문장). 카드가 새 약속을 지어내지 않는다 —
 *    본문은 금지어 검증(findForbidden)을 통과한 글이고, 카드는 그 글의 요약일 뿐이다.
 *  - 유달이는 검수를 통과한 확정 그림만(`docs/design/urdeal-mascot-otter-2026-10.md` 장부).
 *  - 모든 동적 글자는 HTML 탈출한다(초안 본문은 LLM 출력이다).
 */
import type { SocialAudience } from './social-audience'

export const CARD_W = 1080
export const CARD_H = 1350

/**
 * 카드 팔레트 — 디자인 시스템 실측값(`src/index.css` 토큰과 같은 값).
 * ⚠️ 이 카드는 **사이트 CSS 밖**(렌더 브라우저의 빈 페이지)에서 그려져 토큰을 쓸 수 없다 — 그래서 값을 여기 한 곳에 둔다
 *    (`ushop-share-card.ts` 의 SHARE_MASCOT_BG 와 같은 이유. consumer-hex 래칫에 이 파일 1곳으로 등록).
 */
export const CARD_PALETTE = {
  brand: '#1C69EF', brandText: '#4D8DF5', brandTint: '#E8F0FE', bg: '#F8F7FC', navy: '#0F1A33',
  ink: '#16181C', inkSoft: '#4F545A', inkFaint: '#666C72', rule: '#E2E5E9', white: '#FFFFFF',
} as const
const P = CARD_PALETTE

/** 카드가 쓰는 정적 자산의 공개 주소 — 렌더 브라우저가 인터넷에서 받는다. */
export interface CardAssets {
  /** Pretendard 동적 서브셋 CSS */
  pretendardCss: string
  /** 워드마크 Poppins 800 (urdeal 6글자) */
  poppinsWoff2: string
  /** 대상별 유달이 그림 */
  mascot: Record<SocialAudience, string>
}

export const SITE = 'https://urdeal.kr'
export const DEFAULT_CARD_ASSETS: CardAssets = {
  pretendardCss: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css',
  poppinsWoff2: `${SITE}/static/fonts/poppins-800-urdeal-v24.woff2`,
  mascot: {
    store: `${SITE}/assets/mascot/udal-pose-qr.webp`,
    creator: `${SITE}/assets/mascot/udal-pose-highfive.webp`,
    consumer: `${SITE}/assets/mascot/udal-pose-wallet.webp`,
  },
}

interface Theme { bg: string; ink: string; sub: string; chipBg: string; chipInk: string; dot: string; url: string; deco: string }

/** 유달이 그림 높이 — 원본 해상도를 넘겨 키우면 흐려지므로 그림별로 둔다(원본 238~487px). */
const MASCOT_H: Record<SocialAudience, number> = { store: 360, creator: 350, consumer: 360 }

/**
 * 빈 하단을 채우는 **화면 조각**(실물 UI 를 닮은 카드). 숫자·금액·약속은 넣지 않는다 —
 * 서비스가 실제로 하는 동작만(사용 처리 · 매장의 소개 제안 · 이용권 보관)을 보여 준다.
 */
const PROP_HTML: Record<SocialAudience, string> = {
  store: `<div class="prop"><div class="k">이용권 사용 처리</div><div class="v">손님 휴대폰 QR 확인</div><div class="cut"></div><div class="row"><span class="ok">✓ 사용 완료</span><span class="k">새 기기 없이</span></div></div>`,
  creator: `<div class="prop"><div class="k">새 소개 제안이 왔어요</div><div class="v">동네 가게가 먼저<br>소개 몫을 정해 제안</div><div class="cut"></div><div class="row"><span class="ok">제안 보기</span><span class="k">수락은 내가 결정</span></div></div>`,
  consumer: `<div class="prop"><div class="k">내 이용권</div><div class="v">미리 사고, 매장에서<br>QR로 바로 사용</div><div class="cut"></div><div class="row"><span class="ok">✓ 사용 가능</span><span class="k">유어딜 지갑</span></div></div>`,
}

const THEMES: Record<SocialAudience, Theme> = {
  store: { bg: P.bg, ink: P.ink, sub: P.inkSoft, chipBg: P.brand, chipInk: P.white, dot: P.brand, url: P.ink, deco: 'rgba(28,105,239,0.07)' },
  creator: { bg: P.navy, ink: P.white, sub: 'rgba(255,255,255,0.74)', chipBg: P.brand, chipInk: P.white, dot: P.brandText, url: P.white, deco: 'rgba(77,141,245,0.12)' },
  consumer: { bg: P.brand, ink: P.white, sub: 'rgba(255,255,255,0.84)', chipBg: P.white, chipInk: P.brand, dot: P.white, url: P.white, deco: 'rgba(255,255,255,0.10)' },
}

/** 카드 상단 꼬리표 — 누구에게 하는 말인지 한눈에. */
export const CARD_CHIP: Record<SocialAudience, string> = {
  store: '사장님을 위한 유어딜',
  creator: '소개 파트너 모집',
  consumer: '유어딜 이용권',
}

/** 카드 하단 주소 — 착지 페이지와 같은 곳(`AUDIENCE_LANDING`). 인스타 캡션의 주소는 눌리지 않으므로 그림에도 적는다. */
export const CARD_URL: Record<SocialAudience, string> = {
  store: 'urdeal.kr/partners',
  creator: 'urdeal.kr/creators/apply',
  consumer: 'urdeal.kr',
}

export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** 제목 길이에 맞춘 글자 크기 — 3줄 안에 들어가게. */
export function headlineSize(title: string): number {
  const n = [...title].length
  if (n <= 12) return 112
  if (n <= 20) return 100
  if (n <= 28) return 88
  if (n <= 38) return 76
  return 66
}

/**
 * 본문 첫 문장 → 카드 보조 문구. 주소·해시태그·대본 표지(`[대본]`·`(0~3초)`)는 뺀다.
 * 너무 길면 단어 경계에서 자르고 말줄임표를 붙인다.
 */
export function cardSubline(body: string, max = 56): string {
  const lines = String(body || '').split('\n').map((l) => l.trim())
    .filter((l) => l && !/^https?:\/\//.test(l) && !l.startsWith('#') && !/^\[.*\]$/.test(l) && !/^\(\d/.test(l))
  const first = (lines[0] || '').replace(/https?:\/\/\S+/g, '').trim()
  const sentence = first.split(/(?<=[.!?。])\s/)[0] || first
  const chars = [...sentence]
  if (chars.length <= max) return sentence
  const cut = chars.slice(0, max).join('')
  const sp = cut.lastIndexOf(' ')
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[,.·\s]+$/, '') + '…'
}

/** 제목 정리 — 카드 머리에 쓸 수 있게 해시태그·이모지 꼬리를 뗀다. */
export function cardHeadline(title: string): string {
  return String(title || '').replace(/#\S+/g, '').replace(/\s+/g, ' ').trim()
}

export interface CardInput { audience: SocialAudience; title: string; body: string }

/** 1080×1350 카드 HTML. 렌더러는 `document.fonts.ready` 까지 기다린 뒤 찍는다. */
export function buildCardHtml(input: CardInput, assets: CardAssets = DEFAULT_CARD_ASSETS): string {
  const t = THEMES[input.audience]
  const head = cardHeadline(input.title)
  const sub = cardSubline(input.body)
  const fs = headlineSize(head)
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link rel="stylesheet" href="${escHtml(assets.pretendardCss)}">
<style>
@font-face{font-family:'UrPoppins';src:url('${escHtml(assets.poppinsWoff2)}') format('woff2');font-weight:800;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${CARD_W}px;height:${CARD_H}px;overflow:hidden}
body{background:${t.bg};font-family:'Pretendard Variable',Pretendard,system-ui,sans-serif;color:${t.ink};-webkit-font-smoothing:antialiased;position:relative}
.deco{position:absolute;right:-220px;top:-180px;width:760px;height:760px;border-radius:50%;background:${t.deco}}
.wrap{position:absolute;inset:0;padding:96px 96px 88px;display:flex;flex-direction:column}
.top{display:flex;align-items:center;justify-content:space-between}
.logo{font-family:'UrPoppins','Pretendard Variable',sans-serif;font-weight:800;font-size:52px;letter-spacing:-0.035em;line-height:1;display:inline-flex;align-items:baseline;color:${t.ink}}
.logo i{display:inline-block;width:10px;height:10px;border-radius:50%;background:${t.dot};margin-left:4px}
.chip{background:${t.chipBg};color:${t.chipInk};font-size:30px;font-weight:700;letter-spacing:-0.02em;padding:16px 28px;border-radius:999px}
.mid{margin-top:120px;max-width:880px}
h1{font-size:${fs}px;font-weight:800;line-height:1.2;letter-spacing:-0.045em;word-break:keep-all;overflow-wrap:break-word;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.bar{width:88px;height:8px;border-radius:4px;background:${t.chipBg === P.white ? P.white : P.brand};margin:56px 0 44px}
p.sub{font-size:40px;font-weight:500;line-height:1.5;letter-spacing:-0.025em;color:${t.sub};word-break:keep-all;max-width:640px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.bottom{margin-top:auto;display:flex;align-items:flex-end;justify-content:space-between}
.url{font-size:34px;font-weight:700;letter-spacing:-0.02em;color:${t.url};display:flex;align-items:center;gap:14px}
.url b{display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:${t.chipBg};color:${t.chipInk};font-size:30px}
.mascot{position:absolute;right:64px;bottom:150px;height:${MASCOT_H[input.audience]}px;width:auto;${input.audience === 'store' ? 'filter:drop-shadow(0 24px 40px rgba(15,26,51,0.18));' : ''}}
.prop{position:absolute;left:96px;bottom:200px;width:540px;background:${P.white};border-radius:36px;padding:36px 40px;box-shadow:0 30px 60px rgba(15,26,51,0.16);transform:rotate(-3deg);color:${P.ink}}
.prop .k{font-size:26px;font-weight:600;color:${P.inkFaint};letter-spacing:-0.02em}
.prop .v{font-size:40px;font-weight:800;letter-spacing:-0.035em;margin-top:10px;line-height:1.25}
.prop .row{display:flex;align-items:center;gap:14px;margin-top:22px}
.prop .ok{display:inline-flex;align-items:center;gap:10px;background:${P.brandTint};color:${P.brand};font-size:26px;font-weight:700;padding:10px 18px;border-radius:999px}
.prop .cut{position:relative;margin:26px -40px 0;border-top:3px dashed ${P.rule}}
.prop .cut:before,.prop .cut:after{content:'';position:absolute;top:-17px;width:32px;height:32px;border-radius:50%;background:${t.bg}}
.prop .cut:before{left:-16px}.prop .cut:after{right:-16px}
</style></head><body>
<div class="deco"></div>
<div class="wrap">
  <div class="top"><span class="logo">urdeal<i></i></span><span class="chip">${escHtml(CARD_CHIP[input.audience])}</span></div>
  <div class="mid">
    <h1>${escHtml(head)}</h1>
    <div class="bar"></div>
    ${sub ? `<p class="sub">${escHtml(sub)}</p>` : ''}
  </div>
  <div class="bottom"><span class="url"><b>→</b>${escHtml(CARD_URL[input.audience])}</span></div>
</div>
${PROP_HTML[input.audience]}
<img class="mascot" src="${escHtml(assets.mascot[input.audience])}" alt="">
</body></html>`
}
