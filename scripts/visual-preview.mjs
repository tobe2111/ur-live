#!/usr/bin/env node
/**
 * 🖼️ 시각 변경을 **머지 전에** 눈으로 확인한다 (2026-08-30 신설)
 *
 * ■ 왜 만들었나 — 실제로 막혔던 일
 *   소비자 앱(ur-live)은 **PR 프리뷰가 없다.** PR 에 붙는 Cloudflare 프리뷰는
 *   `ur-wholesale`(도매몰 전용 Pages 프로젝트, WHOLESALE_BUNDLE=1)뿐이라
 *   소비자 화면 변경은 main 에 머지해야만 눈에 보였다. 그래서 디자인 변경이
 *   "머지하고 라이브에서 확인 → 이상하면 롤백" 밖에 길이 없었다.
 *   라이브(urdeal.kr)를 브라우저로 직접 여는 것도 이 원격 환경에선 막힌다
 *   (프록시 릴레이가 Chromium 의 TLS 터널을 끊는다 — curl 은 되는데 브라우저는 안 된다).
 *
 * ■ 무엇을 하나
 *   빌드 산출물(dist/client)을 로컬에 띄우고, **앱 자신의 SSR 시드 경로**
 *   (`__SSR_INITIAL_*`)로 데이터를 주입해 실제 React 컴포넌트를 API 없이 렌더한다.
 *   그래서 나오는 그림은 손으로 그린 시안이 아니라 **지금 코드가 실제로 그리는 화면**이다.
 *
 * ■ 쓰는 법
 *   npm run build                      # 먼저 빌드 (dist/client 필요)
 *   node scripts/visual-preview.mjs                        # 기본: 유어샵
 *   node scripts/visual-preview.mjs --route=/vouchers      # 다른 경로
 *   node scripts/visual-preview.mjs --css="body{...}"      # 변형안 주입해 비교
 *   node scripts/visual-preview.mjs --dark                 # 다크 테마
 *   → out/visual/<이름>.png
 *
 * ■ 한계 (과신 금지)
 *   - 외부 리소스(Pretendard CDN·카카오 SDK·이미지 CDN)는 차단하고 렌더한다.
 *     따라서 **폰트가 시스템 폰트로 떨어진다** — 자간·행간 판단에는 쓰지 말 것.
 *     색·간격·그림자·테두리·레이아웃 판단에는 유효하다.
 *   - 시드로 넣은 데이터는 합성이다. 실데이터의 긴 이름/빈 필드는 여기서 안 보인다.
 *   - 워커(HTMLRewriter·SSR 메타·엣지 캐시)는 타지 않는다. 클라 렌더만이다.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist/client')
const OUTDIR = path.join(ROOT, 'out/visual')
const PORT = 8788

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/)
    return m ? [m[1], m[2] ?? true] : [a, true]
  }),
)
const ROUTE = typeof args.route === 'string' ? args.route : '/u/jiwon1228'
/**
 * 🔢 `--pins=N` — 진열대 개수를 바꿔 **경계 동작**을 눈으로 본다.
 *   2026-08-31 에 유어샵 검색창을 `핀 12개 이상일 때만` 으로 바꿨는데, 라이브에는 12개짜리
 *   진열대가 하나도 없어 실물로 확인할 방법이 없었다(최다 4개). 경계는 눈으로 봐야 한다.
 */
const PINS_N = (() => {
  const a = process.argv.find((x) => x.startsWith('--pins='))
  return a ? Math.max(0, parseInt(a.slice('--pins='.length), 10) || 0) : 0
})()
const NAME = typeof args.name === 'string' ? args.name : ROUTE.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'page'
const EXTRA_CSS = typeof args.css === 'string' ? args.css : ''
const DARK = !!args.dark
const HEIGHT = Number(args.height) || 1200
/**
 * 🔐 `--auth=seller|user` — 로그인 뒤 화면을 보기 위한 시딩.
 *   대시보드 가드(`RouteGuards.isDashboardTokenUsable`)는 **점 3개짜리 JWT 가 아니면
 *   관대 통과**시킨다(비표준 토큰 허용). 그래서 평범한 문자열이면 충분하다 —
 *   서버 인증을 우회하는 게 아니라, 이 프리뷰의 가짜 서버가 어차피 전부 200 을 준다.
 *   ⚠️ 이건 **디자인을 보기 위한 도구**다. 권한·보안 동작 검증에 쓰지 말 것.
 */
