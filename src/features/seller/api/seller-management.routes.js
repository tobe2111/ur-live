/**
 * Seller Management API Routes
 *
 * Endpoints:
 * - POST /api/seller/register - 셀러 회원가입
 * - GET /api/seller/profile - 셀러 프로필 조회
 * - PUT /api/seller/profile - 셀러 프로필 수정
 * - GET /api/seller/business-info - 사업자 정보 조회
 * - PUT /api/seller/business-info - 사업자 정보 수정
 * - GET /api/seller/stats - 셀러 통계
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verify } from 'hono/jwt';
import { hashPassword } from '@/lib/password';
export const sellerManagementRoutes = new Hono();
// CORS 설정
sellerManagementRoutes.use('*', cors({
    origin: ['https://live.ur-team.com', 'http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
}));
/**
 * JWT 토큰에서 셀러 ID 추출
 */
async function getSellerIdFromToken(authorization, jwtSecret) {
    if (!authorization || !authorization.startsWith('Bearer ')) {
        return null;
    }
    try {
        const token = authorization.substring(7);
        const payload = await verify(token, jwtSecret, 'HS256');
        return payload.seller_id || null;
    }
    catch (error) {
        console.error('Token verification error:', error);
        return null;
    }
}
/**
 * POST /api/seller/register
 * 셀러 회원가입
 */
sellerManagementRoutes.post('/register', async (c) => {
    try {
        const body = await c.req.json();
        const { username, email, password, name, business_name, business_number, phone, address, description } = body;
        // 필수 필드 검증
        if (!username || !email || !password || !name || !business_name || !business_number || !phone) {
            return c.json({
                success: false,
                error: 'Missing required fields'
            }, 400);
        }
        // 이메일 형식 검증
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return c.json({
                success: false,
                error: 'Invalid email format'
            }, 400);
        }
        // 비밀번호 강도 검증 (최소 6자)
        if (password.length < 6) {
            return c.json({
                success: false,
                error: 'Password must be at least 6 characters'
            }, 400);
        }
        // 사업자번호 형식 검증 (XXX-XX-XXXXX)
        const businessNumberRegex = /^\d{3}-\d{2}-\d{5}$/;
        if (!businessNumberRegex.test(business_number)) {
            return c.json({
                success: false,
                error: 'Invalid business number format (XXX-XX-XXXXX)'
            }, 400);
        }
        const db = c.env.DB;
        // 이메일 중복 확인
        const existingEmail = await db.prepare('SELECT id FROM sellers WHERE email = ?').bind(email).first();
        if (existingEmail) {
            return c.json({
                success: false,
                error: 'Email already exists'
            }, 409);
        }
        // 사용자명 중복 확인
        const existingUsername = await db.prepare('SELECT id FROM sellers WHERE username = ?').bind(username).first();
        if (existingUsername) {
            return c.json({
                success: false,
                error: 'Username already exists'
            }, 409);
        }
        // 비밀번호 해시화
        const passwordHash = await hashPassword(password);
        // 셀러 등록 (pending 상태로)
        const result = await db.prepare(`
      INSERT INTO sellers (
        username, email, password_hash, name, business_name, business_number,
        phone, address, description, status, commission_rate, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 10.00, datetime('now'), datetime('now'))
    `).bind(username, email, passwordHash, name, business_name, business_number, phone, address || null, description || null).run();
        if (!result.success) {
            throw new Error('Failed to create seller account');
        }
        return c.json({
            success: true,
            message: 'Seller registration successful. Waiting for admin approval.',
            seller: {
                username,
                email,
                name,
                business_name,
                status: 'pending'
            }
        }, 201);
    }
    catch (error) {
        console.error('Seller registration error:', error);
        return c.json({
            success: false,
            error: error.message || 'Seller registration failed'
        }, 500);
    }
});
/**
 * GET /api/seller/profile
 * 셀러 프로필 조회
 */
sellerManagementRoutes.get('/profile', async (c) => {
    try {
        const authorization = c.req.header('Authorization');
        console.log('[Profile] Authorization header:', authorization ? 'Present' : 'Missing');
        console.log('[Profile] JWT_SECRET:', c.env.JWT_SECRET ? 'Present' : 'Missing');
        const sellerId = await getSellerIdFromToken(authorization, c.env.JWT_SECRET);
        console.log('[Profile] Seller ID extracted:', sellerId);
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
            seller
        });
    }
    catch (error) {
        console.error('Get seller profile error:', error);
        return c.json({
            success: false,
            error: error.message || 'Failed to get seller profile'
        }, 500);
    }
});
/**
 * PUT /api/seller/profile
 * 셀러 프로필 수정
 */
