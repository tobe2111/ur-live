/**
 * 🖼️ 2026-11-01 이미 올라간 상품 사진을 크기별로 옮기는 어드민 도구 — `/api/admin/image-sizing/*`
 *   (대표 *"응 잠금 해제해줄게 진행해줘"*). 주소 규칙은 `shared/sized-image.ts`.
 *
 * 왜 어드민 브라우저가 줄이나: 워커 안에서 사진을 줄일 수단이 없다(cdn-cgi 는 변환 한도를 쓰고, 워커 프록시는
 *   리사이즈를 못 한다 — 2026-06-11 실측). 브라우저는 R2 원본을 같은 출처(`/api/media/*`)로 받아 캔버스에서
 *   줄이므로 **변환 0** 이다.
 *
 * 흐름(어드민 화면이 사진마다 반복): pending 으로 옛 주소를 받는다 → 브라우저가 세 크기를 만든다 →
 *   store 로 한 크기씩 올린다 → commit 이 R2 에 셋 다 있는지 확인한 **뒤에만** 상품 주소를 바꾼다.
 *   옛 파일은 지우지 않는다(비파괴 — 다른 표가 그 주소를 쓰고 있을 수 있다).
 */
import { Hono } from 'hono'
import { requireAdmin } from '../../../worker/middleware/auth'
import { safeError } from '../../../worker/utils/safe-error'
import { intParam } from '../../../shared/pagination'
import {
  SIZED_KEY_PREFIX, SIZED_WIDTHS, isSizedWidth, sizedKey, sizedStoredUrl, type SizedExt, type SizedRef,
} from '../../../shared/sized-image'

type Bindings = { DB: D1Database; MEDIA_BUCKET?: R2Bucket }

const ABS = 'https://media.ur-team.com/'
const REL = '/api/media/'

/** 옛 주소 → R2 키. 옮길 수 없는 주소(남의 호스트·이미 옮김·교환권·GIF)는 null. */
export function legacyR2Key(url: string): string | null {
  const key = url.startsWith(REL) ? url.slice(REL.length) : url.startsWith(ABS) ? url.slice(ABS.length) : ''
  if (!key.startsWith('uploads/') || key.includes('..') || key.includes('?')) return null
  if (key.startsWith(SIZED_KEY_PREFIX) || key.startsWith('uploads/voucher/')) return null
  if (/\.gif$/i.test(key)) return null
  return key
}

async function migratedRef(oldKey: string, ext: SizedExt): Promise<SizedRef> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(oldKey)))
  const h = [...d.slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return { base: `${SIZED_KEY_PREFIX}migrated/${h}/`, ext }
}

/** 옮길 대상 — 활성 상품(교환권 제외)의 대표 사진·갤러리 중 R2 옛 주소. */
export const PENDING_SQL = `SELECT v FROM (
    SELECT image_url AS v FROM products WHERE COALESCE(is_active, 1) = 1 AND COALESCE(deal_only, 0) = 0
    UNION
    SELECT j.value AS v FROM products p, json_each(CASE WHEN json_valid(p.images) THEN p.images ELSE '[]' END) j
     WHERE COALESCE(p.is_active, 1) = 1 AND COALESCE(p.deal_only, 0) = 0
  ) AS cand
   WHERE (v LIKE '/api/media/uploads/%' OR v LIKE 'https://media.ur-team.com/uploads/%')
     AND v NOT LIKE '%/uploads/sized/%' AND v NOT LIKE '%/uploads/voucher/%' AND lower(v) NOT LIKE '%.gif'
   ORDER BY v`

/** 주소 교체 — 대표 사진(두 모양)과 갤러리 JSON 안의 같은 문자열(따옴표째 — 다른 주소의 일부를 건드리지 않는다). */
export const SWAP_IMAGE_URL_SQL = `UPDATE products SET image_url = ?, updated_at = datetime('now') WHERE image_url IN (?, ?)`
export const SWAP_IMAGES_SQL = `UPDATE products SET images = REPLACE(REPLACE(images, ?, ?), ?, ?), updated_at = datetime('now')
   WHERE instr(images, ?) > 0 OR instr(images, ?) > 0`