const AUTH = typeof args.auth === 'string' ? args.auth : ''

/** 유어샵(`/u/:handle`) 시드 — 실제 CuratorPageResponse 모양. */
/**
 * ⚠️ 2026-08-31 — **이 팩토리가 얇아서 오진이 났다.** `avg_rating`·`discount_rate`·
 *   `restaurant_name` 이 빠져 있어 유어샵 카드가 2줄로 렌더됐고, 나는 그걸 보고
 *   "유어샵 카드가 홈보다 정보가 적다" 고 대표에게 보고할 뻔했다. 실제로는
 *   **같은 `GroupBuyFeedCard`** 이고(2026-08-27 통합), 줄이 준 건 데이터가 없어서였다.
 *   ⇒ 픽스처는 **서버가 실제로 주는 필드 전부**를 담아야 한다. 얇은 픽스처는
 *      "없는 결함"을 만들어 낸다 — 이 세션에서만 세 번 그럴 뻔했다.
 */
const pin = (id, name, price, was, category, merchant, addr, rating, reviews) => ({
  id, product_id: id, position: id, note: null, click_count: 0,
  product_name: name, image_url: null, thumbnail: null,
  price, original_price: was, category, is_active: 1, commission_rate: 5,
  discount_rate: was ? Math.round((1 - price / was) * 100) : 0,
  dominant_color: '#E8DED6',
  avg_rating: rating, review_count: reviews, sold_count: 0,
  restaurant_name: merchant, restaurant_address: addr,
  seller_id: 1, deal_only: 0,
})
const CURATOR_SEED = {
  success: true,
  curator: {
    id: 1, handle: ROUTE.split('/u/')[1] || 'jiwon1228', name: '정지원',
    bio: '연남·망원에서 직접 가 보고 괜찮았던 곳만 올립니다. 주로 저녁 술집과 동네 빵집.',
    profile_image: null, banner_url: null, headline: null, accent: null,
    linkshop_show_recommend: 1,
  },
  pins: [
    pin(101, '연남 이자카야 2인 코스', 38000, 53000, 'meal_voucher', '토리이자카야', '서울 마포구 연남동', 4.8, 132),
    pin(102, '망원 베이커리 3종 세트', 12900, 15000, 'meal_voucher', '망원제빵소', '서울 마포구 망원동', 4.7, 96),
    pin(103, '합정 헤어 커트 이용권', 25000, null, 'beauty_voucher', '살롱드합정', '서울 마포구 합정동', 4.9, 211),
    pin(104, '성산동 필라테스 5회권', 89000, 114000, 'etc_voucher', '코어필라테스', '서울 마포구 성산동', 4.6, 48),
    pin(105, '연희동 로스터리 원두 200g', 18000, null, 'meal_voucher', '연희로스터리', '서울 서대문구 연희동', 4.8, 73),
    pin(106, '망원 한강 게스트하우스 1박', 68000, 85000, 'stay_voucher', '한강게스트하우스', '서울 마포구 망원동', 4.5, 61),
  ],
  linked_seller: null,
}
// --pins=N 이면 원본 6개를 순환 복제해 정확히 N 개로 맞춘다(내용이 아니라 **개수**가 검사 대상).
if (PINS_N > 0) {
  const base = CURATOR_SEED.pins
  CURATOR_SEED.pins = Array.from({ length: PINS_N }, (_, i) => ({ ...base[i % base.length], id: 900 + i, product_id: 900 + i }))
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon',
}

function shell() {
  let html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8')
  const seed = `<script type="application/json" id="__SSR_INITIAL_CURATOR__">${JSON.stringify(CURATOR_SEED)}</script>`
  html = html.replace('</head>', `${seed}\n</head>`)
  // prerender 된 #root 껍데기는 비운다 — 워커의 needsRootBlank 와 같은 효과
  html = html.replace(/<div id="root">[\s\S]*?<\/div>\s*(?=<script)/, '<div id="root"></div>\n')
  return html
}

