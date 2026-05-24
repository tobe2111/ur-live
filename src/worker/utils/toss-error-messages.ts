/**
 * 🛡️ 2026-05-24: Toss V2 코어 API 에러 코드 → 사용자 친화 한국어 메시지 SSOT.
 *
 *   ref: https://docs.tosspayments.com/reference/error-codes
 *
 *   사용:
 *     import { getTossErrorMessage } from './toss-error-messages'
 *     const friendly = getTossErrorMessage(code) ?? fallback
 *
 *   원칙:
 *     1. docs 메시지를 가능한 그대로 (사용자 신뢰도 ↑ + 토스 고객센터 안내와 일치).
 *     2. 운영자가 후속 조치 가이드 필요한 코드는 actionable (suggestedAction).
 *     3. 결제 승인 + 취소 + 카드 + 가상계좌 + 빌링 + 인증 등 모든 시나리오 포함.
 *     4. 새 코드 추가 시 이 파일만 수정 (SSOT).
 *
 *   상태: docs 2026-05-24 기준. 신규 코드는 토스 changelog 모니터링 후 추가.
 */

export interface TossErrorInfo {
  /** 사용자에게 표시할 한국어 메시지. */
  message: string
  /** 후속 조치 카테고리 — UI 가 액션 안내에 사용. */
  category?:
    | 'card_issue'         // 카드 정보/한도/거절 — 다른 카드 시도 안내
    | 'auth'               // 인증/비밀번호 — 재시도 안내
    | 'duplicate'          // 이미 처리/취소된 결제 — idempotent
    | 'merchant_config'    // 가맹점 설정 — 운영자 액션 필요
    | 'system'             // 일시 오류 — 잠시 후 재시도
    | 'limit'              // 한도 초과 — 사용자에게 한도 안내
    | 'invalid_request'    // 잘못된 요청 — client/server 버그
    | 'user_cancel'        // 사용자 명시 취소
    | 'not_found'          // 데이터 없음
    | 'forbidden'          // 권한 없음
    | 'fds'                // FDS (부정거래) — 본인인증 안내
  /** 결제 재시도 권장 여부 — UI 에 '재시도' 버튼 노출 결정. */
  retryable?: boolean
}

