/**
 * ↩️ 마이로 돌아가기 — "마이에서 시작한 일은 마이에서 끝난다" (2026-09-26, 설계 §20)
 *   대표: *"모두 마이에서 하도록"*
 *
 * ## 왜 필요한가 (실측)
 * 마이의 판매 도구 중 **큰 화면**(이용권 등록·수정·예약·반품·정산서…)은 시트로 만들지 않는다.
 * 495줄짜리 폼을 복제하면 두 벌이 갈리고, 폰에서 시트에 넣으면 스크롤 지옥이 된다. 그래서
 * 좌석을 맞춘 뒤 **기존 전체화면으로 보낸다.**
 *
 * 그런데 보내기만 하고 끝이었다. 이용권 등록 폼은 저장 후 `/seller/group-buy` 로 가므로,
 * **마이에서 출발한 사장님이 셀러 대시보드 한복판에 남겨진다** — "왜 여기 있지?" 가 된다.
 *
 * ## URL 이 아니라 세션에 적는다
 * `?from=my` 하나로는 부족하다. 대시보드 안에서 한 번만 이동해도 그 파라미터가 떨어져 나가고,
 * 정작 **일이 끝나는 화면**(저장 후 이동한 목록)에는 남아 있지 않다. 그래서 진입할 때 세션에
 * 적어 두고, 사장님이 마이로 돌아가거나 셀러에서 로그아웃할 때 지운다.
 *
 * ⚠️ **탭 수명이다**(`sessionStorage`). 탭을 닫으면 사라진다 — 어제 마이에서 들어간 흔적이
 *   오늘 띠로 뜨면 안 된다.
 * ⚠️ 이 값은 **표시 전용**이다. 권한·좌석·대상은 여기서 정하지 않는다(토큰이 정한다).
 */

/** 소비자 '마이' 주소. 링크를 손으로 쓰지 않는다 — 바뀌면 여기만 고친다. */
export const MY_PATH = '/user/profile'

/** 진입 주소에 붙는 표시. 세션 기록의 *시작 신호*일 뿐이고, 이후 판정은 세션이 한다. */
export const FROM_MY_PARAM = 'from'
export const FROM_MY_VALUE = 'my'

const KEY = 'ur_seller_from_my'

/** 마이에서 셀러 화면으로 보낼 때 주소에 표시를 붙인다. */
export function withMyReturn(path: string): string {
  if (!path.startsWith('/')) return path
  const [base, hash] = path.split('#')
  const sep = base.includes('?') ? '&' : '?'
  const marked = `${base}${sep}${FROM_MY_PARAM}=${FROM_MY_VALUE}`
  return hash ? `${marked}#${hash}` : marked
}

/**
 * 셀러 화면이 뜰 때 한 번 부른다 — 주소에 표시가 있으면 세션에 적는다.
 * 표시가 없다고 **지우지는 않는다**(대시보드 안에서 이동하면 파라미터가 떨어지므로).
 */
export function noteMyReturn(search: string): void {
  try {
    if (new URLSearchParams(search).get(FROM_MY_PARAM) !== FROM_MY_VALUE) return
    sessionStorage.setItem(KEY, '1')
  } catch { /* storage 접근 불가 */ }
}

/** 지금 이 셀러 화면에 "마이로 돌아가기" 를 보여 줘야 하는가. */
export function shouldOfferMyReturn(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** 마이로 돌아갔거나 셀러에서 나갔을 때 — 흔적을 지운다. */
export function clearMyReturn(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch { /* storage 접근 불가 */ }
}
