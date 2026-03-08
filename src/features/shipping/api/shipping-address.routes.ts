/**
 * Shipping Address API Routes
 * 
 * Endpoints:
 * - GET /api/shipping-addresses - 배송지 목록
 * - POST /api/shipping-addresses - 배송지 추가
 * - PUT /api/shipping-addresses/:id - 배송지 수정
 * - DELETE /api/shipping-addresses/:id - 배송지 삭제
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_CLIENT_EMAIL: string;
};

type AddressCreateRequest = {
  recipient_name: string;
  phone: string;
  address: string;
  address_detail?: string;
  postal_code: string;
  is_default?: boolean;
};

type AddressUpdateRequest = {
  recipient_name?: string;
  phone?: string;
  address?: string;
  address_detail?: string;
  postal_code?: string;
  is_default?: boolean;
};

export const shippingAddressRoutes = new Hono<{ Bindings: Bindings }>();

// CORS 설정
shippingAddressRoutes.use('*', cors({
  origin: ['https://live.ur-team.com', 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

/**
 * Firebase 토큰에서 사용자 ID 추출
 */
async function getUserIdFromToken(authorization: string | undefined): Promise<string | null> {
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authorization.substring(7);
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const payload = JSON.parse(atob(parts[1]));
    return payload.user_id || payload.sub || null;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

/**
 * 사용자 DB ID 가져오기
 */
async function getUserDbId(db: D1Database, firebaseUid: string): Promise<number | null> {
  try {
    const user = await db.prepare('SELECT id FROM users WHERE firebase_uid = ?').bind(firebaseUid).first();
    return user?.id as number || null;
  } catch (error) {
    console.error('Get user DB ID error:', error);
    return null;
  }
}

/**
 * GET /api/shipping-addresses
 * 배송지 목록 조회
 */
shippingAddressRoutes.get('/', async (c) => {
  try {
    const firebaseUid = await getUserIdFromToken(c.req.header('Authorization'));
    if (!firebaseUid) {
      return c.json({
        success: false,
        error: 'Unauthorized'
      }, 401);
    }

    const db = c.env.DB;
    const userId = await getUserDbId(db, firebaseUid);
    if (!userId) {
      return c.json({
        success: false,
        error: 'User not found'
      }, 404);
    }

    const addresses = await db.prepare(`
      SELECT 
        id, recipient_name, phone, address, address_detail, postal_code,
        is_default, created_at, updated_at
      FROM shipping_addresses
      WHERE user_id = ?
      ORDER BY is_default DESC, created_at DESC
    `).bind(userId).all();

    return c.json({
      success: true,
      addresses: addresses.results || []
    });

  } catch (error: any) {
    console.error('Get shipping addresses error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to get shipping addresses'
    }, 500);
  }
});

/**
 * POST /api/shipping-addresses
 * 배송지 추가
 */
