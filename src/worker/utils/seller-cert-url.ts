/**
 * 🧾 매장 사업자등록증 URL — **두 자리** 중 어디에 있든 찾는다 (2026-09-20, E5 실사용에서 발견).
 *
 * 셀러 자기 가입(`seller-registration.routes`)은 `sellers.business_registration_image_url` 에,
 * 대시보드 매장 등록(`POST /api/seller/stores`, 직접·중개 모두)은 `seller_meta.business_cert_url` 에 적었다.
 * 어드민 승인 목록·상세·OCR 은 컬럼만 읽어서, 09-16 이후 새 매장의 서류가 **어디에도 안 보였다**
 * (에러 0 — 화면에 "서류 없음" 만 떴다). 등록 경로는 이제 컬럼에도 적지만(그 라우트 주석), 이전 행과
 * 컬럼 없는 env 를 위해 읽기는 항상 이 폴백을 탄다. 순서: 컬럼 → meta. 둘 다 없으면 null.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { getSellerMeta } from './seller-meta'

export const SELLER_CERT_META_KEY = 'business_cert_url'

export async function resolveSellerCertUrls(
  DB: D1Database, rows: Array<{ id: number | string; business_registration_image_url?: string | null }>,
): Promise<Map<number, string | null>> {
  const out = new Map<number, string | null>()
  const missing: number[] = []
  for (const r of rows) {
    const id = Number(r.id); const col = (r.business_registration_image_url || '').trim()
    if (col) out.set(id, col); else { out.set(id, null); missing.push(id) }
  }
  if (missing.length) {
    const meta = await getSellerMeta(DB, missing).catch(() => new Map<number, Record<string, string>>())
    for (const id of missing) {
      const v = (meta.get(id)?.[SELLER_CERT_META_KEY] || '').trim()
      if (v) out.set(id, v)
    }
  }
  return out
}

export async function resolveSellerCertUrl(DB: D1Database, sellerId: number, column?: string | null): Promise<string | null> {
  const m = await resolveSellerCertUrls(DB, [{ id: sellerId, business_registration_image_url: column ?? null }])
  return m.get(Number(sellerId)) ?? null
}
