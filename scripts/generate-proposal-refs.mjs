#!/usr/bin/env node
/**
 * generate-proposal-refs.mjs
 *
 * docs/proposals/ 의 5개 소개서 + 1개 마스터 커버리지 문서를 코드와 자동 동기화.
 * (guide auto-reference 시스템의 소개서 버전 — 같은 스캔 방식을 재사용 + 확장.)
 *
 * 각 문서에 delimited AUTO 블록을 주입/갱신:
 *   <!-- AUTO-GENERATED:proposal-refs START --> … <!-- AUTO-GENERATED:proposal-refs END -->
 * 블록 내용:
 *   1. 핵심 수치 (자동 추출) — 해당 도메인에 관련된 코드 상수 (값 + 출처 파일:심볼).
 *   2. 도메인 코드 인벤토리 (자동) — 관련 페이지 라우트 + API 엔드포인트.
 *   (마스터 00 문서는 전체 인벤토리 + 버킷별 커버리지 요약.)
 *
 * 핵심 수치는 코드에서 robust regex 로 실제 값 추출. 확신 못 하면 `[추출실패—수동확인]`.
 *
 * Anti-churn: 타임스탬프(`마지막 생성:` 라인)를 제외한 블록 본문이 기존과 동일하면
 *   파일을 다시 쓰지 않음 (매 커밋마다 noisy diff 방지).
 *
 * 자동 호출:
 *   - pre-commit hook (매 커밋, anti-churn 으로 실제 변경시만 stage)
 *   - npm run generate:proposal-refs
 *   - 직접: node scripts/generate-proposal-refs.mjs
 *
 * 의존성: Node 내장 모듈만 (ESM .mjs).
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PROPOSALS_DIR = path.join(ROOT, 'docs/proposals')

const START = '<!-- AUTO-GENERATED:proposal-refs START -->'
const END = '<!-- AUTO-GENERATED:proposal-refs END -->'
const TS_PREFIX = '> 마지막 생성:'
const MISSING = '[추출실패—수동확인]'

// ─────────────────────────────────────────────────────────────
// 0. 도메인 정의 — 확장 쉽게: 각 소개서 파일 → 상수 subset + 라우트/페이지 prefix.
//    NUMBER_GROUPS / route prefix 는 아래 헬퍼들이 채움.
// ─────────────────────────────────────────────────────────────

// 5개 비즈니스 도메인 버킷.
const DOMAINS = ['wholesale', 'offline-groupbuy', 'online-listing', 'linkshop', 'agency']

// 페이지 라우트 prefix (App.tsx / src/routes/*.tsx) — 도메인별.
//   더 구체적인 prefix 가 먼저 매칭되도록 classify 에서 순서대로 검사.
const PAGE_PREFIXES = {
  wholesale: ['/wholesale', '/supplier', '/seller/supply', '/seller/register/supplier'],
  'offline-groupbuy': [
    '/meal-vouchers', '/restaurant-map', '/stays', '/my-stays', '/community-group-buy',
    '/my-appointments', '/group-buy', '/g/',
    // 매장/오프라인 셀러 도구 (online-listing catch-all `/seller` 보다 길어 우선).
    '/seller/stays', '/seller/appointments', '/seller/meal-voucher', '/seller/store-dashboard',
    '/seller/voucher-orders', '/seller/products/:id/booking-slots',
  ],
  'online-listing': [
    '/browse', '/products', '/product', '/cart', '/checkout', '/my-orders', '/my-returns',
    '/search', '/wishlist', '/live', '/shorts', '/vouchers', '/my-vouchers', '/v', '/store',
    // 셀러 입점/운영 대시보드 (C1~C11) = 온라인 입점 소개서 소유 (master 문서 §2).
    //   catch-all `/seller` 는 맨 끝 — 더 구체적 도메인(stays/supply/donations 등)이 우선.
    '/seller',
  ],
  linkshop: ['/profile/', '/s/', '/host', '/referral', '/u/', '/curator', '/user/affiliate', '/seller/donations', '/seller/mini-shop'],
  agency: ['/agency', '/agency-partner', '/a/', '/influencer', '/seller/castings', '/seller/prospects'],
}
// 페이지 prefix 명시 매칭(set) — admin 페이지 등 prefix 로 안 잡히는 것.
//   ⚠️ 도메인 전용 admin 페이지만. 범용 admin 콘솔(G5)은 공통/인프라 allowlist 로.
const PAGE_EXACT = {
  wholesale: new Set([
    '/admin/suppliers', '/admin/distributor-grades', '/admin/wholesale-orders', '/admin/wholesale-guide',
  ]),
  'offline-groupbuy': new Set([
    '/admin/stays', '/admin/restaurant-demand', '/admin/voucher-orders', '/admin/voucher-transactions',
    '/admin/group-buy', '/admin/deals',
  ]),
  agency: new Set([
    '/admin/agencies', '/admin/agency-creator-approval', '/admin/castings',
    '/admin/influencer-disputes', '/admin/influencer-payouts',
  ]),
}

// API 엔드포인트 prefix — 도메인별 (worker 마운트 후 fullPath 기준).
const API_PREFIXES = {
  wholesale: [
    '/api/supplier', '/api/wholesale', '/api/supply', '/api/admin/suppliers',
    '/api/admin/distributor', '/api/admin/supplier-products',
  ],
  'offline-groupbuy': [
    '/api/community-group-buy', '/api/group-buy', '/api/appointments', '/api/restaurant',
    '/api/restaurant-suggestions', '/api/hosting', '/api/funding', '/api/stays',
    // 매장/오프라인 셀러 sub-route (online-listing catch-all `/api/seller` 보다 길어 우선).
    '/api/seller/stays', '/api/seller/appointments', '/api/seller/voucher',
    '/api/seller/meal-voucher', '/api/seller/store-dashboard',
    '/api/admin/stays', '/api/admin/voucher-orders', '/api/admin/voucher-transactions',
  ],
  'online-listing': [
    '/api/products', '/api/orders', '/api/cart', '/api/search', '/api/shipping', '/api/returns',
    '/api/shorts', '/api/seller/youtube', '/api/youtube', '/api/multi-platform', '/api/cafe24',
    '/api/streaming', '/api/timedeal', '/api/auction', '/api/vouchers',
    // 리뷰/리뷰보너스 (C6), 배송지 (C3), 유튜브 성장 (C10) — 셀러 운영 = online-listing.
    '/api/review-bonus', '/api/admin-review-bonus', '/api/shipping-addresses', '/api/youtube-growth',
    // 라이브커머스 송출/시청/채팅 (A1·A2 판매채널 — online-listing 소유).
    '/api/streams', '/api/live', '/api/chat', '/api/platforms',
    // 셀러 입점/운영 대시보드 catch-all (C1~C11) = 온라인 입점 (master §2).
    //   맨 끝 — longest-prefix-wins 로 위의 도메인 전용 seller sub-route 가 먼저 잡힘.
    '/api/seller', '/api/sellers',
  ],
  linkshop: [
    '/api/curator', '/api/seller-public', '/api/referral', '/api/referral-tree', '/api/affiliate',
    '/api/donations', '/api/donation-boosters', '/api/donation-boosters-public',
    '/api/donation-booster', '/api/seller/donations',
  ],
  agency: [
    '/api/agency', '/api/admin/castings', '/api/seller/castings', '/api/admin/agencies',
    '/api/admin/agency-creator-approvals', '/api/agency-public', '/api/pk-public', '/api/pk',
    // 크리에이터 영입/정산/랭킹 (E·F2 — 에이전시/영입 소유).
    '/api/influencer-discover', '/api/influencer-rankings', '/api/influencer-settlement',
    '/api/seller-marketing', '/api/admin-payouts', '/api/seller/promote-boosts',
    '/api/admin/influencer', '/api/admin/agency',
  ],
}

// ── 중첩/register-pattern 마운트 override (src/worker/index.ts 만으로는 안 잡힘) ──
//   일부 라우터는 부모 라우터 내부에서 마운트됨:
//     group-buy.routes.ts: `groupBuyRoutes.route('/admin', groupBuyAdminRoutes)` +
//       `registerSellerEndpoints(groupBuyRoutes)` / `registerPublicEndpoints(...)` / `registerVoucherEndpoints(...)`
//       → 모두 부모 `/api/group-buy` (admin 만 `/api/group-buy/admin`) 아래.
//   index.ts 파서가 못 보는 이런 케이스만 **명시적**으로 등록. (값=relative path, 키=relative file.)
//   ⚠️ 새 중첩 마운트 추가 시 여기 등록 — 아니면 UNCOVERED 에 bare path 로 노출되어 즉시 감지됨.
const NESTED_MOUNT_OVERRIDES = {
  'src/features/group-buy/api/group-buy-public.routes.ts': ['/api/group-buy'],
  'src/features/group-buy/api/group-buy-seller.routes.ts': ['/api/group-buy'],
  'src/features/group-buy/api/group-buy-voucher.routes.ts': ['/api/group-buy'],
  'src/features/group-buy/api/group-buy-admin.routes.ts': ['/api/group-buy/admin'],
}

// 도메인 한국어 라벨.
const DOMAIN_LABEL = {
  wholesale: '도매몰 (유통스타트)',
  'offline-groupbuy': '오프라인 공구 / 동네딜',
  'online-listing': '온라인 입점 / 라이브커머스',
  linkshop: '링크샵 / 큐레이터',
  agency: '에이전시',
}

// 소개서 파일 → 도메인 매핑. (마스터는 전체.)
const FILE_DOMAIN = {
  'wholesale-mall-brief.md': 'wholesale',
  'offline-groupbuy-brief.md': 'offline-groupbuy',
  'online-listing-proposal-brief.md': 'online-listing',
  'linkshop-brief.md': 'linkshop',
  'agency-brief.md': 'agency',
}
const MASTER_FILE = '00-service-overview-and-coverage.md'

// ─────────────────────────────────────────────────────────────
// 0b. 공통/인프라 allowlist — 어떤 소개서의 "주제"도 아닌 cross-cutting 기능.
//    여기 매칭되는 페이지/엔드포인트는 "공통/인프라(의도적 제외)" 로 분류되어
//    UNCOVERED(=빠진 기능) 카운트에 들어가지 않음.
//
//    ⚠️ 감사 가능성(auditability): 이 목록은 명시적이고 주석 처리되어야 함.
//    도메인 관련 기능을 "인프라"로 숨기지 말 것 — 진짜 cross-cutting 만 등록.
//    UNCOVERED 에 도메인 관련 항목이 남으면 allowlist 가 아니라 버킷 prefix 를 확장.
// ─────────────────────────────────────────────────────────────

// 공통/인프라 페이지 — prefix 매칭 (path === pre || path startsWith pre + '/').
const COMMON_PAGE_PREFIXES = [
  // ── 인증 / 로그인 / OAuth / 카카오 ──
  '/login', '/register', '/join', '/auth', '/oauth', '/account',
  // ── 정적/법적/안내 페이지 ──
  '/about', '/business', '/faq', '/terms', '/privacy', '/privacy-policy',
  '/gdpr', '/refund', '/refund-policy', '/shipping-policy', '/introduce',
  '/blog', '/coupon', '/gift', '/following', '/interest-list',
  // ── 알림 ──
  '/notifications',
  // ── 결제 (Toss confirm / 충전 / 성공·실패 콜백) — 공통 결제 인프라 ──
  '/pay', '/payment', '/points', '/checkout-return',
  // ── 마이페이지 (개인 계정 — 어느 한 도메인 소유 아님) ──
  '/mypage', '/user/profile', '/my-coupons', '/my-deal-history',
  '/my-commissions', '/my-reviews', '/my/digital', '/my/follows',
  '/u/me',
  // ── 디버그 / 임베드 / 에러 페이지 (인프라) ──
  '/kakao-debug', '/toss-debug', '/embed', '/500',
  // ── 범용 어드민 운영 콘솔 (G5 — master 문서: "소개서 대상 아님(인프라)") ──
  //    승인/정산/분쟁/모니터링/세무/계정 등 전 도메인 가로지르는 운영 도구.
  //    ⚠️ 도메인 전용 admin 페이지(suppliers/stays/agencies/castings 등)는 위 PAGE_EXACT 로 버킷됨.
  '/admin',
  // ── 약관/법적 (정적) ──
  '/terms-of-service',
]

// 공통/인프라 페이지 — 정확 매칭 (prefix 로 잡으면 도메인 페이지까지 끌려오는 경우).
const COMMON_PAGE_EXACT = new Set([
  '/', '*', // 루트 + catch-all
  '/fail', '/success', // 범용 결제 결과 콜백
  '/seller', // 셀러 대시보드 루트 (개별 도메인 아님)
  '/admin', // 어드민 대시보드 루트
  '/orders', // 범용 주문 alias (실제 매핑은 /my-orders)
])

// 공통/인프라 API — prefix 매칭 (worker 마운트 후 fullPath 기준).
const COMMON_API_PREFIXES = [
  // ── 인증 / 세션 / OAuth / 카카오 ──
  '/api/auth', '/api/login', '/api/oauth', '/api/kakao', '/api/session',
  '/api/users', '/api/user', '/api/me', '/api/account', '/api/2fa',
  '/api/firebase', '/api/verify',
  // ── 알림 / 푸시 / 알림톡(공통 채널) ──
  '/api/notifications', '/api/dashboard-notifications', '/api/push',
  '/api/notification-settings', '/api/web-push',
  // ── 결제 / Toss confirm / 충전 / 환불 게이트웨이 (공통 결제 인프라) ──
  '/api/payment', '/api/payments', '/api/toss', '/api/points', '/api/charge',
  '/api/billing', '/api/webhook', '/api/webhooks',
  // ── 이미지 / 업로드 / 미디어 / R2 ──
  '/api/image', '/api/images', '/api/upload', '/api/media', '/api/r2',
  '/api/cdn', '/api/file', '/api/files',
  // ── 버전 / 헬스 / 진단 / repair-schema / 내부 ──
  '/api/version', '/api/health', '/api/healthz', '/api/ping', '/api/status',
  '/api/_internal', '/api/repair-schema', '/api/debug', '/api/diag',
  '/api/env', '/api/env-check', '/api/metrics',
  // ── i18n / 지역 / 검색(공통 글로벌) / 설정 ──
  '/api/i18n', '/api/locale', '/api/translations', '/api/region',
  '/api/settings', '/api/platform-settings', '/api/config',
  // ── 공통 유틸 (지도/주소/사업자검증/약관/배너/블로그/FAQ/쿠폰 등) ──
  '/api/public-utility', '/api/utility', '/api/geocode', '/api/address',
  '/api/business-verification', '/api/banners', '/api/blog', '/api/faq',
  '/api/coupons', '/api/coupon', '/api/reviews', '/api/review',
  '/api/follow', '/api/followers', '/api/following', '/api/wishlist',
  '/api/interest', '/api/bookmarks', '/api/gift', '/api/terms',
  '/api/contact', '/api/support', '/api/feedback', '/api/analytics',
  '/api/admin/audit', '/api/admin/notices', '/api/notices',
  // ── 인증 (root mount — `/auth/kakao/*` OAuth 콜백/시작) ──
  '/auth/kakao', '/auth', '/oauth', '/login', '/logout', '/change-password',
  '/id-token', '/check', '/disable', '/2fa', '/api/2fa',
  // ── 범용 어드민 운영 콘솔 API (G5 — 소개서 대상 아님, 전 도메인 가로지름) ──
  //    승인/정산/주문/상품/사용자/리뷰/쿠폰/배너/세무/모니터링/플래그/지급 등.
  //    ⚠️ 도메인 전용 admin(suppliers/distributor/stays/castings/agencies/influencer)은
  //       위 API_PREFIXES 에서 longest-prefix-wins 로 먼저 버킷됨 — 여기 안 옴.
  '/api/admin', '/api/disputes', '/api/flags', '/api/feature-flags', '/api/invite',
  '/api/dashboard-notifications', '/api/error', '/api/_errors', '/api/_healthcheck',
  '/api/_selftest', '/api/_bootstrap', '/api/_diag', '/api/csp-report',
  // ── 외부 supply / 기프티콘 catalog 연동 admin (KT Alpha/기프티쇼 — 외부 통합 운영) ──
  //    catalog/sync/settings 등 순수 외부연동 운영. 교환권 '주문'(voucher-orders/
  //    voucher-transactions)은 A4 교환권 도메인이라 offline-groupbuy 로 버킷(위 API_PREFIXES).
  '/api/admin/kt-alpha',
  // ── SEO / PWA / 정적 / 문서 (root mount 인프라) ──
  '/docs', '/api/docs', '/openapi.json', '/api/openapi.json', '/sitemap.xml',
  '/sw.js', '/manifest.webmanifest', '/robots.txt',
  '/api/home', '/api/flash-deals', '/api/vouchers/categories',
  // ── 외부 프록시 / 지도 / OCR / OG 이미지 / 환율 (공통 유틸 인프라) ──
  '/api/naver', '/api/kakao', '/api/ocr', '/api/og', '/api/currency', '/api/proxy', '/api/geo',
  // ── 결제/카카오/2fa root mount (worker payment/stripe/twofa) ──
  '/checkout-session', '/client-key', '/create-intent',
]

// 공통/인프라 API — 정확 매칭.
const COMMON_API_EXACT = new Set([
  '/api', '/', '/health', '/version',
  // PWA service-worker killer (root mount, 정규식 path).
  '/workbox-:hash{[a-zA-Z0-9]+}.js',
])

// ─────────────────────────────────────────────────────────────
// 1. 핵심 수치 추출 — 코드에서 robust regex. 실패 시 MISSING.
// ─────────────────────────────────────────────────────────────

function readSrc(rel) {
  const f = path.join(ROOT, rel)
  if (!fs.existsSync(f)) return null
  return fs.readFileSync(f, 'utf-8')
}

/** `SYMBOL: <number>` 형태에서 숫자 추출 (객체 속성 / const 둘 다). 천단위 _ 허용. */
function num(src, symbolRe) {
  if (!src) return null
  const m = src.match(symbolRe)
  if (!m) return null
  const raw = (m[1] || '').replace(/_/g, '')
  if (raw === '' || !Number.isFinite(Number(raw))) return null
  return Number(raw)
}

