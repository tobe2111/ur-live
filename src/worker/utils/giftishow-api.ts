/**
 * 🛡️ 2026-05-18: 기프티쇼 (KT Alpha) B2B API helper.
 *
 *   URL 베이스: https://bizapi.giftishow.com/bizApi
 *
 *   인증 — HTTP Header (Body parameter 아님):
 *     api_code           — API 번호 (예: '0101' 상품 목록)
 *     custom_auth_code   — 발급받은 인증 Key (예: 'DEVd6f005e6ada8425788de70c64ca2ba0c')
 *     custom_auth_token  — 인증 Key 를 별도 암호화 key 로 암호화한 값 (Base64)
 *     dev_flag           — 'Y' (개발) / 'N' (상용)
 *
 *   암호화 방식 (KT Alpha 표준 패턴):
 *     - AES-128/CBC, key + IV 모두 Token Key (Base64 decode 후 16 bytes 사용)
 *     - PKCS#7 padding
 *     - Encrypt(authCode UTF-8 bytes) → Base64 결과가 custom_auth_token
 *     - 매 요청마다 동일 (timestamp 없음) — replay 가능성 있어 보이지만 KT Alpha 표준.
 *
 *   ⚠️ 확정 사양 받는 대로 encryption 함수 교체 (현재는 best-guess 구현).
 *
 *   규칙:
 *     - 전화번호 / 날짜는 '-' 제외 (예: 01012345678, 20160101)
 *     - 통신: HTTPS server-to-server, UTF-8
 *     - 개발 환경: 2종 테스트 상품만 호출 가능 (배너 202006010058067, 카드 202006010057417)
 *     - 개발 환경: 비즈머니 차감 X (잔액 조회는 동일 규격)
 *
 *   환경변수 (Cloudflare secret):
 *     KT_ALPHA_AUTH_CODE       — 인증 Key 평문 (예: 'DEVd6f005e6...')
 *     KT_ALPHA_TOKEN_KEY       — 암호화 key Base64 (예: 'eai/tEM6hCfxnr8yRM1pxw==')
 *                                또는 KT_ALPHA_AUTH_TOKEN 으로 미리 암호화된 토큰 직접 제공
 *     KT_ALPHA_AUTH_TOKEN      — (옵션) 미리 암호화된 토큰. 있으면 매 호출 암호화 skip.
 *     KT_ALPHA_DEV_MODE        — 'Y' (default 'Y' for safety) / 'N'
 *
 *   API 카탈로그 (현 가이드 기준):
 *     0101  POST goods         — 상품 목록 조회
 *     (추가 API — 발송/조회/취소 — 가이드 받는 대로 확장)
 */

const KT_ALPHA_BASE = 'https://bizapi.giftishow.com/bizApi'

/**
 * KT Alpha 에러 코드 매핑 — 사용자에게 보여줄 한국어 메시지.
 *   기프티쇼 API 문서 (v1.04) 기준.
 */
