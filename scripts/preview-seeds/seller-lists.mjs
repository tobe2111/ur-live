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
  // 🎟️ 2026-10-07 — 이용권 주문 둘(미사용 1 · 다 씀 1). `order-list-enrich` 가 붙이는 `order_kind`·`vouchers` 모양.
  //   이게 없으면 주문 탭의 [사용 전] 을 미리보기로 볼 수 없다(택배 주문만 있는 매장처럼 그려진다).
  {
    id: 10231, order_number: 'UR-20260930-0007', user_id: 11, total_amount: 18_000,
    status: 'DONE', shipping_name: null, shipping_phone: null, shipping_address: null,
    tracking_number: null, courier: null, payment_method: 'deal_points', payment_status: 'approved',
    created_at: '2026-09-30 03:20:00', updated_at: '2026-09-30 03:20:00',
    user_name: '이용권손님', user_email: 'guest@example.com',
    order_kind: 'voucher', items: [{ id: 1, product_id: 501, product_name: '치즈돈가스 2인 이용권', image_url: null, quantity: 1, price: 18_000 }],
    vouchers: [{ code: 'UR-LUBA-RCP5', status: 'unused', used_at: null, expires_at: '2026-12-31 14:59:59' }],
  },
  {
    id: 10230, order_number: 'UR-20260929-0101', user_id: 12, total_amount: 9_000,
    status: 'DONE', shipping_name: null, shipping_phone: null, shipping_address: null,
    tracking_number: null, courier: null, payment_method: 'toss', payment_status: 'approved',
    created_at: '2026-09-29 05:00:00', updated_at: '2026-09-29 08:00:00',
    user_name: '다쓴손님', user_email: null,
    order_kind: 'voucher', items: [{ id: 2, product_id: 502, product_name: '아메리카노 이용권', image_url: null, quantity: 1, price: 9_000 }],
    vouchers: [{ code: 'UR-QWER-1234', status: 'used', used_at: '2026-09-29 08:00:00', expires_at: null }],
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

/**
 * 🗓️ 날짜는 **오늘 기준 상대값**이다 — 고정 날짜를 쓰면 달이 넘어가는 순간 조용히 0 이 된다.
 *
 * 🩸 2026-10-01 에 실제로 그랬다: 이 `daily_revenue` 가 `2026-09-XX` 로 박혀 있었는데
 *   이용권 화면은 `monthRevenue(daily)`(`useSellerHome.ts:61`)로 **이번 달 키만** 더한다.
 *   10월 1일이 되자 `이번 달 ₩0` 이 떴다 — 시드는 멀쩡해 보이는데 숫자만 0 이라
 *   "판매 0" 으로 오판한다(= 1차가 빈 화면에 초록을 준 것과 같은 클래스).
 */
const kstDayKey = (back) => new Date(Date.now() + 9 * 3600_000 - back * 86400_000).toISOString().slice(0, 10)
const DAILY = [320_000, 1_180_000, 0, 940_000, 48_000, 9_900, 12_480_000]

export const SELLER_DASHBOARD_STATS = {
  today_orders: 3, today_revenue: 12_537_900, total_products: 24, active_products: 21,
  total_streams: 0, live_streams: 0,
  // 오늘로 끝나는 7일 — 적어도 하루는 이번 달이라 `이번 달` 칸이 0 이 될 수 없다.
  daily_revenue: DAILY.map((revenue, i) => ({ date: kstDayKey(DAILY.length - 1 - i), revenue })),
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
 * 🩸 **1차 시드도 얇았다** (2026-10-01, 이 파일을 만든 바로 그날).
 *
 * 결재문이 적어 둔 목록(`/orders` · `/settlements` · `/settlements/stats` · `/dashboard/stats` ·
 * `/settlement-options` · 이용권 · 알림톡)만 목했더니 `/seller/settlements` 화면이 여전히
 * *"아직 자동 정산 내역이 없습니다"* · 미지급 0 · 지급예정 0 이었다 — **그 화면의 주 숫자는
 * `/api/seller/payouts` 에서 온다.** 소스를 다시 읽고 넷을 더 담는다.
 *
 * ⇒ 교훈이 또 한 겹: *"결재문이 센 API 목록"* 도 실측이 아니다. **화면 소스에서 뽑아야** 한다.
 */
export const SELLER_PAYOUTS = {
  payable: 11_793_600,
  held: 9_900_000,
  hold_days: 14,
  scheduled_total: 926_100,
  sent_total: 12_719_700,
  auto: true,
  scope: 'owner',
  since: null,
  payouts: [
    {
      id: 41, amount: 926_100, period_start: '2026-09-14', period_end: '2026-09-20',
      status: 'approved', account_number: '카카오뱅크 3333-01-1234567', account_holder: '정지원',
      admin_memo: null, created_at: '2026-09-21 00:10:00', approved_at: '2026-09-22 09:00:00', sent_at: null,
    },
    {
      id: 40, amount: 12_719_700, period_start: '2026-09-07', period_end: '2026-09-13',
      status: 'sent', account_number: '카카오뱅크 3333-01-1234567', account_holder: '정지원',
      admin_memo: '정상 송금 (영업일 D+7)', created_at: '2026-09-14 00:10:00',
      approved_at: '2026-09-15 09:00:00', sent_at: '2026-09-24 14:30:00',
    },
  ],
}

/** 매장(오프라인 이용권) 정산 — 수동 레일. */
export const SELLER_RESTAURANT_SETTLEMENTS = [
  {
    id: 12, seller_id: 1, period_start: '2026-09-21', period_end: '2026-09-27',
    total_amount: 980_000, commission_amount: 53_900, settlement_amount: 926_100,
    status: 'pending', created_at: '2026-09-28 00:10:00', paid_at: null,
  },
]

export const SELLER_TAX_SUMMARY = {
  year: 2026, total_sales: 142_300_000, total_commission: 7_826_500,
  total_settled: 134_473_500, withholding_total: 0, invoice_count: 9,
}

export const SELLER_TAX_INVOICES = [
  {
    id: 3, period_start: '2026-09-01', period_end: '2026-09-30', amount: 7_826_500,
    status: 'pending', issued_at: null, approved_at: null, created_at: '2026-10-01 00:05:00',
  },
]

/**
 * 🩸 **세 번째로 빠진 것** — 이 파일의 가드(`seller-list-fixtures-2026-10-01`)가 바로 잡았다.
 *   `/api/seller/voucher-catalog`(딜 잔액을 교환권으로 받는 화면). 손으로 센 목록은 **세 번 다** 모자랐다
 *   — 그래서 목록을 **화면 소스에서 뽑는** 가드를 같이 둔다.
 */
export const SELLER_VOUCHER_CATALOG = [
  {
    gift_code: 'G0001', name: '스타벅스 아메리카노 T', brand_name: '스타벅스',
    brand_icon_url: null, sale_price: 4_500, real_price: 4_900, discount_rate: 8,
    image_url_small: null, image_url_large: null,
    valid_period_type: 'DAYS', valid_period_days: 90, goods_type_detail: '음료',
  },
  {
    gift_code: 'G0002', name: '배스킨라빈스 패밀리 아이스크림 (쿼터 · 토핑 2종 포함 · 매장 수령 전용)',
    brand_name: '배스킨라빈스', brand_icon_url: null,
    sale_price: 19_800, real_price: 22_000, discount_rate: 10,
    image_url_small: null, image_url_large: null,
    valid_period_type: 'DAYS', valid_period_days: 30, goods_type_detail: '아이스크림',
  },
]

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
    '/api/seller/payouts': () => ({ success: true, data: empty ? { ...SELLER_PAYOUTS, payable: 0, held: 0, scheduled_total: 0, sent_total: 0, payouts: [] } : SELLER_PAYOUTS }),
    '/api/seller/restaurant-settlements': () => ({ success: true, data: empty ? [] : SELLER_RESTAURANT_SETTLEMENTS }),
    '/api/seller/tax-summary': () => ({ success: true, data: SELLER_TAX_SUMMARY }),
    '/api/seller/settlement-tax-invoices': () => ({ success: true, data: empty ? [] : SELLER_TAX_INVOICES }),
    '/api/seller/voucher-catalog': () => ({ success: true, data: empty ? [] : SELLER_VOUCHER_CATALOG }),
    '/api/seller/stays': () => ({ success: true, data: empty ? [] : SELLER_STAYS }),
    '/api/seller/profile': () => ({ success: true, data: SELLER_PROFILE, seller: SELLER_PROFILE }),
    // PIN 게이트는 **열어 둔다** — 안 열면 시트가 PIN 화면에서 멈춰 또 빈 화면을 재게 된다.
    '/api/seller/pin-status': () => ({ success: true, data: { has_pin: true, verified: true }, has_pin: true, verified: true }),
    // 🔎 봉투는 **소비자 쪽**에서 읽었다 — `CollabCodesSection.tsx:36` 이 `r.data.data.codes` 를 본다.
    //    합치는 중에 한 번 틀려(최상위 spread) 코드 목록이 `아직 코드가 없어요` 로 떴다. 서버 코드만
    //    보면 `codes:` 가 최상위처럼 읽히는데, 그건 `success(c, { codes })` 로 한 겹 더 감싸이기 때문이다.
    '/api/seller-marketing/codes': () => ({ success: true, data: empty ? { codes: [], influencer_pct_cap: SELLER_MKT_CODES.influencer_pct_cap } : SELLER_MKT_CODES }),
    '/api/seller-marketing/deals': () => ({ success: true, data: empty ? [] : SELLER_MKT_DEALS }),
    '/api/seller/products': () => ({ success: true, data: empty ? [] : SELLER_PRODUCTS, pagination: { total: empty ? 0 : SELLER_PRODUCTS.length, limit: 50, offset: 0, has_more: false } }),
  }
  const base = path.split('?')[0]
  const hit = T[base]
  return hit ? hit() : null
}