/** 비율 ratio(0.033) → "3.3%" 표기. */
function pctFromRatio(r) {
  if (r == null) return MISSING
  return `${+(r * 100).toFixed(4)}%`
}
function pct(v) {
  if (v == null) return MISSING
  return `${v}%`
}
function won(v) {
  if (v == null) return MISSING
  return `${v.toLocaleString('en-US')}원`
}

// 소스 캐시
const SRC = {
  policy: readSrc('src/shared/constants/policy.ts'),
  tax: readSrc('src/worker/utils/tax-withholding.ts'),
  pricing: readSrc('src/lib/distributor-pricing.ts'),
  settlement: readSrc('src/features/supply/api/supply-settlement.ts'),
  donations: readSrc('src/features/donations/api/donations.routes.ts'),
  storeIntro: readSrc('src/worker/utils/influencer-store-intro-commission.ts'),
  gbHelpers: readSrc('src/features/group-buy/api/helpers.ts'),
  community: readSrc('src/features/community-group-buy/api/community-group-buy.routes.ts'),
}

// 각 상수를 추출 — { label, value, source } 행.
function row(label, value, source) {
  return { label, value, source }
}

// ── 공통 수치 (여러 도메인 공유) ──
function taxRows() {
  const biz = num(SRC.tax, /business_income:\s*([\d._]+)/)
  const other = num(SRC.tax, /other_income:\s*([\d._]+)/)
  const threshold = num(SRC.tax, /ANNUAL_THRESHOLD\s*=\s*([\d_]+)/)
  return [
    row('원천징수 — 사업소득 (반복 활동, default)', biz == null ? MISSING : pctFromRatio(biz), 'src/worker/utils/tax-withholding.ts:WITHHOLDING_RATES.business_income'),
    row('원천징수 — 기타소득 (단발성 협업)', other == null ? MISSING : pctFromRatio(other), 'src/worker/utils/tax-withholding.ts:WITHHOLDING_RATES.other_income'),
    row('기타소득 분리과세 연 한도', won(threshold), 'src/worker/utils/tax-withholding.ts:ANNUAL_THRESHOLD'),
  ]
}

