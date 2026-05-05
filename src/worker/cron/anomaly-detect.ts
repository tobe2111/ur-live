/**
 * Anomaly Detection — z-score 기반 어뷰징 / 이상치 자동 탐지 (2026-05-05)
 *
 * 매시간 실행 (cron). 각 셀러별로:
 *   1. baseline (최근 30일 평균/표준편차) 계산 → seller_baseline_stats 갱신
 *   2. 최근 1시간 통계 vs baseline 비교 → z-score 계산
 *   3. 의심 패턴은 abuse_detections 에 적재 + admin 알림
 *
 * 패턴:
 *   A. 후원 폭증 (z > 3): 갑자기 평소보다 3σ 이상 후원
 *   B. 같은 buyer 24h 내 ≥3건 후원 (셀러 부풀리기 의심)
 *   C. 신규 가입자 (account < 1일) 의 큰 금액 후원 ≥50%
 *   D. 동일 IP 24h ≥5명 가입
 */

import type { Env } from '../types/env';
import { swallow } from '../utils/swallow';

const SINCE_30D = () => new Date(Date.now() - 30 * 86400_000).toISOString();
const SINCE_1H = () => new Date(Date.now() - 3600_000).toISOString();
const SINCE_24H = () => new Date(Date.now() - 24 * 3600_000).toISOString();

interface BaselineStats {
  avg: number;
  std: number;
}

function calcStdDev(values: number[]): { avg: number; std: number } {
  if (values.length === 0) return { avg: 0, std: 0 };
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / values.length;
  return { avg, std: Math.sqrt(variance) };
}

async function flagAbuse(
  DB: D1Database,
  pattern: string,
  evidence: Record<string, unknown>,
  severity: 'low' | 'medium' | 'high',
  userId?: string,
  refType?: string,
  refId?: string,
): Promise<void> {
  await DB.prepare(`
    INSERT INTO abuse_detections (pattern, user_id, ref_type, ref_id, evidence, severity)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    pattern, userId || null, refType || null, refId || null,
    JSON.stringify(evidence), severity
  ).run().catch(swallow('worker:cron:anomaly-detect:flag'));

  // high severity → admin dashboard alert
  if (severity === 'high') {
    await DB.prepare(`
      INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link)
      VALUES ('admin', NULL, 'abuse_detected', ?, ?, '/admin/abuse')
    `).bind(
      `🚨 어뷰징 의심: ${pattern}`,
      `severity=high. ref=${refType}:${refId} user=${userId || '-'}. 즉시 검토 필요.`
    ).run().catch(swallow('worker:cron:anomaly-detect:notif'));
  }
}

async function refreshBaseline(DB: D1Database, sellerId: number): Promise<BaselineStats> {
  const since = SINCE_30D();
  const donations = await DB.prepare(`
    SELECT amount FROM donations
    WHERE seller_id = ? AND payment_status = 'approved' AND created_at >= ?
  `).bind(sellerId, since).all<{ amount: number }>().catch(() => null);

  const amounts = donations?.results?.map(r => Number(r.amount || 0)) || [];
  const { avg, std } = calcStdDev(amounts);

  await DB.prepare(`
    INSERT INTO seller_baseline_stats (seller_id, avg_donation_amount, std_donation_amount, donation_count_30d, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(seller_id) DO UPDATE SET
      avg_donation_amount = excluded.avg_donation_amount,
      std_donation_amount = excluded.std_donation_amount,
      donation_count_30d  = excluded.donation_count_30d,
      updated_at          = datetime('now')
  `).bind(sellerId, avg, std, amounts.length).run().catch(swallow('worker:cron:anomaly-detect:baseline'));

  return { avg, std };
}

// Pattern A: 후원 폭증 (최근 1시간 평균 vs baseline z-score)
async function detectDonationSpike(DB: D1Database, sellerId: number, baseline: BaselineStats): Promise<void> {
  if (baseline.std < 100) return; // 데이터 부족 — 평가 불가

  const recent = await DB.prepare(`
    SELECT amount FROM donations
    WHERE seller_id = ? AND payment_status = 'approved' AND created_at >= ?
  `).bind(sellerId, SINCE_1H()).all<{ amount: number }>().catch(() => null);

  if (!recent?.results || recent.results.length < 3) return;

  const recentAvg = recent.results.reduce((s, r) => s + Number(r.amount || 0), 0) / recent.results.length;
  const z = (recentAvg - baseline.avg) / baseline.std;

  if (z > 3) {
    await flagAbuse(DB, 'donation_spike', {
      sellerId, recentAvg, baselineAvg: baseline.avg, baselineStd: baseline.std, zScore: z, count: recent.results.length
    }, z > 5 ? 'high' : 'medium', undefined, 'seller', String(sellerId));
  }
}

// Pattern B: 같은 buyer 24h ≥3건 후원 (셀러 부풀리기 의심)
async function detectRepeatDonors(DB: D1Database, sellerId: number): Promise<void> {
  const repeats = await DB.prepare(`
    SELECT donor_user_id, COUNT(*) AS cnt, SUM(amount) AS total
    FROM donations
    WHERE seller_id = ? AND payment_status = 'approved' AND created_at >= ?
    GROUP BY donor_user_id
    HAVING cnt >= 3
  `).bind(sellerId, SINCE_24H()).all<{ donor_user_id: string; cnt: number; total: number }>().catch(() => null);

  for (const r of repeats?.results || []) {
    const severity = r.cnt >= 10 ? 'high' : r.cnt >= 5 ? 'medium' : 'low';
    await flagAbuse(DB, 'repeat_donor_24h', {
      sellerId, donorId: r.donor_user_id, count: r.cnt, total: r.total
    }, severity, r.donor_user_id, 'seller', String(sellerId));
  }
}

// Pattern C: 신규 가입자 (account < 1일) 의 큰 금액 후원 비율 ≥50%
async function detectNewAccountDonations(DB: D1Database, sellerId: number): Promise<void> {
  const stats = await DB.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN julianday(d.created_at) - julianday(u.created_at) < 1 THEN 1 ELSE 0 END) AS new_account_count,
      SUM(CASE WHEN julianday(d.created_at) - julianday(u.created_at) < 1 THEN d.amount ELSE 0 END) AS new_account_amount,
      SUM(d.amount) AS total_amount
    FROM donations d
    LEFT JOIN users u ON u.id = d.donor_user_id
    WHERE d.seller_id = ? AND d.payment_status = 'approved' AND d.created_at >= ?
  `).bind(sellerId, SINCE_24H()).first<{
    total: number; new_account_count: number; new_account_amount: number; total_amount: number;
  }>().catch(() => null);

  if (!stats || (stats.total ?? 0) < 5) return;
  const ratio = stats.new_account_amount / Math.max(1, stats.total_amount);
  if (ratio >= 0.5) {
    await flagAbuse(DB, 'new_account_donation_pattern', {
      sellerId, ratio, ...stats
    }, ratio >= 0.8 ? 'high' : 'medium', undefined, 'seller', String(sellerId));
  }
}

