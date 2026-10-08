#!/usr/bin/env node
/**
 * 🖼️ 시각 변경을 **머지 전에** 눈으로 확인한다 (2026-08-30 신설)
 *
 * ■ 왜 만들었나 — 실제로 막혔던 일
 *   소비자 앱(ur-live)은 **PR 프리뷰가 없다.** PR 에 붙는 Cloudflare 프리뷰는
 *   `ur-wholesale`(도매몰 전용 Pages 프로젝트, WHOLESALE_BUNDLE=1)뿐이라
 *   소비자 화면 변경은 main 에 머지해야만 눈에 보였다. 그래서 디자인 변경이
 *   "머지하고 라이브에서 확인 → 이상하면 롤백" 밖에 길이 없었다.
 *   🔴 2026-10-08 정정 — 여기 오래 적혀 있던 *"라이브(urdeal.kr)를 브라우저로 직접 여는 것도
 *   이 원격 환경에선 막힌다"* 는 **더 이상 사실이 아니다.** 옆 스크립트
 *   `capture-proposal-shots.mjs` 가 2026-09-07 에 이미 원인을 적어 뒀다 — 끊긴 건 프록시가
 *   아니라 **TLS 1.3** 이고, `--proxy-server=$HTTPS_PROXY --ssl-version-max=tls1.2` 를 주면
 *   Chromium 이 라이브에 그대로 붙는다(2026-10-08 재확인: `/`·`/u/:handle` 렌더+측정 성공).
 *   이 오기를 믿으면 **할 수 있는 라이브 판정(E4)을 포기하게 된다** — 실제로 그럴 뻔했다.
 *   ⚠️ 그래도 이 하네스의 존재 이유는 그대로다: 라이브는 **머지된 뒤**에만 볼 수 있고,
 *   로그인·시드가 필요한 화면(지갑·마이 판매 구역)은 라이브에서 익명으로 못 잰다.
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
import { looksEmpty, emptyHintMatch } from './preview-seeds/empty-screen-hint.mjs'

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
/** 색 한 판짜리 4:3 인라인 사진 — 네트워크 0, 결정론. 띠·카드가 "사진 없음" 으로 떨어지지 않게. */
const tilePlaceholder = (hex) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="384" height="288"><rect width="384" height="288" fill="${hex}"/></svg>`)

const DEALS = DEAL_TITLES.map(([name, sub, was, now], i) => ({
  id: 9000 + i,
  name,
  restaurant_name: sub.split(' · ')[0],
  restaurant_address: '서울 강남구 ' + sub.split(' · ')[1],
  price: now,
  original_price: was,
  discount_rate: Math.round((1 - now / was) * 100),
  /* 🖼️ 2026-10-07: 종전엔 `''` 였다 — 그래서 **홈 히어로 띠가 하네스에서 구조적으로 안 보였다**
     (`pickHeroStripFrom` 의 `toTile` 은 `image_url` 이 비면 null 을 돌려준다). 띠를 눈으로 보려던
     사람은 "왜 안 뜨지" 를 코드에서 찾아야 했다. 네트워크를 타지 않는 **인라인 data URI** 를 심어
     오프라인·결정론을 지키면서 띠가 뜨게 한다(`cfImage` 는 `data:` 를 그대로 통과시킨다 — 실측).
     ⚠️ 색만 있는 판이라 **사진 크롭·화질은 이걸로 판정하지 말 것**(그건 라이브 실측의 일이다). */
  image_url: tilePlaceholder(['#E8DED6', '#D9D2CB', '#E3DAD2', '#DCD5CE', '#E6DDD5', '#D7D0C9'][i]),
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
/**
 * 🗓️ 날짜는 **오늘 기준 상대값**이다 — 고정 날짜를 쓰면 달이 넘어가는 순간 조용히 0 이 된다.
 *
 * 🩸 2026-10-01 에 실제로 그랬다: `daily_revenue` 를 `2026-09-XX` 로 박아 뒀는데 화면이
 *   `monthRevenue(daily)`(`useSellerHome.ts:61`)로 **이번 달 키만** 더하므로 10월 1일이 되자
 *   `이번 달 ₩0` 이 떴다. 시드가 멀쩡해 보이는데 숫자만 0 이라 "판매 0" 로 오판하게 된다
 *   (= 이 하네스가 2026-09-30 에 빈 화면을 초록으로 준 것과 같은 클래스).
 */
const kstDayKey = (back) => new Date(Date.now() + 9 * 3600_000 - back * 86400_000).toISOString().slice(0, 10)
const ANALYTICS_REVENUE = ANALYTICS_DAYS.map((v, i) => ({
  date: kstDayKey(ANALYTICS_DAYS.length - 1 - i), revenue: v * 10000, orders: Math.max(1, Math.round(v / 6)),
}))
const ANALYTICS_DETAILED = { conversion_rate: 3.4, repeat_purchase_rate: 28, repeat_buyers: 52, total_buyers: 186 }

/**
 * 🧾 셀러 **업무 목록** 시드는 `scripts/preview-seeds/seller-lists.mjs` **하나**다.
 *
 * 🩸 2026-10-01 — 여기에 같은 시드가 **한 벌 더** 있었다. 두 세션이 같은 날 각자 만들어
 *   `--seller-lists`(모듈) ↔ `--seller-work`(여기 인라인)로 갈렸다. 응답 모양을 두 벌로 들고
 *   있으면 **서로 다른 데이터를 재고도 둘 다 초록**이 된다 — "같은 일에 화면이 둘" 의 도구판이다.
 *   ⇒ 데이터는 모듈 하나로 합쳤고, 모듈 쪽이 커버리지 가드(`seller-list-fixtures-2026-10-01`)를
 *     갖고 있어 **화면 소스에서 경로를 긁어** 빠진 API 를 기계가 잡는다.
 *   `--seller-work` 는 **같은 것을 가리키는 별명**으로만 남긴다(이전 명령·문서 호환).
 */


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
const SELLER_LISTS = (() => {
  // `--seller-work` 는 **별명**이다 — 시드 데이터는 위 주석대로 모듈 하나뿐이고, 두 이름이
  // 같은 값을 만든다. 둘 중 하나만 주면 그걸 쓰고, 둘 다 주면 `=empty` 쪽을 존중한다.
  const raw = ['seller-lists', 'seller-work'].filter((k) => k in args).map((k) => args[k])
  if (raw.length === 0) return ''
  return raw.some((v) => v === 'empty') ? 'empty' : 'full'
})()

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
/** 페이지를 연 시각. `--trace-api` 가 요청마다 +Nms 를 적는 기준이다(0 이면 아직 안 열림). */
let NAV_T0 = 0
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
      /**
       * 📦 `--trace-api` 는 **청크도 함께** 찍는다 (2026-10-01).
       *   API 시각만 보면 "왜 늦나" 를 못 가른다 — 늦게 *출발*한 이유가 그 코드가 아직 안 와서인지
       *   (청크 대기) 아니면 와 있는데 늦게 불러서인지(배선)가 구분되지 않는다. 그 둘은 처방이
       *   정반대다. 청크 도착 시각이 그 사이에 찍히면 한눈에 갈린다.
       */
      if (TRACE_API && p.endsWith('.js') && NAV_T0) {
        const name = p.split('/').pop().replace(/-[A-Za-z0-9_]{8}\.js$/, '.js')
        API_LOG.push(`+${String(Date.now() - NAV_T0).padStart(5)}ms  📦 ${name}`)
      }
      if (p.startsWith('/api/')) {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        // 🔀 두 겹을 **순서대로** 감는다(동시 세션 병합 2026-10-01): 안쪽이 기록, 바깥이 지연.
        //   둘 다 `res.end` 를 감싸므로 한쪽만 남기면 다른 쪽이 조용히 사라진다.
        if (TRACE_API) {
          const origEnd = res.end.bind(res)
          // ⏱️ 2026-10-01 — **시각을 함께 찍는다**(대표 *"내 가게 이 부분이 가장 늦게 떠"*).
          //   무엇을 부르는지만 알면 "왜 늦나" 를 못 본다. 화면이 열린 뒤 몇 ms 에 그 요청이
          //   나갔는지가 곧 답이다(늦게 *응답*하는 것과 늦게 *출발*하는 것은 처방이 다르다).
          res.end = (body) => {
            const at = NAV_T0 ? Date.now() - NAV_T0 : -1
            // 🔎 쿼리까지 찍는다 — 같은 경로를 두 번 부를 때 **무엇이 다른지**가 곧 원인이다
            //   (교환권이 `/api/products` 를 두 번 부르는 것을 경로만 보고는 못 가른다).
            API_LOG.push(`+${String(at).padStart(5)}ms  ${req.url} → ${String(body || '').slice(0, 60)}`)
            return origEnd(body)
          }
        }
        /**
         * ⏱️ `--slow=N` 은 **모든** 스텁 응답을 늦춘다 (2026-10-01).
         *   처음엔 `/api/seller/my-stores/summary` 하나에만 걸려 있었다. 그래서 다른 화면에
         *   `--shift` 를 걸면 스텁이 즉답이라 **늘 "안 밀림"** 이 나왔다 — 통과가 아니라 측정을
         *   안 한 것이다. 밀림은 "늦게 오는 응답"이 만드는 현상이므로 전 경로를 늦춰야 보인다.
         */
        if (SLOW > 0) {
          const realEnd = res.end.bind(res)
          res.end = (body) => { setTimeout(() => realEnd(body), SLOW); return res }
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
        /**
         * 📊 매출 분석 — `--analytics` **또는 `--seller-lists`** 로 열린다.
         *
         * 🩸 2026-10-01: 셀러 일곱을 한 명령으로 재려는데 `/seller/analytics` 만 플래그가 따로라
         *   `--seller-lists` 로는 계속 🟡("잴 내용이 없다")였다. 일곱 중 하나가 다른 깃발을
         *   요구하면 **다음 세션은 그 하나를 안 잰다**(실제로 2차가 그렇게 빠뜨렸다).
         *   `--analytics=empty` 는 그대로 — "판 적은 있으나 이 기간엔 없음" 을 따로 보는 깃발이다.
         */
        if (args.analytics || SELLER_LISTS) {
          if (p === '/api/seller/analytics/detailed') return res.end(JSON.stringify({ success: true, data: ANALYTICS_DETAILED }))
          if (p.startsWith('/api/seller/analytics/chart/revenue')) {
            const none = args.analytics === 'empty' || SELLER_LISTS === 'empty'
            return res.end(JSON.stringify({ success: true, data: none ? [] : ANALYTICS_REVENUE }))
          }
        }
        if (SELLER_LISTS) {
          const hit = sellerListResponse(p, SELLER_LISTS)
          if (hit) return res.end(JSON.stringify(hit))
        }
        // ⏱️ 지연은 위 전역 `--slow` 래퍼가 건다 — 여기서 또 늦추면 이 경로만 **두 배**가 된다.
        //    (#1601 의 개선을 그대로 승계 — 이 머지에서 내 쪽 per-route setTimeout 을 버렸다.)
        if (STORES_N > 0 && p === '/api/seller/my-stores/summary')
          return res.end(JSON.stringify(storesSeed(STORES_N)))
        // 🎬 레일은 홈 어느 경로에서든 뜬다 — 플래그 없이 항상 준다.
        if (p === '/api/urshorts') return res.end(JSON.stringify({ success: true, data: SHORTS_SEED }))
        if (args.wallet && p === '/api/vouchers/my')
          return res.end(JSON.stringify({ success: true, data: WALLET_VOUCHERS }))
        if (args.deals) {
          if (p === '/api/vouchers/categories') return res.end(JSON.stringify({ success: true, data: VOUCHER_SECTIONS }))
          // 상세는 **단건**이다 — 목록과 같은 배열을 주면 화면이 안 그려진다.
          const m = p.match(/^\/api\/(?:group-buy\/)?products\/(\d+)/)
          if (m) {
            /**
             * 🩸 2026-10-01 — **스텁이 시드와 같은 값을 줘야 한다.**
             *   그전까지 이 분기는 `DEALS` 원본을 그대로 줬는데, `__SSR_INITIAL_DETAIL__` 시드는
             *   거기에 `description`·`current_discount_pct`·`group_buy_tiers` 를 **더해서** 넣는다.
             *   그래서 [시드로 그린 첫 프레임] → [스텁 응답으로 다시 그린 프레임] 사이에
             *   '상품 구성' 블록이 사라지고 가격·할인율이 바뀌어 **−130px 밀림이 측정됐다.**
             *   그건 제품 결함이 아니라 **이 하네스가 만든 가짜**다 — 라이브에서는 워커가 같은
             *   엔드포인트를 self-fetch 해 시드를 만들므로 둘이 애초에 같은 값이다.
             *   ⇒ 여기서도 같은 값을 돌려준다. 안 그러면 이 도구가 없는 결함을 신고한다.
             */
            if (DETAIL_SEED && String(DETAIL_ID) === m[1])
              return res.end(JSON.stringify({ ...DETAIL_SEED, product: DETAIL_SEED.data }))
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

NAV_T0 = Date.now()
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
    return { pos: Object.fromEntries(m), docH: document.documentElement.scrollHeight, vh: window.innerHeight }
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
    /**
     * 👁️ **보이는 곳이 밀렸는가** 를 따로 센다 (2026-10-01).
     *   그전까지는 문서 전체의 이동만 셌는데, 그러면 **화면 밖 푸터가 움직인 것**과
     *   **읽고 있던 줄이 손가락 밑에서 움직인 것**이 같은 숫자로 보고된다. 둘은 심각도가
     *   전혀 다르다 — 전자는 아무도 모르고, 후자는 대표가 신고한 바로 그 증상이다.
     *   기준: 첫 스냅 시점의 y 가 첫 화면(뷰포트) 안이면 '보이는 곳'.
     *   ⚠️ 스크롤 0 을 가정한다(하네스는 늘 맨 위에서 잰다).
     */
    const fold = a.vh || 0
    let movedVisible = 0
    for (const [k, y] of Object.entries(a.pos)) {
      if (!(k in b.pos)) { gone.push(k); continue }
      const d = b.pos[k] - y
      if (Math.abs(d) > 8) {
        const vis = y < fold
        if (vis) movedVisible++
        moved.push(`${vis ? '👁️ ' : '   '}${k} ${y}→${b.pos[k]} (${d > 0 ? '+' : ''}${d})`)
      }
    }
    for (const k of Object.keys(b.pos)) if (!(k in a.pos)) born.push(k)
    const verdict = movedVisible ? '🔴 보이는 곳이 밀림' : moved.length ? '🟡 화면 밖만 밀림' : '🟢 안 밀림'
    console.log(`📐 밀림 측정 [${ROUTE}] ${label} ${verdict} — 이동 ${moved.length}(보이는 곳 ${movedVisible}) · 사라짐 ${gone.length} · 생김 ${born.length} · 문서높이 ${a.docH}→${b.docH}px`)
    /**
     * 🤖 기계가 읽는 한 줄. `check-layout-shift.mjs` 가 이 하네스를 **그대로 불러서** 판정한다 —
     *   측정기를 두 벌 만들면 둘이 갈리고, 그때 가드 쪽이 조용히 헛돌게 된다(이 레포의 단골 사고).
     *   ⚠️ 형식을 바꾸면 그 가드가 **0건을 읽고 통과**할 수 있다. 그래서 가드는 줄을 **못 찾으면
     *      실패**하도록 돼 있다(그쪽 `parse()` 주석 참조).
     */
    console.log(`SHIFT_RESULT ${JSON.stringify({ route: ROUTE, label, moved: moved.length, movedVisible, gone: gone.length, born: born.length, docH: [a.docH, b.docH], top: moved.slice(0, 6) })}`)
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

/**
 * 📐 `--probe="<선택자>"` — 그 요소들의 **실제 박스**를 찍는다(여러 개면 `;` 로 나눈다).
 *
 * 🩸 왜 생겼나 (2026-10-01): 공용 chrome 의 탭 타깃을 키우고 *"줄 수가 26 → 24 로 줄었는데
 *   배너가 두꺼워진 건가?"* 를 판정할 길이 없었다. `--phone-audit` 의 `첫화면 줄` 은 844px
 *   경계에 걸려 **노이즈가 크다**(한 줄이 1px 내려가도 숫자가 바뀐다) ⇒ 박스를 직접 재야 한다.
 *   박스 모델로 추론해서 "안 변했을 것" 이라고 적는 것이 이 레포가 반복해 당한 클래스다.
 */
if (typeof args.probe === 'string') {
  const boxes = await page.evaluate((sels) => sels.split(';').map((sel) => {
    const el = document.querySelector(sel.trim())
    if (!el) return { sel: sel.trim(), missing: true }
    const r = el.getBoundingClientRect()
    return { sel: sel.trim(), h: Math.round(r.height), w: Math.round(r.width), top: Math.round(r.top) }
  }), args.probe)
  console.log(`   📐 박스: ${JSON.stringify(boxes)}`)
}
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

    /**
     * ③ 잘린 글자 — 리프 노드만(조상은 자식 때문에 늘 초과로 잡힌다).
     *
     * 🩸 2026-10-01 — **줄임표를 결함으로 세고 있었다.** 셀러 이용권 행·협업 제안은 긴 상품명을
     *   `truncate`(= `text-overflow: ellipsis`)로 **일부러** 줄인다(`VoucherRow.tsx:141`).
     *   그걸 `clipped` 로 세니 두 화면이 🔴 로 떴는데, 390px 에서 긴 이름을 줄이는 건 설계다.
     *   ⇒ 둘을 **가른다**: 신호 없는 하드 클립만 🔴(글자가 소리 없이 사라진다) · 줄임표·line-clamp 는
     *     따로 적어 사람이 *"그 문자열을 줄여도 되나"* 를 판단하게 한다.
     *   ⚠️ 합치면 안 된다 — 늘 빨간불이면 다음 세션이 빨간불을 무시하게 되고, 그때 진짜 하드 클립이 섞여 들어온다.
     */
    const clipped = []
    const ellipsis = []
    for (const el of document.querySelectorAll('p,span,h1,h2,h3,h4,h5,td,th,button,a,label,div,li')) {
      if (el.children.length || !seen(el)) continue
      const t = (el.textContent || '').trim()
      if (t.length < 2) continue
      const cs = getComputedStyle(el)
      /**
       * 🔇 **보조기기 전용 글자(`sr-only`)는 잘려 있는 게 정상이다** (2026-10-01).
       *   탭루윈드 `sr-only` 는 `1px` 상자 + `clip: rect(0,0,0,0)` 로 **일부러** 숨긴다.
       *   `/user/profile` 의 `<h1 className="sr-only">마이페이지</h1>` 가 그것이고, 그 한 줄 때문에
       *   마이가 🔴 로 떴다 — 종전 줄임표 오탐과 **같은 클래스**다(의도를 결함으로 세는 것).
       *   ⚠️ 클래스 이름이 아니라 **계산된 모양**으로 판정한다 — 같은 기법을 손으로 쓴 자리도 잡힌다.
       */
      const srOnly = cs.position === 'absolute'
        && (el.clientWidth <= 1 || el.clientHeight <= 1)
        && cs.overflow !== 'visible'
      if (srOnly) continue
      const signalled = cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none'
      if (signalled) {
        // line-clamp 은 세로로 넘친다 — 가로(scrollWidth) 로는 안 잡힌다.
        if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) ellipsis.push(t.slice(0, 34))
        continue
      }
      if (el.scrollWidth > el.clientWidth + 1) clipped.push(t.slice(0, 34))
    }

    /**
     * ④ 작은 터치 타깃 — 숨은 것·아이콘만인 것도 눌러야 하므로 모두 센다.
     *
     * 📏 바는 **40px** 이다 — 외부 규격(Apple HIG·WCAG AAA 의 44)이 아니라 **이 레포의 디자인
     *   시스템 눈금**(`.ur-btn-md { height: 2.5rem }` = 40px, `index.css`)이다. 외부 숫자를 들여오면
     *   체계가 정한 보통 버튼이 전부 "위반" 이 되고, 그러면 아무도 안 고친다.
     *   ⇒ 고치는 방향은 "44 를 새로 만들기" 가 아니라 **`ur-btn-md` 눈금에 맞추기**다.
     */
    const tiny = []
    const reachDead = []
    for (const el of document.querySelectorAll('button, a[href], [role="button"], input:not([type="hidden"]), select')) {
      if (!seen(el)) continue
      const r = el.getBoundingClientRect()
      /**
       * 🩸 2026-10-01 — **`getBoundingClientRect` 는 `::after` 로 넓힌 히트 영역을 못 본다.**
       *   공용 배너의 닫기는 박스가 24px 이지만 `.tap-reach` 가 닿는 범위를 40px 로 넓혀 둔다
       *   (박스째 키우면 같은 행의 글자 칸이 좁아져 배너가 +39px 두꺼워진다 — 실측으로 되돌렸다).
       *   그 자리를 계속 "작은 타깃" 으로 세면 다음 세션이 **또 박스를 키운다.**
       *   ⇒ 유효 크기는 `::after` 를 합쳐 재고, **진짜로 눌리는지는 히트 테스트로 확인한다**
       *     (클래스가 붙었는지만 보면 조상 `overflow: hidden` 에 잘린 경우를 놓친다 — 그게 이
       *      기법의 유일한 함정이고, 함정은 눈으로 안 보인다).
       */
      const af = getComputedStyle(el, '::after')
      const reachH = af.content !== 'none' ? Math.max(r.height, parseFloat(af.height) || 0) : r.height
      const reachW = af.content !== 'none' ? Math.max(r.width, parseFloat(af.width) || 0) : r.width
      if (reachH > r.height + 1) {
        // 넓힌 만큼이 실제로 이 요소에 닿는가 — 아래쪽 바깥 1px 지점을 찍어 본다.
        const y = r.top + r.height + Math.min((reachH - r.height) / 2, 8) - 1
        const x = r.left + r.width / 2
        const hit = document.elementFromPoint(x, y)
        if (!(hit === el || el.contains(hit))) reachDead.push({ s: label(el) || el.tagName.toLowerCase(), h: Math.round(r.height), reach: Math.round(reachH) })
      }
      if (reachH < 40) tiny.push({ h: Math.round(reachH), w: Math.round(reachW), s: label(el) || el.tagName.toLowerCase() })
    }
    // 같은 것이 여러 번 나오면(행마다 붙는 버튼) 한 줄로 묶는다 — 다섯 개만 보면 공용 chrome 과
    // 페이지 고유 버튼을 구분할 수 없다(2026-10-01 에 실제로 그래서 두 번 다시 쟀다).
    const tinyCensus = Object.entries(tiny.reduce((m, t) => {
      const k = `${t.h}x${t.w} ${t.s}`; m[k] = (m[k] || 0) + 1; return m
    }, {})).map(([k, n]) => (n > 1 ? `${k} ×${n}` : k))

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
      ellipsis: ellipsis.length, ellipsisSample: ellipsis.slice(0, 5),
      tiny: tiny.length, tinySample: tiny.slice(0, 5), tinyCensus,
      reachDead: reachDead.length, reachDeadSample: reachDead.slice(0, 5),
      tables: tables.filter((t) => t.w > vw && !t.wrapped).length, tablesAll: tables.length,
      firstScreen,
      docH: document.documentElement.scrollHeight,
    }
  }, VIEWPORT_W)
  /**
   * 🩸 2026-10-01 — **빈 화면을 재고 "🟢 깨끗" 을 내던 것**(2026-09-30 측정 1차가 그렇게 헛돌았다).
   *   빈 목록은 당연히 가로스크롤 0 · 잘린 글자 0 이다. 오류 화면도 마찬가지다.
   *   ⇒ 본문을 보고 **재는 대상이 있었는지 먼저 의심한다.** 결함 0 과 "잴 게 없었음" 은 다른 결론이다.
   *   ⚠️ 이건 "빈 상태 화면을 못 재게" 하는 게 아니다(`--seller-lists=empty` 는 일부러 그걸 본다) —
   *     **초록을 빈손으로 내주지 않는 것**이다.
   */
  const bodyText = await page.innerText('body').catch(() => '')
  // 🩸 2026-10-01: 이 판정이 **거짓 🟡 를 내고 있었다** — 안내 문장 "별도의 정산 신청은 필요 없습니다"
  //   가 맨 `없습니다` 에 걸려, 끝까지 멀쩡히 그려지는 /seller/settlements 가 "판정 보류" 였다.
  //   규칙·근거·반례는 `preview-seeds/empty-screen-hint.mjs` 머리주석, 고정은 그 테스트.
  //   🔀 **머지(2026-10-01)**: 이 자리에 같은 날 두 수리가 들어왔다. 같은 거짓 🟡 를 봤는데
  //     한쪽은 **본문 두께**(글자 수)로 눌렀고 한쪽은 **정규식의 뿌리**(조사 `이/가` 가 가른다)를
  //     고쳤다. 뿌리 쪽을 남긴다 — 두께는 대리 지표라 "긴 안내문 + 데이터 0" 화면을 통과시킨다.
  const suspect = looksEmpty(bodyText, audit.firstScreen)
  // 넓혔다고 선언한 히트 영역이 실제로 안 닿으면 **결함이다** — 고친 줄 알고 넘어가게 된다.
  const bad = audit.hScroll > 0 || audit.cut > 0 || audit.clipped > 0 || audit.tables > 0 || audit.reachDead > 0
  console.log(`📱 폰 적합성 [${ROUTE}] ${bad ? '🔴 결함 있음' : suspect ? '🟡 판정 보류 — 잴 내용이 없다' : '🟢 깨끗'}`)
  if (suspect) {
    const why = emptyHintMatch(bodyText)
    console.log(`   ⚠️ 빈 상태·오류 화면으로 보인다. 이 숫자를 "폰에서 쓸 만하다" 로 읽지 말 것(시드를 먼저 채울 것).`)
    // 🔎 **왜 🟡 인지 같이 찍는다** — 판정만 보여 주면 고칠 수가 없다(문구가 없으면 첫화면 줄 수가 이유다).
    console.log(`   ↳ 근거: ${why ? `"${why}"` : `첫화면 ${audit.firstScreen}줄(8 미만)`}`)
  }
  console.log(`   가로스크롤 ${audit.hScroll}px · 잘려나감 ${audit.cut} · 잘린글자 ${audit.clipped} · 줄임표 ${audit.ellipsis} · 작은타깃 ${audit.tiny} · 표오버플로 ${audit.tables}/${audit.tablesAll} · 첫화면 ${audit.firstScreen}줄 · 문서높이 ${audit.docH}px`)
  if (audit.cutSample.length) console.log(`   잘려나감: ${JSON.stringify(audit.cutSample)}`)
  if (audit.clippedSample.length) console.log(`   잘린글자: ${JSON.stringify(audit.clippedSample)}`)
  if (audit.ellipsisSample.length) console.log(`   줄임표(의도): ${JSON.stringify(audit.ellipsisSample)}`)
  if (audit.tinyCensus.length) console.log(`   작은타깃(종류): ${audit.tinyCensus.join(' | ')}`)
  if (audit.reachDeadSample.length) console.log(`   🔴 안 닿는 히트영역: ${JSON.stringify(audit.reachDeadSample)}`)
  console.log(`   PHONE_AUDIT_JSON ${JSON.stringify({ route: ROUTE, name: NAME, suspect, ...audit, cutSample: undefined, clippedSample: undefined, ellipsisSample: undefined, tinySample: undefined, tinyCensus: undefined, reachDeadSample: undefined })}`)
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
  /**
   * 🤖 기계가 읽는 한 줄 — `check-duplicate-fetch.mjs` 가 이것만 읽는다.
   *   사람이 보는 위 목록과 **같은 출처**라야 둘이 안 갈린다(측정기를 두 벌 만들지 않는다).
   *   `📦`(청크)는 빼고 `/api/*` 만 — 중복 판정의 대상은 데이터 요청이다.
   */
  const calls = API_LOG
    .filter((l) => !l.includes('📦'))
    .map((l) => {
      const m = l.match(/^\+\s*(-?\d+)ms\s+(\S+)/)
      return m ? { at: Number(m[1]), url: m[2] } : null
    })
    .filter(Boolean)
  console.log(`FETCH_RESULT ${JSON.stringify({ route: ROUTE, calls })}`)
}
if (/문제가 발생|오류가 발생/.test(text)) {
  console.log('   ⚠️  오류 화면이다 — 시드가 라우트와 안 맞거나 목 응답 모양이 틀렸다.')
}

await browser.close()
server.close()
