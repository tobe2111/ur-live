/**
 * 🤝 제휴사 입점 위젯 — 화면 전부(2026-11-02 대표 확정 시안 3차 4번 + *"유어딜의 정체성 한줄 고정"*).
 *
 * 흐름: 대표 *"제휴사 위젯 너무 촌스러워"* → 1·2차 시안 → *"이런 식이 아니라 제휴사에서 우리 유어딜 서비스를
 * 홍보하는 차원이니 유어딜 장점을 소개해야지. 체험단의 단점 한계점을 나타내면서"* → 3차 →
 * ***"4번형태로 가되 유어딜의 정체성 한줄 고정은 해야할듯"***.
 *
 * 화면(높이 360 고정 — 붙여 넣는 코드의 iframe 높이):
 *   머리줄   urdeal | ○○ 추천
 *   고정 줄  체험단의 문제를 해결하는 인플루언서 판매 서비스   ← 세 장이 넘어가도 **움직이지 않는다**
 *   무대     세 장이 4초마다 넘어간다: [체험단의 문제 n/3] 지워진 문제 → 큰 해결책 이름 → 설명 한 줄
 *   바닥     진행 막대 셋 · [유어딜 입점 신청]
 *
 * 움직임 이유: 한계→장점을 **한 번에 하나씩** 읽히게 하려는 것(장면 전환이 곧 이야기). 스크립트 0 줄
 * (CSP nonce — `embed-widget.ts` 머리말). 장면은 **음수 지연**으로 돌린다 — 첫 프레임에 1번 장이 이미 서 있고
 * (썸네일·빠른 스크롤이 빈 무대를 보지 않는다), 2·3번 장이 시작 전 상태로 겹치지 않는다.
 * `prefers-reduced-motion` 이면 1번 장만 정지 상태로 선다.
 *
 * ⚠️ 문구는 지금 서비스에 있는 것만(인플루언서 유어샵 판매 · 손님 선결제 · QR 사용 · 소개비는 팔렸을 때만·매장이 비율 결정 · 가입비·월 이용료 0원).
 *    요율·금액 숫자 0 — 어드민이 바꾸는 값이라 남의 사이트에 박힌 숫자는 곧 거짓말이 된다.
 * ⚠️ 바깥 바탕은 --pbg(제휴 위젯 전용)다. --bg 를 바꾸면 strip·single 위젯이 남의 흰 사이트에서 회색 사각형이 된다.
 */

/**
 * 장면 하나 = 체험단의 한계 → 인플루언서와 함께 파는 유어딜. 순서가 곧 이야기다(누가 파나 → 손님은 어떻게 오나 → 비용은).
 * 🤝 2026-11-02 대표 *"이거 아니야, '체험단은 이제 그만, 인플루언서와 함께 팔아보자' 이런 느낌이 필요해"* —
 *   앞선 판(손님 선결제 · 새 손님 · 팔렸을 때만 비용)은 유어딜 일반 장점이었고, 대표가 원한 축은 **인플루언서 판매**다.
 * ⚠️ 사실 근거(지금 코드): 인플루언서가 이용권을 자기 유어샵에 담아 판다 · 소개비 %는 매장이 제안하고 매장이 부담 ·
 *    주문당(팔렸을 때만) · 환불 시 회수(`urdeal-platform-model.md` §5 인플루언서 딜 커미션 행).
 */
export const PARTNER_SLIDES: ReadonlyArray<{ no: string; yes: string; desc: string }> = [
  { no: '공짜 식사를 주고 후기 한 편만 남는다', yes: '<em>인플루언서가 직접 판매</em>하는 할인 이용권', desc: '인플루언서가 자기 유어샵에 담아 팔로워에게 소개' },
  { no: '글 하나 올라가면 효과가 끝난다', yes: '팔로워가 <em>먼저 결제</em>하고 오는 방문', desc: '할인 이용권을 산 손님이 편한 날 QR로 바로 사용' },
  { no: '효과가 없어도 비용은 먼저 나간다', yes: '<em>판매된 만큼만</em> 내는 소개비', desc: '소개비 비율은 사장님이 결정 · 가입비·월 이용료 0원' },
]

/**
 * 고정 줄 — 대표 *"정체성 한줄 고정"* → *"체험단은 이제 그만, 인플루언서와 함께 팔아보자"* →
 * ***"그냥 ~합니다 이런게 아니라 체험단의 문제를 해결하는 서비스, 이런 어투로"*** (2026-11-02).
 * 그래서 문장은 서술(~합니다)이 아니라 **문제 → 해결책 이름**(명사로 끝난다). 장면 라벨도 "체험단의 문제".
 */
export const PARTNER_IDENTITY = '체험단의 문제를 해결하는 <b>인플루언서 판매 서비스</b>'

/** 한 장이 머무는 시간(초). 세 장 한 바퀴 = 3 × 이 값. */
export const PARTNER_SLIDE_SEC = 4

const CYCLE = PARTNER_SLIDES.length * PARTNER_SLIDE_SEC

export const PARTNER_CSS = `
.pt{min-height:100vh;background:var(--pbg);padding:10px}
.pt .k{height:calc(100vh - 20px);min-height:300px;background:var(--card);border-radius:18px;box-shadow:var(--lift);padding:18px 22px;display:flex;flex-direction:column;gap:12px;word-break:keep-all;overflow:hidden}
.pt .hd{gap:8px}
.pt .hd .logo{font-size:15px}
.pt .co{min-width:0;font-size:13px;color:var(--soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pt .id{margin:0;padding:10px 14px;border-radius:10px;background:var(--tint);color:var(--ink);font-size:15px;font-weight:500;line-height:1.45}
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
