/**
 * 🛡️ 2026-05-18: 이미지 업로드 (R2) — 셀러 + 어드민 + 사용자 공용.
 *
 *   - POST /api/upload/image          — multipart/form-data, 단일 이미지
 *   - GET  /api/upload/presigned-url  — 큰 파일용 presigned (옵션, 사용 안 함)
 *   - DELETE /api/upload/image/:key   — 본인 업로드 파일 삭제
 *
 *   저장 키 패턴:
 *     uploads/{role}/{user_id}/{yyyy-mm}/{nanoid}.{ext}
 *     예: uploads/seller/42/2026-05/abc123.jpg
 *
 *   R2 binding: MEDIA_BUCKET (wrangler.toml 에서 설정 필요)
 *   공개 URL: R2 custom domain 또는 PUBLIC_R2_URL env 사용.
 *
 *   검증:
 *     - 인증 필수 (Bearer token — seller/admin/user 모두 가능)
 *     - 파일 타입 화이트리스트 (image/jpeg, image/png, image/webp, image/gif)
 *     - 크기 제한 10MB
 *     - 매직 바이트 검증 (확장자 위변조 차단)
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { safeError } from '../../../worker/utils/safe-error'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  MEDIA_BUCKET?: R2Bucket
  PUBLIC_R2_URL?: string  // 'https://media.ur-team.com' 또는 r2.dev URL
}

export const uploadRoutes = new Hono<{ Bindings: Bindings }>()

const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'])
const MAX_SIZE = 10 * 1024 * 1024  // 10MB

// 매직 바이트 (확장자 위변조 차단).
const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],   // RIFF
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],    // GIF8
}

function detectMime(bytes: Uint8Array): string | null {
  for (const [mime, sigs] of Object.entries(MAGIC_BYTES)) {
    for (const sig of sigs) {
      if (sig.every((b, i) => bytes[i] === b)) return mime
    }
  }
  return null
}

function randomKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let s = ''
  for (let i = 0; i < 16; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

async function getRoleAndId(c: { env: Bindings; req: { header: (k: string) => string | undefined } }): Promise<{ role: string; id: number } | null> {
  const auth = c.req.header('Authorization') || ''
  if (!auth.startsWith('Bearer ')) return null
  try {
    const { verify } = await import('hono/jwt')
    const p = await verify(auth.substring(7), c.env.JWT_SECRET, 'HS256') as Record<string, unknown>
    if (p.seller_id) return { role: 'seller', id: Number(p.seller_id) }
    if (p.admin_id) return { role: 'admin', id: Number(p.admin_id) }
    if (p.agency_id) return { role: 'agency', id: Number(p.agency_id) }
    if (p.user_id || p.sub) return { role: 'user', id: Number(p.user_id || p.sub) }
    return null
  } catch { return null }
}

uploadRoutes.post('/upload/image', cors(), async (c) => {
  try {
    const auth = await getRoleAndId(c)
    if (!auth) return c.json({ success: false, error: '인증 필요' }, 401)

    if (!c.env.MEDIA_BUCKET) {
      return c.json({
        success: false,
        error: 'R2 binding 미설정 (MEDIA_BUCKET) — wrangler.toml + Dashboard 확인 필요',
        code: 'R2_NOT_CONFIGURED',
      }, 503)
    }

    const formData = await c.req.formData().catch(() => null)
    if (!formData) return c.json({ success: false, error: 'multipart/form-data 필요' }, 400)

    const file = formData.get('file')
    if (!(file instanceof File)) return c.json({ success: false, error: 'file field 필요' }, 400)

    // 1. 크기 체크.
    if (file.size > MAX_SIZE) {
      return c.json({ success: false, error: `파일이 너무 큽니다 (최대 ${MAX_SIZE / 1024 / 1024}MB)` }, 413)
    }
    if (file.size < 100) {
      return c.json({ success: false, error: '파일이 너무 작습니다 (최소 100 bytes)' }, 400)
    }

    // 2. MIME 화이트리스트.
    if (!ALLOWED_MIME.has(file.type)) {
      return c.json({ success: false, error: `허용 파일 타입: ${[...ALLOWED_MIME].join(', ')}` }, 415)
    }

    // 3. 매직 바이트 검증.
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    const detected = detectMime(bytes)
    if (!detected) {
      return c.json({ success: false, error: '이미지 파일 형식이 올바르지 않습니다 (위변조 의심)' }, 400)
    }

    // 4. 키 생성 + 업로드.
    const ext = detected === 'image/jpeg' ? 'jpg'
              : detected === 'image/png' ? 'png'
              : detected === 'image/webp' ? 'webp'
              : detected === 'image/gif' ? 'gif'
              : 'bin'
    const yyyymm = new Date().toISOString().slice(0, 7)
    const key = `uploads/${auth.role}/${auth.id}/${yyyymm}/${randomKey()}.${ext}`

    await c.env.MEDIA_BUCKET.put(key, buffer, {
      httpMetadata: { contentType: detected },
      customMetadata: { uploader: `${auth.role}:${auth.id}`, uploaded_at: new Date().toISOString() },
    })

    // 5. 공개 URL.
    const publicBase = c.env.PUBLIC_R2_URL || ''
    const url = publicBase ? `${publicBase.replace(/\/$/, '')}/${key}` : `r2://${key}`

    return c.json({
      success: true,
      data: {
        key,
        url,
        size: file.size,
        mime: detected,
      },
    })
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[upload]')
  }
})

// 본인 업로드 파일 삭제 (key 가 본인 prefix 와 일치할 때만).
uploadRoutes.delete('/upload/image/:key{.+}', cors(), async (c) => {
  try {
    const auth = await getRoleAndId(c)
    if (!auth) return c.json({ success: false, error: '인증 필요' }, 401)
    if (!c.env.MEDIA_BUCKET) return c.json({ success: false, error: 'R2 binding 미설정' }, 503)

    const key = c.req.param('key')
    // 본인 prefix 검증 (admin 은 모두 삭제 가능).
    const ownPrefix = `uploads/${auth.role}/${auth.id}/`
    if (auth.role !== 'admin' && !key.startsWith(ownPrefix)) {
      return c.json({ success: false, error: '본인 업로드만 삭제 가능' }, 403)
    }
    await c.env.MEDIA_BUCKET.delete(key)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[upload]')
  }
})