const TOSS_ERROR_MAP: Record<string, TossErrorInfo> = {
  // ─── 결제 승인 (POST /v1/payments/confirm) ──────────────────────
  ALREADY_PROCESSED_PAYMENT:
    { message: '이미 처리된 결제입니다.', category: 'duplicate' },
  PROVIDER_ERROR:
    { message: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', category: 'system', retryable: true },
  EXCEED_MAX_CARD_INSTALLMENT_PLAN:
    { message: '설정 가능한 최대 할부 개월 수를 초과했습니다.', category: 'card_issue', retryable: true },
  INVALID_REQUEST:
    { message: '잘못된 요청입니다. 다시 시도해주세요.', category: 'invalid_request' },
  NOT_ALLOWED_POINT_USE:
    { message: '포인트 사용이 불가한 카드입니다. 다른 카드로 시도해주세요.', category: 'card_issue', retryable: true },
  INVALID_API_KEY:
    { message: '결제 시스템 설정 오류 — 관리자에게 문의해주세요.', category: 'merchant_config' },
  INVALID_REJECT_CARD:
    { message: '카드 사용이 거절되었습니다. 카드사에 문의해주세요.', category: 'card_issue', retryable: true },
  BELOW_MINIMUM_AMOUNT:
    { message: '신용카드는 100원 이상, 계좌이체는 200원 이상부터 결제 가능합니다.', category: 'invalid_request' },
  INVALID_CARD_EXPIRATION:
    { message: '카드 유효기간이 올바르지 않습니다.', category: 'card_issue', retryable: true },
  INVALID_STOPPED_CARD:
    { message: '정지된 카드입니다. 다른 카드로 시도해주세요.', category: 'card_issue', retryable: true },
  EXCEED_MAX_DAILY_PAYMENT_COUNT:
    { message: '하루 결제 가능 횟수를 초과했습니다.', category: 'limit' },
  NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT:
    { message: '할부가 지원되지 않는 카드 또는 가맹점입니다.', category: 'card_issue', retryable: true },
  INVALID_CARD_INSTALLMENT_PLAN:
    { message: '할부 개월 정보가 잘못되었습니다.', category: 'card_issue', retryable: true },
  NOT_SUPPORTED_MONTHLY_INSTALLMENT_PLAN:
    { message: '할부가 지원되지 않는 카드입니다.', category: 'card_issue', retryable: true },
  NOT_SUPPORTED_MONTHLY_INSTALLMENT_PLAN_BELOW_AMOUNT:
    { message: '5만원 이하의 결제는 할부가 불가능합니다.', category: 'card_issue', retryable: true },
  EXCEED_MAX_PAYMENT_AMOUNT:
    { message: '하루 결제 가능 금액을 초과했습니다.', category: 'limit' },
  NOT_FOUND_TERMINAL_ID:
    { message: '결제 시스템 설정 오류 — 관리자에게 문의해주세요.', category: 'merchant_config' },
  INVALID_AUTHORIZE_AUTH:
    { message: '유효하지 않은 인증 방식입니다.', category: 'auth' },
  INVALID_CARD_LOST_OR_STOLEN:
    { message: '분실 또는 도난 카드입니다. 카드사에 문의해주세요.', category: 'card_issue' },
  RESTRICTED_TRANSFER_ACCOUNT:
    { message: '계좌는 등록 후 12시간 뒤부터 결제할 수 있습니다.', category: 'card_issue', retryable: true },
  INVALID_CARD_NUMBER:
    { message: '카드 번호가 올바르지 않습니다.', category: 'card_issue', retryable: true },
  INVALID_UNREGISTERED_SUBMALL:
    { message: '결제 시스템 설정 오류 — 관리자에게 문의해주세요.', category: 'merchant_config' },
  NOT_REGISTERED_BUSINESS:
    { message: '등록되지 않은 사업자 번호입니다.', category: 'merchant_config' },
  EXCEED_MAX_ONE_DAY_WITHDRAW_AMOUNT:
    { message: '1일 출금 한도를 초과했습니다.', category: 'limit' },
  EXCEED_MAX_ONE_TIME_WITHDRAW_AMOUNT:
    { message: '1회 출금 한도를 초과했습니다.', category: 'limit' },
  CARD_PROCESSING_ERROR:
    { message: '카드사에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', category: 'card_issue', retryable: true },
  EXCEED_MAX_AMOUNT:
    { message: '거래금액 한도를 초과했습니다.', category: 'limit' },
  INVALID_ACCOUNT_INFO_RE_REGISTER:
    { message: '유효하지 않은 계좌입니다. 계좌를 다시 등록해주세요.', category: 'card_issue' },
  NOT_AVAILABLE_PAYMENT:
    { message: '결제가 불가능한 시간대입니다.', category: 'system' },
  UNAPPROVED_ORDER_ID:
    { message: '아직 승인되지 않은 주문번호입니다.', category: 'invalid_request' },
  EXCEED_MAX_MONTHLY_PAYMENT_AMOUNT:
    { message: '당월 결제 가능 금액(₩1,000,000)을 초과했습니다.', category: 'limit' },

  // 401
  UNAUTHORIZED_KEY:
    { message: '결제 시스템 인증 오류 — 관리자에게 문의해주세요.', category: 'merchant_config' },

  // 403
  REJECT_ACCOUNT_PAYMENT:
    { message: '잔액 부족으로 결제에 실패했습니다.', category: 'card_issue', retryable: true },
  REJECT_CARD_PAYMENT:
    { message: '한도 초과 또는 잔액 부족으로 결제에 실패했습니다.', category: 'card_issue', retryable: true },
  REJECT_CARD_COMPANY:
    { message: '카드사에서 결제 승인을 거절했습니다. 다른 카드로 시도해주세요.', category: 'card_issue', retryable: true },
  FORBIDDEN_REQUEST:
    { message: '허용되지 않은 요청입니다.', category: 'forbidden' },
  REJECT_TOSSPAY_INVALID_ACCOUNT:
    { message: '선택한 출금 계좌가 출금이체 등록이 되어 있지 않습니다. 계좌를 다시 등록해주세요.', category: 'card_issue' },
  EXCEED_MAX_AUTH_COUNT:
    { message: '최대 인증 횟수를 초과했습니다. 카드사로 문의해주세요.', category: 'auth' },
  EXCEED_MAX_ONE_DAY_AMOUNT:
    { message: '일일 한도를 초과했습니다.', category: 'limit' },
  NOT_AVAILABLE_BANK:
    { message: '은행 서비스 시간이 아닙니다.', category: 'system', retryable: true },
  INVALID_PASSWORD:
    { message: '결제 비밀번호가 일치하지 않습니다.', category: 'auth', retryable: true },
  INCORRECT_BASIC_AUTH_FORMAT:
    { message: '결제 시스템 인증 오류 — 관리자에게 문의해주세요.', category: 'merchant_config' },
  FDS_ERROR:
    {
      message: '[토스페이먼츠] 위험거래가 감지되어 결제가 제한됩니다. 발송된 문자에 포함된 링크를 통해 본인인증 후 결제가 가능합니다. (고객센터: 1644-8051)',
      category: 'fds',
    },

  // 404
  NOT_FOUND_PAYMENT:
    { message: '존재하지 않는 결제 정보입니다.', category: 'not_found' },
  NOT_FOUND_PAYMENT_SESSION:
    { message: '결제 시간이 만료되었습니다. 다시 시도해주세요.', category: 'not_found', retryable: true },

  // 500
  FAILED_PAYMENT_INTERNAL_SYSTEM_PROCESSING:
    { message: '결제가 완료되지 않았습니다. 다시 시도해주세요.', category: 'system', retryable: true },
  FAILED_INTERNAL_SYSTEM_PROCESSING:
    { message: '내부 시스템 오류 — 잠시 후 다시 시도해주세요.', category: 'system', retryable: true },
  UNKNOWN_PAYMENT_ERROR:
    { message: '결제에 실패했습니다. 같은 문제가 반복되면 은행이나 카드사로 문의해주세요.', category: 'system' },

  // ─── 결제 취소 (POST /v1/payments/:paymentKey/cancel) ────────────
  ALREADY_CANCELED_PAYMENT:
    { message: '이미 취소된 결제입니다.', category: 'duplicate' },
  INVALID_REFUND_ACCOUNT_INFO:
    { message: '환불 계좌번호와 예금주명이 일치하지 않습니다.', category: 'invalid_request' },
  EXCEED_CANCEL_AMOUNT_DISCOUNT_AMOUNT:
    { message: '즉시할인금액보다 적은 금액은 부분취소가 불가능합니다.', category: 'invalid_request' },
  INVALID_REFUND_ACCOUNT_NUMBER:
    { message: '잘못된 환불 계좌번호입니다.', category: 'invalid_request' },
  INVALID_BANK:
    { message: '유효하지 않은 은행입니다.', category: 'invalid_request' },
  NOT_MATCHES_REFUNDABLE_AMOUNT:
    { message: '환불 금액이 결제 금액과 일치하지 않습니다.', category: 'invalid_request' },
  REFUND_REJECTED:
    { message: '환불이 거절되었습니다. 결제사에 문의 부탁드립니다.', category: 'system' },
  ALREADY_REFUND_PAYMENT:
    { message: '이미 환불된 결제입니다.', category: 'duplicate' },
  FORBIDDEN_BANK_REFUND_REQUEST:
    { message: '고객 계좌가 입금이 되지 않는 상태입니다.', category: 'forbidden' },
  NOT_CANCELABLE_AMOUNT:
    { message: '취소할 수 없는 금액입니다.', category: 'forbidden' },
  FORBIDDEN_CONSECUTIVE_REQUEST:
    { message: '반복적인 요청은 허용되지 않습니다. 잠시 후 다시 시도해주세요.', category: 'system', retryable: true },
  NOT_CANCELABLE_PAYMENT:
    { message: '취소할 수 없는 결제입니다.', category: 'forbidden' },
  EXCEED_MAX_REFUND_DUE:
    { message: '환불 가능한 기간이 지났습니다.', category: 'forbidden' },
  NOT_ALLOWED_PARTIAL_REFUND_WAITING_DEPOSIT:
    { message: '입금 대기중인 결제는 부분 환불이 불가합니다.', category: 'forbidden' },
  NOT_ALLOWED_PARTIAL_REFUND:
    { message: '에스크로 주문, 현금 카드 결제는 부분 환불이 불가합니다.', category: 'forbidden' },
  NOT_CANCELABLE_PAYMENT_FOR_DORMANT_USER:
    { message: '휴면 처리된 회원의 결제는 취소할 수 없습니다.', category: 'forbidden' },
  EXCEED_CANCEL_LIMIT:
    { message: '취소 한도 금액을 초과했습니다.', category: 'limit' },
  FAILED_REFUND_PROCESS:
    { message: '환불 처리 중 일시적 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', category: 'system', retryable: true },
  FAILED_METHOD_HANDLING_CANCEL:
    { message: '취소 중 결제 수단 처리에 오류가 발생했습니다.', category: 'system', retryable: true },
  FAILED_PARTIAL_REFUND:
    { message: '은행 점검 또는 해약 계좌 사유로 부분 환불에 실패했습니다.', category: 'system' },
  COMMON_ERROR:
    { message: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', category: 'system', retryable: true },

  // ─── 카드 번호 결제 / 자동결제 빌링키 ─────────────────────────
  INVALID_CARD_PASSWORD:
    { message: '카드 비밀번호가 올바르지 않습니다.', category: 'auth', retryable: true },
  INVALID_CARD_IDENTITY:
    { message: '입력한 주민번호/사업자번호가 카드 소유주 정보와 일치하지 않습니다.', category: 'auth', retryable: true },
  INVALID_BIRTH_DAY_FORMAT:
    { message: '생년월일 형식이 올바르지 않습니다 (6자리 yyMMdd).', category: 'invalid_request' },
  NOT_SUPPORTED_CARD_TYPE:
    { message: '지원되지 않는 카드 종류입니다.', category: 'card_issue', retryable: true },
  NOT_REGISTERED_CARD_COMPANY:
    { message: '카드를 사용 등록 후 이용해주세요.', category: 'card_issue' },
  INVALID_EMAIL:
    { message: '유효하지 않은 이메일 주소 형식입니다.', category: 'invalid_request' },
  INVALID_REQUIRED_PARAM:
    { message: '필수 파라미터가 누락되었습니다.', category: 'invalid_request' },
  DUPLICATED_ORDER_ID:
    { message: '이미 사용된 주문번호입니다. 다시 시도해주세요.', category: 'duplicate', retryable: true },
  INVALID_ORDER_ID:
    { message: '주문번호 형식이 올바르지 않습니다.', category: 'invalid_request' },
  INVALID_BILL_KEY_REQUEST:
    { message: '빌링키 인증이 완료되지 않았거나 유효하지 않은 빌링 거래입니다.', category: 'auth' },
  NOT_MATCHES_CUSTOMER_KEY:
    { message: '빌링 인증 고객키와 결제 요청 고객키가 일치하지 않습니다.', category: 'auth' },
  FAILED_CARD_COMPANY_RESPONSE:
    { message: '카드사에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', category: 'card_issue', retryable: true },
  FAILED_DB_PROCESSING:
    { message: '시스템 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', category: 'system', retryable: true },

  // ─── 인증/멱등키 헤더 ──────────────────────────────────────────
  INVALID_IDEMPOTENCY_KEY:
    { message: '결제 처리 키가 잘못됐습니다. 새로 결제를 시도해주세요.', category: 'invalid_request' },
  IDEMPOTENT_REQUEST_PROCESSING:
    { message: '이전 결제 요청이 처리 중입니다. 잠시 후 다시 시도해주세요.', category: 'system', retryable: true },

  // ─── 사용자 취소 / Toss 위젯 일반 ─────────────────────────────
  USER_CANCEL:
    { message: '결제가 취소되었습니다.', category: 'user_cancel' },
  PAY_PROCESS_CANCELED:
    { message: '사용자가 결제를 취소했습니다.', category: 'user_cancel' },
  PAY_PROCESS_ABORTED:
    { message: '결제가 진행되지 않았습니다. 다시 시도해주세요.', category: 'user_cancel', retryable: true },

  // ─── 가상계좌 발급 ────────────────────────────────────────────
  INVALID_REGISTRATION_NUMBER_TYPE:
    { message: '유효하지 않은 등록 번호 타입입니다.', category: 'invalid_request' },
  INVALID_DATE:
    { message: '날짜 데이터가 잘못되었습니다.', category: 'invalid_request' },
  EXCEED_MAX_DUE_DATE:
    { message: '가상 계좌의 최대 유효만료 기간을 초과했습니다.', category: 'invalid_request' },

  // ─── 일반 시스템 ──────────────────────────────────────────────
  NOT_FOUND:
    { message: '존재하지 않는 정보입니다.', category: 'not_found' },
  UNKNOWN_ERROR:
    { message: '알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', category: 'system', retryable: true },
}

/**
 * Toss 에러 코드 → 사용자 친화 메시지.
 *   매핑 안 된 코드는 undefined 반환 (caller 가 generic fallback 사용).
 */
export function getTossErrorMessage(code: string | undefined | null): string | undefined {
  if (!code) return undefined
  return TOSS_ERROR_MAP[code]?.message
}

/**
 * Toss 에러 코드 → 전체 정보 (message + category + retryable).
 *   UI 가 '재시도' 버튼 노출 결정, 또는 운영자가 후속 액션 카테고리 분류에 사용.
 */
export function getTossErrorInfo(code: string | undefined | null): TossErrorInfo | undefined {
  if (!code) return undefined
  return TOSS_ERROR_MAP[code]
}
