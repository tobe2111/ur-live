/**
 * 🤝 제휴사 입점 위젯 — 화면 전부 (2026-11-02 대표 확정).
 *
 * 흐름(대표 원문): *"제휴사 위젯 너무 촌스러워"* → 시안 여러 차례 → *"B 느낌이 가장 좋네 그걸 고도화해보자"* →
 * *"인스타, 틱톡, 유튜브 이런 로고도"* → *"휴대폰 안의 화면이 별로야. 그리고 AI가 만든 티가 많이 나. 인플루언서가 함께 판다고 표현해야해"* →
 * *"음식점/숙소/네일샵/PT 등 인플루언서에게 팔아달라고 하자"* → *"메인 문구만 바꾸자 성과 없는 체험단은 그만! 인플루언서와 함께 파세요"*
 * → 확정 ***"E2 형광펜 + P1 판매 수 + P3 +1 … 이번 주 판매 xxx장 바탕색 검정"***.
 *
 * 화면(높이 360 고정 — 붙여 넣는 코드의 iframe 높이):
 *   왼쪽  urdeal ○○ 추천 / 음식점 · 숙소 · 네일샵 · PT / [성과 없는 체험단은 그만! · 인플루언서와 함께(형광펜) 파세요]
 *         / 체험단의 문제를 해결하는 인플루언서 판매 서비스(고정 정체성 줄) / 세 줄 / [유어딜 입점 신청]
 *   오른쪽 휴대폰 — 인플루언서 '수아'의 유어샵을 실제 유어샵과 같은 모양으로 다시 그린 **가상 예시**
 *         (실존 인물·가게 아님. 대표 *"화면 안에 실제 내 이름으로 하면 어떡해"*).
 *
 * 🎬 움직임은 한 이야기다: 3초마다 한 업종에서 1장이 팔린다(음식점 → 숙소 → 네일샵 → PT). 그때마다
 *   업종 단어가 파랗게 켜지고 · 유어샵이 그 가게로 스크롤되고 · 그 줄이 밝아지며 "+1" · 위에서 "○○ 1장 판매" 알림 ·
 *   아래 검은 "이번 주 판매 N장" 이 +1. 처음 한 번: 제목 줄이 올라오고 "인플루언서와 함께" 에 형광펜이 칠해진다.
 *   장면은 **음수 지연**으로 돌린다(첫 프레임부터 1번 장면이 서 있다). 스크립트 0 줄(CSP nonce — `embed-widget.ts` 머리말).
 *
 * ⚠️ 성과 숫자 주장("매출 3배" 등) 금지 — 확인할 수 없는 숫자는 남의 사이트에서 거짓말이 된다. 드라마는 장면으로만.
 * ⚠️ 썸네일은 사진이 아니라 유어딜 카테고리 그림 — 숙소·네일·PT 이용권 사진은 지금 외부 사이트 사진뿐이라 남의 사이트에 걸 수 없다.
 * ⚠️ 바깥 바탕은 --pbg(제휴 위젯 전용)다. --bg 를 바꾸면 strip·single 위젯이 남의 흰 사이트에서 회색 사각형이 된다.
 * ⚠️ 아래 SVG 는 React 부품(`components/icons/sns-logos.tsx` · `category-icons.tsx`)의 **사본**이다 — 워커는 React 를
 *    못 끌어온다. 원본과 갈리지 않게 가드가 렌더 결과를 대조한다(`embed-partner-final-2026-11-02.test.ts`).
 */