/** 이 시드가 덮는 경로 — 가드가 "시트가 부르는 API 를 다 목하는가" 를 이것으로 판정한다. */
/**
 * 🤝 인플 협업(`/seller/influencer-deals`) · 🎟️ 이용권 관리(`/seller/group-buy`) 시드.
 *
 * 🩸 2026-10-01 — **같은 일을 하는 시드 기제가 둘이 됐다가 여기로 합쳤다.** 두 세션이 같은 날
 *   각자 셀러 목록 시드를 만들었다(`--seller-lists` 이 모듈 ↔ `--seller-work` 하네스 인라인).
 *   응답 모양을 두 벌로 들고 있으면 **서로 다른 화면을 재고도 둘 다 초록**이 된다 —
 *   이 레포가 "같은 일에 화면이 둘" 로 반복해 당한 그 클래스다. ⇒ 데이터는 이 모듈 하나.
 *
 * 📐 모양 출처(추측 아님): `marketing/collab-codes.ts:70`(codes) · `marketing.routes.ts:429`(deals) ·
 *   `seller-products-query.ts:53`(목록 컬럼) + `seller-orders.routes.ts:518`(봉투).
 * ⚠️ 여기서도 **폰에서 깨지는 값**을 일부러 넣는다 — 긴 상품명·`null` 사진·만료된 코드·큰 숫자.
 */
