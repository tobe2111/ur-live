/**
 * Agency ↔ Seller Auto-Match Cron (2026-05-05)
 *
 * Migration 0245 적용 후 동작. 매일 18시 배치에 포함.
 *
 * 대상:
 *   - 가입 60일 이내이고 어느 에이전시에도 소속되지 않은 셀러
 *   - 이미 pending/accepted 제안이 존재하는 셀러는 제외
 *
 * 매칭 스코어 (100점 만점):
 *   40pt  에이전시 티어   (senior=40, junior=25, new=10)
 *   30pt  여유 용량       max(0, 30 × (1 - currentSellers / softCap))  softCap=30
 *   20pt  최근 활성도     최근 30일 GMV가 있는 소속 셀러 비율 × 20
 *   10pt  신규 환영 보너스 최근 90일 내 신규 셀러 수락 이력 × 2 (최대 10)
 *
 * 결과:
 *   - agency_match_suggestions INSERT (30일 만료)
 *   - 에이전시 → dashboard_notification (수락/거절 링크 포함)
 *   - 셀러     → dashboard_notification (매칭 제안 안내)
 *   - 만료 처리: 30일 지난 pending → expired (멱등)
 */

import type { Env } from '../types/env';
import { swallow } from '../utils/swallow';

const SOFT_CAP = 30;       // 에이전시당 권장 최대 셀러 수
const NEW_SELLER_DAYS = 60; // 가입 N일 이내를 '신규'로 간주

interface AgencyCandidate {
  id: number;
  name: string;
  tier: string;
  current_sellers: number;
  active_sellers_30d: number;
  recent_accepts: number;
}

interface UnmatchedSeller {
  id: number;
  name: string;
  business_name: string;
  created_at: string;
}

function calcMatchScore(agency: AgencyCandidate): { score: number; reason: Record<string, number> } {
  const tierScore = agency.tier === 'senior' ? 40 : agency.tier === 'junior' ? 25 : 10;
  const capacityScore = Math.max(0, 30 * (1 - agency.current_sellers / SOFT_CAP));
  const activityRatio = agency.current_sellers > 0
    ? agency.active_sellers_30d / agency.current_sellers
    : 0;
  const activityScore = Math.round(activityRatio * 20);
  const acceptScore = Math.min(10, agency.recent_accepts * 2);

  const score = Math.round(tierScore + capacityScore + activityScore + acceptScore);
  return {
    score,
    reason: { tierScore, capacityScore, activityScore, acceptScore },
  };
}

async function expireStaleSuggestions(DB: D1Database): Promise<void> {
  await DB.prepare(`
    UPDATE agency_match_suggestions
       SET status = 'expired'
     WHERE status = 'pending' AND expires_at < datetime('now')
  `).run().catch(swallow('cron:agency-seller-match:expire'));
}

async function fetchUnmatchedSellers(DB: D1Database): Promise<UnmatchedSeller[]> {
  const since = new Date(Date.now() - NEW_SELLER_DAYS * 86400_000).toISOString();

  const rows = await DB.prepare(`
    SELECT s.id, s.name, s.business_name, s.created_at
    FROM sellers s
    WHERE s.is_active = 1
      AND s.created_at >= ?
      AND s.id NOT IN (SELECT seller_id FROM agency_sellers)
      AND s.id NOT IN (
        SELECT seller_id FROM agency_match_suggestions
        WHERE status IN ('pending', 'accepted')
      )
    ORDER BY s.created_at DESC
    LIMIT 100
  `).bind(since).all<UnmatchedSeller>().catch(() => null);

  return rows?.results ?? [];
}