export const KT_ALPHA_ERRORS: Record<string, string> = {
  // HTTP-style
  '200': 'Success',
  '204': '요청 처리됐으나 결과 없음',
  '400': '요청 형식이 틀렸습니다',
  '401': '권한이 없습니다',
  '403': '해당 리소스 접근 거부',
  '405': '허용되지 않는 메서드',
  '414': '요청 URI 가 너무 깁니다',
  '500': 'KT Alpha 서버 내부 오류',
  '503': 'KT Alpha 서비스 일시 중단',
  // Common
  '000': '정상 처리',
  '0000': '정상 처리',
  'ERR0208': '상품 주문 관련 오류',
  'ERR0209': '상품 주문 메시지 관련 오류',
  'ERR0212': 'MMS 재발송 대상 없음',
  'ERR0213': 'MMS 재발송 대상 없음',
  'ERR0217': 'MMS 번호 변경 불가',
  'ERR0300': '회원 정보 조회 실패',
  'ERR0301': 'API 가입 정보 없음',
  'ERR0800': '비즈포인트 조회 오류',
  'ERR0803': '비즈포인트 차감 오류',
  'E0002': 'API 코드가 존재하지 않습니다',
  'E0007': 'API 코드가 일치하지 않습니다',
  'E0008': '유효한 인증 키가 아닙니다',
  'E0009': '유효한 인증 토큰이 아닙니다',
  'E0010': '비즈머니 잔액이 부족합니다',  // 🚨 우리 측 충전 필요
  'E0011': '인증키가 없습니다',
  'E0012': '토큰키가 없습니다',
  'E0013': '테스트 YN 값이 없습니다',
  'E9999': '알 수 없는 오류',
  // Coupon
  'COUPON.0001': '유효한 제목이 아닙니다',
  'COUPON.0002': '유효한 제목이 아닙니다',
  'COUPON.0003': '거래 아이디 (tr_id) 길이 초과',
  'COUPON.0004': '유효한 거래 아이디가 아닙니다',
  'COUPON.0005': '전화번호 (phone_no) 가 없습니다',
  'COUPON.0006': '취소 불가능한 쿠폰입니다',
  'COUPON.0007': '교환된 상품 — 취소 불가',
  'COUPON.0008': '이미 취소된 쿠폰입니다',
  'COUPON.0009': '쿠폰 재전송 실패',
  'COUPON.0010': '유효한 발신번호가 없습니다',
  'COUPON.0011': '유효한 상품 ID 가 없습니다',
  'COUPON.0012': '예약일자가 올바르지 않습니다 (YYYYMMDD)',
  'COUPON.0013': '예약시간이 올바르지 않습니다',
  'COUPON.0014': '예약은 5분 후 ~ 90일까지 가능',
  'COUPON.0015': '중복된 거래 아이디 (tr_id)',
}

export function translateKtAlphaError(code: string, fallback?: string): string {
  return KT_ALPHA_ERRORS[code] || fallback || `KT Alpha 오류 (${code})`
}

export interface KtAlphaEnv {
  KT_ALPHA_AUTH_CODE?: string
  KT_ALPHA_TOKEN_KEY?: string   // Base64 16바이트 (AES-128 key)
  KT_ALPHA_AUTH_TOKEN?: string  // 옵션 — 미리 암호화된 token
  KT_ALPHA_DEV_MODE?: string    // 'Y' / 'N'
}

export interface GiftishowGoodsItem {
  goodsCode: string
  goodsNo: number
  goodsName: string
  brandCode: string
  brandName: string
  brandIconImg?: string
  content?: string
  contentAddDesc?: string
  discountRate: number
  saleDiscountRate?: number
  goodsTypeNm?: string
  goodsTypeDtlNm?: string
  goodsImgS?: string
  goodsImgB?: string
  goodsDescImgWeb?: string
  mmsGoodsImg?: string
  discountPrice: number
  realPrice: number
  salePrice: number
  saleDiscountPrice?: number
  srchKeyword?: string
  validPrdTypeCd?: string  // '01' / '02'
  limitDay?: number        // 유효 일수
  validPrdDay?: string     // 유효 일자 (YYYYMMDD)
  endDate?: string
  goodsComId?: string
  goodsComName?: string
  affliateId?: string
  affiliate?: string
  exhGenderCd?: string
  exhAgeCd?: string
  mmsReserveFlag?: string
  goodsStateCd?: string    // 'SALE' / 'SUS'
  mmsBarcdCreateYn?: string
  sellDisCntCost?: string
  rmCntFlag?: string
  saleDateFlagCd?: string
  category1Seq?: number
  saleDateFlag?: string
  sellDisRate?: number
  rmIdBuyCntFlagCd?: string
  popular?: number
}

export interface GiftishowResponse<T> {
  code: string         // '0000' = 성공
  message: string | null
  result?: T
}

