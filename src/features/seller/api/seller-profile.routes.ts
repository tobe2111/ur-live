/**
 * Seller Profile Routes
 *
 * - GET        /profile       — 셀러 프로필 조회
 * - PUT/PATCH  /profile       — 셀러 프로필 수정
 * - GET        /personal-info — 셀러 개인 정보 조회 (alias → /profile 301)
 * - PUT/PATCH  /personal-info — 셀러 개인 정보 수정
 * - POST       /change-password
 * - POST       /upload-image
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verify } from 'hono/jwt';
import { hashPassword, verifyPassword, validatePasswordComplexity } from '@/lib/password';
import { validateFileMagicBytes } from '@/lib/upload-security';
import { isPinVerified } from './seller-pin.routes';
import {
  type Bindings,
  type SellerProfileUpdate,
  type SellerJWTPayload,
  type ImgbbResponse,
  getSellerIdFromToken,
} from './seller-management-helpers';
import { logError } from '@/worker/utils/logger';

export const sellerProfileRoutes = new Hono<{ Bindings: Bindings }>();

// ── input length limits ───────────────────────────────────────────────────────
const MAX_BIO_LEN = 1000;
const MAX_NAME_LEN = 100;
const MAX_DESCRIPTION_LEN = 2000;
const MAX_URL_LEN = 500;

// ── constants for upload-image ────────────────────────────────────────────────
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * GET /api/seller/profile
 * 셀러 프로필 조회
 */
sellerProfileRoutes.get('/profile', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) {
      return c.json({
        success: false,
        error: '로그인이 필요합니다'
      }, 401);
    }

    const db = c.env.DB;
    const seller = await db.prepare(`
      SELECT
        id, username, email, name, business_name, phone, address, description,
        bank_account, bank_name, account_holder, status, commission_rate,
        profile_image, bio, sns_instagram, sns_youtube, sns_facebook, sns_twitter,
        website_url, kakao_chat_url AS kakao_chat_link,
        created_at, updated_at
      FROM sellers
      WHERE id = ?
    `).bind(sellerId).first();

    if (!seller) {
      return c.json({
        success: false,
        error: 'Seller not found'
      }, 404);
    }

    return c.json({
      success: true,
      data: seller
    });

  } catch (error: unknown) {
    logError('seller.profile.getError', { error: (error as Error)?.message });
    return c.json({
      success: false,
      error: (error as Error).message || 'Failed to get seller profile'
    }, 500);
  }
});

/**
 * PUT /api/seller/profile
 * 셀러 프로필 수정
 */
