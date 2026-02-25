import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
const app = new Hono<{ Bindings: Bindings }>();
app.use('/api/*', cors());
app.use('/static/*', serveStatic({ root: './public' }));
// API Routes
// =================================

// =================================
// Authentication APIs
// =================================

// 세션 생성 (D1에 저장)
async function createSession(DB: any, userId: number, userType: 'admin' | 'seller', userData: any) {
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
  const KAKAO_REST_API_KEY = c.env.KAKAO_REST_API_KEY;
  const KAKAO_REDIRECT_URI = c.env.KAKAO_REDIRECT_URI || 'http://localhost:3000/auth/kakao/callback';
  
  try {
    const code = c.req.query('code');
    
    if (!code) {
      return c.html(`
        <!DOCTYPE html>
        <html lang="ko">
        <head>
            <meta charset="UTF-8">
            <title>로그인 실패</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-100 flex items-center justify-center min-h-screen">
            <div class="bg-white p-8 rounded-lg shadow-lg text-center">
                <div class="text-red-500 text-5xl mb-4">❌</div>
                <h1 class="text-2xl font-bold text-gray-800 mb-4">로그인 실패</h1>
                <p class="text-gray-600 mb-6">인증 코드가 없습니다.</p>
                <a href="/live/1" class="bg-yellow-500 text-white px-6 py-2 rounded-lg hover:bg-yellow-600">
                    홈으로 돌아가기
                </a>
            </div>
        </body>
        </html>
      `);
    }
    
    // 카카오 토큰 받기
    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: KAKAO_REST_API_KEY,
        redirect_uri: KAKAO_REDIRECT_URI,
        code: code
      })
    });
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      throw new Error('액세스 토큰을 받지 못했습니다');
    }
    
    // 카카오 사용자 정보 가져오기
    const userResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });
    
    const kakaoUser = await userResponse.json();
    
    // 기존 사용자 확인
    let user = await DB.prepare(`
      SELECT * FROM users WHERE kakao_id = ?
    `).bind(kakaoUser.id.toString()).first();
    
    // 신규 사용자면 등록
    if (!user) {
      const result = await DB.prepare(`
        INSERT INTO users (toss_user_id, kakao_id, name, email, profile_image, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        `kakao_${kakaoUser.id}`,
        kakaoUser.id.toString(),
        kakaoUser.properties?.nickname || '익명',
        kakaoUser.kakao_account?.email || '',
        kakaoUser.properties?.profile_image || ''
      ).run();
      
      const userId = result.meta.last_row_id;
      
      user = await DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(userId).first();
    }
    
    // 세션 생성 (쿠키 방식)
    const sessionToken = `user_${user.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24시간 후
    
    await DB.prepare(`
      INSERT INTO admin_sessions (session_token, user_type, expires_at)
      VALUES (?, ?, ?)
    `).bind(sessionToken, 'user', expiresAt).run();
    
    // 로그인 성공 페이지로 리다이렉트 (세션 토큰 전달)
    return c.html(`
      <!DOCTYPE html>
      <html lang="ko">
      <head>
          <meta charset="UTF-8">
          <title>로그인 성공</title>
          <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center min-h-screen">
          <div class="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
              <div class="animate-bounce text-yellow-500 text-6xl mb-4">✓</div>
              <h1 class="text-3xl font-bold text-gray-800 mb-4">로그인 성공!</h1>
              <p class="text-gray-600 mb-2">환영합니다, <strong>${user.name}</strong>님!</p>
              <p class="text-sm text-gray-500 mb-6">잠시 후 라이브 페이지로 이동합니다...</p>
              
              <div class="bg-yellow-50 p-4 rounded-lg mb-6">
                  <img src="${user.profile_image || '/static/default-avatar.png'}" alt="프로필" 
                       class="w-16 h-16 rounded-full mx-auto mb-2 object-cover"
                       onerror="this.src='/static/default-avatar.png'">
                  <p class="text-sm text-gray-700">${user.email || '이메일 정보 없음'}</p>
              </div>
              
              <button onclick="goToLive()" class="w-full bg-yellow-500 text-white px-6 py-3 rounded-lg hover:bg-yellow-600 font-bold">
                  라이브 보러가기
              </button>
          </div>
          
          <script>
              // 세션 토큰 저장
              localStorage.setItem('user_session_token', '${sessionToken}');
              localStorage.setItem('user_id', '${user.id}');
              localStorage.setItem('user_name', '${user.name}');
              localStorage.setItem('user_email', '${user.email || ''}');
              localStorage.setItem('user_profile_image', '${user.profile_image || ''}');
              
              function goToLive() {
                  window.location.href = '/live/1';
              }
              
              // 3초 후 자동 이동
              setTimeout(goToLive, 3000);
          </script>
      </body>
      </html>
    `);
    
  } catch (err) {
    console.error('Kakao login error:', err);
    return c.html(`
      <!DOCTYPE html>
      <html lang="ko">
      <head>
          <meta charset="UTF-8">
          <title>로그인 오류</title>
          <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-100 flex items-center justify-center min-h-screen">
          <div class="bg-white p-8 rounded-lg shadow-lg text-center">
              <div class="text-red-500 text-5xl mb-4">⚠️</div>
              <h1 class="text-2xl font-bold text-gray-800 mb-4">로그인 오류</h1>
              <p class="text-gray-600 mb-2">${(err as Error).message}</p>
              <p class="text-sm text-gray-500 mb-6">다시 시도해주세요.</p>
              <a href="/auth/kakao" class="bg-yellow-500 text-white px-6 py-2 rounded-lg hover:bg-yellow-600">
                  다시 로그인하기
              </a>
          </div>
      </body>
      </html>
    `);
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

// Product APIs
// GET /api/products - 상품 목록 조회 (with pagination, category filter, sort)
app.get('/api/products', async (c) => {
  const { DB } = c.env;
  
  try {
    // Query parameters
    const limit = parseInt(c.req.query('limit') || '20', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    const category = c.req.query('category'); // 카테고리 필터
    const sort = c.req.query('sort') || 'recent'; // recent, popular, price_low, price_high
    const search = c.req.query('search'); // 검색어
    const featured = c.req.query('featured'); // featured seller only (true/false)
    const productType = c.req.query('type'); // product type: 'live' or 'featured'

    // Build query - JOIN with sellers table to check is_featured_seller
    let whereConditions = ['p.is_active = 1'];
    const bindings: any[] = [];

    // Featured seller filter (for "Ur 특가" section)
    if (featured === 'true') {
      whereConditions.push('s.is_featured_seller = 1');
      // Default to 'featured' type for Ur 특가
      if (!productType) {
        whereConditions.push("p.product_type = 'featured'");
      }
    }

    // Product type filter
    if (productType) {
      whereConditions.push('p.product_type = ?');
      bindings.push(productType);
    }

    if (category) {
      whereConditions.push('p.category = ?');
      bindings.push(category);
    }

    if (search) {
      whereConditions.push('(p.name LIKE ? OR p.description LIKE ?)');
      bindings.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = whereConditions.join(' AND ');

    // Sort order
    let orderBy = 'p.created_at DESC'; // default: recent
    if (sort === 'popular') {
      orderBy = 'p.sold_count DESC, p.created_at DESC';
    } else if (sort === 'price_low') {
      orderBy = 'p.price ASC';
    } else if (sort === 'price_high') {
      orderBy = 'p.price DESC';
    }

    // Query products with seller info
    const products = await DB.prepare(`
      SELECT 
        p.id, p.name, p.price, p.original_price, p.discount_rate, 
        p.image_url, p.category, p.sold_count, p.rating, p.stock, 
        p.created_at, p.seller_id, p.product_type,
        s.name as seller_name, s.is_featured_seller
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `).bind(...bindings, limit, offset).all();

    // Count total
    const countResult = await DB.prepare(`
      SELECT COUNT(*) as total 
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE ${whereClause}
    `).bind(...bindings).first();

    return c.json<ApiResponse>({
      success: true,
      data: {
        products: products.results || [],
        total: countResult?.total || 0,
        limit,
        offset,
      },
    });
  } catch (err) {
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

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

// Admin: 셀러별 매출 현황 조회
app.get('/api/admin/sales/sellers', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    // Admin auth check (should be implemented)
    // const userId = getUserIdFromToken(c)
    // if (!isAdmin(userId)) return unauthorized response

    const startDate = c.req.query('start_date'); // YYYY-MM-DD
    const endDate = c.req.query('end_date'); // YYYY-MM-DD
    const sellerId = c.req.query('seller_id'); // Optional: specific seller

    let whereConditions = ["o.payment_status = 'approved'"];
    const bindings: any[] = [];

    if (startDate) {
      whereConditions.push("date(o.created_at) >= ?");
      bindings.push(startDate);
    }

    if (endDate) {
      whereConditions.push("date(o.created_at) <= ?");
      bindings.push(endDate);
    }

    if (sellerId) {
      whereConditions.push("p.seller_id = ?");
      bindings.push(sellerId);
    }

    const whereClause = whereConditions.join(' AND ');

    // 셀러별 매출 집계
    const salesData = await DB.prepare(`
      SELECT 
        s.id as seller_id,
        s.name as seller_name,
        s.email as seller_email,
        s.is_featured_seller,
        COUNT(DISTINCT o.id) as total_orders,
        SUM(oi.quantity) as total_items_sold,
        SUM(oi.price * oi.quantity) as total_revenue,
        MIN(o.created_at) as first_sale_date,
        MAX(o.created_at) as latest_sale_date
      FROM orders o
      INNER JOIN order_items oi ON o.id = oi.order_id
      INNER JOIN products p ON oi.product_id = p.id
      INNER JOIN sellers s ON p.seller_id = s.id
      WHERE ${whereClause}
      GROUP BY s.id, s.name, s.email, s.is_featured_seller
      ORDER BY total_revenue DESC
    `).bind(...bindings).all();

    return c.json<ApiResponse>({
      success: true,
      data: salesData.results || [],
    });
  } catch (err) {
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

// Admin: 셀러별 상세 매출 내역 조회
app.get('/api/admin/sales/details', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const sellerId = c.req.query('seller_id');
    const startDate = c.req.query('start_date');
    const endDate = c.req.query('end_date');
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    let whereConditions = ["o.payment_status = 'approved'"];
    const bindings: any[] = [];

    if (sellerId) {
      whereConditions.push("p.seller_id = ?");
      bindings.push(sellerId);
    }

    if (startDate) {
      whereConditions.push("date(o.created_at) >= ?");
      bindings.push(startDate);
    }

    if (endDate) {
      whereConditions.push("date(o.created_at) <= ?");
      bindings.push(endDate);
    }

    const whereClause = whereConditions.join(' AND ');

    // 주문 상세 내역
    const salesDetails = await DB.prepare(`
      SELECT 
        o.id as order_id,
        o.order_number,
        o.created_at as order_date,
        o.total_amount,
        s.id as seller_id,
        s.name as seller_name,
        p.id as product_id,
        p.name as product_name,
        oi.quantity,
        oi.price as unit_price,
        (oi.price * oi.quantity) as item_total,
        u.name as customer_name,
        o.live_stream_id,
        ls.title as live_stream_title
      FROM orders o
      INNER JOIN order_items oi ON o.id = oi.order_id
      INNER JOIN products p ON oi.product_id = p.id
      INNER JOIN sellers s ON p.seller_id = s.id
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN live_streams ls ON o.live_stream_id = ls.id
      WHERE ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...bindings, limit, offset).all();

    // Count total
    const countResult = await DB.prepare(`
      SELECT COUNT(*) as total
      FROM orders o
      INNER JOIN order_items oi ON o.id = oi.order_id
      INNER JOIN products p ON oi.product_id = p.id
      WHERE ${whereClause}
    `).bind(...bindings).first();

    return c.json<ApiResponse>({
      success: true,
      data: {
        details: salesDetails.results || [],
        total: countResult?.total || 0,
        limit,
        offset,
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
app.get('/payment/success', async (c) => {
  const { DB } = c.env;
  const orderNumber = c.req.query('orderNumber');
  
  if (!orderNumber) {
    return c.redirect('/orders');
  }
  
  // 주문 정보 조회
  const order = await DB.prepare(`
    SELECT * FROM orders WHERE order_number = ?
  `).bind(orderNumber).first();
  
  if (!order) {
    return c.redirect('/orders');
  }
  
  // 주문 상품 조회
  const items = await DB.prepare(`
    SELECT oi.*, p.name as product_name, p.image_url 
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).bind(order.id).all();
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>결제 완료 - 유어 라이브 커머스</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            min-height: 100vh;
            padding: 20px;
          }
          .success-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          }
          .success-header {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            padding: 48px 24px;
            text-align: center;
            color: white;
          }
          .checkmark {
            width: 80px;
            height: 80px;
            background: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            animation: scaleIn 0.5s ease-out;
          }
          @keyframes scaleIn {
            0% { transform: scale(0); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }
          .order-item {
            border-bottom: 1px solid #e5e7eb;
            padding: 16px 0;
          }
          .order-item:last-child {
            border-bottom: none;
          }
          .btn-primary {
            background: linear-gradient(135deg, #0064FF 0%, #0052CC 100%);
            color: white;
            padding: 16px 32px;
            border-radius: 12px;
            font-weight: 600;
            text-decoration: none;
            display: inline-block;
            transition: all 0.3s;
          }
          .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,100,255,0.3);
          }
          .btn-secondary {
            background: white;
            color: #6b7280;
            padding: 16px 32px;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            font-weight: 600;
            text-decoration: none;
            display: inline-block;
            transition: all 0.3s;
            margin-left: 12px;
          }
        </style>
    </head>
    <body>
        <div class="success-container">
            <div class="success-header">
                <div class="checkmark">
                    <i class="fas fa-check text-green-500 text-4xl"></i>
                </div>
                <h1 class="text-3xl font-bold mb-2">결제가 완료되었습니다!</h1>
                <p class="text-green-100">주문이 정상적으로 접수되었습니다</p>
            </div>
            
            <div class="p-6">
                <div class="bg-gray-50 p-4 rounded-lg mb-6">
                    <div class="flex justify-between mb-2">
                        <span class="text-gray-600">주문번호</span>
                        <span class="font-mono text-sm font-medium">${order.order_number}</span>
                    </div>
                    <div class="flex justify-between mb-2">
                        <span class="text-gray-600">주문일시</span>
                        <span class="font-medium">${new Date(order.created_at).toLocaleString('ko-KR')}</span>
                    </div>
                    <div class="flex justify-between text-lg font-bold mt-4 pt-4 border-t">
                        <span>결제 금액</span>
                        <span class="text-green-600">${order.total_amount.toLocaleString()}원</span>
                    </div>
                </div>
                
                <h3 class="font-bold text-lg mb-3">주문 상품</h3>
                <div class="space-y-2 mb-6">
                    ${items.results.map(item => `
                        <div class="order-item flex items-center">
                            ${item.image_url ? `<img src="${item.image_url}" alt="${item.product_name}" class="w-16 h-16 object-cover rounded-lg mr-4">` : ''}
                            <div class="flex-1">
                                <div class="font-medium">${item.product_name || item.name}</div>
                                <div class="text-sm text-gray-500">${item.quantity}개</div>
                            </div>
                            <div class="font-bold">${item.price.toLocaleString()}원</div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="flex justify-center gap-3 pt-4">
                    <a href="/orders" class="btn-primary">
                        <i class="fas fa-list mr-2"></i>
                        주문 내역 보기
                    </a>
                    <a href="/live/1" class="btn-secondary">
                        <i class="fas fa-home mr-2"></i>
                        홈으로
                    </a>
                </div>
            </div>
        </div>
    </body>
    </html>
  `);
});

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
app.get('/auth/kakao/callback', async (c) => {
  const { DB } = c.env;
  const code = c.req.query('code');
  const KAKAO_REST_API_KEY = c.env.KAKAO_REST_API_KEY || 'your_kakao_rest_api_key';
  const REDIRECT_URI = c.env.KAKAO_REDIRECT_URI || 'http://localhost:3000/auth/kakao/callback';
  
  if (!code) {
    return c.redirect('/login?error=no_code');
  }
  
  try {
    // 1. 액세스 토큰 발급
    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: KAKAO_REST_API_KEY,
        redirect_uri: REDIRECT_URI,
        code: code,
      }),
    });
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      console.error('Token error:', tokenData);
      return c.redirect('/login?error=token_failed');
    }
    
    // 2. 사용자 정보 가져오기
    const userResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });
    
    const kakaoUser = await userResponse.json();
    
    if (!kakaoUser.id) {
      console.error('User info error:', kakaoUser);
      return c.redirect('/login?error=user_info_failed');
    }
    
    // 3. DB에서 사용자 찾기 또는 생성
    let user = await DB.prepare(`
      SELECT * FROM users WHERE kakao_id = ?
    `).bind(String(kakaoUser.id)).first();
    
    if (!user) {
      // 신규 사용자 생성
      const nickname = kakaoUser.kakao_account?.profile?.nickname || '사용자';
      const email = kakaoUser.kakao_account?.email || null;
      const profileImage = kakaoUser.kakao_account?.profile?.profile_image_url || null;
      
      const result = await DB.prepare(`
        INSERT INTO users (kakao_id, name, email, profile_image, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).bind(String(kakaoUser.id), nickname, email, profileImage).run();
      
      const userId = result.meta.last_row_id;
      
      user = await DB.prepare(`
        SELECT * FROM users WHERE id = ?
      `).bind(userId).first();
    }
    
    // 4. 세션 생성 (간단한 JWT 또는 쿠키)
    // 여기서는 간단하게 쿠키에 user_id 저장
    const sessionToken = Buffer.from(JSON.stringify({ 
      userId: user.id, 
      kakaoId: user.kakao_id,
      name: user.name 
    })).toString('base64');
    
    // 5. 쿠키 설정 후 리다이렉트
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>로그인 중...</title>
      </head>
      <body>
          <script>
            // 세션 정보를 localStorage에 저장
            localStorage.setItem('user_session', '${sessionToken}');
            localStorage.setItem('user_id', '${user.id}');
            localStorage.setItem('user_name', '${user.name}');
            
            // 원래 페이지로 돌아가기 (또는 홈으로)
            const returnUrl = sessionStorage.getItem('return_url') || '/';
            sessionStorage.removeItem('return_url');
            window.location.href = returnUrl;
          </script>
      </body>
      </html>
    `);
    
  } catch (error) {
    console.error('Kakao login error:', error);
    return c.redirect('/login?error=server_error');
  }
});

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
app.get('/s/:username', async (c) => {
  const { DB } = c.env;
  const username = c.req.param('username');
  
  // 날짜 포맷 헬퍼 함수
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? '오후' : '오전';
    const displayHours = hours % 12 || 12;
    
    return `${month}월 ${day}일 ${ampm} ${displayHours}:${minutes.toString().padStart(2, '0')}`;
  };
  
  try {
    // UTM 파라미터 추출
    const utmSource = c.req.query('utm_source') || '';
    const utmMedium = c.req.query('utm_medium') || '';
    const utmContent = c.req.query('utm_content') || '';
    
    // 셀러 정보 조회
    const seller = await DB.prepare(`
      SELECT id, username, display_name, profile_image, bio, instagram_url, youtube_url, business_name
      FROM sellers WHERE username = ? AND is_active = 1
    `).bind(username).first();
    
    if (!seller) {
      return c.html(`
        <!DOCTYPE html>
        <html lang="ko">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>셀러를 찾을 수 없습니다</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-50 flex items-center justify-center min-h-screen">
            <div class="text-center">
                <div class="text-6xl mb-4">😢</div>
                <h1 class="text-2xl font-bold text-gray-800 mb-2">셀러를 찾을 수 없습니다</h1>
                <p class="text-gray-600 mb-6">존재하지 않거나 비활성화된 셀러입니다.</p>
                <a href="/" class="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700">
                    홈으로 돌아가기
                </a>
            </div>
        </body>
        </html>
      `);
    }
    
    // 셀러의 다가오는 라이브 스트림 조회
    const upcomingStreams = await DB.prepare(`
      SELECT id, title, youtube_video_id, scheduled_at, status
      FROM live_streams 
      WHERE seller_id = ? AND (status = 'scheduled' OR status = 'live')
      ORDER BY 
        CASE 
          WHEN status = 'live' THEN 0
          WHEN status = 'scheduled' THEN 1
          ELSE 2
        END,
        scheduled_at ASC
      LIMIT 5
    `).bind(seller.id).all();
    
    // 스트림 데이터에 포맷된 날짜 추가
    const streams = upcomingStreams.results ? upcomingStreams.results.map((stream: any) => ({
      ...stream,
      formatted_date: stream.scheduled_at ? formatDateTime(stream.scheduled_at) : ''
    })) : [];
    
    return c.html(`
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${seller.display_name || seller.username} - 유어 라이브 커머스</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        @import url('https://cdn.jsdelivr.net/gh/toss/tossface/dist/tossface.css');
        
        * {
            font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif;
        }
        
        body {
            background: linear-gradient(180deg, #F9FAFB 0%, #FFFFFF 100%);
            min-height: 100vh;
        }
        
        .profile-section {
            background: white;
            border-radius: 24px;
            padding: 32px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
            margin-bottom: 24px;
        }
        
        .profile-image {
            width: 96px;
            height: 96px;
            border-radius: 50%;
            object-fit: cover;
            border: 4px solid #F1F3F5;
        }
        
        .stream-card {
            background: white;
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 16px;
            border: 1px solid #E5E8EB;
            transition: all 0.2s;
            cursor: pointer;
            position: relative;
            overflow: hidden;
        }
        
        .stream-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(0,0,0,0.12);
            border-color: #3182F6;
        }
        
        .stream-card.live {
            border: 2px solid #F04452;
            background: linear-gradient(135deg, #FFF5F5 0%, #FFFFFF 100%);
        }
        
        .live-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: #F04452;
            color: white;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.5px;
        }
        
        .live-badge::before {
            content: '';
            width: 8px;
            height: 8px;
            background: white;
            border-radius: 50%;
            animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }
        
        .scheduled-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: #F1F3F5;
            color: #4E5968;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
        }
        
        .social-link {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #F1F3F5;
            color: #4E5968;
            transition: all 0.2s;
        }
        
        .social-link:hover {
            background: #3182F6;
            color: white;
            transform: scale(1.1);
        }
        
        .btn-primary {
            background: linear-gradient(135deg, #3182F6 0%, #1B64DA 100%);
            color: white;
            padding: 14px 24px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 16px;
            border: none;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        
        .btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(49, 130, 246, 0.4);
        }
        
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #8B95A1;
        }
        
        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.5;
        }
        
        .stream-thumbnail {
            width: 100%;
            height: 200px;
            background: #F1F3F5;
            border-radius: 12px;
            margin-bottom: 16px;
            object-fit: cover;
        }
        
        .time-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 14px;
            color: #6B7684;
        }
        
        .viewer-count {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 14px;
            color: #6B7684;
        }
    </style>
</head>
<body>
    <div class="max-w-2xl mx-auto px-4 py-6">
        <!-- 프로필 섹션 -->
        <div class="profile-section">
            <div class="flex items-center gap-6 mb-6">
                <img src="${seller.profile_image || 'https://via.placeholder.com/96'}" 
                     alt="${seller.display_name || seller.username}" 
                     class="profile-image"
                     onerror="this.src='https://via.placeholder.com/96'">
                <div class="flex-1">
                    <h1 class="text-2xl font-bold text-gray-900 mb-2">
                        ${seller.display_name || seller.username}
                    </h1>
                    ${seller.bio ? `<p class="text-gray-600 text-sm mb-3">${seller.bio}</p>` : ''}
                    ${seller.business_name ? `<p class="text-xs text-gray-500">${seller.business_name}</p>` : ''}
                </div>
            </div>
            
            <!-- 소셜 링크 -->
            ${seller.instagram_url || seller.youtube_url ? `
                <div class="flex gap-3 pt-4 border-t">
                    ${seller.instagram_url ? `
                        <a href="${seller.instagram_url}" target="_blank" class="social-link" title="Instagram">
                            <i class="fab fa-instagram"></i>
                        </a>
                    ` : ''}
                    ${seller.youtube_url ? `
                        <a href="${seller.youtube_url}" target="_blank" class="social-link" title="YouTube">
                            <i class="fab fa-youtube"></i>
                        </a>
                    ` : ''}
                </div>
            ` : ''}
        </div>
        
        <!-- 라이브 스트림 섹션 -->
        <div>
            <h2 class="text-xl font-bold text-gray-900 mb-4 px-2">
                <i class="fas fa-video mr-2 text-blue-600"></i>
                다가오는 라이브 방송
            </h2>
            
            <div id="streams-container">
                ${streams && streams.length > 0 ? 
                    streams.map(stream => `
                        <div class="stream-card ${stream.status === 'live' ? 'live' : ''}" 
                             onclick="goToStream('${stream.id}', '${seller.id}', '${utmSource}', '${utmMedium}', '${utmContent}')">
                            ${stream.status === 'live' ? 
                                '<div class="live-badge">LIVE</div>' : 
                                '<div class="scheduled-badge"><i class="far fa-clock"></i> 예정</div>'
                            }
                            
                            ${stream.youtube_video_id ? `
                                <img src="https://img.youtube.com/vi/${stream.youtube_video_id}/maxresdefault.jpg" 
                                     alt="${stream.title}" 
                                     class="stream-thumbnail"
                                     onerror="this.src='https://via.placeholder.com/640x360?text=Thumbnail'">
                            ` : ''}
                            
                            <h3 class="font-bold text-lg text-gray-900 mb-2">${stream.title}</h3>
                            
                            <div class="flex items-center justify-between text-sm">
                                ${stream.scheduled_at ? `
                                    <div class="time-badge">
                                        <i class="far fa-calendar"></i>
                                        <span>${stream.formatted_date}</span>
                                    </div>
                                ` : '<div></div>'}
                            </div>
                            
                            ${stream.status === 'live' ? `
                                <div class="mt-4">
                                    <button class="btn-primary w-full">
                                        <i class="fas fa-play-circle"></i>
                                        지금 시청하기
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    `).join('') 
                : `
                    <div class="empty-state">
                        <div class="empty-state-icon">📺</div>
                        <h3 class="text-lg font-semibold text-gray-700 mb-2">예정된 라이브가 없습니다</h3>
                        <p class="text-sm text-gray-500">곧 새로운 라이브가 시작될 예정이니 조금만 기다려주세요!</p>
                    </div>
                `}
            </div>
        </div>
        
        <!-- UTM 트래킹 정보 (개발용 - 나중에 제거) -->
        ${utmSource || utmMedium ? `
            <div class="mt-6 p-4 bg-gray-100 rounded-lg text-xs text-gray-600">
                <strong>트래킹 정보:</strong><br>
                Source: ${utmSource || '-'} | Medium: ${utmMedium || '-'} | Content: ${utmContent || '-'}
            </div>
        ` : ''}
    </div>
    
    <script>
        function goToStream(streamId, sellerId, utmSource, utmMedium, utmContent) {
            // UTM 파라미터를 포함한 URL 생성
            let url = \`/live/\${streamId}\`;
            const params = [];
            
            if (sellerId) params.push(\`seller_id=\${sellerId}\`);
            if (utmSource) params.push(\`utm_source=\${utmSource}\`);
            if (utmMedium) params.push(\`utm_medium=\${utmMedium}\`);
            if (utmContent) params.push(\`utm_content=\${utmContent}\`);
            
            if (params.length > 0) {
                url += '?' + params.join('&');
            }
            
            // UTM 정보를 localStorage에 저장 (주문 추적용)
            if (sellerId) {
                localStorage.setItem('seller_id', sellerId);
                localStorage.setItem('utm_source', utmSource || '');
                localStorage.setItem('utm_medium', utmMedium || '');
                localStorage.setItem('utm_content', utmContent || '');
            }
            
            window.location.href = url;
        }
    </script>
</body>
</html>
    `);
  } catch (err) {
    console.error('Seller page error:', err);
    return c.html(`
      <!DOCTYPE html>
      <html lang="ko">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>오류 발생</title>
          <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-50 flex items-center justify-center min-h-screen">
          <div class="text-center">
              <div class="text-6xl mb-4">⚠️</div>
              <h1 class="text-2xl font-bold text-gray-800 mb-2">오류가 발생했습니다</h1>
              <p class="text-gray-600 mb-6">${(err as Error).message}</p>
              <a href="/" class="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700">
                  홈으로 돌아가기
              </a>
          </div>
      </body>
      </html>
    `);
  }
});

