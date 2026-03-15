// ============================================================
// Webhook Event Repository - Idempotency & Audit Trail
// ============================================================
import { QueryBuilder } from './query-builder';
import { generateId } from '../../shared/utils';
export class WebhookEventRepository {
    qb;
    constructor(db) {
        this.qb = new QueryBuilder(db);
    }
    /**
     * Check if a webhook event was already processed (idempotency check)
     * Uses eventType + tossOrderId as composite key
     */
    async isAlreadyProcessed(eventType, tossOrderId, source = 'toss') {
        const row = await this.qb.queryOne(`SELECT COUNT(*) as count FROM webhook_events 
       WHERE source = ? AND event_type = ? AND toss_order_id = ? AND status = 'PROCESSED'`, [source, eventType, tossOrderId]);
        return (row?.count ?? 0) > 0;
    }
    /**
     * Record a new webhook event
     */
    async record(eventType, payload, tossOrderId, orderNumber, source = 'toss') {
        const id = generateId();
        await this.qb.execute(`INSERT INTO webhook_events (
        id, source, event_type, payload, status, toss_order_id, order_number
      ) VALUES (?, ?, ?, ?, 'RECEIVED', ?, ?)`, [id, source, eventType, JSON.stringify(payload), tossOrderId ?? null, orderNumber ?? null]);
        return id;
    }
    /**
     * Mark event as processed
     */
    async markProcessed(eventId) {
        await this.qb.execute(`UPDATE webhook_events 
       SET status = 'PROCESSED', processed_at = datetime('now')
       WHERE id = ?`, [eventId]);
    }
    /**
     * Mark event as failed
     */
    async markFailed(eventId, errorMessage) {
        await this.qb.execute(`UPDATE webhook_events 
       SET status = 'FAILED', error_message = ?, retry_count = retry_count + 1
       WHERE id = ?`, [errorMessage, eventId]);
    }
    /**
     * Mark event as skipped (already processed)
     */
    async markSkipped(eventId) {
        await this.qb.execute(`UPDATE webhook_events 
       SET status = 'SKIPPED', processed_at = datetime('now')
       WHERE id = ?`, [eventId]);
    }
    /**
     * Get recent webhook events for monitoring
     */
    async getRecent(limit = 50) {
        return this.qb.queryMany(`SELECT id, source, event_type, status, toss_order_id, order_number, 
              error_message, created_at, processed_at
       FROM webhook_events 
       ORDER BY created_at DESC 
       LIMIT ?`, [limit]);
    }
}
