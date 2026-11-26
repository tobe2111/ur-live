/**
 * 🪪 개인 소득자 주민등록번호 — 간이지급명세서(사업소득) 제출용 (2026-11-25 대표 *"나머지 다른 할 일 하고"*)
 *
 * 개인 인플루언서·개인 에이전시에게 3.3% 를 떼고 지급하면 유어딜(원천징수의무자)은 **매월** 간이지급명세서를 내야 하고
 * 거기에 소득자 주민등록번호가 들어간다. 종전엔 받는 칸이 없었다(`admin-withholding.routes` 주석 "추후 추가 필요").
 * 수집 근거: 소득세법상 원천징수·지급명세서 제출 의무(개인정보보호법 제24조의2 — 법령 근거가 있는 처리).
 *
 * ## 안전 규칙
 * - **평문 저장 금지.** `DATA_ENCRYPTION_KEY` 가 없으면 저장을 거부한다(던진다) — `encryptPii` 처럼 평문으로 떨어지지 않는다.
 * - 화면·목록엔 앞 7자리(생년월일·성별)만: `900101-1******`. 원문 복호화는 어드민 지급명세서 CSV(2FA) 한 곳뿐.
 * - 로그에 남기지 않는다.
 * - 형식 검사만 한다(생년월일·성별 자리). 2020-10 이후 번호는 끝자리 검증식이 없어 체크섬을 쓰지 않는다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { encryptAtRest, decryptAtRest } from './data-crypto'

export type PayeeKind = 'influencer' | 'agency'

/** 순수 — 숫자 13자리 + 생년월일·성별 자리 확인. 통과하면 숫자만, 아니면 null. */
export function normalizeRrn(raw: unknown): string | null {
  const d = String(raw ?? '').replace(/[\s-]/g, '')
  if (!/^\d{13}$/.test(d)) return null
  const mm = Number(d.slice(2, 4)), dd = Number(d.slice(4, 6)), g = Number(d[6])
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || g < 1 || g > 8) return null
  return d
}

/** 순수 — 화면용 가림: 900101-1****** */
export function maskRrn(digits: string): string {
  return `${digits.slice(0, 6)}-${digits[6]}******`
}

