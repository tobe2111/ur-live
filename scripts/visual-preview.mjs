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
import { sellerListResponse } from './preview-seeds/seller-lists.mjs'

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
 * 📐 `--width=N` — 임의 폭. `--pc` 는 1440 의 줄임말로 남는다.
 *   ⚠️ 폭 하나만 보고 "PC 는 괜찮다" 로 넘기지 말 것: 마이의 PC 우측 칸은
 *   `.ur-account-pc`(max 1200 · 좌 216 · gap 32 · 좌우 패딩 64)라 **1200px 창이 가장 좁다**.
 *   1440 에서 한 줄에 들어가는 것이 1200 에서 깨진다 — 경계는 넓은 쪽이 아니라 좁은 쪽이다.
 */
const VIEWPORT_W = Number(args.width) || (args.pc ? 1440 : 430)
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
    // MAIN_SEED 는 아래(DEALS 뒤)에서 정의된다 — shell() 은 서버가 뜬 뒤 요청 시점에 불리므로 안전.
    + (MAIN_SEED ? `<script type="application/json" id="__SSR_INITIAL_MAIN__">${JSON.stringify(MAIN_SEED)}</script>` : '')
    + (DETAIL_SEED ? `<script type="application/json" id="__SSR_INITIAL_DETAIL__">${JSON.stringify(DETAIL_SEED)}</script>` : '')
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
 * 🎫 2026-09-28 상세 시드 — `/group-buy/:id` 의 `__SSR_INITIAL_DETAIL__`.
 *
 * 왜 필요한가: 상세는 **첫 페인트에 SSR 시드를 동기 소비**한다(2026-06-22 잠금 항목).
 * 그게 없으면 첫 프레임이 빈 상품(가격 `0원`)이고 API 응답이 온 뒤에야 채워진다 —
 * 즉 **라이브의 첫 화면과 다른 그림**을 보게 된다. 이 시드가 그 한 프레임을 맞춘다.
 *
 * 🩸 **정정(2026-09-28)**: 처음 이 주석에 *"이게 없으면 상세를 떠 볼 방법이 아예 없었다"* 고
 *    썼는데 **틀렸다.** `--deals` 뒤에 단건 API 스텁이 이미 있었다(아래 `/api/.../products/:id`).
 *    내가 `--deals` 없이 뜬 뒤 빈 화면을 보고 "시드가 없어서"라고 단정한 것이다.
 *    ⇒ 빈 화면을 만나면 **먼저 플래그를 의심할 것**(`--deals`·`--wallet`·`--stores`·`--auth`).
 *
 * ⚠️ 합성 데이터다. 실데이터의 긴 매장명·빈 필드·사진 여러 장은 여기서 안 보인다.
 */
const DETAIL_ID = (() => {
  const m = ROUTE.match(/^\/(?:pass|group-buy|vouchers|products)\/(\d+)/)
  return m ? Number(m[1]) : 0
})()
const DETAIL_SEED = DETAIL_ID
  ? {
      success: true,
      data: {
        ...(DEALS.find((d) => d.id === DETAIL_ID) || { ...DEALS[0], id: DETAIL_ID }),
        id: DETAIL_ID,
        description: '연남동 골목 안쪽, 예약 없이 들르기 좋은 이자카야입니다. 2인 코스는 제철 사시미와 구이 4종, 식사까지 포함됩니다.',
        group_buy_target: 30,
        group_buy_tiers: [{ count: 10, discount: 15 }, { count: 30, discount: 28 }],
        current_discount_pct: 28,
        next_tier: null,
        next_tier_remaining: null,
        stock: 40,
        store_phone: '02-0000-0000',
        latitude: 37.5602,
        longitude: 126.9255,
      },
    }
  : null

/**
 * 🎬 2026-09-08 유어쇼츠 레일 시드 — `/api/urshorts`.
 *   이게 없으면 레일이 `items.length === 0` 으로 **통째로 안 그려져서**(빈 관측 div 만 남는다)
 *   레일 디자인을 화면으로 판단할 방법이 아예 없었다. 위 브랜드 스트립과 같은 클래스의 함정이다.
 *   ⚠️ **라이브의 실제 모습을 섞는다** — 지금 올라간 3편은 이용권이 안 붙어 있어
 *      `product_id·store_name·price` 가 전부 null 이고 글자 띠가 안 그려진다. 붙은 카드만
 *      넣고 보면 "정보 없는 카드"의 생김새를 못 본다.
 */