export const imageSizingAdminRoutes = new Hono<{ Bindings: Bindings }>()

imageSizingAdminRoutes.get('/admin/image-sizing/pending', requireAdmin(), async (c) => {
  try {
    const limit = Math.min(50, Math.max(1, intParam(c.req.query('limit'), 10)))
    const { results } = await c.env.DB.prepare(PENDING_SQL).all<{ v: string }>()
    const keys = new Map<string, string>()
    for (const r of results || []) {
      const k = legacyR2Key(r.v)
      if (k && !keys.has(k)) keys.set(k, `${REL}${k}`)
    }
    return c.json({ success: true, data: { urls: [...keys.values()].slice(0, limit), remaining: keys.size } })
  } catch (err) {
    return safeError(c, err, '목록을 불러오지 못했습니다', '[image-sizing]')
  }
})

imageSizingAdminRoutes.post('/admin/image-sizing/store', requireAdmin(), async (c) => {
  try {
    if (!c.env.MEDIA_BUCKET) return c.json({ success: false, error: 'R2 binding 미설정' }, 503)
    const form = await c.req.formData().catch(() => null)
    const file = form?.get('file')
    const width = Number(form?.get('width'))
    const oldKey = legacyR2Key(String(form?.get('old') || ''))
    if (!(file instanceof File) || !isSizedWidth(width) || !oldKey) return c.json({ success: false, error: '입력이 올바르지 않습니다' }, 400)
    const ct = file.type === 'image/jpeg' ? 'image/jpeg' : file.type === 'image/webp' ? 'image/webp' : ''
    if (!ct || file.size < 100) return c.json({ success: false, error: 'webp/jpeg 만 허용' }, 415)
    const ref = await migratedRef(oldKey, ct === 'image/webp' ? 'webp' : 'jpg')
    await c.env.MEDIA_BUCKET.put(sizedKey(ref, width), await file.arrayBuffer(), {
      httpMetadata: { contentType: ct, cacheControl: 'public, max-age=31536000, immutable' },
      customMetadata: { migrated_from: oldKey, at: new Date().toISOString() },
    })
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '저장하지 못했습니다', '[image-sizing]')
  }
})

imageSizingAdminRoutes.post('/admin/image-sizing/commit', requireAdmin(), async (c) => {
  try {
    if (!c.env.MEDIA_BUCKET) return c.json({ success: false, error: 'R2 binding 미설정' }, 503)
    const body = await c.req.json<{ old?: string; ext?: string }>().catch(() => ({} as { old?: string; ext?: string }))
    const oldKey = legacyR2Key(String(body.old || ''))
    const ext: SizedExt | null = body.ext === 'webp' || body.ext === 'jpg' ? body.ext : null
    if (!oldKey || !ext) return c.json({ success: false, error: '입력이 올바르지 않습니다' }, 400)
    const ref = await migratedRef(oldKey, ext)
    // 셋 다 있어야 주소를 바꾼다 — 하나라도 없으면 그 크기를 고르는 화면에서 사진이 깨진다.
    for (const w of SIZED_WIDTHS) {
      const head = await c.env.MEDIA_BUCKET.head(sizedKey(ref, w))
      if (!head) return c.json({ success: false, error: `w${w} 이 저장되지 않았습니다` }, 409)
    }
    const next = sizedStoredUrl(ref)
    const rel = `${REL}${oldKey}`, abs = `${ABS}${oldKey}`
    const a = await c.env.DB.prepare(SWAP_IMAGE_URL_SQL).bind(next, rel, abs).run()
    const b = await c.env.DB.prepare(SWAP_IMAGES_SQL)
      .bind(`"${rel}"`, `"${next}"`, `"${abs}"`, `"${next}"`, `"${rel}"`, `"${abs}"`).run()
    return c.json({ success: true, data: { url: next, cover: a.meta?.changes ?? 0, gallery: b.meta?.changes ?? 0 } })
  } catch (err) {
    return safeError(c, err, '주소를 바꾸지 못했습니다', '[image-sizing]')
  }
})