async function fetchAgencyCandidates(DB: D1Database): Promise<AgencyCandidate[]> {
  const since30d = new Date(Date.now() - 30 * 86400_000).toISOString();
  const since90d = new Date(Date.now() - 90 * 86400_000).toISOString();

  const rows = await DB.prepare(`
    SELECT
      a.id,
      a.name,
      COALESCE(a.tier, 'new') AS tier,
      COUNT(DISTINCT ags.seller_id) AS current_sellers,
      COUNT(DISTINCT CASE
        WHEN EXISTS (
          SELECT 1 FROM orders o
          WHERE o.seller_id = ags.seller_id
            AND o.payment_status = 'approved'
            AND o.created_at >= ?
        ) THEN ags.seller_id
        ELSE NULL
      END) AS active_sellers_30d,
      COUNT(DISTINCT CASE
        WHEN ams.status = 'accepted' AND ams.responded_at >= ?
        THEN ams.id ELSE NULL
      END) AS recent_accepts
    FROM agencies a
    LEFT JOIN agency_sellers ags ON ags.agency_id = a.id
    LEFT JOIN agency_match_suggestions ams ON ams.agency_id = a.id
    WHERE a.status = 'active'
    GROUP BY a.id
  `).bind(since30d, since90d).all<AgencyCandidate>().catch(() => null);

  return rows?.results ?? [];
}

export async function handleAgencySellerMatch(env: Env): Promise<void> {
  const DB = env.DB;
  if (!DB) return;

  // 만료 처리 먼저
  await expireStaleSuggestions(DB);

  const sellers = await fetchUnmatchedSellers(DB);
  if (sellers.length === 0) return;

  const agencies = await fetchAgencyCandidates(DB);
  if (agencies.length === 0) return;

  // 각 에이전시 점수 계산 (전체 동일하므로 사전 계산)
  const scored = agencies
    .map(a => ({ agency: a, ...calcMatchScore(a) }))
    .filter(a => a.score >= 10)           // 최소 10점 이상만
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return;

  let matched = 0;

  for (const seller of sellers) {
    // 이 셀러에게 아직 제안하지 않은 최고 점수 에이전시 선택
    const best = scored[0]; // 모든 셀러에게 현재 순위 기준으로 동일 배정 (round-robin도 가능하나 단순화)

    const expiresAt = new Date(Date.now() + 30 * 86400_000).toISOString();

    try {
      await DB.prepare(`
        INSERT OR IGNORE INTO agency_match_suggestions
          (seller_id, agency_id, score, match_reason, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        seller.id,
        best.agency.id,
        best.score,
        JSON.stringify(best.reason),
        expiresAt,
      ).run();

      // 에이전시 알림 (수락/거절 링크)
      await DB.prepare(`
        INSERT INTO dashboard_notifications
          (recipient_type, recipient_id, type, title, message, link, created_at)
        VALUES ('agency', ?, 'seller_match', ?, ?, '/agency/match-suggestions', datetime('now'))
      `).bind(
        String(best.agency.id),
        `새 셀러 매칭 제안: ${seller.business_name || seller.name}`,
        `신규 셀러 ${seller.business_name || seller.name}(가입 ${Math.floor((Date.now() - new Date(seller.created_at).getTime()) / 86400_000)}일차)와 매칭이 제안되었습니다. ` +
        `매칭 점수: ${best.score}점. /agency/match-suggestions 에서 수락하거나 거절하세요.`,
      ).run().catch(swallow('cron:agency-seller-match:notif-agency'));

      // 셀러 알림
      await DB.prepare(`
        INSERT INTO dashboard_notifications
          (recipient_type, recipient_id, type, title, message, link, created_at)
        VALUES ('seller', ?, 'agency_match', ?, ?, '/seller/agency', datetime('now'))
      `).bind(
        String(seller.id),
        `에이전시 매칭 제안이 도착했습니다 🎉`,
        `${best.agency.name} 에이전시에서 여러분의 성장을 돕고 싶어 합니다. ` +
        `에이전시가 수락하면 더 많은 지원을 받을 수 있습니다.`,
      ).run().catch(swallow('cron:agency-seller-match:notif-seller'));

      matched++;
    } catch (err) {
      console.error(`[cron:agency-seller-match] seller=${seller.id}:`, err);
    }
  }

  console.info(`[cron:agency-seller-match] sellers=${sellers.length} matched=${matched}`);
}
