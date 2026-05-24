// ============================================================
// Toss Payments API Client
// Cloudflare Worker 환경에서 Toss Payments REST API를 호출합니다.
// Docs: https://docs.tosspayments.com/reference
// ============================================================

import { TOSS_PAYMENT_URL } from '../../shared/constants';

export interface TossCancelRequest {
  cancelReason: string;
  cancelAmount?: number;       // 부분 취소 금액 (미입력 시 전액 취소)
  refundReceiveAccount?: {     // 가상계좌 환불 계좌 (가상계좌 결제 시 필수)
    bank: string;
    accountNumber: string;
    holderName: string;
  };
}

export interface TossPaymentCancelResponse {
  paymentKey: string;
  orderId: string;
  status: string;              // CANCELED | PARTIAL_CANCELED
  cancels: {
    cancelAmount: number;
    cancelReason: string;
    canceledAt: string;
    transactionKey: string;
  }[];
}

export interface TossApiError {
  code: string;
  message: string;
}

const TOSS_API_BASE = `${TOSS_PAYMENT_URL}/payments`;

/**
 * Basic Auth 헤더 생성 (Toss 방식: secretKey + ':' → Base64)
 */
function makeTossAuthHeader(secretKey: string): string {
  const credentials = `${secretKey}:`;
  // Workers 환경에서 btoa 사용 가능
  return `Basic ${btoa(credentials)}`;
}

/**
 * Toss Payments 결제 취소 API 호출
 *
 * 🛡️ 2026-05-24: toss-gateway.cancelTossPayment() 의 thin wrapper.
 *    실제 구현은 SSOT (toss-gateway). API 호환성 유지 위해 시그니처 유지.
 *
 * ⚠️ Toss V2 docs 잠금 (2026-05-24): 이 파일은 직접 수정 금지. 변경 필요 시 사용자에게 문의.
 */
export async function tossCancelPayment(
  paymentKey: string,
  secretKey: string,
  cancelReason: string,
  cancelAmount?: number,
  idempotencyKey?: string,
  /** 가상계좌 입금 완료 후 환불 시 필수 (V2 docs). */
  refundReceiveAccount?: { bank?: string; bankCode?: string; accountNumber: string; holderName: string },
  /** 면세 부분 취소 (복합과세 상점, V2 docs). */
  taxFreeAmount?: number,
): Promise<{ success: true; data: TossPaymentCancelResponse } | { success: false; code: string; message: string }> {
  const { cancelTossPayment } = await import('./toss-gateway');
  const idemKey = idempotencyKey
    || `cancel-${paymentKey}-${cancelAmount ?? 'full'}-${cancelReason.slice(0, 20).replace(/\s/g, '_')}`;
  const result = await cancelTossPayment({
    env: { TOSS_SECRET_KEY: secretKey },
    paymentKey,
    cancelReason,
    cancelAmount,
    refundReceiveAccount,
    taxFreeAmount,
    idempotencyKey: idemKey,
    timeoutMs: 10000,
  });
  if (result.ok) {
    return { success: true, data: result.data as unknown as TossPaymentCancelResponse };
  }
  return { success: false, code: result.code, message: result.message };
}

/**
 * Toss 취소 결과에서 가장 최근 cancel 항목을 반환합니다.
 */
export function getLatestCancel(
  response: TossPaymentCancelResponse,
): TossPaymentCancelResponse['cancels'][0] | undefined {
  // Toss는 가장 최근 취소를 배열 마지막에 반환
  return response.cancels[response.cancels.length - 1];
}

// ============================================================
// 결제 조회 API
// ============================================================

export interface TossPaymentInfo {
  paymentKey: string;
  orderId: string;
  orderName: string;
  status: string;
  totalAmount: number;
  method: string;
  approvedAt: string;
  requestedAt: string;
  receipt?: { url: string };
  cancels?: TossPaymentCancelResponse['cancels'];
}

/**
 * Toss Payments 결제 조회 API — paymentKey로 결제 상태 확인
 * 결제 승인 후 상태를 검증하거나 영수증 URL을 조회할 때 사용합니다.
 *
 * @param paymentKey - Toss paymentKey
 * @param secretKey  - TOSS_SECRET_KEY
 */
export async function tossGetPayment(
  paymentKey: string,
  secretKey: string,
): Promise<{ success: true; data: TossPaymentInfo } | { success: false; code: string; message: string }> {
  const url = `${TOSS_API_BASE}/${encodeURIComponent(paymentKey)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': makeTossAuthHeader(secretKey),
      },
      signal: AbortSignal.timeout(10000), // 10s timeout (critical path)
    });
  } catch (networkErr) {
    return {
      success: false,
      code: 'NETWORK_ERROR',
      message: networkErr instanceof Error ? networkErr.message : 'Network error',
    };
  }

  if (res.ok) {
    const data = await res.json() as TossPaymentInfo;
    return { success: true, data };
  }

  let errBody: TossApiError = { code: 'UNKNOWN', message: 'Unknown Toss error' };
  try {
    errBody = await res.json() as TossApiError;
  } catch {
    // JSON 파싱 실패 시 기본값 유지
  }

  return { success: false, code: errBody.code, message: errBody.message };
}

/**
 * Toss Payments 결제 조회 API — orderId로 결제 상태 확인
 *
 * @param orderId   - 주문번호 (우리 시스템의 order_number)
 * @param secretKey - TOSS_SECRET_KEY
 */
export async function tossGetPaymentByOrderId(
  orderId: string,
  secretKey: string,
): Promise<{ success: true; data: TossPaymentInfo } | { success: false; code: string; message: string }> {
  const url = `${TOSS_API_BASE}/orders/${encodeURIComponent(orderId)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': makeTossAuthHeader(secretKey),
      },
      signal: AbortSignal.timeout(10000), // 10s timeout (critical path)
    });
  } catch (networkErr) {
    return {
      success: false,
      code: 'NETWORK_ERROR',
      message: networkErr instanceof Error ? networkErr.message : 'Network error',
    };
  }

  if (res.ok) {
    const data = await res.json() as TossPaymentInfo;
    return { success: true, data };
  }

  let errBody: TossApiError = { code: 'UNKNOWN', message: 'Unknown Toss error' };
  try {
    errBody = await res.json() as TossApiError;
  } catch {
    // JSON 파싱 실패 시 기본값 유지
  }

  return { success: false, code: errBody.code, message: errBody.message };
}