sellerManagementRoutes.put('/profile', async (c) => {
    try {
        const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
        if (!sellerId) {
            return c.json({
                success: false,
                error: 'Unauthorized'
            }, 401);
        }
        const body = await c.req.json();
        const updates = [];
        const values = [];
        // 업데이트 가능한 필드들
        if (body.name !== undefined) {
            updates.push('name = ?');
            values.push(body.name);
        }
        if (body.business_name !== undefined) {
            updates.push('business_name = ?');
            values.push(body.business_name);
        }
        if (body.phone !== undefined) {
            updates.push('phone = ?');
            values.push(body.phone);
        }
        if (body.address !== undefined) {
            updates.push('address = ?');
            values.push(body.address);
        }
        if (body.description !== undefined) {
            updates.push('description = ?');
            values.push(body.description);
        }
        if (body.bank_account !== undefined) {
            updates.push('bank_account = ?');
            values.push(body.bank_account);
        }
        if (body.bank_name !== undefined) {
            updates.push('bank_name = ?');
            values.push(body.bank_name);
        }
        if (body.account_holder !== undefined) {
            updates.push('account_holder = ?');
            values.push(body.account_holder);
        }
        if (updates.length === 0) {
            return c.json({
                success: false,
                error: 'No fields to update'
            }, 400);
        }
        updates.push('updated_at = datetime(\'now\')');
        values.push(sellerId);
        const db = c.env.DB;
        const result = await db.prepare(`
      UPDATE sellers
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...values).run();
        if (!result.success) {
            throw new Error('Failed to update seller profile');
        }
        // 업데이트된 프로필 조회
        const updatedSeller = await db.prepare(`
      SELECT 
        id, username, email, name, business_name, phone, address, description,
        bank_account, bank_name, account_holder, status, commission_rate,
        created_at, updated_at
      FROM sellers
      WHERE id = ?
    `).bind(sellerId).first();
        return c.json({
            success: true,
            message: 'Profile updated successfully',
            seller: updatedSeller
        });
    }
    catch (error) {
        console.error('Update seller profile error:', error);
        return c.json({
            success: false,
            error: error.message || 'Failed to update seller profile'
        }, 500);
    }
});
/**
 * GET /api/seller/business-info
 * 사업자 정보 조회
 */
sellerManagementRoutes.get('/business-info', async (c) => {
    try {
        const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
        if (!sellerId) {
            return c.json({
                success: false,
                error: 'Unauthorized'
            }, 401);
        }
        const db = c.env.DB;
        const businessInfo = await db.prepare(`
      SELECT 
        business_number, business_registration_file, tax_email,
        representative_name, business_address
      FROM sellers
      WHERE id = ?
    `).bind(sellerId).first();
        if (!businessInfo) {
            return c.json({
                success: false,
                error: 'Seller not found'
            }, 404);
        }
        return c.json({
            success: true,
            business_info: businessInfo
        });
    }
    catch (error) {
        console.error('Get business info error:', error);
        return c.json({
            success: false,
            error: error.message || 'Failed to get business info'
        }, 500);
    }
});
/**
 * PUT /api/seller/business-info
 * 사업자 정보 수정
 */
sellerManagementRoutes.put('/business-info', async (c) => {
    try {
        const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
        if (!sellerId) {
            return c.json({
                success: false,
                error: 'Unauthorized'
            }, 401);
        }
        const body = await c.req.json();
        const updates = [];
        const values = [];
        // 업데이트 가능한 필드들
        if (body.business_number !== undefined) {
            // 사업자번호 형식 검증
            const businessNumberRegex = /^\d{3}-\d{2}-\d{5}$/;
            if (!businessNumberRegex.test(body.business_number)) {
                return c.json({
                    success: false,
                    error: 'Invalid business number format (XXX-XX-XXXXX)'
                }, 400);
            }
            updates.push('business_number = ?');
            values.push(body.business_number);
        }
        if (body.business_registration_file !== undefined) {
            updates.push('business_registration_file = ?');
            values.push(body.business_registration_file);
        }
        if (body.tax_email !== undefined) {
            updates.push('tax_email = ?');
            values.push(body.tax_email);
        }
        if (body.representative_name !== undefined) {
            updates.push('representative_name = ?');
            values.push(body.representative_name);
        }
        if (body.business_address !== undefined) {
            updates.push('business_address = ?');
            values.push(body.business_address);
        }
        if (updates.length === 0) {
            return c.json({
                success: false,
                error: 'No fields to update'
            }, 400);
        }
        updates.push('updated_at = datetime(\'now\')');
        values.push(sellerId);
        const db = c.env.DB;
        const result = await db.prepare(`
      UPDATE sellers
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...values).run();
        if (!result.success) {
            throw new Error('Failed to update business info');
        }
        // 업데이트된 사업자 정보 조회
        const updatedBusinessInfo = await db.prepare(`
      SELECT 
        business_number, business_registration_file, tax_email,
        representative_name, business_address
      FROM sellers
      WHERE id = ?
    `).bind(sellerId).first();
        return c.json({
            success: true,
            message: 'Business info updated successfully',
            business_info: updatedBusinessInfo
        });
    }
    catch (error) {
        console.error('Update business info error:', error);
        return c.json({
            success: false,
            error: error.message || 'Failed to update business info'
        }, 500);
    }
});
/**
 * GET /api/seller/stats
 * 셀러 통계 조회
 */