sellerProfileRoutes.on(['PUT', 'PATCH'], '/profile', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json<SellerProfileUpdate & Record<string, unknown>>();
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    // ── Input length validation ───────────────────────────────────────────────
    if (typeof body.bio === 'string' && body.bio.length > MAX_BIO_LEN) {
      return c.json({ success: false, error: `소개(bio)는 ${MAX_BIO_LEN}자 이내로 입력해주세요.` }, 400);
    }
    if (typeof body.name === 'string' && body.name.length > MAX_NAME_LEN) {
      return c.json({ success: false, error: `이름은 ${MAX_NAME_LEN}자 이내로 입력해주세요.` }, 400);
    }
    if (typeof body.description === 'string' && body.description.length > MAX_DESCRIPTION_LEN) {
      return c.json({ success: false, error: `설명(description)은 ${MAX_DESCRIPTION_LEN}자 이내로 입력해주세요.` }, 400);
    }
    const urlFields = ['website_url', 'kakao_chat_link', 'sns_instagram', 'sns_youtube', 'sns_facebook', 'sns_twitter'] as const;
    for (const field of urlFields) {
      if (typeof body[field] === 'string' && (body[field] as string).length > MAX_URL_LEN) {
        return c.json({ success: false, error: `${field}은(는) ${MAX_URL_LEN}자 이내로 입력해주세요.` }, 400);
      }
    }

    const fieldMap: Record<string, string> = {
      name: 'name', business_name: 'business_name', phone: 'phone',
      address: 'address', description: 'description',
      bank_account: 'bank_account', bank_name: 'bank_name', account_holder: 'account_holder',
      profile_image: 'profile_image', bio: 'bio',
      sns_instagram: 'sns_instagram', sns_youtube: 'sns_youtube',
      sns_facebook: 'sns_facebook', sns_twitter: 'sns_twitter',
      website_url: 'website_url', kakao_chat_link: 'kakao_chat_url'
    };

    // 🛡️ 2026-04-22: 정산 계좌 변경 시 is_verified=0 강제 → 어드민 재인증 전까지 출금 차단.
    // 이전: 셀러가 이메일/UI 만 뚫리면 은행 계좌 변경 후 정산 받아감.
    const bankChangeKeys = ['bank_account', 'bank_name', 'account_holder'] as const;
    const bankChanged = bankChangeKeys.some(k => body[k] !== undefined);

    // 🛡️ 계좌 변경은 민감 액션 — 최근 15분 내 PIN 인증 필수
    if (bankChanged) {
      const pinOk = await isPinVerified(c.req.header('Cookie'), sellerId, c.env.JWT_SECRET);
      if (!pinOk) {
        return c.json({ success: false, error: '계좌 변경은 PIN 인증이 필요합니다', code: 'PIN_REQUIRED' }, 412);
      }
    }

    for (const [bodyKey, dbCol] of Object.entries(fieldMap)) {
      if (body[bodyKey] !== undefined) {
        updates.push(`${dbCol} = ?`);
        values.push(body[bodyKey] as string | number | null);
      }
    }

    if (bankChanged) {
      updates.push('is_verified = 0');
      // 감사 로그 (실패해도 업데이트는 진행)
      try {
        await c.env.DB.prepare(
          `INSERT INTO admin_audit_logs (admin_id, admin_email, action, target_type, target_id, after_value)
           VALUES (?, ?, 'seller_bank_change', 'seller', ?, ?)`
        ).bind(String(sellerId), 'system', String(sellerId), JSON.stringify({
          reason: 'seller-self-bank-change',
          bank_name: body.bank_name ?? null,
          account_holder: body.account_holder ?? null,
        })).run();
      } catch {}
    }

    if (updates.length === 0) {
      return c.json({ success: false, error: 'No fields to update' }, 400);
    }

    updates.push("updated_at = datetime('now')");
    values.push(sellerId);

    const db = c.env.DB;
    await db.prepare(`UPDATE sellers SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

    const updatedSeller = await db.prepare(`
      SELECT
        id, username, email, name, business_name, phone, address, description,
        bank_account, bank_name, account_holder, status, commission_rate,
        profile_image, bio, sns_instagram, sns_youtube, sns_facebook, sns_twitter,
        website_url, kakao_chat_url AS kakao_chat_link,
        created_at, updated_at
      FROM sellers WHERE id = ?
    `).bind(sellerId).first();

    // 캐시 무효화 - SESSION_KV 의 seller public 캐시 키들 삭제
    const kv = (c.env as { SESSION_KV?: KVNamespace }).SESSION_KV;
    if (kv) {
      // KV 는 prefix 기반 list/delete 가능 (limit 1000 keys)
      c.executionCtx.waitUntil((async () => {
        try {
          const keys = await kv.list({ prefix: 'cache:seller:public:' });
          await Promise.all(keys.keys.map(k => kv.delete(k.name)));
        } catch {
          // 무효화 실패 시 60s TTL 로 자동 만료
        }
      })());
    }

    return c.json({ success: true, data: updatedSeller });

  } catch (error: unknown) {
    logError('seller.profile.updateError', { error: (error as Error)?.message });
    return c.json({ success: false, error: (error as Error).message || 'Failed to update seller profile' }, 500);
  }
});

/**
 * GET /api/seller/personal-info
 * 셀러 개인 정보 조회 (profile 의 alias)
 */
sellerProfileRoutes.get('/personal-info', async (c) => {
  return c.redirect('/api/seller/profile', 301);
});

/**
 * PUT /api/seller/personal-info
 * 셀러 개인 정보 수정 (profile 의 alias)
 */
sellerProfileRoutes.on(['PUT', 'PATCH'], '/personal-info', async (c) => {
  const db = c.env.DB;
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return c.json({ success: false, error: '인증이 필요합니다' }, 401);
  }
  try {
    const token = authorization.substring(7);
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as SellerJWTPayload;
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
sellerProfileRoutes.post('/change-password', async (c) => {
  const db = c.env.DB;
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return c.json({ success: false, error: '인증이 필요합니다' }, 401);
  }
  try {
    const token = authorization.substring(7);
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as SellerJWTPayload;
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
    const complexity = validatePasswordComplexity(newPassword);
    if (!complexity.ok) {
      return c.json({ success: false, error: complexity.error ?? '비밀번호 복잡도 부족' }, 400);
    }
    const seller = await db.prepare('SELECT password_hash FROM sellers WHERE id = ?').bind(sellerId).first<{ password_hash: string }>();
    if (!seller) return c.json({ success: false, error: '셀러를 찾을 수 없습니다' }, 404);
    const { valid } = await verifyPassword(currentPassword, seller.password_hash);
    if (!valid) return c.json({ success: false, error: '현재 비밀번호가 올바르지 않습니다' }, 400);
    const newHash = await hashPassword(newPassword);
    await db.prepare("UPDATE sellers SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").bind(newHash, sellerId).run();
    // 🛡️ 비번 변경 시 기존 refresh token 전량 revoke
    await db.prepare("DELETE FROM auth_refresh_tokens WHERE user_type = 'seller' AND user_id = ?").bind(Number(sellerId)).run().catch(() => {});
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
sellerProfileRoutes.post('/upload-image', cors(), async (c) => {
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
    logError('seller.profile.uploadImageError', { error: (err as Error)?.message });
    return c.json({ success: false, error: '이미지 업로드에 실패했습니다.' }, 500);
  }
});
