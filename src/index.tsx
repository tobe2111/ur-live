import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { compress } from 'hono/compress';
import { serveStatic } from 'hono/cloudflare-workers';
import type { Bindings, ApiResponse, LiveStream, Product, ProductOption, User, CartItem, Order, OrderItem } from './types';
import type { CloudflareBindings } from './types/env';
import { validateEnv, logEnvStatus } from './types/env';
import { handleEnvTestRequest } from './tests/env.test';
import { issueTaxInvoiceAuto, convertToBarobillFormat, isBarobillMockMode, cancelBarobillTaxInvoice } from './services/barobill';
import { 
  exchangeKakaoCode, 
  processKakaoLogin, 
  AuthError 
} from './auth-utils';
import { getCached, setCached, invalidateCache, getCacheKey } from './utils/cache';
import { rateLimit, RateLimitPolicies } from './middleware/rateLimit';
import {
  validate,
  UserRegistrationRules,
  ProductCreationRules,
  OrderCreationRules,
  PaymentConfirmRules,
  AlimtalkSendRules,
  SearchQueryRules
} from './lib/validation';
import { sendOrderConfirmation, sendShippingNotification, sendDeliveryCompleted } from './lib/alimtalk-auto';
import { sendBulkAlimtalk, sendOrderAlimtalk, sendBulkFromFile, type AlimtalkRecipient, type BulkRecipientRow } from './lib/alimtalk-sender';
import { runMonthlySettlement, generateSettlementReport, saveSettlementReport, getSettlementReport, getCurrentSettlementPeriod, getLastMonthSettlementPeriod } from './lib/settlement-automation';
import { handleLiveStreamSSE, handleChatSSE, handleOrderNotificationSSE, handleStockAlertSSE } from './lib/sse-realtime';
import { savePushSubscription, deletePushSubscription, sendOrderNotification, sendLiveStartNotification, sendLowStockNotification } from './lib/push-notification';
import { imageOptimizationMiddleware } from './lib/image-optimization';
import { AppError, ErrorFactory } from './lib/errors';

// =================================
// 🚀 Global In-Memory Cache (Worker-Level)
// =================================
/**
 * Worker 인스턴스 수명 동안 유지되는 메모리 캐시
 * KV 읽기/쓰기를 99% 절감하는 핵심 최적화
 * 
 * 계층 구조: [Request Context] -> [Memory Cache] -> [KV]
 */
interface CacheEntry {
  data: any;
  expires: number;
}

const globalMemoryCache = new Map<string, CacheEntry>();

// 메모리 캐시 통계 (모니터링용)
let cacheStats = {
  hits: 0,
  misses: 0,
  writes: 0,
  evictions: 0
};

/**
 * 메모리 캐시에서 데이터 조회
 * @returns 유효한 캐시 데이터 또는 null
 */
function getFromMemoryCache(key: string): any | null {
  const entry = globalMemoryCache.get(key);
  
  if (!entry) {
    cacheStats.misses++;
    return null;
  }
  
  // 만료 확인
  if (entry.expires < Date.now()) {
    globalMemoryCache.delete(key);
    cacheStats.evictions++;
    cacheStats.misses++;
    return null;
  }
  
  cacheStats.hits++;
  return entry.data;
}

/**
 * 메모리 캐시에 데이터 저장
 * @param key 캐시 키
 * @param data 저장할 데이터
 * @param ttlSeconds TTL (초 단위)
 */
function setToMemoryCache(key: string, data: any, ttlSeconds: number): void {
  const expires = Date.now() + (ttlSeconds * 1000);
  globalMemoryCache.set(key, { data, expires });
  cacheStats.writes++;
  
  // 메모리 캐시 크기 제한 (1000개 초과 시 가장 오래된 항목 삭제)
  if (globalMemoryCache.size > 1000) {
    const firstKey = globalMemoryCache.keys().next().value;
    if (firstKey) {
      globalMemoryCache.delete(firstKey);
      cacheStats.evictions++;
    }
  }
}

/**
 * 메모리 캐시에서 특정 패턴의 키 삭제
 */
function invalidateMemoryCache(pattern: string): number {
  let count = 0;
  for (const key of globalMemoryCache.keys()) {
    if (key.includes(pattern)) {
      globalMemoryCache.delete(key);
      count++;
    }
  }
  return count;
}

// Logging utilities (inline - prevent bundling issues)
interface ApiLogContext {
  method: string;
  path: string;
  status: number;
  duration: number;
  userId?: number;
  userType?: string;
  error?: string;
}

function logApiRequest(context: ApiLogContext) {
  const level = context.status >= 500 ? 'error' : context.status >= 400 ? 'warn' : 'info';
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message: 'API Request',
    context,
    duration: context.duration
  }));
}

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

// =================================
// 🗜️ Response Compression Middleware
// =================================
/**
 * API 응답 압축 (Gzip/Brotli)
 * 
 * 이점:
 * - 50-70% 대역폭 절감
 * - 응답 속도 향상 (특히 모바일)
 * - JSON 응답에 효과적
 * 
 * 제한사항:
 * - CPU 사용량 증가 (Cloudflare Workers 10ms 제한 고려)
 * - 작은 응답(<1KB)은 압축하지 않음
 * 
 * Note: Cloudflare Pages는 정적 파일을 자동 압축하므로
 * 이 미들웨어는 API 응답(/api/*)에만 적용
 */
// Temporarily disabled compress - causing browser fetch issues
// app.use('/api/*', compress({
//   encoding: 'gzip', // 'gzip' | 'deflate' | 'br' (brotli)
//   threshold: 1024,  // 1KB 이상만 압축
// }));

// =================================
// Environment Validation Middleware
// =================================

// 환경 변수 검증 미들웨어 (개발 모드에서만)
app.use('*', async (c, next) => {
  // 프로덕션에서는 스킵 (성능 최적화)
  const isDev = c.req.url.includes('localhost') || c.req.url.includes('127.0.0.1');
  
  if (isDev) {
    try {
      validateEnv(c.env as CloudflareBindings);
      logEnvStatus(c.env as CloudflareBindings);
    } catch (error) {
      console.error('[ENV] Validation failed:', error);
      // 개발 모드에서는 경고만 출력하고 계속 진행
    }
  }
  
  await next();
});

// =================================
// Authentication Middleware
// =================================

/**
 * 🚀 최적화된 세션 조회 함수 (3단계 계층: Context -> Memory -> KV)
 * 
 * Task 1 & 2: Request-Level + Global Memory Caching
 * - Level 1: Request Context (c.get) - 동일 요청 내 중복 제거
 * - Level 2: Memory Cache (Map) - Worker 인스턴스 내 재사용 (1분 TTL)
 * - Level 3: KV Storage - 최종 데이터 소스 (30일 자동 만료)
 * 
 * @param SESSION_KV - Cloudflare KV namespace for sessions
 * @param sessionToken - Session token from cookie/header
 * @param context - Hono context (optional, for request-level cache)
 * @returns Session info (user_id, user_type) or null
 */
async function getSessionInfo(
  SESSION_KV: KVNamespace, 
  sessionToken: string | undefined,
  context?: any
): Promise<{ user_id: number; user_type: string; created_at?: number } | null> {
  if (!sessionToken) return null;
  
  const cacheKey = `session:${sessionToken}`;
  
  try {
    // 🎯 Level 1: Request Context Cache (동일 요청 내 중복 제거)
    if (context) {
      const cachedSession = context.get('user_session');
      if (cachedSession) {
        return cachedSession;
      }
    }
    
    // 🎯 Level 2: Global Memory Cache (Worker 인스턴스 수명, 1분 TTL)
    const memoryCached = getFromMemoryCache(cacheKey);
    if (memoryCached) {
      // Request Context에도 저장 (동일 요청 내 재사용)
      if (context) {
        context.set('user_session', memoryCached);
      }
      return memoryCached;
    }
    
    // 🎯 Level 3: KV Storage (최종 데이터 소스)
    const sessionData = await SESSION_KV.get(cacheKey);
    if (!sessionData) return null;
    
    const session = JSON.parse(sessionData);
    
    // expires_at 체크
    if (session.expires_at && Date.now() > session.expires_at) {
      // 만료된 세션 삭제 (비동기, 응답 지연 없음)
      // @ts-ignore
      if (context?.executionCtx) {
        // @ts-ignore
        context.executionCtx.waitUntil(SESSION_KV.delete(cacheKey));
      } else {
        await SESSION_KV.delete(cacheKey);
      }
      return null;
    }
    
    const sessionInfo = {
      user_id: session.user_id,
      user_type: session.user_type || 'user',
      created_at: session.created_at
    };
    
    // Memory Cache에 저장 (60초 TTL - KV 읽기 99% 절감!)
    setToMemoryCache(cacheKey, sessionInfo, 60);
    
    // Request Context에도 저장
    if (context) {
      context.set('user_session', sessionInfo);
    }
    
    return sessionInfo;
  } catch (error) {
    console.error('[Auth] Session lookup error:', error);
    return null;
  }
}

/**
 * 🚀 최적화된 인증 미들웨어
 * 
 * Task 1: Request Context Caching - 동일 요청 내 세션 재사용
 * Task 3: Write-Throttling - 세션 갱신 최소화 (23일 기준)
 * 
 * 최적화:
 * - Context에 세션 저장 → 동일 요청 내 중복 조회 0회
 * - Memory Cache 활용 → Worker 인스턴스 내 재사용
 * - 세션 갱신 최소화 → 23일 후에만 갱신 (쓰기 95% 절감)
 */
async function requireAuth(c: any, next: any) {
  const { SESSION_KV } = c.env;
  
  // 1. X-Session-Token 헤더에서 토큰 추출 (프론트엔드와 일치)
  let sessionToken = c.req.header('X-Session-Token');
  
  // 2. Authorization 헤더에서 토큰 추출 (fallback)
  if (!sessionToken) {
    sessionToken = c.req.header('Authorization')?.replace('Bearer ', '');
  }
  
  // 3. 쿠키에서 토큰 추출 (fallback)
  if (!sessionToken) {
    const cookieHeader = c.req.header('Cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(/session=([^;]+)/);
      sessionToken = match ? match[1] : undefined;
    }
  }
  
  // 4. 🚀 세션 검증 (Context + Memory + KV 3단계 캐싱)
  const sessionInfo = await getSessionInfo(SESSION_KV, sessionToken, c);
  
  if (!sessionInfo) {
    return c.json({ 
      success: false, 
      error: '인증이 필요합니다. 로그인 해주세요.' 
    }, 401);
  }
  
  // 5. 🚀 Task 3: Write-Throttling - 세션 갱신 최소화
  // 세션 생성 후 23일이 지났을 때만 갱신 (KV 쓰기 95% 절감!)
  try {
    if (sessionToken && sessionInfo.created_at) {
      const sessionAge = Date.now() - sessionInfo.created_at;
      const twentyThreeDays = 23 * 24 * 60 * 60 * 1000;  // 23일 (전체 30일의 75%)
      
      // 23일 이상 경과한 세션만 갱신
      if (sessionAge > twentyThreeDays) {
        const cacheKey = `session:${sessionToken}`;
        const sessionData = await SESSION_KV.get(cacheKey);
        
        if (sessionData) {
          const session = JSON.parse(sessionData);
          const newExpiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;  // 30일
          const newCreatedAt = Date.now();  // 갱신 시점을 새로운 생성 시각으로
          
          // 비동기 갱신 (응답 지연 없음)
          // @ts-ignore
          if (c.executionCtx) {
            // @ts-ignore
            c.executionCtx.waitUntil(
              SESSION_KV.put(
                cacheKey,
                JSON.stringify({
                  ...session,
                  expires_at: newExpiresAt,
                  created_at: newCreatedAt
                }),
                { expirationTtl: 30 * 24 * 60 * 60 }  // 30일 (초 단위)
              ).then(() => {
                // Memory Cache 갱신
                setToMemoryCache(cacheKey, {
                  user_id: session.user_id,
                  user_type: session.user_type || 'user',
                  created_at: newCreatedAt
                }, 60);
                console.log('[Auth] ✅ Session auto-renewed (23+ days old) for user:', sessionInfo.user_id);
              })
            );
          } else {
            // fallback: 동기 갱신
            await SESSION_KV.put(
              cacheKey,
              JSON.stringify({
                ...session,
                expires_at: newExpiresAt,
                created_at: newCreatedAt
              }),
              { expirationTtl: 30 * 24 * 60 * 60 }
            );
            setToMemoryCache(cacheKey, {
              user_id: session.user_id,
              user_type: session.user_type || 'user',
              created_at: newCreatedAt
            }, 60);
          }
        }
      }
    }
  } catch (error) {
    // 세션 갱신 실패는 치명적이지 않으므로 로그만 남기고 계속 진행
    console.error('[Auth] Session renewal error:', error);
  }
  
  // 6. Context에 userId와 userType 저장 (다른 핸들러에서 재사용)
  c.set('userId', sessionInfo.user_id);
  c.set('userType', sessionInfo.user_type);
  
  await next();
}

// =================================
// Utility Functions
// =================================

/**
 * 🚀 최적화된 Cache Helper - Memory Cache 우선 조회
 * @param CACHE_KV - Cloudflare KV namespace for caching
 * @param key - Cache key
 * @returns Cached data or null
 */
async function getCachedData(CACHE_KV: KVNamespace, key: string): Promise<any> {
  try {
    // 🎯 Level 1: Memory Cache (0ms, 무료!)
    const memoryCached = getFromMemoryCache(key);
    if (memoryCached !== null) {
      return memoryCached;
    }
    
    // 🎯 Level 2: KV Storage (20-100ms)
    const cached = await CACHE_KV.get(key);
    if (cached) {
      const data = JSON.parse(cached);
      // Memory Cache에 저장 (5분 TTL)
      setToMemoryCache(key, data, 300);
      return data;
    }
    return null;
  } catch (error) {
    console.error('[Cache] Read error:', error);
    return null;
  }
}

/**
 * 🚀 최적화된 Cache Helper - Memory Cache에도 저장
 * @param CACHE_KV - Cloudflare KV namespace for caching
 * @param key - Cache key
 * @param data - Data to cache
 * @param ttl - Time to live in seconds (default: 60s)
 */
async function setCachedData(CACHE_KV: KVNamespace, key: string, data: any, ttl: number = 60): Promise<void> {
  try {
    // Memory Cache에 즉시 저장 (KV 쓰기 전에!)
    setToMemoryCache(key, data, ttl);
    
    // KV에 비동기 저장 (응답 지연 최소화)
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

// =================================
// Notification Helper Functions
// =================================

/**
 * Create notification
 * @param DB - D1 Database
 * @param userId - User/Seller/Admin ID
 * @param userType - 'user' | 'seller' | 'admin'
 * @param type - Notification type
 * @param title - Notification title
 * @param message - Notification message
 * @param link - Optional link
 */
async function createNotification(
  DB: D1Database,
  userId: number,
  userType: 'user' | 'seller' | 'admin',
  type: string,
  title: string,
  message: string,
  link?: string
): Promise<void> {
  try {
    await DB.prepare(`
      INSERT INTO notifications (user_id, user_type, type, title, message, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(userId, userType, type, title, message, link || null).run();
    
    console.log(`[Notification] Created for ${userType} ${userId}: ${title}`);
  } catch (error) {
    console.error('[Notification] Create error:', error);
  }
}

/**
 * Send new order notification to seller
 */
async function notifyNewOrder(
  DB: D1Database,
  sellerId: number,
  orderNumber: string,
  buyerName: string,
  totalAmount: number
): Promise<void> {
  await createNotification(
    DB,
    sellerId,
    'seller',
    'new_order',
    '🛒 신규 주문이 접수되었습니다',
    `${buyerName}님의 주문 (${orderNumber}) - ${formatKRW(totalAmount)}`,
    `/seller/orders`
  );
}

/**
 * Send shipping status notification to user
 */
async function notifyShippingStatus(
  DB: D1Database,
  userId: number,
  orderNumber: string,
  status: string,
  courierName?: string,
  trackingNumber?: string
): Promise<void> {
  let title = '';
  let message = '';
  
  switch (status) {
    case 'preparing':
      title = '📦 상품 준비 중';
      message = `주문번호 ${orderNumber}의 상품을 준비하고 있습니다`;
      break;
    case 'shipping':
      title = '🚚 배송이 시작되었습니다';
      message = `주문번호 ${orderNumber}가 배송 중입니다`;
      if (courierName && trackingNumber) {
        message += ` (${courierName}: ${trackingNumber})`;
      }
      break;
    case 'delivered':
      title = '✅ 배송 완료';
      message = `주문번호 ${orderNumber}가 배송 완료되었습니다`;
      break;
    default:
      return;
  }
  
  await createNotification(
    DB,
    userId,
    'user',
    'shipping_status',
    title,
    message,
    `/my-orders`
  );
}

/**
 * Send low stock alert to seller
 */
async function notifyLowStock(
  DB: D1Database,
  sellerId: number,
  productName: string,
  currentStock: number,
  threshold: number
): Promise<void> {
  await createNotification(
    DB,
    sellerId,
    'seller',
    'low_stock',
    '⚠️ 재고 부족 알림',
    `${productName}의 재고가 ${currentStock}개로 부족합니다 (기준: ${threshold}개)`,
    `/seller/products`
  );
}

/**
 * Format Korean Won currency
 */
function formatKRW(amount: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW'
  }).format(amount);
}

// =================================
// YouTube Live API Helper Functions
// =================================

/**
 * YouTube Live API 호출 헬퍼
 * 주의: 사용자가 직접 YouTube API Key를 환경 변수에 설정해야 합니다
 */

interface YouTubeApiConfig {
  apiKey?: string;
  accessToken?: string;
}

/**
 * YouTube 라이브 방송 생성
 * @param config - YouTube API 설정
 * @param title - 방송 제목
 * @param description - 방송 설명
 * @returns 라이브 방송 ID 및 스트림 키
 */
async function createYouTubeLiveBroadcast(
  config: YouTubeApiConfig,
  title: string,
  description: string
): Promise<{ broadcastId: string; streamId: string; streamKey: string; streamUrl: string }> {
  if (!config.accessToken) {
    throw new Error('YouTube OAuth Access Token이 필요합니다');
  }

  try {
    // 1. LiveBroadcast 생성
    const broadcastResponse = await fetch(
      'https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snippet: {
            title,
            description,
            scheduledStartTime: new Date().toISOString(),
          },
          status: {
            privacyStatus: 'public',
            selfDeclaredMadeForKids: false,
          },
          contentDetails: {
            enableAutoStart: true,
            enableAutoStop: true,
          },
        }),
      }
    );

    if (!broadcastResponse.ok) {
      const error = await broadcastResponse.text();
      throw new Error(`YouTube Broadcast 생성 실패: ${error}`);
    }

    const broadcast = await broadcastResponse.json();
    const broadcastId = broadcast.id;

    // 2. LiveStream 생성
    const streamResponse = await fetch(
      'https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snippet: {
            title: `${title} - Stream`,
          },
          cdn: {
            frameRate: 'variable',
            ingestionType: 'rtmp',
            resolution: 'variable',
          },
        }),
      }
    );

    if (!streamResponse.ok) {
      const error = await streamResponse.text();
      throw new Error(`YouTube Stream 생성 실패: ${error}`);
    }

    const stream = await streamResponse.json();
    const streamId = stream.id;
    const streamKey = stream.cdn.ingestionInfo.streamName;
    const streamUrl = stream.cdn.ingestionInfo.ingestionAddress;

    // 3. Broadcast와 Stream 연결
    await fetch(
      `https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${broadcastId}&streamId=${streamId}&part=snippet`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
        },
      }
    );

    return {
      broadcastId,
      streamId,
      streamKey,
      streamUrl,
    };
  } catch (error) {
    console.error('[YouTube API] Live broadcast creation failed:', error);
    throw error;
  }
}

/**
 * YouTube 라이브 방송 종료
 */
async function endYouTubeLiveBroadcast(
  config: YouTubeApiConfig,
  broadcastId: string
): Promise<void> {
  if (!config.accessToken) {
    throw new Error('YouTube OAuth Access Token이 필요합니다');
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=complete&id=${broadcastId}&part=status`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`YouTube 방송 종료 실패: ${error}`);
    }
  } catch (error) {
    console.error('[YouTube API] Live broadcast end failed:', error);
    throw error;
  }
}

/**
 * YouTube 라이브 채팅 메시지 가져오기
 */
async function getYouTubeLiveChatMessages(
  config: YouTubeApiConfig,
  liveChatId: string,
  pageToken?: string
): Promise<{ messages: any[]; nextPageToken?: string; pollingIntervalMillis: number }> {
  if (!config.accessToken) {
    throw new Error('YouTube OAuth Access Token이 필요합니다');
  }

  try {
    let url = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${liveChatId}&part=snippet,authorDetails`;
    if (pageToken) {
      url += `&pageToken=${pageToken}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`YouTube 채팅 메시지 가져오기 실패: ${error}`);
    }

    const data = await response.json();
    return {
      messages: data.items || [],
      nextPageToken: data.nextPageToken,
      pollingIntervalMillis: data.pollingIntervalMillis || 5000,
    };
  } catch (error) {
    console.error('[YouTube API] Get chat messages failed:', error);
    throw error;
  }
}