sellerManagementRoutes.get('/stats', async (c) => {
    try {
        const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
        if (!sellerId) {
            return c.json({
                success: false,
                error: 'Unauthorized'
            }, 401);
        }
        const db = c.env.DB;
        // 상품 통계
        const productsCount = await db.prepare(`
      SELECT COUNT(*) as total
      FROM products
      WHERE seller_id = ?
    `).bind(sellerId).first();
        // 주문 통계
        const ordersStats = await db.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_orders,
        SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) as shipped_orders,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_orders,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.seller_id = ?
    `).bind(sellerId).first();
        // 매출 통계
        const revenueStats = await db.prepare(`
      SELECT 
        COALESCE(SUM(o.total_price), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.total_price ELSE 0 END), 0) as confirmed_revenue,
        COALESCE(SUM(CASE WHEN DATE(o.created_at) = DATE('now') THEN o.total_price ELSE 0 END), 0) as today_revenue,
        COALESCE(SUM(CASE WHEN DATE(o.created_at) >= DATE('now', '-30 days') THEN o.total_price ELSE 0 END), 0) as month_revenue
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.seller_id = ? AND o.status != 'cancelled'
    `).bind(sellerId).first();
        // 최근 7일 매출 추이
        const recentRevenue = await db.prepare(`
      SELECT 
        DATE(o.created_at) as date,
        COUNT(*) as order_count,
        SUM(o.total_price) as revenue
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE p.seller_id = ? 
        AND o.status != 'cancelled'
        AND DATE(o.created_at) >= DATE('now', '-7 days')
      GROUP BY DATE(o.created_at)
      ORDER BY date DESC
    `).bind(sellerId).all();
        // 인기 상품 TOP 5
        const topProducts = await db.prepare(`
      SELECT 
        p.id,
        p.name,
        p.price,
        COUNT(o.id) as order_count,
        SUM(o.total_price) as total_revenue
      FROM products p
      LEFT JOIN orders o ON p.id = o.product_id AND o.status != 'cancelled'
      WHERE p.seller_id = ?
      GROUP BY p.id, p.name, p.price
      ORDER BY order_count DESC
      LIMIT 5
    `).bind(sellerId).all();
        return c.json({
            success: true,
            stats: {
                products: {
                    total: productsCount?.total || 0
                },
                orders: {
                    total: ordersStats?.total_orders || 0,
                    pending: ordersStats?.pending_orders || 0,
                    confirmed: ordersStats?.confirmed_orders || 0,
                    shipped: ordersStats?.shipped_orders || 0,
                    delivered: ordersStats?.delivered_orders || 0,
                    cancelled: ordersStats?.cancelled_orders || 0
                },
                revenue: {
                    total: revenueStats?.total_revenue || 0,
                    confirmed: revenueStats?.confirmed_revenue || 0,
                    today: revenueStats?.today_revenue || 0,
                    month: revenueStats?.month_revenue || 0
                },
                recent_revenue: recentRevenue.results || [],
                top_products: topProducts.results || []
            }
        });
    }
    catch (error) {
        console.error('Get seller stats error:', error);
        return c.json({
            success: false,
            error: error.message || 'Failed to get seller stats'
        }, 500);
    }
});
