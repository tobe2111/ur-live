/**
 * 🆕 2026-06-27 유어애즈 — 멀티테넌트 검색광고 계정 연동(per-tenant 자격증명 저장).
 *
 *   모델: 각 고객사(seller_id)가 자기 네이버 검색광고 계정의 자격증명
 *   (고객ID + 액세스라이선스 + 비밀키)을 발급해 연결 → 플랫폼이 그 키로 대신 호출.
 *   커머스 연동(naver_commerce_connections)과 동일 분리/암호화 패턴. 단, 검색광고는
 *   3-필드 HMAC 인증이라 별도 테이블.
 *
 *   보안: secret_key 는 평문 저장 금지 — encryptAtRest(AES-GCM, DATA_ENCRYPTION_KEY).
 *   ⚠️ 라이브 검증은 실 광고계정 키 + 배포 후(이 환경 egress 차단).
 */
import { encryptAtRest, decryptAtRest } from '@/worker/utils/data-crypto'
import { swallow } from '@/worker/utils/swallow'
import type { SearchAdCreds } from './searchad-client'

const _schemaDone = new WeakSet<object>()
export async function ensureSearchAdConnSchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_searchad_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    customer_id TEXT NOT NULL,
    access_license TEXT NOT NULL,
    secret_key_enc TEXT NOT NULL,
    connected_at DATETIME DEFAULT (datetime('now')),
    last_verified_at DATETIME,
    UNIQUE(seller_id)
  )`).run().catch(swallow('searchad:schema'))
}

export interface SearchAdConnRow { customer_id: string; access_license: string; connected_at: string | null }

/** 연결된 자격증명(복호화). 자동입찰/실적 등 per-advertiser 호출에 사용. */
export async function loadSearchAdConnection(DB: D1Database, sellerId: number, kek: string | undefined): Promise<SearchAdCreds | null> {
  await ensureSearchAdConnSchema(DB)
  const row = await DB.prepare('SELECT customer_id, access_license, secret_key_enc FROM ad_searchad_connections WHERE seller_id = ?')
    .bind(sellerId).first<{ customer_id: string; access_license: string; secret_key_enc: string }>().catch(() => null)
  if (!row) return null
  try {
    const secretKey = await decryptAtRest(row.secret_key_enc, kek)
    return { customerId: row.customer_id, accessLicense: row.access_license, secretKey }
  } catch {
    return null // KEK 변경/손상 — 재연결 필요
  }
}

export async function saveSearchAdConnection(DB: D1Database, sellerId: number, creds: SearchAdCreds, kek: string | undefined): Promise<void> {
  await ensureSearchAdConnSchema(DB)
  const enc = await encryptAtRest(creds.secretKey, kek)
  await DB.prepare(`
    INSERT INTO ad_searchad_connections (seller_id, customer_id, access_license, secret_key_enc, last_verified_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(seller_id) DO UPDATE SET customer_id = excluded.customer_id,
      access_license = excluded.access_license, secret_key_enc = excluded.secret_key_enc,
      last_verified_at = datetime('now')
  `).bind(sellerId, creds.customerId, creds.accessLicense, enc).run()
}

export async function deleteSearchAdConnection(DB: D1Database, sellerId: number): Promise<void> {
  await ensureSearchAdConnSchema(DB)
  await DB.prepare('DELETE FROM ad_searchad_connections WHERE seller_id = ?').bind(sellerId).run()
}

/** 마스킹된 연결 상태(UI 표시용 — 비밀키/라이선스 노출 안 함). */
export async function searchAdConnStatus(DB: D1Database, sellerId: number): Promise<{ connected: boolean; customer_id: string | null; connected_at: string | null }> {
  await ensureSearchAdConnSchema(DB)
  const row = await DB.prepare('SELECT customer_id, connected_at FROM ad_searchad_connections WHERE seller_id = ?')
    .bind(sellerId).first<{ customer_id: string; connected_at: string }>().catch(() => null)
  return { connected: !!row, customer_id: row?.customer_id || null, connected_at: row?.connected_at || null }
}
