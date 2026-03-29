/**
 * 알리고 카카오 알림톡 API 유틸리티
 *
 * 원가: 6.5원/건  |  판매가: 9원/건
 * API 문서: https://smartsms.aligo.in/shop/kakaoapispec.html
 */

const ALIGO_API_BASE = 'https://kakaoapi.aligo.in/akv10';

// ── 친구톡 (브랜드메시지) 발송 ─────────────────────────────────────────────────

export interface AligoFriendParams {
  apikey: string;
  userid: string;
  senderkey: string;
  sender: string;          // 발신번호
  receiver_1: string;      // 수신자 전화번호
  recvname_1: string;      // 수신자명
  subject_1: string;       // 메시지 제목 (35자 이내)
  message_1: string;       // 메시지 본문
  ptype_1?: 'I' | 'W';    // I=이미지, W=와이드이미지 (없으면 텍스트)
  image_1?: string;        // 이미지 URL (ptype_1=I일 때)
  button_1?: string;       // 버튼 JSON
  failover?: 'Y' | 'N';   // 실패 시 SMS 대체
  fsubject_1?: string;
  fmessage_1?: string;
}

export async function sendFriendTalk(params: AligoFriendParams): Promise<AligoSendResult> {
  const body = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) body.append(k, String(v));
  });

  const res = await fetch(`${ALIGO_API_BASE}/friend/send/`, {
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

export interface CancellationInfo {
  orderId: string;
  buyerName: string;
  buyerPhone: string;
  productName: string;
  totalAmount: number;
}

/** 주문 취소 알림톡 메시지 생성 */
export function buildCancellationMessage(info: CancellationInfo): { subject: string; message: string } {
  return {
    subject: '주문이 취소되었습니다',
    message: [
      `[주문 취소] 안내`,
      '',
      `주문번호: ${info.orderId}`,
      `취소 상품: ${info.productName}`,
      `환불 금액: ${info.totalAmount.toLocaleString()}원`,
      '',
      '환불은 결제 수단에 따라 3~5 영업일 소요될 수 있습니다.',
    ].join('\n'),
  };
}

export interface SampleApprovalInfo {
  sellerName: string;
  productName: string;
  approved: boolean;
  adminMemo?: string | null;
}

/** 샘플 신청 승인/거부 알림톡 메시지 생성 */
export function buildSampleApprovalMessage(info: SampleApprovalInfo): { subject: string; message: string } {
  if (info.approved) {
    return {
      subject: '샘플 신청이 승인되었습니다',
      message: [
        `[샘플 승인] ${info.productName}`,
        '',
        `안녕하세요, ${info.sellerName}님.`,
        '신청하신 샘플이 승인되었습니다.',
        '',
        info.adminMemo ? `승인 메모: ${info.adminMemo}` : '셀러 대시보드에서 스토어에 등록하실 수 있습니다.',
      ].filter(Boolean).join('\n'),
    };
  }
  return {
    subject: '샘플 신청이 반려되었습니다',
    message: [
      `[샘플 반려] ${info.productName}`,
      '',
      `안녕하세요, ${info.sellerName}님.`,
      '죄송합니다. 신청하신 샘플이 반려되었습니다.',
      '',
      info.adminMemo ? `반려 사유: ${info.adminMemo}` : '자세한 문의는 관리자에게 연락해주세요.',
    ].filter(Boolean).join('\n'),
  };
}
