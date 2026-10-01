/**
 * 🪑 **셀러 목록 API 시드** — 마이의 판매 시트 일곱을 폰 폭에서 실제로 재기 위한 픽스처.
 *
 * 결재: `docs/decisions/2026-09-28-my-stage2-sheet-teardown.md`
 * (대표 2026-09-30 "측정부터 (권장)" → 2026-10-01 "최대한 이상적으로 다 해줘").
 *
 * ## 왜 필요한가 — 1차 측정이 **빈 화면을 재서** 헛돌았다
 *
 * `--phone-audit` 로 대시보드 일곱을 430px 로 재니 여섯 개가 **"🟢 깨끗"** 으로 나왔다.
 * 본문을 찍어 보니 `"… 해당하는 주문이 없어요"` — 빈 목록은 당연히 가로스크롤 0 · 잘린 글자 0 이다.
 * 하네스가 목하던 셀러 API 는 `analytics/*` 둘과 `my-stores/summary` 셋뿐이었고, 시트가 실제로
 * 부르는 목록 API 는 **하나도 없어서** 전부 404 → 빈 목록이었다.
 *
 * ## 🩸 얇은 픽스처는 "없는 결함"을 만든다 (이 레포가 세 번 당했다)
 *
 * `visual-preview.mjs` 머리말이 2026-08-31 에 그 교훈을 적어 뒀다 — 유어샵 픽스처에
 * `avg_rating`·`restaurant_name` 이 빠져 카드가 2줄로 렌더됐고, 그걸 보고 *"유어샵 카드가 홈보다
 * 정보가 적다"* 고 보고할 뻔했다. ⇒ 여기 값은 **서버가 실제로 주는 필드 전부**를 담고,
 * 결재문이 요구한 대로 **폰에서 깨지는 값을 일부러** 넣는다:
 *
 *   · 긴 매장명/상품명(줄바꿈·말줄임 판정) · 7~8자리 금액(칸 넘침) · 빈 필드(`null`) ·
 *     긴 주소 · 긴 수취인 전화 · 실패 로그(빨간 배지) · 상태 다양화(배지 폭)
 *
 * ⚠️ **이건 디자인을 보기 위한 도구다.** 권한·금액 정확성 검증에 쓰지 말 것 —
 *    가짜 서버는 전부 200 을 준다.
 *
 * 응답 모양 출처(2026-10-01 소스 실측):
 *   `/orders`            `seller-orders.routes.ts:109` SELECT + `{data, pagination}`
 *   `/settlements`       `seller-settlements.routes.ts:63` richCols + `{data, total}`
 *   `/settlements/stats` 같은 파일 `defaultStats` 8키
 *   `/dashboard/stats`   같은 파일 7키(+`daily_revenue[]`)
 *   `/settlement-options` 같은 파일 `{business_registration, preferred_method, available_amount, methods}`
 *   `/deal-balance`      같은 파일 7키
 *   `/alimtalk/credits`  `features/alimtalk/api/alimtalk.routes.ts:118` `{balance, packages, history}`
 *   `/alimtalk/logs`     같은 파일 `data: [...]`
 */

/** 폰에서 깨지기 쉬운 값들 — 일부러 넣는다. */
const LONG_STORE = '연남동 수제버거 앤 크래프트비어 하우스 본점'
const LONG_ITEM = '[단독특가] 수제버거 2개 + 수제감자튀김 + 크래프트비어 2잔 세트 (평일 한정)'

export const SELLER_ORDERS = [
  {
    id: 10234, order_number: 'UR-20260930-0001', user_id: 3, total_amount: 12_480_000,
    status: 'PAID', shipping_name: '정지원', shipping_phone: '010-1234-5678',
    shipping_address: '서울특별시 마포구 연남로 21길 35, 1층 101호 (연남동, 연남빌딩)',
    tracking_number: null, courier: null, payment_method: 'toss', payment_status: 'approved',
    created_at: '2026-09-30 02:11:04', updated_at: '2026-09-30 02:11:04',
    user_name: '정지원', user_email: 'jiwon@example.com',
  },
  {
    id: 10233, order_number: 'UR-20260929-0042', user_id: 7, total_amount: 9_900,
    status: 'SHIPPING', shipping_name: '김', shipping_phone: '010-0000-0000',
    shipping_address: '부산 해운대구 센텀중앙로 97',
    tracking_number: '1234567890123', courier: 'CJ대한통운',
    payment_method: 'CARD', payment_status: 'approved',
    created_at: '2026-09-29 11:40:00', updated_at: '2026-09-30 01:02:00',
    user_name: null, user_email: null,            // ← 빈 필드(COALESCE 폴백 경로)
  },
  {
    id: 10232, order_number: 'UR-20260928-0310', user_id: 9, total_amount: 48_000,
    status: 'REFUNDED', shipping_name: '박하늘별님구름햇님보다사랑스러우리', shipping_phone: '010-5555-6666',
    shipping_address: '제주특별자치도 서귀포시 중문관광로 72번길 29-8',
    tracking_number: null, courier: null, payment_method: 'deal_points', payment_status: 'refunded',
    created_at: '2026-09-28 20:05:00', updated_at: '2026-09-29 09:00:00',
    user_name: '박하늘별님구름햇님보다사랑스러우리', user_email: 'very.long.email.address.for.testing@example-domain.co.kr',
  },
]

