import { logInfo, logError } from '../utils/logger'
/**
 * Auto-Settlement Cron Handler
 *
 * 🗓️ 2026-06-23 주간 정산 정책: 월~일(KST) 사용분 → 차주 목요일(KST) 정산.
 *   (weeklySettlementCutoffUtc — settlement-schedule.ts. 이전 'used 7일 롤링' 대체.)
 *   used 상태 + 아직 settlement 미배정 + open 분쟁 아님 + used_at < 주간 cutoff 인 voucher 만.
 *
 * Groups vouchers by seller, creates a pending settlement per seller,
 * and marks the vouchers as settled.
 */

import type { Env } from '../types/env';
import { sendDiscordAlert } from '../utils/discord-alert';
import { adjustUserPoints } from '../utils/point-ledger';
import { reportCronFailure } from '../utils/cron-reporter';
import { clawbackVoucherCommission } from '../../features/group-buy/api/helpers';
import { weeklySettlementCutoffUtc } from '../utils/settlement-schedule';
import { getSupplyMeta } from '../utils/product-supply-meta';
import { parsePickup } from '../../shared/pickup';
import {
  DEFAULT_UNCLAIMED_POLICY,
  parseUnclaimedPolicy,
  unclaimedRefundAmount,
  type UnclaimedPolicy,
} from '../../shared/pickup-refund';
import { recordLedger } from '../utils/ledger';

/**
 * 💸 **미수령 환불 정책 로드** — 세션 ④-b (머니 경로, 게이트 뒤)
 *
 * 🔴 **조회가 실패하면 기본값(=현행 전액 환불)** 이다. 정책을 못 읽었다고 소비자 환불을 깎지 않는다.
 * 게이트(`pickup_unclaimed_policy_enabled`)는 기본 OFF — 대표가 켜기 전까지 **라이브 동작 0 변화**.
 */
async function loadUnclaimedPolicy(DB: D1Database): Promise<UnclaimedPolicy> {
  try {
    const { results } = await DB.prepare(
      `SELECT key, value FROM platform_settings WHERE key IN
        ('pickup_unclaimed_policy_enabled','pickup_unclaimed_cold_pct','pickup_unclaimed_room_pct','pickup_unclaimed_room_grace_days')`
    ).all<{ key: string; value: string | null }>();
    const rec: Record<string, string> = {};
    for (const r of results || []) rec[r.key] = r.value ?? '';
    return parseUnclaimedPolicy(rec);
  } catch {
    return { ...DEFAULT_UNCLAIMED_POLICY };
  }
}
const _expColEnsured = new WeakSet<object>()
async function ensureIsExperienceColumn(DB: D1Database): Promise<void> {
  if (_expColEnsured.has(DB as unknown as object)) return
  try { await DB.prepare("ALTER TABLE vouchers ADD COLUMN is_experience INTEGER DEFAULT 0").run() } catch { /* exists */ }
  _expColEnsured.add(DB as unknown as object)
}

