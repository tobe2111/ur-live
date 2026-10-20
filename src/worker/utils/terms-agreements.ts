/**
 * 📜 2026-07-05 약관 동의 로그 SSOT — "누가·언제·몇 버전" (분쟁 대비 법적 증적).
 *
 * 테이블: terms_agreements
 *  - subject_type: 'user' | 'seller' | 'agency'
 *  - subject_id  : users.id / sellers.id / agencies.id (TEXT 통일)
 *  - doc_type    : terms-versions.ts 의 키 (service/privacy/location/marketing/seller/agency)
 *  - doc_version : 동의 시점의 현행 버전 (서버가 SSOT 에서 찍음 — 클라 값 신뢰 X)
 *  - agreed      : 1=동의, 0=거부(선택 문서의 거부 증적)
 *  - UNIQUE(subject_type, subject_id, doc_type, doc_version) + INSERT OR IGNORE — 첫 기록 보존(멱등),
 *    같은 버전 재동의는 no-op. 개정(버전 업)은 새 row — 과거 증적 불변.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { TERMS_DOC_VERSIONS, isTermsDocType, type TermsDocType } from '../../shared/constants/terms-versions'

export type TermsSubjectType = 'user' | 'seller' | 'agency'

const _ensured = new WeakSet<D1Database>()
export async function ensureTermsAgreementsTable(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS terms_agreements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_type TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        doc_type TEXT NOT NULL,
        doc_version TEXT NOT NULL,
        agreed INTEGER NOT NULL DEFAULT 1,
        agreed_at TEXT DEFAULT (datetime('now')),
        UNIQUE(subject_type, subject_id, doc_type, doc_version)
      )
    `).run()
    await DB.prepare('CREATE INDEX IF NOT EXISTS idx_terms_agreements_subject ON terms_agreements(subject_type, subject_id)').run().catch(() => {})
  } catch { /* exists */ }
}

/**
 * 동의/거부 기록 — 버전은 서버 SSOT 에서 스탬프. 알 수 없는 doc_type 은 무시. fail-soft(가입 흐름 보호).
 * @returns 기록된(신규) doc_type 목록
 */
export async function recordTermsAgreements(
  DB: D1Database,
  subjectType: TermsSubjectType,
  subjectId: string | number,
  agreements: Array<{ doc_type: string; agreed: boolean }>,
): Promise<string[]> {
  const recorded: string[] = []
  try {
    const sid = String(subjectId ?? '')
    if (!sid || !Array.isArray(agreements) || agreements.length === 0) return recorded
    await ensureTermsAgreementsTable(DB)
    for (const a of agreements.slice(0, 20)) {
      if (!isTermsDocType(a?.doc_type)) continue
      const version = TERMS_DOC_VERSIONS[a.doc_type as TermsDocType]
      const r = await DB.prepare(
        `INSERT OR IGNORE INTO terms_agreements (subject_type, subject_id, doc_type, doc_version, agreed)
         VALUES (?, ?, ?, ?, ?)`,
      ).bind(subjectType, sid, a.doc_type, version, a.agreed ? 1 : 0).run().catch(() => null)
      if (r?.meta?.changes) recorded.push(a.doc_type)
    }
  } catch { /* fail-soft */ }
  return recorded
}

/** 현행 버전 기준 동의(agreed=1) 보유 여부 맵 — 재동의 판정(⑤)의 근거. */
export async function getCurrentTermsStatus(
  DB: D1Database,
  subjectType: TermsSubjectType,
  subjectId: string | number,
  docTypes: readonly TermsDocType[],
): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {}
  for (const d of docTypes) out[d] = false
  try {
    const sid = String(subjectId ?? '')
    if (!sid || docTypes.length === 0) return out
    await ensureTermsAgreementsTable(DB)
    const ph = docTypes.map(() => '?').join(',')
    const { results } = await DB.prepare(
      `SELECT doc_type, doc_version FROM terms_agreements
        WHERE subject_type = ? AND subject_id = ? AND agreed = 1 AND doc_type IN (${ph})`,
    ).bind(subjectType, sid, ...docTypes).all<{ doc_type: string; doc_version: string }>()
    for (const r of results || []) {
      if (isTermsDocType(r.doc_type) && r.doc_version === TERMS_DOC_VERSIONS[r.doc_type as TermsDocType]) {
        out[r.doc_type] = true
      }
    }
  } catch { /* fail-soft — 미동의로 간주 */ }
  return out
}
