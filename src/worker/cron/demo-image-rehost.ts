/**
 * 🖼️ 2026-07-21 (대표 "남은 이상적인 것까지 하자"): 데모 상품 갤러리 외부 URL → R2 점진 이관 cron.
 *
 * 배경: 데모 시드는 서브리퀘스트 한도(요청당 50) 때문에 **대표(커버) 1장만** R2 재호스팅하고,
 *   갤러리 2~5번째는 외부 CDN(search.pstatic / t1.daumcdn 등) URL 을 그대로 저장한다(2026-07-03 결정).
 *   외부 링크는 원본 삭제/핫링크 차단/인증서 문제로 언젠가 깨질 수 있음 → 시간당 소량씩 우리
 *   R2(/api/media/…)로 옮겨 영구화한다. 옮긴 뒤엔 cfImage(zone 리사이저)가 same-origin 리사이즈.
 *
 * 설계(예산 보호가 1원칙 — hourly 슬롯은 다른 cron 과 서브리퀘스트 예산을 공유):
 *   - 회당 상품 2개 × 이미지 최대 5장 = 외부 fetch ≤10 (R2 put 은 바인딩 op — fetch 예산 무관).
 *   - 멱등/종결: product_supply_meta `img_rehost_done`='1' 이면 후보 제외. 시도 카운터
 *     `img_rehost_tries` ≥3 이면 포기하고 done 마킹(영구 깨진 원본이 큐를 점유하지 못하게 —
 *     외부 URL 그대로 둬도 표시는 기존과 동일하므로 다운사이드 0).
 *   - 외부 URL 없는 행(이미 전부 내부/placeholder)은 스캔 즉시 done 마킹 — 백로그가 빠르게 수렴.
 *   - demo-stay 는 product_stay_rooms.image_urls 도 같은 매핑으로 동기(객실 썸네일 동일 URL 재사용 구조).
 *   - 완전 fail-soft: 개별 실패는 다음 시간에 재시도, cron 자체는 절대 throw 안 함(safeCron 래핑).
 */
import type { Env } from '../types/env'
import { rehostImageToR2, isExternalImageUrl } from '../utils/rehost-image'
import { getSupplyMeta, setSupplyMeta } from '../utils/product-supply-meta'

const PRODUCTS_PER_RUN = 2
const MAX_IMAGES_PER_PRODUCT = 5
const MAX_TRIES = 3

interface CandidateRow { id: number; slug: string; image_url: string | null; images: string | null }

function parseJsonArr(raw: string | null): string[] {
  if (!raw) return []
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v.filter((u): u is string => typeof u === 'string' && !!u) : [] } catch { return [] }
}

export async function handleDemoImageRehost(env: Env): Promise<{ scanned: number; migrated: number; images: number; done: number }> {
  const DB = env.DB
  const bucketEnv = env as unknown as { MEDIA_BUCKET?: R2Bucket }
  const result = { scanned: 0, migrated: 0, images: 0, done: 0 }
  if (!bucketEnv.MEDIA_BUCKET) return result // 바인딩 미등록 환경 — no-op

  const { results } = await DB.prepare(
    `SELECT p.id, p.slug, p.image_url, p.images
       FROM products p
      WHERE (p.slug LIKE 'demo-deal-%' OR p.slug LIKE 'demo-stay-%')
        AND COALESCE(p.is_active, 1) = 1
        AND NOT EXISTS (
          SELECT 1 FROM product_supply_meta m
           WHERE m.product_id = p.id AND m.key = 'img_rehost_done' AND m.value = '1'
        )
      ORDER BY p.id
      LIMIT 20`
  ).bind().all<CandidateRow>().catch(() => ({ results: [] as CandidateRow[] }))
  const rows = results || []
  result.scanned = rows.length
  if (rows.length === 0) return result

  const metaMap = await getSupplyMeta(DB, rows.map((r) => r.id)).catch(() => new Map<number, Record<string, string>>())

  let processed = 0
  for (const row of rows) {
    const gallery = parseJsonArr(row.images)
    const externals = [row.image_url, ...gallery].filter((u): u is string => isExternalImageUrl(u))
    // 외부 URL 없음 = 이미 전부 내부/placeholder → 종결 마킹(재스캔 제외, 백로그 수렴).
    if (externals.length === 0) {
      await setSupplyMeta(DB, row.id, { img_rehost_done: '1' }).catch(() => {})
      result.done++
      continue
    }
    if (processed >= PRODUCTS_PER_RUN) continue // 이번 시간 예산 소진 — 다음 시간에
    processed++

    const tries = Number(metaMap.get(row.id)?.img_rehost_tries || 0)
    if (tries >= MAX_TRIES) {
      // 반복 실패(원본 만료 등) — 포기 종결. 외부 URL 유지 = 표시 현행과 동일이라 무해.
      await setSupplyMeta(DB, row.id, { img_rehost_done: '1' }).catch(() => {})
      result.done++
      continue
    }

    // 외부 URL → R2 이관 매핑(중복 URL 은 1회만 fetch).
    const mapping = new Map<string, string>()
    let fetches = 0
    for (const u of externals) {
      if (fetches >= MAX_IMAGES_PER_PRODUCT) break
      if (mapping.has(u)) continue
      fetches++
      const hosted = await rehostImageToR2(bucketEnv, u, 'demo-image-rehost')
      if (hosted) mapping.set(u, hosted)
    }

    if (mapping.size > 0) {
      const newCover = row.image_url && mapping.has(row.image_url) ? mapping.get(row.image_url)! : row.image_url
      const newGallery = gallery.map((u) => mapping.get(u) || u)
      await DB.prepare(`UPDATE products SET image_url = ?, images = ?, updated_at = datetime('now') WHERE id = ?`)
        .bind(newCover, newGallery.length > 0 ? JSON.stringify(newGallery) : row.images, row.id)
        .run().catch(() => {})
      // 🏨 숙소 데모: 객실 썸네일(product_stay_rooms.image_urls)이 같은 URL 을 재사용 — 동일 매핑 동기.
      if (row.slug.startsWith('demo-stay-')) {
        const roomRows = await DB.prepare(`SELECT id, image_urls FROM product_stay_rooms WHERE product_id = ?`)
          .bind(row.id).all<{ id: number; image_urls: string | null }>().catch(() => ({ results: [] as { id: number; image_urls: string | null }[] }))
        for (const rr of (roomRows.results || [])) {
          const arr = parseJsonArr(rr.image_urls)
          if (arr.length === 0) continue
          const next = arr.map((u) => mapping.get(u) || u)
          if (JSON.stringify(next) !== JSON.stringify(arr)) {
            await DB.prepare(`UPDATE product_stay_rooms SET image_urls = ? WHERE id = ?`)
              .bind(JSON.stringify(next), rr.id).run().catch(() => {})
          }
        }
      }
      result.migrated++
      result.images += mapping.size
    }

    // 잔여 외부 여부로 종결/재시도 판정.
    const remaining = externals.filter((u) => !mapping.has(u))
    if (remaining.length === 0) {
      await setSupplyMeta(DB, row.id, { img_rehost_done: '1' }).catch(() => {})
      result.done++
    } else {
      await setSupplyMeta(DB, row.id, { img_rehost_tries: String(tries + 1) }).catch(() => {})
    }
  }
  return result
}
