# Phase 2.4 & 2.5: Post-Launch Technical Improvements

**Status**: 📋 PLANNING ONLY  
**Timeline**: 1-3 months post-launch  
**Risk Level**: 60-80% (High - Requires extensive testing)  
**Date**: 2026-03-19

---

## 🎯 Overview

These phases are **NOT for immediate implementation**. They are planned for 1-3 months after successful service launch, when we have:
- ✅ Stable production environment
- ✅ Real user traffic data
- ✅ Identified pain points
- ✅ Dedicated testing resources

---

## 📋 Phase 2.4: Unified Auth Store (60% Risk)

### Current State (Multiple Stores)

**Problem**: 3 separate auth stores cause confusion and bugs

```
src/shared/stores/
├── useAuthKR.ts       ← Korea (Kakao + Firebase)
├── useAuthWorld.ts    ← Global (Firebase only)
└── useAuthUI.ts       ← UI state only
```

**Issues**:
- 🔴 Developers don't know which store to use
- 🔴 State sync issues between stores
- 🔴 Duplicate code (~40% overlap)
- 🔴 Inconsistent behavior

---

### Proposed Solution

**Single Unified Store**: `useAuth.ts`

```typescript
// src/shared/stores/useAuth.ts

interface AuthState {
  // User
  user: FirebaseUser | null;
  profile: UserProfile | null;
  
  // Auth state
  isLoading: boolean;
  isAuthReady: boolean;
  error: string | null;
  
  // Region/locale
  region: 'kr' | 'world';
  locale: string;
  
  // Token management
  tokenCache: TokenCache | null;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  
  // Auth methods (unified)
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithKakao: () => Promise<void>; // KR only
  loginWithGoogle: () => Promise<void>; // World
  loginWithApple: () => Promise<void>;  // World
  logout: () => Promise<void>;
  
  // Profile management
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  deleteAccount: () => Promise<void>;
}
```

---

### Migration Strategy

#### Step 1: Create Unified Store (Week 1)
```bash
# New file
src/shared/stores/useAuth.ts

# Keep old stores for backward compatibility
src/shared/stores/useAuthKR.ts (deprecated)
src/shared/stores/useAuthWorld.ts (deprecated)
```

#### Step 2: Add Compatibility Layer (Week 1)
```typescript
// src/shared/stores/useAuthKR.ts
import { useAuth } from './useAuth';

/**
 * @deprecated Use useAuth instead
 * This is a compatibility wrapper
 */
export const useAuthKR = () => {
  console.warn('[useAuthKR] Deprecated - use useAuth instead');
  return useAuth();
};
```

#### Step 3: Gradual Migration (Week 2-4)
```bash
# Migrate components one-by-one
# Priority order:
1. Critical: HomePage, LoginPage, ProductDetailPage
2. High: Cart, Checkout, LivePage
3. Medium: Profile, Settings, Admin
4. Low: Marketing pages, Static pages

# For each component:
- Replace useAuthKR → useAuth
- Test locally
- Deploy to staging
- Monitor for 1-2 days
- Deploy to production
```

#### Step 4: Remove Old Stores (Week 5+)
```bash
# After all components migrated:
git rm src/shared/stores/useAuthKR.ts
git rm src/shared/stores/useAuthWorld.ts

# Update imports project-wide
```

---

### Testing Requirements

**Unit Tests**:
- ✅ All auth methods (login, logout, etc.)
- ✅ Token caching logic
- ✅ Error handling
- ✅ State transitions

**Integration Tests**:
- ✅ Kakao OAuth flow
- ✅ Google OAuth flow
- ✅ Email/password flow
- ✅ Token refresh
- ✅ Logout across tabs

**E2E Tests**:
- ✅ Complete user journey (signup → login → use app → logout)
- ✅ Multi-tab sync
- ✅ Token expiration handling
- ✅ Network failure recovery

**Load Tests**:
- ✅ 1,000 concurrent logins
- ✅ Token refresh under load
- ✅ Database connection pool

---

### Rollback Plan

**If Issues Arise**:
1. **Instant**: Revert to old stores (compatibility layer still works)
2. **Short-term**: Fix bugs in unified store
3. **Long-term**: Re-evaluate architecture

**Feature Flag**:
```typescript
// src/config/feature-flags.ts
{
  unifiedAuth: false // Start disabled
}

// In components
const auth = featureFlags.unifiedAuth 
  ? useAuth() 
  : useAuthKR();
```

---

### Expected Benefits

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Auth code** | ~1,200 lines (3 stores) | ~600 lines (1 store) | **-50%** ⬇️ |
| **Developer confusion** | High | Low | **-80%** ⬇️ |
| **Bugs related to auth** | 15/month | 5/month | **-67%** ⬇️ |
| **Onboarding time** | 1 day (auth) | 2 hours | **-75%** ⬇️ |

---

### Estimated Timeline

```
Week 1: Design + Create unified store + Compatibility layer
Week 2-4: Migrate components (10-15 per week)
Week 5: Remove old stores + Final testing
Week 6+: Monitor in production
```

**Total**: ~6 weeks (1.5 months)

