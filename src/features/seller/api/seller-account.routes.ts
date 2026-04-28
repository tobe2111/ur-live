/**
 * 🛡️ 2026-04-28 TD-006 (split): Seller Account Management (4 endpoints)
 *
 * 원본: seller-management.routes.ts (310-474).
 *
 * - GET /personal-info               — 개인정보 조회
 * - PUT/PATCH /personal-info         — 개인정보 수정
 * - POST /change-password            — 비밀번호 변경
 * - POST /upload-image               — 프로필 이미지 업로드
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { verify } from 'hono/jwt'
import type { JWTPayload } from 'hono/utils/jwt/types'
import { ALLOWED_ORIGINS } from '@/shared/constants'
import { validateFileMagicBytes } from '@/lib/upload-security'
import { swallow } from '@/worker/utils/swallow'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
}

interface SellerJWTPayload extends Record<string, unknown> { seller_id?: number }
interface ImgbbResponse {
  success: boolean
  data?: { url: string; delete_url: string }
  error?: { message: string }
}

export const sellerAccountRoutes = new Hono<{ Bindings: Bindings }>()
sellerAccountRoutes.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }))

async function getSellerIdFromToken(authorization: string | undefined, jwtSecret: string): Promise<number | null> {
  if (!authorization || !authorization.startsWith('Bearer ')) return null
  try {
    const payload = await verify(authorization.substring(7), jwtSecret, 'HS256') as JWTPayload & { seller_id?: number }
    return payload.seller_id || null
  } catch { return null }
}

sellerAccountRoutes.get('/personal-info', async (c) => {
  return c.redirect('/api/seller/profile', 301);
});

/**
 * PUT /api/seller/personal-info
 * 셀러 개인 정보 수정 (profile 의 alias)
 */
