/**
 * 🏢 이 브라우저에 에이전시 로그인이 있는가 — 마이(손님)와 마이 자리(이메일 전용)가 같이 묻는다.
 *
 * 마이의 첫 화면 번들에 에이전시 화면 코드를 싣지 않으려고 **의존성 없는 작은 모듈**로 둔다
 * (`pages/agency-console/agency-api.ts` 를 import 하면 셀러 좌석 도구까지 딸려 온다).
 * 키 이름은 그쪽과 같아야 한다 — 시험이 대조한다.
 *
 * 🟡 2026-10-26 — **카카오로 이어진 에이전시 로그인은 그 카카오 계정에 묶인다.**
 *   카카오로 받은 에이전시 토큰은 7일 산다. 묶지 않으면 카카오에서 로그아웃한 뒤에도, 또는 같은 브라우저에
 *   **다른 사람**이 카카오로 로그인해도 앞사람의 에이전시가 그대로 열린다. 그래서 잇는 순간 손님 id 를 함께
 *   적어 두고(`AGENCY_KAKAO_UID_KEY`), 지금 손님이 그 사람이 아니면(로그아웃 포함) 에이전시 로그인을 지운다.
 *   이메일로 로그인한 에이전시는 묶지 않는다 — 회사 컴퓨터에서 손님 로그인과 무관하게 쓰는 계정이다.
 */
export const AGENCY_TOKEN_KEY_MIRROR = 'agency_console_token'
export const AGENCY_PROFILE_KEY_MIRROR = 'agency_console_profile'
export const AGENCY_KAKAO_UID_KEY = 'agency_console_kakao_uid'

function stores(): Storage[] {
  const out: Storage[] = []
  try { out.push(localStorage) } catch { /* 막힘 */ }
  try { out.push(sessionStorage) } catch { /* 막힘 */ }
  return out
}
function read(key: string): string {
  for (const s of stores()) {
    try { const v = s.getItem(key); if (v) return v } catch { /* 다음 */ }
  }
  return ''
}
function consumerUserId(): string {
  try { return localStorage.getItem('user_id') || localStorage.getItem('userId') || '' } catch { return '' }
}

/** 카카오로 이어진 에이전시 로그인인데 지금 손님이 그 사람이 아니면 지운다. 지웠으면 true. */
export function dropForeignKakaoAgency(): boolean {
  const owner = read(AGENCY_KAKAO_UID_KEY)
  if (!owner || owner === consumerUserId()) return false
  for (const s of stores()) {
    try { for (const k of [AGENCY_TOKEN_KEY_MIRROR, AGENCY_PROFILE_KEY_MIRROR, AGENCY_KAKAO_UID_KEY]) s.removeItem(k) } catch { /* 무시 */ }
  }
  return true
}

export function hasAgencyLogin(): boolean {
  dropForeignKakaoAgency()
  return !!read(AGENCY_TOKEN_KEY_MIRROR)
}

/** 카카오로 이은 직후 — 지금 손님 id 를 적어 묶는다. */
export function bindAgencyToKakao(): void {
  const uid = consumerUserId()
  if (!uid) return
  try { localStorage.setItem(AGENCY_KAKAO_UID_KEY, uid) } catch { /* 막힘 — 이번 탭에서만 */ }
}

/**
 * 📣 2026-11-02 — 에이전시 로그인이 생기거나 끊긴 순간을 마이의 다른 자리(머리의 '매장 영입' 버튼 ·
 *   에이전시 구역 제목)에 알린다. 카카오로 이어진 에이전시는 첫 화면을 그린 **뒤에** 이어지므로
 *   (MyAgencyZone 의 확인), 마운트 때 한 번 읽는 것만으로는 그 자리들이 영영 안 뜬다.
 */
export const AGENCY_PRESENCE_EVENT = 'ur-agency-presence'
export function announceAgencyPresence(): void {
  try { window.dispatchEvent(new Event(AGENCY_PRESENCE_EVENT)) } catch { /* SSR·테스트 */ }
}

/** 저장된 에이전시 이름·역할 — 응답 전에 제목을 그리려고 읽는다(없으면 null). */
export function readAgencyProfileLite(): { agencyName: string; isAdmin: boolean } | null {
  try {
    const raw = read(AGENCY_PROFILE_KEY_MIRROR)
    if (!raw) return null
    const p = JSON.parse(raw) as { agency?: { name?: string }; staff?: { role?: string } }
    return { agencyName: p.agency?.name || '', isAdmin: p.staff?.role === 'admin' }
  } catch { return null }
}
