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
  const userId = c.req.param('userId');

  try {
    const result = await DB.prepare(`
      SELECT 
        ci.*,
        p.name as product_name,
        p.image_url as product_image,
        po.option_type || ': ' || po.option_value as option_info
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
    const { userId, productId, optionId, quantity, priceSnapshot, liveStreamId } = await c.req.json();

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
          /* YouTube 플레이어 컨테이너 */
          .video-container {
            position: relative;
            width: 100%;
            padding-bottom: 56.25%; /* 16:9 aspect ratio */
            height: 0;
            overflow: hidden;
          }
          .video-container iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
          }
          /* 상품 플로팅 바텀시트 */
          .product-sheet {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: white;
            border-top-left-radius: 20px;
            border-top-right-radius: 20px;
            box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
            transform: translateY(calc(100% - 120px));
            transition: transform 0.3s ease;
            z-index: 1000;
            max-height: 80vh;
          }
          .product-sheet.expanded {
            transform: translateY(0);
          }
          .product-sheet-drag-handle {
            width: 40px;
            height: 4px;
            background: #E5E8EB;
            border-radius: 2px;
            margin: 8px auto;
          }
        </style>
    </head>
    <body class="bg-gray-900">
        <!-- 라이브 영상 영역 -->
        <div class="video-container">
            <div id="youtube-player"></div>
        </div>

        <!-- 시청자 수 표시 -->
        <div class="fixed top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm z-50">
            <i class="fas fa-eye mr-1"></i>
            <span id="viewer-count">0</span>명 시청 중
        </div>

        <!-- 상품 플로팅 바텀시트 -->
        <div id="product-sheet" class="product-sheet">
            <div class="product-sheet-drag-handle"></div>
            <div class="p-4 overflow-y-auto" style="max-height: calc(80vh - 40px);">
                <div id="product-content">
                    <!-- 상품 정보가 여기에 로드됩니다 -->
                </div>
            </div>
        </div>

        <!-- 장바구니 플로팅 버튼 -->
        <button id="cart-button" class="fixed bottom-32 right-4 toss-primary text-white w-14 h-14 rounded-full shadow-lg z-50 flex items-center justify-center">
            <i class="fas fa-shopping-cart text-xl"></i>
            <span id="cart-badge" class="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full hidden items-center justify-center">0</span>
        </button>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="https://www.youtube.com/iframe_api"></script>
        <script>
          const STREAM_ID = '${streamId}';
        </script>
        <script src="/static/live.js"></script>
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
