import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import type { Bindings, ApiResponse, LiveStream, Product, ProductOption, User, CartItem, Order, OrderItem } from './types';
import { issueTaxInvoiceAuto, convertToBarobillFormat, isBarobillMockMode } from './services/barobill';

const app = new Hono<{ Bindings: Bindings }>();

// CORS 설정
app.use('/api/*', cors());

// 정적 파일 서빙
app.use('/static/*', serveStatic({ root: './public' }));

// =================================
// API Routes
// =================================

// =================================
// Authentication APIs
// =================================

// 세션 생성 (D1에 저장)
async function createSession(DB: any, userId: number, userType: 'admin' | 'seller', userData: any) {
  const sessionToken = `${userType}_${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24시간 후
  
  await DB.prepare(`
    INSERT INTO admin_sessions (session_token, ${userType}_id, user_type, expires_at)
    VALUES (?, ?, ?, ?)
  `).bind(sessionToken, userId, userType, expiresAt).run();
  
  return sessionToken;
}

// 세션 조회 및 검증
async function getSession(DB: any, sessionToken: string) {
  const session = await DB.prepare(`
    SELECT * FROM admin_sessions WHERE session_token = ? AND expires_at > datetime('now')
  `).bind(sessionToken).first();
  
  return session;
}

// 관리자 로그인 API
app.post('/api/auth/login', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const { username, password, userType } = await c.req.json();
    
    if (!username || !password || !userType) {
      return c.json({ success: false, error: '아이디와 비밀번호를 입력해주세요' }, 400);
    }
    
    let user;
    let table = userType === 'admin' ? 'admins' : 'sellers';
    
    // 사용자 조회
    user = await DB.prepare(`SELECT * FROM ${table} WHERE username = ?`).bind(username).first();
    
    if (!user) {
      return c.json({ success: false, error: '아이디 또는 비밀번호가 일치하지 않습니다' }, 401);
    }
    
    // 비밀번호 검증
    // 기본 테스트 계정 (admin, seller1, seller2)
    const isDefaultAccount = (userType === 'admin' && username === 'admin' && password === 'admin123') ||
                            (userType === 'seller' && username === 'seller1' && password === 'seller123') ||
                            (userType === 'seller' && username === 'seller2' && password === 'seller123');
    
    // 관리자가 생성한 계정 (password_hash에 비밀번호가 포함됨)
    const isCustomAccount = user.password_hash && user.password_hash.includes(`placeholder_hash_for_${password}`);
    
    const validPassword = isDefaultAccount || isCustomAccount;
    
    if (!validPassword) {
      return c.json({ success: false, error: '아이디 또는 비밀번호가 일치하지 않습니다' }, 401);
    }
    
    // 활성 상태 확인
    if (!user.is_active) {
      return c.json({ success: false, error: '비활성화된 계정입니다' }, 403);
    }
    
    // 판매자인 경우 승인 상태 확인
    if (userType === 'seller' && user.status !== 'approved') {
      return c.json({ success: false, error: '승인 대기 중인 계정입니다' }, 403);
    }
    
    // 세션 생성 (D1에 저장)
    const sessionToken = await createSession(DB, user.id, userType, {
      username: user.username,
      name: user.name,
      email: user.email,
      businessName: user.business_name,
      role: user.role
    });
    
    // 마지막 로그인 시간 업데이트
    await DB.prepare(`UPDATE ${table} SET last_login_at = datetime('now') WHERE id = ?`).bind(user.id).run();
    
    return c.json({
      success: true,
      data: {
        sessionToken,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          type: userType,
          businessName: user.business_name,
          role: user.role
        }
      }
    });
    
  } catch (err) {
    console.error('Login error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 로그아웃 API
app.post('/api/auth/logout', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const sessionToken = c.req.header('X-Session-Token');
    
    if (sessionToken) {
      // D1에서 세션 삭제
      await DB.prepare('DELETE FROM admin_sessions WHERE session_token = ?').bind(sessionToken).run();
    }
    
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 세션 검증 API
app.get('/api/auth/verify', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const sessionToken = c.req.header('X-Session-Token');
    
    if (!sessionToken) {
      return c.json({ success: false, error: '인증 토큰이 없습니다' }, 401);
    }
    
    const session = await getSession(DB, sessionToken);
    
    if (!session) {
      return c.json({ success: false, error: '유효하지 않은 세션입니다' }, 401);
    }
    
    // 사용자 정보 조회
    const table = session.user_type === 'admin' ? 'admins' : 'sellers';
    const userId = session.user_type === 'admin' ? session.admin_id : session.seller_id;
    
    const user = await DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(userId).first();
    
    if (!user) {
      return c.json({ success: false, error: '사용자를 찾을 수 없습니다' }, 404);
    }
    
    return c.json({
      success: true,
      data: {
        user: {
          id: user.id,
          type: session.user_type,
          username: user.username,
          name: user.name,
          email: user.email,
          businessName: user.business_name,
          role: user.role
        }
      }
    });
    
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// =================================
// Kakao Login APIs (일반 사용자)
// =================================

// 카카오 로그인 페이지로 리다이렉트
app.get('/auth/kakao', async (c) => {
  const KAKAO_REST_API_KEY = c.env.KAKAO_REST_API_KEY;
  const KAKAO_REDIRECT_URI = c.env.KAKAO_REDIRECT_URI || 'http://localhost:3000/auth/kakao/callback';
  
  const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_REST_API_KEY}&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}&response_type=code`;
  
  return c.redirect(kakaoAuthUrl);
});

// 카카오 로그인 콜백 처리
app.get('/auth/kakao/callback', async (c) => {
  const { DB } = c.env;
  const code = c.req.query('code');
  
  if (!code) {
    return c.redirect('/?error=no_code');
  }
  
  try {
    const KAKAO_REST_API_KEY = c.env.KAKAO_REST_API_KEY;
    const KAKAO_REDIRECT_URI = c.env.KAKAO_REDIRECT_URI || 'http://localhost:3000/auth/kakao/callback';
    
    // 1. Access Token 요청
    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: KAKAO_REST_API_KEY,
        redirect_uri: KAKAO_REDIRECT_URI,
        code: code,
      }),
    });
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      return c.redirect('/?error=token_failed');
    }
    
    // 2. 사용자 정보 요청
    const userResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });
    
    const userData = await userResponse.json();
    
    // 3. 사용자 정보 저장/업데이트
    const kakaoId = userData.id.toString();
    const nickname = userData.properties?.nickname || 'Kakao User';
    const email = userData.kakao_account?.email || '';
    const profileImage = userData.properties?.profile_image || '';
    
    // 기존 사용자 확인
    const existingUser = await DB.prepare(
      'SELECT * FROM users WHERE kakao_id = ?'
    ).bind(kakaoId).first();
    
    let userId;
    
    if (existingUser) {
      // 기존 사용자 업데이트
      userId = existingUser.id;
      await DB.prepare(
        'UPDATE users SET name = ?, email = ?, profile_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind(nickname, email, profileImage, userId).run();
    } else {
      // 신규 사용자 생성
      const result = await DB.prepare(
        'INSERT INTO users (name, email, kakao_id, profile_image) VALUES (?, ?, ?, ?)'
      ).bind(nickname, email, kakaoId, profileImage).run();
      userId = result.meta.last_row_id;
    }
    
    // 4. 세션 생성 (24시간)
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    await DB.prepare(
      'INSERT INTO admin_sessions (session_token, user_type, expires_at) VALUES (?, ?, ?)'
    ).bind(sessionToken, 'user', expiresAt).run();
    
    // 5. 세션 정보를 쿼리 파라미터로 전달하여 React에서 localStorage에 저장
    return c.redirect(`/?login=success&session=${sessionToken}&userId=${userId}&userName=${encodeURIComponent(nickname)}`);
    
  } catch (error) {
    console.error('Kakao login error:', error);
    return c.redirect('/?error=login_failed');
  }
});
// 카카오 로그아웃
app.post('/api/auth/kakao/logout', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const sessionToken = c.req.header('X-Session-Token') || '';
    
    if (sessionToken) {
      // 세션 삭제
      await DB.prepare('DELETE FROM admin_sessions WHERE session_token = ?').bind(sessionToken).run();
    }
    
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 사용자 세션 검증 API
app.get('/api/auth/user/verify', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const sessionToken = c.req.header('X-Session-Token');
    
    if (!sessionToken) {
      return c.json({ success: false, error: '인증 토큰이 없습니다' }, 401);
    }
    
    const session = await getSession(DB, sessionToken);
    
    if (!session || session.user_type !== 'user') {
      return c.json({ success: false, error: '유효하지 않은 세션입니다' }, 401);
    }
    
    // 사용자 정보 조회 (session에서 user_id 추출)
    const userId = parseInt(sessionToken.split('_')[1]); // user_{id}_{timestamp}_{random} 형식
    const user = await DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(userId).first();
    
    if (!user) {
      return c.json({ success: false, error: '사용자를 찾을 수 없습니다' }, 404);
    }
    
    return c.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          profileImage: user.profile_image,
          phone: user.phone
        }
      }
    });
    
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// =================================
// Shipping Address APIs
// =================================

