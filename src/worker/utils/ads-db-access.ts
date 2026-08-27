/**
 * 🔒 유어애즈 인플루언서 DB — **누가 들여다볼 수 있는가** (2026-08-27 대표 지시)
 *
 * ## 대표 지시
 * *"매장으로 가입한 게 아닌, 대행사로 가입하면 유어애즈의 DB를 볼 수 없게끔 해줘."*
 *
 * ## 왜 이게 필요한가
 * `ad_influencer_leads` 는 몇 달을 들여 모은 **회사의 자산**이고, 값은 명단 자체가 아니라
 * **큐레이션**(카테고리·지역·평균조회수·lead_score)에 있다. 그런데 셀러 대시보드의 탐색
 * 엔드포인트는 **셀러 토큰만 있으면 누구나** 열렸다 — 등록 유형이 '중개(관리 대행)' 인
 * 계정도 똑같이 열렸다는 뜻이다.
 *
 * 대행사에게 이 목록은 **우리 상품 그 자체**다. 한 번 복사되면 되돌릴 방법이 없다(단방향 문).
 * 반대로 정상 매장을 잘못 막는 비용은 "문의 → 해제" 몇 분이다. **비대칭이므로 막는 쪽으로 기운다.**
 *
 * ## 판정 신호 — 이미 등록 시점에 기록돼 있다
 * `POST /api/seller/stores` 는 등록 유형을 반드시 받는다(직접 = 내 가게 / 중개 = 관리 대행):
 *   - `seller_meta.store_channel` = `'direct'` | `'brokered'`
 *   - `seller_operators.role`     = `'owner'`  | `'operator'`   ← 같은 트랜잭션에서 함께 기록
 * 즉 **"대행사로 가입"은 이미 데이터에 있다.** 새 필드를 만들 필요가 없다.
 *
 * ## ⚠️ 미분류(레거시)를 막지 않는 이유
 * 수수료 계산(`fee-resolver`)은 미지정을 `brokered` 로 **폴백**한다. 그 폴백을 여기까지
 * 끌고 오면 등록 유형이 생기기 **전에** 만들어진 계정 10개가 통째로 막힌다 — 그들은
 * 대행사가 아니라 **선택지가 없던 시절의 매장**이다. 지시는 *"대행사로 가입하면"* 이지
 * *"분류가 없으면"* 이 아니다. 그래서 여기서는 **명시적으로 저장된 값만** 근거로 쓴다.
 *
 * ## ⚠️ 이 게이트가 못 막는 것 (대표에게 그대로 보고할 것)
 *   1. **대행사가 '직접'을 골라 가입하면 통과한다.** 자기신고 필드이기 때문이다.
 *      다만 그 선택은 수수료 5% → **10%** 를 뜻한다 — 값을 치르고 들어오는 문이다.
 *      진짜 벽은 이 문이 아니라 **열람량 상한**(`checkAdsDbQuota`)과 **감사 로그**다.
 *   2. **연락처를 가리는 것만으로는 유출이 안 막힌다.** SELECT 에 email 이 없어도
 *      `handle` 이 나가면 인스타·유튜브에서 한 번에 찾는다. 가치는 명단이 아니라 큐레이션이고,
 *      큐레이션은 목록 그 자체다. ⇒ 열람 **총량**을 제한하는 것이 유일하게 실효가 있다.
 */
import type { D1Database } from '@cloudflare/workers-types'

export type AdsDbDenyCode =
  | 'ADS_DB_AGENCY_BLOCKED'   // 등록 유형이 '중개(관리 대행)'
  | 'ADS_DB_ADMIN_DENIED'     // 대표가 개별 차단
  | 'ADS_DB_QUOTA_EXCEEDED'   // 일일 열람 상한 도달

export type AdsDbAccess =
  | { allowed: true; reason: 'admin_allow' | 'direct' | 'unclassified' }
  | { allowed: false; code: AdsDbDenyCode; error: string }

/** 대표가 개별 계정을 뒤집는 스위치 — `seller_meta.ads_db_access` = 'allow' | 'deny'. */
export const ADS_DB_ACCESS_META_KEY = 'ads_db_access'

/**
 * 이 셀러(매장) 계정이 유어애즈 인플루언서 DB 를 열람할 수 있는가.
 *
 * 판정 순서가 곧 우선순위다 — **대표 수동 지정이 언제나 이긴다**(자동 판정이 틀렸을 때
 * 배포 없이 되돌릴 수 있어야 한다. 그게 없으면 오탐 한 건이 곧 장애다).
 */
