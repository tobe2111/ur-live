/**
 * Cron Scheduled Handler
 *
 * Wraps all cron triggers defined in `wrangler.toml` `[triggers]` section.
 * Each task runs through `safeCron` which catches errors and pushes Discord
 * alerts when `DISCORD_WEBHOOK_URL` is set.
 *
 * Triggers:
 *   '*\/5 * * * *' — short cleanup (every 5 min)
 *   '0 18 * * *'   — daily heavy tasks (settlement, voucher refund, agency batch)
 *   '0 19 * * *'   — reconciliation
 *   '0 20 * * 0'   — weekly D1 backup
 *   '0 0 * * 1'    — weekly agency batch (auto-settle, incentives, tier-eval, invoices)
 *
 * Extracted from worker/index.ts (TD-006 부분, 2026-04-27).
 */

import type { ScheduledEvent, ExecutionContext } from '@cloudflare/workers-types';
import type { Env } from './types/env';

import { handleScheduled } from './cron/scheduled-cleanup';
import { handleAutoSettlement, handleExpiredVoucherRefunds } from './cron/auto-settlement';
import { runReconciliation } from './cron/reconciliation';
import { runDailySelfDiagnostic } from './cron/daily-self-diagnostic';
import { handleAgencyAutoSettle } from './cron/agency-auto-settle';
import { handleAgencyTierEval } from './cron/agency-tier-eval';
import { handleAgencyCreatorEval } from './cron/agency-creator-eval';
import { handleAgencyMonthlyTasks } from './cron/agency-monthly-tasks';
import { handleAgencyMonthlyInvoices } from './cron/agency-monthly-invoices';
import { handleTikTokVideosSync } from './cron/tiktok-videos-sync';
import { handleAgencyInactiveSellers } from './cron/agency-inactive-sellers';
import { handleLiveStreamMetrics } from './cron/live-stream-metrics';
import { handleAgencyMonthlyReport } from './cron/agency-monthly-report';
import { handlePkBattlesTick } from './cron/pk-battles-tick';
import { handleAgencySelfEventsTick } from './cron/agency-self-events-tick';
import { handleSellerTierEval } from './cron/seller-tier-eval';
import { handleAnomalyDetection } from './cron/anomaly-detect';
import { handleSellerDailyReport } from './cron/seller-daily-report';
import { handleD1Backup } from './cron/d1-backup';
import { recomputeAllActiveCampaigns } from '../features/agency/api/agency-campaigns.routes';
import { calculateAllAgencyIncentives } from '../features/agency/api/agency-incentives.routes';
import { getFeatureFlags } from './utils/feature-flags';

