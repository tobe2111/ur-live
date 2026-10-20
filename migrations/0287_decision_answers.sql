-- 📥 2026-09-08 결재함 답 우편함 — 대표가 어드민 /admin/decisions 에서 남긴 원문을 보관.
-- SSOT 는 docs/decisions/<slug>.md 의 `결정` 섹션. 커넥터 대리인 루틴이 여기서 읽어 파일로 옮기고 synced_at 을 찍는다.
-- 런타임 보장: worker/utils/decision-answers.ts ensureDecisionAnswers + repair-schema.

CREATE TABLE IF NOT EXISTS decision_answers (
  slug TEXT PRIMARY KEY,
  answer TEXT NOT NULL,
  answered_by TEXT,
  answered_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT,
  synced_ref TEXT
);