export const SELLER_MKT_CODES = {
  codes: [
    { code: 'UR7K2M9Q', display: 'UR7K-2M9Q', join_url: 'https://urdeal.kr/i/join/UR7K2M9Q',
      seller_id: 1, kind: 'influencer', commission_pct: 12.5, requires_approval: 1,
      label: '가을 신메뉴 협업 — 연남·망원 지역 한정 모집(10월)', created_by: 1,
      created_at: '2026-09-20 10:00:00', expires_at: '2026-10-31 23:59:59', revoked_at: null,
      use_count: 1234, max_uses: 10000 },
    { code: 'UR3F8T1W', display: 'UR3F-8T1W', join_url: 'https://urdeal.kr/i/join/UR3F8T1W',
      seller_id: 1, kind: 'influencer', commission_pct: 5, requires_approval: 0,
      label: null, created_by: 1, created_at: '2026-08-02 09:00:00',
      expires_at: '2026-09-01 00:00:00', revoked_at: null, use_count: 0, max_uses: null },
  ],
  influencer_pct_cap: 15,
}

export const SELLER_MKT_DEALS = [
  { id: 11, influencer_id: 'inf_0001', commission_pct: 12.5, starts_at: '2026-10-01', ends_at: '2026-10-31',
    status: 'proposed', proposed_by: 'influencer',
    message: '연남동 버거 가게 소개 영상 찍고 싶어요! 팔로워 3.2만, 음식 리뷰 위주로 올리고 있습니다.',
    created_at: '2026-09-29 18:20:00', responded_at: null,
    requires_content_proof: 1, proof_url: null, proof_status: 'pending' },
  { id: 12, influencer_id: 'inf_0002', commission_pct: 5, starts_at: '2026-09-01', ends_at: '2026-09-30',
    status: 'accepted', proposed_by: 'seller', message: null,
    created_at: '2026-08-28 11:00:00', responded_at: '2026-08-29 09:30:00',
    requires_content_proof: 0, proof_url: null, proof_status: null },
]

export const SELLER_PRODUCTS = [
  { id: 7001, name: LONG_ITEM, description: '수제 도우로 만든 버거에 크래프트비어를 더한 2인 세트입니다.',
    price: 32_000, stock: 0, image_url: null, status: 'ACTIVE', is_active: 1,
    category: 'meal_voucher', created_at: '2026-09-01 12:00:00', updated_at: '2026-09-30 12:00:00',
    original_price: 45_000, restaurant_name: LONG_STORE, restaurant_phone: '02-1234-5678',
    store_owner_token: null, group_buy_current: 1284, group_buy_status: 'active',
    order_count: 1284, total_revenue: 41_088_000 },
  { id: 7002, name: '아메리카노 1잔', description: null, price: 2_500, stock: 999, image_url: null,
    status: 'ACTIVE', is_active: 1, category: 'meal_voucher',
    created_at: '2026-09-15 09:00:00', updated_at: '2026-09-15 09:00:00',
    original_price: 4_500, restaurant_name: '연남 카페', restaurant_phone: null,
    store_owner_token: null, group_buy_current: 0, group_buy_status: 'ended',
    order_count: 0, total_revenue: 0 },
]

export const SELLER_LIST_PATHS = Object.freeze([
  '/api/seller/orders',
  '/api/seller/payouts',
  '/api/seller/restaurant-settlements',
  '/api/seller/tax-summary',
  '/api/seller/settlement-tax-invoices',
  '/api/seller/voucher-catalog',
  '/api/seller/settlements',
  '/api/seller/settlements/stats',
  '/api/seller/dashboard/stats',
  '/api/seller/settlement-options',
  '/api/seller/deal-balance',
  '/api/seller/alimtalk/credits',
  '/api/seller/alimtalk/logs',
  '/api/seller/stays',
  '/api/seller-marketing/codes',
  '/api/seller-marketing/deals',
  '/api/seller/products',
  '/api/seller/profile',
  '/api/seller/pin-status',
])
