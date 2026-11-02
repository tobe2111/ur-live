/**
 * 🤝 제휴사 입점 위젯 — 화면 전부(2026-11-02 대표 확정 시안 3차 4번 + *"유어딜의 정체성 한줄 고정"*).
 *
 * 흐름: 대표 *"제휴사 위젯 너무 촌스러워"* → 1·2차 시안 → *"이런 식이 아니라 제휴사에서 우리 유어딜 서비스를
 * 홍보하는 차원이니 유어딜 장점을 소개해야지. 체험단의 단점 한계점을 나타내면서"* → 3차 →
 * ***"4번형태로 가되 유어딜의 정체성 한줄 고정은 해야할듯"***.
 *
 * 화면(높이 360 고정 — 붙여 넣는 코드의 iframe 높이):
 *   머리줄   urdeal | ○○ 추천
 *   고정 줄  유어딜은 가게 할인 이용권을 미리 파는 서비스예요   ← 세 장이 넘어가도 **움직이지 않는다**
 *   무대     세 장이 4초마다 넘어간다: [체험단의 한계 n/3] 지워진 한계 → 큰 장점 문장 → 설명 한 줄
 *   바닥     진행 막대 셋 · [유어딜 입점 신청]
 *
 * 움직임 이유: 한계→장점을 **한 번에 하나씩** 읽히게 하려는 것(장면 전환이 곧 이야기). 스크립트 0 줄
 * (CSP nonce — `embed-widget.ts` 머리말). 장면은 **음수 지연**으로 돌린다 — 첫 프레임에 1번 장이 이미 서 있고
 * (썸네일·빠른 스크롤이 빈 무대를 보지 않는다), 2·3번 장이 시작 전 상태로 겹치지 않는다.
 * `prefers-reduced-motion` 이면 1번 장만 정지 상태로 선다.
 *
 * ⚠️ 문구는 지금 서비스에 있는 것만(손님 선결제 · QR 사용 · 지도·동네딜·유어샵 노출 · 팔렸을 때만 비용 · 가입비·월 이용료 0원).
 *    요율·금액 숫자 0 — 어드민이 바꾸는 값이라 남의 사이트에 박힌 숫자는 곧 거짓말이 된다.
 * ⚠️ 바깥 바탕은 --pbg(제휴 위젯 전용)다. --bg 를 바꾸면 strip·single 위젯이 남의 흰 사이트에서 회색 사각형이 된다.
 */

/** 장면 하나 = 체험단의 한계 → 유어딜 장점. 순서가 곧 이야기다(결제 → 손님 → 비용). */
export const PARTNER_SLIDES: ReadonlyArray<{ no: string; yes: string; desc: string }> = [
  { no: '음식은 공짜로 나가고 매출은 그대로', yes: '유어딜은 <em>손님이 먼저 결제하고</em> 옵니다', desc: '할인 이용권을 사 둔 손님이 편한 날 찾아와 QR로 바로 사용합니다.' },
  { no: '한 번 다녀가면 그걸로 끝', yes: '유어딜은 <em>새 손님이 계속</em> 찾아옵니다', desc: '지도와 동네딜에 노출되고, 유저들이 자기 유어샵에 담아 소개합니다.' },
  { no: '효과가 없어도 비용은 먼저', yes: '유어딜은 <em>팔렸을 때만</em> 비용이 듭니다', desc: '가입비·월 이용료 0원. 정산은 팔린 만큼 받습니다.' },
]

/** 유어딜 정체성 한 줄 — 대표 *"정체성 한줄 고정"*. 장면이 넘어가도 이 줄은 그대로 선다. */
export const PARTNER_IDENTITY = '유어딜은 <b>가게 할인 이용권</b>을 미리 파는 서비스예요'

/** 한 장이 머무는 시간(초). 세 장 한 바퀴 = 3 × 이 값. */
export const PARTNER_SLIDE_SEC = 4

const CYCLE = PARTNER_SLIDES.length * PARTNER_SLIDE_SEC

export const PARTNER_CSS = `
.pt{min-height:100vh;background:var(--pbg);padding:10px}
.pt .k{height:calc(100vh - 20px);min-height:300px;background:var(--card);border-radius:18px;box-shadow:var(--lift);padding:18px 22px;display:flex;flex-direction:column;gap:12px;word-break:keep-all;overflow:hidden}
.pt .hd{gap:8px}
.pt .hd .logo{font-size:15px}
.pt .co{min-width:0;font-size:13px;color:var(--soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pt .id{margin:0;padding:9px 12px;border-radius:10px;background:var(--tint);color:var(--ink);font-size:13px;line-height:1.5}
.pt .id b{font-weight:700;color:var(--brand)}
.pt .stage{position:relative;flex:1;min-height:0}
.pt .sl{position:absolute;inset:0;display:flex;flex-direction:column;gap:8px;animation:pt-scene ${CYCLE}s infinite}
${PARTNER_SLIDES.map((_, i) => `.pt .sl:nth-child(${i + 1}){animation-delay:-${(CYCLE - i * PARTNER_SLIDE_SEC) % CYCLE}s}`).join('\n')}
.pt .lb{font-size:12px;color:var(--faint)}
.pt .lb i{font-style:normal;margin-left:6px;opacity:.7}
.pt .no{margin:0;font-size:15px;color:var(--faint);text-decoration:line-through;text-decoration-thickness:1px}
.pt .yes{margin:0;font-size:28px;font-weight:700;letter-spacing:-.03em;line-height:1.28;color:var(--ink)}
.pt .yes em{font-style:normal;color:var(--brand)}
.pt .ds{margin:0;font-size:13px;line-height:1.6;color:var(--soft)}
.pt .ft{display:flex;align-items:center;justify-content:space-between;gap:12px}
.pt .dots{display:flex;gap:6px}
.pt .dots i{position:relative;width:18px;height:3px;border-radius:2px;background:var(--rule);overflow:hidden}
.pt .dots i::after{content:'';position:absolute;inset:0;background:var(--brand);transform:scaleX(0);transform-origin:left;animation:pt-bar ${CYCLE}s linear infinite}
${PARTNER_SLIDES.map((_, i) => `.pt .dots i:nth-child(${i + 1})::after{animation-delay:-${(CYCLE - i * PARTNER_SLIDE_SEC) % CYCLE}s}`).join('\n')}
.pt .go{display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 18px;border-radius:12px;background:var(--brand);color:#fff;font-size:15px;font-weight:700;white-space:nowrap}
.pt .go svg{width:16px;height:16px}
@keyframes pt-scene{0%{opacity:1;transform:none}30%{opacity:1;transform:none}34%{opacity:0;transform:translateY(-6px)}96%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:none}}
@keyframes pt-bar{0%{transform:scaleX(0)}33.3%{transform:scaleX(1)}33.4%,100%{transform:scaleX(0)}}
/* 📱 폰 폭 — 설명 줄을 빼고 큰 문장을 줄인다. 버튼은 폭 전체(누르기 쉽게). 320~420px 에서 360 안에 든다. */
@media (max-width:480px){.pt .k{padding:14px 16px;gap:10px}.pt .yes{font-size:24px}.pt .ds{display:none}.pt .ft{flex-direction:column;align-items:stretch;gap:10px}.pt .go{justify-content:center}}
@media (prefers-reduced-motion:reduce){.pt *,.pt *::before,.pt *::after{animation:none!important;transition:none!important}.pt .sl:nth-child(n+2){display:none}.pt .dots{display:none}}`