// =================================
// 셀러 매출 및 정산 APIs
// =================================

// 셀러 매출 조회 API
// 셀러 대시보드 페이지
app.get('/dashboard/seller/:username', async (c) => {
  const { DB } = c.env;
  const username = c.req.param('username');
  
  try {
    // 셀러 정보 조회
    const seller = await DB.prepare(`
      SELECT id, username, display_name, profile_image, bio
      FROM sellers WHERE username = ? AND is_active = 1
    `).bind(username).first();
    
    if (!seller) {
      return c.html(`<h1>셀러를 찾을 수 없습니다</h1>`);
    }
    
    return c.html(`
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${seller.display_name || seller.username} 대시보드</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    <style>
        * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
        .stat-card {
            background: white;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
            transition: transform 0.2s;
        }
        .stat-card:hover { transform: translateY(-2px); }
    </style>
</head>
<body class="bg-gray-50">
    <div class="max-w-6xl mx-auto p-6">
        <!-- 헤더 -->
        <div class="bg-white rounded-xl p-6 shadow-sm mb-6">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <img src="${seller.profile_image || 'https://via.placeholder.com/64'}" 
                         alt="${seller.display_name}" 
                         class="w-16 h-16 rounded-full"
                         onerror="this.src='https://via.placeholder.com/64'">
                    <div>
                        <h1 class="text-2xl font-bold text-gray-900">${seller.display_name || seller.username} 대시보드</h1>
                        <p class="text-gray-600 text-sm mt-1">매출 현황 및 정산 관리</p>
                    </div>
                </div>
                <a href="/s/${seller.username}" class="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
                    <i class="fas fa-link mr-2"></i> 내 전용 링크
                </a>
            </div>
        </div>
        
        <!-- 기간 선택 -->
        <div class="bg-white rounded-xl p-6 shadow-sm mb-6">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label class="block text-sm text-gray-600 mb-2">시작일</label>
                    <input type="date" id="start-date" class="w-full px-4 py-2 border rounded-lg">
                </div>
                <div>
                    <label class="block text-sm text-gray-600 mb-2">종료일</label>
                    <input type="date" id="end-date" class="w-full px-4 py-2 border rounded-lg">
                </div>
                <div class="flex items-end">
                    <button onclick="loadSales()" class="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        <i class="fas fa-search mr-2"></i> 조회
                    </button>
                </div>
                <div class="flex items-end">
                    <button onclick="downloadCSV()" class="w-full px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                        <i class="fas fa-download mr-2"></i> CSV 다운로드
                    </button>
                </div>
            </div>
            
            <!-- 빠른 선택 -->
            <div class="mt-4 flex flex-wrap gap-2">
                <button onclick="setDateRange('today')" class="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">오늘</button>
                <button onclick="setDateRange('yesterday')" class="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">어제</button>
                <button onclick="setDateRange('week')" class="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">이번 주</button>
                <button onclick="setDateRange('month')" class="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">이번 달</button>
            </div>
        </div>
        
        <!-- 통계 카드 -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div class="stat-card">
                <div class="text-sm text-gray-600 mb-2">총 주문</div>
                <div class="text-3xl font-bold text-gray-900" id="total-orders">0건</div>
            </div>
            <div class="stat-card">
                <div class="text-sm text-gray-600 mb-2">총 매출</div>
                <div class="text-3xl font-bold text-gray-900" id="total-amount">0원</div>
                <div class="text-xs text-red-600 mt-1">수수료: <span id="commission-amount">0원</span></div>
            </div>
            <div class="stat-card">
                <div class="text-sm text-gray-600 mb-2">정산 금액 (90%)</div>
                <div class="text-3xl font-bold text-blue-600" id="net-amount">0원</div>
            </div>
        </div>
        
        <!-- 주문 내역 테이블 -->
        <div class="bg-white rounded-xl p-6 shadow-sm">
            <h2 class="text-lg font-bold mb-4">주문 내역</h2>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="text-left p-3">주문번호</th>
                            <th class="text-left p-3">주문일시</th>
                            <th class="text-left p-3">주문자</th>
                            <th class="text-right p-3">총금액</th>
                            <th class="text-right p-3">수수료</th>
                            <th class="text-right p-3">정산금액</th>
                        </tr>
                    </thead>
                    <tbody id="orders-table">
                        <tr>
                            <td colspan="6" class="p-8 text-center text-gray-500">기간을 선택하고 조회 버튼을 클릭하세요</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    
    <script>
        const API_BASE = 'http://localhost:3000/api';
        const sellerId = ${seller.id};
        
        // 오늘 날짜를 기본값으로 설정
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('start-date').value = today;
        document.getElementById('end-date').value = today;
        
        // 페이지 로드 시 오늘 매출 자동 조회
        window.addEventListener('DOMContentLoaded', () => {
            loadSales();
        });
        
        function setDateRange(range) {
            const now = new Date();
            let startDate, endDate;
            
            switch(range) {
                case 'today':
                    startDate = endDate = new Date();
                    break;
                case 'yesterday':
                    startDate = endDate = new Date(now.setDate(now.getDate() - 1));
                    break;
                case 'week':
                    endDate = new Date();
                    startDate = new Date(now.setDate(now.getDate() - 7));
                    break;
                case 'month':
                    endDate = new Date();
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
            }
            
            document.getElementById('start-date').value = startDate.toISOString().split('T')[0];
            document.getElementById('end-date').value = endDate.toISOString().split('T')[0];
            
            loadSales();
        }
        
        async function loadSales() {
            const startDate = document.getElementById('start-date').value;
            const endDate = document.getElementById('end-date').value;
            
            if (!startDate || !endDate) {
                alert('시작일과 종료일을 선택해주세요');
                return;
            }
            
            try {
                const response = await axios.get(\`\${API_BASE}/seller/sales\`, {
                    params: {
                        seller_id: sellerId,
                        start_date: startDate,
                        end_date: endDate
                    }
                });
                
                if (response.data.success) {
                    const { stats, orders } = response.data.data;
                    
                    // 통계 업데이트
                    document.getElementById('total-orders').textContent = stats.totalOrders + '건';
                    document.getElementById('total-amount').textContent = stats.totalAmount.toLocaleString() + '원';
                    document.getElementById('commission-amount').textContent = stats.commissionAmount.toLocaleString() + '원';
                    document.getElementById('net-amount').textContent = stats.netAmount.toLocaleString() + '원';
                    
                    // 테이블 업데이트
                    const tbody = document.getElementById('orders-table');
                    if (orders.length === 0) {
                        tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-gray-500">주문 내역이 없습니다</td></tr>';
                    } else {
                        tbody.innerHTML = orders.map(order => \`
                            <tr class="border-b hover:bg-gray-50">
                                <td class="p-3">\${order.order_number}</td>
                                <td class="p-3">\${new Date(order.created_at).toLocaleString('ko-KR')}</td>
                                <td class="p-3">\${order.user_name || '익명'}</td>
                                <td class="p-3 text-right">\${order.total_amount.toLocaleString()}원</td>
                                <td class="p-3 text-right text-red-600">\${order.commission_amount.toLocaleString()}원</td>
                                <td class="p-3 text-right font-semibold text-blue-600">\${order.seller_amount.toLocaleString()}원</td>
                            </tr>
                        \`).join('');
                    }
                }
            } catch (error) {
                console.error('매출 조회 오류:', error);
                alert('매출 조회에 실패했습니다');
            }
        }
        
        function downloadCSV() {
            const startDate = document.getElementById('start-date').value;
            const endDate = document.getElementById('end-date').value;
            
            if (!startDate || !endDate) {
                alert('시작일과 종료일을 선택해주세요');
                return;
            }
            
            const url = \`\${API_BASE}/seller/settlement-csv?seller_id=\${sellerId}&start_date=\${startDate}&end_date=\${endDate}\`;
            window.open(url, '_blank');
        }
    </script>
</body>
</html>
    `);
    
  } catch (err) {
    console.error('Seller dashboard error:', err);
    return c.html(`<h1>오류: ${(err as Error).message}</h1>`);
  }
});