/**
 * 🃏 2026-08-31 `--deals` — **채워진 화면**을 본다.
 *   그전까지 이 하네스는 모든 API 에 빈 배열을 줬다. 그래서 나오는 그림이 늘 빈 화면이었고,
 *   레이아웃 판단은 되는데 **"카드가 깔렸을 때 어떻게 보이나"** 는 못 봤다 — 커머스 앱의
 *   완성도는 대부분 거기서 결정되는데도. (합성 데이터다. 실데이터의 긴 이름/빈 필드는 안 보인다.)
 */
// ⚠️ 2026-09-01 정정: 처음엔 둘째 칸이 '카페 · 역삼동' 처럼 **카테고리**였고 그걸 restaurant_name 에
//    넣었다. 그래서 스크린샷의 매장명 자리에 "카페"가 찍혔고 대표가 "매장명이 안 나오네?" 로 오해했다.
//    라이브 API 는 50/50 전부 restaurant_name 을 준다. 시드는 실물처럼 **매장명**을 넣는다.
const DEAL_TITLES = [
  ['스타벅스 아메리카노 T', '스타벅스 역삼점 · 역삼동', 4500, 3200],
  ['교촌치킨 허니콤보', '교촌치킨 논현점 · 논현동', 23000, 17900],
  ['올리브영 3만원권', '올리브영 강남본점 · 전국', 30000, 25500],
  ['제주 오션뷰 1박', '오션뷰 펜션 애월 · 서귀포', 180000, 119000],
  ['본죽 전복죽', '본죽 삼성점 · 삼성동', 12000, 8900],
  ['CU 모바일상품권 1만원', 'CU 강남역점 · 전국', 10000, 9300],
]
const DEALS = DEAL_TITLES.map(([name, sub, was, now], i) => ({
  id: 9000 + i,
  name,
  restaurant_name: sub.split(' · ')[0],
  restaurant_address: '서울 강남구 ' + sub.split(' · ')[1],
  price: now,
  original_price: was,
  discount_rate: Math.round((1 - now / was) * 100),
  image_url: '',
  images: '[]',
  dominant_color: ['#E8DED6', '#D9D2CB', '#E3DAD2', '#DCD5CE', '#E6DDD5', '#D7D0C9'][i],
  category: 'meal_voucher',
  deal_only: 0,
  group_buy_status: 'active',
  group_buy_current: 40 - i * 5,
  avg_rating: Number((4.9 - i * 0.1).toFixed(1)),
  review_count: 120 - i * 13,
  slug: `sample-${i}`,
  seller_id: 1,
}))

/**
 * 🎫 2026-08-31 `--deals` 에 교환권 **카테고리 칩 + 브랜드 스트립**을 추가한다.
 *   ⚠️ 이게 없어서 실제로 잘못된 시안을 냈다: `/api/vouchers/categories` 가 빈 배열이라
 *   칩 행(50px)과 브랜드 스트립(113px)이 **통째로 안 그려졌고**, 그 화면으로
 *   "상단을 줄이면 상품이 3개→5개" 라고 보고했다. 화면의 절반을 빼놓고 잰 셈이다.
 *   (대표가 "카테고리 및 브랜드 선택하는건 어딨어?" 로 잡아 줬다.)
 */
const VOUCHER_SECTIONS = [
  { category: '커피/음료', count: 42, brands: [
    { brand_name: '스타벅스', brand_icon_url: null, cnt: 12 },
    { brand_name: '메가커피', brand_icon_url: null, cnt: 9 },
    { brand_name: '투썸플레이스', brand_icon_url: null, cnt: 7 },
    { brand_name: '컴포즈커피', brand_icon_url: null, cnt: 6 },
    { brand_name: '할리스', brand_icon_url: null, cnt: 5 },
    { brand_name: '빽다방', brand_icon_url: null, cnt: 3 },
  ] },
  { category: '편의점', count: 28, brands: [
    { brand_name: 'CU', brand_icon_url: null, cnt: 11 },
    { brand_name: 'GS25', brand_icon_url: null, cnt: 10 },
    { brand_name: '세븐일레븐', brand_icon_url: null, cnt: 7 },
  ] },
  { category: '치킨/피자', count: 19, brands: [
    { brand_name: '교촌치킨', brand_icon_url: null, cnt: 8 },
    { brand_name: 'BBQ', brand_icon_url: null, cnt: 6 },
    { brand_name: '도미노피자', brand_icon_url: null, cnt: 5 },
  ] },
  { category: '뷰티', count: 12, brands: [
    { brand_name: '올리브영', brand_icon_url: null, cnt: 12 },
  ] },
]

