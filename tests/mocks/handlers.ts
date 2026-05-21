import { http, HttpResponse } from 'msw';

// Mock data for common API responses
const mockProducts = [
  {
    id: 1,
    name: 'Test Product 1',
    price: 10000,
    current_price: 10000,
    discount_rate: 0,
    image_url: '/images/product1.jpg',
    stock: 100,
    category: 'fashion',
    seller_name: 'Test Seller',
  },
  {
    id: 2,
    name: 'Test Product 2',
    price: 20000,
    current_price: 15000,
    original_price: 20000,
    discount_rate: 25,
    image_url: '/images/product2.jpg',
    stock: 50,
    category: 'beauty',
    seller_name: 'Test Seller 2',
  },
];

const mockUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  displayName: 'Test User',
};

// ✅ STRENGTHENED: mockOrders now uses optional total_amount to verify BUG #7 guard
const mockOrders = [
  {
    id: 1,
    order_number: 'ORD-001',
    status: 'delivered',
    total_amount: 30000,
    amount: 30000,
    created_at: new Date().toISOString(),
    shipping_name: 'Test User',
    shipping_phone: '010-1234-5678',
    shipping_postal_code: '12345',
    shipping_address: '서울시 강남구 테헤란로 123',
    shipping_address_detail: '101호',
    payment_method: '카드',
    items: [
      {
        id: 1,
        product_name: 'Test Product 1',
        quantity: 1,
        price_snapshot: 10000,
      },
    ],
  },
  // ✅ STRENGTHENED: order with undefined/null price_snapshot — tests BUG #7 guard
  {
    id: 2,
    order_number: 'ORD-002',
    status: 'pending',
    // total_amount intentionally omitted to test nullish-coalescing guard
    amount: 15000,
    created_at: new Date().toISOString(),
    shipping_name: 'Test User 2',
    shipping_phone: '010-0000-0000',
    shipping_postal_code: '67890',
    shipping_address: '서울시 서초구',
    shipping_address_detail: '',
    items: [
      {
        id: 2,
        product_name: 'Test Product 2',
        quantity: 2,
        // price_snapshot intentionally undefined — tests BUG #7 guard
      },
    ],
  },
];

// ✅ STRENGTHENED: cart returns standard { success, data } shape used by useCart
const mockCartItems = [
  {
    id: 1,
    product_id: 1,
    product_name: 'Test Product 1',
    quantity: 2,
    price_snapshot: 10000,
    price: 10000,
    seller_id: 1,
    seller_name: 'Test Seller',
    shipping_fee: 3000,
    free_shipping_threshold: 50000,
    image_url: '/images/product1.jpg',
    stock_quantity: 100,
  },
];

