/**
 * Orders API Routes (간소화 버전)
 * 
 * Endpoints:
 * - GET  /api/orders         - 주문 목록 조회
 * - GET  /api/orders/:id     - 주문 상세 조회
 * - POST /api/orders         - 주문 생성
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { OrderRepository } from '../repositories/OrderRepository';
import type { OrderFilter, OrderCreateInput } from '../types';

type Bindings = {
  DB: D1Database;
};

export const ordersRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/orders
 * 주문 목록 조회
 */
ordersRoutes.get('/', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const filter: OrderFilter = {
      userId: c.req.query('user_id') ? Number(c.req.query('user_id')) : undefined,
      sellerId: c.req.query('seller_id') ? Number(c.req.query('seller_id')) : undefined,
      status: c.req.query('status') as any,
    };
    
    const repository = new OrderRepository(DB);
    const orders = await repository.findAll(filter);
    
    return c.json({
      success: true,
      data: orders
    });
    
  } catch (error) {
    console.error('[Orders API] Get list error:', error);
    return c.json({
      success: false,
      error: (error as Error).message
    }, 500);
  }
});

/**
 * GET /api/orders/:id
 * 주문 상세 조회
 */
ordersRoutes.get('/:id', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const id = Number(c.req.param('id'));
    
    if (isNaN(id)) {
      return c.json({
        success: false,
        error: 'Invalid order ID'
      }, 400);
    }
    
    const repository = new OrderRepository(DB);
    const order = await repository.findById(id);
    
    if (!order) {
      return c.json({
        success: false,
        error: 'Order not found'
      }, 404);
    }
    
    // 주문 아이템도 함께 조회
    const items = await repository.findItems(id);
    
    return c.json({
      success: true,
      data: {
        ...order,
        items
      }
    });
    
  } catch (error) {
    console.error('[Orders API] Get detail error:', error);
    return c.json({
      success: false,
      error: (error as Error).message
    }, 500);
  }
});

/**
 * POST /api/orders
 * 주문 생성
 */
ordersRoutes.post('/', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const data: OrderCreateInput = await c.req.json();
    
    // 필수 필드 검증
    if (!data.user_id || !data.seller_id || !data.items || data.items.length === 0) {
      return c.json({
        success: false,
        error: 'Missing required fields'
      }, 400);
    }
    
    const repository = new OrderRepository(DB);
    const order = await repository.create(data);
    
    return c.json({
      success: true,
      data: order
    }, 201);
    
  } catch (error) {
    console.error('[Orders API] Create error:', error);
    return c.json({
      success: false,
      error: (error as Error).message
    }, 500);
  }
});

export default ordersRoutes;