function platformFeeRows() {
  const fee = num(SRC.policy, /PLATFORM_FEE_PCT:\s*([\d._]+)/)
  const sellerComm = num(SRC.policy, /SELLER_COMMISSION_PCT:\s*([\d._]+)/)
  const affiliate = num(SRC.policy, /AFFILIATE_COMMISSION_PCT:\s*([\d._]+)/)
  return [
    row('플랫폼 fee (default)', pct(fee), 'src/shared/constants/policy.ts:COMMISSION_DEFAULTS.PLATFORM_FEE_PCT'),
    row('위탁 판매 셀러 commission', pct(sellerComm), 'src/shared/constants/policy.ts:COMMISSION_DEFAULTS.SELLER_COMMISSION_PCT'),
    row('제휴 마케팅 추천 보상 (default)', pct(affiliate), 'src/shared/constants/policy.ts:COMMISSION_DEFAULTS.AFFILIATE_COMMISSION_PCT'),
  ]
}

function minWithdrawalRows() {
  const minW = num(SRC.policy, /MIN_AMOUNT:\s*([\d_]+)/)
  const commMin = num(SRC.policy, /COMMISSION_MIN_WITHDRAWAL:\s*([\d_]+)/)
  return [
    row('최소 출금 금액', won(minW), 'src/shared/constants/policy.ts:WITHDRAWAL_DEFAULTS.MIN_AMOUNT'),
    row('최소 commission 출금', won(commMin), 'src/shared/constants/policy.ts:REFUND_POLICY.COMMISSION_MIN_WITHDRAWAL'),
  ]
}

