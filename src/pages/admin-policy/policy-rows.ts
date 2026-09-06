/**
 * 📖 2026-08-01 (대표: "/admin/policy 여기도 최신화해줘. **항상** 여긴 최신화가 되어야 해")
 *
 * 이 대시보드는 `src/shared/constants/policy.ts` 를 사람이 읽게 옮겨 적는 화면이다. 그런데 옮겨 적는
 * 일은 **반드시 밀린다** — 실측 결과 policy.ts 가 선언한 8개 그룹 중 **4개(HOSTING/WITHDRAWAL/
 * SHIPPING/CURATOR)가 화면에 아예 없었고**, COMMISSION_DEFAULTS 안에서도 3개 키
 * (INFLUENCER_STORE_INTRO_PCT · CURATOR_AFFILIATE_PCT 등)가 빠져 있었다.
 * 빠져도 에러가 안 나니 아무도 모른다.
 *
 * 그래서 "최신화"를 사람 약속이 아니라 **가드**로 바꾼다:
 *   행 정의를 이 파일 한 곳에 모으고 → `policy-dashboard-sync.test.ts` 가 policy.ts 의 **모든 키**가
 *   여기 있는지 대조한다. 상수를 추가하고 이 표를 안 고치면 CI 가 빨간불.
 *
 * ⚠️ 이 가드가 **못 막는 것**: 설명 문구가 낡는 것(값은 자동으로 따라오지만 `desc` 는 사람이 쓴다).
 *    그리고 policy.ts 밖의 정책(platform_settings 동적 값)은 여기 대상이 아니다 — 그건 페이지가
 *    별도로 API 에서 읽어 "현재 적용값"으로 겹쳐 보여 준다.
 */
import {
  REFUND_POLICY,
  COMMISSION_DEFAULTS,
  HOSTING_DEFAULTS,
  WITHDRAWAL_DEFAULTS,
  SHIPPING_DEFAULTS,
  CURATOR_DEFAULTS,
  TAX_POLICY,
  TIME_CONSTANTS,
  WITHHOLDING_RATES,
} from '@/shared/constants/policy'

export interface PolicyRow {
  key: string
  value: string | number
  unit?: string
  desc?: string
  /** platform_settings 로 어드민이 덮어쓸 수 있는 값 — 페이지가 현재 적용값을 겹쳐 표시 */
  dynamicKey?: 'platform_fee_pct' | 'seller_commission_pct' | 'influencer_intro_share_pct'
  /** 영구 중단된 기능의 상수 — 값은 남아 있지만 지금 아무 동작도 하지 않음을 화면에 밝힌다 */
  retired?: string
}

export interface PolicySection {
  /** policy.ts 의 export 이름 — 가드가 이 이름으로 대조한다 */
  source: string
  title: string
  rows: PolicyRow[]
  /**
   * 이 표의 값들이 **오늘 실제로 그렇게 동작하는가**에 대한 경고. 표 위에 그대로 뜬다.
   * 상수는 policy.ts 에만 있어야 하므로(유령 키 가드), "표에 없는 사실"은 행이 아니라 여기에 적는다.
   */
  note?: string
}

const pct = (n: number) => n
const fmtList = (o: Record<string, number>) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(' / ')

