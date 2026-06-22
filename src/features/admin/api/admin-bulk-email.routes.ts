/**
 * Admin Bulk Email Routes — 어드민 단체메일 (Wave 3b, 2026-06-09)
 *
 * 어드민이 역할/등급/상태 필터로 수신자를 고르고 이메일 일괄 발송.
 *
 * 🛡️ 2026-06-09 HARDENING — 요청 안에서 직접 발송하던 것을 **큐 + cron drainer** 로 전환.
 *   기존: POST /bulk-email 가 수천 명을 한 요청 안에서 배치 발송 → Workers CPU/wall 한도 초과
 *         + 재시도 시 per-recipient 멱등 없음 → 중복발송 위험.
 *   변경: POST /bulk-email 는 수신자를 서버에서 해석 → bulk_email_jobs(1행) + bulk_email_job_recipients
 *         (수신자별 'pending' 행)만 INSERT 하고 즉시 반환. 실제 발송은
 *         cron drainer(`src/worker/cron/bulk-email-drain.ts`)가 1~2분마다 한 batch 씩 처리.
 *         수신자 행이 'pending' 일 때만 CAS(pending→sent) 후 발송 → cron 재실행이 중복발송 안 함.
 *   test:true 는 그대로 본인에게 즉시 1건 발송(인라인 OK — 단일 건).
 *
 * 🔁 기존 인프라 재사용 (신규 유료 서비스 추가 X):
 *   - 발송: `sendEmail()` (src/services/email.ts) — Resend API.
 *     · 크론(seller-daily-report / agency-monthly-report)이 쓰는 동일 provider.
 *     · circuit breaker + 2회 retry + email_suppressions(바운스 목록) 자동 skip 내장.
 *   - env: RESEND_API_KEY (필수) / RESEND_FROM (선택).
 *
 * 엔드포인트 (adminApp 에 마운트 → /api/admin/bulk-email):
 *   - POST /bulk-email/preview  → 필터 해석 후 수신자 수 + 샘플 미리보기
 *   - POST /bulk-email          → 작업 큐잉(enqueue) / test:true 면 본인에게 즉시 1건
 *   - GET  /bulk-email/jobs      → 최근 작업 + 진행상황 (큐 drainer 진척)
 *   - GET  /bulk-email/jobs/:id  → 작업 상세 (sent/failed/total)
 *   - GET  /bulk-email/log      → 최근 발송 요약 로그 (작업 완료 시 1행 기록)
 *
 * 보안: adminApp 에 이미 IP whitelist + requireAdmin() + audit middleware 적용됨.
 *       추가로 enqueue endpoint 에 rate limit.
 *
 * 수신자 목록은 절대 클라이언트에서 받지 않고 서버에서 필터로만 해석.
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';
import { rateLimit } from '@/worker/middleware/rate-limit';
import { safeError } from '@/worker/utils/safe-error';
import { sendEmail } from '@/services/email';

export const adminBulkEmailRoutes = new Hono<{ Bindings: Env }>();

// ── 타입 ──────────────────────────────────────────────────────────────────────
type Role = 'seller' | 'distributor' | 'supplier';
type StatusFilter = 'all' | 'approved' | 'pending';

interface BulkEmailFilter {
  role: Role;
  status?: StatusFilter;
  grade?: string | null; // distributor 전용 (distributor_grade)
}

interface Recipient {
  email: string;
  name: string;
}

const MAX_SUBJECT = 200;
const MAX_BODY = 50_000;
const HARD_RECIPIENT_CAP = 5000; // 안전 상한 (실수로 대량 발송 방지)
const ENQUEUE_CHUNK = 200;       // 수신자 행 bulk-insert 청크 (D1 bind 변수 한도 보호)

// ── 필터 정규화 + 검증 ──────────────────────────────────────────────────────────
function parseFilter(raw: unknown): { filter: BulkEmailFilter } | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: '필터가 올바르지 않습니다' };
  const f = raw as Record<string, unknown>;
  const role = String(f.role ?? '');
  if (!['seller', 'distributor', 'supplier'].includes(role)) {
    return { error: '역할(role)은 seller / distributor / supplier 중 하나여야 합니다' };
  }
  const statusRaw = String(f.status ?? 'all');
  const status: StatusFilter = (['all', 'approved', 'pending'].includes(statusRaw) ? statusRaw : 'all') as StatusFilter;
  let grade: string | null = null;
  if (role === 'distributor' && f.grade != null && String(f.grade).trim() !== '' && String(f.grade) !== 'all') {
    const g = String(f.grade).toUpperCase().slice(0, 8);
    if (!/^[A-Z0-9]+$/.test(g)) return { error: '등급 형식이 올바르지 않습니다' };
    grade = g;
  }
  return { filter: { role: role as Role, status, grade } };
}

// 상태 필터 → sellers/suppliers 의 status 컬럼 매핑.
//   sellers.status: 'pending'|'approved'|'rejected'|'suspended' (일부 경로는 'active' 사용)
//   suppliers.status: 'pending'|'approved' 등
function statusClause(status: StatusFilter, col = 'status'): { sql: string; binds: string[] } {
  if (status === 'approved') return { sql: ` AND ${col} IN ('approved','active')`, binds: [] };
  if (status === 'pending') return { sql: ` AND ${col} = 'pending'`, binds: [] };
  return { sql: '', binds: [] };
}

// 유효 이메일 보유 가드 — 빈/NULL/형식불량 제외 (서버에서 한 번 더).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── 수신자 해석 (서버 사이드 only) ──────────────────────────────────────────────
async function resolveRecipients(DB: D1Database, filter: BulkEmailFilter): Promise<Recipient[]> {
  const binds: unknown[] = [];
  let sql: string;

  if (filter.role === 'supplier') {
    // 제조사 — suppliers 테이블
    const st = statusClause(filter.status ?? 'all');
    sql = `SELECT email AS email, COALESCE(business_name, '') AS name
           FROM suppliers
           WHERE email IS NOT NULL AND email <> ''${st.sql}
           LIMIT ${HARD_RECIPIENT_CAP}`;
  } else {
    // 셀러 / 판매사 — sellers 테이블
    const st = statusClause(filter.status ?? 'all');
    let extra = '';
    if (filter.role === 'distributor') {
      extra += ' AND is_distributor = 1';
      if (filter.grade) {
        extra += ' AND distributor_grade = ?';
        binds.push(filter.grade);
      }
    }
    sql = `SELECT email AS email, COALESCE(business_name, name, '') AS name
           FROM sellers
           WHERE email IS NOT NULL AND email <> ''${st.sql}${extra}
           LIMIT ${HARD_RECIPIENT_CAP}`;
  }

  const { results } = await DB.prepare(sql).bind(...binds).all<Recipient>();
  // 이메일 형식 + 중복 제거 (대소문자 무시).
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const r of results ?? []) {
    const email = String(r.email ?? '').trim();
    if (!email || !EMAIL_RE.test(email)) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ email, name: String(r.name ?? '').trim() });
  }
  return out;
}

// ── 본문 → 완성 HTML (법적 footer + 수신거부 안내 자동 부착) ──────────────────────
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function looksLikeHtml(body: string): boolean {
  return /<[a-z][\s\S]*>/i.test(body);
}

function buildBulkHtml(subject: string, body: string): string {
  // plain text 면 escape + 줄바꿈 보존. 단순 HTML 이면 그대로 사용(어드민 신뢰).
  const content = looksLikeHtml(body)
    ? body
    : `<p style="font-size:15px;line-height:1.7;margin:0;white-space:pre-line;">${escapeHtml(body)}</p>`;
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1d1d1f;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <div style="padding:20px 28px;border-bottom:1px solid #eee;">
      <span style="font-size:18px;font-weight:700;background:linear-gradient(135deg,#ff6b6b,#6b7280);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">유어딜</span>
    </div>
    <div style="padding:28px;">
      ${content}
    </div>
    <div style="padding:18px 28px;background:#fafafa;border-top:1px solid #eee;font-size:11px;color:#999;line-height:1.6;">
      본 메일은 유어딜(리스터코퍼레이션)이 회원님께 발송한 안내 메일입니다.<br>
      <strong>리스터코퍼레이션</strong> · 사업자등록번호 783-87-03224 · 문의 <a href="mailto:contact@ur-team.com" style="color:#666;">contact@ur-team.com</a><br>
      수신을 원치 않으시면 <a href="mailto:contact@ur-team.com?subject=수신거부" style="color:#666;">수신거부</a>를 신청해주세요.
    </div>
  </div>
</body></html>`;
}

// ── POST /bulk-email/preview — 수신자 수 미리보기 ───────────────────────────────
adminBulkEmailRoutes.post('/bulk-email/preview', cors(), async (c) => {
  try {
    const body = await c.req.json<{ filter?: unknown }>().catch(() => ({} as any));
    const parsed = parseFilter(body.filter);
    if ('error' in parsed) return c.json({ success: false, error: parsed.error }, 400);

    const recipients = await resolveRecipients(c.env.DB, parsed.filter);
    return c.json({
      success: true,
      data: {
        count: recipients.length,
        capped: recipients.length >= HARD_RECIPIENT_CAP,
        sample: recipients.slice(0, 5).map((r) => ({ name: r.name, email: maskEmail(r.email) })),
      },
    });
  } catch (err) {
    return safeError(c, err, '수신자 조회 중 오류가 발생했습니다', '[admin-bulk-email:preview]');
  }
});

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  return `${local[0] ?? '*'}***@${domain}`;
}

// ── POST /bulk-email — 작업 큐잉(enqueue) / test 는 즉시 1건 ──────────────────────
//   ⚠️ 수천 명을 요청 안에서 발송하면 Workers CPU/wall 한도 + 중복발송 위험 →
//   수신자 행만 'pending' 으로 insert 하고 cron drainer 가 멱등하게 비운다.
adminBulkEmailRoutes.post(
  '/bulk-email',
  cors(),
  rateLimit({ action: 'admin_bulk_email', max: 10, windowSec: 600 }),
  async (c) => {
    try {
      const apiKey = (c.env as Env & { RESEND_API_KEY?: string }).RESEND_API_KEY;
      const resendFrom = (c.env as Env & { RESEND_FROM?: string }).RESEND_FROM;
      if (!apiKey) {
        return c.json(
          { success: false, error: '이메일 발송 설정(RESEND_API_KEY)이 되어 있지 않습니다. 운영팀에 문의하세요.' },
          503,
        );
      }

      const body = await c.req.json<{ filter?: unknown; subject?: unknown; body?: unknown; test?: unknown }>();
      const subject = String(body.subject ?? '').trim();
      const content = String(body.body ?? '').trim();
      const isTest = body.test === true;

      if (!subject) return c.json({ success: false, error: '제목을 입력해주세요' }, 400);
      if (subject.length > MAX_SUBJECT) return c.json({ success: false, error: `제목은 ${MAX_SUBJECT}자 이하여야 합니다` }, 400);
      if (!content) return c.json({ success: false, error: '본문을 입력해주세요' }, 400);
      if (content.length > MAX_BODY) return c.json({ success: false, error: `본문은 ${MAX_BODY}자 이하여야 합니다` }, 400);

      const parsed = parseFilter(body.filter);
      if ('error' in parsed) return c.json({ success: false, error: parsed.error }, 400);

      const html = buildBulkHtml(subject, content);
      const user = (c as unknown as { get: (k: string) => unknown }).get('user') as
        | { id?: string | number; email?: string }
        | undefined;

      // ── 테스트 발송 — 본인에게 즉시 1건 (인라인 OK, 단일 건이라 한도 무관) ──
      if (isTest) {
        const adminEmail = String(user?.email ?? '').trim();
        if (!adminEmail || !EMAIL_RE.test(adminEmail)) {
          return c.json({ success: false, error: '관리자 본인 이메일을 확인할 수 없어 테스트 발송이 불가합니다' }, 400);
        }
        const fromTitled = resendFrom || '유어딜 <onboarding@resend.dev>';
        const res = await sendEmail({ to: adminEmail, subject, html }, apiKey, fromTitled, c.env.DB);
        if (!res.success && res.error !== 'suppressed') {
          return c.json({ success: false, error: '테스트 메일 발송에 실패했습니다' }, 502);
        }
        return c.json({ success: true, data: { test: true, sent: res.success ? 1 : 0 } });
      }

      // ── 실제 발송 — 수신자 해석 후 작업 큐잉 (발송은 cron drainer 가) ──
      const recipients = await resolveRecipients(c.env.DB, parsed.filter);
      if (recipients.length === 0) {
        return c.json({ success: false, error: '조건에 맞는 수신자(이메일 보유)가 없습니다' }, 400);
      }

      await ensureJobTables(c.env.DB);

      // 1) 작업 행 INSERT (status 'pending').
      const jobRes = await c.env.DB.prepare(`
        INSERT INTO bulk_email_jobs
          (admin_id, admin_email, filter_json, subject, body_html, status, total, sent, failed)
        VALUES (?, ?, ?, ?, ?, 'pending', ?, 0, 0)
      `).bind(
        user?.id != null ? String(user.id) : null,
        user?.email ?? null,
        JSON.stringify(parsed.filter).slice(0, 1000),
        subject.slice(0, MAX_SUBJECT),
        html,
        recipients.length,
      ).run();

      const jobId = Number(jobRes.meta.last_row_id);
      if (!Number.isFinite(jobId) || jobId <= 0) {
        return c.json({ success: false, error: '작업 생성에 실패했습니다' }, 500);
      }

      // 2) 수신자 행 bulk-insert ('pending'). UNIQUE(job_id,email) → 멱등 가드.
      //    청크로 나눠 D1 bind 변수 한도(~100 변수/문) 안전하게.
      for (let i = 0; i < recipients.length; i += ENQUEUE_CHUNK) {
        const chunk = recipients.slice(i, i + ENQUEUE_CHUNK);
        const values = chunk.map(() => '(?, ?, ?, \'pending\')').join(',');
        const binds: unknown[] = [];
        for (const r of chunk) {
          binds.push(jobId, r.email, r.name || null);
        }
        await c.env.DB.prepare(
          `INSERT OR IGNORE INTO bulk_email_job_recipients (job_id, email, name, status) VALUES ${values}`,
        ).bind(...binds).run();
      }

      return c.json({
        success: true,
        data: { job_id: jobId, total: recipients.length, status: 'pending' },
      });
    } catch (err) {
      return safeError(c, err, '단체메일 작업 등록 중 오류가 발생했습니다', '[admin-bulk-email:enqueue]');
    }
  },
);

// ── GET /bulk-email/jobs — 최근 작업 + 진행상황 ─────────────────────────────────
adminBulkEmailRoutes.get('/bulk-email/jobs', cors(), async (c) => {
  try {
    await ensureJobTables(c.env.DB);
    const { results } = await c.env.DB.prepare(`
      SELECT id, admin_email, filter_json, subject, status, total, sent, failed, created_at, updated_at
      FROM bulk_email_jobs
      ORDER BY id DESC
      LIMIT 30
    `).all();
    return c.json({ success: true, data: results ?? [] });
  } catch (err) {
    return safeError(c, err, '작업 목록 조회 중 오류가 발생했습니다', '[admin-bulk-email:jobs]');
  }
});

// ── GET /bulk-email/jobs/:id — 작업 상세 ────────────────────────────────────────
adminBulkEmailRoutes.get('/bulk-email/jobs/:id', cors(), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    if (!Number.isFinite(id) || id <= 0) {
      return c.json({ success: false, error: '잘못된 작업 ID 입니다' }, 400);
    }
    await ensureJobTables(c.env.DB);
    const job = await c.env.DB.prepare(`
      SELECT id, admin_email, filter_json, subject, status, total, sent, failed, created_at, updated_at
      FROM bulk_email_jobs WHERE id = ?
    `).bind(id).first();
    if (!job) return c.json({ success: false, error: '작업을 찾을 수 없습니다' }, 404);

    // 상태별 수신자 수 집계 (pending/sent/failed/skipped).
    const { results: counts } = await c.env.DB.prepare(`
      SELECT status, COUNT(*) AS cnt
      FROM bulk_email_job_recipients WHERE job_id = ?
      GROUP BY status
    `).bind(id).all<{ status: string; cnt: number }>();
    const breakdown: Record<string, number> = { pending: 0, sent: 0, failed: 0, skipped: 0 };
    for (const r of counts ?? []) breakdown[r.status] = Number(r.cnt) || 0;

    return c.json({ success: true, data: { ...job, breakdown } });
  } catch (err) {
    return safeError(c, err, '작업 상세 조회 중 오류가 발생했습니다', '[admin-bulk-email:job-detail]');
  }
});

// ── GET /bulk-email/log — 최근 발송 로그 ────────────────────────────────────────
adminBulkEmailRoutes.get('/bulk-email/log', cors(), async (c) => {
  try {
    await ensureLogTable(c.env.DB);
    const { results } = await c.env.DB.prepare(`
      SELECT id, admin_email, filter_json, subject, recipient_count, sent_count, failed_count, skipped_count, is_test, created_at
      FROM bulk_email_log
      ORDER BY created_at DESC
      LIMIT 50
    `).all();
    return c.json({ success: true, data: results ?? [] });
  } catch (err) {
    return safeError(c, err, '발송 로그 조회 중 오류가 발생했습니다', '[admin-bulk-email:log]');
  }
});

// ensure-on-use — repair-schema 미실행 환경에서도 자동 생성.
const _ensuredLog = new WeakSet<object>();
async function ensureLogTable(DB: D1Database): Promise<void> {
  if (_ensuredLog.has(DB as unknown as object)) return;
  _ensuredLog.add(DB as unknown as object);
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS bulk_email_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id TEXT,
      admin_email TEXT,
      filter_json TEXT,
      subject TEXT NOT NULL,
      recipient_count INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      skipped_count INTEGER DEFAULT 0,
      is_test INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now'))
    )
  `).run().catch(() => { /* exists */ });
}