/**
 * 🚧 **Rail A(`restaurant_settlements`) 가 이 DB 에 실재하는가** (2026-08-02 실측 후 신설)
 *
 * ## 왜 이 확인이 생겼나 — 문서가 사실과 달랐다
 *
 * `settlement-reconciliation.md §Severe 3` 은 이용권 정산이 두 레일에 **"100% 중복 적재"** 된다고
 * 적었다. 프로덕션 D1 을 직접 조회하니 **그 전제가 틀렸다**:
 *
 * | 대상 | 프로덕션 |
 * |---|---|
 * | `restaurant_settlements` 테이블 | **없음** (`no such table`) |
 * | `vouchers.settlement_id` | **없음** |
 * | `products.commission_rate` | **없음** — 이 컬럼은 애초에 존재한 적이 없다 |
 *
 * 셋 다 `restaurant-settlement.routes.ts` 의 `ensureSettlementTables()` 가 **어드민이 그 화면을
 * 열었을 때만** 만든다. 아무도 안 열었다 ⇒ **Rail A 는 단 한 행도 만든 적이 없다.**
 * 그동안 이 cron 은 매일 03:00 KST 에 첫 SELECT 에서 던지고 죽었다(디스코드/벨 경보만 남기고).
 *
 * ## 그래서 왜 "고쳐서 켜기"가 아니라 "건너뛰기"인가
 *
 * 실제 지급은 **Rail B**(`ledger_entries` → `payouts-generate` 주간 → 어드민 approve)가 한다.
 * 여기서 테이블을 만들어 주면 그날부터 **과거 사용분 전체가 Rail A 에 한꺼번에 적재**되고,
 * 두 레일은 서로의 멱등 마커를 안 본다 ⇒ **같은 매출을 두 번 지급**할 수 있다.
 * 그건 머니 경로 변경이라 **단독 세션 + staging + 대표 승인** 영역이다(설계 문서가 파킹해 둔 안②).
 *
 * ⇒ 이 함수는 **판정만 한다. 절대 프로비저닝하지 않는다.**
 *    (`auto-settlement-rail-a.test.ts` 가 이 파일에 `CREATE TABLE restaurant_settlements` /
 *     `ALTER TABLE vouchers ADD COLUMN settlement_id` 가 들어오는 것을 막는다.)
 *
 * ⚠️ 이 판정이 **못 막는 것**: 어드민이 `/admin` 정산 화면을 한 번 열면 라우트가 테이블을 만들고,
 *    그 다음 회차부터 이 cron 이 정상 진입한다. 즉 Rail A 는 **화면 한 번으로 깨어난다.**
 *    그 경로까지 닫는 것은 게이트(`settlement_skip_ledgered`) flip 이고 대표 판단이다.
 */
export async function railAProvisioned(DB: D1Database): Promise<boolean> {
  try {
    const tbl = await DB.prepare(
      "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='restaurant_settlements'"
    ).first<{ n: number }>()
    if (!Number(tbl?.n)) return false
    const col = await DB.prepare(
      "SELECT COUNT(*) AS n FROM pragma_table_info('vouchers') WHERE name='settlement_id'"
    ).first<{ n: number }>()
    return Number(col?.n) > 0
  } catch {
    // 조회 자체가 실패하면 **없는 것으로 본다** — 모르는 상태에서 정산을 만들지 않는다.
    return false
  }
}

