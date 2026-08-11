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
 *
 * ⚠️ 배포 주의 (2026-07-05): 이 파일(및 cron/**)은 Pages 배포(main.yml)에 **포함되지 않는다** —
 *   cron 은 별도 Workers 프로젝트에서 돈다. 변경 시 `.github/workflows/worker-deploy.yml` 이
 *   자동 트리거(이 경로 push 시)되어 `wrangler deploy` 로 동기화. 수동 실행: Actions → Deploy Worker.
 */

import type { ScheduledEvent, ExecutionContext } from '@cloudflare/workers-types';
import type { Env } from './types/env';
import { slotDue } from './cron-slot';

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
import { handleAgencyMonthlyReport } from './cron/agency-monthly-report';
import { handleAgencySelfEventsTick } from './cron/agency-self-events-tick';
import { handleSellerTierEval } from './cron/seller-tier-eval';
import { handleWholesaleGradeEval } from './cron/wholesale-grade-eval';
import { handleWholesaleOrphanSweep } from './cron/wholesale-orphan-sweep';
import { handleWholesaleRestockNotify } from './cron/wholesale-restock-notify';
import { handleAnomalyDetection } from './cron/anomaly-detect';
import { handleSellerDailyReport } from './cron/seller-daily-report';
import { handleAgencySellerMatch } from './cron/agency-seller-match';
import { handleAdSlotsAward } from './cron/ad-slots-award';
import { handleD1Backup } from './cron/d1-backup';
import { handleRetryAlimtalk } from './cron/retry-alimtalk';
import { retryEmailFailures, retryPushFailures } from './cron/retry-notifications';
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
import { handleGroupBuyFeedCache } from './cron/group-buy-feed-cache';
import { handleCachePrewarm } from './cron/cache-prewarm';
// 🛡️ 2026-06-09: 어드민 단체메일 큐 drainer (요청 안에서 발송 X → CPU/멱등 hardening).
import { handleBulkEmailDrain } from './cron/bulk-email-drain';
// 🛡️ 2026-05-24: 모든 신규 활성 상품 (공구/쇼핑/교환권) 에 자동 허위리뷰 시드.
import { handleAutoSeedReviews } from './cron/auto-seed-reviews';
import { renewDemoFcfs } from './cron/demo-fcfs-renew';
import { recomputeAllActiveCampaigns } from '../features/agency/api/agency-campaigns.routes';
import { calculateAllAgencyIncentives } from '../features/agency/api/agency-incentives.routes';
import { getFeatureFlags } from './utils/feature-flags';
// 🏭 2026-06-05 (사용자 요청 — 라이브 중단 중 cron 낭비 제거): 라이브 전용 cron 게이팅.
//   LIVE_COMMERCE_SUSPENDED=true 동안 라이브 방송 관련 cron(5분마다 헛도는 DB 조회)을 건너뜀.
//   플래그만 false 로 되돌리면 즉시 복원 — 코드 보존.
import { LIVE_COMMERCE_SUSPENDED } from '../shared/feature-flags';
import { logError, logInfo } from './utils/logger';
import { reportCronFailure } from './utils/cron-reporter';
import { recordCronBeat } from './utils/cron-heartbeat';
import { ACCEPTED_CRON_EXPRESSIONS } from './utils/cron-expected';
import { envBeatFor } from './utils/cron-required-env';

/**
 * 🔔 2026-06-12 (4차 감사 D3): cron 내부 실패 공용 통지 — logError + Discord (fail-soft).
 *
 * 배경: agency-cron-batch / agency-weekly-batch 의 내부 task 들이 `.catch(logError)` 만 해서
 * batch 자체는 성공으로 끝남 → safeCron 의 Discord 경로에 절대 안 닿았음 (silent 실패).
 * safeCron 의 Discord 패턴을 그대로 재사용해 내부 task 실패도 운영자에게 도달시킨다.
 *
 * 🔔 2026-07-08 (무인운영 감사): Discord 만으로는 `DISCORD_WEBHOOK_URL` 미설정 시 전면 무음 +
 *   실패 이력이 남지 않아 사후추적 불가 → reportCronFailure 를 함께 호출해 **Discord + cron_failures
 *   테이블 + 어드민 벨 3채널**에 도달시킨다. 이제 모든 safeCron 실패가 pull(어드민 벨/DB)로도 보인다.
 *   (reportCronFailure 는 내부적으로 완전 fail-soft — 이 호출이 알림 자체를 막지 않는다.)
 */
export async function notifyCronFailure(env: Env, name: string, err: unknown): Promise<void> {
  const msg = (err as Error)?.message || String(err);
  logError(`[cron:${name}] FAILED`, { error: msg });
  // 영구 기록 + 어드민 벨 (Discord secret 미설정이어도 pull 로 보이게).
  try { await reportCronFailure(env, name, err, undefined, 'error'); } catch { /* 리포터 자체 실패 무시 */ }
  const webhook = (env as Env & { DISCORD_WEBHOOK_URL?: string }).DISCORD_WEBHOOK_URL;
  if (webhook) {
    try {
      const { sendDiscordAlert } = await import('./utils/discord-alert');
      await sendDiscordAlert(webhook, `🔴 Cron Failed: ${name}`, msg.slice(0, 1500), 'error');
    } catch { /* discord 자체 실패는 무시 */ }
  }
}

/**
 * 🔴 [wholesale-cron-gate 2026-07-29] 도매 번들 cron no-op — 정산 이중성숙 차단.
 *
 * 배경: 소비자(ur-live)와 도매(ur-wholesale)는 **같은 entry `src/worker/index.ts` 를 두 번 빌드**한다
 *   (`build-worker.js`; `WHOLESALE_BUNDLE` 은 라우트 포함 여부만 가른다). 그래서 도매 번들도 지금까지
 *   `handleCronScheduled` 를 그대로 싣고 있었고, 도매 Pages 대시보드에 cron trigger 가 걸리는 순간
 *   `matureSupplierSettlements`·예치금/출금 reconcile 이 **이중 실행 → 이중 지급**이었다.
 *   기존 방어는 "대시보드에서 설정 안 함" 뿐이라 레포가 지킬 수 없었다(가드 0).
 *
 * ⚠️ 극성 — 최대 위험은 도매가 아니라 **소비자 cron 이 조용히 죽는 것**이다. 호출부(index.ts)는
 *   `__INCLUDE_WHOLESALE__ === true`(도매 확실)일 때만 이 no-op 을 쓰고, define 미치환/undefined/문자열은
 *   **전부 실제 핸들러로 폴백**한다(최악 = 현행 동작, 회귀 0). 느슨한 `__INCLUDE_WHOLESALE__ ?` 금지 —
 *   `wholesale-cron-gate.test.ts` 가 빨강.
 *
 * ⚠️ 정산 로직 무접촉 — 실행 *주체*만 가른다. 이 함수는 아무 머니 함수도 부르지 않는다.
 * 롤백: index.ts 의 삼항을 `scheduled: handleCronScheduled,` 로 환원(1줄).
 */
export const WHOLESALE_CRON_NOOP_MARKER = '[wholesale-cron-gate] skipped cron on wholesale bundle'

/** 도매 번들에서 cron 이 발화하면 아무 일도 하지 않는다. 무음 금지 — 설정 실수이므로 로그는 남긴다. */
export async function wholesaleCronNoop(event: ScheduledEvent): Promise<void> {
  console.error(WHOLESALE_CRON_NOOP_MARKER, event?.cron ?? '')
}

/**
 * 이 디스패처가 받는 cron 문자열 전체 — **명부는 `cron-expected.ts` 가 SSOT** 다.
 *
 * 여기에 목록을 다시 두지 않는다. 같은 목록이 두 곳에 있으면 반드시 갈라지고, 갈라진 쪽이
 * 조용한 오탐(정상 발화를 `cron-unmatched` 로 기록)이나 조용한 사각지대(침묵을 못 봄)가 된다.
 * 드리프트는 `cron-expected.test.ts` 가 소스의 분기를 파싱해 강제한다.
 */
const HANDLED_CRONS = new Set(ACCEPTED_CRON_EXPRESSIONS)

/**
 * ⚠️ cron 워커는 이 파일만이 아니라 `worker/index.ts` **번들 전체**로 배포된다(utils·features 포함).
 * 2026-08-01 까지 `worker-deploy.yml` 트리거가 세 경로뿐이라 그 밖의 변경은 **Pages 에만 가고
 * cron 은 옛 코드로 돌았다**(#914 가 그렇게 안 올라갔다). 사유·수리는 그 워크플로 주석 참조.
 */
export async function handleCronScheduled(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  const cron = event.cron;

  // 💓 2026-07-28: 성공·실패 무관 하트비트. safeCron 은 **예외가 날 때만** 기록했는데,
  //   실제로 아픈 정지는 예외가 없다(cron 미발화 / 게이트 OFF 조기 return / 내부 .catch 로 전부 삼킴).
  //   유어애즈 자동 정비가 셋째 경우로 07-26 부터 멈춘 걸 아무도 몰랐다(#793).
  //   여기 한 곳이 68개 작업 전부의 진입점이라, 이 줄들이 곧 전체 커버리지다.
  const safeCron = async (name: string, task: () => Promise<unknown>) => {
    const t0 = Date.now();
    let ok = true;
    let out: unknown;
    try {
      // 반환값이 있으면 '무엇을 했나'까지 기록한다 — 0건으로 끝난 게 '할 일이 없어서'인지
      // '조용히 실패해서'인지 구분하려면 실행 사실만으로는 부족하다.
      out = await task();
    } catch (err) {
      ok = false;
      await notifyCronFailure(env, name, err);
    } finally {
      // 기록 자체는 절대 throw 하지 않는다(관측이 기능을 막으면 안 된다).
      await recordCronBeat(env, name, ok, Date.now() - t0, cron, out);
    }
  };

  // 🔇 2026-07-29: **매칭되지 않은 트리거**를 기록한다. 지금까지 이 침묵은 완전히 안 보였다 —
  //   CF 에 등록은 됐는데 아래 `cron === '...'` 중 어디에도 안 걸리면 하트비트도 실패도 남지 않아,
  //   "등록했으니 돌겠지"와 "등록했는데 무동작"이 관측상 **구분 불가**였다.
  //   0단계(표기 교정) 판정을 오염시키는 것이 정확히 이 침묵이라, 표기를 바꾸기 전에 먼저 넣는다.
  //   비용: 매칭 실패했을 때만 1 write. 정상 발화에는 아무것도 하지 않는다.
  if (!HANDLED_CRONS.has(cron)) {
    ctx.waitUntil(safeCron('cron-unmatched', async () => `cron=${cron} 에 대응하는 핸들러가 없다`));
  }

  // 🔑 **돌긴 도는데 못 하는 일**을 남긴다 — cron 캐리어(Workers)는 시크릿이 0개인데 머니 작업
  //   셋이 TOSS_SECRET_KEY 를 읽는다(없으면 환불·정합이 **에러 없이 스킵**되고 `ok:true` 만 남는다).
  //   판정/문구는 `envBeatFor` 로 옮겼다 — 규칙을 소스 정규식이 아니라 **행동으로** 검사하려고.
  const envBeat = envBeatFor(cron, env as unknown as Record<string, unknown>);
  if (envBeat) ctx.waitUntil(safeCron('cron-env-missing', async () => envBeat));

  // 🛡️ 2026-06-09: 어드민 단체메일 큐 drainer — 2분마다 한 batch 씩 멱등 발송.
  //   요청 안에서 수천 명 발송하던 것을 cron 으로 이전 (CPU/wall 한도 + per-recipient 멱등 hardening).
  //   ⏰ 2026-08-11: `*/2` 는 **등록된 적이 없어** 이 drainer 가 한 번도 안 돌았다. `*/5` 로 이사(주기 2→5분).
  if (cron === '*/5 * * * *') {
    ctx.waitUntil(safeCron('bulk-email-drain', () => handleBulkEmailDrain(env)));
  }

  if (cron === '*/5 * * * *') {
    // 📰 2026-08-03 — 일일 다이제스트. 발화 안 하던 `0 * * * *` 에서 이사. **일간이 아니라 `*/5` 인 이유**:
    //   내부 `getUTCHours()===22`(KST 07:00) 게이트가 있어 일간으로 옮기면 no-op, 게이트를 고치면
    //   받는 시각이 새벽 4시로 바뀐다. 5분 슬롯이면 원래 시각 보존 + 그 외엔 게이트 false 라 DB 0.
    ctx.waitUntil(safeCron('ops-daily-digest', async () => {
      const { isOpsDigestHour, runOpsDailyDigest } = await import('./cron/ops-daily-digest');
      if (isOpsDigestHour()) await runOpsDailyDigest(env);
    }));
    ctx.waitUntil(safeCron('scheduled-cleanup', async () => {
      const { handleScheduled } = await import('./cron/scheduled-cleanup')
      return handleScheduled(env)
    }));
    // 🛡️ 2026-05-07: 알림톡 발송 실패 자동 재시도 (max 3회, exponential backoff)
    ctx.waitUntil(safeCron('retry-alimtalk', () => handleRetryAlimtalk(env)));
    // 🛡️ 2026-05-12: 이메일 / 푸시 dead-letter 재시도 drainer
    ctx.waitUntil(safeCron('retry-email-failures', () => retryEmailFailures(env)));
    ctx.waitUntil(safeCron('retry-push-failures', () => retryPushFailures(env)));
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
    // 🎯 [urads-split Phase E 2026-07-18] ads-autobid → ur-ads worker cron 으로 이관(wrangler-ads.toml "*/5").
    //   이중실행 방지 위해 메인에서 제거 — 재도입=원복.
    // if (env.ADS_AUTOBID_ENABLED === 'true') {
    //   ctx.waitUntil(safeCron('ads-autobid', async () => {
    //     const { runAutobidAll } = await import('../features/marketing/api/autobid')
    //     return runAutobidAll(env)
    //   }));
    // }
  }

  // ⏰ 2026-08-11: `0 * * * *` 는 등록된 적이 없다 → 이 블록 7개가 통째로 침묵했다(하트비트 0).
  //   계정 cron 한도 5개를 다 써서 트리거를 못 늘리므로 `*/5` 틱 위에서 **:25 게이트**로 시간당 1회.
  if (cron === '*/5 * * * *' && slotDue(event.scheduledTime, { minute: 25 })) {
    // 🥗 2026-07-15 워커 다이어트(대표 승인): 소셜 홍보 유지보수 크론 배선 분리 — 소셜 자동화 그래프를 워커에서
    //   완전 제거해 CF 1MB 압축한도 회복. 기능 게이트 OFF·미사용이라 미실행 무해. 재도입 시 원복.
    // ctx.waitUntil(safeCron('social-maintenance', async () => {
    //   const { handleSocialMaintenance } = await import('./cron/social-maintenance')
    //   return handleSocialMaintenance(env)
    // }));
    // ⏰ 2026-07-02 (#5 승인 SLA): 24h+ 대기 셀러 전환 신청 어드민 리마인드(20h dedup = 하루 1회꼴).
    ctx.waitUntil(safeCron('seller-approval-reminder', async () => {
      const { handleSellerApprovalReminder } = await import('./cron/seller-approval-reminder')
      return handleSellerApprovalReminder(env)
    }));
    // 🛡️ 2026-05-24: 별점 "신규" 영구 fix — daily (18 UTC) 외에도 매시간 catch.
    //   신규 활성 상품이 들어오면 최대 1시간 안에 ★ 노출. idempotent (review_count>0 skip).
    ctx.waitUntil(safeCron('auto-seed-reviews-hourly', () => handleAutoSeedReviews(env)));
    // 🔄 2026-07-05 데모 추첨 마감 자동 연장 → **2026-08-03 에 아래 `0 18` 일간 블록으로 옮겼다.**
    //    이 시간당 블록은 `wrangler.toml` crons 에 **등록돼 있지 않다**(3단계 보류 — 도매 예치금
    //    자동 환불 규모 미측정). 즉 여기 있는 동안은 **한 번도 안 돌았다**(하트비트 0건으로 실측).
    // 🖼️ 2026-07-21 (대표 "남은 이상적인 것"): 데모 갤러리 외부 CDN URL → R2 점진 이관(시간당 상품 2개,
    //   외부 fetch ≤10 — 서브리퀘스트 예산 보호). 멱등(img_rehost_done meta 종결) — 수렴 후 SELECT 1회 no-op.
    ctx.waitUntil(safeCron('demo-image-rehost', async () => {
      const { handleDemoImageRehost } = await import('./cron/demo-image-rehost');
      return handleDemoImageRehost(env);
    }));
    // 🏷️ 2026-07-19 (대표 — 카드 제목 중복 제거, "직접 해줘"): 기존 데모 상품명의 '{매장명} · ' 프리픽스를
    //   배포 후 자동으로 in-place 제거(멱등 — 치유 완료 후엔 SELECT 1회 + no-op). 시드 heal 블록과 동일 함수.
    ctx.waitUntil(safeCron('demo-name-heal', async () => {
      const { healDemoNamesInPlace } = await import('../features/admin/api/admin-products.routes');
      return healDemoNamesInPlace(env.DB);
    }));
    // 🏭 2026-06-08 TAX-1: 공급사 정산 성숙 매시간 tick (기존 maturity helper 호출, idempotent).
    // 🏭 2026-06-08 NOTI-1: 재입고 알림 — 구독 상품 재입고(stock>0) 시 판매사 알림.
    ctx.waitUntil(safeCron('wholesale-restock-notify', () => handleWholesaleRestockNotify(env)));
    // 🔔 2026-07-01: 알림 채널 설정 회귀 감시 — LIVE 채널 키가 사라지면(true→false) 1회 critical
    //   경보(cron_failures + 어드민 벨). VAPID 미설정으로 웹푸시가 조용히 죽어있던 사고 재발 방지.
    ctx.waitUntil(safeCron('channel-watchdog', async () => {
      const { handleChannelWatchdog } = await import('./cron/channel-watchdog');
      return handleChannelWatchdog(env);
    }));
  }

  if (cron === '0 18 * * *') {
    ctx.waitUntil(safeCron('auto-settlement', () => handleAutoSettlement(env)));
    ctx.waitUntil(safeCron('expired-voucher-refund', () => handleExpiredVoucherRefunds(env)));
    // 🎭 2026-08-03 — 시간당 블록에서 **여기로 이사**. 데모 추첨 마감 롤링 연장 + 추첨 설정이 없는
    //   이용권 데모(숙박 72개)에 seed. 원래 자리(`0 * * * *`)가 wrangler crons 에 없어 **한 번도
    //   안 돌았다**(하트비트 0건 실측) → 숙박 데모가 배지 없이 "진짜 상품"으로 보이고 있었다.
    //   ⚠️ 머니 무관 · `demo-%` slug 만 건드림 · 완전 멱등이라 하루 1회면 충분하다.
    ctx.waitUntil(safeCron('demo-fcfs-renew', () => renewDemoFcfs(env)));
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
    // 🎯 [urads-split Phase E 2026-07-18] 유어애즈 일일 cron 5종(price-refresh/rank-track/metrics-snapshot/
    //   alerts/autobid-shadow) → ur-ads worker cron("0 18 * * *")으로 이관 — src/worker-ads/index.ts scheduled().
    //   같은 D1 이라 데이터 정합 무변. 이중실행 방지 위해 메인에서 제거(마지막 marketing 참조 → 번들 추가 감소). 재도입=원복.
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

  // 🛡️ KT Alpha catalog sync — 매일 12:30 KST(03:30 UTC). 하루 1회 → KV 한도 무관(D1 only).
  if (cron === '*/5 * * * *' && slotDue(event.scheduledTime, { minute: 30, hour: 3 })) {
    ctx.waitUntil(safeCron('kt-alpha-catalog-sync', async () => {
      const { runKtAlphaCatalogSync } = await import('./cron/kt-alpha-catalog-sync')
      await runKtAlphaCatalogSync(env as { DB: D1Database })
    }))
    // 🌐 바이어 풀 완전 무인 — 저장 소스 자동 수집 + 웹사이트 이메일 보강(이중 게이트).
    ctx.waitUntil(safeCron('buyer-autofetch', async () => {
      const { handleBuyerAutofetchCron } = await import('./cron/buyer-autofetch')
      await handleBuyerAutofetchCron(env)
    }))
  }

  // 🛡️ 이용권 주소 → 좌표 일괄 변환. 페이지 진입마다 Kakao 호출하던 것을 여기로 모았다(일 1만 → ~10).
  if (cron === '*/5 * * * *' && slotDue(event.scheduledTime, { minute: 35, hour: 3 })) {
    ctx.waitUntil(safeCron('restaurant-geocode', async () => {
      const { runRestaurantGeocode } = await import('./cron/restaurant-geocode')
      await runRestaurantGeocode(env as { DB: D1Database; KAKAO_REST_API_KEY?: string })
    }))
    // 🗑️ 2026-07-22 (R2 최적화 #3): 고아 R2 객체 정리 — 기본 리포트-온리(삭제는 R2_ORPHAN_CLEANUP_ENABLED
    //   플래그 + 60일 경과 + biz-cert 제외 + 회당 50개 캡). 일 1회면 충분(R2 list 비용 절감).
    ctx.waitUntil(safeCron('r2-orphan-cleanup', async () => {
      const { r2OrphanCleanup } = await import('./cron/r2-orphan-cleanup')
      await r2OrphanCleanup(env)
    }))
    // 🖼️ 2026-07-22 (대표 "이미지 자동 모니터링"): 커버 깨짐 표본검증 → 임계 초과 시 알림(dedup 12h).
    ctx.waitUntil(safeCron('image-health-monitor', async () => {
      const { imageHealthMonitor } = await import('./cron/image-health-monitor')
      await imageHealthMonitor(env)
    }))
  }

  if (cron === '*/5 * * * *' && slotDue(event.scheduledTime, { minute: 40, hour: 9 })) {
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
    // ⏰ 2026-07-19 (운영 자동화 ② — 게이트 OPS_SEQUENCES_ENABLED, 기본 OFF): 소비자 시퀀스 2종.
    //   드랍 D-1 예고(fcfs 응모자, KST 18:00) + 체험단 게시 리마인드(당첨 48h 경과, 평생 1회).
    ctx.waitUntil(safeCron('drop-d1-reminder', async () => {
      const { runDropD1Reminder } = await import('./cron/drop-d1-reminder')
      await runDropD1Reminder(env as Parameters<typeof runDropD1Reminder>[0])
    }))
    ctx.waitUntil(safeCron('experience-post-reminder', async () => {
      const { runExperiencePostReminder } = await import('./cron/experience-post-reminder')
      await runExperiencePostReminder(env as Parameters<typeof runExperiencePostReminder>[0])
    }))
    // 🧾 2026-07-13: 상권 쿠폰 만료 임박(D-3) 알림 + 만료 스위핑(status='expired'). 병렬 엔티티·머니 0.
    ctx.waitUntil(safeCron('district-coupon-expire', async () => {
      const { runDistrictCouponExpireCron } = await import('./cron/district-coupon-expire')
      await runDistrictCouponExpireCron(env as Parameters<typeof runDistrictCouponExpireCron>[0])
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
    // ⏰ 2026-08-03 — 아래 넷은 발화하지 않는 `0 * * * *` 블록(wrangler crons 미등록 — 하트비트 0건
    //   실측)에서 **여기로 이사**. 머니 무관 + 자체 상한 + 시각 게이트 없음이라 일간도 유효하다.
    //   cron-stale-watch=멈춤 감시 · anomaly-detect=어뷰징 탐지 · wishlist-*=찜 재입고/가격인하(CAP 200).
    //   ⚠️ 두고 온 것: `ops-daily-digest`(내부 `getUTCHours()===22` 게이트 — 여기 오면 조용히 no-op)와
    //      머니 경로(교환권 재발송·환불 재시도·webhook drain·도매 정산) = 대표 결정 + staging 룰.
    ctx.waitUntil(safeCron('cron-stale-watch', async () => {
      const { handleCronStaleWatch } = await import('./cron/cron-stale-watch');
      await handleCronStaleWatch(env);
    }));
    ctx.waitUntil(safeCron('anomaly-detect', () => handleAnomalyDetection(env)));
    ctx.waitUntil(safeCron('wishlist-restock-notify', async () => {
      const { handleWishlistRestockNotify } = await import('./cron/wishlist-notify');
      return handleWishlistRestockNotify(env);
    }));
    ctx.waitUntil(safeCron('wishlist-price-drop-notify', async () => {
      const { handleWishlistPriceDropNotify } = await import('./cron/wishlist-notify');
      return handleWishlistPriceDropNotify(env);
    }));
    // 🎫 KT Alpha 교환권 발송 실패 자동 복구(retry<3·backoff·14일내·run당 20건·NOT EXISTS 이중발송 0).
    //   2026-08-03 대표 승인 — 발화 안 하는 `0 * * * *` 에 있어 **돈 낸 교환권이 영영 안 가고 있었다.**
    //   ⚠️ 일간이라 복구가 최대 24h 지연된다. 즉시 필요하면 어드민 `POST /_run-cron {kt-alpha-voucher-retry}`.
    ctx.waitUntil(safeCron('kt-alpha-voucher-retry', async () => {
      const { handleKtAlphaVoucherRetry } = await import('./cron/kt-alpha-voucher-retry');
      return handleKtAlphaVoucherRetry(env);
    }));
    // 💰 2026-08-03 (대표 "재처리 3개도 다 진행해줘") — 발화 안 하는 `0 * * * *` 에서 이사. 보류 사유였던
    //   규모를 라이브 D1 로 **실측**: reconcile 0건 · 예치금 원장 172,800원 · 환불실패 테이블 미생성 ·
    //   FAILED 웹훅 0 · pending 숙소예약 0 ⇒ 돈이 움직이는 게 아니라 **안전망을 켜는 것**이다.
    ctx.waitUntil(safeCron('toss-refund-retry', () => handleTossRefundRetry(env)));
    // FAILED 웹훅 백로그 **감시**(Discord 요약). 자동 재처리는 잠금 해제 후 2단계 — 지금은 관측만.
    ctx.waitUntil(safeCron('webhook-failed-drain', async () => {
      const { handleWebhookFailedDrain } = await import('./cron/webhook-failed-drain');
      return handleWebhookFailedDrain(env);
    }));
    // 차감됐는데 PAID 못 간 예치금 주문 자동 환불(미회수 0). 라이브 실측 대상 0건 · 예치금 원장 총 172,800원.
    ctx.waitUntil(safeCron('wholesale-deposit-reconcile', async () => {
      const { reconcileOrphanedDepositOrders } = await import('../features/supply/api/wholesale-deposit-core')
      return reconcileOrphanedDepositOrders(env.DB)
    }));
    // 출금 원장 자가복구 — **재출금 방지**라 안 도는 쪽이 위험하다(테이블 미생성 = 아직 출금 0).
    ctx.waitUntil(safeCron('wholesale-withdrawal-reconcile', async () => {
      const { reconcileWithdrawalLedgers } = await import('../features/supply/api/supplier-withdrawal-core')
      return reconcileWithdrawalLedgers(env.DB)
    }));
    // 미결제 pending 숙소 예약 만료(30분 경과). 재고 미조작 — 정리 목적. 실측 대상 0건.
    ctx.waitUntil(safeCron('stay-pending-expire', async () => {
      const { handleStayPendingExpire } = await import('./cron/stay-pending-expire')
      return handleStayPendingExpire(env)
    }));
  }

  // 🔴 2026-07-29: 세 표기를 전부 받는다. CF 는 **등록된 문자열 그대로** event.cron 에 넣기 때문에,
  //   `0 20 * * 0`(CF 가 거부하는 표기)을 `0 20 * * SUN` 으로 교정해 등록하는 순간 이 분기가
  //   조용히 매칭 실패한다 — 등록은 됐는데 아무 일도 안 일어나는, 이 감사가 다룬 바로 그 클래스.
  if (cron === '0 20 * * 0' || cron === '0 20 * * SUN' || cron === '0 20 * * 7') {
    ctx.waitUntil(safeCron('d1-backup', () => handleD1Backup(env as any)));
  }

  if (cron === '0 0 * * 1') {
    // 🛡️ 2026-05-21 Phase C: 주 1회 정산 자동 생성 — admin 검토용 pending payouts 생성.
    ctx.waitUntil(safeCron('payouts-generate', () => handlePayoutsGenerate(env)));
    // 📊 2026-07-05 (자문 ⑤): 주간 조종석 숫자 5개 — 어드민 벨 + Discord (read-only 집계, fail-soft).
    ctx.waitUntil(safeCron('weekly-metrics-summary', async () => {
      const { runWeeklyMetricsSummary } = await import('./cron/weekly-metrics-summary');
      return runWeeklyMetricsSummary(env);
    }));
    // 📈 2026-07-19 (운영 자동화 ④): 주간 코호트 리포트 — 최근 8주 가입 코호트 전환/리텐션 표 1장.
    //   read-only, 벨+Discord(+설정 시 메일). weekly-metrics(스냅샷)와 상보 — 추세용.
    ctx.waitUntil(safeCron('weekly-cohort-report', async () => {
      const { runWeeklyCohortReport } = await import('./cron/weekly-cohort-report');
      return runWeeklyCohortReport(env);
    }));
    // 📝 2026-07-01: 블로그 AI 홍보 초안 주간 1편(비공개, 관리자 검토 후 발행).
    //   킬스위치 BLOG_AI_DRAFTS_ENABLED='true' 일 때만 — 기본 OFF(토큰 낭비 0). 홍보 전용.
    ctx.waitUntil(safeCron('blog-ai-draft', async () => {
      const { handleBlogAiDraft } = await import('./cron/blog-ai-draft');
      return handleBlogAiDraft(env);
    }));
    // 🔧 2026-07-18: off-live user_id backfill 자동 스위퍼(데이터 감사 3단계 자동화 — 대표 "실행도 자동으로").
    //   멱등 + 모호매핑 0 + user_points 충돌은 자동병합 안 함(어드민 벨 보고만). 대상 0 이면 no-op.
    ctx.waitUntil(safeCron('user-id-backfill-sweep', async () => {
      const { handleUserIdBackfillSweep } = await import('./cron/user-id-backfill-sweep');
      return handleUserIdBackfillSweep(env);
    }));
    // 🥗 2026-07-15 워커 다이어트(대표 승인): 소셜 홍보 초안 주간 크론 배선 분리(위 social-maintenance 와 동일 사유).
    //   기본 OFF 라 미실행 무해. 재도입 시 원복.
    // ctx.waitUntil(safeCron('social-draft', async () => {
    //   const { handleSocialDraft } = await import('./cron/social-draft');
    //   return handleSocialDraft(env);
    // }));
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
      // 🎯 [urads-split Phase E 2026-07-18] 유어애즈 AI 주간 리포트 → ur-ads worker cron("0 0 * * 1")으로
      //   이관(src/worker-ads/index.ts, 주당 1회 멱등 유지) — 메인의 마지막 marketing cron 참조 제거. 재도입=원복.
    }));
  }
}
