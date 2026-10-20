/**
 * 바로빌 전자세금계산서 API 연동 서비스
 *
 * API 문서: https://dev.barobill.co.kr/docs/guides/바로빌-API-시작하기
 *
 * 테스트서버: https://testapi.barobill.co.kr
 * 운영서버: https://api.barobill.co.kr
 *
 * 🛡️ 2026-04-30: 보안 강화 — API 키를 hardcoded 에서 환경변수로 이전.
 *   기존 git history 에 노출된 테스트/프로덕션 키는 별도 회전 필요.
 *   이 파일은 현재 사용되지 않음 (worker route 미연결). 사용 시작 전
 *   Cloudflare Pages Variables 에 BAROBILL_TEST_API_KEY / BAROBILL_PROD_API_KEY 등록.
 */

// 환경 설정 (런타임 주입)
const BAROBILL_CONFIG = {
  TEST_BASE_URL: 'https://testapi.barobill.co.kr',
  PROD_BASE_URL: 'https://api.barobill.co.kr',
};

// 🛡️ Worker context (`c.env`) 또는 Node `process.env` 양쪽 호환.
export interface BarobillEnv {
  BAROBILL_TEST_API_KEY?: string;
  BAROBILL_PROD_API_KEY?: string;
  BAROBILL_ENV?: string; // 'production' → 운영 서버/키
}

function envVal(env: BarobillEnv | undefined, key: keyof BarobillEnv): string | undefined {
  return env?.[key] ?? (typeof process !== 'undefined' ? process.env?.[key] : undefined);
}
function isProdEnv(env?: BarobillEnv): boolean {
  return (envVal(env, 'BAROBILL_ENV') || 'test') === 'production';
}

/** 바로빌 자격증명(키) 설정 여부 — 미설정 시 내부 발행만(전자세금계산서 비활성). */
export function isBarobillConfigured(env?: BarobillEnv): boolean {
  return !!(isProdEnv(env) ? envVal(env, 'BAROBILL_PROD_API_KEY') : envVal(env, 'BAROBILL_TEST_API_KEY'));
}

function getApiKey(env?: BarobillEnv): string {
  const isProd = isProdEnv(env);
  const v = isProd ? envVal(env, 'BAROBILL_PROD_API_KEY') : envVal(env, 'BAROBILL_TEST_API_KEY');
  if (v) return v;
  throw new Error(`바로빌 API 키 미설정 — 환경변수 BAROBILL_${isProd ? 'PROD' : 'TEST'}_API_KEY 필요`);
}

function getBarobillConfig(env?: BarobillEnv) {
  const isProduction = isProdEnv(env);
  return {
    baseUrl: isProduction ? BAROBILL_CONFIG.PROD_BASE_URL : BAROBILL_CONFIG.TEST_BASE_URL,
    apiKey: getApiKey(env),
    isProduction,
  };
}

/**
 * 바로빌 API 호출 기본 함수
 */
async function callBarobillAPI(env: BarobillEnv | undefined, endpoint: string, data: any) {
  const config = getBarobillConfig(env);
  const url = `${config.baseUrl}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`바로빌 API 오류: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json() as any;
    return result;
  } catch (error) {
    console.error('바로빌 API 호출 실패:', error);
    throw error;
  }
}

/**
 * 전자세금계산서 발행 인터페이스
 */
interface TaxInvoiceIssueRequest {
  // 공급자 정보 (인플루언서)
  supplierBusinessNumber: string;
  supplierBusinessName: string;
  supplierCEO: string;
  supplierAddress: string;
  supplierBusinessType?: string;
  supplierBusinessCategory?: string;
  supplierEmail?: string;
  supplierTel?: string;
  
  // 공급받는자 정보 (고객)
  buyerBusinessNumber?: string;
  buyerBusinessName: string;
  buyerCEO?: string;
  buyerAddress?: string;
  buyerEmail?: string;
  buyerTel?: string;
  
  // 세금계산서 정보
  writeDate: string; // 작성일 (YYYY-MM-DD)
  purposeType: '01' | '02' | '03'; // 영수/청구 (01: 영수, 02: 청구, 03: 없음)
  taxType: '01' | '02'; // 과세형태 (01: 과세, 02: 영세)
  
