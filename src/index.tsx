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

app.post('/api/cart', async (c) => {
  const { DB } = c.env;

  try {
    const { userId: tossUserId, productId, optionId, quantity, priceSnapshot, liveStreamId } = await c.req.json();

    // 사용자 ID 조회 (toss_user_id -> user.id)
    const user = await DB.prepare(
      'SELECT id FROM users WHERE toss_user_id = ?'
    ).bind(tossUserId).first();

    if (!user) {
      return c.json<ApiResponse>({
        success: false,
        error: 'User not found',
      }, 404);
    }

    const userId = user.id as number;

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
    `).bind(userId, productId, optionId, quantity, priceSnapshot, liveStreamId).run();

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
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/style.css" rel="stylesheet">
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
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/style.css" rel="stylesheet">
        
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
          /* 실시간 채팅 영역 */
          .chat-container {
            position: fixed;
            left: 16px;
            bottom: 140px;
            width: calc(100% - 32px);
            max-width: 400px;
            height: 50vh;
            max-height: 500px;
            z-index: 100;
            pointer-events: none;
          }
          .chat-messages {
            height: 100%;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 12px;
            /* 상단 그라디언트 마스크 - 자연스러운 페이드 아웃 */
            -webkit-mask-image: linear-gradient(to top, black 70%, transparent 100%);
            mask-image: linear-gradient(to top, black 70%, transparent 100%);
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
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(8px);
            color: white;
            padding: 10px 14px;
            border-radius: 20px;
            font-size: 14px;
            line-height: 1.4;
            max-width: 80%;
            word-wrap: break-word;
            pointer-events: auto;
            /* 텍스트 그림자 - 가독성 향상 */
            text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
            /* 슬라이드인 애니메이션 */
            animation: slideInLeft 0.3s ease-out;
          }
          @keyframes slideInLeft {
            from {
              opacity: 0;
              transform: translateX(-20px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          .chat-bubble .username {
            font-weight: 700;
            color: #3182F6;
            margin-right: 6px;
          }
          .chat-bubble.purchase {
            background: rgba(49, 130, 246, 0.7);
            font-weight: 600;
          }
          /* 채팅 입력 영역 */
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
            background: rgba(255, 255, 255, 0.9);
            border: none;
            border-radius: 24px;
            padding: 12px 16px;
            font-size: 14px;
            color: #191F28;
            outline: none;
            transition: all 0.2s;
          }
          .chat-input:focus {
            background: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          }
          .chat-send-button {
            background: #3182F6;
            color: white;
            border: none;
            border-radius: 50%;
            width: 44px;
            height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s;
          }
          .chat-send-button:hover {
            background: #2563EB;
            transform: scale(1.05);
          }
          .chat-send-button:active {
            transform: scale(0.95);
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

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="https://www.youtube.com/iframe_api"></script>
        <script>
          const STREAM_ID = '${streamId}';
        </script>
        <script src="/static/firebase-config.js"></script>
        <script src="/static/live.js"></script>
    </body>
    </html>
  `);
});