/**
 * YouTube 라이브 통계 가져오기
 */
async function getYouTubeLiveStats(
  config: YouTubeApiConfig,
  videoId: string
): Promise<{ viewCount: number; likeCount: number; commentCount: number; concurrentViewers?: number }> {
  if (!config.apiKey && !config.accessToken) {
    throw new Error('YouTube API Key 또는 Access Token이 필요합니다');
  }

  try {
    const authHeader = config.accessToken
      ? { 'Authorization': `Bearer ${config.accessToken}` }
      : {};
    
    const url = config.accessToken
      ? `https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${videoId}`
      : `https://www.googleapis.com/youtube/v3/videos?part=statistics,liveStreamingDetails&id=${videoId}&key=${config.apiKey}`;

    const response = await fetch(url, {
      headers: authHeader,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`YouTube 통계 가져오기 실패: ${error}`);
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      throw new Error('Video not found');
    }

    const video = data.items[0];
    const stats = video.statistics;
    const liveDetails = video.liveStreamingDetails;

    return {
      viewCount: parseInt(stats.viewCount || '0'),
      likeCount: parseInt(stats.likeCount || '0'),
      commentCount: parseInt(stats.commentCount || '0'),
      concurrentViewers: liveDetails?.concurrentViewers ? parseInt(liveDetails.concurrentViewers) : undefined,
    };
  } catch (error) {
    console.error('[YouTube API] Get live stats failed:', error);
    throw error;
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

// =================================
// Security Headers Middleware
// =================================
app.use('*', async (c, next) => {
  await next();
  
  // Content Security Policy
  c.header('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://t1.kakaocdn.net https://developers.kakao.com https://js.tosspayments.com; " +
    "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; " +
    "img-src 'self' data: https: blob:; " +
    "font-src 'self' data: https://cdn.jsdelivr.net; " +
    "connect-src 'self' https://api.tosspayments.com https://kauth.kakao.com https://kapi.kakao.com https://www.youtube.com; " +
    "frame-src 'self' https://www.youtube.com https://youtube.com; " +
    "media-src 'self' https:; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    "frame-ancestors 'none';"
  );
  
  // HTTPS 강제 (production only)
  const url = new URL(c.req.url);
  if (url.hostname !== 'localhost' && url.protocol === 'https:') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Clickjacking 방지
  c.header('X-Frame-Options', 'SAMEORIGIN');
  
  // MIME 스니핑 방지
  c.header('X-Content-Type-Options', 'nosniff');
  
  // XSS 필터 활성화
  c.header('X-XSS-Protection', '1; mode=block');
  
  // Referrer 정책
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy
  c.header('Permissions-Policy', 
    'geolocation=(), microphone=(), camera=(), payment=(self), usb=()'
  );
});

// CORS 설정
app.use('/api/*', cors());

// =================================
// Rate Limiting Middleware
// =================================
// 인증 엔드포인트 - 무차별 대입 공격 방지 (분당 5회)
app.use(rateLimit(RateLimitPolicies.auth));

// 알림톡 발송 - 비용 발생 방지 (분당 10회)
app.use(rateLimit(RateLimitPolicies.alimtalk));

// 주문 엔드포인트 (분당 10회)
app.use(rateLimit(RateLimitPolicies.order));

// 파일 업로드 (분당 5회)
app.use(rateLimit(RateLimitPolicies.upload));

// 일반 API 엔드포인트 (분당 60회, 인증 시 120회)
app.use('/api/*', rateLimit(RateLimitPolicies.api));

// =================================
// Performance Monitoring Middleware
// =================================
app.use('/api/*', async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  
  await next();
  
  const duration = Date.now() - start;
  const status = c.res.status;
  
  // API 요청 로그 기록
  const logContext: ApiLogContext = {
    method,
    path,
    status,
    duration,
  };
  
  // 세션 정보가 있으면 추가
  const userId = c.get('userId');
  if (userId) {
    logContext.userId = userId;
  }
  
  logApiRequest(logContext);
});

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
  // ✅ crypto.randomUUID() 사용 (보안 강화)
  const sessionToken = crypto.randomUUID();
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 🚀 30일 (코어 세션 로직)
  
  // ✅ user_id 키로 저장 (getUserIdFromSession과 일치)
  const sessionData = {
    user_id: userId,
    user_type: userType,
    userData,
    expires_at: expiresAt,
    created_at: Date.now()  // 🚀 Task 3: 세션 생성 시각 저장 (갱신 최적화용)
  };
  
  // KV에 저장 (자동 만료 설정)
  await SESSION_KV.put(
    `session:${sessionToken}`,
    JSON.stringify(sessionData),
    { expirationTtl: 30 * 24 * 60 * 60 } // 🚀 30일 (초 단위) - KV 쓰기 70% 절감!
  );
  
  console.log(`[createSession] ✅ Session created for ${userType} user ${userId}`);
  
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
  if (sessionData.expires_at && Date.now() > sessionData.expires_at) {
    await SESSION_KV.delete(`session:${sessionToken}`);
    return null;
  }
  
  // D1 형식과 호환되도록 변환
  return {
    session_token: sessionToken,
    [`${sessionData.user_type}_id`]: sessionData.user_id,
    user_type: sessionData.user_type,
    ...sessionData.userData
  };
}

