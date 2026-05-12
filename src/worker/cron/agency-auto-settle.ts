import { logInfo, logError } from '../utils/logger'
/**
 * Agency Auto-Settlement Cron (Agency P0 #3)
 *
 * 매주 월요일 00:00 UTC (= KST 09:00) 실행.
 *
 * 처리 흐름:
 * 1. auto_settle=1 인 active 에이전시 조회
 * 2. 각 에이전시별로 정산 가능 주문 (DELIVERED/DONE + settlement_status='confirmed' + agency_settled=0) 집계
 * 3. 수수료 = 매출 × commission_rate%
 * 4. 세금 = 수수료 × 3.3% (소득세 + 지방세, 사업자 자동신고 대상)
 * 5. 실수령액 = 수수료 - 세금
 * 6. agency_settlements row 생성 (is_auto=1)
 * 7. 주문들 agency_settled=1 마킹
 * 8. 에이전시에 알림
 *
 * 참조: docs/AGENCY_BACKSTAGE_GAP_ANALYSIS.md (P0 #3)
 * 마이그레이션: migrations/0208_agency_auto_settle.sql
 */

import type { Env } from '../types/env';
import { swallow } from '../utils/swallow';
interface AgencyRow {
  id: number;
  name: string;
  commission_rate: number | null;
  bank_name: string | null;
  bank_account: string | null;
  account_holder: string | null;
}

interface OrderRow {
  id: number;
  total_amount: number;
  seller_id: number;
}

const TAX_RATE = 0.033; // 소득세 3% + 지방세 0.3%

export async function handleAgencyAutoSettle(env: Env): Promise<{ processed: number; settled: number; total_commission: number }> {
  const DB = env.DB;
  let processed = 0;
  let settled = 0;
  let totalCommission = 0;

  // 1. auto_settle=1 인 활성 에이전시 조회
  let agencies: AgencyRow[] = [];
  try {
    const r = await DB.prepare(`
      SELECT id, name, commission_rate, bank_name, bank_account, account_holder
      FROM agencies
      WHERE COALESCE(auto_settle, 0) = 1
        AND status IN ('active', 'approved')
    `).all<AgencyRow>();
    agencies = r.results || [];
  } catch (e) {
    // 마이그레이션 0208 미적용 시 컬럼 없음 → no-op
    console.warn('[cron:agency-auto-settle] auto_settle column missing — migration 0208 not applied:', e);
    return { processed: 0, settled: 0, total_commission: 0 };
  }

  for (const agency of agencies) {
    processed++;
    try {
      const { results: eligible } = await DB.prepare(`
        SELECT o.id, o.total_amount, o.seller_id
        FROM orders o
        INNER JOIN agency_sellers ag ON ag.seller_id = o.seller_id
        WHERE ag.agency_id = ?
          AND o.status IN ('DELIVERED', 'DONE')
          AND COALESCE(o.settlement_status, 'pending') = 'confirmed'
          AND COALESCE(o.agency_settled, 0) = 0
      `).bind(agency.id).all<OrderRow>();

      if (!eligible?.length) continue;

      const rate = agency.commission_rate ?? 2.0;
      const totalAmount = eligible.reduce((s, o) => s + (o.total_amount || 0), 0);
      const commissionAmount = Math.round(totalAmount * rate / 100);
      const taxAmount = Math.round(commissionAmount * TAX_RATE);
      const netAmount = commissionAmount - taxAmount;

      // 정산 row 생성 (is_auto=1, status='pending' — 어드민 정산 처리 후 'completed')
      await DB.prepare(`
        INSERT INTO agency_settlements
          (agency_id, total_orders, total_amount, commission_rate, commission_amount,
           tax_amount, net_amount, is_auto, status,
           bank_name, bank_account, account_holder, requested_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'pending', ?, ?, ?, datetime('now'))
      `).bind(
        agency.id, eligible.length, totalAmount, rate, commissionAmount,
        taxAmount, netAmount,
        agency.bank_name, agency.bank_account, agency.account_holder
      ).run();

      // 주문들 agency_settled=1 마킹 (배치 IN — D1 binding limit 100 고려해 chunk)
      for (let i = 0; i < eligible.length; i += 50) {
        const chunk = eligible.slice(i, i + 50);
        const placeholders = chunk.map(() => '?').join(',');
        await DB.prepare(
          `UPDATE orders SET agency_settled = 1 WHERE id IN (${placeholders})`
        ).bind(...chunk.map(o => o.id)).run();
      }

      // 에이전시 알림 (best-effort)
      DB.prepare(`
        INSERT INTO agency_notifications (agency_id, type, title, message, link, created_at)
        VALUES (?, 'auto_settlement', '자동 정산 처리됨', ?, '/agency/settlements', datetime('now'))
      `).bind(
        agency.id,
        `${eligible.length}건 / 수수료 ${Number(commissionAmount ?? 0).toLocaleString('ko-KR')}원 (세금 ${Number(taxAmount ?? 0).toLocaleString('ko-KR')}원 차감, 실수령 ${Number(netAmount ?? 0).toLocaleString('ko-KR')}원)`
      ).run().catch(swallow('cron:agency-auto-settle:notify'));

      settled++;
      totalCommission += commissionAmount;

      logInfo(`[cron:agency-auto-settle] agency=${agency.id}(${agency.name}) orders=${eligible.length} commission=${commissionAmount} tax=${taxAmount} net=${netAmount}`);
    } catch (err) {
      logError(`[cron:agency-auto-settle] agency=${agency.id} FAILED:`, { error: String(err) });
    }
  }

  return { processed, settled, total_commission: totalCommission };
}
