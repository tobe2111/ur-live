/**
 * 🔁 2026-06-12 (4차 감사 D4 — 1단계): FAILED 웹훅 재처리 대상 감시 cron (매시간).
 *
 * 대상: webhook_events WHERE status='FAILED' AND retry_count < 3
 *
 * ⚠️ 단계화 한계 (의도된 1단계):
 *   실제 재처리(이벤트 payload 를 다시 핸들러에 태우기)는 webhook.routes.ts 내부의
 *   비-export 핸들러(handlePaymentConfirmed/Cancelled/Failed …)를 호출해야 하는데,
 *   해당 파일은 Toss V2 docs audit 잠금(CLAUDE.md) — 사용자 승인 없이 수정/추출 금지.
 *   직접 재구현은 같은 로직 2벌(드리프트 위험)이라 금지 룰에 따름.
 *   → 1단계: '재처리 대상 존재' 를 Discord + 로그로 운영자에게 도달시키는 것까지만.
 *   → 2단계(승인 필요): webhook.routes 핸들러를 export 로 추출 후 이 cron 에서 직접 재실행.
 *
 * 안전:
 *   - 읽기 전용 (webhook_events 수정 X — Toss 자체 24h 재시도/수동 처리와 충돌 없음)
 *   - Discord dedup 6h (같은 백로그로 매시간 도배 방지), 미설정 시 logError 만
 */

import type { Env } from '../types/env';
import { logError, logInfo } from '../utils/logger';

interface FailedRow {
  id: string;
  source: string;
  event_type: string;
  toss_order_id: string | null;
  order_number: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
}

export async function handleWebhookFailedDrain(env: Env): Promise<{ pending: number }> {
  const DB = env.DB;
  if (!DB) return { pending: 0 };

  let rows: FailedRow[] = [];
  try {
    const res = await DB.prepare(
      `SELECT id, source, event_type, toss_order_id, order_number, error_message, retry_count, created_at
       FROM webhook_events
       WHERE status = 'FAILED' AND retry_count < 3
       ORDER BY created_at DESC
       LIMIT 20`,
    ).all<FailedRow>();
    rows = res.results || [];
  } catch {
    // webhook_events 테이블 부재 (신규 환경) — no-op
    return { pending: 0 };
  }

  if (rows.length === 0) return { pending: 0 };

  let total = rows.length;
  try {
    const cnt = await DB.prepare(
      "SELECT COUNT(*) AS c FROM webhook_events WHERE status = 'FAILED' AND retry_count < 3",
    ).first<{ c: number }>();
    total = Number(cnt?.c ?? rows.length);
  } catch { /* 표본 20건 수로 폴백 */ }

  const lines = rows.slice(0, 10).map((r) =>
    `• [${r.source}/${r.event_type}] order=${r.order_number || r.toss_order_id || '-'} retry=${r.retry_count} — ${(r.error_message || '').slice(0, 80)}`,
  );
  const summary =
    `재처리 대상 FAILED 웹훅 ${total}건 (retry_count < 3).\n` +
    `${lines.join('\n')}\n` +
    `→ /admin (webhook 모니터) 에서 수동 확인 필요. 자동 재처리(2단계)는 webhook.routes 잠금 해제 승인 후.`;

  logInfo(`[cron:webhook-failed-drain] pending FAILED webhooks: ${total}`);

  const webhook = (env as Env & { DISCORD_WEBHOOK_URL?: string }).DISCORD_WEBHOOK_URL;
  if (webhook) {
    try {
      const { sendDiscordAlertDedup } = await import('../utils/discord-alert');
      await sendDiscordAlertDedup(
        env as { RATE_LIMIT_KV?: KVNamespace },
        webhook,
        `⚠️ FAILED 웹훅 ${total}건 — 재처리 필요`,
        summary,
        'warn',
        6 * 3600, // 같은 백로그로 매시간 도배 방지
      );
    } catch (e) {
      logError('[cron:webhook-failed-drain] discord notify failed', { error: String(e) });
    }
  }

  return { pending: total };
}