export const POLICY_SECTIONS: PolicySection[] = [
  {
    source: 'REFUND_POLICY',
    title: '① REFUND_POLICY — 환불 / 만료 / 분쟁 / 출금',
    rows: [
      { key: 'APPOINTMENT_NOSHOW_ALERT_MIN', value: REFUND_POLICY.APPOINTMENT_NOSHOW_ALERT_MIN, unit: '분', desc: '예약 노쇼 자동 알림 — 시작 후 N분' },
      { key: 'APPOINTMENT_CANCEL_DEADLINE_HOURS', value: REFUND_POLICY.APPOINTMENT_CANCEL_DEADLINE_HOURS, unit: '시간', desc: '예약 취소 환불 마감 (시작 N시간 이내 = 환불 X)' },
      { key: 'VOUCHER_REFUND_AFTER_EXPIRY_DAYS', value: REFUND_POLICY.VOUCHER_REFUND_AFTER_EXPIRY_DAYS, unit: '일', desc: '만료 이용권 자동 환불 마감' },
      { key: 'VOUCHER_ARCHIVE_AFTER_EXPIRY_DAYS', value: REFUND_POLICY.VOUCHER_ARCHIVE_AFTER_EXPIRY_DAYS, unit: '일', desc: '미사용 이용권 만료 후 archive' },
      { key: 'DISPUTE_ESCALATION_HOURS', value: REFUND_POLICY.DISPUTE_ESCALATION_HOURS, unit: '시간', desc: '분쟁 미처리 → admin escalation' },
      { key: 'DISPUTE_REPEAT_STORE_THRESHOLD', value: REFUND_POLICY.DISPUTE_REPEAT_STORE_THRESHOLD, unit: '건', desc: '30일 분쟁 N건+ → 재발 매장 경고' },
      { key: 'DISPUTE_REPEAT_USER_THRESHOLD', value: REFUND_POLICY.DISPUTE_REPEAT_USER_THRESHOLD, unit: '건', desc: '30일 분쟁 N건+ → 어뷰징 의심' },
      { key: 'TOSS_REFUND_MAX_RETRY', value: REFUND_POLICY.TOSS_REFUND_MAX_RETRY, unit: '회', desc: '토스 환불 재시도 최대 (exponential backoff)' },
      { key: 'COMMISSION_MIN_WITHDRAWAL', value: REFUND_POLICY.COMMISSION_MIN_WITHDRAWAL, unit: '원', desc: '최소 출금 금액' },
    ],
  },
  {
    source: 'COMMISSION_DEFAULTS',
    note:
      '🩸 채널 요율(직접 등록 10% / 중개 5%)은 코드에 있지만 **지금 청구되지 않는다** — 결제 분배는 ' +
      '`getSellerCommissionRate`(채널을 안 본다: 매장별 수동 → GMV 티어 → 기본 5%)를 쓰고, 채널 요율 경로는 ' +
      '게이트 `fee_channel_rates_enabled` 뒤인데 미설정(꺼짐)이다. 켜는 것은 머니 경로라 staging 실결제가 필요하다.',
    title: '② COMMISSION_DEFAULTS — 수수료율 (% 단위)',
    rows: [
      { key: 'PLATFORM_FEE_PCT', value: pct(COMMISSION_DEFAULTS.PLATFORM_FEE_PCT), unit: '%', desc: '플랫폼 fee (어드민 조정 가능)', dynamicKey: 'platform_fee_pct' },
      { key: 'SELLER_COMMISSION_PCT', value: pct(COMMISSION_DEFAULTS.SELLER_COMMISSION_PCT), unit: '%', desc: '위탁 셀러 commission', dynamicKey: 'seller_commission_pct' },
      { key: 'INFLUENCER_INTRO_SHARE_PCT', value: pct(COMMISSION_DEFAULTS.INFLUENCER_INTRO_SHARE_PCT), unit: '%', desc: '인플 입점 분배 (platform_fee 중)', dynamicKey: 'influencer_intro_share_pct' },
      // ⚠️ 아래 둘은 `platform_settings`(influencer_store_intro_pct / _months) 행이 있으면 **그 값이 우선**한다.
      //   이 표는 코드 기본값이라 라이브와 다를 수 있다 — dynamicKey 를 못 붙이는 건 겹쳐 보여 줄 소스인
      //   `/api/admin/payouts/commission-rates` 가 4개 키만 돌려주기 때문이다(넓히려면 서버부터).
      { key: 'INFLUENCER_STORE_INTRO_PCT', value: pct(COMMISSION_DEFAULTS.INFLUENCER_STORE_INTRO_PCT), unit: '%', desc: '매장 영입(소개) — 그 매장 매 결제마다. T+7 성숙 후 원천징수 차감 송금 · 라이브 값은 어드민 설정 우선' },
      { key: 'INFLUENCER_STORE_INTRO_MONTHS', value: String(COMMISSION_DEFAULTS.INFLUENCER_STORE_INTRO_MONTHS), unit: '개월', desc: '위 영입 커미션 유효기간 — 영입일(introduced_at) 기산. 매장별 referral_bonus_until 이 있으면 그 값 우선' },
      { key: 'CURATOR_AFFILIATE_PCT', value: pct(COMMISSION_DEFAULTS.CURATOR_AFFILIATE_PCT), unit: '%', desc: '유어샵 큐레이터 어필리에이트' },
      { key: 'AFFILIATE_COMMISSION_PCT', value: pct(COMMISSION_DEFAULTS.AFFILIATE_COMMISSION_PCT), unit: '%', desc: '제휴 마케팅 (쿠팡파트너스형) 추천인 보상' },
      { key: 'REFERRAL_BONUS_BOTHSIDES_PCT', value: pct(COMMISSION_DEFAULTS.REFERRAL_BONUS_BOTHSIDES_PCT), unit: '%', desc: '공구 양쪽 보너스 (추천인 + 피추천인)' },
      { key: 'STAYS_COMMISSION_CAP_PCT', value: pct(COMMISSION_DEFAULTS.STAYS_COMMISSION_CAP_PCT), unit: '%', desc: '숙박 카테고리 commission 상한' },
      { key: 'TIER_COMMISSION_BONUS', value: fmtList(COMMISSION_DEFAULTS.TIER_COMMISSION_BONUS), unit: '%', desc: '셀러 등급별 보너스' },
    ],
  },
  {
    source: 'HOSTING_DEFAULTS',
    title: '③ HOSTING_DEFAULTS — 공구 호스팅(내가 여는 공구)',
    rows: [
      { key: 'HOST_INCENTIVE_PCT', value: HOSTING_DEFAULTS.HOST_INCENTIVE_PCT, unit: '%', desc: '호스트 인센티브' },
      { key: 'MAX_ACTIVE_HOSTINGS', value: HOSTING_DEFAULTS.MAX_ACTIVE_HOSTINGS, unit: '건', desc: '1인 동시 진행 가능 공구 수' },
      { key: 'DEFAULT_DEADLINE_DAYS', value: HOSTING_DEFAULTS.DEFAULT_DEADLINE_DAYS, unit: '일', desc: '기본 마감 기한' },
      { key: 'MIN_TARGET', value: HOSTING_DEFAULTS.MIN_TARGET, unit: '명', desc: '최소 목표 인원' },
      { key: 'MAX_TARGET', value: HOSTING_DEFAULTS.MAX_TARGET, unit: '명', desc: '최대 목표 인원' },
      { key: 'NOTE_MAX_LEN', value: HOSTING_DEFAULTS.NOTE_MAX_LEN, unit: '자', desc: '호스트 메모 길이 제한' },
      { key: 'INVITE_CODE_LEN', value: HOSTING_DEFAULTS.INVITE_CODE_LEN, unit: '자', desc: '초대 코드 길이' },
    ],
  },
  {
    source: 'WITHDRAWAL_DEFAULTS',
    title: '④ WITHDRAWAL_DEFAULTS — 출금 / 셀러 승격',
    rows: [
      { key: 'MIN_AMOUNT', value: WITHDRAWAL_DEFAULTS.MIN_AMOUNT, unit: '원', desc: '최소 출금 금액' },
      { key: 'SELLER_UPGRADE_THRESHOLD', value: WITHDRAWAL_DEFAULTS.SELLER_UPGRADE_THRESHOLD, unit: '원', desc: '이 누적을 넘으면 셀러 전환 제안' },
      { key: 'UPGRADE_REOFFER_DAYS', value: WITHDRAWAL_DEFAULTS.UPGRADE_REOFFER_DAYS, unit: '일', desc: '전환 제안 거절 후 재제안 간격' },
    ],
  },
  {
    source: 'SHIPPING_DEFAULTS',
    title: '⑤ SHIPPING_DEFAULTS — 배송비 / 배송 추적',
    rows: [
      { key: 'JEJU_EXTRA_FEE', value: SHIPPING_DEFAULTS.JEJU_EXTRA_FEE, unit: '원', desc: '제주 추가 배송비' },
      { key: 'ISLAND_EXTRA_FEE', value: SHIPPING_DEFAULTS.ISLAND_EXTRA_FEE, unit: '원', desc: '도서산간 추가 배송비' },
      { key: 'AUTO_DELIVERED_AFTER_DAYS', value: SHIPPING_DEFAULTS.AUTO_DELIVERED_AFTER_DAYS, unit: '일', desc: '발송 후 자동 배송완료 처리' },
      { key: 'TRACKER_SYNC_INTERVAL_HOURS', value: SHIPPING_DEFAULTS.TRACKER_SYNC_INTERVAL_HOURS, unit: '시간', desc: '운송장 동기화 주기' },
      { key: 'TRACKER_DELIVERY_API', value: SHIPPING_DEFAULTS.TRACKER_DELIVERY_API, desc: '배송 추적 API 엔드포인트' },
      { key: 'TRACKER_SYNC_BATCH_SIZE', value: SHIPPING_DEFAULTS.TRACKER_SYNC_BATCH_SIZE, unit: '건', desc: '1회 동기화 배치 크기' },
      { key: 'TRACKER_SYNC_MIN_INTERVAL_MIN', value: SHIPPING_DEFAULTS.TRACKER_SYNC_MIN_INTERVAL_MIN, unit: '분', desc: '같은 운송장 재조회 최소 간격' },
      { key: 'ENABLE_BUNDLING', value: String(SHIPPING_DEFAULTS.ENABLE_BUNDLING), desc: '동일 셀러 묶음배송 활성' },
    ],
  },
  {
    source: 'CURATOR_DEFAULTS',
    title: '⑥ CURATOR_DEFAULTS — 유어샵(핸들 · 핀)',
    rows: [
      { key: 'HANDLE_MIN_LEN', value: CURATOR_DEFAULTS.HANDLE_MIN_LEN, unit: '자', desc: '핸들 최소 길이' },
      { key: 'HANDLE_MAX_LEN', value: CURATOR_DEFAULTS.HANDLE_MAX_LEN, unit: '자', desc: '핸들 최대 길이' },
      { key: 'HANDLE_PATTERN', value: String(CURATOR_DEFAULTS.HANDLE_PATTERN), desc: '허용 문자(소문자·숫자·밑줄)' },
      { key: 'HANDLE_RESERVED', value: `${CURATOR_DEFAULTS.HANDLE_RESERVED.length}개 예약어`, desc: 'admin·api 등 시스템 예약 핸들' },
      { key: 'PIN_MAX_PER_USER', value: CURATOR_DEFAULTS.PIN_MAX_PER_USER, unit: '개', desc: '1인 최대 핀 개수' },
      { key: 'PIN_NOTE_MAX_LEN', value: CURATOR_DEFAULTS.PIN_NOTE_MAX_LEN, unit: '자', desc: '핀 메모 길이 제한' },
      { key: 'HANDLE_CHANGE_COOLDOWN_DAYS', value: CURATOR_DEFAULTS.HANDLE_CHANGE_COOLDOWN_DAYS, unit: '일', desc: '핸들 변경 쿨다운' },
      { key: 'BIO_MAX_LEN', value: CURATOR_DEFAULTS.BIO_MAX_LEN, unit: '자', desc: '소개 길이 제한' },
      { key: 'STATS_DEFAULT_RANGE_DAYS', value: CURATOR_DEFAULTS.STATS_DEFAULT_RANGE_DAYS, unit: '일', desc: '통계 기본 조회 범위' },
      { key: 'REF_COOKIE_TTL_HOURS', value: CURATOR_DEFAULTS.REF_COOKIE_TTL_HOURS, unit: '시간', desc: '추천 attribution 쿠키 TTL' },
    ],
  },
  {
    source: 'TAX_POLICY',
    title: '⑦ TAX_POLICY — 원천징수율 (한국 세법 고정)',
    rows: [
      { key: 'BUSINESS_INCOME_RATE', value: (WITHHOLDING_RATES.business_income * 100).toFixed(1), unit: '%', desc: '사업소득 (반복 활동 — 대부분 인플)' },
      { key: 'OTHER_INCOME_RATE', value: (WITHHOLDING_RATES.other_income * 100).toFixed(1), unit: '%', desc: '기타소득 (단발성 협업)' },
      { key: 'OTHER_INCOME_THRESHOLD', value: TAX_POLICY.OTHER_INCOME_THRESHOLD, unit: '원/년', desc: '기타소득 연 누계 분리과세 한도' },
    ],
  },
  {
    source: 'TIME_CONSTANTS',
    title: '⑧ TIME_CONSTANTS — 폴링 / dedup / threshold',
    rows: [
      { key: 'ALERT_DEDUP_DEFAULT_SEC', value: TIME_CONSTANTS.ALERT_DEDUP_DEFAULT_SEC, unit: '초', desc: 'Discord/Slack alert 중복 dedup window' },
      { key: 'YOUTUBE_LIVE_POLL_SEC', value: TIME_CONSTANTS.YOUTUBE_LIVE_POLL_SEC, unit: '초', desc: 'YouTube 라이브 status 폴링', retired: '라이브커머스 영구 중단 — 현재 동작 안 함' },
      { key: 'LIVE_IMMINENT_THRESHOLD_SEC', value: TIME_CONSTANTS.LIVE_IMMINENT_THRESHOLD_SEC, unit: '초', desc: '라이브 임박 알림 threshold', retired: '라이브커머스 영구 중단 — 현재 동작 안 함' },
      { key: 'PWA_DISMISS_DAYS', value: TIME_CONSTANTS.PWA_DISMISS_DAYS, unit: '일', desc: 'PWA 설치 prompt dismiss 만료' },
      { key: 'REFERRAL_ATTRIBUTION_HOURS', value: TIME_CONSTANTS.REFERRAL_ATTRIBUTION_HOURS, unit: '시간', desc: '추천 attribution sessionStorage TTL' },
      { key: 'RATE_LIMIT_WINDOW_SEC', value: TIME_CONSTANTS.RATE_LIMIT_WINDOW_SEC, unit: '초', desc: 'rate_limit_attempts window' },
      { key: 'ERROR_SPIKE_THRESHOLD', value: TIME_CONSTANTS.ERROR_SPIKE_THRESHOLD, unit: '건/분', desc: '5xx 스파이크 detection threshold' },
    ],
  },
]
