/**
 * 🆕 2026-06-28 유어애즈(UR Ads) — 독립 계정 시스템.
 *
 *   대표 결정(2026-06-28): "유어애즈는 유어딜·도매몰과 전혀 무관" → 셀러(seller_token) 계정에
 *   얹혀있던 식별을 **완전 독립 계정**으로 분리. 자체 이메일/비밀번호 가입·로그인.
 *
 *   - 테넌트 식별: `ads_token`(HS256 JWT, claim {ads_id, typ:'ads'}) → ad_accounts.id.
 *     기존 sellerIdFrom(seller_token) 대신 adsAccountIdFrom 사용. 유어딜/도매몰 어떤 계정과도 무관.
 *   - 비밀번호: 공용 PBKDF2 해시 라이브러리(@/lib/password) 재사용(인증 인프라는 중립 — 서비스 결합 아님).
 *   - ad_* 테이블의 `seller_id` 컬럼은 이제 **ad_accounts.id**(테넌트)를 담는다(프리런치 — 마이그레이션
 *     불필요, 컬럼명만 레거시). /api/ads/* 가 배타적으로 이 네임스페이스를 소유하므로 셀러 id 와 섞이지 않음.
 */
import { hashPassword, verifyPassword, validatePasswordComplexity } from '@/lib/password'

const _schemaDone = new WeakSet<object>()

export async function ensureAdsAccountSchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    company_name TEXT,
    phone TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT (datetime('now')),
    last_login_at DATETIME
  )`).run().catch(() => null)
  // 대소문자 무시 이메일 유일성(중복 가입 차단).
  await DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_accounts_email ON ad_accounts(LOWER(email))`).run().catch(() => null)
}

export interface AdsAccount { id: number; email: string; company_name: string | null; phone: string | null; status: string | null }

/** ads_token(Bearer) → ad_accounts.id. 서명·typ·만료만 검증(상태 재검사는 호출측 선택). */
export async function adsAccountIdFrom(authorization: string | undefined, jwtSecret: string): Promise<number | null> {
  if (!authorization?.startsWith('Bearer ')) return null
  try {
    const { verify } = await import('hono/jwt')
    const payload = await verify(authorization.substring(7), jwtSecret, 'HS256') as { ads_id?: number; typ?: string }
    if (payload.typ !== 'ads' || !payload.ads_id) return null
    return Number(payload.ads_id)
  } catch {
    return null
  }
}