// ── 도매몰 ──
function wholesaleRows() {
  const grades = ['A', 'B', 'C', 'D', 'OEM', 'SPECIAL']
  const gradeRows = grades.map((g) => {
    const v = num(SRC.pricing, new RegExp(`\\b${g}:\\s*([\\d._]+)`))
    return row(`유통사 등급 마진율 — ${g}등급`, pct(v), 'src/lib/distributor-pricing.ts:DEFAULT_GRADE_MARGINS')
  })
  const ungraded = (() => {
    const m = SRC.pricing && SRC.pricing.match(/DEFAULT_UNGRADED[^=]*=\s*['"]([A-Z]+)['"]/)
    return m ? m[1] : MISSING
  })()
  const dailyCap = num(SRC.settlement, /DEFAULT_DAILY_CAP\s*=\s*([\d_]+)/)
  const refundWindow = num(SRC.settlement, /SUPPLIER_REFUND_WINDOW_DAYS\s*=\s*([\d_]+)/)
  return [
    ...gradeRows,
    row('유통회원 가입 시 기본 등급', ungraded === MISSING ? MISSING : `${ungraded}등급`, 'src/lib/distributor-pricing.ts:DEFAULT_UNGRADED'),
    row('공급자 정산 1일 한도 (default)', won(dailyCap), 'src/features/supply/api/supply-settlement.ts:DEFAULT_DAILY_CAP'),
    row('공급자 환불창 (성숙 기간)', refundWindow == null ? MISSING : `${refundWindow}일`, 'src/features/supply/api/supply-settlement.ts:SUPPLIER_REFUND_WINDOW_DAYS'),
    ...taxRows(),
  ]
}

// ── 오프라인 공구 / 동네딜 ──
function offlineRows() {
  const mealRate = (() => {
    const m = SRC.gbHelpers && SRC.gbHelpers.match(/DEFAULT_MEAL_VOUCHER_COMMISSION_RATE\s*=\s*([\d._]+)/)
    if (!m) return MISSING
    const r = Number(m[1].replace(/_/g, ''))
    return Number.isFinite(r) ? pctFromRatio(r) : MISSING
  })()
  // TIER_COMMISSION 차등 수수료 (GMV 기반)
  const tierRows = []
  if (SRC.gbHelpers) {
    const re = /min_monthly_gmv:\s*([\d_]+),\s*rate:\s*([\d._]+)/g
    let m
    while ((m = re.exec(SRC.gbHelpers)) !== null) {
      const gmv = Number(m[1].replace(/_/g, ''))
      const r = Number(m[2].replace(/_/g, ''))
      tierRows.push(row(`차등 수수료 — 월 GMV ${won(gmv)} 이상`, pctFromRatio(r), 'src/features/group-buy/api/helpers.ts:TIER_COMMISSION'))
    }
  }
  if (tierRows.length === 0) tierRows.push(row('차등 수수료 (GMV 기반)', MISSING, 'src/features/group-buy/api/helpers.ts:TIER_COMMISSION'))

  // 커뮤니티 공구 (유저 공동구매) 기본값
  const deposit = num(SRC.community, /deposit_per_person\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+([\d_]+)/)
  const target = num(SRC.community, /target_count\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+([\d_]+)/)
  const popularThreshold = num(SRC.community, /current_count\s*[>=]+\s*([\d_]+)/)

  // 호스팅(누구나 공구 호스팅) 기본값
  const hostIncentive = num(SRC.policy, /HOST_INCENTIVE_PCT:\s*([\d._]+)/)
  const hostDeadline = num(SRC.policy, /DEFAULT_DEADLINE_DAYS:\s*([\d_]+)/)
  const hostMaxActive = num(SRC.policy, /MAX_ACTIVE_HOSTINGS:\s*([\d_]+)/)

  // 예약(appointment) 정책
  const noshowMin = num(SRC.policy, /APPOINTMENT_NOSHOW_ALERT_MIN:\s*([\d_]+)/)
  const cancelHours = num(SRC.policy, /APPOINTMENT_CANCEL_DEADLINE_HOURS:\s*([\d_]+)/)

  return [
    row('식사권 기본 수수료', mealRate, 'src/features/group-buy/api/helpers.ts:DEFAULT_MEAL_VOUCHER_COMMISSION_RATE'),
    ...tierRows,
    row('커뮤니티 공구 — 기본 보증금/인', won(deposit), 'src/features/community-group-buy/api/community-group-buy.routes.ts:deposit_per_person'),
    row('커뮤니티 공구 — 기본 목표 인원', target == null ? MISSING : `${target}명`, 'src/features/community-group-buy/api/community-group-buy.routes.ts:target_count'),
    row('커뮤니티 공구 — 인기 그룹 임계', popularThreshold == null ? MISSING : `${popularThreshold}명`, 'src/features/community-group-buy/api/community-group-buy.routes.ts:popular'),
    row('호스팅 인센티브 (호스트 적립)', pct(hostIncentive), 'src/shared/constants/policy.ts:HOSTING_DEFAULTS.HOST_INCENTIVE_PCT'),
    row('호스팅 기본 모집 기간', hostDeadline == null ? MISSING : `${hostDeadline}일`, 'src/shared/constants/policy.ts:HOSTING_DEFAULTS.DEFAULT_DEADLINE_DAYS'),
    row('호스트당 동시 공구 상한', hostMaxActive == null ? MISSING : `${hostMaxActive}개`, 'src/shared/constants/policy.ts:HOSTING_DEFAULTS.MAX_ACTIVE_HOSTINGS'),
    row('예약 노쇼 자동 알림', noshowMin == null ? MISSING : `시작 ${noshowMin}분 후`, 'src/shared/constants/policy.ts:REFUND_POLICY.APPOINTMENT_NOSHOW_ALERT_MIN'),
    row('예약 취소 환불 마감', cancelHours == null ? MISSING : `시작 ${cancelHours}시간 이내`, 'src/shared/constants/policy.ts:REFUND_POLICY.APPOINTMENT_CANCEL_DEADLINE_HOURS'),
    ...taxRows(),
  ]
}

// ── 온라인 입점 / 라이브커머스 ──
function onlineRows() {
  const staysCapPct = num(SRC.policy, /STAYS_COMMISSION_CAP_PCT:\s*([\d_]+)/)
  return [
    ...platformFeeRows(),
    row('외부 카테고리(숙박 등) 수수료 상한', pct(staysCapPct), 'src/shared/constants/policy.ts:COMMISSION_DEFAULTS.STAYS_COMMISSION_CAP_PCT'),
    ...minWithdrawalRows(),
    ...taxRows(),
  ]
}

// ── 링크샵 / 큐레이터 ──
function linkshopRows() {
  const bothsides = num(SRC.policy, /REFERRAL_BONUS_BOTHSIDES_PCT:\s*([\d._]+)/)
  const curatorAff = num(SRC.policy, /CURATOR_AFFILIATE_PCT:\s*([\d._]+)/)
  const affiliate = num(SRC.policy, /AFFILIATE_COMMISSION_PCT:\s*([\d._]+)/)
  const pinMax = num(SRC.policy, /PIN_MAX_PER_USER:\s*([\d_]+)/)
  const refCookie = num(SRC.policy, /REF_COOKIE_TTL_HOURS:\s*([\d_]+)/)
  const upgradeThreshold = num(SRC.policy, /SELLER_UPGRADE_THRESHOLD:\s*([\d_]+)/)
  // 후원 수수료 (default 15%) + 일일 한도
  const donationComm = (() => {
    const m = SRC.donations && SRC.donations.match(/COALESCE\(s\.donation_commission_rate,\s*([\d._]+)\)/)
    return m ? Number(m[1].replace(/_/g, '')) : null
  })()
  const donationCap = num(SRC.donations, /DAILY_CAP\s*=\s*([\d_]+)/)
  return [
    row('제휴 마케팅 추천 보상 (default)', pct(affiliate), 'src/shared/constants/policy.ts:COMMISSION_DEFAULTS.AFFILIATE_COMMISSION_PCT'),
    row('공구 양쪽 추천 보너스 (각각)', pct(bothsides), 'src/shared/constants/policy.ts:COMMISSION_DEFAULTS.REFERRAL_BONUS_BOTHSIDES_PCT'),
    row('큐레이터 핀 어필리에이트', pct(curatorAff), 'src/shared/constants/policy.ts:COMMISSION_DEFAULTS.CURATOR_AFFILIATE_PCT'),
    row('후원 수수료 (default)', pct(donationComm), 'src/features/donations/api/donations.routes.ts:donation_commission_rate fallback'),
    row('후원 1일 한도 (인당)', won(donationCap), 'src/features/donations/api/donations.routes.ts:DAILY_CAP'),
    row('큐레이터당 최대 핀 개수', pinMax == null ? MISSING : `${pinMax}개`, 'src/shared/constants/policy.ts:CURATOR_DEFAULTS.PIN_MAX_PER_USER'),
    row('추천 ref 쿠키 TTL', refCookie == null ? MISSING : `${refCookie}시간`, 'src/shared/constants/policy.ts:CURATOR_DEFAULTS.REF_COOKIE_TTL_HOURS'),
    row('큐레이터→셀러 승급 권유 임계 (누적 정산)', won(upgradeThreshold), 'src/shared/constants/policy.ts:WITHDRAWAL_DEFAULTS.SELLER_UPGRADE_THRESHOLD'),
    ...minWithdrawalRows(),
    ...taxRows(),
  ]
}

// ── 에이전시 ──
function agencyRows() {
  const agencyShare = num(SRC.policy, /AGENCY_SHARE_PCT:\s*([\d._]+)/)
  const agencyOwn = num(SRC.policy, /AGENCY_OWN_RATE:\s*([\d._]+)/)
  const influencerIntro = num(SRC.policy, /INFLUENCER_INTRO_SHARE_PCT:\s*([\d._]+)/)
  const storeIntro = (() => {
    const m = SRC.storeIntro && SRC.storeIntro.match(/DEFAULT_STORE_INTRO_PCT\s*=\s*([\d._]+)/)
    return m ? Number(m[1].replace(/_/g, '')) : null
  })()
  return [
    row('에이전시 입점 분배 (platform_fee 중)', pct(agencyShare), 'src/shared/constants/policy.ts:COMMISSION_DEFAULTS.AGENCY_SHARE_PCT'),
    row('에이전시 본인 commission (매출 기준)', pct(agencyOwn), 'src/shared/constants/policy.ts:COMMISSION_DEFAULTS.AGENCY_OWN_RATE'),
    row('인플루언서 입점 분배 (platform_fee 중)', pct(influencerIntro), 'src/shared/constants/policy.ts:COMMISSION_DEFAULTS.INFLUENCER_INTRO_SHARE_PCT'),
    row('크리에이터 매장 영입 commission (default)', pct(storeIntro), 'src/worker/utils/influencer-store-intro-commission.ts:DEFAULT_STORE_INTRO_PCT'),
    ...taxRows(),
  ]
}

const NUMBER_ROWS = {
  wholesale: wholesaleRows,
  'offline-groupbuy': offlineRows,
  'online-listing': onlineRows,
  linkshop: linkshopRows,
  agency: agencyRows,
}

// ─────────────────────────────────────────────────────────────
// 2. 코드 인벤토리 — 페이지 라우트 + API 엔드포인트 (guide 생성기 방식 재사용/확장).
// ─────────────────────────────────────────────────────────────

function extractRoutes() {
  const files = [path.join(ROOT, 'src/App.tsx')]
  const routesDir = path.join(ROOT, 'src/routes')
  if (fs.existsSync(routesDir)) {
    for (const name of fs.readdirSync(routesDir)) {
      if (name.endsWith('.tsx') && !name.endsWith('.test.tsx')) files.push(path.join(routesDir, name))
    }
  }
  const routes = []
  const routeRe = /<Route\s+path=["']([^"']+)["']/g
  for (const file of files) {
    if (!fs.existsSync(file)) continue
    const src = fs.readFileSync(file, 'utf-8')
    let m
    while ((m = routeRe.exec(src)) !== null) routes.push(m[1])
  }
  return [...new Set(routes)]
}

// prefix 매칭: path === pre 또는 path 가 pre 의 하위 경로(pre + '/').
function prefixMatch(p, pre) {
  const norm = pre.endsWith('/') ? pre.slice(0, -1) : pre
  return p === norm || p.startsWith(norm + '/')
}

// 가장 긴(=가장 구체적인) 매칭 prefix 의 도메인을 반환 — longest-prefix-wins.
//   예: `/seller`(online-listing) 보다 `/seller/stays`(offline) 가 더 길어 우선.
//   EXACT 매칭은 무한대 우선순위(가장 구체적).
function classifyRoute(p) {
  for (const d of DOMAINS) {
    if (PAGE_EXACT[d] && PAGE_EXACT[d].has(p)) return d
  }
  let best = null
  let bestLen = -1
  for (const d of DOMAINS) {
    for (const pre of PAGE_PREFIXES[d] || []) {
      const norm = pre.endsWith('/') ? pre.slice(0, -1) : pre
      if (prefixMatch(p, pre) && norm.length > bestLen) {
        best = d
        bestLen = norm.length
      }
    }
  }
  return best
}

// API 라우트 파일 디렉터리 — guide 생성기보다 넓게 (5개 도메인 전부).
function findRouteFiles() {
  const dirs = [
    'src/features/auth/api',
    'src/features/seller/api',
    'src/features/admin/api',
    'src/features/agency/api',
    'src/features/youtube/api',
    'src/features/youtube-growth/api',
    'src/features/donations/api',
    'src/features/restaurant-map/api',
    'src/features/restaurant-suggestions/api',
    'src/features/alimtalk/api',
    'src/features/supply/api',
    'src/features/group-buy/api',
    'src/features/community-group-buy/api',
    'src/features/appointments/api',
    'src/features/hosting/api',
    'src/features/funding/api',
    'src/features/products/api',
    'src/features/orders/api',
    'src/features/cart/api',
    'src/features/shipping/api',
    'src/features/returns/api',
    'src/features/shorts/api',
    'src/features/streaming/api',
    'src/features/timedeal/api',
    'src/features/auction/api',
    'src/features/multi-platform/api',
    'src/features/cafe24/api',
    'src/features/curator/api',
    'src/features/seller-public/api',
    'src/features/referral/api',
    'src/features/affiliate/api',
    'src/features/casting/api',
    'src/worker/routes',
  ]
  const files = []
  for (const d of dirs) {
    const full = path.join(ROOT, d)
    if (!fs.existsSync(full)) continue
    for (const name of fs.readdirSync(full)) {
      if (name.endsWith('.ts') && !name.endsWith('.d.ts') && !name.endsWith('.test.ts')) files.push(path.join(full, name))
    }
  }
  return files
}

// 파일 내부에서 선언된 Hono 라우터 인스턴스 변수명 집합.
//   `const X = new Hono(...)` / `let X = new Hono(...)` 둘 다. (export 여부 무관.)
//   이 집합으로 `.get/.post/...` 의 receiver 를 제한 → context 객체(`c.get('jwtPayload')`,
//   `c.req.header(...)`) 같은 false-positive 를 추출하지 않음.
function localRouterVars(src) {
  const vars = new Set()
  const re = /\b(?:const|let|var)\s+(\w+)\s*=\s*new\s+Hono\b/g
  let m
  while ((m = re.exec(src)) !== null) vars.add(m[1])
  return vars
}

// JSDoc / 라인 주석 제거 — 주석 안의 `app.post('/x', ...)` 예시가 endpoint 로 오인되는 것 차단.
//   (예: agency-role-guard.ts 의 사용법 주석.) 문자열 리터럴 보존은 불필요(우린 메서드 호출만 봄).
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '') // 블록 주석.
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1') // 라인 주석 ('://' URL 오삭제 방지로 직전 문자 보존).
}