/**
 * 🎟️ `--wallet` — 이용권 지갑(`/my-vouchers`) 시드.
 *   ⚠️ **서버가 실제로 주는 필드를 전부** 담는다(`/api/vouchers/my` → `my-vouchers/types.ts`).
 *      2026-08-31 에 얇은 픽스처가 "없는 결함"을 만들어 대표에게 오보할 뻔했다 —
 *      `avg_rating`·`discount_rate` 가 빠져 카드가 2줄로 그려진 것을 디자인 문제로 읽었다.
 */
const WALLET_VOUCHERS = (() => {
  const day = (n) => new Date(Date.now() + n * 86400000).toISOString()
  const base = {
    source: 'internal', deal_only: 0, order_id: 9001, product_id: 501,
    restaurant_phone: '02-333-1234', usage_guide: '평일 점심(11:00~15:00)만 사용 가능합니다.',
    restaurant_lat: 37.5563, restaurant_lng: 126.9236,
  }
  return [
    { ...base, id: 1, code: 'URD-4821-9930', status: 'unused', product_name: '연남동 마라탕 2인 세트',
      restaurant_name: '연남 마라탕', restaurant_address: '서울 마포구 연남로 21',
      created_at: day(-3), expires_at: day(4), applied_price: 19900, product_price: 28000, applied_discount_pct: 29 },
    { ...base, id: 2, code: 'URD-7710-2244', status: 'unused', product_name: '망원 브런치 플래터',
      restaurant_name: '망원 브런치하우스', restaurant_address: '서울 마포구 망원로 8',
      created_at: day(-9), expires_at: day(21), applied_price: 24000, product_price: 32000, applied_discount_pct: 25 },
    { ...base, id: 3, code: 'URD-1188-5501', status: 'unused', product_name: '합정 헤어 클리닉 1회',
      restaurant_name: '합정 살롱드제이', restaurant_address: '서울 마포구 양화로 45',
      created_at: day(-20), expires_at: day(60), applied_price: 45000, product_price: 70000, applied_discount_pct: 36 },
    { ...base, id: 4, code: 'URD-9042-3317', status: 'used', product_name: '홍대 수제버거 세트',
      restaurant_name: '홍대 버거랩', restaurant_address: '서울 마포구 와우산로 62',
      created_at: day(-40), expires_at: day(-5), used_at: day(-12), applied_price: 12900, product_price: 17000, applied_discount_pct: 24 },
    { ...base, id: 5, code: 'URD-2255-8890', status: 'expired', product_name: '상수 파스타 2인',
      restaurant_name: '상수 트라토리아', restaurant_address: '서울 마포구 독막로 7',
      created_at: day(-90), expires_at: day(-20), applied_price: 29000, product_price: 39000, applied_discount_pct: 26 },
  ]
})()

/**
 * 🛒 `--cart` — 장바구니/결제(`/cart`, `/checkout`) 시드.
 *   대표 *"장바구니 시드 만들어서 결제 화면도 봐줘"* — 그 전까지 `/checkout` 은 빈 상태만 렌더돼
 *   **결제 화면을 한 번도 눈으로 못 봤다**(2026-09-01 handoff 에 "못 봤다" 로 남겨 뒀던 항목).
 *
 * ⚠️ 서버가 실제로 주는 **필드 전부**를 담는다. 얇은 픽스처는 "없는 결함" 을 만든다 —
 *   이 세션에서만 세 번 그럴 뻔했다(유어샵 카드 2줄 · 교환권 시안의 사라진 절반 등).
 *   계약 출처: `src/types/cart.ts` CartItem · `cart.routes.ts` 응답(`data.items`) ·
 *   `checkout/useShippingQuote.ts`(`POST /api/orders/shipping-quote`).
 */
