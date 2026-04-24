/**
 * Seller Auth Helpers
 * Shared types, table-setup helpers, and utility functions used by all
 * seller auth sub-routes.
 */

export type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  FRONTEND_URL?: string;
};

export type SellerLoginRequest = {
  email: string;
  password: string;
};

export type SellerLoginResponse = {
  token: string;
  seller: {
    id: number;
    username: string;
    email: string;
    name: string;
    business_name: string;
    status: string;
    commission_rate: number;
    seller_type: string;
  };
};

/**
 * refresh_tokens 보조 테이블 (admin/seller용) 생성.
 * admin.routes.ts의 동명 함수와 동일 스키마. 멱등(IF NOT EXISTS).
 */
export async function ensureAuthRefreshTokensTable(DB: D1Database) {
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_type TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run().catch(() => {});
  await DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user ON auth_refresh_tokens(user_type, user_id)'
  ).run().catch(() => {});
}

// ── 비밀번호 재설정 토큰 테이블 보장 ─────────────────────────
export async function ensurePasswordResetTable(DB: D1Database) {
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_type TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {});
  await DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token)'
  ).run().catch(() => {});
}

/** 32자 hex 토큰 생성 (Web Crypto) */
export function generateResetToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** 비밀번호 재설정 이메일 HTML */
export function getPasswordResetEmailHTML(resetUrl: string): string {
  // 🛡️ 2026-04-22: GDPR/반스팸법 준수 — 모든 마케팅/시스템 이메일에 unsubscribe 링크 + 발신자 정보 포함.
  // 비밀번호 재설정은 거래성(transactional)이라 unsubscribe 의무는 약하나 footer 표준화.
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1d1d1f;">
      <h2 style="font-size:20px;margin:0 0 16px;">유어딜 비밀번호 재설정</h2>
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
        아래 링크를 클릭하여 새 비밀번호를 설정하세요. (1시간 유효)
      </p>
      <p style="margin:24px 0;">
        <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">
          비밀번호 재설정하기
        </a>
      </p>
      <p style="font-size:13px;color:#666;line-height:1.6;margin-top:24px;">
        요청하지 않았다면 이 이메일을 무시하세요.<br>
        링크가 동작하지 않을 경우 아래 URL을 복사해 주소창에 붙여넣으세요:<br>
        <span style="word-break:break-all;color:#2563eb;">${resetUrl}</span>
      </p>
      <hr style="border:none;border-top:1px solid #e5e5e7;margin:32px 0 16px;">
      <p style="font-size:11px;color:#999;line-height:1.5;text-align:center;">
        본 메일은 비밀번호 재설정 요청에 의한 발송입니다.<br>
        <strong>리스터코퍼레이션</strong> | 사업자등록번호: 783-87-03224<br>
        문의: <a href="mailto:contact@ur-team.com" style="color:#666;">contact@ur-team.com</a><br>
        <a href="https://live.ur-team.com/account/notifications" style="color:#666;">알림 설정 변경</a>
      </p>
    </div>
  `;
}