export async function handleCronScheduled(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  const cron = event.cron;

  const safeCron = async (name: string, task: () => Promise<unknown>) => {
    try {
      await task();
    } catch (err) {
      const msg = (err as Error)?.message || String(err);
      console.error(`[cron:${name}] FAILED:`, msg);
      const webhook = (env as Env & { DISCORD_WEBHOOK_URL?: string }).DISCORD_WEBHOOK_URL;
      if (webhook) {
        try {
          const { sendDiscordAlert } = await import('./utils/discord-alert');
          await sendDiscordAlert(webhook, `🔴 Cron Failed: ${name}`, msg.slice(0, 1500), 'error');
        } catch { /* discord 자체 실패는 무시 */ }
      }
    }
  };

  if (cron === '*/5 * * * *') {
    ctx.waitUntil(safeCron('scheduled-cleanup', () => handleScheduled(env)));
    // Phase 2-7: PK 이벤트 매출 집계 + 종료 처리
    ctx.waitUntil(safeCron('pk-battles-tick', () => handlePkBattlesTick(env)));
  }

  // 🛡️ 2026-05-05: 매시간 어뷰징/이상치 탐지 — 후원 폭증, 반복 후원자, 신규 가입 패턴
  if (cron === '0 * * * *') {
    ctx.waitUntil(safeCron('anomaly-detect', () => handleAnomalyDetection(env)));
  }

  if (cron === '0 18 * * *') {
    ctx.waitUntil(safeCron('auto-settlement', () => handleAutoSettlement(env)));
    ctx.waitUntil(safeCron('expired-voucher-refund', () => handleExpiredVoucherRefunds(env)));
    ctx.waitUntil(safeCron('daily-self-diagnostic', () => runDailySelfDiagnostic(env)));
    ctx.waitUntil(safeCron('agency-cron-batch', async () => {
      const flags = await getFeatureFlags((env as any).RATE_LIMIT_KV, env.DB);
      if (flags.enable_agency_campaigns_aggregate) {
        await recomputeAllActiveCampaigns(env.DB).catch(e => console.error('[cron] campaigns:', e));
      }
      if (flags.enable_agency_creator_eval) {
        await handleAgencyCreatorEval(env).catch(e => console.error('[cron] creator-eval:', e));
      }
      if (flags.enable_agency_monthly_tasks) {
        await handleAgencyMonthlyTasks(env).catch(e => console.error('[cron] monthly-tasks:', e));
      }
      if (flags.enable_tiktok_videos_sync) {
        await handleTikTokVideosSync(env).catch(e => console.error('[cron] tiktok:', e));
      }
      // Phase 1-2: 부진 셀러 알림 (매일)
      await handleAgencyInactiveSellers(env).catch(e => console.error('[cron] inactive-sellers:', e));
      // Phase 2-4: 라이브 종료 메트릭 사전 집계 (매일)
      await handleLiveStreamMetrics(env).catch(e => console.error('[cron] live-metrics:', e));
      // 2026-04-27: 자사 이벤트 진행값 자동 갱신 + 보상 지급 (매일)
      await handleAgencySelfEventsTick(env).catch(e => console.error('[cron] self-events:', e));
      // 2026-04-27: 셀러 일일 리포트 메일 (RESEND_API_KEY 있을 때만)
      await handleSellerDailyReport(env).catch(e => console.error('[cron] seller-daily-report:', e));
    }));
  }

  if (cron === '0 19 * * *') {
    ctx.waitUntil(safeCron('reconciliation', () => runReconciliation(env)));
  }

  if (cron === '0 20 * * 0') {
    ctx.waitUntil(safeCron('d1-backup', () => handleD1Backup(env as any)));
  }

  if (cron === '0 0 * * 1') {
    ctx.waitUntil(safeCron('agency-weekly-batch', async () => {
      const flags = await getFeatureFlags((env as any).RATE_LIMIT_KV, env.DB);
      const now = new Date();
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const monthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
      const dayOfMonth = now.getUTCDate();

      if (flags.enable_agency_auto_settle) {
        await handleAgencyAutoSettle(env).catch(e => console.error('[cron] auto-settle:', e));
      }
      await calculateAllAgencyIncentives(env.DB, monthStr).catch(e => console.error('[cron] incentives:', e));
      if (flags.enable_agency_tier_eval && dayOfMonth <= 7) {
        await handleAgencyTierEval(env).catch(e => console.error('[cron] tier-eval:', e));
      }
      // 2026-04-27: 셀러 등급 자동 평가 (월 1주차)
      if (dayOfMonth <= 7) {
        await handleSellerTierEval(env).catch(e => console.error('[cron] seller-tier-eval:', e));
      }
      if (flags.enable_agency_monthly_invoices && dayOfMonth <= 7) {
        await handleAgencyMonthlyInvoices(env as any).catch(e => console.error('[cron] invoices:', e));
      }
      // Phase 2-6: 월간 리포트 (1주차에만 실행, 내부 멱등)
      if (dayOfMonth <= 7) {
        await handleAgencyMonthlyReport(env).catch(e => console.error('[cron] monthly-report:', e));
      }
    }));
  }
}
