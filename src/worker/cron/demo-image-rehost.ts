/**
 * 🖼️ 2026-07-21 (대표 "남은 이상적인 것까지 하자"): 데모 상품 이미지 자가치유 cron — 2스테이지.
 *
 *   ① 재조정(recondition, 버전 게이트): **모든** 기존 데모(동네딜+숙소)를 "현재 컨디션"으로 한 번씩
 *      맞춘다 — 카카오 대표(메인)사진을 커버로 + 3~5장 갤러리. 블로그 시드 버전(BLOG_SEED_VERSION)과
 *      동일 철학: meta `demo_cond_v` 가 현재 버전(DEMO_COND_V)과 다르면 재처리 → 처리 후 마킹 → 수렴.
 *      배경: 사진 3~5장 + og:image 대표사진 파이프라인 이전에 시드된 데모는 (a) 갤러리가 아예 없거나
 *      (b) 갤러리는 있어도 커버가 옛 네이버 웹검색 결과(대표사진 아님)라, 버전 bump 로 일괄 재적용한다.
 *   ② 이관(rehost): 재조정으로 들어온 외부 CDN URL(카카오/네이버)을 우리 R2(/api/media/…)로 옮겨 영구화
 *      (원본 삭제/핫링크 차단 면역). 옮긴 뒤엔 cfImage(zone 리사이저)가 same-origin 리사이즈.
 *
 * 설계(예산 보호가 1원칙 — hourly 슬롯은 다른 cron 과 서브리퀘스트 예산을 공유):
 *   - 재조정 회당 상품 3개(외부 fetch ≈ 카카오 og 1 + 네이버 1~2 = 상품당 ~3) · 이관 회당 2개.
 *   - 멱등/수렴: 재조정=`demo_cond_v` 마커, 이관=`img_rehost_done` 마커. 시도 카운터 ≥3 이면 포기 마킹
 *     (깨진 원본이 큐를 점유하지 못하게 — 기존 표시 유지라 다운사이드 0).
 *   - 완전 fail-soft: 개별 실패는 다음 시간 재시도, cron 자체는 절대 throw 안 함(safeCron 래핑).
 *   - 규모가 크면 시간당 소량이라 며칠에 걸쳐 수렴(어드민 무개입) — 즉시 전체는 별도 수동 트리거 가능.
 */
import type { Env } from '../types/env'
import { rehostImageToR2, isExternalImageUrl, validateImageLoads } from '../utils/rehost-image'
import { getSupplyMeta, setSupplyMeta } from '../utils/product-supply-meta'
import { fetchDemoPhotos } from '../utils/demo-photo-set'

// 🏷️ 데모 이미지 컨디션 버전 — bump 하면 전 데모가 한 번씩 재적용된다(대표사진 + 3~5장).
//   v2 = 카카오 og 대표사진 커버 + 3~5장(2026-07-21).
//   v3 = + 네이버 지도(플레이스) 대표사진 커버 폴백(카카오 사진 없는 매장, 2026-07-21 대표 지시).
export const DEMO_COND_V = '3'

const RECONDITION_PER_RUN = 3
const REHOST_PER_RUN = 2
const MAX_IMAGES_PER_PRODUCT = 5
const MAX_TRIES = 3

interface CandidateRow { id: number; slug: string; image_url: string | null; images: string | null; restaurant_name: string | null; restaurant_address: string | null }

function parseJsonArr(raw: string | null): string[] {
  if (!raw) return []
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v.filter((u): u is string => typeof u === 'string' && !!u) : [] } catch { return [] }
}
/**
 * ☁️ 2026-07-21 (대표 스샷 — "커버 294개 중 R2 1 · 외부 293"): 외부 커버를 **즉시 대량** R2 이관.
 *   cron 은 시간당 2개라 293개면 수일 → 어드민 온디맨드로 청크 이관(각 요청 = 새 서브리퀘스트 예산).
 *   커버 + 갤러리 외부 URL 을 R2(/api/media)로 옮기고 products.image_url/images 갱신. remaining 반환.
 *   fail-soft. MEDIA_BUCKET 없으면 0(호출측이 배너로 안내).
 */
