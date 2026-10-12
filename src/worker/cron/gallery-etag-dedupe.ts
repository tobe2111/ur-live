/**
 * 🖼️ 같은 사진이 다른 주소로 두 장 — 이미 저장된 갤러리를 **내용 기준**으로 접는다.
 *
 * ■ 무엇이 났나 (2026-10-12 대표 *"이용권 썸네일에서 아직도 사진이 중복으로 2개 있는 경우가 많아"*)
 *   R2 이관 키가 무작위(UUID)였던 시절, 같은 원본 사진을 두 번 이관하면 **주소가 둘**이 됐다
 *   (`rehost-image.ts`). 화면은 주소 문자열로만 겹침을 거르므로 그 둘을 다른 사진으로 보고 두 칸에 그렸다.
 *   실측: 데모 이용권 51개(id 2489~2557)가 갤러리 두 번째 칸이 첫 칸·커버와 **같은 바이트**였다.
 *   2026-09-03 `repairGalleryCoverDrift` 는 "커버만 새 주소, 첫 칸은 옛 외부 주소" 를 고쳤지만
 *   이 경우는 **둘 다 우리 주소**라 그 패스가 못 본다.
 *
 * ■ 앞으로는 안 생긴다 — 이관 키가 내용 해시가 됐다(같은 바이트 = 같은 주소). 이 패스는 **이미 생긴 것**만 정리한다.
 *
 * ■ 어떻게 판정하나 — R2 `head()` 의 크기 + etag(단일 업로드면 내용 MD5). 둘이 같으면 같은 사진이다.
 *   사진을 지우는 게 아니라 **같은 사진의 두 번째 주소**를 빼는 것이라 다른 사진은 사라지지 않는다.
 *   head 를 못 읽은 주소(외부·없음)는 판정 밖 — 그대로 둔다(추측 금지).
 */
import { setSupplyMeta } from '../utils/product-supply-meta'

export const GALLERY_ETAG_DEDUPE_KEY = 'gallery_etag_dedupe_v1'

/** 우리 저장소 주소 → R2 키. 아니면 null. */
export function mediaKeyOf(u: string | null | undefined): string | null {
  if (!u || typeof u !== 'string') return null
  const clean = u.split(/[?#]/)[0]
  const i = clean.indexOf('/api/media/')
  if (i >= 0) return clean.slice(i + '/api/media/'.length) || null
  try {
    const url = new URL(clean)
    if (url.hostname === 'media.ur-team.com') return url.pathname.replace(/^\/+/, '') || null
  } catch { /* 상대경로 등 */ }
  return null
}

/**
 * 갤러리를 내용 서명(크기:etag)으로 접는다. 순수 함수 — 시험이 이것을 직접 잰다.
 *
 * - 커버와 같은 내용인 칸은 빠진다. 단 **첫 칸**이면 커버 주소로 바꿔 둔다(`images[0]` = 커버라는 저장 모델 유지).
 * - 앞 칸과 같은 내용인 칸은 빠진다.
 * - 서명이 없는 칸(외부·head 실패)은 그대로 둔다.
 * @returns 새 갤러리. 바뀐 게 없으면 null.
 */
export function dedupeGalleryBySig(
  cover: string | null | undefined,
  gallery: string[],
  sigOf: (u: string) => string | null,
): string[] | null {
  const coverSig = cover ? sigOf(cover) : null
  const seen = new Set<string>()
  if (coverSig) seen.add(coverSig)
  const out: string[] = []
  for (const u of gallery) {
    const s = sigOf(u)
    if (s && seen.has(s)) {
      if (out.length === 0 && cover && s === coverSig) out.push(cover)
      continue
    }
    if (s) seen.add(s)
    out.push(u)
  }
  const dedup = Array.from(new Set(out))
  if (dedup.length === gallery.length && dedup.every((u, i) => u === gallery[i])) return null
  return dedup
}

/**
 * 한 라운드 — 우리 주소가 둘 이상인 활성 상품 몇 개를 골라 내용이 같은 칸을 접는다.
 * head 1건 = 서브리퀘스트 1건이라 라운드당 적게(기본 4개). 처리한 상품은 표시를 남겨 다시 안 본다.
 */
export async function dedupeGalleryByEtag(
  env: { DB: D1Database; MEDIA_BUCKET?: R2Bucket },
  perRun = 4,
): Promise<{ scanned: number; fixed: number }> {
  const bucket = env.MEDIA_BUCKET
  if (!bucket) return { scanned: 0, fixed: 0 }
  const DB = env.DB
  const MEDIA = '/api/media/'
  const { results } = await DB.prepare(
    `SELECT p.id, p.image_url, p.images FROM products p
      WHERE COALESCE(p.is_active, 1) = 1
        AND json_valid(p.images)
        AND (LENGTH(COALESCE(p.image_url,'') || p.images) - LENGTH(REPLACE(COALESCE(p.image_url,'') || p.images, ?, ''))) >= ? * 2
        AND NOT EXISTS (SELECT 1 FROM product_supply_meta m WHERE m.product_id = p.id AND m.key = ?)
      ORDER BY p.id
      LIMIT ?`
  ).bind(MEDIA, MEDIA.length, GALLERY_ETAG_DEDUPE_KEY, Math.max(1, Math.min(20, perRun)))
    .all<{ id: number; image_url: string | null; images: string }>()
    .catch(() => ({ results: [] as { id: number; image_url: string | null; images: string }[] }))

  let fixed = 0
  for (const row of results || []) {
    let gallery: string[]
    try {
      const arr = JSON.parse(row.images)
      if (!Array.isArray(arr)) continue
      gallery = arr.filter((u): u is string => typeof u === 'string' && !!u)
    } catch { continue }

    const sigs = new Map<string, string | null>()
    let headFailed = false
    for (const u of [row.image_url, ...gallery]) {
      const key = mediaKeyOf(u)
      if (!key || sigs.has(key)) continue
      try {
        const obj = await bucket.head(key)
        sigs.set(key, obj ? `${obj.size}:${obj.etag}` : null)
      } catch { headFailed = true; sigs.set(key, null) }
    }
    if (headFailed) continue  // 일시 실패 — 표시를 남기지 않고 다음 라운드에 다시

    const next = dedupeGalleryBySig(row.image_url, gallery, (u) => {
      const k = mediaKeyOf(u)
      return k ? (sigs.get(k) ?? null) : null
    })
    if (next) {
      const res = await DB.prepare(`UPDATE products SET images = ?, updated_at = datetime('now') WHERE id = ? AND images = ?`)
        .bind(JSON.stringify(next), row.id, row.images).run().catch(() => null)
      if ((res?.meta?.changes || 0) > 0) fixed++
    }
    await setSupplyMeta(DB, row.id, { [GALLERY_ETAG_DEDUPE_KEY]: '1' }).catch(() => {})
  }
  return { scanned: (results || []).length, fixed }
}