interface GoodsListResult {
  listNum: number
  goodsList: GiftishowGoodsItem[]
}

/**
 * 인증 토큰 생성 — KT Alpha 표준 (추정 — 확정 사양 받는 대로 교체).
 *   1) KT_ALPHA_AUTH_TOKEN env 가 있으면 그대로 사용 (미리 암호화된 값)
 *   2) 없으면 AES-128/CBC 로 authCode 를 tokenKey 로 암호화 (key + IV 동일)
 *
 *   ⚠️ 실제 알고리즘 확정되면 이 함수만 교체.
 */
async function encryptAuthToken(authCode: string, tokenKeyBase64: string): Promise<string> {
  // Base64 → Uint8Array (16 bytes 예상).
  const raw = atob(tokenKeyBase64)
  const keyBytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) keyBytes[i] = raw.charCodeAt(i)
  if (keyBytes.length !== 16 && keyBytes.length !== 24 && keyBytes.length !== 32) {
    throw new Error(`KT_ALPHA_TOKEN_KEY 길이 오류 (${keyBytes.length}) — AES-128/192/256 필요`)
  }

  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, false, ['encrypt'])
  const enc = new TextEncoder().encode(authCode)
  // IV = key 동일 패턴 (KT Alpha 표준 추정). 다르면 확정 사양 받기.
  const ct = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: keyBytes.slice(0, 16) }, key, enc)
  const ctBytes = new Uint8Array(ct)
  // Uint8Array → Base64.
  let bin = ''
  for (let i = 0; i < ctBytes.length; i++) bin += String.fromCharCode(ctBytes[i])
  return btoa(bin)
}

async function resolveAuthToken(env: KtAlphaEnv): Promise<string> {
  if (env.KT_ALPHA_AUTH_TOKEN) return env.KT_ALPHA_AUTH_TOKEN
  if (!env.KT_ALPHA_AUTH_CODE || !env.KT_ALPHA_TOKEN_KEY) {
    throw new Error('KT_ALPHA_AUTH_CODE + KT_ALPHA_TOKEN_KEY (또는 KT_ALPHA_AUTH_TOKEN) 필요')
  }
  return encryptAuthToken(env.KT_ALPHA_AUTH_CODE, env.KT_ALPHA_TOKEN_KEY)
}

/**
 * KT Alpha 공통 호출 함수.
 *
 *   ⚠️ 0101 'goods' API 는 인증을 **body parameter** 로 받음 (HTTP header X).
 *   다른 API 도 동일 패턴 추정 (확정되면 교체).
 *
 *   호출 흐름:
 *     1. resolveAuthToken — 미리 암호화된 토큰 있으면 사용 / 없으면 AES-128/CBC 암호화
 *     2. form-urlencoded POST body 에 api_code/custom_auth_code/custom_auth_token/dev_yn + bodyParams 합쳐서 전송
 *     3. JSON 응답 파싱 + code === '0000' 검사
 */
async function callKtAlpha<T>(
  env: KtAlphaEnv,
  apiCode: string,
  path: string,
  bodyParams: Record<string, string | number>,
  method: 'GET' | 'POST' = 'POST',
): Promise<GiftishowResponse<T>> {
  if (!env.KT_ALPHA_AUTH_CODE) {
    throw new Error('KT_ALPHA_AUTH_CODE env 미설정')
  }
  const url = `${KT_ALPHA_BASE}${path}`
  const dev = env.KT_ALPHA_DEV_MODE === 'N' ? 'N' : 'Y'  // safety default 'Y' (dev)
  const token = await resolveAuthToken(env)

  // 모든 파라미터 합치기 (인증 + 비즈니스).
  const body = new URLSearchParams()
  body.append('api_code', apiCode)
  body.append('custom_auth_code', env.KT_ALPHA_AUTH_CODE)
  body.append('custom_auth_token', token)
  body.append('dev_yn', dev)
  for (const [k, v] of Object.entries(bodyParams)) {
    body.append(k, String(v))
  }

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body: method === 'POST' ? body.toString() : undefined,
  })

  const data = await res.json().catch(() => ({})) as GiftishowResponse<T>
  if (!res.ok) {
    throw new Error(`KT Alpha HTTP ${res.status}: ${data?.message || 'unknown'}`)
  }
  if (data.code !== '0000') {
    throw new Error(`KT Alpha API error ${data.code}: ${data.message || 'unknown'}`)
  }
  return data
}

