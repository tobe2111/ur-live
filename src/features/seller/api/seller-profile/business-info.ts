/**
 * 🏢 셀러 사업자 정보 — 조회/등록/수정 (`/api/seller/business-info`)
 *
 * 🧱 2026-09-04 `seller-profile.routes.ts` 에서 분리. 그 파일이 720줄로 자라 file-size 래칫에 걸렸다.
 *   (CLAUDE.md: "페이지/라우트가 600줄 넘어가면 **그 시점에** 추출") 로직은 **byte-불변**으로 옮겼고,
 *   바뀐 것은 `sellerProfileRoutes` 를 인자로 받는 등록 함수로 감싼 것뿐이다.
 *
 * 🏪 운영자(중개사) 게이트: 읽기는 마스킹, 쓰기는 403. 판별 SSOT = `worker/utils/store-actor`.
 *   설계: docs/design/store-operator-model.md §7.7
 */
import type { Hono } from 'hono'
import { getSellerIdFromToken } from '@/lib/seller-shared'
import { safeError } from '@/worker/utils/safe-error'
import { buildBusinessInfoSeed } from '../business-info-seed'
import { resolveStoreActor, maskBusinessNumber, maskName, OWNER_ONLY_MESSAGE } from '@/worker/utils/store-actor'

type Bindings = { DB: D1Database; JWT_SECRET: string }

export function registerBusinessInfoRoutes(sellerProfileRoutes: Hono<{ Bindings: Bindings }>) {
/**
 * GET /api/seller/business-info
 * 사업자 정보 조회 (seller_business_info 테이블)
 */
sellerProfileRoutes.get('/business-info', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const db = c.env.DB;
    let businessInfo;
    try {
      businessInfo = await db.prepare(`
        SELECT
          id, business_number, business_name, ceo_name,
          business_type, business_category,
          postal_code, address, address_detail,
          phone, email,
          is_verified, verified_at, created_at
        FROM seller_business_info
        WHERE seller_id = ?
      `).bind(sellerId).first();
    } catch {
      // address_detail 컬럼이 없는 경우 fallback
      businessInfo = await db.prepare(`
        SELECT
          id, business_number, business_name, ceo_name,
          business_type, business_category,
          postal_code, address, '' as address_detail,
          phone, email,
          is_verified, verified_at, created_at
        FROM seller_business_info
        WHERE seller_id = ?
      `).bind(sellerId).first();
    }

    // 🏪 2026-09-03: 행이 없으면 매장 등록 때 받은 값으로 채워 돌려준다(설명은 business-info-seed).
    if (!businessInfo) {
      const seeded = await buildBusinessInfoSeed(db, sellerId);
      if (!seeded) return c.json({ success: false, error: 'Not found' }, 404);
      // ⚠️ 이 분기도 같은 마스킹을 타야 한다 — 안 그러면 "행이 없을 때만" 원본이 샌다.
      const a0 = await resolveStoreActor(c.req.header('Authorization'), c.env.JWT_SECRET);
      if (!a0.isOwner) {
        const b = seeded as unknown as Record<string, unknown>;
        b.business_number = maskBusinessNumber(b.business_number);
        b.ceo_name = maskName(b.ceo_name);
        for (const k of ['postal_code', 'address', 'address_detail', 'phone', 'email']) b[k] = null;
        b.masked_for_operator = true;
      }
      return c.json({ success: true, data: seeded });
    }

    // 🖼️ 2026-07-01 (대표 — 유어샵 판매자 정보): 통신판매업신고번호 additive 동봉 (컬럼 없으면 조용히 생략 —
    //   repair-schema 가 seller_business_info.mail_order_number 보장).
    try {
      const mo = await db.prepare('SELECT mail_order_number FROM seller_business_info WHERE seller_id = ?')
        .bind(sellerId).first<{ mail_order_number: string | null }>();
      (businessInfo as Record<string, unknown>).mail_order_number = mo?.mail_order_number ?? null;
    } catch { /* additive — 컬럼 미존재 환경 graceful */ }

    // 🏪 2026-07-05 온누리 가맹 플래그 additive 동봉 (seller_meta K-V).
    try {
      const { getSellerMeta } = await import('../../../../worker/utils/seller-meta');
      const sm = await getSellerMeta(db, [Number(sellerId)]);
      (businessInfo as Record<string, unknown>).onnuri_merchant = sm.get(Number(sellerId))?.onnuri_merchant === '1';
    } catch { /* additive — fail-soft */ }

    // 🏪 2026-09-04: 운영자(중개사)에게는 가려서 준다 — 등록번호 끝 4자리·대표자명 첫 글자만,
    //   주소/연락처는 통째로 감춘다. 사장님 본인은 그대로 본다.
    const actor = await resolveStoreActor(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!actor.isOwner) {
      const b = businessInfo as Record<string, unknown>;
      b.business_number = maskBusinessNumber(b.business_number);
      b.ceo_name = maskName(b.ceo_name);
      for (const k of ['postal_code', 'address', 'address_detail', 'phone', 'email']) b[k] = null;
      b.masked_for_operator = true;
    }

    return c.json({ success: true, data: businessInfo });

  } catch (error: unknown) {
    console.error('Get business info error:', error);
    return c.json({ success: false, error: 'Failed to get business info' }, 500);
  }
});

