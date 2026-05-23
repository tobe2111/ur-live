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
 * 🛡️ 2026-05-23 영구 fix — Toss 공식 키 네이밍 정정.
 *
 * 사용자 신고: "결제위젯 연동 키는 지원하지 않습니다" SDK 에러로 공구 결제 막힘.
 * 원인 (영구 분석):
 *   기존 detect 로직이 `_ck_` 를 'general' (legacy 추정) 으로 잘못 분류 →
 *   payment() V2 호출 → SDK 가 widget key 라며 거부.
 *
 * Toss 공식 키 네이밍 (2024+ 현재):
 *   - 'wck' / 'ck' = 결제위젯 (widgets() API) — `test_ck_*` / `live_ck_*` / `test_wck_*`
 *   - 'gck' = API 개별 연동 (payment() V2) — `test_gck_*` / `live_gck_*`
 *   - legacy 'wt' / 'widget_' = 옛 결제위젯 키 패턴 (호환 유지)
 *
 * 검증 출처:
 *   https://docs.tosspayments.com/reference/using-api/api-keys
 *   - 결제위젯 클라이언트 키: live_ck_* / test_ck_*
 *   - API 개별 클라이언트 키: live_gck_* / test_gck_*
 */
export type TossKeyType = 'gck' | 'widget' | 'unknown' | 'missing'
export function detectTossKeyType(key: string | undefined | null): TossKeyType {
  if (!key) return 'missing'
  // gck 먼저 매칭 (gck 가 ck 보다 specific — 순서 중요).
  if (/_gck_/i.test(key)) return 'gck'
  if (/_ck_|_wck_|_wt_|_widget_/i.test(key)) return 'widget'
  return 'unknown'
}

/**
 * Init endpoint 가 반환할 표준 응답 구조 결정.
 * - 'widget' 키 (_ck_/_wck_/_wt_) → 'widget' (widgets() API in-page rendering)
 * - 'gck' 키 → 'redirect' (payment() V2 redirect)
 * - 'unknown' → 'widget' 안전 default (대부분 widget key — payment() V2 보다 widgets() 가 호환성 높음)
 * - missing → 'invalid'
 */
export function decideTossFlow(key: string | undefined | null): {
  flow: 'redirect' | 'widget' | 'invalid'
  flowReason?: string
} {
  const t = detectTossKeyType(key)
  if (t === 'missing') return { flow: 'invalid', flowReason: 'TOSS_CLIENT_KEY env missing' }
  if (t === 'gck') return { flow: 'redirect', flowReason: 'general api key (gck)' }
  if (t === 'widget') return { flow: 'widget', flowReason: 'widget client key (ck/wck/wt)' }
  // unknown prefix — widget API 가 카드/이체/카카오페이/네이버페이 등 더 많은 결제 수단 지원.
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
