/**
 * 라이브 종료 자동 KPI 카드 생성 cron — Phase 2-4
 *
 * 매일 18UTC batch 에 합류 (전일 종료 라이브 처리).
 *
 * 처리 대상:
 *   live_streams 중 status='ended' 이고 live_stream_metrics 에 미등록인 것.
 *   각 라이브에 대해 6개 메트릭 사전 집계 → INSERT.
 *
 * 멱등: live_stream_metrics 에 이미 있으면 skip.
 *
 * 마이그레이션 0226 미적용 시 graceful skip.
 */

import type { Env } from '../types/env';

interface PendingStream {
  id: number;
  seller_id: number;
  started_at: string | null;
  ended_at: string | null;
}

const BATCH_SIZE = 50;

export async function handleLiveStreamMetrics(env: Env): Promise<void> {
  const DB = env.DB;
  if (!DB) return;

  let processed = 0;
  let failed = 0;

  try {
    // 종료된 라이브 중 메트릭 미생성 항목
    const pending = await DB.prepare(`
      SELECT ls.id, ls.seller_id, ls.started_at, ls.ended_at
      FROM live_streams ls
      LEFT JOIN live_stream_metrics m ON m.live_stream_id = ls.id
      WHERE ls.status = 'ended'
        AND m.live_stream_id IS NULL
        AND ls.ended_at IS NOT NULL
      ORDER BY ls.ended_at DESC
      LIMIT ?
    `).bind(BATCH_SIZE).all<PendingStream>().catch(() => ({ results: [] as PendingStream[] }));

    for (const ls of pending.results || []) {
      try {
        // duration
        let durationSec = 0;
        if (ls.started_at && ls.ended_at) {
          durationSec = Math.max(0, Math.floor(
            (new Date(ls.ended_at).getTime() - new Date(ls.started_at).getTime()) / 1000
          ));
        }

        // peak/avg viewers — live_streams.peak_viewers 컬럼 또는 live_views 테이블에서 추출
        let peakViewers = 0;
        let avgViewers = 0;
        try {
          const r = await DB.prepare(
            `SELECT peak_viewers, current_viewers FROM live_streams WHERE id = ?`
          ).bind(ls.id).first<{ peak_viewers: number | null; current_viewers: number | null }>().catch(() => null);
          peakViewers = r?.peak_viewers ?? 0;
          avgViewers = r?.current_viewers ?? 0; // 종료 시점 인원을 평균으로 추정
        } catch { /* skip */ }

        // 매출 — orders (라이브 동안 결제 완료)
        let totalRevenue = 0;
        try {
          const r = await DB.prepare(`
            SELECT COALESCE(SUM(total_amount), 0) AS rev
            FROM orders
            WHERE seller_id = ?
              AND payment_status = 'approved'
              AND created_at >= ?
              AND created_at <= ?
          `).bind(ls.seller_id, ls.started_at, ls.ended_at).first<{ rev: number }>().catch(() => null);
          totalRevenue = r?.rev ?? 0;
        } catch { /* skip */ }

        // 후원
        let totalDonations = 0;
        try {
          const r = await DB.prepare(`
            SELECT COALESCE(SUM(deal_amount), 0) AS dn
            FROM donations
            WHERE seller_id = ?
              AND payment_status = 'approved'
              AND created_at >= ?
              AND created_at <= ?
          `).bind(ls.seller_id, ls.started_at, ls.ended_at).first<{ dn: number }>().catch(() => null);
          totalDonations = r?.dn ?? 0;
        } catch { /* skip */ }

        // 채팅 수
        let chatCount = 0;
        try {
          const r = await DB.prepare(
            `SELECT COUNT(*) AS cnt FROM live_chat WHERE live_stream_id = ?`
          ).bind(ls.id).first<{ cnt: number }>().catch(() => null);
          chatCount = r?.cnt ?? 0;
        } catch { /* skip */ }

        await DB.prepare(`
          INSERT OR REPLACE INTO live_stream_metrics
            (live_stream_id, seller_id, peak_viewers, avg_viewers, total_revenue,
             total_donations, chat_count, new_followers, duration_seconds, computed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now'))
        `).bind(
          ls.id, ls.seller_id, peakViewers, avgViewers,
          totalRevenue, totalDonations, chatCount, durationSec
        ).run();

        processed++;
      } catch (err) {
        console.error(`[cron:live-metrics] stream ${ls.id} failed:`, err);
        failed++;
      }
    }
  } catch (err) {
    console.error('[cron:live-stream-metrics] FAILED:', err);
  }

  console.info(`[cron:live-stream-metrics] processed=${processed} failed=${failed}`);
}
