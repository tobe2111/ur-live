/**
 * 알리고 카카오 알림톡 API 유틸리티
 *
 * 원가: 6.5원/건  |  판매가: 9원/건
 * API 문서: https://smartsms.aligo.in/shop/kakaoapispec.html
 */

const ALIGO_API_BASE = 'https://kakaoapi.aligo.in/akv10';

export interface AligoSendParams {
  apikey: string;
  userid: string;
  senderkey: string;
  tpl_code: string;       // 카카오 승인 템플릿 코드
  sender: string;         // 발신번호
  receiver_1: string;     // 수신자 전화번호
  recvname_1: string;     // 수신자명
  subject_1: string;      // 메시지 제목 (35자 이내)
  message_1: string;      // 메시지 본문
  button_1?: string;      // 버튼 JSON (선택)
  failover?: 'Y' | 'N';  // 실패 시 SMS 대체 발송
  fsubject_1?: string;    // 대체 SMS 제목
  fmessage_1?: string;    // 대체 SMS 내용
}

export interface AligoSendResult {
  success: boolean;
  code: number;        // 0 = 성공
  message: string;
  info?: {
    type: string;
    mid: string;
    current: string;
    unit: number;
    total: number;
    scnt: number;       // 성공 건수
    fcnt: number;       // 실패 건수
  };
}

export async function sendAlimtalk(params: AligoSendParams): Promise<AligoSendResult> {
  const body = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) body.append(k, String(v));
  });

  const res = await fetch(`${ALIGO_API_BASE}/alimtalk/send/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const json = await res.json<{ code: number; message: string; info?: any }>();
  return {
    success: json.code === 0,
    code: json.code,
    message: json.message,
    info: json.info,
  };
}

// ── 템플릿별 메시지 빌더 ──────────────────────────────────────────────────────

export interface OrderInfo {
  orderId: string;
  buyerName: string;
  buyerPhone: string;
  productName: string;
  totalAmount: number;
  sellerName: string;
}

export interface ShippingInfo {
  orderId: string;
  buyerName: string;
  buyerPhone: string;
  productName: string;
  courier: string;       // 택배사
  trackingNumber: string;
}

/** 주문 완료 알림톡 메시지 생성 */
export function buildOrderConfirmMessage(order: OrderInfo): { subject: string; message: string } {
  return {
    subject: '주문이 완료되었습니다',
    message: [
      `[${order.sellerName}] 주문 완료 안내`,
      '',
      `주문번호: ${order.orderId}`,
      `주문상품: ${order.productName}`,
      `결제금액: ${order.totalAmount.toLocaleString()}원`,
      '',
      '감사합니다 :)',
    ].join('\n'),
  };
}

/** 배송 시작 알림톡 메시지 생성 */
export function buildShippingMessage(info: ShippingInfo): { subject: string; message: string } {
  return {
    subject: '배송이 시작되었습니다',
    message: [
      `[배송 시작] ${info.productName}`,
      '',
      `주문번호: ${info.orderId}`,
      `택배사: ${info.courier}`,
      `운송장번호: ${info.trackingNumber}`,
      '',
      '배송 조회는 각 택배사 홈페이지에서 확인하세요.',
    ].join('\n'),
  };
}
