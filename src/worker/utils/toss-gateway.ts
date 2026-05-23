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

  let res: Response
  try {
    res = await withCircuitBreaker(
      { name: circuitName, maxFailures: 10, resetTimeoutMs: 60_000 },
      () => fetch(`${TOSS_API_BASE}/payments/confirm`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(env.TOSS_SECRET_KEY + ':')}`,
          'Content-Type': 'application/json',
          // Idempotency-Key 명시 시 그것, 아니면 paymentKey (토스 권장 — 같은 결제 중복 confirm 안전).
          'Idempotency-Key': idempotencyKey || paymentKey,
        },
        body: JSON.stringify({ paymentKey, orderId, amount }),
        signal: AbortSignal.timeout(timeoutMs),
      }),
    )
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

  return { ok: false, status: res.status, code, message }
}

/**
 * 토스 키 type 검증.
 * - 'gck' / 'ck' = API 개별 연동 키 → payment() V2 redirect 사용 가능.
 * - 'wt' = 결제위젯 연동 키 → variantKey 콘솔 등록 필요 (지원 X).
 * - 'unknown' = prefix 미인식 (Toss 신규 키 type 대비, redirect 시도 fallback).
 * - 'missing' = env 미설정.
 */
export type TossKeyType = 'gck' | 'ck' | 'wt' | 'unknown' | 'missing'
export function detectTossKeyType(key: string | undefined | null): TossKeyType {
  if (!key) return 'missing'
  if (/_gck_/i.test(key)) return 'gck'
  if (/_wt_|_widget_/i.test(key)) return 'wt'
  if (/_ck_/i.test(key)) return 'ck'
  return 'unknown'
}

/**
 * Init endpoint 가 반환할 표준 응답 구조 결정.
 * - 'wt' 키 → 'widget' (widgets() API in-page rendering)
 * - 'gck' / 'ck' / unknown → 'redirect' (payment() V2 redirect)
 * - missing → 'invalid'
 *
 * 🛡️ 2026-05-22 v2: widget 키도 지원 (이전 'invalid' 처리 → 운영자 환경 의존성 영구 차단).
 *   클라이언트는 flow 별로 widgets() / payment() 자동 분기.
 */
export function decideTossFlow(key: string | undefined | null): {
  flow: 'redirect' | 'widget' | 'invalid'
  flowReason?: string
} {
  const t = detectTossKeyType(key)
  if (t === 'missing') return { flow: 'invalid', flowReason: 'TOSS_CLIENT_KEY env missing' }
  if (t === 'wt') return { flow: 'widget', flowReason: 'widget client key' }
  return { flow: 'redirect' }
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