/**
 * 0101: 상품 목록 조회.
 *   start: 페이지 (1부터)
 *   size: 페이지당 갯수 (기본 20, 최대 미정)
 */
export async function listGoods(
  env: KtAlphaEnv,
  options: { start?: number; size?: number } = {},
): Promise<{ listNum: number; goodsList: GiftishowGoodsItem[] }> {
  const data = await callKtAlpha<GoodsListResult>(env, '0101', '/goods', {
    start: options.start ?? 1,
    size: options.size ?? 20,
  })
  return {
    listNum: data.result?.listNum ?? 0,
    goodsList: data.result?.goodsList ?? [],
  }
}

/**
 * 0111: 상품 상세 정보 조회.
 *   URL path 에 goods_code 포함. 0101 응답에 없는 등급별 가격 (gold/vip/platinum) 포함.
 */
export interface GiftishowGoodsDetail extends GiftishowGoodsItem {
  goldPrice?: number
  vipPrice?: number
  platinumPrice?: number
  goldDiscountRate?: number
  vipDiscountRate?: number
  platinumDiscountRate?: number
  categoryName1?: string
  categorySeq1?: number
  goodsTypeCd?: string
}

export async function getGoodsDetail(
  env: KtAlphaEnv,
  goodsCode: string,
): Promise<GiftishowGoodsDetail | null> {
  const data = await callKtAlpha<{ goodsDetail: GiftishowGoodsDetail }>(
    env, '0111', `/goods/${encodeURIComponent(goodsCode)}`, {},
  )
  return data.result?.goodsDetail ?? null
}

/**
 * 0102: 브랜드 정보 조회.
 *   카테고리 매핑 + 브랜드 아이콘 / 배너 이미지.
 */
export interface GiftishowBrand {
  brandSeq: number
  brandCode: string
  brandName: string
  brandBannerImg?: string
  brandIconImg?: string
  mmsThumImg?: string
  content?: string
  category1Name?: string
  category1Seq?: number
  category2Name?: string
  category2Seq?: number
  sort?: number
}

export async function listBrands(env: KtAlphaEnv): Promise<{ listNum: number; brandList: GiftishowBrand[] }> {
  const data = await callKtAlpha<{ listNum: number; brandList: GiftishowBrand[] }>(
    env, '0102', '/brands', {},
  )
  return {
    listNum: data.result?.listNum ?? 0,
    brandList: data.result?.brandList ?? [],
  }
}

/**
 * 0112: 브랜드 상세 조회.
 *   URL path 에 brand_code.
 */
export async function getBrandDetail(env: KtAlphaEnv, brandCode: string): Promise<GiftishowBrand | null> {
  const data = await callKtAlpha<{ brandDetail: GiftishowBrand }>(
    env, '0112', `/brands/${encodeURIComponent(brandCode)}`, {},
  )
  return data.result?.brandDetail ?? null
}

// ============================================================================
// 거래 (쿠폰) API — 02xx 그룹
//
//   ⚠️ 0201, 0202 는 dev_yn='N' 으로만 설정 가능 (개발 모드 호출 X — 실 거래만).
//   ⚠️ 0201 응답 형식이 다름 — resCode/resMsg 사용 (다른 API 는 code/message).
// ============================================================================