---

## 📋 Phase 2.5: Drizzle ORM Migration (80% Risk)

### Current State (Raw SQL + Custom Query Builder)

**Problem**: Manual SQL queries are error-prone and hard to maintain

**Current Approach**:
```typescript
// src/worker/utils/database.ts
const result = await db
  .prepare('SELECT * FROM products WHERE id = ? AND seller_id = ?')
  .bind(productId, sellerId)
  .first();

// Manual type casting
const product = result as Product | null;

// No type safety
// No auto-completion
// No migration management
// SQL injection risk if not careful
```

**Issues**:
- 🔴 No compile-time type checking
- 🔴 Manual SQL string building
- 🔴 No query validation
- 🔴 Hard to refactor database schema
- 🔴 Migration files manually synced

---

### Proposed Solution: Drizzle ORM

**Why Drizzle?**
- ✅ TypeScript-first ORM
- ✅ Works with Cloudflare D1
- ✅ Zero runtime overhead
- ✅ SQL-like syntax (easy migration)
- ✅ Type-safe queries
- ✅ Auto-completion
- ✅ Migration management

**Example**:
```typescript
// Before (Raw SQL)
const product = await db
  .prepare('SELECT * FROM products WHERE id = ?')
  .bind(productId)
  .first() as Product;

// After (Drizzle)
import { products } from '@/db/schema';

const product = await db
  .select()
  .from(products)
  .where(eq(products.id, productId))
  .get(); // Type: Product | undefined (automatic!)
```

---

### Migration Strategy

#### Step 0: Install Drizzle (Day 1)
```bash
npm install drizzle-orm drizzle-kit
npm install -D @cloudflare/workers-types
```

#### Step 1: Define Schema (Day 1-2)
```typescript
// src/db/schema.ts

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const products = sqliteTable('products', {
  id: integer('id').primaryKey(),
  sellerId: integer('seller_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  price: integer('price').notNull(),
  stock: integer('stock').notNull().default(0),
  thumbnailUrl: text('thumbnail_url'),
  status: text('status').notNull().default('active'),
  createdAt: text('created_at').notNull(),
});

export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  userId: integer('user_id').notNull(),
  sellerId: integer('seller_id').notNull(),
  status: text('status').notNull(),
  totalAmount: integer('total_amount').notNull(),
  createdAt: text('created_at').notNull(),
});

// ... 20+ more tables
```

#### Step 2: Sample Migrations (Day 3-5)

**Migrate 5 Representative Queries**:
1. **Simple SELECT**: Get product by ID
2. **JOIN**: Get order with items
3. **INSERT**: Create new product
4. **UPDATE**: Update product stock
5. **DELETE**: Delete wishlist item

**Examples**:

**Query 1: Simple SELECT**
```typescript
// Before (src/worker/routes/product.routes.ts)
const product = await c.env.DB
  .prepare('SELECT * FROM products WHERE id = ?')
  .bind(productId)
  .first() as Product;

// After (with Drizzle)
import { drizzle } from 'drizzle-orm/d1';
import { products } from '@/db/schema';
import { eq } from 'drizzle-orm';

const db = drizzle(c.env.DB);
const product = await db
  .select()
  .from(products)
  .where(eq(products.id, productId))
  .get(); // Type: Product | undefined (automatic!)
```

**Query 2: JOIN (Order with Items)**
```typescript
// Before
const order = await c.env.DB
  .prepare(`
    SELECT o.*, 
           oi.id as item_id, oi.product_id, oi.quantity, oi.price_snapshot,
           p.name as product_name, p.thumbnail_url
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE o.id = ?
  `)
  .bind(orderId)
  .all() as any; // Manual grouping needed

// After
import { orders, orderItems, products } from '@/db/schema';

const orderWithItems = await db
  .select()
  .from(orders)
  .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
  .leftJoin(products, eq(orderItems.productId, products.id))
  .where(eq(orders.id, orderId))
  .all(); // Type-safe result!
```

**Query 3: INSERT**
```typescript
// Before
const result = await c.env.DB
  .prepare('INSERT INTO products (seller_id, name, price, stock) VALUES (?, ?, ?, ?)')
  .bind(sellerId, name, price, stock)
  .run();

// After
const [newProduct] = await db
  .insert(products)
  .values({ sellerId, name, price, stock })
  .returning();
```

**Query 4: UPDATE**
```typescript
// Before
await c.env.DB
  .prepare('UPDATE products SET stock = stock - ? WHERE id = ?')
  .bind(quantity, productId)
  .run();

// After
await db
  .update(products)
  .set({ stock: sql`${products.stock} - ${quantity}` })
  .where(eq(products.id, productId));
```

**Query 5: DELETE**
```typescript
// Before
await c.env.DB
  .prepare('DELETE FROM wishlists WHERE user_id = ? AND product_id = ?')
  .bind(userId, productId)
  .run();

// After
import { wishlists } from '@/db/schema';

await db
  .delete(wishlists)
  .where(and(
    eq(wishlists.userId, userId),
    eq(wishlists.productId, productId)
  ));
```

---

