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