/**
 * 🛒 장바구니·결제 시드 (2026-09-01 — 대표 지적으로 전제를 고쳐 씀)
 *
 * ⚠️ **이용권에는 장바구니가 없다.** 처음 이 시드를 배송 상품(배송비 3,000원·합배송·무료배송
 *    바)으로 만들어 `/checkout` 을 렌더하고 "유어딜 결제 화면"이라고 판단했는데, 대표가
 *    *"이용권은 배송비도 없는데?"* 로 바로잡아 줘서 경로를 실제로 따라가 보니 그랬다:
 *      · 이용권(`/group-buy/:id`) → `/pay/widget`(TossWidgetPayPage) → `/group-buy/confirm-payment`
 *      · 교환권(deal_only=1) → 상세에서 딜로 즉시 교환 (결제 화면 자체가 없다)
 *    상세 어디에도 '장바구니 담기'가 없다(grep: GroupBuyDetailPage/VoucherDetailPage 0건).
 *    ⇒ `/cart`·`/checkout` 을 타는 것은 **쇼핑**(현재 `SHOPPING_TAB_HIDDEN`)과
 *      **공구 서비스의 몰 상품**(`MallProductPage` → directPurchase)뿐이다.
 *
 * 그래서 기본값을 **비배송**(몰 픽업 공구)으로 뒀다 — 살아 있는 쪽이 그쪽이고,
 * 배송 케이스(`--cart=shipping`)는 숨긴 쇼핑 레일이라 참고용이다.
 */
const CART_SEED = (() => {
  const item = (o) => ({
    id: o.id, product_id: o.id, product_name: o.name, quantity: o.qty ?? 1,
    price_snapshot: o.price, price: o.price, product_image: null, image_url: null,
    stock_quantity: 50, product_stock: 50, product_is_active: 1,
    seller_id: o.seller ?? 11, seller_name: o.sellerName ?? '연남 마라탕',
    // 비배송이면 0 이다. ⚠️ 이 0 이 CartPage 에서 `|| 3000` 에 삼켜지는지 보려고 일부러 0 을 넣는다.
    shipping_fee: o.ship ?? 0, free_shipping_threshold: o.freeAt ?? 0,
    bundling_key: o.bundle ?? null, deal_only: o.dealOnly ?? 0, category: o.cat ?? null,
    option_id: o.optId ?? null, option_value: o.opt ?? null, selected_options: o.opt ? [o.opt] : [],
  })
  // 기본 — 비배송(매장에서 쓰는 이용권/픽업 공구). 배송지도 배송비도 없어야 한다.
  const pickup = [
    item({ id: 501, name: '연남동 마라탕 2인 세트', price: 19900, cat: 'meal_voucher', opt: '중간맛' }),
    item({ id: 611, name: '합정 헤어 클리닉 1회', price: 45000, cat: 'beauty_voucher', seller: 22, sellerName: '합정 살롱드제이' }),
  ]
  // `--cart=shipping` — 배송 상품(숨긴 쇼핑 레일). 합배송·무료배송 바를 보려면 이쪽.
  const shipping = [
    item({ id: 801, name: '수제 드립백 20개입', price: 19900, ship: 3000, freeAt: 50000, bundle: 'b1' }),
    item({ id: 802, name: '한라봉 3kg', price: 27000, ship: 3000, freeAt: 50000, bundle: 'b1' }),
  ]
  // `--cart=deal` — 교환권만(딜 결제 전용 분기: 토스 옵션 숨김 + 배송지 없음)
  const dealOnly = [
    item({ id: 701, name: '스타벅스 아메리카노 T', price: 3200, qty: 2, dealOnly: 1, seller: 33, sellerName: '유어딜' }),
  ]
  return { pickup, shipping, dealOnly }
})()

