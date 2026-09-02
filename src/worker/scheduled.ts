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
// 🩹 2026-08-31: 놓친 하루치를 같은 날 안에 만회한다(무료 cron 미발화 + 예산 고갈 대응). 상세는 그 파일 상단.
import type { SlotSpec } from './cron-slot';
import { beginCatchup, catchupOpens, claimCatchupJob, summarizeCatchup, type CatchupState } from './cron-catchup';

// 🛡️ 2026-05-18: handleScheduled (49KB) dynamic import — cron 발생 시만 로드.
import { runReconciliation } from './cron/reconciliation';
import { handleAgencyAutoSettle } from './cron/agency-auto-settle';
import { handleAgencyTierEval } from './cron/agency-tier-eval';
import { handleAgencyMonthlyInvoices } from './cron/agency-monthly-invoices';
import { handleAgencyMonthlyReport } from './cron/agency-monthly-report';
import { handleSellerTierEval } from './cron/seller-tier-eval';
import { handleWholesaleGradeEval } from './cron/wholesale-grade-eval';
import { handleWholesaleRestockNotify } from './cron/wholesale-restock-notify';
import { handleAnomalyDetection } from './cron/anomaly-detect';
// 🌇 일몰 정지(롤백 시 아래 호출과 함께 해제): import { handleAgencySellerMatch } from './cron/agency-seller-match';
import { handleRetryAlimtalk } from './cron/retry-alimtalk';
import { retryEmailFailures, retryPushFailures } from './cron/retry-notifications';
import { handleAppointmentReminder } from './cron/appointment-reminder';
import { handleAppointmentNoshowAlert } from './cron/appointment-noshow-alert';
import { handlePayoutsGenerate } from './cron/payouts-generate';
import { handleTossRefundRetry } from './cron/toss-refund-retry';
import { handleInfluencerPayout } from './cron/influencer-payout';
import { handleGroupBuyDeadlinePush } from './cron/group-buy-deadline-push';
import { handleGroupBuyFeedCache } from './cron/group-buy-feed-cache';
import { handleCachePrewarm } from './cron/cache-prewarm';
// 🛡️ 2026-06-09: 어드민 단체메일 큐 drainer (요청 안에서 발송 X → CPU/멱등 hardening).
import { handleBulkEmailDrain } from './cron/bulk-email-drain'; import { drainOutreachEmails } from '../features/marketing/api/outreach-email';
// 🛡️ 2026-05-24: 모든 신규 활성 상품 (공구/쇼핑/교환권) 에 자동 허위리뷰 시드.
import { handleAutoSeedReviews } from './cron/auto-seed-reviews';
import { calculateAllAgencyIncentives } from '../features/agency/api/agency-incentives.routes';
import { getFeatureFlags } from './utils/feature-flags';
// 🏭 2026-06-05 (사용자 요청 — 라이브 중단 중 cron 낭비 제거): 라이브 전용 cron 게이팅.
//   LIVE_COMMERCE_SUSPENDED=true 동안 라이브 방송 관련 cron(5분마다 헛도는 DB 조회)을 건너뜀.
//   플래그만 false 로 되돌리면 즉시 복원 — 코드 보존.
import { LIVE_COMMERCE_SUSPENDED } from '../shared/feature-flags';
import { logError } from './utils/logger';
import { reportCronFailure } from './utils/cron-reporter';
import { recordCronBeat, expectedMaxAgeMinutes } from './utils/cron-heartbeat';
// 📏 2026-09-02: 작업별 D1 읽기 행 수 — 9/1 무료 한도(500만/일) 사고. 근거는 utils/d1-read-meter.ts 헤더.
import { installTaskMeteredEnv, runInMeter } from './utils/d1-read-meter-als';
import { newMeter } from './utils/d1-read-meter';
import { ACCEPTED_CRON_EXPRESSIONS } from './utils/cron-expected';
import { envBeatFor } from './utils/cron-required-env';
import { runDailyLane } from './cron/daily-lane';

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
  // 📏 env 의 D1 을 계량 래퍼로 바꾼다 — 아래 모든 작업 클로저가 이 `env` 바인딩을 잡으므로 여기 한 줄이
  //   곧 전체 커버리지다(하트비트와 같은 이유로 같은 자리). 작업 밖의 쿼리(`__tick` 등)는 세지 않는다.
  env = installTaskMeteredEnv(env);

  // 🔬 2026-08-22 진단 프로브(`__tick`) — 왜 맨 앞인지·무엇을 가르는지는 `utils/cron-heartbeat.ts` 상단 주석.
  // 🔬 2026-08-25: 키를 **트리거별**로 쪼갠다(`__tick:<cron식>`). 전역 키 하나였을 땐 같은 분에
  //   여러 트리거가 울리면 마지막 하나가 덮어써서 **어느 트리거가 울렸는지 알 수 없었다.**
  //   지금 못 가리고 있는 두 질문이 정확히 그것이다: ① `*/15` 전용 트리거가 실제로 발화하는가
  //   (`*/5` 와 매 분 겹친다) ② 2026-08-24 에 `0 18` 이 안 울린 건가 인보케이션이 죽은 건가.
  //   ⚠️ **쓰기 횟수는 그대로다** — 키만 달라진다(진단을 영구 부채로 남기지 않는다는 원칙 준수).
  ctx.waitUntil(recordCronBeat(env, `__tick:${cron}`, true, 0, cron)); // cron-heartbeat-ok: 작업이 아니라 하트비트 **자체**다 — safeCron 으로 감싸면 진단의 핵심인 '아무도 예산을 안 쓴 시점'을 잃는다
  // 💓 2026-07-28: 성공·실패 무관 하트비트. safeCron 은 **예외가 날 때만** 기록했는데,
  //   실제로 아픈 정지는 예외가 없다(cron 미발화 / 게이트 OFF 조기 return / 내부 .catch 로 전부 삼킴).
  //   유어애즈 자동 정비가 셋째 경우로 07-26 부터 멈춘 걸 아무도 몰랐다(#793).
  //   여기 한 곳이 68개 작업 전부의 진입점이라, 이 줄들이 곧 전체 커버리지다.
  const safeCron = async (name: string, task: () => Promise<unknown>, gapMin?: number) => {
    const t0 = Date.now();
    let ok = true;
    let out: unknown;
    // 📏 이 작업이 읽은 D1 행 수 — 던져도 그때까지 읽은 양은 남긴다(실패한 작업이 제일 많이 읽는다).
    const meter = newMeter();
    try {
      // 반환값이 있으면 '무엇을 했나'까지 기록한다 — 0건으로 끝난 게 '할 일이 없어서'인지
      // '조용히 실패해서'인지 구분하려면 실행 사실만으로는 부족하다.
      out = await runInMeter(meter, task);
    } catch (err) {
      ok = false;
      await notifyCronFailure(env, name, err);
    } finally {
      // 기록 자체는 절대 throw 하지 않는다(관측이 기능을 막으면 안 된다).
      await recordCronBeat(env, name, ok, Date.now() - t0, cron, out, gapMin, meter);
    }
  };
  // ⏰ 슬롯 작업은 5분 캐리어가 아니라 **자기 주기**를 신고한다(근거: `expectedMaxAgeMinutes` docblock).
  //
  // 🩹 2026-08-31 — **만회 틱**(매시 :55)이면 이번 주기에 이미 돈 작업을 건너뛰고,
  //   한 틱에 새로 시작하는 수를 제한한다. 정시 틱은 `catchup === null` 이라 **한 바이트도 안 바뀐다**
  //   — 그게 이 기능의 안전장치다(최악의 경우 = 현행 그대로).
  const nowMs = typeof event.scheduledTime === 'number' && Number.isFinite(event.scheduledTime)
    ? event.scheduledTime : Date.now();
  const catchup: CatchupState | null = cron === '*/5 * * * *'
    ? await beginCatchup(event.scheduledTime, env.DB)
    : null;
  const slotCron = (expr: string) => (n: string, t: () => Promise<unknown>) => {
    if (catchup && !claimCatchupJob(catchup, n, expr, nowMs)) return Promise.resolve();
    return safeCron(n, t, expectedMaxAgeMinutes(expr) ?? undefined);
  };
  /**
   * 이 슬롯이 지금 열리는가 — 정시거나, 만회 틱이면서 오늘 주기가 이미 시작됐거나.
   *
   * ⚠️ **트리거 검사(`cron === …`)는 일부러 호출부에 남겨 뒀다.** 여기로 흡수하면
   *   `check-cron-slot-registered` 가 `if (cron === 'X')` 로 블록을 읽는 파서라
   *   슬롯 블록 대부분을 **못 보게 된다**(이 레포가 잠금표에서 겪은 '낡은 지도'와 같은 클래스).
   *   `catchup` 자체가 5분 캐리어에서만 만들어지므로 중복 검사여도 의미는 갈리지 않는다.
   */
  const slotOpen = (spec: SlotSpec) =>
    slotDue(event.scheduledTime, spec) || catchupOpens(catchup, nowMs, spec);

  // 🔇 2026-07-29: **매칭되지 않은 트리거**를 기록한다 — CF 에 등록은 됐는데 아래 `cron === '...'` 중
  //   어디에도 안 걸리면 하트비트도 실패도 안 남아 "등록했으니 돌겠지"와 "무동작"이 **구분 불가**였다.
  //   0단계(표기 교정) 판정을 오염시키는 것이 정확히 이 침묵이다. 비용: 매칭 실패 때만 1 write.
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
  // ⏰ 2026-08-11: `*/2` 미등록으로 이 drainer 는 한 번도 안 돌았다 → `*/5` 로 이사(주기 2→5분).
  if (cron === '*/5 * * * *') { ctx.waitUntil(safeCron('bulk-email-drain', () => handleBulkEmailDrain(env))); ctx.waitUntil(safeCron('outreach-email-drain', () => drainOutreachEmails(env))); } // 📮 제안 이메일 드립(일일캡·CAS)

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
    // 🎯 [urads-split Phase E 2026-07-18] ads-autobid 는 ur-ads 로 이관(이중실행 방지). 재도입은 `autobid` 의 `runAutobidAll` 을 `ADS_AUTOBID_ENABLED` 게이트 뒤 safeCron 으로.
  }

  // ⏰ 2026-08-11: `0 * * * *` 미등록으로 이 블록 7개가 침묵했다(하트비트 0). 트리거 한도(5)를 다 써
  //   `*/5` 틱 위 :25 게이트로 시간당 1회. 왜 이 방식인지는 `cron-slot.ts` 참조.
  // 🗄️ 2026-08-22: 재개 가능한 분할 백업(커서로 시간당 조금씩). 기존 주간 백업은 DB 가 263 MB 로
  //   자라 워커 메모리를 넘겨 08-02 이후 조용히 멈춰 있었다 — 근거는 `cron/d1-backup-chunked.ts` 헤더.
  if (cron === '*/5 * * * *' && [5, 20, 35, 50].some((m) => slotDue(event.scheduledTime, { minute: m }))) {
    ctx.waitUntil(slotCron('5,20,35,50 * * * *')('d1-backup-chunked', async () => {
      const { handleChunkedBackup } = await import('./cron/d1-backup-chunked')
      return handleChunkedBackup(env as never)
    }));
  }

  if (cron === '*/5 * * * *' && slotDue(event.scheduledTime, { minute: 25 })) {
    // 🥗 2026-07-15 워커 다이어트(대표 승인): social-maintenance 배선 제거 — CF 1MB 압축한도 회복.
    //   게이트 OFF·미사용이라 무해. 재도입은 `./cron/social-maintenance` 를 slotCron('25 * * * *') 로 배선.
    // ⏰ 2026-07-02 (#5 승인 SLA): 24h+ 대기 셀러 전환 신청 어드민 리마인드(20h dedup = 하루 1회꼴).
    ctx.waitUntil(slotCron('25 * * * *')('seller-approval-reminder', async () => {
      const { handleSellerApprovalReminder } = await import('./cron/seller-approval-reminder')
      return handleSellerApprovalReminder(env)
    }));
    // 🛡️ 2026-05-24: 별점 "신규" 영구 fix — daily (18 UTC) 외에도 매시간 catch.
    //   신규 활성 상품이 들어오면 최대 1시간 안에 ★ 노출. idempotent (review_count>0 skip).
    ctx.waitUntil(slotCron('25 * * * *')('auto-seed-reviews-hourly', () => handleAutoSeedReviews(env)));
    // 🔄 2026-07-05 데모 추첨 마감 자동 연장 → **2026-08-03 에 아래 `0 18` 일간 블록으로 옮겼다.**
    //    이 시간당 블록은 `wrangler.toml` crons 에 **등록돼 있지 않다**(3단계 보류 — 도매 예치금
    //    자동 환불 규모 미측정). 즉 여기 있는 동안은 **한 번도 안 돌았다**(하트비트 0건으로 실측).
    // 🖼️ 2026-07-21 (대표 "남은 이상적인 것"): 데모 갤러리 외부 CDN URL → R2 점진 이관(시간당 상품 2개,
    //   외부 fetch ≤10 — 서브리퀘스트 예산 보호). 멱등(img_rehost_done meta 종결) — 수렴 후 SELECT 1회 no-op.
    ctx.waitUntil(slotCron('25 * * * *')('demo-image-rehost', async () => {
      const { handleDemoImageRehost } = await import('./cron/demo-image-rehost');
      return handleDemoImageRehost(env);
    }));
    // 🏷️ 2026-07-19 (대표 — 카드 제목 중복 제거, "직접 해줘"): 기존 데모 상품명의 '{매장명} · ' 프리픽스를
    //   배포 후 자동으로 in-place 제거(멱등 — 치유 완료 후엔 SELECT 1회 + no-op). 시드 heal 블록과 동일 함수.
    ctx.waitUntil(slotCron('25 * * * *')('demo-name-heal', async () => {
      const { healDemoNamesInPlace } = await import('../features/admin/api/admin-products.routes');
      return healDemoNamesInPlace(env.DB);
    }));
    // 🏭 2026-06-08 TAX-1: 공급사 정산 성숙 매시간 tick (기존 maturity helper 호출, idempotent).
    // 🏭 2026-06-08 NOTI-1: 재입고 알림 — 구독 상품 재입고(stock>0) 시 판매사 알림.
    ctx.waitUntil(slotCron('25 * * * *')('wholesale-restock-notify', () => handleWholesaleRestockNotify(env)));
    // 🔔 2026-07-01: 알림 채널 설정 회귀 감시 — LIVE 채널 키가 사라지면(true→false) 1회 critical
    //   경보(cron_failures + 어드민 벨). VAPID 미설정으로 웹푸시가 조용히 죽어있던 사고 재발 방지.
    ctx.waitUntil(slotCron('25 * * * *')('channel-watchdog', async () => {
      const { handleChannelWatchdog } = await import('./cron/channel-watchdog');
      return handleChannelWatchdog(env);
    }));
  }

  // 🌆 2026-08-25: 일간 블록을 **네 인보케이션으로 분리**했다(`cron/daily-lane.ts`).
  //   그전엔 작업 16개가 한 인보케이션에서 서브리퀘스트 예산(무료 ~50)을 나눠 썼고, 마르면
  //   뒤쪽이 **에러 없이 잘렸다**. 실측 2026-08-24: 16개 전부 하트비트 없음(정산 성숙 포함).
  //   ⚠️ 분은 5의 배수 + 기존 게이트와 비충돌이어야 한다 — 겹치면 같은 인보케이션이라 분리가 무의미.
  // 🩹 만회: 전용 트리거가 안 울리거나 예산이 마르면 :55 틱이 오늘 안에 이어받는다. `slotCron` 이 이번 주기에 이미 돈 작업을 걸러낸다.
  if (cron === '0 18 * * *' || catchupOpens(catchup, nowMs, { minute: 0, hour: 18 })) {
    runDailyLane('money', { env, ctx, run: slotCron('0 18 * * *'), onFailure: (n, e) => notifyCronFailure(env, n, e) });
  }
  if (cron === '*/5 * * * *' && slotOpen({ minute: 10, hour: 18 })) {
    runDailyLane('integrity', { env, ctx, run: slotCron('10 18 * * *'), onFailure: (n, e) => notifyCronFailure(env, n, e) });
  }
  if (cron === '*/5 * * * *' && slotOpen({ minute: 30, hour: 18 })) {
    runDailyLane('maintenance', { env, ctx, run: slotCron('30 18 * * *'), onFailure: (n, e) => notifyCronFailure(env, n, e) });
  }
  if (cron === '*/5 * * * *' && slotOpen({ minute: 40, hour: 18 })) {
    runDailyLane('growth', { env, ctx, run: slotCron('40 18 * * *'), onFailure: (n, e) => notifyCronFailure(env, n, e) });
  }

  // 🛡️ KT Alpha catalog sync — 매일 12:30 KST(03:30 UTC). 하루 1회 → KV 한도 무관(D1 only).
  if (cron === '*/5 * * * *' && slotOpen({ minute: 30, hour: 3 })) {
    ctx.waitUntil(slotCron('30 3 * * *')('kt-alpha-catalog-sync', async () => {
      const { runKtAlphaCatalogSync } = await import('./cron/kt-alpha-catalog-sync')
      await runKtAlphaCatalogSync(env as { DB: D1Database })
    }))
    // 🌐 바이어 풀 완전 무인 — 저장 소스 자동 수집 + 웹사이트 이메일 보강(이중 게이트).
    ctx.waitUntil(slotCron('30 3 * * *')('buyer-autofetch', async () => {
      const { handleBuyerAutofetchCron } = await import('./cron/buyer-autofetch')
      await handleBuyerAutofetchCron(env)
    }))
  }

  // 🛡️ 이용권 주소 → 좌표 일괄 변환. 페이지 진입마다 Kakao 호출하던 것을 여기로 모았다(일 1만 → ~10).
  if (cron === '*/5 * * * *' && slotOpen({ minute: 35, hour: 3 })) {
    ctx.waitUntil(slotCron('35 3 * * *')('restaurant-geocode', async () => {
      const { runRestaurantGeocode } = await import('./cron/restaurant-geocode')
      await runRestaurantGeocode(env as { DB: D1Database; KAKAO_REST_API_KEY?: string })
    }))
    // 🗑️ 2026-07-22 (R2 최적화 #3): 고아 R2 객체 정리 — 기본 리포트-온리(삭제는 R2_ORPHAN_CLEANUP_ENABLED
    //   플래그 + 60일 경과 + biz-cert 제외 + 회당 50개 캡). 일 1회면 충분(R2 list 비용 절감).
    ctx.waitUntil(slotCron('35 3 * * *')('r2-orphan-cleanup', async () => {
      const { r2OrphanCleanup } = await import('./cron/r2-orphan-cleanup')
      await r2OrphanCleanup(env)
    }))
    // 🖼️ 2026-07-22 (대표 "이미지 자동 모니터링"): 커버 깨짐 표본검증 → 임계 초과 시 알림(dedup 12h).
    ctx.waitUntil(slotCron('35 3 * * *')('image-health-monitor', async () => {
      const { imageHealthMonitor } = await import('./cron/image-health-monitor')
      await imageHealthMonitor(env)
    }))
  }

  if (cron === '*/5 * * * *' && slotOpen({ minute: 40, hour: 9 })) {
    ctx.waitUntil(slotCron('40 9 * * *')('stay-reminder', async () => {
      const { runStayReminderCron } = await import('./cron/stay-reminder')
      await runStayReminderCron(env as { DB: D1Database })
    }))
    // 🛡️ 2026-05-21 Phase B-2: 자체 예약 D-1 reminder (KST 18시).
    ctx.waitUntil(slotCron('40 9 * * *')('appointment-reminder', () => handleAppointmentReminder(env)))
    // 🛡️ 2026-05-18: voucher 만료 D-30/D-7/D-1 알림.
    ctx.waitUntil(slotCron('40 9 * * *')('stay-voucher-expire', async () => {
      const { runVoucherExpireCron } = await import('./cron/stay-voucher-expire')
      await runVoucherExpireCron(env as { DB: D1Database })
    }))
    // 🎫 2026-06-21: 이용권(교환권) 만료 D-7/D-3/D-1 알림 (앱내 + 알림톡). 선결제 돈 소멸 방지.
    ctx.waitUntil(slotCron('40 9 * * *')('meal-voucher-expire', async () => {
      const { runMealVoucherExpireCron } = await import('./cron/voucher-expire')
      await runMealVoucherExpireCron(env as Parameters<typeof runMealVoucherExpireCron>[0])
    }))
    // ⏰ 2026-07-19 (운영 자동화 ② — 게이트 OPS_SEQUENCES_ENABLED, 기본 OFF): 소비자 시퀀스 2종.
    //   드랍 D-1 예고(fcfs 응모자, KST 18:00) + 체험단 게시 리마인드(당첨 48h 경과, 평생 1회).
    ctx.waitUntil(slotCron('40 9 * * *')('drop-d1-reminder', async () => {
      const { runDropD1Reminder } = await import('./cron/drop-d1-reminder')
      await runDropD1Reminder(env as Parameters<typeof runDropD1Reminder>[0])
    }))
    ctx.waitUntil(slotCron('40 9 * * *')('experience-post-reminder', async () => {
      const { runExperiencePostReminder } = await import('./cron/experience-post-reminder')
      await runExperiencePostReminder(env as Parameters<typeof runExperiencePostReminder>[0])
    }))
    // 🧾 2026-07-13: 상권 쿠폰 만료 임박(D-3) 알림 + 만료 스위핑(status='expired'). 병렬 엔티티·머니 0.
    ctx.waitUntil(slotCron('40 9 * * *')('district-coupon-expire', async () => {
      const { runDistrictCouponExpireCron } = await import('./cron/district-coupon-expire')
      await runDistrictCouponExpireCron(env as Parameters<typeof runDistrictCouponExpireCron>[0])
    }))
    // 🛡️ 2026-06-12 (전수조사 4차 B-6): 체크아웃 +1일 경과 confirmed → checked_out 자동 전이 (리뷰 게이트 해제).
    ctx.waitUntil(slotCron('40 9 * * *')('stay-checkout-transition', async () => {
      const { handleStayCheckoutTransition } = await import('./cron/stay-checkout-transition')
      await handleStayCheckoutTransition(env as { DB: D1Database })
    }))
  }

  // 🩹 만회: 전용 트리거가 안 울리거나 예산이 마르면 :55 틱이 오늘 안에 이어받는다.
  //   `slotCron('0 19 * * *')` 가 이번 주기에 이미 돈 작업을 걸러내므로 정상인 날의 만회는 비용 0 이다.
  if (cron === '0 19 * * *' || catchupOpens(catchup, nowMs, { minute: 0, hour: 19 })) {
    ctx.waitUntil(slotCron('0 19 * * *')('reconciliation', () => runReconciliation(env)));
    // 🛡️ 2026-05-16: 인플루언서 attribution pending→available 매일 19시 동기화.
    //   매월 1일에만 실제 송금 큐잉. 그 외엔 status 동기화만.
    ctx.waitUntil(slotCron('0 19 * * *')('influencer-payout', () => handleInfluencerPayout(env)));
    // ⏰ 2026-08-03 — 아래 넷은 발화하지 않는 `0 * * * *` 블록(wrangler crons 미등록 — 하트비트 0건
    //   실측)에서 **여기로 이사**. 머니 무관 + 자체 상한 + 시각 게이트 없음이라 일간도 유효하다.
    //   cron-stale-watch=멈춤 감시 · anomaly-detect=어뷰징 탐지 · wishlist-*=찜 재입고/가격인하(CAP 200).
    //   ⚠️ 두고 온 것: `ops-daily-digest`(내부 `getUTCHours()===22` 게이트 — 여기 오면 조용히 no-op)와
    //      머니 경로(교환권 재발송·환불 재시도·webhook drain·도매 정산) = 대표 결정 + staging 룰.
    ctx.waitUntil(slotCron('0 19 * * *')('cron-stale-watch', async () => {
      const { handleCronStaleWatch } = await import('./cron/cron-stale-watch');
      await handleCronStaleWatch(env);
    }));
    ctx.waitUntil(slotCron('0 19 * * *')('anomaly-detect', () => handleAnomalyDetection(env)));
    ctx.waitUntil(slotCron('0 19 * * *')('wishlist-restock-notify', async () => {
      const { handleWishlistRestockNotify } = await import('./cron/wishlist-notify');
      return handleWishlistRestockNotify(env);
    }));
    ctx.waitUntil(slotCron('0 19 * * *')('wishlist-price-drop-notify', async () => {
      const { handleWishlistPriceDropNotify } = await import('./cron/wishlist-notify');
      return handleWishlistPriceDropNotify(env);
    }));
    // 🎫 KT Alpha 교환권 발송 실패 자동 복구(retry<3·backoff·14일내·run당 20건·NOT EXISTS 이중발송 0).
    //   2026-08-03 대표 승인 — 발화 안 하는 `0 * * * *` 에 있어 **돈 낸 교환권이 영영 안 가고 있었다.**
    //   ⚠️ 일간이라 복구가 최대 24h 지연된다. 즉시 필요하면 어드민 `POST /_run-cron {kt-alpha-voucher-retry}`.
    ctx.waitUntil(slotCron('0 19 * * *')('kt-alpha-voucher-retry', async () => {
      const { handleKtAlphaVoucherRetry } = await import('./cron/kt-alpha-voucher-retry');
      return handleKtAlphaVoucherRetry(env);
    }));
    // 💰 2026-08-03 (대표 "재처리 3개도 다 진행해줘") — 발화 안 하는 `0 * * * *` 에서 이사. 보류 사유였던
    //   규모를 라이브 D1 로 **실측**: reconcile 0건 · 예치금 원장 172,800원 · 환불실패 테이블 미생성 ·
    //   FAILED 웹훅 0 · pending 숙소예약 0 ⇒ 돈이 움직이는 게 아니라 **안전망을 켜는 것**이다.
    ctx.waitUntil(slotCron('0 19 * * *')('toss-refund-retry', () => handleTossRefundRetry(env)));
    // FAILED 웹훅 백로그 **감시**(Discord 요약). 자동 재처리는 잠금 해제 후 2단계 — 지금은 관측만.
    ctx.waitUntil(slotCron('0 19 * * *')('webhook-failed-drain', async () => {
      const { handleWebhookFailedDrain } = await import('./cron/webhook-failed-drain');
      return handleWebhookFailedDrain(env);
    }));
    // 차감됐는데 PAID 못 간 예치금 주문 자동 환불(미회수 0). 라이브 실측 대상 0건 · 예치금 원장 총 172,800원.
    ctx.waitUntil(slotCron('0 19 * * *')('wholesale-deposit-reconcile', async () => {
      const { reconcileOrphanedDepositOrders } = await import('../features/supply/api/wholesale-deposit-core')
      return reconcileOrphanedDepositOrders(env.DB)
    }));
    // 출금 원장 자가복구 — **재출금 방지**라 안 도는 쪽이 위험하다(테이블 미생성 = 아직 출금 0).
    ctx.waitUntil(slotCron('0 19 * * *')('wholesale-withdrawal-reconcile', async () => {
      const { reconcileWithdrawalLedgers } = await import('../features/supply/api/supplier-withdrawal-core')
      return reconcileWithdrawalLedgers(env.DB)
    }));
    // 미결제 pending 숙소 예약 만료(30분 경과). 재고 미조작 — 정리 목적. 실측 대상 0건.
    ctx.waitUntil(slotCron('0 19 * * *')('stay-pending-expire', async () => {
      const { handleStayPendingExpire } = await import('./cron/stay-pending-expire')
      return handleStayPendingExpire(env)
    }));
  }

  // 🗄️ 2026-08-25 (대표 트리거 교체): 죽어 있던 주간 백업 슬롯 → **백업 전용 트리거**(:02/:17/:32/:47).
  //   위 `*/5` 백업 슬롯(:05/:20/:35/:50)과도, **`*/5` 트리거 자체와도** 한 분도 안 겹친다(:02/:17/:32/:47).
  //   전용 인보케이션이라 예산(~50)을 통째로 쓴다 — 5분 틱은 40개가 나눠 써서 백업이 하루 7시간씩 굶었다.
  //   🩸 처음엔 `*`+`/15` 였는데 **등록되고도 한 번도 안 울렸다**(3/3). 그 분이 전부 `*`+`/5` 의 분이라 가려진다.
  //   옛 `handleD1Backup`(전체 덤프)은 DB 가 커져
  //   08-02 이후 OOM 으로 죽은 코드. 주간 표기 3종도 같이 받는다 — 옛 트리거가 남아 있어도 회차를 안 버린다.
  if (cron === '2,17,32,47 * * * *' || cron === '0 20 * * 0' || cron === '0 20 * * SUN' || cron === '0 20 * * 7') {
    ctx.waitUntil(slotCron('2,17,32,47 * * * *')('d1-backup-chunked', () => import('./cron/d1-backup-chunked').then((m) => m.handleChunkedBackup(env as never))));
  }

  // 💸 2026-08-11: `0 0 * * 1` 도 미등록이라 주간 7개가 침묵했다. `payouts-generate` 는 송금이 아니라
  //   지급 대상 목록 생성이고 송금은 어드민 수동 + 멱등. 월 09:45 KST(다른 게이트와 분 분리 = 예산 분리).
  if (cron === '*/5 * * * *' && slotOpen({ minute: 45, hour: 0, dow: 1 })) {
    // 🛡️ 2026-05-21 Phase C: 주 1회 정산 자동 생성 — admin 검토용 pending payouts 생성.
    ctx.waitUntil(slotCron('45 0 * * 1')('payouts-generate', () => handlePayoutsGenerate(env)));
    // 📊 2026-07-05 (자문 ⑤): 주간 조종석 숫자 5개 — 어드민 벨 + Discord (read-only 집계, fail-soft).
    ctx.waitUntil(slotCron('45 0 * * 1')('weekly-metrics-summary', async () => {
      const { runWeeklyMetricsSummary } = await import('./cron/weekly-metrics-summary');
      return runWeeklyMetricsSummary(env);
    }));
    // 📈 2026-07-19 (운영 자동화 ④): 주간 코호트 리포트 — 최근 8주 가입 코호트 전환/리텐션 표 1장.
    //   read-only, 벨+Discord(+설정 시 메일). weekly-metrics(스냅샷)와 상보 — 추세용.
    ctx.waitUntil(slotCron('45 0 * * 1')('weekly-cohort-report', async () => {
      const { runWeeklyCohortReport } = await import('./cron/weekly-cohort-report');
      return runWeeklyCohortReport(env);
    }));
    // 📝 2026-07-01: 블로그 AI 홍보 초안 주간 1편(비공개, 관리자 검토 후 발행).
    //   킬스위치 BLOG_AI_DRAFTS_ENABLED='true' 일 때만 — 기본 OFF(토큰 낭비 0). 홍보 전용.
    ctx.waitUntil(slotCron('45 0 * * 1')('blog-ai-draft', async () => {
      const { handleBlogAiDraft } = await import('./cron/blog-ai-draft');
      return handleBlogAiDraft(env);
    }));
    // 🔧 2026-07-18: off-live user_id backfill 자동 스위퍼(데이터 감사 3단계 자동화 — 대표 "실행도 자동으로").
    //   멱등 + 모호매핑 0 + user_points 충돌은 자동병합 안 함(어드민 벨 보고만). 대상 0 이면 no-op.
    ctx.waitUntil(slotCron('45 0 * * 1')('user-id-backfill-sweep', async () => {
      const { handleUserIdBackfillSweep } = await import('./cron/user-id-backfill-sweep');
      return handleUserIdBackfillSweep(env);
    }));
    // 🥗 2026-07-15 워커 다이어트(대표 승인): 소셜 홍보 초안 주간 크론 배선 분리(위 social-maintenance 와 동일 사유).
    //   기본 OFF 라 미실행 무해. 재도입 시 원복.
    // ctx.waitUntil(slotCron('45 0 * * 1')('social-draft', async () => {
    //   const { handleSocialDraft } = await import('./cron/social-draft');
    //   return handleSocialDraft(env);
    // }));
    ctx.waitUntil(slotCron('45 0 * * 1')('agency-weekly-batch', async () => {
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

  // 🩹 **만회 회차 한 줄 기록** — 이 기능의 유일한 관측 지점이다.
  //   만회는 정상인 날엔 아무 흔적도 안 남긴다(밀린 게 없으면 전부 건너뛴다). 그러면
  //   "돌았는데 할 일이 없었다"와 "아예 안 돌았다"가 **구분되지 않는다** — 이 레포가 반복해
  //   당한 '조용한 부재' 클래스이고, 하필 그걸 고치려고 만든 기능이 같은 병을 앓았다.
  //   started=0 skipped=27 이면 "돌았고 밀린 게 없었다"가 화면에서 읽힌다.
  //   ⏰ 주기는 매시 1회(:55)라 5분 캐리어 식이 아니라 시간당 기준을 신고한다.
  if (catchup) {
    ctx.waitUntil(recordCronBeat(env, '__catchup', true, 0, cron, summarizeCatchup(catchup), expectedMaxAgeMinutes('55 * * * *') ?? undefined)); // cron-heartbeat-ok: 작업이 아니라 하트비트 **자체**다(__tick 과 동일 이유)
  }
}
