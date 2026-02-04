/**
 * 나이스페이먼츠 결제/환불 API 연동 서비스
 * 
 * API 문서: https://developer.nicepay.co.kr/
 * 
 * 테스트 환경: https://sandbox-api.nicepay.co.kr
 * 운영 환경: https://api.nicepay.co.kr
 */

// 나이스페이먼츠 설정
const NICEPAY_CONFIG = {
  // 환경 설정
  ENV: 'production', // 'sandbox' | 'production'
  
  // 상점 정보
  MERCHANT_ID: 'PItobe211m',
  MERCHANT_KEY: 'GKHsnRI/P5V3RpU7v5UA2ElK5vz0v3Nyf+wdd+T+RXvh8R/xWwZk7gzwQwKZi6kcJ2lnif1xgYYF6amQ5cRnTA==',
  
  // API 엔드포인트
  SANDBOX_BASE_URL: 'https://sandbox-api.nicepay.co.kr',
  PRODUCTION_BASE_URL: 'https://api.nicepay.co.kr',
};

/**
 * 나이스페이먼츠 API 기본 설정 가져오기
 */
function getNicepayConfig() {
  const isProduction = NICEPAY_CONFIG.ENV === 'production';
  
  return {
    baseUrl: isProduction ? NICEPAY_CONFIG.PRODUCTION_BASE_URL : NICEPAY_CONFIG.SANDBOX_BASE_URL,
    merchantId: NICEPAY_CONFIG.MERCHANT_ID,
    merchantKey: NICEPAY_CONFIG.MERCHANT_KEY,
    isProduction,
  };
}

/**
 * 나이스페이먼츠 API 호출 기본 함수
 */
async function callNicepayAPI(endpoint: string, data: any, method: string = 'POST') {
  const config = getNicepayConfig();
  const url = `${config.baseUrl}${endpoint}`;
  
  // Authorization 헤더 생성 (Base64 인코딩)
  const auth = Buffer.from(`${config.merchantId}:${config.merchantKey}`).toString('base64');
  
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: method !== 'GET' ? JSON.stringify(data) : undefined,
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`나이스페이먼츠 API 오류: ${result.resultMsg || response.statusText}`);
    }
    
    return result;
  } catch (error) {
    console.error('나이스페이먼츠 API 호출 실패:', error);
    throw error;
  }
}

/**
 * 결제 취소/환불 요청
 * 
 * @param tid 거래 ID (결제키)
 * @param amount 취소 금액
 * @param reason 취소 사유
 * @returns 취소 결과
 */
export async function cancelNicepayPayment(
  tid: string,
  amount: number,
  reason: string
) {
  try {
    const config = getNicepayConfig();
    
    const requestData = {
      orderId: tid, // 주문번호 (TID)
      cancelAmt: amount, // 취소 금액
      cancelMsg: reason, // 취소 사유
      partialCancelCode: 0, // 0: 전체취소, 1: 부분취소
    };
    
    // 나이스페이먼츠 취소 API 호출
    const result = await callNicepayAPI('/v1/payments/cancel', requestData);
    
    // 응답 형식:
    // {
    //   "resultCode": "0000",
    //   "resultMsg": "성공",
    //   "tid": "UT0000113m01012101...",
    //   "cancelAmt": 1000,
    //   "balanceAmt": 0
    // }
    
    if (result.resultCode !== '0000') {
      throw new Error(`나이스페이먼츠 취소 실패: ${result.resultMsg}`);
    }
    
    return {
      success: true,
      tid: result.tid,
      cancelAmount: result.cancelAmt,
      balanceAmount: result.balanceAmt,
      message: result.resultMsg || '환불이 완료되었습니다.',
    };
  } catch (error) {
    console.error('나이스페이먼츠 환불 실패:', error);
    throw error;
  }
}

/**
 * 결제 상태 조회
 * 
 * @param tid 거래 ID
 * @returns 결제 상태 정보
 */
export async function getNicepayPaymentStatus(tid: string) {
  try {
    const result = await callNicepayAPI(`/v1/payments/${tid}`, {}, 'GET');
    
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('나이스페이먼츠 조회 실패:', error);
    throw error;
  }
}

/**
 * 부분 취소 요청
 * 
 * @param tid 거래 ID
 * @param amount 부분 취소 금액
 * @param reason 취소 사유
 * @returns 취소 결과
 */
export async function partialCancelNicepayPayment(
  tid: string,
  amount: number,
  reason: string
) {
  try {
    const requestData = {
      orderId: tid,
      cancelAmt: amount,
      cancelMsg: reason,
      partialCancelCode: 1, // 부분취소
    };
    
    const result = await callNicepayAPI('/v1/payments/cancel', requestData);
    
    if (result.resultCode !== '0000') {
      throw new Error(`부분 취소 실패: ${result.resultMsg}`);
    }
    
    return {
      success: true,
      tid: result.tid,
      cancelAmount: result.cancelAmt,
      balanceAmount: result.balanceAmt, // 남은 금액
      message: result.resultMsg,
    };
  } catch (error) {
    console.error('나이스페이먼츠 부분 취소 실패:', error);
    throw error;
  }
}

/**
 * Mock 모드 여부 확인
 */
export function isNicepayMockMode(): boolean {
  // 환경변수로 Mock 모드 제어
  // return process.env.NICEPAY_MOCK_MODE === 'true';
  
  // 현재는 실제 API 사용
  return false;
}

/**
 * Mock 또는 실제 API 호출 (자동 선택)
 */
export async function cancelPaymentAuto(
  tid: string,
  amount: number,
  reason: string
) {
  if (isNicepayMockMode()) {
    // Mock 모드
    return {
      success: true,
      tid: `MOCK-${tid}`,
      cancelAmount: amount,
      balanceAmount: 0,
      message: '환불이 완료되었습니다. (Mock Mode)',
    };
  } else {
    // 실제 나이스페이먼츠 API 호출
    return await cancelNicepayPayment(tid, amount, reason);
  }
}
