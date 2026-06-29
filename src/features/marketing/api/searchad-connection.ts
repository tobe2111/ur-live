/**
 * 🆕 2026-06-27 유어애즈 — 멀티테넌트 검색광고 계정 연동(per-tenant 자격증명 저장).
 *   🆕 2026-06-28 다중 연결 + 활성 전환(대행사 고객사 전환). 한 로그인(seller_id)이 여러
 *   고객사(customer_id)를 등록하고, 사이드바 셀렉터로 활성 고객사를 전환.
 *   loadSearchAdConnection 은 **활성** 고객사 자격증명을 반환 → 읽기(실적/키워드/캠페인)는
 *   자동으로 활성 고객사로 격리. 쓰기(자동입찰 규칙)는 autobid.ts 가 tenant 컬럼으로 격리.
 *
 *   보안: secret_key 평문 저장 금지 — encryptAtRest(AES-GCM, DATA_ENCRYPTION_KEY).
 *   ⚠️ 라이브 검증은 실 광고계정 키 + 배포 후(이 환경 egress 차단).
 */
import { encryptAtRest, decryptAtRest } from '@/worker/utils/data-crypto'
import { swallow } from '@/worker/utils/swallow'
import type { SearchAdCreds } from './searchad-client'

const _schemaDone = new WeakSet<object>()
export async function ensureSearchAdConnSchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_searchad_tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    customer_id TEXT NOT NULL,
    tenant_label TEXT,
    access_license TEXT NOT NULL,
    secret_key_enc TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0,
    connected_at DATETIME DEFAULT (datetime('now')),
    last_verified_at DATETIME,
    UNIQUE(seller_id, customer_id)
  )`).run().catch(swallow('searchad:tenants'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_searchad_tenant_active ON ad_searchad_tenants(seller_id, is_active)').run().catch(swallow('searchad:tenantidx'))
  // 레거시(단일연결 ad_searchad_connections) → 신규 테이블로 1회 이관(활성으로). prod 는 대개 0행.
  await DB.prepare(`INSERT OR IGNORE INTO ad_searchad_tenants (seller_id, customer_id, access_license, secret_key_enc, is_active, connected_at, last_verified_at)
    SELECT seller_id, customer_id, access_license, secret_key_enc, 1, connected_at, last_verified_at FROM ad_searchad_connections`).run().catch(swallow('searchad:migrate'))
}

export interface TenantRow { customer_id: string; tenant_label: string | null; connected_at: string | null; is_active: number }

/** 활성 고객사 자격증명(복호화). 활성 없으면 가장 최근 연결로 폴백. */
export async function loadSearchAdConnection(DB: D1Database, sellerId: number, kek: string | undefined): Promise<SearchAdCreds | null> {
  await ensureSearchAdConnSchema(DB)
  const row = await DB.prepare(`SELECT customer_id, access_license, secret_key_enc FROM ad_searchad_tenants
    WHERE seller_id = ? ORDER BY is_active DESC, id DESC LIMIT 1`)
    .bind(sellerId).first<{ customer_id: string; access_license: string; secret_key_enc: string }>().catch(() => null)
  return decryptRow(row, kek)
}

/** 특정 고객사 자격증명(자동입찰 cron 이 tenant 별로 호출). */
export async function loadSearchAdConnectionByTenant(DB: D1Database, sellerId: number, customerId: string, kek: string | undefined): Promise<SearchAdCreds | null> {
  await ensureSearchAdConnSchema(DB)
  const row = await DB.prepare('SELECT customer_id, access_license, secret_key_enc FROM ad_searchad_tenants WHERE seller_id = ? AND customer_id = ?')
    .bind(sellerId, customerId).first<{ customer_id: string; access_license: string; secret_key_enc: string }>().catch(() => null)
  return decryptRow(row, kek)
}

async function decryptRow(row: { customer_id: string; access_license: string; secret_key_enc: string } | null, kek: string | undefined): Promise<SearchAdCreds | null> {
  if (!row) return null
  try {
    const secretKey = await decryptAtRest(row.secret_key_enc, kek)
    return { customerId: row.customer_id, accessLicense: row.access_license, secretKey }
  } catch { return null }
}

/** 활성 고객사 customer_id (자동입찰 규칙 격리 키). */
export async function getActiveTenantId(DB: D1Database, sellerId: number): Promise<string | null> {
  await ensureSearchAdConnSchema(DB)
  const row = await DB.prepare('SELECT customer_id FROM ad_searchad_tenants WHERE seller_id = ? ORDER BY is_active DESC, id DESC LIMIT 1')
    .bind(sellerId).first<{ customer_id: string }>().catch(() => null)
  return row?.customer_id || null
}

/** 고객사 추가/갱신 + 이 고객사를 활성으로(다른 고객사는 비활성). */
export async function saveSearchAdConnection(DB: D1Database, sellerId: number, creds: SearchAdCreds, kek: string | undefined, label?: string): Promise<void> {
  await ensureSearchAdConnSchema(DB)
  const enc = await encryptAtRest(creds.secretKey, kek)
  await DB.prepare('UPDATE ad_searchad_tenants SET is_active = 0 WHERE seller_id = ?').bind(sellerId).run().catch(() => null)
  await DB.prepare(`INSERT INTO ad_searchad_tenants (seller_id, customer_id, tenant_label, access_license, secret_key_enc, is_active, last_verified_at)
    VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
    ON CONFLICT(seller_id, customer_id) DO UPDATE SET tenant_label = COALESCE(excluded.tenant_label, ad_searchad_tenants.tenant_label),
      access_license = excluded.access_license, secret_key_enc = excluded.secret_key_enc, is_active = 1, last_verified_at = datetime('now')`)
    .bind(sellerId, creds.customerId, label?.slice(0, 40) || null, creds.accessLicense, enc).run()
}

/** 활성 고객사 전환. */
export async function setActiveTenant(DB: D1Database, sellerId: number, customerId: string): Promise<{ ok: boolean }> {
  await ensureSearchAdConnSchema(DB)
  const exists = await DB.prepare('SELECT 1 FROM ad_searchad_tenants WHERE seller_id = ? AND customer_id = ?').bind(sellerId, customerId).first().catch(() => null)
  if (!exists) return { ok: false }
  await DB.prepare('UPDATE ad_searchad_tenants SET is_active = 0 WHERE seller_id = ?').bind(sellerId).run()
  await DB.prepare('UPDATE ad_searchad_tenants SET is_active = 1 WHERE seller_id = ? AND customer_id = ?').bind(sellerId, customerId).run()
  return { ok: true }
}

/** 고객사 연결 해제. 활성을 지우면 다른 고객사를 활성으로 승격. customerId 없으면 활성 고객사 삭제. */
export async function deleteSearchAdConnection(DB: D1Database, sellerId: number, customerId?: string): Promise<void> {
  await ensureSearchAdConnSchema(DB)
  const target = customerId || (await getActiveTenantId(DB, sellerId))
  if (!target) return
  await DB.prepare('DELETE FROM ad_searchad_tenants WHERE seller_id = ? AND customer_id = ?').bind(sellerId, target).run()
  // 활성이 사라졌으면 가장 최근 것을 활성으로.
  const stillActive = await DB.prepare('SELECT 1 FROM ad_searchad_tenants WHERE seller_id = ? AND is_active = 1').bind(sellerId).first().catch(() => null)
  if (!stillActive) {
    await DB.prepare(`UPDATE ad_searchad_tenants SET is_active = 1 WHERE id = (
      SELECT id FROM ad_searchad_tenants WHERE seller_id = ? ORDER BY id DESC LIMIT 1)`).bind(sellerId).run().catch(() => null)
  }
}

/** 고객사 목록(마스킹 — 비밀키/라이선스 노출 안 함). */
export async function listTenants(DB: D1Database, sellerId: number): Promise<TenantRow[]> {
  await ensureSearchAdConnSchema(DB)
  const r = await DB.prepare('SELECT customer_id, tenant_label, connected_at, is_active FROM ad_searchad_tenants WHERE seller_id = ? ORDER BY is_active DESC, id ASC')
    .bind(sellerId).all<TenantRow>().catch(() => null)
  return r?.results || []
}

/** 마스킹된 활성 연결 상태(UI). */
export async function searchAdConnStatus(DB: D1Database, sellerId: number): Promise<{ connected: boolean; customer_id: string | null; connected_at: string | null; tenant_count: number }> {
  const tenants = await listTenants(DB, sellerId)
  const active = tenants.find(t => t.is_active) || tenants[0]
  return { connected: tenants.length > 0, customer_id: active?.customer_id || null, connected_at: active?.connected_at || null, tenant_count: tenants.length }
}

/** cron: 자동입찰 대상 (seller_id, customer_id) 쌍 — 활성 무관, 연결된 모든 고객사. */
export async function listAllTenantPairs(DB: D1Database, limit: number): Promise<Array<{ seller_id: number; customer_id: string }>> {
  await ensureSearchAdConnSchema(DB)
  const r = await DB.prepare('SELECT seller_id, customer_id FROM ad_searchad_tenants LIMIT ?').bind(limit).all<{ seller_id: number; customer_id: string }>().catch(() => null)
  return r?.results || []
}
