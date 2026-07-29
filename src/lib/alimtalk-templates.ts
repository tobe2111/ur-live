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
 * 🧱 서비스 분리: 소비자(유어딜, urdeal.kr)와 도매(유통스타트, utongstart.com)는
 *   **발신 프로필(카카오 채널)이 다르다.** 아래 WHOLESALE 코드는 유통스타트 채널에 등록.
 */

/**
 * 소비자(유어딜) platform 알림톡 코드 — urdeal.kr 발신 프로필.
 * 문안: docs/kakao-alimtalk-templates.md 참조.
 */
export const CONSUMER_ALIMTALK_TEMPLATES: readonly string[] = [
  // 가입·승인 (seller_approved/seller_reactivated · business_registration_verified/rejected —
  //   각 1코드=1본문. 2026-07-01 1코드2문안 분리)
  'seller_registered', 'seller_approved', 'seller_reactivated',
  'agency_registered', 'agency_approved',
  'business_registration_verified', 'business_registration_rejected',
  // 주문·선물·환불
  'new_order', 'gift_received', 'gift_refunded', 'voucher_refunded',
  // 계정 보안
  'seller_bank_changed',
  // 정산·송금·커미션
  'seller_settlement_completed', 'settlement_completed', 'payout_completed',
  'commission_withdrawal_approved', 'commission_withdrawal_rejected',
  'referral_commission_earned',   // 숙소 referral 적립(payment.routes 숙소 경로 — 실발송 확인 2026-07-01)
  // 이용권 사용·만료
  'voucher_used', 'voucher_expire_soon',   // 일반 이용권(비-숙소) 만료 D-30/7/3/1
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
  // 🏙️ 2026-07-05 체험단(FCFS) + 이용권 사용 완료, 🧾 2026-07-13 상권 쿠폰 페이백 — 콘솔 등록·심사
  //   신청 대기(게이트 뒤: district 는 DISTRICT_ALIMTALK_ENABLED + 채널설정). 승인 후 CONSUMER 로 이동.
  //   dispatchNotification templateCode 와 동일 문자열이 Aligo tpl_code. (아직 DOCUMENTED 아님 → 진단이 '미등록' 표시)
  'fcfs_selected', 'fcfs_replacement',
  'district_coupon_issued', 'district_coupon_rejected', 'district_coupon_expiring',
  // 🧰 2026-07-19 운영 자동화 백로그 — 콘솔 등록·심사 대기(게이트 뒤: 시퀀스 2종은
  //   OPS_SEQUENCES_ENABLED, 다이제스트는 OPS_DIGEST_ALIMTALK_ENABLED + ops_digest_phone).
  'drop_d1_reminder', 'experience_post_reminder', 'ops_daily_digest',
  // 📣 2026-07-21 크리에이터 잔존 장치 — 추천 링크 판매 시 실시간 적립 알림톡. 콘솔 등록·심사 대기
  //   (게이트 뒤: AFFILIATE_SALE_ALIMTALK_ENABLED). 문안: docs/kakao-alimtalk-templates.md.
  'affiliate_sale_credited',
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
