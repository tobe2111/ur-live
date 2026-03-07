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

const mockOrders = [
  {
    id: 1,
    order_number: 'ORD-001',
    status: 'delivered',
    total_amount: 30000,
    created_at: new Date().toISOString(),
    items: [
      {
        id: 1,
        product_name: 'Test Product 1',
        quantity: 1,
        price_snapshot: 10000,
      },
    ],
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

  // Orders API
  http.get('/api/orders', () => {
    return HttpResponse.json({
      orders: mockOrders,
      total: mockOrders.length,
    });
  }),

  http.get('/api/orders/:id', ({ params }) => {
    const { id } = params;
    const order = mockOrders.find(o => o.id === Number(id));
    
    if (!order) {
      return new HttpResponse(null, { status: 404 });
    }
    
    return HttpResponse.json(order);
  }),

  // Cart API
  http.get('/api/cart', () => {
    return HttpResponse.json({
      items: [
        {
          id: 1,
          product_id: 1,
          product_name: 'Test Product 1',
          quantity: 2,
          price_snapshot: 10000,
        },
      ],
    });
  }),

  http.post('/api/cart', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      { success: true, item: body },
      { status: 201 }
    );
  }),

  http.put('/api/cart/:id', async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({ success: true, ...body });
  }),

  http.delete('/api/cart/:id', () => {
    return HttpResponse.json({ success: true });
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
