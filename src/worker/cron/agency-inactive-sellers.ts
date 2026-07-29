/**
 * 부진 셀러 자동 알림 cron (Phase 1-2)
 *
 * 매일 KST 09:30 (= 00:30 UTC) 실행. 멱등 (같은 셀러에 1주일에 1번만 알림).
 *
 * 검출 조건 (둘 중 하나):
 *   1) 7일 무라이브 (마지막 라이브 시작 시각이 7일 전)
 *   2) 30일 무매출 (마지막 결제 완료 시각이 30일 전)
 *
 * 알림 → agency_notifications 에 INSERT (에이전시 대시보드 표시).
 *
 * 정책 (느슨): 강제 패널티 X. 단순 알림만.
 */

import type { Env } from '../types/env';

import { swallow } from '../utils/swallow';
interface InactiveSellerRow {
  agency_id: number;
  seller_id: number;
  seller_name: string | null;
  last_live_at: string | null;
  last_paid_at: string | null;
}

const NO_LIVE_DAYS = 7;
const NO_REVENUE_DAYS = 30;

// 같은 셀러에 대해 7일 이내 동일 알림 중복 방지
const NOTIFY_DEDUP_DAYS = 7;

export async function handleAgencyInactiveSellers(env: Env): Promise<void> {
  const DB = env.DB;
  if (!DB) return;

  const now = new Date();
  const noLiveCutoff = new Date(now.getTime() - NO_LIVE_DAYS * 86400_000).toISOString();
  const noRevenueCutoff = new Date(now.getTime() - NO_REVENUE_DAYS * 86400_000).toISOString();
  const dedupCutoff = new Date(now.getTime() - NOTIFY_DEDUP_DAYS * 86400_000).toISOString();

  let detected = 0;
  let notified = 0;

  try {
    // 모든 에이전시 소속 셀러 + 마지막 라이브/결제 시각 조회
    const rows = await DB.prepare(`
      SELECT
        ag_s.agency_id,
        ag_s.seller_id,
        s.business_name AS seller_name,
        (SELECT MAX(created_at) FROM live_streams WHERE seller_id = ag_s.seller_id) AS last_live_at,
        (SELECT MAX(created_at) FROM orders WHERE seller_id = ag_s.seller_id AND payment_status = 'approved') AS last_paid_at
      FROM agency_sellers ag_s
      JOIN sellers s ON s.id = ag_s.seller_id
    `).all<InactiveSellerRow>().catch(() => ({ results: [] as InactiveSellerRow[] }));

    for (const r of rows.results || []) {
      const noLive = !r.last_live_at || r.last_live_at < noLiveCutoff;
      const noRevenue = !r.last_paid_at || r.last_paid_at < noRevenueCutoff;

      if (!noLive && !noRevenue) continue;
      detected++;

      // 같은 셀러 + 'inactive_seller' 알림이 7일 이내 있으면 skip (멱등)
      const recent = await DB.prepare(`
        SELECT id FROM agency_notifications
        WHERE agency_id = ? AND type = 'inactive_seller'
          AND link = ? AND created_at > ?
        LIMIT 1
      `).bind(r.agency_id, `seller:${r.seller_id}`, dedupCutoff).first().catch(() => null);

      if (recent) continue;

      const reasons: string[] = [];
      if (noLive) reasons.push(`${NO_LIVE_DAYS}일 무라이브`);
      if (noRevenue) reasons.push(`${NO_REVENUE_DAYS}일 무매출`);

      await DB.prepare(`
        INSERT INTO agency_notifications (agency_id, type, title, message, link)
        VALUES (?, 'inactive_seller', ?, ?, ?)
      `).bind(
        r.agency_id,
        `⚠️ 부진 셀러: ${r.seller_name || `#${r.seller_id}`}`,
        `${reasons.join(' + ')} — 연락 권장 (마지막 라이브: ${r.last_live_at?.slice(0, 10) || '없음'}, 마지막 매출: ${r.last_paid_at?.slice(0, 10) || '없음'})`,
        `seller:${r.seller_id}`
      ).run().catch(swallow('worker:cron:agency-inactive-sellers'));

      // 🛡️ 2026-04-27: 셀러 본인에게도 알림 (부드러운 활동 유도)
      // 7일 무라이브일 때만 (30일 무매출은 셀러가 알아서 — 압박 안 줌)
      if (noLive) {
        // 🛡️ 2026-05-17: dashboard_notifications 스키마는 (recipient_type, recipient_id, ...)
        //   이전 코드는 user_type/user_id 사용 → 컬럼 없어 silent fail.
        await DB.prepare(`
          INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link, created_at)
          VALUES ('seller', ?, 'inactivity_reminder', ?, ?, '/seller/streams', datetime('now'))
        `).bind(
          String(r.seller_id),
          `라이브 시작 권장 안내 🎥`,
          `최근 7일간 라이브가 없으셨네요. 라이브를 다시 시작하면 시청자/매출 회복에 효과적입니다. 부담 없이 짧게 시작해보세요!`,
        ).run().catch(swallow('worker:cron:agency-inactive-sellers'));
      }

      notified++;
    }
  } catch (err) {
    console.error('[cron:agency-inactive-sellers] FAILED:', err);
  }

  console.info(`[cron:agency-inactive-sellers] detected=${detected} notified=${notified}`);
}
