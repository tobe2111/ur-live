# 🎯 제미나이 AI 프롬프트 모음 - 10가지 최적화 작업

각 최적화 작업을 제미나이(Gemini)에게 요청할 때 사용할 상세 프롬프트입니다.

---

## 1️⃣ SSE 채팅 전환 (최우선!)

### 📋 제미나이 프롬프트

```
**Task: Integrate SSE-based real-time chat using useLiveChat hook**

**Context:**
I have a live commerce platform built with Hono (Cloudflare Workers) and React. Currently using Firebase Realtime Database for chat, but I want to migrate to Server-Sent Events (SSE) for better performance and cost efficiency.

**Current Implementation:**
- File: `src/pages/LivePageV2.tsx` (1845 lines)
- Firebase chat initialization: Lines 390-470
- Message sending: Lines 1155-1190
- System message push: Lines 1054-1070
- Firebase SDK loaded via CDN in index.html

**Available Resources:**
- SSE backend handlers: Already implemented in `src/lib/sse-realtime.ts`
- React hook: `src/hooks/useLiveChat.ts` (complete implementation)
- Migration guide: `docs/SSE-CHAT-MIGRATION-GUIDE.md`

**Requirements:**
1. Replace Firebase chat initialization (lines 390-470) with `useLiveChat` hook
2. Remove Firebase SDK references and cleanup code
3. Update message sending logic (lines 1155-1190) to use hook's `sendMessage` function
4. Add connection status UI indicator (green dot when connected)
5. Implement auto-scroll to bottom when new messages arrive
6. Handle SSE connection lifecycle (open on live start, close on live end)
7. Show reconnection status with exponential backoff visualization

**Expected Outcome:**
- Real-time message latency: 100ms → 10ms (10x faster)
- Network traffic reduction: 95% (no more polling every 3 seconds)
- Bundle size reduction: ~180KB (after Firebase removal in next step)

**Technical Details:**
- Hook API: `const { messages, isConnected, error, sendMessage } = useLiveChat(streamId, enabled)`
- SSE endpoint: `/api/live/:id/chat/stream`
- Message format: `{ id, userId, userName, userType, message, timestamp }`

**Please provide:**
1. Step-by-step code changes for LivePageV2.tsx
2. TypeScript-safe implementation
3. Error handling for connection failures
4. UI components for connection status
5. Testing checklist to verify the migration

**Files to modify:**
- `src/pages/LivePageV2.tsx` (main changes)
- Optionally: Create a separate component `<LiveChat />` for better code organization

**Success Criteria:**
- [ ] No Firebase references remain in chat logic
- [ ] Messages appear within 100ms of sending
- [ ] Connection indicator shows real-time status
- [ ] Auto-reconnection works after network failure
- [ ] Multiple browser tabs receive messages simultaneously
```

---

## 2️⃣ Firebase 완전 제거

### 📋 제미나이 프롬프트

```
**Task: Complete Firebase SDK removal from the project**

**Context:**
After migrating chat to SSE (Task 1), Firebase is no longer needed. Remove all Firebase dependencies to reduce bundle size by 71% (~180KB) and improve initial load time by 58% (1.2s → 0.5s).

**Current Firebase Usage:**
- package.json: `firebase` package (if installed via npm)
- index.html: Firebase CDN scripts (app-compat.js, database-compat.js)
- LivePageV2.tsx: Firebase initialization code (already removed in Task 1)
- TypeScript declarations: `window.firebase` type (if exists)

**Requirements:**
1. Remove Firebase from package.json
   ```bash
   npm uninstall firebase
   ```

2. Remove Firebase scripts from index.html
   - Locate `<script>` tags referencing Firebase CDN
   - Remove all Firebase SDK references

3. Clean up TypeScript declarations
   - Check `src/types/global.d.ts` or `vite-env.d.ts`
   - Remove `window.firebase` interface extension

4. Verify no Firebase references remain
   ```bash
   grep -r "firebase" src/
   grep -r "firebase" index.html
   ```

5. Build and measure bundle size reduction
   ```bash
   npm run build
   ls -lh dist/assets/vendor-*.js  # Compare before/after
   ```

**Expected Outcome:**
- Bundle size: 254KB → 74KB (71% reduction)
- Initial load time: 1.2s → 0.5s (58% improvement)
- Removed external dependency on Google Firebase
- Simplified tech stack

**Please provide:**
1. Exact lines to remove from index.html
2. Commands to clean up package.json and node_modules
3. Verification script to ensure complete removal
4. Before/after bundle size comparison
5. Rollback plan if issues occur

**Success Criteria:**
- [ ] No `firebase` in package.json dependencies
- [ ] No Firebase scripts in index.html
- [ ] `grep -r "firebase" src/` returns no results
- [ ] Build succeeds without errors
- [ ] Bundle size reduced by ~180KB
- [ ] All chat features work with SSE
```

