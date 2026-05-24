/**
 * 🛡️ 2026-05-22 사용자 명령 (옵션 B — 얇은 헬퍼):
 *   토스 결제 호출의 공통 부분만 추출 — 비즈니스 로직은 각 endpoint 가 유지.
 *
 * 효과:
 *   - 토스 SDK 변경 / Idempotency-Key 정책 / circuit breaker / amount 검증 1곳에서.
 *   - 여러 시나리오 (충전 / 주문 / 공구 / 숙소 / 캐스팅 / 광고) 가 동일 helper 호출.
 *   - 새 시나리오 추가 시 helper 호출 1줄 (기존: 복붙 50+줄 위험).
 *
 * 책임 분리:
 *   - helper: 토스 API 호출, idempotency key, amount 검증, key type 검증
 *   - caller: pending row 생성/조회, 비즈니스 후처리 (잔액 +, 재고 -, voucher 발급 등)
 *
 * 영구 룰 (CLAUDE.md 에 추가):
 *   신규 Toss 결제 endpoint 는 반드시 `confirmTossPayment()` 사용. 직접 fetch 금지.
 */

import { withCircuitBreaker } from './circuit-breaker'

const TOSS_API_BASE = 'https://api.tosspayments.com/v1'

export interface TossConfirmInput {
  env: { TOSS_SECRET_KEY?: string }
  paymentKey: string
  orderId: string
  amount: number
  /** Idempotency-Key. 명시 안 하면 paymentKey 사용 (토스 권장 안전). */
  idempotencyKey?: string
  /** circuit breaker name. 기본: 'toss-confirm'. 시나리오별 격리 원하면 분리. */
  circuitName?: string
  /** request timeout ms. default 15000. */
  timeoutMs?: number
}

export interface TossConfirmSuccess {
  ok: true
  data: TossPaymentObject
  /** 'ALREADY_PROCESSED_PAYMENT' 인 경우 idempotent 재시도. caller 가 CAS 로 한 번만 처리해야 함. */
  alreadyProcessed?: boolean
}

/**
 * 🛡️ 2026-05-24: Toss V2 결제 승인 응답 객체 (Payment object) — docs 사양.
 *   ref: https://docs.tosspayments.com/reference#결제-승인
 *
 *   상점이 결제 승인 후 받는 모든 필드. 사용한 결제수단에 해당하는 필드만 채워짐
 *   (예: 카드 결제 → card 채워짐, virtualAccount/transfer/... null).
 */