// 배송지 목록 조회
app.get('/api/shipping-addresses/:userId', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const userId = c.req.param('userId');
    
    const addresses = await DB.prepare(`
      SELECT * FROM shipping_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC
    `).bind(userId).all();
    
    return c.json({
      success: true,
      data: addresses.results || []
    });
    
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 배송지 추가
app.post('/api/shipping-addresses', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const { userId, recipientName, phone, postalCode, address, addressDetail, isDefault } = await c.req.json();
    
    if (!userId || !recipientName || !phone || !address) {
      return c.json({ success: false, error: '필수 정보를 입력해주세요' }, 400);
    }
    
    // 기본 배송지로 설정하는 경우, 기존 기본 배송지 해제
    if (isDefault) {
      await DB.prepare(`UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?`).bind(userId).run();
    }
    
    const result = await DB.prepare(`
      INSERT INTO shipping_addresses (user_id, recipient_name, phone, postal_code, address, address_detail, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(userId, recipientName, phone, postalCode || '', address, addressDetail || '', isDefault ? 1 : 0).run();
    
    return c.json({
      success: true,
      data: { id: result.meta.last_row_id }
    });
    
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 배송지 수정
app.put('/api/shipping-addresses/:id', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const id = c.req.param('id');
    const { userId, recipientName, phone, postalCode, address, addressDetail, isDefault } = await c.req.json();
    
    // 기본 배송지로 설정하는 경우, 기존 기본 배송지 해제
    if (isDefault) {
      await DB.prepare(`UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?`).bind(userId).run();
    }
    
    await DB.prepare(`
      UPDATE shipping_addresses
      SET recipient_name = ?, phone = ?, postal_code = ?, address = ?, address_detail = ?, is_default = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(recipientName, phone, postalCode || '', address, addressDetail || '', isDefault ? 1 : 0, id, userId).run();
    
    return c.json({ success: true });
    
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 배송지 삭제
app.delete('/api/shipping-addresses/:id', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const id = c.req.param('id');
    const userId = c.req.query('userId');
    
    await DB.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(id, userId).run();
    
    return c.json({ success: true });
    
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 세션 검증 헬퍼 함수
async function verifyAdminSession(c: any) {
  const { DB } = c.env;
  const sessionToken = c.req.header('X-Session-Token');
  
  if (!sessionToken) {
    return { success: false, error: '인증 토큰이 없습니다' };
  }
  
  const session = await getSession(DB, sessionToken);
  
  if (!session || session.user_type !== 'admin') {
    return { success: false, error: '관리자 권한이 필요합니다' };
  }
  
  return { success: true, adminId: session.admin_id, userData: session };
}

async function verifySellerSession(c: any) {
  const { DB } = c.env;
  const sessionToken = c.req.header('X-Session-Token');
  
  if (!sessionToken) {
    return { success: false, error: '인증 토큰이 없습니다' };
  }
  
  const session = await getSession(DB, sessionToken);
  
  if (!session || session.user_type !== 'seller') {
    return { success: false, error: '판매자 권한이 필요합니다' };
  }
  
  return { success: true, sellerId: session.seller_id, userData: session };
}

// =================================
// Live Stream API
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

// 실시간 재고 확인 API
app.get('/api/products/:id/stock', async (c) => {
  const { DB } = c.env;
  const id = c.req.param('id');

  try {
    const product = await DB.prepare(
      'SELECT id, name, stock FROM products WHERE id = ? AND is_active = 1'
    ).bind(id).first();

    if (!product) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Product not found',
      }, 404);
    }

    return c.json<ApiResponse>({
      success: true,
      data: {
        productId: product.id,
        productName: product.name,
        stock: product.stock,
        available: product.stock > 0,
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

// =================================
// Seller Stream Management APIs
// =================================

// Seller: Create live stream (인플루언서가 직접 라이브 예약)
app.post('/api/seller/streams', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const { 
      title, 
      description, 
      youtube_video_id, 
      scheduled_at, 
      status,
      seller_instagram,
      seller_youtube,
      seller_facebook 
    } = await c.req.json();

    if (!title || !youtube_video_id) {
      return c.json({ success: false, error: 'Title and YouTube video ID are required' }, 400);
    }

    const result = await DB.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, status, scheduled_at,
        seller_id, seller_instagram, seller_youtube, seller_facebook,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      title, 
      description || null, 
      youtube_video_id, 
      status || 'scheduled', 
      scheduled_at || null,
      auth.sellerId,
      seller_instagram || null,
      seller_youtube || null,
      seller_facebook || null
    ).run();

    // Get created stream
    const stream = await DB.prepare(
      'SELECT * FROM live_streams WHERE id = ?'
    ).bind(result.meta.last_row_id).first();

    return c.json({
      success: true,
      data: stream
    });

  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Seller: Update own live stream
app.put('/api/seller/streams/:id', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const streamId = c.req.param('id');
    
    // Verify ownership
    const stream = await DB.prepare(
      'SELECT id FROM live_streams WHERE id = ? AND seller_id = ?'
    ).bind(streamId, auth.sellerId).first();

    if (!stream) {
      return c.json({ success: false, error: 'Stream not found or unauthorized' }, 404);
    }

    const { 
      title, 
      description, 
      youtube_video_id, 
      scheduled_at, 
      status,
      seller_instagram,
      seller_youtube,
      seller_facebook 
    } = await c.req.json();

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
    if (scheduled_at !== undefined) {
      updates.push('scheduled_at = ?');
      values.push(scheduled_at);
    }
    if (seller_instagram !== undefined) {
      updates.push('seller_instagram = ?');
      values.push(seller_instagram);
    }
    if (seller_youtube !== undefined) {
      updates.push('seller_youtube = ?');
      values.push(seller_youtube);
    }
    if (seller_facebook !== undefined) {
      updates.push('seller_facebook = ?');
      values.push(seller_facebook);
    }

    if (updates.length === 0) {
      return c.json({ success: false, error: 'No fields to update' }, 400);
    }

    updates.push('updated_at = datetime(\'now\')');

    await DB.prepare(`
      UPDATE live_streams SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values, streamId).run();

    return c.json({ success: true });

  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Seller: Delete own live stream
app.delete('/api/seller/streams/:id', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const streamId = c.req.param('id');

    // Verify ownership
    const stream = await DB.prepare(
      'SELECT id FROM live_streams WHERE id = ? AND seller_id = ?'
    ).bind(streamId, auth.sellerId).first();

    if (!stream) {
      return c.json({ success: false, error: 'Stream not found or unauthorized' }, 404);
    }

    await DB.prepare('DELETE FROM live_streams WHERE id = ?').bind(streamId).run();

    return c.json({ success: true });

  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// =================================
// Admin Stream Management APIs
// =================================

// Admin: Create live stream
app.post('/api/admin/streams', async (c) => {
  const { DB } = c.env;
  const auth = await verifyAdminSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const { title, description, youtube_video_id, status } = await c.req.json();

    if (!title || !youtube_video_id) {
      return c.json({ success: false, error: '제목과 YouTube 영상 ID는 필수입니다' }, 400);
    }

    const result = await DB.prepare(`
      INSERT INTO live_streams (title, description, youtube_video_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(title, description || null, youtube_video_id, status || 'scheduled').run();

    return c.json({
      success: true,
      data: {
        id: result.meta.last_row_id,
        title,
        description,
        youtube_video_id,
        status: status || 'scheduled'
      }
    });

  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Admin: Update live stream
app.put('/api/admin/streams/:id', async (c) => {
  const { DB } = c.env;
  const auth = await verifyAdminSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const streamId = c.req.param('id');
    const { title, description, youtube_video_id, status } = await c.req.json();

    await DB.prepare(`
      UPDATE live_streams 
      SET title = ?, description = ?, youtube_video_id = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(title, description, youtube_video_id, status, streamId).run();

    return c.json({ success: true });

  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Admin: Delete live stream
app.delete('/api/admin/streams/:id', async (c) => {
  const { DB } = c.env;
  const auth = await verifyAdminSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const streamId = c.req.param('id');

    await DB.prepare('DELETE FROM live_streams WHERE id = ?').bind(streamId).run();

    return c.json({ success: true });

  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
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

// Frontend Routes - Handled by React SPA
// All non-API, non-auth routes are handled by the SPA fallback at the end

// Mock 결제 페이지 (테스트용)
// Removed route: /mock-payment (handled by React SPA)

// 결제 성공 페이지

// 결제 실패 페이지
// Removed route: /payment/failed (handled by React SPA)

// 결제 취소 페이지
// Removed route: /payment/cancel (handled by React SPA)

// ============================================
// 카카오 로그인 (Kakao OAuth 2.0)
// ============================================

// 카카오 로그인 페이지
// Removed route: /login (handled by React SPA)

// 카카오 OAuth 콜백
// 로그아웃
// Removed route: /logout (handled by React SPA)

// ============================================
// 배송지 관리 API
// ============================================

// 배송지 목록 조회
app.get('/api/shipping-addresses/:userId', async (c) => {
  const { DB } = c.env;
  const userId = c.req.param('userId');
  
  try {
    const addresses = await DB.prepare(`
      SELECT * FROM shipping_addresses 
      WHERE user_id = ? 
      ORDER BY is_default DESC, created_at DESC
    `).bind(userId).all();
    
    return c.json({
      success: true,
      data: addresses.results
    });
  } catch (error) {
    return c.json({
      success: false,
      error: (error as Error).message
    }, 500);
  }
});

// 배송지 추가
app.post('/api/shipping-addresses', async (c) => {
  const { DB } = c.env;
  const { userId, recipientName, phone, postalCode, address, addressDetail, isDefault } = await c.req.json();
  
  try {
    // 기본 배송지로 설정 시 기존 기본 배송지 해제
    if (isDefault) {
      await DB.prepare(`
        UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?
      `).bind(userId).run();
    }
    
    const result = await DB.prepare(`
      INSERT INTO shipping_addresses (
        user_id, recipient_name, phone, postal_code, 
        address, address_detail, is_default, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(userId, recipientName, phone, postalCode, address, addressDetail, isDefault ? 1 : 0).run();
    
    return c.json({
      success: true,
      data: { id: result.meta.last_row_id }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: (error as Error).message
    }, 500);
  }
});

// 배송지 수정
app.put('/api/shipping-addresses/:id', async (c) => {
  const { DB } = c.env;
  const addressId = c.req.param('id');
  const { userId, recipientName, phone, postalCode, address, addressDetail, isDefault } = await c.req.json();
  
  try {
    // 기본 배송지로 설정 시 기존 기본 배송지 해제
    if (isDefault) {
      await DB.prepare(`
        UPDATE shipping_addresses SET is_default = 0 WHERE user_id = ?
      `).bind(userId).run();
    }
    
    await DB.prepare(`
      UPDATE shipping_addresses 
      SET recipient_name = ?, phone = ?, postal_code = ?, 
          address = ?, address_detail = ?, is_default = ?, 
          updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(recipientName, phone, postalCode, address, addressDetail, isDefault ? 1 : 0, addressId, userId).run();
    
    return c.json({ success: true });
  } catch (error) {
    return c.json({
      success: false,
      error: (error as Error).message
    }, 500);
  }
});

// 배송지 삭제
app.delete('/api/shipping-addresses/:id', async (c) => {
  const { DB } = c.env;
  const addressId = c.req.param('id');
  const userId = c.req.query('userId');
  
  try {
    await DB.prepare(`
      DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?
    `).bind(addressId, userId).run();
    
    return c.json({ success: true });
  } catch (error) {
    return c.json({
      success: false,
      error: (error as Error).message
    }, 500);
  }
});

// 마이페이지 (프로필 + 배송지 관리)
// Removed route: /mypage (handled by React SPA)

// 셀러 전용 링크 페이지

// =================================
// 셀러 매출 및 정산 APIs
// =================================

// 셀러 매출 조회 API
// 셀러 대시보드 페이지

// 주문서 페이지 (Checkout)
// Removed route: /checkout (handled by React SPA)

// 주문 내역 페이지
// Removed route: /orders (handled by React SPA)

// 주문 상세 페이지
// Removed route: /order/:orderNo (handled by React SPA)

// =================================
// Seller Product Management APIs
// =================================

// Get seller's products (자신의 상품 목록 조회)
app.get('/api/seller/products', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const products = await DB.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.seller_id = ?
      ORDER BY p.created_at DESC
    `).bind(auth.sellerId).all();

    return c.json({ success: true, data: products.results });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Create product (상품 등록)
app.post('/api/seller/products', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const { 
      name, 
      description, 
      price, 
      original_price, 
      discount_rate,
      image_url, 
      stock, 
      category, 
      live_stream_id,
      is_active 
    } = await c.req.json();

    // Validate required fields
    if (!name || !price || !image_url) {
      return c.json({ success: false, error: 'Name, price, and image are required' }, 400);
    }

    // If live_stream_id provided, verify ownership
    if (live_stream_id) {
      const stream = await DB.prepare(
        'SELECT id FROM live_streams WHERE id = ? AND seller_id = ?'
      ).bind(live_stream_id, auth.sellerId).first();

      if (!stream) {
        return c.json({ success: false, error: 'Live stream not found or unauthorized' }, 404);
      }
    }

    // Insert product
    const result = await DB.prepare(`
      INSERT INTO products (
        name, description, price, original_price, discount_rate, 
        image_url, stock, category, live_stream_id, seller_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      name,
      description || null,
      price,
      original_price || null,
      discount_rate || 0,
      image_url,
      stock || 0,
      category || null,
      live_stream_id || null,
      auth.sellerId,
      is_active !== undefined ? is_active : 1
    ).run();

    // Get created product
    const product = await DB.prepare(
      'SELECT * FROM products WHERE id = ?'
    ).bind(result.meta.last_row_id).first();

    return c.json({ success: true, data: product });
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
// 사업자 정보 관리 API (세금계산서)
// =================================

// 사업자 정보 등록
app.post('/api/seller/business-info', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const {
      business_number,
      business_name,
      ceo_name,
      business_type,
      business_category,
      postal_code,
      address,
      phone,
      email
    } = await c.req.json();

    // 필수 필드 검증
    if (!business_number || !business_name || !ceo_name) {
      return c.json({
        success: false,
        error: '사업자등록번호, 상호명, 대표자명은 필수입니다.'
      }, 400);
    }

    // 이미 등록된 사업자 정보가 있는지 확인
    const existing = await DB.prepare(`
      SELECT id FROM seller_business_info WHERE seller_id = ?
    `).bind(auth.sellerId).first();

    let result;
    if (existing) {
      // 업데이트
      result = await DB.prepare(`
        UPDATE seller_business_info
        SET business_number = ?,
            business_name = ?,
            ceo_name = ?,
            business_type = ?,
            business_category = ?,
            postal_code = ?,
            address = ?,
            phone = ?,
            email = ?,
            is_verified = 0,
            verified_at = NULL,
            updated_at = datetime('now')
        WHERE seller_id = ?
      `).bind(
        business_number, business_name, ceo_name,
        business_type, business_category, postal_code,
        address, phone, email, auth.sellerId
      ).run();
    } else {
      // 신규 등록
      result = await DB.prepare(`
        INSERT INTO seller_business_info (
          seller_id, business_number, business_name, ceo_name,
          business_type, business_category, postal_code, address,
          phone, email, is_verified, verified_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, datetime('now'), datetime('now'))
      `).bind(
        auth.sellerId, business_number, business_name, ceo_name,
        business_type, business_category, postal_code, address,
        phone, email
      ).run();
    }

    return c.json({
      success: true,
      data: {
        id: existing ? existing.id : result.meta.last_row_id,
        seller_id: auth.sellerId,
        business_number,
        is_verified: false,
        message: '사업자 정보가 등록되었습니다. 관리자 승인 대기 중입니다.'
      }
    });
  } catch (err) {
    console.error('사업자 정보 등록 오류:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 사업자 정보 조회
app.get('/api/seller/business-info', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const businessInfo = await DB.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ?
    `).bind(auth.sellerId).first();

    if (!businessInfo) {
      return c.json({
        success: false,
        error: '등록된 사업자 정보가 없습니다.'
      }, 404);
    }

    return c.json({
      success: true,
      data: businessInfo
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 관리자: 사업자 정보 승인
app.put('/api/admin/seller-business/:id/verify', async (c) => {
  const { DB } = c.env;
  const auth = await verifyAdminSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  const id = c.req.param('id');
  const { verified } = await c.req.json();

  try {
    if (verified) {
      await DB.prepare(`
        UPDATE seller_business_info
        SET is_verified = 1, verified_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(id).run();

      return c.json({
        success: true,
        message: '사업자 정보가 승인되었습니다.'
      });
    } else {
      await DB.prepare(`
        UPDATE seller_business_info
        SET is_verified = 0, verified_at = NULL, updated_at = datetime('now')
        WHERE id = ?
      `).bind(id).run();

      return c.json({
        success: true,
        message: '사업자 정보 승인이 취소되었습니다.'
      });
    }
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 관리자: 모든 사업자 정보 조회
app.get('/api/admin/seller-business', async (c) => {
  const { DB } = c.env;
  const auth = await verifyAdminSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const businesses = await DB.prepare(`
      SELECT 
        sbi.*,
        s.username,
        s.name as seller_name,
        s.email as seller_email
      FROM seller_business_info sbi
      LEFT JOIN sellers s ON sbi.seller_id = s.id
      ORDER BY sbi.created_at DESC
    `).all();

    return c.json({
      success: true,
      data: businesses.results || []
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
      'SELECT * FROM orders WHERE order_number = ?'
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

    // 🚀 자동 세금계산서 발행: 배송완료 시
    if (status === 'DELIVERED') {
      try {
        console.log(`[AUTO TAX INVOICE] 배송완료 감지: ${orderNo}, 자동 발행 시작...`);

        // 주문 정보 조회 (사업자 정보 포함)
        const fullOrder = await DB.prepare(`
          SELECT 
            o.*,
            oi.seller_id
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.order_no = ?
          LIMIT 1
        `).bind(orderNo).first();

        // 사업자 정보가 있는지 확인
        if (fullOrder?.buyer_business_number && fullOrder?.buyer_business_name) {
          console.log(`[AUTO TAX INVOICE] 사업자 구매 확인: ${fullOrder.buyer_business_number}`);

          // 판매자 사업자 정보 조회
          const sellerBusiness = await DB.prepare(
            'SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1'
          ).bind(auth.sellerId).first();

          if (!sellerBusiness) {
            console.warn(`[AUTO TAX INVOICE] 판매자 사업자 정보 미승인: seller_id=${auth.sellerId}`);
            // 자동 발행 실패 로그 기록 (관리자 알림용)
            await DB.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_no, seller_id, status, error_message, created_at)
              VALUES (?, ?, 'failed', '판매자 사업자 정보가 승인되지 않았습니다.', CURRENT_TIMESTAMP)
            `).bind(orderNo, auth.sellerId).run();
          } else {
            // 세금계산서 자동 발행
            console.log(`[AUTO TAX INVOICE] 발행 시작: orderNo=${orderNo}`);

            // 주문 상품 정보 조회
            const orderItems = await DB.prepare(`
              SELECT 
                oi.*,
                p.name as product_name
              FROM order_items oi
              LEFT JOIN products p ON oi.product_id = p.id
              WHERE oi.order_id = ?
            `).bind(fullOrder.id).all();

            // 공급가액/부가세 계산
            const totalAmount = Number(fullOrder.total_amount);
            const supply_price = Math.floor(totalAmount / 1.1);
            const tax_amount = totalAmount - supply_price;

            // 계산서번호 생성
            const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
            const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const invoice_number = `${today}-${randomCode}`;

            // 세금계산서 발행 (DB 저장)
            const taxInvoiceResult = await DB.prepare(`
              INSERT INTO tax_invoices (
                seller_id, order_no, invoice_number, issue_date,
                supplier_business_number, supplier_business_name, supplier_ceo_name,
                supplier_address, supplier_business_type, supplier_business_category,
                supplier_email, supplier_phone,
                buyer_business_number, buyer_business_name, buyer_ceo_name,
                buyer_address, buyer_business_type, buyer_business_category,
                buyer_email, buyer_phone,
                supply_price, tax_amount, total_amount,
                status, api_provider, nts_confirm_number,
                created_at, updated_at
              ) VALUES (?, ?, ?, DATE('now'),
                ?, ?, ?,
                ?, ?, ?,
                ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?,
                ?, ?, ?,
                'issued', 'barobill', ?,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
              )
            `).bind(
              auth.sellerId,
              orderNo,
              invoice_number,
              sellerBusiness.business_number,
              sellerBusiness.business_name,
              sellerBusiness.ceo_name,
              sellerBusiness.address || '',
              sellerBusiness.business_type || '',
              sellerBusiness.business_category || '',
              sellerBusiness.email || '',
              sellerBusiness.phone || '',
              fullOrder.buyer_business_number,
              fullOrder.buyer_business_name,
              fullOrder.buyer_ceo_name || '',
              fullOrder.buyer_business_address || '',
              fullOrder.buyer_business_type || '',
              fullOrder.buyer_business_category || '',
              fullOrder.buyer_email || '',
              fullOrder.buyer_phone || '',
              supply_price,
              tax_amount,
              totalAmount,
              `AUTO-${Date.now()}-${randomCode}`
            ).run();

            const taxInvoiceId = taxInvoiceResult.meta.last_row_id;

            // 세금계산서 항목 저장
            for (const item of orderItems.results) {
              const itemSupplyPrice = Math.floor(Number(item.price) * Number(item.quantity) / 1.1);
              const itemTaxAmount = Number(item.price) * Number(item.quantity) - itemSupplyPrice;

              await DB.prepare(`
                INSERT INTO tax_invoice_items (
                  tax_invoice_id, product_name, quantity, unit_price,
                  supply_price, tax_amount, description, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              `).bind(
                taxInvoiceId,
                item.product_name || '상품명 없음',
                item.quantity,
                item.price,
                itemSupplyPrice,
                itemTaxAmount,
                item.option_name || ''
              ).run();
            }

            // 자동 발행 성공 로그 기록
            await DB.prepare(`
              INSERT INTO tax_invoice_auto_issue_log (order_no, seller_id, tax_invoice_id, status, created_at)
              VALUES (?, ?, ?, 'success', CURRENT_TIMESTAMP)
            `).bind(orderNo, auth.sellerId, taxInvoiceId).run();

            console.log(`[AUTO TAX INVOICE] ✅ 발행 완료: invoice_id=${taxInvoiceId}, invoice_number=${invoice_number}`);
          }
        } else {
          console.log(`[AUTO TAX INVOICE] 일반 구매 (사업자 정보 없음): ${orderNo}`);
        }
      } catch (autoIssueErr) {
        // 자동 발행 실패 시 로그만 기록하고 주문 상태 변경은 성공 처리
        console.error('[AUTO TAX INVOICE] 발행 실패:', autoIssueErr);
        try {
          await DB.prepare(`
            INSERT INTO tax_invoice_auto_issue_log (order_no, seller_id, status, error_message, created_at)
            VALUES (?, ?, 'failed', ?, CURRENT_TIMESTAMP)
          `).bind(orderNo, auth.sellerId, (autoIssueErr as Error).message).run();
        } catch (logErr) {
          console.error('[AUTO TAX INVOICE] 로그 기록 실패:', logErr);
        }
      }
    }

    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Update order tracking (Seller only) - 송장번호 입력
app.put('/api/seller/orders/:orderNo/tracking', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const orderNo = c.req.param('orderNo');
    const { courier, tracking_number } = await c.req.json();

    if (!courier || !tracking_number) {
      return c.json({ success: false, error: 'Courier and tracking number are required' }, 400);
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

    // Update tracking info and set status to SHIPPING if not already
    await DB.prepare(`
      UPDATE orders 
      SET courier = ?, 
          tracking_number = ?, 
          shipped_at = CASE WHEN shipped_at IS NULL THEN CURRENT_TIMESTAMP ELSE shipped_at END,
          status = CASE WHEN status = 'PREPARING' THEN 'SHIPPING' ELSE status END,
          updated_at = CURRENT_TIMESTAMP 
      WHERE order_no = ?
    `).bind(courier, tracking_number, orderNo).run();

    return c.json({ success: true, message: 'Tracking information updated' });
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
// Seller Management APIs (Admin only)
// =================================

// Get all sellers
app.get('/api/admin/sellers', async (c) => {
  const { DB } = c.env;
  const auth = await verifyAdminSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const sellers = await DB.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, is_active, last_login_at, created_at
      FROM sellers
      ORDER BY created_at DESC
    `).all();

    return c.json({ success: true, data: sellers.results });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Create new seller
app.post('/api/admin/sellers', async (c) => {
  const { DB } = c.env;
  const auth = await verifyAdminSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const { username, password, name, email, phone, business_name, business_number } = await c.req.json();

    // 필수 필드 검증
    if (!username || !password || !name || !email || !business_name) {
      return c.json({ success: false, error: '필수 항목을 모두 입력해주세요' }, 400);
    }

    // 아이디 중복 체크
    const existingUser = await DB.prepare('SELECT id FROM sellers WHERE username = ?').bind(username).first();
    
    if (existingUser) {
      return c.json({ success: false, error: '이미 존재하는 아이디입니다' }, 400);
    }

    // 이메일 중복 체크
    const existingEmail = await DB.prepare('SELECT id FROM sellers WHERE email = ?').bind(email).first();
    
    if (existingEmail) {
      return c.json({ success: false, error: '이미 존재하는 이메일입니다' }, 400);
    }

    // 비밀번호 해시 (실제로는 bcrypt 사용 권장, 여기서는 간단히 처리)
    const password_hash = `$2a$10$placeholder_hash_for_${password}`;

    // 판매자 생성 (관리자가 생성하면 자동 승인)
    const result = await DB.prepare(`
      INSERT INTO sellers (username, password_hash, name, email, phone, business_name, business_number, 
                          status, is_active, approved_by, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, datetime('now'))
    `).bind(username, password_hash, name, email, phone || null, business_name, business_number || null, auth.adminId).run();

    return c.json({
      success: true,
      data: {
        id: result.meta.last_row_id,
        username,
        name,
        email,
        business_name
      }
    });

  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Update seller
app.put('/api/admin/sellers/:id', async (c) => {
  const { DB } = c.env;
  const auth = await verifyAdminSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const sellerId = c.req.param('id');
    const { name, email, phone, business_name, business_number, is_active, status } = await c.req.json();

    // 판매자 존재 확인
    const seller = await DB.prepare('SELECT id FROM sellers WHERE id = ?').bind(sellerId).first();
    
    if (!seller) {
      return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    }

    // 업데이트
    await DB.prepare(`
      UPDATE sellers 
      SET name = ?, email = ?, phone = ?, business_name = ?, business_number = ?, 
          is_active = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(name, email, phone || null, business_name, business_number || null, is_active, status, sellerId).run();

    return c.json({ success: true });

  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Delete seller (비활성화)
app.delete('/api/admin/sellers/:id', async (c) => {
  const { DB } = c.env;
  const auth = await verifyAdminSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const sellerId = c.req.param('id');

    // 판매자 존재 확인
    const seller = await DB.prepare('SELECT id, username FROM sellers WHERE id = ?').bind(sellerId).first();
    
    if (!seller) {
      return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    }

    // 실제 삭제 대신 비활성화 (데이터 보존)
    await DB.prepare(`
      UPDATE sellers 
      SET is_active = 0, status = 'suspended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(sellerId).run();

    // 해당 판매자의 모든 세션 삭제 (로그아웃 처리)
    await DB.prepare('DELETE FROM admin_sessions WHERE seller_id = ?').bind(sellerId).run();

    return c.json({ 
      success: true, 
      message: `판매자 '${seller.username}'의 로그인 권한이 삭제되었습니다` 
    });

  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Reset seller password (관리자가 비밀번호 재설정)
app.post('/api/admin/sellers/:id/reset-password', async (c) => {
  const { DB } = c.env;
  const auth = await verifyAdminSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const sellerId = c.req.param('id');
    const { new_password } = await c.req.json();

    if (!new_password || new_password.length < 6) {
      return c.json({ success: false, error: '비밀번호는 6자 이상이어야 합니다' }, 400);
    }

    // 판매자 존재 확인
    const seller = await DB.prepare('SELECT id, username FROM sellers WHERE id = ?').bind(sellerId).first();
    
    if (!seller) {
      return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    }

    // 비밀번호 해시
    const password_hash = `$2a$10$placeholder_hash_for_${new_password}`;

    // 비밀번호 업데이트
    await DB.prepare(`
      UPDATE sellers 
      SET password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(password_hash, sellerId).run();

    // 해당 판매자의 모든 세션 삭제 (재로그인 필요)
    await DB.prepare('DELETE FROM admin_sessions WHERE seller_id = ?').bind(sellerId).run();

    return c.json({ 
      success: true, 
      message: `판매자 '${seller.username}'의 비밀번호가 재설정되었습니다` 
    });

  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// =================================
// Page Routes
// =================================

// 어드민 로그인 페이지
// Removed route: /admin/login (handled by React SPA)

// 판매자 로그인 페이지
// Removed route: /seller/login (handled by React SPA)

// 관리자 대시보드
// Removed route: /admin (handled by React SPA)

// =================================
// 나이스페이먼츠 API
// =================================

// 1. 주문 생성 API (결제 전)
app.post('/api/orders/create', async (c) => {
  const { DB } = c.env;
  
  try {
    const { 
      userId, cartItems, totalAmount, shippingAddressId, sellerId,
      // 세금계산서 발행을 위한 사업자 정보
      issueTaxInvoice,
      buyerBusinessNumber,
      buyerBusinessName,
      buyerCeoName
    } = await c.req.json();
    
    console.log('주문 생성 요청:', { userId, cartItems: cartItems?.length, totalAmount, shippingAddressId, sellerId, issueTaxInvoice });
    
    // 수수료 계산 (10%)
    const commissionRate = 10.00;
    const commissionAmount = Math.floor(totalAmount * (commissionRate / 100));
    const sellerAmount = totalAmount - commissionAmount;
    
    // 배송지 정보 조회
    let shippingInfo = null;
    if (shippingAddressId) {
      const addressResult = await DB.prepare(`
        SELECT * FROM shipping_addresses WHERE id = ? AND user_id = ?
      `).bind(shippingAddressId, userId).first();
      
      if (!addressResult) {
        return c.json({ success: false, error: '배송지 정보를 찾을 수 없습니다' }, 400);
      }
      shippingInfo = addressResult;
    }
    
    // 임시 사용자 처리
    let finalUserId = userId;
    if (!userId || userId === 'toss_user_temp') {
      const tempUserResult = await DB.prepare(`
        SELECT id FROM users WHERE email = 'temp@example.com'
      `).first();
      
      if (tempUserResult) {
        finalUserId = tempUserResult.id;
      } else {
        const insertResult = await DB.prepare(`
          INSERT INTO users (name, email) VALUES (?, ?)
        `).bind('임시 사용자', 'temp@example.com').run();
        finalUserId = insertResult.meta.last_row_id;
      }
    }
    
    // 주문번호 생성 (ORDER_timestamp_random)
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const orderNumber = `ORDER_${timestamp}_${random}`;
    
    // 재고 확인
    for (const item of cartItems) {
      const product = await DB.prepare(`
        SELECT stock FROM products WHERE id = ?
      `).bind(item.product_id).first();
      
      if (!product) {
        return c.json({ success: false, error: `상품을 찾을 수 없습니다 (ID: ${item.product_id})` }, 400);
      }
      
      if (product.stock < item.quantity) {
        return c.json({ success: false, error: `재고가 부족합니다 (상품 ID: ${item.product_id})` }, 400);
      }
    }
    
    // 주문 생성 (payment_status: pending)
    const orderResult = await DB.prepare(`
      INSERT INTO orders (
        order_number, user_id, total_amount, payment_status,
        seller_id, commission_rate, commission_amount, seller_amount,
        shipping_address_id, shipping_name, shipping_phone, shipping_address, shipping_postal_code,
        issue_tax_invoice, buyer_business_number, buyer_business_name, buyer_ceo_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      orderNumber,
      finalUserId,
      totalAmount,
      'pending',
      sellerId || null,
      commissionRate,
      commissionAmount,
      sellerAmount,
      shippingAddressId || null,
      shippingInfo?.recipient_name || null,
      shippingInfo?.phone || null,
      shippingInfo?.address ? `${shippingInfo.address} ${shippingInfo.address_detail}` : null,
      shippingInfo?.postal_code || null,
      issueTaxInvoice ? 1 : 0,
      buyerBusinessNumber || null,
      buyerBusinessName || null,
      buyerCeoName || null
    ).run();
    
    const orderId = orderResult.meta.last_row_id;
    
    // 주문 아이템 생성
    for (const item of cartItems) {
      await DB.prepare(`
        INSERT INTO order_items (order_id, product_id, option_id, quantity, price)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        orderId,
        item.product_id,
        item.option_id || null,
        item.quantity,
        item.price_snapshot || item.price
      ).run();
      
      // 재고 차감
      await DB.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ?
      `).bind(item.quantity, item.product_id).run();
    }
    
    console.log('주문 생성 완료:', { orderId, orderNumber });
    
    return c.json({
      success: true,
      orderId,
      orderNumber,
      totalAmount
    });
    
  } catch (error) {
    console.error('주문 생성 실패:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 2. 나이스페이 서버 승인 API
app.post('/api/payments/nicepay/confirm', async (c) => {
  const { DB } = c.env;
  
  try {
    const { AuthResultCode, AuthResultMsg, TID, Amt, MID, Moid, AuthToken } = await c.req.json();
    
    console.log('나이스페이 서버 승인 요청:', { AuthResultCode, TID, Amt, Moid });
    
    // 1. 인증 결과 확인
    if (AuthResultCode !== '0000') {
      console.error('나이스페이 인증 실패:', AuthResultMsg);
      return c.json({
        success: false,
        error: AuthResultMsg || '결제 인증에 실패했습니다'
      }, 400);
    }
    
    // 2. 주문 조회
    const order = await DB.prepare(`
      SELECT * FROM orders WHERE order_number = ?
    `).bind(Moid).first();
    
    if (!order) {
      return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404);
    }
    
    // 3. 금액 검증
    if (parseInt(Amt) !== order.total_amount) {
      return c.json({
        success: false,
        error: '결제 금액이 일치하지 않습니다'
      }, 400);
    }
    
    // 4. 나이스페이 서버 승인 API 호출
    const NICEPAY_API_URL = 'https://api.nicepay.co.kr/v1/payments/approval';
    const NICEPAY_MID = c.env.NICEPAY_MID || 'PItobe211m';
    const NICEPAY_KEY = c.env.NICEPAY_KEY || 'GKHsnRI/P5V3RpU7v5UA2ElK5vz0v3Nyf+wdd+T+RXvh8R/xWwZk7gzwQwKZi6kcJ2lnif1xgYYF6amQ5cRnTA==';
    
    // 나이스페이 승인 요청
    const approvalResponse = await fetch(NICEPAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(NICEPAY_MID + ':' + NICEPAY_KEY)}`
      },
      body: JSON.stringify({
        tid: TID,
        amt: Amt,
        ediDate: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
        authToken: AuthToken
      })
    });
    
    if (!approvalResponse.ok) {
      const errorData = await approvalResponse.json();
      console.error('나이스페이 승인 실패:', errorData);
      return c.json({
        success: false,
        error: errorData.resultMsg || '결제 승인에 실패했습니다'
      }, 500);
    }
    
    const approvalData = await approvalResponse.json();
    
    // 5. 주문 상태 업데이트
    await DB.prepare(`
      UPDATE orders 
      SET payment_status = 'approved',
          payment_key = ?,
          transaction_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(TID, approvalData.tid || TID, Moid).run();
    
    // 6. 장바구니 비우기
    if (order.user_id) {
      await DB.prepare(`
        DELETE FROM cart_items WHERE user_id = ?
      `).bind(order.user_id).run();
    }
    
    console.log('결제 승인 완료:', { orderNumber: Moid, tid: TID });
    
    return c.json({
      success: true,
      orderNumber: Moid,
      tid: TID,
      amount: Amt
    });
    
  } catch (error) {
    console.error('결제 승인 실패:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 3. 나이스페이 리턴 페이지 (결제창에서 돌아오는 페이지)

// =================================
// Page Routes
// =================================

// 주문 조회 API
// 판매자 대시보드
// Removed route: /seller (handled by React SPA)

// 고객 주문 목록 페이지
// Removed route: /my-orders (handled by React SPA)

// =================================
// Payment Pages
// =================================

// 결제 성공 페이지
// Removed route: /payment/success (handled by React SPA)

// 결제 취소 페이지
// Removed route: /payment/cancel (handled by React SPA)

// ==================== Seller APIs ====================

// 셀러 매출 조회 API
app.get('/api/seller/sales', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sessionToken = c.req.header('X-Session-Token');
    
    if (!sessionToken) {
      return c.json({ success: false, error: '인증 토큰이 없습니다.' }, 401);
    }
    
    // 세션 검증
    const session = await getSession(DB, sessionToken);
    if (!session) {
      return c.json({ success: false, error: '유효하지 않은 세션입니다.' }, 401);
    }
    
    // 셀러인지 확인
    if (session.user_type !== 'seller') {
      return c.json({ success: false, error: '셀러만 접근 가능합니다.' }, 403);
    }
    
    const sellerId = session.seller_id || session.user_id;
    const { startDate, endDate } = c.req.query();
    
    // 날짜 범위 설정 (기본값: 이번 달)
    const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const end = endDate || new Date().toISOString().split('T')[0];
    
    // 셀러 정보 조회
    const sellerResult = await DB.prepare(`
      SELECT id, username, display_name, business_name, email
      FROM sellers
      WHERE id = ?
    `).bind(sellerId).first();
    
    if (!sellerResult) {
      return c.json({ success: false, error: '셀러를 찾을 수 없습니다.' }, 404);
    }
    
    // 매출 통계 조회
    const statsResult = await DB.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_amount,
        COALESCE(SUM(commission_amount), 0) as total_commission,
        COALESCE(SUM(seller_amount), 0) as net_amount
      FROM orders
      WHERE seller_id = ?
        AND payment_status = 'approved'
        AND DATE(created_at) >= DATE(?)
        AND DATE(created_at) <= DATE(?)
    `).bind(sellerId, start, end).first();
    
    // 최근 주문 목록 조회
    const ordersResult = await DB.prepare(`
      SELECT 
        o.id,
        o.order_number,
        o.total_amount,
        o.commission_amount,
        o.seller_amount,
        o.payment_status,
        o.created_at,
        u.name as user_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.seller_id = ?
        AND DATE(o.created_at) >= DATE(?)
        AND DATE(o.created_at) <= DATE(?)
      ORDER BY o.created_at DESC
      LIMIT 100
    `).bind(sellerId, start, end).all();
    
    return c.json({
      success: true,
      data: {
        seller: sellerResult,
        stats: statsResult,
        orders: ordersResult?.results || []
      }
    });
  } catch (error) {
    console.error('Seller sales query error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 정산서 CSV 다운로드 API
app.get('/api/seller/settlement-csv', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sessionToken = c.req.header('X-Session-Token');
    
    if (!sessionToken) {
      return c.json({ success: false, error: '인증 토큰이 없습니다.' }, 401);
    }
    
    // 세션 검증
    const session = await getSession(DB, sessionToken);
    if (!session) {
      return c.json({ success: false, error: '유효하지 않은 세션입니다.' }, 401);
    }
    
    // 셀러인지 확인
    if (session.user_type !== 'seller') {
      return c.json({ success: false, error: '셀러만 접근 가능합니다.' }, 403);
    }
    
    const sellerId = session.seller_id || session.user_id;
    const { startDate, endDate } = c.req.query();
    
    // 날짜 범위 설정
    const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const end = endDate || new Date().toISOString().split('T')[0];
    
    // 주문 데이터 조회 (세금계산서 정보 포함)
    const ordersResult = await DB.prepare(`
      SELECT 
        o.order_number,
        o.total_amount,
        o.commission_amount,
        o.seller_amount,
        o.payment_status,
        o.status,
        o.created_at,
        u.name as user_name,
        o.buyer_business_name,
        o.buyer_business_number,
        ti.id as tax_invoice_id,
        ti.invoice_number,
        ti.issue_date,
        ti.status as tax_invoice_status,
        ti.nts_confirm_number
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN tax_invoices ti ON o.order_number = ti.order_no
      WHERE o.seller_id = ?
        AND o.payment_status IN ('approved', 'completed')
        AND DATE(o.created_at) >= DATE(?)
        AND DATE(o.created_at) <= DATE(?)
      ORDER BY o.created_at DESC
    `).bind(sellerId, start, end).all();
    
    // CSV 생성 (세금계산서 정보 추가)
    let csv = '주문번호,주문일시,주문자,총금액,수수료(10%),정산금액(90%),주문상태,사업자명,사업자번호,세금계산서번호,발행일자,계산서상태,국세청승인번호\n';
    
    for (const order of ordersResult?.results || []) {
      const orderStatus = order.status === 'DELIVERED' ? '배송완료' : 
                         order.status === 'SHIPPING' ? '배송중' : 
                         order.status === 'PREPARING' ? '상품준비중' : 
                         order.status === 'PAY_COMPLETE' ? '결제완료' : '완료';
      
      const businessName = order.buyer_business_name || '-';
      const businessNumber = order.buyer_business_number || '-';
      const invoiceNumber = order.invoice_number || '-';
      const issueDate = order.issue_date || '-';
      const taxStatus = order.tax_invoice_status === 'issued' ? '발행완료' : 
                       order.tax_invoice_status === 'cancelled' ? '취소' : '-';
      const ntsNumber = order.nts_confirm_number || '-';
      
      csv += `${order.order_number},${order.created_at},${order.user_name || '익명'},${order.total_amount},${order.commission_amount},${order.seller_amount},${orderStatus},${businessName},${businessNumber},${invoiceNumber},${issueDate},${taxStatus},${ntsNumber}\n`;
    }
    
    // CSV 파일 다운로드
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="settlement_${start}_${end}.csv"`
      }
    });
  } catch (error) {
    console.error('CSV download error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// =================================
// 세금계산서 발행 API
// =================================

// 세금계산서 발행
app.post('/api/seller/tax-invoices/issue', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const { order_no } = await c.req.json();

    if (!order_no) {
      return c.json({ success: false, error: '주문번호는 필수입니다.' }, 400);
    }

    // 주문 조회
    const order = await DB.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.order_number = ?
    `).bind(order_no).first();

    if (!order) {
      return c.json({ success: false, error: '주문을 찾을 수 없습니다.' }, 404);
    }

    // 세금계산서 발행 요청 여부 확인
    if (!order.issue_tax_invoice) {
      return c.json({ success: false, error: '세금계산서 발행이 요청되지 않은 주문입니다.' }, 400);
    }

    // 사업자 정보 조회
    const businessInfo = await DB.prepare(`
      SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1
    `).bind(auth.sellerId).first();

    if (!businessInfo) {
      return c.json({ success: false, error: '승인된 사업자 정보가 없습니다. 관리자 승인을 기다려주세요.' }, 400);
    }

    // 주문 상품 조회
    const orderItems = await DB.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(order.id).all();

    // 공급가액 계산 (부가세 별도)
    const totalAmount = Number(order.total_amount);
    const supplyPrice = Math.floor(totalAmount / 1.1); // 공급가액
    const taxAmount = totalAmount - supplyPrice; // 부가세 10%

    // 세금계산서 번호 생성
    const today = new Date().toISOString().split('T')[0];
    const invoiceNumber = `${today}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // 바로빌 API 데이터 준비
    const barobillRequest = convertToBarobillFormat(businessInfo, order, orderItems.results);
    
    // 바로빌 API 호출 (Mock 모드 또는 실제 API 자동 선택)
    let barobillResult;
    let ntsConfirmNumber;
    let apiInvoiceKey;
    
    try {
      barobillResult = await issueTaxInvoiceAuto(barobillRequest);
      ntsConfirmNumber = barobillResult.ntsConfirmNumber;
      apiInvoiceKey = barobillResult.invoiceKey;
      
      console.log('바로빌 발행 성공:', {
        ntsConfirmNumber,
        invoiceKey: apiInvoiceKey,
        mockMode: isBarobillMockMode(),
      });
    } catch (barobillError) {
      console.error('바로빌 API 호출 실패:', barobillError);
      // 바로빌 실패 시에도 DB에는 기록 (상태를 failed로)
      ntsConfirmNumber = 'FAILED';
      apiInvoiceKey = null;
    }

    // 세금계산서 DB 저장
    const taxInvoiceResult = await DB.prepare(`
      INSERT INTO tax_invoices (
        seller_id, order_no, invoice_type, invoice_number, issue_date,
        supplier_business_number, supplier_business_name, supplier_ceo_name, supplier_address,
        supplier_business_type, supplier_business_category,
        buyer_business_number, buyer_name, buyer_ceo_name,
        supply_price, tax_amount, total_amount,
        status, api_provider, api_invoice_id, nts_confirm_number,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      auth.sellerId,
      order_no,
      'tax',
      invoiceNumber,
      today,
      businessInfo.business_number,
      businessInfo.business_name,
      businessInfo.ceo_name,
      businessInfo.address,
      businessInfo.business_type,
      businessInfo.business_category,
      order.buyer_business_number,
      order.buyer_business_name,
      order.buyer_ceo_name,
      supplyPrice,
      taxAmount,
      totalAmount,
      ntsConfirmNumber === 'FAILED' ? 'failed' : 'issued',
      isBarobillMockMode() ? 'mock' : 'barobill',
      apiInvoiceKey,
      ntsConfirmNumber
    ).run();

    const taxInvoiceId = taxInvoiceResult.meta.last_row_id;

    // 세금계산서 품목 추가
    for (const item of orderItems.results) {
      const itemSupplyPrice = Math.floor(Number(item.price) * Number(item.quantity) / 1.1);
      const itemTaxAmount = Number(item.price) * Number(item.quantity) - itemSupplyPrice;

      await DB.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, order_item_id, product_name, quantity,
          unit_price, supply_price, tax_amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        taxInvoiceId,
        item.id,
        item.product_name,
        item.quantity,
        item.price,
        itemSupplyPrice,
        itemTaxAmount
      ).run();
    }

    return c.json({
      success: true,
      data: {
        invoice_id: taxInvoiceId,
        invoice_number: invoiceNumber,
        issue_date: today,
        total_amount: totalAmount,
        supply_price: supplyPrice,
        tax_amount: taxAmount,
        status: ntsConfirmNumber === 'FAILED' ? 'failed' : 'issued',
        nts_confirm_number: ntsConfirmNumber,
        api_invoice_key: apiInvoiceKey,
        mock_mode: isBarobillMockMode(),
        message: ntsConfirmNumber === 'FAILED' 
          ? '바로빌 API 호출 실패. 나중에 다시 시도해주세요.' 
          : isBarobillMockMode()
            ? '세금계산서가 발행되었습니다. (Mock Mode - 실제 발행 아님)'
            : '세금계산서가 발행되었습니다.'
      }
    });
  } catch (err) {
    console.error('세금계산서 발행 오류:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 세금계산서 목록 조회
app.get('/api/seller/tax-invoices', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const { start_date, end_date, status } = c.req.query();

    let query = `
      SELECT * FROM tax_invoices
      WHERE seller_id = ?
    `;
    const params = [auth.sellerId];

    if (start_date) {
      query += ` AND issue_date >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND issue_date <= ?`;
      params.push(end_date);
    }
    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;

    const taxInvoices = await DB.prepare(query).bind(...params).all();

    return c.json({
      success: true,
      data: taxInvoices.results || [],
      total: taxInvoices.results?.length || 0
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 세금계산서 상세 조회
app.get('/api/seller/tax-invoices/:id', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const id = c.req.param('id');

    // 세금계산서 조회
    const taxInvoice = await DB.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(id, auth.sellerId).first();

    if (!taxInvoice) {
      return c.json({ success: false, error: '세금계산서를 찾을 수 없습니다.' }, 404);
    }

    // 품목 조회
    const items = await DB.prepare(`
      SELECT * FROM tax_invoice_items WHERE tax_invoice_id = ?
    `).bind(id).all();

    return c.json({
      success: true,
      data: {
        ...taxInvoice,
        items: items.results || []
      }
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 세금계산서 취소
app.post('/api/seller/tax-invoices/:id/cancel', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const id = c.req.param('id');
    const { reason } = await c.req.json();

    // 세금계산서 조회
    const taxInvoice = await DB.prepare(`
      SELECT * FROM tax_invoices WHERE id = ? AND seller_id = ?
    `).bind(id, auth.sellerId).first();

    if (!taxInvoice) {
      return c.json({ success: false, error: '세금계산서를 찾을 수 없습니다.' }, 404);
    }

    // 발행일 익일까지만 취소 가능 (법적 요구사항)
    const issueDate = new Date(taxInvoice.issue_date);
    const nextDay = new Date(issueDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const now = new Date();

    if (now > nextDay) {
      return c.json({ success: false, error: '발행일 익일까지만 취소 가능합니다.' }, 400);
    }

    // TODO: 실제 바로빌 API 취소 호출
    // await callBarobillCancelAPI({ ... });

    // 취소 처리
    await DB.prepare(`
      UPDATE tax_invoices
      SET status = 'cancelled', updated_at = datetime('now')
      WHERE id = ?
    `).bind(id).run();

    return c.json({
      success: true,
      message: '세금계산서가 취소되었습니다.'
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// =================================
// Tax Invoice Auto Issue & Retry APIs
// =================================

// 자동 발행 실패 목록 조회 (관리자/판매자)
app.get('/api/seller/tax-invoices/auto-issue-logs', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const { status, limit = 50 } = c.req.query();

    let query = `
      SELECT 
        log.*,
        o.total_amount,
        o.buyer_business_name
      FROM tax_invoice_auto_issue_log log
      LEFT JOIN orders o ON log.order_no = o.order_no
      WHERE log.seller_id = ?
    `;

    const params: any[] = [auth.sellerId];

    if (status) {
      query += ' AND log.status = ?';
      params.push(status);
    }

    query += ' ORDER BY log.created_at DESC LIMIT ?';
    params.push(Number(limit));

    const logs = await DB.prepare(query).bind(...params).all();

    return c.json({ success: true, data: logs.results });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 자동 발행 재시도 API (관리자/판매자)
app.post('/api/seller/tax-invoices/retry/:orderNo', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const orderNo = c.req.param('orderNo');

    console.log(`[TAX INVOICE RETRY] 재시도 시작: ${orderNo}`);

    // 이전 실패 로그 조회
    const failedLog = await DB.prepare(`
      SELECT * FROM tax_invoice_auto_issue_log
      WHERE order_no = ? AND seller_id = ? AND status = 'failed'
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(orderNo, auth.sellerId).first();

    if (!failedLog) {
      return c.json({ success: false, error: '재시도할 실패 로그를 찾을 수 없습니다.' }, 404);
    }

    // 재시도 횟수 확인 (최대 3회)
    const retryCount = Number(failedLog.retry_count || 0);
    if (retryCount >= 3) {
      return c.json({ success: false, error: '최대 재시도 횟수(3회)를 초과했습니다.' }, 400);
    }

    // 주문 정보 조회
    const fullOrder = await DB.prepare(`
      SELECT 
        o.*,
        oi.seller_id
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.order_no = ?
      LIMIT 1
    `).bind(orderNo).first();

    if (!fullOrder) {
      return c.json({ success: false, error: '주문을 찾을 수 없습니다.' }, 404);
    }

    // 사업자 정보 확인
    if (!fullOrder.buyer_business_number || !fullOrder.buyer_business_name) {
      return c.json({ success: false, error: '주문에 사업자 정보가 없습니다.' }, 400);
    }

    // 판매자 사업자 정보 조회
    const sellerBusiness = await DB.prepare(
      'SELECT * FROM seller_business_info WHERE seller_id = ? AND is_verified = 1'
    ).bind(auth.sellerId).first();

    if (!sellerBusiness) {
      return c.json({ success: false, error: '판매자 사업자 정보가 승인되지 않았습니다.' }, 400);
    }

    // 주문 상품 정보 조회
    const orderItems = await DB.prepare(`
      SELECT 
        oi.*,
        p.name as product_name
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).bind(fullOrder.id).all();

    // 공급가액/부가세 계산
    const totalAmount = Number(fullOrder.total_amount);
    const supply_price = Math.floor(totalAmount / 1.1);
    const tax_amount = totalAmount - supply_price;

    // 계산서번호 생성
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const invoice_number = `${today}-${randomCode}`;

    // 세금계산서 발행 (DB 저장)
    const taxInvoiceResult = await DB.prepare(`
      INSERT INTO tax_invoices (
        seller_id, order_no, invoice_number, issue_date,
        supplier_business_number, supplier_business_name, supplier_ceo_name,
        supplier_address, supplier_business_type, supplier_business_category,
        supplier_email, supplier_phone,
        buyer_business_number, buyer_business_name, buyer_ceo_name,
        buyer_address, buyer_business_type, buyer_business_category,
        buyer_email, buyer_phone,
        supply_price, tax_amount, total_amount,
        status, api_provider, nts_confirm_number,
        created_at, updated_at
      ) VALUES (?, ?, ?, DATE('now'),
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        'issued', 'barobill', ?,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `).bind(
      auth.sellerId,
      orderNo,
      invoice_number,
      sellerBusiness.business_number,
      sellerBusiness.business_name,
      sellerBusiness.ceo_name,
      sellerBusiness.address || '',
      sellerBusiness.business_type || '',
      sellerBusiness.business_category || '',
      sellerBusiness.email || '',
      sellerBusiness.phone || '',
      fullOrder.buyer_business_number,
      fullOrder.buyer_business_name,
      fullOrder.buyer_ceo_name || '',
      fullOrder.buyer_business_address || '',
      fullOrder.buyer_business_type || '',
      fullOrder.buyer_business_category || '',
      fullOrder.buyer_email || '',
      fullOrder.buyer_phone || '',
      supply_price,
      tax_amount,
      totalAmount,
      `RETRY-${Date.now()}-${randomCode}`
    ).run();

    const taxInvoiceId = taxInvoiceResult.meta.last_row_id;

    // 세금계산서 항목 저장
    for (const item of orderItems.results) {
      const itemSupplyPrice = Math.floor(Number(item.price) * Number(item.quantity) / 1.1);
      const itemTaxAmount = Number(item.price) * Number(item.quantity) - itemSupplyPrice;

      await DB.prepare(`
        INSERT INTO tax_invoice_items (
          tax_invoice_id, product_name, quantity, unit_price,
          supply_price, tax_amount, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        taxInvoiceId,
        item.product_name || '상품명 없음',
        item.quantity,
        item.price,
        itemSupplyPrice,
        itemTaxAmount,
        item.option_name || ''
      ).run();
    }

    // 재시도 성공 로그 기록
    await DB.prepare(`
      INSERT INTO tax_invoice_auto_issue_log (
        order_no, seller_id, tax_invoice_id, status, retry_count, created_at
      ) VALUES (?, ?, ?, 'success', ?, CURRENT_TIMESTAMP)
    `).bind(orderNo, auth.sellerId, taxInvoiceId, retryCount + 1).run();

    // 기존 실패 로그 상태 업데이트
    await DB.prepare(`
      UPDATE tax_invoice_auto_issue_log
      SET status = 'retry', retry_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(retryCount + 1, failedLog.id).run();

    console.log(`[TAX INVOICE RETRY] ✅ 재시도 성공: invoice_id=${taxInvoiceId}, retry_count=${retryCount + 1}`);

    return c.json({
      success: true,
      data: {
        invoice_id: taxInvoiceId,
        invoice_number,
        retry_count: retryCount + 1
      }
    });
  } catch (err) {
    console.error('[TAX INVOICE RETRY] 재시도 실패:', err);

    // 재시도 실패 로그 기록
    try {
      const orderNo = c.req.param('orderNo');
      const failedLog = await DB.prepare(`
        SELECT * FROM tax_invoice_auto_issue_log
        WHERE order_no = ? AND seller_id = ? AND status = 'failed'
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(orderNo, auth.sellerId).first();

      const retryCount = Number(failedLog?.retry_count || 0);

      await DB.prepare(`
        INSERT INTO tax_invoice_auto_issue_log (
          order_no, seller_id, status, error_message, retry_count, created_at
        ) VALUES (?, ?, 'failed', ?, ?, CURRENT_TIMESTAMP)
      `).bind(orderNo, auth.sellerId, (err as Error).message, retryCount + 1).run();
    } catch (logErr) {
      console.error('[TAX INVOICE RETRY] 로그 기록 실패:', logErr);
    }

    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 404 handler - return JSON for API routes
// For all other routes, don't handle them - let Cloudflare Pages serve static files
app.notFound((c) => {
  const path = c.req.path;
  
  // Only handle API routes in the Worker
  if (path.startsWith('/api/')) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  // For non-API routes, pass through to let Pages serve static files
  // Return undefined to indicate this route should not be handled by the Worker
  return new Response(null, { status: 404 });
});

export default app;