  // 품목 정보
  items: Array<{
    name: string;          // 품목명
    quantity: number;      // 수량
    unitPrice: number;     // 단가
    supplyPrice: number;   // 공급가액
    taxAmount: number;     // 세액
    description?: string;  // 비고
  }>;
  
  // 합계
  totalSupplyPrice: number; // 총 공급가액
  totalTaxAmount: number;   // 총 세액
  totalAmount: number;      // 총 합계
  
  // 기타
  memo?: string; // 비고
  orderNo?: string; // 주문번호 (관리용)
}

/**
 * 전자세금계산서 발행
 */
export async function issueBarobillTaxInvoice(env: BarobillEnv | undefined, request: TaxInvoiceIssueRequest) {
  try {
    // 바로빌 API 형식으로 데이터 변환
    const barobillData = {
      CorpNum: request.supplierBusinessNumber, // 공급자 사업자번호
      
      // 공급자 정보
      InvoicerCorpNum: request.supplierBusinessNumber,
      InvoicerCorpName: request.supplierBusinessName,
      InvoicerCEOName: request.supplierCEO,
      InvoicerAddr: request.supplierAddress,
      InvoicerBizType: request.supplierBusinessType,
      InvoicerBizClass: request.supplierBusinessCategory,
      InvoicerContactName: request.supplierCEO,
      InvoicerEmail: request.supplierEmail,
      InvoicerTEL: request.supplierTel,
      
      // 공급받는자 정보
      InvoiceeType: request.buyerBusinessNumber ? '사업자' : '개인',
      InvoiceeCorpNum: request.buyerBusinessNumber,
      InvoiceeCorpName: request.buyerBusinessName,
      InvoiceeCEOName: request.buyerCEO,
      InvoiceeAddr: request.buyerAddress,
      InvoiceeEmail: request.buyerEmail,
      InvoiceeTEL: request.buyerTel,
      
      // 세금계산서 정보
      WriteDate: request.writeDate,
      PurposeType: request.purposeType,
      TaxType: request.taxType,
      
      // 품목
      DetailList: request.items.map((item, index) => ({
        SerialNum: index + 1,
        ItemName: item.name,
        Qty: item.quantity,
        UnitPrice: item.unitPrice,
        SupplyCost: item.supplyPrice,
        Tax: item.taxAmount,
        Remark: item.description || '',
      })),
      
      // 합계
      SupplyCostTotal: request.totalSupplyPrice.toString(),
      TaxTotal: request.totalTaxAmount.toString(),
      TotalAmount: request.totalAmount.toString(),
      
      // 비고
      Remark1: request.memo || '',
      Remark2: request.orderNo || '',
      
      // 발행 옵션
      SendSMS: false, // SMS 발송 여부
      AutoAccept: false, // 자동 승인 여부
    };
    
    // 바로빌 API 호출
    const result = await callBarobillAPI(env, '/eTaxInvoice/RegistAndIssue', barobillData);
    
    // 응답 형식
    // {
    //   "code": 1,
    //   "message": "성공",
    //   "ntsconfirmNum": "202602041234567890",
    //   "invoiceKey": "ABC123..."
    // }
    
    if (result.code !== 1) {
      throw new Error(`바로빌 발행 실패: ${result.message}`);
    }
    
    return {
      success: true,
      ntsConfirmNumber: result.ntsconfirmNum, // 국세청 승인번호
      invoiceKey: result.invoiceKey, // 바로빌 세금계산서 키
      message: result.message,
    };
  } catch (error) {
    console.error('바로빌 세금계산서 발행 실패:', error);
    throw error;
  }
}

/**
 * 전자세금계산서 취소
 */
export async function cancelBarobillTaxInvoice(env: BarobillEnv | undefined, supplierBusinessNumber: string, invoiceKey: string, reason: string) {
  try {
    const barobillData = {
      CorpNum: supplierBusinessNumber,
      InvoiceKey: invoiceKey,
      Memo: reason,
    };
    
    const result = await callBarobillAPI(env, '/eTaxInvoice/Delete', barobillData);
    
    if (result.code !== 1) {
      throw new Error(`바로빌 취소 실패: ${result.message}`);
    }
    
    return {
      success: true,
      message: result.message,
    };
  } catch (error) {
    console.error('바로빌 세금계산서 취소 실패:', error);
    throw error;
  }
}

