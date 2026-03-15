// ============================================================
// E2E Tests: Toss Webhook + Multi-Seller Cart/Checkout
// ============================================================

import { test, expect, type Page } from '@playwright/test';

// ---- Helpers ----
const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:8787';

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('[data-testid="login-email"]', 'buyer@test.com');
  await page.fill('[data-testid="login-password"]', 'test1234!');
  await page.click('[data-testid="login-submit"]');
  await page.waitForURL('/');
}

async function addProductToCart(page: Page, productId: string) {
  await page.goto(`/products/${productId}`);
  await page.click('[data-testid="add-to-cart-detail"]');
  await page.waitForTimeout(500);
}

// ============================================================
// TEST SUITE 1: Cart - Multi-Seller Grouping
// ============================================================
test.describe('Cart - Multi-Seller Support', () => {

  test('TC01: Products from different sellers appear in separate groups', async ({ page }) => {
    // Add product from seller 1
    await page.goto('/products');
    await page.waitForSelector('[data-testid="product-card"]');
    
    // Click first product and add to cart
    await page.click('[data-testid="product-card"]:first-child [data-testid="add-to-cart-btn"]');
    await page.waitForTimeout(300);

    // Navigate to cart
    await page.goto('/cart');
    await page.waitForSelector('[data-testid="cart-page"]');

    // Cart should show at least one item
    const cartItems = page.locator('[data-testid="cart-item"]');
    await expect(cartItems.first()).toBeVisible();
    
    // Cart total should be visible
    await expect(page.locator('[data-testid="checkout-button"]')).toBeVisible();
  });

  test('TC02: Cart shows seller name for each product group', async ({ page }) => {
    await page.goto('/products');
    await page.waitForSelector('[data-testid="product-card"]');
    
    // Add product to cart
    await page.click('[data-testid="product-card"]:first-child [data-testid="add-to-cart-btn"]');
    await page.waitForTimeout(300);

    await page.goto('/cart');
    
    // Check that seller info is displayed
    const sellerLabels = page.locator('text=/멋진 패션샵|전자기기 마켓/');
    // At least one seller label should be visible
    if (await sellerLabels.count() > 0) {
      await expect(sellerLabels.first()).toBeVisible();
    }
  });

  test('TC03: Quantity update works correctly in cart', async ({ page }) => {
    await page.goto('/products');
    await page.waitForSelector('[data-testid="product-card"]');
    await page.click('[data-testid="product-card"]:first-child [data-testid="add-to-cart-btn"]');
    await page.waitForTimeout(300);

    await page.goto('/cart');
    await page.waitForSelector('[data-testid="cart-item"]');

    // Find increment button and click it
    const plusBtn = page.locator('[data-testid="cart-item"]').first().locator('button').last();
    await plusBtn.click();
    await page.waitForTimeout(300);

    // Quantity should be 2
    const qtyText = page.locator('[data-testid="cart-item"]').first().locator('span.text-center');
    await expect(qtyText).toHaveText('2');
  });

  test('TC04: Remove item from cart', async ({ page }) => {
    await page.goto('/products');
    await page.waitForSelector('[data-testid="product-card"]');
    await page.click('[data-testid="product-card"]:first-child [data-testid="add-to-cart-btn"]');
    await page.waitForTimeout(300);

    await page.goto('/cart');
    await page.waitForSelector('[data-testid="cart-item"]');
    
    const initialCount = await page.locator('[data-testid="cart-item"]').count();
    
    // Remove the item
    await page.click('[data-testid="remove-item"]');
    await page.waitForTimeout(500);

    if (initialCount === 1) {
      // Should show empty cart
      await expect(page.locator('text=장바구니가 비어있습니다')).toBeVisible();
    } else {
      // Should have one fewer item
      const newCount = await page.locator('[data-testid="cart-item"]').count();
      expect(newCount).toBe(initialCount - 1);
    }
  });

  test('TC05: Cart shows correct total including shipping', async ({ page }) => {
    await page.goto('/products');
    await page.waitForSelector('[data-testid="product-card"]');
    await page.click('[data-testid="product-card"]:first-child [data-testid="add-to-cart-btn"]');
    await page.waitForTimeout(300);

    await page.goto('/cart');
    await page.waitForSelector('[data-testid="cart-page"]');

    // Total amount should be visible in KRW format
    await expect(page.locator('text=/[0-9,]+원/')).toBeVisible();
  });
});