export async function handleAutoSettlement(env: Env) {
  const DB = env.DB;

  try {
    // 🚧 Rail A 미프로비저닝이면 여기서 끝. 아무것도 만들지 않는다(위 `railAProvisioned` 주석).
    //   2026-08-02 현재 프로덕션이 이 경로다 — 그래서 이 cron 은 매일 조용히 no-op 이 된다.
    //   ⚠️ 이건 "정산이 안 되고 있다"가 아니다. 지급은 Rail B(원장→payouts)가 한다.
    if (!(await railAProvisioned(DB))) {
      logInfo('[Cron] Auto-settlement: Rail A(restaurant_settlements) 미프로비저닝 — skip. 지급은 Rail B(원장→payouts).')
      return;
    }

    // Get platform-wide meal voucher commission rate (source of truth: platform_settings).
    // Default 5% aligns with group-buy DEFAULT_MEAL_VOUCHER_COMMISSION_RATE.
    let platformRate = 5;
    try {
      const settingRow = await DB.prepare(
        "SELECT value FROM platform_settings WHERE key = 'commission_rate_meal_voucher'"
      ).first<{ value: string }>();
      if (settingRow?.value) {
        const parsed = Number(settingRow.value);
        if (Number.isFinite(parsed) && parsed >= 0) platformRate = parsed;
      }
    } catch { /* platform_settings may not exist — use default 5% */ }

    // 🎟️ 2026-06-22 (대표 — 사용처리 분쟁): open 분쟁 voucher 는 정산 보류. 분쟁 테이블 미존재 가능 → 먼저 보장.
    await DB.prepare(`CREATE TABLE IF NOT EXISTS voucher_disputes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, voucher_id INTEGER NOT NULL, product_id INTEGER, seller_id INTEGER,
      reason TEXT, status TEXT DEFAULT 'open', created_at DATETIME DEFAULT (datetime('now')), resolved_at DATETIME,
      resolution TEXT, admin_note TEXT, UNIQUE(voucher_id))`).run().catch(() => {});

    // 🗓️ 2026-06-23 (대표 결정): 주간 정산 — 월~일(KST) 사용분 → 차주 목요일(KST) 정산.
    //   (이전 'used 7일 롤링' 대체.) cutoff = 정산 도래한 가장 최근 주 일요일까지의 상한(UTC).
    //   used_at < cutoff 만 정산. cron 이 매일 03:00 KST 돌므로 각 주는 그 차주 목요일 첫 실행에 정산(멱등).
    const settlementCutoff = weeklySettlementCutoffUtc(Date.now());

    // 💸 2026-07-08 (머니 감사 Guard 2 근본수정 — 안①, 기본 OFF 게이트): 이용권 정산이 두 레일
    //   (restaurant_settlements Rail A ↔ ledger/payouts Rail B)에 같은 매출을 이중 적재하는 것을 원천 차단.
    //   ON 이면 이미 원장(Rail B, event_type='voucher_used')에 booking 된 voucher 를 Rail A 생성에서 skip
    //   → 단일 레일(원장→payouts) 수렴(settlement-reconciliation.md §4.1·Severe 3). 기본 OFF = 현행 byte-불변.
    //   ⚠️ 라이브 정산이라 flip(ON) 전 staging 실검증 + '어느 레일이 실제 지급에 쓰이는지' 확인 필수.
    let skipLedgered = false;
    try {
      const g = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'settlement_skip_ledgered'").first<{ value: string }>();
      skipLedgered = g?.value === 'true';
    } catch { /* 키 없으면 OFF(현행) */ }
    const ledgerSkipClause = skipLedgered
      ? "AND NOT EXISTS (SELECT 1 FROM ledger_entries le WHERE le.reference_id = 'voucher:' || v.id AND le.event_type = 'voucher_used')"
      : '';

    // 💸 2026-08-02 [머니] 수수료율 출처 정정 — `p.commission_rate` → `sellers.commission_rate`.
    //   `products` 에는 `commission_rate` 컬럼이 **존재한 적이 없다**(프로덕션 pragma 실측 0,
    //   `products-column-baseline.json` 97컬럼에도 없음). 그래서 이 SELECT 는 실행될 때마다
    //   `no such column: p.commission_rate` 로 던졌다 — 회차 전체가 죽었다.
    //   셀러별 수수료의 SSOT 는 `sellers.commission_rate`(REAL DEFAULT 5.00, 어드민 조정 대상 —
    //   production-schema.ts:221 · CLAUDE.md '딜 포인트 시스템'). 미설정이면 platform_settings 폴백.
    //   ⚠️ **분배식은 손대지 않았다** — COALESCE 폴백 순서·`platformRate` 바인딩·아래 Math.round
    //      전부 그대로다. 바뀐 것은 "그 율을 어느 테이블에서 읽는가" 하나뿐.
    // 🛡️ 2026-05-30: 정산 매출 = 실제 결제가(applied_price). 미존재 시 정가(price) fallback.
    //   환불(applied_price)과 동일 기준 → 결제·정산·환불 폐루프 정합. 티어 할인 deal 과다정산(플랫폼 손실) 제거.
    // 🛡️ 전수조사 fix: 이 SELECT 가 참조하는 vouchers.is_experience 는 번호 마이그레이션이 없어
    //   (repair-schema/helpers ensure 로만 추가) 극단적 순서에서 'no such column' 으로 정산 회차
    //   전체가 skip 될 수 있음 → cron 이 스스로 멱등 보증(WeakSet 메모, 실패 무해).
    await ensureIsExperienceColumn(DB)
    const usedVouchers = await DB.prepare(`
      SELECT v.id, v.product_id, v.order_id, v.applied_price, p.price, p.seller_id, p.restaurant_name,
             COALESCE(s.commission_rate, ?) as commission_rate
      FROM vouchers v
      JOIN products p ON v.product_id = p.id
      LEFT JOIN sellers s ON s.id = p.seller_id
      WHERE v.status = 'used'
        AND v.used_at < ?
        AND v.settlement_id IS NULL
        AND v.id NOT IN (SELECT voucher_id FROM voucher_disputes WHERE status = 'open')
        AND COALESCE(v.is_experience, 0) = 0
        ${ledgerSkipClause}
    `).bind(platformRate, settlementCutoff).all();
    // 🎁 2026-07-12 (체험 캠페인 트랙 WP-A#4 — trial-campaign-track-2026-07.md): 0원 체험권은
    //   매장 자기부담 무상제공이라 정산 대상 아님. applied_price=0 은 위 매출계산(:99)에서 정가로
    //   폴백되므로 **SELECT 대상에서 구조적으로 제외**(voucher_disputes 제외와 동일 패턴 — 금액/분배
    //   계산식 무변경). is_experience 마킹은 발급 시점(experience-voucher.ts)에만 세팅. 캠페인
    //   미개설 시 이 컬럼은 항상 0/NULL → 현행 byte-불변.

    if (!usedVouchers.results?.length) return;

    // Group by seller_id
    // HIGH-5: skip orphan vouchers (null seller_id would coerce to 0 and merge unrelated orders)
    const sellerGroups: Record<number, any[]> = {};
    for (const v of usedVouchers.results) {
      if (v.seller_id == null) {
        if (env.ENVIRONMENT !== 'production') console.warn('[Settlement] Voucher without seller_id:', v.id);
        continue; // Don't process orphan vouchers
      }
      const sid = v.seller_id as number;
      if (!sellerGroups[sid]) sellerGroups[sid] = [];
      sellerGroups[sid].push(v);
    }

    // Create settlement records
    // 🛡️ 2026-04-22: per-seller try-catch — 한 셀러 실패 시 나머지 셀러 정산 계속 진행
    let processedSellers = 0;
    let failedSellers = 0;
    const failedSellerIds: string[] = [];
    for (const [sellerId, vouchers] of Object.entries(sellerGroups)) {
      try {
        // 실제 결제가(applied_price) 합산 — 미존재 시 정가 fallback (할인 없는 deal/레거시 voucher 무영향)
        const totalRevenue = vouchers.reduce((sum: number, v: any) => {
          const paid = Number(v.applied_price) > 0 ? Number(v.applied_price) : (v.price || 0);
          return sum + paid;
        }, 0);
        const commissionRate = vouchers[0]?.commission_rate ?? platformRate;
        // CRIT-2: standardized to Math.round() across all settlement calculations
        const commissionAmount = Math.round(totalRevenue * commissionRate / 100);
        const settlementAmount = totalRevenue - commissionAmount;

        const result = await DB.prepare(`
          INSERT INTO restaurant_settlements (seller_id, restaurant_name, total_vouchers_used, total_revenue, commission_rate, commission_amount, settlement_amount, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
        `).bind(
          Number(sellerId),
          vouchers[0]?.restaurant_name || '',
          vouchers.length,
          totalRevenue,
          commissionRate,
          commissionAmount,
          settlementAmount
        ).run();

        // Mark vouchers as settled.
        // 🛡️ 2026-06-26 [머니] claim CAS — `AND settlement_id IS NULL` 가드 추가. 가드 없으면
        //   두 정산 run 이 겹칠 때(현재는 일 1회 cron 만 트리거 → 사실상 없음) 같은 voucher 가
        //   두 정산행에 동시 귀속될 수 있었음. 이제 voucher 는 한 정산행에만 한 번 claim.
        if (result.meta?.last_row_id && vouchers.length > 0) {
          const voucherIds = vouchers.map((v: any) => Number(v.id)).filter(Number.isFinite);
          if (voucherIds.length > 0) {
            const placeholders = voucherIds.map(() => '?').join(',');
            await DB.prepare(
              `UPDATE vouchers SET settlement_id = ? WHERE id IN (${placeholders}) AND settlement_id IS NULL`
            ).bind(result.meta.last_row_id, ...voucherIds).run();
          }
        }
        processedSellers++;
      } catch (sellerErr) {
        failedSellers++;
        failedSellerIds.push(sellerId);
        // 🛡️ 2026-05-07: 정산 실패는 critical (돈 이슈) — admin 대시보드 알림 + 영구 기록
        await reportCronFailure(env, 'auto-settlement', sellerErr,
          { sellerId, voucherCount: vouchers.length }, 'critical')
        // 다음 셀러 계속 진행
      }
    }
    if (failedSellers > 0) {
      console.warn(`[Cron] Settlement: ${processedSellers} OK, ${failedSellers} failed (sellers: ${failedSellerIds.join(',')})`);
    }

    logInfo(`[Cron] Auto-settlement: ${Object.keys(sellerGroups).length} sellers processed`);
  } catch (err) {
    logError('[Cron] Auto-settlement failed:', { error: String(err) });
    if (env.DISCORD_WEBHOOK_URL) {
      await sendDiscordAlert(
        env.DISCORD_WEBHOOK_URL,
        'Auto-Settlement Failed',
        `Cron auto-settlement encountered an error: ${(err as Error).message || String(err)}`,
        'error'
      );
    }
  }
}

