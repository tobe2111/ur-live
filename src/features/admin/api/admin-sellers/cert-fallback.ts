/**
 * 🧾 어드민 셀러 목록·상세에 등록증 URL 폴백을 얹는다 (2026-09-20) — SSOT `worker/utils/seller-cert-url.ts`.
 * 대시보드 매장 등록은 서류를 `seller_meta.business_cert_url` 에만 적던 시절이 있어, 컬럼만 읽으면 "서류 없음".
 * 둘 다 fail-soft: 폴백이 실패하면 컬럼 값 그대로(종전 동작).
 */
import type { D1Database } from '@cloudflare/workers-types'
import { resolveSellerCertUrls, resolveSellerCertUrl } from '@/worker/utils/seller-cert-url'

type Row = { id: number | string; business_registration_image_url?: string | null }

export async function attachCertUrls<T extends Row>(DB: D1Database, rows: T[]): Promise<void> {
  try {
    const certs = await resolveSellerCertUrls(DB, rows)
    for (const r of rows) r.business_registration_image_url = certs.get(Number(r.id)) ?? r.business_registration_image_url ?? null
  } catch { /* 폴백 실패 — 컬럼 값 그대로 */ }
}

export async function attachCertUrl(DB: D1Database, sellerId: number | string, row: Record<string, unknown>): Promise<void> {
  try {
    row.business_registration_image_url = await resolveSellerCertUrl(DB, Number(sellerId), row.business_registration_image_url as string | null)
  } catch { /* 폴백 실패 — 컬럼 값 그대로 */ }
}