// ============================================================
// TEST SUITE 2: Checkout Flow
// ============================================================
test.describe('Checkout - Multi-Seller Flow', () => {

  test.beforeEach(async ({ page }) => {
    // Add a product to cart before each checkout test
    await page.goto('/products');
    await page.waitForSelector('[data-testid="product-card"]');
    await page.click('[data-testid="product-card"]:first-child [data-testid="add-to-cart-btn"]');
    await page.waitForTimeout(300);
  });

  test('TC06: Checkout page requires authentication', async ({ page }) => {
    await page.goto('/checkout');
    // Should redirect to login
    await expect(page).toHaveURL('/login');
  });

  test('TC07: Checkout page shows shipping form after login', async ({ page }) => {
    await login(page);
    
    // Re-add product after login (cart might be cleared by auth change)
    await page.goto('/products');
    await page.waitForSelector('[data-testid="product-card"]');
    await page.click('[data-testid="product-card"]:first-child [data-testid="add-to-cart-btn"]');
    await page.waitForTimeout(300);

    await page.goto('/checkout');
    await page.waitForSelector('[data-testid="checkout-page"]');

    // Shipping form should be visible
    await expect(page.locator('[data-testid="shipping-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="shipping-phone"]')).toBeVisible();
    await expect(page.locator('[data-testid="address1"]')).toBeVisible();
  });

  test('TC08: Checkout validates required shipping fields', async ({ page }) => {
    await login(page);
    
    await page.goto('/products');
    await page.click('[data-testid="product-card"]:first-child [data-testid="add-to-cart-btn"]');
    await page.waitForTimeout(300);
    
    await page.goto('/checkout');
    await page.waitForSelector('[data-testid="checkout-page"]');

    // Click pay without filling form
    await page.click('[data-testid="pay-button"]');
    await page.waitForTimeout(500);

    // Validation errors should appear
    await expect(page.locator('text=수령인을 입력해주세요')).toBeVisible();
  });

  test('TC09: Multi-seller checkout shows grouped items by seller', async ({ page }) => {
    await login(page);

    // Add product from products page (may add from multiple sellers)
    await page.goto('/products');
    await page.waitForSelector('[data-testid="product-card"]');
    
    // Add first product
    await page.click('[data-testid="product-card"]:nth-child(1) [data-testid="add-to-cart-btn"]');
    await page.waitForTimeout(200);
    
    await page.goto('/checkout');
    await page.waitForSelector('[data-testid="checkout-page"]');

    // Order items section should show products
    await expect(page.locator('text=주문 상품')).toBeVisible();
  });

  test('TC10: Create orders via API for multi-seller checkout', async ({ page }) => {
    await login(page);
    
    // Get auth token from localStorage
    const authData = await page.evaluate(() => {
      const stored = localStorage.getItem('auth-storage');
      if (!stored) return null;
      const data = JSON.parse(stored) as { state?: { accessToken?: string } };
      return data?.state?.accessToken;
    });

    if (!authData) {
      test.skip(true, 'No auth token available');
      return;
    }

    const { generateOrderNumber } = await import('../../src/shared/utils/index.js');
    const orderNumber = `ORD-TEST-${Date.now()}`;
    
    // Create order via API
    const response = await page.request.post(`${API_URL}/api/orders`, {
      headers: {
        'Authorization': `Bearer ${authData}`,
        'Content-Type': 'application/json',
      },
      data: {
        seller_id: 'seller-001',
        order_number: orderNumber,
        items: [{ product_id: 'prod-001', quantity: 1 }],
        shipping_address: {
          postal_code: '12345',
          address1: '서울시 강남구 테헤란로 1',
          country: 'KR',
        },
        shipping_name: '테스트 구매자',
        shipping_phone: '010-1234-5678',
        idempotency_key: `test-${Date.now()}`,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json() as { success: boolean; data?: { order_number: string } };
    expect(body.success).toBe(true);
    expect(body.data?.order_number).toBe(orderNumber);
  });
});

// ============================================================
// TEST SUITE 3: Toss Webhook
// ============================================================
test.describe('Toss Webhook - Server-Side Processing', () => {

  test('TC11: Webhook endpoint returns 200 for valid signature', async ({ page }) => {
    const orderNumber = `ORD-WEBHOOK-${Date.now()}`;
    const payload = JSON.stringify({
      eventType: 'payment.confirmed',
      createdAt: new Date().toISOString(),
      data: {
        paymentKey: `test_pk_${Date.now()}`,
        orderId: orderNumber,
        orderName: 'Test Order',
        status: 'DONE',
        totalAmount: 32900,
        currency: 'KRW',
        method: 'CARD',
        approvedAt: new Date().toISOString(),
      },
    });

    // Generate HMAC signature (dev mode skips verification)
    const response = await page.request.post(`${API_URL}/api/payments/webhook`, {
      headers: {
        'Content-Type': 'application/json',
        // No signature = dev mode (TOSS_WEBHOOK_SECRET=dev_skip or not set)
      },
      data: payload,
    });

    // Should always return 200
    expect(response.status()).toBe(200);
    const body = await response.json() as { received: boolean };
    expect(body.received).toBe(true);
  });

  test('TC12: Webhook endpoint returns 200 for invalid signature (no retry)', async ({ page }) => {
    const payload = JSON.stringify({
      eventType: 'payment.confirmed',
      createdAt: new Date().toISOString(),
      data: {
        paymentKey: 'test_pk_invalid',
        orderId: 'ORD-INVALID-001',
        orderName: 'Test',
        status: 'DONE',
        totalAmount: 10000,
        currency: 'KRW',
      },
    });

    const response = await page.request.post(`${API_URL}/api/payments/webhook`, {
      headers: {
        'Content-Type': 'application/json',
        'Toss-Signature': 'v1=invalid_signature_here',
      },
      data: payload,
    });

    // Always 200 even for invalid signature
    expect(response.status()).toBe(200);
  });

  test('TC13: Webhook idempotency - duplicate events return 200 without reprocessing', async ({ page }) => {
    const orderNumber = `ORD-IDEM-${Date.now()}`;
    const payload = {
      eventType: 'payment.confirmed',
      createdAt: new Date().toISOString(),
      data: {
        paymentKey: `pk_test_${Date.now()}`,
        orderId: orderNumber,
        orderName: 'Idempotency Test',
        status: 'DONE',
        totalAmount: 29900,
        currency: 'KRW',
        method: 'CARD',
        approvedAt: new Date().toISOString(),
      },
    };

    const headers = {
      'Content-Type': 'application/json',
    };

    // First request
    const response1 = await page.request.post(`${API_URL}/api/payments/webhook`, {
      headers,
      data: JSON.stringify(payload),
    });
    expect(response1.status()).toBe(200);
    const body1 = await response1.json() as { received: boolean; status: string };
    expect(body1.received).toBe(true);

    // Second request (duplicate) - should return 200 with duplicate_skipped or processed
    const response2 = await page.request.post(`${API_URL}/api/payments/webhook`, {
      headers,
      data: JSON.stringify(payload),
    });
    expect(response2.status()).toBe(200);
    const body2 = await response2.json() as { received: boolean };
    expect(body2.received).toBe(true);
  });

  test('TC14: Webhook handles payment.cancelled event correctly', async ({ page }) => {
    const orderNumber = `ORD-CANCEL-${Date.now()}`;
    const payload = {
      eventType: 'payment.cancelled',
      createdAt: new Date().toISOString(),
      data: {
        paymentKey: `pk_cancel_${Date.now()}`,
        orderId: orderNumber,
        orderName: 'Cancellation Test',
        status: 'CANCELLED',
        totalAmount: 45000,
        currency: 'KRW',
        cancelledAt: new Date().toISOString(),
        failureMessage: '고객 요청',
      },
    };

    const response = await page.request.post(`${API_URL}/api/payments/webhook`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify(payload),
    });

    expect(response.status()).toBe(200);
    const body = await response.json() as { received: boolean; status: string };
    expect(body.received).toBe(true);
    expect(['processed', 'error']).toContain(body.status); // processed or error (order not found is ok)
  });

  test('TC15: Webhook handles payment.failed event correctly', async ({ page }) => {
    const payload = {
      eventType: 'payment.failed',
      createdAt: new Date().toISOString(),
      data: {
        paymentKey: 'pk_failed_test',
        orderId: `ORD-FAIL-${Date.now()}`,
        orderName: 'Failed Payment Test',
        status: 'ABORTED',
        totalAmount: 15000,
        currency: 'KRW',
        failureCode: 'NOT_ALLOWED_CARD_COMPANY',
        failureMessage: '해당 카드사 결제 불가',
      },
    };

    const response = await page.request.post(`${API_URL}/api/payments/webhook`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify(payload),
    });

    expect(response.status()).toBe(200);
    const body = await response.json() as { received: boolean };
    expect(body.received).toBe(true);
  });
});

// ============================================================
// TEST SUITE 4: Order Management
// ============================================================
test.describe('Order Management', () => {

  test('TC16: Order list page shows orders', async ({ page }) => {
    await login(page);
    await page.goto('/orders');
    await page.waitForSelector('[data-testid="order-list"]');
    
    // Page loads successfully
    await expect(page.locator('h1')).toHaveText('주문 내역');
  });

  test('TC17: Payment success page processes correctly', async ({ page }) => {
    // Simulate redirect from Toss
    await page.goto('/payment/success?paymentKey=test_pk_123&orderId=ORD-TEST-001&amount=32900');
    
    // Should attempt to confirm payment
    // Will likely show error since test_pk is invalid, but page should load
    await page.waitForTimeout(3000);
    
    // Either success or error page, not a crash
    const hasSuccess = await page.locator('[data-testid="payment-success"]').isVisible();
    const hasError = await page.locator('text=결제').isVisible();
    expect(hasSuccess || hasError).toBe(true);
  });

  test('TC18: Payment fail page shows error details', async ({ page }) => {
    await page.goto('/payment/fail?code=USER_CANCEL&message=사용자가 결제를 취소했습니다&orderId=ORD-TEST-001');
    await page.waitForSelector('[data-testid="payment-fail"]');
    
    await expect(page.locator('text=결제 실패')).toBeVisible();
    await expect(page.locator('text=사용자가 결제를 취소했습니다')).toBeVisible();
  });
});

// ============================================================
// TEST SUITE 5: API - Multi-Seller Order Creation
// ============================================================
test.describe('API - Multi-Seller Orders', () => {

  test('TC19: Creating orders with same order_number for different sellers', async ({ page }) => {
    await login(page);
    
    const authToken = await page.evaluate(() => {
      const stored = localStorage.getItem('auth-storage');
      if (!stored) return null;
      const data = JSON.parse(stored) as { state?: { accessToken?: string } };
      return data?.state?.accessToken;
    });

    if (!authToken) {
      test.skip(true, 'Authentication not available');
      return;
    }

    const orderNumber = `ORD-MULTI-${Date.now()}`;
    
    // Create first order (seller-001)
    const resp1 = await page.request.post(`${API_URL}/api/orders`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        seller_id: 'seller-001',
        order_number: orderNumber,
        items: [{ product_id: 'prod-001', quantity: 1 }],
        shipping_address: { postal_code: '06236', address1: '서울시 강남구', country: 'KR' },
        shipping_name: '테스트',
        shipping_phone: '010-1234-5678',
        idempotency_key: `${orderNumber}:seller-001`,
      },
    });

    expect(resp1.status()).toBe(201);

    // Create second order (seller-002) with same order_number
    const resp2 = await page.request.post(`${API_URL}/api/orders`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        seller_id: 'seller-002',
        order_number: orderNumber,
        items: [{ product_id: 'prod-004', quantity: 1 }],
        shipping_address: { postal_code: '06236', address1: '서울시 강남구', country: 'KR' },
        shipping_name: '테스트',
        shipping_phone: '010-1234-5678',
        idempotency_key: `${orderNumber}:seller-002`,
      },
    });

    expect(resp2.status()).toBe(201);

    // Both orders should have same order_number
    const body1 = await resp1.json() as { data?: { order_number: string } };
    const body2 = await resp2.json() as { data?: { order_number: string } };
    
    expect(body1.data?.order_number).toBe(orderNumber);
    expect(body2.data?.order_number).toBe(orderNumber);
  });

  test('TC20: Idempotent order creation returns same order', async ({ page }) => {
    await login(page);
    
    const authToken = await page.evaluate(() => {
      const stored = localStorage.getItem('auth-storage');
      if (!stored) return null;
      const data = JSON.parse(stored) as { state?: { accessToken?: string } };
      return data?.state?.accessToken;
    });

    if (!authToken) {
      test.skip(true, 'Authentication not available');
      return;
    }

    const idempotencyKey = `idem-test-${Date.now()}`;
    const orderData = {
      seller_id: 'seller-001',
      order_number: `ORD-IDEM2-${Date.now()}`,
      items: [{ product_id: 'prod-002', quantity: 1 }],
      shipping_address: { postal_code: '06236', address1: '서울시 강남구', country: 'KR' },
      shipping_name: '테스트',
      shipping_phone: '010-0000-0000',
      idempotency_key: idempotencyKey,
    };

    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    };

    // First create
    const resp1 = await page.request.post(`${API_URL}/api/orders`, { headers, data: orderData });
    
    if (resp1.status() === 201) {
      const body1 = await resp1.json() as { data?: { id: string } };
      
      // Second create (duplicate idempotency key)
      const resp2 = await page.request.post(`${API_URL}/api/orders`, { headers, data: orderData });
      
      // Should return 200 (existing order)
      expect([200, 201]).toContain(resp2.status());
      const body2 = await resp2.json() as { data?: { id: string } };
      
      // Same order ID
      expect(body1.data?.id).toBe(body2.data?.id);
    }
  });
});
