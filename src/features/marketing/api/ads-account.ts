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
    access_unlocked INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT (datetime('now')),
    last_login_at DATETIME
  )`).run().catch(() => null)
  // 기존 행에 액세스 코드 잠금 컬럼 보강(best-effort — 이미 있으면 무시).
  await DB.prepare('ALTER TABLE ad_accounts ADD COLUMN access_unlocked INTEGER DEFAULT 0').run().catch(() => null)
  // 대소문자 무시 이메일 유일성(중복 가입 차단).
  await DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_accounts_email ON ad_accounts(LOWER(email))`).run().catch(() => null)
}

export interface AdsAccount { id: number; email: string; company_name: string | null; phone: string | null; status: string | null; access_unlocked: number }

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
  // 2026-07-10 대표 결정: 유어애즈 비번 정책 = 완화 모드(8자+ · 영문/숫자/특수 2종+) — 대문자 강제 해제.
  const pw = validatePasswordComplexity(input.password, { relaxed: true })
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
    return { ok: true, account: { id, email, company_name: company, phone, status: 'active', access_unlocked: 0 } }
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
    'SELECT id, email, password_hash, company_name, phone, status, access_unlocked FROM ad_accounts WHERE LOWER(email) = ?'
  ).bind(e).first<{ id: number; email: string; password_hash: string; company_name: string | null; phone: string | null; status: string | null; access_unlocked: number | null }>().catch(() => null)
  // 사용자 열거 방지: 계정 없음/비번 불일치 동일 메시지.
  if (!row) return { ok: false, status: 401, error: '이메일 또는 비밀번호가 올바르지 않습니다' }
  const { valid } = await verifyPassword(password, row.password_hash)
  if (!valid) return { ok: false, status: 401, error: '이메일 또는 비밀번호가 올바르지 않습니다' }
  if (row.status && row.status !== 'active') return { ok: false, status: 403, error: '이용이 제한된 계정입니다' }
  await DB.prepare("UPDATE ad_accounts SET last_login_at = datetime('now') WHERE id = ?").bind(row.id).run().catch(() => null)
  return { ok: true, account: { id: row.id, email: row.email, company_name: row.company_name, phone: row.phone, status: row.status, access_unlocked: Number(row.access_unlocked) || 0 } }
}

export async function getAdsAccount(DB: D1Database, id: number): Promise<AdsAccount | null> {
  await ensureAdsAccountSchema(DB)
  return DB.prepare('SELECT id, email, company_name, phone, status, access_unlocked FROM ad_accounts WHERE id = ?')
    .bind(id).first<AdsAccount>().catch(() => null)
}

/** 상수시간 문자열 비교 — 타이밍 사이드채널로 코드 추측 방지(길이만 노출, 내용 비교는 일정시간). */
function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a)
  const eb = new TextEncoder().encode(b)
  if (ea.length !== eb.length) return false
  let diff = 0
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i]
  return diff === 0
}

/** 액세스 코드 검증 → 잠금 해제(계정별 1회). 코드는 호출측(라우트)이 env 에서 주입. */
export async function unlockAdsAccount(DB: D1Database, id: number, code: string, expected: string): Promise<{ ok: boolean; error?: string }> {
  await ensureAdsAccountSchema(DB)
  if (!code || !expected || !timingSafeEqual(code.trim(), String(expected))) return { ok: false, error: '액세스 코드가 올바르지 않습니다' }
  await DB.prepare('UPDATE ad_accounts SET access_unlocked = 1 WHERE id = ?').bind(id).run().catch(() => null)
  return { ok: true }
}

