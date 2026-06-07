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
  wholesale: ['/wholesale', '/supplier'],
  'offline-groupbuy': ['/meal-vouchers', '/restaurant-map', '/stays', '/my-stays', '/community-group-buy', '/my-appointments', '/group-buy'],
  'online-listing': ['/browse', '/products', '/cart', '/checkout', '/my-orders', '/search', '/wishlist', '/live', '/shorts'],
  linkshop: ['/profile/', '/s/', '/host', '/referral', '/u/', '/curator'],
  agency: ['/agency'],
}
// 페이지 prefix 명시 매칭(set) — admin 페이지 등 prefix 로 안 잡히는 것.
const PAGE_EXACT = {
  wholesale: new Set(['/admin/suppliers', '/admin/distributor-grades', '/admin/wholesale-orders', '/admin/wholesale-guide']),
}

// API 엔드포인트 prefix — 도메인별 (worker 마운트 후 fullPath 기준).
const API_PREFIXES = {
  wholesale: ['/api/supplier', '/api/wholesale', '/api/supply', '/api/admin/suppliers', '/api/admin/distributor', '/api/admin/supplier-products'],
  'offline-groupbuy': ['/api/community-group-buy', '/api/group-buy', '/api/appointments', '/api/seller/stays', '/api/restaurant', '/api/hosting', '/api/funding'],
  'online-listing': ['/api/products', '/api/orders', '/api/cart', '/api/search', '/api/shipping', '/api/returns', '/api/shorts', '/api/seller/youtube', '/api/youtube', '/api/multi-platform', '/api/cafe24', '/api/streaming', '/api/timedeal', '/api/auction'],
  linkshop: ['/api/curator', '/api/seller-public', '/api/referral', '/api/affiliate', '/api/donations', '/api/donation-boosters'],
  agency: ['/api/agency', '/api/admin/castings', '/api/seller/castings', '/api/admin/agencies', '/api/admin/agency-creator-approvals', '/api/pk-public'],
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

function classifyRoute(p) {
  // EXACT 먼저 (admin 페이지 등).
  for (const d of DOMAINS) {
    if (PAGE_EXACT[d] && PAGE_EXACT[d].has(p)) return d
  }
  // prefix — 더 구체적 도메인이 먼저 잡히도록 DOMAINS 순서대로.
  for (const d of DOMAINS) {
    const prefixes = PAGE_PREFIXES[d] || []
    if (prefixes.some((pre) => p === pre || p.startsWith(pre.endsWith('/') ? pre : pre + '/') || p === pre)) {
      return d
    }
  }
  return null
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

function extractEndpoints(file) {
  const src = fs.readFileSync(file, 'utf-8')
  const endpoints = []
  const re = /\b(\w+)\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/g
  let m
  while ((m = re.exec(src)) !== null) {
    endpoints.push({ method: m[2].toUpperCase(), path: m[3], file: path.relative(ROOT, file) })
  }
  return endpoints
}

function extractMountedPrefixes() {
  const file = path.join(ROOT, 'src/worker/index.ts')
  if (!fs.existsSync(file)) return {}
  const src = fs.readFileSync(file, 'utf-8')
  const directMap = {}
  const directRe = /(\w+)\.route\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\w+)\s*\)/g
  let m
  while ((m = directRe.exec(src)) !== null) {
    const [, mountApp, mountPath, routerName] = m
    if (!directMap[routerName]) directMap[routerName] = []
    directMap[routerName].push({ mountApp, mountPath })
  }
  const subAppPrefix = {}
  for (const [routerName, mounts] of Object.entries(directMap)) {
    for (const { mountApp, mountPath } of mounts) {
      if (mountApp === 'app' && /^\w+App$/.test(routerName)) subAppPrefix[routerName] = mountPath
    }
  }
  const map = {}
  for (const [routerName, mounts] of Object.entries(directMap)) {
    if (!map[routerName]) map[routerName] = []
    for (const { mountApp, mountPath } of mounts) {
      const parentPrefix = mountApp === 'app' ? '' : (subAppPrefix[mountApp] || '')
      const finalPrefix = (parentPrefix + mountPath).replace(/\/+/g, '/').replace(/\/$/, '') || '/'
      map[routerName].push(finalPrefix)
    }
  }
  return map
}

function extractRouterNames(file) {
  const src = fs.readFileSync(file, 'utf-8')
  const names = []
  const re1 = /export\s+const\s+(\w+)\s*=\s*new\s+Hono/g
  let m
  while ((m = re1.exec(src)) !== null) names.push(m[1])
  const re2 = /export\s*\{\s*(\w+)\s+as\s+(\w+)\s*\}/g
  while ((m = re2.exec(src)) !== null) names.push(m[2])
  if (/export\s+default\s+\w+/.test(src)) names.push('__default__')
  return [...new Set(names)]
}

function classifyEndpoint(fullPath) {
  for (const d of DOMAINS) {
    const prefixes = API_PREFIXES[d] || []
    if (prefixes.some((pre) => fullPath === pre || fullPath.startsWith(pre + '/') || fullPath.startsWith(pre))) {
      return d
    }
  }
  return null
}

// 전체 인벤토리 계산 (한 번만).
function computeInventory() {
  const routes = extractRoutes()
  const routeFiles = findRouteFiles()
  const mounted = extractMountedPrefixes()

  const allEndpoints = []
  for (const f of routeFiles) {
    const names = extractRouterNames(f)
    const eps = extractEndpoints(f)
    let prefixes = []
    for (const n of names) if (mounted[n]) prefixes.push(...mounted[n])
    if (prefixes.length === 0) prefixes = ['']
    for (const ep of eps) {
      if (ep.path === '/*' || ep.path === '*') continue
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
  return buckets
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
function masterBody(buckets) {
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

function main() {
  if (!fs.existsSync(PROPOSALS_DIR)) {
    console.error(`❌ ${path.relative(ROOT, PROPOSALS_DIR)} 없음`)
    process.exit(0)
  }
  const buckets = computeInventory()
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
    const body = masterBody(buckets)
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