// Pattern D: 동일 IP 24h ≥5명 가입 (시스템 전역)
async function detectRapidSignupsSameIp(DB: D1Database): Promise<void> {
  // users 테이블에 registration_ip 컬럼이 있을 때만 작동 (없으면 skip)
  const rows = await DB.prepare(`
    SELECT registration_ip AS ip, COUNT(*) AS cnt
    FROM users
    WHERE registration_ip IS NOT NULL AND registration_ip != ''
      AND created_at >= ?
    GROUP BY registration_ip
    HAVING cnt >= 5
  `).bind(SINCE_24H()).all<{ ip: string; cnt: number }>().catch(() => null);

  for (const r of rows?.results || []) {
    const severity = r.cnt >= 20 ? 'high' : r.cnt >= 10 ? 'medium' : 'low';
    await flagAbuse(DB, 'rapid_signups_same_ip', {
      ip: r.ip, count: r.cnt, windowHours: 24
    }, severity);
  }
}

export async function handleAnomalyDetection(env: Env): Promise<void> {
  const DB = env.DB;
  if (!DB) return;

  // 활성 셀러 (최근 30일 후원/주문 1건 이상)
  const activeSellers = await DB.prepare(`
    SELECT DISTINCT seller_id FROM donations
    WHERE payment_status = 'approved' AND created_at >= ?
    UNION
    SELECT DISTINCT seller_id FROM orders
    WHERE payment_status = 'approved' AND created_at >= ?
  `).bind(SINCE_30D(), SINCE_30D()).all<{ seller_id: number }>().catch(() => null);

  let processed = 0;
  for (const { seller_id } of activeSellers?.results || []) {
    if (!seller_id) continue;
    try {
      const baseline = await refreshBaseline(DB, seller_id);
      await detectDonationSpike(DB, seller_id, baseline);
      await detectRepeatDonors(DB, seller_id);
      await detectNewAccountDonations(DB, seller_id);
      processed++;
    } catch (err) {
      console.error(`[cron:anomaly-detect] seller ${seller_id}:`, err);
    }
  }

  // 전역 IP 패턴
  await detectRapidSignupsSameIp(DB).catch(() => {});

  console.info(`[cron:anomaly-detect] processed=${processed}`);
}