const SHORTS_SEED = [
  { id: 1, video_id: 'JLyX_qcuEig', thumb_url: null, title: null, channel: null, duration_sec: null,
    product_id: null, product_name: null, store_name: null, price: null, original_price: null },
  { id: 2, video_id: 'uSPgWrjU3-4', thumb_url: null, title: '수제 돈가스', channel: '맛집탐방',
    duration_sec: 47, product_id: 2888, product_name: '치즈돈가스 2인 세트', store_name: '동탄 왕돈가스',
    price: 12900, original_price: 19000, discount_rate: 32 },
  { id: 3, video_id: 'Q7WEeklpYEE', thumb_url: null, title: null, channel: null, duration_sec: 18,
    product_id: 2901, product_name: '아메리카노 2잔', store_name: '카페 온', price: 4500,
    original_price: 7000, discount_rate: 35 },
]

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
    { ...base, id: 1, product_id: 9001, code: 'URD-4821-9930', status: 'unused', product_name: '연남동 마라탕 2인 세트',
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

/**
 * 🖼️ 2026-09-02 `--hero=<사진 파일>` — **PC 홈 히어로에 사진이 실린 상태**를 본다.
 *   히어로 사진은 API 가 아니라 `__SSR_INITIAL_MAIN__` 시드에서 **동기 1회** 고른다(`pickHeroPhoto`).
 *   그래서 `--deals` 로 API 만 채워도 히어로는 빈 색면이다 — 라이브에서 D1 이 죽어 시드가 빠졌을 때와
 *   똑같은 그림이라, 그걸 보고 "사진이 없어졌다" 고 오진할 수 있다(2026-09-02 실제로 그 질문이 왔다).
 *   외부 이미지 호스트는 이 하네스가 차단하므로 파일을 data: URL 로 박는다(`cfImage` 는 data: 를 그대로 둔다).
 */
const HERO_FILE = typeof args.hero === 'string' ? args.hero : ''
const MAIN_SEED = (() => {
  if (!HERO_FILE) return null
  const buf = fs.readFileSync(HERO_FILE)
  const mime = MIME[path.extname(HERO_FILE)] || 'image/jpeg'
  const data = `data:${mime};base64,${buf.toString('base64')}`
  return { success: true, data: DEALS.map((d, i) => (i === 0 ? { ...d, image_url: data } : d)) }
})()

/**
 * 📊 `--analytics` — 셀러 매출 분석(안 C) 시드.
 *   ⚠️ 플래그가 없으면 기본 폴백(`data: []`)이 떨어져 **"한 번도 판 적 없음"** 화면이 뜬다.
 *      그게 우연이 아니라 의도다 — 안 C 의 절반은 그 빈 화면이라 기본으로 보이는 편이 낫다.
 *   계약 출처: `/api/seller/analytics/chart/revenue`(RevenueDataPoint[]) · `/analytics/detailed`.
 */
const ANALYTICS_DAYS = [31, 44, 28, 52, 61, 47, 38, 55, 72, 49, 63, 58, 41, 69]
const ANALYTICS_REVENUE = ANALYTICS_DAYS.map((v, i) => ({
  date: `2026-08-${String(i + 18).padStart(2, '0')}`, revenue: v * 10000, orders: Math.max(1, Math.round(v / 6)),
}))
const ANALYTICS_DETAILED = { conversion_rate: 3.4, repeat_purchase_rate: 28, repeat_buyers: 52, total_buyers: 186 }

/**
 * 🧾 `--seller-work[=empty]` — 셀러 **업무 목록** 시드(주문 · 정산 · 출금).
 *
 * 🩸 왜 생겼나 (2026-09-30 측정 1차가 헛돌았다 → 2026-10-01 수리):
 *   `--phone-audit` 로 대시보드 일곱을 430px 로 쟀더니 여섯이 **"🟢 깨끗"** 으로 나왔다.
 *   본문을 찍어 보니 `"해당하는 주문이 없어요"` — **빈 화면을 재고 있었다.** 빈 목록은 당연히
 *   가로스크롤 0 · 잘린 글자 0 이다. 하네스가 목하는 API 는 analytics 둘과 좌석 요약 하나뿐이고,
 *   나머지는 전부 catch-all `{ data: [] }` 로 떨어졌다.
 *
 * ⚠️ **얇은 픽스처는 "없는 결함"을 만든다**(결재문의 교훈). 그래서 일부러 **폰에서 깨지는 값**을 넣는다:
 *   · 아주 긴 매장명·상품명(줄바꿈·말줄임 판정)  · `null` 운송장·메모(빈 필드 처리)
 *   · 일곱 자리 금액(숫자 칸 넘침)              · 긴 계좌 문자열(표 오버플로)
 *   짧고 예쁜 값만 넣으면 측정이 또 초록을 낸다.
 *
 * 📐 응답 **모양은 라우트에서 읽어 맞췄다**(추측 아님):
 *   `seller-orders.routes.ts:168` · `seller-settlements.routes.ts:47·88·199` ·
 *   `seller-settlements/payouts.ts:82`.
 *   `--seller-work=empty` 는 "진짜 비었을 때" 의 화면 — 빈 상태 안내가 제대로 뜨는지 본다.
 */
const LONG_STORE = '연남동 수제화덕피자 앤 파스타 하우스 본점(2층)'
const LONG_PRODUCT = '[1+1 한정] 트러플 마르게리타 피자 + 알리오올리오 파스타 2인 세트 (음료 포함)'

const SELLER_ORDERS = [
  { id: 9001, order_number: 'GB-14-1790000000001', user_id: 3, total_amount: 1234000, status: 'PAID',
    shipping_name: '정지원', shipping_phone: '010-1234-5678',
    shipping_address: '서울특별시 마포구 연남로 21-3, 301호 (연남동, 연남빌딩)',
    tracking_number: null, courier: null, payment_method: 'toss', payment_status: 'approved',
    created_at: '2026-09-30 14:21:03', updated_at: '2026-09-30 14:21:03',
    user_name: '정지원', user_email: 'jiwon@example.com', product_name: LONG_PRODUCT },
  { id: 9002, order_number: 'GB-14-1790000000002', user_id: 4, total_amount: 9800, status: 'DONE',
    shipping_name: null, shipping_phone: null, shipping_address: null,
    tracking_number: '1234567890123', courier: 'CJ대한통운', payment_method: 'deal_points', payment_status: 'approved',
    created_at: '2026-09-29 09:05:44', updated_at: '2026-09-29 11:00:00',
    user_name: null, user_email: 'nobody@example.com', product_name: '아메리카노 1잔' },
  { id: 9003, order_number: 'GB-14-1790000000003', user_id: 5, total_amount: 45000, status: 'PENDING',
    shipping_name: '김아주아주긴이름입니다', shipping_phone: '010-0000-0000',
    shipping_address: '경기도 성남시 분당구 판교역로 235, 에이치스퀘어 엔동 7층',
    tracking_number: null, courier: null, payment_method: 'toss', payment_status: 'pending',
    created_at: '2026-09-28 22:47:10', updated_at: '2026-09-28 22:47:10',
    user_name: '김아주아주긴이름입니다', user_email: 'long@example.com', product_name: LONG_PRODUCT },
]

const SELLER_SETTLEMENTS = [
  { id: 501, seller_id: 1, total_sales: 12345000, commission_amount: 617250, commission_rate: 5.0,
    settlement_amount: 11727750, amount: 11727750,
    bank_name: '중소기업은행', account_number: '010-9999-8888-7777-6666', account_holder: LONG_STORE,
    period_start: '2026-09-01', period_end: '2026-09-30', status: 'pending',
    admin_memo: null, requested_at: '2026-10-01 09:00:00', created_at: '2026-10-01 09:00:00', updated_at: '2026-10-01 09:00:00' },
  { id: 502, seller_id: 1, total_sales: 980000, commission_amount: 49000, commission_rate: 5.0,
    settlement_amount: 931000, amount: 931000,
    bank_name: '국민은행', account_number: '123456-01-234567', account_holder: '유어딜',
    period_start: '2026-08-01', period_end: '2026-08-31', status: 'paid',
    admin_memo: '정상 지급 완료', requested_at: '2026-09-01 09:00:00', created_at: '2026-09-01 09:00:00', updated_at: '2026-09-03 10:00:00' },
]

const SELLER_SETTLEMENT_STATS = {
  total_settled: 931000, pending_amount: 11727750, approved_amount: 0, paid_amount: 931000,
  total_pending: 1, total_approved: 0, total_paid: 1, total_requests: 2,
}

const SELLER_PAYOUTS = {
  payable: 11727750, held: 2340000, hold_days: 10, scheduled_total: 0, sent_total: 931000,
  auto: true, scope: 'owner', since: null,
  payouts: [
    { id: 77, amount: 931000, period_start: '2026-08-01', period_end: '2026-08-31', status: 'sent',
      account_number: '123456-01-234567', account_holder: '유어딜', admin_memo: null,
      created_at: '2026-09-01 09:00:00', approved_at: '2026-09-02 10:00:00', sent_at: '2026-09-03 10:00:00' },
  ],
}

const SELLER_SETTLEMENT_OPTIONS = {
  business_registration: { status: 'approved', image_url: null, reject_reason: null, business_number: '123-45-67890' },
  preferred_method: 'auto',
  available_amount: 11727750,
  methods: {
    cash: { available: true, label: '현금 (계좌 입금)', description: '사업자등록 완료 — 신청 후 영업일 D+7 입금', withholding_rate: 0 },
    voucher: { available: true, label: '모바일 교환권 (기프티쇼)', description: '즉시 발송 · 사업자 미등록 시 8.8% 원천징수 후 발송', withholding_rate: 0, note: '추후 KT Alpha 통합 후 활성화' },
    deal: { available: true, label: '딜 포인트 (플랫폼 내 사용)', description: '플랫폼 내 사용 + 환급 가능 (8.8% 원천징수)', withholding_rate: 8.8, redeemable: true },
  },
}

const SELLER_DASHBOARD_STATS = {
  daily_revenue: ANALYTICS_DAYS.map((v, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, revenue: v * 1000 })),
}