// ── 비밀번호 재설정(이메일 토큰) ─────────────────────────────────────────────
const _resetSchemaDone = new WeakSet<object>()
async function ensureResetSchema(DB: D1Database): Promise<void> {
  if (_resetSchemaDone.has(DB)) return
  _resetSchemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME,
    created_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_ad_resets_token ON ad_password_resets(token_hash)').run().catch(() => null)
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** 재설정 요청 — 계정 있으면 1시간 유효 토큰 발급(해시 저장). 호출측이 이메일 발송. 열거 방지 위해
 *  계정 없으면 null 반환(라우트는 항상 success). */
export async function requestPasswordReset(DB: D1Database, email: string): Promise<{ accountId: number; email: string; token: string } | null> {
  await ensureAdsAccountSchema(DB); await ensureResetSchema(DB)
  const e = (email || '').trim().toLowerCase()
  if (!EMAIL_RE.test(e)) return null
  const acc = await DB.prepare('SELECT id, email FROM ad_accounts WHERE LOWER(email) = ?').bind(e).first<{ id: number; email: string }>().catch(() => null)
  if (!acc) return null
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('')
  const tokenHash = await sha256Hex(token)
  await DB.prepare("INSERT INTO ad_password_resets (account_id, token_hash, expires_at) VALUES (?, ?, datetime('now', '+1 hour'))")
    .bind(acc.id, tokenHash).run().catch(() => null)
  return { accountId: acc.id, email: acc.email, token }
}

/** 토큰으로 비밀번호 재설정 — 미만료·미사용 + 복잡도 검증 후 변경, 토큰 1회용 소모. */
export async function resetPasswordWithToken(DB: D1Database, token: string, newPassword: string): Promise<PasswordResult> {
  await ensureResetSchema(DB)
  if (!token || token.length < 32) return { ok: false, status: 400, error: '유효하지 않은 링크입니다' }
  const tokenHash = await sha256Hex(token)
  const row = await DB.prepare("SELECT id, account_id FROM ad_password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')")
    .bind(tokenHash).first<{ id: number; account_id: number }>().catch(() => null)
  if (!row) return { ok: false, status: 400, error: '만료되었거나 이미 사용된 링크입니다. 다시 요청해주세요.' }
  const pw = validatePasswordComplexity(newPassword, { relaxed: true })
  if (!pw.ok) return { ok: false, status: 400, error: pw.error }
  const hash = await hashPassword(newPassword)
  await DB.prepare('UPDATE ad_accounts SET password_hash = ? WHERE id = ?').bind(hash, row.account_id).run().catch(() => null)
  await DB.prepare("UPDATE ad_password_resets SET used_at = datetime('now') WHERE id = ?").bind(row.id).run().catch(() => null)
  return { ok: true }
}

// ── 🟡 카카오 로그인 (2026-07-27 대표 "/ads 도 카카오 로그인 가능하게") ────────
//   유어애즈 독립 계정 유지 — 카카오는 *로그인 수단*일 뿐(유어딜 소비자 카카오 세션과 무관).
//   매칭 규칙(플랫폼 관례 미러): ① kakao_id 일치 → 로그인 ② verified 이메일 일치 → 기존 계정에
//   kakao_id 연결(미verified 이메일 takeover 차단 — 2026-05-31 감사 룰) ③ 없으면 신규 생성.
const _kakaoColDone = new WeakSet<object>()
async function ensureKakaoColumn(DB: D1Database): Promise<void> {
  if (_kakaoColDone.has(DB)) return
  _kakaoColDone.add(DB)
  await DB.prepare('ALTER TABLE ad_accounts ADD COLUMN kakao_id TEXT').run().catch(() => null)
  await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_accounts_kakao ON ad_accounts(kakao_id) WHERE kakao_id IS NOT NULL').run().catch(() => null)
}

export interface KakaoAdsProfile { kakaoId: string; email: string | null; emailVerified: boolean; nickname: string | null }

/** 카카오 프로필 → 유어애즈 계정 로그인/연결/생성. 반환 {account, created}. */
export async function kakaoLoginAdsAccount(DB: D1Database, k: KakaoAdsProfile): Promise<{ ok: true; account: AdsAccount; created: boolean } | { ok: false; status: number; error: string }> {
  await ensureAdsAccountSchema(DB)
  await ensureKakaoColumn(DB)
  const kid = String(k.kakaoId || '').trim()
  if (!kid) return { ok: false, status: 400, error: '카카오 프로필을 확인하지 못했습니다' }
  const cols = 'id, email, company_name, phone, status, access_unlocked'
  // ① kakao_id 재로그인
  let row = await DB.prepare(`SELECT ${cols} FROM ad_accounts WHERE kakao_id = ?`).bind(kid).first<AdsAccount>().catch(() => null)
  // ② verified 같은 이메일 → 기존 이메일 계정에 카카오 연결. 이미 **다른** 카카오가 연결된 계정이면
  //    로그인/연결/신규생성 전부 거부(그 이메일로 복구경로 진입도 차단 — 계정 탈취 여지 0).
  if (!row && k.email && k.emailVerified) {
    const byEmail = await DB.prepare(`SELECT ${cols}, kakao_id FROM ad_accounts WHERE LOWER(email) = ?`)
      .bind(k.email.trim().toLowerCase()).first<AdsAccount & { kakao_id: string | null }>().catch(() => null)
    if (byEmail?.kakao_id && byEmail.kakao_id !== kid) {
      return { ok: false, status: 409, error: '이 이메일은 이미 다른 카카오 계정과 연결돼 있습니다 — 이메일 로그인을 이용해주세요' }
    }
    if (byEmail) {
      await DB.prepare('UPDATE ad_accounts SET kakao_id = ? WHERE id = ? AND kakao_id IS NULL').bind(kid, byEmail.id).run().catch(() => null)
      row = byEmail
    }
  }
  // ③ 신규 생성 — 비번 없는 카카오 계정(무작위 해시 = 비번 로그인 불가, 카카오로만).
  let created = false
  if (!row) {
    const email = k.email && k.emailVerified ? k.email.trim().toLowerCase() : `kakao${kid}@kakao.local`
    const company = (k.nickname || '').trim().slice(0, 80) || '카카오 회원'
    const randomPw = Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, '0')).join('')
    const hash = await hashPassword(randomPw)
    try {
      const r = await DB.prepare('INSERT INTO ad_accounts (email, password_hash, company_name, kakao_id) VALUES (?, ?, ?, ?)')
        .bind(email, hash, company, kid).run()
      const id = Number(r.meta?.last_row_id)
      if (!id) return { ok: false, status: 500, error: '가입 처리 중 오류가 발생했습니다' }
      row = { id, email, company_name: company, phone: null, status: 'active', access_unlocked: 0 }
      created = true
    } catch {
      // UNIQUE 충돌(동시 요청 경쟁) — **내 kakao_id 로만** 재조회 자기치유(이메일 재조회는
      //   다른 카카오가 연결된 계정으로 새는 탈취 경로라 금지).
      row = await DB.prepare(`SELECT ${cols} FROM ad_accounts WHERE kakao_id = ?`)
        .bind(kid).first<AdsAccount>().catch(() => null)
      if (!row) return { ok: false, status: 409, error: '가입 처리 중 충돌이 발생했습니다 — 다시 시도해주세요' }
    }
  }
  if (row.status && row.status !== 'active') return { ok: false, status: 403, error: '이용이 제한된 계정입니다' }
  await DB.prepare("UPDATE ad_accounts SET last_login_at = datetime('now') WHERE id = ?").bind(row.id).run().catch(() => null)
  return { ok: true, account: { ...row, access_unlocked: Number(row.access_unlocked) || 0 }, created }
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
  const pw = validatePasswordComplexity(newPassword, { relaxed: true })
  if (!pw.ok) return { ok: false, status: 400, error: pw.error }
  const hash = await hashPassword(newPassword)
  await DB.prepare('UPDATE ad_accounts SET password_hash = ? WHERE id = ?').bind(hash, id).run().catch(() => null)
  return { ok: true }
}

/** 어드민 강제 비밀번호 재설정 — 현재 비번 확인 없이 새 비번 세팅(운영자 콘솔 전용).
 *  호출측(라우트)에서 requireAdmin 게이트 필수. 새 비번은 요청 바디로만 전달(레포에 하드코딩 금지). */
export async function adminSetPassword(DB: D1Database, id: number, newPassword: string): Promise<PasswordResult> {
  await ensureAdsAccountSchema(DB)
  const row = await DB.prepare('SELECT id FROM ad_accounts WHERE id = ?').bind(id).first<{ id: number }>().catch(() => null)
  if (!row) return { ok: false, status: 404, error: '계정을 찾을 수 없습니다' }
  const pw = validatePasswordComplexity(newPassword, { relaxed: true })
  if (!pw.ok) return { ok: false, status: 400, error: pw.error }
  const hash = await hashPassword(newPassword)
  await DB.prepare('UPDATE ad_accounts SET password_hash = ? WHERE id = ?').bind(hash, id).run().catch(() => null)
  return { ok: true }
}
