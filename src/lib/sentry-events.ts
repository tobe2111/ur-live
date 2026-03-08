/**
 * 🎯 Sentry 이벤트 추적 서비스
 * 
 * 비즈니스 로직의 핵심 이벤트를 추적하여 Sentry 대시보드에서 모니터링합니다.
 * 
 * @example
 * // 로그인 시도
 * SentryEvents.loginAttempt('kakao');
 * 
 * // 로그인 성공
 * SentryEvents.loginSuccess('kakao', userId);
 * 
 * // 결제 시도
 * SentryEvents.paymentAttempt('toss', 50000);
 */

import * as Sentry from '@sentry/react';

export const SentryEvents = {
  // ==========================================
  // 🔐 Authentication Events
  // ==========================================

  /**
   * 로그인 시도
   */
  loginAttempt(type: 'kakao' | 'google' | 'email' | 'seller' | 'admin') {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: `Login attempt: ${type}`,
      level: 'info',
      data: { type, timestamp: Date.now() }
    });
  },

  /**
   * 로그인 성공
   */
  loginSuccess(type: string, userId: string) {
    Sentry.captureMessage(`Login success: ${type}`, {
      level: 'info',
      tags: { 
        login_type: type, 
        user_id: userId,
        event: 'login_success'
      },
      contexts: {
        login: {
          type,
          userId,
          timestamp: new Date().toISOString()
        }
      }
    });

    // 사용자 컨텍스트 설정
    Sentry.setUser({ id: userId });
    Sentry.setTag('login_method', type);
  },

  /**
   * 로그인 실패
   */
  loginFailure(type: string, error: Error) {
    Sentry.captureException(error, {
      level: 'error',
      tags: { 
        login_type: type,
        event: 'login_failure'
      },
      contexts: {
        login: {
          type,
          errorMessage: error.message,
          timestamp: new Date().toISOString()
        }
      }
    });
  },

  /**
   * 로그아웃
   */
  logout(userId: string, type: string) {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: `Logout: ${type}`,
      level: 'info',
      data: { userId, type }
    });

    // 사용자 컨텍스트 제거
    Sentry.setUser(null);
  },

  // ==========================================
  // 💳 Payment Events
  // ==========================================

  /**
   * 결제 시도
   */
  paymentAttempt(method: 'toss' | 'stripe', amount: number, orderId?: string) {
    Sentry.addBreadcrumb({
      category: 'payment',
      message: `Payment attempt: ${method}`,
      level: 'info',
      data: { method, amount, orderId, timestamp: Date.now() }
    });
  },

  /**
   * 결제 성공
   */
  paymentSuccess(method: string, orderId: string, amount: number) {
    Sentry.captureMessage('Payment success', {
      level: 'info',
      tags: { 
        payment_method: method, 
        order_id: orderId,
        event: 'payment_success'
      },
      contexts: {
        payment: { 
          method,
          orderId,
          amount, 
          currency: method === 'toss' ? 'KRW' : 'USD',
          timestamp: new Date().toISOString()
        }
      }
    });
  },

  /**
   * 결제 실패
   */
  paymentFailure(method: string, error: Error, amount: number, orderId?: string) {
    Sentry.captureException(error, {
      level: 'error',
      tags: { 
        payment_method: method,
        event: 'payment_failure'
      },
      contexts: {
        payment: {
          method,
          orderId,
          amount,
          errorMessage: error.message,
          timestamp: new Date().toISOString()
        }
      }
    });
  },

  // ==========================================
  // 📺 Live Streaming Events
  // ==========================================

  /**
   * 라이브 스트림 시작
   */
  liveStreamStart(streamId: string, sellerId: string, title: string) {
    Sentry.captureMessage('Live stream started', {
      level: 'info',
      tags: { 
        stream_id: streamId, 
        seller_id: sellerId,
        event: 'live_stream_start'
      },
      contexts: {
        stream: {
          id: streamId,
          sellerId,
          title,
          timestamp: new Date().toISOString()
        }
      }
    });
  },

  /**
   * 라이브 스트림 종료
   */
  liveStreamEnd(streamId: string, duration: number, viewerCount: number) {
    Sentry.addBreadcrumb({
      category: 'live_stream',
      message: 'Live stream ended',
      level: 'info',
      data: { streamId, duration, viewerCount }
    });
  },

  /**
   * 라이브 스트림 에러
   */
  liveStreamError(streamId: string, error: Error) {
    Sentry.captureException(error, {
      level: 'error',
      tags: { 
        stream_id: streamId,
        event: 'live_stream_error'
      },
      contexts: {
        stream: {
          id: streamId,
          errorMessage: error.message,
          timestamp: new Date().toISOString()
        }
      }
    });
  },

  // ==========================================
  // 📊 Performance Events
  // ==========================================

  /**
   * 페이지 로드 시간
   */
  pageLoad(pageName: string, loadTime: number) {
    Sentry.addBreadcrumb({
      category: 'performance',
      message: `Page loaded: ${pageName}`,
      level: 'info',
      data: { 
        page: pageName, 
        load_time_ms: loadTime,
        timestamp: Date.now()
      }
    });

    // 3초 이상 느린 경우 경고
    if (loadTime > 3000) {
      Sentry.captureMessage(`Slow page load: ${pageName}`, {
        level: 'warning',
        tags: { 
          page: pageName,
          event: 'slow_page_load'
        },
        contexts: {
          performance: { 
            load_time_ms: loadTime,
            threshold_ms: 3000
          }
        }
      });
    }
  },

  /**
   * API 응답 시간
   */
  apiResponseTime(endpoint: string, method: string, duration: number, status: number) {
    Sentry.addBreadcrumb({
      category: 'api',
      message: `${method} ${endpoint}`,
      level: status >= 400 ? 'error' : 'info',
      data: { endpoint, method, duration, status }
    });

    // 5초 이상 느린 API 경고
    if (duration > 5000) {
      Sentry.captureMessage(`Slow API response: ${method} ${endpoint}`, {
        level: 'warning',
        tags: { 
          endpoint,
          method,
          event: 'slow_api'
        },
        contexts: {
          api: { duration, status, threshold: 5000 }
        }
      });
    }
  },

  // ==========================================
  // 🛒 E-commerce Events
  // ==========================================

  /**
   * 장바구니 추가
   */
  addToCart(productId: string, quantity: number, price: number) {
    Sentry.addBreadcrumb({
      category: 'commerce',
      message: 'Product added to cart',
      level: 'info',
      data: { productId, quantity, price }
    });
  },

  /**
   * 주문 생성
   */
  orderCreated(orderId: string, totalAmount: number, itemCount: number) {
    Sentry.addBreadcrumb({
      category: 'commerce',
      message: 'Order created',
      level: 'info',
      data: { orderId, totalAmount, itemCount }
    });
  },

  /**
   * 주문 취소
   */
  orderCancelled(orderId: string, reason: string) {
    Sentry.captureMessage('Order cancelled', {
      level: 'info',
      tags: { 
        order_id: orderId,
        event: 'order_cancelled'
      },
      contexts: {
        order: { orderId, reason }
      }
    });
  },

  // ==========================================
  // 🔔 Custom Business Events
  // ==========================================

  /**
   * 커스텀 이벤트 (범용)
   */
  custom(eventName: string, data?: Record<string, any>, level: 'info' | 'warning' | 'error' = 'info') {
    Sentry.captureMessage(eventName, {
      level,
      tags: { event: 'custom' },
      contexts: {
        custom: { ...data, timestamp: new Date().toISOString() }
      }
    });
  }
};