function extractEndpoints(file) {
  const raw = fs.readFileSync(file, 'utf-8')
  const src = stripComments(raw)
  const routerVars = localRouterVars(src)
  // register-pattern: `export function registerXEndpoints(router: Hono...)` — param 이름을 라우터로.
  const registerParams = new Set()
  const regRe = /export\s+function\s+register\w*\s*\(\s*(\w+)\s*:/g
  let rp
  while ((rp = regRe.exec(src)) !== null) registerParams.add(rp[1])

  const endpoints = []
  const re = /\b(\w+)\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/g
  let m
  while ((m = re.exec(src)) !== null) {
    const receiver = m[1]
    // 실제 Hono 라우터(또는 register-pattern param)에 대한 호출만.
    //  context 객체(`c.get(...)`)는 절대 제외.
    if (receiver === 'c') continue
    // 라우터/register-param 식별 실패 파일 = util/guard/helper → endpoint 0 (false-positive 차단).
    if (routerVars.size === 0 && registerParams.size === 0) continue
    if (!routerVars.has(receiver) && !registerParams.has(receiver)) continue
    endpoints.push({ method: m[2].toUpperCase(), path: m[3], file: path.relative(ROOT, file), receiver })
  }
  return endpoints
}

// 파일 내부의 receiver 변수(`app`, `sellerApp`, …) → 외부 export 이름(들) 매핑.
//   `export { sellerApp as sellerMarketingRoutes }` / `export const fooRoutes = app`.
//   여러 라우터가 한 파일에서 각각 다른 prefix 로 마운트될 때 receiver 별 정확 해소에 사용.
function receiverExportAliases(src) {
  const map = {} // receiverVar → [exportName...]
  const add = (recv, name) => {
    if (!map[recv]) map[recv] = []
    if (!map[recv].includes(name)) map[recv].push(name)
  }
  let m
  // export { recv as alias, recv2 as alias2 }
  const reBrace = /export\s*\{([^}]+)\}/g
  while ((m = reBrace.exec(src)) !== null) {
    for (const part of m[1].split(',')) {
      const as = part.trim().match(/^(\w+)\s+as\s+(\w+)$/)
      if (as) add(as[1], as[2])
    }
  }
  // export const alias = recv
  const reAssign = /export\s+const\s+(\w+)\s*=\s*(\w+)\s*;?\s*$/gm
  while ((m = reAssign.exec(src)) !== null) add(m[2], m[1])
  return map
}