// ensure-on-use — 큐 테이블 (repair-schema 와 동일 스키마, 미실행 환경 대비).
//   exported → cron drainer 도 동일 보장 후 작업 처리.
const _ensuredJobs = new WeakSet<object>();
export async function ensureBulkEmailJobTables(DB: D1Database): Promise<void> {
  if (_ensuredJobs.has(DB as unknown as object)) return;
  _ensuredJobs.add(DB as unknown as object);
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS bulk_email_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id TEXT,
      admin_email TEXT,
      filter_json TEXT,
      subject TEXT NOT NULL,
      body_html TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      total INTEGER NOT NULL DEFAULT 0,
      sent INTEGER NOT NULL DEFAULT 0,
      failed INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now'))
    )
  `).run().catch(() => { /* exists */ });
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS bulk_email_job_recipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      sent_at DATETIME
    )
  `).run().catch(() => { /* exists */ });
  await DB.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_bulk_email_job_recipients_unique ON bulk_email_job_recipients(job_id, email)`,
  ).run().catch(() => { /* exists */ });
  await DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_bulk_email_job_recipients_pending ON bulk_email_job_recipients(job_id, status)`,
  ).run().catch(() => { /* exists */ });
  await DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_bulk_email_jobs_status ON bulk_email_jobs(status, id)`,
  ).run().catch(() => { /* exists */ });
}

// 라우트 내부에서 쓰는 짧은 alias.
async function ensureJobTables(DB: D1Database): Promise<void> {
  return ensureBulkEmailJobTables(DB);
}
