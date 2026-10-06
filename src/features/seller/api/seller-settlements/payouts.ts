/**
 * 💸 셀러 정산 현황(읽기 전용) — `GET /api/seller/settlements/payouts`
 *
 * 🧱 2026-09-07 분리: `seller-settlements.routes.ts` 가 파일크기 래칫(1076줄) 상한이라
 *   같은이름 폴더로 뺐다(레포 룰: 대형 파일은 성장 금지 — 우회 대신 분해).
 *
 * 💸 2026-07-01 (정산 정합 — 대표 승인 "자동 정산 하나로 통일"):
 *   진실원천 = 이중원장(`ledger_entries`)의 `seller:N` credit − payouts 지급분(getPayablePending).
 *   동네딜 공구/이용권 매출이 원장에 적립 → 주간 집계 cron(`payouts-generate`)이 payouts(pending)
 *   생성 → 어드민이 검토 후 송금(approved→sent). 여기서는 그 실데이터를 그대로 노출한다
 *   (**머니-이동 없음** — 읽기뿐이다).
 *   ⚠️ 일반 쇼핑 상품 주문은 아직 원장 미배선(`payment.routes` 잠금) → orders 기반 매출은
 *     매출 캘린더로 별도 표시.
 */
import type { Context } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import type { SellerJWTPayload } from '@/lib/seller-shared'
import { safeError } from '@/worker/utils/safe-error'

// 호출부(seller-settlements.routes.ts)의 Hono 제네릭과 같은 모양이어야 한다.
type Bindings = { DB: D1Database; JWT_SECRET: string }

export async function getSellerPayouts(c: Context<{ Bindings: Bindings }>): Promise<Response> {
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) return c.json({ success: false, error: '인증이 필요합니다' }, 401);
  try {
    const token = authorization.substring(7);
    const payload = await import('hono/jwt').then(m => m.verify(token, c.env.JWT_SECRET, 'HS256')) as SellerJWTPayload;
    const sellerId = payload.seller_id;
    if (!sellerId) return c.json({ success: false, error: '셀러 권한이 필요합니다' }, 403);

    // 순 receivable(지급 이력 제외) — (credit − fee_amount) − debit. ledger.ts SSOT.
    const { getLedgerReceivable } = await import('../../../../worker/utils/ledger');
    const receivable = await getLedgerReceivable(c.env.DB, `seller:${sellerId}`).catch(() => 0);

    // 🕙 2026-09-24 (유보 10일의 짝): 이 화면은 '미지급' 옆에 **"다음 집계 대상"** 이라고 적고
    //   맨 위 카드는 **"매주 자동으로 처리됩니다"** 라고 말한다. 유보가 생긴 뒤로 그건 오늘 적립된
    //   돈에 대해 **거짓**이다 — 다음 집계가 아니라 2주 뒤 집계 대상이다. 숫자가 틀린 게 아니라
    //   **화면이 못 지킬 약속을 하는 것**이고, 첫 실매장이 뭔가 팔면 바로 겪는다.
    //   ⚠️ 부등호를 여기서 뒤집지 않는다 — `payout-hold.ts` 가 cron 과 **같은 cutoff** 로 만든
    //     여집합(`heldSql`)을 쓴다(유보일을 바꾼 날 한쪽만 따라가는 것을 구조적으로 막는다).
    const { resolvePayoutHold } = await import('../../../../worker/utils/payout-hold');
    const hold = await resolvePayoutHold(c.env.DB);
    const heldRow = hold.enabled
      ? await c.env.DB.prepare(
          `SELECT COALESCE(SUM(amount - COALESCE(fee_amount, 0)), 0) AS held
             FROM ledger_entries
            WHERE credit_account = ?
              ${hold.heldSql}`
        ).bind(`seller:${sellerId}`).first<{ held: number }>().catch(() => null)
      : null;

    // 👥 2026-09-07 (대표 *"귀속되는 시점부터 계산"*): 운영자는 합류(`granted_at`) 이후만 본다.
    //   소유자는 종전 그대로 전 기간. 사유·한계는 settlement-scope.ts 헤더에 있다.
    const { resolveSettlementScope } = await import('../../../../worker/utils/settlement-scope');
    const { scope, since, displaySince } = await resolveSettlementScope(c.env.DB, sellerId, authorization, c.env.JWT_SECRET);

    // 실제 지급 기록 (payouts) — 이 셀러 건만. 운영자는 합류 이후만.
    const rows = await c.env.DB.prepare(
      `SELECT id, amount, period_start, period_end, status,
              account_number, account_holder, admin_memo,
              created_at, approved_at, sent_at
         FROM payouts
        WHERE payee_type = 'seller' AND payee_id = ?
          AND (? IS NULL OR created_at >= ?)
        ORDER BY created_at DESC LIMIT 50`
    ).bind(String(sellerId), since, since).all<Record<string, unknown>>().catch(() => ({ results: [] as Record<string, unknown>[] }));
    const list = rows.results || [];

    // 상태별 합계 — 지급 예정(pending+approved) vs 지급 완료(sent).
    const sum = (st: string[]) => list
      .filter(r => st.includes(String(r.status)))
      .reduce((a, r) => a + Number(r.amount || 0), 0);
    const scheduledTotal = sum(['pending', 'approved']);
    const sentTotal = sum(['sent']);
    // 미지급 = 순 receivable − (지급예정 + 지급완료). 세 버킷이 겹치지 않게 분할.
    const payable = Math.max(0, Number(receivable) - scheduledTotal - sentTotal);
    // 미지급 중 **아직 안 익은 몫**. payable 을 넘지 않게 자른다 — 유보가 생기기 전에 지급된 건이
    // 있으면 원장 기준 held 가 미지급보다 클 수 있고, 그러면 "그중 N" 이 말이 안 된다.
    const held = Math.min(payable, Math.max(0, Math.round(Number(heldRow?.held) || 0)));

    return c.json({
      success: true,
      data: {
        payable,                          // 아직 payout 에 안 잡힌 순수 외상
        held,                             // 그중 유보 기간이 안 지나 이번 집계에 안 잡히는 몫
        hold_days: hold.days,             // 유보 역일(0 이면 유보 없음) — 화면 문구가 이 값을 쓴다
        scheduled_total: scheduledTotal,  // 집계됐고 송금 대기중
        sent_total: sentTotal,            // 송금 완료
        payouts: list,
        auto: true,                       // 자동 정산 파이프라인 사용
        scope,                            // 'owner' | 'operator' — payable 은 매장 돈이지 운영자 몫이 아니다
        since: displaySince,              // 운영자면 합류 시각
      },
    });
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[seller-settlements]');
  }
}
