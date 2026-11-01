/**
 * 🔔 2026-07-01: 알림톡 템플릿 코드 SSOT (진단용 레지스트리).
 *
 * 배경(전수조사): 카카오 알림톡은 템플릿 코드가 **발송사 콘솔에 사전 등록·승인된 템플릿**이어야
 *   하고, 보낸 본문도 승인된 템플릿 본문과 일치해야 한다. 미등록/불일치면 발송사가 거절한다.
 *   📨 2026-10-12: 발송사 = 네이버 클라우드 SENS(알리고 제거). 템플릿 코드는 등록할 때 **우리가 정한다** —
 *   이 파일의 이름을 그대로 쓴다. 승인되면 어드민 `alimtalk_approved_templates` 에 적어야 나간다(`lib/text-notice.ts`).
 *   문자(SMS) 대체발송은 없다(대표 "문자는 안 쓸거고 카톡만" 2026-10-11).
 *   (인앱 알림/웹푸시는 별개 경로라 대부분 사용자가 완전 무통보는 아님.)
 *
 * 이 파일의 역할:
 *  - 코드베이스가 **사용하는** 모든 platform template 코드 목록(ALL_USED_ALIMTALK_TEMPLATES) — 오타/중복 방지.
 *  - 문서화된(콘솔 등록 대상) 코드(DOCUMENTED_REGISTERED) — `docs/kakao-alimtalk-templates.md` SSOT.
 *  - `isDocumentedRegistered(code)` — 진단(admin)에서 "이 실패가 미등록 템플릿 때문인지" 주석용.
 *
 * ⚠️ 이 목록은 **발송을 막지 않는다**(fail-open). 실제 등록 여부는 SENS 콘솔 + 어드민 승인 목록(운영 사실)이 SSOT이며,
 *   문서가 최신이 아닐 수 있어 하드 게이트로 쓰면 정상 발송을 막을 위험이 있다. 진단/문서 전용.
 *
 * 📌 문안(본문) 전체는 `docs/kakao-alimtalk-templates.md` 에 콘솔 등록형(#{변수})으로 정리됨.
 *   새 알림톡 트리거 추가 시: (1) 여기 ALL_USED 에 코드 추가, (2) docs 에 본문(#{변수}) 추가,
 *   (3) SENS 콘솔에 같은 템플릿 코드 + 같은 본문 등록·승인 → 어드민 `alimtalk_approved_templates` 에 이름 추가.
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

/** 콘솔에 등록됨으로 저장소에 문서화된 코드 (docs/kakao-alimtalk-templates.md). */
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
  //   dispatchNotification templateCode 와 동일 문자열이 SENS 템플릿 코드. (아직 DOCUMENTED 아님 → 진단이 '미등록' 표시)
  'fcfs_selected', 'fcfs_replacement',
  'district_coupon_issued', 'district_coupon_rejected', 'district_coupon_expiring',
  // 🧰 2026-07-19 운영 자동화 백로그 — 콘솔 등록·심사 대기(게이트 뒤: 시퀀스 2종은
  //   OPS_SEQUENCES_ENABLED, 다이제스트는 OPS_DIGEST_ALIMTALK_ENABLED + ops_digest_phone).
  'drop_d1_reminder', 'experience_post_reminder', 'ops_daily_digest',
  // 📣 2026-07-21 크리에이터 잔존 장치 — 추천 링크 판매 시 실시간 적립 알림톡. 콘솔 등록·심사 대기
  //   (게이트 뒤: AFFILIATE_SALE_ALIMTALK_ENABLED). 문안: docs/kakao-alimtalk-templates.md.
  'affiliate_sale_credited',
  // 📨 2026-10-11 이용권 알림 7종을 솔라피에서 옮기며 코드를 붙였다(`lib/text-notice.ts`).
  //   카카오 검수 전엔 보내지 않고, 승인되면 어드민 `alimtalk_approved_templates` 에 적어 알림톡으로 넘긴다.
  //   문안: docs/kakao-alimtalk-templates.md §이용권 알림(2026-10-11).
  'voucher_issued', 'seller_first_voucher', 'seller_voucher_sold', 'seller_voucher_used', 'store_owner_stats_link',
  // 🛍️ 쇼핑 주문 알림(손님에게 — 셀러 크레딧 1건 차감, `features/alimtalk/send.ts`). 2026-10-12 부터
  //   유어딜 채널(SENS)로 나간다 — 종전 셀러 자체 채널 발송(alimtalk-auto · 알리고 전용, 0곳)은 제거됐다.
  'order_confirm', 'shipping_start', 'order_cancel',
  // 📨 2026-10-12 SENS 전환 때 env 코드(`ALIGO_TPL_*` · 'TBD')를 이름으로 고정한 것들.
  'sample_approved', 'store_listed',
  // 🎁 2026-10-31 무상 체험 제공 — 문안 docs/alimtalk-register-list.md §무상 체험(23~29). 등록·승인 전엔 앱 알림만 간다.
  'seeding_request_store', 'seeding_slots_store', 'seeding_approved', 'seeding_rejected',
  'seeding_scheduled', 'seeding_post_reminder', 'seeding_penalty',
] as const

/**
 * 🔕 2026-10-11 대표 "알림톡 안 보내도 되는 것들은 좀 줄여야겠어" — 알림톡(돈 드는 채널)을 **보내지 않는** 코드.
 * 앱 알림·대시보드 벨은 그대로 나간다(공짜). 카카오에 등록하지 않으며, 등록돼도 이 목록이 이긴다.
 *  - voucher_used               손님이 매장에 서 있다 — 방금 일어난 일을 다시 알릴 필요 없음
 *  - seller_voucher_used        사장님 대시보드 벨로 충분
 *  - appointment_user_confirmed 손님이 예약 화면에서 방금 확인했다
 *  - appointment_reminder_seller 새 예약 때 이미 알림톡을 받았다
 *  - store_owner_stats_link     옛 '매장 전용 링크' — 첫 판매 안내(seller_first_voucher)가 같은 일을 한다
 * 다시 켜려면 이 목록에서 지우기만 하면 된다.
 */
export const ALIMTALK_OFF_TEMPLATES: readonly string[] = [
  'voucher_used',
  'seller_voucher_used',
  'appointment_user_confirmed',
  'appointment_reminder_seller',
  'store_owner_stats_link',
] as const

const _offSet = new Set(ALIMTALK_OFF_TEMPLATES)

/** 대표가 알림톡을 끈 코드인가(앱 알림만 나간다). */
export function isAlimtalkOff(code: string): boolean {
  return _offSet.has(code)
}

const _registeredSet = new Set(DOCUMENTED_REGISTERED_ALIMTALK_TEMPLATES)

/** 저장소에 등록됨으로 문서화된 코드인가. (SENS 콘솔 실제 등록은 별개 — 진단 주석 전용) */
export function isDocumentedRegistered(code: string): boolean {
  return _registeredSet.has(code)
}
