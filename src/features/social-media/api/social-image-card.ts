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
    store: `${SITE}/assets/mascot/udal-social-phone.webp`,
    creator: `${SITE}/assets/mascot/udal-social-wave.webp`,
    consumer: `${SITE}/assets/mascot/udal-social-gift.webp`,
  },
}

interface Theme { bg: string; ink: string; sub: string; label: string; dot: string; accent: string; floor: string; propShadow: string; halo: string }

/**
 * 유달이 그림 높이 — 원본(v6 누끼, 약 480px)을 거의 1:1 로 쓴다. 키우면 털이 뭉개진다(1차 카드는 238px 를 360px 로 키워 흐렸다).
 * ⚠️ 이 값을 원본 높이보다 크게 올리지 말 것 — 테스트가 고정한다.
 */
export const MASCOT_DRAW_H = 470

/**
 * 하단 왼쪽 **화면 조각** — 서비스가 실제로 하는 동작 하나(사용 처리 · 매장의 소개 제안 · 이용권 보관).
 * 숫자·금액·약속은 넣지 않는다. 기울이거나 티켓 홈을 파지 않는다(값싼 장식으로 읽힌다) — 앱 알림 한 장처럼 평평하게.
 */
const PROP: Record<SocialAudience, { icon: string; k: string; v: string; ok: string }> = {
  store: { icon: 'qr', k: '이용권 사용 처리', v: '손님 휴대폰 QR만 확인', ok: '사용 완료' },
  creator: { icon: 'mail', k: '새 소개 제안이 도착했어요', v: '수락하면 내 유어샵에 진열', ok: '고르는 건 나' },
  consumer: { icon: 'ticket', k: '내 이용권', v: '매장에서 QR로 바로 사용', ok: '사용 가능' },
}

/** 조각 아이콘 — 유어딜 아이콘 세트와 같은 문법(24 그리드 · 획 1.6 · 둥근 끝). */
const PROP_ICON: Record<string, string> = {
  qr: '<rect x="4" y="4" width="6" height="6" rx="1.2"/><rect x="14" y="4" width="6" height="6" rx="1.2"/><rect x="4" y="14" width="6" height="6" rx="1.2"/><path d="M14 14h2.5M20 14v2.5M14 18v2M17.5 20H20"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.4"/><path d="m4.5 7 7.5 6 7.5-6"/>',
  ticket: '<path d="M4 8.2a2 2 0 0 0 2-2h12a2 2 0 0 0 2 2v7.6a2 2 0 0 0-2 2H6a2 2 0 0 0-2-2z"/><path d="M14 6.5v11" stroke-dasharray="1.6 2"/>',
}