function serve() {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const p = new URL(req.url, 'http://x').pathname
      if (p.startsWith('/api/')) {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        // 큐레이터 조회는 시드와 같은 페이로드로 — 아니면 백그라운드 갱신이 오류 상태로 빠진다
        if (p.startsWith('/api/curator/') && !p.includes('/me/')) return res.end(JSON.stringify(CURATOR_SEED))
        if (args.cart) {
          const items = args.cart === 'deal' ? CART_SEED.dealOnly
            : args.cart === 'shipping' ? CART_SEED.shipping
            : CART_SEED.pickup
          const total = items.reduce((n, i) => n + i.price_snapshot * i.quantity, 0)
          if (p === '/api/cart') return res.end(JSON.stringify({ success: true, data: { items, summary: { total_price: total, total_quantity: items.length } } }))
          if (p === '/api/orders/shipping-quote') {
            // 서버 권위 견적 — 합배송(bundling_key) 묶음당 1회. 클라 자체 계산과 어긋나면 Toss 400 이 난다.
            const keys = new Set(items.filter((i) => i.shipping_fee > 0).map((i) => i.bundling_key || `s${i.seller_id}`))
            return res.end(JSON.stringify({ success: true, data: { items: items.map((i) => ({ product_id: i.product_id, current_price: i.price })), shipping_total: keys.size * 3000, total } }))
          }
          if (p === '/api/points/balance') return res.end(JSON.stringify({ success: true, data: { balance: 12000 }, balance: 12000 }))
          if (p === '/api/shipping-addresses') return res.end(JSON.stringify({ success: true, data: [{ id: 1, recipient_name: '정지원', phone: '010-1234-5678', postal_code: '04039', address: '서울 마포구 연남로 21', address_detail: '3층', is_default: 1 }] }))
          if (p === '/api/coupons/my') return res.end(JSON.stringify({ success: true, data: [] }))
          if (p === '/api/payments/client-key') return res.end(JSON.stringify({ success: true, data: { clientKey: 'test_ck_preview' }, clientKey: 'test_ck_preview' }))
        }
        if (args.wallet && p === '/api/vouchers/my')
          return res.end(JSON.stringify({ success: true, data: WALLET_VOUCHERS }))
        if (args.deals) {
          if (p === '/api/vouchers/categories') return res.end(JSON.stringify({ success: true, data: VOUCHER_SECTIONS }))
          // 상세는 **단건**이다 — 목록과 같은 배열을 주면 화면이 안 그려진다.
          const m = p.match(/^\/api\/(?:group-buy\/)?products\/(\d+)/)
          if (m) {
            const one = DEALS.find((d) => String(d.id) === m[1]) || DEALS[0]
            return res.end(JSON.stringify({ success: true, data: one, product: one }))
          }
          if (p.startsWith('/api/group-buy/products') || p === '/api/products')
            return res.end(JSON.stringify({ success: true, data: DEALS, products: DEALS }))
        }
        return res.end(JSON.stringify({ success: true, data: [], products: [], pins: [], stats: {} }))
      }
      const f = path.join(DIST, p)
      if (p !== '/' && fs.existsSync(f) && fs.statSync(f).isFile()) {
        res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' })
        return res.end(fs.readFileSync(f))
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(shell())
    })
    s.listen(PORT, '127.0.0.1', () => resolve(s))
  })
}

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('❌ dist/client 가 없다. 먼저 `npm run build` 를 돌릴 것.')
  process.exit(1)
}

let chromium
try { ({ chromium } = await import('playwright')) } catch {
  console.error('❌ playwright 미설치. `npm ci` 후 다시.')
  process.exit(1)
}

// Playwright 가 받아 둔 chromium 을 찾는다(경로에 빌드번호가 붙어 고정할 수 없다).
const PW_DIR = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers'
const exe = fs.existsSync(PW_DIR)
  ? fs.readdirSync(PW_DIR)
      .filter((d) => d.startsWith('chromium-'))
      .map((d) => path.join(PW_DIR, d, 'chrome-linux/chrome'))
      .find((f) => fs.existsSync(f))
  : undefined

const server = await serve()
fs.mkdirSync(OUTDIR, { recursive: true })