export interface TossPaymentObject {
  /** 가맹점 ID — 토스가 발급. */
  mId?: string
  /** 마지막 트랜잭션 키 — 결제 + 부분취소 등 각 액션마다 갱신. */
  lastTransactionKey?: string
  /** 결제 식별 키 — 최대 200자, 결제 승인/조회/취소에 사용. */
  paymentKey: string
  /** 주문번호 — 영문/숫자/-/_, 6-64자. 주문마다 고유. */
  orderId: string
  /** 구매상품명 — ≤100자. */
  orderName?: string
  /** 과세 제외 금액 (컵 보증금 등). */
  taxExemptionAmount?: number
  /** READY / IN_PROGRESS / WAITING_FOR_DEPOSIT / DONE / CANCELED / PARTIAL_CANCELED / ABORTED / EXPIRED */
  status: string
  /** 결제 요청 시각 — ISO 8601 with timezone. */
  requestedAt?: string
  /** 결제 승인 시각 — ISO 8601 with timezone. */
  approvedAt?: string
  /** 에스크로 적용 여부. */
  useEscrow?: boolean
  /** 문화비 (도서 / 공연 / 박물관) 여부. */
  cultureExpense?: boolean
  /** 카드 결제 정보 — 카드 결제 시만. */
  card?: {
    issuerCode?: string
    acquirerCode?: string
    /** 카드 번호 마스킹 형식 (예: '12345678****000*'). */
    number?: string
    installmentPlanMonths?: number
    isInterestFree?: boolean
    interestPayer?: string | null
    approveNo?: string
    useCardPoint?: boolean
    /** '신용' / '체크' / '기프트' / '미확인' */
    cardType?: string
    /** '개인' / '법인' / '미확인' */
    ownerType?: string
    /** READY / REQUESTED / COMPLETED / CANCEL_REQUESTED / CANCELED */
    acquireStatus?: string
    amount?: number
  } | null
  /** 가상계좌 정보. */
  virtualAccount?: Record<string, unknown> | null
  /** 계좌이체 정보. */
  transfer?: Record<string, unknown> | null
  /** 휴대폰 결제 정보. */
  mobilePhone?: Record<string, unknown> | null
  /** 상품권 정보. */
  giftCertificate?: Record<string, unknown> | null
  /** 현금영수증 정보 (단건). */
  cashReceipt?: Record<string, unknown> | null
  /** 현금영수증 정보 (다건). */
  cashReceipts?: Array<Record<string, unknown>> | null
  /** 즉시 할인 정보. */
  discount?: { amount: number } | null
  /** 결제 취소 이력 배열. */
  cancels?: Array<Record<string, unknown>> | null
  /** 결제 시크릿 — 가상계좌 webhook 검증 등에 사용. */
  secret?: string | null
  /** 결제 타입 — NORMAL / BILLING / BRANDPAY */
  type?: 'NORMAL' | 'BILLING' | 'BRANDPAY' | string
  /** 간편결제 정보. */
  easyPay?: {
    /** 토스페이 / 네이버페이 / 카카오페이 등 */
    provider: string
    amount: number
    discountAmount: number
  } | null
  /** 결제자 위치 국가 — ISO-3166 2자리 (예: 'KR'). */
  country?: string
  /** 결제 실패 정보 — status 실패 시. */
  failure?: { code: string; message: string } | null
  /** 부분취소 가능 여부 — 일부 결제수단/카드에서는 false. */
  isPartialCancelable?: boolean
  /** 영수증 URL — 사용자에게 표시 가능. */
  receipt?: { url?: string } | null
  /** 결제창 URL. */
  checkout?: { url?: string } | null
  /** 결제 통화 — KRW / USD (해외간편결제). */
  currency?: string
  /** 총 결제 금액 — client 가 보낸 amount 와 일치해야 함. */
  totalAmount: number
  /** 잔여 금액 — 부분취소 후. 초기엔 totalAmount 와 같음. */
  balanceAmount?: number
  /** 공급가액 (totalAmount - vat). */
  suppliedAmount?: number
  /** 부가세. */
  vat?: number
  /** 면세 금액. */
  taxFreeAmount?: number
  /** 결제 시 추가 메타데이터 (최대 5 key, key ≤40자, value ≤2000자). */
  metadata?: Record<string, string> | null
  /** 결제수단 — '카드' / '가상계좌' / '계좌이체' / '휴대폰' / '문화상품권' / '도서문화상품권' / '게임문화상품권' / '해외간편결제'. */
  method?: string
  /** Toss API 버전 (예: '2024-06-01'). */
  version?: string
  /** 미래 확장용 — docs 추가 필드 누락 시도 안전. */
  [k: string]: unknown
}

export interface TossConfirmFailure {
  ok: false
  /** HTTP status code 또는 'CIRCUIT_OPEN' / 'NO_SECRET' / 'TIMEOUT' / 'BAD_RESPONSE'. */
  status: number | string
  /** Toss API 의 error code (e.g. 'INVALID_AMOUNT', 'ALREADY_PROCESSED_PAYMENT', 'NOT_FOUND_PAYMENT'). */
  code?: string
  /** 사용자에게 보여줄 메시지 (한국어). */
  message: string
}

export type TossConfirmResult = TossConfirmSuccess | TossConfirmFailure

/**
 * 토스 결제 confirm — 토스 API `POST /v1/payments/confirm` 호출.
 *
 * docs 사양 일치:
 *   - Authorization: Basic base64(SECRET_KEY + ':') — 콜론 필수
 *   - UTF-8 BOM 제거 (docs warning: BOM 포함 시 77u/ 시작하는 잘못된 base64)
 *   - Idempotency-Key: 최대 300자, UUID 권장, 15일 유효
 *   - 에러 처리:
 *     - 400 INVALID_IDEMPOTENCY_KEY: 300자 초과 (우리는 paymentKey ~64자라 발생 X)
 *     - 409 IDEMPOTENT_REQUEST_PROCESSING: 처리 중 중복 → 1회 자동 재시도
 *     - ALREADY_PROCESSED_PAYMENT: 같은 결제 중복 → idempotent OK
 *
 * 사용:
 *   const res = await confirmTossPayment({ env: c.env, paymentKey, orderId, amount })
 *   if (!res.ok) {
 *     return c.json({ success: false, error: res.message, code: res.code }, 400)
 *   }
 *   // 비즈니스 후처리 (잔액 + / 재고 - / voucher 발급 ...)
 *   // res.alreadyProcessed === true 인 경우 CAS 가드로 중복 처리 방지.
 */