export const handlers = [
  // Products API
  http.get('/api/products', () => {
    return HttpResponse.json({
      products: mockProducts,
      total: mockProducts.length,
    });
  }),

  http.get('/api/products/:id', ({ params }) => {
    const { id } = params;
    const product = mockProducts.find(p => p.id === Number(id));
    
    if (!product) {
      return new HttpResponse(null, { status: 404 });
    }
    
    return HttpResponse.json(product);
  }),

  // User API
  http.get('/api/user/profile', () => {
    return HttpResponse.json(mockUser);
  }),

  http.put('/api/user/profile', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ ...mockUser, ...body });
  }),

  // ✅ STRENGTHENED: /api/users/role needed by useAuthKR.loginWithEmail & initializeAuth
  http.get('/api/users/role', () => {
    return HttpResponse.json({ role: 'user' });
  }),

  // Orders API — ✅ STRENGTHENED: return { success, data } shape
  http.get('/api/orders', () => {
    return HttpResponse.json({
      success: true,
      data: mockOrders,
    });
  }),

  http.get('/api/orders/:id', ({ params }) => {
    const { id } = params;
    const order = mockOrders.find(o => o.id === Number(id));
    
    if (!order) {
      return new HttpResponse(null, { status: 404 });
    }
    
    return HttpResponse.json({ success: true, data: order });
  }),

  // ✅ STRENGTHENED: POST /api/orders — used by PaymentSuccessPage
  http.post('/api/orders', async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json(
      {
        success: true,
        data: {
          id: 99,
          order_number: body.orderNumber || 'ORD-TEST',
          status: 'pending',
          total_amount: body.totalAmount,
        },
      },
      { status: 201 }
    );
  }),

  // ✅ STRENGTHENED: POST /api/orders/:id/cancel
  http.post('/api/orders/:id/cancel', async ({ request }) => {
    const body = await request.json() as any;
    if (!body.reason) {
      return HttpResponse.json({ success: false, error: '취소 사유 필요' }, { status: 400 });
    }
    return HttpResponse.json({ success: true, data: { status: 'cancelled' } });
  }),

  // Cart API — ✅ STRENGTHENED: return { success, data } shape used by useCart
  http.get('/api/cart', () => {
    return HttpResponse.json({
      success: true,
      data: mockCartItems,
    });
  }),

  http.post('/api/cart', async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json(
      { success: true, data: { ...body, id: Date.now() } },
      { status: 201 }
    );
  }),

  // ✅ STRENGTHENED: PUT (not PATCH) — aligns with BUG #6 fix
  http.put('/api/cart/:id', async ({ params, request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({ success: true, data: { id: params.id, ...body } });
  }),

  http.delete('/api/cart/:id', () => {
    return HttpResponse.json({ success: true });
  }),

  // ✅ STRENGTHENED: POST /api/cart/clear (not DELETE) — aligns with BUG #5 fix
  http.post('/api/cart/clear', () => {
    return HttpResponse.json({ success: true });
  }),

  // ✅ STRENGTHENED: POST /api/payments/confirm
  http.post('/api/payments/confirm', async ({ request }) => {
    const body = await request.json() as any;
    if (!body.paymentKey || !body.orderId || body.amount === undefined) {
      return HttpResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 422 }
      );
    }
    return HttpResponse.json({
      success: true,
      data: {
        orderId: body.orderId,
        method: '카드',
        totalAmount: body.amount,
      },
    });
  }),

  // Shipping addresses
  http.get('/api/shipping-addresses', () => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          id: 1,
          recipient_name: 'Test User',
          phone: '010-1234-5678',
          postal_code: '12345',
          address: '서울시 강남구',
          address_detail: '101호',
          is_default: 1,
        },
      ],
    });
  }),

  // Wishlist API
  http.get('/api/wishlists', () => {
    return HttpResponse.json({
      items: [
        {
          id: 1,
          product_id: 1,
          product_name: 'Test Product 1',
          price: 10000,
        },
      ],
    });
  }),

  http.post('/api/wishlists', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      { success: true, item: body },
      { status: 201 }
    );
  }),

  http.delete('/api/wishlists/:id', () => {
    return HttpResponse.json({ success: true });
  }),

  // Search API
  http.get('/api/search', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    
    const filtered = mockProducts.filter(p =>
      p.name.toLowerCase().includes(query?.toLowerCase() || '')
    );
    
    return HttpResponse.json({
      products: filtered,
      total: filtered.length,
      query,
    });
  }),

  // 🛡️ 2026-05-20: Business registration submit + admin verify/reject (sellers.business_registration_*)
  http.post('/api/seller/business-registration/submit', async ({ request }) => {
    const body = (await request.json()) as { image_url?: string; business_number?: string }
    if (!body?.image_url) {
      return HttpResponse.json({ success: false, error: 'image_url 누락' }, { status: 400 })
    }
    if (!/^https?:\/\//.test(body.image_url)) {
      return HttpResponse.json({ success: false, error: '잘못된 URL' }, { status: 400 })
    }
    return HttpResponse.json({ success: true, status: 'pending' })
  }),

  http.patch('/api/admin/sellers/:id/business-registration/verify', async ({ request, params }) => {
    const body = (await request.json()) as { action?: string; reason?: string }
    const sellerId = String(params.id)
    if (!/^\d+$/.test(sellerId)) return HttpResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 })
    if (body.action !== 'verify' && body.action !== 'reject') {
      return HttpResponse.json({ success: false, error: 'action 은 verify 또는 reject' }, { status: 400 })
    }
    if (body.action === 'reject' && !body.reason?.trim()) {
      return HttpResponse.json({ success: false, error: '거부 사유 필요' }, { status: 400 })
    }
    return HttpResponse.json({
      success: true,
      message: body.action === 'verify' ? '사업자등록을 승인했습니다' : '사업자등록을 반려했습니다',
    })
  }),

  // 🛡️ 2026-05-21: 추천 commission 출금 — 인증 헤더 없으면 401.
  http.post('/api/referral-tree/withdrawals', async ({ request }) => {
    if (!request.headers.get('Authorization')) {
      return HttpResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const body = (await request.json()) as { bank_name?: string; account_number?: string; account_holder?: string }
    if (!body?.bank_name?.trim() || !body?.account_number?.trim() || !body?.account_holder?.trim()) {
      return HttpResponse.json({ success: false, error: '은행명/계좌번호/예금주를 모두 입력하세요.' }, { status: 400 })
    }
    if (!/^[\d-]{5,30}$/.test(body.account_number)) {
      return HttpResponse.json({ success: false, error: '계좌번호 형식이 올바르지 않습니다.' }, { status: 400 })
    }
    return HttpResponse.json({ success: true, data: { withdrawal_id: 1, total_amount: 25000, commission_count: 3 } })
  }),

  http.get('/api/referral-tree/withdrawals', ({ request }) => {
    if (!request.headers.get('Authorization')) {
      return HttpResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    return HttpResponse.json({ success: true, data: [] })
  }),

  http.get('/api/referral-tree/admin/withdrawals', ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status') || 'pending'
    const auth = request.headers.get('Authorization') || ''
    if (!auth.includes('admin')) {
      return HttpResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }
    if (!['pending', 'approved', 'rejected', 'all'].includes(status)) {
      return HttpResponse.json({ success: false, error: 'Invalid status' }, { status: 400 })
    }
    return HttpResponse.json({ success: true, data: [] })
  }),

  http.patch('/api/referral-tree/admin/withdrawals/:id/approve', async ({ request, params }) => {
    if (!String(request.headers.get('Authorization') || '').includes('admin')) {
      return HttpResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }
    const id = parseInt(String(params.id), 10)
    if (!Number.isFinite(id)) return HttpResponse.json({ success: false, error: 'Invalid id' }, { status: 400 })
    return HttpResponse.json({ success: true })
  }),

  http.patch('/api/referral-tree/admin/withdrawals/:id/reject', async ({ request, params }) => {
    if (!String(request.headers.get('Authorization') || '').includes('admin')) {
      return HttpResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }
    const id = parseInt(String(params.id), 10)
    if (!Number.isFinite(id)) return HttpResponse.json({ success: false, error: 'Invalid id' }, { status: 400 })
    const body = (await request.json()) as { rejection_reason?: string }
    if (!body?.rejection_reason?.trim()) {
      return HttpResponse.json({ success: false, error: '거절 사유를 입력하세요.' }, { status: 400 })
    }
    return HttpResponse.json({ success: true })
  }),

  // 🛡️ 2026-05-20: User withdrawal (user_withdrawals migration 0274) — 잔액 확인 + 8.8% 원천징수.
  http.post('/api/points/withdraw', async ({ request }) => {
    const body = (await request.json()) as {
      amount?: number
      bank_name?: string
      bank_account?: string
      account_holder?: string
    }
    const amount = Number(body?.amount)
    if (!Number.isFinite(amount) || amount < 10000 || amount > 10_000_000) {
      return HttpResponse.json({ success: false, error: '출금 금액은 10,000~10,000,000딜' }, { status: 400 })
    }
    if (!body?.bank_name?.trim() || !body?.bank_account?.trim() || !body?.account_holder?.trim()) {
      return HttpResponse.json({ success: false, error: '계좌 정보 누락' }, { status: 400 })
    }
    const withholding = Math.floor(amount * 0.088)
    return HttpResponse.json({
      success: true,
      data: {
        withdrawal_id: 1,
        amount,
        withholding_tax: withholding,
        net_amount: amount - withholding,
        status: 'requested',
      },
    })
  }),

  // FTS5 trigram search mock — bm25 ranking 시뮬레이션.
  http.get('/api/search/fts', ({ request }) => {
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') || '').trim()
    if (!q) return HttpResponse.json({ success: true, data: [], pagination: { total: 0 } })
    // 부분매칭 (trigram 효과 시뮬레이션) + bm25 가중치 (name>category>description) 시뮬.
    const score = (p: typeof mockProducts[0]) => {
      const qq = q.toLowerCase()
      let s = 0
      if (p.name.toLowerCase().includes(qq)) s += 3
      if ((p.category ?? '').toLowerCase().includes(qq)) s += 2
      return s
    }
    const ranked = mockProducts
      .map(p => ({ p, s: score(p) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map(x => x.p)
    return HttpResponse.json({
      success: true,
      data: ranked,
      pagination: { total: ranked.length, page: 1, limit: 20, totalPages: 1 },
    })
  }),

  // Error handling example
  http.get('/api/error', () => {
    return new HttpResponse(null, { status: 500 });
  }),

  // Delayed response example
  http.get('/api/slow', async () => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return HttpResponse.json({ message: 'Slow response' });
  }),
];