export interface GiftishowCouponInfo {
  goodsCd: string
  goodsNm: string
  brandNm?: string
  mmsBrandThumImg?: string
  cnsmPriceAmt?: string         // 정상판매단가
  sellPriceAmt?: string          // 실판매단가
  senderTelNo?: string
  recverTelNo?: string
  validPrdEndDt?: string         // 유효기간만료일 YYYYMMDDHHMMSS
  sendBasicCd?: string           // 기본번호
  sendRstCd?: string             // 거래번호
  sendRstMsg?: string            // 발송상태코드
  sendStatusCd?: string          // 발송상태명
  correcDtm?: string             // 변경일자 YYYYMMDD
}

/**
 * 0201: 쿠폰 상세 정보 조회.
 *   - tr_id (거래 ID) 로 발급된 쿠폰 정보 + 발송 상태 조회.
 *   - 응답 형식: { couponInfoList, resCode, resMsg } — 다른 API 와 다름.
 *   - dev_yn='N' 으로만 호출 가능.
 */
export async function getCouponInfo(
  env: KtAlphaEnv,
  trId: string,
): Promise<{ resCode: string; resMsg: string; couponInfoList: GiftishowCouponInfo[] }> {
  // dev_yn 강제 N — 다른 호출에서도 안전하게.
  const forceProdEnv = { ...env, KT_ALPHA_DEV_MODE: 'N' }
  if (!forceProdEnv.KT_ALPHA_AUTH_CODE) {
    throw new Error('KT_ALPHA_AUTH_CODE env 미설정')
  }
  const token = await resolveAuthToken(forceProdEnv)

  const body = new URLSearchParams()
  body.append('api_code', '0201')
  body.append('custom_auth_code', forceProdEnv.KT_ALPHA_AUTH_CODE)
  body.append('custom_auth_token', token)
  body.append('dev_yn', 'N')
  body.append('tr_id', trId)

  const res = await fetch(`${KT_ALPHA_BASE}/coupons`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: body.toString(),
  })
  const data = await res.json().catch(() => ({})) as {
    resCode?: string; resMsg?: string; couponInfoList?: GiftishowCouponInfo[]
  }
  if (!res.ok) throw new Error(`KT Alpha 0201 HTTP ${res.status}`)
  if (data.resCode !== '0000') {
    throw new Error(`KT Alpha 0201 error ${data.resCode}: ${data.resMsg || 'unknown'}`)
  }
  return {
    resCode: data.resCode,
    resMsg: data.resMsg || '',
    couponInfoList: data.couponInfoList || [],
  }
}

/**
 * 0202: 쿠폰 취소.
 *   - tr_id + user_id (회원 ID) 필요.
 *   - dev_yn='N' 강제.
 *   - 응답 형식: 표준 (code/message).
 *
 *   주의: 발송 후 일정 기간 이내만 취소 가능 (정책 별도 확인).
 */
export async function cancelCoupon(
  env: KtAlphaEnv,
  params: { trId: string; userId: string },
): Promise<{ code: string; message: string }> {
  const forceProdEnv = { ...env, KT_ALPHA_DEV_MODE: 'N' }
  const data = await callKtAlpha<unknown>(forceProdEnv, '0202', '/cancel', {
    tr_id: params.trId,
    user_id: params.userId,
  })
  return {
    code: data.code,
    message: data.message || '',
  }
}

/**
 * 0203: 쿠폰 재전송.
 *   - tr_id + user_id 필요.
 *   - sms_flag: 'Y'=SMS / 'N'=MMS (default N).
 *   - dev_yn='N' 강제.
 */
export async function resendCoupon(
  env: KtAlphaEnv,
  params: { trId: string; userId: string; smsFlag?: 'Y' | 'N' },
): Promise<{ code: string; message: string }> {
  const forceProdEnv = { ...env, KT_ALPHA_DEV_MODE: 'N' }
  const data = await callKtAlpha<unknown>(forceProdEnv, '0203', '/resend', {
    tr_id: params.trId,
    user_id: params.userId,
    sms_flag: params.smsFlag || 'N',
  })
  return { code: data.code, message: data.message || '' }
}