/**
 * 🪑 `--stores=N` — 마이의 **'내 가게' 구역**(§14 `SellerSection`)을 눈으로 본다.
 *
 * ■ 왜 필요했나 — 실제로 막혔던 일
 *   이 구역은 `/api/seller/my-stores/summary` **한 곳**에서만 나오는데, 이 하네스의 기본 스텁이
 *   모든 `/api/*` 에 빈 배열을 준다. 좌석 0곳이면 `SellerSection` 은 `null` 을 그린다(설계대로다 —
 *   실패를 0원으로 위장하지 않는다). 그래서 **이 하네스로는 판매 구역이 한 번도 렌더된 적이 없었다.**
 *   2026-09-28 에 25px 제목·PC 히어로를 넣고도 "폰에서 제목이 줄바꿈되나 / 1200px 에서 히어로가
 *   한 줄에 들어가나" 를 확인할 길이 없어 E4 를 미룬 자리가 정확히 여기다.
 *
 * ■ 모양은 서버 그대로
 *   `seller-operators.routes.ts` 의 `GET /my-stores/summary` 가 실제로 주는 필드만 담는다
 *   (`stores[] {seller_id,name,role,status,today_revenue,today_orders,pending}` · `totals` ·
 *   `current_seller_id`). 얇은 픽스처는 "없는 결함" 을 만든다 — 이 파일이 이미 한 번 값을 치른 교훈.
 *
 * ■ 첫 이름이 **일부러 길다**
 *   머리줄이 보여 주는 이름은 언제나 `stores[0]` 이고, `truncate`·줄바꿈은 **긴 이름에서만** 드러난다.
 *   짧은 이름을 첫 칸에 두면 어떤 조합으로 돌려도 늘 통과하는 그림이 나온다 — 하네스가 경계를
 *   안 보여 주면 없는 것과 같다. 말줄임(…)이 뜨는 게 정상이고, 오른쪽으로 삐져나가면 결함이다.
 */
