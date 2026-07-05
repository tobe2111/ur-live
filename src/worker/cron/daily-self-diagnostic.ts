/**
 * Daily Self-Diagnostic Cron
 *
 * 매일 새벽 3시에 실행 (wrangler.toml 의 cron: '0 18 * * *' UTC = 3AM KST)
 * - DB latency 확인
 * - Secret 존재 확인
 * - 최근 24h 에러/느린 쿼리 통계 수집
 * - 전날 주문/결제 건수 요약
 * - 문제 발견 시 Discord 로 알림
 *
 * 1인 운영자가 자는 동안 시스템이 자동으로 자기 진단 → 이상 발견 시에만 깨움.
 */

import { sendDiscordAlert } from '../utils/discord-alert';
import type { Env } from '../types/env';

export async function runDailySelfDiagnostic(env: Env) {
  const DB = env.DB;
  const webhookUrl = env.DISCORD_WEBHOOK_URL;
  if (!DB) {
    console.error('[daily-diagnostic] No DB binding');
    return;
  }

  const issues: string[] = [];
  const info: string[] = [];

  // 1. DB latency
  try {
    const t0 = Date.now();
    await DB.prepare('SELECT 1').first();
    const latency = Date.now() - t0;
    if (latency > 500) issues.push(`⚠️ DB latency 느림: ${latency}ms (임계 500ms)`);
    else info.push(`DB latency: ${latency}ms`);
  } catch (err) {
    issues.push(`🔴 DB 연결 실패: ${(err as Error).message}`);
  }

  // 2. Secret 존재
  const requiredSecrets = [
    'JWT_SECRET', 'REFRESH_TOKEN_SECRET', 'KAKAO_REST_API_KEY',
    'FIREBASE_PRIVATE_KEY', 'TOSS_SECRET_KEY',
  ];
  const missing = requiredSecrets.filter((k) => !(env as unknown as Record<string, unknown>)[k]);
  if (missing.length > 0) issues.push(`🔴 누락된 Secret: ${missing.join(', ')}`);

  // 3. 전날 주문/결제
  try {
    const row = await DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN payment_status = 'approved' THEN 1 ELSE 0 END) as paid,
        SUM(CASE WHEN payment_status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM orders
      WHERE created_at >= datetime('now', '-24 hours')
    `).first<{ total: number; paid: number; failed: number }>();
    if (row) {
      info.push(`전날 주문: 전체 ${row.total}, 결제완료 ${row.paid}, 실패 ${row.failed}`);
      // 실패율 5% 이상이면 이슈
      if (row.total > 10 && row.failed / row.total > 0.05) {
        issues.push(`⚠️ 결제 실패율 높음: ${Math.round((row.failed / row.total) * 100)}%`);
      }
    }
  } catch {}

  // 4. 최근 5xx spike
  try {
    const row = await DB.prepare(
      "SELECT COUNT(*) as c FROM rate_limit_attempts WHERE action='5xx_spike' AND window_start >= ?"
    ).bind(Math.floor(Date.now() / 1000) - 86400).first<{ c: number }>();
    if (row && row.c > 0) issues.push(`⚠️ 5xx spike ${row.c}건 발생 (24h)`);
  } catch {}

  // 5. Slow query
  try {
    const row = await DB.prepare(`
      SELECT COUNT(*) as c, MAX(duration_ms) as max_ms
      FROM slow_queries
      WHERE logged_at >= datetime('now', '-24 hours')
    `).first<{ c: number; max_ms: number }>();
    if (row && row.c > 0) {
      info.push(`슬로우 쿼리: ${row.c}건 (최대 ${row.max_ms}ms)`);
      if (row.c > 100) issues.push(`⚠️ 슬로우 쿼리 많음: ${row.c}건`);
    }
  } catch {}

  // 🛡️ 2026-04-27 (TD-009): Webhook 실패 24h 요약
  try {
    const row = await DB.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN retry_count >= 3 THEN 1 ELSE 0 END) as fatal
      FROM webhook_events
      WHERE status = 'FAILED'
        AND created_at >= datetime('now', '-24 hours')
    `).first<{ total: number; fatal: number }>();
    if (row && row.total > 0) {
      info.push(`Webhook 실패 24h: ${row.total}건 (FATAL ${row.fatal}건)`);
      if (row.fatal > 0) issues.push(`🔴 Webhook FATAL ${row.fatal}건 — 운영 검토 필요`);
      else if (row.total > 10) issues.push(`⚠️ Webhook 실패 ${row.total}건 — 평소보다 많음`);
    }
  } catch {}

  // 🫀 2026-07-05: 핵심 cron 침묵 감지 — heartbeat 가 허용 간격을 넘긴 cron 표시.
  //   ⚠️ 이 진단 자체가 cron 이라 cron 전면 사망은 외부 uptime.yml(/api/_healthcheck/cron)이 잡음.
  //   여기서는 "일부 cron 만 조용히 안 도는" 부분 침묵(스케줄 누락/특정 트리거 drift)을 커버.
  try {
    const { getCronHealth } = await import('../utils/cron-heartbeat');
    const health = await getCronHealth(DB);
    if (health.stale.length > 0) {
      for (const s of health.stale) {
        const when = s.age_min != null ? `마지막 실행 ${s.age_min}분 전` : '실행 기록 없음 (트리거 누락 의심)';
        issues.push(`🔴 Cron 침묵: ${s.label} (${s.name}) — ${when} (허용 ${s.max_gap_min}분)`);
      }
    } else if (!health.bootstrapping) {
      info.push(`Cron heartbeat: 핵심 ${health.missing.length > 0 ? `정상 (기록 대기 ${health.missing.length}건)` : '전체 정상'}`);
    }
  } catch {}

  // 🖥️ 2026-07-05: 프론트(브라우저) 에러 24h 집계 — 수집(frontend_errors)은 2026-05-23부터
  //   돌고 있었으나 진단이 안 봐서 "대표가 직접 발견" 의존이 남아있던 마지막 축.
  //   급증 시에만 깨움 + 상시 요약. 상세: /admin/errors
  try {
    // 30일 초과분 프루닝 (best-effort) — 수집 테이블 무한 성장 방지 (인덱스 idx_frontend_errors_created 사용).
    await DB.prepare(`DELETE FROM frontend_errors WHERE created_at < datetime('now', '-30 days')`).run().catch(() => null);
    const row = await DB.prepare(`
      SELECT COUNT(*) as total, COUNT(DISTINCT message) as distinct_msgs
      FROM frontend_errors
      WHERE created_at >= datetime('now', '-24 hours')
    `).first<{ total: number; distinct_msgs: number }>();
    if (row && row.total > 0) {
      info.push(`프론트 에러 24h: ${row.total}건 (고유 ${row.distinct_msgs}종) — /admin/errors`);
      if (row.total > 30) {
        const top = await DB.prepare(`
          SELECT message, COUNT(*) as c FROM frontend_errors
          WHERE created_at >= datetime('now', '-24 hours')
          GROUP BY message ORDER BY c DESC LIMIT 3
        `).all<{ message: string; c: number }>().catch(() => ({ results: [] as Array<{ message: string; c: number }> }));
        const topStr = (top.results || []).map((t) => `${t.c}× ${t.message.slice(0, 80)}`).join(' / ');
        issues.push(`⚠️ 프론트 에러 급증: 24h ${row.total}건 — 상위: ${topStr}`);
      }
    }
  } catch {}

  // 알림 발송
  if (!webhookUrl) {
    // 🛡️ 2026-04-22: webhook 미설정 알림 — 진단 자체 작동 안 함을 운영자가 인지하도록
    console.warn('[Daily Diagnostic] DISCORD_WEBHOOK_URL not configured — diagnostic results not sent');
    return;
  }

  if (issues.length > 0) {
    await sendDiscordAlert(
      webhookUrl,
      '🩺 Daily Health Check — 이슈 발견',
      `발견된 이슈:\n${issues.map((i) => `- ${i}`).join('\n')}\n\n정상:\n${info.map((i) => `- ${i}`).join('\n')}\n\n대시보드: /api/_internal/health-dashboard`,
      'warn'
    );
  } else {
    await sendDiscordAlert(
      webhookUrl,
      '✅ Daily Health Check — 모두 정상',
      info.map((i) => `- ${i}`).join('\n'),
      'info'
    );
  }
}
