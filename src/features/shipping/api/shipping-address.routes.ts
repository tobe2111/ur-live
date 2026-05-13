/**
 * Shipping Address API Routes (Refactored)
 * 
 * Endpoints:
 * - GET /api/shipping-addresses - 배송지 목록
 * - POST /api/shipping-addresses - 배송지 추가
 * - PUT /api/shipping-addresses/:id - 배송지 수정
 * - DELETE /api/shipping-addresses/:id - 배송지 삭제
 * 
 * Refactored: 2026-03-09
 * - Using validation utilities
 * - Using response formatters
 * - Using database helpers
 * - Using auth middleware
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  requireAuth,
  getCurrentUser
} from '@/worker/middleware/auth';
import { ALLOWED_ORIGINS } from '@/shared/constants';
import {
  validateRequiredString,
  validateOptionalString,
  validatePhoneNumber,
  ValidationError
} from '@/worker/utils/validation';
import {
  successResponse,
  createdResponse,
  notFoundResponse,
  badRequestResponse,
  validationErrorResponse,
  unauthorizedResponse,
  internalServerErrorResponse
} from '@/worker/utils/response';
import { createDbHelper } from '@/worker/utils/database';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_CLIENT_EMAIL: string;
};

type EntryMethod = 'free' | 'password' | 'intercom' | 'pickup_box';

interface AddressCreateRequest {
  recipient_name: string;
  phone: string;
  address: string;
  address_detail?: string;
  postal_code: string;
  country?: string;
  state?: string;
  city?: string;
  is_default?: boolean;
  // 0204: 실무 필수 필드
  label?: string;          // 배송지 별칭 ("집", "회사")
  delivery_note?: string;  // 배송 메모
  entry_code?: string;     // 공동현관 비밀번호
  entry_method?: EntryMethod;
}

interface AddressUpdateRequest {
  recipient_name?: string;
  phone?: string;
  address?: string;
  address_detail?: string;
  postal_code?: string;
  country?: string;
  state?: string;
  city?: string;
  is_default?: boolean;
  label?: string;
  delivery_note?: string;
  entry_code?: string;
  entry_method?: EntryMethod;
}

const ALLOWED_ENTRY_METHODS: EntryMethod[] = ['free', 'password', 'intercom', 'pickup_box'];

export const shippingAddressRoutes = new Hono<{ Bindings: Bindings }>();

// CORS 설정
// 🛡️ 2026-05-13: redundant cors() 제거 — 전역 cors 가 처리.

/**
 * 사용자 DB ID 가져오기 (Helper)
 */
async function getUserDbId(db: D1Database, idOrUid: string): Promise<number | null> {
  // 1. 숫자 ID면 바로 사용 (세션 쿠키 유저)
  const numId = parseInt(idOrUid);
  if (!isNaN(numId) && String(numId) === idOrUid) {
    return numId;
  }
  // 2. Firebase UID로 조회
  const dbHelper = createDbHelper(db);
  const user = await dbHelper.findOne<{ id: number }>('users', { firebase_uid: idOrUid });
  return user?.id || null;
}

/**
 * GET /api/shipping-addresses
 * 배송지 목록 조회
 */
shippingAddressRoutes.get('/', requireAuth(), async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json(unauthorizedResponse(), 401);
    }

    const db = c.env.DB;
    const dbHelper = createDbHelper(db);
    const userId = await getUserDbId(db, String(user.id));
    
    if (!userId) {
      return c.json(notFoundResponse('User'), 404);
    }

    const addresses = await dbHelper.findAll(
      'shipping_addresses',
      { user_id: userId },
      { orderBy: 'is_default DESC, created_at', order: 'DESC' }
    );

    return c.json(successResponse(addresses));

  } catch (error: any) {
    console.error('[Shipping] Get addresses error:', error);
    return c.json(internalServerErrorResponse('Failed to get shipping addresses'), 500);
  }
});

/**
 * POST /api/shipping-addresses
 * 배송지 추가
 */
shippingAddressRoutes.post('/', requireAuth(), async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json(unauthorizedResponse(), 401);
    }

    const body = await c.req.json<AddressCreateRequest>();

    // Validation
    const recipient_name = validateRequiredString(body.recipient_name, 'recipient_name', { maxLength: 50 });
    const phone = validatePhoneNumber(body.phone);
    const address = validateRequiredString(body.address, 'address', { maxLength: 200 });
    const address_detail = validateOptionalString(body.address_detail, 'address_detail', { maxLength: 100 });
    const postal_code = validateRequiredString(body.postal_code, 'postal_code', { maxLength: 10 });
    const is_default = Boolean(body.is_default);
    const label = validateOptionalString(body.label, 'label', { maxLength: 20 });
    const delivery_note = validateOptionalString(body.delivery_note, 'delivery_note', { maxLength: 200 });
    const entry_code = validateOptionalString(body.entry_code, 'entry_code', { maxLength: 20 });
    const entry_method: EntryMethod = body.entry_method && ALLOWED_ENTRY_METHODS.includes(body.entry_method)
      ? body.entry_method
      : 'free';

    const db = c.env.DB;
    const dbHelper = createDbHelper(db);
    const userId = await getUserDbId(db, String(user.id));
    
    if (!userId) {
      return c.json(notFoundResponse('User'), 404);
    }

    // 기본 배송지로 설정하려는 경우, 기존 기본 배송지를 해제
    if (is_default) {
      await dbHelper.update(
        'shipping_addresses',
        { is_default: 0 },
        { user_id: userId }
      );
    }

    // 새 배송지 추가 (migration 0204 확장 필드 — 없으면 fallback)
    const basePayload = {
      user_id: userId,
      recipient_name,
      phone,
      address,
      address_detail,
      postal_code,
      is_default: is_default ? 1 : 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const extraPayload = { label, delivery_note, entry_code, entry_method };

    let result;
    try {
      result = await dbHelper.insert('shipping_addresses', { ...basePayload, ...extraPayload });
    } catch (insertErr) {
      // 마이그레이션 0204 미적용 환경 — 확장 필드 없이 재시도
      if (insertErr instanceof Error && /no such column|has no column/i.test(insertErr.message)) {
        console.warn('[Shipping] migration 0204 not applied, inserting without extended fields');
        result = await dbHelper.insert('shipping_addresses', basePayload);
      } else {
        throw insertErr;
      }
    }

    const newAddress = await dbHelper.findById('shipping_addresses', result.meta.last_row_id);

    return c.json(createdResponse(newAddress, 'Shipping address added'), 201);

  } catch (error: any) {
    console.error('[Shipping] Add address error:', error);
    
    if (error instanceof ValidationError) {
      return c.json(validationErrorResponse(error.message, error.field), 422);
    }
    
    return c.json(internalServerErrorResponse('Failed to add shipping address'), 500);
  }
});

