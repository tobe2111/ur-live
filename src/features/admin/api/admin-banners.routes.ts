/**
 * Admin Banners API Routes
 * 
 * Endpoints for banner management:
 * - GET /api/admin/banners - 모든 배너 조회
 * - POST /api/admin/banners - 새 배너 생성
 * - PUT /api/admin/banners/:id - 배너 수정
 * - DELETE /api/admin/banners/:id - 배너 삭제
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  successResponse,
  badRequestResponse,
  notFoundResponse,
  internalServerErrorResponse
} from '@/worker/utils/response';
import { executeQuery } from '@/worker/utils/database';
import { validateRequired } from '@/worker/utils/validation';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

export const adminBannersRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/admin/banners
 * 모든 배너 조회
 */
adminBannersRoutes.get('/', cors(), async (c) => {
  try {
    const { DB } = c.env;
    
    console.log('[Admin Banners] 📋 Fetching all banners');
    
    const banners = await executeQuery<any>(
      DB,
      `SELECT 
        id, title, image_url, link_url, description,
        is_active, display_order, start_date, end_date,
        created_at, updated_at
      FROM banners
      ORDER BY display_order ASC, created_at DESC`
    );
    
    console.log(`[Admin Banners] ✅ Found ${banners.length} banners`);
    
    return successResponse(c, banners, 'Banners retrieved successfully');
  } catch (error) {
    console.error('[Admin Banners] ❌ Failed to fetch banners:', error);
    return internalServerErrorResponse(c, '배너 목록 조회 실패');
  }
});

/**
 * POST /api/admin/banners
 * 새 배너 생성
 */
adminBannersRoutes.post('/', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const body = await c.req.json();
    
    const {
      title,
      image_url,
      link_url,
      description,
      is_active,
      display_order,
      start_date,
      end_date
    } = body;
    
    console.log('[Admin Banners] 📝 Creating new banner:', title);
    
    // Validation
    const validationErrors = validateRequired(body, ['title', 'image_url']);
    if (validationErrors.length > 0) {
      return badRequestResponse(c, '제목과 이미지 URL은 필수입니다.');
    }
    
    // Insert banner (use COALESCE for backward compatibility)
    const result = await executeQuery(
      DB,
      `INSERT INTO banners (
        title, image_url, link_url, description,
        is_active, display_order, start_date, end_date,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        title,
        image_url,
        link_url || null,
        description || null,
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
        display_order || 0,
        start_date || null,
        end_date || null
      ]
    );
    
    console.log('[Admin Banners] ✅ Banner created successfully');
    
    return successResponse(
      c,
      { id: result.meta?.last_row_id, title },
      '배너가 생성되었습니다'
    );
  } catch (error) {
    console.error('[Admin Banners] ❌ Failed to create banner:', error);
    return internalServerErrorResponse(c, '배너 생성 실패');
  }
});

/**
 * PUT /api/admin/banners/:id
 * 배너 수정
 */
adminBannersRoutes.put('/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const bannerId = c.req.param('id');
    const body = await c.req.json();
    
    const {
      title,
      image_url,
      link_url,
      description,
      is_active,
      display_order,
      start_date,
      end_date
    } = body;
    
    console.log('[Admin Banners] 📝 Updating banner:', bannerId);
    
    // Check if banner exists
    const banners = await executeQuery<any>(
      DB,
      'SELECT id FROM banners WHERE id = ?',
      [bannerId]
    );
    
    if (banners.length === 0) {
      return notFoundResponse(c, '배너를 찾을 수 없습니다');
    }
    
    // Update banner
    await executeQuery(
      DB,
      `UPDATE banners SET
        title = ?,
        image_url = ?,
        link_url = ?,
        description = ?,
        is_active = ?,
        display_order = ?,
        start_date = ?,
        end_date = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        title,
        image_url,
        link_url || null,
        description || null,
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
        display_order || 0,
        start_date || null,
        end_date || null,
        bannerId
      ]
    );
    
    console.log('[Admin Banners] ✅ Banner updated successfully');
    
    return successResponse(c, { id: bannerId }, '배너가 수정되었습니다');
  } catch (error) {
    console.error('[Admin Banners] ❌ Failed to update banner:', error);
    return internalServerErrorResponse(c, '배너 수정 실패');
  }
});

/**
 * DELETE /api/admin/banners/:id
 * 배너 삭제
 */
adminBannersRoutes.delete('/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const bannerId = c.req.param('id');
    
    console.log('[Admin Banners] 🗑️ Deleting banner:', bannerId);
    
    // Check if banner exists
    const banners = await executeQuery<any>(
      DB,
      'SELECT id FROM banners WHERE id = ?',
      [bannerId]
    );
    
    if (banners.length === 0) {
      return notFoundResponse(c, '배너를 찾을 수 없습니다');
    }
    
    // Delete banner
    await executeQuery(DB, 'DELETE FROM banners WHERE id = ?', [bannerId]);
    
    console.log('[Admin Banners] ✅ Banner deleted successfully');
    
    return successResponse(c, { id: bannerId }, '배너가 삭제되었습니다');
  } catch (error) {
    console.error('[Admin Banners] ❌ Failed to delete banner:', error);
    return internalServerErrorResponse(c, '배너 삭제 실패');
  }
});

export default adminBannersRoutes;
