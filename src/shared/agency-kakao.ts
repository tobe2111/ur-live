/**
 * 🏢 카카오로 만든 에이전시 — 2026-10-26 대표 확정.
 *   대표: *"아무튼 에이전시 계정은 이메일로만 로그인 되긴 해야해. 카카오 로그인으로 해도 되고,
 *   대신 카카오 로그인 시, 여러명이 함께 관리는 힘들다고 해두면 되는거 아닌가?"*
 *   → `AskUserQuestion` *"이메일 계정으로 옮기기 제공"*.
 *
 * 카카오로 만든 에이전시의 직원 행은 이메일이 없다. `agency_staff.email` 은 NOT NULL·유일이라
 * **자리표시 주소**를 넣는다 — `.invalid` 최상위 도메인은 RFC 2606 이 "절대 배달되지 않는다" 고
 * 정해 둔 이름이라, 실수로 메일을 보내도 남에게 가지 않고, 그 주소로 가입·로그인할 수도 없다
 * (비밀번호가 없다).
 *
 * 서버(직원 행을 만드는 쪽)와 화면(그 주소를 사람에게 안 보여 주는 쪽)이 **같은 판정**을 써야 한다 —
 * 두 벌이면 화면에 `kakao-3@…invalid` 가 그대로 뜨는 날이 온다.
 */
export const KAKAO_STAFF_EMAIL_DOMAIN = 'kakao.agency.urdeal.invalid'

export function kakaoStaffEmail(userId: number): string {
  return `kakao-${userId}@${KAKAO_STAFF_EMAIL_DOMAIN}`
}

/** 카카오로만 들어오는 계정인가(= 아직 이메일 계정으로 옮기지 않았다). */
export function isKakaoOnlyStaffEmail(email: string | null | undefined): boolean {
  return typeof email === 'string' && email.toLowerCase().endsWith(`@${KAKAO_STAFF_EMAIL_DOMAIN}`)
}

/** 사람에게 보여 줄 로그인 이름 — 자리표시 주소는 숨긴다. */
export function agencyStaffLoginLabel(email: string | null | undefined): string {
  if (!email) return ''
  return isKakaoOnlyStaffEmail(email) ? '카카오 로그인' : email
}

/** 카카오 계정이 혼자 쓰는 이유 — 서버 거절 문구와 화면 안내가 같은 말을 한다. */
export const KAKAO_SOLO_NOTICE = '카카오로 만든 에이전시는 혼자 쓰는 계정이에요. 직원과 함께 쓰려면 이메일 계정으로 옮겨 주세요.'
