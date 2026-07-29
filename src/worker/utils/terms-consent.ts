/**
 * 약관 동의 기록 — 2026-07-05 약관 v1.0 시행 (대표 확정).
 *
 * 가입(에이전시/판매자) 시점의 약관 동의를 감사 가능하게 남긴다:
 *   누가(subject/user) · 어떤 약관(slug) · 어떤 버전 · 언제 · 어디서(ip) · 핵심조항 개별동의 여부.
 * 에이전시 파트너 약관 전문(前文): "가입 화면에서 제4조·제5조·제9조·제10조는 요약 고지 및
 * 개별 동의를 받습니다" → core_terms_agreed 로 기록.
 *
 * 기록은 fail-soft(동의 기록 실패가 가입을 막지 않음 — 동의 여부 검증은 핸들러가 400 으로 선행).
 * per-request DDL 금지 룰 준수: WeakSet 메모이즈 + repair-schema 에도 동일 테이블 등록.
 */

const _ensured = new WeakSet<object>()

export async function ensureTermsConsents(db: D1Database): Promise<void> {
  if (_ensured.has(db)) return
  _ensured.add(db)
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS terms_consents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_type TEXT NOT NULL,
      subject_id TEXT,
      user_id TEXT,
      terms_slug TEXT NOT NULL,
      terms_version TEXT NOT NULL,
      core_terms_agreed INTEGER DEFAULT 0,
      ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run()
  } catch { /* 이미 존재 / 권한 이슈 — 기록은 아래에서 개별 fail-soft */ }
}

export interface TermsConsentRecord {
  /** 'agency' | 'seller' | 'user' */
  subjectType: string
  /** 생성된 agencies.id / sellers.id 등 (INSERT 후 last_row_id) */
  subjectId?: number | string | null
  /** 연결된 소비자 users.id (카카오 확장 가입 시) */
  userId?: number | string | null
  /** 'agency-partner' | 'seller' | 'service' */
  slug: string
  version: string
  coreAgreed?: boolean
  ip?: string | null
}

/** 약관 동의 1건 기록 — 실패해도 throw 하지 않음 (fail-soft) */
export async function recordTermsConsent(db: D1Database, r: TermsConsentRecord): Promise<void> {
  try {
    await ensureTermsConsents(db)
    await db.prepare(
      `INSERT INTO terms_consents (subject_type, subject_id, user_id, terms_slug, terms_version, core_terms_agreed, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      r.subjectType,
      r.subjectId != null ? String(r.subjectId) : null,
      r.userId != null ? String(r.userId) : null,
      r.slug,
      r.version,
      r.coreAgreed ? 1 : 0,
      r.ip || null,
    ).run()
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('[terms-consent] record failed (non-fatal):', e)
  }
}

/** 클라이언트가 보낸 terms_agreed_version 검증 — 문자열 '1.0' 형태만 허용 */
export function isValidTermsVersion(v: unknown): v is string {
  return typeof v === 'string' && /^\d+\.\d+$/.test(v) && v.length <= 10
}
