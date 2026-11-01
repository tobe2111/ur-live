/**
 * 🛒 AI 비서 결제 넘겨받기 — 순수 규칙 (2026-10-20 대표 *"4번도 일단은 하자. 가장 이상적으로."*).
 *
 * ## 왜 "대신 결제"가 아니라 "결제 직전까지 넘겨주기"인가
 * AI 비서가 손님 카드로 **혼자** 결제하려면 카드를 미리 등록해 두고(빌링키) 결제마다 손님 확인 없이
 * 청구해야 한다. 그건 ① 국내 카드 결제가 요구하는 본인 인증을 건너뛰는 것이고 ② AI 가 잘못 알아들은
 * 주문을 되돌릴 길이 환불뿐이며 ③ 잠긴 결제 경로(토스 V2 감사)를 새로 여는 일이다.
 * 그래서 이상적인 형태는 **AI 가 고르고, 사람이 확인해 결제한다**:
 *   1. AI 가 `/api/agent/checkout?id=&qty=` 로 묻는다 → 그 수량의 금액과 **결제 링크**를 받는다.
 *   2. 손님이 링크를 열면 우리 상세 페이지에 **구매 창이 그 수량으로 열린 채** 뜬다.
 *   3. 손님은 금액을 보고 [구매하기] 한 번 — 결제는 종전과 같은 토스 흐름이고, 금액은 서버가 다시 잰다.
 *
 * 🔒 머니 경로 무접촉: 주문·결제·원장 코드는 한 줄도 안 바뀐다. 링크의 수량은 **미리 채우는 값**일 뿐이고
 *    실제 한도·금액은 결제 직전에 서버가 다시 검사한다(`purchase-cap.ts` · `/join`). 링크를 손으로 고쳐도
 *    얻는 것이 없다.
 * 🔒 게이트 `agent_checkout_enabled` — 꺼져 있으면 404, 안내문(llms.txt)에도 안 싣는다.
 */

export const AGENT_CHECKOUT_GATE = 'agent_checkout_enabled'
export const AGENT_CHECKOUT_PATH = '/api/agent/checkout'
/** 결제 링크에 붙는 표식 — 상세 페이지가 이것을 보고 구매 창을 연다. */
export const AGENT_VIA = 'agent'

/** 수량 입력 정리. 숫자가 아니거나 1 미만이면 1, 상한을 넘으면 상한. */
export function clampAgentQty(raw: unknown, cap: number): number {
  const top = Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : 1
  const n = Math.trunc(Number(raw))
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(n, top)
}

/**
 * 결제 링크. **수량을 고르는 화면이 있는 상세(`/pass/:id`)만** 수량을 싣는다 —
 * 숙소(`/stays/:id`)는 날짜·객실을 골라야 해서 수량 하나로 미리 채울 수 없다(링크만 준다).
 */
export function agentCheckoutUrl(origin: string, path: string, qty: number): string {
  const base = `${origin.replace(/\/+$/, '')}${path}`
  if (!path.startsWith('/pass/')) return base
  return `${base}?qty=${Math.max(1, Math.trunc(qty))}&via=${AGENT_VIA}`
}

/** 상세 페이지가 읽는다 — AI 비서 링크로 들어왔으면 그 수량, 아니면 null. */
export function readAgentHandoff(search: string): { qty: number } | null {
  let p: URLSearchParams
  try { p = new URLSearchParams(search) } catch { return null }
  if (p.get('via') !== AGENT_VIA) return null
  const n = Math.trunc(Number(p.get('qty')))
  return { qty: Number.isFinite(n) && n >= 1 ? n : 1 }
}

/** AI 비서가 손님에게 그대로 옮길 수 있는 안내 — 실제 흐름만 말한다. */
export const AGENT_HOW_TO_PAY = '결제 링크(checkout_url)를 손님에게 건네세요. 링크를 열면 이 수량으로 구매 창이 열려 있고, 손님이 금액을 확인한 뒤 직접 결제합니다. 실제 금액과 한도는 결제 직전에 다시 확인됩니다.'

/** `llms.txt` 에 싣는 안내 — 게이트가 켜져 있을 때만 라우트가 붙인다. */
export function agentCheckoutLines(base: string): string[] {
  return [
    '## AI 비서용 결제 링크',
    '',
    `- 주소: GET ${base}${AGENT_CHECKOUT_PATH}?id=상품번호&qty=수량`,
    '- 상품번호(id)는 검색 결과의 id 다. 수량(qty)은 1 이상이고, 넘치면 1인당 한도로 줄여서 돌려준다.',
    '- 금액(total)과 결제 링크(checkout_url)를 돌려준다. AI 가 결제하지 않는다 — 손님이 링크를 열어 직접 결제한다.',
    '',
  ]
}
