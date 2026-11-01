/**
 * 🖼️ 2026-11-01 크기별로 미리 저장한 사진 — 변환 한도 0 가드.
 *
 * 대표 *"가장 이상적인 방법은 뭐야?"* → *"응 잠금 해제해줄게 진행해줘"*. Cloudflare 변환은 그달에 쓰인 사진 × 크기로
 * 세서 사진이 늘수록 매달 사용량이 커진다. 올릴 때 브라우저가 세 크기로 줄여 R2 에 넣으면 변환이 영원히 0 이다.
 *
 * 고정하는 것:
 *   ① 주소 규칙 — 크기별 사진은 cdn-cgi 를 안 타고 R2 파일을 그대로(폭 고르기 · 데이터 절약 · 두 주소 모양)
 *   ② 업로드 — 큰 것부터 · 셋 다 성공해야 주소를 돌려준다 · 묶음 이름이 바뀌면 거부
 *   ③ 옮기기 SQL(진짜 SQLite) — 옮길 대상 · 주소 교체가 따옴표째라 다른 주소를 안 건드린다
 *   ④ 배선 — 두 업로드 화면이 먼저 시도 · 서버가 키를 만든다 · 크기별 경로는 리사이저를 안 부른다 · commit 이 셋 다 확인
 * ⚠️ 못 보는 것: 브라우저 캔버스 실제 출력(jsdom 엔 createImageBitmap 이 없다) · R2 에 실제로 올라가는지(라이브).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseSizedUrl, pickSizedWidth, sizedVariantUrl, sizedStoredUrl, SIZED_BATCH_RE } from '@/shared/sized-image'
import { cfImage, cfSrcSet } from '@/utils/cf-image'
import { uploadSizedImage, type SizedVariants } from '@/lib/image-sized'
import { legacyR2Key, PENDING_SQL, SWAP_IMAGE_URL_SQL, SWAP_IMAGES_SQL } from '../../features/upload/api/image-sizing-admin.routes'
import { readCode } from '../helpers/source-text'

const req = createRequire(import.meta.url)
const { DatabaseSync } = req('node:sqlite') as typeof import('node:sqlite')

const REL = '/api/media/uploads/sized/seller/26/2026-11/abcdEFGH12345678/w1280.webp'
const ABS = 'https://media.ur-team.com/uploads/sized/migrated/0123456789abcdef01234567/w1280.jpg'

describe('① 주소 규칙', () => {
  it('두 주소 모양을 읽는다 · 아닌 것은 null', () => {
    expect(parseSizedUrl(REL)).toEqual({ base: 'uploads/sized/seller/26/2026-11/abcdEFGH12345678/', ext: 'webp' })
    expect(parseSizedUrl(ABS)?.ext).toBe('jpg')
    expect(parseSizedUrl('/api/media/uploads/seller/26/2026-11/a.webp')).toBeNull()
    expect(parseSizedUrl('/api/media/uploads/sized/x/w999.webp')).toBeNull()
    expect(parseSizedUrl('https://evil.com/uploads/sized/x/w1280.webp')).toBeNull()
    expect(parseSizedUrl('/api/media/uploads/sized/../w1280.webp')).toBeNull()
  })
  it('요청 폭 이상인 가장 작은 크기 · 데이터 절약이면 한 칸 아래', () => {
    expect(pickSizedWidth(200)).toBe(320)
    expect(pickSizedWidth(400)).toBe(640)
    expect(pickSizedWidth(960)).toBe(1280)
    expect(pickSizedWidth(2000)).toBe(1280)
    expect(pickSizedWidth(400, true)).toBe(320)
    expect(pickSizedWidth(200, true)).toBe(320)
  })
  it('cfImage 는 변환하지 않고 R2 파일을 그대로 낸다(높이·크롭을 줘도)', () => {
    const u = cfImage(REL, { width: 400 })
    expect(u).toBe('https://media.ur-team.com/uploads/sized/seller/26/2026-11/abcdEFGH12345678/w640.webp')
    expect(u).not.toContain('/cdn-cgi/')
    expect(cfImage(REL, { width: 900, height: 600, fit: 'cover', gravity: 'auto' })).toMatch(/w1280\.webp$/)
    expect(cfImage(ABS, { width: 200 })).toMatch(/\/w320\.jpg$/)
  })
  it('srcset 도 변환 없이 · 같은 파일은 한 번만', () => {
    const s = cfSrcSet(REL, 200)
    expect(s).toBe('https://media.ur-team.com/uploads/sized/seller/26/2026-11/abcdEFGH12345678/w320.webp 1x, https://media.ur-team.com/uploads/sized/seller/26/2026-11/abcdEFGH12345678/w640.webp 2x')
    expect(cfSrcSet(REL, 900, 3)).not.toContain('/cdn-cgi/')
    expect(cfSrcSet(REL, 900, 3).split(', ').length).toBe(1)
  })
  it('옛 업로드 사진은 종전대로 리사이저', () => {
    expect(cfImage('/api/media/uploads/seller/26/2026-11/a.webp', { width: 400 })).toContain('/cdn-cgi/image/')
  })
  it('저장 주소는 가장 큰 크기', () => {
    const ref = parseSizedUrl(REL)!
    expect(sizedStoredUrl(ref)).toBe(REL)
    expect(sizedVariantUrl(ref, 320)).toMatch(/w320\.webp$/)
    expect(SIZED_BATCH_RE.test('2026-11/abcdEFGH12345678')).toBe(true)
    expect(SIZED_BATCH_RE.test('../../x/abcdEFGH12345678')).toBe(false)
  })
})

describe('② 업로드', () => {
  const blob = (n: number) => new Blob([new Uint8Array(n)], { type: 'image/webp' })
  const make = async (): Promise<SizedVariants> => ({ ext: 'webp', files: new Map([[320, blob(200)], [640, blob(300)], [1280, blob(400)]]) })
  it('큰 것부터 올리고 두 번째부터 같은 묶음을 보낸다', async () => {
    const seen: Array<{ w: string; batch: string | null }> = []
    const url = await uploadSizedImage(blob(10), async (fd) => {
      seen.push({ w: String(fd.get('width')), batch: fd.get('batch') as string | null })
      return { success: true, data: { batch: '2026-11/abcdEFGH12345678', url: REL } }
    }, make)
    expect(url).toBe(REL)
    expect(seen.map((s) => s.w)).toEqual(['1280', '640', '320'])
    expect(seen[0].batch).toBeNull()
    expect(seen[1].batch).toBe('2026-11/abcdEFGH12345678')
  })
  it('하나라도 실패하면 주소를 안 준다(작은 크기가 빠진 주소가 저장되지 않게)', async () => {
    let n = 0
    const url = await uploadSizedImage(blob(10), async () => (++n === 3 ? null : { success: true, data: { batch: '2026-11/abcdEFGH12345678', url: REL } }), make)
    expect(url).toBeNull()
  })
  it('묶음 이름이 바뀌면 거부', async () => {
    let n = 0
    const url = await uploadSizedImage(blob(10), async () => ({ success: true, data: { batch: ++n === 1 ? '2026-11/abcdEFGH12345678' : '2026-11/zzzzzzzzzzzzzzzz', url: REL } }), make)
    expect(url).toBeNull()
  })
  it('줄이기 실패면 null(호출부는 종전 업로드로)', async () => {
    expect(await uploadSizedImage(blob(10), async () => ({ success: true }), async () => null)).toBeNull()
  })
})

describe('③ 옮기기 (진짜 SQLite)', () => {
  it('옛 주소 판정', () => {
    expect(legacyR2Key('/api/media/uploads/demo/h/a.jpg')).toBe('uploads/demo/h/a.jpg')
    expect(legacyR2Key('https://media.ur-team.com/uploads/seller/1/a.jpg')).toBe('uploads/seller/1/a.jpg')
    expect(legacyR2Key(REL)).toBeNull()
    expect(legacyR2Key('/api/media/uploads/voucher/h/a.jpg')).toBeNull()
    expect(legacyR2Key('/api/media/uploads/x/a.GIF')).toBeNull()
    expect(legacyR2Key('/api/media/uploads/../secret')).toBeNull()
    expect(legacyR2Key('https://evil.com/uploads/a.jpg')).toBeNull()
  })
  function db() {
    const d = new DatabaseSync(':memory:')
    d.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY, is_active INTEGER, deal_only INTEGER, image_url TEXT, images TEXT, updated_at TEXT)`)
    const ins = d.prepare('INSERT INTO products (id, is_active, deal_only, image_url, images) VALUES (?,?,?,?,?)')
    ins.run(1, 1, 0, '/api/media/uploads/demo/h/a.jpg', JSON.stringify(['/api/media/uploads/demo/h/a.jpg', '/api/media/uploads/demo/h/ab.jpg']))
    ins.run(2, 1, 0, 'https://media.ur-team.com/uploads/demo/h/a.jpg', 'not json')
    ins.run(3, 0, 0, '/api/media/uploads/demo/h/off.jpg', null)
    ins.run(4, 1, 1, '/api/media/uploads/voucher/h/v.jpg', null)
    ins.run(5, 1, 0, REL, null)
    ins.run(6, 1, 0, 'https://cdn.example.com/x.jpg', '[]')
    return d
  }
  it('대상 — 활성·교환권 아님·옛 R2 주소만(깨진 JSON 에도 안 터진다)', () => {
    const rows = db().prepare(PENDING_SQL).all() as Array<{ v: string }>
    expect(rows.map((r) => r.v).sort()).toEqual([
      '/api/media/uploads/demo/h/a.jpg', '/api/media/uploads/demo/h/ab.jpg', 'https://media.ur-team.com/uploads/demo/h/a.jpg',
    ])
  })
  it('교체 — 두 모양 모두 · 비슷한 다른 주소(ab.jpg)는 그대로', () => {
    const d = db()
    const rel = '/api/media/uploads/demo/h/a.jpg', abs = 'https://media.ur-team.com/uploads/demo/h/a.jpg'
    d.prepare(SWAP_IMAGE_URL_SQL).run(REL, rel, abs)
    d.prepare(SWAP_IMAGES_SQL).run(`"${rel}"`, `"${REL}"`, `"${abs}"`, `"${REL}"`, `"${rel}"`, `"${abs}"`)
    const p1 = d.prepare('SELECT image_url, images FROM products WHERE id = 1').get() as { image_url: string; images: string }
    expect(p1.image_url).toBe(REL)
    expect(JSON.parse(p1.images)).toEqual([REL, '/api/media/uploads/demo/h/ab.jpg'])
    expect((d.prepare('SELECT image_url FROM products WHERE id = 2').get() as { image_url: string }).image_url).toBe(REL)
  })
})

describe('④ 배선', () => {
  const up = readCode('src/components/upload/ImageUpload.tsx')
  const gal = readCode('src/components/seller/PhotoGalleryEditor.tsx')
  const route = readCode('src/features/upload/api/upload.routes.ts')
  const admin = readCode('src/features/upload/api/image-sizing-admin.routes.ts')
  it('두 업로드 화면이 크기별 업로드를 먼저 시도한다', () => {
    for (const s of [up, gal]) {
      expect(s.indexOf('uploadSizedImage(')).toBeGreaterThan(0)
      expect(s.indexOf('uploadSizedImage(')).toBeLessThan(s.indexOf("'/api/upload/image'"))
    }
  })
  it('크기별 업로드 경로는 서버가 키를 만들고 리사이저를 안 부른다', () => {
    const h = route.slice(route.indexOf("'/upload/image-sized'"), route.indexOf('imageSizingAdminRoutes)'))
    expect(h.length).toBeGreaterThan(500)
    expect(h).toMatch(/\$\{SIZED_KEY_PREFIX\}\$\{auth\.role\}\/\$\{auth\.id\}\/\$\{batch\}\//)
    expect(h).not.toMatch(/resizeStoredImageInPlace|cdn-cgi/)
    expect(h).toMatch(/if \(batchIn && !SIZED_BATCH_RE\.test\(batchIn\)\) return c\.json\(/)
  })
  it('어드민 도구 세 경로 전부 requireAdmin · commit 은 셋 다 확인한 뒤 교체', () => {
    expect(admin.match(/requireAdmin\(\)/g)?.length).toBe(3)
    const c = admin.slice(admin.indexOf("'/admin/image-sizing/commit'"))
    expect(c.indexOf('MEDIA_BUCKET.head(')).toBeGreaterThan(0)
    expect(c.indexOf('MEDIA_BUCKET.head(')).toBeLessThan(c.indexOf('SWAP_IMAGE_URL_SQL'))
    expect(c.search(/if \(!head\) return c\.json\(/)).toBeGreaterThan(0)
    expect(c.search(/if \(!head\) return c\.json\(/)).toBeLessThan(c.indexOf('SWAP_IMAGE_URL_SQL'))
    expect(admin).not.toMatch(/MEDIA_BUCKET\.delete|DELETE FROM/)
    // 갤러리는 따옴표째 바꾼다(③ 이 SQL 로 확인한 그 형태를 라우트가 실제로 넘기는가).
    expect(admin).toContain('.bind(`"${rel}"`, `"${next}"`, `"${abs}"`, `"${next}"`, `"${rel}"`, `"${abs}"`)')
  })
})