const STORE_NAMES = [
  '합정 살롱드합정 헤어&메이크업 본점',   // ← 긴 이름을 첫 칸에 (truncate 경계)
  '연남 토리이자카야',
  '망원제빵소 연남점',
  '코어필라테스 성산',
]
/**
 * ⏳ `--slow=N` — 좌석 요약(`/api/seller/my-stores/summary`)의 응답을 N ms 늦춘다.
 *   라이브에서 이 응답은 수백 ms 걸리는데 하네스 스텁은 **즉답**이라, 그 사이에만 존재하는
 *   화면(판매 구역이 아직 없는 한 프레임)을 지금까지 한 번도 못 봤다. 대표가 본 것이 그 프레임이다.
 * 📐 `--shift` — 그 프레임과 완성 프레임에서 **같은 글자가 같은 y 에 있는지** 재서 밀림을 판정한다.
 *   "그럴듯한 기제" 로 결론 내지 않기 위한 측정이다(CLAUDE.md 2026-09-21 교훈).
 */
/**
 * 🪑 `--seller-lists[=empty]` — 마이의 판매 시트 일곱이 부르는 **목록 API 를 목한다**.
 *
 * 🩸 왜 필요한가: 이게 없으면 그 API 들이 전부 404 → **빈 목록**이 되고, `--phone-audit` 는
 *   빈 화면을 재서 "🟢 깨끗" 을 낸다(2026-09-30 1차 측정이 실제로 그렇게 헛돌았다).
 *   픽스처는 `scripts/preview-seeds/seller-lists.mjs` — 서버가 실제로 주는 필드 전부 + **폰에서
 *   깨지는 값**(긴 매장명 · 7~8자리 금액 · 빈 필드 · 실패 로그)을 일부러 담았다.
 *   `=empty` 면 빈 상태를 본다 — **두 상태를 모두** 봐야 측정이 의미를 갖는다.
 */
const SELLER_LISTS = args['seller-lists'] === true ? 'full'
  : typeof args['seller-lists'] === 'string' ? args['seller-lists'] : ''

/**
 * 🔍 `--trace-api` — 화면이 부른 `/api/*` 와 **스텁이 뭘 돌려줬는지**를 찍는다.
 *
 * 🩸 왜 필요한가: 프로덕션 빌드는 `drop_console: true` 라 화면이 ErrorBoundary 로 떨어져도
 *   콘솔에 아무것도 안 남는다. 그러면 "오류 화면이다" 까지만 알고 **어느 응답 때문인지는 모른다**
 *   (2026-09-30 측정 1차가 정확히 거기서 멈췄다). 서버는 렌더 직후 닫히므로 밖에서 붙을 수도 없다.
 *   ⇒ 스텁이 **자기가 응답한 것**을 남긴다. 목이 라우트 모양과 어긋난 자리가 바로 보인다.
 */
const TRACE_API = 'trace-api' in args
const API_LOG = []
const SELLER_WORK = 'seller-work' in args ? (args['seller-work'] === 'empty' ? 'empty' : 'full') : null
const SLOW = Number(args.slow) || 0
const SHIFT = 'shift' in args
const STORE_STATUS = typeof args.stores === 'string' && /^[a-z]+$/.test(args.stores) ? args.stores : 'approved'
const STORES_N = (() => {
  const a = process.argv.find((x) => x.startsWith('--stores'))
  if (!a) return 0
  const v = a.includes('=') ? a.slice(a.indexOf('=') + 1) : '1'
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : 1   // `--stores` 나 `--stores=approved` → 1곳
})()
function storesSeed(n) {
  const stores = Array.from({ length: n }, (_, i) => ({
    seller_id: i + 1,
    name: STORE_NAMES[i % STORE_NAMES.length],
    role: i === 0 ? 'owner' : 'operator',
    status: STORE_STATUS,
    today_revenue: [412000, 86000, 0, 1240000][i % 4],
    today_orders: [7, 2, 0, 19][i % 4],
    pending: [2, 0, 0, 5][i % 4],
  }))
  const totals = stores.reduce(
    (a, r) => ({ today_revenue: a.today_revenue + r.today_revenue, today_orders: a.today_orders + r.today_orders, pending: a.pending + r.pending }),
    { today_revenue: 0, today_orders: 0, pending: 0 },
  )
  return { success: true, data: { stores, totals, current_seller_id: stores[0]?.seller_id ?? null } }
}
/**
 * 🔐 좌석 토큰은 **JWT 모양**이어야 한다 — `readSeatClaims`(`lib/seller-seat.ts`)가 `token.split('.')[1]`
 *   을 base64url 디코드해 `seller_id` 를 읽고, 그 값이 `store.seller_id` 와 같을 때만 '일감' 격자가 뜬다.
 *   평문 `'preview'` 로는 claim 이 null 이라 오늘 카드만 나오고 아래 절반이 통째로 빈다.
 *   ⚠️ 서명은 없다(가짜 서버가 어차피 전부 200 이다). **권한 검증용으로 쓰지 말 것.**
 */
