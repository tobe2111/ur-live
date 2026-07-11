/**
 * 🔔 2026-07-01: 알림톡 템플릿 코드 SSOT (진단용 레지스트리).
 *
 * 배경(전수조사): 카카오 알림톡은 `tpl_code` 가 **Aligo 콘솔에 사전 등록·승인된 템플릿**이어야
 *   하고, 보낸 `message` 도 승인된 템플릿 본문과 일치해야 한다. 미등록/불일치면 Aligo 가
 *   `result_code != '1'` 로 거부 → `alimtalk_failures` 에 쌓여 3회 재시도 후 방치(전달 0, quota 낭비).
 *   SMS 대체발송(failover)은 2026-07-11 부로 **env 게이트로 배선됨(기본 OFF)** —
 *   `features/alimtalk/send.ts`(공용 발송 경로) 한 곳에서 Aligo `failover`/`fsubject_1`/`fmessage_1`
 *   파라미터를 주입. 활성 절차: ① Aligo 콘솔에 SMS 발신번호(ALIGO_SENDER_PHONE) 등록·인증 확인
 *   ② env `ALIMTALK_SMS_FAILOVER=true` 설정. OFF 인 동안(그리고 `lib/aligo.ts` 경유
 *   system-alimtalk 경로는 여전히) 거부된 알림톡은 SMS 로도 안 감.
 *   (인앱 알림/웹푸시는 별개 경로라 대부분 사용자가 완전 무통보는 아님.)
 *
 * 이 파일의 역할:
 *  - 코드베이스가 **사용하는** 모든 template 코드 목록(ALL_USED_ALIMTALK_TEMPLATES) — 오타/중복 방지.
 *  - 저장소에 **등록됨으로 문서화된** 코드(DOCUMENTED_REGISTERED) — Aligo 콘솔 등록의 SSOT 후보.
 *  - `isDocumentedRegistered(code)` — 진단(admin)에서 "이 실패가 미등록 템플릿 때문인지" 주석용.
 *
 * ⚠️ 이 목록은 **발송을 막지 않는다**(fail-open). 실제 등록 여부는 Aligo 콘솔(운영 사실)이 SSOT이며,
 *   문서가 최신이 아닐 수 있어 하드 게이트로 쓰면 정상 발송을 막을 위험이 있다. 진단/문서 전용.
 *
 * 새 알림톡 트리거 추가 시: (1) 여기 ALL_USED 에 코드 추가, (2) Aligo 콘솔에 동일 tpl_code 로 템플릿
 *   등록·승인, (3) 승인되면 DOCUMENTED_REGISTERED 로 이동 + docs/kakao-alimtalk-templates.md 갱신.
 */

/** Aligo 콘솔에 등록됨으로 저장소에 문서화된 코드 (system-alimtalk 헤더 + docs/kakao-alimtalk-templates.md). */
export const DOCUMENTED_REGISTERED_ALIMTALK_TEMPLATES: readonly string[] = [
  // 가입·승인 (system-alimtalk.ts 헤더)
  'seller_registered', 'seller_approved', 'seller_rejected',
  'agency_registered', 'agency_approved',
  'new_order', 'gift_received', 'gift_refunded', 'settlement_completed',
  // docs/kakao-alimtalk-templates.md
  'stay_reminder_d1', 'stay_reminder_dday', 'stay_voucher_expire_soon',
  'referral_commission_earned', 'business_registration_result',
] as const

/**
 * 코드베이스가 실제로 `sendSystemAlimtalk`/`sendAlimtalk` 로 넘기는 모든 template 코드.
 * DOCUMENTED_REGISTERED 에 없는 항목은 "등록 미확인" — 프로덕션에서 거부되고 있을 가능성이 높다
 * (admin 진단 GET /api/admin/alimtalk-failures 의 by_template 에서 registered:false 로 표시됨).
 */
export const ALL_USED_ALIMTALK_TEMPLATES: readonly string[] = [
  ...DOCUMENTED_REGISTERED_ALIMTALK_TEMPLATES,
  // 예약(appointment) — 등록 미확인
  'appointment_seller_new', 'appointment_user_confirmed',
  'appointment_reminder_seller', 'appointment_reminder_user', 'appointment_noshow_alert',
  // 경매 / 교환권 / 정산 / 지급 — 등록 미확인
  'auction_won', 'voucher_refunded', 'seller_settlement_completed', 'payout_completed',
  // 도매(판매사/제조사) — 등록 미확인
  'distributor_approved', 'distributor_rejected', 'supplier_approved', 'supplier_rejected',
  // 🏙️ 2026-07-05 체험단(FCFS) + 이용권 사용 완료 — 콘솔 등록·심사 신청 필요 (문안은 운영이
  //   Aligo 에 등록한 승인 본문과 코드의 message 를 일치시킬 것 — 승인 후 DOCUMENTED 로 이동).
  'fcfs_selected', 'fcfs_replacement', 'voucher_used',
  // 셀러 브랜드메시지 테스트 발송(seller-alimtalk-mgmt) — 셀러 자체 Aligo 계정용 테스트 코드(시스템 알림 아님)
  'test',
] as const

const _registeredSet = new Set(DOCUMENTED_REGISTERED_ALIMTALK_TEMPLATES)

/** 저장소에 등록됨으로 문서화된 코드인가. (Aligo 콘솔 실제 등록은 별개 — 진단 주석 전용) */
export function isDocumentedRegistered(code: string): boolean {
  return _registeredSet.has(code)
}
