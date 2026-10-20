/**
 * Ad Slots Daily Award Cron (2026-05-05)
 *
 * Migration 0244 (ad_slots, ad_bids) 적용 후 동작. 매일 18시 배치에 포함.
 *
 * 처리:
 *   1. 만료된 슬롯 확인 → 최고 입찰자 선정 → 'won' 처리 + 나머지 'lost'
 *   2. 낙찰된 슬롯은 24시간 갱신 + 낙찰자에게 dashboard 알림
 *   3. 슬롯에 입찰 없으면 만료 처리 후 빈 슬롯으로 초기화
 *   4. 낙찰자의 payment_status = 'pending' → /seller/ad-slots 에서 결제 진행
 */

import type { Env } from '../types/env';
import { swallow } from '../utils/swallow';

export async function handleAdSlotsAward(env: Env): Promise<void> {
  const DB = env.DB;
  if (!DB) return;

  // 만료 시점이 지난 슬롯 (아직 처리 안 된 것)
  const expiredSlots = await DB.prepare(`
    SELECT slot_id, display_name, base_price, current_seller_id
    FROM ad_slots
    WHERE is_active = 1 AND expires_at IS NOT NULL AND expires_at < datetime('now')
  `).all<{ slot_id: string; display_name: string; base_price: number; current_seller_id: number | null }>()
    .catch(() => null);

  let awarded = 0;
  let expired = 0;

  for (const slot of expiredSlots?.results ?? []) {
    // 최고 입찰자 찾기
    const winner = await DB.prepare(`
      SELECT id, seller_id, bid_amount
      FROM ad_bids
      WHERE slot_id = ? AND status = 'active'
      ORDER BY bid_amount DESC, created_at ASC
      LIMIT 1
    `).bind(slot.slot_id).first<{ id: number; seller_id: number; bid_amount: number }>()
      .catch(() => null);

    const nextExpires = new Date(Date.now() + 24 * 3600_000).toISOString();
    const now = new Date().toISOString();

    if (winner) {
      // 낙찰 처리
      await DB.batch([
        // 낙찰자
        DB.prepare(`
          UPDATE ad_bids SET status = 'won', start_period = ?, end_period = ?
          WHERE id = ?
        `).bind(now, nextExpires, winner.id),
        // 나머지 'lost'
        DB.prepare(`
          UPDATE ad_bids SET status = 'lost'
          WHERE slot_id = ? AND status = 'active' AND id != ?
        `).bind(slot.slot_id, winner.id),
        // 슬롯 갱신
        DB.prepare(`
          UPDATE ad_slots
             SET current_seller_id = ?, current_bid = ?, starts_at = ?, expires_at = ?
           WHERE slot_id = ?
        `).bind(winner.seller_id, winner.bid_amount, now, nextExpires, slot.slot_id),
        // 낙찰 알림
        DB.prepare(`
          INSERT INTO dashboard_notifications
            (recipient_type, recipient_id, type, title, message, link, created_at)
          VALUES ('seller', ?, 'ad_slot_won', ?, ?, '/seller/ad-slots', datetime('now'))
        `).bind(
          String(winner.seller_id),
          `🎉 광고 슬롯 낙찰: ${slot.display_name}`,
          `입찰가 ${winner.bid_amount.toLocaleString('ko-KR')}원으로 낙찰되었습니다. ` +
          `24시간 노출이 시작됩니다. /seller/ad-slots 에서 결제를 완료해주세요.`,
        ),
      ]).catch(swallow('cron:ad-slots-award:win'));

      awarded++;
    } else {
      // 입찰 없이 만료 → 슬롯 초기화 (다음 24시간 다시 열기)
      await DB.prepare(`
        UPDATE ad_slots
           SET current_seller_id = NULL, current_bid = NULL,
               starts_at = ?, expires_at = ?
         WHERE slot_id = ?
      `).bind(now, nextExpires, slot.slot_id).run()
        .catch(swallow('cron:ad-slots-award:reset'));

      expired++;
    }
  }

  // 신규 슬롯 (expires_at NULL = 아직 한번도 열지 않음) → 첫 개장
  const freshSlots = await DB.prepare(`
    SELECT slot_id FROM ad_slots WHERE is_active = 1 AND expires_at IS NULL
  `).all<{ slot_id: string }>().catch(() => null);

  for (const s of freshSlots?.results ?? []) {
    const nextExpires = new Date(Date.now() + 24 * 3600_000).toISOString();
    await DB.prepare(`
      UPDATE ad_slots SET starts_at = datetime('now'), expires_at = ?
      WHERE slot_id = ?
    `).bind(nextExpires, s.slot_id).run().catch(swallow('cron:ad-slots-award:open'));
  }

  console.info(`[cron:ad-slots-award] awarded=${awarded} expired=${expired} fresh=${freshSlots?.results?.length ?? 0}`);
}
