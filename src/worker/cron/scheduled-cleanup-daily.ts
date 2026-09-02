import { logError } from '../utils/logger'
import type { D1Database } from '@cloudflare/workers-types'

/**
 * ⏱️ **청소 daily 티어** — `scheduled-cleanup.ts` 의 GC 섹션 13개를 그대로 옮겨 왔다(2026-09-02).
 *
 * 전부 `created_at < now-N days` 류의 **인덱스 없는 전수 스캔 삭제**라 하루 한 번(04:20 KST 슬롯)이면
 * 충분하다. 본문은 byte-동일하고, 감싸던 `if (tiers.daily) { … }` 만 벗겼다 — 게이트는 호출부
 * (`scheduled-cleanup.ts` 의 `if (tiers.daily) await runDailyCleanup(…)`) 하나로 모였다.
 * 섹션 번호(8·9·9b·15~19·22·22b·🏁·23)는 원본 순서 그대로다.
 */
export async function runDailyCleanup(DB: D1Database, results: Record<string, number>): Promise<void> {
  // ── 8. 알림 정리: 90일 이상 된 알림 삭제 — LIMIT 10000으로 한 틱에 과부하 방지 ──
  try {
    await DB.prepare(`
      DELETE FROM user_notifications
      WHERE rowid IN (
        SELECT rowid FROM user_notifications
        WHERE created_at < datetime('now', '-90 days')
        LIMIT 10000
      )
    `).run();
    await DB.prepare(`
      DELETE FROM dashboard_notifications
      WHERE rowid IN (
        SELECT rowid FROM dashboard_notifications
        WHERE created_at < datetime('now', '-90 days')
        LIMIT 10000
      )
    `).run();
    // 🔔 2026-07-01: 레거시 notifications + agency_notifications 도 정리(이전엔 방치 → 무한 증가).
    //   소비자 벨이 notifications 를 UNION-read 하므로 user_notifications 와 동일 정책 적용.
    await DB.prepare(`
      DELETE FROM notifications
      WHERE rowid IN (
        SELECT rowid FROM notifications
        WHERE created_at < datetime('now', '-90 days')
        LIMIT 10000
      )
    `).run().catch(() => { /* table 없으면 skip */ });
    await DB.prepare(`
      DELETE FROM agency_notifications
      WHERE rowid IN (
        SELECT rowid FROM agency_notifications
        WHERE created_at < datetime('now', '-90 days')
        LIMIT 10000
      )
    `).run().catch(() => { /* table 없으면 skip */ });
  } catch (e) { logError('[Cron] notifications_cleanup error:', { error: String(e) }) }

  // ── 9. 만료된 리프레시 토큰 정리 ──
  try {
    await DB.prepare(`
      DELETE FROM refresh_tokens
      WHERE expires_at < datetime('now')
    `).run();
  } catch (e) { logError('[Cron] token_cleanup error:', { error: String(e) }) }

  // ── 9b. 만료된 idempotency 키 정리 (테이블이 존재할 때만) ──
  // idempotentWrite() 유틸리티가 저장하는 결과 캐시를 주기적으로 청소한다.
  // 테이블이 없는 환경(신규 배포)에서는 조용히 건너뛴다.
  try {
    await DB.prepare(
      "DELETE FROM idempotency_keys WHERE expires_at < datetime('now')"
    ).run();
  } catch { /* table may not exist yet — skip silently */ }

  // ── 15. csp_violations 정리: 30일 경과 (DoS 방어 + DB 부피 관리) ──
  // 🛡️ 2026-04-22: CSP 보고가 너무 많이 쌓이면 DB 비용 + 분석 노이즈
  try {
    await DB.prepare(`
      DELETE FROM csp_violations WHERE created_at < datetime('now', '-30 days')
    `).run();
  } catch { /* table may not exist */ }

  // ── 16. account_lockouts 정리: 만료된 잠금 기록 ──
  try {
    await DB.prepare(`
      DELETE FROM account_lockouts WHERE locked_until < datetime('now', '-7 days')
    `).run();
  } catch { /* table may not exist */ }

  // ── 16b. pin_click_logs 정리: 180일 경과 (유어샵 클릭 raw 로그) ──
  // 🔐 2026-06-15: 핀 클릭 분석은 최대 90일 range → 180일 보관이면 충분. 무한 적재 시 테이블 비대.
  //   집계값(product_pins.click_count)은 별도 보존이라 영향 없음. chunk LIMIT 으로 틱당 과부하 방지.
  try {
    await DB.prepare(`
      DELETE FROM pin_click_logs WHERE rowid IN (
        SELECT rowid FROM pin_click_logs WHERE created_at < datetime('now', '-180 days') LIMIT 5000
      )
    `).run();
  } catch { /* table may not exist */ }

  // ── 17. chat_messages 정리: 90일 경과 (live stream 종료 후 보관) ──
  // 라이브 종료 후 대량 채팅 누적 → 검색 부하. 라이브 다시보기에 필요한 90일만 보관.
  // chunked LIMIT 5000 — 한 틱에 과부하 방지.
  try {
    await DB.prepare(`
      DELETE FROM chat_messages
      WHERE rowid IN (
        SELECT rowid FROM chat_messages
        WHERE created_at < datetime('now', '-90 days')
          AND live_stream_id IN (
            SELECT id FROM live_streams WHERE status = 'ended' AND ended_at < datetime('now', '-90 days')
          )
        LIMIT 5000
      )
    `).run();
  } catch { /* table may not exist */ }

  // ── 18. rate_limit_attempts 정리: 24시간 이상 된 카운터 ──
  try {
    await DB.prepare(`
      DELETE FROM rate_limit_attempts WHERE window_start < (CAST(strftime('%s', 'now') AS INTEGER) - 86400)
    `).run();
  } catch { /* table may not exist */ }

  // ── 19. stripe_webhook_events 정리: 90일 경과 (idempotency 키, 더 이상 필요없음) ──
  try {
    await DB.prepare(`
      DELETE FROM stripe_webhook_events WHERE processed_at < datetime('now', '-90 days')
    `).run();
    // 🏁 2026-06-12 (인프라 감사): Toss webhook_events 도 90일 보존 — 기존엔 오타 테이블명만 정리.
    await DB.prepare(`
      DELETE FROM webhook_events WHERE created_at < datetime('now', '-90 days')
    `).run();
  } catch { /* table may not exist */ }

  // ── 22. 🛡️ 2026-04-28: consignment_partnerships pending 30일 자동 정리 ──
  //   양측 모두 응답 안 하면 자동 ended (cleanup)
  try {
    const { meta } = await DB.prepare(`
      UPDATE consignment_partnerships
      SET status = 'ended', ended_at = datetime('now'), updated_at = datetime('now')
      WHERE status = 'pending'
        AND created_at < datetime('now', '-30 days')
    `).run();
    results.consignment_pending_expired = meta.changes ?? 0;
  } catch { /* table may not exist */ }

  // ── 22b. 🛡️ 2026-05-30: 메인 공구 미달 자동환불 제거 (즉시판매 모델 확정) ──
  //   [모델 결정 — 사용자 명령] 메인 공구(group-buy.routes.ts)는 **즉시판매**다:
  //   참여 즉시 결제 + 교환권 발급되어, 목표 인원(group_buy_target)은 **마케팅 표시용(소셜프루프)**일 뿐
  //   환불 조건이 아니다. 따라서 목표 미달이어도 교환권은 유효하며 자동 환불하지 않는다.
  //   이전(2026-05-12~05-30)의 "미달 자동환불 cron"은 즉시판매 모델과 모순되어 제거했다.
  //
  //   ※ 개별 딜을 취소해야 할 땐 셀러 수동환불(group-buy-seller.routes.ts) /
  //     어드민 강제환불(group-buy-admin.routes.ts) 사용 — 둘 다 토스 카드환불 포함.
  //   ※ 보증금형(all-or-nothing) 자동환불이 필요한 **커뮤니티 공구**는 아래 22d 블록에서 별도 처리.
  //   ※ '미달성 시 자동환불' 마케팅(BusinessLandingPage)은 커뮤니티 공구 한정.

  // ── 🏁 2026-06-12 (전 플로우 감사 🟡): 탈퇴 30일 경과분 hard purge ──
  //   delete-account.service 가 "30일 후 파기" 를 고지하는데 cron 이 없어 deleted_accounts 에
  //   원본 email/kakao_id/이름이 무기한 보존됐음(개인정보 파기 의무). 복원 가능 기간이 지난 행 삭제.
  try {
    const { meta } = await DB.prepare(
      "DELETE FROM deleted_accounts WHERE reregister_available_at IS NOT NULL AND reregister_available_at < datetime('now')"
    ).run();
    if ((meta.changes ?? 0) > 0) results.deleted_accounts_purged = meta.changes;
  } catch { /* table 없으면 skip */ }

  // ── 23. 🛡️ 2026-04-28: consignment_settlements 자동 기록 (월간 윈도우) ──
  //   당월 1일 ~ 어제까지의 consignment 주문건을 분배 기록 (멱등).
  try {
    const { recordConsignmentSettlements } = await import('../../lib/consignment-settlement');
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const r = await recordConsignmentSettlements(DB, monthStart, yesterday);
    if (r.recorded > 0 || r.failed > 0) {
      results.consignment_settlements_recorded = r.recorded;
      if (r.failed > 0) results.consignment_settlements_failed = r.failed;
    }
  } catch (e) { logError('[Cron] consignment_settlements record error:', { error: String(e) }); }
}
