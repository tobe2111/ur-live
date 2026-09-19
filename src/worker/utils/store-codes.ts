/**
 * 🔑 **매장 코드 SSOT** — 사장님 승계 코드 · 인플루언서 협업 코드 (2026-09-19, 대표 확정 플로우)
 *
 * ## 왜 코드 하나로 접었나
 * 매칭이 네 갈래로 흩어져 있었다 — 사장님이 대행사 핸들·이메일을 입력(`/seller/operators`),
 * 사장님이 사업자번호로 매장을 찾아 claim(`/store/find`), 매장이 인플루언서를 검색해 제안
 * (`/seller/influencer-deals`), 유어애즈 DB 아웃리치 이메일 토큰(`/i/offer/:token`). 그리고
 * **매장이 제안한 조건 없는 딜은 인플루언서가 수락할 길이 아예 없었다**(엔드포인트 0).
 *
 * 대표 확정(2026-09-19): 코드 하나가 두 매칭을 맡는다.
 *   - `owner_claim`  — 대행사가 매장을 등록하는 순간 생긴다. 대행사가 사장님에게 주고, 사장님이
 *                      `/store/find?code=` 에서 입력하면 **그 매장의 소유권 신청**이 된다.
 *                      ⚠️ 코드는 "매장 찾기"만 대신한다 — 사업자등록증 확인·어드민 승인은 그대로다
 *                      (2026-09-16 사기 방어 결정). 코드가 새도 남의 매장을 못 가져간다.
 *   - `influencer`   — 매장(주인이든 운영자든)이 발급한다. **기본 커미션 %** 를 싣고, 인플루언서가
 *                      마이페이지나 `/i/join/:code` 에서 입력하면 `seller_influencer_deals` 에
 *                      **활성 딜**이 생긴다(승인 필요 코드면 `proposed`). 새 머니 경로가 아니다 —
 *                      기존 딜 레일의 **활성화 입구 하나**가 더 생긴 것뿐이다. 결제·적립·환불 역전은
 *                      `findActiveDealPct`(influencer-deal.ts) 가 그대로 본다.
 *
 * ## 🔒 권한을 내주는 쪽이 입력한다
 * `owner_claim` 은 **사장님이** 입력한다(대행사가 매장 코드를 입력하는 방향이면 코드 유출 = 남의 매장
 * 운영권). `influencer` 는 인플루언서가 입력하지만 얻는 것이 "그 매장 판매의 N% 를 받을 권리" 뿐이라
 * 유출돼도 매장에 손해가 없다(자기 매장 자기 추천은 `isSelfReferral` 이 결제 시점에 막는다).
 *
 * ## 케이스별 조정 (대표 2026-09-19 *"커미션 % 를 매번 케이스마다 조정 가능하긴 해야해"*)
 * 코드의 % 는 **기본값**이다. 코드는 여러 개 만들 수 있고(인플루언서 등급별로 다른 %), 입력 뒤에는
 * 딜 행을 매장이 개별 조정한다(`PATCH /api/seller-marketing/deals/:id`). 조정 상한은 매장의
 * `influencer_pct_cap`(중개사가 매장 등록 때 정한 인플루언서 예산 상한) 과 `DEAL_PCT_MAX`(90).
 *
 * ## 이 모듈이 하지 않는 것
 * 돈을 움직이지 않는다. 소유권을 넘기지 않는다(`store-ownership-claims.ts` 가 한다).
 */
import type { D1Database } from '@cloudflare/workers-types'
import { swallow } from './swallow'

export type StoreCodeKind = 'owner_claim' | 'influencer'

export interface StoreCodeRow {
  code: string
  seller_id: number
  kind: StoreCodeKind
  commission_pct: number | null
  requires_approval: number
  label: string | null
  created_by: number | null
  created_at: string
  expires_at: string | null
  revoked_at: string | null
  use_count: number
  max_uses: number | null
}

const _ensured = new WeakSet<object>()

export async function ensureStoreCodesTable(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS store_codes (
    code TEXT PRIMARY KEY,
    seller_id INTEGER NOT NULL,
    kind TEXT NOT NULL,
    commission_pct REAL,
    requires_approval INTEGER NOT NULL DEFAULT 0,
    label TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT (datetime('now')),
    expires_at DATETIME,
    revoked_at DATETIME,
    use_count INTEGER NOT NULL DEFAULT 0,
    max_uses INTEGER
  )`).run().catch(swallow('store-codes:create'))
  await DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_store_codes_seller ON store_codes(seller_id, kind, revoked_at)',
  ).run().catch(swallow('store-codes:idx'))
}

/** 사람이 옮겨 적을 수 있는 글자만 — 0/O · 1/I 를 뺀다. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const STORE_CODE_LEN = 8

export function generateStoreCode(random: (n: number) => Uint8Array = defaultRandom): string {
  const bytes = random(STORE_CODE_LEN)
  let out = ''
  for (let i = 0; i < STORE_CODE_LEN; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

function defaultRandom(n: number): Uint8Array {
  const b = new Uint8Array(n)
  crypto.getRandomValues(b)
  return b
}

/** 입력은 관대하게 — 하이픈·공백·소문자 전부 허용. 저장·비교는 항상 이 형태. */
export function normalizeStoreCode(raw: unknown): string {
  return String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
}

/** 사람에게 보여 줄 때는 `XXXX-XXXX`. 저장값은 하이픈이 없다. */
export function formatStoreCode(code: string): string {
  const c = normalizeStoreCode(code)
  return c.length === STORE_CODE_LEN ? `${c.slice(0, 4)}-${c.slice(4)}` : c
}

export function isStoreCodeShape(code: string): boolean {
  return new RegExp(`^[${ALPHABET}]{${STORE_CODE_LEN}}$`).test(code)
}

export interface IssueStoreCodeInput {
  sellerId: number
  kind: StoreCodeKind
  createdBy: number
  commissionPct?: number | null
  requiresApproval?: boolean
  label?: string | null
  maxUses?: number | null
  expiresAt?: string | null
}

/** 코드 발급. PK 충돌(32^8 ≈ 1조 분의 1)은 재시도 한 번으로 흡수한다. */
export async function issueStoreCode(DB: D1Database, input: IssueStoreCodeInput): Promise<StoreCodeRow | null> {
  await ensureStoreCodesTable(DB)
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateStoreCode()
    const r = await DB.prepare(
      `INSERT OR IGNORE INTO store_codes
         (code, seller_id, kind, commission_pct, requires_approval, label, created_by, expires_at, max_uses)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      code, input.sellerId, input.kind,
      input.commissionPct ?? null,
      input.requiresApproval ? 1 : 0,
      input.label ?? null,
      input.createdBy,
      input.expiresAt ?? null,
      input.maxUses ?? null,
    ).run().catch(() => null)
    if (r?.meta?.changes) return findStoreCode(DB, code)
  }
  return null
}