const _ensured = new WeakSet<object>()
async function ensureTable(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  await DB.prepare(`CREATE TABLE IF NOT EXISTS payee_tax_ids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payee_kind TEXT NOT NULL,
    payee_id TEXT NOT NULL,
    legal_name TEXT NOT NULL,
    rrn_enc TEXT NOT NULL,
    rrn_masked TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run()
  await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_payee_tax_ids_payee ON payee_tax_ids(payee_kind, payee_id)').run()
  _ensured.add(DB)
}

export class TaxIdError extends Error { constructor(public code: 'INVALID_RRN' | 'INVALID_NAME' | 'NO_KEY', msg: string) { super(msg) } }

/** 저장(덮어쓰기). 키가 없으면 저장하지 않고 던진다 — 평문 저장 금지. */
export async function saveTaxId(DB: D1Database, kek: string | undefined, kind: PayeeKind, payeeId: string, legalName: unknown, rrn: unknown): Promise<{ masked: string }> {
  const digits = normalizeRrn(rrn)
  if (!digits) throw new TaxIdError('INVALID_RRN', '주민등록번호 13자리를 확인해 주세요')
  const name = String(legalName ?? '').trim()
  if (name.length < 2 || name.length > 30) throw new TaxIdError('INVALID_NAME', '실명을 확인해 주세요')
  if (!kek || kek.length < 16) throw new TaxIdError('NO_KEY', '지금은 저장할 수 없습니다. 잠시 뒤 다시 시도해 주세요')
  const enc = await encryptAtRest(digits, kek)
  if (!enc.startsWith('v1:')) throw new TaxIdError('NO_KEY', '지금은 저장할 수 없습니다. 잠시 뒤 다시 시도해 주세요')
  await ensureTable(DB)
  const masked = maskRrn(digits)
  await DB.prepare(`
    INSERT INTO payee_tax_ids (payee_kind, payee_id, legal_name, rrn_enc, rrn_masked) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(payee_kind, payee_id) DO UPDATE SET legal_name = excluded.legal_name, rrn_enc = excluded.rrn_enc,
      rrn_masked = excluded.rrn_masked, updated_at = datetime('now')`,
  ).bind(kind, payeeId, name, enc, masked).run()
  return { masked }
}

/** 등록 여부(가린 값만). */
export async function getTaxIdStatus(DB: D1Database, kind: PayeeKind, payeeId: string): Promise<{ registered: boolean; legalName?: string; masked?: string; updatedAt?: string }> {
  await ensureTable(DB)
  const r = await DB.prepare('SELECT legal_name, rrn_masked, updated_at FROM payee_tax_ids WHERE payee_kind = ? AND payee_id = ?')
    .bind(kind, payeeId).first<{ legal_name: string; rrn_masked: string; updated_at: string }>()
  return r ? { registered: true, legalName: r.legal_name, masked: r.rrn_masked, updatedAt: r.updated_at } : { registered: false }
}

/** 어드민 지급명세서용 — 원문 복호화. 호출부는 2FA·감사 로그 뒤에서만 부른다. */
export async function loadTaxIdsForStatement(DB: D1Database, kek: string | undefined, keys: Array<{ kind: PayeeKind; id: string }>): Promise<Map<string, { name: string; rrn: string | null }>> {
  await ensureTable(DB)
  const out = new Map<string, { name: string; rrn: string | null }>()
  for (const k of keys) {
    const r = await DB.prepare('SELECT legal_name, rrn_enc FROM payee_tax_ids WHERE payee_kind = ? AND payee_id = ?')
      .bind(k.kind, k.id).first<{ legal_name: string; rrn_enc: string }>()
    if (!r) continue
    let rrn: string | null = null
    try { const d = await decryptAtRest(r.rrn_enc, kek); rrn = /^\d{13}$/.test(d) ? `${d.slice(0, 6)}-${d.slice(6)}` : null } catch { rrn = null }
    out.set(`${k.kind}:${k.id}`, { name: r.legal_name, rrn })
  }
  return out
}

/**
 * 🗑️ 보관기간이 지난 주민등록번호 파기 — 2026-11-26 대표 *"가장 이상적인 형태"*.
 * 개인정보 보호법 제21조(목적 달성·보관기간 경과 시 지체 없이 파기). 지급명세서 관련 기록은 국세기본법상 5년 보관이라
 * **마지막 지급(원천징수 기록) 뒤 6년**(신고기한 여유 1년)이 지나고 그동안 다시 등록·수정이 없었던 행만 지운다.
 * 개인 소개자만 — 에이전시는 지급 장부가 달라 기준 날짜를 확정하지 못해 건드리지 않는다(남기는 쪽이 안전).
 * 해외 거주자 받는 곳(`overseas_payees`)도 같은 규칙(기준: `overseas_payouts`).
 */
export async function purgeExpiredPayeeIds(DB: D1Database, years = 6): Promise<{ taxIds: number; overseas: number }> {
  await ensureTable(DB)
  const cutoff = `-${Math.max(5, Math.floor(years))} years`
  const t = await DB.prepare(`
    DELETE FROM payee_tax_ids
     WHERE payee_kind = 'influencer' AND updated_at < datetime('now', ?1)
       AND NOT EXISTS (SELECT 1 FROM influencer_withholding_log w
                        WHERE w.influencer_id = payee_tax_ids.payee_id AND w.created_at >= datetime('now', ?1))`,
  ).bind(cutoff).run().catch(() => null)
  const { ensureOverseasTables } = await import('./overseas-payee')
  await ensureOverseasTables(DB)
  const o = await DB.prepare(`
    DELETE FROM overseas_payees
     WHERE payee_kind = 'influencer' AND updated_at < datetime('now', ?1)
       AND NOT EXISTS (SELECT 1 FROM overseas_payouts p
                        WHERE p.payee_kind = 'influencer' AND p.payee_id = overseas_payees.payee_id AND p.created_at >= datetime('now', ?1))`,
  ).bind(cutoff).run().catch(() => null)
  return { taxIds: Number(t?.meta?.changes ?? 0), overseas: Number(o?.meta?.changes ?? 0) }
}
