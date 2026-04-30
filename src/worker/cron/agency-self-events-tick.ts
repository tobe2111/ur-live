/**
 * Agency Self Events Tick — 자사 매출 챌린지 진행값 자동 갱신 + 보상 지급
 *
 * 매일 18UTC batch 에 합류 (KST 03:00).
 *
 * 처리:
 *   1) 진행 중 (status='active') 이벤트 순회
 *   2) 참여자별 current_value 갱신 (metric 별 집계)
 *   3) target_value 도달 시 achieved=1, 보상 자동 지급 (user_points)
 *   4) end_date 지나면 status='ended'
 *
 * 멱등 (이미 reward_paid=1 이면 skip).
 */

import type { Env } from '../types/env';

import { swallow } from '../utils/swallow';
interface SelfEvent {
  id: number;
  agency_id: number;
  start_date: string;
  end_date: string;
  metric: 'revenue' | 'live_count' | 'viewer_peak';
  target_value: number;
  reward_deal: number;
  status: string;
}

interface Participant {
  id: number;
  event_id: number;
  seller_id: number;
  current_value: number;
  achieved: number;
  reward_paid: number;
}

export async function handleAgencySelfEventsTick(env: Env): Promise<void> {
  const DB = env.DB;
  if (!DB) return;

  let processed = 0;
  let achieved = 0;
  let ended = 0;

  try {
    const events = await DB.prepare(`
      SELECT id, agency_id, start_date, end_date, metric, target_value, reward_deal, status
      FROM agency_self_events
      WHERE status = 'active'
    `).all<SelfEvent>().catch(() => ({ results: [] as SelfEvent[] }));

    const now = new Date().toISOString().slice(0, 10);

    for (const ev of events.results || []) {
      try {
        // 종료 시점 도달 → ended 마킹
        if (ev.end_date < now) {
          await DB.prepare(`UPDATE agency_self_events SET status = 'ended' WHERE id = ?`)
            .bind(ev.id).run().catch(swallow('worker:cron:agency-self-events-tick'));
          ended++;
          continue;
        }

        // 참여자 조회
        const participants = await DB.prepare(`
          SELECT id, event_id, seller_id, current_value, achieved, reward_paid
          FROM agency_self_event_participants
          WHERE event_id = ?
        `).bind(ev.id).all<Participant>().catch(() => ({ results: [] as Participant[] }));

        for (const p of participants.results || []) {
          if (p.reward_paid) continue;

          // 메트릭 별 집계 (start_date ~ today)
          let value = 0;
          try {
            if (ev.metric === 'revenue') {
              const r = await DB.prepare(`
                SELECT COALESCE(SUM(total_amount), 0) AS v
                FROM orders
                WHERE seller_id = ? AND payment_status = 'approved'
                  AND date(created_at) >= ? AND date(created_at) <= ?
              `).bind(p.seller_id, ev.start_date, ev.end_date)
                .first<{ v: number }>().catch(() => null);
              value = r?.v ?? 0;
            } else if (ev.metric === 'live_count') {
              const r = await DB.prepare(`
                SELECT COUNT(*) AS v
                FROM live_streams
                WHERE seller_id = ?
                  AND date(created_at) >= ? AND date(created_at) <= ?
              `).bind(p.seller_id, ev.start_date, ev.end_date)
                .first<{ v: number }>().catch(() => null);
              value = r?.v ?? 0;
            } else if (ev.metric === 'viewer_peak') {
              const r = await DB.prepare(`
                SELECT COALESCE(MAX(peak_viewers), 0) AS v
                FROM live_stream_metrics m
                JOIN live_streams ls ON ls.id = m.live_stream_id
                WHERE ls.seller_id = ?
                  AND date(ls.created_at) >= ? AND date(ls.created_at) <= ?
              `).bind(p.seller_id, ev.start_date, ev.end_date)
                .first<{ v: number }>().catch(() => null);
              value = r?.v ?? 0;
            }
          } catch { /* skip — 메트릭 집계 실패 */ }

          const wasAchieved = p.achieved === 1;
          const isAchieved = value >= ev.target_value;

          if (!wasAchieved && isAchieved) {
            // 새로 달성 → 보상 지급
            await DB.batch([
              DB.prepare(`
                UPDATE agency_self_event_participants
                SET current_value = ?, achieved = 1, achieved_at = datetime('now'), reward_paid = 1
                WHERE id = ?
              `).bind(value, p.id),
              DB.prepare(`
                INSERT INTO user_points (user_id, balance, total_charged, total_used)
                VALUES (?, ?, ?, 0)
                ON CONFLICT(user_id) DO UPDATE SET
                  balance = balance + ?,
                  total_charged = total_charged + ?
              `).bind(p.seller_id, ev.reward_deal, ev.reward_deal, ev.reward_deal, ev.reward_deal),
            ]);

            // 셀러 알림
            await DB.prepare(`
              INSERT INTO dashboard_notifications (user_type, user_id, type, title, message, link, created_at)
              VALUES ('seller', ?, 'event_achieved', ?, ?, '/seller', datetime('now'))
            `).bind(
              String(p.seller_id),
              `🏆 챌린지 달성!`,
              `목표 달성 보상 ${Number(ev.reward_deal ?? 0).toLocaleString('ko-KR')}딜이 지급되었습니다.`,
            ).run().catch(swallow('worker:cron:agency-self-events-tick'));

            achieved++;
          } else {
            // 진행값만 갱신
            await DB.prepare(`
              UPDATE agency_self_event_participants SET current_value = ? WHERE id = ?
            `).bind(value, p.id).run().catch(swallow('worker:cron:agency-self-events-tick'));
          }

          processed++;
        }
      } catch (err) {
        console.error(`[cron:self-events] event ${ev.id} failed:`, err);
      }
    }
  } catch (err) {
    console.error('[cron:agency-self-events-tick] FAILED:', err);
  }

  console.info(`[cron:agency-self-events-tick] processed=${processed} achieved=${achieved} ended=${ended}`);
}
