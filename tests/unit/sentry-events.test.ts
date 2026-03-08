import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Sentry from '@sentry/react';
import { SentryEvents } from '@/lib/sentry-events';

// Mock Sentry
vi.mock('@sentry/react', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
  setContext: vi.fn(),
}));

describe('SentryEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication Events', () => {
    it('should track login attempt', () => {
      SentryEvents.loginAttempt('kakao');

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'auth',
        message: 'Login attempt: kakao',
        level: 'info',
        data: expect.objectContaining({
          type: 'kakao',
          timestamp: expect.any(Number),
        }),
      });
    });

    it('should track login success', () => {
      const userId = 'user123';
      SentryEvents.loginSuccess('kakao', userId);

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Login success: kakao',
        expect.objectContaining({
          level: 'info',
          tags: expect.objectContaining({
            login_type: 'kakao',
            user_id: userId,
            event: 'login_success',
          }),
        })
      );

      expect(Sentry.setUser).toHaveBeenCalledWith({ id: userId });
      expect(Sentry.setTag).toHaveBeenCalledWith('login_method', 'kakao');
    });

    it('should track login failure', () => {
      const error = new Error('Invalid credentials');
      SentryEvents.loginFailure('email', error);

      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          level: 'error',
          tags: expect.objectContaining({
            login_type: 'email',
            event: 'login_failure',
          }),
        })
      );
    });

    it('should track logout', () => {
      SentryEvents.logout('user123', 'user');

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'auth',
        message: 'Logout: user',
        level: 'info',
        data: { userId: 'user123', type: 'user' },
      });

      expect(Sentry.setUser).toHaveBeenCalledWith(null);
    });
  });

  describe('Payment Events', () => {
    it('should track payment attempt', () => {
      SentryEvents.paymentAttempt('toss', 50000, 'order123');

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'payment',
        message: 'Payment attempt: toss',
        level: 'info',
        data: expect.objectContaining({
          method: 'toss',
          amount: 50000,
          orderId: 'order123',
        }),
      });
    });

    it('should track payment success', () => {
      SentryEvents.paymentSuccess('toss', 'order123', 50000);

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Payment success',
        expect.objectContaining({
          level: 'info',
          tags: expect.objectContaining({
            payment_method: 'toss',
            order_id: 'order123',
            event: 'payment_success',
          }),
          contexts: expect.objectContaining({
            payment: expect.objectContaining({
              method: 'toss',
              orderId: 'order123',
              amount: 50000,
              currency: 'KRW',
            }),
          }),
        })
      );
    });

    it('should track payment failure', () => {
      const error = new Error('Payment declined');
      SentryEvents.paymentFailure('stripe', error, 100, 'order456');

      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          level: 'error',
          tags: expect.objectContaining({
            payment_method: 'stripe',
            event: 'payment_failure',
          }),
        })
      );
    });

    it('should set correct currency for Toss and Stripe', () => {
      SentryEvents.paymentSuccess('toss', 'order1', 50000);
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Payment success',
        expect.objectContaining({
          contexts: expect.objectContaining({
            payment: expect.objectContaining({ currency: 'KRW' }),
          }),
        })
      );

      vi.clearAllMocks();

      SentryEvents.paymentSuccess('stripe', 'order2', 100);
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Payment success',
        expect.objectContaining({
          contexts: expect.objectContaining({
            payment: expect.objectContaining({ currency: 'USD' }),
          }),
        })
      );
    });
  });

  describe('Live Streaming Events', () => {
    it('should track live stream start', () => {
      SentryEvents.liveStreamStart('stream123', 'seller456', 'My Live Show');

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Live stream started',
        expect.objectContaining({
          level: 'info',
          tags: expect.objectContaining({
            stream_id: 'stream123',
            seller_id: 'seller456',
            event: 'live_stream_start',
          }),
          contexts: expect.objectContaining({
            stream: expect.objectContaining({
              id: 'stream123',
              sellerId: 'seller456',
              title: 'My Live Show',
            }),
          }),
        })
      );
    });

    it('should track live stream end', () => {
      SentryEvents.liveStreamEnd('stream123', 3600, 150);

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'live_stream',
        message: 'Live stream ended',
        level: 'info',
        data: {
          streamId: 'stream123',
          duration: 3600,
          viewerCount: 150,
        },
      });
    });

    it('should track live stream error', () => {
      const error = new Error('Connection lost');
      SentryEvents.liveStreamError('stream123', error);

      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          level: 'error',
          tags: expect.objectContaining({
            stream_id: 'stream123',
            event: 'live_stream_error',
          }),
        })
      );
    });
  });

  describe('Performance Events', () => {
    it('should track page load', () => {
      SentryEvents.pageLoad('LoginPage', 1500);

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'performance',
        message: 'Page loaded: LoginPage',
        level: 'info',
        data: expect.objectContaining({
          page: 'LoginPage',
          load_time_ms: 1500,
        }),
      });
    });

    it('should warn on slow page load (>3s)', () => {
      SentryEvents.pageLoad('SlowPage', 5000);

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Slow page load: SlowPage',
        expect.objectContaining({
          level: 'warning',
          tags: expect.objectContaining({
            page: 'SlowPage',
            event: 'slow_page_load',
          }),
        })
      );
    });

    it('should not warn on fast page load (<3s)', () => {
      SentryEvents.pageLoad('FastPage', 1000);

      expect(Sentry.captureMessage).not.toHaveBeenCalled();
    });

    it('should track API response time', () => {
      SentryEvents.apiResponseTime('/api/users', 'GET', 200, 200);

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'api',
        message: 'GET /api/users',
        level: 'info',
        data: {
          endpoint: '/api/users',
          method: 'GET',
          duration: 200,
          status: 200,
        },
      });
    });

    it('should warn on slow API response (>5s)', () => {
      SentryEvents.apiResponseTime('/api/slow', 'POST', 6000, 200);

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Slow API response: POST /api/slow',
        expect.objectContaining({
          level: 'warning',
          tags: expect.objectContaining({
            endpoint: '/api/slow',
            method: 'POST',
            event: 'slow_api',
          }),
        })
      );
    });
  });

  describe('E-commerce Events', () => {
    it('should track add to cart', () => {
      SentryEvents.addToCart('product123', 2, 50000);

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'commerce',
        message: 'Product added to cart',
        level: 'info',
        data: {
          productId: 'product123',
          quantity: 2,
          price: 50000,
        },
      });
    });

    it('should track order created', () => {
      SentryEvents.orderCreated('order123', 150000, 3);

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'commerce',
        message: 'Order created',
        level: 'info',
        data: {
          orderId: 'order123',
          totalAmount: 150000,
          itemCount: 3,
        },
      });
    });

    it('should track order cancelled', () => {
      SentryEvents.orderCancelled('order123', 'Customer request');

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Order cancelled',
        expect.objectContaining({
          level: 'info',
          tags: expect.objectContaining({
            order_id: 'order123',
            event: 'order_cancelled',
          }),
          contexts: expect.objectContaining({
            order: {
              orderId: 'order123',
              reason: 'Customer request',
            },
          }),
        })
      );
    });
  });

  describe('Custom Events', () => {
    it('should track custom event with default level', () => {
      SentryEvents.custom('user_signup', { source: 'google' });

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'user_signup',
        expect.objectContaining({
          level: 'info',
          tags: { event: 'custom' },
          contexts: expect.objectContaining({
            custom: expect.objectContaining({
              source: 'google',
            }),
          }),
        })
      );
    });

    it('should track custom event with warning level', () => {
      SentryEvents.custom('rate_limit_approaching', { limit: 1000 }, 'warning');

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'rate_limit_approaching',
        expect.objectContaining({
          level: 'warning',
        })
      );
    });

    it('should track custom event with error level', () => {
      SentryEvents.custom('critical_error', { code: 'E500' }, 'error');

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'critical_error',
        expect.objectContaining({
          level: 'error',
        })
      );
    });
  });
});
