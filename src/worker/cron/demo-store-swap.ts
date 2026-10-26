/**
 * 🔁 2026-10-27 (대표 "그 방식으로 진행") — 관련 사진이 3장 안 되는 매장의 동네딜 데모를 **다른 실제 매장으로 교체**.
 *
 * 그 매장이 카카오에 쓸 수 있는 사진(업체 + 장면 분류)을 3장 미만 갖고 있으면 아무리 다시 시도해도 3장이 안 된다
 * (라이브 표본 40곳 중 3곳). 숨기고 기다리는 대신, 같은 업종을 그 근처의 다른 실제 매장에서 찾아
 * 사진이 3장 이상 확보되는 곳으로 **같은 상품 행을 옮긴다**(가게·주소·전화·좌표·사진·카카오 주소).
 *   - 상품명·설명·가격(업종 오퍼)은 그대로 — 같은 업종이라 그대로 맞다.
 *   - 그 매장 이름으로 생성된 리뷰는 지우고 새 매장 기준으로 다시 만든다(옛 가게 이름이 남지 않게).
 *   - 다른 데모가 이미 쓰는 매장은 고르지 않는다.
 * 못 찾으면 false — 호출부가 그 데모를 내리고(is_active=0, 가역) 나중에 다시 시도한다.
 *
 * 서브리퀘스트: 후보 ≤2 × (카카오 검색 1~2 + 사진 수집 ≤7) + 리뷰 1. 호출부가 회차당 1건으로 제한한다.
 */
import type { Env } from '../types/env'
import { fetchDemoPhotos, DEMO_MIN_PHOTOS } from '../utils/demo-photo-set'
import { extractKakaoPlaceId } from '../utils/kakao-place-photos'
import { demoPhotoJudgeOn } from '../utils/demo-photo-judge'
import { setSupplyMeta } from '../utils/product-supply-meta'

export interface SwapRow {
  id: number; name: string; price: number | null; category: string | null; is_active: number | null
  restaurant_name: string; restaurant_lat: number | null; restaurant_lng: number | null
}

const SWAP_CANDIDATES = 2
/** 🤖 AI 판정 모드는 후보 하나가 싸다(매장주 사진 3장 미만이면 판정 없이 탈락 — 카카오 1회) → 하나 더 본다. */
const SWAP_CANDIDATES_JUDGED = 3

export async function swapDemoStore(env: Env, row: SwapRow, meta: Record<string, string>, condVersion: string): Promise<boolean> {
  const DB = env.DB
  if (row.restaurant_lat == null || row.restaurant_lng == null) return false
  const mod = await import('../../features/admin/api/admin-products.routes').catch(() => null)
  if (!mod) return false
  const pq = meta.demo_biz || mod.DEMO_BIZ.find((t) => t.cat === row.category)?.pq
  if (!pq) return false
  const curId = extractKakaoPlaceId(meta.kakao_place_url || null)
  const center = { x: String(row.restaurant_lng), y: String(row.restaurant_lat) }
  const tries = demoPhotoJudgeOn(env) ? SWAP_CANDIDATES_JUDGED : SWAP_CANDIDATES
  for (let i = 0; i < tries; i++) {
    const place = await mod.kakaoPlaceLookup(env as unknown as { KAKAO_REST_API_KEY?: string }, pq, -1, center).catch(() => null)
    if (!place?.name || !place.address || place.lat == null || place.lng == null) continue
    if (curId && place.placeId === curId) continue
    const dup = await DB.prepare(
      `SELECT 1 AS x FROM products WHERE slug LIKE 'demo-deal-%' AND restaurant_name = ? AND restaurant_address = ? LIMIT 1`
    ).bind(place.name, place.address).first<{ x: number }>().catch(() => ({ x: 1 }))
    if (dup) continue
    const imgs = await fetchDemoPhotos(env, {
      placeId: place.placeId, nameQuery: place.name, address: place.address,
      count: 3 + Math.floor(Math.random() * 3), category: row.category,
    }).catch(() => [] as string[])
    if (imgs.length < DEMO_MIN_PHOTOS) continue
    const res = await DB.prepare(
      `UPDATE products SET restaurant_name = ?, restaurant_address = ?, restaurant_phone = ?, restaurant_lat = ?, restaurant_lng = ?,
         image_url = ?, images = ?, is_active = 1, updated_at = datetime('now') WHERE id = ?`
    ).bind(place.name, place.address, place.phone || null, place.lat, place.lng, imgs[0], JSON.stringify(imgs), row.id).run().catch(() => null)
    if (!res?.meta?.changes) return false
    await setSupplyMeta(DB, row.id, {
      ...(place.placeUrl ? { kakao_place_url: place.placeUrl } : {}),
      ...(place.categoryName ? { kakao_category: place.categoryName } : {}),
      demo_cond_v: condVersion, demo_cond_tries: '0', img_rehost_done: '0',
      demo_photo_retry_after: '', demo_hidden_no_photo: '0',
      demo_swapped_from: row.restaurant_name.slice(0, 60),
    }).catch(() => {})
    // 옛 가게 이름으로 만든 리뷰를 걷고 새 매장 기준으로 다시 만든다(fail-soft — 실패하면 시간당 리뷰 cron 이 채운다).
    await DB.prepare(`DELETE FROM product_reviews WHERE product_id = ?`).bind(row.id).run().catch(() => {})
    await import('../utils/demo-review-generator').then((m) => m.seedDemoReviews(env, {
      id: row.id, name: row.name, category: row.category || 'meal_voucher', storeName: place.name, price: Number(row.price || 0),
    }, 6 + Math.floor(Math.random() * 7))).catch(() => 0)
    return true
  }
  return false
}