shippingAddressRoutes.post('/', async (c) => {
  try {
    const firebaseUid = await getUserIdFromToken(c.req.header('Authorization'));
    if (!firebaseUid) {
      return c.json({
        success: false,
        error: 'Unauthorized'
      }, 401);
    }

    const body = await c.req.json<AddressCreateRequest>();
    const { recipient_name, phone, address, address_detail, postal_code, is_default } = body;

    // 필수 필드 검증
    if (!recipient_name || !phone || !address || !postal_code) {
      return c.json({
        success: false,
        error: 'Missing required fields'
      }, 400);
    }

    // 전화번호 형식 검증 (간단한 버전)
    const phoneRegex = /^01[0-9]-\d{3,4}-\d{4}$/;
    if (!phoneRegex.test(phone)) {
      return c.json({
        success: false,
        error: 'Invalid phone number format (010-XXXX-XXXX)'
      }, 400);
    }

    const db = c.env.DB;
    const userId = await getUserDbId(db, firebaseUid);
    if (!userId) {
      return c.json({
        success: false,
        error: 'User not found'
      }, 404);
    }

    // 기본 배송지로 설정하려는 경우, 기존 기본 배송지를 해제
    if (is_default) {
      await db.prepare(`
        UPDATE shipping_addresses
        SET is_default = 0
        WHERE user_id = ?
      `).bind(userId).run();
    }

    // 새 배송지 추가
    const result = await db.prepare(`
      INSERT INTO shipping_addresses (
        user_id, recipient_name, phone, address, address_detail, postal_code,
        is_default, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      userId,
      recipient_name,
      phone,
      address,
      address_detail || null,
      postal_code,
      is_default ? 1 : 0
    ).run();

    if (!result.success) {
      throw new Error('Failed to add shipping address');
    }

    // 생성된 배송지 조회
    const newAddress = await db.prepare(`
      SELECT 
        id, recipient_name, phone, address, address_detail, postal_code,
        is_default, created_at, updated_at
      FROM shipping_addresses
      WHERE id = ?
    `).bind(result.meta.last_row_id).first();

    return c.json({
      success: true,
      message: 'Shipping address added',
      address: newAddress
    }, 201);

  } catch (error: any) {
    console.error('Add shipping address error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to add shipping address'
    }, 500);
  }
});

/**
 * PUT /api/shipping-addresses/:id
 * 배송지 수정
 */
shippingAddressRoutes.put('/:id', async (c) => {
  try {
    const firebaseUid = await getUserIdFromToken(c.req.header('Authorization'));
    if (!firebaseUid) {
      return c.json({
        success: false,
        error: 'Unauthorized'
      }, 401);
    }

    const addressId = parseInt(c.req.param('id'));
    const body = await c.req.json<AddressUpdateRequest>();
    const { recipient_name, phone, address, address_detail, postal_code, is_default } = body;

    // 전화번호 형식 검증 (있는 경우)
    if (phone) {
      const phoneRegex = /^01[0-9]-\d{3,4}-\d{4}$/;
      if (!phoneRegex.test(phone)) {
        return c.json({
          success: false,
          error: 'Invalid phone number format (010-XXXX-XXXX)'
        }, 400);
      }
    }

    const db = c.env.DB;
    const userId = await getUserDbId(db, firebaseUid);
    if (!userId) {
      return c.json({
        success: false,
        error: 'User not found'
      }, 404);
    }

    // 배송지가 해당 사용자의 것인지 확인
    const existingAddress = await db.prepare('SELECT id FROM shipping_addresses WHERE id = ? AND user_id = ?').bind(addressId, userId).first();
    if (!existingAddress) {
      return c.json({
        success: false,
        error: 'Shipping address not found'
      }, 404);
    }

    // 기본 배송지로 설정하려는 경우, 기존 기본 배송지를 해제
    if (is_default) {
      await db.prepare(`
        UPDATE shipping_addresses
        SET is_default = 0
        WHERE user_id = ? AND id != ?
      `).bind(userId, addressId).run();
    }

    // 업데이트
    const updates: string[] = [];
    const params: any[] = [];

    if (recipient_name !== undefined) {
      updates.push('recipient_name = ?');
      params.push(recipient_name);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone);
    }
    if (address !== undefined) {
      updates.push('address = ?');
      params.push(address);
    }
    if (address_detail !== undefined) {
      updates.push('address_detail = ?');
      params.push(address_detail);
    }
    if (postal_code !== undefined) {
      updates.push('postal_code = ?');
      params.push(postal_code);
    }
    if (is_default !== undefined) {
      updates.push('is_default = ?');
      params.push(is_default ? 1 : 0);
    }

    if (updates.length === 0) {
      return c.json({
        success: false,
        error: 'No fields to update'
      }, 400);
    }

    updates.push('updated_at = datetime(\'now\')');
    params.push(addressId);

    const result = await db.prepare(`
      UPDATE shipping_addresses
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...params).run();

    if (!result.success) {
      throw new Error('Failed to update shipping address');
    }

    // 업데이트된 배송지 조회
    const updatedAddress = await db.prepare(`
      SELECT 
        id, recipient_name, phone, address, address_detail, postal_code,
        is_default, created_at, updated_at
      FROM shipping_addresses
      WHERE id = ?
    `).bind(addressId).first();

    return c.json({
      success: true,
      message: 'Shipping address updated',
      address: updatedAddress
    });

  } catch (error: any) {
    console.error('Update shipping address error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to update shipping address'
    }, 500);
  }
});

/**
 * DELETE /api/shipping-addresses/:id
 * 배송지 삭제
 */
shippingAddressRoutes.delete('/:id', async (c) => {
  try {
    const firebaseUid = await getUserIdFromToken(c.req.header('Authorization'));
    if (!firebaseUid) {
      return c.json({
        success: false,
        error: 'Unauthorized'
      }, 401);
    }

    const addressId = parseInt(c.req.param('id'));

    const db = c.env.DB;
    const userId = await getUserDbId(db, firebaseUid);
    if (!userId) {
      return c.json({
        success: false,
        error: 'User not found'
      }, 404);
    }

    // 배송지가 해당 사용자의 것인지 확인
    const existingAddress = await db.prepare('SELECT id FROM shipping_addresses WHERE id = ? AND user_id = ?').bind(addressId, userId).first();
    if (!existingAddress) {
      return c.json({
        success: false,
        error: 'Shipping address not found'
      }, 404);
    }

    // 삭제
    const result = await db.prepare('DELETE FROM shipping_addresses WHERE id = ?').bind(addressId).run();

    if (!result.success) {
      throw new Error('Failed to delete shipping address');
    }

    return c.json({
      success: true,
      message: 'Shipping address deleted'
    });

  } catch (error: any) {
    console.error('Delete shipping address error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to delete shipping address'
    }, 500);
  }
});
