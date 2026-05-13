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
import { getSellerIdFromToken, type SellerJWTPayload } from '@/lib/seller-shared'
import { validateFileMagicBytes } from '@/lib/upload-security'
import { swallow } from '@/worker/utils/swallow'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
}

interface ImgbbResponse {
  success: boolean
  data?: { url: string; delete_url: string }
  error?: { message: string }
}

export const sellerAccountRoutes = new Hono<{ Bindings: Bindings }>()
// 🛡️ 2026-05-13: redundant cors() 제거 — worker/index.ts:243 글로벌 cors 가 처리.
//   서브라우터 wildcard 미들웨어가 같은 prefix 의 다른 라우터 경로 가로채는 버그 (Hono v4) 방지.
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

// 🛡️ 하루 셀러당 업로드 한도 (스토리지 비용 폭주 방지)
//   - 분당 10회 (rate-limit) + 일 200회 (this) = 합리적 상한
//   - 일반 셀러 사용 패턴: 상품 1개 등록 시 5-10장 → 200장 = 20-40 상품/일 충분
const MAX_UPLOADS_PER_DAY = 200;

sellerAccountRoutes.post('/upload-image', cors(), async (c) => {
  // ── Auth required ──────────────────────────────────────────────────────────
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
  if (!sellerId) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  try {
    // ── Content-Length precheck (avoid buffering huge bodies just to reject) ──
    // 🛡️ multipart body 는 magic-byte / MIME 검사 전에 메모리에 로드되므로
    //   Content-Length 가 명백히 한도 초과면 즉시 reject 해 워커 메모리 보호.
    //   (multipart overhead 감안 +20% 여유)
    const contentLength = Number.parseInt(c.req.header('Content-Length') ?? '', 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES * 1.2) {
      return c.json({ success: false, error: `파일 크기는 5MB 이하여야 합니다` }, 413);
    }

    // ── Daily upload quota per seller (storage cost guard) ────────────────────
    //   RATE_LIMIT_KV 미바인딩 시 fail-open (가용성 우선, 분당 rate-limit 가 1차 방어)
    const kv = (c.env as unknown as { RATE_LIMIT_KV?: KVNamespace }).RATE_LIMIT_KV;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    const quotaKey = `upload-quota:seller:${sellerId}:${today}`;
    let currentCount = 0;
    if (kv) {
      try {
        const v = await kv.get(quotaKey);
        currentCount = v ? Number.parseInt(v, 10) || 0 : 0;
        if (currentCount >= MAX_UPLOADS_PER_DAY) {
          return c.json(
            { success: false, error: `일일 업로드 한도 (${MAX_UPLOADS_PER_DAY}장) 를 초과했습니다. 내일 다시 시도해주세요.` },
            429,
          );
        }
      } catch {
        // KV 조회 실패 시 fail-open
      }
    }

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
    // 🛡️ 파일명에 확장자가 없으면 split('.').pop() 이 전체 파일명을 반환해
    //   '.somefile' 같은 가짜 확장자가 만들어질 수 있다. 명시적으로 dot 검사.
    const fileName = (file.name || '').toString();
    const dotIdx = fileName.lastIndexOf('.');
    const ext = dotIdx > 0 && dotIdx < fileName.length - 1
      ? fileName.slice(dotIdx).toLowerCase()
      : '';
    if (!ext || !ALLOWED_IMAGE_EXT.has(ext)) {
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
      return c.json({
        success: false,
        error: '이미지 업로드 서비스가 구성되지 않았습니다. Cloudflare Pages 대시보드에서 IMGBB_API_KEY 시크릿을 추가해주세요.',
        error_code: 'IMGBB_NOT_CONFIGURED'
      }, 503);
    }

    // ── Safe filename (no path traversal) ─────────────────────────────────────
    const safeName = `seller_${sellerId}_${Date.now()}${ext}`;

    // 🛡️ 2026-05-13: btoa(String.fromCharCode(...arr)) 는 spread 인자 수가
    //   콜스택 한도를 넘어 100KB+ 파일에서 RangeError → 500 사고 발생.
    //   32KB 청크로 분할 인코딩 → 5MB 까지 안정.
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
    }
    const base64 = btoa(binary);

    const resp = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `image=${encodeURIComponent(base64)}&name=${encodeURIComponent(safeName)}`,
      // 🛡️ 2026-04-22: 30s timeout — 큰 이미지 업로드 + imgbb 응답 지연 대비
      signal: AbortSignal.timeout(30_000),
    });
    if (!resp.ok) {
      const bodyText = await resp.text().catch(() => '');
      throw new Error(`imgbb HTTP ${resp.status}: ${bodyText.slice(0, 200)}`);
    }
    const json = await resp.json() as ImgbbResponse;
    if (!json.success) throw new Error(json.error?.message || 'imgbb upload failed');

    // ── Bump daily quota counter (TTL = 26h to safely cross day boundary) ────
    if (kv) {
      try {
        await kv.put(quotaKey, String(currentCount + 1), { expirationTtl: 26 * 60 * 60 });
      } catch {
        // best-effort
      }
    }

    // 🛡️ 2026-04-22: delete_url 은 응답에 포함하지 않음.
    // 클라이언트가 받으면 악의적으로 이미지 삭제 가능. 서버 내부에만 저장.
    return c.json({ success: true, url: json.data!.url });
  } catch (err: unknown) {
    const msg = (err as Error).message || String(err);
    console.error('[Seller] Upload image error:', msg);
    // 🛡️ 2026-05-13: imgbb / 인코딩 실패를 사용자에게 구체적으로 안내 — 디버깅 가능성 ↑.
    //   IMGBB_API_KEY 미설정은 이미 위에서 503 으로 처리. 여기까지 도달 = 외부 호출/인코딩 실패.
    const userHint = msg.toLowerCase().includes('imgbb')
      ? 'imgbb 응답이 비정상입니다. API 키 유효성 또는 일일 한도를 확인하세요.'
      : '이미지 업로드에 실패했습니다.';
    const isProd = (c.env as unknown as { ENVIRONMENT?: string }).ENVIRONMENT === 'production';
    return c.json({
      success: false,
      error: userHint,
      ...(isProd ? {} : { debug: msg.slice(0, 300) })
    }, 500);
  }
});

/**
 * GET  /api/seller/settlements
 * POST /api/seller/settlements/request
 * GET  /api/seller/settlements/stats
 * 셀러 정산 관련 API
 */
