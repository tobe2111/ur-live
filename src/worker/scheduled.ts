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
import { handleWholesaleGradeEval } from './cron/wholesale-grade-eval';
import { handleWholesaleSettleTick } from './cron/wholesale-settle-tick';
import { handleWholesaleOrphanSweep } from './cron/wholesale-orphan-sweep';
import { handleWholesaleRestockNotify } from './cron/wholesale-restock-notify';
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
import { handleAppointmentNoshowAlert } from './cron/appointment-noshow-alert';
import { handlePayoutsGenerate } from './cron/payouts-generate';
import { handleLedgerIntegrityCheck } from './cron/ledger-integrity-check';
import { handleDisputesEscalation } from './cron/disputes-escalation';
import { handleTossRefundRetry } from './cron/toss-refund-retry';
import { handleSellerChurnDetect } from './cron/seller-churn-detect';
import { handleLedgerReconcile } from './cron/ledger-reconcile';
import { handleInfluencerPayout } from './cron/influencer-payout';
import { handleGroupBuyDeadlinePush } from './cron/group-buy-deadline-push';
import { handleOmeHealthCheck } from './cron/ome-health-check';
import { handleGroupBuyFeedCache } from './cron/group-buy-feed-cache';
import { handleCachePrewarm } from './cron/cache-prewarm';
// 🛡️ 2026-06-09: 어드민 단체메일 큐 drainer (요청 안에서 발송 X → CPU/멱등 hardening).
import { handleBulkEmailDrain } from './cron/bulk-email-drain';
// 🛡️ 2026-05-24: 모든 신규 활성 상품 (공구/쇼핑/교환권) 에 자동 허위리뷰 시드.
import { handleAutoSeedReviews } from './cron/auto-seed-reviews';
import { recomputeAllActiveCampaigns } from '../features/agency/api/agency-campaigns.routes';
import { calculateAllAgencyIncentives } from '../features/agency/api/agency-incentives.routes';
import { getFeatureFlags } from './utils/feature-flags';
// 🏭 2026-06-05 (사용자 요청 — 라이브 중단 중 cron 낭비 제거): 라이브 전용 cron 게이팅.
//   LIVE_COMMERCE_SUSPENDED=true 동안 라이브 방송 관련 cron(5분마다 헛도는 DB 조회)을 건너뜀.
//   플래그만 false 로 되돌리면 즉시 복원 — 코드 보존.
import { LIVE_COMMERCE_SUSPENDED } from '../shared/feature-flags';
import { logError, logInfo } from './utils/logger';

/**
 * 🔔 2026-06-12 (4차 감사 D3): cron 내부 실패 공용 통지 — logError + Discord (fail-soft).
 *
 * 배경: agency-cron-batch / agency-weekly-batch 의 내부 task 들이 `.catch(logError)` 만 해서
 * batch 자체는 성공으로 끝남 → safeCron 의 Discord 경로에 절대 안 닿았음 (silent 실패).
 * safeCron 의 Discord 패턴을 그대로 재사용해 내부 task 실패도 운영자에게 도달시킨다.
 */