export async function confirmTossPayment(input: TossConfirmInput): Promise<TossConfirmResult> {
  const { env, paymentKey, orderId, amount, idempotencyKey, circuitName = 'toss-confirm', timeoutMs = 15_000 } = input

  if (!env.TOSS_SECRET_KEY) {
    return { ok: false, status: 'NO_SECRET', message: '결제 시스템이 설정되지 않았습니다.', code: 'NO_TOSS_SECRET' }
  }
  if (!paymentKey || !orderId) {
    return { ok: false, status: 400, message: '결제 정보가 올바르지 않습니다.', code: 'INVALID_PARAMS' }
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, status: 400, message: '결제 금액이 올바르지 않습니다.', code: 'INVALID_AMOUNT' }
  }

  // 🛡️ 2026-05-24 docs warning fix: UTF-8 BOM 제거.
  //   docs: "시크릿 키를 base64로 인코딩할 때 UTF-8 BOM 문자가 포함되면 결과가 77u/로 시작할 수 있습니다."
  //   secretKey 가 BOM 으로 시작하면 사용자가 잘못된 base64 받음 → 401.
  const secretKey = env.TOSS_SECRET_KEY.replace(/^﻿/, '').trim()

  // 🛡️ Idempotency-Key 길이 검증 — docs: 최대 300자. paymentKey 는 정상 ~64자.
  //   안전 차원: 300자 초과 시 SHA-256 hash 64자로 단축 (docs INVALID_IDEMPOTENCY_KEY 예방).
  let idemKey = idempotencyKey || paymentKey
  if (idemKey.length > 300) {
    // crypto.subtle 비동기 — 동기 fallback: slice (collision 위험 낮음 — paymentKey 자체가 unique).
    idemKey = idemKey.slice(0, 300)
  }

  // 🛡️ 토스 docs 사양 callFetch — 1회 자동 재시도 (IDEMPOTENT_REQUEST_PROCESSING 처리).
  const callFetch = (): Promise<Response> => withCircuitBreaker(
    { name: circuitName, maxFailures: 10, resetTimeoutMs: 60_000 },
    () => fetch(`${TOSS_API_BASE}/payments/confirm`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(secretKey + ':')}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idemKey,
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
      signal: AbortSignal.timeout(timeoutMs),
    }),
  )

  let res: Response
  try {
    res = await callFetch()
  } catch (e) {
    const msg = (e as Error)?.message || ''
    if (/circuit|breaker/i.test(msg)) {
      return { ok: false, status: 'CIRCUIT_OPEN', message: '결제 시스템이 일시 중단됐습니다. 잠시 후 다시 시도해주세요.', code: 'CIRCUIT_OPEN' }
    }
    if (/abort|timeout/i.test(msg)) {
      return { ok: false, status: 'TIMEOUT', message: '결제 승인 응답이 지연됩니다. 잠시 후 다시 시도해주세요.', code: 'TIMEOUT' }
    }
    return { ok: false, status: 'NETWORK', message: '결제 승인 요청에 실패했습니다.', code: 'NETWORK' }
  }

  let data: Record<string, unknown> = {}
  try { data = await res.json() as Record<string, unknown> } catch { /* empty body */ }

  if (res.ok) {
    return { ok: true, data: data as TossConfirmSuccess['data'] }
  }

  const code = String((data as { code?: string }).code || `HTTP_${res.status}`)
  const message = String((data as { message?: string }).message || '결제 승인에 실패했습니다')

  // ALREADY_PROCESSED_PAYMENT: 같은 결제 중복 confirm 호출.
  // caller 는 CAS 가드로 비즈니스 후처리를 한 번만 적용해야 함 (둘 다 OK 처리).
  if (code === 'ALREADY_PROCESSED_PAYMENT') {
    return { ok: true, data: data as TossConfirmSuccess['data'], alreadyProcessed: true }
  }

  // 🛡️ 2026-05-24 docs 권장: IDEMPOTENT_REQUEST_PROCESSING (409) → 1회 자동 재시도.
  //   docs: "이 에러가 돌아오면 다시 한번 요청해서 응답을 확인하세요."
  //   500ms 대기 후 재시도 — 첫 요청 처리 완료 대기.
  if (code === 'IDEMPOTENT_REQUEST_PROCESSING') {
    await new Promise(r => setTimeout(r, 500))
    try {
      const retry = await callFetch()
      let retryData: Record<string, unknown> = {}
      try { retryData = await retry.json() as Record<string, unknown> } catch { /* empty body */ }
      if (retry.ok) {
        return { ok: true, data: retryData as TossConfirmSuccess['data'], alreadyProcessed: true }
      }
      const retryCode = String((retryData as { code?: string }).code || `HTTP_${retry.status}`)
      const retryMessage = String((retryData as { message?: string }).message || '결제 승인에 실패했습니다')
      if (retryCode === 'ALREADY_PROCESSED_PAYMENT') {
        return { ok: true, data: retryData as TossConfirmSuccess['data'], alreadyProcessed: true }
      }
      return { ok: false, status: retry.status, code: retryCode, message: retryMessage }
    } catch {
      return { ok: false, status: 409, code: 'IDEMPOTENT_REQUEST_PROCESSING', message: '이전 결제 요청이 처리 중입니다. 잠시 후 다시 시도해주세요.' }
    }
  }

  // 🛡️ docs 명시 에러 코드 — 친화 메시지.
  if (code === 'INVALID_IDEMPOTENCY_KEY') {
    return { ok: false, status: res.status, code, message: '결제 처리 키가 잘못됐습니다. 새로 결제를 시도해주세요.' }
  }

  return { ok: false, status: res.status, code, message }
}