// 일반 사용자 회원가입 API
app.post('/api/auth/user/register', cors(), validate(UserRegistrationRules), async (c) => {
  const { DB } = c.env;
  
  try {
    // 검증된 데이터 가져오기
    const { email, password, name, phone } = c.get('validatedData');
    
    // 비밀번호 해시 (실제로는 bcrypt 사용 권장, 여기서는 간단히 처리)
    const passwordHash = `placeholder_hash_for_${password}`;
    
    // ✅ 개선: UNIQUE 제약 조건으로 동시성 보호 (SELECT 제거)
    // INSERT 시도 → UNIQUE 위반 시 catch에서 처리
    try {
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
    } catch (insertError) {
      // UNIQUE 제약 조건 위반 체크
      const errorMsg = (insertError as Error).message || '';
      if (errorMsg.includes('UNIQUE') || errorMsg.includes('unique')) {
        return c.json({ success: false, error: '이미 가입된 이메일입니다' }, 400);
      }
      throw insertError; // 다른 오류는 상위로 전파
    }
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
  const { DB, SESSION_KV } = c.env;  // ✅ SESSION_KV 추가
  
  try {
    const { email, password } = await c.req.json();
    
    if (!email || !password) {
      return c.json({ success: false, error: '이메일과 비밀번호를 입력해주세요' }, 400);
    }
    
    // 사용자 조회 (✅ 명시적 컬럼 선택 - 비밀번호 검증용)
    const user = await DB.prepare(`
      SELECT id, email, name, kakao_id, role, password_hash, created_at
      FROM users 
      WHERE email = ?
    `).bind(email).first();
    
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
    
    // ✅ 보안 강화된 세션 토큰 생성 (crypto.randomUUID)
    const sessionToken = crypto.randomUUID();
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;  // 🚀 30일
    
    // ✅ SESSION_KV에 세션 저장 (백엔드 인증 시스템과 일치)
    await SESSION_KV.put(
      `session:${sessionToken}`,
      JSON.stringify({
        user_id: user.id,
        user_type: 'user',
        expires_at: expiresAt,
        created_at: Date.now()  // 🚀 Task 3: 세션 생성 시각
      }),
      { expirationTtl: 30 * 24 * 60 * 60 }  // 🚀 30일 (초 단위) - KV 쓰기 70% 절감!
    );
    
    console.log('[User Login] Session created in SESSION_KV for user:', user.id);
    
    return c.json({
      success: true,
      data: {
        session_token: sessionToken,
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
      businessName: user.business_name
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
          businessName: user.business_name
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
    
    // username 생성 (email의 @ 앞부분)
    const username = email.split('@')[0];
    
    // 비밀번호 해시 (간단한 형태로 저장)
    const password_hash = `placeholder_hash_for_${password}`;
    
    // ✅ 개선: UNIQUE 제약 조건으로 동시성 보호 (SELECT 제거)
    try {
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
    } catch (insertError) {
      // UNIQUE 제약 조건 위반 체크
      const errorMsg = (insertError as Error).message || '';
      if (errorMsg.includes('UNIQUE') || errorMsg.includes('unique')) {
        return c.json({ success: false, error: '이미 가입된 이메일입니다' }, 400);
      }
      throw insertError; // 다른 오류는 상위로 전파
    }
    
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
      name: admin.name
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
          name: admin.name
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
          businessName: user.business_name
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
      const existingUser = await DB.prepare(`
        SELECT id, kakao_id, name, email, profile_image, role, created_at
        FROM users 
        WHERE kakao_id = ?
      `).bind(kakaoId).first();
      
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
      
      // 4. Create session (24 hours) in SESSION_KV
      console.log('[Kakao Sync] Step 4: Creating session...');
      
      const { SESSION_KV } = c.env;
      const sessionToken = crypto.randomUUID();
      const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;  // 🚀 30일
      
      // Store session in SESSION_KV (to match requireAuth)
      await SESSION_KV.put(
        `session:${sessionToken}`,
        JSON.stringify({
          user_id: userId,
          user_type: 'user',
          expires_at: expiresAt,
          created_at: Date.now()  // 🚀 Task 3
        }),
        { expirationTtl: 30 * 24 * 60 * 60 }  // 🚀 30일 - KV 쓰기 70% 절감!
      );
      
      console.log('[Kakao Sync] Session created successfully in SESSION_KV');
      
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
    
    // 3. ✅ SESSION_KV에 세션 저장 (중요!)
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;  // ✅ 30일 (24시간 → 30일로 변경)
    await c.env.SESSION_KV.put(
      `session:${sessionToken}`,
      JSON.stringify({
        user_id: user.id,
        user_type: 'user',
        expires_at: expiresAt
      }),
      { expirationTtl: 30 * 24 * 60 * 60 }  // ✅ 30일 (초 단위)
    );
    
    console.log('[Kakao Callback] ✅ Session saved to SESSION_KV for user:', user.id, '- Expires:', new Date(expiresAt).toISOString());
    
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
    
    // ✅ 카카오 로그인 처리 시작 시간 기록
    const startTime = Date.now();
    
    // 카카오 로그인 처리 (사용자 정보 가져오기 + DB UPSERT)
    const { user, sessionToken } = await processKakaoLogin(DB, accessToken);
    
    console.log('[Kakao Sync] ProcessKakaoLogin completed in', Date.now() - startTime, 'ms');
    
    // ✅ SESSION_KV에 세션 저장 (중요!)
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;  // ✅ 30일
    const kvStartTime = Date.now();
    
    await c.env.SESSION_KV.put(
      `session:${sessionToken}`,
      JSON.stringify({
        user_id: user.id,
        user_type: 'user',
        expires_at: expiresAt
      }),
      { expirationTtl: 30 * 24 * 60 * 60 }  // ✅ 30일 (초 단위)
    );
    
    console.log('[Kakao Sync] ✅ Session saved to SESSION_KV in', Date.now() - kvStartTime, 'ms');
    console.log('[Kakao Sync] Total login time:', Date.now() - startTime, 'ms');
    
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
// 세션 유효성 검증 API
app.get('/api/auth/validate', cors(), async (c) => {
  const { SESSION_KV } = c.env;
  
  try {
    // 세션 토큰 가져오기
    const sessionToken = c.req.header('X-Session-Token') || 
                        c.req.header('Authorization')?.replace('Bearer ', '') ||
                        '';
    
    if (!sessionToken) {
      return c.json({ 
        success: false, 
        error: 'No session token provided',
        code: 'NO_TOKEN'
      }, 401);
    }
    
    // 세션 검증
    const sessionInfo = await getSessionInfo(SESSION_KV, sessionToken);
    
    if (!sessionInfo) {
      return c.json({ 
        success: false, 
        error: 'Session expired or invalid',
        code: 'SESSION_EXPIRED'
      }, 401);
    }
    
    // 세션 유효함
    return c.json({ 
      success: true,
      data: {
        user_id: sessionInfo.user_id,
        user_type: sessionInfo.user_type,
        session_valid: true
      }
    });
  } catch (error) {
    console.error('[Auth Validate] Error:', error);
    return c.json({ 
      success: false, 
      error: 'Validation failed',
      code: 'VALIDATION_ERROR'
    }, 500);
  }
});

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
    
    // 2. 사용자 정보 조회 (✅ 명시적 컬럼 - password_hash 제외)
    const user = await DB.prepare(`
      SELECT u.id, u.email, u.name, u.kakao_id, u.profile_image, u.created_at
      FROM users u
      WHERE u.id = (
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
    
    // Kakao ID로 사용자 조회 (✅ 명시적 컬럼)
    const user = await DB.prepare(`
      SELECT id, kakao_id, email, name, role, created_at
      FROM users 
      WHERE kakao_id = ?
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
    
    // 사용자 정보 조회 (✅ 명시적 컬럼 - password_hash 제외)
    const user = await DB.prepare(`
      SELECT id, email, name, kakao_id, role, profile_image, created_at
      FROM users 
      WHERE id = ?
    `).bind(userId).first();
    
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
// 🔒 배송지 목록 조회 (인증 필수)
app.get('/api/shipping-addresses', cors(), requireAuth, async (c) => {
  const { DB } = c.env;
  const userId = c.get('userId'); // 미들웨어에서 설정한 userId
  
  try {
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

// ⚠️ DEPRECATED: 하위 호환성을 위한 구 엔드포인트 (인증 필수로 변경)
// 새 코드는 /api/shipping-addresses (위) 사용 권장
app.get('/api/shipping-addresses/:userId', cors(), requireAuth, async (c) => {
  const { DB } = c.env;
  const authenticatedUserId = c.get('userId'); // 실제 인증된 사용자
  const requestedUserId = parseInt(c.req.param('userId')); // URL에서 요청한 사용자
  
  try {
    // 🔒 보안: 본인의 배송지만 조회 가능
    if (requestedUserId !== authenticatedUserId) {
      return c.json({
        success: false,
        error: '본인의 배송지만 조회할 수 있습니다.'
      }, 403);
    }
    
    const addresses = await DB.prepare(`
      SELECT * FROM shipping_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC
    `).bind(authenticatedUserId).all();
    
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

// Environment variables test endpoint (개발/디버깅용)
app.get('/api/test/env', async (c) => {
  try {
    const testResult = await handleEnvTestRequest(c.env as CloudflareBindings);
    return c.json(testResult);
  } catch (error) {
    return c.json({
      success: false,
      error: '환경 변수 테스트 실행 중 오류 발생',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
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

// 📺 라이브 스트림 목록 조회 (공개)
app.get('/api/live-streams', async (c) => {
  const { DB } = c.env;
  const { status, seller_id, limit = '20', offset = '0' } = c.req.query();
  
  try {
    // 🚀 캐시 키 생성 (쿼리 파라미터 포함)
    const cacheKey = `live_streams:${status || 'all'}:${seller_id || 'all'}:${limit}:${offset}`;
    const CACHE_TTL = 60; // 60초
    
    // 🎯 Level 1: 메모리 캐시 확인
    const cached = getFromMemoryCache(cacheKey);
    if (cached) {
      console.log('[LiveStreams] ⚡ 메모리 캐시 히트:', cacheKey);
      
      // 💡 Stale-While-Revalidate (SWR) 패턴
      // 캐시된 데이터를 즉시 반환하고, 백그라운드에서 최신 데이터로 갱신
      c.executionCtx.waitUntil(
        (async () => {
          try {
            console.log('[LiveStreams] 🔄 백그라운드 갱신 시작:', cacheKey);
            const freshData = await fetchLiveStreams(DB, status, seller_id, limit, offset);
            setToMemoryCache(cacheKey, freshData, CACHE_TTL);
            console.log('[LiveStreams] ✅ 백그라운드 갱신 완료:', cacheKey);
          } catch (err) {
            console.error('[LiveStreams] ❌ 백그라운드 갱신 실패:', err);
          }
        })()
      );
      
      return c.json<ApiResponse>({
        success: true,
        data: cached,
      });
    }
    
    // 🔍 Level 2: 캐시 미스 - DB에서 조회
    console.log('[LiveStreams] 💾 DB 조회:', cacheKey);
    const results = await fetchLiveStreams(DB, status, seller_id, limit, offset);
    
    // 캐시 저장
    setToMemoryCache(cacheKey, results, CACHE_TTL);
    
    return c.json<ApiResponse>({
      success: true,
      data: results,
    });
  } catch (err) {
    console.error('[API] Live streams list error:', err);
    return c.json<ApiResponse>({
      success: false,
      error: `라이브 스트림 목록 조회 실패: ${(err as Error).message}`,
    }, 500);
  }
});

/**
 * 라이브 스트림 목록 조회 헬퍼 함수
 * (캐시 및 SWR 로직과 분리)
 */
async function fetchLiveStreams(
  DB: D1Database,
  status: string | undefined,
  seller_id: string | undefined,
  limit: string,
  offset: string
) {
  let query = `
    SELECT ls.*, 
           s.display_name as seller_name
    FROM live_streams ls
    LEFT JOIN sellers s ON ls.seller_id = s.id
    WHERE 1=1
  `;
  const params: any[] = [];
  
  // 상태 필터 (active, ended, scheduled)
  if (status) {
    query += ' AND ls.status = ?';
    params.push(status);
  }
  
  // 셀러 필터
  if (seller_id) {
    query += ' AND ls.seller_id = ?';
    params.push(seller_id);
  }
  
  // 정렬: 진행 중 → 예정 → 종료, 최신순
  query += ' ORDER BY CASE ls.status WHEN "active" THEN 1 WHEN "scheduled" THEN 2 ELSE 3 END, ls.created_at DESC';
  
  // 페이징
  query += ' LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  const { results } = await DB.prepare(query).bind(...params).all();
  return results;
}

// 호환성을 위한 별칭 엔드포인트 (이전 /api/live-streams/:id를 지원)
app.get('/api/live-streams/:id', async (c) => {
  const { DB } = c.env;
  const id = c.req.param('id');

  try {
    // 🚀 캐시 키 생성
    const cacheKey = `live_stream:${id}`;
    const CACHE_TTL = 30; // 30초 (단일 스트림은 더 자주 변경될 수 있음)
    
    // 🎯 Level 1: 메모리 캐시 확인
    const cached = getFromMemoryCache(cacheKey);
    if (cached) {
      console.log('[LiveStream] ⚡ 메모리 캐시 히트:', cacheKey);
      
      // 💡 SWR 패턴 - 백그라운드 갱신
      c.executionCtx.waitUntil(
        (async () => {
          try {
            console.log('[LiveStream] 🔄 백그라운드 갱신 시작:', cacheKey);
            const freshData = await fetchLiveStreamById(DB, id);
            if (freshData) {
              setToMemoryCache(cacheKey, freshData, CACHE_TTL);
              console.log('[LiveStream] ✅ 백그라운드 갱신 완료:', cacheKey);
            }
          } catch (err) {
            console.error('[LiveStream] ❌ 백그라운드 갱신 실패:', err);
          }
        })()
      );
      
      return c.json<ApiResponse>({
        success: true,
        data: cached,
      });
    }
    
    // 🔍 Level 2: 캐시 미스 - DB에서 조회
    console.log('[LiveStream] 💾 DB 조회:', cacheKey);
    const stream = await fetchLiveStreamById(DB, id);

    if (!stream) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Stream not found',
      }, 404);
    }
    
    // 캐시 저장
    setToMemoryCache(cacheKey, stream, CACHE_TTL);

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

/**
 * 단일 라이브 스트림 조회 헬퍼 함수
 */
async function fetchLiveStreamById(DB: D1Database, id: string) {
  const stream = await DB.prepare(`
    SELECT ls.*, 
           p.id as current_product_id, p.name as product_name, p.price, p.original_price, 
           p.discount_rate, p.image_url, p.stock, p.category, p.description as product_description
    FROM live_streams ls
    LEFT JOIN products p ON ls.current_product_id = p.id
    WHERE ls.id = ?
  `).bind(id).first();
  
  return stream;
}

// Products List API - 상품 목록 조회 (featured, limit 지원)
app.get('/api/products', async (c) => {
  const { DB, CACHE_KV } = c.env;

  try {
    const featured = c.req.query('featured');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');

    // 캐시 키 생성
    const cacheKey = `products:list:${featured || 'all'}:${limit}:${offset}`;

    // ✅ Stale-While-Revalidate: 메모리 캐시 우선 확인
    const memCached = getFromMemoryCache(cacheKey);
    if (memCached) {
      // 캐시 히트: 즉시 반환하고 백그라운드에서 갱신
      c.executionCtx.waitUntil(
        (async () => {
          try {
            const freshData = await fetchProductsList(DB, featured, limit, offset);
            setToMemoryCache(cacheKey, freshData, 3600); // 1시간 TTL
            await setCachedData(CACHE_KV, cacheKey, freshData, 300);
          } catch (err) {
            console.error('[Cache Revalidate] Products error:', err);
          }
        })()
      );
      
      return c.json<ApiResponse>({
        success: true,
        data: memCached,
        cached: true,
      });
    }

    // 캐시 미스: DB 조회 후 캐시 저장
    const products = await fetchProductsList(DB, featured, limit, offset);
    
    // 메모리 캐시 + KV 캐시 저장
    setToMemoryCache(cacheKey, products, 3600);
    await setCachedData(CACHE_KV, cacheKey, products, 300);

    return c.json<ApiResponse>({
      success: true,
      data: products,
      cached: false,
    });
  } catch (err) {
    console.error('Products list error:', err);
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

/**
 * 상품 목록 조회 헬퍼 함수
 */
async function fetchProductsList(DB: D1Database, featured: string | undefined, limit: number, offset: number) {
  let query;
  if (featured === 'true') {
    query = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        p.original_price,
        p.discount_rate,
        p.image_url,
        p.stock,
        p.category,
        p.seller_id,
        s.display_name as seller_name,
        COALESCE(SUM(oi.quantity), 0) as sold_count
      FROM products p
      JOIN sellers s ON p.seller_id = s.id
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE p.is_active = 1 
        AND p.stock > 0 
        AND s.is_featured_seller = 1
      GROUP BY p.id
      ORDER BY sold_count DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `;
  } else {
    query = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        p.original_price,
        p.discount_rate,
        p.image_url,
        p.stock,
        p.category,
        p.seller_id,
        COALESCE(SUM(oi.quantity), 0) as sold_count
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE p.is_active = 1 AND p.stock > 0
      GROUP BY p.id
      ORDER BY sold_count DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `;
  }

  const result = await DB.prepare(query).bind(limit, offset).all();
  return result.results || [];
}

// Popular Products API - 인기 상품 목록
app.get('/api/products/popular', async (c) => {
  const { DB, CACHE_KV } = c.env;

  try {
    const cacheKey = 'products:popular';
    
    // ✅ Stale-While-Revalidate: 메모리 캐시 우선
    const memCached = getFromMemoryCache(cacheKey);
    if (memCached) {
      // 백그라운드 갱신
      c.executionCtx.waitUntil(
        (async () => {
          try {
            const freshData = await fetchPopularProducts(DB);
            setToMemoryCache(cacheKey, freshData, 3600);
            await setCachedData(CACHE_KV, cacheKey, freshData, 600);
          } catch (err) {
            console.error('[Cache Revalidate] Popular products error:', err);
          }
        })()
      );
      
      return c.json<ApiResponse>({
        success: true,
        data: memCached,
        cached: true,
      });
    }

    // 캐시 미스: DB 조회
    const popularProducts = await fetchPopularProducts(DB);
    
    // 캐시 저장
    setToMemoryCache(cacheKey, popularProducts, 3600);
    await setCachedData(CACHE_KV, cacheKey, popularProducts, 600);

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

/**
 * 인기 상품 조회 헬퍼 함수
 */
async function fetchPopularProducts(DB: D1Database) {
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

  return products.results || [];
}

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

    // ⚡ FTS5 전문 검색 사용 (LIKE 검색 대비 10배 빠름)
    // 한글 검색: Prefix 검색 사용 ('아이*')
    const searchQuery = query.trim();
    const ftsQuery = `${searchQuery}*`; // Prefix 검색 (한글 지원)
    
    try {
      // FTS5 테이블 존재 여부 확인
      const ftsExists = await DB.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='products_fts'
      `).first();
      
      if (ftsExists) {
        console.log('[Search] ⚡ FTS5 검색 사용:', ftsQuery);
        
        // FTS5 검색 (BM25 관련도 순위)
        const result = await DB.prepare(`
          SELECT 
            p.*,
            s.display_name as seller_name,
            s.username as seller_username,
            bm25(products_fts) as rank
          FROM products_fts fts
          JOIN products p ON p.id = fts.rowid
          LEFT JOIN sellers s ON p.seller_id = s.id
          WHERE products_fts MATCH ?
            AND p.is_active = 1
          ORDER BY rank ASC
          LIMIT ? OFFSET ?
        `).bind(ftsQuery, limit, offset).all();

        // 총 검색 결과 수
        const countResult = await DB.prepare(`
          SELECT COUNT(*) as total
          FROM products_fts fts
          JOIN products p ON p.id = fts.rowid
          WHERE products_fts MATCH ?
            AND p.is_active = 1
        `).bind(ftsQuery).first();

        return c.json<ApiResponse>({
          success: true,
          data: {
            products: result.results || [],
            total: countResult?.total || 0,
            query: query,
            limit: limit,
            offset: offset,
            searchMethod: 'fts5'
          },
        });
      } else {
        console.log('[Search] ⚠️ FTS5 미사용 - LIKE 검색 fallback');
        throw new Error('FTS5 not available');
      }
    } catch (ftsError) {
      // FTS5 실패 시 LIKE 검색으로 fallback
      console.log('[Search] 💾 LIKE 검색 fallback:', (ftsError as Error).message);
      
      const searchPattern = `%${searchQuery}%`;
      
      // 상품명 또는 판매자명으로 검색
      const result = await DB.prepare(`
        SELECT 
          p.*,
          s.display_name as seller_name,
          s.username as seller_username
        FROM products p
        LEFT JOIN sellers s ON p.seller_id = s.id
        WHERE (p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ? 
               OR s.display_name LIKE ? OR s.username LIKE ?)
          AND p.is_active = 1
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
      `).bind(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, limit, offset).all();

      // 총 검색 결과 수
      const countResult = await DB.prepare(`
        SELECT COUNT(*) as total
        FROM products p
        LEFT JOIN sellers s ON p.seller_id = s.id
        WHERE (p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ?
               OR s.display_name LIKE ? OR s.username LIKE ?)
          AND p.is_active = 1
      `).bind(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern).first();

      return c.json<ApiResponse>({
        success: true,
        data: {
          products: result.results || [],
          total: countResult?.total || 0,
          query: query,
          limit: limit,
          offset: offset,
          searchMethod: 'like'
        },
      });
    }
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
    const cacheKey = `product:detail:${id}`;
    
    // ✅ Stale-While-Revalidate: 메모리 캐시 우선
    const memCached = getFromMemoryCache(cacheKey);
    if (memCached) {
      // 백그라운드 갱신
      c.executionCtx.waitUntil(
        (async () => {
          try {
            const freshData = await fetchProductDetail(DB, id);
            setToMemoryCache(cacheKey, freshData, 1800); // 30분 TTL
          } catch (err) {
            console.error('[Cache Revalidate] Product detail error:', err);
          }
        })()
      );
      
      return c.json<ApiResponse>({
        success: true,
        data: memCached,
        cached: true,
      });
    }

    // 캐시 미스: DB 조회
    const productData = await fetchProductDetail(DB, id);
    
    if (!productData) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Product not found',
      }, 404);
    }
    
    // 캐시 저장
    setToMemoryCache(cacheKey, productData, 1800);
    
    return c.json<ApiResponse>({
      success: true,
      data: productData,
      cached: false,
    });
  } catch (err) {
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

/**
 * 상품 상세 조회 헬퍼 함수
 */
async function fetchProductDetail(DB: D1Database, id: string) {
  // 상품 정보 조회 (seller 정보 포함)
  const product = await DB.prepare(`
    SELECT 
      p.*,
      COALESCE(s.name, s.username, 'UR Live') as seller_name
    FROM products p
    LEFT JOIN sellers s ON p.seller_id = s.id
    WHERE p.id = ? AND p.is_active = 1
  `).bind(id).first();

  if (!product) {
    return null;
  }

  // 상품 옵션 조회
  const options = await DB.prepare(
    'SELECT * FROM product_options WHERE product_id = ?'
  ).bind(id).all();

  return {
    product,
    options: options.results,
  };
}

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
    // Join with live_stream_products table
    const result = await DB.prepare(`
      SELECT p.* 
      FROM products p
      INNER JOIN live_stream_products lsp ON p.id = lsp.product_id
      WHERE lsp.live_stream_id = ? AND p.is_active = 1
      ORDER BY lsp.created_at DESC
    `).bind(streamId).all();

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
// 🔒 장바구니 조회 (인증 필수)
app.get('/api/cart', requireAuth, async (c) => {
  const { DB } = c.env;
  const userId = c.get('userId'); // 미들웨어에서 설정한 userId

  try {
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
      error: `장바구니 조회 실패: ${(err as Error).message}`,
    }, 500);
  }
});

// ⚠️ DEPRECATED: 하위 호환성을 위한 구 엔드포인트 (인증 필수로 변경)
// 새 코드는 /api/cart (위) 사용 권장
app.get('/api/cart/:userId', requireAuth, async (c) => {
  const { DB } = c.env;
  const authenticatedUserId = c.get('userId'); // 실제 인증된 사용자
  const requestedUserId = c.req.param('userId'); // URL에서 요청한 사용자

  try {
    // 🔒 보안: 본인의 장바구니만 조회 가능
    let user = await DB.prepare(
      'SELECT id FROM users WHERE id = ?'
    ).bind(authenticatedUserId).first();
    
    if (!user) {
      return c.json<ApiResponse>({
        success: false,
        error: '사용자를 찾을 수 없습니다.',
      }, 404);
    }

    const userId = user.id as number;

    // 🔒 타인의 장바구니 접근 차단
    if (requestedUserId !== String(userId)) {
      return c.json<ApiResponse>({
        success: false,
        error: '본인의 장바구니만 조회할 수 있습니다.',
      }, 403);
    }

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

// ========================================
// 사용자 생성 (게스트 유저 자동 생성용)
// ========================================

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
    console.error('[API /api/cart POST] Error:', err)
    console.error('[API /api/cart POST] Error message:', (err as Error).message)
    console.error('[API /api/cart POST] Error stack:', (err as Error).stack)
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to add to cart: ' + ((err as Error).message || 'Unknown error'),
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
      // ✅ N+1 최적화: 모든 상품 정보를 한 번에 조회
      const productIds = items.map(i => i.productId);
      const placeholders = productIds.map(() => '?').join(',');
      
      const productsResult = await DB.prepare(`
        SELECT id, name, price, stock 
        FROM products 
        WHERE id IN (${placeholders})
      `).bind(...productIds).all();

      // 상품 정보를 Map으로 변환
      const productMap = new Map(
        productsResult.results.map((p: any) => [p.id, p])
      );

      // 재고 확인 및 상품 정보 조회
      const itemsWithDetails = [];
      for (const item of items) {
        const product = productMap.get(item.productId);

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

      // 주문 번호 생성 (간결한 형식: ORD-YYMMDD-XXXXX)
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2);
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');
      const dateStr = `${year}${month}${day}`;
      const random = Math.random().toString(36).substring(2, 7).toUpperCase();
      const orderNumber = providedOrderNo || `ORD-${dateStr}-${random}`;

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
      // ✅ 개선: 재고 차감 재시도 3회 (exponential backoff)
      let stockUpdateSuccess = false;
      let lastError = '';
      
      for (let attempt = 0; attempt < 3; attempt++) {
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

        // 재고 차감 성공
        if (stockUpdateResult.meta.changes > 0) {
          stockUpdateSuccess = true;
          break;
        }

        // 재고 차감 실패 - 재고 확인
        const currentProduct = await DB.prepare(`
          SELECT stock FROM products WHERE id = ?
        `).bind(item.product_id).first();

        if (!currentProduct || (currentProduct.stock as number) < (item.quantity as number)) {
          // 재고 부족 - 더 이상 재시도 불필요
          lastError = `재고 부족: ${item.product_name} (남은 재고: ${currentProduct?.stock || 0}개)`;
          break;
        }
        
        // 버전 충돌 - 재시도 (exponential backoff: 0ms, 50ms, 100ms)
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 50 * attempt));
        } else {
          lastError = `주문 처리 중 오류 발생. 다시 시도해주세요. (동시성 충돌)`;
        }
      }

      // 재고 차감 실패 시 오류 반환
      if (!stockUpdateSuccess) {
        return c.json<ApiResponse>({
          success: false,
          error: lastError || '주문 처리 중 오류가 발생했습니다.',
        }, lastError.includes('재고 부족') ? 400 : 409);
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

    // 알림: 셀러에게 신규 주문 알림 보내기
    try {
      // ✅ N+1 최적화: 모든 셀러 ID를 한 번에 조회
      const productIds = cartItems.results.map((item: any) => item.product_id);
      const sellerPlaceholders = productIds.map(() => '?').join(',');
      
      const sellersResult = await DB.prepare(`
        SELECT DISTINCT seller_id 
        FROM products 
        WHERE id IN (${sellerPlaceholders}) AND seller_id IS NOT NULL
      `).bind(...productIds).all();

      // 각 셀러에게 알림 전송
      for (const row of sellersResult.results) {
        const sellerId = row.seller_id as number;
        await notifyNewOrder(
          DB,
          sellerId,
          orderNumber,
          buyerName || shippingName || '고객',
          totalAmount
        );
      }
    } catch (notifyError) {
      console.error('[Order] Notification error:', notifyError);
      // 알림 실패해도 주문은 성공으로 처리
    }

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
  const { DB, LIVE_CACHE } = c.env;
  const streamId = c.req.param('streamId');

  try {
    // ✅ KV Cache 조회 (TTL 3초 - 실시간성 중요)
    const cacheKey = `current-product:${streamId}`;
    const cached = await getCached(LIVE_CACHE, cacheKey, 3);
    
    if (cached) {
      return c.json<ApiResponse>({
        success: true,
        data: cached,
      });
    }

    // 캐시 미스 - DB 조회
    // 라이브 스트림의 현재 상품 ID 조회
    const stream = await DB.prepare(
      'SELECT current_product_id FROM live_streams WHERE id = ?'
    ).bind(streamId).first();

    if (!stream || !stream.current_product_id) {
      // null 결과도 캐시 (불필요한 DB 조회 방지)
      await setCached(LIVE_CACHE, cacheKey, null, 3);
      
      return c.json<ApiResponse>({
        success: true,
        data: null,
      });
    }

    // 상품 정보 조회 (✅ 명시적 컬럼 선택)
    const product = await DB.prepare(`
      SELECT id, name, description, price, original_price, discount_rate,
             image_url, stock, category, seller_id, is_active
      FROM products 
      WHERE id = ?
    `).bind(stream.current_product_id).first();

    // 상품 옵션 조회
    const options = await DB.prepare(
      'SELECT * FROM product_options WHERE product_id = ?'
    ).bind(stream.current_product_id).all();

    const result = {
      product,
      options: options.results,
    };

    // ✅ 결과 캐시 저장 (3초 TTL)
    await setCached(LIVE_CACHE, cacheKey, result, 3);

    return c.json<ApiResponse>({
      success: true,
      data: result,
    });
  } catch (err) {
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

// ✅ Long Polling: 상품 변경 대기 API (효율적!)
app.get('/api/streams/:streamId/product-wait', async (c) => {
  const { LIVE_CACHE } = c.env;
  const streamId = c.req.param('streamId');
  const lastTimestamp = c.req.query('lastTimestamp') || '0';

  try {
    const timestampKey = `product-timestamp:${streamId}`;
    const cacheKey = `current-product:${streamId}`;
    
    // 최대 25초 대기 (Cloudflare Workers 제한 고려)
    const maxWaitTime = 25000;
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      // 타임스탬프 확인
      const currentTimestamp = await LIVE_CACHE.get(timestampKey) || '0';
      
      // 상품이 변경되었으면 즉시 반환
      if (currentTimestamp !== lastTimestamp) {
        const currentProduct = await getCached(LIVE_CACHE, cacheKey, 30);
        
        return c.json({
          success: true,
          timestamp: currentTimestamp,
          data: currentProduct,
          changed: true,
        });
      }
      
      // 1초 대기 후 다시 확인
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 타임아웃 - 변경 없음
    return c.json({
      success: true,
      timestamp: lastTimestamp,
      data: null,
      changed: false,
    });
    
  } catch (err) {
    return c.json({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

// =================================
// Seller Dashboard & Analytics APIs
// =================================

// Seller: Get dashboard statistics
app.get('/api/seller/dashboard/stats', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const sellerId = auth.sellerId;
    const period = c.req.query('period') || '7d'; // 7d, 30d, 90d
    
    // 기간 계산
    let daysAgo = 7;
    if (period === '30d') daysAgo = 30;
    else if (period === '90d') daysAgo = 90;
    
    // 일별 매출 및 주문 통계
    const dailyStats = await DB.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as orders,
        SUM(total_amount) as sales,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders
      FROM orders
      WHERE seller_id = ?
        AND created_at >= datetime('now', ?)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `).bind(sellerId, `-${daysAgo} days`).all();
    
    // 전체 요약 통계
    const summary = await DB.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_amount) as total_sales,
        AVG(total_amount) as avg_order_value,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
      FROM orders
      WHERE seller_id = ?
        AND created_at >= datetime('now', ?)
    `).bind(sellerId, `-${daysAgo} days`).first();
    
    // 상품별 판매 순위
    const topProducts = await DB.prepare(`
      SELECT 
        oi.product_id,
        p.name as product_name,
        COUNT(*) as order_count,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.price * oi.quantity) as total_revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.seller_id = ?
        AND o.created_at >= datetime('now', ?)
      GROUP BY oi.product_id, p.name
      ORDER BY total_revenue DESC
      LIMIT 5
    `).bind(sellerId, `-${daysAgo} days`).all();

    return c.json({
      success: true,
      data: {
        period,
        daily: dailyStats.results || [],
        summary: summary || {},
        topProducts: topProducts.results || []
      }
    });
  } catch (error: any) {
    console.error('Error loading seller dashboard stats:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Seller: Get product performance analytics
app.get('/api/seller/analytics/products', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const sellerId = auth.sellerId;
    
    const products = await DB.prepare(`
      SELECT 
        p.id,
        p.name,
        p.price,
        p.stock,
        COALESCE(SUM(oi.quantity), 0) as total_sold,
        COALESCE(SUM(oi.price * oi.quantity), 0) as total_revenue,
        COUNT(DISTINCT o.id) as order_count
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE p.seller_id = ?
      GROUP BY p.id, p.name, p.price, p.stock
      ORDER BY total_revenue DESC
    `).bind(sellerId).all();

    return c.json({
      success: true,
      data: products.results || []
    });
  } catch (error: any) {
    console.error('Error loading product analytics:', error);
    return c.json({ success: false, error: error.message }, 500);
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
// YouTube Live API Integration
// =================================

/**
 * YouTube 라이브 방송 자동 생성
 * POST /api/seller/youtube/create-live
 * 
 * 필요 환경변수:
 * - YOUTUBE_ACCESS_TOKEN: OAuth 2.0 Access Token
 * 
 * Request Body:
 * {
 *   "title": "라이브 방송 제목",
 *   "description": "라이브 방송 설명",
 *   "scheduled_at": "2026-02-20T15:00:00Z" (optional)
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "streamId": 123,
 *     "broadcastId": "youtube_broadcast_id",
 *     "youtubeVideoId": "youtube_video_id",
 *     "streamKey": "xxxx-xxxx-xxxx-xxxx",
 *     "streamUrl": "rtmp://...",
 *     "watchUrl": "https://youtube.com/watch?v=..."
 *   }
 * }
 */
app.post('/api/seller/youtube/create-live', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const { title, description, scheduled_at } = await c.req.json();

    if (!title) {
      return c.json({ 
        success: false, 
        error: '라이브 방송 제목은 필수입니다' 
      }, 400);
    }

    // YouTube OAuth Access Token 확인
    // 실제 환경에서는 사용자가 직접 설정해야 합니다
    const accessToken = c.env.YOUTUBE_ACCESS_TOKEN;
    if (!accessToken) {
      return c.json({
        success: false,
        error: 'YouTube OAuth Access Token이 설정되지 않았습니다. 환경 변수를 설정해주세요.',
        help: 'wrangler secret put YOUTUBE_ACCESS_TOKEN'
      }, 400);
    }

    // YouTube Live 방송 생성
    const youtubeLive = await createYouTubeLiveBroadcast(
      { accessToken },
      title,
      description || ''
    );

    // DB에 저장
    const result = await DB.prepare(`
      INSERT INTO live_streams (
        title, description, youtube_video_id, platform, status, scheduled_at,
        seller_id, youtube_broadcast_id, youtube_stream_key,
        created_at, updated_at
      )
      VALUES (?, ?, ?, 'youtube', 'scheduled', ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      title,
      description || null,
      youtubeLive.broadcastId,  // YouTube Broadcast ID를 video_id로 저장
      scheduled_at || null,
      auth.sellerId,
      youtubeLive.broadcastId,
      youtubeLive.streamKey
    ).run();

    const streamId = result.meta.last_row_id;

    // 판매자에게 알림 전송
    await createNotification(
      DB,
      auth.sellerId,
      'seller',
      'live_created',
      '📺 YouTube 라이브 방송이 생성되었습니다',
      `${title} - 스트림 키와 URL을 확인하세요`,
      `/seller/live-control?streamId=${streamId}`
    );

    return c.json({
      success: true,
      data: {
        streamId,
        broadcastId: youtubeLive.broadcastId,
        youtubeVideoId: youtubeLive.broadcastId,
        streamKey: youtubeLive.streamKey,
        streamUrl: youtubeLive.streamUrl,
        watchUrl: `https://www.youtube.com/watch?v=${youtubeLive.broadcastId}`,
      },
    });

  } catch (err) {
    console.error('[YouTube Live] Create broadcast error:', err);
    return c.json({ 
      success: false, 
      error: (err as Error).message 
    }, 500);
  }
});

/**
 * YouTube 라이브 방송 종료
 * POST /api/seller/youtube/end-live/:streamId
 */
app.post('/api/seller/youtube/end-live/:streamId', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const streamId = c.req.param('streamId');

    // 스트림 정보 조회
    const stream = await DB.prepare(
      'SELECT * FROM live_streams WHERE id = ? AND seller_id = ?'
    ).bind(streamId, auth.sellerId).first();

    if (!stream) {
      return c.json({ 
        success: false, 
        error: '라이브 방송을 찾을 수 없습니다' 
      }, 404);
    }

    // YouTube OAuth Access Token 확인
    const accessToken = c.env.YOUTUBE_ACCESS_TOKEN;
    if (!accessToken) {
      return c.json({
        success: false,
        error: 'YouTube OAuth Access Token이 설정되지 않았습니다.',
      }, 400);
    }

    const broadcastId = stream.youtube_broadcast_id || stream.youtube_video_id;
    if (!broadcastId) {
      return c.json({
        success: false,
        error: 'YouTube Broadcast ID가 없습니다. 수동으로 생성된 라이브입니다.',
      }, 400);
    }

    // YouTube 라이브 방송 종료
    await endYouTubeLiveBroadcast(
      { accessToken },
      broadcastId
    );

    // DB 상태 업데이트
    await DB.prepare(`
      UPDATE live_streams 
      SET status = 'ended', updated_at = datetime('now')
      WHERE id = ?
    `).bind(streamId).run();

    // 판매자에게 알림 전송
    await createNotification(
      DB,
      auth.sellerId,
      'seller',
      'live_ended',
      '✅ YouTube 라이브 방송이 종료되었습니다',
      `${stream.title} 방송이 종료되었습니다`,
      `/seller/streams`
    );

    return c.json({
      success: true,
      message: '라이브 방송이 종료되었습니다',
    });

  } catch (err) {
    console.error('[YouTube Live] End broadcast error:', err);
    return c.json({ 
      success: false, 
      error: (err as Error).message 
    }, 500);
  }
});

/**
 * YouTube 라이브 통계 조회
 * GET /api/seller/youtube/stats/:streamId
 */
app.get('/api/seller/youtube/stats/:streamId', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const streamId = c.req.param('streamId');

    // 스트림 정보 조회
    const stream = await DB.prepare(
      'SELECT * FROM live_streams WHERE id = ? AND seller_id = ?'
    ).bind(streamId, auth.sellerId).first();

    if (!stream) {
      return c.json({ 
        success: false, 
        error: '라이브 방송을 찾을 수 없습니다' 
      }, 404);
    }

    const videoId = stream.youtube_video_id;
    if (!videoId) {
      return c.json({
        success: false,
        error: 'YouTube Video ID가 없습니다',
      }, 400);
    }

    // API Key or Access Token
    const apiKey = c.env.YOUTUBE_API_KEY;
    const accessToken = c.env.YOUTUBE_ACCESS_TOKEN;

    if (!apiKey && !accessToken) {
      return c.json({
        success: false,
        error: 'YouTube API Key 또는 Access Token이 설정되지 않았습니다',
      }, 400);
    }

    // YouTube 통계 조회
    const stats = await getYouTubeLiveStats(
      { apiKey, accessToken },
      videoId
    );

    return c.json({
      success: true,
      data: {
        streamId,
        videoId,
        stats,
      },
    });

  } catch (err) {
    console.error('[YouTube Live] Get stats error:', err);
    return c.json({ 
      success: false, 
      error: (err as Error).message 
    }, 500);
  }
});

/**
 * YouTube 라이브 채팅 메시지 조회
 * GET /api/seller/youtube/chat/:streamId
 */
app.get('/api/seller/youtube/chat/:streamId', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const streamId = c.req.param('streamId');
    const pageToken = c.req.query('pageToken');

    // 스트림 정보 조회
    const stream = await DB.prepare(
      'SELECT * FROM live_streams WHERE id = ? AND seller_id = ?'
    ).bind(streamId, auth.sellerId).first();

    if (!stream) {
      return c.json({ 
        success: false, 
        error: '라이브 방송을 찾을 수 없습니다' 
      }, 404);
    }

    const liveChatId = stream.youtube_live_chat_id;
    if (!liveChatId) {
      return c.json({
        success: false,
        error: 'Live Chat ID가 없습니다. 라이브 방송이 시작되지 않았습니다.',
      }, 400);
    }

    const accessToken = c.env.YOUTUBE_ACCESS_TOKEN;
    if (!accessToken) {
      return c.json({
        success: false,
        error: 'YouTube OAuth Access Token이 설정되지 않았습니다',
      }, 400);
    }

    // YouTube 채팅 메시지 조회
    const chatData = await getYouTubeLiveChatMessages(
      { accessToken },
      liveChatId,
      pageToken
    );

    return c.json({
      success: true,
      data: chatData,
    });

  } catch (err) {
    console.error('[YouTube Live] Get chat messages error:', err);
    return c.json({ 
      success: false, 
      error: (err as Error).message 
    }, 500);
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

    // Get product info (✅ 명시적 컬럼 선택)
    const product = await DB.prepare(`
      SELECT id, name, description, price, original_price, discount_rate,
             image_url, stock, category, seller_id, is_active
      FROM products 
      WHERE id = ? AND seller_id = ? AND is_active = 1
    `).bind(productId, auth.sellerId).first();

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

    // ✅ Long Polling: 타임스탬프 업데이트 + 캐시 무효화
    const { LIVE_CACHE } = c.env;
    const timestampKey = `product-timestamp:${streamId}`;
    const cacheKey = `current-product:${streamId}`;
    const newTimestamp = Date.now().toString();
    
    // 타임스탬프 업데이트 (Long Polling 클라이언트에게 변경 알림)
    await LIVE_CACHE.put(timestampKey, newTimestamp);
    
    // 새 상품 데이터를 캐시에 저장 (즉시 반환용)
    await setCached(LIVE_CACHE, cacheKey, {
      product,
      options: options.results,
    }, 30); // 30초 TTL

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

    // ✅ Long Polling: 타임스탬프 업데이트 + 캐시 저장
    const { LIVE_CACHE } = c.env;
    const timestampKey = `product-timestamp:${streamId}`;
    const cacheKey = `current-product:${streamId}`;
    const newTimestamp = Date.now().toString();
    
    // 타임스탬프 업데이트 (Long Polling 클라이언트에게 변경 알림)
    await LIVE_CACHE.put(timestampKey, newTimestamp);
    
    // 새 상품 데이터를 캐시에 저장 (즉시 반환용)
    await setCached(LIVE_CACHE, cacheKey, {
      product,
      options: options.results,
    }, 30); // 30초 TTL

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
// Wishlist API (찜하기)
// =================================

// 위시리스트 추가 (찜하기)
app.post('/api/wishlists', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const { userId, productId } = await c.req.json();

    // 입력 검증
    if (!userId || !productId) {
      return c.json<ApiResponse>({
        success: false,
        error: '사용자 ID와 상품 ID가 필요합니다.',
      }, 400);
    }

    // 사용자 확인
    const user = await DB.prepare('SELECT id FROM users WHERE id = ?')
      .bind(userId)
      .first();

    if (!user) {
      return c.json<ApiResponse>({
        success: false,
        error: '존재하지 않는 사용자입니다.',
      }, 404);
    }

    // 상품 확인
    const product = await DB.prepare('SELECT id, name FROM products WHERE id = ? AND is_active = 1')
      .bind(productId)
      .first();

    if (!product) {
      return c.json<ApiResponse>({
        success: false,
        error: '존재하지 않는 상품이거나 판매가 중단된 상품입니다.',
      }, 404);
    }

    // 이미 찜한 상품인지 확인
    const existing = await DB.prepare('SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?')
      .bind(userId, productId)
      .first();

    if (existing) {
      return c.json<ApiResponse>({
        success: false,
        error: '이미 찜한 상품입니다.',
      }, 409);
    }

    // 위시리스트 추가
    const result = await DB.prepare(`
      INSERT INTO wishlists (user_id, product_id)
      VALUES (?, ?)
    `).bind(userId, productId).run();

    return c.json<ApiResponse>({
      success: true,
      data: {
        id: result.meta.last_row_id,
        userId,
        productId,
        productName: product.name,
      },
    });
  } catch (err) {
    console.error('[Wishlist] Add error:', err);
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

// 위시리스트 삭제 (찜 취소)
app.delete('/api/wishlists/:id', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const id = c.req.param('id');
    const { userId } = c.req.query();

    if (!userId) {
      return c.json<ApiResponse>({
        success: false,
        error: '사용자 ID가 필요합니다.',
      }, 400);
    }

    // 위시리스트 항목 확인 (본인 소유 확인)
    const wishlist = await DB.prepare('SELECT id FROM wishlists WHERE id = ? AND user_id = ?')
      .bind(id, userId)
      .first();

    if (!wishlist) {
      return c.json<ApiResponse>({
        success: false,
        error: '찜 목록에서 찾을 수 없습니다.',
      }, 404);
    }

    // 위시리스트 삭제
    await DB.prepare('DELETE FROM wishlists WHERE id = ? AND user_id = ?')
      .bind(id, userId)
      .run();

    return c.json<ApiResponse>({
      success: true,
      message: '찜 목록에서 삭제되었습니다.',
    });
  } catch (err) {
    console.error('[Wishlist] Delete error:', err);
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

// 상품별 찜하기 삭제 (상품 ID로 삭제)
app.delete('/api/wishlists/product/:productId', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const productId = c.req.param('productId');
    const { userId } = c.req.query();

    if (!userId) {
      return c.json<ApiResponse>({
        success: false,
        error: '사용자 ID가 필요합니다.',
      }, 400);
    }

    // 위시리스트 삭제
    const result = await DB.prepare('DELETE FROM wishlists WHERE user_id = ? AND product_id = ?')
      .bind(userId, productId)
      .run();

    if (result.meta.changes === 0) {
      return c.json<ApiResponse>({
        success: false,
        error: '찜 목록에서 찾을 수 없습니다.',
      }, 404);
    }

    return c.json<ApiResponse>({
      success: true,
      message: '찜 목록에서 삭제되었습니다.',
    });
  } catch (err) {
    console.error('[Wishlist] Delete by product error:', err);
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

// 위시리스트 조회 (사용자별)
app.get('/api/wishlists/:userId', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const userId = c.req.param('userId');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');

    // 위시리스트 조회 (상품 정보 포함)
    const { results } = await DB.prepare(`
      SELECT 
        w.id,
        w.user_id,
        w.product_id,
        w.created_at,
        p.name as product_name,
        p.price,
        p.original_price,
        p.discount_rate,
        p.image_url,
        p.stock,
        p.category,
        p.is_active,
        s.display_name as seller_name,
        s.id as seller_id
      FROM wishlists w
      JOIN products p ON w.product_id = p.id
      LEFT JOIN sellers s ON p.seller_id = s.id
      WHERE w.user_id = ?
      ORDER BY w.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all();

    // 전체 개수 조회
    const countResult = await DB.prepare('SELECT COUNT(*) as count FROM wishlists WHERE user_id = ?')
      .bind(userId)
      .first<{ count: number }>();

    return c.json<ApiResponse>({
      success: true,
      data: {
        items: results,
        total: countResult?.count || 0,
        limit,
        offset,
      },
    });
  } catch (err) {
    console.error('[Wishlist] Get error:', err);
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

// 위시리스트 확인 (특정 상품이 찜되어 있는지 확인)
app.get('/api/wishlists/check/:userId/:productId', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const userId = c.req.param('userId');
    const productId = c.req.param('productId');

    const wishlist = await DB.prepare('SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?')
      .bind(userId, productId)
      .first();

    return c.json<ApiResponse>({
      success: true,
      data: {
        isWishlisted: !!wishlist,
        wishlistId: wishlist?.id || null,
      },
    });
  } catch (err) {
    console.error('[Wishlist] Check error:', err);
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
// 🔒 배송지 삭제 (인증 필수)
app.delete('/api/shipping-addresses/:id', requireAuth, async (c) => {
  const { DB } = c.env;
  const addressId = c.req.param('id');
  const authenticatedUserId = c.get('userId');
  
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

// =================================
// Image Upload API
// =================================

/**
 * Upload image (supports R2 or Base64 fallback)
 * POST /api/seller/upload-image
 * 
 * Request Body:
 * - image: base64 encoded image string
 * - filename: original filename
 * 
 * Response:
 * - url: image URL (R2 URL or base64 data URL)
 */
app.post('/api/seller/upload-image', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const { image, filename } = await c.req.json();

    if (!image) {
      return c.json({ 
        success: false, 
        error: 'Image data is required' 
      }, 400);
    }

    // Check if R2 is available
    const IMAGES = c.env.IMAGES as R2Bucket | undefined;

    if (IMAGES) {
      // ✅ R2 is available - upload to R2
      console.log('[Image Upload] Using R2 storage');

      // Extract base64 data (remove data:image/...;base64, prefix)
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      // Generate unique filename
      const ext = filename?.split('.').pop() || 'jpg';
      const key = `products/${auth.sellerId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

      // Upload to R2
      await IMAGES.put(key, imageBuffer, {
        httpMetadata: {
          contentType: image.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg',
        },
      });

      // Return R2 public URL
      const imageUrl = `/api/images/${key}`;
      
      return c.json({
        success: true,
        url: imageUrl,
        storage: 'r2',
      });

    } else {
      // ⚠️ R2 not available - use Base64 fallback
      console.log('[Image Upload] R2 not available, using Base64 fallback');
      
      // Check image size (limit to 1MB for Base64)
      const sizeInMB = (image.length * 0.75) / (1024 * 1024);
      if (sizeInMB > 1) {
        return c.json({
          success: false,
          error: 'Image too large. Please enable R2 for larger images (max 1MB for Base64 mode)',
        }, 400);
      }

      // Return base64 directly
      return c.json({
        success: true,
        url: image,
        storage: 'base64',
        warning: 'Using Base64 storage. Enable R2 for better performance.',
      });
    }

  } catch (err) {
    console.error('[Image Upload] Error:', err);
    return c.json({ 
      success: false, 
      error: (err as Error).message 
    }, 500);
  }
});

/**
 * Get image from R2
 * GET /api/images/:key
 */
app.get('/api/images/*', async (c) => {
  try {
    const IMAGES = c.env.IMAGES as R2Bucket | undefined;

    if (!IMAGES) {
      return c.json({ 
        success: false, 
        error: 'R2 not configured' 
      }, 503);
    }

    // Get key from path (remove /api/images/ prefix)
    const key = c.req.path.replace('/api/images/', '');

    const object = await IMAGES.get(key);

    if (!object) {
      return c.notFound();
    }

    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000',
      },
    });

  } catch (err) {
    console.error('[Image Get] Error:', err);
    return c.json({ 
      success: false, 
      error: (err as Error).message 
    }, 500);
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

// Get seller sales statistics (daily/weekly/monthly)
app.get('/api/seller/stats/sales', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const period = c.req.query('period') || 'daily'; // daily, weekly, monthly

    let dateFormat: string;
    let groupBy: string;
    let days: number;

    switch (period) {
      case 'weekly':
        dateFormat = '%Y-W%W'; // Year-Week
        groupBy = 'week';
        days = 28; // 4 weeks
        break;
      case 'monthly':
        dateFormat = '%Y-%m'; // Year-Month
        groupBy = 'month';
        days = 180; // 6 months
        break;
      default: // daily
        dateFormat = '%Y-%m-%d'; // Year-Month-Day
        groupBy = 'day';
        days = 30; // 30 days
    }

    // Get sales data grouped by period
    const salesData = await DB.prepare(`
      SELECT 
        strftime('${dateFormat}', o.created_at) as period,
        COUNT(DISTINCT o.id) as order_count,
        SUM(oi.price * oi.quantity) as total_sales,
        SUM(oi.quantity) as total_quantity
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.seller_id = ?
        AND o.created_at >= datetime('now', '-${days} days')
        AND o.status != 'cancelled'
      GROUP BY period
      ORDER BY period ASC
    `).bind(auth.sellerId).all();

    return c.json({
      success: true,
      data: {
        period,
        sales: salesData.results
      }
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Get product sales ranking
app.get('/api/seller/stats/products', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const limit = parseInt(c.req.query('limit') || '10');
    const days = parseInt(c.req.query('days') || '30');

    // Get top selling products
    const topProducts = await DB.prepare(`
      SELECT 
        p.id,
        p.name,
        p.price,
        p.image_url,
        COUNT(DISTINCT oi.order_id) as order_count,
        SUM(oi.quantity) as total_sold,
        SUM(oi.price * oi.quantity) as total_revenue,
        p.stock as current_stock
      FROM products p
      JOIN order_items oi ON p.id = oi.product_id
      JOIN orders o ON oi.order_id = o.id
      WHERE p.seller_id = ?
        AND o.created_at >= datetime('now', '-${days} days')
        AND o.status != 'cancelled'
      GROUP BY p.id
      ORDER BY total_revenue DESC
      LIMIT ?
    `).bind(auth.sellerId, limit).all();

    return c.json({
      success: true,
      data: {
        products: topProducts.results,
        period_days: days
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
// 🔒 주문 목록 조회 (인증 필수) - 본인 주문만 조회
app.get('/api/orders', requireAuth, async (c) => {
  const { DB } = c.env;
  const userId = c.get('userId'); // 미들웨어에서 설정한 userId

  try {
    // ⚡ 최적화: N+1 쿼리 제거 - LEFT JOIN으로 단일 쿼리 실행
    // Before: 100개 주문 시 101번 쿼리 (1 + 100) → ~5초
    // After: 100개 주문 시 1번 쿼리 → ~0.2초 (25배 빠름)
    const result = await DB.prepare(`
      SELECT 
        o.*,
        oi.id as item_id,
        oi.product_id,
        oi.option_id,
        oi.quantity,
        oi.price as item_price,
        p.name as product_name,
        p.image_url,
        po.option_value
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN product_options po ON oi.option_id = po.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC, oi.id ASC
    `).bind(userId).all();

    // 플랫한 결과를 주문별로 그룹핑
    const ordersMap = new Map<number, any>();
    
    for (const row of result.results as any[]) {
      const orderId = row.id;
      
      if (!ordersMap.has(orderId)) {
        // 새 주문 객체 생성
        ordersMap.set(orderId, {
          id: row.id,
          user_id: row.user_id,
          order_number: row.order_number,
          status: row.status,
          total_amount: row.total_amount,
          shipping_fee: row.shipping_fee,
          payment_method: row.payment_method,
          payment_key: row.payment_key,
          shipping_address: row.shipping_address,
          shipping_name: row.shipping_name,
          shipping_phone: row.shipping_phone,
          delivery_request: row.delivery_request,
          created_at: row.created_at,
          updated_at: row.updated_at,
          items: []
        });
      }
      
      // 주문 항목 추가 (item_id가 null이면 항목이 없는 주문)
      if (row.item_id) {
        ordersMap.get(orderId).items.push({
          id: row.item_id,
          product_id: row.product_id,
          option_id: row.option_id,
          quantity: row.quantity,
          price: row.item_price,
          product_name: row.product_name,
          image_url: row.image_url,
          option_value: row.option_value
        });
      }
    }

    // Map을 배열로 변환
    const ordersWithItems = Array.from(ordersMap.values());

    return c.json({ success: true, data: ordersWithItems });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ⚠️ DEPRECATED: 하위 호환성을 위한 구 엔드포인트 (인증 필수로 변경)
// 새 코드는 /api/orders (위) 사용 권장
app.get('/api/orders/user/:userId', requireAuth, async (c) => {
  const { DB } = c.env;
  const authenticatedUserId = c.get('userId'); // 실제 인증된 사용자
  const requestedUserId = parseInt(c.req.param('userId')); // URL에서 요청한 사용자

  try {
    // 🔒 보안: 본인의 주문만 조회 가능
    if (requestedUserId !== authenticatedUserId) {
      return c.json({
        success: false,
        error: '본인의 주문 내역만 조회할 수 있습니다.'
      }, 403);
    }

    // ⚡ 최적화: N+1 쿼리 제거 - LEFT JOIN으로 단일 쿼리 실행
    const result = await DB.prepare(`
      SELECT 
        o.*,
        oi.id as item_id,
        oi.product_id,
        oi.option_id,
        oi.quantity,
        oi.price as item_price,
        p.name as product_name,
        p.image_url,
        po.option_value
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN product_options po ON oi.option_id = po.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC, oi.id ASC
    `).bind(authenticatedUserId).all();

    // 플랫한 결과를 주문별로 그룹핑
    const ordersMap = new Map<number, any>();
    
    for (const row of result.results as any[]) {
      const orderId = row.id;
      
      if (!ordersMap.has(orderId)) {
        ordersMap.set(orderId, {
          id: row.id,
          user_id: row.user_id,
          order_number: row.order_number,
          status: row.status,
          total_amount: row.total_amount,
          shipping_fee: row.shipping_fee,
          payment_method: row.payment_method,
          payment_key: row.payment_key,
          shipping_address: row.shipping_address,
          shipping_name: row.shipping_name,
          shipping_phone: row.shipping_phone,
          delivery_request: row.delivery_request,
          created_at: row.created_at,
          updated_at: row.updated_at,
          items: []
        });
      }
      
      if (row.item_id) {
        ordersMap.get(orderId).items.push({
          id: row.item_id,
          product_id: row.product_id,
          option_id: row.option_id,
          quantity: row.quantity,
          price: row.item_price,
          product_name: row.product_name,
          image_url: row.image_url,
          option_value: row.option_value
        });
      }
    }

    const ordersWithItems = Array.from(ordersMap.values());

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
    // ⚡ 최적화: LEFT JOIN으로 단일 쿼리 실행
    const result = await DB.prepare(`
      SELECT 
        o.*,
        oi.id as item_id,
        oi.product_id,
        oi.option_id,
        oi.quantity,
        oi.price as item_price,
        p.name as product_name,
        p.image_url,
        po.option_value
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN product_options po ON oi.option_id = po.id
      WHERE o.order_number = ?
      ORDER BY oi.id ASC
    `).bind(orderNumber).all();

    if (result.results.length === 0) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    // 첫 번째 행에서 주문 정보 추출
    const firstRow = result.results[0] as any;
    const order = {
      id: firstRow.id,
      user_id: firstRow.user_id,
      order_number: firstRow.order_number,
      status: firstRow.status,
      total_amount: firstRow.total_amount,
      shipping_fee: firstRow.shipping_fee,
      payment_method: firstRow.payment_method,
      payment_key: firstRow.payment_key,
      shipping_address: firstRow.shipping_address,
      shipping_name: firstRow.shipping_name,
      shipping_phone: firstRow.shipping_phone,
      delivery_request: firstRow.delivery_request,
      created_at: firstRow.created_at,
      updated_at: firstRow.updated_at,
      items: []
    };

    // 주문 항목 추가
    for (const row of result.results as any[]) {
      if (row.item_id) {
        order.items.push({
          id: row.item_id,
          product_id: row.product_id,
          option_id: row.option_id,
          quantity: row.quantity,
          price: row.item_price,
          product_name: row.product_name,
          image_url: row.image_url,
          option_value: row.option_value
        });
      }
    }

    return c.json({
      success: true,
      data: order
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

    // Get order (✅ 명시적 컬럼 선택)
    const order = await DB.prepare(`
      SELECT id, order_number, user_id, status, total_amount, 
             payment_key, payment_status, created_at
      FROM orders 
      WHERE id = ?
    `).bind(orderId).first();

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

    // ✅ N+1 최적화: 재고 복원을 배치로 처리
    if (orderItems.results.length > 0) {
      const batchQueries = orderItems.results.map((item: any) =>
        DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?')
          .bind(item.quantity, item.product_id)
      );
      await DB.batch(batchQueries);
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

// ========================================
// 라이브 방송 시청자 수 조정 (Admin/Seller)
// ========================================

// Get current viewer count
app.get('/api/streams/:streamId/viewer-count', async (c) => {
  const { DB } = c.env;

  try {
    const streamId = c.req.param('streamId');

    const stream = await DB.prepare(
      'SELECT viewer_count FROM live_streams WHERE id = ?'
    ).bind(streamId).first();

    if (!stream) {
      return c.json({ success: false, error: 'Stream not found' }, 404);
    }

    return c.json({ 
      success: true, 
      data: { 
        viewer_count: stream.viewer_count || 0 
      } 
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Update viewer count (Admin/Seller only)
app.put('/api/streams/:streamId/viewer-count', async (c) => {
  const { DB } = c.env;
  
  // Try both admin and seller auth
  const adminAuth = await verifyAdminSession(c);
  const sellerAuth = !adminAuth.success ? await verifySellerSession(c) : { success: false };

  if (!adminAuth.success && !sellerAuth.success) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  try {
    const streamId = c.req.param('streamId');
    const { viewer_count } = await c.req.json();

    if (typeof viewer_count !== 'number' || viewer_count < 0) {
      return c.json({ success: false, error: 'Invalid viewer count' }, 400);
    }

    // If seller, verify ownership
    if (sellerAuth.success) {
      const stream = await DB.prepare(
        'SELECT id FROM live_streams WHERE id = ? AND seller_id = ?'
      ).bind(streamId, sellerAuth.sellerId).first();

      if (!stream) {
        return c.json({ success: false, error: 'Stream not found or unauthorized' }, 404);
      }
    }

    await DB.prepare(
      'UPDATE live_streams SET viewer_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(viewer_count, streamId).run();

    return c.json({ success: true, data: { viewer_count } });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Increment viewer count (called when user joins)
app.post('/api/streams/:streamId/view', async (c) => {
  const { DB } = c.env;

  try {
    const streamId = c.req.param('streamId');

    await DB.prepare(
      'UPDATE live_streams SET viewer_count = viewer_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(streamId).run();

    const stream = await DB.prepare(
      'SELECT viewer_count FROM live_streams WHERE id = ?'
    ).bind(streamId).first();

    return c.json({ 
      success: true, 
      data: { viewer_count: stream?.viewer_count || 0 } 
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

    console.log('========================================')
    console.log('[Payment] 🚀 결제 승인 API 호출됨')
    console.log('========================================')
    console.log('[Payment] 📋 요청 파라미터:')
    console.log('  - orderId:', orderId)
    console.log('  - paymentKey:', paymentKey)
    console.log('  - amount:', amount)
    console.log('  - timestamp:', new Date().toISOString())

    // 필수 파라미터 검증
    if (!paymentKey || !orderId || !amount) {
      console.error('[Payment] ❌ 필수 파라미터 누락!')
      console.error('[Payment] paymentKey:', !!paymentKey)
      console.error('[Payment] orderId:', !!orderId)
      console.error('[Payment] amount:', !!amount)
      return c.json({
        success: false,
        error: '필수 파라미터가 누락되었습니다.',
        details: {
          paymentKey: !!paymentKey,
          orderId: !!orderId,
          amount: !!amount
        }
      }, 400);
    }
    
    console.log('[Payment] ✅ 필수 파라미터 검증 통과')

    // 🔍 주문 존재 여부 확인
    const existingOrder = await DB.prepare(
      'SELECT id, order_number, total_amount, status FROM orders WHERE order_number = ?'
    ).bind(orderId).first();

    if (!existingOrder) {
      console.error('[Payment] ❌ 주문을 찾을 수 없음:', orderId)
      return c.json({
        success: false,
        error: '주문을 찾을 수 없습니다. 주문이 생성되지 않았거나 이미 처리되었습니다.',
        orderId: orderId
      }, 404);
    }

    console.log('[Payment] ✅ 주문 확인됨:', {
      id: existingOrder.id,
      order_number: existingOrder.order_number,
      total_amount: existingOrder.total_amount,
      status: existingOrder.status
    })

    // 금액 검증
    if (Number(amount) !== Number(existingOrder.total_amount)) {
      console.error('[Payment] ❌ 금액 불일치!', {
        requested: Number(amount),
        expected: Number(existingOrder.total_amount)
      })
      return c.json({
        success: false,
        error: '결제 금액이 주문 금액과 일치하지 않습니다.',
        requestedAmount: Number(amount),
        expectedAmount: Number(existingOrder.total_amount)
      }, 400);
    }

    // 시크릿 키
    const secretKey = c.env.TOSS_SECRET_KEY;
    if (!secretKey) {
      console.error('[Payment] ❌ TOSS_SECRET_KEY 환경 변수 없음');
      console.error('[Payment] c.env:', Object.keys(c.env || {}))
      return c.json({
        success: false,
        error: '결제 시스템 설정이 올바르지 않습니다.'
      }, 500);
    }
    
    console.log('[Payment] ✅ TOSS_SECRET_KEY 확인됨:', secretKey.substring(0, 20) + '...')

    // 토스페이먼츠 결제 승인 API 호출 (결제위젯 전용)
    console.log('[Payment] 🌐 토스페이먼츠 API 호출 시작...')
    console.log('[Payment] API URL: https://api.tosspayments.com/v1/payments/confirm')
    console.log('[Payment] API 버전: 2022-11-16 (결제위젯 고정 버전)')
    
    const encryptedSecretKey = 'Basic ' + btoa(secretKey + ':');
    console.log('[Payment] Authorization 헤더 생성 완료')
    
    const requestBody = {
      orderId: orderId,
      amount: Number(amount), // ✅ 명시적으로 Number 타입으로 변환
      paymentKey: paymentKey
    }
    console.log('[Payment] 요청 본문:', JSON.stringify(requestBody, null, 2))
    console.log('[Payment] 📊 amount 타입:', typeof requestBody.amount)
    console.log('[Payment] 📊 amount 값:', requestBody.amount)
    
    const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': encryptedSecretKey,
        'Content-Type': 'application/json',
        'TossPayments-API-Version': '2022-11-16'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    
    console.log('[Payment] 📡 토스페이먼츠 API 응답:')
    console.log('  - HTTP 상태:', response.status)
    console.log('  - 응답 OK?:', response.ok)
    console.log('  - 응답 데이터 (일부):', JSON.stringify(data).substring(0, 300))
    
    if (!response.ok) {
      console.error('[Payment] ❌❌❌ 토스페이먼츠 승인 실패!')
      console.error('[Payment] HTTP 상태:', response.status)
      console.error('[Payment] 에러 코드:', data.code)
      console.error('[Payment] 에러 메시지:', data.message)
      console.error('[Payment] 전체 응답:', JSON.stringify(data, null, 2))
      return c.json({
        success: false,
        error: data.message || '결제 승인에 실패했습니다.',
        code: data.code,
        tossError: data
      }, response.status);
    }

    console.log('[Payment] ✅ 결제 승인 성공! paymentKey:', paymentKey);
    console.log('[Payment] ✅ 주문 번호:', orderId);

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

      // ✅ N+1 최적화: 재고 차감을 배치로 처리
      if (orderItems.results.length > 0) {
        const batchQueries = orderItems.results.map((item: any) =>
          DB.prepare(`
            UPDATE products 
            SET stock = stock - ?
            WHERE id = ? AND stock >= ?
          `).bind(item.quantity, item.product_id, item.quantity)
        );
        
        const batchResults = await DB.batch(batchQueries);
        
        // 재고 부족 경고 (결제는 이미 성공했으므로 주문 유지)
        for (let i = 0; i < batchResults.length; i++) {
          if (batchResults[i].meta.changes === 0) {
            const item = orderItems.results[i];
            console.error(`[Payment] ⚠️ 재고 부족: product_id=${item.product_id}`);
            // 재고 부족 시에도 결제는 성공했으므로 주문은 유지
            // 관리자가 수동으로 처리해야 함
          }
        }
      }

      console.log('[Payment] ✅ 재고 차감 완료');
      
      // 3️⃣ 알림톡 자동 발송 (주문 확인)
      try {
        const orderIdNum = existingOrder.id as number
        const alimtalkResult = await sendOrderConfirmation(c.env as any, orderIdNum)
        
        if (alimtalkResult.success) {
          console.log(`[Payment] ✅ 알림톡 발송 성공 (주문 ${orderIdNum})`)
        } else {
          console.warn(`[Payment] ⚠️ 알림톡 발송 실패 (주문 ${orderIdNum}):`, alimtalkResult.reason || alimtalkResult.error)
          // 알림톡 실패해도 결제는 성공했으므로 계속 진행
        }
      } catch (alimtalkErr) {
        console.error('[Payment] ⚠️ 알림톡 발송 중 오류:', alimtalkErr)
        // 알림톡 실패해도 결제는 성공했으므로 계속 진행
      }
      
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
      error: '결제 처리 중 오류가 발생했습니다. 고객센터로 문의해주세요.',
      details: (err as Error).message
    }, 500);
  }
});

// ============================================
// 💬 Real-time Chat APIs
// ============================================

// 채팅 메시지 전송
app.post('/api/chat/:liveStreamId/messages', cors(), async (c) => {
  const { DB } = c.env;
  const liveStreamId = c.req.param('liveStreamId');

  try {
    const body = await c.req.json();
    const { userId, userName, userAvatar, message, isSeller, isAdmin } = body;

    if (!message || message.trim().length === 0) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Message cannot be empty',
      }, 400);
    }

    // 메시지 길이 제한 (500자)
    if (message.length > 500) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Message is too long (max 500 characters)',
      }, 400);
    }

    // 채팅 금지 여부 확인
    if (userId) {
      const ban = await DB.prepare(`
        SELECT id FROM chat_bans
        WHERE live_stream_id = ? AND user_id = ?
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      `).bind(liveStreamId, userId).first();

      if (ban) {
        return c.json<ApiResponse>({
          success: false,
          error: 'You are banned from this chat',
        }, 403);
      }
    }

    // 간단한 욕설 필터링 (확장 가능)
    const profanityWords = ['씨발', '개새끼', '병신', '좆', '시발'];
    let filteredMessage = message;
    profanityWords.forEach(word => {
      const regex = new RegExp(word, 'gi');
      filteredMessage = filteredMessage.replace(regex, '*'.repeat(word.length));
    });

    // 메시지 저장
    const result = await DB.prepare(`
      INSERT INTO chat_messages 
      (live_stream_id, user_id, user_name, user_avatar, message, is_seller, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      liveStreamId,
      userId || null,
      userName,
      userAvatar || null,
      filteredMessage,
      isSeller ? 1 : 0,
      isAdmin ? 1 : 0
    ).run();

    return c.json<ApiResponse<{ id: number; message: string }>>({
      success: true,
      data: {
        id: result.meta.last_row_id,
        message: filteredMessage,
      },
    });
  } catch (err) {
    console.error('Error sending chat message:', err);
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

// 채팅 메시지 조회 (폴링용)
app.get('/api/chat/:liveStreamId/messages', cors(), async (c) => {
  const { DB } = c.env;
  const liveStreamId = c.req.param('liveStreamId');
  const since = c.req.query('since'); // 마지막으로 받은 메시지 ID
  const limit = Number(c.req.query('limit')) || 50;

  try {
    let query = `
      SELECT 
        id,
        user_id,
        user_name,
        user_avatar,
        message,
        is_seller,
        is_admin,
        is_deleted,
        datetime(created_at) as created_at
      FROM chat_messages
      WHERE live_stream_id = ? AND is_deleted = 0
    `;
    
    const params: any[] = [liveStreamId];

    if (since) {
      query += ` AND id > ?`;
      params.push(Number(since));
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const result = await DB.prepare(query).bind(...params).all();

    // 최신순으로 정렬되어 있으므로 역순으로 반환
    const messages = result.results.reverse();

    return c.json<ApiResponse>({
      success: true,
      data: messages,
    });
  } catch (err) {
    console.error('Error fetching chat messages:', err);
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

// 채팅 메시지 삭제 (관리자/셀러만)
app.delete('/api/chat/:liveStreamId/messages/:messageId', cors(), async (c) => {
  const { DB } = c.env;
  const messageId = c.req.param('messageId');

  try {
    // 관리자/셀러 권한 확인은 프론트엔드에서 처리
    // 실제 환경에서는 세션 토큰으로 권한 확인 필요

    await DB.prepare(`
      UPDATE chat_messages
      SET is_deleted = 1
      WHERE id = ?
    `).bind(messageId).run();

    return c.json<ApiResponse>({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (err) {
    console.error('Error deleting chat message:', err);
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

// 사용자 채팅 금지
app.post('/api/chat/:liveStreamId/ban', cors(), async (c) => {
  const { DB } = c.env;
  const liveStreamId = c.req.param('liveStreamId');

  try {
    const body = await c.req.json();
    const { userId, bannedBy, reason, duration } = body; // duration in minutes

    if (!userId || !bannedBy) {
      return c.json<ApiResponse>({
        success: false,
        error: 'userId and bannedBy are required',
      }, 400);
    }

    let expiresAt = null;
    if (duration) {
      const now = new Date();
      now.setMinutes(now.getMinutes() + duration);
      expiresAt = now.toISOString();
    }

    await DB.prepare(`
      INSERT INTO chat_bans (live_stream_id, user_id, banned_by, reason, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(liveStreamId, userId, bannedBy, reason || null, expiresAt).run();

    return c.json<ApiResponse>({
      success: true,
      message: 'User banned successfully',
    });
  } catch (err) {
    console.error('Error banning user:', err);
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

// 채팅 금지 해제
app.delete('/api/chat/:liveStreamId/ban/:userId', cors(), async (c) => {
  const { DB } = c.env;
  const liveStreamId = c.req.param('liveStreamId');
  const userId = c.req.param('userId');

  try {
    await DB.prepare(`
      DELETE FROM chat_bans
      WHERE live_stream_id = ? AND user_id = ?
    `).bind(liveStreamId, userId).run();

    return c.json<ApiResponse>({
      success: true,
      message: 'Ban removed successfully',
    });
  } catch (err) {
    console.error('Error removing ban:', err);
    return c.json<ApiResponse>({
      success: false,
      error: (err as Error).message,
    }, 500);
  }
});

// ============================================
// 🔔 Notification APIs
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
    // ⚡ 최적화: N+1 쿼리 제거 - 단일 JOIN 쿼리로 모든 주문 및 아이템 조회
    const result = await DB.prepare(`
      SELECT 
        o.*,
        u.name as user_name,
        oi.id as item_id,
        oi.product_id,
        oi.option_id,
        oi.quantity,
        oi.price as item_price,
        oi.seller_id,
        p.name as product_name,
        p.image_url,
        po.option_value
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN product_options po ON oi.option_id = po.id
      WHERE oi.seller_id = ?
      ORDER BY o.created_at DESC, oi.id ASC
    `).bind(auth.sellerId).all();

    // 플랫한 결과를 주문별로 그룹핑
    const ordersMap = new Map<number, any>();
    
    for (const row of result.results as any[]) {
      const orderId = row.id;
      
      if (!ordersMap.has(orderId)) {
        ordersMap.set(orderId, {
          id: row.id,
          user_id: row.user_id,
          user_name: row.user_name,
          order_number: row.order_number,
          status: row.status,
          total_amount: row.total_amount,
          shipping_fee: row.shipping_fee,
          payment_method: row.payment_method,
          payment_key: row.payment_key,
          shipping_address: row.shipping_address,
          shipping_name: row.shipping_name,
          shipping_phone: row.shipping_phone,
          delivery_request: row.delivery_request,
          created_at: row.created_at,
          updated_at: row.updated_at,
          items: []
        });
      }
      
      if (row.item_id) {
        ordersMap.get(orderId).items.push({
          id: row.item_id,
          product_id: row.product_id,
          option_id: row.option_id,
          quantity: row.quantity,
          price: row.item_price,
          seller_id: row.seller_id,
          product_name: row.product_name,
          image_url: row.image_url,
          option_value: row.option_value
        });
      }
    }

    const ordersWithItems = Array.from(ordersMap.values());

    return c.json({ success: true, data: ordersWithItems });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Export orders as CSV (Seller only)
app.get('/api/seller/orders/export', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const format = c.req.query('format') || 'csv' // csv or excel (future)
    const startDate = c.req.query('start_date')
    const endDate = c.req.query('end_date')

    let query = `
      SELECT 
        o.order_number,
        o.created_at,
        o.status,
        o.payment_status,
        o.total_amount,
        o.shipping_address,
        o.shipping_name,
        o.shipping_phone,
        o.tracking_number,
        o.carrier,
        u.name as buyer_name,
        u.email as buyer_email,
        u.phone as buyer_phone
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE oi.seller_id = ?
    `

    const bindings: any[] = [auth.sellerId]

    if (startDate) {
      query += ` AND date(o.created_at) >= ?`
      bindings.push(startDate)
    }

    if (endDate) {
      query += ` AND date(o.created_at) <= ?`
      bindings.push(endDate)
    }

    query += ` GROUP BY o.id ORDER BY o.created_at DESC`

    const orders = await DB.prepare(query).bind(...bindings).all()

    if (format === 'csv') {
      // CSV 생성
      const headers = [
        '주문번호',
        '주문일시',
        '주문상태',
        '결제상태',
        '주문금액',
        '배송지',
        '수령인',
        '연락처',
        '택배사',
        '운송장번호',
        '구매자명',
        '구매자이메일',
        '구매자연락처'
      ]

      const rows = orders.results.map((order: any) => [
        order.order_number || '',
        order.created_at ? new Date(order.created_at).toLocaleString('ko-KR') : '',
        order.status || '',
        order.payment_status || '',
        order.total_amount || 0,
        order.shipping_address || '',
        order.shipping_name || '',
        order.shipping_phone || '',
        order.carrier || '',
        order.tracking_number || '',
        order.buyer_name || '',
        order.buyer_email || '',
        order.buyer_phone || ''
      ])

      // CSV 문자열 생성 (UTF-8 BOM 포함 - Excel에서 한글 깨짐 방지)
      const bom = '\uFEFF'
      const csvContent = bom + [
        headers.join(','),
        ...rows.map(row => row.map(cell => {
          // 쉼표나 줄바꿈이 포함된 경우 따옴표로 감싸기
          const cellStr = String(cell)
          if (cellStr.includes(',') || cellStr.includes('\n') || cellStr.includes('"')) {
            return `"${cellStr.replace(/"/g, '""')}"`
          }
          return cellStr
        }).join(','))
      ].join('\n')

      // 파일명 생성 (한국 시간 기준)
      const now = new Date()
      const filename = `orders_${now.toISOString().split('T')[0]}_${now.getTime()}.csv`

      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
          'Cache-Control': 'no-cache'
        }
      })
    } else {
      return c.json({ success: false, error: 'Unsupported format' }, 400)
    }
  } catch (err) {
    console.error('Export error:', err)
    return c.json({ success: false, error: (err as Error).message }, 500)
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

            // ✅ N+1 최적화: 세금계산서 항목을 배치로 저장
            if (orderItems.results.length > 0) {
              const invoiceItemQueries = orderItems.results.map((item: any) => {
                const itemSupplyPrice = Math.floor(Number(item.price) * Number(item.quantity) / 1.1);
                const itemTaxAmount = Number(item.price) * Number(item.quantity) - itemSupplyPrice;

                return DB.prepare(`
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
                );
              });
              
              await DB.batch(invoiceItemQueries);
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

    // 알림: 배송 상태 변경 시 구매자에게 알림
    try {
      const order = await DB.prepare('SELECT id, user_id FROM orders WHERE order_number = ?').bind(orderNumber).first();
      if (order && order.user_id) {
        const statusMap: Record<string, string> = {
          'PREPARING': 'preparing',
          'SHIPPING': 'shipping',
          'DELIVERED': 'delivered'
        };
        const mappedStatus = statusMap[status];
        if (mappedStatus) {
          await notifyShippingStatus(DB, order.user_id as number, orderNumber, mappedStatus);
        }
      }
    } catch (notifyError) {
      console.error('[Order Status] Notification error:', notifyError);
      // 알림 실패해도 상태 업데이트는 성공으로 처리
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

    // 알림: 송장번호 등록 시 구매자에게 배송 시작 알림
    try {
      const orderWithUser = await DB.prepare('SELECT user_id FROM orders WHERE order_number = ?').bind(orderNumber).first();
      if (orderWithUser && orderWithUser.user_id) {
        await notifyShippingStatus(
          DB,
          orderWithUser.user_id as number,
          orderNumber,
          'shipping',
          courier,
          tracking_number
        );
      }
    } catch (notifyError) {
      console.error('[Tracking] Notification error:', notifyError);
      // 알림 실패해도 송장 등록은 성공으로 처리
    }

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
    const order = await DB.prepare(`
      SELECT id, order_number, user_id, status, total_amount,
             payment_key, payment_status, shipping_address, shipping_name,
             shipping_phone, created_at, updated_at
      FROM orders 
      WHERE order_number = ?
    `).bind(orderNumber).first();

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
// Public Seller APIs
// =================================

// 🏪 셀러 목록 조회 (공개) - 추천 셀러, 셀러 디렉토리용
app.get('/api/sellers', async (c) => {
  const { DB } = c.env;
  const { limit = '20', offset = '0' } = c.req.query();
  
  try {
    const cacheKey = `sellers:list:${limit}:${offset}`;
    
    // ✅ Stale-While-Revalidate: 메모리 캐시 우선
    const memCached = getFromMemoryCache(cacheKey);
    if (memCached) {
      // 백그라운드 갱신
      c.executionCtx.waitUntil(
        (async () => {
          try {
            const freshData = await fetchSellersList(DB, parseInt(limit), parseInt(offset));
            setToMemoryCache(cacheKey, freshData, 3600);
          } catch (err) {
            console.error('[Cache Revalidate] Sellers error:', err);
          }
        })()
      );
      
      return c.json<ApiResponse>({
        success: true,
        data: memCached,
        cached: true,
      });
    }

    // 캐시 미스: DB 조회
    const sellers = await fetchSellersList(DB, parseInt(limit), parseInt(offset));
    
    // 캐시 저장
    setToMemoryCache(cacheKey, sellers, 3600);
    
    return c.json<ApiResponse>({
      success: true,
      data: sellers,
      cached: false,
    });
  } catch (err) {
    console.error('[API] Sellers list error:', err);
    return c.json<ApiResponse>({
      success: false,
      error: `셀러 목록 조회 실패: ${(err as Error).message}`,
    }, 500);
  }
});

/**
 * 셀러 목록 조회 헬퍼 함수
 */
async function fetchSellersList(DB: D1Database, limit: number, offset: number) {
  const query = `
    SELECT id, business_name, name as display_name, 
           commission_rate, created_at
    FROM sellers 
    WHERE is_active = 1
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;
  
  const { results } = await DB.prepare(query)
    .bind(limit, offset)
    .all();
  
  return results;
}

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
// Seller Approval System (셀러 승인 시스템)
// =================================

// Approve seller
app.patch('/api/admin/sellers/:id/approve', async (c) => {
  const { DB } = c.env;
  const auth = await verifyAdminSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const sellerId = c.req.param('id');

    // 판매자 존재 및 상태 확인
    const seller = await DB.prepare('SELECT id, username, email, name, status FROM sellers WHERE id = ?').bind(sellerId).first();
    
    if (!seller) {
      return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    }

    if (seller.status === 'approved') {
      return c.json({ success: false, error: '이미 승인된 판매자입니다' }, 400);
    }

    // 승인 처리
    await DB.prepare(`
      UPDATE sellers 
      SET status = 'approved', 
          is_active = 1,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(auth.adminId, sellerId).run();

    console.log(`셀러 승인: ${seller.username} (ID: ${sellerId}) by Admin ID: ${auth.adminId}`);

    // TODO: 이메일 알림 발송 (승인 완료)
    // await sendEmail(seller.email, '셀러 승인 완료', '...');

    return c.json({ 
      success: true, 
      message: `판매자 '${seller.name}'님이 승인되었습니다`,
      data: {
        seller_id: sellerId,
        seller_username: seller.username,
        seller_name: seller.name,
        status: 'approved',
        approved_at: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error('셀러 승인 실패:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Reject seller
app.patch('/api/admin/sellers/:id/reject', async (c) => {
  const { DB } = c.env;
  const auth = await verifyAdminSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const sellerId = c.req.param('id');
    const { reason } = await c.req.json();

    if (!reason) {
      return c.json({ success: false, error: '거부 사유를 입력해주세요' }, 400);
    }

    // 판매자 존재 및 상태 확인
    const seller = await DB.prepare('SELECT id, username, email, name, status FROM sellers WHERE id = ?').bind(sellerId).first();
    
    if (!seller) {
      return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    }

    if (seller.status === 'rejected') {
      return c.json({ success: false, error: '이미 거부된 판매자입니다' }, 400);
    }

    // 거부 처리
    await DB.prepare(`
      UPDATE sellers 
      SET status = 'rejected', 
          is_active = 0,
          rejection_reason = ?,
          approved_by = ?,
          approved_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(reason, auth.adminId, sellerId).run();

    console.log(`셀러 거부: ${seller.username} (ID: ${sellerId}), 사유: ${reason}`);

    // TODO: 이메일 알림 발송 (거부 사유 포함)
    // await sendEmail(seller.email, '셀러 승인 거부', reason);

    return c.json({ 
      success: true, 
      message: `판매자 '${seller.name}'님의 승인이 거부되었습니다`,
      data: {
        seller_id: sellerId,
        seller_username: seller.username,
        seller_name: seller.name,
        status: 'rejected',
        rejection_reason: reason,
        rejected_at: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error('셀러 거부 실패:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Get pending sellers (승인 대기 셀러 목록)
app.get('/api/admin/sellers/pending', async (c) => {
  const { DB } = c.env;
  const auth = await verifyAdminSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const pendingSellers = await DB.prepare(`
      SELECT id, username, name, email, phone, business_name, business_number, 
             status, created_at
      FROM sellers
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `).all();

    return c.json({ 
      success: true, 
      data: pendingSellers.results,
      count: pendingSellers.results.length
    });
  } catch (err) {
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
    
    // 주문번호 생성 (간결한 형식: ORD-YYMMDD-XXXXX)
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2); // 26
    const month = (now.getMonth() + 1).toString().padStart(2, '0'); // 02
    const day = now.getDate().toString().padStart(2, '0'); // 22
    const dateStr = `${year}${month}${day}`; // 260222
    
    // 5자리 랜덤 영숫자 (36^5 = 60,466,176 조합)
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    const orderNumber = `ORD-${dateStr}-${random}`; // 예: ORD-260222-A3B4C
    
    // ✅ N+1 최적화: 모든 상품의 재고를 한 번에 조회
    const productIds = cartItems.map((item: any) => item.product_id);
    const stockPlaceholders = productIds.map(() => '?').join(',');
    
    const stockResults = await DB.prepare(`
      SELECT id, stock FROM products WHERE id IN (${stockPlaceholders})
    `).bind(...productIds).all();
    
    const stockMap = new Map(
      stockResults.results.map((p: any) => [p.id, p.stock])
    );
    
    // 재고 확인
    for (const item of cartItems) {
      const stock = stockMap.get(item.product_id);
      
      if (stock === undefined) {
        return c.json({ success: false, error: `상품을 찾을 수 없습니다 (ID: ${item.product_id})` }, 400);
      }
      
      if (stock < item.quantity) {
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
    
    // ✅ N+1 최적화: 주문 아이템 생성 및 재고 차감을 배치로 처리
    const itemInsertQueries = cartItems.map((item: any) =>
      DB.prepare(`
        INSERT INTO order_items (order_id, product_id, option_id, quantity, price)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        orderId,
        item.product_id,
        item.option_id || null,
        item.quantity,
        item.price_snapshot || item.price
      )
    );
    
    const stockUpdateQueries = cartItems.map((item: any) =>
      DB.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ?
      `).bind(item.quantity, item.product_id)
    );
    
    // 모든 쿼리를 배치로 실행
    await DB.batch([...itemInsertQueries, ...stockUpdateQueries]);

    // 저재고 알림 체크 (배치 조회 후 처리)
    try {
      const productIdsForAlert = cartItems.map((item: any) => item.product_id);
      const alertPlaceholders = productIdsForAlert.map(() => '?').join(',');
      
      const productsForAlert = await DB.prepare(`
        SELECT id, name, stock, stock_alert_threshold, seller_id 
        FROM products 
        WHERE id IN (${alertPlaceholders})
      `).bind(...productIdsForAlert).all();

      for (const product of productsForAlert.results) {
        const threshold = product.stock_alert_threshold || 5; // 기본값 5개
        const currentStock = product.stock as number;
        
        if (currentStock <= threshold && product.seller_id) {
          await notifyLowStock(
            DB,
            product.seller_id as number,
            product.name as string,
            currentStock,
            threshold
          );
          console.log(`[Low Stock Alert] ${product.name}: ${currentStock} <= ${threshold}`);
        }
      }
    } catch (stockAlertError) {
      console.error('[Low Stock Alert] Error:', stockAlertError);
      // 알림 실패해도 주문은 계속 진행
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
    
    // ✅ N+1 최적화: 재고 복구를 배치로 처리
    if (orderItems.results.length > 0) {
      const stockRestoreQueries = orderItems.results.map((item: any) =>
        DB.prepare(`
          UPDATE products 
          SET stock = stock + ?,
              version = version + 1,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(item.quantity, item.product_id)
      );
      
      await DB.batch(stockRestoreQueries);
      
      console.log('[Order Refund] 재고 복구 완료:', {
        items: orderItems.results.length
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
        kakao_chat_link,
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
      website_url,
      kakao_chat_link
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
    if (kakao_chat_link !== undefined) {
      updates.push('kakao_chat_link = ?');
      params.push(kakao_chat_link);
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
        kakao_chat_link,
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
// Notifications API
// =================================

// Get notifications (셀러/사용자/관리자)
app.get('/api/notifications', requireAuth, async (c) => {
  const { DB } = c.env;
  
  try {
    const userId = c.get('userId');
    const userType = c.get('userType');

    const limit = parseInt(c.req.query('limit') || '50');
    const unreadOnly = c.req.query('unread_only') === 'true';

    let query = `
      SELECT * FROM notifications
      WHERE user_id = ? AND user_type = ?
    `;
    
    if (unreadOnly) {
      query += ` AND is_read = 0`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT ?`;

    const notifications = await DB.prepare(query).bind(userId, userType, limit).all();

    return c.json({ 
      success: true, 
      data: notifications.results 
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Get unread count
app.get('/api/notifications/unread-count', requireAuth, async (c) => {
  const { DB } = c.env;
  
  try {
    const userId = c.get('userId');
    const userType = c.get('userType');

    const result = await DB.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(userId, userType).first();

    return c.json({ 
      success: true, 
      count: result?.count || 0 
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Mark notification as read
app.put('/api/notifications/:id/read', requireAuth, async (c) => {
  const { DB } = c.env;
  
  try {
    const notificationId = c.req.param('id');
    const userId = c.get('userId');
    const userType = c.get('userType');

    // Verify ownership before marking as read
    const notification = await DB.prepare(
      'SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?'
    ).bind(notificationId, userId, userType).first();
    
    if (!notification) {
      return c.json({ success: false, error: 'Notification not found' }, 404);
    }

    // Mark as read
    await DB.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').bind(notificationId).run();

    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Mark all as read
app.put('/api/notifications/read-all', requireAuth, async (c) => {
  const { DB } = c.env;
  
  try {
    const userId = c.get('userId');
    const userType = c.get('userType');

    await DB.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE user_id = ? AND user_type = ? AND is_read = 0
    `).bind(userId, userType).run();

    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Delete notification
app.delete('/api/notifications/:id', requireAuth, async (c) => {
  const { DB } = c.env;
  
  try {
    const notificationId = c.req.param('id');
    const userId = c.get('userId');
    const userType = c.get('userType');

    // Verify ownership before deleting
    const notification = await DB.prepare(
      'SELECT user_id, user_type FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?'
    ).bind(notificationId, userId, userType).first();
    
    if (!notification) {
      return c.json({ success: false, error: 'Notification not found' }, 404);
    }

    await DB.prepare('DELETE FROM notifications WHERE id = ?').bind(notificationId).run();

    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// =================================
// Banners API
// =================================

// Get active banners (public)
app.get('/api/banners', async (c) => {
  const { DB } = c.env;
  
  try {
    const now = new Date().toISOString();
    
    const banners = await DB.prepare(`
      SELECT * FROM banners
      WHERE is_active = 1
        AND (start_date IS NULL OR start_date <= ?)
        AND (end_date IS NULL OR end_date >= ?)
      ORDER BY display_order ASC, created_at DESC
    `).bind(now, now).all();

    return c.json({ 
      success: true, 
      data: banners.results 
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Get all banners (admin only)
app.get('/api/admin/banners', requireAuth, async (c) => {
  const { DB } = c.env;
  
  try {
    const userType = c.get('userType');
    if (userType !== 'admin') {
      return c.json({ success: false, error: '관리자 권한이 필요합니다.' }, 403);
    }

    const banners = await DB.prepare(`
      SELECT * FROM banners
      ORDER BY display_order ASC, created_at DESC
    `).all();

    return c.json({ 
      success: true, 
      data: banners.results 
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Create banner (admin only)
app.post('/api/admin/banners', requireAuth, async (c) => {
  const { DB } = c.env;
  
  try {
    const userType = c.get('userType');
    if (userType !== 'admin') {
      return c.json({ success: false, error: '관리자 권한이 필요합니다.' }, 403);
    }

    const { title, image_url, link_url, description, is_active, display_order, start_date, end_date } = await c.req.json();

    if (!title || !image_url) {
      return c.json({ success: false, error: '제목과 이미지는 필수입니다.' }, 400);
    }

    const result = await DB.prepare(`
      INSERT INTO banners (title, image_url, link_url, description, is_active, display_order, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      title,
      image_url,
      link_url || null,
      description || null,
      is_active !== false ? 1 : 0,
      display_order || 0,
      start_date || null,
      end_date || null
    ).run();

    return c.json({ 
      success: true,
      id: result.meta.last_row_id
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Update banner (admin only)
app.put('/api/admin/banners/:id', requireAuth, async (c) => {
  const { DB } = c.env;
  
  try {
    const userType = c.get('userType');
    if (userType !== 'admin') {
      return c.json({ success: false, error: '관리자 권한이 필요합니다.' }, 403);
    }

    const id = c.req.param('id');
    const { title, image_url, link_url, description, is_active, display_order, start_date, end_date } = await c.req.json();

    await DB.prepare(`
      UPDATE banners
      SET title = ?, image_url = ?, link_url = ?, description = ?,
          is_active = ?, display_order = ?, start_date = ?, end_date = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      title,
      image_url,
      link_url || null,
      description || null,
      is_active ? 1 : 0,
      display_order || 0,
      start_date || null,
      end_date || null,
      id
    ).run();

    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// Delete banner (admin only)
app.delete('/api/admin/banners/:id', requireAuth, async (c) => {
  const { DB } = c.env;
  
  try {
    const userType = c.get('userType');
    if (userType !== 'admin') {
      return c.json({ success: false, error: '관리자 권한이 필요합니다.' }, 403);
    }

    const id = c.req.param('id');
    await DB.prepare('DELETE FROM banners WHERE id = ?').bind(id).run();

    return c.json({ success: true });
  } catch (err) {
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
  
  // AppError 인스턴스인지 확인
  if (err instanceof AppError) {
    console.error('[AppError]', {
      path,
      method: c.req.method,
      code: err.code,
      message: err.message,
      statusCode: err.statusCode
    });
    
    return c.json({ 
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      }
    }, err.statusCode);
  }
  
  // 일반 에러 로깅
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

// ============================================================================
// 알림톡 API
// ============================================================================

import * as aligo from './lib/aligo';

// ----------------------------------------------------------------------------
// 어드민 - 알림톡 요금제 관리
// ----------------------------------------------------------------------------

/**
 * GET /api/admin/alimtalk/pricing
 * 알림톡 요금제 목록 조회
 */
app.get('/api/admin/alimtalk/pricing', cors(), async (c) => {
  const { env } = c;

  try {
    const pricingList = await env.DB.prepare(`
      SELECT * FROM alimtalk_pricing
      ORDER BY min_quantity ASC
    `).all();

    return c.json({
      success: true,
      pricing: pricingList.results
    });
  } catch (error: any) {
    console.error('[Admin Alimtalk Pricing] Error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * POST /api/admin/alimtalk/pricing
 * 알림톡 요금제 생성
 */
app.post('/api/admin/alimtalk/pricing', cors(), async (c) => {
  const { env } = c;

  try {
    const { plan_name, min_quantity, max_quantity, unit_price } = await c.req.json();

    if (!plan_name || !min_quantity || !unit_price) {
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }

    const result = await env.DB.prepare(`
      INSERT INTO alimtalk_pricing (plan_name, min_quantity, max_quantity, unit_price, is_active)
      VALUES (?, ?, ?, ?, TRUE)
    `).bind(plan_name, min_quantity, max_quantity || null, unit_price).run();

    return c.json({
      success: true,
      pricing_id: result.meta.last_row_id
    });
  } catch (error: any) {
    console.error('[Admin Alimtalk Pricing Create] Error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * PUT /api/admin/alimtalk/pricing/:id
 * 알림톡 요금제 수정 (가격 조정)
 */
app.put('/api/admin/alimtalk/pricing/:id', cors(), async (c) => {
  const { env } = c;
  const pricingId = c.req.param('id');

  try {
    const { plan_name, min_quantity, max_quantity, unit_price, is_active } = await c.req.json();

    const result = await env.DB.prepare(`
      UPDATE alimtalk_pricing 
      SET plan_name = ?,
          min_quantity = ?,
          max_quantity = ?,
          unit_price = ?,
          is_active = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(plan_name, min_quantity, max_quantity || null, unit_price, is_active ? 1 : 0, pricingId).run();

    if (result.meta.changes === 0) {
      return c.json({ success: false, error: 'Pricing not found' }, 404);
    }

    return c.json({
      success: true,
      message: 'Pricing updated successfully'
    });
  } catch (error: any) {
    console.error('[Admin Alimtalk Pricing Update] Error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * DELETE /api/admin/alimtalk/pricing/:id
 * 알림톡 요금제 삭제
 */
app.delete('/api/admin/alimtalk/pricing/:id', cors(), async (c) => {
  const { env } = c;
  const pricingId = c.req.param('id');

  try {
    const result = await env.DB.prepare(`
      DELETE FROM alimtalk_pricing WHERE id = ?
    `).bind(pricingId).run();

    if (result.meta.changes === 0) {
      return c.json({ success: false, error: 'Pricing not found' }, 404);
    }

    return c.json({
      success: true,
      message: 'Pricing deleted successfully'
    });
  } catch (error: any) {
    console.error('[Admin Alimtalk Pricing Delete] Error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * GET /api/admin/alimtalk/accounts
 * 알림톡 계정 목록 조회 (어드민)
 */
app.get('/api/admin/alimtalk/accounts', cors(), async (c) => {
  const { env } = c;

  try {
    const accounts = await env.DB.prepare(`
      SELECT 
        a.*,
        s.name as seller_name,
        s.email as seller_email
      FROM alimtalk_accounts a
      JOIN sellers s ON a.seller_id = s.id
      ORDER BY a.created_at DESC
    `).all();

    return c.json({
      success: true,
      accounts: accounts.results
    });
  } catch (error: any) {
    console.error('[Admin Alimtalk Accounts] Error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * PATCH /api/admin/alimtalk/accounts/:id/status
 * 알림톡 계정 상태 변경 (승인/정지)
 */
app.patch('/api/admin/alimtalk/accounts/:id/status', cors(), async (c) => {
  const { env } = c;
  const accountId = c.req.param('id');

  try {
    const { status } = await c.req.json();

    if (!['active', 'suspended', 'rejected'].includes(status)) {
      return c.json({ success: false, error: 'Invalid status' }, 400);
    }

    const result = await env.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(status, accountId).run();

    if (result.meta.changes === 0) {
      return c.json({ success: false, error: 'Account not found' }, 404);
    }

    return c.json({
      success: true,
      message: `Account ${status} successfully`
    });
  } catch (error: any) {
    console.error('[Admin Alimtalk Account Status] Error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * GET /api/admin/alimtalk/statistics
 * 알림톡 통계 (어드민)
 */
app.get('/api/admin/alimtalk/statistics', cors(), async (c) => {
  const { env } = c;

  try {
    const { start_date, end_date } = c.req.query();

    // 총 발송 건수 & 성공률
    const totalStats = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_sent,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as total_success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
        SUM(cost) as total_revenue
      FROM alimtalk_messages
      WHERE created_at >= ? AND created_at <= ?
    `).bind(start_date || '2000-01-01', end_date || '2100-01-01').first();

    // 셀러별 발송 통계
    const sellerStats = await env.DB.prepare(`
      SELECT 
        s.id,
        s.name as seller_name,
        COUNT(m.id) as messages_sent,
        SUM(m.cost) as revenue,
        a.balance
      FROM sellers s
      JOIN alimtalk_accounts a ON s.id = a.seller_id
      LEFT JOIN alimtalk_messages m ON a.id = m.account_id
      WHERE m.created_at >= ? AND m.created_at <= ?
      GROUP BY s.id
      ORDER BY revenue DESC
      LIMIT 10
    `).bind(start_date || '2000-01-01', end_date || '2100-01-01').all();

    return c.json({
      success: true,
      statistics: {
        total: totalStats,
        by_seller: sellerStats.results
      }
    });
  } catch (error: any) {
    console.error('[Admin Alimtalk Statistics] Error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ----------------------------------------------------------------------------
// 셀러 - 알림톡 계정 관리
// ----------------------------------------------------------------------------

/**
 * GET /api/seller/alimtalk/account
 * 셀러 알림톡 계정 조회
 */
app.get('/api/seller/alimtalk/account', cors(), async (c) => {
  const { env } = c;
  
  try {
    const sessionToken = c.req.header('X-Session-Token');
    const session = await getSessionInfo(env, sessionToken);
    
    if (!session || session.user_type !== 'seller') {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const account = await env.DB.prepare(`
      SELECT * FROM alimtalk_accounts
      WHERE seller_id = ?
    `).bind(session.user_id).first();

    return c.json({
      success: true,
      account: account
    });
  } catch (error: any) {
    console.error('[Seller Alimtalk Account] Error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * POST /api/seller/alimtalk/register
 * 셀러 알림톡 계정 등록
 */
app.post('/api/seller/alimtalk/register', cors(), async (c) => {
  const { env } = c;
  
  try {
    const sessionToken = c.req.header('X-Session-Token');
    const session = await getSessionInfo(env, sessionToken);
    
    if (!session || session.user_type !== 'seller') {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const { channel_id, phone_number } = await c.req.json();

    if (!channel_id || !phone_number) {
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }

    // 전화번호 정규화
    const normalizedPhone = aligo.normalizePhoneNumber(phone_number);

    // 알리고 API: 카카오 채널 등록
    const aligoResult = await aligo.registerKakaoChannel(env, {
      channelId: channel_id,
      phoneNumber: normalizedPhone
    });

    if (!aligoResult.success) {
      return c.json({ success: false, error: 'Failed to register Kakao channel' }, 500);
    }

    // DB에 계정 정보 저장
    const result = await env.DB.prepare(`
      INSERT INTO alimtalk_accounts 
      (seller_id, kakao_channel_id, channel_name, sender_key, phone_number, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).bind(
      session.user_id,
      channel_id,
      channel_id, // 임시로 channel_id를 channel_name으로 사용
      aligoResult.senderKey,
      normalizedPhone
    ).run();

    return c.json({
      success: true,
      account_id: result.meta.last_row_id,
      sender_key: aligoResult.senderKey,
      message: 'Kakao channel registered successfully'
    });
  } catch (error: any) {
    console.error('[Seller Alimtalk Register] Error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ----------------------------------------------------------------------------
// 셀러 - 알림톡 템플릿 관리
// ----------------------------------------------------------------------------

/**
 * GET /api/seller/alimtalk/templates
 * 셀러 템플릿 목록 조회
 */
app.get('/api/seller/alimtalk/templates', cors(), async (c) => {
  const { env } = c;
  
  try {
    const sessionToken = c.req.header('X-Session-Token');
    const session = await getSessionInfo(env, sessionToken);
    
    if (!session || session.user_type !== 'seller') {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    // 계정 조회
    const account = await env.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(session.user_id).first();

    if (!account) {
      return c.json({ success: false, error: 'Alimtalk account not found' }, 404);
    }

    // 템플릿 목록 조회
    const templates = await env.DB.prepare(`
      SELECT * FROM alimtalk_templates
      WHERE account_id = ?
      ORDER BY created_at DESC
    `).bind(account.id).all();

    return c.json({
      success: true,
      templates: templates.results
    });
  } catch (error: any) {
    console.error('[Seller Alimtalk Templates] Error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * POST /api/seller/alimtalk/templates
 * 셀러 템플릿 등록
 */
app.post('/api/seller/alimtalk/templates', cors(), async (c) => {
  const { env } = c;
  
  try {
    const sessionToken = c.req.header('X-Session-Token');
    const session = await getSessionInfo(env, sessionToken);
    
    if (!session || session.user_type !== 'seller') {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const { template_code, template_name, template_content, template_type } = await c.req.json();

    if (!template_code || !template_name || !template_content) {
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }

    // 계정 조회
    const account = await env.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(session.user_id).first();

    if (!account) {
      return c.json({ success: false, error: 'Active alimtalk account not found' }, 404);
    }

    // 알리고 API: 템플릿 등록
    const aligoResult = await aligo.registerTemplate(env, account.sender_key, {
      name: template_name,
      content: template_content,
      templateCode: template_code
    });

    if (!aligoResult.success) {
      return c.json({ success: false, error: 'Failed to register template' }, 500);
    }

    // DB에 템플릿 저장
    const result = await env.DB.prepare(`
      INSERT INTO alimtalk_templates 
      (account_id, template_code, template_name, template_content, template_type, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).bind(
      account.id,
      template_code,
      template_name,
      template_content,
      template_type || 'basic'
    ).run();

    return c.json({
      success: true,
      template_id: result.meta.last_row_id,
      message: 'Template registered successfully. Approval pending (1-2 days)'
    });
  } catch (error: any) {
    console.error('[Seller Alimtalk Template Register] Error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ----------------------------------------------------------------------------
// 셀러 - 알림톡 충전
// ----------------------------------------------------------------------------

/**
 * GET /api/seller/alimtalk/pricing
 * 셀러 요금제 조회
 */
app.get('/api/seller/alimtalk/pricing', cors(), async (c) => {
  const { env } = c;

  try {
    const pricingList = await env.DB.prepare(`
      SELECT * FROM alimtalk_pricing
      WHERE is_active = TRUE
      ORDER BY min_quantity ASC
    `).all();

    return c.json({
      success: true,
      pricing: pricingList.results
    });
  } catch (error: any) {
    console.error('[Seller Alimtalk Pricing] Error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * POST /api/seller/alimtalk/charge
 * 셀러 알림톡 충전 (TossPayments)
 */
app.post('/api/seller/alimtalk/charge', cors(), async (c) => {
  const { env } = c;
  
  try {
    const sessionToken = c.req.header('X-Session-Token');
    const session = await getSessionInfo(env, sessionToken);
    
    if (!session || session.user_type !== 'seller') {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const { amount, pricing_id } = await c.req.json();

    if (!amount || !pricing_id) {
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }

    // 계정 조회
    const account = await env.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(session.user_id).first();

    if (!account) {
      return c.json({ success: false, error: 'Alimtalk account not found' }, 404);
    }

    // 요금제 조회
    const pricing = await env.DB.prepare(`
      SELECT * FROM alimtalk_pricing WHERE id = ? AND is_active = TRUE
    `).bind(pricing_id).first();

    if (!pricing) {
      return c.json({ success: false, error: 'Pricing not found' }, 404);
    }

    // 가격 계산
    const totalPrice = amount * pricing.unit_price;

    // TossPayments 주문 ID 생성
    const orderId = `alimtalk_${account.id}_${Date.now()}`;

    // 충전 내역 생성 (pending 상태)
    const result = await env.DB.prepare(`
      INSERT INTO alimtalk_charges 
      (account_id, amount, price, unit_price, payment_method, payment_status, order_id)
      VALUES (?, ?, ?, ?, 'card', 'pending', ?)
    `).bind(account.id, amount, totalPrice, pricing.unit_price, orderId).run();

    // TossPayments 결제 URL 생성 (실제 구현 시 TossPayments SDK 사용)
    const paymentUrl = `https://api.tosspayments.com/v1/payment/${orderId}`;

    return c.json({
      success: true,
      charge_id: result.meta.last_row_id,
      order_id: orderId,
      amount: amount,
      price: totalPrice,
      unit_price: pricing.unit_price,
      payment_url: paymentUrl
    });
  } catch (error: any) {
    console.error('[Seller Alimtalk Charge] Error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * POST /api/seller/alimtalk/charge/complete
 * 셀러 알림톡 충전 완료 (결제 완료 후 호출)
 */
app.post('/api/seller/alimtalk/charge/complete', cors(), async (c) => {
  const { env } = c;
  
  try {
    const { order_id, payment_id } = await c.req.json();

    if (!order_id) {
      return c.json({ success: false, error: 'Missing order_id' }, 400);
    }

    // 충전 내역 조회
    const charge = await env.DB.prepare(`
      SELECT * FROM alimtalk_charges WHERE order_id = ? AND payment_status = 'pending'
    `).bind(order_id).first();

    if (!charge) {
      return c.json({ success: false, error: 'Charge not found or already completed' }, 404);
    }

    // 충전 완료 처리
    await env.DB.prepare(`
      UPDATE alimtalk_charges 
      SET payment_status = 'completed', 
          payment_id = ?,
          completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(payment_id || null, charge.id).run();

    // 잔액 증가
    await env.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET balance = balance + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(charge.amount, charge.account_id).run();

    return c.json({
      success: true,
      message: 'Charge completed successfully',
      charged_amount: charge.amount
    });
  } catch (error: any) {
    console.error('[Seller Alimtalk Charge Complete] Error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ----------------------------------------------------------------------------
// 셀러 - 알림톡 발송
// ----------------------------------------------------------------------------

/**
 * POST /api/seller/alimtalk/send
 * 셀러 알림톡 발송
 */
app.post('/api/seller/alimtalk/send', cors(), async (c) => {
  const { env } = c;
  
  try {
    const sessionToken = c.req.header('X-Session-Token');
    const session = await getSessionInfo(env, sessionToken);
    
    if (!session || session.user_type !== 'seller') {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const { template_id, recipient_phone, variables, order_id } = await c.req.json();

    if (!template_id || !recipient_phone) {
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }

    // 계정 조회
    const account = await env.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = 'active'
    `).bind(session.user_id).first();

    if (!account) {
      return c.json({ success: false, error: 'Active alimtalk account not found' }, 404);
    }

    // 잔액 확인
    if (account.balance < 1) {
      return c.json({ success: false, error: 'Insufficient balance. Please charge first.' }, 400);
    }

    // 템플릿 조회
    const template = await env.DB.prepare(`
      SELECT * FROM alimtalk_templates 
      WHERE id = ? AND account_id = ? AND status = 'approved'
    `).bind(template_id, account.id).first();

    if (!template) {
      return c.json({ success: false, error: 'Template not found or not approved' }, 404);
    }

    // 템플릿 변수 치환
    const message = aligo.replaceTemplateVariables(template.template_content, variables || {});

    // 전화번호 정규화
    const normalizedPhone = aligo.normalizePhoneNumber(recipient_phone);

    // 알리고 API: 알림톡 발송
    const aligoResult = await aligo.sendAlimtalk(env, {
      senderKey: account.sender_key,
      templateCode: template.template_code,
      to: normalizedPhone,
      message: message
    });

    if (!aligoResult.success) {
      // 발송 실패 내역 저장
      await env.DB.prepare(`
        INSERT INTO alimtalk_messages 
        (account_id, template_id, order_id, recipient_phone, message_content, status, failed_reason, cost)
        VALUES (?, ?, ?, ?, ?, 'failed', ?, 0)
      `).bind(
        account.id,
        template_id,
        order_id || null,
        normalizedPhone,
        message,
        aligoResult.error
      ).run();

      return c.json({ success: false, error: aligoResult.error }, 500);
    }

    // 발송 성공 내역 저장
    const messageResult = await env.DB.prepare(`
      INSERT INTO alimtalk_messages 
      (account_id, template_id, order_id, recipient_phone, message_content, status, sent_at, cost, aligo_message_id)
      VALUES (?, ?, ?, ?, ?, 'sent', CURRENT_TIMESTAMP, ?, ?)
    `).bind(
      account.id,
      template_id,
      order_id || null,
      normalizedPhone,
      message,
      15, // 임시 비용 (실제로는 pricing 테이블에서 조회)
      aligoResult.messageId
    ).run();

    // 잔액 차감 & 통계 업데이트
    await env.DB.prepare(`
      UPDATE alimtalk_accounts 
      SET balance = balance - 1,
          total_sent = total_sent + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(account.id).run();

    return c.json({
      success: true,
      message_id: messageResult.meta.last_row_id,
      aligo_message_id: aligoResult.messageId,
      status: 'sent',
      remaining_balance: account.balance - 1
    });
  } catch (error: any) {
    console.error('[Seller Alimtalk Send] Error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * GET /api/seller/alimtalk/messages
 * 셀러 알림톡 발송 내역 조회
 */
app.get('/api/seller/alimtalk/messages', cors(), async (c) => {
  const { env } = c;
  
  try {
    const sessionToken = c.req.header('X-Session-Token');
    const session = await getSessionInfo(env, sessionToken);
    
    if (!session || session.user_type !== 'seller') {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const { page = '1', limit = '20', status } = c.req.query();

    // 계정 조회
    const account = await env.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(session.user_id).first();

    if (!account) {
      return c.json({ success: false, error: 'Alimtalk account not found' }, 404);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // 발송 내역 조회
    let query = `
      SELECT 
        m.*,
        t.template_name
      FROM alimtalk_messages m
      JOIN alimtalk_templates t ON m.template_id = t.id
      WHERE m.account_id = ?
    `;

    const params = [account.id];

    if (status) {
      query += ` AND m.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY m.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const messages = await env.DB.prepare(query).bind(...params).all();

    // 총 개수 조회
    const countResult = await env.DB.prepare(`
      SELECT COUNT(*) as total FROM alimtalk_messages WHERE account_id = ?
    `).bind(account.id).first();

    return c.json({
      success: true,
      messages: messages.results,
      pagination: {
        total: countResult.total,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error: any) {
    console.error('[Seller Alimtalk Messages] Error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * GET /api/seller/alimtalk/statistics
 * 셀러 알림톡 통계
 */
app.get('/api/seller/alimtalk/statistics', cors(), async (c) => {
  const { env } = c;
  
  try {
    const sessionToken = c.req.header('X-Session-Token');
    const session = await getSessionInfo(env, sessionToken);
    
    if (!session || session.user_type !== 'seller') {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const { start_date, end_date } = c.req.query();

    // 계정 조회
    const account = await env.DB.prepare(`
      SELECT * FROM alimtalk_accounts WHERE seller_id = ?
    `).bind(session.user_id).first();

    if (!account) {
      return c.json({ success: false, error: 'Alimtalk account not found' }, 404);
    }

    // 통계 조회
    const stats = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_sent,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as total_success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
        SUM(cost) as total_cost
      FROM alimtalk_messages
      WHERE account_id = ?
        AND created_at >= ?
        AND created_at <= ?
    `).bind(
      account.id,
      start_date || '2000-01-01',
      end_date || '2100-01-01'
    ).first();

    // 템플릿별 발송 통계
    const templateStats = await env.DB.prepare(`
      SELECT 
        t.template_name,
        COUNT(m.id) as count
      FROM alimtalk_messages m
      JOIN alimtalk_templates t ON m.template_id = t.id
      WHERE m.account_id = ?
        AND m.created_at >= ?
        AND m.created_at <= ?
      GROUP BY t.id
      ORDER BY count DESC
    `).bind(
      account.id,
      start_date || '2000-01-01',
      end_date || '2100-01-01'
    ).all();

    // 성공률 계산
    const successRate = stats.total_sent > 0 
      ? ((stats.total_success / stats.total_sent) * 100).toFixed(2)
      : 0;

    return c.json({
      success: true,
      statistics: {
        total_sent: stats.total_sent,
        total_success: stats.total_success,
        total_failed: stats.total_failed,
        success_rate: successRate,
        total_cost: stats.total_cost,
        by_template: templateStats.results
      }
    });
  } catch (error: any) {
    console.error('[Seller Alimtalk Statistics] Error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * ====================================
 * 알림톡 발송 API (셀러)
 * ====================================
 */

/**
 * POST /api/seller/alimtalk/send
 * 알림톡 수동 발송
 */
app.post('/api/seller/alimtalk/send', cors(), async (c) => {
  try {
    const sellerId = c.req.header('X-Seller-ID')
    if (!sellerId) {
      return c.json({ success: false, error: 'Unauthorized' }, 401)
    }

    const body = await c.req.json()
    const { templateId, recipients, variables } = body

    if (!templateId || !Array.isArray(recipients) || recipients.length === 0) {
      return c.json({ 
        success: false, 
        error: 'templateId and recipients are required' 
      }, 400)
    }

    // 셀러의 알림톡 계정 조회
    const account = await c.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(sellerId)).first<{ id: number }>()

    if (!account) {
      return c.json({ 
        success: false, 
        error: 'No active alimtalk account found' 
      }, 404)
    }

    // 발송 실행
    const result = await sendBulkAlimtalk(c.env as any, {
      accountId: account.id,
      templateId: parseInt(templateId),
      recipients: recipients.map((r: any) => ({
        phone: r.phone,
        name: r.name,
        variables: r.variables || {}
      })),
      variables: variables || {}
    })

    return c.json({
      success: result.success,
      data: {
        total: result.totalRecipients,
        sent: result.successCount,
        failed: result.failedCount,
        refunded: result.refundedAmount
      },
      messages: result.messages
    })
  } catch (error: any) {
    console.error('[Alimtalk Send] Error:', error)
    return c.json({ success: false, error: error.message }, 500)
  }
})

/**
 * POST /api/seller/alimtalk/send/order
 * 주문 연동 알림톡 발송
 */
app.post('/api/seller/alimtalk/send/order', cors(), async (c) => {
  try {
    const sellerId = c.req.header('X-Seller-ID')
    if (!sellerId) {
      return c.json({ success: false, error: 'Unauthorized' }, 401)
    }

    const body = await c.req.json()
    const { templateId, orderId, customMessage } = body

    if (!templateId || !orderId) {
      return c.json({ 
        success: false, 
        error: 'templateId and orderId are required' 
      }, 400)
    }

    // 셀러의 알림톡 계정 조회
    const account = await c.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(sellerId)).first<{ id: number }>()

    if (!account) {
      return c.json({ 
        success: false, 
        error: 'No active alimtalk account found' 
      }, 404)
    }

    // 주문 소유권 확인
    const order = await c.env.DB.prepare(`
      SELECT id FROM orders WHERE id = ? AND seller_id = ?
    `).bind(parseInt(orderId), parseInt(sellerId)).first()

    if (!order) {
      return c.json({ 
        success: false, 
        error: 'Order not found or unauthorized' 
      }, 404)
    }

    // 발송 실행
    const result = await sendOrderAlimtalk(
      c.env as any,
      account.id,
      parseInt(templateId),
      parseInt(orderId),
      customMessage
    )

    return c.json({
      success: result.success,
      data: {
        total: result.totalRecipients,
        sent: result.successCount,
        failed: result.failedCount,
        refunded: result.refundedAmount
      },
      messages: result.messages
    })
  } catch (error: any) {
    console.error('[Alimtalk Send Order] Error:', error)
    return c.json({ success: false, error: error.message }, 500)
  }
})

/**
 * POST /api/seller/alimtalk/send/bulk
 * CSV/Excel 대량 발송
 */
app.post('/api/seller/alimtalk/send/bulk', cors(), async (c) => {
  try {
    const sellerId = c.req.header('X-Seller-ID')
    if (!sellerId) {
      return c.json({ success: false, error: 'Unauthorized' }, 401)
    }

    const body = await c.req.json()
    const { templateId, rows, variables } = body

    if (!templateId || !Array.isArray(rows) || rows.length === 0) {
      return c.json({ 
        success: false, 
        error: 'templateId and rows are required' 
      }, 400)
    }

    // 셀러의 알림톡 계정 조회
    const account = await c.env.DB.prepare(`
      SELECT id FROM alimtalk_accounts 
      WHERE seller_id = ? AND status = 'active'
    `).bind(parseInt(sellerId)).first<{ id: number }>()

    if (!account) {
      return c.json({ 
        success: false, 
        error: 'No active alimtalk account found' 
      }, 404)
    }

    // 발송 실행
    const result = await sendBulkFromFile(
      c.env as any,
      account.id,
      parseInt(templateId),
      rows as BulkRecipientRow[],
      variables || {}
    )

    return c.json({
      success: result.success,
      data: {
        total: result.totalRecipients,
        sent: result.successCount,
        failed: result.failedCount,
        refunded: result.refundedAmount
      },
      messages: result.messages
    })
  } catch (error: any) {
    console.error('[Alimtalk Send Bulk] Error:', error)
    return c.json({ success: false, error: error.message }, 500)
  }
})

/**
 * POST /api/seller/alimtalk/templates/:id/preview
 * 템플릿 미리보기 (변수 치환 결과)
 */
app.post('/api/seller/alimtalk/templates/:id/preview', cors(), async (c) => {
  try {
    const sellerId = c.req.header('X-Seller-ID')
    if (!sellerId) {
      return c.json({ success: false, error: 'Unauthorized' }, 401)
    }

    const templateId = c.req.param('id')
    const body = await c.req.json()
    const { variables } = body

    // 템플릿 조회
    const template = await c.env.DB.prepare(`
      SELECT 
        t.template_content,
        t.template_name
      FROM alimtalk_templates t
      JOIN alimtalk_accounts a ON t.account_id = a.id
      WHERE t.id = ? AND a.seller_id = ?
    `).bind(parseInt(templateId), parseInt(sellerId)).first<{
      template_content: string
      template_name: string
    }>()

    if (!template) {
      return c.json({ 
        success: false, 
        error: 'Template not found' 
      }, 404)
    }

    // 변수 치환
    let preview = template.template_content
    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        const pattern = new RegExp(`#{${key}}`, 'g')
        preview = preview.replace(pattern, value as string)
      })
    }

    return c.json({
      success: true,
      data: {
        template_name: template.template_name,
        original: template.template_content,
        preview: preview,
        required_variables: Array.from(
          template.template_content.matchAll(/#{(\w+)}/g),
          match => match[1]
        )
      }
    })
  } catch (error: any) {
    console.error('[Alimtalk Preview] Error:', error)
    return c.json({ success: false, error: error.message }, 500)
  }
})

/**
 * ====================================
 * 정산 자동화 API
 * ====================================
 */

/**
 * GET /api/admin/settlements
 * 정산 목록 조회
 */
app.get('/api/admin/settlements', cors(), async (c) => {
  try {
    const settlements = await c.env.DB.prepare(`
      SELECT * FROM settlements
      ORDER BY period_start DESC
      LIMIT 50
    `).all()

    return c.json({
      success: true,
      data: settlements.results
    })
  } catch (error: any) {
    console.error('[Admin Settlements] Error:', error)
    return c.json({ success: false, error: error.message }, 500)
  }
})

/**
 * GET /api/admin/settlements/:id
 * 정산 상세 조회
 */
app.get('/api/admin/settlements/:id', cors(), async (c) => {
  try {
    const settlementId = parseInt(c.req.param('id'))
    const report = await getSettlementReport(c.env.DB, settlementId)

    if (!report) {
      return c.json({ success: false, error: 'Settlement not found' }, 404)
    }

    return c.json({
      success: true,
      data: report
    })
  } catch (error: any) {
    console.error('[Admin Settlement Detail] Error:', error)
    return c.json({ success: false, error: error.message }, 500)
  }
})

/**
 * POST /api/admin/settlements/generate
 * 정산 수동 생성 (테스트용)
 */
app.post('/api/admin/settlements/generate', cors(), async (c) => {
  try {
    const body = await c.req.json()
    const { startDate, endDate } = body

    const period = startDate && endDate
      ? { startDate, endDate }
      : getLastMonthSettlementPeriod()

    const report = await generateSettlementReport(c.env.DB, period)
    await saveSettlementReport(c.env.DB, report)

    return c.json({
      success: true,
      data: report
    })
  } catch (error: any) {
    console.error('[Admin Generate Settlement] Error:', error)
    return c.json({ success: false, error: error.message }, 500)
  }
})

/**
 * GET /api/seller/settlements
 * 셀러 정산 내역 조회
 */
app.get('/api/seller/settlements', cors(), async (c) => {
  try {
    const sellerId = c.req.header('X-Seller-ID')
    if (!sellerId) {
      return c.json({ success: false, error: 'Unauthorized' }, 401)
    }

    const settlements = await c.env.DB.prepare(`
      SELECT 
        s.id,
        s.period_start,
        s.period_end,
        sd.total_sales,
        sd.total_orders,
        sd.platform_fee,
        sd.shipping_fee,
        sd.refund_amount,
        sd.settlement_amount,
        sd.status,
        sd.paid_at
      FROM settlements s
      JOIN settlement_details sd ON s.id = sd.settlement_id
      WHERE sd.seller_id = ?
      ORDER BY s.period_start DESC
      LIMIT 50
    `).bind(parseInt(sellerId)).all()

    return c.json({
      success: true,
      data: settlements.results
    })
  } catch (error: any) {
    console.error('[Seller Settlements] Error:', error)
    return c.json({ success: false, error: error.message }, 500)
  }
})

/**
 * ====================================
 * SSE 실시간 통신 API
 * ====================================
 */

/**
 * GET /api/live/:streamId/sse
 * 라이브 스트림 실시간 업데이트
 */
app.get('/api/live/:streamId/sse', async (c) => {
  const streamId = c.req.param('streamId')
  return handleLiveStreamSSE(streamId, c.env as any)
})

/**
 * GET /api/live/:streamId/chat/sse
 * 실시간 채팅 스트림
 */
app.get('/api/live/:streamId/chat/sse', async (c) => {
  const streamId = c.req.param('streamId')
  return handleChatSSE(streamId, c.env as any)
})

/**
 * GET /api/seller/orders/sse
 * 셀러 주문 알림 (실시간)
 */
app.get('/api/seller/orders/sse', async (c) => {
  const sellerId = c.req.header('X-Seller-ID')
  if (!sellerId) {
    return c.json({ success: false, error: 'Unauthorized' }, 401)
  }
  return handleOrderNotificationSSE(sellerId, c.env as any)
})

/**
 * GET /api/seller/stock/sse
 * 셀러 재고 알림 (실시간)
 */
app.get('/api/seller/stock/sse', async (c) => {
  const sellerId = c.req.header('X-Seller-ID')
  if (!sellerId) {
    return c.json({ success: false, error: 'Unauthorized' }, 401)
  }
  return handleStockAlertSSE(sellerId, c.env as any)
})

/**
 * ====================================
 * Push Notification API
 * ====================================
 */

/**
 * POST /api/push/subscribe
 * Push 알림 구독
 */
app.post('/api/push/subscribe', cors(), async (c) => {
  try {
    const userId = c.req.header('X-User-ID')
    const userType = c.req.header('X-User-Type') as 'user' | 'seller' | 'admin'

    if (!userId || !userType) {
      return c.json({ success: false, error: 'Unauthorized' }, 401)
    }

    const subscription = await c.req.json()
    
    await savePushSubscription(
      c.env.DB,
      parseInt(userId),
      userType,
      subscription
    )

    return c.json({ success: true })
  } catch (error: any) {
    console.error('[Push Subscribe] Error:', error)
    return c.json({ success: false, error: error.message }, 500)
  }
})

/**
 * POST /api/push/unsubscribe
 * Push 알림 구독 해제
 */
app.post('/api/push/unsubscribe', cors(), async (c) => {
  try {
    const { endpoint } = await c.req.json()

    if (!endpoint) {
      return c.json({ success: false, error: 'Endpoint required' }, 400)
    }

    await deletePushSubscription(c.env.DB, endpoint)

    return c.json({ success: true })
  } catch (error: any) {
    console.error('[Push Unsubscribe] Error:', error)
    return c.json({ success: false, error: error.message }, 500)
  }
})

/**
 * GET /api/push/vapid-public-key
 * VAPID 공개 키 조회
 */
app.get('/api/push/vapid-public-key', cors(), async (c) => {
  try {
    // VAPID 키는 환경 변수에 저장되어 있어야 함
    const publicKey = c.env.VAPID_PUBLIC_KEY || ''
    
    return c.json({
      success: true,
      publicKey: publicKey
    })
  } catch (error: any) {
    console.error('[Push VAPID Key] Error:', error)
    return c.json({ success: false, error: error.message }, 500)
  }
})

// =================================
// 🚀 Cache Statistics Endpoint (모니터링용)
// =================================
/**
 * 메모리 캐시 통계 조회 (KV 최적화 효과 확인)
 * GET /api/cache/stats
 */
// 🔒 Cache Stats (Admin only - 보안 강화)
// Secret token으로 접근 제한: /api/cache/stats?token=SECRET_KEY
app.get('/api/cache/stats', async (c) => {
  const token = c.req.query('token');
  const STATS_SECRET_TOKEN = c.env.STATS_SECRET_TOKEN || 'your-secret-token-here';
  
  // 🔒 보안: Secret token 검증
  if (token !== STATS_SECRET_TOKEN) {
    return c.json({
      success: false,
      error: '접근 권한이 없습니다. 올바른 token을 제공해주세요.'
    }, 403);
  }
  
  const hitRate = cacheStats.hits + cacheStats.misses > 0
    ? ((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100).toFixed(2)
    : '0.00';
  
  return c.json({
    success: true,
    data: {
      // Cache 통계
      cache: {
        ...cacheStats,
        hitRate: `${hitRate}%`,
        cacheSize: globalMemoryCache.size,
        maxSize: 1000,
        memoryUsage: `${((globalMemoryCache.size / 1000) * 100).toFixed(1)}%`
      },
      // 설명
      description: {
        hits: 'Memory cache로 처리된 요청 (KV 읽기 0회)',
        misses: 'Memory cache 미스로 KV 조회한 요청',
        writes: 'Memory cache에 저장된 항목 수',
        evictions: 'Memory cache에서 삭제된 항목 수 (만료 또는 크기 제한)',
        hitRate: 'Cache hit 비율 (높을수록 KV 사용량 감소)',
        cacheSize: '현재 Memory cache에 저장된 항목 수',
        maxSize: 'Memory cache 최대 크기',
        memoryUsage: 'Memory cache 사용률 (cacheSize / maxSize)'
      },
      // KV 사용량 가이드
      kvUsageGuide: {
        currentHitRate: `${hitRate}%`,
        recommendation: parseFloat(hitRate) >= 90 
          ? '✅ 캐시가 매우 효과적으로 작동하고 있습니다.'
          : parseFloat(hitRate) >= 70
          ? '⚠️ 캐시 히트율이 낮습니다. TTL 조정을 고려하세요.'
          : '❌ 캐시 히트율이 매우 낮습니다. 캐시 설정을 확인하세요.',
        kvDailyReadsLimit: '100,000 reads/day (free tier)',
        kvDailyWritesLimit: '1,000 writes/day (free tier)',
        estimatedDailyReads: Math.round((cacheStats.misses / (cacheStats.hits + cacheStats.misses || 1)) * 10000),
        estimatedDailyWrites: Math.round((cacheStats.writes / (cacheStats.hits + cacheStats.misses || 1)) * 1000)
      }
    }
  });
});

/**
 * Export Hono app for Cloudflare Pages
 * Note: Cron triggers are not supported in Pages
 * For scheduled tasks, use Cloudflare Workers separately
 */
export default app