export const PARTNER_SVG = {
  "instagram": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.1\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"3.5\" y=\"3.5\" width=\"17\" height=\"17\" rx=\"5\"></rect><circle cx=\"12\" cy=\"12\" r=\"3.7\"></circle><circle cx=\"17.3\" cy=\"6.7\" r=\"1.1\" fill=\"currentColor\" stroke=\"none\"></circle></svg>",
  "tiktok": "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M16.5 3c.3 2.2 1.6 3.9 3.8 4.1v2.6c-1.3.1-2.5-.3-3.8-1v5.7c0 4.4-3.4 6.9-6.9 5.8-3.2-1-4.1-5-1.7-7.2 1-.9 2.4-1.3 3.8-1.1v2.7c-.4-.1-.8-.1-1.2 0-1.2.3-1.7 1.4-1.3 2.5.4 1.1 1.8 1.5 2.7.7.5-.4.7-1 .7-1.7V3h3.9Z\"></path></svg>",
  "youtube": "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z\"></path></svg>",
  "meal": "<svg viewBox=\"0 0 32 32\" aria-hidden=\"true\" fill=\"none\"><path d=\"M5 14h22a11 11 0 0 1-11 11A11 11 0 0 1 5 14z\" fill=\"#E8433F\"></path><path d=\"M8 21.5a11 11 0 0 0 16 0c-2.6 1.9-5.3 2.5-8 2.5s-5.4-.6-8-2.5z\" fill=\"#A8262A\"></path><rect x=\"20\" y=\"4\" width=\"2.2\" height=\"12\" rx=\"1.1\" transform=\"rotate(20 21 10)\" fill=\"#A8262A\"></rect><rect x=\"24\" y=\"4\" width=\"2.2\" height=\"12\" rx=\"1.1\" transform=\"rotate(20 25 10)\" fill=\"#A8262A\"></rect></svg>",
  "stay": "<svg viewBox=\"0 0 32 32\" aria-hidden=\"true\" fill=\"none\"><path d=\"M8 6h16a2 2 0 0 1 2 2v20H6V8a2 2 0 0 1 2-2z\" fill=\"#3B82F6\"></path><path d=\"M13 21h6v7h-6z\" fill=\"#1F55B8\"></path><rect x=\"10\" y=\"10\" width=\"2.6\" height=\"2.6\" rx=\".5\" fill=\"#fff\" opacity=\".9\"></rect><rect x=\"10\" y=\"15\" width=\"2.6\" height=\"2.6\" rx=\".5\" fill=\"#fff\" opacity=\".9\"></rect><rect x=\"15\" y=\"10\" width=\"2.6\" height=\"2.6\" rx=\".5\" fill=\"#fff\" opacity=\".9\"></rect><rect x=\"15\" y=\"15\" width=\"2.6\" height=\"2.6\" rx=\".5\" fill=\"#fff\" opacity=\".9\"></rect><rect x=\"20\" y=\"10\" width=\"2.6\" height=\"2.6\" rx=\".5\" fill=\"#fff\" opacity=\".9\"></rect><rect x=\"20\" y=\"15\" width=\"2.6\" height=\"2.6\" rx=\".5\" fill=\"#fff\" opacity=\".9\"></rect></svg>",
  "beauty": "<svg viewBox=\"0 0 32 32\" aria-hidden=\"true\" fill=\"none\"><circle cx=\"10\" cy=\"22\" r=\"4.5\" fill=\"#F0607A\"></circle><circle cx=\"22\" cy=\"22\" r=\"4.5\" fill=\"#F0607A\"></circle><circle cx=\"10\" cy=\"22\" r=\"2\" fill=\"#B93A55\"></circle><circle cx=\"22\" cy=\"22\" r=\"2\" fill=\"#B93A55\"></circle><path d=\"M12.5 19 24 5.5l2 1.6L14.6 21.5zM19.5 19 8 5.5l-2 1.6 11.4 14.4z\" fill=\"#B93A55\"></path></svg>",
  "leisure": "<svg viewBox=\"0 0 32 32\" aria-hidden=\"true\" fill=\"none\"><path d=\"M4 11a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v3a2.5 2.5 0 0 0 0 5v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2.5 2.5 0 0 0 0-5z\" fill=\"#8B6CF6\"></path><path d=\"M12 10v13\" stroke=\"#fff\" stroke-width=\"1.6\" stroke-dasharray=\"2 2\" opacity=\".9\"></path><path d=\"M16 13.5h8v5h-8z\" fill=\"#5B41B8\"></path></svg>"
} as const

/** 정체성 한 줄 — 대표 *"정체성 한줄 고정"*. */
export const PARTNER_IDENTITY = '체험단의 문제를 해결하는 인플루언서 판매 서비스'

