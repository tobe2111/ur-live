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
    const stream = await DB.prepare(
      'SELECT * FROM live_streams WHERE id = ?'
    ).bind(id).first();

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
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>토스 라이브 커머스 - 실시간 방송</title>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/style.css?v=${Date.now()}" rel="stylesheet">
        
        <!-- Firebase SDK -->
        <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
        <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js"></script>
        <style>
          :root {
            --toss-blue: #3182F6;
            --toss-gray: #191F28;
            --toss-light-gray: #F2F4F6;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            overflow-x: hidden;
          }
          .toss-primary {
            background-color: var(--toss-blue);
          }
          .toss-text-primary {
            color: var(--toss-blue);
          }
          /* YouTube 플레이어 컨테이너 - 전체 화면 배경 */
          .video-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            overflow: hidden;
            z-index: 1;
            background: #000;
          }
          .video-container iframe {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 100vw;
            height: 100vh;
            transform: translate(-50%, -50%);
            pointer-events: auto; /* 클릭 가능하게 변경 */
          }
          /* 그라디언트 오버레이 - 하단 가독성 확보 */
          .video-overlay {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 50%;
            background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, transparent 100%);
            z-index: 2;
            pointer-events: none;
          }

          /* 하단 컨트롤 바 */
          .bottom-controls {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 12px 16px;
            padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
            background: rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(10px);
            z-index: 200;
            display: flex;
            gap: 8px;
            align-items: center;
          }

          .buy-button {
            background: #FF4785;
            color: white;
            border: none;
            border-radius: 24px;
            padding: 12px 24px;
            font-size: 15px;
            font-weight: 700;
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.2s;
          }
          .buy-button:hover {
            background: #E63C6F;
            transform: scale(1.05);
          }
          .my-orders-button {
            background: rgba(255, 255, 255, 0.9);
            color: #191F28;
            border: none;
            border-radius: 24px;
            padding: 12px 20px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s;
          }
          .my-orders-button:hover {
            background: white;
            transform: scale(1.05);
          }
          /* 토스트 메시지 */
          .toast-message {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.3s ease;
          }
          .toast-message.show {
            opacity: 1;
          }
          /* 실시간 채팅 영역 - 토스 디자인 적용 */
          .chat-container {
            position: fixed;
            left: 16px;
            bottom: 140px; /* 입력창(44px) + 버튼바(60px) + 여유(36px) */
            width: 70%; /* 화면 왼쪽에 배치 */
            max-width: 400px;
            max-height: 180px; /* 약 5줄 정도 */
            z-index: 100;
            pointer-events: none;
          }
          .chat-messages {
            height: 100%;
            overflow-y: auto;
            overflow-x: hidden;
            display: flex;
            flex-direction: column;
            justify-content: flex-end; /* 채팅이 아래서부터 쌓이도록 */
            gap: 6px;
            padding: 0;
            /* 상단 그라디언트 마스크 - 자연스러운 페이드 아웃 */
            -webkit-mask-image: linear-gradient(to top, black 85%, transparent 100%);
            mask-image: linear-gradient(to top, black 85%, transparent 100%);
          }
          /* 스크롤바 숨기기 */
          .chat-messages::-webkit-scrollbar {
            display: none;
          }
          .chat-messages {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .chat-bubble {
            background: rgba(25, 31, 40, 0.85); /* Toss Gray 900 with transparency */
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            color: #FFFFFF;
            padding: 8px 12px;
            border-radius: 16px; /* Toss 디자인 radius */
            font-size: 13px;
            line-height: 1.5;
            max-width: 85%;
            word-wrap: break-word;
            pointer-events: auto;
            /* 텍스트 그림자 - 가독성 향상 */
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
            /* Toss 스타일 그림자 */
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            /* 슬라이드인 애니메이션 */
            animation: slideInLeft 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
          @keyframes slideInLeft {
            from {
              opacity: 0;
              transform: translateX(-16px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          .chat-bubble .username {
            font-weight: 600; /* Toss Medium */
            color: #3182F6; /* Toss Blue 500 */
            margin-right: 4px;
            font-size: 13px;
          }
          .chat-bubble.purchase {
            background: rgba(49, 130, 246, 0.9); /* Toss Blue with transparency */
            font-weight: 600;
            box-shadow: 0 2px 12px rgba(49, 130, 246, 0.3);
          }
          /* 채팅 입력 영역 - 토스 디자인 */
          .chat-input-area {
            position: fixed;
            left: 16px;
            right: 16px;
            bottom: calc(68px + env(safe-area-inset-bottom, 0px));
            z-index: 150;
            display: flex;
            gap: 8px;
            pointer-events: auto;
          }
          .chat-input {
            flex: 1;
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid rgba(242, 244, 246, 0.8); /* Toss Gray 100 */
            border-radius: 12px; /* Toss 디자인 radius */
            padding: 12px 16px;
            font-size: 14px;
            color: #191F28; /* Toss Gray 900 */
            outline: none;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
          .chat-input:focus {
            background: #FFFFFF;
            border-color: #3182F6; /* Toss Blue 500 */
            box-shadow: 0 0 0 3px rgba(49, 130, 246, 0.1);
          }
          .chat-input::placeholder {
            color: #B0B8C1; /* Toss Gray 500 */
          }
          .chat-send-button {
            background: #3182F6; /* Toss Blue 500 */
            color: white;
            border: none;
            border-radius: 12px; /* Toss 디자인 radius */
            width: 44px;
            height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 2px 8px rgba(49, 130, 246, 0.25);
          }
          .chat-send-button:hover {
            background: #1B64DA; /* Toss Blue 600 */
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(49, 130, 246, 0.35);
          }
          .chat-send-button:active {
            transform: translateY(0);
            box-shadow: 0 2px 6px rgba(49, 130, 246, 0.3);
          }
          /* 모바일 최적화 */
          @media (max-width: 768px) {
            .product-sheet {
              transform: translateY(calc(100% - 140px));
            }
            .video-container iframe {
              width: 100vw;
              height: 56.25vw; /* 16:9 → 모바일은 세로 전체 */
              min-height: 100vh;
            }
            .chat-container {
              max-width: none;
            }
          }
        </style>
    </head>
    <body class="bg-black overflow-hidden">
        <!-- YouTube 전체 화면 배경 -->
        <div class="video-container">
            <div id="youtube-player"></div>
        </div>
        
        <!-- 그라디언트 오버레이 -->
        <div class="video-overlay"></div>

        <!-- 상단 헤더 정보 -->
        <div class="fixed top-0 left-0 right-0 z-50 p-4 flex items-center justify-between">
            <!-- 라이브 타이틀 -->
            <div class="text-white text-lg font-bold flex items-center max-w-[60%]">
                <i class="fas fa-tv mr-2 flex-shrink-0"></i>
                <span id="stream-title" class="truncate">토스 라이브 커머스</span>
            </div>
            
            <div class="flex items-center gap-2">
                <!-- 음소거 토글 버튼 (아이콘만) -->
                <button id="unmute-button" onclick="toggleMute()" class="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white w-10 h-10 rounded-full flex items-center justify-center transition hidden" title="음소거 토글">
                    <i id="mute-icon" class="fas fa-volume-mute text-lg"></i>
                </button>
                
                <!-- LIVE 뱃지 -->
                <div class="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center">
                    <i class="fas fa-circle mr-1 animate-pulse"></i>
                    LIVE
                </div>
            </div>
        </div>

        <!-- 실시간 채팅 영역 -->
        <div class="chat-container">
            <div id="chat-messages" class="chat-messages">
                <!-- 채팅 메시지가 여기에 동적으로 추가됩니다 -->
            </div>
        </div>

        <!-- 채팅 입력 영역 -->
        <div class="chat-input-area">
            <input 
                type="text" 
                id="chat-input" 
                class="chat-input" 
                placeholder="메시지를 입력하세요" 
                maxlength="200"
            />
            <button id="chat-send-button" class="chat-send-button">
                <i class="fas fa-paper-plane"></i>
            </button>
        </div>
        
        <!-- 하단 컨트롤 바 -->
        <div class="bottom-controls">
            <button id="my-orders-button" class="my-orders-button">
                <i class="fas fa-shopping-bag"></i>
                <span>내 주문</span>
            </button>
            <button id="buy-button" class="buy-button">
                구매하기
            </button>
        </div>
        
        <!-- 토스트 메시지 -->
        <div id="toast-message" class="toast-message"></div>

        <!-- 상품 리스트 모달 -->
        <div id="product-list-modal" class="modal-overlay" style="display: none;">
            <div class="modal-container">
                <div class="modal-header">
                    <h2 class="modal-title">판매상품 <span id="product-count" class="product-count">0</span></h2>
                    <button id="close-product-list" class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div id="product-list" class="product-list">
                        <!-- 상품 목록이 여기에 동적으로 추가됩니다 -->
                    </div>
                </div>
            </div>
        </div>

        <!-- 상품 상세 모달 -->
        <div id="product-detail-modal" class="modal-overlay" style="display: none;">
            <div class="modal-container">
                <div class="modal-header">
                    <button id="back-to-list" class="modal-back">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <button id="close-product-detail" class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" id="product-detail-content">
                    <!-- 상품 상세 정보가 여기에 동적으로 추가됩니다 -->
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="https://www.youtube.com/iframe_api"></script>
        <script>
          const STREAM_ID = '${streamId}';
        </script>
        <script src="/static/firebase-config.js?v=${Date.now()}"></script>
        <script src="/static/live.js?v=${Date.now()}"></script>
    </body>
    </html>
  `);
});

// ==================== 토스페이 결제 API ====================

// 토스페이 결제 생성
app.post('/api/tosspay/create-payment', async (c) => {
  const TOSSPAY_BASE_URL = 'https://pay-apps-in-toss-api.toss.im';
  
  try {
    const body = await c.req.json();
    const { userKey, orderNo, productDesc, amount, amountTaxFree, isTestPayment } = body;

    if (!userKey || !orderNo || !productDesc || typeof amount !== 'number') {
      return c.json<ApiResponse>({
        success: false,
        error: 'Missing required parameters',
      }, 400);
    }

    // 토스페이 API 호출
    const response = await fetch(`${TOSSPAY_BASE_URL}/api-partner/v1/apps-in-toss/pay/make-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-toss-user-key': userKey,
      },
      body: JSON.stringify({
        orderNo,
        productDesc,
        amount,
        amountTaxFree: amountTaxFree || 0,
        isTestPayment: isTestPayment !== false, // 기본값 true (샌드박스)
      }),
    });

    const data = await response.json();

    if (data.resultType === 'SUCCESS') {
      return c.json<ApiResponse<{ payToken: string }>>({
        success: true,
        data: {
          payToken: data.success.payToken,
        },
      });
    } else {
      return c.json<ApiResponse>({
        success: false,
        error: data.fail?.msg || 'Payment creation failed',
      }, 400);
    }
  } catch (err) {
    console.error('Error creating payment:', err);
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

// 토스페이 결제 실행
app.post('/api/tosspay/execute-payment', async (c) => {
  const TOSSPAY_BASE_URL = 'https://pay-apps-in-toss-api.toss.im';
  const { DB } = c.env;

  try {
    const body = await c.req.json();
    const { userKey, payToken, orderNo, isTestPayment } = body;

    if (!userKey || !payToken) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Missing required parameters',
      }, 400);
    }

    // 토스페이 승인 API 호출
    const response = await fetch(`${TOSSPAY_BASE_URL}/api-partner/v1/apps-in-toss/pay/execute-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-toss-user-key': userKey,
      },
      body: JSON.stringify({
        payToken,
        orderNo,
        isTestPayment: isTestPayment !== false,
      }),
    });

    const data = await response.json();

    if (data.resultType === 'SUCCESS') {
      const paymentData = data.success;

      // 주문 정보 DB에 저장 (orders 테이블 필요)
      // TODO: 주문 정보 저장 로직 추가

      return c.json<ApiResponse<any>>({
        success: true,
        data: paymentData,
      });
    } else {
      return c.json<ApiResponse>({
        success: false,
        error: data.fail?.msg || 'Payment execution failed',
      }, 400);
    }
  } catch (err) {
    console.error('Error executing payment:', err);
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

// 장바구니 페이지 (토스 디자인 시스템 완벽 적용)
app.get('/cart', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
        <title>장바구니 - 토스 라이브 커머스</title>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/style.css?v=${Date.now()}" rel="stylesheet">
        <style>
          /* ========================================
             토스 디자인 시스템 (TDS) - 완벽 적용
             ======================================== */
          
          /* 1. Color System */
          :root {
            /* Primary Colors */
            --toss-blue-50: #EBF4FF;
            --toss-blue-100: #CCE1FF;
            --toss-blue-200: #99C3FF;
            --toss-blue-300: #66A5FF;
            --toss-blue-400: #3D8DFF;
            --toss-blue-500: #3182F6;  /* Main Blue */
            --toss-blue-600: #2568D8;
            --toss-blue-700: #1B4FBA;
            --toss-blue-800: #13389C;
            --toss-blue-900: #0D2A7E;
            
            /* Grayscale */
            --toss-gray-50: #F9FAFB;
            --toss-gray-100: #F2F4F6;
            --toss-gray-200: #E5E8EB;
            --toss-gray-300: #D1D6DB;
            --toss-gray-400: #B0B8C1;
            --toss-gray-500: #8B95A1;
            --toss-gray-600: #6B7684;
            --toss-gray-700: #4E5968;
            --toss-gray-800: #333D4B;
            --toss-gray-900: #191F28;
            
            /* Semantic Colors */
            --toss-red: #FF3B30;
            --toss-green: #34C759;
            --toss-orange: #FF9500;
            
            /* Elevation */
            --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
          }
          
          /* 2. Typography */
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 
                         'Noto Sans KR', 'Malgun Gothic', sans-serif;
            background: var(--toss-gray-50);
            color: var(--toss-gray-900);
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          
          /* 3. Header */
          .cart-header {
            background: white;
            border-bottom: 1px solid var(--toss-gray-100);
            position: sticky;
            top: 0;
            z-index: 100;
            backdrop-filter: blur(20px);
            background: rgba(255, 255, 255, 0.95);
          }
          
          .cart-header-content {
            max-width: 480px;
            margin: 0 auto;
            padding: 16px 20px;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          
          .back-button {
            width: 40px;
            height: 40px;
            border: none;
            background: none;
            color: var(--toss-gray-900);
            font-size: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 12px;
            transition: background 0.2s;
          }
          
          .back-button:active {
            background: var(--toss-gray-100);
          }
          
          .header-title {
            font-size: 20px;
            font-weight: 700;
            color: var(--toss-gray-900);
            letter-spacing: -0.02em;
          }
          
          /* 4. Container */
          .cart-container {
            max-width: 480px;
            margin: 0 auto;
            padding: 20px;
            padding-bottom: calc(120px + env(safe-area-inset-bottom));
          }
          
          /* 5. Cart Item Card */
          .cart-item {
            background: white;
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 12px;
            box-shadow: var(--shadow-sm);
            transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          
          .cart-item:active {
            transform: scale(0.98);
          }
          
          .item-content {
            display: flex;
            gap: 16px;
          }
          
          .item-image {
            width: 80px;
            height: 80px;
            border-radius: 12px;
            object-fit: cover;
            background: var(--toss-gray-100);
            flex-shrink: 0;
          }
          
          .item-details {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          
          .item-name {
            font-size: 16px;
            font-weight: 600;
            color: var(--toss-gray-900);
            line-height: 1.4;
            letter-spacing: -0.02em;
          }
          
          .item-option {
            font-size: 13px;
            color: var(--toss-gray-600);
            line-height: 1.4;
          }
          
          .item-price-row {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-top: auto;
          }
          
          .item-price {
            font-size: 18px;
            font-weight: 700;
            color: var(--toss-gray-900);
          }
          
          .item-original-price {
            font-size: 14px;
            color: var(--toss-gray-400);
            text-decoration: line-through;
          }
          
          /* 6. Quantity Controls */
          .quantity-controls {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid var(--toss-gray-100);
          }
          
          .quantity-label {
            font-size: 14px;
            font-weight: 600;
            color: var(--toss-gray-700);
          }
          
          .quantity-button-group {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-left: auto;
          }
          
          .quantity-btn {
            width: 32px;
            height: 32px;
            border: 1px solid var(--toss-gray-200);
            background: white;
            border-radius: 8px;
            color: var(--toss-gray-700);
            font-size: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s;
          }
          
          .quantity-btn:active {
            background: var(--toss-gray-50);
            transform: scale(0.95);
          }
          
          .quantity-btn:disabled {
            opacity: 0.3;
            cursor: not-allowed;
          }
          
          .quantity-value {
            font-size: 16px;
            font-weight: 600;
            color: var(--toss-gray-900);
            min-width: 32px;
            text-align: center;
          }
          
          /* 7. Delete Button */
          .delete-btn {
            width: 32px;
            height: 32px;
            border: none;
            background: none;
            color: var(--toss-gray-400);
            font-size: 18px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            transition: all 0.2s;
          }
          
          .delete-btn:active {
            background: var(--toss-gray-100);
            color: var(--toss-red);
          }
          
          /* 8. Empty State */
          .empty-cart {
            text-align: center;
            padding: 80px 20px;
          }
          
          .empty-icon {
            font-size: 64px;
            color: var(--toss-gray-200);
            margin-bottom: 20px;
          }
          
          .empty-title {
            font-size: 18px;
            font-weight: 600;
            color: var(--toss-gray-900);
            margin-bottom: 8px;
          }
          
          .empty-desc {
            font-size: 14px;
            color: var(--toss-gray-600);
            line-height: 1.5;
            margin-bottom: 24px;
          }
          
          /* 9. Checkout Bar */
          .checkout-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: white;
            border-top: 1px solid var(--toss-gray-100);
            padding: 16px 20px;
            padding-bottom: calc(16px + env(safe-area-inset-bottom));
            box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.05);
            z-index: 100;
          }
          
          .checkout-content {
            max-width: 480px;
            margin: 0 auto;
          }
          
          .price-summary {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 16px;
          }
          
          .price-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          .price-label {
            font-size: 14px;
            color: var(--toss-gray-600);
          }
          
          .price-value {
            font-size: 14px;
            font-weight: 600;
            color: var(--toss-gray-900);
          }
          
          .price-row.total {
            padding-top: 12px;
            border-top: 1px solid var(--toss-gray-100);
            margin-top: 4px;
          }
          
          .price-row.total .price-label {
            font-size: 16px;
            font-weight: 600;
            color: var(--toss-gray-900);
          }
          
          .price-row.total .price-value {
            font-size: 24px;
            font-weight: 700;
            color: var(--toss-blue-500);
          }
          
          /* 10. Buttons */
          .btn-primary {
            width: 100%;
            height: 56px;
            background: var(--toss-blue-500);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 17px;
            font-weight: 600;
            letter-spacing: -0.02em;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }
          
          .btn-primary:active {
            background: var(--toss-blue-600);
            transform: scale(0.98);
          }
          
          .btn-secondary {
            padding: 12px 24px;
            background: white;
            color: var(--toss-blue-500);
            border: 1px solid var(--toss-blue-500);
            border-radius: 10px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }
          
          .btn-secondary:active {
            background: var(--toss-blue-50);
          }
          
          /* 11. Loading */
          .loading-container {
            text-align: center;
            padding: 60px 20px;
          }
          
          .spinner {
            width: 48px;
            height: 48px;
            border: 4px solid var(--toss-gray-100);
            border-top-color: var(--toss-blue-500);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin: 0 auto 20px;
          }
          
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          
          .loading-text {
            font-size: 15px;
            color: var(--toss-gray-600);
          }
          
          /* 12. Section Divider */
          .section-divider {
            height: 8px;
            background: var(--toss-gray-50);
            margin: 20px -20px;
          }
          
          /* 13. Info Badge */
          .info-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            background: var(--toss-blue-50);
            color: var(--toss-blue-500);
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
          }
          
          /* 14. Responsive */
          @media (max-width: 480px) {
            .cart-container {
              padding: 16px;
            }
          }
        </style>
    </head>
    <body>
        <!-- 헤더 -->
        <div class="cart-header">
            <div class="cart-header-content">
                <button class="back-button" onclick="window.history.back()">
                    <i class="fas fa-arrow-left"></i>
                </button>
                <h1 class="header-title">장바구니</h1>
            </div>
        </div>

        <!-- 장바구니 컨텐츠 -->
        <div class="cart-container">
            <div id="cart-items">
                <!-- 로딩 상태 -->
                <div class="loading-container">
                    <div class="spinner"></div>
                    <p class="loading-text">장바구니를 불러오는 중...</p>
                </div>
            </div>
        </div>

        <!-- 하단 결제 바 -->
        <div id="checkout-bar" class="checkout-bar" style="display: none;">
            <div class="checkout-content">
                <div class="price-summary">
                    <div class="price-row">
                        <span class="price-label">상품 금액</span>
                        <span class="price-value" id="subtotal-amount">0원</span>
                    </div>
                    <div class="price-row">
                        <span class="price-label">배송비</span>
                        <span class="price-value">무료</span>
                    </div>
                    <div class="price-row total">
                        <span class="price-label">총 결제 금액</span>
                        <span class="price-value" id="total-amount">0원</span>
                    </div>
                </div>
                <button class="btn-primary" onclick="goToCheckout()">
                    <i class="fas fa-credit-card"></i>
                    <span id="checkout-btn-text">결제하기</span>
                </button>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/cart.js?v=${Date.now()}"></script>
    </body>
    </html>
  `);
});

// =================================
// Admin/Seller Authentication API
// =================================

// Helper: Generate session token
function generateSessionToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Helper: Simple password check (for demo - in production use bcrypt)
function checkPassword(password: string, hash: string): boolean {
  // For demo purposes, we're using simple comparison
  // In production, use bcrypt.compare()
  return password === 'admin123' || password === 'seller123';
}

// Admin Login
app.post('/api/admin/login', async (c) => {
  const { DB } = c.env;
  const { username, password } = await c.req.json();

  try {
    // Find admin
    const admin = await DB.prepare(
      'SELECT id, username, name, email, role, password_hash FROM admins WHERE username = ? AND is_active = 1'
    ).bind(username).first();

    if (!admin) {
      return c.json({ success: false, error: 'Invalid credentials' }, 401);
    }

    // Check password (simplified for demo)
    if (!checkPassword(password, admin.password_hash)) {
      return c.json({ success: false, error: 'Invalid credentials' }, 401);
    }

    // Create session
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    await DB.prepare(
      'INSERT INTO admin_sessions (session_token, admin_id, user_type, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(sessionToken, admin.id, 'admin', expiresAt).run();

    // Update last login
    await DB.prepare(
      'UPDATE admins SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(admin.id).run();

    return c.json({
      success: true,
      data: {
        sessionToken,
        user: {
          id: admin.id,
          username: admin.username,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          type: 'admin'
        }
      }
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Seller Login
app.post('/api/seller/login', async (c) => {
  const { DB } = c.env;
  const { username, password } = await c.req.json();

  try {
    // Find seller
    const seller = await DB.prepare(
      'SELECT id, username, name, email, business_name, status, password_hash FROM sellers WHERE username = ? AND is_active = 1'
    ).bind(username).first();

    if (!seller) {
      return c.json({ success: false, error: 'Invalid credentials' }, 401);
    }

    // Check if seller is approved
    if (seller.status !== 'approved') {
      return c.json({ success: false, error: 'Seller account not approved yet' }, 403);
    }

    // Check password (simplified for demo)
    if (!checkPassword(password, seller.password_hash)) {
      return c.json({ success: false, error: 'Invalid credentials' }, 401);
    }

    // Create session
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    await DB.prepare(
      'INSERT INTO admin_sessions (session_token, seller_id, user_type, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(sessionToken, seller.id, 'seller', expiresAt).run();

    // Update last login
    await DB.prepare(
      'UPDATE sellers SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(seller.id).run();

    return c.json({
      success: true,
      data: {
        sessionToken,
        user: {
          id: seller.id,
          username: seller.username,
          name: seller.name,
          email: seller.email,
          businessName: seller.business_name,
          type: 'seller'
        }
      }
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Verify Session (Middleware helper endpoint)
app.get('/api/auth/verify', async (c) => {
  const { DB } = c.env;
  const sessionToken = c.req.header('X-Session-Token');

  if (!sessionToken) {
    return c.json({ success: false, error: 'No session token' }, 401);
  }

  try {
    const session = await DB.prepare(
      'SELECT * FROM admin_sessions WHERE session_token = ? AND expires_at > CURRENT_TIMESTAMP'
    ).bind(sessionToken).first();

    if (!session) {
      return c.json({ success: false, error: 'Invalid or expired session' }, 401);
    }

    let user;
    if (session.user_type === 'admin') {
      user = await DB.prepare(
        'SELECT id, username, name, email, role FROM admins WHERE id = ?'
      ).bind(session.admin_id).first();
    } else {
      user = await DB.prepare(
        'SELECT id, username, name, email, business_name FROM sellers WHERE id = ?'
      ).bind(session.seller_id).first();
    }

    return c.json({
      success: true,
      data: {
        user: { ...user, type: session.user_type }
      }
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Logout
app.post('/api/auth/logout', async (c) => {
  const { DB } = c.env;
  const sessionToken = c.req.header('X-Session-Token');

  if (!sessionToken) {
    return c.json({ success: true }); // Already logged out
  }

  try {
    await DB.prepare(
      'DELETE FROM admin_sessions WHERE session_token = ?'
    ).bind(sessionToken).run();

    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// =================================
// Admin Management API
// =================================

// Helper: Verify admin session
async function verifyAdminSession(c: any): Promise<{ success: boolean; adminId?: number; error?: string }> {
  const { DB } = c.env;
  const sessionToken = c.req.header('X-Session-Token');

  if (!sessionToken) {
    return { success: false, error: 'No session token' };
  }

  try {
    const session = await DB.prepare(
      'SELECT * FROM admin_sessions WHERE session_token = ? AND user_type = ? AND expires_at > CURRENT_TIMESTAMP'
    ).bind(sessionToken, 'admin').first();

    if (!session) {
      return { success: false, error: 'Invalid or expired session' };
    }

    return { success: true, adminId: session.admin_id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// Helper: Verify seller session
async function verifySellerSession(c: any): Promise<{ success: boolean; sellerId?: number; error?: string }> {
  const { DB } = c.env;
  const sessionToken = c.req.header('X-Session-Token');

  if (!sessionToken) {
    return { success: false, error: 'No session token' };
  }

  try {
    const session = await DB.prepare(
      'SELECT * FROM admin_sessions WHERE session_token = ? AND user_type = ? AND expires_at > CURRENT_TIMESTAMP'
    ).bind(sessionToken, 'seller').first();

    if (!session) {
      return { success: false, error: 'Invalid or expired session' };
    }

    return { success: true, sellerId: session.seller_id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// Get all live streams (Admin only)
app.get('/api/admin/streams', async (c) => {
  const { DB } = c.env;
  const auth = await verifyAdminSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const result = await DB.prepare(
      'SELECT * FROM live_streams ORDER BY created_at DESC'
    ).all();

    return c.json({ success: true, data: result.results });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Create live stream (Admin only)
app.post('/api/admin/streams', async (c) => {
  const { DB } = c.env;
  const auth = await verifyAdminSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const { title, description, youtube_video_id } = await c.req.json();

    if (!title || !youtube_video_id) {
      return c.json({ success: false, error: 'Title and YouTube video ID are required' }, 400);
    }

    const result = await DB.prepare(
      'INSERT INTO live_streams (title, description, youtube_video_id, status) VALUES (?, ?, ?, ?)'
    ).bind(title, description || '', youtube_video_id, 'scheduled').run();

    return c.json({
      success: true,
      data: {
        id: result.meta.last_row_id,
        title,
        description,
        youtube_video_id,
        status: 'scheduled'
      }
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Update live stream (Admin only)
app.put('/api/admin/streams/:id', async (c) => {
  const { DB } = c.env;
  const auth = await verifyAdminSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const id = c.req.param('id');
    const { title, description, youtube_video_id, status, current_product_id } = await c.req.json();

    const updates: string[] = [];
    const values: any[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (youtube_video_id !== undefined) {
      updates.push('youtube_video_id = ?');
      values.push(youtube_video_id);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (current_product_id !== undefined) {
      updates.push('current_product_id = ?');
      values.push(current_product_id);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    if (updates.length === 1) {
      return c.json({ success: false, error: 'No fields to update' }, 400);
    }

    await DB.prepare(
      `UPDATE live_streams SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    // Get updated stream
    const stream = await DB.prepare('SELECT * FROM live_streams WHERE id = ?').bind(id).first();

    return c.json({ success: true, data: stream });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Delete live stream (Admin only)
app.delete('/api/admin/streams/:id', async (c) => {
  const { DB } = c.env;
  const auth = await verifyAdminSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const id = c.req.param('id');

    await DB.prepare('DELETE FROM live_streams WHERE id = ?').bind(id).run();

    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Get all sellers (Admin only)
app.get('/api/admin/sellers', async (c) => {
  const { DB } = c.env;
  const auth = await verifyAdminSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const result = await DB.prepare(
      'SELECT id, username, name, email, phone, business_name, business_number, status, created_at FROM sellers ORDER BY created_at DESC'
    ).all();

    return c.json({ success: true, data: result.results });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Update seller status (Admin only)
app.patch('/api/admin/sellers/:id/status', async (c) => {
  const { DB } = c.env;
  const auth = await verifyAdminSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const id = c.req.param('id');
    const { status } = await c.req.json();

    if (!['approved', 'rejected', 'suspended'].includes(status)) {
      return c.json({ success: false, error: 'Invalid status' }, 400);
    }

    await DB.prepare(
      'UPDATE sellers SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(status, auth.adminId, id).run();

    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Get dashboard stats (Admin only)
app.get('/api/admin/stats', async (c) => {
  const { DB } = c.env;
  const auth = await verifyAdminSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const liveStreams = await DB.prepare('SELECT COUNT(*) as count FROM live_streams').first();
    const products = await DB.prepare('SELECT COUNT(*) as count FROM products').first();
    const sellers = await DB.prepare('SELECT COUNT(*) as count FROM sellers WHERE status = ?').bind('approved').first();
    const orders = await DB.prepare('SELECT COUNT(*) as count, SUM(total_amount) as total FROM orders').first();

    return c.json({
      success: true,
      data: {
        liveStreams: liveStreams.count || 0,
        products: products.count || 0,
        sellers: sellers.count || 0,
        orders: orders.count || 0,
        totalRevenue: orders.total || 0
      }
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// =================================
// Seller Product Management API
// =================================

// Get seller's products
app.get('/api/seller/products', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const result = await DB.prepare(
      'SELECT * FROM products WHERE seller_id = ? ORDER BY created_at DESC'
    ).bind(auth.sellerId).all();

    return c.json({ success: true, data: result.results });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Create product
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
        </div>
        
        <!-- Create/Edit Modal -->
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

export default app;
