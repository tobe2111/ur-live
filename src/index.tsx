import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import type { Bindings, ApiResponse, LiveStream, Product, ProductOption, User, CartItem, Order, OrderItem } from './types';

const app = new Hono<{ Bindings: Bindings }>();

// CORS 설정
app.use('/api/*', cors());

// 정적 파일 서빙
app.use('/static/*', serveStatic({ root: './public' }));

// =================================
// API Routes
// =================================

// Live Stream API
app.get('/api/streams', async (c) => {
  const { DB } = c.env;
  try {
    const result = await DB.prepare(
      'SELECT * FROM live_streams WHERE status = ? ORDER BY created_at DESC'
    ).bind('live').all();

    return c.json<ApiResponse>({
      success: true,
      data: result.results,
    });
  } catch (err) {
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

app.get('/api/streams/:id', async (c) => {
  const { DB } = c.env;
  const id = c.req.param('id');

  try {
    const stream = await DB.prepare(`
      SELECT ls.*, 
             p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
             p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
      FROM live_streams ls
      LEFT JOIN products p ON ls.current_product_id = p.id
      WHERE ls.id = ?
    `).bind(id).first();

    if (!stream) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Stream not found',
      }, 404);
    }

    return c.json<ApiResponse>({
      success: true,
      data: stream,
    });
  } catch (err) {
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

// Product API
app.get('/api/products/:id', async (c) => {
  const { DB } = c.env;
  const id = c.req.param('id');

  try {
    // 상품 정보 조회
    const product = await DB.prepare(
      'SELECT * FROM products WHERE id = ? AND is_active = 1'
    ).bind(id).first();

    if (!product) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Product not found',
      }, 404);
    }

    // 상품 옵션 조회
    const options = await DB.prepare(
      'SELECT * FROM product_options WHERE product_id = ?'
    ).bind(id).all();

    return c.json<ApiResponse>({
      success: true,
      data: {
        product,
        options: options.results,
      },
    });
  } catch (err) {
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

app.get('/api/streams/:streamId/products', async (c) => {
  const { DB } = c.env;
  const streamId = c.req.param('streamId');

  try {
    const result = await DB.prepare(
      'SELECT * FROM products WHERE live_stream_id = ? AND is_active = 1 ORDER BY created_at DESC'
    ).bind(streamId).all();

    return c.json<ApiResponse>({
      success: true,
      data: result.results,
    });
  } catch (err) {
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

// Cart API
app.get('/api/cart/:userId', async (c) => {
  const { DB } = c.env;
  const tossUserId = c.req.param('userId');

  try {
    // 사용자 ID 조회 (toss_user_id -> user.id)
    const user = await DB.prepare(
      'SELECT id FROM users WHERE toss_user_id = ?'
    ).bind(tossUserId).first();

    if (!user) {
      return c.json<ApiResponse>({
        success: true,
        data: [], // 사용자가 없으면 빈 장바구니 반환
      });
    }

    const userId = user.id as number;

    const result = await DB.prepare(`
      SELECT 
        ci.*,
        p.name as product_name,
        p.image_url as image_url,
        po.option_value as option_value
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      LEFT JOIN product_options po ON ci.option_id = po.id
      WHERE ci.user_id = ?
      ORDER BY ci.added_at DESC
    `).bind(userId).all();

    return c.json<ApiResponse>({
      success: true,
      data: result.results,
    });
  } catch (err) {
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

// 사용자 생성 (게스트 유저 자동 생성용)
app.post('/api/users', async (c) => {
  const { DB } = c.env;

  try {
    const body = await c.req.json();
    const { tossUserId, name, email, phone } = body;

    if (!tossUserId || !name) {
      return c.json<ApiResponse>({
        success: false,
        error: 'tossUserId and name are required',
      }, 400);
    }

    // 이미 존재하는 사용자인지 확인
    const existingUser = await DB.prepare(
      'SELECT id FROM users WHERE toss_user_id = ?'
    ).bind(tossUserId).first();

    if (existingUser) {
      return c.json<ApiResponse<{ id: number }>>({
        success: true,
        data: { id: existingUser.id as number },
      });
    }

    // 새 사용자 생성
    const result = await DB.prepare(
      'INSERT INTO users (toss_user_id, name, email, phone) VALUES (?, ?, ?, ?)'
    ).bind(
      tossUserId,
      name,
      email || null,
      phone || null
    ).run();

    return c.json<ApiResponse<{ id: number }>>({
      success: true,
      data: { id: result.meta.last_row_id },
    });
  } catch (err) {
    console.error('Error creating user:', err);
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

app.post('/api/cart', async (c) => {
  const { DB } = c.env;

  try {
    const body = await c.req.json();
    const { userId, tossUserId, productId, optionId, quantity, priceSnapshot, liveStreamId } = body;
    
    // userId 또는 tossUserId 중 하나를 사용
    const userIdToUse = tossUserId || userId;
    
    if (!userIdToUse) {
      return c.json<ApiResponse>({
        success: false,
        error: 'userId or tossUserId is required',
      }, 400);
    }

    // 사용자 ID 조회 (toss_user_id -> user.id)
    const user = await DB.prepare(
      'SELECT id FROM users WHERE toss_user_id = ?'
    ).bind(userIdToUse).first();

    if (!user) {
      return c.json<ApiResponse>({
        success: false,
        error: 'User not found',
      }, 404);
    }

    const dbUserId = user.id as number;

    // 상품 재고 확인
    const product = await DB.prepare(
      'SELECT stock FROM products WHERE id = ?'
    ).bind(productId).first();

    if (!product || (product.stock as number) < quantity) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Insufficient stock',
      }, 400);
    }

    // 장바구니에 추가
    const result = await DB.prepare(`
      INSERT INTO cart_items (user_id, product_id, option_id, quantity, price_snapshot, live_stream_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      dbUserId, 
      productId, 
      optionId || null,  // null 처리
      quantity, 
      priceSnapshot, 
      liveStreamId || null  // null 처리
    ).run();

    return c.json<ApiResponse>({
      success: true,
      data: { id: result.meta.last_row_id },
    });
  } catch (err) {
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

app.delete('/api/cart/:cartItemId', async (c) => {
  const { DB } = c.env;
  const cartItemId = c.req.param('cartItemId');

  try {
    await DB.prepare(
      'DELETE FROM cart_items WHERE id = ?'
    ).bind(cartItemId).run();

    return c.json<ApiResponse>({
      success: true,
    });
  } catch (err) {
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

// 장바구니 아이템 수량 변경
app.put('/api/cart/:cartItemId', async (c) => {
  const { DB } = c.env;
  const cartItemId = c.req.param('cartItemId');

  try {
    const body = await c.req.json();
    const { quantity } = body;

    if (!quantity || quantity < 1) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Invalid quantity',
      }, 400);
    }

    // 재고 확인
    const cartItem = await DB.prepare(`
      SELECT ci.product_id, p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id = ?
    `).bind(cartItemId).first();

    if (!cartItem) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Cart item not found',
      }, 404);
    }

    if ((cartItem.stock as number) < quantity) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Insufficient stock',
      }, 400);
    }

    // 수량 업데이트
    await DB.prepare(
      'UPDATE cart_items SET quantity = ? WHERE id = ?'
    ).bind(quantity, cartItemId).run();

    return c.json<ApiResponse>({
      success: true,
    });
  } catch (err) {
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

// Order API
app.post('/api/orders', async (c) => {
  const { DB } = c.env;

  try {
    const { userId, cartItemIds, shippingInfo } = await c.req.json();

    // 장바구니 아이템 조회
    const placeholders = cartItemIds.map(() => '?').join(',');
    const cartItems = await DB.prepare(`
      SELECT 
        ci.*,
        p.name as product_name,
        p.stock as product_stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id IN (${placeholders})
    `).bind(...cartItemIds).all();

    if (cartItems.results.length === 0) {
      return c.json<ApiResponse>({
        success: false,
        error: 'No items found',
      }, 400);
    }

    // 재고 확인
    for (const item of cartItems.results) {
      if ((item.product_stock as number) < (item.quantity as number)) {
        return c.json<ApiResponse>({
          success: false,
          error: `Insufficient stock for ${item.product_name}`,
        }, 400);
      }
    }

    // 총 금액 계산
    const totalAmount = cartItems.results.reduce(
      (sum, item) => sum + (item.price_snapshot as number) * (item.quantity as number),
      0
    );

    // 주문 번호 생성
    const orderNumber = `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // 주문 생성
    const orderResult = await DB.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount,
        shipping_address, shipping_name, shipping_phone
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      orderNumber,
      userId,
      totalAmount,
      shippingInfo.address,
      shippingInfo.name,
      shippingInfo.phone
    ).run();

    const orderId = orderResult.meta.last_row_id;

    // 주문 아이템 생성
    for (const item of cartItems.results) {
      await DB.prepare(`
        INSERT INTO order_items (
          order_id, product_id, option_id, quantity, price, product_name
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        orderId,
        item.product_id,
        item.option_id,
        item.quantity,
        item.price_snapshot,
        item.product_name
      ).run();

      // 재고 감소
      await DB.prepare(
        'UPDATE products SET stock = stock - ? WHERE id = ?'
      ).bind(item.quantity, item.product_id).run();
    }

    // 장바구니에서 제거
    await DB.prepare(`
      DELETE FROM cart_items WHERE id IN (${placeholders})
    `).bind(...cartItemIds).run();

    return c.json<ApiResponse>({
      success: true,
      data: {
        orderId,
        orderNumber,
        totalAmount,
      },
    });
  } catch (err) {
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

app.get('/api/orders/:userId', async (c) => {
  const { DB } = c.env;
  const userId = c.req.param('userId');

  try {
    const result = await DB.prepare(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(userId).all();

    return c.json<ApiResponse>({
      success: true,
      data: result.results,
    });
  } catch (err) {
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

// 현재 상품 조회 API (폴링용)
app.get('/api/streams/:streamId/current-product', async (c) => {
  const { DB } = c.env;
  const streamId = c.req.param('streamId');

  try {
    // 라이브 스트림의 현재 상품 ID 조회
    const stream = await DB.prepare(
      'SELECT current_product_id FROM live_streams WHERE id = ?'
    ).bind(streamId).first();

    if (!stream || !stream.current_product_id) {
      return c.json<ApiResponse>({
        success: true,
        data: null,
      });
    }

    // 상품 정보 조회
    const product = await DB.prepare(
      'SELECT * FROM products WHERE id = ?'
    ).bind(stream.current_product_id).first();

    // 상품 옵션 조회
    const options = await DB.prepare(
      'SELECT * FROM product_options WHERE product_id = ?'
    ).bind(stream.current_product_id).all();

    return c.json<ApiResponse>({
      success: true,
      data: {
        product,
        options: options.results,
      },
    });
  } catch (err) {
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

// Admin: 상품 전환 API
app.post('/api/admin/streams/:streamId/change-product', async (c) => {
  const { DB } = c.env;
  const streamId = c.req.param('streamId');

  try {
    const { productId } = await c.req.json();

    // 상품 정보 조회
    const product = await DB.prepare(
      'SELECT * FROM products WHERE id = ? AND is_active = 1'
    ).bind(productId).first();

    if (!product) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Product not found',
      }, 404);
    }

    // 상품 옵션 조회
    const options = await DB.prepare(
      'SELECT * FROM product_options WHERE product_id = ?'
    ).bind(productId).all();

    // 라이브 스트림 업데이트
    await DB.prepare(
      'UPDATE live_streams SET current_product_id = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(productId, streamId).run();

    return c.json<ApiResponse>({
      success: true,
      data: {
        product,
        options: options.results,
      },
    });
  } catch (err) {
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

// =================================
// Frontend Routes
// =================================

// 메인 페이지
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>토스 라이브 커머스</title>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/style.css?v=${Date.now()}" rel="stylesheet">
        <style>
          /* 토스 브랜드 컬러 */
          :root {
            --toss-blue: #3182F6;
            --toss-gray: #191F28;
            --toss-light-gray: #F2F4F6;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          }
          .toss-primary {
            background-color: var(--toss-blue);
          }
          .toss-text-primary {
            color: var(--toss-blue);
          }
        </style>
    </head>
    <body class="bg-gray-50">
        <div id="app">
            <!-- 앱 컨텐츠 로드 중 -->
            <div class="flex items-center justify-center min-h-screen">
                <div class="text-center">
                    <i class="fas fa-spinner fa-spin text-4xl text-blue-500 mb-4"></i>
                    <p class="text-gray-600">라이브 커머스 로드 중...</p>
                </div>
            </div>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="https://www.youtube.com/iframe_api"></script>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `);
});

// 라이브 스트림 뷰어 페이지
app.get('/live/:streamId', (c) => {
  const streamId = c.req.param('streamId');
  
  return c.html(`
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>토스 라이브 커머스</title>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { 
            width: 100%; 
            height: 100%; 
            overflow: hidden; 
            font-family: "Toss Face", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
        }
        
        /* YouTube 배경 - object-fit: cover */
        #youtube-bg { 
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 100%; 
            height: 100vh; 
            z-index: 0; 
            background: #000; 
            overflow: hidden; 
        }
        #youtube-player { 
            position: absolute; 
            top: 50%; 
            left: 50%; 
            width: 177.77vh; 
            height: 56.25vw; 
            min-width: 100%; 
            min-height: 100%; 
            transform: translate(-50%, -50%); 
        }
        
        /* Overlay UI */
        .overlay-ui { 
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 100%; 
            height: 100%; 
            z-index: 10; 
            pointer-events: none; 
        }
        .overlay-ui > * { pointer-events: auto; }
        
        /* 상단 바 */
        .top-bar { 
            position: absolute; 
            top: 0; 
            left: 0; 
            right: 0; 
            padding: 12px 16px; 
            padding-top: calc(12px + env(safe-area-inset-top)); 
            background: linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 100%); 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
        }
        .live-badge { 
            background: #ff0000; 
            color: white; 
            padding: 4px 12px; 
            border-radius: 16px; 
            font-size: 12px; 
            font-weight: bold; 
        }
        .viewer-count { 
            color: white; 
            font-size: 13px; 
            font-weight: 600; 
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8)); 
            display: flex; 
            align-items: center; 
            gap: 4px; 
        }
        
        /* 채팅창 - 완전 투명 + 강한 drop-shadow */
        .chat-container { 
            position: absolute; 
            bottom: 100px; 
            left: 16px; 
            right: 80px; 
            max-height: 150px; 
            overflow-y: auto; 
            pointer-events: none; 
            display: flex; 
            flex-direction: column; 
            gap: 4px; 
        }
        .chat-message { 
            color: white; 
            font-size: 14px; 
            font-weight: 500; 
            line-height: 1.4; 
            filter: drop-shadow(0 2px 6px rgba(0,0,0,0.9)); 
            pointer-events: auto; 
            word-wrap: break-word; 
        }
        .chat-message.system { 
            color: #FFD700; 
            font-weight: 700; 
            filter: drop-shadow(0 2px 8px rgba(0,0,0,1)); 
        }
        .chat-username { 
            font-weight: 700; 
            margin-right: 4px; 
        }
        .chat-container::-webkit-scrollbar { display: none; }
        
        /* 우측 퀵 아이콘 - 콤팩트 */
        .side-icons { 
            position: absolute; 
            right: 16px; 
            bottom: 140px; 
            display: flex; 
            flex-direction: column; 
            gap: 12px; 
        }
        .icon-btn { 
            width: 44px; 
            height: 44px; 
            background: rgba(0,0,0,0.4); 
            border-radius: 50%; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            color: white; 
            font-size: 18px; 
            backdrop-filter: blur(4px); 
            cursor: pointer; 
            transition: all 0.2s; 
            border: none; 
        }
        .icon-btn:active { 
            transform: scale(0.9); 
            background: rgba(0,0,0,0.6); 
        }
        .icon-btn .badge { 
            position: absolute; 
            top: -2px; 
            right: -2px; 
            background: #ff0000; 
            color: white; 
            font-size: 10px; 
            padding: 2px 5px; 
            border-radius: 8px; 
            font-weight: bold; 
        }
        
        /* 하단 상품 정보 및 버튼 - 완전 밀착 */
        .bottom-product-area { 
            position: absolute; 
            bottom: 0; 
            left: 0; 
            right: 0; 
            padding: 12px 16px; 
            padding-bottom: calc(12px + env(safe-area-inset-bottom)); 
            background: linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 70%, transparent 100%); 
            display: flex; 
            align-items: center; 
            justify-content: space-between; 
            gap: 12px; 
        }
        
        .product-info { 
            flex: 1; 
            display: flex; 
            flex-direction: column; 
            gap: 2px; 
            min-width: 0; 
        }
        .product-name { 
            color: white; 
            font-size: 15px; 
            font-weight: 700; 
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8)); 
            line-height: 1.3; 
            white-space: nowrap; 
            overflow: hidden; 
            text-overflow: ellipsis; 
        }
        .product-price { 
            color: #FFD700; 
            font-size: 18px; 
            font-weight: 800; 
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8)); 
        }
        .product-price .original { 
            text-decoration: line-through; 
            color: rgba(255,255,255,0.5); 
            font-size: 13px; 
            margin-left: 6px; 
            font-weight: 500; 
        }
        
        .add-to-basket-btn { 
            background: #FF5126; 
            color: white; 
            border: none; 
            border-radius: 16px; 
            padding: 10px 20px; 
            font-size: 15px; 
            font-weight: 700; 
            cursor: pointer; 
            white-space: nowrap; 
            box-shadow: 0 4px 12px rgba(255,81,38,0.5); 
            transition: all 0.2s; 
        }
        .add-to-basket-btn:active { 
            transform: scale(0.95); 
        }
        
        /* 결제하기 버튼 (플로팅) - 우측 하단 */
        .checkout-btn { 
            position: fixed; 
            bottom: calc(80px + env(safe-area-inset-bottom)); 
            right: 16px; 
            width: 56px; 
            height: 56px; 
            background: #0064FF; 
            border: none; 
            border-radius: 50%; 
            color: white; 
            font-size: 22px; 
            cursor: pointer; 
            box-shadow: 0 6px 20px rgba(0,100,255,0.5); 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            transition: all 0.2s; 
            z-index: 100; 
        }
        .checkout-btn:active { 
            transform: scale(0.95); 
        }
        .checkout-btn .badge { 
            position: absolute; 
            top: -4px; 
            right: -4px; 
            background: #FF5126; 
            color: white; 
            font-size: 12px; 
            padding: 3px 7px; 
            border-radius: 10px; 
            font-weight: bold; 
            min-width: 20px; 
            text-align: center; 
        }
        
        /* 채팅 입력창 - 하단에서 슬라이드업 */
        .chat-input-overlay { 
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 100%; 
            height: 100%; 
            background: rgba(0,0,0,0.6); 
            z-index: 2000; 
            display: none; 
            opacity: 0; 
            transition: opacity 0.3s; 
        }
        .chat-input-overlay.active { 
            display: block; 
            opacity: 1; 
        }
        
        .chat-input-panel { 
            position: fixed; 
            bottom: 0; 
            left: 0; 
            right: 0; 
            background: white; 
            padding: 16px; 
            padding-bottom: calc(16px + env(safe-area-inset-bottom)); 
            box-shadow: 0 -4px 12px rgba(0,0,0,0.2); 
            transform: translateY(100%); 
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
            z-index: 2001; 
        }
        .chat-input-panel.active { 
            transform: translateY(0); 
        }
        
        .chat-input-row { 
            display: flex; 
            gap: 8px; 
            align-items: center; 
        }
        .chat-input { 
            flex: 1; 
            border: 2px solid #e5e8eb; 
            border-radius: 20px; 
            padding: 12px 16px; 
            font-size: 15px; 
            outline: none; 
            transition: border-color 0.2s; 
        }
        .chat-input:focus { 
            border-color: #0064FF; 
        }
        .send-btn { 
            width: 44px; 
            height: 44px; 
            background: #0064FF; 
            border: none; 
            border-radius: 50%; 
            color: white; 
            cursor: pointer; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            transition: all 0.2s; 
            flex-shrink: 0; 
        }
        .send-btn:active { 
            transform: scale(0.95); 
            background: #0052CC; 
        }
        
        /* Bottom Sheet (장바구니) - Slide-up */
        .bottom-sheet-overlay { 
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 100%; 
            height: 100%; 
            background: rgba(0,0,0,0.6); 
            z-index: 1000; 
            display: none; 
            opacity: 0; 
            transition: opacity 0.3s; 
        }
        .bottom-sheet-overlay.active { 
            display: block; 
            opacity: 1; 
        }
        
        .bottom-sheet { 
            position: fixed; 
            bottom: 0; 
            left: 0; 
            right: 0; 
            background: rgba(255,255,255,0.98); 
            backdrop-filter: blur(20px); 
            border-radius: 24px 24px 0 0; 
            padding: 20px 16px; 
            padding-bottom: calc(20px + env(safe-area-inset-bottom)); 
            max-height: 75vh; 
            overflow-y: auto; 
            transform: translateY(100%); 
            transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1); 
            z-index: 1001; 
        }
        .bottom-sheet.active { 
            transform: translateY(0); 
        }
        
        .sheet-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-bottom: 16px; 
        }
        .sheet-title { 
            font-size: 18px; 
            font-weight: 700; 
            color: #191f28; 
        }
        .sheet-close { 
            background: none; 
            border: none; 
            font-size: 28px; 
            color: #8b95a1; 
            cursor: pointer; 
            line-height: 1; 
        }
        
        .cart-items { 
            margin-bottom: 16px; 
        }
        .cart-item { 
            display: flex; 
            gap: 12px; 
            padding: 12px; 
            background: #f9fafb; 
            border-radius: 16px; 
            margin-bottom: 10px; 
        }
        .cart-item-image { 
            width: 70px; 
            height: 70px; 
            border-radius: 12px; 
            object-fit: cover; 
            flex-shrink: 0; 
        }
        .cart-item-info { 
            flex: 1; 
            display: flex; 
            flex-direction: column; 
            gap: 3px; 
            min-width: 0; 
        }
        .cart-item-name { 
            font-size: 14px; 
            font-weight: 600; 
            color: #191f28; 
            overflow: hidden; 
            text-overflow: ellipsis; 
            white-space: nowrap; 
        }
        .cart-item-price { 
            font-size: 15px; 
            font-weight: 700; 
            color: #0064FF; 
        }
        .cart-item-quantity { 
            font-size: 12px; 
            color: #8b95a1; 
        }
        
        .cart-summary { 
            padding: 16px 0; 
            border-top: 1px solid #e5e8eb; 
            margin-bottom: 12px; 
        }
        .summary-row { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-bottom: 6px; 
        }
        .summary-label { 
            font-size: 14px; 
            color: #4e5968; 
        }
        .summary-value { 
            font-size: 14px; 
            font-weight: 600; 
            color: #191f28; 
        }
        .summary-total { 
            font-size: 17px; 
            font-weight: 700; 
            color: #0064FF; 
        }
        
        .toss-pay-btn { 
            width: 100%; 
            background: #0064FF; 
            color: white; 
            border: none; 
            border-radius: 16px; 
            padding: 16px; 
            font-size: 16px; 
            font-weight: 700; 
            cursor: pointer; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            gap: 8px; 
            transition: all 0.2s; 
        }
        .toss-pay-btn:active { 
            transform: scale(0.98); 
        }
    </style>
</head>
<body>
    <!-- YouTube 배경 -->
    <div id="youtube-bg">
        <div id="youtube-player"></div>
    </div>
    
    <!-- Overlay UI -->
    <div class="overlay-ui">
        <!-- 상단 바 -->
        <div class="top-bar">
            <div class="live-badge">LIVE</div>
            <div class="viewer-count">
                <i class="fas fa-eye"></i>
                <span id="viewer-count">0</span>
            </div>
        </div>
        
        <!-- 채팅창 - 완전 투명 -->
        <div class="chat-container" id="chat-container">
            <!-- 채팅 메시지가 여기에 추가됩니다 -->
        </div>
        
        <!-- 우측 퀵 아이콘 -->
        <div class="side-icons">
            <button class="icon-btn" id="chat-btn" title="채팅">
                <i class="fas fa-comment"></i>
            </button>
            <button class="icon-btn" id="share-btn" title="공유">
                <i class="fas fa-share-alt"></i>
            </button>
        </div>
        
        <!-- 하단 상품 정보 및 버튼 - 완전 밀착 -->
        <div class="bottom-product-area">
            <div class="product-info">
                <div class="product-name" id="product-name">상품 불러오는 중...</div>
                <div class="product-price">
                    <span id="product-price">0원</span>
                    <span class="original" id="product-original-price" style="display: none;"></span>
                </div>
            </div>
            <button class="add-to-basket-btn" id="add-to-basket-btn">담아두기</button>
        </div>
        
        <!-- 결제하기 버튼 (플로팅) -->
        <button class="checkout-btn" id="checkout-btn">
            <i class="fas fa-shopping-bag"></i>
            <span class="badge" id="cart-count" style="display: none;">0</span>
        </button>
    </div>

    <!-- 채팅 입력 패널 -->
    <div class="chat-input-overlay" id="chat-input-overlay" onclick="closeChatInput()"></div>
    <div class="chat-input-panel" id="chat-input-panel">
        <div class="chat-input-row">
            <input type="text" class="chat-input" id="chat-input" placeholder="메시지를 입력하세요" autocomplete="off">
            <button class="send-btn" id="send-btn">
                <i class="fas fa-paper-plane"></i>
            </button>
        </div>
    </div>

    <!-- Bottom Sheet (장바구니) -->
    <div class="bottom-sheet-overlay" id="sheet-overlay" onclick="closeBottomSheet()"></div>
    <div class="bottom-sheet" id="bottom-sheet">
        <div class="sheet-header">
            <div class="sheet-title">장바구니 (<span id="sheet-cart-count">0</span>)</div>
            <button class="sheet-close" onclick="closeBottomSheet()">×</button>
        </div>
        
        <div class="cart-items" id="cart-items-list">
            <!-- 장바구니 아이템이 여기에 추가됩니다 -->
        </div>
        
        <div class="cart-summary">
            <div class="summary-row">
                <span class="summary-label">상품 금액</span>
                <span class="summary-value" id="summary-subtotal">0원</span>
            </div>
            <div class="summary-row">
                <span class="summary-label">배송비</span>
                <span class="summary-value">무료</span>
            </div>
            <div class="summary-row" style="margin-top: 8px;">
                <span class="summary-label" style="font-size: 16px; font-weight: 600;">총 결제 금액</span>
                <span class="summary-total" id="summary-total">0원</span>
            </div>
        </div>
        
        <button class="toss-pay-btn" id="toss-pay-btn">
            <span>토스페이로 결제하기</span>
        </button>
    </div>

    <script src="https://www.youtube.com/iframe_api"></script>
    <script>
        const STREAM_ID = '${streamId}';
        const API_BASE = '/api';
        let currentProduct = null;
        let player = null;
        let chatMessages = [];
        const MAX_CHAT_MESSAGES = 5;
        let cartItems = [];
        
        // 초기화
        document.addEventListener('DOMContentLoaded', async () => {
            await loadStreamData();
            startProductPolling();
            setupEventListeners();
            loadSampleChats();
            updateCartUI();
        });
        
        // 스트림 데이터 로드 - 수정된 파싱
        async function loadStreamData() {
            try {
                const response = await axios.get(API_BASE + '/streams/' + STREAM_ID);
                if (response.data.success) {
                    const stream = response.data.data;
                    initYouTubePlayer(stream.youtube_video_id);
                    document.getElementById('viewer-count').textContent = stream.viewer_count || 0;
                    
                    // 상품 정보 파싱 - API 구조에 맞게 수정
                    if (stream.product_name) {
                        const product = {
                            id: stream.current_product_id || 1,
                            name: stream.product_name,
                            price: stream.price,
                            original_price: stream.original_price,
                            image_url: stream.image_url,
                            stock: stream.stock
                        };
                        updateProductInfo(product);
                    }
                }
            } catch (error) {
                console.error('Failed to load stream data:', error);
            }
        }
        
        // YouTube 플레이어 초기화
        function initYouTubePlayer(videoId) {
            player = new YT.Player('youtube-player', {
                videoId: videoId,
                playerVars: {
                    autoplay: 1,
                    controls: 0,
                    modestbranding: 1,
                    rel: 0,
                    showinfo: 0,
                    fs: 0,
                    playsinline: 1,
                    loop: 1,
                    playlist: videoId,
                    mute: 1
                },
                events: {
                    onReady: (event) => {
                        event.target.playVideo();
                    }
                }
            });
        }
        
        // 상품 정보 업데이트
        function updateProductInfo(product) {
            currentProduct = product;
            document.getElementById('product-name').textContent = product.name;
            
            const price = parseInt(product.price || 0);
            document.getElementById('product-price').textContent = price.toLocaleString() + '원';
            
            if (product.original_price && product.original_price > product.price) {
                const originalPrice = parseInt(product.original_price);
                document.getElementById('product-original-price').textContent = originalPrice.toLocaleString() + '원';
                document.getElementById('product-original-price').style.display = 'inline';
            } else {
                document.getElementById('product-original-price').style.display = 'none';
            }
        }
        
        // 실시간 상품 폴링 - 수정된 파싱
        function startProductPolling() {
            setInterval(async () => {
                try {
                    const response = await axios.get(API_BASE + '/streams/' + STREAM_ID);
                    if (response.data.success && response.data.data.product_name) {
                        const stream = response.data.data;
                        const newProduct = {
                            id: stream.current_product_id || 1,
                            name: stream.product_name,
                            price: stream.price,
                            original_price: stream.original_price,
                            image_url: stream.image_url,
                            stock: stream.stock
                        };
                        
                        if (!currentProduct || currentProduct.id !== newProduct.id) {
                            updateProductInfo(newProduct);
                        }
                    }
                } catch (error) {
                    console.error('Polling error:', error);
                }
            }, 3000);
        }
        
        // 채팅 메시지 추가
        function addChatMessage(username, message, isSystem = false) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'chat-message' + (isSystem ? ' system' : '');
            
            if (isSystem) {
                messageDiv.textContent = message;
            } else {
                messageDiv.innerHTML = '<span class="chat-username">' + username + ':</span>' + message;
            }
            
            const container = document.getElementById('chat-container');
            container.appendChild(messageDiv);
            chatMessages.push(messageDiv);
            
            if (chatMessages.length > MAX_CHAT_MESSAGES) {
                const removed = chatMessages.shift();
                removed.remove();
            }
            
            container.scrollTop = container.scrollHeight;
        }
        
        // 샘플 채팅 로드
        function loadSampleChats() {
            const samples = [
                { username: '매니저', text: '안녕하세요! 오늘의 특가 상품을 소개합니다 🎉' },
                { username: '고객1', text: '가격 정말 좋네요!' },
                { username: '매니저', text: '지금 구매하시면 추가 할인받으실 수 있어요' }
            ];
            
            samples.forEach(msg => {
                addChatMessage(msg.username, msg.text);
            });
        }
        
        // 장바구니 UI 업데이트
        function updateCartUI() {
            const count = cartItems.reduce((sum, item) => sum + item.quantity, 0);
            const badge = document.getElementById('cart-count');
            
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
        
        // 시스템 메시지 추가 (로컬)
        function sendSystemMessage(message) {
            addChatMessage('', message, true);
        }
        
        // 채팅 입력창 열기/닫기
        function openChatInput() {
            const overlay = document.getElementById('chat-input-overlay');
            const panel = document.getElementById('chat-input-panel');
            const input = document.getElementById('chat-input');
            
            overlay.classList.add('active');
            panel.classList.add('active');
            
            // 약간의 딜레이 후 키보드 포커스
            setTimeout(() => {
                input.focus();
            }, 300);
        }
        
        function closeChatInput() {
            const overlay = document.getElementById('chat-input-overlay');
            const panel = document.getElementById('chat-input-panel');
            
            overlay.classList.remove('active');
            panel.classList.remove('active');
        }
        
        // Bottom Sheet 열기/닫기
        function openBottomSheet() {
            const overlay = document.getElementById('sheet-overlay');
            const sheet = document.getElementById('bottom-sheet');
            
            overlay.classList.add('active');
            sheet.classList.add('active');
            
            renderCartItems();
        }
        
        function closeBottomSheet() {
            const overlay = document.getElementById('sheet-overlay');
            const sheet = document.getElementById('bottom-sheet');
            
            overlay.classList.remove('active');
            sheet.classList.remove('active');
        }
        
        // 장바구니 아이템 렌더링
        function renderCartItems() {
            const container = document.getElementById('cart-items-list');
            const count = cartItems.reduce((sum, item) => sum + item.quantity, 0);
            const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            
            document.getElementById('sheet-cart-count').textContent = count;
            
            if (cartItems.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 40px 0; color: #8b95a1;">장바구니가 비어있습니다</div>';
                document.getElementById('summary-subtotal').textContent = '0원';
                document.getElementById('summary-total').textContent = '0원';
                return;
            }
            
            container.innerHTML = cartItems.map(item => {
                const itemTotal = item.price * item.quantity;
                return '<div class="cart-item"><img class="cart-item-image" src="' + (item.image_url || 'https://via.placeholder.com/70') + '" alt="' + item.name + '"><div class="cart-item-info"><div class="cart-item-name">' + item.name + '</div><div class="cart-item-price">' + item.price.toLocaleString() + '원</div><div class="cart-item-quantity">수량: ' + item.quantity + '개 | 합계: ' + itemTotal.toLocaleString() + '원</div></div></div>';
            }).join('');
            
            document.getElementById('summary-subtotal').textContent = subtotal.toLocaleString() + '원';
            document.getElementById('summary-total').textContent = subtotal.toLocaleString() + '원';
        }
        
        // 이벤트 리스너 설정
        function setupEventListeners() {
            // 담아두기 버튼
            document.getElementById('add-to-basket-btn').addEventListener('click', () => {
                if (!currentProduct) {
                    alert('상품 정보를 불러오는 중입니다.');
                    return;
                }
                
                const existingItem = cartItems.find(item => item.product_id === currentProduct.id);
                if (existingItem) {
                    existingItem.quantity += 1;
                } else {
                    cartItems.push({
                        product_id: currentProduct.id,
                        name: currentProduct.name,
                        price: parseInt(currentProduct.price || 0),
                        image_url: currentProduct.image_url,
                        quantity: 1
                    });
                }
                
                updateCartUI();
                
                const userName = '고객' + Math.floor(Math.random() * 1000);
                const systemMsg = '시스템: ' + userName + '님이 ' + currentProduct.name + ' 구매했습니다! 🎁';
                sendSystemMessage(systemMsg);
                
                const btn = document.getElementById('add-to-basket-btn');
                const originalText = btn.textContent;
                const originalBg = btn.style.background;
                btn.textContent = '담았어요! ✓';
                btn.style.background = '#4CAF50';
                
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = originalBg || '#FF5126';
                }, 1000);
            });
            
            // 채팅 버튼 (하트 대신)
            document.getElementById('chat-btn').addEventListener('click', () => {
                openChatInput();
            });
            
            // 채팅 전송
            const sendMessage = () => {
                const input = document.getElementById('chat-input');
                const message = input.value.trim();
                if (message) {
                    addChatMessage('나', message);
                    input.value = '';
                    closeChatInput();
                }
            };
            
            document.getElementById('send-btn').addEventListener('click', sendMessage);
            document.getElementById('chat-input').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') sendMessage();
            });
            
            // 결제하기 버튼
            document.getElementById('checkout-btn').addEventListener('click', () => {
                if (cartItems.length === 0) {
                    alert('장바구니에 상품을 담아주세요');
                    return;
                }
                openBottomSheet();
            });
            
            // 토스페이 결제 버튼
            document.getElementById('toss-pay-btn').addEventListener('click', async () => {
                if (cartItems.length === 0) {
                    alert('장바구니가 비어있습니다');
                    return;
                }
                
                alert('토스페이 결제 기능은 곧 추가될 예정입니다.\\n\\n총 ' + cartItems.reduce((sum, item) => sum + item.quantity, 0) + '개 상품, ' + cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toLocaleString() + '원');
            });
            
            // 공유 버튼
            document.getElementById('share-btn').addEventListener('click', async () => {
                const url = window.location.href;
                
                if (navigator.share) {
                    try {
                        await navigator.share({
                            title: '토스 라이브 커머스',
                            text: '실시간 라이브 쇼핑을 시청하세요!',
                            url: url
                        });
                    } catch (error) {
                        console.log('Share cancelled');
                    }
                } else {
                    try {
                        await navigator.clipboard.writeText(url);
                        alert('링크가 복사되었습니다!');
                    } catch (error) {
                        alert('링크: ' + url);
                    }
                }
            });
        }
    </script>
</body>
</html>
  `);
});

app.post('/api/seller/products', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const { name, description, price, original_price, image_url, stock, category, live_stream_id } = await c.req.json();

    if (!name || !price || !stock) {
      return c.json({ success: false, error: 'Name, price, and stock are required' }, 400);
    }

    // Calculate discount rate
    const discount_rate = original_price ? Math.round(((original_price - price) / original_price) * 100) : 0;

    const result = await DB.prepare(
      'INSERT INTO products (name, description, price, original_price, discount_rate, image_url, stock, category, live_stream_id, seller_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)'
    ).bind(name, description || '', price, original_price || null, discount_rate, image_url || null, stock, category || '기타', live_stream_id || null, auth.sellerId).run();

    return c.json({
      success: true,
      data: {
        id: result.meta.last_row_id,
        name,
        description,
        price,
        original_price,
        discount_rate,
        image_url,
        stock,
        category,
        seller_id: auth.sellerId
      }
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Update product
app.put('/api/seller/products/:id', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const id = c.req.param('id');
    
    // Verify ownership
    const product = await DB.prepare('SELECT * FROM products WHERE id = ? AND seller_id = ?').bind(id, auth.sellerId).first();
    
    if (!product) {
      return c.json({ success: false, error: 'Product not found or unauthorized' }, 404);
    }

    const { name, description, price, original_price, image_url, stock, category, is_active } = await c.req.json();

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (price !== undefined) {
      updates.push('price = ?');
      values.push(price);
    }
    if (original_price !== undefined) {
      updates.push('original_price = ?');
      values.push(original_price);
      
      // Recalculate discount rate
      if (price !== undefined && original_price) {
        const discount_rate = Math.round(((original_price - price) / original_price) * 100);
        updates.push('discount_rate = ?');
        values.push(discount_rate);
      }
    }
    if (image_url !== undefined) {
      updates.push('image_url = ?');
      values.push(image_url);
    }
    if (stock !== undefined) {
      updates.push('stock = ?');
      values.push(stock);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      values.push(category);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id, auth.sellerId);

    if (updates.length === 1) {
      return c.json({ success: false, error: 'No fields to update' }, 400);
    }

    await DB.prepare(
      `UPDATE products SET ${updates.join(', ')} WHERE id = ? AND seller_id = ?`
    ).bind(...values).run();

    // Get updated product
    const updatedProduct = await DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();

    return c.json({ success: true, data: updatedProduct });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Delete product
app.delete('/api/seller/products/:id', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const id = c.req.param('id');

    // Verify ownership
    const product = await DB.prepare('SELECT * FROM products WHERE id = ? AND seller_id = ?').bind(id, auth.sellerId).first();
    
    if (!product) {
      return c.json({ success: false, error: 'Product not found or unauthorized' }, 404);
    }

    await DB.prepare('DELETE FROM products WHERE id = ? AND seller_id = ?').bind(id, auth.sellerId).run();

    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Get product options
app.get('/api/seller/products/:id/options', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const id = c.req.param('id');

    // Verify ownership
    const product = await DB.prepare('SELECT * FROM products WHERE id = ? AND seller_id = ?').bind(id, auth.sellerId).first();
    
    if (!product) {
      return c.json({ success: false, error: 'Product not found or unauthorized' }, 404);
    }

    const result = await DB.prepare(
      'SELECT * FROM product_options WHERE product_id = ? ORDER BY id'
    ).bind(id).all();

    return c.json({ success: true, data: result.results });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Add product option
app.post('/api/seller/products/:id/options', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const product_id = c.req.param('id');

    // Verify ownership
    const product = await DB.prepare('SELECT * FROM products WHERE id = ? AND seller_id = ?').bind(product_id, auth.sellerId).first();
    
    if (!product) {
      return c.json({ success: false, error: 'Product not found or unauthorized' }, 404);
    }

    const { option_type, option_value, price_adjustment, stock } = await c.req.json();

    if (!option_type || !option_value) {
      return c.json({ success: false, error: 'Option type and value are required' }, 400);
    }

    const result = await DB.prepare(
      'INSERT INTO product_options (product_id, option_type, option_value, price_adjustment, stock) VALUES (?, ?, ?, ?, ?)'
    ).bind(product_id, option_type, option_value, price_adjustment || 0, stock || 0).run();

    return c.json({
      success: true,
      data: {
        id: result.meta.last_row_id,
        product_id,
        option_type,
        option_value,
        price_adjustment: price_adjustment || 0,
        stock: stock || 0
      }
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Delete product option
app.delete('/api/seller/products/:productId/options/:optionId', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const productId = c.req.param('productId');
    const optionId = c.req.param('optionId');

    // Verify ownership
    const product = await DB.prepare('SELECT * FROM products WHERE id = ? AND seller_id = ?').bind(productId, auth.sellerId).first();
    
    if (!product) {
      return c.json({ success: false, error: 'Product not found or unauthorized' }, 404);
    }

    await DB.prepare('DELETE FROM product_options WHERE id = ? AND product_id = ?').bind(optionId, productId).run();

    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Get seller stats
app.get('/api/seller/stats', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const products = await DB.prepare('SELECT COUNT(*) as count FROM products WHERE seller_id = ?').bind(auth.sellerId).first();
    
    const activeProducts = await DB.prepare('SELECT COUNT(*) as count FROM products WHERE seller_id = ? AND is_active = 1').bind(auth.sellerId).first();
    
    const totalStock = await DB.prepare('SELECT SUM(stock) as total FROM products WHERE seller_id = ?').bind(auth.sellerId).first();
    
    // Get orders for this seller's products
    const orders = await DB.prepare(`
      SELECT COUNT(DISTINCT o.id) as count, SUM(oi.price * oi.quantity) as total
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ?
    `).bind(auth.sellerId).first();

    return c.json({
      success: true,
      data: {
        totalProducts: products.count || 0,
        activeProducts: activeProducts.count || 0,
        totalStock: totalStock.total || 0,
        totalOrders: orders.count || 0,
        totalRevenue: orders.total || 0
      }
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// =================================
// Order Management API
// =================================

// Get user's orders
app.get('/api/orders/user/:userId', async (c) => {
  const { DB } = c.env;
  const userId = c.req.param('userId');

  try {
    // Get orders
    const orders = await DB.prepare(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(userId).all();

    // Get order items for each order
    const ordersWithItems = await Promise.all(
      orders.results.map(async (order: any) => {
        const items = await DB.prepare(`
          SELECT oi.*, p.name as product_name, p.image_url
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?
        `).bind(order.id).all();

        return {
          ...order,
          items: items.results
        };
      })
    );

    return c.json({ success: true, data: ordersWithItems });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Get order by order number
app.get('/api/orders/:orderNo', async (c) => {
  const { DB } = c.env;
  const orderNo = c.req.param('orderNo');

  try {
    const order = await DB.prepare(
      'SELECT * FROM orders WHERE order_no = ?'
    ).bind(orderNo).first();

    if (!order) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    // Get order items
    const items = await DB.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(order.id).all();

    return c.json({
      success: true,
      data: {
        ...order,
        items: items.results
      }
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Get seller's orders
app.get('/api/seller/orders', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    // Get orders that contain this seller's products
    const orders = await DB.prepare(`
      SELECT DISTINCT o.*, u.name as user_name
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE oi.seller_id = ?
      ORDER BY o.created_at DESC
    `).bind(auth.sellerId).all();

    // Get order items for each order (only this seller's items)
    const ordersWithItems = await Promise.all(
      orders.results.map(async (order: any) => {
        const items = await DB.prepare(`
          SELECT oi.*, p.name as product_name, p.image_url
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ? AND oi.seller_id = ?
        `).bind(order.id, auth.sellerId).all();

        return {
          ...order,
          items: items.results
        };
      })
    );

    return c.json({ success: true, data: ordersWithItems });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Update order status (Seller only)
app.patch('/api/seller/orders/:orderNo/status', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const orderNo = c.req.param('orderNo');
    const { status } = await c.req.json();

    // Validate status
    const validStatuses = ['PAY_COMPLETE', 'PREPARING', 'SHIPPING', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return c.json({ success: false, error: 'Invalid status' }, 400);
    }

    // Verify this order contains seller's products
    const order = await DB.prepare('SELECT id FROM orders WHERE order_no = ?').bind(orderNo).first();
    if (!order) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    const sellerItem = await DB.prepare(
      'SELECT id FROM order_items WHERE order_id = ? AND seller_id = ?'
    ).bind(order.id, auth.sellerId).first();

    if (!sellerItem) {
      return c.json({ success: false, error: 'Unauthorized' }, 403);
    }

    // Update order status
    await DB.prepare(
      'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_no = ?'
    ).bind(status, orderNo).run();

    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Request refund (Customer)
app.post('/api/orders/:orderNo/refund', async (c) => {
  const { DB } = c.env;
  const orderNo = c.req.param('orderNo');
  const { reason } = await c.req.json();

  try {
    const order = await DB.prepare('SELECT * FROM orders WHERE order_no = ?').bind(orderNo).first();

    if (!order) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    // Check if order can be refunded
    if (!['PAY_COMPLETE', 'PREPARING'].includes(order.status)) {
      return c.json({ success: false, error: 'This order cannot be refunded' }, 400);
    }

    // Update status to cancelled/refund requested
    await DB.prepare(
      'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_no = ?'
    ).bind('REFUND_REQUESTED', orderNo).run();

    // TODO: Call Toss Pay refund API

    return c.json({ success: true, message: 'Refund request submitted' });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Get all orders (Admin only)
app.get('/api/admin/orders', async (c) => {
  const { DB } = c.env;
  const auth = await verifyAdminSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const orders = await DB.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `).all();

    return c.json({ success: true, data: orders.results });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// =================================
// Toss Bridge API
// =================================

// 토스 앱에서 유저 정보 가져오기
app.get('/api/toss/user-info', async (c) => {
  try {
    // 토스 브릿지를 통해 유저 정보 가져오기
    // 실제로는 토스 앱의 JavaScript Bridge를 통해 전달받음
    
    // 예시: 토스 앱에서 전달하는 헤더 정보
    const tossUserId = c.req.header('X-Toss-User-Id');
    const tossUserName = c.req.header('X-Toss-User-Name');
    
    if (!tossUserId) {
      // 토스 브릿지가 없는 경우 (웹 브라우저 직접 접속)
      return c.json({
        success: true,
        data: {
          userId: 'web_user_' + Date.now(),
          name: '게스트',
          isGuest: true
        }
      });
    }
    
    // 토스 유저 정보 반환
    return c.json({
      success: true,
      data: {
        userId: tossUserId,
        name: tossUserName || '토스 사용자',
        isGuest: false
      }
    });
  } catch (err) {
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

// 토스페이 결제 준비 (향후 구현)
app.post('/api/toss/payment/prepare', async (c) => {
  try {
    const { orderId, amount, orderName } = await c.req.json();
    
    // TODO: 토스페이먼츠 API 연동
    // https://docs.tosspayments.com/guides/payment-widget/integration
    
    return c.json({
      success: true,
      data: {
        orderId,
        amount,
        orderName,
        // 실제로는 토스페이먼츠에서 받은 결제 정보
        clientKey: 'test_client_key',
        successUrl: `${c.req.url.split('/api')[0]}/payment/success`,
        failUrl: `${c.req.url.split('/api')[0]}/payment/fail`,
      }
    });
  } catch (err) {
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

// =================================
// Page Routes
// =================================

// 어드민 로그인 페이지
app.get('/admin/login', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>어드민 로그인 - 토스 라이브 커머스</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            :root {
                --toss-blue: #3182F6;
                --toss-gray-900: #191F28;
                --toss-gray-700: #4E5968;
                --toss-gray-600: #6B7684;
                --toss-gray-200: #E5E8EB;
                --toss-gray-100: #F2F4F6;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .login-container {
                background: white;
                border-radius: 16px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                padding: 48px;
                width: 100%;
                max-width: 420px;
            }
            
            .logo {
                text-align: center;
                margin-bottom: 32px;
            }
            
            .logo-icon {
                width: 64px;
                height: 64px;
                background: var(--toss-blue);
                border-radius: 16px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 32px;
                margin-bottom: 16px;
            }
            
            .form-group {
                margin-bottom: 20px;
            }
            
            .form-label {
                display: block;
                font-size: 14px;
                font-weight: 600;
                color: var(--toss-gray-900);
                margin-bottom: 8px;
            }
            
            .form-input {
                width: 100%;
                padding: 14px 16px;
                border: 1px solid var(--toss-gray-200);
                border-radius: 8px;
                font-size: 16px;
                transition: all 0.2s;
            }
            
            .form-input:focus {
                outline: none;
                border-color: var(--toss-blue);
                box-shadow: 0 0 0 3px rgba(49, 130, 246, 0.1);
            }
            
            .btn-login {
                width: 100%;
                padding: 16px;
                background: var(--toss-blue);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .btn-login:hover {
                background: #2563eb;
                transform: translateY(-1px);
            }
            
            .btn-login:active {
                transform: translateY(0);
            }
            
            .error-message {
                color: #ef4444;
                font-size: 14px;
                margin-top: 8px;
                display: none;
            }
            
            .error-message.show {
                display: block;
            }
            
            .link-seller {
                text-align: center;
                margin-top: 24px;
                font-size: 14px;
                color: var(--toss-gray-600);
            }
            
            .link-seller a {
                color: var(--toss-blue);
                text-decoration: none;
                font-weight: 600;
            }
        </style>
    </head>
    <body>
        <div class="login-container">
            <div class="logo">
                <div class="logo-icon">
                    <i class="fas fa-user-shield"></i>
                </div>
                <h1 style="font-size: 24px; font-weight: 700; color: var(--toss-gray-900); margin: 0;">어드민 로그인</h1>
                <p style="font-size: 14px; color: var(--toss-gray-600); margin-top: 8px;">토스 라이브 커머스 관리자</p>
            </div>
            
            <form id="loginForm">
                <div class="form-group">
                    <label class="form-label" for="username">아이디</label>
                    <input type="text" id="username" name="username" class="form-input" placeholder="아이디를 입력하세요" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="password">비밀번호</label>
                    <input type="password" id="password" name="password" class="form-input" placeholder="비밀번호를 입력하세요" required>
                </div>
                
                <div class="error-message" id="errorMessage"></div>
                
                <button type="submit" class="btn-login">로그인</button>
            </form>
            
            <div class="link-seller">
                판매자이신가요? <a href="/seller/login">판매자 로그인</a>
            </div>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            const loginForm = document.getElementById('loginForm');
            const errorMessage = document.getElementById('errorMessage');
            
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                
                try {
                    const response = await axios.post('/api/admin/login', {
                        username,
                        password
                    });
                    
                    if (response.data.success) {
                        // Store session token
                        localStorage.setItem('sessionToken', response.data.data.sessionToken);
                        localStorage.setItem('userType', 'admin');
                        localStorage.setItem('userName', response.data.data.user.name);
                        
                        // Redirect to admin dashboard
                        window.location.href = '/admin';
                    }
                } catch (error) {
                    errorMessage.textContent = error.response?.data?.error || '로그인에 실패했습니다.';
                    errorMessage.classList.add('show');
                    
                    setTimeout(() => {
                        errorMessage.classList.remove('show');
                    }, 3000);
                }
            });
            
            // Test credentials hint
            console.log('Test Admin: username=admin, password=admin123');
        </script>
    </body>
    </html>
  `);
});

// 판매자 로그인 페이지
app.get('/seller/login', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>판매자 로그인 - 토스 라이브 커머스</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            :root {
                --toss-blue: #3182F6;
                --toss-gray-900: #191F28;
                --toss-gray-700: #4E5968;
                --toss-gray-600: #6B7684;
                --toss-gray-200: #E5E8EB;
                --toss-gray-100: #F2F4F6;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", sans-serif;
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .login-container {
                background: white;
                border-radius: 16px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                padding: 48px;
                width: 100%;
                max-width: 420px;
            }
            
            .logo {
                text-align: center;
                margin-bottom: 32px;
            }
            
            .logo-icon {
                width: 64px;
                height: 64px;
                background: #f5576c;
                border-radius: 16px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 32px;
                margin-bottom: 16px;
            }
            
            .form-group {
                margin-bottom: 20px;
            }
            
            .form-label {
                display: block;
                font-size: 14px;
                font-weight: 600;
                color: var(--toss-gray-900);
                margin-bottom: 8px;
            }
            
            .form-input {
                width: 100%;
                padding: 14px 16px;
                border: 1px solid var(--toss-gray-200);
                border-radius: 8px;
                font-size: 16px;
                transition: all 0.2s;
            }
            
            .form-input:focus {
                outline: none;
                border-color: #f5576c;
                box-shadow: 0 0 0 3px rgba(245, 87, 108, 0.1);
            }
            
            .btn-login {
                width: 100%;
                padding: 16px;
                background: #f5576c;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .btn-login:hover {
                background: #f31942;
                transform: translateY(-1px);
            }
            
            .btn-login:active {
                transform: translateY(0);
            }
            
            .error-message {
                color: #ef4444;
                font-size: 14px;
                margin-top: 8px;
                display: none;
            }
            
            .error-message.show {
                display: block;
            }
            
            .link-admin {
                text-align: center;
                margin-top: 24px;
                font-size: 14px;
                color: var(--toss-gray-600);
            }
            
            .link-admin a {
                color: #f5576c;
                text-decoration: none;
                font-weight: 600;
            }
        </style>
    </head>
    <body>
        <div class="login-container">
            <div class="logo">
                <div class="logo-icon">
                    <i class="fas fa-store"></i>
                </div>
                <h1 style="font-size: 24px; font-weight: 700; color: var(--toss-gray-900); margin: 0;">판매자 로그인</h1>
                <p style="font-size: 14px; color: var(--toss-gray-600); margin-top: 8px;">토스 라이브 커머스 판매자</p>
            </div>
            
            <form id="loginForm">
                <div class="form-group">
                    <label class="form-label" for="username">아이디</label>
                    <input type="text" id="username" name="username" class="form-input" placeholder="아이디를 입력하세요" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="password">비밀번호</label>
                    <input type="password" id="password" name="password" class="form-input" placeholder="비밀번호를 입력하세요" required>
                </div>
                
                <div class="error-message" id="errorMessage"></div>
                
                <button type="submit" class="btn-login">로그인</button>
            </form>
            
            <div class="link-admin">
                관리자이신가요? <a href="/admin/login">어드민 로그인</a>
            </div>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            const loginForm = document.getElementById('loginForm');
            const errorMessage = document.getElementById('errorMessage');
            
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                
                try {
                    const response = await axios.post('/api/seller/login', {
                        username,
                        password
                    });
                    
                    if (response.data.success) {
                        // Store session token
                        localStorage.setItem('sessionToken', response.data.data.sessionToken);
                        localStorage.setItem('userType', 'seller');
                        localStorage.setItem('userName', response.data.data.user.name);
                        
                        // Redirect to seller dashboard
                        window.location.href = '/seller';
                    }
                } catch (error) {
                    errorMessage.textContent = error.response?.data?.error || '로그인에 실패했습니다.';
                    errorMessage.classList.add('show');
                    
                    setTimeout(() => {
                        errorMessage.classList.remove('show');
                    }, 3000);
                }
            });
            
            // Test credentials hint
            console.log('Test Seller 1: username=seller1, password=seller123');
            console.log('Test Seller 2: username=seller2, password=seller123');
        </script>
    </body>
    </html>
  `);
});

// 관리자 대시보드
app.get('/admin', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>관리자 대시보드 - 토스 라이브 커머스</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            :root {
                --toss-blue: #3182F6;
                --toss-gray-900: #191F28;
                --toss-gray-700: #4E5968;
                --toss-gray-600: #6B7684;
                --toss-gray-200: #E5E8EB;
                --toss-gray-100: #F2F4F6;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", sans-serif;
                background: var(--toss-gray-100);
            }
            
            .stat-card {
                background: white;
                border-radius: 12px;
                padding: 24px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            
            .stat-value {
                font-size: 32px;
                font-weight: 700;
                color: var(--toss-gray-900);
            }
            
            .stat-label {
                font-size: 14px;
                color: var(--toss-gray-600);
                margin-top: 8px;
            }
            
            .stream-card {
                background: white;
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 16px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                transition: all 0.2s;
            }
            
            .stream-card:hover {
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            
            .status-badge {
                display: inline-block;
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 600;
            }
            
            .status-scheduled {
                background: #FFF3E0;
                color: #F57C00;
            }
            
            .status-live {
                background: #E8F5E9;
                color: #388E3C;
            }
            
            .status-ended {
                background: var(--toss-gray-200);
                color: var(--toss-gray-600);
            }
            
            .btn {
                padding: 10px 20px;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                border: none;
                font-size: 14px;
            }
            
            .btn-primary {
                background: var(--toss-blue);
                color: white;
            }
            
            .btn-primary:hover {
                background: #2563eb;
            }
            
            .btn-secondary {
                background: var(--toss-gray-200);
                color: var(--toss-gray-900);
            }
            
            .btn-danger {
                background: #ef4444;
                color: white;
            }
            
            .modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                z-index: 1000;
                align-items: center;
                justify-content: center;
            }
            
            .modal.show {
                display: flex;
            }
            
            .modal-content {
                background: white;
                border-radius: 16px;
                padding: 32px;
                max-width: 500px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
            }
            
            /* Mobile Responsive Styles */
            @media (max-width: 768px) {
                body {
                    font-size: 14px;
                }
                
                .header {
                    padding: 12px 16px !important;
                    flex-wrap: wrap;
                    gap: 12px;
                }
                
                .header h1 {
                    font-size: 18px !important;
                    width: 100%;
                }
                
                .header-info {
                    width: 100%;
                    justify-content: space-between;
                }
                
                /* Stats Grid - 2 columns on mobile */
                [style*="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))"] {
                    grid-template-columns: repeat(2, 1fr) !important;
                    gap: 12px !important;
                }
                
                .stat-card {
                    padding: 16px !important;
                }
                
                .stat-value {
                    font-size: 24px !important;
                }
                
                .stat-label {
                    font-size: 12px !important;
                }
                
                /* Stream/Seller Cards */
                .stream-card {
                    padding: 16px !important;
                }
                
                .stream-card > div {
                    flex-direction: column !important;
                    gap: 12px !important;
                }
                
                .stream-card h3 {
                    font-size: 14px !important;
                }
                
                .stream-card > div > div:last-child {
                    width: 100%;
                    justify-content: flex-start !important;
                    flex-wrap: wrap;
                }
                
                /* Buttons on mobile */
                .btn {
                    padding: 8px 12px !important;
                    font-size: 12px !important;
                }
                
                /* Section Headers */
                [style*="font-size: 18px"] {
                    font-size: 16px !important;
                }
                
                /* Modal on mobile */
                .modal-content {
                    padding: 20px !important;
                    width: 95% !important;
                    max-height: 85vh !important;
                }
                
                .form-group {
                    margin-bottom: 16px !important;
                }
                
                .form-input {
                    font-size: 14px !important;
                }
                
                /* Hide icons on very small screens */
                @media (max-width: 480px) {
                    .fas, .fab {
                        display: none;
                    }
                    
                    .btn {
                        padding: 8px !important;
                    }
                }
            }
            
            /* Tablet Styles */
            @media (min-width: 769px) and (max-width: 1024px) {
                [style*="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))"] {
                    grid-template-columns: repeat(3, 1fr) !important;
                }
            }
            
            .form-group {
                margin-bottom: 20px;
            }
            
            .form-label {
                display: block;
                font-size: 14px;
                font-weight: 600;
                color: var(--toss-gray-900);
                margin-bottom: 8px;
            }
            
            .form-input {
                width: 100%;
                padding: 12px 16px;
                border: 1px solid var(--toss-gray-200);
                border-radius: 8px;
                font-size: 14px;
            }
            
            .form-input:focus {
                outline: none;
                border-color: var(--toss-blue);
            }
        </style>
    </head>
    <body>
        <!-- Header -->
        <div style="background: white; border-bottom: 1px solid var(--toss-gray-200); padding: 16px 32px; position: sticky; top: 0; z-index: 100;">
            <div style="display: flex; align-items: center; justify-content: space-between; max-width: 1400px; margin: 0 auto;">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <h1 style="font-size: 20px; font-weight: 700; color: var(--toss-gray-900); margin: 0;">
                        <i class="fas fa-user-shield" style="color: var(--toss-blue);"></i>
                        관리자 대시보드
                    </h1>
                    <span id="adminName" style="font-size: 14px; color: var(--toss-gray-600);"></span>
                </div>
                <button onclick="logout()" class="btn btn-secondary">
                    <i class="fas fa-sign-out-alt"></i> 로그아웃
                </button>
            </div>
        </div>
        
        <!-- Main Content -->
        <div style="max-width: 1400px; margin: 0 auto; padding: 32px;">
            <!-- Stats -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 32px;">
                <div class="stat-card">
                    <i class="fas fa-broadcast-tower" style="font-size: 24px; color: var(--toss-blue);"></i>
                    <div class="stat-value" id="statLiveStreams">0</div>
                    <div class="stat-label">라이브 스트림</div>
                </div>
                <div class="stat-card">
                    <i class="fas fa-box" style="font-size: 24px; color: #10b981;"></i>
                    <div class="stat-value" id="statProducts">0</div>
                    <div class="stat-label">등록 상품</div>
                </div>
                <div class="stat-card">
                    <i class="fas fa-store" style="font-size: 24px; color: #f59e0b;"></i>
                    <div class="stat-value" id="statSellers">0</div>
                    <div class="stat-label">승인된 판매자</div>
                </div>
                <div class="stat-card">
                    <i class="fas fa-won-sign" style="font-size: 24px; color: #8b5cf6;"></i>
                    <div class="stat-value" id="statRevenue">0원</div>
                    <div class="stat-label">총 매출</div>
                </div>
            </div>
            
            <!-- Live Streams Section -->
            <div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
                    <h2 style="font-size: 18px; font-weight: 700; color: var(--toss-gray-900); margin: 0;">
                        <i class="fas fa-video"></i> 라이브 스트림 관리
                    </h2>
                    <button onclick="openCreateModal()" class="btn btn-primary">
                        <i class="fas fa-plus"></i> 새 라이브 생성
                    </button>
                </div>
                
                <div id="streamsList">
                    <div style="text-align: center; padding: 40px; color: var(--toss-gray-600);">
                        <i class="fas fa-spinner fa-spin" style="font-size: 24px;"></i>
                        <p style="margin-top: 16px;">로딩 중...</p>
                    </div>
                </div>
            </div>
            
            <!-- Sellers Section -->
            <div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-top: 24px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
                    <h2 style="font-size: 18px; font-weight: 700; color: var(--toss-gray-900); margin: 0;">
                        <i class="fas fa-store"></i> 판매자 관리
                    </h2>
                    <button onclick="openSellerCreateModal()" class="btn btn-primary">
                        <i class="fas fa-plus"></i> 새 판매자 등록
                    </button>
                </div>
                
                <div id="sellersList">
                    <div style="text-align: center; padding: 40px; color: var(--toss-gray-600);">
                        <i class="fas fa-spinner fa-spin" style="font-size: 24px;"></i>
                        <p style="margin-top: 16px;">로딩 중...</p>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Create/Edit Stream Modal -->
        <div id="streamModal" class="modal">
            <div class="modal-content">
                <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 24px;">
                    <span id="modalTitle">새 라이브 생성</span>
                </h3>
                
                <form id="streamForm">
                    <input type="hidden" id="streamId">
                    
                    <div class="form-group">
                        <label class="form-label" for="streamTitle">제목</label>
                        <input type="text" id="streamTitle" class="form-input" placeholder="라이브 제목을 입력하세요" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="streamDescription">설명</label>
                        <textarea id="streamDescription" class="form-input" rows="3" placeholder="라이브 설명을 입력하세요"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="youtubeVideoId">YouTube 영상 ID</label>
                        <input type="text" id="youtubeVideoId" class="form-input" placeholder="dQw4w9WgXcQ" required>
                        <small style="color: var(--toss-gray-600); font-size: 12px;">
                            YouTube URL에서 v= 뒤의 ID를 입력하세요
                        </small>
                    </div>
                    
                    <div style="display: flex; gap: 12px; margin-top: 24px;">
                        <button type="submit" class="btn btn-primary" style="flex: 1;">저장</button>
                        <button type="button" onclick="closeModal()" class="btn btn-secondary">취소</button>
                    </div>
                </form>
            </div>
        </div>
        
        <!-- Create Seller Modal -->
        <div id="sellerModal" class="modal">
            <div class="modal-content">
                <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 24px;">
                    새 판매자 등록
                </h3>
                
                <form id="sellerForm">
                    <div class="form-group">
                        <label class="form-label" for="sellerUsername">사용자명 (로그인 ID) *</label>
                        <input type="text" id="sellerUsername" class="form-input" placeholder="영문, 숫자 조합" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="sellerPassword">비밀번호 *</label>
                        <input type="password" id="sellerPassword" class="form-input" placeholder="8자 이상" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="sellerName">담당자 이름 *</label>
                        <input type="text" id="sellerName" class="form-input" placeholder="홍길동" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="sellerBusinessName">사업자명 *</label>
                        <input type="text" id="sellerBusinessName" class="form-input" placeholder="주식회사 토스" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="sellerEmail">이메일</label>
                        <input type="email" id="sellerEmail" class="form-input" placeholder="seller@example.com">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="sellerPhone">연락처</label>
                        <input type="tel" id="sellerPhone" class="form-input" placeholder="010-1234-5678">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="sellerBusinessNumber">사업자등록번호</label>
                        <input type="text" id="sellerBusinessNumber" class="form-input" placeholder="123-45-67890">
                    </div>
                    
                    <div style="display: flex; gap: 12px; margin-top: 24px;">
                        <button type="submit" class="btn btn-primary" style="flex: 1;">등록</button>
                        <button type="button" onclick="closeSellerModal()" class="btn btn-secondary">취소</button>
                    </div>
                </form>
            </div>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/admin.js?v=${Date.now()}"></script>
    </body>
    </html>
  `);
});

// 판매자 대시보드
app.get('/seller', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>판매자 대시보드 - 토스 라이브 커머스</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            :root {
                --seller-pink: #f5576c;
                --toss-gray-900: #191F28;
                --toss-gray-700: #4E5968;
                --toss-gray-600: #6B7684;
                --toss-gray-200: #E5E8EB;
                --toss-gray-100: #F2F4F6;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", sans-serif;
                background: var(--toss-gray-100);
            }
            
            .stat-card {
                background: white;
                border-radius: 12px;
                padding: 24px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            
            .stat-value {
                font-size: 32px;
                font-weight: 700;
                color: var(--toss-gray-900);
            }
            
            .stat-label {
                font-size: 14px;
                color: var(--toss-gray-600);
                margin-top: 8px;
            }
            
            .product-card {
                background: white;
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 16px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                transition: all 0.2s;
                display: flex;
                gap: 20px;
            }
            
            .product-card:hover {
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            
            .product-image {
                width: 120px;
                height: 120px;
                border-radius: 8px;
                object-fit: cover;
                background: var(--toss-gray-100);
            }
            
            .status-badge {
                display: inline-block;
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 600;
            }
            
            .status-active {
                background: #E8F5E9;
                color: #388E3C;
            }
            
            .status-inactive {
                background: var(--toss-gray-200);
                color: var(--toss-gray-600);
            }
            
            .btn {
                padding: 10px 20px;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                border: none;
                font-size: 14px;
            }
            
            .btn-primary {
                background: var(--seller-pink);
                color: white;
            }
            
            .btn-primary:hover {
                background: #f31942;
            }
            
            .btn-secondary {
                background: var(--toss-gray-200);
                color: var(--toss-gray-900);
            }
            
            .btn-danger {
                background: #ef4444;
                color: white;
            }
            
            .modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                z-index: 1000;
                align-items: center;
                justify-content: center;
            }
            
            .modal.show {
                display: flex;
            }
            
            .modal-content {
                background: white;
                border-radius: 16px;
                padding: 32px;
                max-width: 600px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
            }
            
            .form-group {
                margin-bottom: 20px;
            }
            
            .form-label {
                display: block;
                font-size: 14px;
                font-weight: 600;
                color: var(--toss-gray-900);
                margin-bottom: 8px;
            }
            
            .form-input {
                width: 100%;
                padding: 12px 16px;
                border: 1px solid var(--toss-gray-200);
                border-radius: 8px;
                font-size: 14px;
            }
            
            .form-input:focus {
                outline: none;
                border-color: var(--seller-pink);
            }
            
            /* Mobile Responsive Styles */
            @media (max-width: 768px) {
                body {
                    font-size: 14px;
                }
                
                /* Header */
                [style*="padding: 16px 32px"] {
                    padding: 12px 16px !important;
                }
                
                [style*="font-size: 20px"] h1 {
                    font-size: 18px !important;
                }
                
                /* Main content padding */
                [style*="padding: 32px"] {
                    padding: 16px !important;
                }
                
                /* Stats Grid - 2 columns on mobile */
                [style*="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))"] {
                    grid-template-columns: repeat(2, 1fr) !important;
                    gap: 12px !important;
                }
                
                .stat-card {
                    padding: 16px !important;
                }
                
                .stat-value {
                    font-size: 24px !important;
                }
                
                .stat-label {
                    font-size: 12px !important;
                }
                
                /* Product Cards */
                .product-card {
                    padding: 16px !important;
                    flex-direction: column !important;
                    gap: 12px !important;
                }
                
                .product-image {
                    width: 100% !important;
                    height: 200px !important;
                }
                
                .product-card h3 {
                    font-size: 14px !important;
                }
                
                /* Buttons */
                .btn {
                    padding: 8px 12px !important;
                    font-size: 12px !important;
                }
                
                /* Product info section */
                .product-card > div {
                    width: 100% !important;
                }
                
                .product-card > div > div:last-child {
                    flex-wrap: wrap !important;
                    gap: 8px !important;
                }
                
                /* Section Headers */
                [style*="font-size: 18px"] {
                    font-size: 16px !important;
                }
                
                /* Modal on mobile */
                .modal-content {
                    padding: 20px !important;
                    width: 95% !important;
                    max-height: 85vh !important;
                }
                
                .form-group {
                    margin-bottom: 16px !important;
                }
                
                .form-input {
                    font-size: 14px !important;
                }
                
                /* Option chips */
                [style*="display: flex; gap: 8px; flex-wrap: wrap"] {
                    gap: 6px !important;
                }
                
                .option-chip {
                    font-size: 11px !important;
                    padding: 4px 8px !important;
                }
                
                /* Hide icons on very small screens */
                @media (max-width: 480px) {
                    .fas, .fab {
                        display: none;
                    }
                    
                    .btn {
                        padding: 8px !important;
                    }
                    
                    /* Stack header vertically */
                    [style*="display: flex; align-items: center; justify-content: space-between"] {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                        gap: 12px !important;
                    }
                }
            }
            
            /* Tablet Styles */
            @media (min-width: 769px) and (max-width: 1024px) {
                [style*="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))"] {
                    grid-template-columns: repeat(3, 1fr) !important;
                }
                
                .product-image {
                    width: 100px !important;
                    height: 100px !important;
                }
            }
        </style>
    </head>
    <body>
        <!-- Header -->
        <div style="background: white; border-bottom: 1px solid var(--toss-gray-200); padding: 16px 32px; position: sticky; top: 0; z-index: 100;">
            <div style="display: flex; align-items: center; justify-content: space-between; max-width: 1400px; margin: 0 auto;">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <h1 style="font-size: 20px; font-weight: 700; color: var(--toss-gray-900); margin: 0;">
                        <i class="fas fa-store" style="color: var(--seller-pink);"></i>
                        판매자 대시보드
                    </h1>
                    <span id="sellerName" style="font-size: 14px; color: var(--toss-gray-600);"></span>
                </div>
                <button onclick="logout()" class="btn btn-secondary">
                    <i class="fas fa-sign-out-alt"></i> 로그아웃
                </button>
            </div>
        </div>
        
        <!-- Main Content -->
        <div style="max-width: 1400px; margin: 0 auto; padding: 32px;">
            <!-- Stats -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 32px;">
                <div class="stat-card">
                    <i class="fas fa-box" style="font-size: 24px; color: var(--seller-pink);"></i>
                    <div class="stat-value" id="statTotalProducts">0</div>
                    <div class="stat-label">총 상품</div>
                </div>
                <div class="stat-card">
                    <i class="fas fa-check-circle" style="font-size: 24px; color: #10b981;"></i>
                    <div class="stat-value" id="statActiveProducts">0</div>
                    <div class="stat-label">판매 중</div>
                </div>
                <div class="stat-card">
                    <i class="fas fa-warehouse" style="font-size: 24px; color: #f59e0b;"></i>
                    <div class="stat-value" id="statTotalStock">0</div>
                    <div class="stat-label">총 재고</div>
                </div>
                <div class="stat-card">
                    <i class="fas fa-won-sign" style="font-size: 24px; color: #8b5cf6;"></i>
                    <div class="stat-value" id="statRevenue">0원</div>
                    <div class="stat-label">총 매출</div>
                </div>
            </div>
            
            <!-- Products Section -->
            <div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
                    <h2 style="font-size: 18px; font-weight: 700; color: var(--toss-gray-900); margin: 0;">
                        <i class="fas fa-shopping-bag"></i> 상품 관리
                    </h2>
                    <button onclick="openCreateModal()" class="btn btn-primary">
                        <i class="fas fa-plus"></i> 새 상품 등록
                    </button>
                </div>
                
                <div id="productsList">
                    <div style="text-align: center; padding: 40px; color: var(--toss-gray-600);">
                        <i class="fas fa-spinner fa-spin" style="font-size: 24px;"></i>
                        <p style="margin-top: 16px;">로딩 중...</p>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Create/Edit Modal -->
        <div id="productModal" class="modal">
            <div class="modal-content">
                <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 24px;">
                    <span id="modalTitle">새 상품 등록</span>
                </h3>
                
                <form id="productForm">
                    <input type="hidden" id="productId">
                    
                    <div class="form-group">
                        <label class="form-label" for="productName">상품명</label>
                        <input type="text" id="productName" class="form-input" placeholder="상품명을 입력하세요" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="productDescription">상품 설명</label>
                        <textarea id="productDescription" class="form-input" rows="3" placeholder="상품 설명을 입력하세요"></textarea>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div class="form-group">
                            <label class="form-label" for="productPrice">판매가</label>
                            <input type="number" id="productPrice" class="form-input" placeholder="0" required>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label" for="productOriginalPrice">정가 (선택)</label>
                            <input type="number" id="productOriginalPrice" class="form-input" placeholder="0">
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div class="form-group">
                            <label class="form-label" for="productStock">재고</label>
                            <input type="number" id="productStock" class="form-input" placeholder="0" required>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label" for="productCategory">카테고리</label>
                            <select id="productCategory" class="form-input">
                                <option value="패션">패션</option>
                                <option value="전자기기">전자기기</option>
                                <option value="식품">식품</option>
                                <option value="뷰티">뷰티</option>
                                <option value="생활용품">생활용품</option>
                                <option value="기타">기타</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="productImageUrl">이미지 URL</label>
                        <input type="text" id="productImageUrl" class="form-input" placeholder="https://...">
                        <small style="color: var(--toss-gray-600); font-size: 12px;">
                            이미지 URL을 입력하세요 (미입력 시 기본 이미지 사용)
                        </small>
                    </div>
                    
                    <div style="display: flex; gap: 12px; margin-top: 24px;">
                        <button type="submit" class="btn btn-primary" style="flex: 1;">저장</button>
                        <button type="button" onclick="closeModal()" class="btn btn-secondary">취소</button>
                    </div>
                </form>
            </div>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/seller.js?v=${Date.now()}"></script>
    </body>
    </html>
  `);
});

// 고객 주문 목록 페이지
app.get('/my-orders', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>내 주문 내역 - 토스 라이브 커머스</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            :root {
                --toss-blue: #3182F6;
                --toss-gray-900: #191F28;
                --toss-gray-600: #6B7684;
                --toss-gray-200: #E5E8EB;
                --toss-gray-100: #F2F4F6;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif;
                background: var(--toss-gray-100);
            }
            
            .order-card {
                background: white;
                border-radius: 12px;
                padding: 24px;
                margin-bottom: 16px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            
            .status-badge {
                display: inline-block;
                padding: 6px 12px;
                border-radius: 12px;
                font-size: 13px;
                font-weight: 600;
            }
            
            .status-PAY_COMPLETE { background: #E3F2FD; color: #1976D2; }
            .status-PREPARING { background: #FFF3E0; color: #F57C00; }
            .status-SHIPPING { background: #E8F5E9; color: #388E3C; }
            .status-DELIVERED { background: var(--toss-gray-200); color: var(--toss-gray-600); }
            .status-CANCELLED { background: #FFEBEE; color: #D32F2F; }
            
            .product-item {
                display: flex;
                gap: 16px;
                padding: 16px 0;
                border-bottom: 1px solid var(--toss-gray-200);
            }
            
            .product-item:last-child {
                border-bottom: none;
            }
            
            .product-image {
                width: 80px;
                height: 80px;
                border-radius: 8px;
                object-fit: cover;
            }
            
            .btn {
                padding: 10px 20px;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                border: none;
                font-size: 14px;
            }
            
            .btn-primary {
                background: var(--toss-blue);
                color: white;
            }
            
            .btn-secondary {
                background: var(--toss-gray-200);
                color: var(--toss-gray-900);
            }
        </style>
    </head>
    <body>
        <div style="max-width: 800px; margin: 0 auto; padding: 32px 16px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px;">
                <h1 style="font-size: 24px; font-weight: 700; color: var(--toss-gray-900); margin: 0;">
                    <i class="fas fa-receipt"></i> 내 주문 내역
                </h1>
                <button onclick="goBack()" class="btn btn-secondary">
                    <i class="fas fa-arrow-left"></i> 뒤로
                </button>
            </div>
            
            <div id="ordersList">
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: var(--toss-gray-600);"></i>
                    <p style="margin-top: 16px; color: var(--toss-gray-600);">로딩 중...</p>
                </div>
            </div>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            const API_BASE = '/api';
            const userId = 1; // TODO: Get from session/Toss Bridge
            
            function goBack() {
                window.history.back();
            }
            
            function formatPrice(price) {
                return new Intl.NumberFormat('ko-KR').format(price);
            }
            
            function formatDate(dateString) {
                const date = new Date(dateString);
                return date.toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
            
            function getStatusText(status) {
                const statusMap = {
                    'PAY_COMPLETE': '결제완료',
                    'PREPARING': '상품준비중',
                    'SHIPPING': '배송중',
                    'DELIVERED': '배송완료',
                    'CANCELLED': '취소/환불'
                };
                return statusMap[status] || status;
            }
            
            function viewOrderDetail(orderNo) {
                window.location.href = \`/orders/\${orderNo}\`;
            }
            
            async function loadOrders() {
                try {
                    const response = await axios.get(\API_BASE + ");
                    
                    if (response.data.success) {
                        renderOrders(response.data.data);
                    }
                } catch (error) {
                    console.error('Failed to load orders:', error);
                    document.getElementById('ordersList').innerHTML = \`
                        <div style="text-align: center; padding: 40px; color: #ef4444;">
                            <i class="fas fa-exclamation-circle" style="font-size: 24px;"></i>
                            <p style="margin-top: 16px;">주문 내역을 불러올 수 없습니다.</p>
                        </div>
                    \`;
                }
            }
            
            function renderOrders(orders) {
                const container = document.getElementById('ordersList');
                
                if (orders.length === 0) {
                    container.innerHTML = \`
                        <div style="text-align: center; padding: 60px;">
                            <i class="fas fa-shopping-bag" style="font-size: 48px; color: var(--toss-gray-600); opacity: 0.5;"></i>
                            <p style="margin-top: 16px; font-size: 16px; color: var(--toss-gray-900);">주문 내역이 없습니다</p>
                            <p style="margin-top: 8px; font-size: 14px; color: var(--toss-gray-600);">라이브 방송에서 상품을 구매해보세요!</p>
                            <button onclick="window.location.href='/live/1'" class="btn btn-primary" style="margin-top: 24px;">
                                라이브 보러 가기
                            </button>
                        </div>
                    \`;
                    return;
                }
                
                container.innerHTML = orders.map(order => \`
                    <div class="order-card">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                            <div>
                                <span class="status-badge status-\${order.status}">
                                    \${getStatusText(order.status)}
                                </span>
                                <span style="margin-left: 12px; font-size: 14px; color: var(--toss-gray-600);">
                                    \${formatDate(order.created_at)}
                                </span>
                            </div>
                            <span style="font-size: 14px; color: var(--toss-gray-600);">
                                주문번호: \${order.order_no}
                            </span>
                        </div>
                        
                        <div>
                            \${order.items.map(item => \`
                                <div class="product-item">
                                    <img src="\${item.image_url || 'https://picsum.photos/80/80?random=' + item.product_id}" 
                                         alt="\${item.product_name}" 
                                         class="product-image">
                                    <div style="flex: 1;">
                                        <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">
                                            \${item.product_name || '상품명'}
                                        </h3>
                                        <p style="font-size: 14px; color: var(--toss-gray-600); margin-bottom: 8px;">
                                            수량: \${item.quantity}개
                                        </p>
                                        <p style="font-size: 16px; font-weight: 700; color: var(--toss-gray-900);">
                                            \${formatPrice(item.price * item.quantity)}원
                                        </p>
                                    </div>
                                </div>
                            \`).join('')}
                        </div>
                        
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--toss-gray-200);">
                            <div>
                                <span style="font-size: 14px; color: var(--toss-gray-600);">총 결제금액</span>
                                <strong style="font-size: 20px; font-weight: 700; color: var(--toss-blue); margin-left: 12px;">
                                    \${formatPrice(order.total_amount)}원
                                </strong>
                            </div>
                            <button onclick="viewOrderDetail('\${order.order_no}')" class="btn btn-primary">
                                상세보기
                            </button>
                        </div>
                    </div>
                \`).join('');
            }
            
            // Initialize
            loadOrders();
        </script>
    </body>
    </html>
  `);
});

export default app;