---

## 3️⃣ 반복문 내 DB 쿼리 제거 (N+1 문제)

### 📋 제미나이 프롬프트

```
**Task: Eliminate N+1 query problems in loops (20+ occurrences found)**

**Context:**
Detected 20+ locations where DB queries are executed inside loops, causing severe N+1 query problems. For example, fetching 100 cart items triggers 101 queries (1 + 100).

**Problem Pattern:**
```typescript
// ❌ BAD: N+1 queries
for (const item of cartItems) {
  const product = await DB.prepare('SELECT * FROM products WHERE id = ?')
    .bind(item.product_id).first();
}
// Result: 100 items = 101 queries (1 for cart + 100 for products)
```

**Solution Pattern:**
```typescript
// ✅ GOOD: 2 queries total
const productIds = cartItems.map(i => i.product_id);
const products = await DB.prepare(`
  SELECT * FROM products 
  WHERE id IN (${productIds.map(() => '?').join(',')})
`).bind(...productIds).all();

// Create lookup map
const productMap = new Map(products.results.map(p => [p.id, p]));
const itemsWithProducts = cartItems.map(item => ({
  ...item,
  product: productMap.get(item.product_id)
}));
```

**Detected Locations in src/index.tsx:**
- Line 3697: Cart items product lookup
- Line 3764: Cart items detail fetch
- Line 3821: Cart items with seller info
- Line 3860: Cart items validation
- Line 3939: Cart items price calculation
- Line 3949: Seller-specific queries
- Line 6615: Order items restoration
- Line 6894: Order items stock update
- Line 7816: Order items processing
- Line 8831: Settlement order processing
- Line 9050: Cart items stock check
- Line 9095: Cart items reservation
- Line 9245: Order items refund

**Requirements:**
1. Identify all N+1 patterns in the codebase
2. Refactor each location to use batch queries with IN clause
3. Maintain exact same response structure (backward compatibility)
4. Add TypeScript types for proper type safety
5. Test with large datasets (100+ items) to verify performance

**Technical Constraints:**
- Using Cloudflare D1 (SQLite-based)
- Maximum SQL statement length: 1MB
- Recommended batch size: 100-1000 items
- Must handle empty arrays gracefully

**Expected Outcome:**
- Response time: 2-5s → 0.1-0.2s (20-50x faster)
- DB queries: N+1 → 2 (per batch)
- CPU time: Reduced by 90% (important for Cloudflare Workers 10ms limit)

**Please provide:**
1. Refactored code for each of the 13+ locations
2. Helper function for batch query pattern (reusable)
3. TypeScript interfaces for type safety
4. Unit tests or test cases
5. Performance comparison (before/after)

**Example Helper Function:**
```typescript
async function batchFetchProducts(
  DB: D1Database, 
  productIds: number[]
): Promise<Map<number, Product>> {
  if (productIds.length === 0) return new Map();
  
  const placeholders = productIds.map(() => '?').join(',');
  const products = await DB.prepare(`
    SELECT * FROM products WHERE id IN (${placeholders})
  `).bind(...productIds).all();
  
  return new Map(products.results.map(p => [p.id, p]));
}
```

**Success Criteria:**
- [ ] All 20+ loop-based queries refactored
- [ ] Performance test: 100 items in <500ms
- [ ] No breaking changes to API responses
- [ ] TypeScript compilation passes
- [ ] All existing tests pass
```

---

## 4️⃣ 캐시 확장

### 📋 제미나이 프롬프트

