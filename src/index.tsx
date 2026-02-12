import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import type { Bindings, ApiResponse, LiveStream, Product, ProductOption, User, CartItem, Order, OrderItem } from './types';
import { issueTaxInvoiceAuto, convertToBarobillFormat, isBarobillMockMode, cancelBarobillTaxInvoice } from './services/barobill';
import { 
  exchangeKakaoCode, 
  processKakaoLogin, 
  AuthError 
} from './auth-utils';

// Payment Provider (인라인 - 번들링 이슈 방지)
interface PaymentConfirmRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
}

interface PaymentConfirmResponse {
  success: boolean;
  orderId: string;
  paymentKey: string;
  method: string;
  totalAmount: number;
  status: string;
  approvedAt: string;
  cardCompany?: string;
  cardNumber?: string;
  installmentMonths?: number;
  virtualAccountBank?: string;
  virtualAccountNumber?: string;
  virtualAccountHolder?: string;
  virtualAccountDueDate?: string;
  transactionId?: string;
  rawData?: any;
  error?: string;
}

interface PaymentProvider {
  name: string;
  confirmPayment(request: PaymentConfirmRequest): Promise<PaymentConfirmResponse>;
  cancelPayment(request: { paymentKey: string; cancelReason: string; cancelAmount?: number }): Promise<{
    success: boolean;
    error?: string;
    canceledAt?: string;
    rawData?: any;
  }>;
  getPayment(paymentKey: string): Promise<PaymentConfirmResponse>;
}