/**
 * 0204: 쿠폰 발송 요청 — 가장 중요한 API.
 *
 *   결제 완료 → 사용자 핸드폰으로 MMS 쿠폰 발송 (또는 PIN 번호 수신).
 *
 *   gubun:
 *     - 'N' (default) → MMS 발송, 응답에 orderNo
 *     - 'Y' → PIN 번호 수신 (자체 발송 채널 사용 시), 응답에 pinNo + orderNo
 *
 *   tr_id: Unique 거래 ID — 우리가 생성 (예: 'ur-stay-{bookingId}-{timestamp}').
 *   user_id: KT Alpha 회원 ID — 우리 사업자 계정 ID.
 *
 *   주의: dev_yn='N' 강제. 개발 모드 발송 X.
 *   응답이 nested: result.result.{orderNo, pinNo} 패턴.
 */
export async function sendCoupon(
  env: KtAlphaEnv,
  params: {
    goodsCode: string
    phoneNo: string         // '-' 제외 (예: '01012345678')
    callbackNo: string      // '-' 제외 발신번호
    mmsTitle: string        // MMS 제목
    mmsMsg: string          // MMS 내용
    trId: string            // Unique 거래 ID
    userId: string          // KT Alpha 회원 ID
    orderNo?: string        // 우리 측 주문 번호 (옵션)
    revInfoYn?: 'Y' | 'N'   // 예약 발송 여부
    revInfoDate?: string    // 예약일자 YYYYMMDD
    revInfoTime?: string    // 예약시간 HHmm
    templateId?: string     // 카드 ID (테스트: 202006010057417)
    bannerId?: string       // 배너 ID (테스트: 202006010058067)
    gubun?: 'N' | 'Y'       // 'N'=MMS / 'Y'=PIN수신
  },
): Promise<{ code: string; message: string; orderNo?: string; pinNo?: string }> {
  // 입력 검증.
  const phone = params.phoneNo.replace(/\D/g, '')
  if (!/^01\d{8,9}$/.test(phone)) {
    throw new Error(`phoneNo 형식 오류: ${params.phoneNo}`)
  }
  const callback = params.callbackNo.replace(/\D/g, '')
  if (callback.length < 8) {
    throw new Error(`callbackNo 형식 오류: ${params.callbackNo}`)
  }

  const forceProdEnv = { ...env, KT_ALPHA_DEV_MODE: 'N' }
  const body: Record<string, string | number> = {
    goods_code: params.goodsCode,
    mms_title: params.mmsTitle.slice(0, 60),  // KT Alpha 표준 60자 제한
    mms_msg: params.mmsMsg.slice(0, 2000),
    callback_no: callback,
    phone_no: phone,
    tr_id: params.trId,
    user_id: params.userId,
    gubun: params.gubun || 'N',
  }
  if (params.orderNo) body.order_no = params.orderNo
  if (params.revInfoYn) body.rev_info_yn = params.revInfoYn
  if (params.revInfoDate) body.rev_info_date = params.revInfoDate
  if (params.revInfoTime) body.rev_info_time = params.revInfoTime
  if (params.templateId) body.template_id = params.templateId
  if (params.bannerId) body.banner_id = params.bannerId

  // 응답 nested 처리.
  const data = await callKtAlpha<{
    code?: string
    message?: string
    result?: { orderNo?: string; pinNo?: string }
  }>(forceProdEnv, '0204', '/send', body)

  // KT Alpha 의 nested result 패턴 — 외부 code='0000' + 내부 code 도 확인.
  const inner = data.result
  if (inner?.code && inner.code !== '0000') {
    throw new Error(`KT Alpha 0204 inner error ${inner.code}: ${inner.message || 'unknown'}`)
  }
  const innerResult = inner?.result || {}
  return {
    code: data.code,
    message: data.message || '',
    orderNo: innerResult.orderNo,
    pinNo: innerResult.pinNo,
  }
}

