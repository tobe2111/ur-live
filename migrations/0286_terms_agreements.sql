-- 📜 2026-07-05 약관 동의 로그 (누가·언제·몇 버전) — 법적 증적 SSOT
-- 기록: worker/utils/terms-agreements.ts (버전은 shared/constants/terms-versions.ts 에서 서버 스탬프)
-- 배선: 유저(카카오 동의 게이트 + 이메일 가입 /users/init) · 셀러(register-from-user) · 에이전시(register 2종)
-- 프로덕션 반영은 ensureTermsAgreementsTable 런타임 + repair-schema 가 보장.

CREATE TABLE IF NOT EXISTS terms_agreements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_type TEXT NOT NULL,          -- 'user' | 'seller' | 'agency'
  subject_id TEXT NOT NULL,
  doc_type TEXT NOT NULL,              -- service/privacy/location/marketing/seller/agency
  doc_version TEXT NOT NULL,
  agreed INTEGER NOT NULL DEFAULT 1,
  agreed_at TEXT DEFAULT (datetime('now')),
  UNIQUE(subject_type, subject_id, doc_type, doc_version)
);
CREATE INDEX IF NOT EXISTS idx_terms_agreements_subject ON terms_agreements(subject_type, subject_id);