// index.ts 의 `import { x as y } from '...'` 를 파싱해 { localName → 절대 소스 파일 경로 }.
//   라우터가 mount 시점에 alias(`featureProductsRoutes`)로 불려도 원본 파일로 역추적 가능.
function parseImports(indexFile, src) {
  const dir = path.dirname(indexFile)
  const map = {} // localName → absFile (확장자 .ts 가정)
  const resolveAbs = (spec) => {
    let abs = path.resolve(dir, spec)
    if (!abs.endsWith('.ts')) abs += '.ts'
    return abs
  }
  // (a) named import: import { x, y as z } from '...'
  const reNamed = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g
  let m
  while ((m = reNamed.exec(src)) !== null) {
    const spec = m[2]
    if (!spec.startsWith('.')) continue
    const abs = resolveAbs(spec)
    for (const part of m[1].split(',')) {
      const seg = part.trim()
      if (!seg) continue
      const asMatch = seg.match(/^(\w+)\s+as\s+(\w+)$/)
      const local = asMatch ? asMatch[2] : (seg.match(/^(\w+)$/) || [])[1]
      if (local) map[local] = abs
    }
  }
  // (b) default import: import youtubeRoutes from '...'  (export default app 패턴.)
  const reDefault = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g
  while ((m = reDefault.exec(src)) !== null) {
    const spec = m[2]
    if (!spec.startsWith('.')) continue
    if (!map[m[1]]) map[m[1]] = resolveAbs(spec)
  }
  return map
}

// worker mount 분석. 반환:
//   byName: { routerLocalName → [fullPrefix...] }  (기존 호환)
//   byFile: { absSourceFile → [fullPrefix...] }     (import alias 우회 — 더 견고)
function extractMountedPrefixes() {
  const file = path.join(ROOT, 'src/worker/index.ts')
  if (!fs.existsSync(file)) return { byName: {}, byFile: {} }
  const src = fs.readFileSync(file, 'utf-8')
  const imports = parseImports(file, src)

  const directMap = {}
  const directRe = /(\w+)\.route\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\w+)\s*\)/g
  let m
  while ((m = directRe.exec(src)) !== null) {
    const [, mountApp, mountPath, routerName] = m
    if (!directMap[routerName]) directMap[routerName] = []
    directMap[routerName].push({ mountApp, mountPath })
  }
  // 부모 sub-app(`fooApp`) 자체가 `app.route('/prefix', fooApp)` 로 마운트된 경우의 접두.
  const subAppPrefix = {}
  for (const [routerName, mounts] of Object.entries(directMap)) {
    for (const { mountApp, mountPath } of mounts) {
      if (mountApp === 'app' && /^\w+App$/.test(routerName)) subAppPrefix[routerName] = mountPath
    }
  }
  const byName = {}
  const byFile = {}
  for (const [routerName, mounts] of Object.entries(directMap)) {
    if (!byName[routerName]) byName[routerName] = []
    for (const { mountApp, mountPath } of mounts) {
      const parentPrefix = mountApp === 'app' ? '' : (subAppPrefix[mountApp] || '')
      const finalPrefix = (parentPrefix + mountPath).replace(/\/+/g, '/').replace(/\/$/, '') || '/'
      byName[routerName].push(finalPrefix)
      const absFile = imports[routerName]
      if (absFile) {
        if (!byFile[absFile]) byFile[absFile] = []
        byFile[absFile].push(finalPrefix)
      }
    }
  }
  return { byName, byFile }
}

function extractRouterNames(file) {
  const src = fs.readFileSync(file, 'utf-8')
  const names = []
  let m
  // (a) export const X = new Hono(...)
  const re1 = /export\s+const\s+(\w+)\s*=\s*new\s+Hono/g
  while ((m = re1.exec(src)) !== null) names.push(m[1])
  // (b) export const X = <identifier>  (예: `export const fooRoutes = app`)
  const re1b = /export\s+const\s+(\w+)\s*=\s*\w+\s*;?\s*$/gm
  while ((m = re1b.exec(src)) !== null) names.push(m[1])
  // (c) export { app as fooRoutes } — alias 형태.
  const re2 = /export\s*\{\s*([^}]+)\}/g
  while ((m = re2.exec(src)) !== null) {
    // 콤마 구분 각 항목: `name` 또는 `orig as alias`. 외부에 노출되는 이름(alias 우선) 수집.
    for (const part of m[1].split(',')) {
      const seg = part.trim()
      if (!seg) continue
      const asMatch = seg.match(/^(\w+)\s+as\s+(\w+)$/)
      if (asMatch) names.push(asMatch[2])
      else {
        const plain = seg.match(/^(\w+)$/)
        if (plain) names.push(plain[1]) // `export { curatorRoutes }` — alias 없는 재노출.
      }
    }
  }
  if (/export\s+default\s+\w+/.test(src)) names.push('__default__')
  return [...new Set(names)]
}

// longest-prefix-wins (classifyRoute 와 동일 원칙).
//   `/api/seller`(online-listing catch-all) 보다 `/api/seller/stays`(offline) 가 우선.
function classifyEndpoint(fullPath) {
  let best = null
  let bestLen = -1
  for (const d of DOMAINS) {
    for (const pre of API_PREFIXES[d] || []) {
      if (prefixMatch(fullPath, pre) && pre.length > bestLen) {
        best = d
        bestLen = pre.length
      }
    }
  }
  return best
}

// ── 공통/인프라 allowlist 매칭 ──
//    page: COMMON_PAGE_EXACT / COMMON_PAGE_PREFIXES 중 하나라도 매칭.
function isCommonPage(p) {
  if (COMMON_PAGE_EXACT.has(p)) return true
  return COMMON_PAGE_PREFIXES.some((pre) => p === pre || p.startsWith(pre + '/'))
}
//    endpoint: COMMON_API_EXACT / COMMON_API_PREFIXES 중 하나라도 매칭.
function isCommonEndpoint(fullPath) {
  if (COMMON_API_EXACT.has(fullPath)) return true
  return COMMON_API_PREFIXES.some((pre) => fullPath === pre || fullPath.startsWith(pre + '/'))
}

