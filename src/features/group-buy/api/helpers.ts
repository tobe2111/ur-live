/**
 * 🛡️ 2026-05-15 (TD-G01 3단계): group-buy 공유 helpers — sub-router 들이 import.
 *
 * 분리 이유: voucher / public / seller / admin sub-router 가 같은 helper 사용 →
 *           main 파일에 헬퍼 두면 순환 import. 별도 파일로 분리.
 */

import type { D1Database } from '@cloudflare/workers-types'

const DEFAULT_MEAL_VOUCHER_COMMISSION_RATE = 0.05 // 식사권 기본 수수료 5%

// 🛡️ 2026-05-15: 차등 수수료 — 셀러 GMV 기반 자동 산정 (셀러 lock-in)
//   기본 5%, 월 GMV 1,000만+ 셀러 4%, 월 GMV 1억+ 셀러 3%
//   sellers.commission_rate 컬럼이 있으면 어드민 수동 override 우선.
const TIER_COMMISSION = [
  { min_monthly_gmv: 100_000_000, rate: 0.03 },  // 1억+ → 3%
  { min_monthly_gmv: 10_000_000,  rate: 0.04 },  // 1천만+ → 4%
] as const

/** DB에서 식사권 기본 수수료율 조회 (어드민 설정 우선, 없으면 5%) */
export async function getMealVoucherCommissionRate(DB: D1Database): Promise<number> {
  try {
    const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'commission_rate_meal_voucher'").first<{ value: string }>()
    if (row) return Number(row.value) / 100
  } catch { /* table may not exist */ }
  return DEFAULT_MEAL_VOUCHER_COMMISSION_RATE
}

/** 셀러별 commission rate (override > tier > default). */
export async function getSellerCommissionRate(DB: D1Database, sellerId: number): Promise<number> {
  // 1. 어드민 수동 설정 (sellers.commission_rate)
  try {
    const seller = await DB.prepare("SELECT commission_rate FROM sellers WHERE id = ?").bind(sellerId).first<{ commission_rate: number | null }>()
    if (seller && seller.commission_rate != null && seller.commission_rate > 0 && seller.commission_rate < 100) {
      return Number(seller.commission_rate) / 100
    }
  } catch { /* column may not exist */ }
  // 2. 자동 tier — 최근 30일 GMV 기준
  try {
    const gmvRow = await DB.prepare(`
      SELECT COALESCE(SUM(p.price * p.group_buy_current), 0) AS gmv
      FROM products p
      WHERE p.seller_id = ?
        AND p.updated_at >= datetime('now', '-30 days')
        AND p.category IN ('meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher')
    `).bind(sellerId).first<{ gmv: number }>()
    const gmv = Number(gmvRow?.gmv ?? 0)
    for (const tier of TIER_COMMISSION) {
      if (gmv >= tier.min_monthly_gmv) return tier.rate
    }
  } catch { /* fallback to default */ }
  // 3. 기본값 (platform_settings)
  return await getMealVoucherCommissionRate(DB)
}

/**
 * 테이블 + 컬럼 자동 생성 (마이그레이션 미적용 시 fallback).
 * products 에 group-buy 관련 컬럼 추가 + vouchers 테이블 생성.
 */
/**
 * 🛡️ 2026-05-19: per-worker 메모이제이션 — 매 요청마다 15+ ALTER TABLE 실행하던 패턴 제거.
 *   효과: group-buy 모든 페이지 응답시간 0.5-1초 단축.
 */
