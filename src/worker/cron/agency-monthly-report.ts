/**
 * 에이전시 자동 월간 리포트 — Phase 2-6
 *
 * 매월 1일 KST 09:00 (= 월요일 weekly batch) 실행. 멱등.
 *
 * 처리:
 *   1) 모든 활성 에이전시 순회
 *   2) 전월 KPI 집계 (매출/활성 셀러/신규 셀러/등급 변화)
 *   3) HTML 리포트 생성
 *   4) 에이전시 owner 이메일로 발송 (RESEND_API_KEY 있을 때)
 *   5) agency_notifications 에 알림 추가 (대시보드용)
 *
 * 마이그레이션 미적용 또는 RESEND 미설정 시 graceful skip.
 */

import type { Env } from '../types/env';

interface AgencyRow {
  id: number;
  name: string;
  email: string;
  tier: string;
}

function buildReportHTML(opts: {
  agencyName: string;
  monthStr: string;
  prevMonthRevenue: number;
  prevPrevMonthRevenue: number;
  activeSellers: number;
  newSellers: number;
  inactiveSellers: number;
  totalSellers: number;
  tier: string;
}) {
  const growth = opts.prevPrevMonthRevenue > 0
    ? ((opts.prevMonthRevenue - opts.prevPrevMonthRevenue) / opts.prevPrevMonthRevenue) * 100
    : 0;
  const growthSign = growth >= 0 ? '+' : '';
  const growthColor = growth >= 0 ? '#10b981' : '#ef4444';

  const tierLabel = opts.tier === 'senior' ? '골드' : opts.tier === 'junior' ? '실버' : '브론즈';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${opts.agencyName} ${opts.monthStr} 월간 리포트</title>
</head>
<body style="font-family: -apple-system, sans-serif; background: #f9fafb; padding: 24px; color: #111827;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <div style="background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); padding: 32px; color: white;">
      <h1 style="margin: 0; font-size: 24px; font-weight: bold;">📊 ${opts.monthStr} 월간 리포트</h1>
      <p style="margin: 8px 0 0; opacity: 0.9;">${opts.agencyName} · 등급 ${tierLabel}</p>
    </div>
    <div style="padding: 24px;">
      <h2 style="font-size: 14px; color: #6b7280; margin: 0 0 12px;">💰 매출</h2>
      <div style="background: #f9fafb; padding: 16px; border-radius: 12px; margin-bottom: 16px;">
        <div style="font-size: 28px; font-weight: bold;">${(opts.prevMonthRevenue / 10_000).toFixed(0)}만 딜</div>
        <div style="margin-top: 4px; color: ${growthColor}; font-size: 13px;">
          전월 대비 ${growthSign}${growth.toFixed(1)}%
        </div>
      </div>

      <h2 style="font-size: 14px; color: #6b7280; margin: 24px 0 12px;">👥 셀러</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px; color: #6b7280;">총 소속 셀러</td><td style="padding: 8px; text-align: right; font-weight: bold;">${opts.totalSellers}명</td></tr>
        <tr><td style="padding: 8px; color: #6b7280;">활성 셀러 (1+ 라이브)</td><td style="padding: 8px; text-align: right; font-weight: bold; color: #10b981;">${opts.activeSellers}명</td></tr>
        <tr><td style="padding: 8px; color: #6b7280;">신규 가입</td><td style="padding: 8px; text-align: right; font-weight: bold; color: #3b82f6;">+${opts.newSellers}명</td></tr>
        <tr><td style="padding: 8px; color: #6b7280;">부진 셀러 (7일+ 미활동)</td><td style="padding: 8px; text-align: right; font-weight: bold; color: #f59e0b;">${opts.inactiveSellers}명</td></tr>
      </table>

      <div style="margin-top: 24px; padding: 16px; background: #fef3c7; border-radius: 12px; font-size: 13px; color: #92400e;">
        💡 <strong>이번 달 추천 액션</strong><br>
        ${opts.inactiveSellers > 0 ? `· 부진 셀러 ${opts.inactiveSellers}명에게 메시지 발송 권장<br>` : ''}
        ${growth < 0 ? '· 매출 감소 — 캠페인 또는 부스터 이벤트 검토<br>' : ''}
        ${opts.newSellers === 0 ? '· 이번 달 신규 가입 0건 — QR 영입 코드 발급 권장<br>' : ''}
        ${opts.tier === 'new' && opts.prevMonthRevenue > 1_000_000 ? '· 다음 등급 (실버) 가까워졌습니다. 활성 셀러 5명+ 도전 권장<br>' : ''}
      </div>

      <div style="margin-top: 24px; text-align: center;">
        <a href="https://live.ur-team.com/agency" style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">대시보드 열기 →</a>
      </div>
    </div>
    <div style="padding: 16px; background: #f9fafb; text-align: center; font-size: 11px; color: #9ca3af;">
      유어딜 — 라이브 커머스 에이전시 플랫폼
    </div>
  </div>
