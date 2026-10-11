/**
 * 🔗 사장님 메시지 → **한 번 눌러 그 화면** (2026-10-10 대표 "카카오톡으로 이용권 관리" → 1번)
 *
 * 판매·사용 문자에 `https://urdeal.kr/seller/group-buy` 같은 대시보드 주소를 넣고 있었다. 그런데
 * 폰에 셀러 세션이 없으면 그 주소는 **셀러 아이디·비밀번호 로그인**으로 떨어진다 — 카카오로만 가입한
 * 사장님에게는 막다른 길이다(비밀번호를 만든 적이 없다).
 *
 * ⇒ 링크를 `/store/go?s=<매장>&to=<화면>` 하나로 모은다. 그 화면은
 *   ① 카카오 로그인(카톡 안에서 열리면 사실상 한 번 탭) → ② 그 매장 좌석에 앉고
 *   (`POST /api/seller/stores/:id/token` — 운영 권한을 서버가 매번 확인한다) → ③ 목적 화면으로 간다.
 *
 * 🔒 링크에 **비밀이 없다** — 매장 번호와 화면 이름뿐이다. 문자가 남에게 넘어가도 그 사람 카카오
 *   계정에 그 매장 권한이 없으면 아무것도 열리지 않는다(권한 판정은 좌석 발급이 한다).
 *
 * 워커(문자 본문)와 화면(`StoreGoPage`)이 **같은 표**를 쓴다 — 두 벌이면 문자가 없는 화면을 가리킨다.
 */

export const STORE_GO_TARGETS = {
  scan: '/seller/scan',               // 손님이 왔을 때 — 사용 처리
  orders: '/seller/voucher-orders',   // 판매·사용 내역
  vouchers: '/seller/group-buy',      // 내 이용권 관리(판매 중지·수정)
  settlements: '/seller/settlements', // 정산·계좌
  docs: '/seller/business-info',      // 사업자등록증·서류
  home: '/seller',
} as const

export type StoreGoTarget = keyof typeof STORE_GO_TARGETS

export const STORE_GO_ORIGIN = 'https://urdeal.kr'

export function isStoreGoTarget(v: unknown): v is StoreGoTarget {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(STORE_GO_TARGETS, v)
}

/** 문자·알림에 넣을 링크. 매장 번호가 이상하면 매장 지정 없이(내 매장 목록에서 고른다). */
export function storeGoUrl(sellerId: unknown, to: StoreGoTarget): string {
  const id = Number(sellerId)
  const s = Number.isFinite(id) && id > 0 ? `s=${Math.trunc(id)}&` : ''
  return `${STORE_GO_ORIGIN}/store/go?${s}to=${to}`
}

/** 앱 안 알림(같은 사이트)용 상대 경로 — 알림함에서 눌러도 같은 순서(로그인 → 좌석 → 화면)를 탄다. */
export function storeGoPath(sellerId: unknown, to: StoreGoTarget): string {
  return storeGoUrl(sellerId, to).slice(STORE_GO_ORIGIN.length)
}

/** 화면이 받은 쿼리를 해석한다 — 모르는 화면은 대시보드 홈으로. */
export function parseStoreGo(search: string): { sellerId: number | null; path: string } {
  const q = new URLSearchParams(search)
  const id = Number(q.get('s'))
  const to = q.get('to')
  return {
    sellerId: Number.isFinite(id) && id > 0 ? Math.trunc(id) : null,
    path: isStoreGoTarget(to) ? STORE_GO_TARGETS[to] : STORE_GO_TARGETS.home,
  }
}