export async function rehostDemoImagesBulk(env: Env, perRun = 8): Promise<{ rehosted: number; images: number; remaining: number; bucketBound: boolean }> {
  const DB = env.DB
  const bucketEnv = env as unknown as { MEDIA_BUCKET?: R2Bucket }
  const bucketBound = !!bucketEnv.MEDIA_BUCKET
  const countExternal = async () => {
    const r = await DB.prepare(
      `SELECT COUNT(*) AS n FROM products
        WHERE (slug LIKE 'demo-deal-%' OR slug LIKE 'demo-stay-%') AND COALESCE(is_active,1)=1
          AND image_url LIKE 'http%' AND image_url NOT LIKE '%media.ur-team.com%' AND image_url NOT LIKE '%picsum.photos%'`
    ).first<{ n: number }>().catch(() => ({ n: 0 }))
    return Number(r?.n ?? 0)
  }
  if (!bucketBound) return { rehosted: 0, images: 0, remaining: await countExternal(), bucketBound }
  const { results } = await DB.prepare(
    `SELECT id, slug, image_url, images FROM products
      WHERE (slug LIKE 'demo-deal-%' OR slug LIKE 'demo-stay-%') AND COALESCE(is_active,1)=1
        AND image_url LIKE 'http%' AND image_url NOT LIKE '%media.ur-team.com%' AND image_url NOT LIKE '%picsum.photos%'
      ORDER BY id LIMIT ?`
  ).bind(Math.max(1, Math.min(12, perRun))).all<{ id: number; slug: string; image_url: string | null; images: string | null }>()
    .catch(() => ({ results: [] as { id: number; slug: string; image_url: string | null; images: string | null }[] }))
  let rehosted = 0, images = 0
  for (const row of (results || [])) {
    const gallery = parseJsonArr(row.images)
    const externals = [row.image_url, ...gallery].filter((u): u is string => isExternalImageUrl(u))
    const mapping = new Map<string, string>()
    let fetches = 0
    for (const u of externals) {
      if (fetches >= MAX_IMAGES_PER_PRODUCT) break
      if (mapping.has(u)) continue
      fetches++
      const hosted = await rehostImageToR2(bucketEnv, u, 'demo-bulk-rehost')
      if (hosted) mapping.set(u, hosted)
    }
    const resolve = (u: string) => mapping.get(u) || u
    const newCover = row.image_url ? resolve(row.image_url) : row.image_url
    const newGallery = gallery.map(resolve)
    // 커버가 여전히 외부(이관 실패)면 이 라운드는 skip(다음에 재시도) — 무한루프 방지는 remaining 감소로.
    if (newCover !== row.image_url || JSON.stringify(newGallery) !== JSON.stringify(gallery)) {
      await DB.prepare(`UPDATE products SET image_url = ?, images = ?, updated_at = datetime('now') WHERE id = ?`)
        .bind(newCover, newGallery.length ? JSON.stringify(newGallery) : row.images, row.id).run().catch(() => {})
      // 숙소 객실 썸네일도 매핑 반영.
      if (row.slug.startsWith('demo-stay-') && mapping.size > 0) {
        const rr = await DB.prepare(`SELECT id, image_urls FROM product_stay_rooms WHERE product_id = ?`).bind(row.id)
          .all<{ id: number; image_urls: string | null }>().catch(() => ({ results: [] as { id: number; image_urls: string | null }[] }))
        for (const room of (rr.results || [])) {
          const arr = parseJsonArr(room.image_urls); if (!arr.length) continue
          const next = arr.map(resolve)
          if (JSON.stringify(next) !== JSON.stringify(arr)) await DB.prepare(`UPDATE product_stay_rooms SET image_urls = ? WHERE id = ?`).bind(JSON.stringify(next), room.id).run().catch(() => {})
        }
      }
      if (newCover !== row.image_url) rehosted++
      images += mapping.size
    } else {
      // 커버 이관 실패(도달불가/깨짐) — 이 커버가 remaining 에서 안 빠지면 루프가 멈추니, 깨진 것으로 마킹해
      //   다음 순환에서 heal(재획득)로 넘김. 여기선 placeholder 로 치환해 카드 깨짐만 즉시 제거.
      await DB.prepare(`UPDATE products SET image_url = ? WHERE id = ?`)
        .bind(`https://picsum.photos/seed/heal-${row.id}/600/600`, row.id).run().catch(() => {})
    }
  }
  return { rehosted, images, remaining: await countExternal(), bucketBound }
}

function isPlaceholderUrl(u: string | null | undefined): boolean {
  return !u || /picsum\.photos/.test(u)
}

/**
 * ① 재조정 — 버전 마커(demo_cond_v)가 현재와 다른 데모를 현재 컨디션으로 맞춘다.
 *   커버 = 카카오 대표(og)사진(placeUrl 있을 때, imgs[0]) · 갤러리 = 3~5장. 성공 시 rehost 재큐잉.
 */
