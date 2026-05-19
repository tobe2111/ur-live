/**
 * 🛡️ 2026-04-28: 통합 알림 dispatcher.
 *
 * 알림 종류별로 어드민이 설정한 채널 (dashboard/email/alimtalk/push) 만 발송.
 * notification_channel_settings 테이블 조회 → enabled 채널만 발송.
 *
 * 사용:
 *   await dispatchNotification(env, 'seller_approved', {
 *     dashboard: { recipientType: 'seller', recipientId: '123', title: '승인 완료', message: '...' },
 *     email: { to: 'user@ex.com', subject: '...', html: '...' },
 *     alimtalk: { phone: '010...', templateCode: 'seller_approved', message: '[유어딜] ...' },
 *     push: { userType: 'seller', userId: 123, title: '...', body: '...' },
 *   })
 *
 * 설정 미존재 → 기본값 (DEFAULT_CHANNELS) 사용.
 * 채널 발송 함수 throw → 다른 채널 영향 0 (Promise.allSettled).
 */

export type NotificationType =
  | 'seller_registered' | 'seller_approved' | 'seller_rejected'
  | 'agency_registered' | 'agency_approved'
  | 'new_order' | 'order_delivered'
  | 'gift_received' | 'gift_refunded'
  | 'settlement_completed' | 'settlement_request'
  | 'low_stock'
  | string; // 확장 가능

export interface ChannelSettings {
  dashboard: boolean;
  email: boolean;
  alimtalk: boolean;
  push: boolean;
}

export interface NotificationPayload {
  dashboard?: {
    recipientType: 'admin' | 'seller' | 'agency';
    recipientId: string | null;
    title: string;
    message?: string;
    link?: string;
  };
  email?: {
    to: string;
    subject: string;
    html: string;
  };
  alimtalk?: {
    phone: string;
    templateCode: string;
    message: string;
  };
  push?: {
    userType: 'user' | 'seller' | 'admin' | 'agency';
    userId: string | number;
    title: string;
    body: string;
    url?: string;
  };
}

const DEFAULT_CHANNELS: ChannelSettings = {
  dashboard: true,
  email: false,
  alimtalk: false,
  push: true,
};

// 🛡️ 2026-05-19: per-worker 메모이제이션.
let _settingsTableEnsured = false
async function ensureSettingsTable(db: D1Database) {
  if (_done_ensureSettingsTable.has(db)) return
  _done_ensureSettingsTable.add(db)
  if (_settingsTableEnsured) return
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS notification_channel_settings (
      notification_type TEXT PRIMARY KEY,
      dashboard_enabled INTEGER NOT NULL DEFAULT 1,
      email_enabled INTEGER NOT NULL DEFAULT 0,
      alimtalk_enabled INTEGER NOT NULL DEFAULT 0,
      push_enabled INTEGER NOT NULL DEFAULT 1,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run();
  } catch { /* exists */ }
  _settingsTableEnsured = true
}

export async function getChannelSettings(
  db: D1Database,
  type: NotificationType,
): Promise<ChannelSettings> {
  await ensureSettingsTable(db);
  try {
    const row = await db.prepare(
      `SELECT dashboard_enabled, email_enabled, alimtalk_enabled, push_enabled
       FROM notification_channel_settings WHERE notification_type = ?`
    ).bind(type).first<{
      dashboard_enabled: number; email_enabled: number;
      alimtalk_enabled: number; push_enabled: number;
    }>();
    if (!row) return DEFAULT_CHANNELS;
    return {
      dashboard: !!row.dashboard_enabled,
      email: !!row.email_enabled,
      alimtalk: !!row.alimtalk_enabled,
      push: !!row.push_enabled,
    };
  } catch {
    return DEFAULT_CHANNELS;
  }
}

export async function dispatchNotification(
  env: unknown,
  type: NotificationType,
  payload: NotificationPayload,
): Promise<{
  type: NotificationType;
  channels_attempted: string[];
  channels_succeeded: string[];
  channels_failed: string[];
}> {
  const e = env as { DB?: D1Database };
  const db = e?.DB;
  if (!db) {
    return { type, channels_attempted: [], channels_succeeded: [], channels_failed: [] };
  }

  const settings = await getChannelSettings(db, type);
  const attempted: string[] = [];
  const succeeded: string[] = [];
  const failed: string[] = [];

  const tasks: Array<{ name: string; fn: () => Promise<unknown> }> = [];

  if (settings.dashboard && payload.dashboard) {
    attempted.push('dashboard');
    tasks.push({
      name: 'dashboard',
      fn: async () => {
        const { createDashboardNotification } = await import(
          '../features/notifications/api/dashboard-notifications.routes'
        );
        return createDashboardNotification(
          db,
          payload.dashboard!.recipientType,
          payload.dashboard!.recipientId,
          type,
          payload.dashboard!.title,
          payload.dashboard!.message,
          payload.dashboard!.link,
        );
      },
    });
  }

  if (settings.email && payload.email) {
    attempted.push('email');
    tasks.push({
      name: 'email',
      fn: async () => {
        const { sendSystemEmail } = await import('./system-email');
        return sendSystemEmail(env, payload.email!.to, {
          subject: payload.email!.subject,
          html: payload.email!.html,
        });
      },
    });
  }

  if (settings.alimtalk && payload.alimtalk) {
    attempted.push('alimtalk');
    tasks.push({
      name: 'alimtalk',
      fn: async () => {
        const { sendSystemAlimtalk } = await import('./system-alimtalk');
        return sendSystemAlimtalk(
          env,
          payload.alimtalk!.phone,
          payload.alimtalk!.templateCode,
          payload.alimtalk!.message,
        );
      },
    });
  }

  if (settings.push && payload.push) {
    attempted.push('push');
    tasks.push({
      name: 'push',
      fn: async () => {
        const { sendSystemPush } = await import('./system-push');
        return sendSystemPush(env, payload.push!.userType, payload.push!.userId, {
          title: payload.push!.title,
          body: payload.push!.body,
          url: payload.push!.url,
        });
      },
    });
  }

  const results = await Promise.allSettled(tasks.map(t => t.fn()));
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') succeeded.push(tasks[i].name);
    else failed.push(tasks[i].name);
  });

  return { type, channels_attempted: attempted, channels_succeeded: succeeded, channels_failed: failed };
}


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureSettingsTable = new WeakSet<object>()
