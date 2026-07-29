/**
 * 🏥 2026-07-03 (대표 — 의료용품 도매몰): 규제 몰 인허가(면허/신고번호) 저장 SSOT.
 *
 * 배경: 의료기기 등 규제 품목 몰(wholesale_malls.requires_license=1)은 가입 시 판매업/제조업 신고번호를
 *   받아 검증해야 한다. sellers/suppliers 컬럼 예산제(100컬럼 한도)를 피해 **사이드 테이블**에 저장.
 *   owner_type='supplier'(제조사) | 'distributor'(판매사=sellers), owner_id = 그 테이블 id.
 *   verified = 어드민 승인 시점에 1(현재는 저장·표시까지; 검증 토글은 승인 UI 후속).
 *
 * ⚠️ 전부 fail-soft(ensure/save 는 swallow) — 인허가 저장 실패가 가입 자체를 막지 않게(게이트는 라우트에서 400).
 */
import { swallow } from '@/worker/utils/swallow'

export type LicenseOwnerType = 'supplier' | 'distributor'

const _ensured = new WeakSet<object>()
export async function ensureLicenseSchema(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_type TEXT NOT NULL,
    owner_id INTEGER NOT NULL,
    mall_id INTEGER NOT NULL DEFAULT 1,
    permit_no TEXT,
    permit_url TEXT,
    verified INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(swallow('wholesale-license:ensure'))
  // owner 당 1행 멱등 (재가입/수정 upsert).
  await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_wholesale_license_owner ON wholesale_licenses(owner_type, owner_id)').run().catch(() => { /* 이미 존재/중복 */ })
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wholesale_license_mall ON wholesale_licenses(mall_id, verified)').run().catch(() => { /* 이미 존재 */ })
}

export interface WholesaleLicenseRow { permit_no: string | null; permit_url: string | null; verified: number }

/** 인허가 저장(멱등 upsert). permitNo/permitUrl 은 서버에서 trim/slice 후 전달. */
export async function saveWholesaleLicense(
  DB: D1Database, ownerType: LicenseOwnerType, ownerId: number, mallId: number,
  permitNo: string | null, permitUrl: string | null,
): Promise<void> {
  if (!ownerId) return
  await ensureLicenseSchema(DB)
  await DB.prepare(
    `INSERT INTO wholesale_licenses (owner_type, owner_id, mall_id, permit_no, permit_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(owner_type, owner_id) DO UPDATE SET
       permit_no = excluded.permit_no, permit_url = excluded.permit_url, mall_id = excluded.mall_id, updated_at = datetime('now')`
  ).bind(ownerType, ownerId, Math.floor(mallId) || 1, permitNo || null, permitUrl || null).run().catch(swallow('wholesale-license:save'))
}

/** owner 의 인허가 조회(어드민 승인 화면·본인 확인용). 없으면 null. */
export async function getWholesaleLicense(DB: D1Database, ownerType: LicenseOwnerType, ownerId: number): Promise<WholesaleLicenseRow | null> {
  if (!ownerId) return null
  await ensureLicenseSchema(DB)
  return DB.prepare('SELECT permit_no, permit_url, verified FROM wholesale_licenses WHERE owner_type = ? AND owner_id = ?')
    .bind(ownerType, ownerId).first<WholesaleLicenseRow>().catch(() => null)
}

/** 어드민 검증 토글(승인 시 verified=1). fail-soft. */
export async function setWholesaleLicenseVerified(DB: D1Database, ownerType: LicenseOwnerType, ownerId: number, verified: boolean): Promise<void> {
  if (!ownerId) return
  await ensureLicenseSchema(DB)
  await DB.prepare("UPDATE wholesale_licenses SET verified = ?, updated_at = datetime('now') WHERE owner_type = ? AND owner_id = ?")
    .bind(verified ? 1 : 0, ownerType, ownerId).run().catch(swallow('wholesale-license:verify'))
}
