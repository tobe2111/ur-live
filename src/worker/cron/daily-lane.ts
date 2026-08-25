/**
 * 🌆 **일간(18 UTC) cron 레인** — `scheduled.ts` 에서 분리하고 **네 인보케이션으로 쪼갠다**.
 *
 * ## 왜 쪼개나 (2026-08-25 실사고)
 *
 * 이 블록에는 작업 16개가 있었고 **전부 한 인보케이션**에서 돌았다. 무료 플랜은 인보케이션당
 * 서브리퀘스트가 ~50인데, 작업 하나가 D1 왕복 2~5회를 쓴다. 예산이 마르면 뒤쪽 작업은
 * **에러 없이 잘린다** — `recordCronBeat` 의 write 조차 실패하고 fail-soft catch 가 삼킨다.
 * 즉 *"안 돌았다"* 가 *"조용하다"* 와 구분되지 않는다(이 레포가 반복해 만난 클래스).
 *
 * 실측: 2026-08-24 회차에 이 16개 **전부** 하트비트가 없었다. 그 안에 정산 성숙·원장 정합이
 * 들어 있다. 경보는 0이었다(그건 `staleToleranceMinutes` 에서 따로 고쳤다).
 *
 * ⚠️ **08-24 누락의 원인은 아직 확정하지 못했다** — 트리거 미발화인지, 인보케이션이 기록 전에
 *   죽었는지. 이 분리는 *후자*를 구조적으로 없앤다(그룹마다 예산을 따로 받는다). 전자라면
 *   이 분리로도 money 그룹은 여전히 `0 18` 트리거에 묶여 있지만, 나머지 셋은 **다른 트리거
 *   (`*​/5` 캐리어)** 라 같이 죽지 않는다 — 한 번에 전부 사라지는 일은 없어진다.
 *
 * ## 그룹 배정 원칙 — **돈이 먼저, 그리고 혼자**
 *
 * | 그룹 | 슬롯 | 왜 |
 * |---|---|---|
 * | `money` | `0 18 * * *`(전용 트리거) | 정산 성숙·환불. **가장 확실한 자리**를 준다 |
 * | `integrity` | 18:10 | 원장 정합·분쟁·고아행 — 돈을 *검사*하는 축 |
 * | `maintenance` | 18:30 | 스키마 복구·백필·데모 — 늦어도 손해가 회복 가능 |
 * | `growth` | 18:40 | 리뷰 시드·이탈 탐지·에이전시 배치 |
 *
 * ⚠️ 분은 **5의 배수**여야 하고(`*​/5` 격자) 기존 게이트와 겹치면 안 된다 — 겹치면 같은
 *   인보케이션이 되어 이 분리가 통째로 무의미해진다. `cron-slot-gate.test.ts` 가 강제한다.
 *
 * ## 이 파일이 하지 않는 것
 *
 * 작업 내용은 **한 줄도 바꾸지 않았다.** 순서·핸들러·에러처리 전부 이동 전과 동일하다.
 * 바뀐 것은 *어느 인보케이션에서 도는가* 뿐이다.
 */
import type { D1Database, ExecutionContext, KVNamespace } from '@cloudflare/workers-types'
import type { Env } from '../types/env'
import { handleAutoSettlement, handleExpiredVoucherRefunds } from './auto-settlement'
import { renewDemoFcfs } from './demo-fcfs-renew'
import { runDailySelfDiagnostic } from './daily-self-diagnostic'
import { handleWholesaleOrphanSweep } from './wholesale-orphan-sweep'
import { handleLedgerIntegrityCheck } from './ledger-integrity-check'
import { handleDisputesEscalation } from './disputes-escalation'
import { handleAutoSeedReviews } from './auto-seed-reviews'
import { handleSellerChurnDetect } from './seller-churn-detect'
import { handleLedgerReconcile } from './ledger-reconcile'
import { handleAgencyCreatorEval } from './agency-creator-eval'
import { handleAgencyMonthlyTasks } from './agency-monthly-tasks'
import { handleTikTokVideosSync } from './tiktok-videos-sync'
import { handleAgencyInactiveSellers } from './agency-inactive-sellers'
import { handleAgencySelfEventsTick } from './agency-self-events-tick'
import { handleSellerDailyReport } from './seller-daily-report'
import { handleAdSlotsAward } from './ad-slots-award'
import { recomputeAllActiveCampaigns } from '../../features/agency/api/agency-campaigns.routes'
import { getFeatureFlags } from '../utils/feature-flags'
import { logError, logInfo } from '../utils/logger'

/** 네 그룹. 이름이 곧 배정 근거다 — 새 작업을 넣을 때 "이건 어느 축인가"를 먼저 답할 것. */
export type DailyGroup = 'money' | 'integrity' | 'maintenance' | 'growth'