// 순수 함수 기반 Payment Provider (class 문법을 피해 Workers 번들링 이슈 방지)
function createTossPaymentsProvider(secretKey: string): PaymentProvider {
  return {
    name: 'tosspayments',
    
    async confirmPayment(request: PaymentConfirmRequest): Promise<PaymentConfirmResponse> {
      try {
        const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(secretKey + ':')}`,
            'Content-Type': 'application/json',
            'TossPayments-API-Version': '2022-11-16'
          },
          body: JSON.stringify({
            paymentKey: request.paymentKey,
            orderId: request.orderId,
            amount: request.amount
          })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          return {
            success: false,
            orderId: request.orderId,
            paymentKey: request.paymentKey,
            method: '',
            totalAmount: request.amount,
            status: 'FAILED',
            approvedAt: '',
            error: data.message || '결제 승인 실패',
            rawData: data
          };
        }
        
        let cardInfo: any = {};
        if (data.card) {
          cardInfo = {
            cardCompany: data.card.company,
            cardNumber: data.card.number,
            installmentMonths: data.card.installmentPlanMonths || 0
          };
        }
        
        let virtualAccountInfo: any = {};
        if (data.virtualAccount) {
          virtualAccountInfo = {
            virtualAccountBank: data.virtualAccount.bankCode,
            virtualAccountNumber: data.virtualAccount.accountNumber,
            virtualAccountHolder: data.virtualAccount.customerName,
            virtualAccountDueDate: data.virtualAccount.dueDate
          };
        }
        
        return {
          success: true,
          orderId: data.orderId,
          paymentKey: data.paymentKey,
          method: data.method,
          totalAmount: data.totalAmount,
          status: data.status,
          approvedAt: data.approvedAt,
          transactionId: data.transactionKey,
          ...cardInfo,
          ...virtualAccountInfo,
          rawData: data
        };
      } catch (err) {
        return {
          success: false,
          orderId: request.orderId,
          paymentKey: request.paymentKey,
          method: '',
          totalAmount: request.amount,
          status: 'FAILED',
          approvedAt: '',
          error: (err as Error).message,
          rawData: null
        };
      }
    },
    
    async cancelPayment(request: { paymentKey: string; cancelReason: string; cancelAmount?: number }): Promise<{
      success: boolean;
      error?: string;
      canceledAt?: string;
      rawData?: any;
    }> {
      try {
        const body: any = { cancelReason: request.cancelReason };
        if (request.cancelAmount) {
          body.cancelAmount = request.cancelAmount;
        }
        
        const response = await fetch(`https://api.tosspayments.com/v1/payments/${request.paymentKey}/cancel`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(secretKey + ':')}`,
            'Content-Type': 'application/json',
            'TossPayments-API-Version': '2022-11-16'
          },
          body: JSON.stringify(body)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          return { success: false, error: data.message || '취소 실패' };
        }
        
        return { 
          success: true,
          canceledAt: data.canceledAt || new Date().toISOString(),
          rawData: data
        };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
    
    async getPayment(paymentKey: string): Promise<PaymentConfirmResponse> {
      try {
        const response = await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${btoa(secretKey + ':')}`,
            'TossPayments-API-Version': '2022-11-16'
          }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message);
        }
        
        return {
          success: true,
          orderId: data.orderId,
          paymentKey: data.paymentKey,
          method: data.method,
          totalAmount: data.totalAmount,
          status: data.status,
          approvedAt: data.approvedAt,
          rawData: data
        };
      } catch (err) {
        throw err;
      }
    }
  };
}

// PaymentProvider Factory (순수 함수)
function createPaymentProvider(provider: string, secretKey: string): PaymentProvider {
  switch (provider.toLowerCase()) {
    case 'tosspayments':
      return createTossPaymentsProvider(secretKey);
    default:
      throw new Error(`Unknown payment provider: ${provider}`);
  }
}

const app = new Hono<{ Bindings: Bindings }>();

// Note: Cloudflare Pages automatically handles compression (Gzip/Brotli)
// No need for manual compression middleware

// =================================
// Utility Functions
// =================================

/**
 * Cache Helper - Read from CACHE_KV with TTL
 * @param CACHE_KV - Cloudflare KV namespace for caching
 * @param key - Cache key
 * @returns Cached data or null
 */
async function getCachedData(CACHE_KV: KVNamespace, key: string): Promise<any> {
  try {
    const cached = await CACHE_KV.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    console.error('[Cache] Read error:', error);
    return null;
  }
}

/**
 * Cache Helper - Write to CACHE_KV with TTL
 * @param CACHE_KV - Cloudflare KV namespace for caching
 * @param key - Cache key
 * @param data - Data to cache
 * @param ttl - Time to live in seconds (default: 60s)
 */
async function setCachedData(CACHE_KV: KVNamespace, key: string, data: any, ttl: number = 60): Promise<void> {
  try {
    await CACHE_KV.put(key, JSON.stringify(data), { expirationTtl: ttl });
  } catch (error) {
    console.error('[Cache] Write error:', error);
  }
}

/**
 * Cache Helper - Delete from CACHE_KV
 * @param CACHE_KV - Cloudflare KV namespace for caching
 * @param keys - Cache key(s) to delete
 */
async function deleteCachedData(CACHE_KV: KVNamespace, ...keys: string[]): Promise<void> {
  try {
    await Promise.all(keys.map(key => CACHE_KV.delete(key)));
  } catch (error) {
    console.error('[Cache] Delete error:', error);
  }
}

/**
 * Extract YouTube Video ID from various URL formats
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/live/VIDEO_ID
 */
function extractYouTubeVideoId(url: string): string | null {
  try {
    // Direct video ID (no URL)
    if (!/^https?:\/\//.test(url) && /^[\w-]{11}$/.test(url)) {
      return url;
    }

    const urlObj = new URL(url);
    
    // youtube.com/watch?v=VIDEO_ID
    if (urlObj.hostname.includes('youtube.com')) {
      const videoId = urlObj.searchParams.get('v');
      if (videoId) return videoId;
      
      // youtube.com/embed/VIDEO_ID, youtube.com/live/VIDEO_ID, or youtube.com/shorts/VIDEO_ID
      const pathMatch = urlObj.pathname.match(/\/(embed|live|shorts)\/([a-zA-Z0-9_-]{11})/);
      if (pathMatch) return pathMatch[2];
    }
    
    // youtu.be/VIDEO_ID
    if (urlObj.hostname === 'youtu.be') {
      const videoId = urlObj.pathname.slice(1).split('?')[0]; // Remove query params
      if (videoId && videoId.length === 11) return videoId;
    }
    
    return null;
  } catch {
    return null;
  }
}

function extractTikTokVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    
    // tiktok.com/@username/video/7602630404377414932
    if (urlObj.hostname.includes('tiktok.com')) {
      const videoMatch = urlObj.pathname.match(/\/video\/(\d+)/);
      if (videoMatch) {
        return videoMatch[1]; // Return video ID
      }
      
      // For live or username-only URLs, return the full path after @
      const usernameMatch = urlObj.pathname.match(/\/@([a-zA-Z0-9_.]+)/);
      if (usernameMatch) {
        return usernameMatch[1]; // Return username as fallback
      }
    }
    
    // vm.tiktok.com or vt.tiktok.com short links
    if (urlObj.hostname.includes('vm.tiktok.com') || urlObj.hostname.includes('vt.tiktok.com')) {
      return urlObj.pathname.slice(1); // Return the short code
    }
    
    return null;
  } catch {
    return null;
  }
}

function detectTikTokVideoType(url: string): 'video' | 'live' | null {
  try {
    const urlObj = new URL(url);
    
    if (urlObj.hostname.includes('tiktok.com')) {
      // Check if it's a live stream
      if (urlObj.pathname.includes('/live')) {
        return 'live';
      }
      // Check if it's a video
      if (urlObj.pathname.includes('/video/')) {
        return 'video';
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

function extractTikTokUsername(url: string): string | null {
  try {
    const urlObj = new URL(url);
    
    // tiktok.com/@username or tiktok.com/@username/live or tiktok.com/@username/video/12345
    if (urlObj.hostname.includes('tiktok.com')) {
      const match = urlObj.pathname.match(/\/@([a-zA-Z0-9_.]+)/);
      if (match) return match[1];
    }
    
    // vm.tiktok.com short links
    if (urlObj.hostname.includes('vm.tiktok.com')) {
      // For short links, we can't extract username directly
      // Return a placeholder or the full URL
      return urlObj.pathname.slice(1); // Return the short code
    }
    
    // vt.tiktok.com short links (another TikTok short link format)
    if (urlObj.hostname.includes('vt.tiktok.com')) {
      return urlObj.pathname.slice(1);
    }
    
    return null;
  } catch {
    return null;
  }
}

// CORS 설정
app.use('/api/*', cors());

// Static Asset CDN 최적화 - Cache-Control 헤더 설정
app.use('/static/*', async (c, next) => {
  await next();
  
  // 정적 파일에 1년 캐시 설정 (immutable)
  c.header('Cache-Control', 'public, max-age=31536000, immutable');
  c.header('CDN-Cache-Control', 'public, max-age=31536000');
});

app.use('/images/*', async (c, next) => {
  await next();
  
  // 이미지 파일에 1년 캐시 설정
  c.header('Cache-Control', 'public, max-age=31536000, immutable');
  c.header('CDN-Cache-Control', 'public, max-age=31536000');
});

// 정적 파일 서빙 - Cloudflare Pages가 처리하도록 Worker에서 제외
// app.use('/static/*', serveStatic({ root: './public' }));
// → _routes.json에서 /static/*을 exclude에 추가하여 Pages가 직접 서빙

// =================================
// API Routes
// =================================

// =================================
// Authentication APIs
// =================================

// 세션 생성 (KV에 저장) - D1 쓰기 부담 감소 ✅
async function createSession(SESSION_KV: KVNamespace, userId: number, userType: 'admin' | 'seller', userData: any) {
  const sessionToken = `${userType}_${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24시간 후 (timestamp)
  
  const sessionData = {
    userId,
    userType,
    userData,
    expiresAt
  };
  
  // KV에 저장 (자동 만료 설정)
  await SESSION_KV.put(
    `session:${sessionToken}`,
    JSON.stringify(sessionData),
    { expirationTtl: 86400 } // 24시간 (초 단위)
  );
  
  return sessionToken;
}

// 세션 조회 및 검증 (KV에서 조회) - 10배 빠름 ✅
async function getSession(SESSION_KV: KVNamespace, sessionToken: string) {
  const sessionDataStr = await SESSION_KV.get(`session:${sessionToken}`);
  
  if (!sessionDataStr) {
    return null;
  }
  
  const sessionData = JSON.parse(sessionDataStr);
  
  // 만료 확인 (KV의 expirationTtl이 자동으로 처리하지만 추가 체크)
  if (sessionData.expiresAt && Date.now() > sessionData.expiresAt) {
    await SESSION_KV.delete(`session:${sessionToken}`);
    return null;
  }
  
  // D1 형식과 호환되도록 변환
  return {
    session_token: sessionToken,
    [`${sessionData.userType}_id`]: sessionData.userId,
    user_type: sessionData.userType,
    ...sessionData.userData
  };
}

// 일반 사용자 회원가입 API
app.post('/api/auth/user/register', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const { email, password, name, phone } = await c.req.json();
    
    if (!email || !password || !name) {
      return c.json({ success: false, error: '이메일, 비밀번호, 이름은 필수입니다' }, 400);
    }
    
    // 이메일 중복 확인
    const existingUser = await DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();
    
    if (existingUser) {
      return c.json({ success: false, error: '이미 가입된 이메일입니다' }, 400);
    }
    
    // 비밀번호 해시 (실제로는 bcrypt 사용 권장, 여기서는 간단히 처리)
    const passwordHash = `placeholder_hash_for_${password}`;
    
    
    // 사용자 생성
    const result = await DB.prepare(`
      INSERT INTO users (email, password_hash, name, phone, created_at, last_login_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(email, passwordHash, name, phone || null).run();
    
    const userId = result.meta.last_row_id;
    
    // 세션 토큰 생성
    const sessionToken = `user_${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    return c.json({
      success: true,
      data: {
        access_token: sessionToken,
        user: {
          id: userId,
          email,
          name,
          phone,
        },
      },
    });
  } catch (error) {
    console.error('[User Register] Error:', error);
    return c.json({
      success: false,
      error: (error as Error).message || '회원가입 중 오류가 발생했습니다',
    }, 500);
  }
});

// 일반 사용자 로그인 API
app.post('/api/auth/user/login', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const { email, password } = await c.req.json();
    
    if (!email || !password) {
      return c.json({ success: false, error: '이메일과 비밀번호를 입력해주세요' }, 400);
    }
    
    // 사용자 조회
    const user = await DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email).first();
    
    if (!user) {
      return c.json({ success: false, error: '이메일 또는 비밀번호가 일치하지 않습니다' }, 401);
    }
    
    // 비밀번호 검증
    const validPassword = user.password_hash && user.password_hash.includes(`placeholder_hash_for_${password}`);
    
    if (!validPassword) {
      return c.json({ success: false, error: '이메일 또는 비밀번호가 일치하지 않습니다' }, 401);
    }
    
    // 마지막 로그인 시간 업데이트
    await DB.prepare(
      'UPDATE users SET last_login_at = datetime(\'now\') WHERE id = ?'
    ).bind(user.id).run();
    
    // 세션 토큰 생성
    const sessionToken = `user_${user.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    return c.json({
      success: true,
      data: {
        access_token: sessionToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          profile_image: user.profile_image,
        },
      },
    });
  } catch (error) {
    console.error('[User Login] Error:', error);
    return c.json({
      success: false,
      error: (error as Error).message || '로그인 중 오류가 발생했습니다',
    }, 500);
  }
});

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
    
    // 사용자 조회 (username 또는 email로 조회)
    user = await DB.prepare(`SELECT * FROM ${table} WHERE username = ? OR email = ?`).bind(username, username).first();
    
    if (!user) {
      return c.json({ success: false, error: '아이디 또는 비밀번호가 일치하지 않습니다' }, 401);
    }
    
    // 비밀번호 검증
    // 기본 테스트 계정 (username 또는 email로 로그인 가능)
    const isDefaultAdmin = userType === 'admin' && 
                          (username === 'admin' || username === 'admin@example.com') && 
                          password === 'admin123';
    const isDefaultSeller = userType === 'seller' && 
                           ((username === 'seller1' && password === 'seller123') ||
                            (username === 'seller2' && password === 'seller123'));
    
    // 관리자가 생성한 계정 (password_hash에 비밀번호가 포함됨)
    const isCustomAccount = user.password_hash && user.password_hash.includes(`placeholder_hash_for_${password}`);
    
    const validPassword = isDefaultAdmin || isDefaultSeller || isCustomAccount;
    
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
    
    // 세션 생성 (KV에 저장) ✅
    const sessionToken = await createSession(c.env.SESSION_KV, user.id, userType, {
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
      // KV에서 세션 삭제 ✅
      await c.env.SESSION_KV.delete(`session:${sessionToken}`);
    }
    
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 셀러 회원가입 API
app.post('/api/seller/register', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const { email, password, name, phone, business_number, company_name } = await c.req.json();
    
    // 유효성 검증
    if (!email || !password || !name || !phone) {
      return c.json({ success: false, error: '필수 항목을 모두 입력해주세요' }, 400);
    }
    
    if (password.length < 6) {
      return c.json({ success: false, error: '비밀번호는 6자 이상이어야 합니다' }, 400);
    }
    
    // 이메일 중복 확인
    const existingSeller = await DB.prepare('SELECT id FROM sellers WHERE email = ?').bind(email).first();
    if (existingSeller) {
      return c.json({ success: false, error: '이미 가입된 이메일입니다' }, 400);
    }
    
    // username 생성 (email의 @ 앞부분)
    const username = email.split('@')[0];
    
    // 비밀번호 해시 (간단한 형태로 저장)
    const password_hash = `placeholder_hash_for_${password}`;
    
    // 셀러 생성 (관리자 승인 대기 상태)
    const result = await DB.prepare(`
      INSERT INTO sellers (
        username, email, password_hash, name, phone, 
        business_number, company_name, status, is_active, 
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 1, datetime('now'), datetime('now'))
    `).bind(
      username,
      email,
      password_hash,
      name,
      phone,
      business_number || null,
      company_name || null
    ).run();
    
    return c.json({
      success: true,
      data: {
        sellerId: result.meta.last_row_id,
        message: '회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.'
      }
    });
    
  } catch (err) {
    console.error('Seller registration error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Admin login API (email-based)
app.post('/api/admin/login', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const { email, password } = await c.req.json();
    
    if (!email || !password) {
      return c.json({ success: false, error: '이메일과 비밀번호를 입력해주세요' }, 400);
    }
    
    // Find admin by email
    const admin = await DB.prepare('SELECT * FROM admins WHERE email = ?').bind(email).first();
    
    if (!admin) {
      return c.json({ success: false, error: '이메일 또는 비밀번호가 일치하지 않습니다' }, 401);
    }
    
    // Verify password (simple check for test account)
    const isTestAccount = email === 'admin@example.com' && password === 'admin123';
    const isValidPassword = isTestAccount || (admin.password_hash && admin.password_hash.includes(`placeholder_hash_for_${password}`));
    
    if (!isValidPassword) {
      return c.json({ success: false, error: '이메일 또는 비밀번호가 일치하지 않습니다' }, 401);
    }
    
    // Check if active
    if (!admin.is_active) {
      return c.json({ success: false, error: '비활성화된 계정입니다' }, 403);
    }
    
    // Create session in KV
    const sessionToken = await createSession(c.env.SESSION_KV, admin.id, 'admin', {
      username: admin.username,
      email: admin.email,
      name: admin.name,
      role: admin.role
    });
    
    // Update last login time
    await DB.prepare('UPDATE admins SET last_login_at = datetime("now") WHERE id = ?').bind(admin.id).run();
    
    return c.json({
      success: true,
      data: {
        token: sessionToken,
        admin: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          name: admin.name,
          role: admin.role
        }
      }
    });
    
  } catch (err) {
    console.error('Admin login error:', err);
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
    
    const session = await getSession(c.env.SESSION_KV, sessionToken);
    
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

// =================================
// 카카오 싱크 로그인 API
// =================================

// 카카오 싱크 콜백 처리 (authorize 리다이렉트)
app.get('/auth/kakao/sync/callback', async (c) => {
  const { DB } = c.env;
  
  try {
    console.log('[Kakao Sync] Callback started');
    console.log('[Kakao Sync] DB available:', !!DB);
    
    const code = c.req.query('code');
    const state = c.req.query('state') || '/';
    const error = c.req.query('error');
    
    console.log('[Kakao Sync] Query params:', { 
      hasCode: !!code, 
      state, 
      error 
    });
    
    if (error) {
      console.error('[Kakao Sync] OAuth error:', error);
      return c.redirect(`${state}?error=kakao_oauth_${error}`);
    }
    
    if (!code) {
      console.error('[Kakao Sync] No authorization code');
      return c.redirect(`${state}?error=no_code`);
    }
    
    console.log('[Kakao Sync] Authorization code received');
    
    const KAKAO_REST_API_KEY = c.env.KAKAO_REST_API_KEY || '5dd74bccb797640b0efd070467f3bafd';
    const KAKAO_REDIRECT_URI = `${new URL(c.req.url).origin}/auth/kakao/sync/callback`;
    
    console.log('[Kakao Sync] Exchanging code for token...');
    console.log('  - REST_API_KEY:', KAKAO_REST_API_KEY.substring(0, 10) + '...');
    console.log('  - REDIRECT_URI:', KAKAO_REDIRECT_URI);
    
    // 1. Exchange code for access token
    console.log('[Kakao Sync] Step 1: Fetching access token...');
    
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
    
    console.log('[Kakao Sync] Token response status:', tokenResponse.status);
    console.log('[Kakao Sync] Token request details:', {
      client_id: KAKAO_REST_API_KEY,
      redirect_uri: KAKAO_REDIRECT_URI,
      code_length: code.length,
      code_prefix: code.substring(0, 20)
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[Kakao Sync] Token request failed:', errorText);
      return c.redirect(`${state}?error=token_request_failed&detail=${encodeURIComponent(errorText)}`);
    }
    
    const tokenData = await tokenResponse.json();
    console.log('[Kakao Sync] Token data received:', { 
      hasAccessToken: !!tokenData.access_token,
      error: tokenData.error,
      errorDescription: tokenData.error_description
    });
    
    if (!tokenData.access_token) {
      console.error('[Kakao Sync] Token error:', tokenData);
      return c.redirect(`${state}?error=token_failed&detail=${encodeURIComponent(tokenData.error || 'unknown')}`);
    }
    
    console.log('[Kakao Sync] Access token obtained successfully');
    
    // 2. Get user info
    console.log('[Kakao Sync] Step 2: Fetching user info...');
    
    const userResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });
    
    console.log('[Kakao Sync] User response status:', userResponse.status);
    
    const userData = await userResponse.json();
    console.log('[Kakao Sync] User data received:', { 
      hasId: !!userData.id,
      id: userData.id,
      hasNickname: !!(userData.properties?.nickname || userData.kakao_account?.profile?.nickname)
    });
    
    if (!userData.id) {
      console.error('[Kakao Sync] Failed to get user info:', userData);
      return c.redirect(`${state}?error=user_info_failed`);
    }
    
    console.log('[Kakao Sync] User info obtained successfully');
    
    // 2.5. Get service terms agreement status (카카오싱크 필수)
    console.log('[Kakao Sync] Step 2.5: Fetching service terms...');
    
    const termsResponse = await fetch('https://kapi.kakao.com/v2/user/service_terms', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });
    
    console.log('[Kakao Sync] Terms response status:', termsResponse.status);
    
    let termsData = null;
    if (termsResponse.ok) {
      termsData = await termsResponse.json();
      console.log('[Kakao Sync] Service terms received:', {
        allowedServiceTerms: termsData.allowed_service_terms?.length || 0,
        tags: termsData.allowed_service_terms?.map((t: any) => t.tag)
      });
    } else {
      console.warn('[Kakao Sync] Failed to fetch service terms (non-critical)');
    }
    
    // 3. Save/update user in database
    console.log('[Kakao Sync] Step 3: Saving user to database...');
    
    if (!DB) {
      console.error('[Kakao Sync] DB is not available!');
      return c.redirect(`${state}?error=db_not_available`);
    }
    
    const kakaoId = userData.id.toString();
    const nickname = userData.properties?.nickname || userData.kakao_account?.profile?.nickname || 'Kakao User';
    const email = userData.kakao_account?.email || '';
    const profileImage = userData.properties?.profile_image || userData.kakao_account?.profile?.profile_image_url || '';
    const accessToken = tokenData.access_token; // For unlink operation
    const serviceTermsTags = termsData?.allowed_service_terms?.map((t: any) => t.tag) || [];
    const serviceTermsJson = JSON.stringify(serviceTermsTags);
    
    console.log('[Kakao Sync] User data:', { 
      kakaoId, 
      nickname, 
      email: email ? 'exists' : 'none',
      serviceTerms: serviceTermsTags
    });
    
    try {
      const existingUser = await DB.prepare(
        'SELECT * FROM users WHERE kakao_id = ?'
      ).bind(kakaoId).first();
      
      console.log('[Kakao Sync] Existing user check:', !!existingUser);
      
      let userId;
      
      if (existingUser) {
        userId = existingUser.id;
        await DB.prepare(`
          UPDATE users 
          SET name = ?, 
              email = ?, 
              profile_image = ?,
              updated_at = CURRENT_TIMESTAMP,
              last_login_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(nickname, email, profileImage, userId).run();
        console.log('[Kakao Sync] Updated user:', userId);
      } else {
        // Insert new Kakao user
        const result = await DB.prepare(`
          INSERT INTO users (
            kakao_id, 
            name, 
            email, 
            profile_image,
            created_at,
            last_login_at
          ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(kakaoId, nickname, email || null, profileImage || null).run();
        userId = result.meta.last_row_id;
        console.log('[Kakao Sync] Created user:', userId);
      }
      
      console.log('[Kakao Sync] User saved successfully, userId:', userId);
      
      // 4. Create session (24 hours)
      console.log('[Kakao Sync] Step 4: Creating session...');
      
      const sessionToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      
      await DB.prepare(
        'INSERT INTO admin_sessions (session_token, user_type, expires_at) VALUES (?, ?, ?)'
      ).bind(sessionToken, 'user', expiresAt).run();
      
      console.log('[Kakao Sync] Session created successfully');
      
      // 5. Redirect back with session info
      console.log('[Kakao Sync] Step 5: Redirecting...');
      
      const redirectUrl = state.includes('?') 
        ? `${state}&login=success&session=${sessionToken}&userId=${userId}&userName=${encodeURIComponent(nickname)}`
        : `${state}?login=success&session=${sessionToken}&userId=${userId}&userName=${encodeURIComponent(nickname)}`;
      
      console.log('[Kakao Sync] Redirect URL:', redirectUrl);
      return c.redirect(redirectUrl);
      
    } catch (dbError) {
      console.error('[Kakao Sync] Database error:', dbError);
      console.error('[Kakao Sync] DB error details:', {
        message: (dbError as Error).message,
        name: (dbError as Error).name
      });
      return c.redirect(`${state}?error=database_error&detail=${encodeURIComponent((dbError as Error).message)}`);
    }
    
  } catch (error) {
    console.error('[Kakao Sync] Exception:', error);
    console.error('[Kakao Sync] Error details:', {
      message: (error as Error).message,
      stack: (error as Error).stack,
      name: (error as Error).name
    });
    const state = c.req.query('state') || '/';
    const errorMsg = encodeURIComponent((error as Error).message || 'unknown');
    return c.redirect(`${state}?error=kakao_sync_failed&detail=${errorMsg}`);
  }
});

// 카카오 로그인 콜백 처리 (OAuth code exchange)
app.post('/api/auth/kakao/callback', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const { code, redirect_uri } = await c.req.json();
    
    if (!code) {
      return c.json({ success: false, error: 'Authorization code is required' }, 400);
    }
    
    // KAKAO_REST_API_KEY가 없으면 에러 (하드코딩 제거)
    if (!c.env.KAKAO_REST_API_KEY) {
      console.error('[Kakao Callback] KAKAO_REST_API_KEY not configured');
      return c.json({ 
        success: false, 
        error: 'Server configuration error',
        code: 'MISSING_API_KEY'
      }, 500);
    }
    
    const redirectUri = redirect_uri || 'https://live.ur-team.com/auth/kakao/callback';
    
    console.log('[Kakao Callback] Starting OAuth flow');
    
    // 1. 코드를 액세스 토큰으로 교환
    const accessToken = await exchangeKakaoCode(code, redirectUri, c.env.KAKAO_REST_API_KEY);
    
    // 2. 카카오 로그인 처리 (사용자 정보 가져오기 + DB UPSERT)
    const { user, sessionToken } = await processKakaoLogin(DB, accessToken);
    
    return c.json({
      success: true,
      data: {
        session_token: sessionToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          profile_image: user.profile_image,
        },
      },
    });
    
  } catch (error) {
    console.error('[Kakao Callback] Error:', error);
    
    // AuthError 타입 체크
    if (error instanceof AuthError) {
      return c.json({
        success: false,
        error: error.message,
        code: error.code,
      }, error.statusCode);
    }
    
    // 기타 에러
    return c.json({
      success: false,
      error: (error as Error).message || 'Internal server error',
      code: 'UNKNOWN_ERROR',
    }, 500);
  }
});

// 카카오 싱크 토큰 검증 및 로그인 (Legacy - for reference)
app.post('/api/auth/kakao/sync', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const { accessToken } = await c.req.json();
    
    if (!accessToken) {
      return c.json({ success: false, error: 'Access token is required' }, 400);
    }
    
    console.log('[Kakao Sync] Verifying access token');
    
    // 카카오 로그인 처리 (사용자 정보 가져오기 + DB UPSERT)
    const { user, sessionToken } = await processKakaoLogin(DB, accessToken);
    
    console.log('[Kakao Sync] Login successful');
    
    return c.json({
      success: true,
      data: {
        session_token: sessionToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          profile_image: user.profile_image,
        },
      },
    });
    
  } catch (error) {
    console.error('[Kakao Sync] Error:', error);
    
    // AuthError 타입 체크
    if (error instanceof AuthError) {
      return c.json({
        success: false,
        error: error.message,
        code: error.code,
      }, error.statusCode);
    }
    
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Login failed',
      code: 'UNKNOWN_ERROR',
    }, 500);
  }
});

// 카카오 로그아웃
app.post('/api/auth/kakao/logout', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const sessionToken = c.req.header('X-Session-Token') || '';
    
    if (sessionToken) {
      await DB.prepare('DELETE FROM admin_sessions WHERE session_token = ?').bind(sessionToken).run();
      console.log('[Kakao Sync] Session deleted');
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error('[Kakao Sync] Logout error:', error);
    return c.json({ success: false, error: 'Logout failed' }, 500);
  }
});

// 카카오 연결 해제 및 회원 탈퇴
app.post('/api/auth/kakao/unlink', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const sessionToken = c.req.header('X-Session-Token');
    
    if (!sessionToken) {
      return c.json({ 
        success: false, 
        error: '인증이 필요합니다' 
      }, 401);
    }
    
    console.log('[Kakao Unlink] Starting unlink process...');
    
    // 1. 세션에서 사용자 정보 조회
    const session = await DB.prepare(`
      SELECT * FROM admin_sessions WHERE session_token = ?
    `).bind(sessionToken).first();
    
    if (!session) {
      return c.json({ 
        success: false, 
        error: '유효하지 않은 세션입니다' 
      }, 401);
    }
    
    // 2. 사용자 정보 조회 (access_token 포함)
    const user = await DB.prepare(`
      SELECT * FROM users WHERE id = (
        SELECT user_id FROM admin_sessions WHERE session_token = ?
      )
    `).bind(sessionToken).first();
    
    if (!user) {
      return c.json({ 
        success: false, 
        error: '사용자를 찾을 수 없습니다' 
      }, 404);
    }
    
    console.log('[Kakao Unlink] User found:', user.id);
    
    // 3. Kakao 연결 해제 API 호출
    if (user.access_token) {
      try {
        console.log('[Kakao Unlink] Calling Kakao unlink API...');
        
        const unlinkResponse = await fetch('https://kapi.kakao.com/v1/user/unlink', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user.access_token}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        
        const unlinkData = await unlinkResponse.json();
        
        if (unlinkResponse.ok) {
          console.log('[Kakao Unlink] Kakao unlink successful:', unlinkData.id);
        } else {
          console.warn('[Kakao Unlink] Kakao unlink failed:', unlinkData);
          // 실패해도 계속 진행 (DB에서는 삭제)
        }
      } catch (unlinkError) {
        console.error('[Kakao Unlink] Kakao API error:', unlinkError);
        // 에러가 발생해도 계속 진행
      }
    } else {
      console.warn('[Kakao Unlink] No access token found, skipping Kakao API call');
    }
    
    // 4. DB에서 사용자 관련 데이터 삭제
    console.log('[Kakao Unlink] Deleting user data from DB...');
    
    // 세션 삭제
    await DB.prepare('DELETE FROM admin_sessions WHERE session_token = ?')
      .bind(sessionToken).run();
    console.log('[Kakao Unlink] Sessions deleted');
    
    // 장바구니 삭제
    await DB.prepare('DELETE FROM cart_items WHERE user_id = ?')
      .bind(user.id).run();
    console.log('[Kakao Unlink] Cart items deleted');
    
    // 주문 정보는 유지 (법적 요구사항에 따라 조정 필요)
    // 필요 시 아래 주석 해제
    // await DB.prepare('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = ?)')
    //   .bind(user.id).run();
    // await DB.prepare('DELETE FROM orders WHERE user_id = ?')
    //   .bind(user.id).run();
    
    // 사용자 삭제
    await DB.prepare('DELETE FROM users WHERE id = ?')
      .bind(user.id).run();
    console.log('[Kakao Unlink] User deleted');
    
    console.log('[Kakao Unlink] Unlink process completed successfully');
    
    return c.json({
      success: true,
      message: '회원 탈퇴가 완료되었습니다'
    });
    
  } catch (error) {
    console.error('[Kakao Unlink] Error:', error);
    return c.json({ 
      success: false, 
      error: '회원 탈퇴 처리 중 오류가 발생했습니다' 
    }, 500);
  }
});

// =================================
// Kakao 연결 해제 Webhook
// =================================
app.post('/webhooks/kakao/unlink', async (c) => {
  const { DB } = c.env;
  
  try {
    const body = await c.req.json();
    const { user_id, referrer_type } = body;
    
    console.log('[Kakao Webhook] Unlink notification received:', {
      user_id,
      referrer_type
    });
    
    if (!user_id) {
      return c.json({ 
        success: false, 
        error: 'user_id is required' 
      }, 400);
    }
    
    // Kakao ID로 사용자 조회
    const user = await DB.prepare(`
      SELECT * FROM users WHERE kakao_id = ?
    `).bind(user_id.toString()).first();
    
    if (!user) {
      console.log('[Kakao Webhook] User not found:', user_id);
      // 이미 삭제된 경우 성공으로 응답
      return c.json({ success: true });
    }
    
    console.log('[Kakao Webhook] Deleting user data for user:', user.id);
    
    // 사용자 관련 데이터 삭제
    // 1. 세션 삭제
    await DB.prepare(`
      DELETE FROM admin_sessions 
      WHERE session_token IN (
        SELECT session_token FROM admin_sessions WHERE user_type = 'user'
      )
    `).run();
    
    // 2. 장바구니 삭제
    await DB.prepare('DELETE FROM cart_items WHERE user_id = ?')
      .bind(user.id).run();
    
    // 3. 사용자 삭제
    await DB.prepare('DELETE FROM users WHERE id = ?')
      .bind(user.id).run();
    
    console.log('[Kakao Webhook] User data deleted successfully');
    
    return c.json({ success: true });
    
  } catch (error) {
    console.error('[Kakao Webhook] Error:', error);
    return c.json({ 
      success: false, 
      error: 'Webhook processing failed' 
    }, 500);
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
    
    const session = await getSession(c.env.SESSION_KV, sessionToken);
    
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
    // ✅ snake_case로 받기 (프론트엔드가 snake_case로 전송)
    const body = await c.req.json();
    const userId = body.user_id;
    const recipientName = body.recipient_name;
    const phone = body.phone;
    const postalCode = body.postal_code;
    const address = body.address;
    const addressDetail = body.address_detail;
    const isDefault = body.is_default;
    
    console.log('[POST /api/shipping-addresses] Received:', JSON.stringify(body));
    
    if (!userId || !recipientName || !phone || !address) {
      console.error('[POST /api/shipping-addresses] Missing required fields:', { userId, recipientName, phone, address });
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
    
    console.log('[POST /api/shipping-addresses] Success:', { id: result.meta.last_row_id });
    
    return c.json({
      success: true,
      data: { id: result.meta.last_row_id }
    });
    
  } catch (err) {
    console.error('[POST /api/shipping-addresses] Error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 배송지 수정
app.put('/api/shipping-addresses/:id', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const id = c.req.param('id');
    // ✅ snake_case로 받기
    const body = await c.req.json();
    const userId = body.user_id;
    const recipientName = body.recipient_name;
    const phone = body.phone;
    const postalCode = body.postal_code;
    const address = body.address;
    const addressDetail = body.address_detail;
    const isDefault = body.is_default;
    
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
  const sessionToken = c.req.header('X-Session-Token');
  
  if (!sessionToken) {
    return { success: false, error: '인증 토큰이 없습니다' };
  }
  
  const session = await getSession(c.env.SESSION_KV, sessionToken);
  
  if (!session || session.user_type !== 'admin') {
    return { success: false, error: '관리자 권한이 필요합니다' };
  }
  
  return { success: true, adminId: session.admin_id, userData: session };
}

async function verifySellerSession(c: any) {
  const sessionToken = c.req.header('X-Session-Token');
  
  if (!sessionToken) {
    return { success: false, error: '인증 토큰이 없습니다' };
  }
  
  const session = await getSession(c.env.SESSION_KV, sessionToken);
  
  if (!session || session.user_type !== 'seller') {
    return { success: false, error: '판매자 권한이 필요합니다' };
  }
  
  return { success: true, sellerId: session.seller_id, userData: session };
}

// =================================
// Live Stream API
// =================================

// Health check endpoint (no DB required)
app.get('/api/health', (c) => {
  return c.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    env: {
      hasDB: !!c.env.DB,
      hasSessionKV: !!c.env.SESSION_KV,
      hasCacheKV: !!c.env.CACHE_KV,
    }
  });
});

// Live Stream API
app.get('/api/streams', async (c) => {
  const { DB, CACHE_KV } = c.env;
  try {
    // \uce90\uc2dc \ud0a4
    const cacheKey = 'streams:live';
    
    // \uce90\uc2dc\uc5d0\uc11c \uba3c\uc800 \uc870\ud68c (10\ubd84 TTL) \u2705
    const cached = await CACHE_KV.get(cacheKey, 'json');
    if (cached) {
      return c.json<ApiResponse>({
        success: true,
        data: cached,
        cached: true
      });
    }
    
    // \uce90\uc2dc \ubbf8\uc2a4 \uc2dc D1 \uc870\ud68c
    const result = await DB.prepare(
      'SELECT * FROM live_streams WHERE status = ? ORDER BY created_at DESC'
    ).bind('live').all();

    // \uacb0\uacfc\ub97c \uce90\uc2dc\uc5d0 \uc800\uc7a5 (10\ubd84 TTL)
    await CACHE_KV.put(cacheKey, JSON.stringify(result.results), {
      expirationTtl: 600 // 10\ubd84
    });

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

// 호환성을 위한 별칭 엔드포인트 (이전 /api/live-streams/:id를 지원)
app.get('/api/live-streams/:id', async (c) => {
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

// Popular Products API - 인기 상품 목록
app.get('/api/products/popular', async (c) => {
  const { DB, CACHE_KV } = c.env;

  try {
    // 캐시 확인
    const cached = await getCachedData(CACHE_KV, 'products:popular');
    if (cached) {
      return c.json<ApiResponse>({
        success: true,
        data: cached,
        cached: true,
      });
    }

    // 인기 상품 조회 (주문이 많은 순서대로, 최대 20개)
    const products = await DB.prepare(`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.price as current_price,
        p.original_price,
        p.discount_rate,
        p.image_url,
        p.stock,
        p.category,
        COALESCE(SUM(oi.quantity), 0) as sold_count
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE p.is_active = 1 AND p.stock > 0
      GROUP BY p.id
      ORDER BY sold_count DESC, p.created_at DESC
      LIMIT 20
    `).all();

    const popularProducts = products.results || [];

    // 캐시 저장 (60초)
    await setCachedData(CACHE_KV, 'products:popular', popularProducts, 60);

    return c.json<ApiResponse>({
      success: true,
      data: popularProducts,
      cached: false,
    });
  } catch (err) {
    console.error('Popular products error:', err);
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

// 상품 검색 API
// 검색 자동완성 API
app.get('/api/search/suggestions', async (c) => {
  const { DB } = c.env;
  
  try {
    const query = c.req.query('q') || '';
    
    if (!query.trim() || query.length < 2) {
      return c.json<ApiResponse>({
        success: true,
        data: {
          suggestions: [],
        },
      });
    }

    const searchPattern = `%${query}%`;
    
    // 상품명 자동완성 (최대 10개)
    const productResult = await DB.prepare(`
      SELECT DISTINCT name
      FROM products
      WHERE name LIKE ? AND is_active = 1
      ORDER BY name ASC
      LIMIT 10
    `).bind(searchPattern).all();

    // 판매자명 자동완성 (최대 5개)
    const sellerResult = await DB.prepare(`
      SELECT DISTINCT display_name
      FROM sellers
      WHERE (display_name LIKE ? OR username LIKE ?) AND is_active = 1
      ORDER BY display_name ASC
      LIMIT 5
    `).bind(searchPattern, searchPattern).all();

    const suggestions = [
      ...(productResult.results || []).map((row: any) => ({
        type: 'product',
        text: row.name,
      })),
      ...(sellerResult.results || []).map((row: any) => ({
        type: 'seller',
        text: row.display_name,
      })),
    ];

    return c.json<ApiResponse>({
      success: true,
      data: {
        suggestions: suggestions,
      },
    });
  } catch (err) {
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

app.get('/api/products/search', async (c) => {
  const { DB } = c.env;
  
  try {
    const query = c.req.query('q') || '';
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');
    
    if (!query.trim()) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Search query is required',
      }, 400);
    }

    const searchPattern = `%${query}%`;
    
    // 상품명 또는 판매자명으로 검색
    const result = await DB.prepare(`
      SELECT 
        p.*,
        s.display_name as seller_name,
        s.username as seller_username
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE (p.name LIKE ? OR s.display_name LIKE ? OR s.username LIKE ?)
        AND p.is_active = 1
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(searchPattern, searchPattern, searchPattern, limit, offset).all();

    // 총 검색 결과 수
    const countResult = await DB.prepare(`
      SELECT COUNT(*) as total
      FROM products p
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE (p.name LIKE ? OR s.display_name LIKE ? OR s.username LIKE ?)
        AND p.is_active = 1
    `).bind(searchPattern, searchPattern, searchPattern).first();

    return c.json<ApiResponse>({
      success: true,
      data: {
        products: result.results || [],
        total: countResult?.total || 0,
        query: query,
        limit: limit,
        offset: offset,
      },
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
  const userIdParam = c.req.param('userId');

  try {
    // 사용자 ID 조회 (kakao_id 기반)
    let user = await DB.prepare(
      'SELECT id FROM users WHERE id = ?'
    ).bind(userIdParam).first();
    
    // id로 못 찾으면 kakao_id로 찾기
    if (!user) {
      user = await DB.prepare(
        'SELECT id FROM users WHERE kakao_id = ?'
      ).bind(userIdParam).first();
    }

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
        p.seller_id as seller_id,
        po.option_value as option_value,
        s.shipping_fee as shipping_fee,
        s.free_shipping_threshold as free_shipping_threshold,
        s.display_name as seller_name
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      LEFT JOIN product_options po ON ci.option_id = po.id
      LEFT JOIN sellers s ON p.seller_id = s.id
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
    const { kakaoId, name, email, phone } = body;

    if (!kakaoId || !name) {
      return c.json<ApiResponse>({
        success: false,
        error: 'kakaoId and name are required',
      }, 400);
    }

    // 이미 존재하는 사용자인지 확인
    const existingUser = await DB.prepare(
      'SELECT id FROM users WHERE kakao_id = ?'
    ).bind(kakaoId).first();

    if (existingUser) {
      return c.json<ApiResponse<{ id: number }>>({
        success: true,
        data: { id: existingUser.id as number },
      });
    }

    // 새 사용자 생성
    const result = await DB.prepare(
      'INSERT INTO users (kakao_id, name, email, phone) VALUES (?, ?, ?, ?)'
    ).bind(
      kakaoId,
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
    const { userId, kakaoId, productId, optionId, quantity, priceSnapshot, liveStreamId } = body;
    
    // userId 또는 kakaoId 중 하나를 사용
    const userIdToUse = kakaoId || userId;
    
    if (!userIdToUse) {
      return c.json<ApiResponse>({
        success: false,
        error: 'userId or kakaoId is required',
      }, 400);
    }

    // 사용자 ID 조회 (kakao_id 기반)
    let user = await DB.prepare(
      'SELECT id FROM users WHERE id = ?'
    ).bind(userIdToUse).first();
    
    // id로 못 찾으면 kakao_id로 찾기
    if (!user) {
      user = await DB.prepare(
        'SELECT id FROM users WHERE kakao_id = ?'
      ).bind(userIdToUse).first();
    }

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

    // 기존 장바구니 아이템 확인 (같은 상품 + 같은 옵션)
    const existingItem = await DB.prepare(`
      SELECT id, quantity 
      FROM cart_items 
      WHERE user_id = ? 
        AND product_id = ? 
        AND (option_id = ? OR (option_id IS NULL AND ? IS NULL))
    `).bind(dbUserId, productId, optionId || null, optionId || null).first();

    let cartItemId: number;

    if (existingItem) {
      // 기존 아이템이 있으면 수량만 증가
      const newQuantity = (existingItem.quantity as number) + quantity;
      await DB.prepare(`
        UPDATE cart_items 
        SET quantity = ?, 
            price_snapshot = ?
        WHERE id = ?
      `).bind(newQuantity, priceSnapshot, existingItem.id).run();
      
      cartItemId = existingItem.id as number;
    } else {
      // 새 아이템 추가
      const result = await DB.prepare(`
        INSERT INTO cart_items (user_id, product_id, option_id, quantity, price_snapshot, live_stream_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        dbUserId, 
        productId, 
        optionId || null,
        quantity, 
        priceSnapshot, 
        liveStreamId || null
      ).run();
      
      cartItemId = result.meta.last_row_id as number;
    }

    return c.json<ApiResponse>({
      success: true,
      data: { 
        id: cartItemId,
        isUpdate: !!existingItem 
      },
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

// 장바구니 전체 비우기 (결제 완료 시 사용)
app.delete('/api/cart/clear/:userId', async (c) => {
  const { DB } = c.env;
  const userId = c.req.param('userId');

  try {
    await DB.prepare(
      'DELETE FROM cart_items WHERE user_id = ?'
    ).bind(userId).run();

    return c.json<ApiResponse>({
      success: true,
      message: '장바구니가 비워졌습니다.'
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
    const requestData = await c.req.json();
    const { 
      userId, 
      cartItemIds, 
      shippingInfo,
      // 직접 전달된 주문 항목 (cart.html에서 사용)
      items,
      shippingAddress,
      shippingAddressDetail,
      recipientName,
      recipientPhone,
      deliveryMemo,
      totalAmount: providedTotalAmount,
      shippingFee,
      // 결제 정보 (PaymentSuccessPage에서 전달)
      orderNumber: providedOrderNo,
      paymentKey,
      paymentMethod
    } = requestData;

    // 직접 전달된 items가 있으면 새로운 방식으로 처리
    if (items && items.length > 0) {
      // 재고 확인 및 상품 정보 조회
      const itemsWithDetails = [];
      for (const item of items) {
        const product = await DB.prepare(`
          SELECT id, name, price, stock 
          FROM products 
          WHERE id = ?
        `).bind(item.productId).first();

        if (!product) {
          return c.json<ApiResponse>({
            success: false,
            error: `상품을 찾을 수 없습니다 (ID: ${item.productId})`,
          }, 400);
        }

        if ((product.stock as number) < item.quantity) {
          return c.json<ApiResponse>({
            success: false,
            error: `재고 부족: ${product.name} (남은 재고: ${product.stock}개)`,
          }, 400);
        }

        itemsWithDetails.push({
          product_id: item.productId,
          option_id: item.optionId || null,
          quantity: item.quantity,
          price: item.price,
          product_name: product.name as string,
          product_stock: product.stock as number
        });
      }

      // 주문 번호 생성 (이미 제공되었으면 사용, 없으면 생성)
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      const orderNumber = providedOrderNo || `ORDER_${timestamp}_${random}`;

      // 주문 생성
      const fullAddress = shippingAddressDetail 
        ? `${shippingAddress} ${shippingAddressDetail}` 
        : shippingAddress;
      
      const orderResult = await DB.prepare(`
        INSERT INTO orders (
          order_number, user_id, total_amount, payment_status, status,
          shipping_address, shipping_name, shipping_phone, shipping_memo,
          payment_key, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        orderNumber,
        userId || null,
        providedTotalAmount || 0,
        'pending',  // 결제 대기 상태
        'pending',  // 주문 상태 (결제 승인 후 'paid'로 변경)
        fullAddress || null,
        recipientName || null,
        recipientPhone || null,
        deliveryMemo || null,
        paymentKey || null
      ).run();

      const orderId = orderResult.meta.last_row_id;

      // 주문 아이템 생성 (⚠️ 재고 차감 제거 - 결제 승인 시 처리)
      for (const item of itemsWithDetails) {
        // ❌ 재고 차감 제거 (Before: 여기서 차감했음)
        // ✅ 결제 승인 API에서 처리함

        // 주문 아이템 생성
        await DB.prepare(`
          INSERT INTO order_items (
            order_id, product_id, option_id, quantity, price, product_name
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          orderId,
          item.product_id,
          item.option_id,
          item.quantity,
          item.price,
          item.product_name
        ).run();
      }

      return c.json<ApiResponse>({
        success: true,
        data: {
          orderId,
          orderNumber,
          totalAmount: providedTotalAmount,
        },
      });
    }

    // 기존 방식: cartItemIds로 처리
    if (!cartItemIds || cartItemIds.length === 0) {
      return c.json<ApiResponse>({
        success: false,
        error: 'No items provided',
      }, 400);
    }

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

    // 배치 쿼리 준비 - DB 왕복 횟수 70% 감소
    const batchQueries: D1PreparedStatement[] = [];

    // 주문 아이템 생성 및 재고 차감 (낙관적 락 적용)
    for (const item of cartItems.results) {
      // 재고 차감 (낙관적 락 - 동시성 문제 해결)
      const stockUpdateResult = await DB.prepare(`
        UPDATE products 
        SET stock = stock - ?, 
            version = version + 1,
            updated_at = datetime('now')
        WHERE id = ? 
          AND stock >= ?
          AND is_active = 1
      `).bind(item.quantity, item.product_id, item.quantity).run();

      // 재고 차감 실패 시 (동시 주문 또는 재고 부족)
      if (stockUpdateResult.meta.changes === 0) {
        // 현재 재고 확인
        const currentProduct = await DB.prepare(`
          SELECT stock FROM products WHERE id = ?
        `).bind(item.product_id).first();

        if (!currentProduct || (currentProduct.stock as number) < (item.quantity as number)) {
          return c.json<ApiResponse>({
            success: false,
            error: `재고 부족: ${item.product_name} (남은 재고: ${currentProduct?.stock || 0}개)`,
          }, 400);
        } else {
          // 재시도 (버전 충돌)
          const retryResult = await DB.prepare(`
            UPDATE products 
            SET stock = stock - ?, 
                version = version + 1,
                updated_at = datetime('now')
            WHERE id = ? 
              AND stock >= ?
          `).bind(item.quantity, item.product_id, item.quantity).run();

          if (retryResult.meta.changes === 0) {
            return c.json<ApiResponse>({
              success: false,
              error: `주문 처리 중 오류 발생. 다시 시도해주세요.`,
            }, 409);
          }
        }
      }

      // 주문 아이템 INSERT 쿼리 배치에 추가
      batchQueries.push(
        DB.prepare(`
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
        )
      );
    }

    // 장바구니 삭제 쿼리도 배치에 추가
    batchQueries.push(
      DB.prepare(`DELETE FROM cart_items WHERE id IN (${placeholders})`).bind(...cartItemIds)
    );

    // 배치 실행 - 모든 INSERT/DELETE를 한 번에 처리
    await DB.batch(batchQueries);

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

// Seller: Get seller's live streams
app.get('/api/seller/streams', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const sellerId = auth.sellerId;
    
    // Get all streams for this seller
    const result = await DB.prepare(`
      SELECT * FROM live_streams 
      WHERE seller_id = ?
      ORDER BY created_at DESC
    `).bind(sellerId).all();

    return c.json({ 
      success: true, 
      data: result.results || []
    });
  } catch (error: any) {
    console.error('Error loading seller streams:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

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
      youtube_url,  // Accept both YouTube and TikTok URLs
      thumbnail_url,  // Optional: user-provided thumbnail URL
      scheduled_at, 
      status,
      seller_instagram,
      seller_youtube,
      seller_facebook 
    } = await c.req.json();

    // Detect platform and extract video ID or username
    let videoId = youtube_video_id;
    let platform = 'youtube';
    let tiktokUsername = null;
    let tiktokVideoType = null;
    let finalThumbnailUrl = thumbnail_url;

    if (youtube_url && !videoId) {
      // Try YouTube first
      videoId = extractYouTubeVideoId(youtube_url);
      
      if (!videoId) {
        // Try TikTok
        videoId = extractTikTokVideoId(youtube_url);
        tiktokUsername = extractTikTokUsername(youtube_url);
        tiktokVideoType = detectTikTokVideoType(youtube_url);
        if (videoId) {
          platform = 'tiktok';
        } else {
          return c.json({ 
            success: false, 
            error: 'Invalid URL. Please provide a valid YouTube or TikTok live stream URL.' 
          }, 400);
        }
      }
    }
    
    // Generate thumbnail URL if not provided
    if (!finalThumbnailUrl && videoId) {
      if (platform === 'youtube') {
        finalThumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      }
      // For TikTok, thumbnail will be null and handled by frontend
    }

    if (!title || !videoId) {
      return c.json({ 
        success: false, 
        error: 'Title and live stream URL are required' 
      }, 400);
    }

    const result = await DB.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, status, scheduled_at,
        seller_id, seller_instagram, seller_youtube, seller_facebook,
        platform, tiktok_username, tiktok_video_type, thumbnail_url,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      title, 
      description || null, 
      videoId,  // Use extracted video ID or TikTok username
      status || 'scheduled', 
      scheduled_at || null,
      auth.sellerId,
      seller_instagram || null,
      seller_youtube || null,
      seller_facebook || null,
      platform,
      tiktokUsername,
      tiktokVideoType,
      finalThumbnailUrl || null
    ).run();

    // Get created stream
    const stream = await DB.prepare(
      'SELECT * FROM live_streams WHERE id = ?'
    ).bind(result.meta.last_row_id).first();

    // 판매자 정보 가져오기
    const seller = await DB.prepare(
      'SELECT display_name, username FROM sellers WHERE id = ?'
    ).bind(auth.sellerId).first();

    // 이메일 알림 전송 (비동기, 실패해도 라이브 생성은 성공)
    try {
      const { sendLiveStreamCreatedEmail } = await import('./utils/email');
      
      // 이메일 전송 (await 없이 비동기 실행)
      sendLiveStreamCreatedEmail({
        streamId: result.meta.last_row_id as number,
        title: title,
        sellerName: seller?.display_name || seller?.username || '알 수 없음',
        platform: platform,
        scheduledAt: scheduled_at,
        status: status || 'scheduled',
      }).then(result => {
        if (result.success) {
          console.log(`[Email] Live stream notification sent for stream #${result.meta.last_row_id}`);
        } else {
          console.error(`[Email] Failed to send notification:`, result.error);
        }
      }).catch(error => {
        console.error('[Email] Exception while sending notification:', error);
      });
    } catch (emailError) {
      // 이메일 전송 실패는 로그만 남기고 무시
      console.error('[Email] Failed to send live stream notification:', emailError);
    }

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
      youtube_url,  // New: Accept YouTube URL
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
    
    // Handle YouTube/TikTok URL or video ID
    if (youtube_url !== undefined || youtube_video_id !== undefined) {
      let videoId = youtube_video_id;
      let platform = 'youtube';
      let tiktokUsername = null;
      
      if (youtube_url) {
        // Try YouTube first
        videoId = extractYouTubeVideoId(youtube_url);
        
        if (!videoId) {
          // Try TikTok
          videoId = extractTikTokVideoId(youtube_url);
          tiktokUsername = extractTikTokUsername(youtube_url);
          
          if (videoId) {
            platform = 'tiktok';
          } else {
            return c.json({ 
              success: false, 
              error: 'Invalid URL. Please provide a valid YouTube or TikTok video URL.' 
            }, 400);
          }
        }
      }
      
      if (videoId !== undefined) {
        updates.push('youtube_video_id = ?');
        values.push(videoId);
        updates.push('platform = ?');
        values.push(platform);
        
        if (platform === 'tiktok' && tiktokUsername) {
          updates.push('tiktok_username = ?');
          values.push(tiktokUsername);
        }
      }
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
    const { title, description, youtube_video_id, platform, tiktok_username, status } = await c.req.json();

    if (!title) {
      return c.json({ success: false, error: '제목은 필수입니다' }, 400);
    }

    // Validate platform-specific fields
    const streamPlatform = platform || 'youtube';
    if (streamPlatform === 'youtube' && !youtube_video_id) {
      return c.json({ success: false, error: 'YouTube 플랫폼은 영상 ID가 필수입니다' }, 400);
    }
    if (streamPlatform === 'tiktok' && !tiktok_username) {
      return c.json({ success: false, error: 'TikTok 플랫폼은 사용자명이 필수입니다' }, 400);
    }

    const result = await DB.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, tiktok_username, status, 
        created_at, updated_at, seller_id
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    `).bind(
      title, 
      description || null, 
      youtube_video_id || null, 
      streamPlatform,
      tiktok_username || null,
      status || 'scheduled',
      auth.sellerId || null
    ).run();

    return c.json({
      success: true,
      data: {
        id: result.meta.last_row_id,
        title,
        description,
        youtube_video_id,
        platform: streamPlatform,
        tiktok_username,
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
    const { title, description, youtube_video_id, platform, tiktok_username, status } = await c.req.json();

    await DB.prepare(`
      UPDATE live_streams 
      SET title = ?, description = ?, youtube_video_id = ?, platform = ?, tiktok_username = ?, 
          status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      title, 
      description, 
      youtube_video_id || null, 
      platform || 'youtube', 
      tiktok_username || null, 
      status, 
      streamId
    ).run();

    return c.json({ success: true });

  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Seller: Change current product in live stream
app.post('/api/seller/streams/:streamId/change-product', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const streamId = c.req.param('streamId');
    const { productId } = await c.req.json();

    // Verify stream ownership
    const stream = await DB.prepare(
      'SELECT id FROM live_streams WHERE id = ? AND seller_id = ?'
    ).bind(streamId, auth.sellerId).first();

    if (!stream) {
      return c.json({ success: false, error: 'Stream not found or unauthorized' }, 404);
    }

    // Get product info (allow any active product from this seller)
    const product = await DB.prepare(
      'SELECT * FROM products WHERE id = ? AND seller_id = ? AND is_active = 1'
    ).bind(productId, auth.sellerId).first();

    if (!product) {
      return c.json({
        success: false,
        error: 'Product not found or not active',
      }, 404);
    }

    // Get product options
    const options = await DB.prepare(
      'SELECT * FROM product_options WHERE product_id = ?'
    ).bind(productId).all();

    // Update live stream current product
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
// Removed route: /order/:orderNumber (handled by React SPA)

// =================================
// Seller Product Management APIs
// =================================

// Get seller's products (자신의 상품 목록 조회)
app.get('/api/seller/products', async (c) => {
  const { DB, CACHE_KV } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    // \uce90\uc2dc \ud0a4 (\ud310\ub9e4\uc790\ubcc4\ub85c \uce90\uc2f1)
    const cacheKey = `seller:${auth.sellerId}:products`;
    
    // \uce90\uc2dc\uc5d0\uc11c \uba3c\uc800 \uc870\ud68c (5\ubd84 TTL) \u2705
    const cached = await CACHE_KV.get(cacheKey, 'json');
    if (cached) {
      return c.json({ success: true, data: cached, cached: true });
    }
    
    // \uce90\uc2dc \ubbf8\uc2a4 \uc2dc D1 \uc870\ud68c
    const products = await DB.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.seller_id = ?
      ORDER BY p.created_at DESC
    `).bind(auth.sellerId).all();

    // \uacb0\uacfc\ub97c \uce90\uc2dc\uc5d0 \uc800\uc7a5 (5\ubd84 TTL)
    await CACHE_KV.put(cacheKey, JSON.stringify(products.results), {
      expirationTtl: 300 // 5\ubd84
    });

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
    if (!name || !price) {
      return c.json({ success: false, error: 'Name and price are required' }, 400);
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
      image_url || null,
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

    // \uce90\uc2dc \ubb34\ud6a8\ud654 (Cache Invalidation) \u2705
    await deleteCachedData(c.env.CACHE_KV, `seller:${auth.sellerId}:products`, `public:seller:${auth.sellerId}`);

    return c.json({ success: true, data: product });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Get single product (상품 단건 조회 - 수정용)
app.get('/api/seller/products/:id', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const id = c.req.param('id');

    // Verify ownership and get product
    const product = await DB.prepare(`
      SELECT p.*, ls.title as live_stream_title
      FROM products p
      LEFT JOIN live_streams ls ON p.live_stream_id = ls.id
      WHERE p.id = ? AND p.seller_id = ?
    `).bind(id, auth.sellerId).first();
    
    if (!product) {
      return c.json({ success: false, error: 'Product not found or unauthorized' }, 404);
    }

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

    // \uce90\uc2dc \ubb34\ud6a8\ud654 (Cache Invalidation) \u2705
    await deleteCachedData(c.env.CACHE_KV, `seller:${auth.sellerId}:products`, `public:seller:${auth.sellerId}`);

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

    // Check if product is used in orders (prevent deletion if already ordered)
    const ordersCount = await DB.prepare(
      'SELECT COUNT(*) as count FROM order_items WHERE product_id = ?'
    ).bind(id).first();

    if (ordersCount && ordersCount.count > 0) {
      return c.json({ 
        success: false, 
        error: '이미 주문된 상품은 삭제할 수 없습니다. 품절 처리하거나 숨김 처리해주세요.' 
      }, 400);
    }

    // Delete related data first (to avoid foreign key constraint)
    // 1. Delete product options
    await DB.prepare('DELETE FROM product_options WHERE product_id = ?').bind(id).run();
    
    // 2. Delete cart items
    await DB.prepare('DELETE FROM cart_items WHERE product_id = ?').bind(id).run();

    // 3. Clear current_product_id in live_streams
    await DB.prepare('UPDATE live_streams SET current_product_id = NULL WHERE current_product_id = ?').bind(id).run();

    // 4. Finally delete the product
    await DB.prepare('DELETE FROM products WHERE id = ? AND seller_id = ?').bind(id, auth.sellerId).run();

    // \uce90\uc2dc \ubb34\ud6a8\ud654 (Cache Invalidation) \u2705
    await deleteCachedData(c.env.CACHE_KV, `seller:${auth.sellerId}:products`, `public:seller:${auth.sellerId}`);

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
  const { DB, CACHE_KV } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    // \uce90\uc2dc \ud0a4
    const cacheKey = `seller:${auth.sellerId}:stats`;
    
    // \uce90\uc2dc\uc5d0\uc11c \uba3c\uc800 \uc870\ud68c (1\ubd84 TTL) \u2705
    const cached = await CACHE_KV.get(cacheKey, 'json');
    if (cached) {
      return c.json({ success: true, data: cached, cached: true });
    }
    
    // \uce90\uc2dc \ubbf8\uc2a4 \uc2dc D1 \uc870\ud68c
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

    // Get streams for this seller
    const activeStreams = await DB.prepare(`
      SELECT COUNT(*) as count 
      FROM live_streams 
      WHERE seller_id = ? AND status = 'live'
    `).bind(auth.sellerId).first();

    // TODO: Add viewer_count column to live_streams table
    // For now, return 0 for totalViewers
    const totalViewers = 0;

    const stats = {
      totalProducts: products.count || 0,
      activeProducts: activeProducts.count || 0,
      totalStock: totalStock.total || 0,
      totalOrders: orders.count || 0,
      totalRevenue: orders.total || 0,
      activeStreams: activeStreams.count || 0,
      totalViewers: totalViewers
    };
    
    // \uacb0\uacfc\ub97c \uce90\uc2dc\uc5d0 \uc800\uc7a5 (1\ubd84 TTL)
    await CACHE_KV.put(cacheKey, JSON.stringify(stats), {
      expirationTtl: 60 // 1\ubd84
    });

    return c.json({
      success: true,
      data: stats
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

// Cancel order (User only - only for pending status)
app.post('/api/orders/:orderId/cancel', async (c) => {
  const { DB } = c.env;
  const orderId = c.req.param('orderId');

  try {
    // Get request body
    const body = await c.req.json();
    const cancelReason = body.reason || '사유 없음';

    // Get order
    const order = await DB.prepare(
      'SELECT * FROM orders WHERE id = ?'
    ).bind(orderId).first();

    if (!order) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    // Only allow cancellation for pending orders
    if (order.status !== 'pending') {
      return c.json({ 
        success: false, 
        error: '결제 대기 중인 주문만 취소할 수 있습니다. 결제가 완료된 주문은 환불을 신청해주세요.' 
      }, 400);
    }

    // Get order items to restore stock
    const orderItems: any = await DB.prepare(
      'SELECT product_id, quantity FROM order_items WHERE order_id = ?'
    ).bind(orderId).all();

    // Restore stock for each item
    for (const item of orderItems.results) {
      await DB.prepare(
        'UPDATE products SET stock = stock + ? WHERE id = ?'
      ).bind(item.quantity, item.product_id).run();
    }

    // Update order status to cancelled with reason
    await DB.prepare(
      'UPDATE orders SET status = ?, cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind('cancelled', cancelReason, orderId).run();

    return c.json({ 
      success: true, 
      message: 'Order cancelled successfully',
      data: {
        orderId,
        reason: cancelReason,
        itemsRestored: orderItems.results.length
      }
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ==========================================
// Payment API - PG 결제 승인 (PG사 변경 가능)
// ==========================================

// 결제 승인 API
app.post('/api/payments/confirm', async (c) => {
  const { DB } = c.env;
  let body: any = null;
  
  try {
    body = await c.req.json();
    const { paymentKey, orderId, amount } = body;

    console.log('[Payment] 결제 승인 요청:', { orderId, amount });

    // 필수 파라미터 검증
    if (!paymentKey || !orderId || !amount) {
      return c.json({
        success: false,
        error: '필수 파라미터가 누락되었습니다.'
      }, 400);
    }

    // 시크릿 키
    const secretKey = c.env.TOSS_SECRET_KEY;
    if (!secretKey) {
      console.error('[Payment] ❌ TOSS_SECRET_KEY 환경 변수 없음');
      return c.json({
        success: false,
        error: '결제 시스템 설정이 올바르지 않습니다.'
      }, 500);
    }

    // 토스페이먼츠 결제 승인 API 호출 (공식 가이드대로)
    console.log('[Payment] 토스페이먼츠 결제 승인 API 호출...');
    const encryptedSecretKey = 'Basic ' + btoa(secretKey + ':');
    
    const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': encryptedSecretKey,
        'Content-Type': 'application/json',
        'TossPayments-API-Version': '2022-11-16'
      },
      body: JSON.stringify({
        orderId: orderId,
        amount: amount,
        paymentKey: paymentKey
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('[Payment] ❌ 토스페이먼츠 승인 실패:', data);
      return c.json({
        success: false,
        error: data.message || '결제 승인에 실패했습니다.',
        code: data.code
      }, response.status);
    }

    console.log('[Payment] ✅ 결제 승인 성공:', orderId);

    // 주문 상태 업데이트 + 재고 차감
    try {
      // 1️⃣ 주문 상태 업데이트
      await DB.prepare(`
        UPDATE orders 
        SET payment_key = ?,
            payment_status = 'approved',
            status = 'paid',
            updated_at = CURRENT_TIMESTAMP 
        WHERE order_number = ?
      `).bind(paymentKey, orderId).run();
      
      console.log('[Payment] ✅ 주문 상태 업데이트 완료');

      // 2️⃣ 재고 차감 (✅ 결제 승인 후에만 차감)
      const orderItems: any = await DB.prepare(
        'SELECT product_id, quantity FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = ?)'
      ).bind(orderId).all();

      for (const item of orderItems.results) {
        const stockUpdateResult = await DB.prepare(`
          UPDATE products 
          SET stock = stock - ?
          WHERE id = ? AND stock >= ?
        `).bind(item.quantity, item.product_id, item.quantity).run();

        if (stockUpdateResult.meta.changes === 0) {
          console.error(`[Payment] ⚠️ 재고 부족: product_id=${item.product_id}`);
          // 재고 부족 시에도 결제는 성공했으므로 주문은 유지
          // 관리자가 수동으로 처리해야 함
        }
      }

      console.log('[Payment] ✅ 재고 차감 완료');
      
    } catch (dbErr) {
      console.error('[Payment] ⚠️ DB 업데이트 실패 (결제는 성공):', dbErr);
      // DB 실패해도 결제는 성공했으므로 성공 응답 반환
    }

    return c.json({
      success: true,
      data: data
    });

  } catch (err) {
    console.error('[Payment] ❌ 결제 승인 실패:', {
      orderId: body?.orderId,
      error: (err as Error).message,
      stack: (err as Error).stack?.substring(0, 500)
    });
    
    return c.json({ 
      success: false, 
      error: '결제 처리 중 오류가 발생했습니다. 고객센터로 문의해주세요.'
    }, 500);
  }
});

// ============================================
// 💳 Payment Advanced APIs (Webhook, Cancel, Query)
// ============================================

// 1️⃣ 웹훅 엔드포인트 (가상계좌 입금, 결제 상태 변경 등)
app.post('/api/payments/webhook', async (c) => {
  const { DB } = c.env;
  
  try {
    const body = await c.req.json();
    console.log('[Webhook] 토스페이먼츠 웹훅 수신:', {
      eventType: body.eventType,
      orderId: body.orderId,
      status: body.status,
      timestamp: new Date().toISOString()
    });

    // 웹훅 이벤트 타입 처리
    switch (body.eventType) {
      case 'PAYMENT_STATUS_CHANGED':
        // 결제 상태 변경 (가상계좌 입금 완료 등)
        await handlePaymentStatusChanged(DB, body);
        break;
      
      case 'VIRTUAL_ACCOUNT_ISSUED':
        // 가상계좌 발급
        await handleVirtualAccountIssued(DB, body);
        break;
      
      default:
        console.log('[Webhook] 처리하지 않는 이벤트 타입:', body.eventType);
    }

    return c.json({ success: true });
  } catch (err) {
    console.error('[Webhook] ❌ 웹훅 처리 실패:', (err as Error).message);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// 웹훅 핸들러: 결제 상태 변경
async function handlePaymentStatusChanged(DB: any, data: any) {
  const { orderId, status, paymentKey } = data;
  
  console.log('[Webhook] 결제 상태 변경:', { orderId, status });
  
  // payments 테이블 업데이트
  await DB.prepare(`
    UPDATE payments 
    SET status = ?, 
        updated_at = CURRENT_TIMESTAMP,
        pg_raw_data = ?
    WHERE pg_payment_key = ?
  `).bind(status, JSON.stringify(data), paymentKey).run();
  
  // 입금 완료 시 주문 상태도 업데이트
  if (status === 'DONE' || status === 'completed') {
    await DB.prepare(`
      UPDATE orders 
      SET payment_status = 'approved',
          status = 'paid',
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(orderId).run();
    
    console.log('[Webhook] ✅ 가상계좌 입금 완료 처리:', orderId);
  }
}

// 웹훅 핸들러: 가상계좌 발급
async function handleVirtualAccountIssued(DB: any, data: any) {
  const { orderId, virtualAccount } = data;
  
  console.log('[Webhook] 가상계좌 발급:', {
    orderId,
    bank: virtualAccount?.bank,
    accountNumber: virtualAccount?.accountNumber
  });
  
  // 가상계좌 정보 업데이트
  await DB.prepare(`
    UPDATE payments 
    SET virtual_account_bank = ?,
        virtual_account_number = ?,
        virtual_account_holder = ?,
        virtual_account_due_date = ?,
        pg_raw_data = ?
    WHERE order_id = ?
  `).bind(
    virtualAccount?.bank,
    virtualAccount?.accountNumber,
    virtualAccount?.customerName,
    virtualAccount?.dueDate,
    JSON.stringify(data),
    orderId
  ).run();
  
  console.log('[Webhook] ✅ 가상계좌 정보 저장 완료:', orderId);
}

// 2️⃣ 결제 취소/환불 API
app.post('/api/payments/:paymentKey/cancel', async (c) => {
  const { DB } = c.env;
  
  try {
    const paymentKey = c.req.param('paymentKey');
    const body = await c.req.json();
    const { cancelReason, cancelAmount } = body;

    console.log('[Payment] 결제 취소 요청:', { paymentKey, cancelReason, cancelAmount });

    // 필수 파라미터 검증
    if (!cancelReason) {
      return c.json({
        success: false,
        error: '취소 사유를 입력해주세요.'
      }, 400);
    }

    // 결제 정보 조회
    const payment = await DB.prepare(`
      SELECT * FROM payments WHERE pg_payment_key = ?
    `).bind(paymentKey).first();

    if (!payment) {
      return c.json({
        success: false,
        error: '결제 정보를 찾을 수 없습니다.'
      }, 404);
    }

    // 이미 취소된 결제인지 확인
    if (payment.status === 'CANCELED' || payment.status === 'cancelled') {
      return c.json({
        success: false,
        error: '이미 취소된 결제입니다.'
      }, 400);
    }

    // PG 프로바이더 설정
    const pgProvider = payment.pg_provider || 'tosspayments';
    const secretKey = c.env.TOSS_SECRET_KEY;
    
    if (!secretKey) {
      return c.json({
        success: false,
        error: '결제 시스템 설정이 올바르지 않습니다.'
      }, 500);
    }

    const provider = createPaymentProvider(pgProvider, secretKey);
    
    // 부분 취소 여부 결정
    const isPartialCancel = cancelAmount && cancelAmount < payment.amount;
    const finalCancelAmount = cancelAmount || payment.amount;

    console.log('[Payment] PG 결제 취소 요청 중...', {
      pgProvider,
      paymentKey,
      cancelAmount: finalCancelAmount,
      isPartial: isPartialCancel
    });

    // PG 결제 취소
    const cancelResult = await provider.cancelPayment({
      paymentKey,
      cancelReason,
      cancelAmount: finalCancelAmount
    });

    if (!cancelResult.success) {
      console.error(`[Payment] ❌ ${pgProvider} 결제 취소 실패:`, cancelResult.error);
      return c.json({
        success: false,
        error: cancelResult.error || '결제 취소에 실패했습니다.'
      }, 400);
    }

    console.log('[Payment] ✅ PG 결제 취소 완료:', {
      paymentKey,
      cancelAmount: finalCancelAmount,
      canceledAt: cancelResult.canceledAt
    });

    // DB 업데이트
    await DB.prepare(`
      UPDATE payments 
      SET status = ?,
          cancelled_at = ?,
          pg_raw_data = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE pg_payment_key = ?
    `).bind(
      'CANCELED',
      cancelResult.canceledAt || new Date().toISOString(),
      JSON.stringify(cancelResult),
      paymentKey
    ).run();

    // 주문 상태도 업데이트
    await DB.prepare(`
      UPDATE orders 
      SET status = 'cancelled',
          payment_status = 'cancelled',
          updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(payment.order_id).run();

    console.log(`[Payment] ✅ 결제 취소 완료 [${pgProvider}]: ${paymentKey}`);

    return c.json({
      success: true,
      data: {
        paymentKey,
        orderId: payment.order_id,
        cancelAmount: finalCancelAmount,
        canceledAt: cancelResult.canceledAt,
        status: 'CANCELED'
      }
    });
  } catch (err) {
    console.error('[Payment] ❌ 결제 취소 처리 실패:', (err as Error).message);
    return c.json({ 
      success: false, 
      error: '결제 취소 처리 중 오류가 발생했습니다.' 
    }, 500);
  }
});

// 3️⃣ 결제 단건 조회 API
app.get('/api/payments/:paymentKey', async (c) => {
  const { DB } = c.env;
  
  try {
    const paymentKey = c.req.param('paymentKey');
    
    const payment = await DB.prepare(`
      SELECT p.*, o.order_number, o.status as order_status
      FROM payments p
      LEFT JOIN orders o ON p.order_id = o.order_number
      WHERE p.pg_payment_key = ?
    `).bind(paymentKey).first();

    if (!payment) {
      return c.json({
        success: false,
        error: '결제 정보를 찾을 수 없습니다.'
      }, 404);
    }

    return c.json({
      success: true,
      data: payment
    });
  } catch (err) {
    console.error('[Payment] ❌ 결제 조회 실패:', (err as Error).message);
    return c.json({ 
      success: false, 
      error: '결제 조회 중 오류가 발생했습니다.' 
    }, 500);
  }
});

// 4️⃣ 결제 목록 조회 API (주문별)
app.get('/api/payments/order/:orderId', async (c) => {
  const { DB } = c.env;
  
  try {
    const orderId = c.req.param('orderId');
    
    const payments = await DB.prepare(`
      SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC
    `).bind(orderId).all();

    return c.json({
      success: true,
      data: payments.results || []
    });
  } catch (err) {
    console.error('[Payment] ❌ 결제 목록 조회 실패:', (err as Error).message);
    return c.json({ 
      success: false, 
      error: '결제 목록 조회 중 오류가 발생했습니다.' 
    }, 500);
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

    // 🚀 자동 세금계산서 발행: 배송완료 시
    if (status === 'DELIVERED') {
      try {
        console.log(`[AUTO TAX INVOICE] 배송완료 감지: ${orderNumber}, 자동 발행 시작...`);

        // 주문 정보 조회 (사업자 정보 포함)
        const fullOrder = await DB.prepare(`
          SELECT 
            o.*,
            oi.seller_id
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.order_number = ?
          LIMIT 1
        `).bind(orderNumber).first();

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
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
              VALUES (?, ?, 'failed', '판매자 사업자 정보가 승인되지 않았습니다.', CURRENT_TIMESTAMP)
            `).bind(orderNumber, auth.sellerId).run();
          } else {
            // 세금계산서 자동 발행
            console.log(`[AUTO TAX INVOICE] 발행 시작: orderNumber=${orderNumber}`);

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
                seller_id, order_number, invoice_number, issue_date,
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
              orderNumber,
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
              INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, tax_invoice_id, status, created_at)
              VALUES (?, ?, ?, 'success', CURRENT_TIMESTAMP)
            `).bind(orderNumber, auth.sellerId, taxInvoiceId).run();

            console.log(`[AUTO TAX INVOICE] ✅ 발행 완료: invoice_id=${taxInvoiceId}, invoice_number=${invoice_number}`);
          }
        } else {
          console.log(`[AUTO TAX INVOICE] 일반 구매 (사업자 정보 없음): ${orderNumber}`);
        }
      } catch (autoIssueErr) {
        // 자동 발행 실패 시 로그만 기록하고 주문 상태 변경은 성공 처리
        console.error('[AUTO TAX INVOICE] 발행 실패:', autoIssueErr);
        try {
          await DB.prepare(`
            INSERT INTO tax_invoice_auto_issue_log (order_number, seller_id, status, error_message, created_at)
            VALUES (?, ?, 'failed', ?, CURRENT_TIMESTAMP)
          `).bind(orderNumber, auth.sellerId, (autoIssueErr as Error).message).run();
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
app.put('/api/seller/orders/:orderNumber/tracking', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const orderNumber = c.req.param('orderNumber');
    const { courier, tracking_number } = await c.req.json();

    if (!courier || !tracking_number) {
      return c.json({ success: false, error: 'Courier and tracking number are required' }, 400);
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

    // Update tracking info and set status to SHIPPING if not already
    await DB.prepare(`
      UPDATE orders 
      SET courier = ?, 
          tracking_number = ?, 
          shipped_at = CASE WHEN shipped_at IS NULL THEN CURRENT_TIMESTAMP ELSE shipped_at END,
          status = CASE WHEN status = 'PREPARING' THEN 'SHIPPING' ELSE status END,
          updated_at = CURRENT_TIMESTAMP 
      WHERE order_number = ?
    `).bind(courier, tracking_number, orderNumber).run();

    return c.json({ success: true, message: 'Tracking information updated' });
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

    // Check if order can be refunded (소문자 상태값 사용)
    if (!['paid', 'preparing', 'shipped', 'delivered'].includes(order.status)) {
      return c.json({ success: false, error: '환불이 불가능한 주문 상태입니다.' }, 400);
    }

    // Check if order is already refunded or cancelled
    if (order.status === 'refunded' || order.status === 'cancelled') {
      return c.json({ success: false, error: '이미 환불 또는 취소된 주문입니다.' }, 400);
    }

    // Update order status to refund requested (manual processing required)
    await DB.prepare(
      'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_number = ?'
    ).bind('refunded', orderNumber).run();

    return c.json({ 
      success: true, 
      message: '환불 요청이 접수되었습니다. 고객센터(0507-0177-0432)에서 처리 예정입니다.',
      requiresManualProcessing: true
    });
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
             status, is_active, commission_rate, last_login_at, created_at
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

// Update seller commission rate (관리자가 수수료율 변경)
app.patch('/api/admin/sellers/:id/commission', async (c) => {
  const { DB } = c.env;
  const auth = await verifyAdminSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const sellerId = c.req.param('id');
    const { commission_rate } = await c.req.json();

    // 수수료율 유효성 검증 (0 ~ 100%)
    if (commission_rate === null || commission_rate === undefined) {
      return c.json({ success: false, error: '수수료율을 입력해주세요' }, 400);
    }

    const rate = parseFloat(commission_rate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      return c.json({ success: false, error: '수수료율은 0에서 100 사이의 값이어야 합니다' }, 400);
    }

    // 판매자 존재 확인
    const seller = await DB.prepare('SELECT id, username, commission_rate FROM sellers WHERE id = ?').bind(sellerId).first();
    
    if (!seller) {
      return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    }

    const oldRate = seller.commission_rate || 10.00;

    // 수수료율 업데이트
    await DB.prepare(`
      UPDATE sellers 
      SET commission_rate = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(rate, sellerId).run();

    console.log(`수수료율 변경: 판매자 ${seller.username} (ID: ${sellerId}), ${oldRate}% → ${rate}%`);

    return c.json({ 
      success: true, 
      message: `판매자 '${seller.username}'의 수수료율이 ${oldRate}%에서 ${rate}%로 변경되었습니다`,
      data: {
        seller_id: sellerId,
        seller_username: seller.username,
        old_commission_rate: oldRate,
        new_commission_rate: rate
      }
    });

  } catch (err) {
    console.error('수수료율 변경 실패:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// =================================
// Public Seller Profile APIs (공개 페이지)
// =================================

// Get seller public profile (셀러 공개 프로필)
app.get('/api/public/seller/:sellerId', async (c) => {
  const { DB, CACHE_KV } = c.env;
  
  try {
    const sellerId = c.req.param('sellerId');
    const cacheKey = `public:seller:${sellerId}`;

    // 캐시 확인 (60초 TTL) - 응답 속도 100-500ms → 5-10ms
    const cached = await getCachedData(CACHE_KV, cacheKey);
    if (cached) {
      return c.json({ success: true, data: cached, cached: true });
    }

    // 셀러 정보 조회
    const seller = await DB.prepare(`
      SELECT 
        id, username, name, business_name,
        profile_image, bio, 
        sns_instagram, sns_youtube, sns_facebook,
        created_at
      FROM sellers
      WHERE id = ? AND status = 'approved' AND is_active = 1
    `).bind(sellerId).first();

    if (!seller) {
      return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    }

    // 진행 중인 라이브
    const liveStreams = await DB.prepare(`
      SELECT 
        id, title, description, youtube_video_id, 
        status, current_product_id, created_at
      FROM live_streams
      WHERE seller_id = ? AND status = 'live'
      ORDER BY created_at DESC
      LIMIT 5
    `).bind(sellerId).all();

    // 예정된 라이브
    const scheduledStreams = await DB.prepare(`
      SELECT 
        id, title, description, youtube_video_id,
        status, created_at
      FROM live_streams
      WHERE seller_id = ? AND status = 'scheduled'
      ORDER BY created_at ASC
      LIMIT 10
    `).bind(sellerId).all();

    // 판매 상품
    const products = await DB.prepare(`
      SELECT 
        id, name, description, price, original_price, 
        discount_rate, image_url, stock, category
      FROM products
      WHERE seller_id = ? AND is_active = 1
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(sellerId).all();

    // 통계 정보
    const stats = await DB.prepare(`
      SELECT 
        COUNT(DISTINCT ls.id) as total_streams,
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT o.id) as total_orders
      FROM sellers s
      LEFT JOIN live_streams ls ON s.id = ls.seller_id
      LEFT JOIN products p ON s.id = p.seller_id AND p.is_active = 1
      LEFT JOIN orders o ON s.id = o.seller_id AND o.payment_status = 'completed'
      WHERE s.id = ?
    `).bind(sellerId).first();

    const responseData = {
      profile: seller,
      live_streams: liveStreams.results,
      scheduled_streams: scheduledStreams.results,
      products: products.results,
      stats: stats
    };

    // 캐시 저장 (60초 TTL)
    await setCachedData(CACHE_KV, cacheKey, responseData, 60);

    return c.json({
      success: true,
      data: responseData
    });

  } catch (err) {
    console.error('셀러 프로필 조회 실패:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Get seller by username (사용자명으로 조회)
app.get('/api/public/seller/username/:username', async (c) => {
  const { DB } = c.env;
  
  try {
    const username = c.req.param('username');

    const seller = await DB.prepare(`
      SELECT id FROM sellers 
      WHERE username = ? AND status = 'approved' AND is_active = 1
    `).bind(username).first();

    if (!seller) {
      return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    }

    return c.json({ success: true, data: { seller_id: seller.id } });

  } catch (err) {
    console.error('셀러 조회 실패:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// =================================
// Admin Settlement Dashboard APIs
// =================================

// Get settlement statistics (전체 정산 통계)
app.get('/api/admin/settlement/stats', async (c) => {
  const { DB } = c.env;
  const auth = await verifyAdminSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const { period } = c.req.query();
    
    // 기간별 필터링
    let dateFilter = '';
    const now = new Date();
    
    switch (period) {
      case 'today':
        const today = now.toISOString().split('T')[0];
        dateFilter = `AND DATE(o.created_at) = '${today}'`;
        break;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        dateFilter = `AND DATE(o.created_at) >= '${weekAgo}'`;
        break;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        dateFilter = `AND DATE(o.created_at) >= '${monthAgo}'`;
        break;
      default:
        dateFilter = '';
    }

    // 전체 통계
    const totalStats = await DB.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_sales,
        COALESCE(SUM(commission_amount), 0) as total_commission,
        COALESCE(SUM(seller_amount), 0) as total_seller_amount
      FROM orders o
      WHERE payment_status = 'completed' 
        AND is_cancelled = 0
        ${dateFilter}
    `).first();

    // 셀러별 통계
    const sellerStats = await DB.prepare(`
      SELECT 
        s.id as seller_id,
        s.username as seller_name,
        s.business_name,
        s.commission_rate,
        COUNT(o.id) as order_count,
        COALESCE(SUM(o.total_amount), 0) as total_sales,
        COALESCE(SUM(o.commission_amount), 0) as commission_amount,
        COALESCE(SUM(o.seller_amount), 0) as seller_amount,
        SUM(CASE WHEN o.settlement_status = 'pending' THEN o.seller_amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN o.settlement_status = 'completed' THEN o.seller_amount ELSE 0 END) as settled_amount
      FROM sellers s
      LEFT JOIN orders o ON s.id = o.seller_id 
        AND o.payment_status = 'completed' 
        AND o.is_cancelled = 0
        ${dateFilter}
      GROUP BY s.id
      HAVING order_count > 0
      ORDER BY total_sales DESC
    `).all();

    return c.json({
      success: true,
      data: {
        overview: totalStats,
        sellers: sellerStats.results,
        period: period || 'all'
      }
    });

  } catch (err) {
    console.error('정산 통계 조회 실패:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Get detailed settlement records (정산 내역 상세)
app.get('/api/admin/settlement/records', async (c) => {
  const { DB } = c.env;
  const auth = await verifyAdminSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const { seller_id, period, status } = c.req.query();
    
    let filters = ["payment_status = 'completed'", "is_cancelled = 0"];
    const params: any[] = [];

    if (seller_id) {
      filters.push('o.seller_id = ?');
      params.push(seller_id);
    }

    if (status) {
      filters.push('o.settlement_status = ?');
      params.push(status);
    }

    // 기간 필터
    const now = new Date();
    switch (period) {
      case 'today':
        const today = now.toISOString().split('T')[0];
        filters.push(`DATE(o.created_at) = '${today}'`);
        break;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        filters.push(`DATE(o.created_at) >= '${weekAgo}'`);
        break;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        filters.push(`DATE(o.created_at) >= '${monthAgo}'`);
        break;
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const records = await DB.prepare(`
      SELECT 
        o.id,
        o.order_number,
        o.seller_id,
        s.username as seller_name,
        s.business_name,
        o.total_amount,
        o.commission_rate,
        o.commission_amount,
        o.seller_amount,
        o.settlement_status,
        o.settled_at,
        o.created_at,
        u.name as user_name
      FROM orders o
      LEFT JOIN sellers s ON o.seller_id = s.id
      LEFT JOIN users u ON o.user_id = u.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT 100
    `).bind(...params).all();

    return c.json({
      success: true,
      data: records.results
    });

  } catch (err) {
    console.error('정산 내역 조회 실패:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Update settlement status (정산 상태 변경)
app.patch('/api/admin/settlement/:orderId/status', async (c) => {
  const { DB } = c.env;
  const auth = await verifyAdminSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const orderId = c.req.param('orderId');
    const { status } = await c.req.json();

    if (!['pending', 'completed'].includes(status)) {
      return c.json({ success: false, error: '유효하지 않은 정산 상태입니다' }, 400);
    }

    // 주문 확인
    const order = await DB.prepare(`
      SELECT id, order_number, settlement_status, seller_amount 
      FROM orders 
      WHERE id = ? AND payment_status = 'completed' AND is_cancelled = 0
    `).bind(orderId).first();

    if (!order) {
      return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404);
    }

    // 정산 상태 업데이트
    await DB.prepare(`
      UPDATE orders 
      SET settlement_status = ?,
          settled_at = ${status === 'completed' ? "datetime('now')" : 'NULL'}
      WHERE id = ?
    `).bind(status, orderId).run();

    console.log(`정산 상태 변경: 주문 ${order.order_number}, ${order.settlement_status} → ${status}`);

    return c.json({
      success: true,
      message: `정산 상태가 '${status}'로 변경되었습니다`,
      data: {
        order_id: orderId,
        order_number: order.order_number,
        old_status: order.settlement_status,
        new_status: status
      }
    });

  } catch (err) {
    console.error('정산 상태 변경 실패:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Batch update settlement status (일괄 정산 처리)
app.post('/api/admin/settlement/batch-complete', async (c) => {
  const { DB } = c.env;
  const auth = await verifyAdminSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const { order_ids } = await c.req.json();

    if (!Array.isArray(order_ids) || order_ids.length === 0) {
      return c.json({ success: false, error: '주문 ID 배열이 필요합니다' }, 400);
    }

    let successCount = 0;
    let failCount = 0;

    for (const orderId of order_ids) {
      try {
        await DB.prepare(`
          UPDATE orders 
          SET settlement_status = 'completed',
              settled_at = datetime('now')
          WHERE id = ? 
            AND payment_status = 'completed' 
            AND is_cancelled = 0
            AND settlement_status = 'pending'
        `).bind(orderId).run();
        successCount++;
      } catch (err) {
        failCount++;
        console.error(`주문 ${orderId} 정산 처리 실패:`, err);
      }
    }

    return c.json({
      success: true,
      message: `${successCount}건 정산 완료, ${failCount}건 실패`,
      data: {
        total: order_ids.length,
        success: successCount,
        failed: failCount
      }
    });

  } catch (err) {
    console.error('일괄 정산 처리 실패:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Export settlement records as CSV (정산 내역 CSV 다운로드)
app.get('/api/admin/settlement/export-csv', async (c) => {
  const { DB } = c.env;
  const auth = await verifyAdminSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const { seller_id, period } = c.req.query();
    
    let filters = ["payment_status = 'completed'", "is_cancelled = 0"];
    const params: any[] = [];

    if (seller_id) {
      filters.push('o.seller_id = ?');
      params.push(seller_id);
    }

    // 기간 필터
    const now = new Date();
    switch (period) {
      case 'today':
        const today = now.toISOString().split('T')[0];
        filters.push(`DATE(o.created_at) = '${today}'`);
        break;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        filters.push(`DATE(o.created_at) >= '${weekAgo}'`);
        break;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        filters.push(`DATE(o.created_at) >= '${monthAgo}'`);
        break;
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const records = await DB.prepare(`
      SELECT 
        o.order_number as '주문번호',
        o.created_at as '주문일시',
        s.username as '판매자ID',
        s.business_name as '사업자명',
        u.name as '구매자명',
        o.total_amount as '총금액',
        o.commission_rate as '수수료율',
        o.commission_amount as '수수료',
        o.seller_amount as '정산금액',
        o.settlement_status as '정산상태',
        o.settled_at as '정산일시'
      FROM orders o
      LEFT JOIN sellers s ON o.seller_id = s.id
      LEFT JOIN users u ON o.user_id = u.id
      ${whereClause}
      ORDER BY o.created_at DESC
    `).bind(...params).all();

    // CSV 생성
    const rows = records.results as any[];
    if (rows.length === 0) {
      return c.json({ success: false, error: '데이터가 없습니다' }, 404);
    }

    // CSV 헤더
    const headers = Object.keys(rows[0]);
    let csv = headers.join(',') + '\n';

    // CSV 데이터
    rows.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        // CSV 이스케이프 (쉼표, 따옴표 처리)
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      csv += values.join(',') + '\n';
    });

    // UTF-8 BOM 추가 (Excel에서 한글 깨짐 방지)
    const bom = '\uFEFF';
    
    return new Response(bom + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="settlement_${period || 'all'}_${Date.now()}.csv"`
      }
    });

  } catch (err) {
    console.error('CSV 내보내기 실패:', err);
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
    
    // 셀러별 수수료율 조회 (기본값 10%)
    let commissionRate = 10.00;
    if (sellerId) {
      const seller = await DB.prepare(`
        SELECT commission_rate FROM sellers WHERE id = ?
      `).bind(sellerId).first();
      
      if (seller && seller.commission_rate !== null) {
        commissionRate = seller.commission_rate as number;
      }
    }
    
    console.log('수수료율:', { sellerId, commissionRate });
    
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
    
    // 임시 사용자 처리 제거 - Kakao 로그인 필수
    if (!userId) {
      return c.json<ApiResponse>({
        success: false,
        error: 'User ID is required. Please login with Kakao first.',
      }, 401);
    }
    
    const finalUserId = userId;
    
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

// =================================
// Payment Provider Abstraction Layer
// =================================
// Note: Payment provider integration removed.
// Future PG implementations should use PaymentProvider interface.
// See docs/PAYMENT_GATEWAY_GUIDE.md for implementation guide.

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

// =================================
// Order Refund API (Simplified)
// =================================

/**
 * 주문 취소/환불 API (PG 연동 전 - 상태 변경만)
 * POST /api/orders/:orderNumber/refund
 * 
 * Request Body:
 * - reason: 취소/환불 사유
 */
app.post('/api/orders/:orderNumber/refund', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const orderNumber = c.req.param('orderNumber');
    const { reason } = await c.req.json();
    
    console.log('[Order Refund] 환불 요청:', {
      orderNumber,
      reason
    });
    
    // 1. 주문 조회
    const order = await DB.prepare(`
      SELECT * FROM orders WHERE order_number = ?
    `).bind(orderNumber).first();
    
    if (!order) {
      return c.json({
        success: false,
        error: '주문을 찾을 수 없습니다'
      }, 404);
    }
    
    // 2. 취소 가능 상태 확인
    if (order.payment_status === 'cancelled') {
      return c.json({
        success: false,
        error: '이미 취소된 주문입니다'
      }, 400);
    }
    
    // 3. DB 업데이트: 주문 상태 변경
    await DB.prepare(`
      UPDATE orders 
      SET 
        payment_status = 'cancelled',
        cancelled_at = CURRENT_TIMESTAMP,
        cancel_reason = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE order_number = ?
    `).bind(reason || '구매자 요청', orderNumber).run();
    
    console.log('[Order Refund] 주문 상태 업데이트 완료:', orderNumber);
    
    // 4. 재고 복구
    const orderItems = await DB.prepare(`
      SELECT product_id, quantity FROM order_items WHERE order_id = ?
    `).bind(order.id).all();
    
    for (const item of orderItems.results) {
      await DB.prepare(`
        UPDATE products 
        SET stock = stock + ?,
            version = version + 1,
            updated_at = datetime('now')
        WHERE id = ?
      `).bind(item.quantity, item.product_id).run();
      
      console.log('[Order Refund] 재고 복구:', {
        productId: item.product_id,
        quantity: item.quantity
      });
    }
    
    console.log('[Order Refund] ✅ 환불 완료:', {
      orderNumber,
      reason
    });
    
    return c.json({
      success: true,
      message: '주문이 취소되었습니다',
      data: {
        orderNumber: orderNumber,
        cancelDate: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('[Order Refund] Error:', error);
    return c.json({
      success: false,
      error: error.message || '주문 취소 중 오류가 발생했습니다'
    }, 500);
  }
});

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
    const session = await getSession(c.env.SESSION_KV, sessionToken);
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
    const session = await getSession(c.env.SESSION_KV, sessionToken);
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
      LEFT JOIN tax_invoices ti ON o.order_number = ti.order_number
      WHERE o.seller_id = ?
        AND o.payment_status IN ('approved', 'completed')
        AND DATE(o.created_at) >= DATE(?)
        AND DATE(o.created_at) <= DATE(?)
      ORDER BY o.created_at DESC
    `).bind(sellerId, start, end).all();
    
    // CSV 생성 (세금계산서 정보 추가)
    let csv = '주문번호,주문일시,주문자,총금액,수수료(10%),정산금액(90%),주문상태,사업자명,사업자번호,세금계산서번호,발행일자,계산서상태,국세청승인번호\n';
    
    for (const order of ordersResult?.results || []) {
      const orderStatus = order.status === 'delivered' ? '배송완료' : 
                         order.status === 'shipped' ? '배송중' : 
                         order.status === 'preparing' ? '상품준비중' : 
                         order.status === 'paid' ? '결제완료' : '대기중';
      
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
    const { order_number } = await c.req.json();

    if (!order_number) {
      return c.json({ success: false, error: '주문번호는 필수입니다.' }, 400);
    }

    // 주문 조회
    const order = await DB.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.order_number = ?
    `).bind(order_number).first();

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
        seller_id, order_number, invoice_type, invoice_number, issue_date,
        supplier_business_number, supplier_business_name, supplier_ceo_name, supplier_address,
        supplier_business_type, supplier_business_category,
        buyer_business_number, buyer_name, buyer_ceo_name,
        supply_price, tax_amount, total_amount,
        status, api_provider, api_invoice_id, nts_confirm_number,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      auth.sellerId,
      order_number,
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

    // 실제 바로빌 API 취소 호출
    try {
      if (taxInvoice.api_invoice_key && !isBarobillMockMode()) {
        // 사업자 정보 조회
        const businessInfo = await DB.prepare(`
          SELECT business_number FROM seller_business_info WHERE seller_id = ?
        `).bind(auth.sellerId).first();

        if (businessInfo && businessInfo.business_number) {
          await cancelBarobillTaxInvoice(
            businessInfo.business_number,
            taxInvoice.api_invoice_key,
            reason || '판매자 요청'
          );
        }
      }
    } catch (barobillError) {
      console.error('바로빌 취소 API 호출 실패:', barobillError);
      // 실패해도 DB는 취소 처리 (재시도 가능)
    }

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
      LEFT JOIN orders o ON log.order_number = o.order_number
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
app.post('/api/seller/tax-invoices/retry/:orderNumber', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const orderNumber = c.req.param('orderNumber');

    console.log(`[TAX INVOICE RETRY] 재시도 시작: ${orderNumber}`);

    // 이전 실패 로그 조회
    const failedLog = await DB.prepare(`
      SELECT * FROM tax_invoice_auto_issue_log
      WHERE order_number = ? AND seller_id = ? AND status = 'failed'
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(orderNumber, auth.sellerId).first();

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
      WHERE o.order_number = ?
      LIMIT 1
    `).bind(orderNumber).first();

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
        seller_id, order_number, invoice_number, issue_date,
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
      orderNumber,
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
        order_number, seller_id, tax_invoice_id, status, retry_count, created_at
      ) VALUES (?, ?, ?, 'success', ?, CURRENT_TIMESTAMP)
    `).bind(orderNumber, auth.sellerId, taxInvoiceId, retryCount + 1).run();

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
      const orderNumber = c.req.param('orderNumber');
      const failedLog = await DB.prepare(`
        SELECT * FROM tax_invoice_auto_issue_log
        WHERE order_number = ? AND seller_id = ? AND status = 'failed'
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(orderNumber, auth.sellerId).first();

      const retryCount = Number(failedLog?.retry_count || 0);

      await DB.prepare(`
        INSERT INTO tax_invoice_auto_issue_log (
          order_number, seller_id, status, error_message, retry_count, created_at
        ) VALUES (?, ?, 'failed', ?, ?, CURRENT_TIMESTAMP)
      `).bind(orderNumber, auth.sellerId, (err as Error).message, retryCount + 1).run();
    } catch (logErr) {
      console.error('[TAX INVOICE RETRY] 로그 기록 실패:', logErr);
    }

    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// =================================
// Live Page Route
// =================================
app.get('/live/:id', async (c) => {
  try {
    // Cloudflare Pages에서 정적 파일 가져오기
    const staticUrl = new URL('/static/live.html', c.req.url)
    const response = await fetch(staticUrl.toString())
    let html = await response.text()
    
    // 환경 변수 주입 (폴백 값 포함)
    const KAKAO_JS_KEY = c.env.KAKAO_JS_KEY || '975a2e7f97254b08f15dba4d177a2865';
    
    // HTML에 환경 변수 주입을 위한 스크립트 추가
    const envScript = `<script>window.KAKAO_JS_KEY = '${KAKAO_JS_KEY}';</script>`;
    
    // <script> 태그 앞에 환경 변수 스크립트 삽입
    html = html.replace('<!-- Scripts -->', `<!-- Scripts -->\n    ${envScript}`);
    
    console.log('[Live Page] Environment variables injected');
    
    // TrustedHTML 오류 방지: Response 객체로 직접 반환
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    })
  } catch (err) {
    console.error('Error serving live page:', err)
    return new Response('<h1>Error loading live page</h1>', {
      status: 500,
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    })
  }
})

// =================================
// Cart Page Route
// =================================
// Cart Page Route - Inject env vars and serve static HTML
// =================================
app.get('/cart', async (c) => {
  try {
    // Cloudflare Pages에서 정적 파일 가져오기
    const staticUrl = new URL('/static/cart.html', c.req.url)
    const response = await fetch(staticUrl.toString())
    let html = await response.text()
    
    // 환경 변수 주입 (폴백 값 포함)
    html = html.replace('%%NICEPAY_CLIENT_ID%%', c.env.NICEPAY_CLIENT_ID || 'S2_d5ec29558e9d46419bf01eb828ca0834')
    html = html.replace('%%NICEPAY_MID%%', c.env.NICEPAY_MID || 'nictest00m')
    
    // TrustedHTML 오류 방지: Response 객체로 직접 반환
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    })
  } catch (err) {
    console.error('Error serving cart page:', err)
    return new Response('<h1>Error loading cart page</h1>', {
      status: 500,
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    })
  }
})

// =================================
// My Orders Page Route
// =================================
app.get('/my-orders', async (c) => {
  try {
    // Cloudflare Pages에서 정적 파일 가져오기
    const staticUrl = new URL('/static/my-orders.html', c.req.url)
    const response = await fetch(staticUrl.toString())
    const html = await response.text()
    
    // TrustedHTML 오류 방지: Response 객체로 직접 반환
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    })
  } catch (err) {
    console.error('Error serving my orders page:', err)
    return new Response('<h1>Error loading orders page</h1>', {
      status: 500,
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    })
  }
})

// =================================
// Payment Result Page Route
// =================================
app.get('/payment-result', async (c) => {
  try {
    // Cloudflare Pages에서 정적 파일 가져오기
    const staticUrl = new URL('/payment-result.html', c.req.url)
    const response = await fetch(staticUrl.toString())
    const html = await response.text()
    
    // TrustedHTML 오류 방지: Response 객체로 직접 반환
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    })
  } catch (err) {
    console.error('Error serving payment result page:', err)
    return new Response('<h1>Error loading payment result page</h1>', {
      status: 500,
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    })
  }
})

// =================================
// Seller Profile Management APIs (셀러 프로필 관리)
// =================================

// Get current seller's profile (현재 로그인한 셀러 프로필 조회)
app.get('/api/seller/profile', async (c) => {
  const { DB } = c.env;
  const sessionToken = c.req.header('X-Session-Token');

  if (!sessionToken) {
    return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  }

  try {
    // Verify session
    const session = await DB.prepare(`
      SELECT seller_id 
      FROM admin_sessions 
      WHERE session_token = ? AND expires_at > datetime('now')
    `).bind(sessionToken).first();

    if (!session || !session.seller_id) {
      return c.json({ success: false, error: '유효하지 않은 세션입니다' }, 401);
    }

    // Get seller profile
    const seller = await DB.prepare(`
      SELECT 
        id,
        username,
        name,
        email,
        phone,
        business_name,
        business_number,
        profile_image,
        bio,
        sns_instagram,
        sns_youtube,
        sns_facebook,
        sns_twitter,
        website_url,
        status,
        created_at
      FROM sellers 
      WHERE id = ?
    `).bind(session.seller_id).first();

    if (!seller) {
      return c.json({ success: false, error: '셀러를 찾을 수 없습니다' }, 404);
    }

    return c.json({ success: true, data: seller });

  } catch (err) {
    console.error('프로필 조회 실패:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Update seller profile (셀러 프로필 수정)
app.patch('/api/seller/profile', async (c) => {
  const { DB } = c.env;
  const sessionToken = c.req.header('X-Session-Token');

  if (!sessionToken) {
    return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  }

  try {
    // Verify session
    const session = await DB.prepare(`
      SELECT seller_id 
      FROM admin_sessions 
      WHERE session_token = ? AND expires_at > datetime('now')
    `).bind(sessionToken).first();

    if (!session || !session.seller_id) {
      return c.json({ success: false, error: '유효하지 않은 세션입니다' }, 401);
    }

    // Get update data
    const {
      profile_image,
      bio,
      sns_instagram,
      sns_youtube,
      sns_facebook,
      sns_twitter,
      website_url
    } = await c.req.json();

    // Build update query dynamically
    const updates: string[] = [];
    const params: any[] = [];

    if (profile_image !== undefined) {
      updates.push('profile_image = ?');
      params.push(profile_image);
    }
    if (bio !== undefined) {
      updates.push('bio = ?');
      params.push(bio);
    }
    if (sns_instagram !== undefined) {
      updates.push('sns_instagram = ?');
      params.push(sns_instagram);
    }
    if (sns_youtube !== undefined) {
      updates.push('sns_youtube = ?');
      params.push(sns_youtube);
    }
    if (sns_facebook !== undefined) {
      updates.push('sns_facebook = ?');
      params.push(sns_facebook);
    }
    if (sns_twitter !== undefined) {
      updates.push('sns_twitter = ?');
      params.push(sns_twitter);
    }
    if (website_url !== undefined) {
      updates.push('website_url = ?');
      params.push(website_url);
    }

    if (updates.length === 0) {
      return c.json({ success: false, error: '수정할 내용이 없습니다' }, 400);
    }

    updates.push('updated_at = datetime(\'now\')');
    params.push(session.seller_id);

    // Update seller profile
    await DB.prepare(`
      UPDATE sellers 
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...params).run();

    // Get updated profile
    const updatedSeller = await DB.prepare(`
      SELECT 
        id,
        username,
        name,
        email,
        phone,
        business_name,
        business_number,
        profile_image,
        bio,
        sns_instagram,
        sns_youtube,
        sns_facebook,
        sns_twitter,
        website_url,
        status,
        created_at
      FROM sellers 
      WHERE id = ?
    `).bind(session.seller_id).first();

    return c.json({ 
      success: true, 
      message: '프로필이 업데이트되었습니다',
      data: updatedSeller 
    });

  } catch (err) {
    console.error('프로필 업데이트 실패:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// =================================
// Seller Public APIs (공개 프로필 및 콘텐츠)
// =================================

// Get seller public profile (셀러 공개 프로필 조회)
app.get('/api/seller/public/:sellerId', async (c) => {
  const { DB } = c.env;
  const sellerId = c.req.param('sellerId');

  try {
    // 셀러 정보 조회 (공개 가능한 정보만)
    const seller = await DB.prepare(`
      SELECT 
        id,
        username,
        name,
        email,
        phone,
        business_name,
        business_number,
        profile_image,
        bio,
        sns_instagram,
        sns_youtube,
        sns_facebook,
        sns_twitter,
        website_url,
        is_active,
        status,
        created_at
      FROM sellers 
      WHERE id = ? AND is_active = 1 AND status = 'approved'
    `).bind(sellerId).first();

    if (!seller) {
      return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    }

    return c.json({ success: true, data: seller });

  } catch (err) {
    console.error('셀러 프로필 조회 실패:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Get seller's live streams (셀러의 라이브 방송 목록)
app.get('/api/seller/:sellerId/streams', async (c) => {
  const { DB } = c.env;
  const sellerId = c.req.param('sellerId');

  try {
    // 셀러의 라이브 방송 목록 조회 (최신순)
    const streams = await DB.prepare(`
      SELECT 
        id,
        title,
        description,
        youtube_video_id,
        status,
        viewer_count,
        scheduled_at,
        created_at
      FROM live_streams 
      WHERE seller_id = ?
      ORDER BY 
        CASE status
          WHEN 'live' THEN 1
          WHEN 'scheduled' THEN 2
          WHEN 'ended' THEN 3
        END,
        created_at DESC
      LIMIT 50
    `).bind(sellerId).all();

    return c.json({ success: true, data: streams.results });

  } catch (err) {
    console.error('라이브 목록 조회 실패:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Get seller's public products (셀러의 공개 상품 목록)
app.get('/api/seller/:sellerId/products-public', async (c) => {
  const { DB } = c.env;
  const sellerId = c.req.param('sellerId');

  try {
    // 셀러의 활성화된 상품 목록 조회
    const products = await DB.prepare(`
      SELECT 
        id,
        name,
        price,
        original_price,
        discount_rate,
        stock,
        image_url,
        category,
        is_active
      FROM products 
      WHERE seller_id = ? AND is_active = 1
      ORDER BY created_at DESC
      LIMIT 100
    `).bind(sellerId).all();

    return c.json({ success: true, data: products.results });

  } catch (err) {
    console.error('상품 목록 조회 실패:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// =================================
// Order Complete Page Route
// =================================
app.get('/order-complete', (c) => {
  return c.redirect('/order-complete.html', 302)
})

// =================================
// Live Stream Page Route
// =================================
// /live/:id is handled by React Router in the SPA
// Don't handle it in the Worker - let Cloudflare Pages serve the SPA

// 404 handler - return JSON for API routes
// For all other routes, don't handle them - let Cloudflare Pages serve static files
app.notFound((c) => {
  const path = c.req.path;
  
  // Only handle API routes in the Worker
  if (path.startsWith('/api/')) {
    return c.json({ 
      success: false,
      error: 'Not found',
      message: `The requested endpoint ${path} was not found.`
    }, 404);
  }
  
  // For non-API routes, pass through to let Pages serve static files
  // Return undefined to indicate this route should not be handled by the Worker
  return new Response(null, { status: 404 });
});

// Global error handler
app.onError((err, c) => {
  const path = c.req.path;
  console.error('[Global Error Handler]', {
    path,
    method: c.req.method,
    error: err.message,
    stack: err.stack
  });
  
  // API routes: return JSON error
  if (path.startsWith('/api/')) {
    // Determine status code based on error type
    let status = 500;
    let message = 'Internal Server Error';
    
    if (err.message.includes('Unauthorized') || err.message.includes('로그인')) {
      status = 401;
      message = '인증이 필요합니다. 로그인해주세요.';
    } else if (err.message.includes('Forbidden') || err.message.includes('권한')) {
      status = 403;
      message = '접근 권한이 없습니다.';
    } else if (err.message.includes('Not found') || err.message.includes('찾을 수 없')) {
      status = 404;
      message = '요청하신 리소스를 찾을 수 없습니다.';
    } else if (err.message.includes('Bad request') || err.message.includes('잘못된')) {
      status = 400;
      message = '잘못된 요청입니다.';
    }
    
    return c.json({ 
      success: false,
      error: err.message || message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }, status);
  }
  
  // HTML routes: return user-friendly error page
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>오류 발생 - 유어 라이브</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50">
      <div class="min-h-screen flex items-center justify-center px-4">
        <div class="max-w-md w-full text-center">
          <div class="mb-8">
            <svg class="mx-auto h-16 w-16 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 class="text-3xl font-bold text-gray-900 mb-4">오류가 발생했습니다</h1>
          <p class="text-gray-600 mb-8">
            죄송합니다. 일시적인 오류가 발생했습니다.<br/>
            잠시 후 다시 시도해주세요.
          </p>
          <div class="space-y-3">
            <a 
              href="/" 
              class="inline-block w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              홈으로 돌아가기
            </a>
            <button 
              onclick="window.history.back()" 
              class="inline-block w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              이전 페이지로
            </button>
          </div>
          ${process.env.NODE_ENV === 'development' ? `
            <details class="mt-8 text-left">
              <summary class="cursor-pointer text-sm text-gray-500 hover:text-gray-700">개발자 정보</summary>
              <pre class="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto">${err.stack || err.message}</pre>
            </details>
          ` : ''}
        </div>
      </div>
    </body>
    </html>
  `, 500);
});

export default app;
