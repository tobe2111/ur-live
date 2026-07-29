/**
 * 🏭 2026-06-29 도매몰(판매사/제조사) 자동 로그인 의도 — off-by-default(교과서적 전환, Option B).
 *
 *   배경(대표 "근본적으로 / 가장 이상적으로"): 기존엔 도매 페이지가 마운트할 때마다 카카오 소비자
 *   세션(user_id)만 있으면 자동으로 `become-distributor`/`/supplier/become` 를 호출해 토큰을 *암묵적으로*
 *   재발급(ambient privilege elevation)했다. 이 ambient 자동로그인이 "로그아웃이 안 됨"의 근본 원인.
 *   (로그아웃이 seller 토큰·ur_seller_session 을 지워도 ur_session 이 살아있어 probe 가 재인증.)
 *
 *   교과서적 모델: **명시 로그인(카카오 버튼) 직후 1회만** 자동 토큰교환을 허용한다(off-by-default).
 *   - setWholesaleLoginIntent(): 카카오 로그인 시작 직전 1회 마커(세션 스토리지 — OAuth 왕복 생존).
 *   - consumeWholesaleLoginIntent(): probe 진입 시 마커가 있으면 true 반환 + 소비(1회). 없으면 false → 미발화.
 *   - clearWholesaleLoginIntent(): 로그아웃 시 미소비 stale 마커 제거(토큰이 콜백으로 직접 전달돼 probe
 *     미발화 시 잔존 → 다음 로그아웃 후 재로그인 방지).
 *
 *   카카오 콜백(issueLinkedRoleTokens)이 승인 판매사의 seller_token 을 *명시 발급*하므로 정상 로그인은
 *   콜백이 1차 경로. probe 는 토큰이 전달 안 된 엣지(2026-06-06 B2 fix)만 보완 — 단 '로그인 직후'에 한정.
 */

const LOGIN_INTENT = 'ur_wholesale_login_intent'

/** 명시 로그인(카카오 버튼) 직전 1회 마커 set — become 자동 probe 는 이게 있을 때만 발화. */
export function setWholesaleLoginIntent() {
  try { sessionStorage.setItem(LOGIN_INTENT, '1') } catch { /* ignore */ }
}

/** probe 진입 — 로그인 직후 1회만 true(소비). 마운트마다/로그아웃 후엔 false → ambient 자동로그인 없음. */
export function consumeWholesaleLoginIntent(): boolean {
  try {
    if (sessionStorage.getItem(LOGIN_INTENT) === '1') {
      sessionStorage.removeItem(LOGIN_INTENT)
      return true
    }
  } catch { /* ignore */ }
  return false
}

/** 로그아웃 — 미소비 stale 마커 제거(콜백 직접발급으로 probe 미발화 시 잔존 → 재로그인 방지). */
export function clearWholesaleLoginIntent() {
  try { sessionStorage.removeItem(LOGIN_INTENT) } catch { /* ignore */ }
}
