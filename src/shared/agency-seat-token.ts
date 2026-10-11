/**
 * 🏢 에이전시 좌석 판정 — 토큰 claim 만 본다 (2026-10-11 `AgencySeatBar.tsx` 에서 분리).
 *
 * 왜 따로 있나: 이 작은 함수가 `components/seller/AgencySeatBar.tsx` 안에 있으면, 그걸 import 하는
 *   공용 부품(`SellerKakaoLinkBanner`)이 **셀러 대시보드 청크 전체**(+ 대시보드 청크)를 소비자 화면
 *   (이용권 상세·교환권·유어샵·쇼핑 상세)의 첫 페인트로 끌고 왔다(`check-surface-role-leak` 이 5건 잡았다).
 *   화면은 멀쩡하고 바이트만 새는 종류다. 그래서 의존성 없는 순수 모듈로 두고 `app-shared` 청크에 묶는다.
 */

/** 에이전시 직원이 매장 좌석을 열 때 저장하는 에이전시 이름 키. */
export const AGENCY_SEAT_NAME_KEY = 'agency_seat_name'

/** 지금 셀러 좌석이 에이전시 직원 좌석인가 — 토큰 payload 의 claim 으로만 본다(서명 검증은 서버 일). */
export function isAgencySeatToken(token: string | null): boolean {
  if (!token) return false
  const part = token.split('.')[1]
  if (!part) return false
  try {
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as { agency_staff_id?: unknown }
    return json.agency_staff_id != null
  } catch { return false }
}
