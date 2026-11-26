/**
 * 🌍 해외 거주 소득자 — 받는 곳(해외 계좌 · Wise · PayPal) · 해외 송금 기록 (2026-11-26 대표 *"응 만들어줘"*)
 *
 * 해외에 사는 개인 소개자는 국내 계좌·주민등록번호가 없다. 종전 규칙(주민번호 없으면 송금 대기에서 뺀다)에
 * 그대로 걸려 영원히 못 받았다. 여기서 "해외 거주" 를 따로 받고, 송금은 **사람이 Wise·은행 해외송금으로** 한다
 * (업체 API 는 대표 가입·확인 뒤 — 이 파일은 업체와 무관한 부분만).
 *
 * ## 세금 (세무사 확인 전 — 보수적 기본값)
 * - 비거주자 소득은 간이지급명세서(거주자용) 대상이 아니다 → `payee_tax_ids`·`influencer-withholding-log` 에 섞지 않는다.
 * - 원천징수율은 어드민 `overseas_withholding_pct`(기본 22 = 소득세 20% + 지방소득세 2%). 국외 제공 용역이면 0,
 *   조세조약이면 더 낮을 수 있다 — **세무사가 정하면 어드민 값만 바꾼다.** 덜 떼는 쪽 실수가 회사 부담이라 기본은 높게.
 * - 지급 기록 `overseas_payouts` 가 나중에 비거주자 지급명세서의 원장이 된다.
 *
 * ## 안전 규칙
 * - 받는 곳(계좌·이메일)은 `DATA_ENCRYPTION_KEY` 로 암호화(`v1:`). 키가 없으면 저장 거부 — 평문 저장 금지.
 * - 화면엔 가린 값만. 원문은 어드민 한 곳(`revealOverseasDestination`) — 감사 로그·`require2FA` 뒤(2FA 는 2026-07-19 대표 지시로 전체 꺼짐).
 * - 돈을 옮기지 않는다(기록·표시만). 잔액 차감은 기존 지급 처리(CAS)가 한다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { encryptAtRest, decryptAtRest } from './data-crypto'
import type { PayeeKind } from './payee-tax-id'

export type OverseasMethod = 'wise' | 'paypal' | 'bank'
export interface OverseasDestination { email?: string; account?: string; swift?: string; bankName?: string; bankAddress?: string }
export interface OverseasPayeeInput { country: unknown; legalNameEn: unknown; method: unknown; currency?: unknown; destination?: Record<string, unknown> }
export interface NormalizedOverseasPayee { country: string; legalNameEn: string; method: OverseasMethod; currency: string; destination: OverseasDestination }

export class OverseasPayeeError extends Error {
  constructor(public code: 'INVALID_COUNTRY' | 'INVALID_NAME' | 'INVALID_METHOD' | 'INVALID_DESTINATION' | 'INVALID_CURRENCY' | 'NO_KEY', msg: string) { super(msg) }
}

export const OVERSEAS_WITHHOLDING_DEFAULT_PCT = 22
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/

/** 순수 — 입력 검사. 통과하면 정리된 값, 아니면 던진다. */
export function normalizeOverseasPayee(input: OverseasPayeeInput): NormalizedOverseasPayee {
  const country = String(input.country ?? '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(country)) throw new OverseasPayeeError('INVALID_COUNTRY', '거주 나라를 골라 주세요')
  if (country === 'KR') throw new OverseasPayeeError('INVALID_COUNTRY', '한국에 살면 해외 등록 대신 계좌·주민등록번호를 넣어 주세요')
  const legalNameEn = String(input.legalNameEn ?? '').trim().replace(/\s+/g, ' ')
  if (!/^[A-Za-z][A-Za-z .'-]{1,79}$/.test(legalNameEn)) throw new OverseasPayeeError('INVALID_NAME', '여권과 같은 영문 이름을 적어 주세요')
  const method = String(input.method ?? '') as OverseasMethod
  if (!['wise', 'paypal', 'bank'].includes(method)) throw new OverseasPayeeError('INVALID_METHOD', '받는 방법을 골라 주세요')
  const currency = String(input.currency ?? 'USD').trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) throw new OverseasPayeeError('INVALID_CURRENCY', '받을 통화를 확인해 주세요')
  const d = input.destination || {}
  const s = (k: string, max: number) => String(d[k] ?? '').trim().slice(0, max)
  let destination: OverseasDestination
  if (method === 'bank') {
    const account = s('account', 40).replace(/\s+/g, '').toUpperCase()
    const swift = s('swift', 11).replace(/\s+/g, '').toUpperCase()
    const bankName = s('bankName', 100)
    if (!/^[A-Z0-9]{6,34}$/.test(account)) throw new OverseasPayeeError('INVALID_DESTINATION', '계좌번호(또는 IBAN)를 확인해 주세요')
    if (!/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(swift)) throw new OverseasPayeeError('INVALID_DESTINATION', 'SWIFT 코드(8자리 또는 11자리)를 확인해 주세요')
    if (bankName.length < 2) throw new OverseasPayeeError('INVALID_DESTINATION', '은행 이름을 적어 주세요')
    destination = { account, swift, bankName, bankAddress: s('bankAddress', 200) || undefined }
  } else {
    const email = s('email', 254).toLowerCase()
    if (!EMAIL.test(email)) throw new OverseasPayeeError('INVALID_DESTINATION', `${method === 'wise' ? 'Wise' : 'PayPal'} 이메일을 확인해 주세요`)
    destination = { email }
  }
  return { country, legalNameEn, method, currency, destination }
}

/** 순수 — 화면용 가림. */
export function maskOverseasDestination(method: OverseasMethod, d: OverseasDestination): string {
  if (method === 'bank') return `${d.bankName || '은행'} ****${String(d.account || '').slice(-4)}`
  const [u, host] = String(d.email || '').split('@')
  return `${method === 'wise' ? 'Wise' : 'PayPal'} ${(u || '').slice(0, 2)}***@${host || ''}`
}

/** 순수 — 어드민 값(%) 해석. 0~45 밖이거나 비면 기본 22. */
export function resolveOverseasWithholdingPct(raw: unknown): number {
  const n = Number(raw)
  return raw !== null && raw !== undefined && String(raw).trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 45 ? n : OVERSEAS_WITHHOLDING_DEFAULT_PCT
}

export async function loadOverseasWithholdingPct(DB: D1Database): Promise<number> {
  const r = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'overseas_withholding_pct'").first<{ value: string }>().catch(() => null)
  return resolveOverseasWithholdingPct(r?.value)
}

const _ensured = new WeakSet<object>()
export async function ensureOverseasTables(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  await DB.prepare(`CREATE TABLE IF NOT EXISTS overseas_payees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payee_kind TEXT NOT NULL,
    payee_id TEXT NOT NULL,
    country TEXT NOT NULL,
    legal_name_en TEXT NOT NULL,
    method TEXT NOT NULL,
    currency TEXT NOT NULL,
    destination_enc TEXT NOT NULL,
    destination_masked TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run()
  await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_overseas_payees_payee ON overseas_payees(payee_kind, payee_id)').run()
  await DB.prepare(`CREATE TABLE IF NOT EXISTS overseas_payouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payee_kind TEXT NOT NULL,
    payee_id TEXT NOT NULL,
    country TEXT NOT NULL,
    legal_name_en TEXT NOT NULL,
    method TEXT NOT NULL,
    currency TEXT NOT NULL,
    gross INTEGER NOT NULL,
    fee INTEGER NOT NULL DEFAULT 0,
    withholding_pct REAL NOT NULL,
    withholding INTEGER NOT NULL,
    net INTEGER NOT NULL,
    reference TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run()
  _ensured.add(DB)
}

export interface OverseasPayeeStatus { registered: boolean; country?: string; legalNameEn?: string; method?: OverseasMethod; currency?: string; masked?: string; updatedAt?: string }

/** 저장(덮어쓰기). 키가 없으면 저장하지 않고 던진다. */
export async function saveOverseasPayee(DB: D1Database, kek: string | undefined, kind: PayeeKind, payeeId: string, input: OverseasPayeeInput): Promise<OverseasPayeeStatus> {
  const p = normalizeOverseasPayee(input)
  if (!kek || kek.length < 16) throw new OverseasPayeeError('NO_KEY', '지금은 저장할 수 없습니다. 잠시 뒤 다시 시도해 주세요')
  const enc = await encryptAtRest(JSON.stringify(p.destination), kek)
  if (!enc.startsWith('v1:')) throw new OverseasPayeeError('NO_KEY', '지금은 저장할 수 없습니다. 잠시 뒤 다시 시도해 주세요')
  await ensureOverseasTables(DB)
  const masked = maskOverseasDestination(p.method, p.destination)
  await DB.prepare(`
    INSERT INTO overseas_payees (payee_kind, payee_id, country, legal_name_en, method, currency, destination_enc, destination_masked)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(payee_kind, payee_id) DO UPDATE SET country = excluded.country, legal_name_en = excluded.legal_name_en,
      method = excluded.method, currency = excluded.currency, destination_enc = excluded.destination_enc,
      destination_masked = excluded.destination_masked, updated_at = datetime('now')`,
  ).bind(kind, payeeId, p.country, p.legalNameEn, p.method, p.currency, enc, masked).run()
  return { registered: true, country: p.country, legalNameEn: p.legalNameEn, method: p.method, currency: p.currency, masked }
}

export async function getOverseasPayee(DB: D1Database, kind: PayeeKind, payeeId: string): Promise<OverseasPayeeStatus> {
  await ensureOverseasTables(DB)
  const r = await DB.prepare('SELECT country, legal_name_en, method, currency, destination_masked, updated_at FROM overseas_payees WHERE payee_kind = ? AND payee_id = ?')
    .bind(kind, payeeId).first<{ country: string; legal_name_en: string; method: OverseasMethod; currency: string; destination_masked: string; updated_at: string }>()
  return r ? { registered: true, country: r.country, legalNameEn: r.legal_name_en, method: r.method, currency: r.currency, masked: r.destination_masked, updatedAt: r.updated_at } : { registered: false }
}

/** 국내로 돌아오면 지운다(다음 정산부터 국내 규칙 — 계좌·주민번호). */
export async function removeOverseasPayee(DB: D1Database, kind: PayeeKind, payeeId: string): Promise<boolean> {
  await ensureOverseasTables(DB)
  const r = await DB.prepare('DELETE FROM overseas_payees WHERE payee_kind = ? AND payee_id = ?').bind(kind, payeeId).run()
  return (r.meta?.changes ?? 0) > 0
}

/** 어드민 목록용 — 여러 명의 등록 상태(가린 값만). */
export async function mapOverseasPayees(DB: D1Database, kind: PayeeKind, ids: string[]): Promise<Map<string, OverseasPayeeStatus>> {
  const out = new Map<string, OverseasPayeeStatus>()
  if (ids.length === 0) return out
  await ensureOverseasTables(DB)
  const { results } = await DB.prepare('SELECT payee_id, country, legal_name_en, method, currency, destination_masked FROM overseas_payees WHERE payee_kind = ?')
    .bind(kind).all<{ payee_id: string; country: string; legal_name_en: string; method: OverseasMethod; currency: string; destination_masked: string }>()
  const want = new Set(ids)
  for (const r of results || []) {
    if (want.has(String(r.payee_id))) out.set(String(r.payee_id), { registered: true, country: r.country, legalNameEn: r.legal_name_en, method: r.method, currency: r.currency, masked: r.destination_masked })
  }
  return out
}

/** 어드민 송금용 — 원문 복호화. 호출부는 2FA·감사 로그 뒤에서만 부른다. */
export async function revealOverseasDestination(DB: D1Database, kek: string | undefined, kind: PayeeKind, payeeId: string): Promise<(OverseasPayeeStatus & { destination: OverseasDestination | null }) | null> {
  await ensureOverseasTables(DB)
  const r = await DB.prepare('SELECT country, legal_name_en, method, currency, destination_enc, destination_masked FROM overseas_payees WHERE payee_kind = ? AND payee_id = ?')
    .bind(kind, payeeId).first<{ country: string; legal_name_en: string; method: OverseasMethod; currency: string; destination_enc: string; destination_masked: string }>()
  if (!r) return null
  let destination: OverseasDestination | null = null
  try { destination = JSON.parse(await decryptAtRest(r.destination_enc, kek)) as OverseasDestination } catch { destination = null }
  return { registered: true, country: r.country, legalNameEn: r.legal_name_en, method: r.method, currency: r.currency, masked: r.destination_masked, destination }
}

/** 지급 기록(비거주자 지급명세서의 원장). 잔액 차감(CAS)이 통과한 뒤 한 번만 부른다. */
export async function recordOverseasPayout(DB: D1Database, row: {
  kind: PayeeKind; payeeId: string; payee: OverseasPayeeStatus; gross: number; fee: number; withholdingPct: number; withholding: number; net: number; reference?: string | null; adminId?: number | null
}): Promise<void> {
  await ensureOverseasTables(DB)
  await DB.prepare(`INSERT INTO overseas_payouts (payee_kind, payee_id, country, legal_name_en, method, currency, gross, fee, withholding_pct, withholding, net, reference, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(row.kind, row.payeeId, row.payee.country || '', row.payee.legalNameEn || '', row.payee.method || '', row.payee.currency || '',
      row.gross, row.fee, row.withholdingPct, row.withholding, row.net, row.reference ? String(row.reference).slice(0, 120) : null, row.adminId ?? null).run()
}