export const SELLER_SETTLEMENTS = [
  {
    id: 88, seller_id: 1, total_sales: 12_480_000, commission_amount: 686_400, commission_rate: 5.5,
    settlement_amount: 11_793_600, period_start: '2026-09-21', period_end: '2026-09-27',
    requested_at: '2026-09-28 00:10:00', status: 'pending',
  },
  {
    id: 87, seller_id: 1, total_sales: 980_000, commission_amount: 53_900, commission_rate: 5.5,
    settlement_amount: 926_100, period_start: '2026-09-14', period_end: '2026-09-20',
    requested_at: '2026-09-21 00:10:00', status: 'paid',
  },
  {
    id: 86, seller_id: 1, total_sales: 0, commission_amount: 0, commission_rate: 0,
    settlement_amount: 0, period_start: '2026-09-07', period_end: '2026-09-13',
    requested_at: '2026-09-14 00:10:00', status: 'rejected',
  },
]

export const SELLER_SETTLEMENT_STATS = {
  total_settled: 12_719_700, pending_amount: 11_793_600, approved_amount: 0, paid_amount: 926_100,
  total_pending: 1, total_approved: 0, total_paid: 1, total_requests: 3,
}

export const SELLER_DASHBOARD_STATS = {
  today_orders: 3, today_revenue: 12_537_900, total_products: 24, active_products: 21,
  total_streams: 0, live_streams: 0,
  daily_revenue: [
    { date: '2026-09-24', revenue: 320_000 }, { date: '2026-09-25', revenue: 1_180_000 },
    { date: '2026-09-26', revenue: 0 }, { date: '2026-09-27', revenue: 940_000 },
    { date: '2026-09-28', revenue: 48_000 }, { date: '2026-09-29', revenue: 9_900 },
    { date: '2026-09-30', revenue: 12_480_000 },
  ],
}

export const SELLER_SETTLEMENT_OPTIONS = {
  business_registration: {
    status: 'verified',
    image_url: null,
    reject_reason: null,
    business_number: '123-45-67890',
  },
  preferred_method: 'auto',
  available_amount: 11_793_600,
  methods: {
    cash: {
      available: true, label: '현금 (계좌 입금)',
      description: '사업자등록 완료 — 신청 후 영업일 D+7 입금', withholding_rate: 0,
    },
    voucher: {
      available: true, label: '이용권(딜) 적립',
      description: '즉시 적립 · 플랫폼 내 사용', withholding_rate: 0,
    },
  },
}

export const SELLER_DEAL_BALANCE = {
  gated_deal_amount: 420_000,
  redeemable_deal_amount: 1_850_000,
  total: 2_270_000,
  business_verified: true,
  withdrawable: 1_850_000,
  notice: '환급 시 8.8% 원천징수 후 계좌 입금',
}

export const SELLER_ALIMTALK_CREDITS = {
  balance: 1_240,
  packages: [
    { id: 1, label: '1,000건', credits: 1000, price: 11_000, is_active: 1, sort_order: 1 },
    { id: 2, label: '5,000건', credits: 5000, price: 49_500, is_active: 1, sort_order: 2 },
    { id: 3, label: '20,000건 (대량 발송 · 부가세 포함 · 유효기간 1년)', credits: 20000, price: 176_000, is_active: 1, sort_order: 3 },
  ],
  history: [
    { id: 31, type: 'charge', amount: 5000, price_paid: 49_500, description: '5,000건 패키지 충전', created_at: '2026-09-20 10:00:00' },
    { id: 30, type: 'use', amount: -1, price_paid: null, description: '주문 확정 알림 발송', created_at: '2026-09-30 02:11:06' },
  ],
}

