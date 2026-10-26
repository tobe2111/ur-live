/**
 * 🔘 알림톡 버튼 표 — 2026-10-12 대표 *"알림톡을 보낼 때 유어딜 링크도 넣어야 되지 않을까? 매장 사장이나 대행사가
 *   바로 톡으로 링크 유입을 하기 쉽게"* → 버튼 표 승인 *"수정하면 돼. 각각 링크 넣어줘"*.
 *
 * 왜 한 곳인가: 카카오는 **템플릿에 등록한 버튼과 발송 때 실은 버튼이 같아야** 메시지를 받는다(이름·종류·링크 모양).
 *   버튼이 호출부마다 흩어져 있으면 하나만 어긋나도 그 알림이 조용히 거절된다. 그래서 이 표가 정본이고,
 *   발송(`text-notice.ts`)이 템플릿 이름으로 여기서 꺼내 싣는다 — 호출부는 매장 번호만 넘긴다.
 *   등록용 문서(`docs/alimtalk-register-list.md`)의 버튼 칸도 이 표와 같아야 한다(시험이 대조한다).
 *
 * 사장님 버튼은 `/store/go?s=<매장>&to=<화면>` — 누르면 카카오 로그인 → 그 매장 좌석 → 그 화면(`shared/store-deep-link`).
 *   대행사가 받아도 자기가 맡은 그 매장으로 들어간다. 콘솔에는 매장 번호 자리를 `#{매장번호}` 변수로 등록한다.
 *
 * ❌ 그 알림과 무관한 홍보 링크(예: "유어딜 둘러보기")는 넣지 않는다 — 카카오가 광고로 보고 반려한다.
 */
import type { SensButton } from './ncp-sens'
import { STORE_GO_ORIGIN, storeGoUrl, type StoreGoTarget } from '../shared/store-deep-link'

export type ButtonLink = { kind: 'url'; url: string } | { kind: 'store'; to: StoreGoTarget }
export interface AlimtalkButtonSpec { name: string; link: ButtonLink }

export const MY_VOUCHERS_URL = `${STORE_GO_ORIGIN}/my-vouchers`
/** 콘솔 등록 때 매장 번호 자리에 쓰는 변수 이름. */
export const STORE_ID_VAR = '#{매장번호}'

const MY_VOUCHERS: AlimtalkButtonSpec = { name: '내 이용권 보기', link: { kind: 'url', url: MY_VOUCHERS_URL } }

/** 템플릿 이름(우리 이름) → 버튼. 여기 없는 템플릿은 버튼 없이 간다(시험 발송·정산 송금 완료 등). */
export const ALIMTALK_BUTTONS: Readonly<Record<string, readonly AlimtalkButtonSpec[]>> = {
  voucher_issued: [MY_VOUCHERS],
  voucher_refunded: [MY_VOUCHERS],
  voucher_expire_soon: [MY_VOUCHERS],
  seller_first_voucher: [
    { name: '사용 처리하기', link: { kind: 'store', to: 'scan' } },
    { name: '정산 계좌 등록', link: { kind: 'store', to: 'settlements' } },
  ],
  seller_voucher_sold: [
    { name: '사용 처리하기', link: { kind: 'store', to: 'scan' } },
    { name: '판매 내역', link: { kind: 'store', to: 'orders' } },
  ],
  seller_approved: [{ name: '이용권 등록하기', link: { kind: 'store', to: 'vouchers' } }],
  business_registration_rejected: [{ name: '다시 제출하기', link: { kind: 'store', to: 'docs' } }],
  seller_bank_changed: [{ name: '정산 계좌 확인', link: { kind: 'store', to: 'settlements' } }],
  // 🏠 2026-10-24 생활 견적 — 요청·견적 번호는 버튼에 싣지 않는다(목록 화면으로 보내고, 본문이 무엇인지 말한다).
  home_request_new: [{ name: '요청 보기', link: { kind: 'url', url: `${STORE_GO_ORIGIN}/life/pro` } }],
  home_quote_arrived: [{ name: '견적 비교하기', link: { kind: 'url', url: `${STORE_GO_ORIGIN}/life/requests` } }],
  home_quote_chosen: [{ name: '손님 연락처 보기', link: { kind: 'url', url: `${STORE_GO_ORIGIN}/life/pro` } }],
}

/** 콘솔에 등록할 링크 — 매장 번호 자리는 변수 그대로. 문서·시험이 이 값을 쓴다. */
export function registeredButtonLink(link: ButtonLink): string {
  return link.kind === 'url' ? link.url : `${STORE_GO_ORIGIN}/store/go?s=${STORE_ID_VAR}&to=${link.to}`
}

function validStoreId(v: unknown): boolean {
  const n = Number(v)
  return Number.isFinite(n) && n > 0
}

/**
 * 발송 때 실을 버튼. 버튼이 없는 템플릿이면 `[]`.
 * 매장 버튼인데 매장 번호가 없으면 `null` — 등록한 링크 모양(`s=#{매장번호}`)과 달라 카카오가 거절하므로
 *   보내지 않고 기록만 남긴다(호출부가 매장 번호를 빠뜨린 결함을 숨기지 않는다).
 */
export function alimtalkButtons(tpl: string, vars?: { sellerId?: unknown }): SensButton[] | null {
  const specs = ALIMTALK_BUTTONS[tpl]
  if (!specs) return []
  const out: SensButton[] = []
  for (const b of specs) {
    let url: string
    if (b.link.kind === 'url') url = b.link.url
    else {
      if (!validStoreId(vars?.sellerId)) return null
      url = storeGoUrl(vars?.sellerId, b.link.to)
    }
    out.push({ type: 'WL', name: b.name, linkMobile: url, linkPc: url })
  }
  return out
}
