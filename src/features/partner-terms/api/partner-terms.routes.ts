/**
 * 파트너 약관-as-계약 API + 동의기록 헬퍼.
 * 설계: docs/design/partner-terms-as-contract.md · 문안 SSOT: src/shared/legal.
 *
 * - GET /api/partner-terms/:type/active — 가입 화면용 활성 약관(제목·버전·중요조항·전문). 공개(읽기).
 * - recordPartnerTermsAgreement() — 계약 성립 시 동의기록 저장(멱등). 셀러/에이전시 가입 라우트가 호출.
 * - validatePartnerConsent() — 중요조항 4개 전부 동의했는지 서버 검증(§2① 개별 동의 강제).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { PARTNER_TERMS } from '../partner-terms-seed'

type PartnerType = 'seller' | 'agency'

// per-request DDL 방지 — isolate 당 1회 (WeakSet 메모이즈).
const _ensured = new WeakSet<object>()
export async function ensurePartnerTermsTables(db: D1Database): Promise<void> {
  if (_ensured.has(db as unknown as object)) return
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS partner_terms_agreements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      terms_type TEXT NOT NULL,
      terms_version INTEGER NOT NULL,
      subject_type TEXT NOT NULL,
      subject_id INTEGER NOT NULL,
      user_id TEXT,
      per_clause_consent TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      agreed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {})
  // 멱등: 같은 주체·같은 약관버전 중복 방지.
  await db.prepare(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_pta_subject_version ON partner_terms_agreements (subject_type, subject_id, terms_type, terms_version)'
  ).run().catch(() => {})
  _ensured.add(db as unknown as object)
}

/** 중요조항(§2①) 개별 동의 서버 검증. required 조항이 모두 true 여야 계약 성립. */
export function validatePartnerConsent(
  type: PartnerType,
  perClause: Record<string, unknown> | null | undefined,
): { ok: boolean; version?: number; error?: string } {
  const doc = PARTNER_TERMS[type]
  if (!doc) return { ok: false, error: '알 수 없는 약관 유형' }
  if (!perClause || typeof perClause !== 'object') return { ok: false, error: '약관 동의 정보가 없습니다' }
  for (const clause of doc.key_clauses) {
    if (clause.required && perClause[clause.key] !== true) {
      return { ok: false, error: `필수 약관 항목에 동의해주세요: ${clause.title}` }
    }
  }
  return { ok: true, version: doc.version }
}

/** 동의기록 저장(계약 성립 증거). 멱등(INSERT OR IGNORE + UNIQUE index). fail-soft 는 호출부 판단. */
export async function recordPartnerTermsAgreement(
  db: D1Database,
  opts: {
    termsType: PartnerType
    termsVersion: number
    subjectType: PartnerType
    subjectId: number
    userId?: string | number | null
    perClause: Record<string, unknown>
    ip?: string | null
    userAgent?: string | null
  },
): Promise<void> {
  await ensurePartnerTermsTables(db)
  await db.prepare(`
    INSERT OR IGNORE INTO partner_terms_agreements
      (terms_type, terms_version, subject_type, subject_id, user_id, per_clause_consent, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    opts.termsType, opts.termsVersion, opts.subjectType, opts.subjectId,
    opts.userId != null ? String(opts.userId) : null,
    JSON.stringify(opts.perClause), opts.ip ?? null, opts.userAgent ?? null,
  ).run()
}

const app = new Hono<{ Bindings: Env }>()

// 가입 화면용 활성 약관 — 공개(읽기 전용). 전문 + 중요조항(개별 동의 대상).
app.get('/:type/active', (c) => {
  const type = c.req.param('type') as PartnerType
  const doc = PARTNER_TERMS[type]
  if (!doc) return c.json({ success: false, error: '알 수 없는 약관 유형' }, 404)
  return c.json({
    success: true,
    data: {
      terms_type: doc.terms_type,
      version: doc.version,
      title: doc.title,
      key_clauses: doc.key_clauses,
      body: doc.body,
    },
  })
})

export const partnerTermsRoutes = app
