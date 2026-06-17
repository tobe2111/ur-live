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
// 🏁 2026-06-17 (전수조사): 원천징수율 하드코딩(0.033) 제거 — SSOT 상수 사용.
//   seller 전용 withholdAndLog()는 sellers 테이블(tax_type/사업자등록)을 조회하므로 에이전시(별도 agencies 엔티티,
//   tax_type 컬럼 없음)엔 부적합. agencies 는 전부 사업소득 3.3% 이므로 마스터 상수에서 직접 소싱(값 동일, 동작 보존).
//   향후 agencies.tax_type/사업자등록 도입 시 비율 분기·면제는 별도 작업(머니 — staging E2E 필요).
import { WITHHOLDING_RATES } from '../utils/tax-withholding';
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

const TAX_RATE = WITHHOLDING_RATES.business_income; // 3.3% (소득세 3% + 지방세 0.3%) — SSOT 상수

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
      // 🏁 2026-06-17 (전수조사 — claim-before-credit): 기존엔 SELECT(eligible) → INSERT settlement → UPDATE mark
      //   순서라 동시/중첩 실행 시 같은 주문을 두 번 정산(이중 settlement row)할 수 있었음. 정산 가능 주문을
      //   원자적 UPDATE...RETURNING 으로 **먼저 선점**(agency_settled=0 가드)하고, 실제로 선점한 행으로만 수수료를
      //   계산·INSERT. 다른 동시 실행은 이미 마킹된 행을 못 잡아(RETURNING 0건) 정산을 건너뜀 → 멱등.
      const { results: claimed } = await DB.prepare(`
        UPDATE orders SET agency_settled = 1
        WHERE id IN (
          SELECT o.id FROM orders o
          INNER JOIN agency_sellers ag ON ag.seller_id = o.seller_id
          WHERE ag.agency_id = ?
            AND o.status IN ('DELIVERED', 'DONE')
            AND COALESCE(o.settlement_status, 'pending') = 'confirmed'
            AND COALESCE(o.agency_settled, 0) = 0
        )
        RETURNING id, total_amount, seller_id
      `).bind(agency.id).all<OrderRow>();

      if (!claimed?.length) continue;

      // 🛡️ 2026-05-21: 정책 중앙화
      const { COMMISSION_DEFAULTS } = await import('../../shared/constants/policy')
      const rate = agency.commission_rate ?? COMMISSION_DEFAULTS.AGENCY_OWN_RATE;
      const totalAmount = claimed.reduce((s, o) => s + (o.total_amount || 0), 0);
      const commissionAmount = Math.round(totalAmount * rate / 100);
      const taxAmount = Math.round(commissionAmount * TAX_RATE);
      const netAmount = commissionAmount - taxAmount;

      // 정산 row 생성 (is_auto=1, status='pending' — 어드민 정산 처리 후 'completed').
      //   주문은 위에서 이미 선점(agency_settled=1)됐으므로 이 INSERT 는 선점한 행에 1:1 대응.
      await DB.prepare(`
        INSERT INTO agency_settlements
          (agency_id, total_orders, total_amount, commission_rate, commission_amount,
           tax_amount, net_amount, is_auto, status,
           bank_name, bank_account, account_holder, requested_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'pending', ?, ?, ?, datetime('now'))
      `).bind(
        agency.id, claimed.length, totalAmount, rate, commissionAmount,
        taxAmount, netAmount,
        agency.bank_name, agency.bank_account, agency.account_holder
      ).run();

      // 에이전시 알림 (best-effort)
      DB.prepare(`
        INSERT INTO agency_notifications (agency_id, type, title, message, link, created_at)
        VALUES (?, 'auto_settlement', '자동 정산 처리됨', ?, '/agency/settlements', datetime('now'))
      `).bind(
        agency.id,
        `${claimed.length}건 / 수수료 ${Number(commissionAmount ?? 0).toLocaleString('ko-KR')}원 (세금 ${Number(taxAmount ?? 0).toLocaleString('ko-KR')}원 차감, 실수령 ${Number(netAmount ?? 0).toLocaleString('ko-KR')}원)`
      ).run().catch(swallow('cron:agency-auto-settle:notify'));

      settled++;
      totalCommission += commissionAmount;

      logInfo(`[cron:agency-auto-settle] agency=${agency.id}(${agency.name}) orders=${claimed.length} commission=${commissionAmount} tax=${taxAmount} net=${netAmount}`);
    } catch (err) {
      logError(`[cron:agency-auto-settle] agency=${agency.id} FAILED:`, { error: String(err) });
    }
  }

  return { processed, settled, total_commission: totalCommission };
}
