/**
 * 💸 토스페이먼츠 지급대행 — 매장 정산 송금을 토스가 대신 한다 (2026-11-03 대표 *"1번 일단 해주고"*)
 *
 * 결재 `docs/decisions/2026-11-03-settlement-structure.md`:
 *   12-17 개정 전금법 — 매장 돈이 유어딜 통장을 거쳐 나가면 PG업 등록 + 100% 예치 대상이다.
 *   지급대행을 쓰면 토스가 매장에 직접 보내므로 그 구조에서 벗어난다(중개 유지).
 *
 * ## 🔴 만들고 꺼 두기 — 켜지는 조건은 셋 다
 *   ① `platform_settings.toss_payouts_enabled = 'true'` (대표가 켠다 — 등급 C)
 *   ② `TOSS_PAYOUT_SECRET_KEY` (지급대행용 API 개별 연동 키 — 결제 키와 별개)
 *   ③ `TOSS_PAYOUT_SECURITY_KEY` (ENCRYPTION 보안 키, 64자 hex)
 *   하나라도 없으면 모든 진입점이 아무것도 안 한다 ⇒ 종전(은행 이체 파일) 그대로.
 *
 * ## 왜 결제 게이트웨이(`toss-gateway.ts`, 잠금)에 넣지 않았나
 *   다른 제품·다른 키·다른 보안 방식(JWE)이다. 결제 승인/취소 코드는 한 글자도 안 건드린다 —
 *   잠금표의 "SSOT helper 를 호출하는 새 시나리오" 와도 무관한 **별개 API**(`/v2/sellers`, `/v2/payouts`).
 *
 * ## 공식 문서 (2026-11-03 확인)
 *   - 가이드 https://docs.tosspayments.com/guides/v2/payouts (ENCRYPTION 보안 — dir + A256GCM, iat·nonce 헤더)
 *   - 레퍼런스 https://docs.tosspayments.com/reference/additional (Seller · Payout · Balance)
 *   - 셀러 등록 직후 개인·개인사업자는 본인인증 필요(APPROVAL_REQUIRED), 주 1천만원 넘으면 KYC.
 *   - 지급 요청은 최대 100건/회, 하나라도 실패하면 전부 실패. 잔액 부족이면 실패. **보낸 돈은 회수 어렵다.**
 *   - 바로지급(EXPRESS)은 영업일 08:00~15:00 만. 그 밖은 예약지급(SCHEDULED, 다음 영업일).
 *
 * ## 머니 룰
 *   #1 claim-before-credit · #3 멱등: `toss_payout_requests(payout_id)` UNIQUE + INSERT OR IGNORE 가 먼저,
 *      토스 호출은 선점에 성공한 쪽만. `refPayoutId` 도 토스 쪽에서 재사용 불가(이중 지급 이중 방어).
 *   장부(`payouts.status='sent'`)는 **토스가 COMPLETED 라고 할 때만**(`markPayoutSent` SSOT — 가드 셋 그대로).
 */
import type { D1Database } from '@cloudflare/workers-types'
import { bankCodeOf } from '../../shared/banks'
import { checkPayeeAccountCurrent, markPayoutSent } from './payout-sent'
import { getSellerMeta, setSellerMeta } from './seller-meta'
import { canonicalPaidPayee } from './payout-account'

export const TOSS_PAYOUTS_GATE = 'toss_payouts_enabled'
export const TOSS_SELLER_META_KEY = 'toss_payout_seller_id'
const API = 'https://api.tosspayments.com'

export interface TossPayoutEnv {
  TOSS_PAYOUT_SECRET_KEY?: string
  TOSS_PAYOUT_SECURITY_KEY?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// JWE (compact, alg=dir, enc=A256GCM) — WebCrypto 만 쓴다(워커·노드 공통, 의존성 0)
// ─────────────────────────────────────────────────────────────────────────────
const enc = new TextEncoder()
const dec = new TextDecoder()

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  const bin = atob(pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const h = hex.trim()
  if (!/^[0-9a-fA-F]{64}$/.test(h)) throw new Error('TOSS_PAYOUT_SECURITY_KEY 는 64자 hex 여야 합니다')
  const out = new Uint8Array(32)
  for (let i = 0; i < 32; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  return out
}
async function aesKey(hex: string, usage: 'encrypt' | 'decrypt'): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', hexToBytes(hex), { name: 'AES-GCM' }, false, [usage])
}

/** KST ISO 8601 (`yyyy-MM-ddTHH:mm:ss+09:00`) — 문서의 iat 형식. */
export function kstIso(nowMs: number = Date.now()): string {
  return new Date(nowMs + 9 * 3600_000).toISOString().slice(0, 19) + '+09:00'
}

/** 요청 본문 → JWE compact. 헤더 = { alg:'dir', enc:'A256GCM', iat, nonce }. */
export async function encryptJwe(payload: unknown, securityKeyHex: string, nowMs: number = Date.now()): Promise<string> {
  const header = { alg: 'dir', enc: 'A256GCM', iat: kstIso(nowMs), nonce: crypto.randomUUID() }
  const protectedB64 = b64url(enc.encode(JSON.stringify(header)))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await aesKey(securityKeyHex, 'encrypt')
  const sealed = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(protectedB64), tagLength: 128 },
    key, enc.encode(JSON.stringify(payload)),
  ))
  const ct = sealed.slice(0, sealed.length - 16)
  const tag = sealed.slice(sealed.length - 16)
  // dir 이라 암호화된 키 칸은 비어 있다(`header..iv.ct.tag`).
  return `${protectedB64}..${b64url(iv)}.${b64url(ct)}.${b64url(tag)}`
}