```
**Task: Extend memory caching to additional frequently-accessed endpoints**

**Context:**
Currently, only live streams are cached. Expand caching to products, sellers, categories, and banners to reduce DB queries by 70%.

**Current Cache Implementation:**
- Location: `src/index.tsx` lines 33-108
- Pattern: Memory cache with TTL and SWR (Stale-While-Revalidate)
- Helpers: `getFromMemoryCache()`, `setToMemoryCache()`
- Monitoring: `/api/cache/stats?token=SECRET`

**Endpoints to Cache:**

1. **Product List** (high traffic)
   - Endpoint: `GET /api/products`
   - TTL: 5 minutes (300 seconds)
   - Cache key: `products:${category}:${limit}:${offset}`
   - Invalidate: On product create/update/delete

2. **Product Detail** (very high traffic)
   - Endpoint: `GET /api/products/:id`
   - TTL: 10 minutes (600 seconds)
   - Cache key: `product:${id}`
   - Invalidate: On specific product update

3. **Seller Info** (medium traffic)
   - Endpoint: `GET /api/sellers/:id`
   - TTL: 30 minutes (1800 seconds)
   - Cache key: `seller:${id}`
   - Invalidate: On seller profile update

4. **Categories List** (low change frequency)
   - Endpoint: `GET /api/categories` (if exists)
   - TTL: 1 hour (3600 seconds)
   - Cache key: `categories:all`
   - Invalidate: On category changes

5. **Banners** (low change frequency)
   - Endpoint: `GET /api/banners` or `GET /api/admin/banners`
   - TTL: 10 minutes (600 seconds)
   - Cache key: `banners:active`
   - Invalidate: On banner changes

**Requirements:**
1. Apply SWR pattern to all endpoints (return cached, refresh in background)
2. Use `executionCtx.waitUntil()` for background refresh
3. Add cache invalidation on data mutations (POST, PUT, DELETE)
4. Update cache stats to track per-endpoint hit rates
5. Handle cache warming for critical endpoints

**Cache Invalidation Pattern:**
```typescript
// On product update
app.put('/api/products/:id', async (c) => {
  const id = c.req.param('id');
  
  // Update DB
  await DB.prepare('UPDATE products SET ... WHERE id = ?').bind(id).run();
  
  // Invalidate related caches
  globalMemoryCache.delete(`product:${id}`);
  globalMemoryCache.delete('products:all');  // If list cache exists
  
  return c.json({ success: true });
});
```

**Expected Outcome:**
- DB queries: Reduced by 70% (on top of existing 99% cache hit rate)
- Response time: 50-100ms → 10-20ms for cached endpoints
- Cache hit rate: Maintain 95%+ across all endpoints

**Please provide:**
1. Updated cache implementation for 5 endpoints
2. Cache invalidation logic for mutations
3. Cache key strategy (avoid collisions)
4. Cache warming strategy (pre-populate on deploy)
5. Updated monitoring endpoint to show per-endpoint stats

**Success Criteria:**
- [ ] All 5 endpoints have caching
- [ ] Cache hit rate ≥95% after 1 hour of traffic
- [ ] Response time <20ms for cached hits
- [ ] Invalidation works correctly on mutations
- [ ] No stale data issues reported
```

---

## 5️⃣ 코드 분할 (Code Splitting)

### 📋 제미나이 프롬프트

```
**Task: Split monolithic index.tsx (12,295 lines) into modular route files**

**Context:**
Single file with 12,295 lines, 177 API endpoints, and 289 DB queries is difficult to maintain. Split into logical route modules for better organization and faster cold starts.

**Current Structure:**
```
src/
├── index.tsx              # 12,295 lines (everything)
├── types/
├── lib/
├── middleware/
└── services/
```

**Target Structure:**
```
src/
├── index.tsx              # Main app (100-200 lines, routing only)
├── routes/
│   ├── auth.routes.ts     # Authentication (login, kakao, sessions)
│   ├── products.routes.ts # Product CRUD + search
│   ├── orders.routes.ts   # Order management + payments
│   ├── cart.routes.ts     # Shopping cart operations
│   ├── live.routes.ts     # Live streaming + chat
│   ├── sellers.routes.ts  # Seller dashboard + products
│   ├── admin.routes.ts    # Admin panel + analytics
│   └── users.routes.ts    # User profile + addresses
├── middleware/
│   ├── auth.middleware.ts # requireAuth, verifySellerSession, verifyAdminSession
│   ├── cache.middleware.ts # Cache helpers
│   └── rateLimit.ts       # (existing)
└── lib/                   # (existing helpers)
```

**Migration Strategy:**

1. **Create route files** (one at a time)
   ```typescript
   // routes/products.routes.ts
   import { Hono } from 'hono';
   import type { Bindings } from '../types';
   
   export const productsRouter = new Hono<{ Bindings: Bindings }>();
   
   // Product list
   productsRouter.get('/', async (c) => { ... });
   
   // Product detail
   productsRouter.get('/:id', async (c) => { ... });
   
   // Create product
   productsRouter.post('/', requireAuth, async (c) => { ... });
   ```

2. **Extract middleware** to separate files
   ```typescript
   // middleware/auth.middleware.ts
   export const requireAuth = async (c, next) => {
     const sessionId = c.req.header('X-Session-ID');
     // ... existing logic
     await next();
   };
   ```

3. **Update main index.tsx** to route composition
   ```typescript
   // index.tsx (simplified)
   import { Hono } from 'hono';
   import { productsRouter } from './routes/products.routes';
   import { ordersRouter } from './routes/orders.routes';
   // ... other imports
   
   const app = new Hono<{ Bindings: Bindings }>();
   
   // Global middleware
   app.use('/api/*', compress({ threshold: 1024 }));
   
   // Mount route modules
   app.route('/api/products', productsRouter);
   app.route('/api/orders', ordersRouter);
   app.route('/api/cart', cartRouter);
   app.route('/api/live', liveRouter);
   app.route('/api/sellers', sellersRouter);
   app.route('/api/admin', adminRouter);
   app.route('/auth', authRouter);
   
   export default app;
   ```

**Requirements:**
1. Split by domain/feature (products, orders, cart, etc.)
2. Keep all existing functionality intact (no breaking changes)
3. Share common types and helpers via imports
4. Maintain middleware order and authentication logic
5. Update imports throughout codebase

**Benefits:**
- Maintainability: 80% improvement (easier to find code)
- Cold start: 30% faster (smaller worker bundle per route)
- Team collaboration: Multiple developers can work simultaneously
- Testing: Easier to test individual route modules

**Expected Outcome:**
- index.tsx: 12,295 lines → ~200 lines
- 8 route files: ~1,500 lines each (average)
- Build time: Same or slightly faster
- Runtime performance: Same or slightly faster (tree-shaking)

**Please provide:**
1. Complete file structure with all route modules
2. Migration script or steps (if possible)
3. Updated imports for shared code
4. Testing strategy to verify no regressions
5. Git commit strategy (one route at a time vs. big bang)

**Success Criteria:**
- [ ] All 177 endpoints migrated to route modules
- [ ] Build succeeds without errors
- [ ] All tests pass
- [ ] No breaking changes to API
- [ ] Code coverage maintained
```

