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
 * @param paymentKey  - Toss paymentKey (결제 완료 시 저장)
 * @param secretKey   - TOSS_SECRET_KEY (env binding)
 * @param cancelReason - 취소 사유 (필수, 200자 이내)
 * @param cancelAmount - 부분 취소 금액 (미입력 시 전액 취소)
 */
export async function tossCancelPayment(
  paymentKey: string,
  secretKey: string,
  cancelReason: string,
  cancelAmount?: number,
): Promise<{ success: true; data: TossPaymentCancelResponse } | { success: false; code: string; message: string }> {
  const url = `${TOSS_API_BASE}/${encodeURIComponent(paymentKey)}/cancel`;

  const body: TossCancelRequest = { cancelReason };
  if (cancelAmount !== undefined && cancelAmount > 0) {
    body.cancelAmount = cancelAmount;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': makeTossAuthHeader(secretKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    return {
      success: false,
      code: 'NETWORK_ERROR',
      message: networkErr instanceof Error ? networkErr.message : 'Network error',
    };
  }

  // HTTP 200 → 성공
  if (res.ok) {
    const data = await res.json() as TossPaymentCancelResponse;
    return { success: true, data };
  }

  // HTTP 4xx/5xx → Toss 에러 객체 파싱
  let errBody: TossApiError = { code: 'UNKNOWN', message: 'Unknown Toss error' };
  try {
    errBody = await res.json() as TossApiError;
  } catch {
    // JSON 파싱 실패 시 기본값 유지
  }

  return { success: false, code: errBody.code, message: errBody.message };
}

/**
 * Toss 취소 결과에서 첫 번째 cancel 항목을 반환합니다.
 */
export function getLatestCancel(
  response: TossPaymentCancelResponse,
): TossPaymentCancelResponse['cancels'][0] | undefined {
  // Toss는 가장 최근 취소를 배열 마지막에 반환
  return response.cancels[response.cancels.length - 1];
}