export interface DailyLaneDeps {
  env: Env
  ctx: ExecutionContext
  /**
   * 하트비트를 남기는 실행 래퍼. `scheduled.ts` 의 `safeCron`(전용 트리거) 또는
   * `slotCron(expr)`(슬롯). ⚠️ 여기서 직접 만들지 않는다 — 그러면 하트비트에 신고되는
   * 주기가 실제 슬롯과 갈라지고, 갈라져도 조용하다.
   */
  run: (name: string, task: () => Promise<unknown>) => Promise<unknown>
  /** `notifyCronFailure` 위임 — `scheduled.ts` 를 import 하면 순환이라 주입받는다. */
  onFailure: (name: string, err: unknown) => Promise<void>
}

/** 한 그룹을 띄운다. 호출부(`scheduled.ts`)가 슬롯 게이트를 판정한 뒤 부른다. */
export function runDailyLane(group: DailyGroup, d: DailyLaneDeps): void {
  const { env, ctx, run, onFailure } = d

  if (group === 'money') {
    ctx.waitUntil(run('auto-settlement', () => handleAutoSettlement(env)))
    ctx.waitUntil(run('expired-voucher-refund', () => handleExpiredVoucherRefunds(env)))
    // 🛡️ 2026-06-01 도매몰: 공급자 정산 성숙 (환불창 지난 pending → available).
    ctx.waitUntil(run('supplier-settlement-mature', async () => {
      const { matureSupplierSettlements } = await import('../../features/supply/api/supply-settlement')
      await matureSupplierSettlements(env.DB)
    }))
    // ⏳ 2026-06-15 링크샵: 추천 적립 성숙 — holding 상태 T+7(환불창) 경과 + 미환불 주문분을
    //   granted 로 확정 + 그때 딜 잔액 적립. 즉시적립 후 환불 시 회수불가(MAX0 clamp) 누수 차단.
    ctx.waitUntil(run('affiliate-mature', async () => {
      const { matureAffiliateEarnings } = await import('../utils/affiliate-credit')
      await matureAffiliateEarnings(env.DB, env)
    }))
    // ⏳ 2026-06-15 추천 트리(referral_commissions) 적립도 동일 T+7 hold — pending→granted 확정 시 잔액 적립.
    ctx.waitUntil(run('referral-mature', async () => {
      const { matureReferralCommissions } = await import('../../features/referral/api/referral-tree.routes')
      await matureReferralCommissions(env.DB, env)
    }))
    return
  }

  if (group === 'integrity') {
    // 🛡️ 2026-05-15 (TD-G08): ledger 정합성 검증 — Σdebit ≠ Σcredit / 음수 wallet → Discord alert
    ctx.waitUntil(run('ledger-reconcile', () => handleLedgerReconcile(env)))
    // 🛡️ 2026-05-21 Phase D-3: 매일 ledger 정합성 검증 — orphan entries 알림.
    ctx.waitUntil(run('ledger-integrity-check', () => handleLedgerIntegrityCheck(env)))
    // 🛡️ 2026-05-21 Phase E-4: 분쟁 자동 escalation (24시간 미처리 + 재발 매장 + 어뷰징 사용자).
    ctx.waitUntil(run('disputes-escalation', () => handleDisputesEscalation(env)))
    // 🏭 2026-06-08 DATA-1: 도매 고아행(FK 부재) 일일 스윕 (flag-only, 삭제 X).
    ctx.waitUntil(run('wholesale-orphan-sweep', () => handleWholesaleOrphanSweep(env)))
    ctx.waitUntil(run('daily-self-diagnostic', () => runDailySelfDiagnostic(env)))
    return
  }

  if (group === 'maintenance') {
    // 🛡️ 2026-05-20: 매일 1회 schema-repair 자동 호출 — 누락 컬럼/테이블 보장.
    //   신규 migration 추가 시 다음날 자동 적용(어드민 수동 호출 대체).
    ctx.waitUntil(run('schema-repair-daily', async () => {
      const { runSchemaRepair } = await import('../routes/repair-schema.routes')
      const result = await runSchemaRepair(env.DB)
      const colErr = result.columns.filter(r => r.status === 'error').length
      const tabErr = result.tables.filter(r => r.status === 'error').length
      const colAdded = result.columns.filter(r => r.status === 'added').length
      if (colErr > 0 || tabErr > 0) {
        logError('[cron] schema-repair has errors', { colErr, tabErr })
      } else if (colAdded > 0) {
        logInfo(`[cron] schema-repair: +${colAdded} columns added (others existed)`)
      }
    }))
    // 🛡️ 2026-05-21: 리뷰 user_name 백필 — 카카오 이름 masked 자동 적용 (사용자 요청 영구).
    //   idempotent — user_name IS NULL 인 row 만 처리. 매일 실행해도 안전.
    ctx.waitUntil(run('review-username-backfill', async () => {
      try {
        await env.DB.prepare(`ALTER TABLE product_reviews ADD COLUMN user_name TEXT`).run().catch(() => null)
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
        `).run().catch(() => null)
        if (r && r.meta.changes > 0) {
          logInfo(`[cron] review-username-backfill: +${r.meta.changes} reviews updated`)
        }
      } catch (e) { logError('[cron] review-username-backfill', { error: String(e) }) }
    }))
    // 🎭 2026-08-03 — 데모 추첨 마감 롤링 연장 + 추첨 설정이 없는 이용권 데모(숙박 72개)에 seed.
    //   ⚠️ 머니 무관 · `demo-%` slug 만 건드림 · 완전 멱등이라 하루 1회면 충분하다.
    ctx.waitUntil(run('demo-fcfs-renew', () => renewDemoFcfs(env)))
    return
  }

  // growth
  // 🛡️ 2026-05-24: 신규 활성 상품 (공구/쇼핑/교환권) 자동 리뷰 시드 — 1일당 최대 200개. idempotent.
  ctx.waitUntil(run('auto-seed-reviews', () => handleAutoSeedReviews(env)))
  // 🛡️ 2026-05-15: 셀러 churn 탐지 — 14일+ 등록 X + 평균 진행률 < 50% → 에이전시 alert
  ctx.waitUntil(run('seller-churn-detect', () => handleSellerChurnDetect(env)))
  ctx.waitUntil(run('agency-cron-batch', async () => {
    const flags = await getFeatureFlags((env as unknown as { RATE_LIMIT_KV?: KVNamespace }).RATE_LIMIT_KV, env.DB)
    if (flags.enable_agency_campaigns_aggregate) {
      await recomputeAllActiveCampaigns(env.DB).catch(e => onFailure('agency-cron-batch/campaigns', e))
    }
    if (flags.enable_agency_creator_eval) {
      await handleAgencyCreatorEval(env).catch(e => onFailure('agency-cron-batch/creator-eval', e))
    }
    if (flags.enable_agency_monthly_tasks) {
      await handleAgencyMonthlyTasks(env).catch(e => onFailure('agency-cron-batch/monthly-tasks', e))
    }
    if (flags.enable_tiktok_videos_sync) {
      await handleTikTokVideosSync(env).catch(e => onFailure('agency-cron-batch/tiktok', e))
    }
    // Phase 1-2: 부진 셀러 알림 (매일)
    await handleAgencyInactiveSellers(env).catch(e => onFailure('agency-cron-batch/inactive-sellers', e))
    // 🔐 2026-06-11 (정합성 감사 🔴): 매월 1일에만 실행 — 매일 실행 + note-LIKE 멱등(약함)이라
    //   같은 날 cron 중복/재시도 시 growth_bonus 이중 적립 위험. 1일 게이트로 실행 빈도 자체를 월1회로.
    if (new Date().getUTCDate() === 1) try {
      const { runAgencyStoreIntroMonthlyBonus } = await import('./agency-store-intro-monthly-bonus')
      const r = await runAgencyStoreIntroMonthlyBonus(env)
      if (r.awarded > 0) {
        logInfo(`[cron] agency-store-intro monthly bonus: awarded ${r.awarded} stores, total ₩${r.totalAmount.toLocaleString()}`)
      }
    } catch (e) { await onFailure('agency-cron-batch/agency-intro-monthly-bonus', e) }
    // 2026-04-27: 자사 이벤트 진행값 자동 갱신 + 보상 지급 (매일)
    await handleAgencySelfEventsTick(env).catch(e => onFailure('agency-cron-batch/self-events', e))
    // 2026-04-27: 셀러 일일 리포트 메일 (RESEND_API_KEY 있을 때만)
    await handleSellerDailyReport(env).catch(e => onFailure('agency-cron-batch/seller-daily-report', e))
    // 🌇 2026-08-19 일몰 정지 — 목적지 화면(/agency/match-suggestions)이 제거됐다(알림만 남는 게 최악).
    //    같은 배치의 self-events·campaigns 는 채무/집계 경로라 유지. 롤백: 아래 한 줄 주석 해제.
    // await handleAgencySellerMatch(env).catch(e => onFailure('agency-cron-batch/agency-seller-match', e));
    // 2026-05-05: 광고 슬롯 낙찰 처리
    await handleAdSlotsAward(env).catch(e => onFailure('agency-cron-batch/ad-slots-award', e))
  }))
}

/** 타입 참조용(사용 안 함) — `env.DB` 가 D1 임을 명시해 두면 리팩토링 때 신호가 된다. */
export type _DailyLaneDb = D1Database
