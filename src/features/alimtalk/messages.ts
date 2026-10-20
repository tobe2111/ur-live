/**
 * 알림톡 본문 빌더 — 쇼핑 주문·배송·취소·샘플 승인.
 *
 * 📨 2026-10-12: 발송처가 알리고 → 네이버 클라우드 SENS 로 바뀌면서 알리고 파일(`aligo.ts`)을 지우고
 *   **문구 빌더만** 이리로 옮겼다(문구는 한 글자도 안 바꿨다 — 카카오 검수 본문과 같아야 한다).
 *   발송은 `@/lib/system-alimtalk` / `@/lib/text-notice` 한 곳이 한다.
 */

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
      `결제금액: ${Number(order.totalAmount ?? 0).toLocaleString('ko-KR')}원`,
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
      `환불 금액: ${Number(info.totalAmount ?? 0).toLocaleString('ko-KR')}원`,
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