---

## 6️⃣ SELECT * 최적화

### 📋 제미나이 프롬프트

```
**Task: Replace SELECT * with explicit column selection (65 occurrences)**

**Context:**
Found 65 instances of `SELECT *` queries that fetch unnecessary columns, wasting network bandwidth and DB I/O.

**Problem:**
```sql
-- ❌ BAD: Fetches all 20 columns (including large description)
SELECT * FROM products WHERE id = ?
```

**Solution:**
```sql
-- ✅ GOOD: Only fetch needed columns
SELECT id, name, price, image_url, stock, category 
FROM products 
WHERE id = ?
```

**Benefits:**
- Response size: 30-50% reduction
- Network bandwidth: 30-50% savings
- DB I/O: 20-30% reduction
- Parsing time: 10-20% faster

**Detection Command:**
```bash
cd /home/user/webapp
grep -n "SELECT \*" src/index.tsx
# Found: 65 occurrences
```

**Requirements:**
1. Identify all 65 `SELECT *` queries in src/index.tsx
2. For each query, determine which columns are actually used in the response
3. Replace `SELECT *` with explicit column list
4. Update TypeScript types to match selected columns
5. Test to ensure no missing fields in responses

**Common Patterns:**

1. **Product queries** (most common)
   ```sql
   -- Instead of:
   SELECT * FROM products WHERE category = ?
   
   -- Use:
   SELECT id, name, price, original_price, discount_rate, 
          image_url, thumbnail_url, stock, category, seller_id
   FROM products 
   WHERE category = ?
   ```

2. **Order queries**
   ```sql
   -- Instead of:
   SELECT * FROM orders WHERE user_id = ?
   
   -- Use:
   SELECT id, order_number, user_id, status, total_amount, 
          shipping_fee, payment_method, created_at, updated_at
   FROM orders 
   WHERE user_id = ?
   ```

3. **User queries**
   ```sql
   -- Instead of:
   SELECT * FROM users WHERE id = ?
   
   -- Use:
   SELECT id, name, email, phone, user_type, created_at
   FROM users 
   WHERE id = ?
   -- Note: Exclude password_hash for security
   ```

**Special Cases:**
- Admin queries: May need more columns for full data display
- Internal queries: Can use * if all columns are needed for processing
- JOIN queries: Use table aliases and explicit columns (e.g., `p.id, p.name`)

**Expected Outcome:**
- Response size: 30-50% reduction per query
- Overall bandwidth: 20-30% savings
- DB I/O: 15-20% reduction
- Slightly faster response times (5-10%)

**Please provide:**
1. List of all 65 queries with recommended column selections
2. Refactored queries with explicit columns
3. TypeScript type updates (if needed)
4. Testing strategy to verify correctness
5. Before/after response size comparison (sample)

**Success Criteria:**
- [ ] All 65 `SELECT *` replaced with explicit columns
- [ ] No missing fields in API responses
- [ ] Response sizes reduced by 30%+
- [ ] All tests pass
- [ ] No performance regressions
```

---

## 7️⃣ 인덱스 최적화

### 📋 제미나이 프롬프트

