/**
 * 🔔 2026-07-01: 알림톡 템플릿 코드 SSOT (진단용 레지스트리).
 *
 * 배경(전수조사): 카카오 알림톡은 `tpl_code` 가 **Aligo 콘솔에 사전 등록·승인된 템플릿**이어야
 *   하고, 보낸 `message` 도 승인된 템플릿 본문과 일치해야 한다. 미등록/불일치면 Aligo 가
 *   `result_code != '1'` 로 거부 → `alimtalk_failures` 에 쌓여 3회 재시도 후 방치(전달 0, quota 낭비).
 *   `aligo.ts sendAlimtalk` 에는 **SMS 폴백이 없어**, 거부된 알림톡은 어떤 채널로도 안 감.
 *   (인앱 알림/웹푸시는 별개 경로라 대부분 사용자가 완전 무통보는 아님.)
 *
 * 이 파일의 역할:
 *  - 코드베이스가 **사용하는** 모든 platform template 코드 목록(ALL_USED_ALIMTALK_TEMPLATES) — 오타/중복 방지.
 *  - 문서화된(콘솔 등록 대상) 코드(DOCUMENTED_REGISTERED) — `docs/kakao-alimtalk-templates.md` SSOT.
 *  - `isDocumentedRegistered(code)` — 진단(admin)에서 "이 실패가 미등록 템플릿 때문인지" 주석용.
 *
 * ⚠️ 이 목록은 **발송을 막지 않는다**(fail-open). 실제 등록 여부는 Aligo 콘솔(운영 사실)이 SSOT이며,
 *   문서가 최신이 아닐 수 있어 하드 게이트로 쓰면 정상 발송을 막을 위험이 있다. 진단/문서 전용.
 *
 * 📌 문안(본문) 전체는 `docs/kakao-alimtalk-templates.md` 에 콘솔 등록형(#{변수})으로 정리됨.
 *   새 알림톡 트리거 추가 시: (1) 여기 ALL_USED 에 코드 추가, (2) docs 에 본문(#{변수}) 추가,
 *   (3) Aligo 콘솔에 동일 tpl_code + 동일 본문 등록·승인.
 *
 * 🧱 서비스 분리: 소비자(유어딜, live.ur-team.com)와 도매(유통스타트, utongstart.com)는
 *   **발신 프로필(카카오 채널)이 다르다.** 아래 WHOLESALE 코드는 유통스타트 채널에 등록.
 */

/**
 * 소비자(유어딜) platform 알림톡 코드 — live.ur-team.com 발신 프로필.
 * 문안: docs/kakao-alimtalk-templates.md 참조.
 */
export const CONSUMER_ALIMTALK_TEMPLATES: readonly string[] = [
  // 가입·승인
  'seller_registered', 'seller_approved', 'agency_registered', 'agency_approved',
  'business_registration_result',
  // 주문·선물·환불
  'new_order', 'gift_received', 'gift_refunded', 'voucher_refunded',
  // 정산·송금
  'seller_settlement_completed', 'settlement_completed', 'payout_completed',
  'commission_withdrawal_approved', 'commission_withdrawal_rejected',
  // 예약(appointment)
  'appointment_seller_new', 'appointment_user_confirmed',
  'appointment_reminder_seller', 'appointment_reminder_user', 'appointment_noshow_alert',
  // 경매
  'auction_won', 'auction_promoted',
  // 숙소
  'stay_dday', 'stay_d1', 'stay_voucher_expire_soon',
] as const

/**
 * 도매(유통스타트) platform 알림톡 코드 — utongstart.com 발신 프로필(소비자와 별개 채널).
 */
export const WHOLESALE_ALIMTALK_TEMPLATES: readonly string[] = [
  'supplier_approved', 'supplier_rejected',
  'distributor_approved', 'distributor_rejected',
] as const

/** Aligo 콘솔에 등록됨으로 저장소에 문서화된 코드 (docs/kakao-alimtalk-templates.md). */
export const DOCUMENTED_REGISTERED_ALIMTALK_TEMPLATES: readonly string[] = [
  ...CONSUMER_ALIMTALK_TEMPLATES,
  ...WHOLESALE_ALIMTALK_TEMPLATES,
] as const

/**
 * 코드베이스가 실제로 `sendSystemAlimtalk`/`sendAlimtalk` 로 넘기는 모든 platform template 코드.
 * DOCUMENTED_REGISTERED 에 없는 항목은 "문서 미기재" — 오타이거나 새로 추가하고 문서를 안 갱신한 것.
 */
export const ALL_USED_ALIMTALK_TEMPLATES: readonly string[] = [
  ...CONSUMER_ALIMTALK_TEMPLATES,
  ...WHOLESALE_ALIMTALK_TEMPLATES,
  // 셀러 자체 Aligo 계정으로 나가는 브랜드메시지(alimtalk-auto.ts) — 플랫폼 발신 프로필 아님.
  //   각 셀러가 자기 채널에 등록. 플랫폼 콘솔 심사 대상 아님(참고용).
  'order_confirm', 'shipping_start', 'delivery_completed', 'low_stock_alert',
  // 셀러 브랜드메시지 테스트 발송(seller-alimtalk-mgmt) — 셀러 자체 계정 테스트 코드.
  'test',
] as const

const _registeredSet = new Set(DOCUMENTED_REGISTERED_ALIMTALK_TEMPLATES)

/** 저장소에 등록됨으로 문서화된 코드인가. (Aligo 콘솔 실제 등록은 별개 — 진단 주석 전용) */
export function isDocumentedRegistered(code: string): boolean {
  return _registeredSet.has(code)
}
