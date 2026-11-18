/**
 * 💸 2026-11-17 정산행에 이용권을 **한 덩어리로** 묶는다 — 대표 *"모두 다 해줘 가장 이상적이고 영구적으로"*
 *   (결재 `docs/decisions/2026-11-17-traffic-surge-readiness.md` 1번).
 *
 * 🩸 무엇이 깨져 있었나(`cron/auto-settlement.ts`): 정산행을 INSERT 한 뒤
 *   `UPDATE vouchers SET settlement_id = ? WHERE id IN (…)` 를 **한 문장**으로 보냈다.
 *   D1 은 한 문장에 바인딩 100개까지라 한 가게가 그 회차에 이용권 **100장 이상**을 쓰면 이 UPDATE 가 던진다.
 *   그런데 정산행은 이미 만들어져 있고 이용권엔 `settlement_id` 가 안 붙는다 →
 *   **다음 회차가 같은 이용권을 또 정산한다(이중 지급).** 에러는 cron 실패 알림 한 줄로만 남았다.
 *
 * 처방:
 *  1. 90개씩 나눈 UPDATE 를 `DB.batch` 로 보낸다 — D1 batch 는 **전부 되거나 전부 안 된다**.
 *  2. 묶기가 실패하면 방금 만든 정산행(아직 `pending`)을 지운다 — "행만 있고 표시는 없는" 상태를 남기지 않는다.
 *  3. 묶인 수가 정산행이 센 장수와 다르면(다른 회차가 먼저 일부를 가져감) 정산행을 지우고 실패로 올린다 —
 *     금액이 장수로 계산됐으므로 일부만 묶인 행은 그대로 지급하면 틀린 돈이 나간다. 다음 회차가 남은 것만 다시 센다.
 */
import { chunkIds } from './d1-in-chunks'

export async function claimVouchersForSettlement(
  DB: D1Database,
  settlementId: number,
  voucherIds: readonly number[],
): Promise<void> {
  if (voucherIds.length === 0) return
  let claimed = 0
  try {
    const results = await DB.batch(
      chunkIds(voucherIds).map((ch) =>
        DB.prepare(
          `UPDATE vouchers SET settlement_id = ? WHERE id IN (${ch.map(() => '?').join(',')}) AND settlement_id IS NULL`,
        ).bind(settlementId, ...ch),
      ),
    )
    claimed = results.reduce((n, r) => n + Number(r?.meta?.changes ?? 0), 0)
    if (claimed !== voucherIds.length) {
      throw new Error(`정산 묶기 불일치 — 대상 ${voucherIds.length}장 중 ${claimed}장만 묶였다(다른 회차가 먼저 가져감)`)
    }
  } catch (err) {
    // 일부만 묶였으면 그 표시도 풀고, 정산행을 지운다 — 다음 회차가 처음부터 다시 센다.
    await DB.batch([
      DB.prepare(`UPDATE vouchers SET settlement_id = NULL WHERE settlement_id = ?`).bind(settlementId),
      DB.prepare(`DELETE FROM restaurant_settlements WHERE id = ? AND status = 'pending'`).bind(settlementId),
    ])
    throw err
  }
}
