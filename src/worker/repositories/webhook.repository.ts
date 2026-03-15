// ============================================================
// Webhook Event Repository - Idempotency & Audit Trail
// ============================================================

import type { D1Database } from '@cloudflare/workers-types';
import { QueryBuilder } from './query-builder';
import { generateId } from '../../shared/utils';
import type { WebhookStatus } from '../../shared/types';

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
       WHERE source = ? AND event_type = ? AND toss_order_id = ? AND status = 'PROCESSED'`,
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
   */
  async markFailed(eventId: string, errorMessage: string): Promise<void> {
    await this.qb.execute(
      `UPDATE webhook_events 
       SET status = 'FAILED', error_message = ?, retry_count = retry_count + 1
       WHERE id = ?`,
      [errorMessage, eventId]
    );
  }

  /**
   * Mark event as skipped (already processed)
   */
  async markSkipped(eventId: string): Promise<void> {
    await this.qb.execute(
      `UPDATE webhook_events 
       SET status = 'SKIPPED', processed_at = datetime('now')
       WHERE id = ?`,
      [eventId]
    );
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