// ============================================================================
// 03xx — 계정/비즈머니 그룹
// ============================================================================

/**
 * 0301: 비즈머니 잔액 조회.
 *   - user_id (회원 아이디) 필요.
 *   - dev_yn='N' 강제.
 *   - 응답에 balance (string, 단위 KRW).
 *
 *   호출 시점:
 *     - 어드민 대시보드 자동 fetch (잔액 부족 모니터링)
 *     - 발송 직전 잔액 체크 (옵션)
 *     - 잔액 임계 (예: 50만 원 이하) cron 으로 알림
 */
export async function getBizMoneyBalance(
  env: KtAlphaEnv,
  userId: string,
): Promise<{ code: string; message: string; balance: number }> {
  const forceProdEnv = { ...env, KT_ALPHA_DEV_MODE: 'N' }
  const data = await callKtAlpha<unknown>(forceProdEnv, '0301', '/bizmoney', {
    user_id: userId,
  })
  // KT Alpha 가 result wrapper 없이 balance 를 root 에 둠 — 다른 구조.
  const raw = data as unknown as { code?: string; message?: string; balance?: string | number }
  return {
    code: raw.code || '0000',
    message: raw.message || '',
    balance: Number(raw.balance) || 0,
  }
}

/**
 * 전체 페이지 순회 — sync cron 에서 사용.
 *   기본: 페이지당 100개씩, 최대 50 페이지 (5000개 까지). 안전 한도.
 */
export async function fetchAllGoods(
  env: KtAlphaEnv,
  options: { pageSize?: number; maxPages?: number } = {},
): Promise<GiftishowGoodsItem[]> {
  const pageSize = options.pageSize ?? 100
  const maxPages = options.maxPages ?? 50
  const all: GiftishowGoodsItem[] = []
  for (let page = 1; page <= maxPages; page++) {
    const data = await listGoods(env, { start: page, size: pageSize })
    if (!data.goodsList || data.goodsList.length === 0) break
    all.push(...data.goodsList)
    if (data.goodsList.length < pageSize) break  // 마지막 페이지
  }
  return all
}

/**
 * 응답 item → DB row 변환.
 */
export function goodsItemToCatalogRow(item: GiftishowGoodsItem): Record<string, unknown> {
  return {
    gift_code: item.goodsCode,
    goods_no: item.goodsNo,
    name: item.goodsName,
    brand_code: item.brandCode || null,
    brand_name: item.brandName || null,
    brand_icon_url: item.brandIconImg || null,
    sale_price: Number(item.salePrice) || 0,
    discount_price: Number(item.discountPrice) || 0,
    real_price: Number(item.realPrice) || 0,
    discount_rate: Number(item.discountRate) || 0,
    image_url_small: item.goodsImgS || null,
    image_url_large: item.goodsImgB || null,
    desc_image_url: item.goodsDescImgWeb || null,
    goods_type_name: item.goodsTypeNm || null,
    goods_type_detail: item.goodsTypeDtlNm || null,
    category_seq: Number(item.category1Seq) || null,
    affiliate_id: item.affliateId || null,
    affiliate_name: item.affiliate || null,
    valid_period_type: item.validPrdTypeCd || null,
    valid_period_days: item.limitDay ? Number(item.limitDay) : null,
    valid_period_until: item.validPrdDay || null,
    goods_state: item.goodsStateCd || 'SALE',
    is_active: item.goodsStateCd === 'SALE' ? 1 : 0,
    search_keywords: item.srchKeyword || null,
    content: item.content || null,
    content_add_desc: item.contentAddDesc || null,
    popular: Number(item.popular) || 0,
  }
}