// 장바구니 페이지
app.get('/cart', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>장바구니 - 토스 라이브 커머스</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
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
        </style>
    </head>
    <body class="bg-gray-50">
        <!-- 헤더 -->
        <div class="bg-white border-b sticky top-0 z-50">
            <div class="max-w-2xl mx-auto px-4 py-4 flex items-center">
                <button onclick="window.history.back()" class="mr-4">
                    <i class="fas fa-arrow-left text-xl text-gray-700"></i>
                </button>
                <h1 class="text-xl font-bold text-gray-800">장바구니</h1>
            </div>
        </div>

        <!-- 장바구니 컨텐츠 -->
        <div class="max-w-2xl mx-auto px-4 py-6">
            <div id="cart-items">
                <!-- 로딩 상태 -->
                <div class="text-center py-12">
                    <i class="fas fa-spinner fa-spin text-4xl text-gray-400 mb-4"></i>
                    <p class="text-gray-500">장바구니를 불러오는 중...</p>
                </div>
            </div>
        </div>

        <!-- 하단 결제 바 -->
        <div id="checkout-bar" class="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg" style="display: none;">
            <div class="max-w-2xl mx-auto px-4 py-4">
                <div class="flex items-center justify-between mb-3">
                    <span class="text-gray-600">총 상품 금액</span>
                    <span id="total-amount" class="text-2xl font-bold text-gray-900">0원</span>
                </div>
                <button onclick="goToCheckout()" class="w-full toss-primary text-white font-bold py-4 rounded-lg hover:opacity-90 transition">
                    <i class="fas fa-credit-card mr-2"></i>
                    결제하기
                </button>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
          const API_BASE = '/api';
          const userId = 'toss_user_001'; // 실제로는 토스 로그인에서 받아옴
          
          let cartData = [];

          async function loadCart() {
            try {
              const response = await axios.get(\`\${API_BASE}/cart/\${userId}\`);
              if (response.data.success) {
                cartData = response.data.data;
                renderCart();
              }
            } catch (error) {
              console.error('Failed to load cart:', error);
              document.getElementById('cart-items').innerHTML = \`
                <div class="text-center py-12">
                  <i class="fas fa-exclamation-circle text-4xl text-red-400 mb-4"></i>
                  <p class="text-gray-500">장바구니를 불러올 수 없습니다</p>
                </div>
              \`;
            }
          }

          function renderCart() {
            const container = document.getElementById('cart-items');
            
            if (cartData.length === 0) {
              container.innerHTML = \`
                <div class="text-center py-12">
                  <i class="fas fa-shopping-cart text-6xl text-gray-300 mb-4"></i>
                  <p class="text-gray-500 text-lg mb-4">장바구니가 비어있습니다</p>
                  <button onclick="window.location.href='/'" class="toss-primary text-white px-6 py-3 rounded-lg font-semibold">
                    쇼핑 계속하기
                  </button>
                </div>
              \`;
              document.getElementById('checkout-bar').style.display = 'none';
              return;
            }

            container.innerHTML = cartData.map(item => \`
              <div class="bg-white rounded-lg p-4 mb-3 shadow-sm">
                <div class="flex gap-4">
                  <img src="\${item.image_url || 'https://via.placeholder.com/100'}" 
                       alt="\${item.product_name}"
                       class="w-24 h-24 object-cover rounded-lg flex-shrink-0">
                  <div class="flex-1 min-w-0">
                    <h3 class="font-bold text-gray-800 mb-1 truncate">\${item.product_name}</h3>
                    \${item.option_value ? \`<p class="text-sm text-gray-500 mb-2">옵션: \${item.option_value}</p>\` : ''}
                    <div class="flex items-center justify-between">
                      <span class="text-xl font-bold text-gray-900">\${formatPrice(item.price_snapshot)}원</span>
                      <div class="flex items-center gap-2">
                        <button onclick="updateQuantity(\${item.id}, \${item.quantity - 1})" 
                                class="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                                \${item.quantity <= 1 ? 'disabled style="opacity: 0.5"' : ''}>
                          <i class="fas fa-minus text-xs"></i>
                        </button>
                        <span class="text-lg font-semibold w-8 text-center">\${item.quantity}</span>
                        <button onclick="updateQuantity(\${item.id}, \${item.quantity + 1})" 
                                class="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100">
                          <i class="fas fa-plus text-xs"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                  <button onclick="removeItem(\${item.id})" class="text-gray-400 hover:text-red-500">
                    <i class="fas fa-times text-xl"></i>
                  </button>
                </div>
              </div>
            \`).join('');

            // 총 금액 계산
            const totalAmount = cartData.reduce((sum, item) => sum + (item.price_snapshot * item.quantity), 0);
            document.getElementById('total-amount').textContent = formatPrice(totalAmount) + '원';
            document.getElementById('checkout-bar').style.display = 'block';
          }

          async function updateQuantity(cartItemId, newQuantity) {
            if (newQuantity < 1) return;
            
            try {
              // TODO: 수량 업데이트 API 구현 필요
              const item = cartData.find(i => i.id === cartItemId);
              if (item) {
                item.quantity = newQuantity;
                renderCart();
              }
            } catch (error) {
              console.error('Failed to update quantity:', error);
              alert('수량 변경에 실패했습니다');
            }
          }

          async function removeItem(cartItemId) {
            if (!confirm('이 상품을 장바구니에서 삭제하시겠습니까?')) return;
            
            try {
              const response = await axios.delete(\`\${API_BASE}/cart/\${cartItemId}\`);
              if (response.data.success) {
                await loadCart();
              }
            } catch (error) {
              console.error('Failed to remove item:', error);
              alert('상품 삭제에 실패했습니다');
            }
          }

          function goToCheckout() {
            alert('결제 기능은 준비 중입니다.\\n토스페이 연동 후 사용 가능합니다.');
          }

          function formatPrice(price) {
            return price.toLocaleString('ko-KR');
          }

          // 페이지 로드 시 실행
          loadCart();
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
        <title>토스 라이브 커머스 - 관리자</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
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
        </style>
    </head>
    <body class="bg-gray-50">
        <div class="max-w-7xl mx-auto p-6">
            <h1 class="text-3xl font-bold text-gray-800 mb-8">
                <i class="fas fa-tv mr-2"></i>
                라이브 커머스 관리자
            </h1>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- 라이브 스트림 관리 -->
                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-xl font-bold mb-4">진행 중인 라이브</h2>
                    <div id="current-stream"></div>
                </div>

                <!-- 상품 목록 -->
                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-xl font-bold mb-4">상품 전환</h2>
                    <div id="product-list" class="space-y-3"></div>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/admin.js"></script>
    </body>
    </html>
  `);
});

export default app;