```
**Task: Add database indexes to optimize slow queries**

**Context:**
With 289 DB queries executed across 177 endpoints, some queries may be slow due to missing indexes on frequently-filtered columns.

**Current Indexes:**
Check existing indexes in migrations:
```bash
cd /home/user/webapp
grep -r "CREATE INDEX" migrations/
```

**Common Slow Query Patterns:**

1. **User-based filtering** (very common)
   ```sql
   SELECT * FROM orders WHERE user_id = ?
   SELECT * FROM cart_items WHERE user_id = ?
   SELECT * FROM addresses WHERE user_id = ?
   ```

2. **Seller-based filtering** (common)
   ```sql
   SELECT * FROM products WHERE seller_id = ?
   SELECT * FROM live_streams WHERE seller_id = ?
   SELECT * FROM settlements WHERE seller_id = ?
   ```

3. **Status filtering** (common)
   ```sql
   SELECT * FROM orders WHERE status = 'pending'
   SELECT * FROM live_streams WHERE status = 'active'
   ```

4. **Composite filters** (very common)
   ```sql
   SELECT * FROM orders WHERE user_id = ? AND status = ?
   SELECT * FROM products WHERE seller_id = ? AND is_active = 1
   ```

5. **Date range queries** (analytics)
   ```sql
   SELECT * FROM orders WHERE created_at > ? AND created_at < ?
   SELECT * FROM settlements WHERE period_start >= ?
   ```

**Recommended Indexes:**

```sql
-- Migration: 0090_add_performance_indexes.sql