const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const ctx = await browser.newContext({
  // 🖥️ 2026-08-31 `--pc` — PC 홈은 레이아웃이 아예 다르다(히어로 + 가로 레일 + 흰 패널).
  //   모바일 폭으로만 보면 PC 회귀를 못 본다 — 실제로 PC 홈이 모바일과 다른 규칙을 쓰는 것을
  //   라이브 판정에서야 발견했다.
  viewport: { width: args.pc ? 1440 : 430, height: HEIGHT },
  deviceScaleFactor: 2,
  colorScheme: DARK ? 'dark' : 'light',
})
// 외부 호스트 차단 — 이 환경의 프록시가 막아 타임아웃/오류 상태를 유발한다.
await ctx.route('**/*', (r) => (r.request().url().startsWith(`http://127.0.0.1:${PORT}`) ? r.continue() : r.abort()))

// 🌙 2026-09-02 정정: `--dark` 가 colorScheme 만 바꿔서 **한 번도 다크를 켠 적이 없었다** —
//    index.html 부트 스크립트는 localStorage 가 null 이면 OS 설정을 무시하고 라이트를 고정한다
//    (2026-05-16 "신규 사용자 default = light"). 그래서 `-dark.png` 가 라이트와 픽셀 동일했다.
//    앱이 실제로 읽는 키를 심어야 다크가 뜬다.
if (DARK) {
  await ctx.addInitScript(() => { try { localStorage.setItem('ur_theme_mode_v1', 'dark') } catch { /* private mode */ } })
}
if (AUTH) {
  const seed = AUTH === 'seller'
    ? { seller_token: 'preview', seller_id: '1', seller_username: 'preview', user_type: 'seller' }
    : { user_id: '1', user_type: 'user', user_handle: 'preview', user_name: '정지원' }
  await ctx.addInitScript((kv) => {
    try { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v) } catch { /* private mode */ }
  }, seed)
}

const page = await ctx.newPage()
await page.goto(`http://127.0.0.1:${PORT}${ROUTE}`, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {})
await page.waitForTimeout(4000)
if (EXTRA_CSS) { await page.addStyleTag({ content: EXTRA_CSS }); await page.waitForTimeout(400) }

const out = path.join(OUTDIR, `${NAME}${DARK ? '-dark' : ''}.png`)
// 🔬 스크린샷만으로는 안 보이는 계약을 **실제 렌더 트리에서** 확인한다.
//    (스펙상 CSS 가 presentation attribute 를 이긴다는 것을 '알고' 넘어가지 말고 잰다.)
const probe = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel)
    return el ? getComputedStyle(el) : null
  }
  const icon = document.querySelector('svg.lucide[stroke-width="2"]')
  const btn = document.querySelector('button')
  const byClass = (c) => [...document.querySelectorAll('*')].find((e) => e.classList && e.classList.contains(c))
  const card = byClass('rounded-xl')
  const ctrl = byClass('rounded-lg')
  return {
    lucideStrokeWidth: icon ? getComputedStyle(icon).strokeWidth : null,
    lucideCount: document.querySelectorAll('svg.lucide').length,
    buttonTransitionMs: btn ? getComputedStyle(btn).transitionDuration : null,
    roundedXl: card ? getComputedStyle(card).borderTopLeftRadius : null,
    roundedLg: ctrl ? getComputedStyle(ctrl).borderTopLeftRadius : null,
    void0: pick('body') ? null : null,
  }
})
console.log('🔬 렌더 실측:', JSON.stringify(probe))

if (args.dom) {
  // 🔎 화면에서 이상해 보이는 것을 **추측하지 않고** 확인한다.
  const dump = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('nav, [class*="fixed"], header')) {
      const r = el.getBoundingClientRect()
      if (r.height < 8) continue
      out.push({ tag: el.tagName.toLowerCase(), top: Math.round(r.top), h: Math.round(r.height),
                 pos: getComputedStyle(el).position, cls: (el.className || '').toString().slice(0, 70) })
    }
    return out
  })
  console.log('🔎 DOM:', JSON.stringify(dump, null, 1))
}

await page.screenshot({ path: out })
const text = (await page.innerText('body').catch(() => '')).slice(0, 60).replace(/\s+/g, ' ')
console.log(`✅ ${out}`)
console.log(`   본문 앞부분: ${text}`)
if (/문제가 발생|오류가 발생/.test(text)) {
  console.log('   ⚠️  오류 화면이다 — 시드가 라우트와 안 맞거나 목 응답 모양이 틀렸다.')
}

await browser.close()
server.close()