/** 30일 유효 ads_token 발급. */
export async function signAdsToken(accountId: number, jwtSecret: string): Promise<string> {
  const { sign } = await import('hono/jwt')
  const now = Math.floor(Date.now() / 1000)
  return sign({ ads_id: accountId, typ: 'ads', iat: now, exp: now + 60 * 60 * 24 * 30 }, jwtSecret, 'HS256')
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type SignupResult =
  | { ok: true; account: AdsAccount }
  | { ok: false; status: number; error: string }

/** 신규 유어애즈 계정 생성. 이메일 형식·비번 복잡도·중복 검사. */
export async function createAdsAccount(
  DB: D1Database,
  input: { email: string; password: string; company_name: string; phone?: string },
): Promise<SignupResult> {
  await ensureAdsAccountSchema(DB)
  const email = (input.email || '').trim().toLowerCase()
  const company = (input.company_name || '').trim()
  const phone = (input.phone || '').trim() || null
  if (!EMAIL_RE.test(email)) return { ok: false, status: 400, error: '올바른 이메일을 입력해주세요' }
  if (!company || company.length > 80) return { ok: false, status: 400, error: '회사(고객사) 이름을 입력해주세요' }
  const pw = validatePasswordComplexity(input.password)
  if (!pw.ok) return { ok: false, status: 400, error: pw.error }
  // 중복 이메일 사전 검사(인덱스가 최종 방어 — 경쟁 시 INSERT 실패).
  const dup = await DB.prepare('SELECT id FROM ad_accounts WHERE LOWER(email) = ?').bind(email).first<{ id: number }>().catch(() => null)
  if (dup) return { ok: false, status: 409, error: '이미 가입된 이메일입니다' }
  const password_hash = await hashPassword(input.password)
  try {
    const r = await DB.prepare(
      'INSERT INTO ad_accounts (email, password_hash, company_name, phone) VALUES (?, ?, ?, ?)'
    ).bind(email, password_hash, company, phone).run()
    const id = Number(r.meta?.last_row_id)
    if (!id) return { ok: false, status: 500, error: '가입 처리 중 오류가 발생했습니다' }
    return { ok: true, account: { id, email, company_name: company, phone, status: 'active' } }
  } catch {
    // UNIQUE 충돌(동시 가입) 등.
    return { ok: false, status: 409, error: '이미 가입된 이메일입니다' }
  }
}

export type LoginResult =
  | { ok: true; account: AdsAccount }
  | { ok: false; status: number; error: string }

/** 이메일/비번 로그인. 성공 시 last_login_at 갱신. */
export async function loginAdsAccount(
  DB: D1Database,
  email: string,
  password: string,
): Promise<LoginResult> {
  await ensureAdsAccountSchema(DB)
  const e = (email || '').trim().toLowerCase()
  if (!e || !password) return { ok: false, status: 400, error: '이메일과 비밀번호를 입력해주세요' }
  const row = await DB.prepare(
    'SELECT id, email, password_hash, company_name, phone, status FROM ad_accounts WHERE LOWER(email) = ?'
  ).bind(e).first<{ id: number; email: string; password_hash: string; company_name: string | null; phone: string | null; status: string | null }>().catch(() => null)
  // 사용자 열거 방지: 계정 없음/비번 불일치 동일 메시지.
  if (!row) return { ok: false, status: 401, error: '이메일 또는 비밀번호가 올바르지 않습니다' }
  const { valid } = await verifyPassword(password, row.password_hash)
  if (!valid) return { ok: false, status: 401, error: '이메일 또는 비밀번호가 올바르지 않습니다' }
  if (row.status && row.status !== 'active') return { ok: false, status: 403, error: '이용이 제한된 계정입니다' }
  await DB.prepare("UPDATE ad_accounts SET last_login_at = datetime('now') WHERE id = ?").bind(row.id).run().catch(() => null)
  return { ok: true, account: { id: row.id, email: row.email, company_name: row.company_name, phone: row.phone, status: row.status } }
}

export async function getAdsAccount(DB: D1Database, id: number): Promise<AdsAccount | null> {
  await ensureAdsAccountSchema(DB)
  return DB.prepare('SELECT id, email, company_name, phone, status FROM ad_accounts WHERE id = ?')
    .bind(id).first<AdsAccount>().catch(() => null)
}

export type MutateResult =
  | { ok: true; account: AdsAccount }
  | { ok: false; status: number; error: string }

/** 회사명/연락처 수정. */
export async function updateAdsAccount(DB: D1Database, id: number, patch: { company_name?: string; phone?: string }): Promise<MutateResult> {
  await ensureAdsAccountSchema(DB)
  const sets: string[] = []
  const binds: (string | null)[] = []
  if (patch.company_name !== undefined) {
    const company = patch.company_name.trim()
    if (!company || company.length > 80) return { ok: false, status: 400, error: '회사(고객사) 이름을 확인해주세요' }
    sets.push('company_name = ?'); binds.push(company)
  }
  if (patch.phone !== undefined) {
    sets.push('phone = ?'); binds.push(patch.phone.trim() || null)
  }
  if (sets.length) {
    await DB.prepare(`UPDATE ad_accounts SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, id).run().catch(() => null)
  }
  const account = await getAdsAccount(DB, id)
  return account ? { ok: true, account } : { ok: false, status: 404, error: '계정을 찾을 수 없습니다' }
}

export type PasswordResult = { ok: true } | { ok: false; status: number; error: string }

/** 비밀번호 변경 — 현재 비번 확인 + 새 비번 복잡도 검증. */
export async function changeAdsPassword(DB: D1Database, id: number, currentPassword: string, newPassword: string): Promise<PasswordResult> {
  await ensureAdsAccountSchema(DB)
  const row = await DB.prepare('SELECT password_hash FROM ad_accounts WHERE id = ?').bind(id).first<{ password_hash: string }>().catch(() => null)
  if (!row) return { ok: false, status: 404, error: '계정을 찾을 수 없습니다' }
  const { valid } = await verifyPassword(currentPassword, row.password_hash)
  if (!valid) return { ok: false, status: 401, error: '현재 비밀번호가 올바르지 않습니다' }
  const pw = validatePasswordComplexity(newPassword)
  if (!pw.ok) return { ok: false, status: 400, error: pw.error }
  const hash = await hashPassword(newPassword)
  await DB.prepare('UPDATE ad_accounts SET password_hash = ? WHERE id = ?').bind(hash, id).run().catch(() => null)
  return { ok: true }
}