/** JWE compact → 평문 JSON. 응답(성공·실패 모두)이 이 형식으로 온다. */
export async function decryptJwe<T = unknown>(token: string, securityKeyHex: string): Promise<T> {
  const parts = token.trim().split('.')
  if (parts.length !== 5) throw new Error('JWE 형식이 아닙니다')
  const [protectedB64, , ivB64, ctB64, tagB64] = parts
  const header = JSON.parse(dec.decode(b64urlDecode(protectedB64))) as { alg?: string; enc?: string }
  if (header.alg !== 'dir' || header.enc !== 'A256GCM') throw new Error('지원하지 않는 JWE 헤더')
  const ct = b64urlDecode(ctB64)
  const tag = b64urlDecode(tagB64)
  const sealed = new Uint8Array(ct.length + tag.length)
  sealed.set(ct, 0)
  sealed.set(tag, ct.length)
  const key = await aesKey(securityKeyHex, 'decrypt')
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64urlDecode(ivB64), additionalData: enc.encode(protectedB64), tagLength: 128 },
    key, sealed,
  )
  return JSON.parse(dec.decode(plain)) as T
}

// ─────────────────────────────────────────────────────────────────────────────
// 게이트 · API 호출
// ─────────────────────────────────────────────────────────────────────────────
export async function tossPayoutsReady(DB: D1Database, env: TossPayoutEnv): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!env.TOSS_PAYOUT_SECRET_KEY) return { ok: false, reason: 'TOSS_PAYOUT_SECRET_KEY 미설정' }
  if (!env.TOSS_PAYOUT_SECURITY_KEY) return { ok: false, reason: 'TOSS_PAYOUT_SECURITY_KEY 미설정' }
  const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ? LIMIT 1')
    .bind(TOSS_PAYOUTS_GATE).first<{ value: string }>().catch(() => null)
  if (String(row?.value) !== 'true') return { ok: false, reason: `${TOSS_PAYOUTS_GATE} 꺼짐` }
  return { ok: true }
}

const authHeader = (secret: string) => `Basic ${btoa(`${secret}:`)}`

interface TossEnvelope<T> { entityType?: string; entityBody?: T; error?: { code?: string; message?: string }; code?: string; message?: string }

/** ENCRYPTION 보안 POST — 본문을 JWE 로 보내고 응답(JWE)을 풀어 돌려준다. */
async function encryptedPost<T>(env: Required<TossPayoutEnv>, path: string, body: unknown): Promise<{ ok: boolean; status: number; data: TossEnvelope<T> }> {
  const jwe = await encryptJwe(body, env.TOSS_PAYOUT_SECURITY_KEY)
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(env.TOSS_PAYOUT_SECRET_KEY),
      'Content-Type': 'text/plain',
      'TossPayments-api-security-mode': 'ENCRYPTION',
    },
    body: jwe,
    signal: AbortSignal.timeout(15_000),
  })
  const text = await res.text()
  let data: TossEnvelope<T>
  try {
    data = await decryptJwe<TossEnvelope<T>>(text, env.TOSS_PAYOUT_SECURITY_KEY)
  } catch {
    // 인증 실패 등은 평문 JSON 으로 올 수 있다.
    try { data = JSON.parse(text) as TossEnvelope<T> } catch { data = { message: text.slice(0, 200) } }
  }
  return { ok: res.ok, status: res.status, data }
}

async function plainGet<T>(env: Required<TossPayoutEnv>, path: string): Promise<{ ok: boolean; status: number; data: TossEnvelope<T> }> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: authHeader(env.TOSS_PAYOUT_SECRET_KEY) },
    signal: AbortSignal.timeout(15_000),
  })
  const data = await res.json().catch(() => ({})) as TossEnvelope<T>
  return { ok: res.ok, status: res.status, data }
}