/** 업종 넷 — 순서가 곧 장면 순서. 휴대폰 속 가게(가상)와 1:1. */
export const PARTNER_SCENES: ReadonlyArray<{ cat: string; icon: 'meal' | 'stay' | 'beauty' | 'leisure'; tint: string; store: string; item: string; pct: string; price: string; orig: string }> = [
  { cat: '음식점', icon: 'meal', tint: '#FDEEE6', store: '을지로 닭한상', item: '닭도리탕 2인 세트', pct: '11%', price: '31,000', orig: '35,000' },
  { cat: '숙소', icon: 'stay', tint: '#E8F0FE', store: '바다결 스테이', item: '평일 1박 오션뷰 룸', pct: '22%', price: '89,000', orig: '115,000' },
  { cat: '네일샵', icon: 'beauty', tint: '#FCE8F0', store: '네일 아뜰리에', item: '젤네일 기본 + 아트 2개', pct: '30%', price: '35,000', orig: '50,000' },
  { cat: 'PT', icon: 'leisure', tint: '#E7F6EE', store: '바디핏 스튜디오', item: 'PT 1:1 체험 2회', pct: '40%', price: '36,000', orig: '60,000' },
]

export const PARTNER_CSS = `
.pt{word-break:keep-all}
.pt{min-height:100vh;background:var(--pbg);padding:10px}
.pt .k{position:relative;height:calc(100vh - 20px);min-height:300px;background:var(--card);border-radius:18px;box-shadow:var(--lift);overflow:hidden;display:grid;grid-template-columns:1fr 150px;grid-template-rows:100%;column-gap:16px}
.pt .l{padding:20px 0 20px 22px;display:flex;flex-direction:column;min-width:0}
.pt .hd{display:flex;align-items:baseline;gap:10px;min-width:0}
.pt .logo{font:800 15px/1 'Arial Black',Arial,sans-serif;letter-spacing:-.04em;flex:none}.pt .logo i{display:inline-block;width:4px;height:4px;border-radius:50%;background:var(--brand);margin-left:1px}
.pt .co{font-size:12px;color:var(--faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pt .cats{margin:16px 0 0;font-size:13px;font-weight:500;color:var(--soft)}
.pt h3{margin:4px 0 0;font-size:24px;font-weight:800;letter-spacing:-.045em;line-height:1.2}
.pt .sub{margin:8px 0 0;font-size:13px;color:var(--soft)}
.pt .facts{margin:12px 0 0;padding:0;list-style:none;counter-reset:f;font-size:13px;line-height:1.5}
.pt .facts li{counter-increment:f;display:flex;align-items:center;gap:0;padding:4px 0;border-top:1px solid var(--rule)}
.pt .facts li::before{content:counter(f);width:18px;flex:none;color:var(--faint);font-variant-numeric:tabular-nums}
.pt .sl{display:inline-flex;gap:4px;margin-right:6px}
.pt .sl span{display:inline-grid;place-items:center;width:18px;height:18px}
.pt .sl svg{width:15px;height:15px}
.pt .go{margin-top:auto;align-self:flex-start;display:inline-flex;align-items:center;height:44px;padding:0 20px;border-radius:12px;background:var(--brand);color:#fff;font-size:15px;font-weight:700}
.pt .phone{position:relative;min-height:0;overflow:hidden;margin:20px 0 0;border-radius:26px 0 0 0;background:#16181C;padding:7px 0 0 7px}
.pt .scr{position:relative;height:100%;border-radius:20px 0 0 0;overflow:hidden;background:#fff}
.pt .zoom{width:375px;transform:scale(.5);transform-origin:top left;animation:browse 12s cubic-bezier(.45,0,.2,1) infinite}
/* 유어샵 화면(375 기준, 반으로 줄여 그린다) */
.pt .us{color:#16181C;font-size:15px;background:#fff}
.pt .ush{display:flex;justify-content:space-between;align-items:center;padding:18px 20px 6px}
.pt .lg2{font:800 21px/1 'Arial Black',Arial,sans-serif;letter-spacing:-.04em}.pt .lg2 i{display:inline-block;width:5px;height:5px;border-radius:50%;background:#1C69EF;margin-left:2px}
.pt .shr svg{width:26px;height:26px;color:#4F545A}
.pt .pro{display:flex;align-items:center;gap:14px;padding:14px 20px 4px}
.pt .av2{width:56px;height:56px;border-radius:50%;background:#FCE8F0;color:#C2185B;display:grid;place-items:center;font-size:22px;font-weight:700}
.pt .pro b{display:block;font-size:20px;font-weight:700}.pt .pro small{font-size:14px;color:#666C72}
.pt .sns{display:flex;align-items:center;gap:8px;padding:14px 20px 16px}
.pt .cnt{font-size:14px;color:#666C72;margin-right:auto;white-space:nowrap}.pt .cnt b{color:#16181C}
.pt .pill{display:inline-grid;place-items:center;width:36px;height:36px;border-radius:50%;background:#F1F2F5;color:#383D42}
.pt .pill svg{width:17px;height:17px}
.pt .tabs{display:flex;gap:18px;padding:12px 20px 0;border-bottom:1px solid #EDEFF3;font-size:15px;color:#81868C}
.pt .tabs b{color:#16181C;font-weight:700;padding-bottom:10px;border-bottom:2px solid #1C69EF}
.pt .it{display:flex;gap:14px;padding:16px 20px;border-bottom:1px solid #EDEFF3}
.pt .th{width:84px;height:84px;border-radius:14px;flex:none;display:grid;place-items:center}
.pt .th svg{width:46px;height:46px}
.pt .tx{display:flex;flex-direction:column;gap:3px;min-width:0;padding-top:4px}
.pt .tx span{font-size:13px;color:#81868C}.pt .tx b{font-size:16px;font-weight:500}
.pt .tx p{margin:4px 0 0;font-size:13px;font-variant-numeric:tabular-nums}
.pt .tx em{font-style:normal;color:#DC2626;font-weight:700;margin-right:5px;font-size:15px}
.pt .tx strong{font-size:18px;font-weight:700;margin-right:1px}.pt .tx s{color:#81868C;margin-left:6px}
/* 🎬 모션 — 한 이야기: 3초마다 한 업종에서 1장이 팔린다(음식점 → 숙소 → 네일샵 → PT). */
.pt h3 .ln{display:block;animation:rise .7s cubic-bezier(.2,.7,.2,1) both}
.pt h3 .ln+.ln{animation-delay:.12s}
.pt .facts li{animation:fade .6s ease both}
.pt .facts li:nth-child(1){animation-delay:.3s}.pt .facts li:nth-child(2){animation-delay:.42s}.pt .facts li:nth-child(3){animation-delay:.54s}
.pt .cats span{transition:none;animation:catOn 12s infinite}
.pt .cats .c1{animation-delay:0s}.pt .cats .c2{animation-delay:-9s}.pt .cats .c3{animation-delay:-6s}.pt .cats .c4{animation-delay:-3s}
.pt .toast{position:absolute;z-index:2;left:6px;width:max-content;max-width:128px;top:6px;display:flex;align-items:center;gap:5px;background:#16181C;color:#fff;border-radius:10px;padding:7px 8px;font-size:12px;white-space:nowrap;overflow:hidden;box-shadow:0 6px 14px rgba(0,0,0,.25);opacity:0;animation:toast 12s infinite}
.pt .toast i,.pt .mlive i{width:6px;height:6px;border-radius:50%;background:#22C55E;flex:none}
.pt .toast b{flex:none;font-weight:700}.pt .toast span{min-width:0;overflow:hidden;text-overflow:ellipsis}
.pt .toast.t1{animation-delay:0s}.pt .toast.t2{animation-delay:-9s}.pt .toast.t3{animation-delay:-6s}.pt .toast.t4{animation-delay:-3s}
.pt .it{animation:flash 12s infinite}
.pt .it:nth-child(5){animation-delay:0s}.pt .it:nth-child(6){animation-delay:-9s}.pt .it:nth-child(7){animation-delay:-6s}.pt .it:nth-child(8){animation-delay:-3s}.pt .it:nth-child(9){animation:none}
.pt .sl span{animation:pop 12s infinite}
.pt .sl span:nth-child(1){animation-delay:-1s}.pt .sl span:nth-child(2){animation-delay:-5s}.pt .sl span:nth-child(3){animation-delay:-9s}
.pt .go{position:relative;overflow:hidden}
.pt .go::after{content:'';position:absolute;top:-20%;bottom:-20%;width:36%;left:-50%;transform:skewX(-18deg);background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.32),rgba(255,255,255,0));animation:shine 6s ease-in-out 2s infinite}
.pt .mlive{display:none;position:relative;margin:10px 0 0;height:30px}
.pt .mlive span{position:absolute;inset:0;display:flex;align-items:center;gap:8px;width:max-content;max-width:100%;padding:0 12px;border-radius:999px;background:var(--rule);font-size:12px;color:var(--ink);opacity:0;animation:toast 12s infinite}
.pt .mlive .m1{animation-delay:0s}.pt .mlive .m2{animation-delay:-9s}.pt .mlive .m3{animation-delay:-6s}.pt .mlive .m4{animation-delay:-3s}
@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes catOn{0%,24%{color:var(--brand)}26%,100%{color:inherit}}
@keyframes toast{0%{opacity:0;transform:translateY(-8px)}4%,20%{opacity:1;transform:none}25%,100%{opacity:0;transform:translateY(-6px)}}
@keyframes flash{0%,2%{background:#fff}6%,16%{background:#EAF1FE}24%,100%{background:#fff}}
@keyframes pop{0%,100%{transform:none}3%{transform:scale(1.25)}7%{transform:none}}
@keyframes browse{0%,20%{translate:0 0}25%,45%{translate:0 -44px}50%,70%{translate:0 -103px}75%,95%{translate:0 -162px}100%{translate:0 0}}
@keyframes shine{0%{left:-50%}30%,100%{left:130%}}
@media (max-width:480px){.pt .mlive{display:block}.pt .facts li{padding:3px 0}.pt .k{grid-template-columns:1fr}.pt .phone{display:none}.pt .l{padding:16px 18px}.pt .cats{margin-top:12px}.pt h3{font-size:24px}.pt .facts{margin-top:10px}.pt .go{align-self:stretch;justify-content:center}}
.pt .em-m{background:linear-gradient(transparent 58%,rgba(28,105,239,.22) 58%,rgba(28,105,239,.22) 92%,transparent 92%) no-repeat 0 0/0% 100%;animation:mark .9s cubic-bezier(.6,0,.2,1) .7s forwards}
@keyframes mark{to{background-size:100% 100%}}
/* P1 판매 수 */
@property --c{syntax:'<integer>';inherits:false;initial-value:124}
.pt .tally{position:absolute;z-index:3;left:6px;bottom:8px;display:flex;align-items:baseline;gap:5px;padding:6px 10px;border-radius:10px;background:#16181C;color:#fff;font-size:12px;white-space:nowrap;box-shadow:0 6px 14px rgba(0,0,0,.28);animation:bump 3s infinite}
.pt .tally b{font-size:15px;font-weight:800;font-variant-numeric:tabular-nums}
.pt .tally b::before{content:counter(c);counter-reset:c var(--c);animation:cnt 900s steps(300,start) infinite}
@keyframes cnt{from{--c:124}to{--c:424}}
@keyframes bump{0%,6%{transform:none}2%{transform:scale(1.12)}}
/* P3 +1 */
.pt .it{position:relative}
.pt .plus{position:absolute;right:36px;top:22px;font-size:34px;font-weight:800;color:#1C69EF;opacity:0;animation:plus 12s infinite}
.pt .it:nth-child(5) .plus{animation-delay:0s}.pt .it:nth-child(6) .plus{animation-delay:-9s}.pt .it:nth-child(7) .plus{animation-delay:-6s}.pt .it:nth-child(8) .plus{animation-delay:-3s}.pt .it:nth-child(9) .plus{display:none}
@keyframes plus{0%,3%{opacity:0;transform:translateY(10px)}7%{opacity:1;transform:none}17%,100%{opacity:0;transform:translateY(-26px)}}
@media (prefers-reduced-motion:reduce){.pt *,.pt *::before,.pt *::after{animation:none!important}.pt .toast.t1,.pt .mlive .m1{opacity:1}.pt .em-m{background-size:100% 100%}}`
