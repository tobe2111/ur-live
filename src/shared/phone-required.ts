/**
 * 📞 가입 시 휴대폰 번호 필수 (2026-11-04 대표 *"가입 시, 전화번호는 필수로 입력하게끔 해줄래? 예약 및 소식 알림을 위한 목적으로"*).
 *
 * 대표 확정 두 가지:
 *   ① **새 가입자만** — 이미 가입한 회원은 그대로 두고, 필요한 순간(구매 등)에만 묻는다.
 *   ② **예약·이용 안내는 필수, 소식(할인·이벤트) 알림은 선택 체크** — 광고성 정보는 필수 동의로 묶을 수 없다
 *      (정보통신망법 제50조). 선택 동의는 `terms_agreements` 의 `marketing` 으로 남긴다(기본 꺼짐).
 *
 * "새 가입자" 판정은 서버가 한다 — `users.created_at` 이 아래 시각 이후이고 번호가 없으면 `/api/auth/me` 가
 * `phone_required: true` 를 내린다. URL 의 `?new=1` 로 판정하지 않는 이유: 그 창을 닫고 나가면 다음 접속엔
 * 표시가 없어 그대로 빠져나간다. 서버 판정이면 번호를 넣을 때까지 어느 기기에서든 다시 뜬다.
 */

/** 이 시각(UTC, D1 `datetime('now')` 형식) 이후 가입한 회원부터 번호가 필수다. */
export const PHONE_REQUIRED_SINCE = '2026-11-04 00:00:00'

export function isPhoneRequired(phone: string | null | undefined, createdAt: string | null | undefined): boolean {
  if (phone && String(phone).replace(/\D/g, '').length >= 9) return false
  if (!createdAt) return false
  return String(createdAt).replace('T', ' ').slice(0, 19) >= PHONE_REQUIRED_SINCE
}