/**
 * 전자세금계산서 조회
 */
export async function getBarobillTaxInvoice(env: BarobillEnv | undefined, supplierBusinessNumber: string, invoiceKey: string) {
  try {
    const barobillData = {
      CorpNum: supplierBusinessNumber,
      InvoiceKey: invoiceKey,
    };
    
    const result = await callBarobillAPI(env, '/eTaxInvoice/GetInfo', barobillData);
    
    if (result.code !== 1) {
      throw new Error(`바로빌 조회 실패: ${result.message}`);
    }
    
    return {
      success: true,
      data: result.invoiceInfo,
    };
  } catch (error) {
    console.error('바로빌 세금계산서 조회 실패:', error);
    throw error;
  }
}

/**
 * Mock 모드 여부 확인
 * 환경변수로 제어 가능
 */
export function isBarobillMockMode(): boolean {
  // 환경변수로 Mock 모드 제어
  // return process.env.BAROBILL_MOCK_MODE === 'true';
  
  // 현재는 테스트 서버 사용
  return false; // false로 설정하면 실제 바로빌 테스트 서버 사용
}

/**
 * Mock 또는 실제 API 호출 (자동 선택)
 */
export async function issueTaxInvoiceAuto(env: BarobillEnv | undefined, request: TaxInvoiceIssueRequest) {
  if (isBarobillMockMode()) {
    // Mock 모드
    return {
      success: true,
      ntsConfirmNumber: `MOCK-${Date.now()}`,
      invoiceKey: `MOCK-KEY-${Math.random().toString(36).substring(2, 10)}`,
      message: '세금계산서가 발행되었습니다. (Mock Mode)',
    };
  } else {
    // 실제 바로빌 API 호출
    return await issueBarobillTaxInvoice(env, request);
  }
}

/**
 * 세금계산서 발행 헬퍼 함수
 * DB 데이터를 바로빌 API 형식으로 변환
 */
export function convertToBarobillFormat(
  businessInfo: any,
  order: any,
  orderItems: any[]
): TaxInvoiceIssueRequest {
  // 공급가액 계산 (VAT 별도)
  const totalAmount = Number(order.total_amount);
  const supplyPrice = Math.floor(totalAmount / 1.1);
  const taxAmount = totalAmount - supplyPrice;
  
  return {
    // 공급자 (인플루언서)
    supplierBusinessNumber: businessInfo.business_number,
    supplierBusinessName: businessInfo.business_name,
    supplierCEO: businessInfo.ceo_name,
    supplierAddress: businessInfo.address,
    supplierBusinessType: businessInfo.business_type,
    supplierBusinessCategory: businessInfo.business_category,
    supplierEmail: businessInfo.email,
    supplierTel: businessInfo.phone,
    
    // 공급받는자 (고객)
    buyerBusinessNumber: order.buyer_business_number,
    buyerBusinessName: order.buyer_business_name || order.user_name,
    buyerCEO: order.buyer_ceo_name,
    buyerAddress: order.shipping_address,
    buyerEmail: order.user_email,
    buyerTel: order.shipping_phone,
    
    // 세금계산서 정보
    writeDate: new Date().toISOString().split('T')[0], // 오늘 날짜
    purposeType: '01', // 영수
    taxType: '01', // 과세
    
    // 품목
    items: orderItems.map(item => {
      const itemTotal = Number(item.price) * Number(item.quantity);
      const itemSupply = Math.floor(itemTotal / 1.1);
      const itemTax = itemTotal - itemSupply;
      
      return {
        name: item.product_name,
        quantity: Number(item.quantity),
        unitPrice: Number(item.price),
        supplyPrice: itemSupply,
        taxAmount: itemTax,
        description: item.option_name || '',
      };
    }),
    
    // 합계
    totalSupplyPrice: supplyPrice,
    totalTaxAmount: taxAmount,
    totalAmount: totalAmount,
    
    // 기타
    memo: `주문번호: ${order.order_number}`,
    orderNo: order.order_number,
  };
}