export async function findStoreCode(DB: D1Database, raw: unknown): Promise<StoreCodeRow | null> {
  const code = normalizeStoreCode(raw)
  if (!isStoreCodeShape(code)) return null
  await ensureStoreCodesTable(DB)
  return DB.prepare('SELECT * FROM store_codes WHERE code = ? LIMIT 1')
    .bind(code).first<StoreCodeRow>().catch(() => null)
}

export type StoreCodeInvalidReason = 'NOT_FOUND' | 'REVOKED' | 'EXPIRED' | 'EXHAUSTED' | 'WRONG_KIND'

/** 순수 판정 — 테스트가 이 함수로 경계를 잰다. `now` 는 ISO. */
export function judgeStoreCode(
  row: StoreCodeRow | null,
  kind: StoreCodeKind,
  now: string = new Date().toISOString(),
): { ok: true; row: StoreCodeRow } | { ok: false; reason: StoreCodeInvalidReason } {
  if (!row) return { ok: false, reason: 'NOT_FOUND' }
  if (row.kind !== kind) return { ok: false, reason: 'WRONG_KIND' }
  if (row.revoked_at) return { ok: false, reason: 'REVOKED' }
  if (row.expires_at && row.expires_at.replace(' ', 'T') < now.replace(' ', 'T')) return { ok: false, reason: 'EXPIRED' }
  if (row.max_uses != null && row.use_count >= row.max_uses) return { ok: false, reason: 'EXHAUSTED' }
  return { ok: true, row }
}

export const STORE_CODE_REASON_MESSAGE: Record<StoreCodeInvalidReason, string> = {
  NOT_FOUND: '코드를 찾을 수 없어요. 다시 확인해주세요',
  REVOKED: '더 이상 쓸 수 없는 코드예요',
  EXPIRED: '기간이 지난 코드예요',
  EXHAUSTED: '사용 횟수가 다 찬 코드예요',
  WRONG_KIND: '이 자리에 넣는 코드가 아니에요',
}

/**
 * 매장의 **사장님 승계 코드** — 매장당 하나. 없으면 만든다(멱등).
 * 주인이 이미 있는 매장에는 발급하지 않는다(호출부가 판정해 넘긴다 — 여기서는 모른다).
 */
export async function getOrIssueOwnerClaimCode(DB: D1Database, sellerId: number, createdBy: number): Promise<StoreCodeRow | null> {
  await ensureStoreCodesTable(DB)
  const existing = await DB.prepare(
    `SELECT * FROM store_codes WHERE seller_id = ? AND kind = 'owner_claim' AND revoked_at IS NULL
      ORDER BY created_at DESC LIMIT 1`,
  ).bind(sellerId).first<StoreCodeRow>().catch(() => null)
  if (existing) return existing
  return issueStoreCode(DB, { sellerId, kind: 'owner_claim', createdBy })
}

export async function listStoreCodes(DB: D1Database, sellerId: number, kind: StoreCodeKind): Promise<StoreCodeRow[]> {
  await ensureStoreCodesTable(DB)
  const { results } = await DB.prepare(
    `SELECT * FROM store_codes WHERE seller_id = ? AND kind = ? ORDER BY created_at DESC LIMIT 50`,
  ).bind(sellerId, kind).all<StoreCodeRow>().catch(() => ({ results: [] as StoreCodeRow[] }))
  return results || []
}

/** 회수 — 매장 스코프 안에서만(남의 매장 코드는 `changes=0`). */
export async function revokeStoreCode(DB: D1Database, sellerId: number, raw: unknown): Promise<boolean> {
  const code = normalizeStoreCode(raw)
  if (!isStoreCodeShape(code)) return false
  await ensureStoreCodesTable(DB)
  const r = await DB.prepare(
    `UPDATE store_codes SET revoked_at = datetime('now') WHERE code = ? AND seller_id = ? AND revoked_at IS NULL`,
  ).bind(code, sellerId).run().catch(() => null)
  return !!r?.meta?.changes
}

/** 사용 1회 기록 — 상한(`max_uses`)은 CAS 로 잠근다(동시 입력 두 건이 한도를 넘지 못한다). */
export async function consumeStoreCode(DB: D1Database, code: string): Promise<boolean> {
  const r = await DB.prepare(
    `UPDATE store_codes SET use_count = use_count + 1
      WHERE code = ? AND revoked_at IS NULL AND (max_uses IS NULL OR use_count < max_uses)`,
  ).bind(code).run().catch(() => null)
  return !!r?.meta?.changes
}