// 전체 인벤토리 계산 (한 번만).
function computeInventory() {
  const routes = extractRoutes()
  const routeFiles = findRouteFiles()
  const mounted = extractMountedPrefixes()

  const allEndpoints = []
  for (const f of routeFiles) {
    const src = fs.readFileSync(f, 'utf-8')
    const names = extractRouterNames(f)
    const eps = extractEndpoints(f)
    const relFile = path.relative(ROOT, f)
    const recvAliases = receiverExportAliases(stripComments(src))

    // 파일 전체 fallback prefix 집합 (per-receiver 해소 실패 시).
    let filePrefixes = []
    if (NESTED_MOUNT_OVERRIDES[relFile]) filePrefixes.push(...NESTED_MOUNT_OVERRIDES[relFile])
    if (mounted.byFile[f]) filePrefixes.push(...mounted.byFile[f])
    for (const n of names) if (mounted.byName[n]) filePrefixes.push(...mounted.byName[n])
    filePrefixes = [...new Set(filePrefixes)]

    // 한 파일에 서로 다른 prefix 로 마운트되는 라우터가 ≥2개면 receiver 별 정밀 해소.
    //   (예: marketing.routes.ts 의 sellerApp/influencerApp/adminApp 등 5개.)
    //   receiver → export alias → byName[alias] prefix. 해소되면 그것만, 아니면 file fallback.
    for (const ep of eps) {
      if (ep.path === '/*' || ep.path === '*') continue
      let prefixes = []
      const aliases = recvAliases[ep.receiver] || []
      for (const a of aliases) if (mounted.byName[a]) prefixes.push(...mounted.byName[a])
      // receiver 자신이 직접 마운트 이름인 경우 (`adminApp` 등).
      if (mounted.byName[ep.receiver]) prefixes.push(...mounted.byName[ep.receiver])
      prefixes = [...new Set(prefixes)]
      // override 가 있으면 (register-pattern) 우선.
      if (NESTED_MOUNT_OVERRIDES[relFile]) prefixes = [...NESTED_MOUNT_OVERRIDES[relFile]]
      if (prefixes.length === 0) prefixes = filePrefixes.length ? filePrefixes : ['']
      for (const pref of prefixes) {
        const full = (pref + ep.path).replace(/\/+/g, '/')
        allEndpoints.push({ ...ep, fullPath: full })
      }
    }
  }
  const seen = new Set()
  const uniqueEndpoints = allEndpoints.filter((e) => {
    const k = `${e.method} ${e.fullPath}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  const buckets = {}
  for (const d of DOMAINS) buckets[d] = { pages: [], endpoints: [] }
  for (const r of routes) {
    const d = classifyRoute(r)
    if (d) buckets[d].pages.push(r)
  }
  for (const e of uniqueEndpoints) {
    const d = classifyEndpoint(e.fullPath)
    if (d) buckets[d].endpoints.push(e)
  }
  for (const d of DOMAINS) {
    buckets[d].pages = [...new Set(buckets[d].pages)].sort()
    buckets[d].endpoints = buckets[d].endpoints.sort(
      (a, b) => a.fullPath.localeCompare(b.fullPath) || a.method.localeCompare(b.method),
    )
  }

  // ── 커버리지 검증: 모든 페이지/엔드포인트를 3분류로 나눔 ──
  //    bucketed(도메인 매칭) / common(인프라 allowlist) / uncovered(둘 다 아님 = 빠진 기능).
  const allRoutes = [...new Set(routes)].sort()
  const commonPages = []
  const uncoveredPages = []
  for (const r of allRoutes) {
    if (classifyRoute(r)) continue // bucketed
    if (isCommonPage(r)) commonPages.push(r)
    else uncoveredPages.push(r)
  }

  const commonEndpoints = []
  const uncoveredEndpoints = []
  for (const e of uniqueEndpoints) {
    if (classifyEndpoint(e.fullPath)) continue // bucketed
    if (isCommonEndpoint(e.fullPath)) commonEndpoints.push(e)
    else uncoveredEndpoints.push(e)
  }
  const epSort = (a, b) => a.fullPath.localeCompare(b.fullPath) || a.method.localeCompare(b.method)
  commonEndpoints.sort(epSort)
  uncoveredEndpoints.sort(epSort)

  const coverage = {
    totalPages: allRoutes.length,
    totalEndpoints: uniqueEndpoints.length,
    bucketedPages: allRoutes.length - commonPages.length - uncoveredPages.length,
    bucketedEndpoints: uniqueEndpoints.length - commonEndpoints.length - uncoveredEndpoints.length,
    commonPages,
    commonEndpoints,
    uncoveredPages,
    uncoveredEndpoints,
  }

  return { buckets, coverage }
}

// ─────────────────────────────────────────────────────────────
// 3. 마크다운 블록 생성.
// ─────────────────────────────────────────────────────────────

function renderNumberTable(rows) {
  let md = '### 핵심 수치 (자동 추출)\n\n'
  md += '| 항목 | 값 | 출처 (파일:심볼) |\n'
  md += '|---|---|---|\n'
  for (const r of rows) {
    md += `| ${r.label} | ${r.value} | \`${r.source}\` |\n`
  }
  return md
}

function renderInventory(bucket) {
  let md = `### 도메인 코드 인벤토리 (자동) — 페이지 (${bucket.pages.length}개)\n\n`
  if (bucket.pages.length === 0) md += '(없음)\n'
  else md += bucket.pages.map((p) => `- \`${p}\``).join('\n') + '\n'

  md += `\n### 도메인 코드 인벤토리 (자동) — API 엔드포인트 (${bucket.endpoints.length}개)\n\n`
  if (bucket.endpoints.length === 0) {
    md += '(없음)\n'
  } else {
    const groups = {}
    for (const e of bucket.endpoints) {
      const parts = e.fullPath.split('/').filter(Boolean)
      const key = '/' + parts.slice(0, 3).join('/')
      if (!groups[key]) groups[key] = []
      groups[key].push(e)
    }
    for (const [key, eps] of Object.entries(groups).sort()) {
      md += `\n**${key}**\n`
      for (const e of eps) md += `- \`${e.method} ${e.fullPath}\`\n`
    }
  }
  return md
}

// 소개서(도메인) 블록 본문 (타임스탬프 제외).
function domainBody(domain, bucket) {
  let md = '## 🤖 코드 자동 동기화 (수치 SSOT + 기능 인벤토리) — 자동 생성, 수동 수정 금지\n\n'
  md += `> 도메인: **${DOMAIN_LABEL[domain]}**. 이 블록은 \`scripts/generate-proposal-refs.mjs\` 가 코드에서 추출해 자동 채웁니다.\n`
  md += `> 값이 코드와 다르면 코드를 수정하고 \`npm run generate:proposal-refs\` 실행. (수동 편집 금지 — 다음 커밋에 덮어써짐.)\n\n`
  md += renderNumberTable(NUMBER_ROWS[domain]()) + '\n'
  md += renderInventory(bucket)
  return md
}

// 마스터 블록 본문 (전체 인벤토리 + 커버리지 요약 + 전체 수치).
function masterBody(buckets, coverage) {
  let md = '## 🤖 코드 자동 동기화 (수치 SSOT + 기능 인벤토리) — 자동 생성, 수동 수정 금지\n\n'
  md += '> 마스터 문서: 전체 도메인 인벤토리 + 버킷별 커버리지 요약. `scripts/generate-proposal-refs.mjs` 자동 생성.\n\n'

  // 커버리지 요약 표.
  md += '### 커버리지 요약 (자동 — 버킷별 카운트)\n\n'
  md += '| 도메인 | 소개서 파일 | 페이지 | API 엔드포인트 |\n'
  md += '|---|---|---|---|\n'
  const fileByDomain = {}
  for (const [f, d] of Object.entries(FILE_DOMAIN)) fileByDomain[d] = f
  let totalPages = 0
  let totalEps = 0
  for (const d of DOMAINS) {
    const b = buckets[d]
    totalPages += b.pages.length
    totalEps += b.endpoints.length
    md += `| ${DOMAIN_LABEL[d]} | \`${fileByDomain[d] || '-'}\` | ${b.pages.length} | ${b.endpoints.length} |\n`
  }
  md += `| **합계** | — | **${totalPages}** | **${totalEps}** |\n\n`

  // ── 전체 커버리지 검증 (자동) — 빠진 기능 없음 보증 ──
  if (coverage) {
    md += '### 전체 커버리지 검증 (자동 — 빠진 기능 보증)\n\n'
    md += '> 모든 페이지/엔드포인트를 3분류: **도메인 버킷** / **공통·인프라(의도적 제외)** / **미커버**.\n'
    md += '> 미커버(allowlist 비포함)가 0 이면 모든 서비스 기능이 5개 소개서에 반영됨을 의미.\n\n'
    md += '| 분류 | 페이지 | API 엔드포인트 |\n'
    md += '|---|---|---|\n'
    md += `| 전체 | ${coverage.totalPages} | ${coverage.totalEndpoints} |\n`
    md += `| 도메인 버킷 (5개 소개서) | ${coverage.bucketedPages} | ${coverage.bucketedEndpoints} |\n`
    md += `| 공통/인프라 (의도적 제외) | ${coverage.commonPages.length} | ${coverage.commonEndpoints.length} |\n`
    md += `| **미커버 (점검 필요)** | **${coverage.uncoveredPages.length}** | **${coverage.uncoveredEndpoints.length}** |\n\n`

    const totalUncovered = coverage.uncoveredPages.length + coverage.uncoveredEndpoints.length
    if (totalUncovered === 0) {
      md += '✅ **미커버 0** — 모든 도메인 관련 페이지/엔드포인트가 5개 소개서 버킷에 포함되었습니다. (나머지는 공통/인프라로 의도적 제외.)\n'
    } else {
      md += `⚠️ **미커버 ${totalUncovered}건** — 아래 항목은 도메인 버킷에도 공통/인프라 allowlist 에도 없습니다. 버킷 prefix 확장 또는 allowlist 등록 필요.\n\n`
      if (coverage.uncoveredPages.length > 0) {
        md += '**미커버 페이지**\n'
        for (const p of coverage.uncoveredPages) md += `- \`${p}\`\n`
        md += '\n'
      }
      if (coverage.uncoveredEndpoints.length > 0) {
        md += '**미커버 API 엔드포인트**\n'
        for (const e of coverage.uncoveredEndpoints) md += `- \`${e.method} ${e.fullPath}\` (\`${e.file}\`)\n`
        md += '\n'
      }
    }
  }

  // 전체 핵심 수치 (도메인별 섹션).
  md += '### 핵심 수치 (자동 추출 — 전체)\n\n'
  for (const d of DOMAINS) {
    md += `#### ${DOMAIN_LABEL[d]}\n\n`
    md += renderNumberTable(NUMBER_ROWS[d]()) + '\n'
  }

  // 전체 인벤토리 (도메인별).
  md += '### 전체 도메인 코드 인벤토리 (자동)\n'
  for (const d of DOMAINS) {
    md += `\n#### ${DOMAIN_LABEL[d]}\n\n`
    md += renderInventory(buckets[d]) + '\n'
  }
  return md
}

// ─────────────────────────────────────────────────────────────
// 4. 파일 주입 — anti-churn 비교.
// ─────────────────────────────────────────────────────────────

// 블록 본문에서 타임스탬프 + 생성기 푸터 라인 제거 (비교용 정규화).
//   wrapBlock 이 본문 뒤에 타임스탬프/생성기 라인을 덧붙이므로, 재추출한 기존 본문에는
//   이 라인들이 포함되지만 새로 만든 body 에는 없음 → 둘 다 제거해 실질 내용만 비교.
function stripTimestamp(s) {
  return s
    .split('\n')
    .filter((line) => !line.startsWith(TS_PREFIX) && !line.startsWith('> 생성기:'))
    .join('\n')
    .trim()
}

// 파일에서 기존 블록 본문 추출 (delimiter 사이, 마커 제외).
function extractExistingBody(content) {
  const si = content.indexOf(START)
  const ei = content.indexOf(END)
  if (si === -1 || ei === -1 || ei < si) return null
  return content.slice(si + START.length, ei).trim()
}

// 블록 전체 (마커 + 본문 + 타임스탬프).
function wrapBlock(body, timestamp) {
  return `${START}\n\n${body}\n\n${TS_PREFIX} ${timestamp}\n> 생성기: \`scripts/generate-proposal-refs.mjs\`\n\n${END}`
}

// 파일 갱신. 변경 있으면 write, 없으면 skip. returns true if changed.
function updateFile(filePath, body) {
  const exists = fs.existsSync(filePath)
  const content = exists ? fs.readFileSync(filePath, 'utf-8') : ''
  const existingBody = extractExistingBody(content)

  // anti-churn: 타임스탬프 제외 본문 비교.
  if (existingBody != null && stripTimestamp(existingBody) === stripTimestamp(body)) {
    return false // 실질 변경 없음 — skip.
  }

  const timestamp = new Date().toISOString()
  const block = wrapBlock(body, timestamp)

  let next
  const si = content.indexOf(START)
  const ei = content.indexOf(END)
  if (si !== -1 && ei !== -1 && ei > si) {
    // 마커 사이 교체.
    next = content.slice(0, si) + block + content.slice(ei + END.length)
  } else {
    // 마커 없음 → EOF 에 append (leading separator).
    const base = content.replace(/\s*$/, '')
    next = base + '\n\n---\n\n' + block + '\n'
  }
  fs.writeFileSync(filePath, next)
  return true
}

// ─────────────────────────────────────────────────────────────
// 5. 메인.
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// 5b. --dry / --report 모드 — 파일 안 씀. 커버리지 검증 결과만 stdout 출력.
// ─────────────────────────────────────────────────────────────
function reportMode() {
  const { buckets, coverage } = computeInventory()

  console.log('📑 proposal-refs 커버리지 리포트 (--dry — 파일 미작성)\n')
  console.log(`전체 페이지:        ${coverage.totalPages}`)
  console.log(`전체 엔드포인트:    ${coverage.totalEndpoints}\n`)

  console.log('버킷별 카운트 (도메인 — 5개 소개서):')
  for (const d of DOMAINS) {
    const b = buckets[d]
    console.log(`  - ${DOMAIN_LABEL[d]}: ${b.pages.length} pages, ${b.endpoints.length} endpoints`)
  }
  console.log(`  = 버킷 합계: ${coverage.bucketedPages} pages, ${coverage.bucketedEndpoints} endpoints\n`)

  console.log(`공통/인프라 (allowlist — 의도적 제외): ${coverage.commonPages.length} pages, ${coverage.commonEndpoints.length} endpoints\n`)

  const totalUncovered = coverage.uncoveredPages.length + coverage.uncoveredEndpoints.length
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`UNCOVERED (버킷 X + allowlist X = 무엇이 빠졌는가): ${totalUncovered}건`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  if (totalUncovered === 0) {
    console.log('✅ UNCOVERED 0 — 모든 도메인 관련 페이지/엔드포인트가 버킷에 포함됨. 나머지는 공통/인프라.')
  } else {
    if (coverage.uncoveredPages.length > 0) {
      console.log(`UNCOVERED 페이지 (${coverage.uncoveredPages.length}):`)
      for (const p of coverage.uncoveredPages) console.log(`  - ${p}`)
      console.log('')
    }
    if (coverage.uncoveredEndpoints.length > 0) {
      console.log(`UNCOVERED 엔드포인트 (${coverage.uncoveredEndpoints.length}):`)
      for (const e of coverage.uncoveredEndpoints) console.log(`  - ${e.method} ${e.fullPath}  (${e.file})`)
      console.log('')
    }
  }

  // 감사용: allowlist 가 무엇을 잡았는지도 출력 (도메인 기능을 인프라로 숨겼는지 점검).
  if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
    console.log('\n── 공통/인프라로 분류된 페이지 (감사용) ──')
    for (const p of coverage.commonPages) console.log(`  · ${p}`)
    console.log('\n── 공통/인프라로 분류된 엔드포인트 (감사용) ──')
    for (const e of coverage.commonEndpoints) console.log(`  · ${e.method} ${e.fullPath}`)
  }

  // 종료 코드: UNCOVERED 있으면 비-0 (orchestrator/CI 가 게이트로 사용 가능).
  process.exit(totalUncovered === 0 ? 0 : 2)
}

