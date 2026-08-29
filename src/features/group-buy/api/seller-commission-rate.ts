/**
 * 💸 **이 매장의 수수료율은 얼마인가** — 이용권 판매가 부르는 SSOT.
 *
 * `helpers.ts` 에서 분리했다(2026-08-27). 원래 그 파일의 맨 위에 있었는데, 채널별 요율(직접 10% /
 * 대행사 5%)이 들어오면서 **왜 이 순서인가**를 설명해야 할 코드가 됐다 — 그리고 그건 공유 헬퍼
 * 모음집이 아니라 자기 파일을 가질 만한 개념이다. (파일 크기 래칫도 그렇게 말했다: baseline 을
 * 올리는 대신 뽑아낸다.)
 *
 * 호출부는 `helpers.ts` 재수출로 그대로 동작한다 — 이동이지 배선 변경이 아니다.
 */

import type { D1Database } from '@cloudflare/workers-types'

const DEFAULT_MEAL_VOUCHER_COMMISSION_RATE = 0.05 // 이용권 기본 수수료 5%

// 🛡️ 2026-05-15: 차등 수수료 — 셀러 GMV 기반 자동 산정 (셀러 lock-in)
//   기본 5%, 월 GMV 1,000만+ 셀러 4%, 월 GMV 1억+ 셀러 3%
//   sellers.commission_rate 컬럼이 있으면 어드민 수동 override 우선.
const TIER_COMMISSION = [
  { min_monthly_gmv: 100_000_000, rate: 0.03 },  // 1억+ → 3%
  { min_monthly_gmv: 10_000_000,  rate: 0.04 },  // 1천만+ → 4%
] as const

/** DB에서 이용권 기본 수수료율 조회 (어드민 설정 우선, 없으면 5%) */
export async function getMealVoucherCommissionRate(DB: D1Database): Promise<number> {
  try {
    const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'commission_rate_meal_voucher'").first<{ value: string }>()
    if (row) return Number(row.value) / 100
  } catch { /* table may not exist */ }
  return DEFAULT_MEAL_VOUCHER_COMMISSION_RATE
}

/**
 * 셀러별 commission rate — **채널 > override > tier > default**.
 *
 * 💸 **2026-08-27: 채널(직접 10% / 대행사 5%)이 맨 앞에 왔다.** 대표 확정 모델은
 *   *"10%는 매장이 직접 입점해 이용권을 팔 때. 대행사로 가입하면 5%"* 인데, 이 함수는 채널을
 *   **아예 안 봤다** — 그래서 대행사 매장도 이 함수가 돌려주는 값을 그대로 냈다.
 *
 * 🩸 **왜 override 보다 위인가** (이 순서가 이 수정의 핵심이다):
 *   `sellers.commission_rate` 는 **쓰는 주체가 셋**이다 — 어드민 수동 설정, `seller-tier-eval` cron
 *   (GMV 등급으로 3~5% 를 덮어쓴다), 그리고 과거에 박힌 값. 채널을 이 컬럼 **아래**에 두면
 *   **cron 이 돌 때마다 채널 요율이 조용히 지워진다**(에러도 로그도 없다). 라이브 실측이 그 상태였다:
 *   활성 매장 7곳 전부 `commission_rate = 10` — 컬럼 기본값은 5 이고 tier cron 표에도 10 은 없으니
 *   **아무도 의도하지 않은 잔재**이고, 그 잔재가 대행사 매장에 10% 를 물리고 있었다.
 *   ⇒ 게이트를 켠다는 것은 *"이제 채널이 요율을 정한다"* 는 어드민의 선언이므로 채널이 이긴다.
 *   매장별 예외가 필요하면 캠페인 override 경로(`params.platform_rate`)를 쓴다.
 *
 * ⚠️ 게이트(`fee_channel_rates_enabled`) OFF 또는 채널 미지정이면 **종전과 byte-동일**하다.
 */
export async function getSellerCommissionRate(DB: D1Database, sellerId: number): Promise<number> {
  // 0. 채널별 요율 — 게이트 ON + 채널이 확정된 매장만. 미지정이면 undefined 로 아래 경로에 위임.
  try {
    const { channelPlatformRate } = await import('../../../worker/utils/ledger-commission-policy')
    const byChannel = await channelPlatformRate(DB, sellerId)
    if (byChannel !== undefined) return byChannel
  } catch { /* 채널 조회 실패가 정산을 막지 않는다 — 아래 종전 경로로 */ }
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