export async function notifyCronFailure(env: Env, name: string, err: unknown): Promise<void> {
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
      await notifyCronFailure(env, name, err);
    }
  };

  // 🛡️ 2026-06-09: 어드민 단체메일 큐 drainer — 2분마다 한 batch 씩 멱등 발송.
  //   요청 안에서 수천 명 발송하던 것을 cron 으로 이전 (CPU/wall 한도 + per-recipient 멱등 hardening).
  if (cron === '*/2 * * * *') {
    ctx.waitUntil(safeCron('bulk-email-drain', () => handleBulkEmailDrain(env)));
  }

  if (cron === '*/5 * * * *') {
    ctx.waitUntil(safeCron('scheduled-cleanup', async () => {
      const { handleScheduled } = await import('./cron/scheduled-cleanup')
      return handleScheduled(env)
    }));
    // Phase 2-7: PK 이벤트 매출 집계 + 종료 처리 (라이브 중단 시 skip)
    if (!LIVE_COMMERCE_SUSPENDED) ctx.waitUntil(safeCron('pk-battles-tick', () => handlePkBattlesTick(env)));
    // 🛡️ 2026-05-07: 알림톡 발송 실패 자동 재시도 (max 3회, exponential backoff)
    ctx.waitUntil(safeCron('retry-alimtalk', () => handleRetryAlimtalk(env)));
    // 🛡️ 2026-05-12: 이메일 / 푸시 dead-letter 재시도 drainer
    ctx.waitUntil(safeCron('retry-email-failures', () => retryEmailFailures(env)));
    ctx.waitUntil(safeCron('retry-push-failures', () => retryPushFailures(env)));
    // 🛡️ 2026-05-07: 외부 도구(YouTube Studio/OBS)에서 종료된 방송 자동 감지 + DB ended 처리 (라이브 중단 시 skip)
    if (!LIVE_COMMERCE_SUSPENDED) ctx.waitUntil(safeCron('yt-broadcast-end-detect', () => handleYoutubeBroadcastEndDetect(env)));
    // 🛡️ 2026-05-21: 라이브 썸네일 자동 갱신 (셀러 수동 호출 제거 — YouTube 자동 캡처에 의존) (라이브 중단 시 skip)
    if (!LIVE_COMMERCE_SUSPENDED) ctx.waitUntil(safeCron('yt-thumbnail-refresh', () => handleYoutubeThumbnailRefresh(env)));
    // 🛡️ 2026-05-13 (안정성 #3): OME 미디어 서버 health check — 송출 SPOF 감지 (라이브 중단 시 skip)
    if (!LIVE_COMMERCE_SUSPENDED) ctx.waitUntil(safeCron('ome-health-check', () => handleOmeHealthCheck(env)));
    // 🛡️ 2026-05-16: 공구 마감 3시간/1시간 전 push 알림 (5분마다 체크)
    ctx.waitUntil(safeCron('group-buy-deadline-push', () => handleGroupBuyDeadlinePush(env)));
    // 🛡️ 2026-05-21 Phase E-3: 예약 시작 +30분 지난 confirmed 노쇼 자동 알림.
    ctx.waitUntil(safeCron('appointment-noshow-alert', () => handleAppointmentNoshowAlert(env)));
    // 🛡️ 2026-05-22: group-buy 피드 materialized cache 갱신 (5분).
    //   migrations/0277 미적용 환경은 graceful skip — table probe 후 no-op.
    //   응답 path 의 cache fallback 과 함께 동작 (group-buy-public.routes.ts).
    ctx.waitUntil(safeCron('group-buy-feed-cache', () => handleGroupBuyFeedCache(env)));
    // 🛡️ 2026-05-23 (Task 3): 5분마다 hot endpoint pre-warm — 배포 후 / cache expire 후
    //   첫 사용자 cold-start 제거. publicCache 가 edge + KV 양쪽 자동으로 채움.
    ctx.waitUntil(safeCron('cache-prewarm', () => handleCachePrewarm(env)));
    // 🛡️ 2026-05-27 (영업 검증 Layer 4): prospects 첫 매출 발생 시 commission 활성.
    //   단순 가입 X — 매장이 실제 매출 내야 영업 commission lock-in. 부정 방지.
    ctx.waitUntil(safeCron('prospects-commission-activate', async () => {
      const { handleProspectsCommissionActivate } = await import('./cron/prospects-commission-activate')
      return handleProspectsCommissionActivate(env)
    }));
    // 🆕 2026-06-27 유어애즈 자동입찰 — 활성 규칙의 입찰가 자동조정(목표순위→추정→max_bid 클램프).
    //   글로벌 킬스위치(ADS_AUTOBID_ENABLED='true')일 때만 실제 동작 — 아니면 즉시 no-op(라이브검증 전 OFF).
    if (env.ADS_AUTOBID_ENABLED === 'true') {
      ctx.waitUntil(safeCron('ads-autobid', async () => {
        const { runAutobidAll } = await import('../features/marketing/api/autobid')
        return runAutobidAll(env)
      }));
    }
  }

  // 🛡️ 2026-05-05: 매시간 어뷰징/이상치 탐지 — 후원 폭증, 반복 후원자, 신규 가입 패턴
  if (cron === '0 * * * *') {
    ctx.waitUntil(safeCron('anomaly-detect', () => handleAnomalyDetection(env)));
    // ⏰ 2026-07-02 (#5 승인 SLA): 24h+ 대기 셀러 전환 신청 어드민 리마인드(20h dedup = 하루 1회꼴).
    ctx.waitUntil(safeCron('seller-approval-reminder', async () => {
      const { handleSellerApprovalReminder } = await import('./cron/seller-approval-reminder')
      return handleSellerApprovalReminder(env)
    }));
    // 🛡️ 2026-05-31: 미결제 pending 숙소 예약 자동 만료 (30분 경과). 재고 미조작 — 정리 목적.
    ctx.waitUntil(safeCron('stay-pending-expire', async () => {
      const { handleStayPendingExpire } = await import('./cron/stay-pending-expire')
      return handleStayPendingExpire(env)
    }));
    // 🏦 2026-06-09: 미완료 예치금 주문 reconcile(크래시 복구) — 차감됐는데 PAID 도달 못 한 주문 자동 환불(미회수 0).
    ctx.waitUntil(safeCron('wholesale-deposit-reconcile', async () => {
      const { reconcileOrphanedDepositOrders } = await import('../features/supply/api/wholesale-deposit-core')
      return reconcileOrphanedDepositOrders(env.DB)
    }));
    // 🛡️ 2026-05-21 Phase TD-3: 토스 환불 실패 자동 재시도 (exponential backoff).
    ctx.waitUntil(safeCron('toss-refund-retry', () => handleTossRefundRetry(env)));
    // 🛡️ 2026-05-24: 별점 "신규" 영구 fix — daily (18 UTC) 외에도 매시간 catch.
    //   신규 활성 상품이 들어오면 최대 1시간 안에 ★ 노출. idempotent (review_count>0 skip).
    ctx.waitUntil(safeCron('auto-seed-reviews-hourly', () => handleAutoSeedReviews(env)));
    // 🏭 2026-06-08 TAX-1: 공급사 정산 성숙 매시간 tick (기존 maturity helper 호출, idempotent).
    ctx.waitUntil(safeCron('wholesale-settle-tick', () => handleWholesaleSettleTick(env)));
    // 🏭 2026-06-08 NOTI-1: 재입고 알림 — 구독 상품 재입고(stock>0) 시 판매사 알림.
    ctx.waitUntil(safeCron('wholesale-restock-notify', () => handleWholesaleRestockNotify(env)));
    // 🔔 2026-07-01: 알림 채널 설정 회귀 감시 — LIVE 채널 키가 사라지면(true→false) 1회 critical
    //   경보(cron_failures + 어드민 벨). VAPID 미설정으로 웹푸시가 조용히 죽어있던 사고 재발 방지.
    ctx.waitUntil(safeCron('channel-watchdog', async () => {
      const { handleChannelWatchdog } = await import('./cron/channel-watchdog');
      return handleChannelWatchdog(env);
    }));
    // 🔔 2026-07-01: 소비자 찜(위시리스트) 재입고 + 가격인하 알림(매시간, 멱등 스캔 — 재고/가격 write 무hook).
    ctx.waitUntil(safeCron('wishlist-restock-notify', async () => {
      const { handleWishlistRestockNotify } = await import('./cron/wishlist-notify');
      return handleWishlistRestockNotify(env);
    }));
    ctx.waitUntil(safeCron('wishlist-price-drop-notify', async () => {
      const { handleWishlistPriceDropNotify } = await import('./cron/wishlist-notify');
      return handleWishlistPriceDropNotify(env);
    }));
    // 🔁 2026-06-12 (4차 감사 D4 — 1단계): FAILED 웹훅(retry<3) 백로그 감시 — Discord 요약.
    //   실제 자동 재처리는 webhook.routes 잠금 해제 승인 후 2단계 (파일 헤더 참조).
    ctx.waitUntil(safeCron('webhook-failed-drain', async () => {
      const { handleWebhookFailedDrain } = await import('./cron/webhook-failed-drain');
      return handleWebhookFailedDrain(env);
    }));
    // 🎫 2026-06-17 (사용자 요청 "가장 이상적으로"): KT Alpha 교환권 발송 실패 자동 복구.
    //   'failed'(미발송 확정) 는 안전 자동 재시도(retry<3, backoff) / 'processing' 끼임은 중복방지 위해
    //   수동 검토로 surface. config 미설정 시 skip. (파일 헤더 참조)
    ctx.waitUntil(safeCron('kt-alpha-voucher-retry', async () => {
      const { handleKtAlphaVoucherRetry } = await import('./cron/kt-alpha-voucher-retry');
      return handleKtAlphaVoucherRetry(env);
    }));
  }

  if (cron === '0 18 * * *') {
    ctx.waitUntil(safeCron('auto-settlement', () => handleAutoSettlement(env)));
    ctx.waitUntil(safeCron('expired-voucher-refund', () => handleExpiredVoucherRefunds(env)));
    // 🛡️ 2026-06-01 도매몰: 공급자 정산 성숙 (환불창 지난 pending → available).
    ctx.waitUntil(safeCron('supplier-settlement-mature', async () => {
      const { matureSupplierSettlements } = await import('../features/supply/api/supply-settlement');
      await matureSupplierSettlements(env.DB);
    }));
    // ⏳ 2026-06-15 링크샵: 추천 적립 성숙 — holding 상태 T+7(환불창) 경과 + 미환불 주문분을
    //   granted 로 확정 + 그때 딜 잔액 적립. 즉시적립 후 환불 시 회수불가(MAX0 clamp) 누수 차단.
    ctx.waitUntil(safeCron('affiliate-mature', async () => {
      const { matureAffiliateEarnings } = await import('./utils/affiliate-credit');
      await matureAffiliateEarnings(env.DB, env);
    }));
    // ⏳ 2026-06-15 추천 트리(referral_commissions) 적립도 동일 T+7 hold — pending→granted 확정 시 잔액 적립.
    ctx.waitUntil(safeCron('referral-mature', async () => {
      const { matureReferralCommissions } = await import('../features/referral/api/referral-tree.routes');
      await matureReferralCommissions(env.DB, env);
    }));
    ctx.waitUntil(safeCron('daily-self-diagnostic', () => runDailySelfDiagnostic(env)));
    // 🆕 2026-06-27 유어애즈 가격 모니터링 — 등록된 워치의 네이버쇼핑 최저가 일일 갱신(읽기, 돈 0).
    ctx.waitUntil(safeCron('ads-price-refresh', async () => {
      const { refreshAllWatches } = await import('../features/marketing/api/price-monitor')
      return refreshAllWatches(env)
    }));
    // 🆕 2026-06-28 유어애즈 쇼핑 순위 추적 — 등록 키워드의 내 몰 순위 일일 갱신(읽기, 돈 0).
    ctx.waitUntil(safeCron('ads-rank-track', async () => {
      const { refreshAllRankTargets } = await import('../features/marketing/api/rank-tracker')
      return refreshAllRankTargets(env)
    }));
    // 🆕 2026-06-30 유어애즈 일별 메트릭 스냅샷 — 연결 계정의 '어제' 실적을 ad_daily_metrics 에 1행/계정/일(추세 차트 원천, 읽기, 돈 0).
    ctx.waitUntil(safeCron('ads-metrics-snapshot', async () => {
      const { snapshotAllAccounts } = await import('../features/marketing/api/metrics-history')
      return snapshotAllAccounts(env)
    }));
    // 🆕 2026-06-28 유어애즈 임계값 알림 — 예산 소진/최저가 역전 점검 후 이메일(계정+날짜 멱등 1일 1회).
    //   가격 갱신 후 실행되도록 동일 블록 뒤에 등록(최신 last_lowest 반영).
    ctx.waitUntil(safeCron('ads-alerts', async () => {
      const { runAlertsAll } = await import('../features/marketing/api/alerts')
      return runAlertsAll(env)
    }));
    // 🏭 2026-06-08 DATA-1: 도매 고아행(FK 부재) 일일 스윕 (flag-only, 삭제 X).
    ctx.waitUntil(safeCron('wholesale-orphan-sweep', () => handleWholesaleOrphanSweep(env)));
    // 🛡️ 2026-05-21 Phase D-3: 매일 ledger 정합성 검증 — orphan entries 알림.
    ctx.waitUntil(safeCron('ledger-integrity-check', () => handleLedgerIntegrityCheck(env)));
    // 🛡️ 2026-05-21 Phase E-4: 분쟁 자동 escalation (24시간 미처리 + 재발 매장 + 어뷰징 사용자).
    ctx.waitUntil(safeCron('disputes-escalation', () => handleDisputesEscalation(env)));
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
    // 🛡️ 2026-05-24: 신규 활성 상품 (공구/쇼핑/교환권) 자동 허위리뷰 시드 — 1일당 최대 200개.
    //   정책 B: is_active=1 검수 통과한 상품만. 어떤 경로 (셀러/관리자/카페24/대량업로드/KT Alpha)
    //   로 생성됐든 1일 안에 카드 별점·리뷰 노출. idempotent.
    ctx.waitUntil(safeCron('auto-seed-reviews', () => handleAutoSeedReviews(env)));
    // 🛡️ 2026-05-15: 셀러 churn 탐지 — 14일+ 등록 X + 평균 진행률 < 50% → 에이전시 alert
    ctx.waitUntil(safeCron('seller-churn-detect', () => handleSellerChurnDetect(env)));
    // 🛡️ 2026-05-15 (TD-G08): ledger 정합성 검증 — Σdebit ≠ Σcredit / 음수 wallet → Discord alert
    ctx.waitUntil(safeCron('ledger-reconcile', () => handleLedgerReconcile(env)));
    ctx.waitUntil(safeCron('agency-cron-batch', async () => {
      const flags = await getFeatureFlags((env as any).RATE_LIMIT_KV, env.DB);
      if (flags.enable_agency_campaigns_aggregate) {
        await recomputeAllActiveCampaigns(env.DB).catch(e => notifyCronFailure(env, 'agency-cron-batch/campaigns', e));
      }
      if (flags.enable_agency_creator_eval) {
        await handleAgencyCreatorEval(env).catch(e => notifyCronFailure(env, 'agency-cron-batch/creator-eval', e));
      }
      if (flags.enable_agency_monthly_tasks) {
        await handleAgencyMonthlyTasks(env).catch(e => notifyCronFailure(env, 'agency-cron-batch/monthly-tasks', e));
      }
      if (flags.enable_tiktok_videos_sync) {
        await handleTikTokVideosSync(env).catch(e => notifyCronFailure(env, 'agency-cron-batch/tiktok', e));
      }
      // Phase 1-2: 부진 셀러 알림 (매일)
      await handleAgencyInactiveSellers(env).catch(e => notifyCronFailure(env, 'agency-cron-batch/inactive-sellers', e));
      // 🛡️ 2026-05-20: 에이전시 입점 가게 월 성장 보너스 — 매일 체크하지만 동월 중복은 내부 가드.
      //   실질적으로 매월 1일 첫 실행만 의미 있음 (전월 매출 fix 됨).
      // 🔐 2026-06-11 (정합성 감사 🔴): 매월 1일에만 실행 — 기존 매일 실행 + note-LIKE 멱등(약함)이라
      //   같은 날 cron 중복/재시도 시 growth_bonus 이중 적립 위험. 1일 게이트로 실행 빈도 자체를 월1회로.
      if (new Date().getUTCDate() === 1) try {
        const { runAgencyStoreIntroMonthlyBonus } = await import('./cron/agency-store-intro-monthly-bonus')
        const r = await runAgencyStoreIntroMonthlyBonus(env)
        if (r.awarded > 0) {
          logInfo(`[cron] agency-store-intro monthly bonus: awarded ${r.awarded} stores, total ₩${r.totalAmount.toLocaleString()}`)
        }
      } catch (e) { await notifyCronFailure(env, 'agency-cron-batch/agency-intro-monthly-bonus', e) }
      // Phase 2-4: 라이브 종료 메트릭 사전 집계 (매일) — 라이브 중단 시 skip
      if (!LIVE_COMMERCE_SUSPENDED) await handleLiveStreamMetrics(env).catch(e => notifyCronFailure(env, 'agency-cron-batch/live-metrics', e));
      // 2026-04-27: 자사 이벤트 진행값 자동 갱신 + 보상 지급 (매일)
      await handleAgencySelfEventsTick(env).catch(e => notifyCronFailure(env, 'agency-cron-batch/self-events', e));
      // 2026-04-27: 셀러 일일 리포트 메일 (RESEND_API_KEY 있을 때만)
      await handleSellerDailyReport(env).catch(e => notifyCronFailure(env, 'agency-cron-batch/seller-daily-report', e));
      // 2026-05-05: 신규 셀러 ↔ 에이전시 자동 매칭 제안
      await handleAgencySellerMatch(env).catch(e => notifyCronFailure(env, 'agency-cron-batch/agency-seller-match', e));
      // 2026-05-05: 광고 슬롯 낙찰 처리
      await handleAdSlotsAward(env).catch(e => notifyCronFailure(env, 'agency-cron-batch/ad-slots-award', e));
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

  // 🛡️ 2026-05-19: 이용권 주소 → 좌표 일괄 변환 cron — 매일 03:00 UTC 와 함께 실행.
  //   클라이언트에서 페이지 진입 시마다 Kakao API 호출하던 패턴을 제거하기 위함.
  //   효과: 일 트래픽 1000명 × 10건/명 = 10,000 호출/일 → 새 이용권만 (~10 호출/일) 로 감소.
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
    // 🎫 2026-06-21: 이용권(교환권) 만료 D-7/D-3/D-1 알림 (앱내 + 알림톡). 선결제 돈 소멸 방지.
    ctx.waitUntil(safeCron('meal-voucher-expire', async () => {
      const { runMealVoucherExpireCron } = await import('./cron/voucher-expire')
      await runMealVoucherExpireCron(env as Parameters<typeof runMealVoucherExpireCron>[0])
    }))
    // 🛡️ 2026-06-12 (전수조사 4차 B-6): 체크아웃 +1일 경과 confirmed → checked_out 자동 전이 (리뷰 게이트 해제).
    ctx.waitUntil(safeCron('stay-checkout-transition', async () => {
      const { handleStayCheckoutTransition } = await import('./cron/stay-checkout-transition')
      await handleStayCheckoutTransition(env as { DB: D1Database })
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
    // 📝 2026-07-01: 블로그 AI 홍보 초안 주간 1편(비공개, 관리자 검토 후 발행).
    //   킬스위치 BLOG_AI_DRAFTS_ENABLED='true' 일 때만 — 기본 OFF(토큰 낭비 0). 홍보 전용.
    ctx.waitUntil(safeCron('blog-ai-draft', async () => {
      const { handleBlogAiDraft } = await import('./cron/blog-ai-draft');
      return handleBlogAiDraft(env);
    }));
    ctx.waitUntil(safeCron('agency-weekly-batch', async () => {
      const flags = await getFeatureFlags((env as any).RATE_LIMIT_KV, env.DB);
      const now = new Date();
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const monthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
      const dayOfMonth = now.getUTCDate();

      if (flags.enable_agency_auto_settle) {
        await handleAgencyAutoSettle(env).catch(e => notifyCronFailure(env, 'agency-weekly-batch/auto-settle', e));
      }
      await calculateAllAgencyIncentives(env.DB, monthStr).catch(e => notifyCronFailure(env, 'agency-weekly-batch/incentives', e));
      if (flags.enable_agency_tier_eval && dayOfMonth <= 7) {
        await handleAgencyTierEval(env).catch(e => notifyCronFailure(env, 'agency-weekly-batch/tier-eval', e));
      }
      // 2026-04-27: 셀러 등급 자동 평가 (월 1주차)
      if (dayOfMonth <= 7) {
        await handleSellerTierEval(env).catch(e => notifyCronFailure(env, 'agency-weekly-batch/seller-tier-eval', e));
      }
      // 🏭 BIZ-7 (2026-06-08): 판매사 도매 등급 자동 평가 (GMV 기반 승급 전용).
      //   매주 월요일 — platform_settings.wholesale_auto_grade_enabled='1' 일 때만 동작(off=no-op).
      await handleWholesaleGradeEval(env).catch(e => notifyCronFailure(env, 'agency-weekly-batch/wholesale-grade-eval', e));
      if (flags.enable_agency_monthly_invoices && dayOfMonth <= 7) {
        await handleAgencyMonthlyInvoices(env as any).catch(e => notifyCronFailure(env, 'agency-weekly-batch/invoices', e));
      }
      // Phase 2-6: 월간 리포트 (1주차에만 실행, 내부 멱등)
      if (dayOfMonth <= 7) {
        await handleAgencyMonthlyReport(env).catch(e => notifyCronFailure(env, 'agency-weekly-batch/monthly-report', e));
      }
      // 🆕 2026-06-27 유어애즈 AI 주간 리포트 (매주 월요일, 주당 1회 멱등). 연결 고객사만.
      await (async () => {
        const { handleAdsWeeklyReport } = await import('../features/marketing/api/weekly-report');
        return handleAdsWeeklyReport(env);
      })().catch(e => notifyCronFailure(env, 'agency-weekly-batch/ads-weekly-report', e));
    }));
  }
}