const errText = (d: TossEnvelope<unknown>) => d.error?.message || d.message || d.error?.code || d.code || '알 수 없는 오류'

// ─────────────────────────────────────────────────────────────────────────────
// 셀러(매장) 등록
// ─────────────────────────────────────────────────────────────────────────────
interface SellerRow {
  id: number; name: string | null; email: string | null; phone: string | null; business_name: string | null
  business_number: string | null; representative_name: string | null; representative_phone: string | null
  tax_email: string | null; bank_name: string | null; bank_account: string | null; account_holder: string | null
}

const digitsOnly = (v: unknown) => String(v ?? '').replace(/\D/g, '')

/** 사업자번호 가운데 두 자리 81~88 = 법인. 순수. */
export function tossBusinessType(bizNo: string): 'CORPORATE' | 'INDIVIDUAL_BUSINESS' {
  const mid = Number(digitsOnly(bizNo).slice(3, 5))
  return mid >= 81 && mid <= 88 ? 'CORPORATE' : 'INDIVIDUAL_BUSINESS'
}

/** 매장 행 → 셀러 등록 본문. 빠진 값이 있으면 무엇이 빠졌는지 돌려준다(지어내지 않는다). 순수. */
export function buildSellerBody(s: SellerRow): { ok: true; body: Record<string, unknown> } | { ok: false; missing: string[] } {
  const biz = digitsOnly(s.business_number)
  const phone = digitsOnly(s.representative_phone || s.phone)
  const email = (s.tax_email || s.email || '').trim()
  const bankCode = bankCodeOf(s.bank_name)
  const account = digitsOnly(s.bank_account)
  const missing: string[] = []
  if (biz.length !== 10) missing.push('사업자번호')
  if (!(s.business_name || s.name)) missing.push('상호')
  if (!(s.representative_name || s.account_holder)) missing.push('대표자명')
  if (phone.length < 8) missing.push('전화번호')
  if (!email) missing.push('이메일')
  if (!bankCode) missing.push('은행')
  if (!account || account.length > 14) missing.push('계좌번호')
  if (!s.account_holder) missing.push('예금주')
  if (missing.length) return { ok: false, missing }
  return {
    ok: true,
    body: {
      refSellerId: `urdeal-s${s.id}`.slice(0, 20),
      businessType: tossBusinessType(biz),
      company: {
        name: String(s.business_name || s.name),
        representativeName: String(s.representative_name || s.account_holder),
        businessRegistrationNumber: biz,
        email,
        phone,
      },
      account: { bankCode, accountNumber: account, holderName: String(s.account_holder) },
      metadata: { urdealSellerId: String(s.id) },
    },
  }
}

/** 매장을 토스 셀러로 등록(이미 있으면 그 id). 게이트가 꺼져 있으면 아무것도 안 한다. */
export async function ensureTossSeller(DB: D1Database, env: TossPayoutEnv, sellerId: number): Promise<{ ok: true; tossSellerId: string; status?: string } | { ok: false; error: string }> {
  const ready = await tossPayoutsReady(DB, env)
  if (!ready.ok) return { ok: false, error: ready.reason }
  const meta = await getSellerMeta(DB, [sellerId]).catch(() => new Map<number, Record<string, string>>())
  const existing = meta.get(sellerId)?.[TOSS_SELLER_META_KEY]
  if (existing) return { ok: true, tossSellerId: existing }
  const row = await DB.prepare(
    `SELECT id, name, email, phone, business_name, business_number, representative_name, representative_phone,
            tax_email, bank_name, bank_account, account_holder FROM sellers WHERE id = ?`,
  ).bind(sellerId).first<SellerRow>()
  if (!row) return { ok: false, error: '매장을 찾을 수 없습니다' }
  const built = buildSellerBody(row)
  if (!built.ok) return { ok: false, error: `토스 등록에 필요한 정보가 없습니다: ${built.missing.join(', ')}` }
  const r = await encryptedPost<{ id: string; status: string }>(env as Required<TossPayoutEnv>, '/v2/sellers', built.body)
  const id = r.data.entityBody?.id
  if (!r.ok || !id) return { ok: false, error: `토스 셀러 등록 실패: ${errText(r.data)}` }
  await setSellerMeta(DB, sellerId, { [TOSS_SELLER_META_KEY]: id })
  return { ok: true, tossSellerId: id, status: r.data.entityBody?.status }
}