-- Orders table
CREATE INDEX IF NOT EXISTS idx_orders_user_status 
  ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_seller_status 
  ON orders(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at 
  ON orders(created_at);

-- Products table
CREATE INDEX IF NOT EXISTS idx_products_seller_active 
  ON products(seller_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_category_active 
  ON products(category, is_active);

-- Order items table
CREATE INDEX IF NOT EXISTS idx_order_items_order_id 
  ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id 
  ON order_items(product_id);

-- Cart items table
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id 
  ON cart_items(user_id);

-- Live streams table
CREATE INDEX IF NOT EXISTS idx_live_streams_seller_status 
  ON live_streams(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_live_streams_status_created 
  ON live_streams(status, created_at);

-- Settlements table
CREATE INDEX IF NOT EXISTS idx_settlements_seller_period 
  ON settlements(seller_id, period_start, period_end);

-- Sessions table
CREATE INDEX IF NOT EXISTS idx_sessions_user_type 
  ON sessions(user_id, user_type);
```

**Requirements:**
1. Analyze query patterns in src/index.tsx (289 queries)
2. Identify missing indexes using EXPLAIN QUERY PLAN
3. Create migration file with recommended indexes
4. Test query performance before/after
5. Verify index size doesn't bloat database

**Index Analysis Commands:**
```bash
# Check query execution plan
npx wrangler d1 execute toss-live-commerce-db --remote \
  --command="EXPLAIN QUERY PLAN SELECT * FROM orders WHERE user_id = 1"

# Check index usage
npx wrangler d1 execute toss-live-commerce-db --remote \
  --command="SELECT * FROM sqlite_stat1"
```

**Expected Outcome:**
- Slow queries: 2-5x faster (especially on large tables)
- Full table scans: Eliminated for filtered queries
- JOIN performance: Improved by 30-50%
- Overall API latency: 10-20% improvement

**Please provide:**
1. Complete migration file with all recommended indexes
2. EXPLAIN QUERY PLAN analysis for key queries (before/after)
3. Index size estimation (should be <10% of table size)
4. List of queries that benefit from each index
5. Performance benchmarks (before/after)

**Success Criteria:**
- [ ] Migration created and tested locally
- [ ] All indexes created without errors
- [ ] Query performance improved by 2-5x (measured)
- [ ] No significant database size increase (<10%)
- [ ] Production migration successful
```

---

## 8️⃣ Rate Limiting 확장

### 📋 제미나이 프롬프트

```
**Task: Extend rate limiting to protect all sensitive endpoints**

**Context:**
Current rate limiting is partially implemented. Extend protection to all authentication, mutation, and high-value endpoints to prevent abuse and attacks.

**Current Rate Limiting:**
- Location: `src/middleware/rateLimit.ts`
- Some endpoints protected, many unprotected
- Need consistent policy across all sensitive operations

**Sensitive Endpoints to Protect:**

1. **Authentication** (prevent brute force)
   ```typescript
   // Login attempts
   app.post('/api/users/login', 
     rateLimit({ requests: 5, window: 60 }), // 5 attempts per minute
     async (c) => { ... }
   );
   
   // Registration
   app.post('/api/users/register',
     rateLimit({ requests: 3, window: 300 }), // 3 per 5 minutes
     async (c) => { ... }
   );
   
   // Password reset
   app.post('/api/users/forgot-password',
     rateLimit({ requests: 3, window: 600 }), // 3 per 10 minutes
     async (c) => { ... }
   );
   ```

2. **Chat/Messaging** (prevent spam)
   ```typescript
   app.post('/api/live/:id/chat',
     rateLimit({ requests: 10, window: 60 }), // 10 messages per minute
     async (c) => { ... }
   );
   
   app.post('/api/alimtalk/send',
     rateLimit({ requests: 5, window: 60 }), // 5 per minute
     async (c) => { ... }
   );
   ```

3. **Orders** (prevent fraudulent orders)
   ```typescript
   app.post('/api/orders',
     rateLimit({ requests: 10, window: 60 }), // 10 orders per minute
     async (c) => { ... }
   );
   
   app.post('/api/payments/confirm',
     rateLimit({ requests: 20, window: 60 }), // 20 per minute
     async (c) => { ... }
   );
   ```

4. **Admin Actions** (extra protection)
   ```typescript
   app.delete('/api/admin/users/:id',
     rateLimit({ requests: 10, window: 60 }), // 10 per minute
     async (c) => { ... }
   );
   
   app.post('/api/admin/settlements/generate',
     rateLimit({ requests: 5, window: 300 }), // 5 per 5 minutes
     async (c) => { ... }
   );
   ```

5. **Search** (prevent scraping)
   ```typescript
   app.get('/api/products/search',
     rateLimit({ requests: 30, window: 60 }), // 30 per minute
     async (c) => { ... }
   );
   ```

**Rate Limiting Policies:**
```typescript
export const RateLimitPolicies = {
  auth: { requests: 5, window: 60 },        // Authentication
  chat: { requests: 10, window: 60 },       // Real-time messaging
  orders: { requests: 10, window: 60 },     // Order creation
  payments: { requests: 20, window: 60 },   // Payment processing
  admin: { requests: 10, window: 60 },      // Admin actions
  search: { requests: 30, window: 60 },     // Search queries
  general: { requests: 100, window: 60 },   // General API
};
```

**Requirements:**
1. Audit all 177 endpoints for rate limiting needs
2. Apply appropriate rate limit policy to each sensitive endpoint
3. Use user_id or IP address as rate limit key
4. Return 429 status with retry-after header
5. Log rate limit violations for monitoring

**Response Format:**
```typescript
// When rate limited
return c.json({
  success: false,
  error: 'Too many requests. Please try again later.',
  retryAfter: 60 // seconds
}, 429, {
  'Retry-After': '60'
});
```

**Expected Outcome:**
- Brute force attacks: Prevented (max 5 login attempts/minute)
- Chat spam: Prevented (max 10 messages/minute)
- API abuse: Prevented (consistent limits across all endpoints)
- DDoS resilience: Improved (Cloudflare Workers + rate limiting)

**Please provide:**
1. List of all sensitive endpoints requiring rate limiting
2. Recommended rate limit policy for each endpoint type
3. Updated middleware implementation (if needed)
4. Monitoring/alerting strategy for rate limit violations
5. Testing strategy (simulate rate limit scenarios)

**Success Criteria:**
- [ ] All sensitive endpoints have rate limiting
- [ ] Policies are reasonable (not too strict, not too lenient)
- [ ] 429 responses include retry-after header
- [ ] Rate limit violations are logged
- [ ] No false positives for legitimate users
```

---

## 9️⃣ 에러 핸들링 표준화

### 📋 제미나이 프롬프트

```
**Task: Standardize error handling across all 177 API endpoints**

**Context:**
Inconsistent error responses make debugging difficult and provide poor developer experience. Standardize all error handling with a unified format and error middleware.

**Current Problems:**

1. **Inconsistent error formats:**
   ```typescript
   // Some endpoints
   return c.json({ success: false, error: 'Error message' }, 500);
   
   // Other endpoints
   return c.json({ error: 'Error message' }, 400);
   
   // Yet others
   return c.json({ success: false, message: 'Error' }, 404);
   ```

2. **Missing error details:**
   - No error codes (e.g., USER_NOT_FOUND, INVALID_INPUT)
   - No request ID for debugging
   - No stack traces in development

3. **Poor client experience:**
   - Generic error messages
   - No indication of how to fix the issue
   - No retry guidance

**Proposed Standard:**

1. **Error Response Format:**
   ```typescript
   {
     "success": false,
     "error": {
       "code": "USER_NOT_FOUND",           // Machine-readable code
       "message": "User not found",         // Human-readable message
       "details": {                         // Optional additional info
         "userId": 123,
         "field": "email"
       },
       "timestamp": 1709567890000,          // Unix timestamp
       "requestId": "req_abc123xyz",        // For support/debugging
       "documentation": "/docs/errors/user-not-found" // Optional help link
     }
   }
   ```

2. **Error Classes:**
   ```typescript
   // lib/errors.ts
   export class ApiError extends Error {
     constructor(
       public message: string,
       public statusCode: number = 500,
       public errorCode: string = 'INTERNAL_ERROR',
       public details?: any
     ) {
       super(message);
       this.name = 'ApiError';
     }
   }
   
   export class ValidationError extends ApiError {
     constructor(message: string, details?: any) {
       super(message, 400, 'VALIDATION_ERROR', details);
     }
   }
   
   export class NotFoundError extends ApiError {
     constructor(resource: string, id: any) {
       super(`${resource} not found`, 404, 'NOT_FOUND', { id });
     }
   }
   
   export class UnauthorizedError extends ApiError {
     constructor(message: string = 'Unauthorized') {
       super(message, 401, 'UNAUTHORIZED');
     }
   }
   
   export class ForbiddenError extends ApiError {
     constructor(message: string = 'Forbidden') {
       super(message, 403, 'FORBIDDEN');
     }
   }
   ```

3. **Global Error Handler:**
   ```typescript
   // index.tsx
   app.onError((err, c) => {
     const isDev = c.env.ENVIRONMENT === 'development';
     
     // Generate request ID
     const requestId = c.req.header('x-request-id') || 
       `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
     
     // Log error
     console.error('[API Error]', {
       requestId,
       error: err.message,
       stack: err.stack,
       path: c.req.path,
       method: c.req.method,
     });
     
     // Handle known errors
     if (err instanceof ApiError) {
       return c.json({
         success: false,
         error: {
           code: err.errorCode,
           message: err.message,
           details: err.details,
           timestamp: Date.now(),
           requestId,
           ...(isDev && { stack: err.stack })
         }
       }, err.statusCode);
     }
     
     // Handle unknown errors
     return c.json({
       success: false,
       error: {
         code: 'INTERNAL_ERROR',
         message: isDev ? err.message : 'An unexpected error occurred',
         timestamp: Date.now(),
         requestId,
         ...(isDev && { stack: err.stack })
       }
     }, 500);
   });
   ```

4. **Usage in Endpoints:**
   ```typescript
   // Instead of:
   if (!user) {
     return c.json({ error: 'User not found' }, 404);
   }
   
   // Use:
   if (!user) {
     throw new NotFoundError('User', userId);
   }
   
   // Instead of:
   if (!isValid) {
     return c.json({ success: false, error: 'Invalid input' }, 400);
   }
   
   // Use:
   if (!isValid) {
     throw new ValidationError('Invalid input', { field: 'email', value });
   }
   ```

**Error Codes to Define:**
```typescript
export enum ErrorCodes {
  // Authentication
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // Resources
  NOT_FOUND = 'NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  
  // Business Logic
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  ORDER_ALREADY_PAID = 'ORDER_ALREADY_PAID',
  INVALID_ORDER_STATUS = 'INVALID_ORDER_STATUS',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // System
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
}
```

**Requirements:**
1. Create error classes and error handler middleware
2. Refactor all 177 endpoints to use standard error handling
3. Define comprehensive error codes for all scenarios
4. Add request ID tracking for debugging
5. Include helpful error messages and documentation links

**Expected Outcome:**
- Consistent error format across all endpoints
- Easier debugging with request IDs and error codes
- Better developer experience for API consumers
- Reduced time spent on error investigation (50% reduction)

**Please provide:**
1. Complete error classes implementation (lib/errors.ts)
2. Global error handler middleware
3. Error codes enum with all scenarios
4. Refactored examples for common endpoint patterns
5. Migration guide for updating existing endpoints
6. Documentation for error handling best practices

**Success Criteria:**
- [ ] All error responses follow standard format
- [ ] Request IDs generated for all errors
- [ ] Error codes defined for all scenarios
- [ ] Stack traces only in development
- [ ] Error documentation available
```

---

## 🔟 TypeScript 타입 안전성 강화

### 📋 제미나이 프롬프트

```
**Task: Strengthen TypeScript type safety across database queries and API responses**

**Context:**
Many database queries use `any` type or unsafe type assertions (`as any[]`), leading to potential runtime errors and poor IDE support.

**Current Problems:**

1. **Unsafe type assertions:**
   ```typescript
   const order: any = await DB.prepare('SELECT * FROM orders WHERE id = ?').first();
   const items = result.results as any[]; // No type safety
   ```

2. **Missing type definitions:**
   ```typescript
   // No types for DB query results
   const products = await DB.prepare('SELECT * FROM products').all();
   // products.results has type 'unknown'
   ```

3. **Inconsistent type usage:**
   ```typescript
   // Some endpoints have types
   interface Product { ... }
   
   // Others don't
   const product = await DB.prepare('...').first(); // type: unknown
   ```

**Proposed Solution:**

1. **Define comprehensive database types:**
   ```typescript
   // types/database.ts
   export interface User {
     id: number;
     name: string;
     email: string;
     phone: string | null;
     user_type: 'buyer' | 'seller' | 'admin';
     created_at: string;
     updated_at: string;
   }
   
   export interface Product {
     id: number;
     seller_id: number;
     name: string;
     description: string;
     price: number;
     original_price: number | null;
     discount_rate: number;
     stock: number;
     category: string;
     image_url: string;
     thumbnail_url: string | null;
     is_active: number; // SQLite uses 0/1 for boolean
     created_at: string;
     updated_at: string;
   }
   
   export interface Order {
     id: number;
     user_id: number;
     order_number: string;
     status: 'pending' | 'paid' | 'preparing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
     payment_status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';
     total_amount: number;
     shipping_fee: number;
     payment_method: string;
     payment_key: string | null;
     shipping_address: string;
     shipping_name: string;
     shipping_phone: string;
     delivery_request: string | null;
     tracking_number: string | null;
     carrier: string | null;
     created_at: string;
     updated_at: string;
   }
   
   export interface OrderItem {
     id: number;
     order_id: number;
     product_id: number;
     option_id: number | null;
     seller_id: number;
     quantity: number;
     price: number;
     created_at: string;
   }
   
   // ... define all other tables
   ```

2. **Create typed query helpers:**
   ```typescript
   // lib/db-helpers.ts
   import type { D1Database } from '@cloudflare/workers-types';
   
   export async function queryOne<T>(
     db: D1Database,
     query: string,
     ...params: any[]
   ): Promise<T | null> {
     const result = await db.prepare(query).bind(...params).first();
     return result as T | null;
   }
   
   export async function queryAll<T>(
     db: D1Database,
     query: string,
     ...params: any[]
   ): Promise<T[]> {
     const result = await db.prepare(query).bind(...params).all();
     return result.results as T[];
   }
   
   export async function queryRun(
     db: D1Database,
     query: string,
     ...params: any[]
   ): Promise<D1Response> {
     return db.prepare(query).bind(...params).run();
   }
   ```

3. **Usage in endpoints:**
   ```typescript
   // Instead of:
   const order: any = await DB.prepare('SELECT * FROM orders WHERE id = ?')
     .bind(orderId).first();
   
   // Use:
   const order = await queryOne<Order>(
     DB,
     'SELECT * FROM orders WHERE id = ?',
     orderId
   );
   // order has type: Order | null
   
   if (!order) {
     throw new NotFoundError('Order', orderId);
   }
   
   // TypeScript knows order.status is valid
   if (order.status === 'paid') { ... }
   ```

4. **API response types:**
   ```typescript
   // types/api.ts
   export interface ApiResponse<T = any> {
     success: boolean;
     data?: T;
     error?: {
       code: string;
       message: string;
       details?: any;
     };
   }
   
   // Usage:
   return c.json<ApiResponse<Order>>({
     success: true,
     data: order
   });
   ```

5. **JOIN query types:**
   ```typescript
   // For complex queries with joins
   interface OrderWithItems extends Order {
     items: Array<OrderItem & {
       product_name: string;
       image_url: string;
       option_value: string | null;
     }>;
   }
   
   const ordersWithItems = await queryAll<OrderWithItems>(
     DB,
     `SELECT o.*, oi.*, p.name as product_name ...`,
     userId
   );
   ```

**Requirements:**
1. Define TypeScript interfaces for all database tables
2. Create typed query helper functions
3. Update all 289 queries to use typed helpers
4. Add strict type checking to API responses
5. Enable strict TypeScript mode in tsconfig.json

**TypeScript Config Updates:**
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

**Expected Outcome:**
- Catch type errors at compile time (not runtime)
- Better IDE autocomplete and IntelliSense
- Safer refactoring (compiler catches breaking changes)
- Self-documenting code (types as documentation)
- Reduced runtime errors by 50%+

**Please provide:**
1. Complete database type definitions (types/database.ts)
2. Typed query helper functions (lib/db-helpers.ts)
3. Updated API response types (types/api.ts)
4. Example refactoring for 10-20 endpoints
5. Migration strategy for updating all 289 queries
6. tsconfig.json updates for strict mode

**Success Criteria:**
- [ ] All database tables have TypeScript interfaces
- [ ] All 289 queries use typed helpers
- [ ] No `any` types in database queries
- [ ] Strict TypeScript mode enabled
- [ ] Build succeeds with no type errors
- [ ] IDE autocomplete works for all queries
```

---

## 📚 프롬프트 사용 가이드

### 사용 방법
1. 각 프롬프트를 복사하여 제미나이 AI에게 붙여넣기
2. 제미나이가 제공한 코드/가이드를 검토
3. 로컬에서 테스트 후 프로덕션 적용
4. 다음 태스크로 진행

### 우선순위 순서
1. 🔥🔥🔥🔥🔥 **Task 1**: SSE 채팅 전환
2. 🔥🔥🔥🔥🔥 **Task 2**: Firebase 제거
3. 🔥🔥🔥🔥 **Task 3**: 반복문 DB 쿼리 제거
4. 🔥🔥🔥 **Task 4**: 캐시 확장
5. 🔥🔥🔥 **Task 5**: 코드 분할
6. 🔥🔥 **Task 6-10**: 나머지 작업

### 예상 소요 시간
- **Phase 1** (Task 1-3): 6-9 시간
- **Phase 2** (Task 4-6): 8-12 시간
- **Phase 3** (Task 7-10): 8-10 시간
- **총**: 22-31 시간

---

**작성일**: 2026-02-22  
**작성자**: AI Assistant  
**버전**: 1.0