function seatToken(sellerId, name) {
  const b64u = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${b64u({ alg: 'none', typ: 'JWT' })}.${b64u({ seller_id: sellerId, seller_type: 'store_owner', name })}.preview`
}

function serve() {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const p = new URL(req.url, 'http://x').pathname
      if (p.startsWith('/api/')) {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        if (TRACE_API) {
          const origEnd = res.end.bind(res)
          res.end = (body) => { API_LOG.push(`${p} → ${String(body || '').slice(0, 110)}`); return origEnd(body) }
        }
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
        if (args.analytics) {
          if (p === '/api/seller/analytics/detailed') return res.end(JSON.stringify({ success: true, data: ANALYTICS_DETAILED }))
          if (p.startsWith('/api/seller/analytics/chart/revenue')) {
            // `--analytics=empty` — 판 적은 있으나 이 기간엔 없음(안 C 의 두 번째 "없음").
            const rows = args.analytics === 'empty' ? [] : ANALYTICS_REVENUE
            return res.end(JSON.stringify({ success: true, data: rows }))
          }
        }
        if (SELLER_LISTS) {
          const hit = sellerListResponse(p, SELLER_LISTS)
          if (hit) return res.end(JSON.stringify(hit))
        }
        if (STORES_N > 0 && p === '/api/seller/my-stores/summary') {
          const body = JSON.stringify(storesSeed(STORES_N))
          if (SLOW > 0) return void setTimeout(() => res.end(body), SLOW)
          return res.end(body)
        }
        if (SELLER_WORK) {
          // 🧾 셀러 업무 목록 — 모양은 라우트에서 읽어 맞췄다(위 시드 주석의 파일·줄 참조).
          const none = SELLER_WORK === 'empty'
          if (p.startsWith('/api/seller/orders')) {
            const data = none ? [] : SELLER_ORDERS
            return res.end(JSON.stringify({ success: true, data, pagination: { total: data.length, limit: 20, offset: 0, has_more: false } }))
          }
          if (p.startsWith('/api/seller/settlements/stats'))
            return res.end(JSON.stringify({ success: true, data: none ? { total_settled: 0, pending_amount: 0, approved_amount: 0, paid_amount: 0, total_pending: 0, total_approved: 0, total_paid: 0, total_requests: 0 } : SELLER_SETTLEMENT_STATS }))
          if (p.startsWith('/api/seller/settlements/payouts'))
            return res.end(JSON.stringify({ success: true, data: none ? { ...SELLER_PAYOUTS, payable: 0, held: 0, sent_total: 0, payouts: [] } : SELLER_PAYOUTS }))
          if (p.startsWith('/api/seller/settlements')) {
            const data = none ? [] : SELLER_SETTLEMENTS
            return res.end(JSON.stringify({ success: true, data, total: data.length }))
          }
          if (p.startsWith('/api/seller/settlement-options'))
            return res.end(JSON.stringify({ success: true, data: SELLER_SETTLEMENT_OPTIONS }))
          if (p.startsWith('/api/seller/dashboard/stats'))
            return res.end(JSON.stringify({ success: true, data: none ? { daily_revenue: [] } : SELLER_DASHBOARD_STATS }))
        }
        // 🎬 레일은 홈 어느 경로에서든 뜬다 — 플래그 없이 항상 준다.
        if (p === '/api/urshorts') return res.end(JSON.stringify({ success: true, data: SHORTS_SEED }))
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
  viewport: { width: VIEWPORT_W, height: HEIGHT },
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
if (AUTH || STORES_N > 0) {
  const seed = AUTH === 'seller'
    ? { seller_token: 'preview', seller_id: '1', seller_username: 'preview', user_type: 'seller' }
    : { user_id: '1', user_type: 'user', user_handle: 'preview', user_name: '정지원' }
  /**
   * 🪑 `--stores` 일 때만 좌석 토큰을 **JWT 모양**으로 덮어쓴다.
   *   `--auth=seller` 단독의 평문 `'preview'` 는 **일부러 그대로 둔다** — 그걸 바꾸면 `currentSeatId()`
   *   가 null → 1 이 되어 좌석으로 갈리는 다른 프리뷰(셀러 대시보드 화면들)의 그림이 같이 변한다.
   *   요청하지도 않은 diff 를 공용 도구에 심지 않는다.
   *   ⚠️ 3조각 토큰이라도 `exp` 가 없으면 `isDashboardTokenUsable` 은 관대 통과다(RouteGuards:48) —
   *      즉 로그인 가드는 전과 같이 열린다.
   */
  if (STORES_N > 0 || SELLER_LISTS) {
    seed.seller_token = seatToken(1, STORE_NAMES[0])
    seed.seller_id = '1'
  }
  await ctx.addInitScript((kv) => {
    try { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v) } catch { /* private mode */ }
  }, seed)
}

const page = await ctx.newPage()
/**
 * 🖨️ 2026-09-28 — **콘솔을 버리지 않는다.** 그전까지 이 하네스는 브라우저 콘솔을 통째로 버려서,
 *   페이지가 ErrorBoundary 로 떨어져도 그림만 "문제가 발생했습니다" 일 뿐 **왜인지는 못 봤다**
 *   (`/seller/settlements` 가 정확히 그랬다). 그림은 증상이고 원인은 콘솔에 있다.
 */
const consoleErrors = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)) })
page.on('pageerror', (e) => consoleErrors.push(`[pageerror] ${String(e && e.message).slice(0, 300)}`))

await page.goto(`http://127.0.0.1:${PORT}${ROUTE}`, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {})
/**
 * 📐 `--shift` — 두 프레임의 같은 글자를 대조한다.
 *   ⚠️ 이 측정이 못 보는 것: **그 사이에 몇 번 움직였는가**(두 점만 본다) · 애니메이션 · 폰트 로드로
 *      인한 미세 이동. 그리고 `--slow` 없이 쓰면 스텁이 즉답이라 **늘 0 이 나온다**(그건 통과가 아니라
 *      측정을 안 한 것이다) — 그래서 SLOW 가 0 이면 크게 소리낸다.
 */
if (SHIFT) {
  const snap = () => page.evaluate(() => {
    const m = new Map()
    for (const el of document.querySelectorAll('p,span,h1,h2,h3,h4,button,a,label,li,div')) {
      if (el.children.length) continue
      const s = (el.textContent || '').trim()
      if (s.length < 2 || s.length > 40) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue
      if (!m.has(s)) m.set(s, Math.round(r.top + window.scrollY))
    }
    return { pos: Object.fromEntries(m), docH: document.documentElement.scrollHeight }
  })
  /**
   * 🔁 **두 번 잰다 — 첫 방문과 재방문.**
   *   자리 예약이 *지난 렌더에서 잰 값*으로 동작하는 화면이 있어서(판매 구역), 한 번만 재면
   *   그 처방을 **영영 못 본다**. 재방문은 같은 브라우저 컨텍스트에서 새로고침으로 만든다
   *   (localStorage 가 그대로 남는다 — 그게 예약값이 사는 곳이다).
   */
  const round = async (label) => {
    await page.waitForTimeout(Math.max(500, Math.round(SLOW * 0.5)))
    const a = await snap()
    await page.waitForTimeout(SLOW + 2500)
    const b = await snap()
    const moved = [], gone = [], born = []
    for (const [k, y] of Object.entries(a.pos)) {
      if (!(k in b.pos)) { gone.push(k); continue }
      const d = b.pos[k] - y
      if (Math.abs(d) > 8) moved.push(`${k} ${y}→${b.pos[k]} (${d > 0 ? '+' : ''}${d})`)
    }
    for (const k of Object.keys(b.pos)) if (!(k in a.pos)) born.push(k)
    console.log(`📐 밀림 측정 [${ROUTE}] ${label} ${moved.length ? '🔴 밀림 있음' : '🟢 안 밀림'} — 이동 ${moved.length} · 사라짐 ${gone.length} · 생김 ${born.length} · 문서높이 ${a.docH}→${b.docH}px`)
    for (const l of moved.slice(0, 10)) console.log(`   ↕ ${l}`)
    if (gone.length) console.log(`   ✂️ 사라짐: ${JSON.stringify(gone.slice(0, 8))}`)
    if (born.length) console.log(`   ✚ 생김: ${JSON.stringify(born.slice(0, 6))}`)
  }
  if (SLOW <= 0) console.log('📐 밀림 측정 ⚠️ `--slow=N` 없이 돌렸다 — 스텁이 즉답이라 이 0 은 아무것도 증명하지 않는다')
  await round('첫 방문')
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
  await round('재방문')
}
await page.waitForTimeout(4000)
/**
 * 🖱️ `--click="글자"` — 버튼을 눌러 **연 뒤**를 찍는다(여러 개면 `>>` 로 이어서).
 *   왜 필요한가: 마이의 판매 도구는 전부 **시트**라, 닫힌 화면만 찍으면 그 화면들은
 *   영원히 검증 범위 밖이다. 2026-09-28 에 "시트 일곱을 철거할까" 를 판단하려는데
 *   시트 안을 볼 방법이 없어 단독 페이지로 대신 볼 뻔했다 — 그건 다른 화면이다.
 *   ⚠️ 글자로 찾는다 — 클래스는 자주 바뀌고 글자는 사람이 보는 것이다.
 *   🩸 2026-09-28 정정: 처음엔 `getByText(label).first()` 였는데 **엉뚱한 것을 눌렀다.**
 *      `getByText` 는 그 글자를 *품은* 조상까지 맞히고 `.first()` 는 DOM 순서상 **가장 바깥**이다 —
 *      시트 몸통 전체가 잡혀 그 한가운데(= 다른 줄)를 눌렀다. 그래서 `전체 도구 >> 셀러 등급` 이
 *      **실패 메시지도 없이** 아무 일도 안 하는 것처럼 보였다(클릭은 성공했으니 경고도 안 뜬다).
 *      ⇒ **누를 수 있는 것**(button·a·[role=button])부터 찾고, 없을 때만 글자로 떨어진다.
 */
if (typeof args.click === 'string' && args.click) {
  for (const label of args.click.split('>>').map((x) => x.trim()).filter(Boolean)) {
    try {
      const clickable = page.locator('button, a, [role="button"]').filter({ hasText: label })
      const target = (await clickable.count()) > 0 ? clickable.last() : page.getByText(label, { exact: false }).last()
      // 🔎 **무엇을 눌렀는지 말한다.** 엉뚱한 것을 눌러도 클릭은 성공하므로 경고가 안 뜬다 —
      //    그 침묵이 2026-09-28 에 한 시간을 먹었다. 누른 것을 찍으면 그 자리에서 보인다.
      const shape = await target.evaluate((el) => `${el.tagName.toLowerCase()} "${(el.innerText || '').replace(/\s+/g, ' ').slice(0, 30)}"`).catch(() => '?')
      await target.click({ timeout: 8000 })
      await page.waitForTimeout(1800)
      console.log(`   🖱️ "${label}" → ${shape}`)
    } catch (e) {
      console.error(`   ⚠️ --click "${label}" 실패: ${String(e).split('\n')[0].slice(0, 120)}`)
    }
  }
}
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

/**
 * 📱 `--phone-audit` — **"폰에서 쓸 만한가"를 눈이 아니라 숫자로 판정한다** (2026-09-30 신설)
 *
 * 왜: 마이의 손수 시트 일곱(1,362줄)이 존재하는 이유가 *"대시보드 화면이 폰에서 나쁘기 때문"* 이라고
 *   `SellerSection.tsx` 주석에 적혀 있는데, **그 전제를 아무도 잰 적이 없다.** 그래서 철거도 유지도
 *   근거가 없었다(결재 `2026-09-28-my-stage2-sheet-teardown`). 대표 확정: *"측정부터."*
 *
 * 무엇을 재나 — 전부 **그림으로는 안 보이거나 세기 어려운** 것들:
 *   ① 가로 스크롤(px)  — CLAUDE.md 가 0 을 요구한다. 1px 이라도 있으면 폰에서 화면이 흔들린다
 *   ② 화면 밖으로 나간 요소 — 잘려서 **아예 못 누르는** 것이 있는지
 *   ③ 잘린 글자        — ellipsis/clip 으로 뜻이 사라진 줄(리프 노드만)
 *   ④ 작은 터치 타깃   — 높이 40px 미만(iOS HIG 44 · Material 48 보다 관대하게 잡았다)
 *   ⑤ 표 오버플로      — `<table>` 이 `overflow-x` 컨테이너 없이 폭을 넘는지
 *   ⑥ 첫 화면 밀도     — 844px 안에 **실제 콘텐츠**가 몇 줄 오는가(헤더·로더만이면 나쁘다)
 *
 * ⚠️ 이 측정이 **못 보는 것**: 글자가 읽기 좋은가 · 순서가 자연스러운가 · 폰트(시스템 폴백이다).
 *   숫자가 깨끗해도 화면이 나쁠 수 있다 — 그래서 `.png` 를 같이 남긴다. 숫자는 **나쁨의 증거**이고
 *   깨끗함은 좋음의 증거가 아니다.
 */
if (args['phone-audit']) {
  const audit = await page.evaluate((vw) => {
    const seen = (el) => {
      const r = el.getBoundingClientRect(); const s = getComputedStyle(el)
      return r.width > 0.5 && r.height > 0.5 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.01
    }
    const label = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 34)
    const hScroll = Math.max(0, document.documentElement.scrollWidth - vw)

    // ② 잘려 나간 것 — 컨테이너가 스크롤되는 경우는 의도된 가로 스크롤이라 제외한다.
    const cut = []
    for (const el of document.querySelectorAll('body *')) {
      if (!seen(el)) continue
      const r = el.getBoundingClientRect()
      if (r.right <= vw + 1 || r.width > vw * 3) continue
      let scrollable = false
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const ox = getComputedStyle(a).overflowX
        if (ox === 'auto' || ox === 'scroll') { scrollable = true; break }
      }
      if (scrollable) continue
      if (el.children.length === 0 || r.right > vw + 8) cut.push({ t: el.tagName.toLowerCase(), right: Math.round(r.right), s: label(el) })
    }

    // ③ 잘린 글자 — 리프 노드만(조상은 자식 때문에 늘 초과로 잡힌다)
    const clipped = []
    for (const el of document.querySelectorAll('p,span,h1,h2,h3,h4,h5,td,th,button,a,label,div,li')) {
      if (el.children.length || !seen(el)) continue
      const t = (el.textContent || '').trim()
      if (t.length < 2) continue
      if (el.scrollWidth > el.clientWidth + 1) clipped.push(t.slice(0, 34))
    }

    // ④ 작은 터치 타깃 — 숨은 것·아이콘만인 것도 눌러야 하므로 모두 센다
    const tiny = []
    for (const el of document.querySelectorAll('button, a[href], [role="button"], input:not([type="hidden"]), select')) {
      if (!seen(el)) continue
      const r = el.getBoundingClientRect()
      if (r.height < 40) tiny.push({ h: Math.round(r.height), w: Math.round(r.width), s: label(el) || el.tagName.toLowerCase() })
    }

    // ⑤ 표 오버플로
    const tables = []
    for (const el of document.querySelectorAll('table')) {
      if (!seen(el)) continue
      const r = el.getBoundingClientRect()
      const ox = el.parentElement ? getComputedStyle(el.parentElement).overflowX : 'visible'
      tables.push({ w: Math.round(r.width), wrapped: ox === 'auto' || ox === 'scroll' })
    }

    // ⑥ 첫 화면 밀도 — 844px 안에 글자를 가진 리프가 몇 개인가
    let firstScreen = 0
    for (const el of document.querySelectorAll('p,span,h1,h2,h3,h4,td,th,button,a,label,li')) {
      if (el.children.length || !seen(el)) continue
      if ((el.textContent || '').trim().length < 2) continue
      const r = el.getBoundingClientRect()
      if (r.top >= 0 && r.top < 844) firstScreen++
    }

    return {
      hScroll,
      cut: cut.length, cutSample: cut.slice(0, 4),
      clipped: clipped.length, clippedSample: clipped.slice(0, 5),
      tiny: tiny.length, tinySample: tiny.slice(0, 5),
      tables: tables.filter((t) => t.w > vw && !t.wrapped).length, tablesAll: tables.length,
      firstScreen,
      docH: document.documentElement.scrollHeight,
    }
  }, VIEWPORT_W)
  /**
   * 🩸 2026-10-01 — **빈 화면을 재고 "🟢 깨끗" 을 내던 것**(2026-09-30 측정 1차가 그렇게 헛돌았다).
   *   빈 목록은 당연히 가로스크롤 0 · 잘린 글자 0 이다. 오류 화면도 마찬가지다.
   *   ⇒ 본문을 보고 **재는 대상이 있었는지 먼저 의심한다.** 결함 0 과 "잴 게 없었음" 은 다른 결론이다.
   *   ⚠️ 이건 "빈 상태 화면을 못 재게" 하는 게 아니다(`--seller-work=empty` 는 일부러 그걸 본다) —
   *     **초록을 빈손으로 내주지 않는 것**이다.
   */
  const bodyText = await page.innerText('body').catch(() => '')
  const EMPTY_HINT = /없어요|없습니다|아직 .*없|비어 ?있|문제가 발생|오류가 발생/
  const suspect = EMPTY_HINT.test(bodyText) || audit.firstScreen < 8
  const bad = audit.hScroll > 0 || audit.cut > 0 || audit.clipped > 0 || audit.tables > 0
  console.log(`📱 폰 적합성 [${ROUTE}] ${bad ? '🔴 결함 있음' : suspect ? '🟡 판정 보류 — 잴 내용이 없다' : '🟢 깨끗'}`)
  if (suspect) console.log(`   ⚠️ 빈 상태·오류 화면으로 보인다. 이 숫자를 "폰에서 쓸 만하다" 로 읽지 말 것(시드를 먼저 채울 것).`)
  console.log(`   가로스크롤 ${audit.hScroll}px · 잘려나감 ${audit.cut} · 잘린글자 ${audit.clipped} · 작은타깃 ${audit.tiny} · 표오버플로 ${audit.tables}/${audit.tablesAll} · 첫화면 ${audit.firstScreen}줄 · 문서높이 ${audit.docH}px`)
  if (audit.cutSample.length) console.log(`   잘려나감: ${JSON.stringify(audit.cutSample)}`)
  if (audit.clippedSample.length) console.log(`   잘린글자: ${JSON.stringify(audit.clippedSample)}`)
  if (audit.tinySample.length) console.log(`   작은타깃: ${JSON.stringify(audit.tinySample)}`)
  console.log(`   PHONE_AUDIT_JSON ${JSON.stringify({ route: ROUTE, name: NAME, suspect, ...audit, cutSample: undefined, clippedSample: undefined, tinySample: undefined })}`)
}

