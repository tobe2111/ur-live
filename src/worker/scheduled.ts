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

// 🛡️ 2026-05-18: handleScheduled (49KB) dynamic import — cron 발생 시만 로드.
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
import { handleAgencySellerMatch } from './cron/agency-seller-match';
import { handleAdSlotsAward } from './cron/ad-slots-award';
import { handleD1Backup } from './cron/d1-backup';
import { handleRetryAlimtalk } from './cron/retry-alimtalk';
import { retryEmailFailures, retryPushFailures } from './cron/retry-notifications';
import { handleYoutubeBroadcastEndDetect } from './cron/youtube-broadcast-end-detect';
import { handleYoutubeThumbnailRefresh } from './cron/youtube-thumbnail-refresh';
import { handleAppointmentReminder } from './cron/appointment-reminder';
import { handlePayoutsGenerate } from './cron/payouts-generate';
import { handleSellerChurnDetect } from './cron/seller-churn-detect';
import { handleLedgerReconcile } from './cron/ledger-reconcile';
import { handleInfluencerPayout } from './cron/influencer-payout';
import { handleGroupBuyDeadlinePush } from './cron/group-buy-deadline-push';
import { handleOmeHealthCheck } from './cron/ome-health-check';
import { recomputeAllActiveCampaigns } from '../features/agency/api/agency-campaigns.routes';
import { calculateAllAgencyIncentives } from '../features/agency/api/agency-incentives.routes';
import { getFeatureFlags } from './utils/feature-flags';
import { logError, logInfo } from './utils/logger';

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
      logError(`[cron:${name}] FAILED`, { error: msg });
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
    ctx.waitUntil(safeCron('scheduled-cleanup', async () => {
      const { handleScheduled } = await import('./cron/scheduled-cleanup')
      return handleScheduled(env)
    }));
    // Phase 2-7: PK 이벤트 매출 집계 + 종료 처리
    ctx.waitUntil(safeCron('pk-battles-tick', () => handlePkBattlesTick(env)));
    // 🛡️ 2026-05-07: 알림톡 발송 실패 자동 재시도 (max 3회, exponential backoff)
    ctx.waitUntil(safeCron('retry-alimtalk', () => handleRetryAlimtalk(env)));
    // 🛡️ 2026-05-12: 이메일 / 푸시 dead-letter 재시도 drainer
    ctx.waitUntil(safeCron('retry-email-failures', () => retryEmailFailures(env)));
    ctx.waitUntil(safeCron('retry-push-failures', () => retryPushFailures(env)));
    // 🛡️ 2026-05-07: 외부 도구(YouTube Studio/OBS)에서 종료된 방송 자동 감지 + DB ended 처리
    ctx.waitUntil(safeCron('yt-broadcast-end-detect', () => handleYoutubeBroadcastEndDetect(env)));
    // 🛡️ 2026-05-21: 라이브 썸네일 자동 갱신 (셀러 수동 호출 제거 — YouTube 자동 캡처에 의존)
    ctx.waitUntil(safeCron('yt-thumbnail-refresh', () => handleYoutubeThumbnailRefresh(env)));
    // 🛡️ 2026-05-13 (안정성 #3): OME 미디어 서버 health check — 송출 SPOF 감지
    ctx.waitUntil(safeCron('ome-health-check', () => handleOmeHealthCheck(env)));
    // 🛡️ 2026-05-16: 공구 마감 3시간/1시간 전 push 알림 (5분마다 체크)
    ctx.waitUntil(safeCron('group-buy-deadline-push', () => handleGroupBuyDeadlinePush(env)));
  }

  // 🛡️ 2026-05-05: 매시간 어뷰징/이상치 탐지 — 후원 폭증, 반복 후원자, 신규 가입 패턴
  if (cron === '0 * * * *') {
    ctx.waitUntil(safeCron('anomaly-detect', () => handleAnomalyDetection(env)));
  }

  if (cron === '0 18 * * *') {
    ctx.waitUntil(safeCron('auto-settlement', () => handleAutoSettlement(env)));
    ctx.waitUntil(safeCron('expired-voucher-refund', () => handleExpiredVoucherRefunds(env)));
    ctx.waitUntil(safeCron('daily-self-diagnostic', () => runDailySelfDiagnostic(env)));
    // 🛡️ 2026-05-20: 운영자 액션 자동화 (사용자 요청).
    //   매일 1회 schema-repair 자동 호출 — migrations 0271-0274 의 누락 컬럼/테이블 보장.
    //   기존: 어드민이 수동으로 POST /api/_internal/repair-schema 호출 필요했음.
    //   변경: 매일 18 UTC cron 에 자동 통합 → 신규 migration 추가 시 다음날 자동 적용.
    ctx.waitUntil(safeCron('schema-repair-daily', async () => {
      const { runSchemaRepair } = await import('./routes/repair-schema.routes')
      const result = await runSchemaRepair(env.DB)
      const colErr = result.columns.filter(r => r.status === 'error').length
      const tabErr = result.tables.filter(r => r.status === 'error').length
      const colAdded = result.columns.filter(r => r.status === 'added').length
      if (colErr > 0 || tabErr > 0) {
        logError('[cron] schema-repair has errors', { colErr, tabErr })
      } else if (colAdded > 0) {
        logInfo(`[cron] schema-repair: +${colAdded} columns added (others existed)`)
      }
    }));
    // 🛡️ 2026-05-21: 리뷰 user_name 백필 — 카카오 이름 masked 자동 적용 (사용자 요청 영구).
    //   idempotent — user_name IS NULL 인 row 만 처리. 매일 실행해도 안전.
    ctx.waitUntil(safeCron('review-username-backfill', async () => {
      try {
        await env.DB.prepare(`ALTER TABLE product_reviews ADD COLUMN user_name TEXT`).run().catch(() => null);
        const r = await env.DB.prepare(`
          UPDATE product_reviews
             SET user_name = (
               SELECT CASE
                 WHEN name IS NULL OR name = '' THEN NULL
                 WHEN LENGTH(name) = 1 THEN name
                 WHEN LENGTH(name) = 2 THEN SUBSTR(name, 1, 1) || '*'
                 ELSE SUBSTR(name, 1, 1) || '*' || SUBSTR(name, -1, 1)
               END
               FROM users WHERE id = product_reviews.user_id
             )
           WHERE (user_name IS NULL OR user_name = '')
             AND EXISTS (SELECT 1 FROM users WHERE id = product_reviews.user_id AND name IS NOT NULL AND name != '')
        `).run().catch(() => null);
        if (r && r.meta.changes > 0) {
          logInfo(`[cron] review-username-backfill: +${r.meta.changes} reviews updated`)
        }
      } catch (e) { logError('[cron] review-username-backfill', { error: String(e) }) }
    }));
    // 🛡️ 2026-05-15: 셀러 churn 탐지 — 14일+ 등록 X + 평균 진행률 < 50% → 에이전시 alert
    ctx.waitUntil(safeCron('seller-churn-detect', () => handleSellerChurnDetect(env)));
    // 🛡️ 2026-05-15 (TD-G08): ledger 정합성 검증 — Σdebit ≠ Σcredit / 음수 wallet → Discord alert
    ctx.waitUntil(safeCron('ledger-reconcile', () => handleLedgerReconcile(env)));
    ctx.waitUntil(safeCron('agency-cron-batch', async () => {
      const flags = await getFeatureFlags((env as any).RATE_LIMIT_KV, env.DB);
      if (flags.enable_agency_campaigns_aggregate) {
        await recomputeAllActiveCampaigns(env.DB).catch(e => logError('[cron] campaigns', { error: String(e) }));
      }
      if (flags.enable_agency_creator_eval) {
        await handleAgencyCreatorEval(env).catch(e => logError('[cron] creator-eval', { error: String(e) }));
      }
      if (flags.enable_agency_monthly_tasks) {
        await handleAgencyMonthlyTasks(env).catch(e => logError('[cron] monthly-tasks', { error: String(e) }));
      }
      if (flags.enable_tiktok_videos_sync) {
        await handleTikTokVideosSync(env).catch(e => logError('[cron] tiktok', { error: String(e) }));
      }
      // Phase 1-2: 부진 셀러 알림 (매일)
      await handleAgencyInactiveSellers(env).catch(e => logError('[cron] inactive-sellers', { error: String(e) }));
      // 🛡️ 2026-05-20: 에이전시 입점 가게 월 성장 보너스 — 매일 체크하지만 동월 중복은 내부 가드.
      //   실질적으로 매월 1일 첫 실행만 의미 있음 (전월 매출 fix 됨).
      try {
        const { runAgencyStoreIntroMonthlyBonus } = await import('./cron/agency-store-intro-monthly-bonus')
        const r = await runAgencyStoreIntroMonthlyBonus(env)
        if (r.awarded > 0) {
          logInfo(`[cron] agency-store-intro monthly bonus: awarded ${r.awarded} stores, total ₩${r.totalAmount.toLocaleString()}`)
        }
      } catch (e) { logError('[cron] agency-intro-monthly-bonus', { error: String(e) }) }
      // Phase 2-4: 라이브 종료 메트릭 사전 집계 (매일)
      await handleLiveStreamMetrics(env).catch(e => logError('[cron] live-metrics', { error: String(e) }));
      // 2026-04-27: 자사 이벤트 진행값 자동 갱신 + 보상 지급 (매일)
      await handleAgencySelfEventsTick(env).catch(e => logError('[cron] self-events', { error: String(e) }));
      // 2026-04-27: 셀러 일일 리포트 메일 (RESEND_API_KEY 있을 때만)
      await handleSellerDailyReport(env).catch(e => logError('[cron] seller-daily-report', { error: String(e) }));
      // 2026-05-05: 신규 셀러 ↔ 에이전시 자동 매칭 제안
      await handleAgencySellerMatch(env).catch(e => logError('[cron] agency-seller-match', { error: String(e) }));
      // 2026-05-05: 광고 슬롯 낙찰 처리
      await handleAdSlotsAward(env).catch(e => logError('[cron] ad-slots-award', { error: String(e) }));
    }));
  }

  // 🛡️ 2026-05-18 (PR 6/6): 숙소 예약 D-1 / D-day 알림 — 매일 09:00 UTC (KST 18:00).
  //   KST 09:00 으로 옮기려면 '0 0 * * *' (UTC).
  // 🛡️ 2026-05-19: KT Alpha catalog sync — 매일 03:00 UTC (KST 12:00).
  //   하루 1회만 → KV write 한도 영향 없음 (D1 only).
  if (cron === '0 3 * * *') {
    ctx.waitUntil(safeCron('kt-alpha-catalog-sync', async () => {
      const { runKtAlphaCatalogSync } = await import('./cron/kt-alpha-catalog-sync')
      await runKtAlphaCatalogSync(env as { DB: D1Database })
    }))
  }

  // 🛡️ 2026-05-19: 식사권 주소 → 좌표 일괄 변환 cron — 매일 03:00 UTC 와 함께 실행.
  //   클라이언트에서 페이지 진입 시마다 Kakao API 호출하던 패턴을 제거하기 위함.
  //   효과: 일 트래픽 1000명 × 10건/명 = 10,000 호출/일 → 새 식사권만 (~10 호출/일) 로 감소.
  if (cron === '0 3 * * *') {
    ctx.waitUntil(safeCron('restaurant-geocode', async () => {
      const { runRestaurantGeocode } = await import('./cron/restaurant-geocode')
      await runRestaurantGeocode(env as { DB: D1Database; KAKAO_REST_API_KEY?: string })
    }))
  }

  if (cron === '0 9 * * *' || cron === '0 0 * * *') {
    ctx.waitUntil(safeCron('stay-reminder', async () => {
      const { runStayReminderCron } = await import('./cron/stay-reminder')
      await runStayReminderCron(env as { DB: D1Database })
    }))
    // 🛡️ 2026-05-21 Phase B-2: 자체 예약 D-1 reminder (KST 18시).
    ctx.waitUntil(safeCron('appointment-reminder', () => handleAppointmentReminder(env)))
    // 🛡️ 2026-05-18: voucher 만료 D-30/D-7/D-1 알림.
    ctx.waitUntil(safeCron('stay-voucher-expire', async () => {
      const { runVoucherExpireCron } = await import('./cron/stay-voucher-expire')
      await runVoucherExpireCron(env as { DB: D1Database })
    }))
  }

  if (cron === '0 19 * * *') {
    ctx.waitUntil(safeCron('reconciliation', () => runReconciliation(env)));
    // 🛡️ 2026-05-16: 인플루언서 attribution pending→available 매일 19시 동기화.
    //   매월 1일에만 실제 송금 큐잉. 그 외엔 status 동기화만.
    ctx.waitUntil(safeCron('influencer-payout', () => handleInfluencerPayout(env)));
  }

  if (cron === '0 20 * * 0') {
    ctx.waitUntil(safeCron('d1-backup', () => handleD1Backup(env as any)));
  }

  if (cron === '0 0 * * 1') {
    // 🛡️ 2026-05-21 Phase C: 주 1회 정산 자동 생성 — admin 검토용 pending payouts 생성.
    ctx.waitUntil(safeCron('payouts-generate', () => handlePayoutsGenerate(env)));
    ctx.waitUntil(safeCron('agency-weekly-batch', async () => {
      const flags = await getFeatureFlags((env as any).RATE_LIMIT_KV, env.DB);
      const now = new Date();
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const monthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
      const dayOfMonth = now.getUTCDate();

      if (flags.enable_agency_auto_settle) {
        await handleAgencyAutoSettle(env).catch(e => logError('[cron] auto-settle', { error: String(e) }));
      }
      await calculateAllAgencyIncentives(env.DB, monthStr).catch(e => logError('[cron] incentives', { error: String(e) }));
      if (flags.enable_agency_tier_eval && dayOfMonth <= 7) {
        await handleAgencyTierEval(env).catch(e => logError('[cron] tier-eval', { error: String(e) }));
      }
      // 2026-04-27: 셀러 등급 자동 평가 (월 1주차)
      if (dayOfMonth <= 7) {
        await handleSellerTierEval(env).catch(e => logError('[cron] seller-tier-eval', { error: String(e) }));
      }
      if (flags.enable_agency_monthly_invoices && dayOfMonth <= 7) {
        await handleAgencyMonthlyInvoices(env as any).catch(e => logError('[cron] invoices', { error: String(e) }));
      }
      // Phase 2-6: 월간 리포트 (1주차에만 실행, 내부 멱등)
      if (dayOfMonth <= 7) {
        await handleAgencyMonthlyReport(env).catch(e => logError('[cron] monthly-report', { error: String(e) }));
      }
    }));
  }
}