const THEMES: Record<SocialAudience, Theme> = {
  store: { bg: P.bg, ink: P.ink, sub: P.inkSoft, label: P.inkFaint, dot: P.brand, accent: P.brand, floor: 'rgba(15,26,51,0.13)', propShadow: '0 18px 48px rgba(15,26,51,0.10)', halo: 'rgba(28,105,239,0.07)' },
  creator: { bg: P.navy, ink: P.white, sub: 'rgba(255,255,255,0.68)', label: 'rgba(255,255,255,0.55)', dot: P.brandText, accent: P.brandText, floor: 'rgba(0,0,0,0.38)', propShadow: '0 22px 56px rgba(0,0,0,0.38)', halo: 'rgba(77,141,245,0.13)' },
  consumer: { bg: P.brand, ink: P.white, sub: 'rgba(255,255,255,0.80)', label: 'rgba(255,255,255,0.70)', dot: P.white, accent: P.white, floor: 'rgba(8,30,80,0.30)', propShadow: '0 22px 56px rgba(8,30,80,0.28)', halo: 'rgba(255,255,255,0.10)' },
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

/** 제목 길이에 맞춘 글자 크기 — 3줄 안에 들어가게. 굵기 700(800 은 한글이 뭉친다 — 배너 실측). */
export function headlineSize(title: string): number {
  const n = [...title].length
  if (n <= 10) return 116
  if (n <= 16) return 104
  if (n <= 24) return 96
  if (n <= 34) return 84
  return 72
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

/**
 * 1080×1350 카드 HTML. 렌더러는 `document.fonts.ready` 까지 기다린 뒤 찍는다.
 *
 * 구성(위→아래, 좌우 여백 96 한 격자): 워드마크 + 대상 · 제목(굵기 700 · 한글 단어 단위 줄바꿈 · 줄 길이 균형) ·
 * 보조 한 문장 · 하단 왼쪽 앱 조각 + 주소 · 오른쪽 유달이(바닥 그림자 위에 선다).
 * 장식 원·강조 막대·기울인 티켓은 쓰지 않는다(템플릿 티가 난다 — 1차 카드의 실패).
 */
export function buildCardHtml(input: CardInput, assets: CardAssets = DEFAULT_CARD_ASSETS): string {
  const t = THEMES[input.audience]
  const head = cardHeadline(input.title)
  const sub = cardSubline(input.body)
  const fs = headlineSize(head)
  const pr = PROP[input.audience]
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link rel="stylesheet" href="${escHtml(assets.pretendardCss)}">
<style>
@font-face{font-family:'UrPoppins';src:url('${escHtml(assets.poppinsWoff2)}') format('woff2');font-weight:800;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${CARD_W}px;height:${CARD_H}px;overflow:hidden}
body{background:${t.bg};font-family:'Pretendard Variable',Pretendard,system-ui,sans-serif;color:${t.ink};-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision;position:relative;font-feature-settings:'ss06'}
.wrap{position:absolute;inset:0;padding:92px 96px 96px;display:flex;flex-direction:column}
.top{display:flex;align-items:center;justify-content:space-between;height:56px}
.logo{font-family:'UrPoppins','Pretendard Variable',sans-serif;font-weight:800;font-size:46px;letter-spacing:-0.035em;line-height:1;display:inline-flex;align-items:baseline;color:${t.ink}}
.logo i{display:inline-block;width:9px;height:9px;border-radius:50%;background:${t.dot};margin-left:4px}
.label{font-size:28px;font-weight:600;letter-spacing:-0.01em;color:${t.label}}
.mid{margin-top:124px;position:relative;z-index:2}
h1{font-size:${fs}px;font-weight:700;line-height:1.26;letter-spacing:-0.032em;word-break:keep-all;overflow-wrap:break-word;text-wrap:balance;max-width:888px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
p.sub{margin-top:40px;font-size:38px;font-weight:500;line-height:1.5;letter-spacing:-0.02em;color:${t.sub};word-break:keep-all;text-wrap:pretty;max-width:760px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.foot{margin-top:auto;position:relative;z-index:1;width:540px}
.prop{background:${P.white};color:${P.ink};border-radius:32px;padding:30px 32px;display:flex;align-items:center;gap:24px;box-shadow:${t.propShadow}}
.prop .ic{flex:none;width:76px;height:76px;border-radius:22px;background:${P.brandTint};display:flex;align-items:center;justify-content:center}
.prop .ic svg{width:40px;height:40px;fill:none;stroke:${P.brand};stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.prop .tx{min-width:0;flex:1}
.prop .k{font-size:24px;font-weight:600;color:${P.inkFaint};letter-spacing:-0.01em}
.prop .v{font-size:32px;font-weight:700;letter-spacing:-0.025em;margin-top:6px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.prop .ok{display:inline-block;margin-top:14px;font-size:22px;font-weight:700;color:${P.brand};background:${P.brandTint};padding:7px 14px;border-radius:999px;letter-spacing:-0.01em}
.url{margin-top:44px;font-size:32px;font-weight:700;letter-spacing:-0.015em;color:${t.ink};display:flex;align-items:center;gap:12px}
.url svg{width:30px;height:30px;fill:none;stroke:${t.accent};stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.halo{position:absolute;right:-150px;bottom:-190px;width:820px;height:820px;border-radius:50%;background:${t.halo}}
.hero{position:absolute;z-index:3;right:64px;bottom:96px;width:420px;height:${MASCOT_DRAW_H + 40}px;display:flex;align-items:flex-end;justify-content:center}
.hero:before{content:'';position:absolute;left:50%;bottom:6px;width:300px;height:44px;margin-left:-150px;border-radius:50%;background:radial-gradient(closest-side,${t.floor},transparent)}
.hero img{position:relative;height:${MASCOT_DRAW_H}px;width:auto;display:block}
</style></head><body>
<div class="wrap">
  <div class="top"><span class="logo">urdeal<i></i></span><span class="label">${escHtml(CARD_CHIP[input.audience])}</span></div>
  <div class="mid">
    <h1>${escHtml(head)}</h1>
    ${sub ? `<p class="sub">${escHtml(sub)}</p>` : ''}
  </div>
  <div class="foot">
    <div class="prop"><span class="ic"><svg viewBox="0 0 24 24">${PROP_ICON[pr.icon]}</svg></span><div class="tx"><div class="k">${escHtml(pr.k)}</div><div class="v">${escHtml(pr.v)}</div><span class="ok">${escHtml(pr.ok)}</span></div></div>
    <div class="url">${escHtml(CARD_URL[input.audience])}<svg viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6"/></svg></div>
  </div>
</div>
<div class="halo"></div>
<div class="hero"><img src="${escHtml(assets.mascot[input.audience])}" alt=""></div>
</body></html>`
}
