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
export async function handleAutoSettlement(env: Env) {
  const DB = env.DB;

  try {
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
    // 🛡️ 2026-05-30: 정산 매출 = 실제 결제가(applied_price). 미존재 시 정가(price) fallback.
    //   환불(applied_price)과 동일 기준 → 결제·정산·환불 폐루프 정합. 티어 할인 deal 과다정산(플랫폼 손실) 제거.
    const usedVouchers = await DB.prepare(`
      SELECT v.id, v.product_id, v.order_id, v.applied_price, p.price, p.seller_id, p.restaurant_name,
             COALESCE(p.commission_rate, ?) as commission_rate
      FROM vouchers v
      JOIN products p ON v.product_id = p.id
      WHERE v.status = 'used'
        AND v.used_at < ?
        AND v.settlement_id IS NULL
        AND v.id NOT IN (SELECT voucher_id FROM voucher_disputes WHERE status = 'open')
    `).bind(platformRate, settlementCutoff).all();

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
             o.user_id, o.payment_method, o.payment_key, p.price, p.name as product_name
      FROM vouchers v
      JOIN orders o ON v.order_id = o.id
      JOIN products p ON v.product_id = p.id
      WHERE v.status = 'unused'
        AND v.expires_at < datetime('now')
      ORDER BY v.expires_at ASC
      LIMIT 5000
    `).all();

    if (!expired.results?.length) return;

    let refundCount = 0;
    let expireCount = 0;

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
      const refundAmount = Number(voucher.applied_price) > 0
        ? Number(voucher.applied_price)
        : Number(voucher.price || 0);

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

    logInfo(`[Cron] Expired voucher refunds: ${expireCount} expired, ${refundCount} refunded`);
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