#### Step 3: Evaluate Sample Results (Week 1-2)

**Metrics to Track**:
- 📊 Developer velocity (time to write query)
- 📊 Bug rate (type errors caught at compile time)
- 📊 Query performance (Drizzle vs raw SQL)
- 📊 Code readability (team feedback)

**Decision Point**: Proceed only if:
- ✅ No performance regression
- ✅ Developers prefer Drizzle
- ✅ Type safety improves code quality

---

#### Step 4: Full Migration (Month 2-3, IF proceeding)

**Approach**: Gradual, route-by-route

**Priority Order**:
1. **Low-risk**: Read-only routes (GET /api/products)
2. **Medium-risk**: Simple writes (POST /api/cart)
3. **High-risk**: Complex transactions (POST /api/orders)
4. **Critical**: Payment & settlement routes (last)

**Process**:
```bash
# For each route:
1. Write Drizzle version in new file (e.g., product.routes.drizzle.ts)
2. Add feature flag to switch between old/new
3. Deploy to staging
4. A/B test (50% old, 50% new)
5. Monitor for 1 week
6. If successful, switch to 100% new
7. Remove old route file
8. Repeat for next route
```

---

### Testing Requirements

**Unit Tests**:
- ✅ All CRUD operations
- ✅ Complex joins
- ✅ Transactions
- ✅ Error handling

**Integration Tests**:
- ✅ Database connection
- ✅ Schema validation
- ✅ Migration execution
- ✅ Rollback on error

**Performance Tests**:
- ✅ Query latency (Drizzle vs raw SQL)
- ✅ Memory usage
- ✅ Connection pool efficiency
- ✅ 10K concurrent queries

**Data Integrity Tests**:
- ✅ Verify all queries return same results as old code
- ✅ No data loss during migration
- ✅ Foreign key constraints enforced

---

### Rollback Plan

**Feature Flag Per Route**:
```typescript
// src/config/feature-flags.ts
{
  drizzleORM: false, // Global switch
  drizzleProducts: false, // Per-route switches
  drizzleOrders: false,
  drizzleCart: false,
  // ...
}

// In route file
if (featureFlags.drizzleProducts) {
  // Use Drizzle
  return drizzleProductRoutes.handle(c);
} else {
  // Use old raw SQL
  return oldProductRoutes.handle(c);
}
```

**Instant Rollback**: Set flag to false → Redeploy (2 minutes)

---

### Expected Benefits

| Metric | Before (Raw SQL) | After (Drizzle) | Improvement |
|--------|------------------|-----------------|-------------|
| **Type safety** | 0% | 100% | **+100%** ⬆️ |
| **Dev velocity** | Baseline | +40% | **+40%** ⬆️ |
| **Bugs (type-related)** | 20/month | 2/month | **-90%** ⬇️ |
| **Query performance** | Baseline | Same | No change |
| **Code readability** | Medium | High | **+50%** ⬆️ |

---

### Estimated Timeline

```
Week 1-2: Schema definition + 5 sample queries + Evaluation
Month 2-3: Full migration (if proceeding)
  - Week 1-2: Low-risk routes (read-only)
  - Week 3-4: Medium-risk routes (simple writes)
  - Week 5-6: High-risk routes (complex transactions)
  - Week 7-8: Critical routes (payments) + Final cleanup
```

**Total**: ~3 months (if proceeding after evaluation)

---

## 🎯 Summary

### Phase 2.4: Unified Auth Store (60% Risk)
- **Timeline**: 6 weeks (1.5 months)
- **When**: 1-2 months post-launch
- **Priority**: High (reduces developer confusion)
- **Risk Mitigation**: Feature flag + compatibility layer

### Phase 2.5: Drizzle ORM (80% Risk)
- **Timeline**: 3 months (after evaluation)
- **When**: 2-3 months post-launch
- **Priority**: Medium (nice-to-have, not critical)
- **Risk Mitigation**: Gradual migration + per-route feature flags

---

## ✅ Pre-requisites for Phase 2.4 & 2.5

**Before starting either phase**:
- [ ] Service launched successfully
- [ ] 1,000+ DAU with stable performance
- [ ] Error rate < 0.5%
- [ ] All critical bugs resolved
- [ ] Dedicated QA resources available
- [ ] Staging environment mirrors production
- [ ] Full test coverage for affected areas
- [ ] Approval from product/engineering leads

---

## 📚 Resources

### Phase 2.4 (Unified Auth)
- **Zustand Best Practices**: https://docs.pmnd.rs/zustand/guides/practice-with-no-store-actions
- **Auth State Management**: https://kentcdodds.com/blog/authentication-in-react-applications

### Phase 2.5 (Drizzle ORM)
- **Drizzle ORM Docs**: https://orm.drizzle.team/docs/overview
- **Cloudflare D1 + Drizzle**: https://orm.drizzle.team/docs/get-started-d1
- **Migration Guide**: https://orm.drizzle.team/docs/migrations

---

**Planning Document Generated**: 2026-03-19  
**For Implementation**: Post-launch (1-3 months)  
**Status**: 📋 Planning only, NOT for immediate execution