/**
 * Auto-refund expired vouchers.
 *
 * 1. Find vouchers with status='unused' and expires_at < now
 * 2. Mark them as 'expired'
 * 3. If paid with deal points, refund the user's deal_balance
 * 4. Send notification to the user
 */
export async function handleExpiredVoucherRefunds(env: Env) {
  const DB = env.DB;

  try {
    // 🛡️ 2026-04-22: LIMIT 5000 추가 — 수만 건 expired voucher 시 cron hang/OOM 방어.
    // 다음 cron 주기에 나머지 처리 (idempotent).
    const expired = await DB.prepare(`
      SELECT v.id, v.code, v.order_id, v.product_id, v.applied_price,
             o.user_id, o.payment_method, o.payment_key, p.price, p.name as product_name,
             p.seller_id
      FROM vouchers v
      JOIN orders o ON v.order_id = o.id
      JOIN products p ON v.product_id = p.id
      WHERE v.status = 'unused'
        AND v.expires_at < datetime('now')
      ORDER BY v.expires_at ASC
      LIMIT 5000
    `).all();

    if (!expired.results?.length) return;

    // 💸 ④-b: 정책이 꺼져 있으면 **아무것도 더 조회하지 않는다** — OFF 경로는 쿼리 수까지 현행과 같다.
    const unclaimedPolicy = await loadUnclaimedPolicy(DB);
    const pickupMeta = unclaimedPolicy.enabled
      ? await getSupplyMeta(DB, expired.results.map((v) => Number((v as { product_id: number }).product_id)))
          .catch(() => new Map<number, Record<string, string>>())
      : new Map<number, Record<string, string>>();

    let refundCount = 0;
    let expireCount = 0;
    let forfeitCount = 0;

    for (const voucher of expired.results) {
      // 🛡️ 2026-04-22: Atomic CAS — status 가 'unused' 일 때만 'expired' 로 변경.
      // 이전: SELECT 후 UPDATE 사이 재실행 시 두 번 환불 가능 (CRITICAL bug).
      // 수정 후: CAS 성공 (changes=1) 시만 환불. 이미 expired 면 skip.
      const casResult = await DB.prepare(
        "UPDATE vouchers SET status = 'expired' WHERE id = ? AND status = 'unused'"
      ).bind(voucher.id).run();
      if (!casResult.meta?.changes) {
        // 이미 다른 실행에서 처리됨 — skip
        continue;
      }
      expireCount++;

      // 🛡️ 2026-05-30 낙전(breakage) 정책 = "만료 시 고객 환불" (즉시판매 모델 정합).
      //   환불 금액은 실제 결제가(applied_price). 미존재 시 정가(price) fallback — 과다환불 방지.
      //   BUG #45 패턴: total_amount(주문 전체) 금지 — voucher 1건당 applied_price.
      const paidAmount = Number(voucher.applied_price) > 0
        ? Number(voucher.applied_price)
        : Number(voucher.price || 0);

      // 💸 ④-b 미수령 정책 — **게이트 OFF 면 `unclaimedRefundAmount` 가 전액을 그대로 돌려준다.**
      //   즉 이 블록이 있어도 OFF 상태의 환불액은 위 `paidAmount` 와 동일하다(현행 불변).
      //   보관구분(`storage`)을 모르면 역시 전액 — 모르는 상태에서 소비자 돈을 덜 주지 않는다.
      const pickup = parsePickup(pickupMeta.get(Number(voucher.product_id)));
      const pickupMs = pickup.date ? Date.parse(pickup.date) : NaN;
      const verdict = unclaimedRefundAmount({
        paidAmount,
        storage: pickup.storage,
        daysSinceBasis: Number.isNaN(pickupMs)
          ? null
          : Math.floor((Date.now() - pickupMs) / 86_400_000),
        policy: unclaimedPolicy,
      });
      const refundAmount = verdict.refund;

      // 🔴 적립-역전 대칭(CLAUDE.md 머니 룰 #2): 환불을 줄였으면 그만큼 **운영자에게 귀속**돼야 한다.
      //   원장 기록이 없으면 그 돈은 공중에 뜬다. CAS 통과분 안이라 **한 번만** 기록된다.
      //   ⚠️ 유어딜 5% 는 여기서 건드리지 않는다 — 이건 소비자↔운영자 사이의 분배다.
      if (verdict.operatorShare > 0 && voucher.seller_id) {
        forfeitCount++;
        try {
          await recordLedger(DB, {
            event_type: 'unclaimed_forfeit',
            reference_id: `voucher:${voucher.id}`,
            amount: verdict.operatorShare,
            debit_account: `user:${voucher.user_id ?? 'unknown'}`,
            credit_account: `seller:${voucher.seller_id}`,
            metadata: { reason: verdict.reason, storage: pickup.storage, paid: paidAmount },
          });
        } catch (e) {
          if (env.ENVIRONMENT !== 'production') console.warn('[unclaimed forfeit ledger]', e);
        }

        // 🔴 전액 미환불이면 아래 환불 알림이 **하나도 안 나간다**(전부 `refundAmount > 0` 가드).
        //   돈을 냈는데 아무 통보도 못 받는 상태가 된다 — 그건 이 변경이 만든 구멍이다. 여기서 막는다.
        //   (부분 환불은 아래 기존 알림이 **실제 환불액**으로 정확히 나가므로 중복시키지 않는다.)
        if (refundAmount <= 0 && voucher.user_id) {
          try {
            await DB.prepare(`
              INSERT INTO notifications (user_id, user_type, type, title, message, created_at, is_read)
              VALUES (?, 'user', 'refund', '이용권이 만료되었습니다', ?, datetime('now'), 0)
            `).bind(
              voucher.user_id,
              `사용 기한이 지나 이용권이 만료되었습니다 (${voucher.product_name}). 보관 기준에 따라 환불되지 않습니다.`
            ).run();
          } catch (e) {
            if (env.ENVIRONMENT !== 'production') console.warn('[unclaimed forfeit notif]', e);
          }
        }
      }

      // Refund deal points if paid with deal_points — user_points 테이블 사용
      // 💸 2026-06-12 (4차 감사 D1): 잔액변경 + point_transactions 장부 동시 기록 (adjustUserPoints SSOT).
      //   기존엔 balance 만 올리고 장부 0건 → '딜 이용내역' 과 잔액 불일치. 금액/조건 불변.
      if (voucher.payment_method === 'deal_points' && voucher.user_id && refundAmount > 0) {
        try {
          await adjustUserPoints(DB, {
            userId: String(voucher.user_id),
            delta: refundAmount,
            type: 'refund',
            description: `바우처 만료 환불 (${voucher.product_name})`,
            orderId: voucher.order_id != null ? String(voucher.order_id) : null,
          });
        } catch (e) {
          if (env.ENVIRONMENT !== 'production') console.warn('[auto-settlement user_points]', e);
        }
        // Best-effort legacy column sync
        try {
          await DB.prepare("UPDATE users SET deal_balance = COALESCE(deal_balance, 0) + ? WHERE id = ?")
            .bind(refundAmount, voucher.user_id).run();
        } catch (e) {
          if (env.ENVIRONMENT !== 'production') console.warn('[auto-settlement deal_balance]', e);
        }
        refundCount++;

        // Send notification to user (production notifications requires user_type)
        try {
          await DB.prepare(`
            INSERT INTO notifications (user_id, user_type, type, title, message, created_at, is_read)
            VALUES (?, 'user', 'refund', '바우처 만료 환불', ?, datetime('now'), 0)
          `).bind(
            voucher.user_id,
            `바우처가 만료되어 ${refundAmount.toLocaleString('ko-KR')}딜 포인트가 환불되었습니다 (${voucher.product_name})`
          ).run();
        } catch (e) {
          if (env.ENVIRONMENT !== 'production') console.warn('[auto-settlement notifications insert]', e);
        }
      }
      // 🛡️ 2026-05-30: 토스(카드) 결제 낙전 환불 — 기존엔 deal_points 만 환불되어
      //   카드 결제 미사용 만료건이 환불 누락(금전 손실)됐음. tossCancelPayment 는 toss-gateway SSOT wrapper.
      //   실패 시 toss_refund_failures 에 기록 → toss-refund-retry cron 재시도.
      else if ((voucher.payment_method === 'toss' || voucher.payment_method === 'CARD')
               && voucher.order_id && voucher.payment_key && refundAmount > 0) {
        try {
          const { tossCancelPayment } = await import('../utils/toss-refund');
          const result = await tossCancelPayment(
            env as unknown as { TOSS_SECRET_KEY?: string; DB?: D1Database },
            voucher.payment_key as string,
            {
              reason: `바우처 만료 환불: ${voucher.product_name}`,
              amount: refundAmount,
              idempotencyKey: `voucher-${voucher.id}-refund`,
            },
          );
          if (result.ok) {
            await DB.prepare("UPDATE orders SET status = 'REFUNDED' WHERE id = ?").bind(voucher.order_id).run().catch(() => null);
            refundCount++;
            try {
              await DB.prepare(`
                INSERT INTO notifications (user_id, user_type, type, title, message, created_at, is_read)
                VALUES (?, 'user', 'refund', '바우처 만료 환불', ?, datetime('now'), 0)
              `).bind(
                voucher.user_id,
                `바우처가 만료되어 ${refundAmount.toLocaleString('ko-KR')}원이 환불 처리되었습니다 — 카드 환불은 영업일 기준 3~5일 소요 (${voucher.product_name})`
              ).run();
            } catch (e) { if (env.ENVIRONMENT !== 'production') console.warn('[auto-settlement toss notif]', e); }
          } else {
            logError('[Cron] expired voucher toss refund failed', { voucher_id: voucher.id, error_code: result.error_code });
          }
        } catch (e) {
          if (env.ENVIRONMENT !== 'production') console.warn('[auto-settlement toss refund]', e);
        }
      }

      // 🛡️ 2026-05-16/2026-05-31: 인플 commission clawback — voucher 만료 시 관련 attribution 회수.
      //   환불됐는데 인플은 commission 받는 부당이득 차단. 공유 헬퍼로 통합(이전 인라인 `WHERE voucher_id=?`
      //   는 attribution.voucher_id 가 항상 NULL 이라 0건 매칭 → 회수 안 되던 누수 버그. 헬퍼는 order_id
      //   연결 + 바우처 비례 clawback). voucher.status 는 위에서 'expired' 로 설정됨 → 분모 정합.
      try {
        await clawbackVoucherCommission(DB, Number(voucher.id), 'voucher_expired');
      } catch (e) {
        if (env.ENVIRONMENT !== 'production') console.warn('[clawback]', e);
      }
    }

    logInfo(`[Cron] Expired voucher refunds: ${expireCount} expired, ${refundCount} refunded, ${forfeitCount} forfeited`);
  } catch (err) {
    logError('[Cron] Expired voucher refund failed:', { error: String(err) });
    if (env.DISCORD_WEBHOOK_URL) {
      await sendDiscordAlert(
        env.DISCORD_WEBHOOK_URL,
        'Expired Voucher Refund Failed',
        `Cron expired voucher refund encountered an error: ${(err as Error).message || String(err)}`,
        'error'
      );
    }
  }
}
