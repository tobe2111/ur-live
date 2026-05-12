/**
 * Seller Daily Report — 셀러 일일 보고서 메일
 *
 * 매일 18UTC batch 합류 (KST 03:00 — 한국에선 새벽이라 다음날 아침 확인).
 *
 * 처리:
 *   1) sellers.daily_report_enabled = 1 인 셀러 조회
 *   2) 어제 (00:00~23:59 KST) 매출/주문/라이브/시청자 요약
 *   3) Resend 이메일 발송 (RESEND_API_KEY 있을 때만)
 *
 * 사용자가 수신 거부 가능 (sellers.daily_report_enabled 컬럼 토글).
 *
 * 마이그레이션: sellers.daily_report_enabled 컬럼 (idempotent ALTER).
 */

import type { Env } from '../types/env';

import { swallow } from '../utils/swallow';
interface SellerRow {
  id: number;
  business_name: string | null;
  email: string;
}

function buildReportHTML(opts: {
  sellerName: string;
  yesterdayDate: string;
  revenue: number;
  orderCount: number;
  liveCount: number;
  totalViewers: number;
  newReviews: number;
  avgRating: number;
}) {
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><title>${opts.sellerName} 일일 리포트</title></head>
<body style="font-family: -apple-system, sans-serif; background: #f9fafb; padding: 24px; color: #111827;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #3b82f6, #06b6d4); padding: 24px; color: white;">
      <h1 style="margin: 0; font-size: 20px;">📊 ${opts.yesterdayDate} 일일 리포트</h1>
      <p style="margin: 4px 0 0; opacity: 0.9;">${opts.sellerName}</p>
    </div>
    <div style="padding: 20px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        ${stat('💰 매출', `${(opts.revenue / 10_000).toFixed(0)}만원`)}
        ${stat('📦 주문', `${opts.orderCount}건`)}
        ${stat('🎥 라이브', `${opts.liveCount}회`)}
        ${stat('👥 시청자', `${Number(opts.totalViewers ?? 0).toLocaleString('ko-KR')}명`)}
        ${stat('⭐ 새 리뷰', `${opts.newReviews}건`)}
        ${stat('★ 평균 별점', opts.avgRating.toFixed(1))}
      </div>
      <div style="margin-top: 20px; padding: 14px; background: #fef3c7; border-radius: 10px; font-size: 12px; color: #92400e;">
        💡 <strong>오늘의 추천</strong>:
        ${opts.liveCount === 0 ? '어제 라이브가 없었어요. 오늘 짧게라도 시작해보세요!' :
          opts.revenue === 0 ? '시청자가 있는데 매출 0건. 가격/혜택 점검 권장.' :
          '꾸준한 활동 감사합니다 🎉'}
      </div>
      <div style="margin-top: 20px; text-align: center;">
        <a href="https://live.ur-team.com/seller" style="display: inline-block; padding: 10px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">대시보드 →</a>
      </div>
    </div>
    <div style="padding: 12px; background: #f9fafb; text-align: center; font-size: 10px; color: #9ca3af;">
      유어딜 일일 리포트 ·
      <a href="https://live.ur-team.com/seller/settings" style="color: #6b7280;">수신 거부</a>
    </div>
  </div>
</body>
</html>`;
}

function stat(label: string, value: string): string {
  return `<div style="background: #f9fafb; padding: 12px; border-radius: 10px;">
    <div style="font-size: 11px; color: #6b7280;">${label}</div>
    <div style="font-size: 18px; font-weight: bold; margin-top: 4px;">${value}</div>
  </div>`;
}

export async function handleSellerDailyReport(env: Env): Promise<void> {
  const DB = env.DB;
  if (!DB) return;

  const resendKey = (env as Env & { RESEND_API_KEY?: string }).RESEND_API_KEY;
  if (!resendKey) {
    console.info('[cron:seller-daily-report] RESEND_API_KEY 미설정 — skip');
    return;
  }

  // sellers.daily_report_enabled 컬럼 보장 (idempotent)
  await DB.prepare(`ALTER TABLE sellers ADD COLUMN daily_report_enabled INTEGER DEFAULT 0`).run().catch(swallow('worker:cron:seller-daily-report'));

  // 수신 활성화한 셀러만
  const sellers = await DB.prepare(`
    SELECT id, business_name, email
    FROM sellers
    WHERE status = 'active' AND daily_report_enabled = 1
    LIMIT 1000
  `).all<SellerRow>().catch(() => ({ results: [] as SellerRow[] }));

  if (!sellers.results?.length) {
    console.info('[cron:seller-daily-report] enabled sellers: 0');
    return;
  }

  // 어제 KST 00:00 ~ 23:59 → UTC 로 환산 (KST = UTC+9)
  // 어제 KST 시작 = 2일 전 UTC 15:00
  const now = new Date();
  const yesterdayKstStart = new Date(now.getTime() - 86400_000);
  yesterdayKstStart.setUTCHours(15, 0, 0, 0); // 어제 KST 00:00 = 어제 UTC 15:00 (= 그저께 UTC 15:00)
  yesterdayKstStart.setUTCDate(yesterdayKstStart.getUTCDate() - 1);
  const yesterdayKstEnd = new Date(yesterdayKstStart.getTime() + 86399_000);
  const yesterdayDate = `${yesterdayKstStart.getUTCFullYear()}-${String(yesterdayKstStart.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterdayKstStart.getUTCDate() + 1).padStart(2, '0')}`;

  let sent = 0;
  let failed = 0;

  const start = yesterdayKstStart.toISOString();
  const end = yesterdayKstEnd.toISOString();

  // ✅ PERF: 셀러별 3개 쿼리 (revenue/lives/reviews) → IN clause + GROUP BY 단일 query 3개 (총 3 쿼리만 실행).
  // 100명 셀러 × 3 = 300 쿼리 → 3 쿼리. (chunk size 100 으로 IN 절 보호)
  type RevAgg = { seller_id: number; cnt: number; rev: number };
  type LiveAgg = { seller_id: number; cnt: number; viewers: number };
  type ReviewAgg = { seller_id: number; cnt: number; avg_r: number };
  const revMap = new Map<number, { cnt: number; rev: number }>();
  const liveMap = new Map<number, { cnt: number; viewers: number }>();
  const reviewMap = new Map<number, { cnt: number; avg_r: number }>();

  const sellerIds = sellers.results.map(s => s.id);
  const CHUNK = 100;
  for (let i = 0; i < sellerIds.length; i += CHUNK) {
    const chunk = sellerIds.slice(i, i + CHUNK);
    const ph = chunk.map(() => '?').join(',');
    try {
      const { results } = await DB.prepare(`
        SELECT seller_id, COUNT(*) AS cnt, COALESCE(SUM(total_amount), 0) AS rev
        FROM orders WHERE seller_id IN (${ph}) AND payment_status = 'approved'
          AND created_at >= ? AND created_at <= ?
        GROUP BY seller_id
      `).bind(...chunk, start, end).all<RevAgg>();
      for (const r of results ?? []) revMap.set(r.seller_id, { cnt: r.cnt, rev: r.rev });
    } catch { /* best-effort */ }
    try {
      const { results } = await DB.prepare(`
        SELECT seller_id, COUNT(*) AS cnt, COALESCE(SUM(peak_viewers), 0) AS viewers
        FROM live_streams WHERE seller_id IN (${ph})
          AND created_at >= ? AND created_at <= ?
        GROUP BY seller_id
      `).bind(...chunk, start, end).all<LiveAgg>();
      for (const r of results ?? []) liveMap.set(r.seller_id, { cnt: r.cnt, viewers: r.viewers });
    } catch { /* best-effort */ }
    try {
      const { results } = await DB.prepare(`
        SELECT p.seller_id AS seller_id, COUNT(*) AS cnt, COALESCE(AVG(pr.rating), 0) AS avg_r
        FROM product_reviews pr
        JOIN products p ON p.id = pr.product_id
        WHERE p.seller_id IN (${ph})
          AND pr.created_at >= ? AND pr.created_at <= ?
        GROUP BY p.seller_id
      `).bind(...chunk, start, end).all<ReviewAgg>();
      for (const r of results ?? []) reviewMap.set(r.seller_id, { cnt: r.cnt, avg_r: r.avg_r });
    } catch { /* best-effort */ }
  }

  for (const s of sellers.results) {
    try {
      const rev = revMap.get(s.id) ?? null;
      const lives = liveMap.get(s.id) ?? null;
      const reviews = reviewMap.get(s.id) ?? null;

      // 활동 0 인 셀러는 메일 skip (스팸 방지)
      const totalActivity = (rev?.cnt ?? 0) + (lives?.cnt ?? 0) + (reviews?.cnt ?? 0);
      if (totalActivity === 0) continue;

      const html = buildReportHTML({
        sellerName: s.business_name || '셀러',
        yesterdayDate,
        revenue: rev?.rev ?? 0,
        orderCount: rev?.cnt ?? 0,
        liveCount: lives?.cnt ?? 0,
        totalViewers: lives?.viewers ?? 0,
        newReviews: reviews?.cnt ?? 0,
        avgRating: reviews?.avg_r ?? 0,
      });

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: (env as any).RESEND_FROM || 'noreply@ur-team.com',
          to: s.email,
          subject: `[유어딜] ${s.business_name || '셀러'} ${yesterdayDate} 일일 리포트`,
          html,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) sent++;
      else failed++;
    } catch (err) {
      console.error(`[cron:seller-daily-report] ${s.id} failed:`, err);
      failed++;
    }
  }

  console.info(`[cron:seller-daily-report] sent=${sent} failed=${failed}`);
}
