/**
 * 🖋️ 전자계약 상태 추적 — contract_signatures 테이블 + 멱등 기록/갱신.
 *
 *   발송 시 recordContractRequest (UNIQUE(account_type,account_id,template_id) + INSERT OR IGNORE → 재가입/재시도 멱등),
 *   webhook 수신 시 updateContractStatusByDocumentId (서명완료/거절 반영).
 *
 *   PII(서명자 이메일/휴대폰)는 이 테이블에만 — 공개 응답 노출 금지(보안감사 규칙).
 */
const _ensured = new WeakSet<object>()

export type ContractStatus = 'requested' | 'viewed' | 'signed' | 'rejected' | 'expired' | 'failed'

export async function ensureContractSignaturesTable(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS contract_signatures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_type TEXT NOT NULL,
      account_id INTEGER NOT NULL,
      template_id TEXT NOT NULL,
      document_id TEXT,
      status TEXT NOT NULL DEFAULT 'requested',
      signer_name TEXT,
      signer_value TEXT,
      signing_method TEXT,
      title TEXT,
      raw_event TEXT,
      requested_at DATETIME DEFAULT (datetime('now')),
      signed_at DATETIME,
      updated_at DATETIME DEFAULT (datetime('now'))
    )
  `).run().catch(() => {})
  // 멱등 가드: 같은 계정·템플릿 1행. document_id 단건 조회용 인덱스.
  await DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_sig_account ON contract_signatures(account_type, account_id, template_id)").run().catch(() => {})
  await DB.prepare("CREATE INDEX IF NOT EXISTS idx_contract_sig_document ON contract_signatures(document_id)").run().catch(() => {})
  _ensured.add(DB)
}

/** 발송 기록(멱등). 이미 행이 있으면(재시도) INSERT OR IGNORE 로 무시 → changes=0. */
export async function recordContractRequest(
  DB: D1Database,
  row: {
    account_type: string
    account_id: number
    template_id: string
    document_id: string | null
    signer_name: string
    signer_value: string
    signing_method: string
    title: string
    status?: ContractStatus
  },
): Promise<void> {
  await ensureContractSignaturesTable(DB)
  await DB.prepare(`
    INSERT OR IGNORE INTO contract_signatures
      (account_type, account_id, template_id, document_id, status, signer_name, signer_value, signing_method, title)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    row.account_type, row.account_id, row.template_id, row.document_id,
    row.status || 'requested', row.signer_name, row.signer_value, row.signing_method, row.title.slice(0, 200),
  ).run().catch(() => {})
  // document_id 가 나중에(발송 성공 응답) 확정되면 채움 — 행이 이미 있어도 업데이트.
  if (row.document_id) {
    await DB.prepare(
      "UPDATE contract_signatures SET document_id = ?, updated_at = datetime('now') WHERE account_type = ? AND account_id = ? AND template_id = ? AND (document_id IS NULL OR document_id = '')",
    ).bind(row.document_id, row.account_type, row.account_id, row.template_id).run().catch(() => {})
  }
}

/** webhook 상태 갱신 — document_id 매칭으로만(위·변조 방지). signed 면 signed_at 기록. */
export async function updateContractStatusByDocumentId(
  DB: D1Database,
  documentId: string,
  status: ContractStatus,
  rawEvent: string,
): Promise<number> {
  await ensureContractSignaturesTable(DB)
  const signedClause = status === 'signed' ? ", signed_at = datetime('now')" : ''
  const res = await DB.prepare(
    `UPDATE contract_signatures SET status = ?, raw_event = ?, updated_at = datetime('now')${signedClause} WHERE document_id = ?`,
  ).bind(status, rawEvent.slice(0, 2000), documentId).run().catch(() => null)
  return res?.meta?.changes ?? 0
}

/**
 * 차단(hard) enforcement — 미서명 계약이 있으면 true(거래/승인 차단).
 *   행이 없으면(자격증명 전·기존 계정·발송 skip) false → 차단 안 함(락아웃 방지, grandfather).
 *   서명 완료(signed) 행만 있으면 false → 통과.
 */
export async function hasUnsignedContract(DB: D1Database, accountType: string, accountId: number): Promise<boolean> {
  await ensureContractSignaturesTable(DB)
  const row = await DB.prepare(
    "SELECT 1 AS x FROM contract_signatures WHERE account_type = ? AND account_id = ? AND status != 'signed' LIMIT 1",
  ).bind(accountType, Number(accountId)).first<{ x: number }>().catch(() => null)
  return !!row
}