/**
 * PUT /api/shipping-addresses/:id
 * 배송지 수정
 */
shippingAddressRoutes.put('/:id', requireAuth(), async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json(unauthorizedResponse(), 401);
    }

    const addressId = parseInt(c.req.param('id') || '0');
    const body = await c.req.json<AddressUpdateRequest>();

    if (isNaN(addressId)) {
      return c.json(badRequestResponse('Invalid address ID'), 400);
    }

    // Validation (optional fields)
    const updateData: any = {};
    
    if (body.recipient_name !== undefined) {
      updateData.recipient_name = validateRequiredString(body.recipient_name, 'recipient_name', { maxLength: 50 });
    }
    if (body.phone !== undefined) {
      updateData.phone = validatePhoneNumber(body.phone);
    }
    if (body.address !== undefined) {
      updateData.address = validateRequiredString(body.address, 'address', { maxLength: 200 });
    }
    if (body.address_detail !== undefined) {
      updateData.address_detail = validateOptionalString(body.address_detail, 'address_detail', { maxLength: 100 });
    }
    if (body.postal_code !== undefined) {
      updateData.postal_code = validateRequiredString(body.postal_code, 'postal_code', { maxLength: 10 });
    }
    if (body.is_default !== undefined) {
      updateData.is_default = Boolean(body.is_default) ? 1 : 0;
    }
    if (body.label !== undefined) {
      updateData.label = validateOptionalString(body.label, 'label', { maxLength: 20 });
    }
    if (body.delivery_note !== undefined) {
      updateData.delivery_note = validateOptionalString(body.delivery_note, 'delivery_note', { maxLength: 200 });
    }
    if (body.entry_code !== undefined) {
      updateData.entry_code = validateOptionalString(body.entry_code, 'entry_code', { maxLength: 20 });
    }
    if (body.entry_method !== undefined && ALLOWED_ENTRY_METHODS.includes(body.entry_method)) {
      updateData.entry_method = body.entry_method;
    }

    if (Object.keys(updateData).length === 0) {
      return c.json(badRequestResponse('No fields to update'), 400);
    }

    const db = c.env.DB;
    const dbHelper = createDbHelper(db);
    const userId = await getUserDbId(db, String(user.id));
    
    if (!userId) {
      return c.json(notFoundResponse('User'), 404);
    }

    // 배송지가 해당 사용자의 것인지 확인
    const address = await dbHelper.findOne('shipping_addresses', { id: addressId, user_id: userId });
    if (!address) {
      return c.json(notFoundResponse('Shipping address'), 404);
    }

    // 기본 배송지로 변경하려는 경우, 기존 기본 배송지를 해제
    if (updateData.is_default === 1) {
      await dbHelper.update(
        'shipping_addresses',
        { is_default: 0 },
        { user_id: userId }
      );
    }

    // 업데이트
    updateData.updated_at = new Date().toISOString();
    await dbHelper.update('shipping_addresses', updateData, { id: addressId });

    const updatedAddress = await dbHelper.findById('shipping_addresses', addressId);

    return c.json(successResponse(updatedAddress, 'Shipping address updated'));

  } catch (error: any) {
    console.error('[Shipping] Update address error:', error);
    
    if (error instanceof ValidationError) {
      return c.json(validationErrorResponse(error.message, error.field), 422);
    }
    
    return c.json(internalServerErrorResponse('Failed to update shipping address'), 500);
  }
});

/**
 * DELETE /api/shipping-addresses/:id
 * 배송지 삭제
 */
shippingAddressRoutes.delete('/:id', requireAuth(), async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json(unauthorizedResponse(), 401);
    }

    const addressId = parseInt(c.req.param('id') || '0');

    if (isNaN(addressId)) {
      return c.json(badRequestResponse('Invalid address ID'), 400);
    }

    const db = c.env.DB;
    const dbHelper = createDbHelper(db);
    const userId = await getUserDbId(db, String(user.id));
    
    if (!userId) {
      return c.json(notFoundResponse('User'), 404);
    }

    // 배송지가 해당 사용자의 것인지 확인
    const address = await dbHelper.findOne('shipping_addresses', { id: addressId, user_id: userId });
    if (!address) {
      return c.json(notFoundResponse('Shipping address'), 404);
    }

    // 삭제
    await dbHelper.delete('shipping_addresses', { id: addressId });

    return c.json(successResponse(null, 'Shipping address deleted'));

  } catch (error: any) {
    console.error('[Shipping] Delete address error:', error);
    return c.json(internalServerErrorResponse('Failed to delete shipping address'), 500);
  }
});