function main() {
  if (process.argv.includes('--dry') || process.argv.includes('--report')) {
    reportMode()
    return
  }
  if (!fs.existsSync(PROPOSALS_DIR)) {
    console.error(`❌ ${path.relative(ROOT, PROPOSALS_DIR)} 없음`)
    process.exit(0)
  }
  const { buckets, coverage } = computeInventory()
  const changed = []
  const missingNotes = new Set()

  // 도메인 소개서 5개.
  for (const [file, domain] of Object.entries(FILE_DOMAIN)) {
    const fp = path.join(PROPOSALS_DIR, file)
    if (!fs.existsSync(fp)) {
      console.warn(`⚠️  ${file} 없음 — skip`)
      continue
    }
    const body = domainBody(domain, buckets[domain])
    if (body.includes(MISSING)) missingNotes.add(file)
    if (updateFile(fp, body)) changed.push(file)
  }

  // 마스터.
  const masterFp = path.join(PROPOSALS_DIR, MASTER_FILE)
  if (fs.existsSync(masterFp)) {
    const body = masterBody(buckets, coverage)
    if (body.includes(MISSING)) missingNotes.add(MASTER_FILE)
    if (updateFile(masterFp, body)) changed.push(MASTER_FILE)
  } else {
    console.warn(`⚠️  ${MASTER_FILE} 없음 — skip`)
  }

  // 요약.
  console.log('📑 proposal-refs 생성 완료')
  for (const d of DOMAINS) {
    console.log(`   ${DOMAIN_LABEL[d]}: ${buckets[d].pages.length} pages, ${buckets[d].endpoints.length} endpoints`)
  }
  if (changed.length === 0) {
    console.log('   변경 없음 (anti-churn — 모든 블록 최신).')
  } else {
    console.log(`   변경된 파일 (${changed.length}): ${changed.join(', ')}`)
  }
  if (missingNotes.size > 0) {
    console.log(`   ⚠️  [추출실패—수동확인] 포함 파일: ${[...missingNotes].join(', ')}`)
  }
}

main()
