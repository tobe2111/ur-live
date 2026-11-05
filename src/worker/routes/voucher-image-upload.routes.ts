/**
 * 🎁 2026-11-05 대표 *"첫 로딩 관련해서 최적화를 최대한 … 교환권 페이지도 마찬가지야"* — 교환권 사진 이관을 **끝낸다**.
 *
 * ## 무엇이 멎어 있었나 (라이브 실측)
 * 교환권 사진 2,260장을 우리 R2 로 옮기는 cron(`voucher-image-rehost.ts`, 2026-10-31)이 5일 동안 **8장**만 옮겼다
 * (하트비트 `migrated=0 failed=4 remaining=2252` — 회차마다 전부 실패). 이유는 그 cron 이 생긴 이유와 같다:
 * giftishow 가 **Cloudflare 를 막는다** — 워커의 fetch 도 Cloudflare 이그레스라 같이 막힌다.
 * 그래서 교환권 탭의 사진 전부가 여전히 giftishow 원본(장당 20~86KB · 축소 없음 · 우리 캐시 없음)으로 간다.
 *
 * ## 어떻게
 * Cloudflare 가 아닌 곳(GitHub Actions 러너 — `voucher-image-rehost.yml`)이 사진을 받아 **바이트**를 여기로 넘긴다.
 * 저장 규칙은 cron 과 같다(`storeImageBytesToR2` — 내용 해시 키 · 크기 한도 · 재축소). 주소 교체도 같은 CAS
 * (`AND image_url = ?` — 그 사이 어드민이 바꿨으면 덮지 않는다).
 *
 * ## 🔒 누가 부를 수 있나
 * `X-Repair-Token`(= `REPAIR_SCHEMA_TOKEN`, 배포 파이프라인이 이미 쓰는 값) 하나뿐. 없으면 403(fail-closed).
 * 바꿀 수 있는 것도 좁다: **활성 교환권(deal_only=1)** 의 **giftishow 원본 주소**를, 넘긴 원래 주소와 **같을 때만**,
 * 이미지 바이트(JPEG·PNG·WEBP 서명 확인)로 저장한 **우리 주소**로. 돈·재고·가격과 무관하다.
 */
import { Hono } from 'hono'
import { storeImageBytesToR2 } from '../utils/rehost-image'
import { giftishowHostSql } from '../cron/voucher-image-rehost'
import { ensureSupplyMetaTable, setSupplyMeta } from '../utils/product-supply-meta'

type Env = { DB: D1Database; MEDIA_BUCKET?: R2Bucket; REPAIR_SCHEMA_TOKEN?: string }

export const voucherImageUploadRoutes = new Hono<{ Bindings: Env }>()

/** 한 번에 넘기는 사진 상한(바이트) — giftishow 원본은 20~86KB 다. 넉넉히 3MB. */
export const VOUCHER_UPLOAD_MAX_BYTES = 3 * 1024 * 1024

/** 길이가 같아도 시간이 새지 않게 비교한다. */
export function tokenOk(expected: string | undefined, got: string | undefined | null): boolean {
  if (!expected || !got || expected.length !== got.length) return false
  let d = 0
  for (let i = 0; i < expected.length; i++) d |= expected.charCodeAt(i) ^ got.charCodeAt(i)
  return d === 0
}

/** 바이트 앞머리로 이미지 종류를 판정한다(넘긴 쪽의 Content-Type 을 믿지 않는다). */
export function sniffImageType(b: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp'
  return null
}

const WHERE = `deal_only = 1 AND COALESCE(is_active, 1) = 1 AND ${giftishowHostSql('image_url')}`

/** 옮길 사진 목록 — 많이 팔린 것부터(cron 과 같은 순서). 기다림(retry_after)은 무시한다 — 막힌 건 cron 쪽 사정이다. */
voucherImageUploadRoutes.get('/api/_internal/voucher-image/candidates', async (c) => {
  if (!tokenOk(c.env.REPAIR_SCHEMA_TOKEN, c.req.header('X-Repair-Token'))) return c.json({ success: false, error: 'unauthorized' }, 403)
  const limit = Math.min(Math.max(1, Number(c.req.query('limit')) || 50), 300)
  const { results } = await c.env.DB.prepare(
    `SELECT id, image_url FROM products WHERE ${WHERE} ORDER BY COALESCE(sold_count, 0) DESC, id LIMIT ?`,
  ).bind(limit).all<{ id: number; image_url: string }>()
  const left = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM products WHERE ${WHERE}`).first<{ n: number }>().catch(() => null)
  return c.json({ success: true, remaining: left?.n ?? null, data: results || [] })
})

/** 사진 한 장 — 본문 = 이미지 바이트. `?id=&src=`(원래 주소 — CAS). */
voucherImageUploadRoutes.post('/api/_internal/voucher-image/upload', async (c) => {
  if (!tokenOk(c.env.REPAIR_SCHEMA_TOKEN, c.req.header('X-Repair-Token'))) return c.json({ success: false, error: 'unauthorized' }, 403)
  if (!c.env.MEDIA_BUCKET) return c.json({ success: false, error: 'NO_MEDIA_BUCKET' }, 503)
  const id = Number(c.req.query('id'))
  const src = c.req.query('src') || ''
  if (!Number.isInteger(id) || id <= 0 || !/^https:\/\//.test(src)) return c.json({ success: false, error: 'bad params' }, 400)

  const row = await c.env.DB.prepare(`SELECT id FROM products WHERE id = ? AND image_url = ? AND ${WHERE}`)
    .bind(id, src).first<{ id: number }>()
  if (!row) return c.json({ success: false, error: 'not a pending giftishow voucher image' }, 409)

  const buf = await c.req.arrayBuffer()
  if (buf.byteLength > VOUCHER_UPLOAD_MAX_BYTES) return c.json({ success: false, error: 'too large' }, 413)
  const ct = sniffImageType(new Uint8Array(buf, 0, Math.min(16, buf.byteLength)))
  if (!ct) return c.json({ success: false, error: 'not an image' }, 415)

  const hosted = await storeImageBytesToR2({ MEDIA_BUCKET: c.env.MEDIA_BUCKET }, buf, ct, 'voucher-image-runner', 'uploads/voucher')
  if (!hosted) return c.json({ success: false, error: 'store failed' }, 422)

  const up = await c.env.DB.prepare(`UPDATE products SET image_url = ?, updated_at = datetime('now') WHERE id = ? AND image_url = ?`)
    .bind(hosted, id, src).run()
  if ((up.meta?.changes ?? 0) === 0) return c.json({ success: false, error: 'changed meanwhile' }, 409)
  await ensureSupplyMetaTable(c.env.DB).catch(() => {})
  await setSupplyMeta(c.env.DB, id, { voucher_img_src: src, voucher_img_tries: '0' }).catch(() => {})
  return c.json({ success: true, url: hosted })
})