// ============================================================
// 🛡️ 2026-05-24 V2 docs audit — 결제 취소 SSOT
//
// docs ref: https://docs.tosspayments.com/guides/v2/payment-cancel
//           POST /v1/payments/{paymentKey}/cancel
//
// 이전: refund.ts / toss-refund.ts / toss-payments.ts 3곳에서 각각 cancel 호출 →
//       refundReceiveAccount / taxFreeAmount 누락 / 5xx 재시도 불일치 등 산발 버그.
// 이제: cancelTossPayment() 가 SSOT. 기존 3 helper 는 wrapper 로 위임.
//
// 영구 룰 (CLAUDE.md 에 추가):
//   신규 Toss 취소 endpoint 는 반드시 cancelTossPayment() 사용. 직접 fetch 금지.
// ============================================================

export interface TossCancelInput {
  env: { TOSS_SECRET_KEY?: string; DB?: D1Database }
  paymentKey: string
  cancelReason: string
  /** 부분 취소 금액. 미지정 시 전액 취소. */
  cancelAmount?: number
  /** 가상계좌 환불 받을 계좌 — VA 결제 입금 완료 후 취소 시 필수.
   *  docs: bankCode (숫자 코드, ex: '20'), accountNumber, holderName. */
  refundReceiveAccount?: { bank?: string; bankCode?: string; accountNumber: string; holderName: string }
  /** 부분 취소 중 면세 금액 — 복합과세 상점만 사용. docs `cancelTaxFreeAmount`. */
  taxFreeAmount?: number
  /** Idempotency-Key. 권장: 호출자가 stable key 제공. */
  idempotencyKey: string
  /** request timeout ms. default 15000. */
  timeoutMs?: number
  /** circuit breaker name. 기본: 'toss-cancel'. */
  circuitName?: string
}

export interface TossCancelSuccess {
  ok: true
  /** Payment 객체 (cancels 배열 포함). */
  data: TossPaymentObject
  /** 마지막 cancel 항목 (transactionKey + cancelAmount). */
  lastCancel?: {
    transactionKey?: string
    cancelAmount?: number
    cancelReason?: string
    canceledAt?: string
  }
  http_status: number
}