// ─────────────────────────────────────────────────────────────────────────────
// 지급 요청 — payouts 한 건 → 토스 지급 한 건
// ─────────────────────────────────────────────────────────────────────────────
const _ensured = new WeakSet<object>()
export async function ensureTossPayoutTable(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  await DB.prepare(`CREATE TABLE IF NOT EXISTS toss_payout_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payout_id INTEGER NOT NULL,
    attempt INTEGER NOT NULL DEFAULT 1,
    ref_payout_id TEXT NOT NULL,
    toss_payout_id TEXT,
    toss_seller_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'CLAIMED',
    error TEXT,
    requested_by_admin_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run()
  // 한 정산 건에 살아 있는 요청은 하나 — 실패(FAILED·CANCELED)한 시도만 재시도로 새 행을 허용한다.
  await DB.prepare(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_toss_payout_requests_live ON toss_payout_requests(payout_id) WHERE status NOT IN ('FAILED','CANCELED')",
  ).run()
  await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_toss_payout_requests_ref ON toss_payout_requests(ref_payout_id)').run()
  _ensured.add(DB)
}

/** 영업일 08:00~15:00(KST)면 바로지급, 아니면 다음 평일 예약지급. 공휴일은 토스가 거절한다 → 실패로 남고 재시도. 순수. */
export function tossSchedule(nowMs: number): { scheduleType: 'EXPRESS' } | { scheduleType: 'SCHEDULED'; payoutDate: string } {
  const k = new Date(nowMs + 9 * 3600_000)
  const dow = k.getUTCDay()
  const h = k.getUTCHours()
  if (dow >= 1 && dow <= 5 && h >= 8 && h < 15) return { scheduleType: 'EXPRESS' }
  const d = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()))
  do { d.setUTCDate(d.getUTCDate() + 1) } while (d.getUTCDay() === 0 || d.getUTCDay() === 6)
  return { scheduleType: 'SCHEDULED', payoutDate: d.toISOString().slice(0, 10) }
}

interface PayoutDbRow { id: number; status: string; payee_type: string; payee_id: string; amount: number; account_number: string | null; kind?: string | null }

/**
 * 승인된 정산 한 건을 토스에 보낸다. **매장(seller) 정산만** — 유어딜 커미션(인플루언서·에이전시)은
 * 우리 돈이라 은행 이체로 간다(결재 표). 장부는 여기서 'sent' 로 바꾸지 않는다 — 웹훅·상태 조회가 COMPLETED 를 확인할 때.
 */
export async function sendPayoutViaToss(
  DB: D1Database, env: TossPayoutEnv, payoutId: number, adminId: number | null, nowMs: number = Date.now(),
): Promise<{ ok: true; tossPayoutId: string; status: string } | { ok: false; error: string }> {
  const ready = await tossPayoutsReady(DB, env)
  if (!ready.ok) return { ok: false, error: ready.reason }
  await ensureTossPayoutTable(DB)
  const p = await DB.prepare('SELECT id, status, payee_type, payee_id, amount, account_number, kind FROM payouts WHERE id = ?')
    .bind(payoutId).first<PayoutDbRow>()
  if (!p) return { ok: false, error: '정산 건을 찾을 수 없습니다' }
  if (p.status !== 'approved') return { ok: false, error: '승인된 건만 토스로 보낼 수 있습니다' }
  // 'seller' 와 옛 'store_owner' 둘 다 매장이다 — 판정은 payout-account SSOT 로.
  const payee = canonicalPaidPayee(p.payee_type, p.payee_id)
  if (payee?.kind !== 'seller') return { ok: false, error: '매장 정산만 토스 지급대행으로 보냅니다(커미션은 은행 이체)' }
  const amount = Math.floor(Number(p.amount) || 0)
  if (amount <= 0) return { ok: false, error: '금액이 0 입니다' }
  // 계좌 재확인 가드 — 은행 이체와 같은 문(탈취 계좌로 나가는 것을 막는다).
  const acct = await checkPayeeAccountCurrent(DB, p)
  if (!acct.ok) return { ok: false, error: acct.error }
  const sellerId = Number(payee.id)
  const seller = await ensureTossSeller(DB, env, sellerId)
  if (!seller.ok) return { ok: false, error: seller.error }

  // 선점 — 살아 있는 요청이 이미 있으면 여기서 멈춘다(이중 지급 차단).
  const prev = await DB.prepare('SELECT COALESCE(MAX(attempt), 0) AS n FROM toss_payout_requests WHERE payout_id = ?')
    .bind(payoutId).first<{ n: number }>()
  const attempt = (Number(prev?.n) || 0) + 1
  const ref = `urdeal-p${payoutId}-a${attempt}`
  const claim = await DB.prepare(
    `INSERT OR IGNORE INTO toss_payout_requests (payout_id, attempt, ref_payout_id, toss_seller_id, amount, status, requested_by_admin_id)
     VALUES (?, ?, ?, ?, ?, 'CLAIMED', ?)`,
  ).bind(payoutId, attempt, ref, seller.tossSellerId, amount, adminId).run()
  if (!claim.meta?.changes) return { ok: false, error: '이미 토스에 요청한 건입니다' }

  const body = [{
    refPayoutId: ref,
    destination: seller.tossSellerId,
    ...tossSchedule(nowMs),
    amount: { currency: 'KRW', value: amount },
    transactionDescription: '유어딜정산',
    metadata: { urdealPayoutId: String(payoutId) },
  }]
  const r = await encryptedPost<{ items?: Array<{ id: string; status: string }> }>(env as Required<TossPayoutEnv>, '/v2/payouts', body)
  const item = r.data.entityBody?.items?.[0]
  if (!r.ok || !item?.id) {
    const error = errText(r.data)
    await DB.prepare("UPDATE toss_payout_requests SET status = 'FAILED', error = ?, updated_at = datetime('now') WHERE ref_payout_id = ?")
      .bind(error.slice(0, 500), ref).run()
    return { ok: false, error: `토스 지급 요청 실패: ${error}` }
  }
  await DB.prepare("UPDATE toss_payout_requests SET toss_payout_id = ?, status = ?, updated_at = datetime('now') WHERE ref_payout_id = ?")
    .bind(item.id, item.status || 'REQUESTED', ref).run()
  return { ok: true, tossPayoutId: item.id, status: item.status || 'REQUESTED' }
}

/**
 * 토스에 상태를 **직접 물어서** 반영한다(웹훅 본문은 믿지 않는다 — 신호로만 쓴다).
 * COMPLETED 면 `markPayoutSent`(가드 셋 + CAS)로 장부를 'sent' 로. FAILED·CANCELED 면 요청 행만 닫는다(재시도 가능).
 */
export async function syncTossPayout(DB: D1Database, env: TossPayoutEnv, tossPayoutId: string): Promise<{ ok: boolean; status?: string; error?: string }> {
  const ready = await tossPayoutsReady(DB, env)
  if (!ready.ok) return { ok: false, error: ready.reason }
  await ensureTossPayoutTable(DB)
  const req = await DB.prepare('SELECT payout_id, status FROM toss_payout_requests WHERE toss_payout_id = ?')
    .bind(tossPayoutId).first<{ payout_id: number; status: string }>()
  if (!req) return { ok: false, error: '우리가 요청한 지급이 아닙니다' }
  const r = await plainGet<{ status: string; error?: { message?: string } }>(env as Required<TossPayoutEnv>, `/v2/payouts/${encodeURIComponent(tossPayoutId)}`)
  const status = r.data.entityBody?.status
  if (!r.ok || !status) return { ok: false, error: `토스 조회 실패: ${errText(r.data)}` }
  const mapped = status === 'REJECTED' ? 'FAILED' : status
  await DB.prepare("UPDATE toss_payout_requests SET status = ?, error = ?, updated_at = datetime('now') WHERE toss_payout_id = ?")
    .bind(mapped, r.data.entityBody?.error?.message ?? null, tossPayoutId).run()
  if (mapped === 'COMPLETED') {
    const sent = await markPayoutSent(DB, Number(req.payout_id), `toss:${tossPayoutId}`, '토스 지급대행 완료')
    // 이미 sent 면 ALREADY_PROCESSED — 웹훅 재전송이다(정상).
    if (!sent.ok && sent.code !== 'ALREADY_PROCESSED') return { ok: false, status: mapped, error: sent.error }
  }
  return { ok: true, status: mapped }
}

/** 지급 가능 잔액(토스에 쌓인 돈). 어드민이 보내기 전에 본다. */
export async function getTossPayoutBalance(DB: D1Database, env: TossPayoutEnv): Promise<{ ok: true; available: number; pending: number } | { ok: false; error: string }> {
  const ready = await tossPayoutsReady(DB, env)
  if (!ready.ok) return { ok: false, error: ready.reason }
  const r = await plainGet<{ availableAmount?: { value: number }; pendingAmount?: { value: number } }>(env as Required<TossPayoutEnv>, '/v2/balances')
  if (!r.ok) return { ok: false, error: `토스 잔액 조회 실패: ${errText(r.data)}` }
  return { ok: true, available: Number(r.data.entityBody?.availableAmount?.value) || 0, pending: Number(r.data.entityBody?.pendingAmount?.value) || 0 }
}
