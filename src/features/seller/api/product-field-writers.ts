/**
 * 🧩 상품 부가 필드 개별 UPDATE (seller-orders.routes.ts 에서 추출 — 2026-08-22)
 *
 * ⚠️ **왜 한 번에 안 쓰고 컬럼마다 따로 쓰는가**: 이 레포는 마이그레이션 CI 가 동작하지 않아
 *    (TECHNICAL_DEBT — D1 권한 없음) prod 에 없는 컬럼이 있을 수 있다. 한 문장에 몰아 쓰면
 *    컬럼 하나가 없을 때 **나머지도 전부 실패**한다. 그래서 컬럼별 try-catch 다 — 느리지만
 *    상품 등록이 통째로 실패하는 것보다 낫다. 합치지 말 것.
 */

import type { D1Database } from '@cloudflare/workers-types';

type DigitalBody = {
  product_kind?: string;
  delivery_type?: string;
  content_url?: string | null;
  content_format?: string | null;
  access_duration_days?: number | null;
  preview_url?: string | null;
};

/** 이용권 4종 공통 매장/공구 필드. 값이 비어 있으면 건드리지 않는다(기존 값 보존). */
const VOUCHER_FIELDS = [
  'restaurant_name', 'restaurant_address', 'restaurant_phone', 'voucher_terms', 'voucher_expiry',
  'group_buy_target', 'group_buy_deadline', 'store_verify_pin', 'group_buy_tiers',
  'restaurant_lat', 'restaurant_lng', 'external_booking_url', 'region_si', 'region_gu',
] as const;

async function writeOne(db: D1Database, field: string, val: unknown, productId: number): Promise<void> {
  try {
    await db.prepare(`UPDATE products SET ${field} = ? WHERE id = ?`).bind(val, productId).run();
  } catch { /* 컬럼 미존재 환경 — 나머지 필드는 계속 쓴다 */ }
}

export async function writeDigitalProductFields(
  db: D1Database, productId: number, body: DigitalBody,
): Promise<void> {
  if (!body.product_kind || body.product_kind === 'physical') return;
  const fields: Array<[string, unknown]> = [
    ['product_kind', body.product_kind],
    ['delivery_type', body.delivery_type || 'instant_url'],
    ['content_url', body.content_url || null],
    ['content_format', body.content_format || null],
    ['access_duration_days', body.access_duration_days ?? null],
    ['preview_url', body.preview_url || null],
  ];
  for (const [field, val] of fields) await writeOne(db, field, val, productId);
}

export async function writeVoucherProductFields(
  db: D1Database, productId: number, body: Record<string, unknown>,
): Promise<void> {
  for (const field of VOUCHER_FIELDS) {
    const val = body[field];
    if (val !== undefined && val !== null && val !== '') await writeOne(db, field, val, productId);
  }
}

/**
 * 📝 긴 텍스트/JSON 컬럼 한 칸 (`detail_images` · `images` · long_description 류).
 *
 * 🖼️ `images` 는 2026-09-03 대표 "이용권에 사진 여러 장" 으로 쓰기 시작했다. `detail_images`(상세에만
 * 병합) 와 달리 이 컬럼은 **홈 카드 캐러셀**도 읽는다(`sliceCardGallery`) — 첫 장이 대표이고
 * `image_url` 과 같은 값이다. 위 파일 주석대로 컬럼별 개별 write + 개별 try.
 */
export async function writeProductText(db: D1Database, productId: number, field: string, val: unknown): Promise<void> {
  if (typeof val !== 'string' || val.length === 0 || val.length > 100000) return;
  await writeOne(db, field, val, productId);
}
