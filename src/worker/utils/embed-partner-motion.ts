/**
 * 🎬 제휴사 입점 위젯 모션 (2026-11-02 대표 *"에이전시도 그렇고 제휴사가 더 급해"* — 같은 요청
 * *"모션그래픽도 넣어서 최대한 고급지게"* 를 제휴 위젯에 먼저).
 *
 * 대표 확정 시안 B(2026-11-01 "나란히 선 두 브랜드")의 **마크업·문구·치수는 한 글자도 안 바꾼다** —
 * 움직임만 얹는다. 그래서 이 파일은 CSS 한 덩어리뿐이고 `renderPartner` 가 문서 끝에 붙인다.
 *
 * 순서(처음 한 번 — 1.8초 안에 끝나고 그 뒤엔 조용하다. 영업 문구는 읽혀야 한다):
 *   카드가 떠오름 → 머리 문장 → 체험단 쪽 세 줄에 **줄이 그어지며** 흐려짐 → 유어딜 쪽 세 줄이 파란 점과 함께 들어옴
 *   → 버튼. 그 뒤로는 두 가지만 계속 숨 쉰다: 카드 귀퉁이의 옅은 빛 덩어리, 버튼 위를 가끔 지나가는 빛.
 *
 * 스크립트 0 줄(CSP nonce — `embed-widget.ts` 머리말). `prefers-reduced-motion` 이면 전부 끝 상태로 바로 선다.
 */
export const PARTNER_MOTION_CSS = `
.pt .k{position:relative;isolation:isolate;animation:pm-rise .7s cubic-bezier(.2,.7,.2,1) both}
.pt .k::before{content:'';position:absolute;z-index:-1;width:320px;height:320px;right:-140px;top:-170px;border-radius:50%;background:radial-gradient(closest-side,rgba(28,105,239,.16),transparent);animation:pm-drift 9s ease-in-out infinite alternate;pointer-events:none}
.pt .bar,.pt .in{position:relative}
.pt h1{animation:pm-up .7s cubic-bezier(.2,.7,.2,1) .15s both}
.pt .sub{animation:pm-up .7s cubic-bezier(.2,.7,.2,1) .25s both}
.pt .col b{animation:pm-fade .5s ease .4s both}
.pt .old span{position:relative;width:max-content;max-width:100%;animation:pm-dim .5s ease both}
.pt .old span::after{content:'';position:absolute;left:0;right:0;top:52%;height:1px;background:currentColor;transform:scaleX(0);transform-origin:left;animation:pm-strike .45s cubic-bezier(.6,0,.2,1) both}
.pt .old span:nth-of-type(1),.pt .old span:nth-of-type(1)::after{animation-delay:.55s}
.pt .old span:nth-of-type(2),.pt .old span:nth-of-type(2)::after{animation-delay:.7s}
.pt .old span:nth-of-type(3),.pt .old span:nth-of-type(3)::after{animation-delay:.85s}
.pt .new span{position:relative;padding-left:12px;animation:pm-in .55s cubic-bezier(.2,.7,.2,1) both}
.pt .new span::before{content:'';position:absolute;left:0;top:50%;width:5px;height:5px;margin-top:-2.5px;border-radius:50%;background:var(--brand);animation:pm-pop .4s cubic-bezier(.3,1.6,.5,1) both;animation-delay:inherit}
.pt .new span:nth-of-type(1){animation-delay:1.05s}
.pt .new span:nth-of-type(2){animation-delay:1.2s}
.pt .new span:nth-of-type(3){animation-delay:1.35s}
.pt .new{animation:pm-line .6s ease .9s both}
.pt .foot{animation:pm-up .6s cubic-bezier(.2,.7,.2,1) 1.5s both}
.pt .go{position:relative;overflow:hidden;transition:transform .2s ease,box-shadow .2s ease}
.pt .go::after{content:'';position:absolute;top:-20%;bottom:-20%;width:40%;left:-60%;transform:skewX(-18deg);background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.35),rgba(255,255,255,0));animation:pm-shine 4.5s ease-in-out 2.2s infinite}
.pt .go:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(28,105,239,.34)}
@keyframes pm-rise{from{opacity:0;transform:translateY(16px) scale(.985)}to{opacity:1;transform:none}}
@keyframes pm-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes pm-fade{from{opacity:0}to{opacity:1}}
@keyframes pm-dim{from{opacity:0}to{opacity:1}}
@keyframes pm-strike{to{transform:scaleX(1)}}
@keyframes pm-in{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}
@keyframes pm-pop{from{transform:scale(0)}to{transform:scale(1)}}
@keyframes pm-line{from{border-left-color:transparent}}
@keyframes pm-drift{to{transform:translate(-60px,40px) scale(1.15)}}
@keyframes pm-shine{0%{left:-60%}35%,100%{left:130%}}
/* 📱 좁은 폭(폰) — 종전엔 340px 이하에서 문서가 409px 로 자라 붙인 iframe(360px)이 버튼을 잘랐다(2026-11-02 실측).
   치수만 줄인다(글자 크기·문구 그대로). */
@media (max-width:500px){.pt{padding:6px}.pt .bar{padding:12px 18px}.pt .in{padding:16px 18px}.pt .cmp{margin:14px 0}.pt .col{gap:5px;padding-right:10px}.pt .new{padding-left:14px}.pt .sub{margin-top:6px}.pt .go{padding:10px 16px}.pt .foot{gap:8px}}
@media (prefers-reduced-motion:reduce){.pt *,.pt *::before,.pt *::after{animation:none!important;transition:none!important}.pt .old span::after{transform:none}}`