export async function reconditionDemos(env: Env, perRun = RECONDITION_PER_RUN): Promise<{ reconditioned: number; skipped: number }> {
  const DB = env.DB
  const out = { reconditioned: 0, skipped: 0 }
  const { results } = await DB.prepare(
    `SELECT p.id, p.slug, p.image_url, p.images, p.restaurant_name, p.restaurant_address, p.restaurant_phone, p.restaurant_lat, p.restaurant_lng
       FROM products p
      WHERE (p.slug LIKE 'demo-deal-%' OR p.slug LIKE 'demo-stay-%')
        AND COALESCE(p.is_active, 1) = 1
        AND p.restaurant_name IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM product_supply_meta m
           WHERE m.product_id = p.id AND m.key = 'demo_cond_v' AND m.value = ?
        )
      ORDER BY p.id
      LIMIT ?`
  ).bind(DEMO_COND_V, Math.max(1, perRun)).all<{ id: number; slug: string; image_url: string | null; images: string | null; restaurant_name: string; restaurant_address: string | null; restaurant_phone: string | null; restaurant_lat: number | null; restaurant_lng: number | null }>()
    .catch(() => ({ results: [] as { id: number; slug: string; image_url: string | null; images: string | null; restaurant_name: string; restaurant_address: string | null; restaurant_phone: string | null; restaurant_lat: number | null; restaurant_lng: number | null }[] }))
  const rows = results || []
  if (rows.length === 0) return out
  const metaMap = await getSupplyMeta(DB, rows.map((r) => r.id)).catch(() => new Map<number, Record<string, string>>())
  // 📞 2026-07-21 (대표 "다 넣어줘 — 모두 다"): 기존 데모 전화·실업종 백필용 — 카카오 키워드 조회.
  //   admin-stays 시드와 동일한 dynamic-import 패턴(순환은 둘 다 lazy 라 무해).
  const { kakaoPlaceLookup } = await import('../../features/admin/api/admin-products.routes').catch(() => ({ kakaoPlaceLookup: null as unknown as null }))

  for (const row of rows) {
    const meta = metaMap.get(row.id) || {}
    const tries = Number(meta.demo_cond_tries || 0)
    if (tries >= MAX_TRIES) {
      // 반복 실패(매칭/사진 확보 불가) — 현재 상태 유지하고 버전만 마킹(큐에서 제외, 수렴).
      await setSupplyMeta(DB, row.id, { demo_cond_v: DEMO_COND_V }).catch(() => {})
      out.skipped++
      continue
    }
    const placeUrl = meta.kakao_place_url || null
    const imgs = await fetchDemoPhotos(env, {
      placeId: placeUrl,                  // 있으면 imgs[0] = 카카오 대표(og)사진 — 커버 교체 grounding
      nameQuery: row.restaurant_name,     // 실매장명 — 네이버 지도 대표사진 + 스코어링 grounding
      address: row.restaurant_address,    // 네이버 지도 대표사진 검색 정확도(동명 매장 구분)
      count: 3 + Math.floor(Math.random() * 3),
    }).catch(() => [] as string[])
    if (imgs.length === 0) {
      await setSupplyMeta(DB, row.id, { demo_cond_tries: String(tries + 1) }).catch(() => {})
      continue
    }
    // 커버 결정:
    //   - placeUrl 있음 → imgs[0](카카오 대표사진)로 교체 = "가장 메인이 되는 사진" 확정.
    //   - placeUrl 없음 → 기존 커버가 실사진이고 **실제 로드되면** 유지, placeholder/깨짐이면 imgs[0].
    //   🩹 2026-07-21 전수조사 #4: 기존 커버를 무조건 유지하던 것 → validateImageLoads 로 검증해
    //     깨진/핫링크 커버가 살아남지 않게(감사 지적 — 깨진 커버가 recondition 을 통과하던 구멍).
    const keepOld = !placeUrl && !isPlaceholderUrl(row.image_url) && await validateImageLoads(row.image_url)
    const cover = keepOld ? (row.image_url as string) : imgs[0]
    const gallery = Array.from(new Set([cover, ...imgs])).slice(0, 5)
    await DB.prepare(`UPDATE products SET image_url = ?, images = ?, updated_at = datetime('now') WHERE id = ?`)
      .bind(cover, JSON.stringify(gallery), row.id).run().catch(() => {})
    // 🏨 숙소: 객실 썸네일도 새 갤러리로 정합(hero=새사진 / 객실=옛사진 불일치 방지). 객실별 로테이션 분배.
    if (row.slug.startsWith('demo-stay-')) {
      const roomRows = await DB.prepare(`SELECT id FROM product_stay_rooms WHERE product_id = ? AND is_active = 1 ORDER BY display_order ASC`)
        .bind(row.id).all<{ id: number }>().catch(() => ({ results: [] as { id: number }[] }))
      let order = 0
      for (const rr of (roomRows.results || [])) {
        const pics = gallery.length ? [gallery[order % gallery.length], ...(gallery.length > 2 ? [gallery[(order + 1) % gallery.length]] : [])] : [cover]
        await DB.prepare(`UPDATE product_stay_rooms SET image_urls = ? WHERE id = ?`)
          .bind(JSON.stringify(pics), rr.id).run().catch(() => {})
        order++
      }
    }
    // 📞 전화·실업종 백필(기존 데모도 "모두 다") — 전화 없고 placeUrl 있을 때만, 카카오 키워드로 재조회.
    //   같은 매장 보장: 반환 placeId 가 저장된 place URL 의 id 와 일치할 때만 신뢰(오매칭 방지).
    if (kakaoPlaceLookup && placeUrl && !row.restaurant_phone) {
      const storedId = (placeUrl.match(/(\d{6,})/) || [])[1] || null
      const center = row.restaurant_lat != null && row.restaurant_lng != null
        ? { x: String(row.restaurant_lng), y: String(row.restaurant_lat) } : null
      const look = await kakaoPlaceLookup(env as unknown as { KAKAO_REST_API_KEY?: string }, row.restaurant_name, 0, center).catch(() => null)
      if (look && (!storedId || look.placeId === storedId)) {
        if (look.phone) {
          await DB.prepare(`UPDATE products SET restaurant_phone = ? WHERE id = ?`).bind(look.phone, row.id).run().catch(() => {})
        }
        if (look.categoryName) {
          await setSupplyMeta(DB, row.id, { kakao_category: look.categoryName }).catch(() => {})
        }
      }
    }
    // 버전 마킹(수렴) + rehost 재큐잉(새 외부 URL 을 R2 로 이관하도록 종결 마크 해제).
    await setSupplyMeta(DB, row.id, { demo_cond_v: DEMO_COND_V, img_rehost_done: '0' }).catch(() => {})
    out.reconditioned++
  }
  return out
}