export async function resolveAdsDbAccess(DB: D1Database, sellerId: number): Promise<AdsDbAccess> {
  if (!Number.isFinite(sellerId) || sellerId <= 0) {
    return { allowed: false, code: 'ADS_DB_ADMIN_DENIED', error: '셀러 인증이 필요합니다' }
  }

  // ① 대표 수동 지정 (allow / deny) — 자동 판정보다 먼저.
  const override = await DB.prepare(
    'SELECT value FROM seller_meta WHERE seller_id = ? AND key = ? LIMIT 1',
  ).bind(sellerId, ADS_DB_ACCESS_META_KEY).first<{ value: string }>().catch(() => null)
  if (override?.value === 'allow') return { allowed: true, reason: 'admin_allow' }
  if (override?.value === 'deny') {
    return {
      allowed: false, code: 'ADS_DB_ADMIN_DENIED',
      error: '이 계정은 인플루언서 DB 열람이 제한되어 있습니다. 유어딜에 문의해주세요.',
    }
  }

  // ② 등록 유형 — **명시적으로 저장된 'brokered' 만** 차단(미저장은 판단 근거가 아니다).
  const ch = await DB.prepare(
    "SELECT value FROM seller_meta WHERE seller_id = ? AND key = 'store_channel' LIMIT 1",
  ).bind(sellerId).first<{ value: string }>().catch(() => null)
  if (ch?.value === 'brokered') return { allowed: false, code: 'ADS_DB_AGENCY_BLOCKED', error: AGENCY_MSG }

  // ③ 보강 신호 — 등록자가 operator 로만 잡혀 있고 owner 가 없는 매장.
  //    ②와 같은 트랜잭션에서 쓰이지만, 한쪽이 유실돼도 다른 쪽이 남도록 둘 다 본다.
  //    (owner 가 생겼다 = 실제 사장님이 승계했다 → 그때는 매장이다.)
  const hasOwner = await DB.prepare(
    `SELECT 1 AS x FROM seller_operators
      WHERE seller_id = ? AND role = 'owner' AND revoked_at IS NULL LIMIT 1`,
  ).bind(sellerId).first<{ x: number }>().catch(() => null)
  if (!hasOwner) {
    const op = await DB.prepare(
      `SELECT 1 AS x FROM seller_operators
        WHERE seller_id = ? AND role = 'operator' AND revoked_at IS NULL LIMIT 1`,
    ).bind(sellerId).first<{ x: number }>().catch(() => null)
    if (op) return { allowed: false, code: 'ADS_DB_AGENCY_BLOCKED', error: AGENCY_MSG }
  }

  return { allowed: true, reason: ch?.value === 'direct' ? 'direct' : 'unclassified' }
}

const AGENCY_MSG =
  '인플루언서 DB 는 매장(직접 등록) 계정에만 열립니다. ' +
  '중개(관리 대행)로 등록된 계정은 열람할 수 없습니다 — 매장 사장님이 소유자로 승계하시면 열립니다.'

// ── 열람 총량 상한 ────────────────────────────────────────────────────────────────
/**
 * ⚠️ **게이트보다 이쪽이 실효 방어다.** 등록 유형은 자기신고라 우회되지만, 하루에 몇 행을
 * 가져갔는지는 우회할 수 없다. 44,000행을 하루 500행씩 긁으면 88일이 걸린다 —
 * 그 사이에 감사 로그가 먼저 눈에 띈다.
 *
 * 정상 사용과의 간격: 매장이 인플루언서를 고르는 데 20행 × 5~10페이지면 충분하다.
 */
export const ADS_DB_DEFAULT_DAILY_ROW_CAP = 500

let _usageEnsured = false
export async function ensureAdsDbUsage(DB: D1Database): Promise<void> {
  if (_usageEnsured) return
  _usageEnsured = true
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS seller_ads_db_usage (
      seller_id INTEGER NOT NULL,
      day TEXT NOT NULL,
      rows_served INTEGER NOT NULL DEFAULT 0,
      calls INTEGER NOT NULL DEFAULT 0,
      last_at DATETIME DEFAULT (datetime('now')),
      UNIQUE(seller_id, day)
    )`).run()
  } catch { /* fail-soft — 상한이 없어도 게이트는 산다 */ }
}

/** 오늘 이 셀러가 이미 가져간 행 수. 테이블이 없으면 0(=상한 미적용). */
export async function adsDbRowsToday(DB: D1Database, sellerId: number): Promise<number> {
  await ensureAdsDbUsage(DB)
  const day = new Date().toISOString().slice(0, 10)
  const row = await DB.prepare(
    'SELECT rows_served FROM seller_ads_db_usage WHERE seller_id = ? AND day = ?',
  ).bind(sellerId, day).first<{ rows_served: number }>().catch(() => null)
  return Number(row?.rows_served) || 0
}

/** 실제로 내보낸 행 수를 적립(멱등 upsert). best-effort — 실패해도 응답을 막지 않는다. */
export async function recordAdsDbRows(DB: D1Database, sellerId: number, rows: number): Promise<void> {
  if (!Number.isFinite(rows) || rows <= 0) return
  await ensureAdsDbUsage(DB)
  const day = new Date().toISOString().slice(0, 10)
  await DB.prepare(
    `INSERT INTO seller_ads_db_usage (seller_id, day, rows_served, calls, last_at)
     VALUES (?, ?, ?, 1, datetime('now'))
     ON CONFLICT(seller_id, day) DO UPDATE SET
       rows_served = rows_served + excluded.rows_served,
       calls = calls + 1,
       last_at = datetime('now')`,
  ).bind(sellerId, day, Math.floor(rows)).run().catch(() => null)
}

/** 상한 판정 — 초과면 deny. cap 은 `platform_settings.ads_db_daily_row_cap`(없으면 기본값). */
export async function checkAdsDbQuota(
  DB: D1Database, sellerId: number,
): Promise<AdsDbAccess> {
  const setting = await DB.prepare(
    "SELECT value FROM platform_settings WHERE key = 'ads_db_daily_row_cap' LIMIT 1",
  ).first<{ value: string }>().catch(() => null)
  const parsed = Number(setting?.value)
  const cap = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : ADS_DB_DEFAULT_DAILY_ROW_CAP
  const used = await adsDbRowsToday(DB, sellerId)
  if (used >= cap) {
    return {
      allowed: false, code: 'ADS_DB_QUOTA_EXCEEDED',
      error: `오늘 열람 가능한 인플루언서 수(${cap.toLocaleString('ko-KR')}명)를 모두 사용했습니다. 내일 다시 시도해주세요.`,
    }
  }
  return { allowed: true, reason: 'direct' }
}
