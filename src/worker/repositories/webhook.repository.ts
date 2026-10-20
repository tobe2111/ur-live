// ============================================================
// Webhook Event Repository - Idempotency & Audit Trail
// ============================================================

import type { D1Database } from '@cloudflare/workers-types';
import { QueryBuilder } from './query-builder';
import { generateId } from '../../shared/utils';
import type { WebhookStatus } from '../../shared/types';
import { captureException } from '../utils/sentry';

export class WebhookEventRepository {
  private qb: QueryBuilder;

  constructor(db: D1Database) {
    this.qb = new QueryBuilder(db);
  }

  /**
   * Check if a webhook event was already processed (idempotency check)
   * Uses eventType + tossOrderId as composite key
   */
  async isAlreadyProcessed(
    eventType: string,
    tossOrderId: string,
    source: string = 'toss'
  ): Promise<boolean> {
    const row = await this.qb.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM webhook_events
       WHERE source = ? AND event_type = ? AND toss_order_id = ? AND status IN ('PROCESSED', 'RECEIVED')`,
      [source, eventType, tossOrderId]
    );
    return (row?.count ?? 0) > 0;
  }

  /**
   * Record a new webhook event
   */
  async record(
    eventType: string,
    payload: unknown,
    tossOrderId?: string,
    orderNumber?: string,
    source: string = 'toss'
  ): Promise<string> {
    const id = generateId();
    await this.qb.execute(
      `INSERT INTO webhook_events (
        id, source, event_type, payload, status, toss_order_id, order_number
      ) VALUES (?, ?, ?, ?, 'RECEIVED', ?, ?)`,
      [id, source, eventType, JSON.stringify(payload), tossOrderId ?? null, orderNumber ?? null]
    );
    return id;
  }

  /**
   * Mark event as processed
   */
  async markProcessed(eventId: string): Promise<void> {
    await this.qb.execute(
      `UPDATE webhook_events 
       SET status = 'PROCESSED', processed_at = datetime('now')
       WHERE id = ?`,
      [eventId]
    );
  }

  /**
   * Mark event as failed
   *
   * 🛡️ 2026-04-22 배치 119 (TD-009): FAILED 이벤트 Sentry alert 추가.
   *   모든 FAILED 는 Sentry 에 보고 → 운영자가 인지 가능.
   *   retry_count 3 초과 시 fatal level 로 승격 — escalation 신호.
   *
   * ⚠️ 자동 재시도 cron 은 별도 티켓. Toss 는 24h 내 여러 번 재시도하므로
   *   markFailed 후 non-2xx 응답으로 Toss 재시도 유도 가능.
   */
  async markFailed(eventId: string, errorMessage: string): Promise<void> {
    await this.qb.execute(
      `UPDATE webhook_events
       SET status = 'FAILED', error_message = ?, retry_count = retry_count + 1
       WHERE id = ?`,
      [errorMessage, eventId]
    );

    // retry_count 조회 (update 후)
    const row = await this.qb.queryOne<{ retry_count: number; event_type: string; source: string; toss_order_id: string | null; order_number: string | null }>(
      `SELECT retry_count, event_type, source, toss_order_id, order_number
       FROM webhook_events WHERE id = ?`,
      [eventId]
    );

    const retryCount = row?.retry_count ?? 1;
    // Sentry 보고 (실패 시에도 절대 throw 하지 않음 — webhook 처리 자체를 방해하면 안됨)
    try {
      await captureException(new Error(`Webhook ${retryCount >= 3 ? 'FATAL' : 'FAILED'}: ${errorMessage}`), {
        tags: {
          webhook_source: row?.source ?? 'unknown',
          webhook_event_type: row?.event_type ?? 'unknown',
          retry_count: String(retryCount),
          escalation: retryCount >= 3 ? 'fatal' : 'warning',
        },
        extra: {
          event_id: eventId,
          toss_order_id: row?.toss_order_id,
          order_number: row?.order_number,
        },
      });
    } catch {
      // Sentry 자체 실패는 무시 (이미 DB 에 FAILED 기록됨)
    }
  }

  /**
   * Mark event as skipped (already processed or intentionally unhandled).
   * Optional reason is persisted to `error_message` for audit.
   */
  async markSkipped(eventId: string, reason?: string): Promise<void> {
    if (reason) {
      await this.qb.execute(
        `UPDATE webhook_events
         SET status = 'SKIPPED', error_message = ?, processed_at = datetime('now')
         WHERE id = ?`,
        [reason, eventId]
      );
    } else {
      await this.qb.execute(
        `UPDATE webhook_events
         SET status = 'SKIPPED', processed_at = datetime('now')
         WHERE id = ?`,
        [eventId]
      );
    }
  }

  /**
   * 🛡️ 배치 119 (TD-009): FAILED 이벤트 통계 — admin 대시보드 조회용
   */
  async getFailedStats(hours = 24): Promise<{
    total: number;
    by_source: { source: string; count: number }[];
    by_event_type: { event_type: string; count: number }[];
    escalated: number; // retry_count >= 3
  }> {
    const total = await this.qb.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM webhook_events
       WHERE status = 'FAILED' AND created_at > datetime('now', '-' || ? || ' hours')`,
      [hours]
    );
    const bySource = await this.qb.queryMany<{ source: string; count: number }>(
      `SELECT source, COUNT(*) as count FROM webhook_events
       WHERE status = 'FAILED' AND created_at > datetime('now', '-' || ? || ' hours')
       GROUP BY source ORDER BY count DESC`,
      [hours]
    );
    const byEventType = await this.qb.queryMany<{ event_type: string; count: number }>(
      `SELECT event_type, COUNT(*) as count FROM webhook_events
       WHERE status = 'FAILED' AND created_at > datetime('now', '-' || ? || ' hours')
       GROUP BY event_type ORDER BY count DESC`,
      [hours]
    );
    const escalated = await this.qb.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM webhook_events
       WHERE status = 'FAILED' AND retry_count >= 3
         AND created_at > datetime('now', '-' || ? || ' hours')`,
      [hours]
    );
    return {
      total: total?.count ?? 0,
      by_source: bySource,
      by_event_type: byEventType,
      escalated: escalated?.count ?? 0,
    };
  }

  /**
   * Get recent webhook events for monitoring
   */
  async getRecent(limit = 50): Promise<{
    id: string;
    source: string;
    event_type: string;
    status: WebhookStatus;
    toss_order_id?: string;
    order_number?: string;
    error_message?: string;
    created_at: string;
    processed_at?: string;
  }[]> {
    return this.qb.queryMany(
      `SELECT id, source, event_type, status, toss_order_id, order_number, 
              error_message, created_at, processed_at
       FROM webhook_events 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [limit]
    );
  }
}