/**
 * 📜 `--scroll=N` — N px 내린 뒤 찍는다. 페이지 아래쪽(설정·푸터)은 한 화면에 안 들어오는데,
 *   전체 캡처(`fullPage`)는 sticky/fixed 요소가 이상하게 늘어나 판정에 못 쓴다.
 */
const SCROLL = Number(args.scroll) || 0
if (SCROLL > 0) {
  await page.evaluate((y) => window.scrollTo(0, y), SCROLL)
  await page.waitForTimeout(600)
}
await page.screenshot({ path: out })
/**
 * 📄 `--text=N` — 본문을 N 자까지 찍는다(기본 60).
 *   왜: 프로덕션 빌드는 `drop_console: true`(vite.config)라 **콘솔이 통째로 제거된다** —
 *   화면이 에러로 떨어져도 콘솔엔 아무것도 안 남는다. 그때 남는 유일한 증거가 **화면의 글자**다.
 */
const TEXT_N = Number(args.text) || 60
const text = (await page.innerText('body').catch(() => '')).slice(0, TEXT_N).replace(/\s+/g, ' ')
console.log(`✅ ${out}`)
if (consoleErrors.length) {
  // 🔇 외부 호스트를 일부러 막았으므로 `ERR_FAILED` 는 **이 하네스가 만든 잡음**이다.
  //   그게 앞에 쌓이면 진짜 원인(ErrorBoundary 를 띄운 예외)이 안 보인다 — 실제로 한 번 가렸다.
  const noise = (e) => /ERR_FAILED|ERR_BLOCKED|net::ERR|Failed to load resource/.test(e)
  const real = consoleErrors.filter((e) => !noise(e))
  console.log(`   🖨️ 콘솔 에러 ${consoleErrors.length}건 (차단 잡음 ${consoleErrors.length - real.length} 제외 ${real.length}건):`)
  for (const e of real.slice(0, 5)) console.log(`      ${e}`)
  if (!real.length) console.log('      (전부 외부 차단 잡음 — 진짜 예외는 없었다)')
}
console.log(`   본문 앞부분: ${text}`)
if (TRACE_API) {
  console.log(`   🔍 /api 호출 ${API_LOG.length}건:`)
  for (const l of API_LOG) console.log(`      ${l}`)
}
if (/문제가 발생|오류가 발생/.test(text)) {
  console.log('   ⚠️  오류 화면이다 — 시드가 라우트와 안 맞거나 목 응답 모양이 틀렸다.')
}

await browser.close()
server.close()