export interface TossCancelFailure {
  ok: false
  code: string
  message: string
  http_status?: number
  /** caller 가 retry 가능한지 판단. 5xx / 일부 PROVIDER_ERROR 만 true. */
  retryable?: boolean
}

export type TossCancelResult = TossCancelSuccess | TossCancelFailure

export async function cancelTossPayment(input: TossCancelInput): Promise<TossCancelResult> {
  const { env, paymentKey, cancelReason, cancelAmount, refundReceiveAccount, taxFreeAmount, idempotencyKey, timeoutMs = 15_000, circuitName = 'toss-cancel' } = input

  if (!env.TOSS_SECRET_KEY) {
    return { ok: false, code: 'NO_TOSS_SECRET', message: '결제 시스템이 설정되지 않았습니다.' }
  }
  if (!paymentKey) {
    return { ok: false, code: 'INVALID_PAYMENT_KEY', message: '결제 키 형식이 올바르지 않습니다.' }
  }
  if (!cancelReason || cancelReason.length === 0) {
    return { ok: false, code: 'MISSING_CANCEL_REASON', message: '취소 사유는 필수입니다.' }
  }
  if (cancelAmount != null && (!Number.isFinite(cancelAmount) || cancelAmount <= 0)) {
    return { ok: false, code: 'INVALID_CANCEL_AMOUNT', message: '취소 금액이 올바르지 않습니다.' }
  }

  // UTF-8 BOM 방어 (env 에 BOM 섞여있을 때 base64 손상 → 401).
  const secretKey = env.TOSS_SECRET_KEY.replace(/^﻿/, '').trim()

  // Idempotency-Key 길이 검증 (docs: 최대 300자).
  let idemKey = idempotencyKey
  if (idemKey.length > 300) idemKey = idemKey.slice(0, 300)

  const body: Record<string, unknown> = {
    cancelReason: String(cancelReason).slice(0, 200),
  }
  if (cancelAmount != null && cancelAmount > 0) body.cancelAmount = Math.floor(cancelAmount)
  if (taxFreeAmount != null && taxFreeAmount >= 0) body.taxFreeAmount = Math.floor(taxFreeAmount)
  if (refundReceiveAccount) {
    // docs: V1 cancel API 에서 refundReceiveAccount.bank 는 bankCode 와 동일 (숫자코드).
    const bank = refundReceiveAccount.bankCode ?? refundReceiveAccount.bank
    if (!bank || !refundReceiveAccount.accountNumber || !refundReceiveAccount.holderName) {
      return { ok: false, code: 'INVALID_REFUND_ACCOUNT', message: '환불 계좌 정보가 누락되었습니다.' }
    }
    body.refundReceiveAccount = {
      bank,
      accountNumber: refundReceiveAccount.accountNumber,
      holderName: refundReceiveAccount.holderName,
    }
  }

  const callFetch = (): Promise<Response> => withCircuitBreaker(
    { name: circuitName, maxFailures: 10, resetTimeoutMs: 60_000 },
    () => fetch(`${TOSS_API_BASE}/payments/${encodeURIComponent(paymentKey)}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(secretKey + ':')}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idemKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    }),
  )

  // 5xx 1회 자동 재시도 (2초 대기). 4xx 는 즉시 실패.
  let res: Response | null = null
  let lastErr: unknown = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await callFetch()
      if (res.ok || res.status < 500) break
      // 5xx → retry
      if (attempt === 0) {
        await new Promise(r => setTimeout(r, 2000))
        continue
      }
    } catch (e) {
      lastErr = e
      const msg = (e as Error)?.message || ''
      if (/circuit|breaker/i.test(msg)) {
        return { ok: false, code: 'CIRCUIT_OPEN', message: '결제 시스템이 일시 중단됐습니다. 잠시 후 다시 시도해주세요.', retryable: true }
      }
      if (attempt === 0) {
        await new Promise(r => setTimeout(r, 2000))
        continue
      }
    }
  }

  if (!res) {
    const msg = (lastErr as Error)?.message || ''
    const isTimeout = /abort|timeout/i.test(msg)
    return {
      ok: false,
      code: isTimeout ? 'TIMEOUT' : 'NETWORK',
      // 원본 에러 메시지 보존 (DNS / connect refused 등 진단 가능).
      message: msg || (isTimeout ? '취소 요청 타임아웃' : '취소 요청에 실패했습니다.'),
      retryable: true,
    }
  }

  let data: Record<string, unknown> = {}
  try { data = await res.json() as Record<string, unknown> } catch { /* empty */ }

  if (res.ok) {
    const cancels = Array.isArray((data as { cancels?: unknown[] }).cancels)
      ? (data as { cancels: Array<{ transactionKey?: string; cancelAmount?: number; cancelReason?: string; canceledAt?: string }> }).cancels
      : []
    return {
      ok: true,
      data: data as TossPaymentObject,
      lastCancel: cancels[cancels.length - 1],
      http_status: res.status,
    }
  }

  const code = String((data as { code?: string }).code || `HTTP_${res.status}`)
  const message = String((data as { message?: string }).message || '취소 요청에 실패했습니다.')
  const retryable = res.status >= 500 || code === 'PROVIDER_ERROR' || code === 'FAILED_INTERNAL_SYSTEM_PROCESSING'

  // 실패 시 자동 기록 (TD-3 정책 — toss_refund_retry cron 이 처리).
  if (env.DB && retryable) {
    try {
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS toss_refund_failures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_key TEXT NOT NULL,
        cancel_amount INTEGER,
        cancel_reason TEXT,
        http_status INTEGER,
        error_code TEXT,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        last_retried_at TEXT,
        resolved_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`).run()
      await env.DB.prepare(
        `INSERT INTO toss_refund_failures (payment_key, cancel_amount, cancel_reason, http_status, error_code, error_message)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(paymentKey, cancelAmount ?? null, cancelReason, res.status, code, message).run()
    } catch { /* graceful */ }
  }

  return { ok: false, code, message, http_status: res.status, retryable }
}

/**
 * 🛡️ 2026-05-23 v3 — 사용자 진단 + 실 에러 증거 종합 정정:
 *
 * 결정적 증거:
 *   1) PaymentDemoPage 'test_gck_docs_*' 로 widgets() API 성공
 *   2) 사용자 /toss-debug 'test_gck_P9B...' 로 widgets() 성공
 *   3) 사용자 production: payment() V2 가 _gck_ 키에 "결제위젯 연동 키 미지원" 에러
 *
 * → 이전 가정 (_gck_ = API 개별 연동 키) 거꾸로였음.
 * → _gck_ / _ck_ / _wck_ 모두 widget 키 type (widgets() API 호환).
 * → payment() V2 경로는 사용자 환경에서 작동 안 함. 사용 폐기.
 */
export type TossKeyType = 'widget' | 'unknown' | 'missing'
export function detectTossKeyType(key: string | undefined | null): TossKeyType {
  if (!key) return 'missing'
  if (/_gck_|_ck_|_wck_|_wt_|_widget_/i.test(key)) return 'widget'
  return 'unknown'
}

/**
 * 모든 키 → widgets() API 강제. payment() V2 경로 폐기.
 */
export function decideTossFlow(key: string | undefined | null): {
  flow: 'redirect' | 'widget' | 'invalid'
  flowReason?: string
} {
  const t = detectTossKeyType(key)
  if (t === 'missing') return { flow: 'invalid', flowReason: 'TOSS_CLIENT_KEY env missing' }
  if (t === 'widget') return { flow: 'widget', flowReason: 'widget client key' }
  return { flow: 'widget', flowReason: 'unknown key prefix — defaulting to widget' }
}

/**
 * orderId prefix 표준 — 시나리오별 식별 가능 + 충돌 방지.
 *   DEAL- : 딜 충전
 *   ORD-  : 일반 상품 주문
 *   GB-   : 공동구매 참여
 *   STAY- : 숙소 예약
 *   CAST- : 캐스팅
 *   AD-   : 광고 슬롯
 */
export type TossOrderPrefix = 'DEAL' | 'ORD' | 'GB' | 'STAY' | 'CAST' | 'AD'
export function generateTossOrderId(prefix: TossOrderPrefix, userId: string | number): string {
  const safeUser = String(userId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)
  return `${prefix}-${safeUser}-${Date.now()}`
}
