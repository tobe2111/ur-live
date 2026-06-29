/**
 * 🏭 2026-06-29 도매몰(판매사/제조사) 세션 — 명시 로그아웃이 자동 재로그인에 풀리지 않게 하는 억제 플래그.
 *
 *   배경(대표 신고 "유통사로 로그인한 상태였는데 로그아웃이 전혀 안돼"):
 *   도매 페이지(WholesaleCatalogPage/WholesaleLoginPage/SupplierLoginPage 등)는 마운트 시
 *   카카오 소비자 세션(localStorage.user_id + ur_session 쿠키)만 있으면 자동으로
 *   `become-distributor`/`/supplier/become` 를 호출해 seller/supplier 토큰을 재발급한다.
 *   그래서 로그아웃이 seller 토큰만 지워도, 카카오 세션이 살아있으면 다음 페이지 로드에서
 *   즉시 자동 재로그인 → "로그아웃이 안 됨". 이 플래그로 *명시 로그아웃 후 ~ 명시 로그인 전* 까지
 *   자동 probe 를 억제한다. (소비자/카카오 세션 자체는 보존 — 분리/공존 설계 유지.)
 */
import { clearAuthData } from './auth'

const LOGOUT_FLAG = 'ur_wholesale_logout'

/** 억제 플래그만 set (제조사 로그아웃 등 seller 세션과 무관한 경로용). */
export function setWholesaleLogoutFlag() {
  try { localStorage.setItem(LOGOUT_FLAG, '1') } catch { /* ignore */ }
}

/** 판매사(도매) 로그아웃 핵심 — seller 세션 정리 + 자동 재로그인 억제 플래그 set. (navigate 는 호출부에서.) */
export function markWholesaleLoggedOut() {
  clearAuthData('seller')
  try { localStorage.removeItem('is_distributor') } catch { /* ignore */ }
  setWholesaleLogoutFlag()
}

/** become-distributor / supplier-become 자동 probe 가 억제돼야 하는가(명시 로그아웃 후, 명시 로그인 전). */
export function wholesaleAutoLoginSuppressed(): boolean {
  try { return localStorage.getItem(LOGOUT_FLAG) === '1' } catch { return false }
}

/** 명시 로그인(이메일 제출 / 카카오 버튼 클릭) 시 — 억제 해제(이후 자동 probe 정상). */
export function clearWholesaleLogoutFlag() {
  try { localStorage.removeItem(LOGOUT_FLAG) } catch { /* ignore */ }
}
