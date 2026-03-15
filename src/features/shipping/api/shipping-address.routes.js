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
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import { validateRequiredString, validateOptionalString, validatePhoneNumber, ValidationError } from '@/worker/utils/validation';
import { successResponse, createdResponse, notFoundResponse, badRequestResponse, validationErrorResponse, unauthorizedResponse, internalServerErrorResponse } from '@/worker/utils/response';
import { createDbHelper } from '@/worker/utils/database';
export const shippingAddressRoutes = new Hono();
// CORS 설정
shippingAddressRoutes.use('*', cors({
    origin: ['https://live.ur-team.com', 'http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
}));
/**
 * 사용자 DB ID 가져오기 (Helper)
 */
async function getUserDbId(db, firebaseUid) {
    const dbHelper = createDbHelper(db);
    const user = await dbHelper.findOne('users', { firebase_uid: firebaseUid });
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
        const addresses = await dbHelper.findAll('shipping_addresses', { user_id: userId }, { orderBy: 'is_default DESC, created_at', order: 'DESC' });
        return c.json(successResponse(addresses));
    }
    catch (error) {
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
        const body = await c.req.json();
        // Validation
        const recipient_name = validateRequiredString(body.recipient_name, 'recipient_name', { maxLength: 50 });
        const phone = validatePhoneNumber(body.phone);
        const address = validateRequiredString(body.address, 'address', { maxLength: 200 });
        const address_detail = validateOptionalString(body.address_detail, 'address_detail', { maxLength: 100 });
        const postal_code = validateRequiredString(body.postal_code, 'postal_code', { maxLength: 10 });
        const is_default = Boolean(body.is_default);
        const db = c.env.DB;
        const dbHelper = createDbHelper(db);
        const userId = await getUserDbId(db, String(user.id));
        if (!userId) {
            return c.json(notFoundResponse('User'), 404);
        }
        // 기본 배송지로 설정하려는 경우, 기존 기본 배송지를 해제
        if (is_default) {
            await dbHelper.update('shipping_addresses', { is_default: 0 }, { user_id: userId });
        }
        // 새 배송지 추가
        const result = await dbHelper.insert('shipping_addresses', {
            user_id: userId,
            recipient_name,
            phone,
            address,
            address_detail,
            postal_code,
            is_default: is_default ? 1 : 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        const newAddress = await dbHelper.findById('shipping_addresses', result.meta.last_row_id);
        return c.json(createdResponse(newAddress, 'Shipping address added'), 201);
    }
    catch (error) {
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
        const body = await c.req.json();
        if (isNaN(addressId)) {
            return c.json(badRequestResponse('Invalid address ID'), 400);
        }
        // Validation (optional fields)
        const updateData = {};
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
            await dbHelper.update('shipping_addresses', { is_default: 0 }, { user_id: userId });
        }
        // 업데이트
        updateData.updated_at = new Date().toISOString();
        await dbHelper.update('shipping_addresses', updateData, { id: addressId });
        const updatedAddress = await dbHelper.findById('shipping_addresses', addressId);
        return c.json(successResponse(updatedAddress, 'Shipping address updated'));
    }
    catch (error) {
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
    }
    catch (error) {
        console.error('[Shipping] Delete address error:', error);
        return c.json(internalServerErrorResponse('Failed to delete shipping address'), 500);
    }
});