// 주문서 페이지 (Checkout)
// Removed route: /checkout (handled by React SPA)

// 주문 내역 페이지
// Removed route: /orders (handled by React SPA)

// 주문 상세 페이지
// Removed route: /order/:orderNumber (handled by React SPA)

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
app.get('/api/orders/:orderNumber', async (c) => {
  const { DB } = c.env;
  const orderNumber = c.req.param('orderNumber');

  try {
    const order = await DB.prepare(
      'SELECT * FROM orders WHERE order_number = ?'
    ).bind(orderNumber).first();

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
app.patch('/api/seller/orders/:orderNumber/status', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const orderNumber = c.req.param('orderNumber');
    const { status } = await c.req.json();

    // Validate status
    const validStatuses = ['PAY_COMPLETE', 'PREPARING', 'SHIPPING', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return c.json({ success: false, error: 'Invalid status' }, 400);
    }

    // Verify this order contains seller's products
    const order = await DB.prepare('SELECT id FROM orders WHERE order_number = ?').bind(orderNumber).first();
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
      'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?'
    ).bind(status, orderNumber).run();

    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Request refund (Customer)
app.post('/api/orders/:orderNumber/refund', async (c) => {
  const { DB } = c.env;
  const orderNumber = c.req.param('orderNumber');
  const { reason } = await c.req.json();

  try {
    const order = await DB.prepare('SELECT * FROM orders WHERE order_number = ?').bind(orderNumber).first();

    if (!order) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    // Check if order can be refunded
    if (!['PAY_COMPLETE', 'PREPARING'].includes(order.status)) {
      return c.json({ success: false, error: 'This order cannot be refunded' }, 400);
    }

    // ✅ Call Toss Pay refund API
    const tossSecretKey = c.env.TOSS_SECRET_KEY || 'test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6';
    
    try {
      const refundResponse = await fetch(
        `https://api.tosspayments.com/v1/payments/${order.payment_key}/cancel`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(tossSecretKey + ':')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            cancelReason: reason || '고객 요청',
            cancelAmount: order.total_amount
          })
        }
      );
      
      const refundData = await refundResponse.json();
      
      if (!refundResponse.ok) {
        console.error('[Refund] Toss API error:', refundData);
        return c.json({ 
          success: false, 
          error: refundData.message || '환불 처리 중 오류가 발생했습니다.' 
        }, 400);
      }
      
      // Update order status to REFUNDED
      await DB.prepare(
        `UPDATE orders 
         SET status = ?, 
             refund_reason = ?,
             refunded_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP 
         WHERE order_number = ?`
      ).bind('REFUNDED', reason || '고객 요청', orderNumber).run();
      
      return c.json({ 
        success: true, 
        message: '환불이 완료되었습니다.',
        refund: {
          orderId: refundData.orderId,
          canceledAmount: refundData.cancelAmount,
          canceledAt: refundData.canceledAt
        }
      });
      
    } catch (refundErr) {
      console.error('[Refund] Request failed:', refundErr);
      
      // 환불 요청은 실패했지만 주문 상태는 업데이트
      await DB.prepare(
        'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?'
      ).bind('REFUND_REQUESTED', orderNumber).run();
      
      return c.json({ 
        success: false, 
        error: '환불 요청이 제출되었으나 결제 취소 처리 중 오류가 발생했습니다. 관리자에게 문의하세요.' 
      }, 500);
    }
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
// Toss Bridge API
// =================================

// 유어 앱에서 유저 정보 가져오기
app.get('/api/toss/user-info', async (c) => {
  try {
    // 유어 브릿지를 통해 유저 정보 가져오기
    // 실제로는 유어 앱의 JavaScript Bridge를 통해 전달받음
    
    // 예시: 유어 앱에서 전달하는 헤더 정보
    const tossUserId = c.req.header('X-Toss-User-Id');
    const tossUserName = c.req.header('X-Toss-User-Name');
    
    if (!tossUserId) {
      // 유어 브릿지가 없는 경우 (웹 브라우저 직접 접속)
      return c.json({
        success: true,
        data: {
          userId: 'web_user_' + Date.now(),
          name: '게스트',
          isGuest: true
        }
      });
    }
    
    // 유어 유저 정보 반환
    return c.json({
      success: true,
      data: {
        userId: tossUserId,
        name: tossUserName || '유어 사용자',
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

// 유어페이 결제 준비 (향후 구현)
app.post('/api/toss/payment/prepare', async (c) => {
  try {
    const { orderId, amount, orderName } = await c.req.json();
    
    // TODO: 유어페이먼츠 API 연동
    // https://docs.tosspayments.com/guides/payment-widget/integration
    
    return c.json({
      success: true,
      data: {
        orderId,
        amount,
        orderName,
        // 실제로는 유어페이먼츠에서 받은 결제 정보
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
    const { userId, cartItems, totalAmount, shippingAddressId, sellerId } = await c.req.json();
    
    console.log('주문 생성 요청:', { userId, cartItems: cartItems?.length, totalAmount, shippingAddressId, sellerId });
    
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
        shipping_address_id, shipping_name, shipping_phone, shipping_address, shipping_postal_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      shippingInfo?.postal_code || null
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
app.get('/payment/nicepay/return', async (c) => {
  const { DB } = c.env;
  const orderNumber = c.req.query('Moid');
  
  if (!orderNumber) {
    return c.redirect('/orders');
  }
  
  // 주문 조회
  const order = await DB.prepare(`
    SELECT * FROM orders WHERE order_number = ?
  `).bind(orderNumber).first();
  
  if (!order) {
    return c.redirect('/orders');
  }
  
  // 주문 아이템 조회
  const items = await DB.prepare(`
    SELECT oi.*, p.name as product_name, p.image_url
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).bind(order.id).all();
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>결제 완료 - 유어 라이브 커머스</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            .success-container {
                background: white;
                border-radius: 20px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                padding: 40px;
                max-width: 600px;
                margin: 40px auto;
            }
            .success-icon {
                font-size: 80px;
                color: #22c55e;
                margin-bottom: 20px;
            }
        </style>
    </head>
    <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
        <div class="success-container text-center">
            <i class="fas fa-check-circle success-icon"></i>
            <h1 class="text-3xl font-bold text-gray-800 mb-4">결제가 완료되었습니다!</h1>
            <p class="text-gray-600 mb-8">주문이 성공적으로 처리되었습니다.</p>
            
            <div class="bg-gray-50 rounded-lg p-6 mb-6 text-left">
                <div class="flex justify-between mb-3">
                    <span class="text-gray-600">주문번호</span>
                    <span class="font-semibold">${order.order_number}</span>
                </div>
                <div class="flex justify-between mb-3">
                    <span class="text-gray-600">결제금액</span>
                    <span class="font-semibold text-blue-600">${order.total_amount.toLocaleString()}원</span>
                </div>
                ${order.shipping_name ? `
                <div class="flex justify-between mb-3">
                    <span class="text-gray-600">받는분</span>
                    <span class="font-semibold">${order.shipping_name}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">배송지</span>
                    <span class="font-semibold text-sm">${order.shipping_address}</span>
                </div>
                ` : ''}
            </div>
            
            <div class="space-y-3 mb-6">
                ${items.results.map(item => `
                    <div class="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                        ${item.image_url ? `<img src="${item.image_url}" alt="${item.product_name}" class="w-16 h-16 rounded object-cover">` : ''}
                        <div class="flex-1 text-left">
                            <p class="font-semibold">${item.product_name}</p>
                            <p class="text-sm text-gray-600">${item.quantity}개 × ${item.price.toLocaleString()}원</p>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="flex gap-3">
                <a href="/my-orders" class="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition">
                    주문 내역 보기
                </a>
                <a href="/" class="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition">
                    홈으로
                </a>
            </div>
        </div>
    </body>
    </html>
  `);
});

// =================================
// Toss Pay API
// =================================

// 유어페이 결제 생성
app.post('/api/toss-pay/payments/create', async (c) => {
  const { DB } = c.env;
  const TOSS_PAY_API_KEY = 'sk_live_Rk5xZE4K8zRk5nJ5aG2z';
  
  // 테스트 모드: true로 설정하면 실제 유어페이 API 호출 없이 Mock 데이터 반환
  const TEST_MODE = true;
  
  try {
    const { userId, cartItems, totalAmount, shippingAddressId, sellerId } = await c.req.json();
    
    // 수수료 계산 (10%)
    const commissionRate = 10.00;
    const commissionAmount = Math.floor(totalAmount * (commissionRate / 100));
    const sellerAmount = totalAmount - commissionAmount;
    
    // 배송지 정보 조회
    let shippingInfo = null;
    if (shippingAddressId) {
      shippingInfo = await DB.prepare(`
        SELECT * FROM shipping_addresses WHERE id = ? AND user_id = ?
      `).bind(shippingAddressId, userId).first();
      
      if (!shippingInfo) {
        return c.json({ success: false, error: '배송지 정보를 찾을 수 없습니다' }, 400);
      }
    }
    
    // userId가 없으면 임시 사용자 생성 또는 기존 사용자 찾기
    let finalUserId = userId;
    if (!userId || userId === 'toss_user_temp') {
      // 임시 사용자가 있는지 확인
      const existingUser = await DB.prepare(`
        SELECT id FROM users WHERE toss_user_id = 'toss_user_temp' LIMIT 1
      `).first();
      
      if (existingUser) {
        finalUserId = existingUser.id;
      } else {
        // 임시 사용자 생성
        const userResult = await DB.prepare(`
          INSERT INTO users (toss_user_id, name, email, created_at)
          VALUES ('toss_user_temp', '게스트', 'guest@temp.com', datetime('now'))
        `).run();
        finalUserId = userResult.meta.last_row_id;
      }
    } else {
      // userId가 제공된 경우, users 테이블에 있는지 확인
      const existingUser = await DB.prepare(`
        SELECT id FROM users WHERE id = ? LIMIT 1
      `).bind(userId).first();
      
      if (!existingUser) {
        // 사용자가 없으면 생성
        const userResult = await DB.prepare(`
          INSERT INTO users (toss_user_id, name, email, created_at)
          VALUES (?, '유어유저', 'user@toss.im', datetime('now'))
        `).bind(`toss_user_${userId}`).run();
        finalUserId = userResult.meta.last_row_id;
      }
    }
    
    // 주문번호 생성 (타임스탬프 + 랜덤)
    const orderNumber = `ORDER_${Date.now()}_${Math.random().toString(36).substring(7).toUpperCase()}`;
    
    // 주문 생성 (배송지 정보 포함)
    const orderResult = await DB.prepare(`
      INSERT INTO orders (
        order_number, user_id, seller_id, total_amount, 
        commission_rate, commission_amount, seller_amount,
        payment_status, 
        shipping_address_id, shipping_name, shipping_phone, shipping_address, shipping_postal_code,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      orderNumber, 
      finalUserId,
      sellerId || null,
      totalAmount,
      commissionRate,
      commissionAmount,
      sellerAmount,
      shippingInfo ? shippingInfo.id : null,
      shippingInfo ? shippingInfo.recipient_name : null,
      shippingInfo ? shippingInfo.phone : null,
      shippingInfo ? `${shippingInfo.address} ${shippingInfo.address_detail || ''}`.trim() : null,
      shippingInfo ? shippingInfo.postal_code : null
    ).run();
    
    const orderId = orderResult.meta.last_row_id;
    
    // 주문 상품 저장 (재고 차감 포함)
    for (const item of cartItems) {
      // 재고 확인
      const product = await DB.prepare(`
        SELECT stock FROM products WHERE id = ?
      `).bind(item.product_id).first();
      
      if (!product || product.stock < item.quantity) {
        throw new Error(`재고 부족: ${item.name}`);
      }
      
      // 가격 결정: price_snapshot 우선, 없으면 price, 둘 다 없으면 products 테이블에서 가져오기
      let finalPrice = item.price_snapshot || item.price;
      if (!finalPrice) {
        const productPrice = await DB.prepare(`
          SELECT price FROM products WHERE id = ?
        `).bind(item.product_id).first();
        finalPrice = productPrice?.price || 0;
      }
      
      // 주문 아이템 저장
      await DB.prepare(`
        INSERT INTO order_items (order_id, product_id, option_id, quantity, price, product_name, option_info)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        orderId,
        item.product_id,
        item.option_id || null,
        item.quantity,
        finalPrice,
        item.name,
        item.option_info || null
      ).run();
      
      // 재고 차감
      await DB.prepare(`
        UPDATE products SET stock = stock - ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(item.quantity, item.product_id).run();
    }
    
    // 상품명 생성
    const productDesc = cartItems.length === 1 
      ? cartItems[0].name 
      : `${cartItems[0].name} 외 ${cartItems.length - 1}건`;
    
    // ========================================
    // 테스트 모드: Mock 결제 페이지 반환
    // ========================================
    if (TEST_MODE) {
      const mockPayToken = `MOCK_PAY_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // payment_key 저장
      await DB.prepare(`
        UPDATE orders SET payment_key = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(mockPayToken, orderId).run();
      
      // Mock 결제 페이지 URL 생성
      const mockCheckoutPage = `${new URL(c.req.url).origin}/mock-payment?orderNumber=${orderNumber}&amount=${totalAmount}&productDesc=${encodeURIComponent(productDesc)}`;
      
      return c.json({
        success: true,
        data: {
          orderNumber: orderNumber,
          orderId: orderId,
          checkoutPage: mockCheckoutPage,
          payToken: mockPayToken
        }
      });
    }
    
    // ========================================
    // 실제 유어페이 API 호출 (TEST_MODE = false)
    // ========================================
    
    // 유어페이 결제 생성 요청
    const tossPayPayload = {
      orderNumber: orderNumber,
      amount: totalAmount,
      amountTaxFree: 0,
      productDesc: productDesc,
      apiKey: TOSS_PAY_API_KEY,
      retUrl: `${new URL(c.req.url).origin}/payment/success`,
      retCancelUrl: `${new URL(c.req.url).origin}/payment/cancel`,
      autoExecute: true,
      resultCallback: `${new URL(c.req.url).origin}/api/toss-pay/callback`,
      callbackVersion: 'V2'
    };
    
    const tossPayResponse = await fetch('https://pay.toss.im/api/v2/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tossPayPayload)
    });
    
    if (!tossPayResponse.ok) {
      const errorData = await tossPayResponse.json();
      throw new Error(`유어페이 API 오류: ${JSON.stringify(errorData)}`);
    }
    
    const tossPayData = await tossPayResponse.json();
    
    // payment_key 저장
    if (tossPayData.payToken) {
      await DB.prepare(`
        UPDATE orders SET payment_key = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(tossPayData.payToken, orderId).run();
    }
    
    return c.json({
      success: true,
      data: {
        orderNumber: orderNumber,
        orderId: orderId,
        checkoutPage: tossPayData.checkoutPage,
        payToken: tossPayData.payToken
      }
    });
    
  } catch (err) {
    console.error('유어페이 결제 생성 오류:', err);
    return c.json({
      success: false,
      error: (err as Error).message
    }, 500);
  }
});

// 유어페이 결제 결과 Callback
app.post('/api/toss-pay/callback', async (c) => {
  const { DB } = c.env;
  
  try {
    const callbackData = await c.req.json();
    
    console.log('유어페이 Callback 수신:', JSON.stringify(callbackData, null, 2));
    
    const { orderNumber, status, payToken } = callbackData;
    
    if (!orderNumber) {
      return c.json({ success: false, error: 'orderNumber 누락' }, 400);
    }
    
    // 주문 조회
    const order = await DB.prepare(`
      SELECT * FROM orders WHERE order_number = ?
    `).bind(orderNumber).first();
    
    if (!order) {
      return c.json({ success: false, error: '주문을 찾을 수 없음' }, 404);
    }
    
    // 결제 상태 업데이트
    let paymentStatus = 'pending';
    
    if (status === 'PAY_COMPLETE' || status === 'DONE') {
      paymentStatus = 'approved';
      
      // 장바구니 비우기
      await DB.prepare(`
        DELETE FROM cart_items WHERE user_id = ?
      `).bind(order.user_id).run();
      
    } else if (status === 'PAY_CANCEL' || status === 'CANCEL') {
      paymentStatus = 'cancelled';
    } else if (status === 'PAY_FAIL' || status === 'FAILED') {
      paymentStatus = 'failed';
    }
    
    await DB.prepare(`
      UPDATE orders 
      SET payment_status = ?, payment_key = ?, updated_at = datetime('now')
      WHERE order_number = ?
    `).bind(paymentStatus, payToken || order.payment_key, orderNumber).run();
    
    return c.json({ success: true });
    
  } catch (err) {
    console.error('유어페이 Callback 처리 오류:', err);
    return c.json({
      success: false,
      error: (err as Error).message
    }, 500);
  }
});

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

// ==================== Seller Live Management APIs ====================

// Get seller's streams
app.get('/api/seller/streams', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, error: '인증 토큰이 없습니다.' }, 401);
    }
    
    const sessionToken = authHeader.replace('Bearer ', '');
    
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
    
    // 셀러의 스트림 목록 조회
    const streams = await DB.prepare(`
      SELECT 
        id,
        title,
        description,
        youtube_video_id,
        platform,
        status,
        current_product_id,
        viewer_count,
        created_at,
        updated_at
      FROM live_streams
      WHERE seller_id = ?
      ORDER BY created_at DESC
    `).bind(sellerId).all();
    
    return c.json({
      success: true,
      data: streams.results || []
    });
  } catch (error) {
    console.error('Seller streams query error:', error);
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});

// Get seller's products
app.get('/api/seller/products', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, error: '인증 토큰이 없습니다.' }, 401);
    }
    
    const sessionToken = authHeader.replace('Bearer ', '');
    
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
    
    // 셀러의 상품 목록 조회
    const products = await DB.prepare(`
      SELECT 
        id,
        name,
        description,
        price,
        original_price,
        discount_rate,
        stock,
        image_url,
        is_active,
        created_at
      FROM products
      WHERE seller_id = ?
      ORDER BY created_at DESC
    `).bind(sellerId).all();
    
    return c.json({
      success: true,
      data: products.results || []
    });
  } catch (error) {
    console.error('Seller products query error:', error);
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});

// Create new product (Seller)
app.post('/api/seller/products', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, error: '인증 토큰이 없습니다.' }, 401);
    }
    
    const sessionToken = authHeader.replace('Bearer ', '');
    
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
    const { name, description, price, stock, image_url, live_stream_id, product_type } = await c.req.json();
    
    // 필수 필드 검증
    if (!name || price === undefined || stock === undefined) {
      return c.json({ success: false, error: '필수 필드가 누락되었습니다.' }, 400);
    }
    
    // 상품 생성
    const result = await DB.prepare(`
      INSERT INTO products (
        name, description, price, stock, image_url, 
        seller_id, is_active, product_type, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))
    `).bind(
      name,
      description || null,
      price,
      stock,
      image_url || null,
      sellerId,
      product_type || 'featured'
    ).run();
    
    return c.json({
      success: true,
      data: { id: result.meta.last_row_id }
    });
  } catch (error) {
    console.error('Create product error:', error);
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});

// Get specific product (Seller)
app.get('/api/seller/products/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const productId = c.req.param('id');
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, error: '인증 토큰이 없습니다.' }, 401);
    }
    
    const sessionToken = authHeader.replace('Bearer ', '');
    
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
    
    // 상품 조회 (본인 상품만)
    const product = await DB.prepare(`
      SELECT * FROM products
      WHERE id = ? AND seller_id = ?
    `).bind(productId, sellerId).first();
    
    if (!product) {
      return c.json({ success: false, error: '상품을 찾을 수 없습니다.' }, 404);
    }
    
    return c.json({ success: true, data: product });
  } catch (error) {
    console.error('Get product error:', error);
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});

// Update product (Seller)
app.patch('/api/seller/products/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const productId = c.req.param('id');
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, error: '인증 토큰이 없습니다.' }, 401);
    }
    
    const sessionToken = authHeader.replace('Bearer ', '');
    
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
    const { name, description, price, stock, image_url, is_active, detail_images, product_type } = await c.req.json();
    
    // 본인 상품인지 확인
    const product = await DB.prepare(`
      SELECT id FROM products WHERE id = ? AND seller_id = ?
    `).bind(productId, sellerId).first();
    
    if (!product) {
      return c.json({ success: false, error: '상품을 찾을 수 없거나 권한이 없습니다.' }, 404);
    }
    
    // 상품 업데이트
    await DB.prepare(`
      UPDATE products
      SET name = ?, description = ?, price = ?, stock = ?, 
          image_url = ?, is_active = ?, detail_images = ?, product_type = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      name,
      description || null,
      price,
      stock,
      image_url || null,
      is_active ? 1 : 0,
      detail_images || null,
      product_type || 'featured',
      productId
    ).run();
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Update product error:', error);
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});

// Change current product in live stream (Seller)
app.post('/api/seller/streams/:streamId/change-product', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const streamId = c.req.param('streamId');
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, error: '인증 토큰이 없습니다.' }, 401);
    }
    
    const sessionToken = authHeader.replace('Bearer ', '');
    
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
    
    // 스트림 소유권 확인
    const stream = await DB.prepare(`
      SELECT id, seller_id, status
      FROM live_streams
      WHERE id = ?
    `).bind(streamId).first();
    
    if (!stream) {
      return c.json({ success: false, error: '스트림을 찾을 수 없습니다.' }, 404);
    }
    
    if (stream.seller_id !== sellerId) {
      return c.json({ success: false, error: '권한이 없습니다.' }, 403);
    }
    
    const { productId } = await c.req.json();
    
    // 상품 정보 조회 및 소유권 확인
    const product = await DB.prepare(`
      SELECT * FROM products 
      WHERE id = ? AND seller_id = ? AND is_active = 1
    `).bind(productId, sellerId).first();
    
    if (!product) {
      return c.json({ success: false, error: '상품을 찾을 수 없거나 권한이 없습니다.' }, 404);
    }
    
    // 라이브 스트림의 현재 상품 업데이트
    await DB.prepare(`
      UPDATE live_streams 
      SET current_product_id = ?, updated_at = datetime("now") 
      WHERE id = ?
    `).bind(productId, streamId).run();
    
    return c.json({
      success: true,
      data: {
        streamId: streamId,
        productId: productId,
        message: '상품이 변경되었습니다.'
      }
    });
  } catch (error) {
    console.error('Change product error:', error);
    return c.json({ success: false, error: (error as Error).message }, 500);
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
    
    // 주문 데이터 조회
    const ordersResult = await DB.prepare(`
      SELECT 
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
        AND o.payment_status IN ('approved', 'completed')
        AND DATE(o.created_at) >= DATE(?)
        AND DATE(o.created_at) <= DATE(?)
      ORDER BY o.created_at DESC
    `).bind(sellerId, start, end).all();
    
    // CSV 생성
    let csv = '주문번호,주문일시,주문자,총금액,수수료(10%),정산금액(90%),상태\n';
    
    for (const order of ordersResult?.results || []) {
      csv += `${order.order_number},${order.created_at},${order.user_name || '익명'},${order.total_amount},${order.commission_amount},${order.seller_amount},완료\n`;
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

// 셀러 대시보드 페이지
app.get('/seller', async (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>셀러 대시보드 - 유어 라이브 커머스</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                background: #f8f9fa;
            }
            .stat-card {
                background: white;
                border-radius: 12px;
                padding: 20px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                margin-bottom: 16px;
            }
            .stat-label {
                font-size: 14px;
                color: #8b95a1;
                margin-bottom: 8px;
            }
            .stat-value {
                font-size: 28px;
                font-weight: 700;
                color: #191f28;
            }
            .order-card {
                background: white;
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 12px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            }
            .btn-download {
                background: #0064FF;
                color: white;
                padding: 12px 24px;
                border-radius: 8px;
                border: none;
                cursor: pointer;
                font-weight: 600;
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }
            .btn-download:hover {
                background: #0051CC;
            }
            .date-input {
                padding: 8px 12px;
                border: 1px solid #e5e8eb;
                border-radius: 8px;
                font-size: 14px;
            }
        </style>
    </head>
    <body class="bg-gray-50">
        <div class="max-w-6xl mx-auto p-6">
            <!-- Header -->
            <div class="flex justify-between items-center mb-8">
                <div>
                    <h1 class="text-3xl font-bold text-gray-800">셀러 대시보드</h1>
                    <p class="text-gray-600 mt-2" id="seller-name">위드셀루</p>
                </div>
                <button onclick="logout()" class="text-gray-600 hover:text-gray-800">
                    <i class="fas fa-sign-out-alt mr-2"></i>로그아웃
                </button>
            </div>
            
            <!-- Date Range Filter -->
            <div class="bg-white rounded-xl p-6 shadow-sm mb-6">
                <div class="flex items-center gap-4 flex-wrap">
                    <div>
                        <label class="block text-sm text-gray-600 mb-2">시작일</label>
                        <input type="date" id="start-date" class="date-input">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-600 mb-2">종료일</label>
                        <input type="date" id="end-date" class="date-input">
                    </div>
                    <div class="flex-1"></div>
                    <button onclick="loadSalesData()" class="btn-download">
                        <i class="fas fa-search"></i>조회하기
                    </button>
                    <button onclick="downloadCSV()" class="btn-download">
                        <i class="fas fa-download"></i>CSV 다운로드
                    </button>
                </div>
            </div>
            
            <!-- Stats Cards -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="stat-card">
                    <div class="stat-label">총 주문</div>
                    <div class="stat-value" id="total-orders">0건</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">총 매출</div>
                    <div class="stat-value" id="total-amount">0원</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">정산 금액 (90%)</div>
                    <div class="stat-value text-blue-600" id="net-amount">0원</div>
                </div>
            </div>
            
            <!-- Recent Orders -->
            <div class="bg-white rounded-xl p-6 shadow-sm">
                <h2 class="text-xl font-bold text-gray-800 mb-4">주문 내역</h2>
                <div id="orders-list">
                    <div class="text-center text-gray-500 py-8">
                        데이터를 불러오는 중...
                    </div>
                </div>
            </div>
        </div>
        
        <script>
            // Initialize date inputs with current month
            const today = new Date();
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            document.getElementById('start-date').value = firstDay.toISOString().split('T')[0];
            document.getElementById('end-date').value = today.toISOString().split('T')[0];
            
            // Check authentication
            const sessionToken = localStorage.getItem('sessionToken');
            if (!sessionToken) {
                window.location.href = '/seller-login';
            }
            
            // Load sales data on page load
            loadSalesData();
            
            async function loadSalesData() {
                const startDate = document.getElementById('start-date').value;
                const endDate = document.getElementById('end-date').value;
                
                try {
                    const response = await axios.get('/api/seller/sales', {
                        params: { startDate, endDate },
                        headers: {
                            'X-Session-Token': sessionToken
                        }
                    });
                    
                    if (response.data.success) {
                        const { seller, stats, orders } = response.data.data;
                        
                        // Update seller name
                        document.getElementById('seller-name').textContent = 
                            seller.display_name || seller.username;
                        
                        // Update stats
                        document.getElementById('total-orders').textContent = 
                            stats.total_orders + '건';
                        document.getElementById('total-amount').textContent = 
                            parseInt(stats.total_amount).toLocaleString() + '원';
                        document.getElementById('net-amount').textContent = 
                            parseInt(stats.net_amount).toLocaleString() + '원';
                        
                        // Update orders list
                        const ordersList = document.getElementById('orders-list');
                        if (orders.length === 0) {
                            ordersList.innerHTML = '<div class="text-center text-gray-500 py-8">주문 내역이 없습니다.</div>';
                        } else {
                            ordersList.innerHTML = orders.map(order => \`
                                <div class="order-card">
                                    <div class="flex justify-between items-start mb-2">
                                        <div>
                                            <div class="font-semibold text-gray-800">\${order.order_number}</div>
                                            <div class="text-sm text-gray-600 mt-1">\${formatDate(order.created_at)}</div>
                                        </div>
                                        <div class="text-right">
                                            <div class="text-lg font-bold text-gray-800">
                                                \${parseInt(order.total_amount).toLocaleString()}원
                                            </div>
                                            <div class="text-sm text-gray-600">
                                                수수료: \${parseInt(order.commission_amount).toLocaleString()}원
                                            </div>
                                            <div class="text-sm text-blue-600 font-semibold">
                                                정산: \${parseInt(order.seller_amount).toLocaleString()}원
                                            </div>
                                        </div>
                                    </div>
                                    <div class="text-sm text-gray-600">
                                        <i class="fas fa-user mr-1"></i>\${order.user_name || '익명'}
                                    </div>
                                </div>
                            \`).join('');
                        }
                    }
                } catch (error) {
                    console.error('Failed to load sales data:', error);
                    if (error.response?.status === 401) {
                        alert('세션이 만료되었습니다. 다시 로그인해주세요.');
                        window.location.href = '/seller-login';
                    } else {
                        alert('데이터를 불러오는데 실패했습니다.');
                    }
                }
            }
            
            async function downloadCSV() {
                const startDate = document.getElementById('start-date').value;
                const endDate = document.getElementById('end-date').value;
                
                try {
                    const response = await axios.get('/api/seller/settlement-csv', {
                        params: { startDate, endDate },
                        headers: {
                            'X-Session-Token': sessionToken
                        },
                        responseType: 'blob'
                    });
                    
                    // Create download link
                    const url = window.URL.createObjectURL(new Blob([response.data]));
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', \`settlement_\${startDate}_\${endDate}.csv\`);
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    window.URL.revokeObjectURL(url);
                    
                    alert('정산서가 다운로드되었습니다.');
                } catch (error) {
                    console.error('CSV download failed:', error);
                    alert('다운로드에 실패했습니다.');
                }
            }
            
            function formatDate(dateString) {
                const date = new Date(dateString);
                return \`\${date.getFullYear()}년 \${date.getMonth() + 1}월 \${date.getDate()}일 \${date.getHours()}:\${String(date.getMinutes()).padStart(2, '0')}\`;
            }
            
            function logout() {
                localStorage.removeItem('sessionToken');
                localStorage.removeItem('userType');
                localStorage.removeItem('userName');
                window.location.href = '/seller-login';
            }
        </script>
    </body>
    </html>
  `);
});

export default app;