</body>
</html>`;
}

export async function handleAgencyMonthlyReport(env: Env): Promise<void> {
  const DB = env.DB;
  if (!DB) return;

  const now = new Date();
  // 매월 1일 또는 1주차 월요일 (의도적 멱등 — 한 달에 한 번)
  if (now.getUTCDate() > 7) {
    console.info('[cron:agency-monthly-report] not first week of month, skip');
    return;
  }

  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const prevPrevMonth = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const prevPrevMonthEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59);
  const monthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

  // 멱등 체크 — 이미 이번 달 리포트 보낸 에이전시는 skip
  const sentSet = new Set<number>();
  try {
    const sent = await DB.prepare(`
      SELECT DISTINCT agency_id FROM agency_notifications
      WHERE type = 'monthly_report' AND created_at >= ?
    `).bind(prevMonthEnd.toISOString()).all<{ agency_id: number }>().catch(() => ({ results: [] as any[] }));
    for (const r of sent.results || []) sentSet.add(r.agency_id);
  } catch { /* skip */ }

  const agencies = await DB.prepare(`
    SELECT id, name, email, COALESCE(tier, 'new') AS tier
    FROM agencies WHERE status = 'active'
  `).all<AgencyRow>().catch(() => ({ results: [] as AgencyRow[] }));

  let sent = 0;
  let skipped = 0;

  for (const a of agencies.results || []) {
    if (sentSet.has(a.id)) { skipped++; continue; }

    try {
      // 전월 매출
      const r1 = await DB.prepare(`
        SELECT COALESCE(SUM(o.total_amount), 0) AS rev
        FROM agency_sellers ag_s JOIN orders o ON o.seller_id = ag_s.seller_id
        WHERE ag_s.agency_id = ? AND o.payment_status = 'approved'
          AND o.created_at >= ? AND o.created_at <= ?
      `).bind(a.id, prevMonth.toISOString(), prevMonthEnd.toISOString())
        .first<{ rev: number }>().catch(() => null);

      // 전전월 매출
      const r2 = await DB.prepare(`
        SELECT COALESCE(SUM(o.total_amount), 0) AS rev
        FROM agency_sellers ag_s JOIN orders o ON o.seller_id = ag_s.seller_id
        WHERE ag_s.agency_id = ? AND o.payment_status = 'approved'
          AND o.created_at >= ? AND o.created_at <= ?
      `).bind(a.id, prevPrevMonth.toISOString(), prevPrevMonthEnd.toISOString())
        .first<{ rev: number }>().catch(() => null);

      // 셀러 통계
      const totalRow = await DB.prepare(
        `SELECT COUNT(*) AS cnt FROM agency_sellers WHERE agency_id = ?`
      ).bind(a.id).first<{ cnt: number }>().catch(() => null);

      const activeRow = await DB.prepare(`
        SELECT COUNT(DISTINCT ls.seller_id) AS cnt
        FROM agency_sellers ag_s JOIN live_streams ls ON ls.seller_id = ag_s.seller_id
        WHERE ag_s.agency_id = ?
          AND ls.created_at >= ? AND ls.created_at <= ?
      `).bind(a.id, prevMonth.toISOString(), prevMonthEnd.toISOString())
        .first<{ cnt: number }>().catch(() => null);

      const newRow = await DB.prepare(`
        SELECT COUNT(DISTINCT s.id) AS cnt
        FROM agency_sellers ag_s JOIN sellers s ON s.id = ag_s.seller_id
        WHERE ag_s.agency_id = ? AND s.created_at >= ? AND s.created_at <= ?
      `).bind(a.id, prevMonth.toISOString(), prevMonthEnd.toISOString())
        .first<{ cnt: number }>().catch(() => null);

      const inactiveRow = await DB.prepare(`
        SELECT COUNT(DISTINCT ag_s.seller_id) AS cnt
        FROM agency_sellers ag_s
        LEFT JOIN live_streams ls ON ls.seller_id = ag_s.seller_id
          AND ls.created_at >= datetime('now', '-7 days')
        WHERE ag_s.agency_id = ? AND ls.id IS NULL
      `).bind(a.id).first<{ cnt: number }>().catch(() => null);

      const html = buildReportHTML({
        agencyName: a.name,
        monthStr,
        prevMonthRevenue: r1?.rev ?? 0,
        prevPrevMonthRevenue: r2?.rev ?? 0,
        activeSellers: activeRow?.cnt ?? 0,
        newSellers: newRow?.cnt ?? 0,
        inactiveSellers: inactiveRow?.cnt ?? 0,
        totalSellers: totalRow?.cnt ?? 0,
        tier: a.tier,
      });

      // Resend 메일 발송 (있을 때만)
      const resendKey = (env as Env & { RESEND_API_KEY?: string }).RESEND_API_KEY;
      if (resendKey) {
        try {
          const fetchRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'noreply@ur-team.com',
              to: a.email,
              subject: `[유어딜] ${a.name} ${monthStr} 월간 리포트`,
              html,
            }),
            signal: AbortSignal.timeout(10000),
          });
          if (!fetchRes.ok) {
            console.warn(`[cron:monthly-report] Resend ${fetchRes.status} for agency ${a.id}`);
          }
        } catch (e) {
          console.warn(`[cron:monthly-report] mail send failed for ${a.id}:`, e);
        }
      }

      // 대시보드 알림
      await DB.prepare(`
        INSERT INTO agency_notifications (agency_id, type, title, message, link)
        VALUES (?, 'monthly_report', ?, ?, ?)
      `).bind(
        a.id,
        `📊 ${monthStr} 월간 리포트 도착`,
        `전월 매출: ${((r1?.rev ?? 0) / 10_000).toFixed(0)}만 딜 · 활성 셀러: ${activeRow?.cnt ?? 0}명`,
        `/agency`
      ).run().catch(() => {});

      sent++;
    } catch (err) {
      console.error(`[cron:monthly-report] agency ${a.id} failed:`, err);
    }
  }

  console.info(`[cron:agency-monthly-report] sent=${sent} skipped=${skipped}`);
}
