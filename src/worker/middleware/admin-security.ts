/**
 * Admin Security Middleware
 *
 * 1. IP Whitelist — ADMIN_IP_WHITELIST env var (comma-separated CIDRs/IPs)
 *    If not set, all IPs are allowed (you should set this in production)
 * 2. Audit Logging — every admin action is logged to admin_audit_logs
 */

import { Context, Next } from 'hono';

// ── IP Whitelist ──────────────────────────────────────────────────────────────

function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function isIpInCidr(ip: string, cidr: string): boolean {
  if (!cidr.includes('/')) return ip === cidr;
  const [base, bits] = cidr.split('/');
  const mask = bits ? (0xffffffff << (32 - parseInt(bits, 10))) >>> 0 : 0xffffffff;
  return (ipToInt(ip) & mask) === (ipToInt(base!) & mask);
}

function isIpAllowed(ip: string, whitelist: string[]): boolean {
  if (whitelist.length === 0) return true; // no restriction if not configured
  return whitelist.some(entry => isIpInCidr(ip, entry.trim()));
}

export function adminIpWhitelist() {
  return async (c: Context, next: Next) => {
    const rawList = (c.env as Record<string, unknown>).ADMIN_IP_WHITELIST as string | undefined;
    if (!rawList) return next(); // not configured → allow all

    const whitelist = rawList.split(',').map(s => s.trim()).filter(Boolean);
    if (whitelist.length === 0) return next();

    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '';

    if (!isIpAllowed(ip, whitelist)) {
      console.warn('[Admin] IP blocked:', ip);
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    return next();
  };
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

export interface AuditContext {
  action: string;
  targetType?: string;
  targetId?: string | number;
  before?: unknown;
  after?: unknown;
}

export async function writeAuditLog(
  c: Context,
  ctx: AuditContext
): Promise<void> {
  try {
    const db: D1Database | undefined = (c.env as Record<string, unknown>).DB as D1Database | undefined;
    if (!db) return;

    const user = c.get('user') as { id?: string | number; email?: string } | undefined;
    const adminId = String(user?.id ?? 'unknown');
    const adminEmail = user?.email ?? null;
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || null;
    const userAgent = c.req.header('User-Agent') || null;

    await db.prepare(`
      INSERT INTO admin_audit_logs
        (admin_id, admin_email, action, target_type, target_id, before_value, after_value, ip, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      adminId,
      adminEmail,
      ctx.action,
      ctx.targetType ?? null,
      ctx.targetId != null ? String(ctx.targetId) : null,
      ctx.before != null ? JSON.stringify(ctx.before) : null,
      ctx.after != null ? JSON.stringify(ctx.after) : null,
      ip,
      userAgent,
    ).run();
  } catch (err) {
    // Audit log failure must not block the operation
    console.error('[AuditLog] Failed to write:', err);
  }
}

/**
 * Middleware that auto-logs every mutating admin request (POST/PUT/PATCH/DELETE)
 * Fine-grained logging (with before/after) is done by calling writeAuditLog() directly in handlers.
 */
export function adminAuditMiddleware() {
  return async (c: Context, next: Next) => {
    const method = c.req.method;
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next();

    await next();

    // Log after response so we know it succeeded
    if (c.res.status < 400) {
      const url = new URL(c.req.url);
      await writeAuditLog(c, {
        action: `${method} ${url.pathname}`,
      });
    }
  };
}