export async function handleDemoImageRehost(env: Env): Promise<{ reconditioned: number; migrated: number; images: number; done: number }> {
  const DB = env.DB
  const bucketEnv = env as unknown as { MEDIA_BUCKET?: R2Bucket }
  // ① 재조정 — R2 버킷 유무와 무관(외부 URL 저장도 표시엔 유효, ②가 이후 영구화). fail-soft.
  const rc = await reconditionDemos(env).catch(() => ({ reconditioned: 0, skipped: 0 }))
  const result = { reconditioned: rc.reconditioned, migrated: 0, images: 0, done: 0 }
  if (!bucketEnv.MEDIA_BUCKET) return result // 바인딩 미등록 — 이관만 no-op(재조정은 이미 수행)

  // ② 이관 + 깨진 사진 자가치유 — 외부 CDN URL → R2, 3회 시도해도 못 옮기는 URL 은 깨진 것으로 판정해 제거.
  const { results } = await DB.prepare(
    `SELECT p.id, p.slug, p.image_url, p.images, p.restaurant_name, p.restaurant_address
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
    if (processed >= REHOST_PER_RUN) continue // 이번 시간 예산 소진 — 다음 시간에
    processed++

    const meta = metaMap.get(row.id) || {}
    const tries = Number(meta.img_rehost_tries || 0)
    const lastTry = tries + 1 >= MAX_TRIES  // 이번이 마지막 시도 → 못 옮긴 외부 URL 은 깨진 것으로 판정·제거

    // 외부 URL → R2 이관 매핑(중복 URL 은 1회만 fetch). rehostImageToR2 는 fetch+검증(image/*·크기)
    //   포함이라 성공=성한 사진, 실패=도달불가/비이미지(=깨진 후보).
    const mapping = new Map<string, string>()
    let fetches = 0
    for (const u of externals) {
      if (fetches >= MAX_IMAGES_PER_PRODUCT) break
      if (mapping.has(u)) continue
      fetches++
      const hosted = await rehostImageToR2(bucketEnv, u, 'demo-image-rehost')
      if (hosted) mapping.set(u, hosted)
    }
    // URL 해석기: 이관 성공→R2, 내부(/api/media)→그대로, 그 외 외부→(마지막 시도면 깨진 것으로 제거).
    const isStillExternalBroken = (u: string) => isExternalImageUrl(u) && !mapping.has(u)
    const resolve = (u: string) => mapping.get(u) || u
    const keep = (u: string) => !(lastTry && isStillExternalBroken(u))  // 마지막 시도: 못 옮긴 외부 제거

    // 커버+갤러리 재구성(순서 보존·중복 제거). 마지막 시도면 깨진 외부는 빠짐.
    const rebuilt: string[] = []
    const seenU = new Set<string>()
    for (const u of [row.image_url, ...gallery]) {
      if (!u) continue
      if (!keep(u)) continue
      const r = resolve(u)
      if (!seenU.has(r)) { seenU.add(r); rebuilt.push(r) }
    }

    let healRefetched = false
    if (rebuilt.length === 0 && lastTry) {
      // 🩹 모든 사진이 깨짐(전부 도달불가) → 대표사진을 다시 받아 복구(회당 1회, heal 라운드 캡).
      const rounds = Number(meta.img_heal_rounds || 0)
      if (rounds < 2 && row.restaurant_name) {
        const fresh = await fetchDemoPhotos(env, {
          placeId: meta.kakao_place_url || null,
          nameQuery: row.restaurant_name,
          address: row.restaurant_address,
          count: 3 + Math.floor(Math.random() * 3),
        }).catch(() => [] as string[])
        if (fresh.length > 0) {
          for (const u of fresh) if (!seenU.has(u)) { seenU.add(u); rebuilt.push(u) }
          healRefetched = true
          await setSupplyMeta(DB, row.id, { img_heal_rounds: String(rounds + 1) }).catch(() => {})
        }
      }
    }

    // 커버 = 재구성 첫 장(대표사진 우선순위 보존). 갤러리 = 재구성 전체. 아무것도 없으면 기존 유지(placeholder 방지).
    const newCover = rebuilt[0] ?? row.image_url
    const newImages = rebuilt.length > 0 ? JSON.stringify(rebuilt) : row.images
    const changed = newCover !== row.image_url || newImages !== row.images
    if (changed) {
      await DB.prepare(`UPDATE products SET image_url = ?, images = ?, updated_at = datetime('now') WHERE id = ?`)
        .bind(newCover, newImages, row.id).run().catch(() => {})
    }
    // 🏨 숙소 데모: 객실 썸네일 정합 — 깨진 URL 제거 + 이관 매핑 반영(빈배열이면 새 갤러리로 대체).
    if (row.slug.startsWith('demo-stay-') && (mapping.size > 0 || lastTry)) {
      const roomRows = await DB.prepare(`SELECT id, image_urls FROM product_stay_rooms WHERE product_id = ?`)
        .bind(row.id).all<{ id: number; image_urls: string | null }>().catch(() => ({ results: [] as { id: number; image_urls: string | null }[] }))
      let order = 0
      for (const rr of (roomRows.results || [])) {
        const arr = parseJsonArr(rr.image_urls)
        let next = arr.map(resolve).filter(keep)
        if (next.length === 0 && rebuilt.length > 0) {
          // 객실 사진이 전부 깨짐 → 새 갤러리에서 로테이션 분배(시드 규칙 미러).
          next = rebuilt.length ? [rebuilt[order % rebuilt.length], ...(rebuilt.length > 2 ? [rebuilt[(order + 1) % rebuilt.length]] : [])] : []
        }
        next = Array.from(new Set(next))
        if (JSON.stringify(next) !== JSON.stringify(arr) && next.length > 0) {
          await DB.prepare(`UPDATE product_stay_rooms SET image_urls = ? WHERE id = ?`)
            .bind(JSON.stringify(next), rr.id).run().catch(() => {})
        }
        order++
      }
    }
    if (mapping.size > 0) { result.migrated++; result.images += mapping.size }

    // 종결/재시도 판정: 잔여 외부(미이관·미제거) 없으면 종결. heal 재조회했으면 새 외부 URL 이관 위해 계속.
    const remainingExternal = rebuilt.some((u) => isExternalImageUrl(u))
    if (!remainingExternal) {
      await setSupplyMeta(DB, row.id, { img_rehost_done: '1' }).catch(() => {})
      result.done++
    } else if (lastTry && !healRefetched) {
      // 마지막 시도인데 여전히 외부 남음(=깨진 건 이미 제거, 남은 건 이관 실패한 성한 URL) → 종결(다음 순환에서 재시도되게 tries 리셋).
      await setSupplyMeta(DB, row.id, { img_rehost_done: '1' }).catch(() => {})
      result.done++
    } else {
      // heal 재조회했으면 tries 리셋(새 URL 이관 기회), 아니면 +1.
      await setSupplyMeta(DB, row.id, { img_rehost_tries: healRefetched ? '0' : String(tries + 1) }).catch(() => {})
    }
  }
  return result
}
