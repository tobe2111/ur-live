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
  data: {
    paymentKey: string
    orderId: string
    totalAmount: number
    method?: string
    status: string
    approvedAt?: string
    receipt?: { url?: string }
    [k: string]: unknown
  }
  /** 'ALREADY_PROCESSED_PAYMENT' 인 경우 idempotent 재시도. caller 가 CAS 로 한 번만 처리해야 함. */
  alreadyProcessed?: boolean
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