let _ensuredTables = false
export async function ensureTables(DB: D1Database): Promise<void> {
  if (_done_ensureTables) return
  _done_ensureTables = true
  if (_ensuredTables) return
  const columns = [
    'restaurant_name TEXT', 'restaurant_address TEXT', 'restaurant_phone TEXT',
    'restaurant_lat REAL', 'restaurant_lng REAL',
    'voucher_expiry DATE', 'voucher_terms TEXT',
    'group_buy_target INTEGER DEFAULT 0', 'group_buy_current INTEGER DEFAULT 0',
    'group_buy_deadline DATETIME', "group_buy_status TEXT DEFAULT 'active'",
    'store_verify_pin TEXT',
    // 🛡️ 2026-04-27: Magic Link — 사장님 PIN 없이 통계 페이지 진입.
    'store_owner_token TEXT',
    // 🛡️ 2026-05-15: 티어 할인 시스템 — JSON 배열 [{ "min": 5, "discount_pct": 10 }, ...]
    'group_buy_tiers TEXT',
    // 🛡️ 2026-05-15: 마일스톤 알림 dedup
    'milestone_notified_50 INTEGER DEFAULT 0',
    'milestone_notified_80 INTEGER DEFAULT 0',
    'milestone_notified_lastone INTEGER DEFAULT 0',
  ]
  for (const col of columns) {
    try { await DB.prepare(`ALTER TABLE products ADD COLUMN ${col}`).run() } catch { /* exists */ }
  }
  try {
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_products_store_owner_token ON products(store_owner_token)`).run()
  } catch { /* exists */ }
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS vouchers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'unused',
        used_at DATETIME,
        expires_at DATETIME,
        applied_discount_pct INTEGER DEFAULT 0,
        applied_price INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run()
  } catch { /* exists */ }
  // applied_* 컬럼 자동 추가 (기존 테이블 마이그레이션)
  for (const col of ['applied_discount_pct INTEGER DEFAULT 0', 'applied_price INTEGER']) {
    try { await DB.prepare(`ALTER TABLE vouchers ADD COLUMN ${col}`).run() } catch { /* exists */ }
  }
  _ensuredTables = true
}

/**
 * 티어 할인 계산 — group_buy_tiers JSON 파싱 + current 에 맞는 최고 tier 적용.
 *   tiers = [{ min: 5, discount_pct: 5 }, { min: 10, discount_pct: 15 }, { min: 20, discount_pct: 25 }]
 *   current=12 → discount_pct=15 (가장 높은 충족 tier)
 *   tiers null/empty → discount_pct=0
 */
export function calcTierDiscount(
  tiersJson: string | null,
  current: number,
): { discount_pct: number; next_tier: { min: number; discount_pct: number } | null } {
  if (!tiersJson) return { discount_pct: 0, next_tier: null }
  try {
    const tiers = JSON.parse(tiersJson) as Array<{ min: number; discount_pct: number }>
    if (!Array.isArray(tiers) || tiers.length === 0) return { discount_pct: 0, next_tier: null }
    // 정렬 후 current 이하 max + current 초과 min 찾기
    const sorted = [...tiers].sort((a, b) => a.min - b.min)
    let achieved = 0
    let next: { min: number; discount_pct: number } | null = null
    for (const t of sorted) {
      if (current >= t.min) achieved = Math.max(achieved, t.discount_pct)
      else { next = t; break }
    }
    return { discount_pct: achieved, next_tier: next }
  } catch { return { discount_pct: 0, next_tier: null } }
}

/**
 * 바우처 코드 생성 — 'UR-XXXX-XXXX' (8 chars + dash, 32^8 = 1.1조 가능).
 * 🛡️ Math.random → crypto.getRandomValues (guessable code 방어).
 */
export function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  let code = 'UR-'
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(bytes[i] % chars.length)
    if (i === 3) code += '-'
  }
  return code
}

/**
 * 🛡️ 2026-05-16: UNIQUE 충돌 retry 가능한 voucher code 생성.
 *   32^8 = 1.1조 조합이라 충돌 확률 극히 낮지만 0 아님 (생일 역설 — 100만 voucher 발급 시 ~0.5%).
 *   DB collision 발생하면 최대 5회 재시도 후 예외.
 */
export async function generateUniqueVoucherCode(DB: D1Database): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateVoucherCode()
    try {
      const existing = await DB.prepare("SELECT 1 FROM vouchers WHERE code = ?").bind(code).first().catch(() => null)
      if (!existing) return code
    } catch { return code /* 검증 자체 실패 시 fallback (DB 부담 회피) */ }
  }
  throw new Error('voucher_code_collision_max_retry')
}

/** Magic Link 사장님 토큰 — 32자 hex (128bit), URL-safe. */
export function generateStoreOwnerToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 사장님께 Magic Link 알림톡 발송 (best-effort).
 * ALIMTALK_API_KEY / ALIMTALK_SENDER_KEY 미설정 시 silent skip.
 */
export async function sendStoreOwnerAlimtalk(
  env: { ALIMTALK_API_KEY?: string; ALIMTALK_SENDER_KEY?: string },
  phone: string,
  data: { restaurantName: string; productName: string; statsUrl: string }
): Promise<void> {
  if (!env.ALIMTALK_API_KEY || !phone) return // 미설정 시 silently skip
  try {
    // 정규화: 010-xxxx-xxxx → 01012345678
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    if (!/^01\d{8,9}$/.test(cleanPhone)) return

    const message = `[유어딜] 식사권 통계 페이지 안내

안녕하세요, ${data.restaurantName} 사장님!
"${data.productName}" 식사권 공동구매가 등록되었습니다.

📊 실시간 발급/사용 현황 확인:
${data.statsUrl}

✅ 이 링크는 사장님 전용 영구 링크입니다.
즐겨찾기에 추가하시면 편하게 확인할 수 있어요.

문의가 있으시면 언제든 연락주세요.`

    // Solapi-style 호출 (실제 provider 마다 다름 — 환경변수로 baseURL 받으면 더 유연)
    await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.ALIMTALK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          to: cleanPhone,
          from: env.ALIMTALK_SENDER_KEY || '15441234',
          text: message,
          type: 'LMS', // 알림톡 템플릿 미등록 시 LMS fallback
        },
      }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => { /* silently fail — 운영 영향 없게 */ })
  } catch { /* graceful */ }
}

/**
 * 🛡️ 2026-05-16: 사용자에게 voucher 발급 알림톡 (결제 완료 직후).
 *   링크: https://live.ur-team.com/my-vouchers (QR 코드 화면 진입)
 */
export async function sendBuyerVoucherIssuedAlimtalk(
  env: { ALIMTALK_API_KEY?: string; ALIMTALK_SENDER_KEY?: string },
  phone: string,
  data: { productName: string; restaurantName?: string; qty: number; expiresAt: string }
): Promise<void> {
  if (!env.ALIMTALK_API_KEY || !phone) return
  try {
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    if (!/^01\d{8,9}$/.test(cleanPhone)) return
    const expDate = new Date(data.expiresAt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
    const message = `[유어딜] 식사권 발급 완료

${data.restaurantName ? data.restaurantName + ' · ' : ''}${data.productName}
${data.qty}장 발급되었습니다.

📱 매장에서 QR 코드 보여주세요:
https://live.ur-team.com/my-vouchers

⏰ 유효기간: ${expDate}까지

문의: 유어딜 고객센터`
    await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.ALIMTALK_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: { to: cleanPhone, from: env.ALIMTALK_SENDER_KEY || '15441234', text: message, type: 'LMS' },
      }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => {})
  } catch { /* graceful */ }
}

/**
 * 🛡️ 2026-05-16: 매장 사장님에게 "곧 손님 옵니다" 친절 알림톡 (첫 voucher 발급 시 1회).
 *   sellers.first_voucher_notified flag 로 dedup.
 */
export async function sendSellerFirstVoucherAlimtalk(
  env: { ALIMTALK_API_KEY?: string; ALIMTALK_SENDER_KEY?: string },
  phone: string,
  data: { restaurantName: string; productName: string; statsUrl: string }
): Promise<void> {
  if (!env.ALIMTALK_API_KEY || !phone) return
  try {
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    if (!/^01\d{8,9}$/.test(cleanPhone)) return
    const message = `[유어딜] 🎉 첫 손님이 곧 방문합니다

${data.restaurantName} 사장님,
"${data.productName}" 첫 손님이 식권을 구매했어요!

📋 사용 처리 방법
1. 본인 폰으로 아래 링크 진입 (즐겨찾기 권장)
   ${data.statsUrl}
2. 손님이 QR 보여주면 [QR 스캔] 버튼 → 자동 처리
3. 화면에 "메뉴 X 제공" 표시 후 음식 준비
4. POS / T오더 결제 X (이미 유어딜에서 결제 완료)

💰 정산
사용 + 7일 후 등록 계좌로 자동 송금됩니다.

문의: 유어딜 고객센터`
    await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.ALIMTALK_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: { to: cleanPhone, from: env.ALIMTALK_SENDER_KEY || '15441234', text: message, type: 'LMS' },
      }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => {})
  } catch { /* graceful */ }
}

/**
 * 🛡️ 2026-05-16: voucher 사용 완료 알림톡 (매장이 QR 스캔 직후).
 */
export async function sendBuyerVoucherUsedAlimtalk(
  env: { ALIMTALK_API_KEY?: string; ALIMTALK_SENDER_KEY?: string },
  phone: string,
  data: { restaurantName: string; productName: string; usedAt?: string }
): Promise<void> {
  if (!env.ALIMTALK_API_KEY || !phone) return
  try {
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    if (!/^01\d{8,9}$/.test(cleanPhone)) return
    const ts = data.usedAt ? new Date(data.usedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''
    const message = `[유어딜] ✅ 식사권 사용 완료

${data.restaurantName}
"${data.productName}"
${ts ? '사용 시각: ' + ts : ''}

맛있게 드세요! 🍱

후기 작성하면 보너스 딜 지급:
https://live.ur-team.com/my-vouchers

문의: 유어딜 고객센터`
    await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.ALIMTALK_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: { to: cleanPhone, from: env.ALIMTALK_SENDER_KEY || '15441234', text: message, type: 'LMS' },
      }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => {})
  } catch { /* graceful */ }
}


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
let _done_ensureTables = false