/**
 * POST/PUT/PATCH /api/seller/business-info
 * 사업자 정보 등록/수정 (seller_business_info 테이블 UPSERT)
 * 수정 시 is_verified = 0 으로 초기화 (재승인 필요)
 */
sellerProfileRoutes.on(['POST', 'PUT', 'PATCH'], '/business-info', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    // 🏪 2026-09-04 (대표 확정): 사업자 정보는 **소유자만** 등록·수정한다. 이 값이 세금계산서와
    //   정산 대상자를 정하므로, 대신 운영하는 사람이 바꿀 수 있으면 명의가 조용히 바뀐다.
    const actorW = await resolveStoreActor(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!actorW.isOwner) return c.json({ success: false, error: `사업자 정보는 ${OWNER_ONLY_MESSAGE}` }, 403);

    const body = await c.req.json<{
      business_number?: string;
      business_name?: string;
      ceo_name?: string;
      business_type?: string;
      business_category?: string;
      postal_code?: string;
      address?: string;
      address_detail?: string;
      phone?: string;
      email?: string;
      mail_order_number?: string; // 🖼️ 2026-07-01 통신판매업신고번호 (side-table 컬럼, additive 저장)
      onnuri_merchant?: boolean;  // 🏪 2026-07-05 온누리상품권 가맹 여부 (seller_meta K-V, additive 저장)
    }>();

    // 사업자번호 형식 검증 — 🗣️ 2026-09-03: 문구를 한국어로(영문 원문이면 무엇을 고칠지 모른다).
    if (body.business_number && !/^\d{3}-\d{2}-\d{5}$/.test(body.business_number)) {
      return c.json({ success: false, error: '사업자등록번호는 000-00-00000 형식으로 입력해 주세요' }, 400);
    }

    const db = c.env.DB;

    // address_detail 컬럼이 없을 수 있으므로 확인 (마이그레이션 0127 미적용 대비)
    let hasAddressDetail = true;
    try {
      await db.prepare('SELECT address_detail FROM seller_business_info LIMIT 0').all();
    } catch {
      hasAddressDetail = false;
    }

    const existing = await db.prepare(
      'SELECT id, is_verified FROM seller_business_info WHERE seller_id = ?'
    ).bind(sellerId).first<{ id: number; is_verified: number }>();

    if (existing) {
      // UPDATE — 재제출 시 승인 상태 초기화
      if (hasAddressDetail) {
        await db.prepare(`
          UPDATE seller_business_info SET
            business_number = COALESCE(?, business_number),
            business_name   = COALESCE(?, business_name),
            ceo_name        = COALESCE(?, ceo_name),
            business_type   = COALESCE(?, business_type),
            business_category = COALESCE(?, business_category),
            postal_code     = COALESCE(?, postal_code),
            address         = COALESCE(?, address),
            address_detail  = COALESCE(?, address_detail),
            phone           = COALESCE(?, phone),
            email           = COALESCE(?, email),
            is_verified     = 0,
            verified_at     = NULL,
            updated_at      = datetime('now')
          WHERE seller_id = ?
        `).bind(
          body.business_number ?? null,
          body.business_name ?? null,
          body.ceo_name ?? null,
          body.business_type ?? null,
          body.business_category ?? null,
          body.postal_code ?? null,
          body.address ?? null,
          body.address_detail ?? null,
          body.phone ?? null,
          body.email ?? null,
          sellerId
        ).run();
      } else {
        await db.prepare(`
          UPDATE seller_business_info SET
            business_number = COALESCE(?, business_number),
            business_name   = COALESCE(?, business_name),
            ceo_name        = COALESCE(?, ceo_name),
            business_type   = COALESCE(?, business_type),
            business_category = COALESCE(?, business_category),
            postal_code     = COALESCE(?, postal_code),
            address         = COALESCE(?, address),
            phone           = COALESCE(?, phone),
            email           = COALESCE(?, email),
            is_verified     = 0,
            verified_at     = NULL,
            updated_at      = datetime('now')
          WHERE seller_id = ?
        `).bind(
          body.business_number ?? null,
          body.business_name ?? null,
          body.ceo_name ?? null,
          body.business_type ?? null,
          body.business_category ?? null,
          body.postal_code ?? null,
          body.address ?? null,
          body.phone ?? null,
          body.email ?? null,
          sellerId
        ).run();
      }
    } else {
      // INSERT — NOT NULL 제약 대비: 빈 문자열 기본값
      if (hasAddressDetail) {
        await db.prepare(`
          INSERT INTO seller_business_info
            (seller_id, business_number, business_name, ceo_name,
             business_type, business_category, postal_code, address, address_detail,
             phone, email, is_verified)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `).bind(
          sellerId,
          body.business_number || '',
          body.business_name || '',
          body.ceo_name || '',
          body.business_type ?? null,
          body.business_category ?? null,
          body.postal_code ?? null,
          body.address ?? null,
          body.address_detail ?? null,
          body.phone ?? null,
          body.email ?? null
        ).run();
      } else {
        await db.prepare(`
          INSERT INTO seller_business_info
            (seller_id, business_number, business_name, ceo_name,
             business_type, business_category, postal_code, address,
             phone, email, is_verified)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `).bind(
          sellerId,
          body.business_number || '',
          body.business_name || '',
          body.ceo_name || '',
          body.business_type ?? null,
          body.business_category ?? null,
          body.postal_code ?? null,
          body.address ?? null,
          body.phone ?? null,
          body.email ?? null
        ).run();
      }
    }

    // 🖼️ 2026-07-01 (대표 — 유어샵 판매자 정보): 통신판매업신고번호 additive 저장 (컬럼 없으면 조용히 생략).
    //   메인 UPSERT 와 분리 — 기존 필드/검증/재승인(is_verified=0) 로직 byte-불변.
    if (body.mail_order_number !== undefined) {
      try {
        await db.prepare('UPDATE seller_business_info SET mail_order_number = ? WHERE seller_id = ?')
          .bind(body.mail_order_number || null, sellerId).run();
      } catch { /* additive — 컬럼 미존재 환경 graceful */ }
    }

    // 🏪 2026-07-05 온누리 가맹 플래그 — sellers 컬럼 한도(100=D1 한도) 회피, seller_meta K-V 저장.
    //   소비자 표면(동네딜 카드/상세/상권관)이 이 키로 뱃지 렌더. 메인 UPSERT 와 분리(additive).
    if (body.onnuri_merchant !== undefined) {
      try {
        const { setSellerMeta } = await import('../../../../worker/utils/seller-meta');
        await setSellerMeta(db, Number(sellerId), { onnuri_merchant: body.onnuri_merchant ? '1' : null });
      } catch { /* additive — fail-soft */ }
    }

    // 저장 확인 (address_detail 유무에 따라 쿼리 분기)
    let saved;
    try {
      saved = await db.prepare(`
        SELECT id, business_number, business_name, ceo_name,
               business_type, business_category, postal_code, address, address_detail,
               phone, email, is_verified, verified_at, created_at
        FROM seller_business_info WHERE seller_id = ?
      `).bind(sellerId).first();
    } catch {
      saved = await db.prepare(`
        SELECT id, business_number, business_name, ceo_name,
               business_type, business_category, postal_code, address,
               '' as address_detail,
               phone, email, is_verified, verified_at, created_at
        FROM seller_business_info WHERE seller_id = ?
      `).bind(sellerId).first();
    }

    if (saved && body.mail_order_number !== undefined) {
      (saved as Record<string, unknown>).mail_order_number = body.mail_order_number || null;
    }
    return c.json({ success: true, data: saved });

  } catch (error: unknown) {
    const errMsg = (error as Error).message || 'Unknown error';
    console.error('Update business info error:', errMsg, error);
    // 구체적인 에러 메시지 반환 (디버깅용)
    if (errMsg.includes('UNIQUE constraint')) {
      return c.json({ success: false, error: '이미 등록된 사업자번호입니다.' }, 409);
    }
    if (errMsg.includes('NOT NULL constraint')) {
      return c.json({ success: false, error: '필수 항목을 모두 입력해주세요 (사업자번호, 상호명, 대표자명).' }, 400);
    }
    return safeError(c, error, '사업자 정보 저장 중 오류가 발생했습니다', '[seller-profile]');
  }
});
}