sellerAccountRoutes.on(['PUT', 'PATCH'], '/personal-info', async (c) => {
  const db = c.env.DB;
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return c.json({ success: false, error: '인증이 필요합니다' }, 401);
  }
  try {
    const token = authorization.substring(7);
    const payload = await import('hono/jwt').then(m => m.verify(token, c.env.JWT_SECRET, 'HS256')) as SellerJWTPayload;
    const sellerId = payload.seller_id;
    if (!sellerId) return c.json({ success: false, error: '셀러 권한이 필요합니다' }, 403);
    const body = await c.req.json();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
    if (body.phone !== undefined) { fields.push('phone = ?'); values.push(body.phone); }
    if (body.email !== undefined) { fields.push('email = ?'); values.push(body.email); }
    if (fields.length === 0) return c.json({ success: false, error: '수정할 항목이 없습니다' }, 400);
    fields.push("updated_at = datetime('now')");
    values.push(sellerId);
    await db.prepare(`UPDATE sellers SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
    const updatedSeller = await db.prepare(`
      SELECT
        id, username, email, name, business_name, phone, address, description,
        bank_account, bank_name, account_holder, status, commission_rate,
        profile_image, bio, sns_instagram, sns_youtube, sns_facebook, sns_twitter,
        website_url, kakao_chat_url AS kakao_chat_link,
        created_at, updated_at
      FROM sellers WHERE id = ?
    `).bind(sellerId).first();
    return c.json({ success: true, data: updatedSeller });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

/**
 * POST /api/seller/change-password
 * 셀러 비밀번호 변경
 */
sellerAccountRoutes.post('/change-password', async (c) => {
  const db = c.env.DB;
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return c.json({ success: false, error: '인증이 필요합니다' }, 401);
  }
  try {
    const token = authorization.substring(7);
    const payload = await import('hono/jwt').then(m => m.verify(token, c.env.JWT_SECRET, 'HS256')) as SellerJWTPayload;
    const sellerId = payload.seller_id;
    if (!sellerId) return c.json({ success: false, error: '셀러 권한이 필요합니다' }, 403);
    const { currentPassword, newPassword } = await c.req.json<{ currentPassword: string; newPassword: string }>();
    if (!currentPassword || !newPassword) {
      return c.json({ success: false, error: '현재 비밀번호와 새 비밀번호가 필요합니다' }, 400);
    }
    // 🛡️ 2026-04-22: 이전 비밀번호 재사용 방어
    if (currentPassword === newPassword) {
      return c.json({ success: false, error: '새 비밀번호는 현재 비밀번호와 달라야 합니다' }, 400);
    }
    // 🛡️ 복잡도 검증 (user 와 동일 규칙)
    const { hashPassword: hp, verifyPassword, validatePasswordComplexity } = await import('../../../lib/password');
    const complexity = validatePasswordComplexity(newPassword);
    if (!complexity.ok) {
      return c.json({ success: false, error: complexity.error ?? '비밀번호 복잡도 부족' }, 400);
    }
    const seller = await db.prepare('SELECT password_hash FROM sellers WHERE id = ?').bind(sellerId).first<{ password_hash: string }>();
    if (!seller) return c.json({ success: false, error: '셀러를 찾을 수 없습니다' }, 404);
    const { valid } = await verifyPassword(currentPassword, seller.password_hash);
    if (!valid) return c.json({ success: false, error: '현재 비밀번호가 올바르지 않습니다' }, 400);
    const newHash = await hp(newPassword);
    await db.prepare("UPDATE sellers SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").bind(newHash, sellerId).run();
    // 🛡️ 비번 변경 시 기존 refresh token 전량 revoke
    await db.prepare("DELETE FROM auth_refresh_tokens WHERE user_type = 'seller' AND user_id = ?").bind(Number(sellerId)).run().catch(swallow('seller:api:seller-management'));
    return c.json({ success: true, message: '비밀번호가 변경되었습니다' });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

/**
 * POST /api/seller/upload-image
 * 셀러 이미지 업로드 (imgbb 사용)
 * Security: auth required, MIME whitelist, 5MB size limit, safe filename
 */
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

sellerAccountRoutes.post('/upload-image', cors(), async (c) => {
  // ── Auth required ──────────────────────────────────────────────────────────
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!sellerId) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  try {
    const formData = await c.req.formData();
    const file = formData.get('image') as File | null;
    if (!file) {
      return c.json({ success: false, error: '이미지 파일이 필요합니다' }, 400);
    }

    // ── Size limit ────────────────────────────────────────────────────────────
    if (file.size > MAX_UPLOAD_BYTES) {
      return c.json({ success: false, error: `파일 크기는 5MB 이하여야 합니다 (현재: ${(file.size / 1024 / 1024).toFixed(1)}MB)` }, 400);
    }

    // ── MIME type whitelist ───────────────────────────────────────────────────
    if (!ALLOWED_IMAGE_MIME.has(file.type)) {
      return c.json({ success: false, error: '허용되지 않는 파일 형식입니다. JPEG, PNG, WebP, GIF만 허용됩니다.' }, 400);
    }

    // ── Extension whitelist (double-check, MIME can be spoofed) ──────────────
    const ext = ('.' + file.name.split('.').pop()?.toLowerCase()) as string;
    if (!ALLOWED_IMAGE_EXT.has(ext)) {
      return c.json({ success: false, error: '허용되지 않는 파일 확장자입니다.' }, 400);
    }

    // ── Magic-byte validation (MIME + extension can both be spoofed) ─────────
    const buffer = await file.arrayBuffer();
    const magicCheck = await validateFileMagicBytes(buffer, file.type);
    if (!magicCheck.valid) {
      return c.json({ success: false, error: magicCheck.error || '파일 형식이 올바르지 않습니다' }, 400);
    }

    const imgbbKey = (c.env as unknown as Record<string, string | undefined>).IMGBB_API_KEY;
    if (!imgbbKey) {
      return c.json({ success: false, error: '이미지 업로드 서비스가 구성되지 않았습니다' }, 500);
    }

    // ── Safe filename (no path traversal) ─────────────────────────────────────
    const safeName = `seller_${sellerId}_${Date.now()}${ext}`;

    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const resp = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `image=${encodeURIComponent(base64)}&name=${encodeURIComponent(safeName)}`,
      // 🛡️ 2026-04-22: 30s timeout — 큰 이미지 업로드 + imgbb 응답 지연 대비
      signal: AbortSignal.timeout(30_000),
    });
    const json = await resp.json() as ImgbbResponse;
    if (!json.success) throw new Error(json.error?.message || 'imgbb upload failed');
    // 🛡️ 2026-04-22: delete_url 은 응답에 포함하지 않음.
    // 클라이언트가 받으면 악의적으로 이미지 삭제 가능. 서버 내부에만 저장.
    return c.json({ success: true, url: json.data!.url });
  } catch (err: unknown) {
    console.error('[Seller] Upload image error:', (err as Error).message);
    return c.json({ success: false, error: '이미지 업로드에 실패했습니다.' }, 500);
  }
});

/**
 * GET  /api/seller/settlements
 * POST /api/seller/settlements/request
 * GET  /api/seller/settlements/stats
 * 셀러 정산 관련 API
 */