export const SELLER_ALIMTALK_LOGS = [
  {
    id: 912, receiver: '010-1234-5678', template_code: 'UR_ORDER_PAID',
    message: `[유어딜] ${LONG_STORE}\n주문이 확정되었습니다. ${LONG_ITEM}`,
    order_id: 10234, success: 1, error_msg: null, created_at: '2026-09-30 02:11:06',
  },
  {
    id: 911, receiver: '010-0000-0000', template_code: 'UR_SHIPPING',
    message: '[유어딜] 배송이 시작되었습니다.', order_id: 10233, success: 0,
    error_msg: '수신 거부된 번호입니다 (ALIGO-401: 수신자 수신거부 상태)',
    created_at: '2026-09-30 01:02:03',
  },
]

export const SELLER_STAYS = [
  {
    id: 5, name: LONG_STORE, address: '강원특별자치도 양양군 현북면 하조대해안길 13-4',
    price: 180_000, is_active: 1, rooms: 3, thumbnail: null,
  },
]

export const SELLER_PROFILE = {
  id: 1, username: 'preview', business_name: LONG_STORE, seller_type: 'store_owner',
  status: 'approved', email: 'store@example.com', phone: '010-1234-5678',
  bank_account: '카카오뱅크 3333-01-1234567', account_holder: '정지원',
  commission_rate: 5.5, business_number: '123-45-67890',
}

/**
 * 하네스의 가짜 서버가 쓰는 라우팅 표. `empty` 면 **빈 목록**을 준다 — 두 상태를 모두 봐야 한다
 * (빈 화면은 1차 측정이 이미 봤고, 그게 "🟢 깨끗" 오판의 원인이었다).
 */
export function sellerListResponse(path, mode = 'full') {
  const empty = mode === 'empty'
  const T = {
    '/api/seller/orders': () => ({ success: true, data: empty ? [] : SELLER_ORDERS, pagination: { total: empty ? 0 : SELLER_ORDERS.length, limit: 50, offset: 0, has_more: false } }),
    '/api/seller/settlements': () => ({ success: true, data: empty ? [] : SELLER_SETTLEMENTS, total: empty ? 0 : SELLER_SETTLEMENTS.length }),
    '/api/seller/settlements/stats': () => ({ success: true, data: empty ? { total_settled: 0, pending_amount: 0, approved_amount: 0, paid_amount: 0, total_pending: 0, total_approved: 0, total_paid: 0, total_requests: 0 } : SELLER_SETTLEMENT_STATS }),
    '/api/seller/dashboard/stats': () => ({ success: true, data: empty ? { ...SELLER_DASHBOARD_STATS, today_orders: 0, today_revenue: 0, daily_revenue: [] } : SELLER_DASHBOARD_STATS }),
    '/api/seller/settlement-options': () => ({ success: true, data: SELLER_SETTLEMENT_OPTIONS }),
    '/api/seller/deal-balance': () => ({ success: true, data: empty ? { ...SELLER_DEAL_BALANCE, gated_deal_amount: 0, redeemable_deal_amount: 0, total: 0, withdrawable: 0 } : SELLER_DEAL_BALANCE }),
    '/api/seller/alimtalk/credits': () => ({ success: true, data: empty ? { balance: 0, packages: SELLER_ALIMTALK_CREDITS.packages, history: [] } : SELLER_ALIMTALK_CREDITS }),
    '/api/seller/alimtalk/logs': () => ({ success: true, data: empty ? [] : SELLER_ALIMTALK_LOGS }),
    '/api/seller/stays': () => ({ success: true, data: empty ? [] : SELLER_STAYS }),
    '/api/seller/profile': () => ({ success: true, data: SELLER_PROFILE, seller: SELLER_PROFILE }),
    // PIN 게이트는 **열어 둔다** — 안 열면 시트가 PIN 화면에서 멈춰 또 빈 화면을 재게 된다.
    '/api/seller/pin-status': () => ({ success: true, data: { has_pin: true, verified: true }, has_pin: true, verified: true }),
  }
  const base = path.split('?')[0]
  const hit = T[base]
  return hit ? hit() : null
}

/** 이 시드가 덮는 경로 — 가드가 "시트가 부르는 API 를 다 목하는가" 를 이것으로 판정한다. */
export const SELLER_LIST_PATHS = Object.freeze([
  '/api/seller/orders',
  '/api/seller/settlements',
  '/api/seller/settlements/stats',
  '/api/seller/dashboard/stats',
  '/api/seller/settlement-options',
  '/api/seller/deal-balance',
  '/api/seller/alimtalk/credits',
  '/api/seller/alimtalk/logs',
  '/api/seller/stays',
  '/api/seller/profile',
  '/api/seller/pin-status',
])
