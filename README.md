# Global Marketplace — Cloudflare Worker + React + D1

> **Multi-seller marketplace** built on Cloudflare Worker (Hono), React 18, Cloudflare D1 (SQLite), Toss Payments, and Zustand.  
> Fully TypeScript, edge-native, globally deployable.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                 Cloudflare Edge                      │
│  ┌──────────────────────────────────────────────┐   │
│  │        Cloudflare Worker (Hono)              │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐   │   │
│  │  │  /auth   │  │/products │  │ /orders  │   │   │
│  │  └──────────┘  └──────────┘  └──────────┘   │   │
│  │  ┌────────────────────────────────────────┐  │   │
│  │  │  /payments/webhook  (HMAC-SHA256)      │  │   │
│  │  └────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────┘   │
│           │                      │                   │
│     ┌─────▼──────┐        ┌─────▼──────┐            │
│     │ D1 SQLite  │        │  React SPA │            │
│     │(orders/    │        │(Vite/TSX)  │            │
│     │ products)  │        └────────────┘            │
│     └────────────┘                                   │
└─────────────────────────────────────────────────────┘
                           │
                  ┌────────▼────────┐
                  │  Toss Payments  │
                  │  (Webhook POST) │
                  └─────────────────┘
```

## Features

### ✅ Toss Payments Webhook (`POST /api/payments/webhook`)
- **HMAC-SHA256** signature verification via `TOSS_WEBHOOK_SECRET`
- Event handling:
  - `payment.confirmed` → order status `DONE`, stock reduced
  - `payment.cancelled` → order status `CANCELLED`, stock restored
  - `payment.failed` → order status `FAILED`
  - `payment.virtual_account_issued` → status `AWAITING_PAYMENT`
  - `payment.virtual_account_deposited` → same as `payment.confirmed`
- **Idempotency** via `webhook_events` table (unique index on `source + event_type + toss_order_id`)
- **Always returns HTTP 200** to prevent Toss retry storms
- Constant-time signature comparison (timing-attack resistant)

### ✅ Multi-Seller Cart (Zustand)
- Cart items grouped by `seller_id` → `Map<string, CartItem[]>`
- Per-seller shipping fee calculation (`free_shipping_threshold`)
- Seller info cached in Zustand persist storage
- Cart sections rendered per seller in `CartPage`

### ✅ Multi-Seller Checkout
- Single `order_number` shared across all seller orders
- One `POST /api/orders` per seller (idempotency key: `orderNumber:sellerId`)
- Single Toss payment for combined total
- Separate `orders` rows per seller in DB (idempotent via `idempotency_key` unique index)
- Race condition safety: `idempotency_key` unique constraint prevents duplicates

### ✅ Global i18n Support
- Languages: 🇰🇷 Korean, 🇺🇸 English, 🇯🇵 Japanese, 🇨🇳 Chinese, 🇪🇸 Spanish, 🇫🇷 French, 🇸🇦 Arabic (RTL)
- Currencies: KRW, USD, JPY, CNY, EUR, GBP, AUD, CAD, SGD, SAR, AED
- `Accept-Language` header detection in Worker
- `Intl.NumberFormat` for locale-aware currency formatting

### ✅ Database Schema (Cloudflare D1 / SQLite)
- `sellers` — multi-seller support, shipping settings
- `users` — auth, i18n preferences
- `products` — with stock, i18n content fields
- `orders` — one per seller per checkout, shared `order_number`
- `order_items` — snapshot prices, seller_id
- `webhook_events` — idempotency audit trail
- `carts` — server-side cart sync
- `refresh_tokens` — JWT refresh
- Auto `updated_at` triggers on all tables

---

## Quick Start

### Prerequisites
- Node.js 18+
- Wrangler CLI (`npm install -g wrangler`)

### Install
```bash
npm install
```

### Environment Variables (`.dev.vars`)
```env
TOSS_CLIENT_KEY=test_ck_...
TOSS_SECRET_KEY=test_sk_...
TOSS_WEBHOOK_SECRET=your_webhook_secret   # or "dev_skip" to bypass in dev
JWT_SECRET=your_jwt_secret_at_least_32_chars
ENVIRONMENT=development
FRONTEND_URL=http://localhost:5173
```

### Database Setup
```bash
# Create local D1 DB and run migrations
npm run db:migrate
npm run db:seed

# Or apply seed directly with sqlite3/sqlite-utils
python3 -m sqlite_utils insert --import migrations/002_seed.sql
```

### Development
```bash
npm run dev          # starts Worker (port 8787) + React Vite (port 5173)
npm run dev:worker   # Worker only
npm run dev:client   # React only
```

### Build
```bash
npm run build        # builds client + worker
```

### Deploy to Cloudflare
```bash
# 1. Create D1 database
wrangler d1 create marketplace-db

# 2. Update database_id in wrangler.toml

# 3. Run production migration
npm run db:migrate:prod

# 4. Set production secrets
wrangler secret put TOSS_SECRET_KEY
wrangler secret put TOSS_WEBHOOK_SECRET
wrangler secret put JWT_SECRET

# 5. Deploy
npm run deploy
```

---

## API Reference

### Authentication
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register (email, password, name) |
| POST | `/api/auth/login` | Login → JWT access + refresh tokens |
| GET | `/api/auth/me` | Get current user (requires Bearer) |

### Products
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | List products (page, limit, seller_id, search) |
| GET | `/api/products/:id` | Product detail |

### Orders
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/orders` | Create order (requires auth, idempotency_key) |
| GET | `/api/orders` | List user orders |
| GET | `/api/orders/:id` | Order detail |
| POST | `/api/orders/:id/cancel` | Cancel order |

### Payments
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/payments/confirm` | Confirm Toss payment (after widget redirect) |
| POST | `/api/payments/webhook` | **Toss webhook** (HMAC-protected, always 200) |
| POST | `/api/payments/checkout-session` | Get checkout session info |

---

## Toss Webhook Registration

### Steps in Toss Developer Center
1. Go to **개발자 센터** → **Webhook** 설정
2. Add endpoint: `https://your-worker.your-domain.workers.dev/api/payments/webhook`
3. Select events: `payment.confirmed`, `payment.cancelled`, `payment.failed`, `payment.virtual_account_issued`, `payment.virtual_account_deposited`
4. Copy the generated **Webhook Secret**
5. Set it: `wrangler secret put TOSS_WEBHOOK_SECRET`

### cURL Test
```bash
# Generate signature
SECRET="your_webhook_secret"
PAYLOAD='{"eventType":"payment.confirmed","createdAt":"2026-01-01T00:00:00Z","data":{"paymentKey":"test_pk_123","orderId":"ORD-20260101-ABCDEF","orderName":"Test","status":"DONE","totalAmount":32900,"currency":"KRW","method":"CARD","approvedAt":"2026-01-01T00:00:00Z"}}'
SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

# Send webhook
curl -X POST https://your-worker.workers.dev/api/payments/webhook \
  -H "Content-Type: application/json" \
  -H "Toss-Signature: v1=$SIG" \
  -d "$PAYLOAD"
# Expected: {"received":true,"status":"processed"}

# Test duplicate (idempotency)
curl -X POST https://your-worker.workers.dev/api/payments/webhook \
  -H "Content-Type: application/json" \
  -H "Toss-Signature: v1=$SIG" \
  -d "$PAYLOAD"
# Expected: {"received":true,"status":"duplicate_skipped"}
```

---

## Monitoring Log Keywords

| Keyword | Meaning |
|---------|---------|
| `[WEBHOOK] RECEIVED` | New webhook event received |
| `[WEBHOOK] PAYMENT_CONFIRMED` | Confirmed → orders set DONE |
| `[WEBHOOK] PAYMENT_CANCELLED` | Cancelled → stock restored |
| `[WEBHOOK] PAYMENT_FAILED` | Failed payment |
| `[WEBHOOK] DUPLICATE_SKIPPED` | Idempotent duplicate ignored |
| `[WEBHOOK] INVALID_SIGNATURE` | Possible spoofed request |
| `[WEBHOOK] PROCESSING_ERROR` | Unexpected error (DB etc.) |
| `[WEBHOOK] STOCK_REDUCED` | Stock decremented on confirm |
| `[WEBHOOK] STOCK_RESTORED` | Stock restored on cancel |
| `[ORDERS] Created` | New order created |
| `[PAYMENTS] CONFIRMED` | Payment confirm API call succeeded |

---

## Multi-Seller Cart Flow

```
User adds Product A (seller-001) + Product B (seller-002) to cart
                    │
                    ▼
         CartPage: SellerGroup [seller-001]
                     ├── Product A × 1  ₩29,900
                     └── Shipping: ₩3,000 (or Free if ≥₩50,000)
                   SellerGroup [seller-002]
                     ├── Product B × 1  ₩89,000
                     └── Shipping: Free (≥₩50,000)
                    │
                    ▼
           CheckoutPage (shipping form)
                    │
                    ▼
         POST /api/orders (seller-001 items)  ──► Order A  (ORD-20260313-XXXXX)
         POST /api/orders (seller-002 items)  ──► Order B  (ORD-20260313-XXXXX)
                    │
                    ▼
         POST /api/payments/checkout-session
                    │
                    ▼
         Toss Payments Widget (total = ₩121,900)
                    │
         User pays  │
                    ▼
         POST /api/payments/webhook (payment.confirmed)
                    │
         ┌──────────▼──────────┐
         │ Order A → DONE      │  stock reduced
         │ Order B → DONE      │  stock reduced
         └─────────────────────┘
```

---

## Playwright E2E Tests

```bash
npm run test:e2e
# or headed mode:
npm run test:e2e:headed
```

### Test Cases (20 total)
| Suite | Tests |
|-------|-------|
| Cart - Multi-Seller | TC01–TC05: grouping, seller names, qty update, remove, shipping total |
| Checkout Flow | TC06–TC10: auth redirect, form display, validation, seller grouping, API |
| Toss Webhook | TC11–TC15: valid sig, invalid sig (200), idempotency, cancelled, failed |
| Order Management | TC16–TC18: list, success page, fail page |
| API Multi-Seller | TC19–TC20: same order_number for 2 sellers, idempotent creation |

---

## Regression Test Points

When modifying webhook or order logic:
1. `TOSS_WEBHOOK_SECRET=dev_skip` → signature verification bypassed (dev only)
2. Sending same payload twice → must get `duplicate_skipped` on 2nd request
3. `payment.cancelled` on already-PENDING order → no stock restore (guard in handler)
4. Multi-seller order: both orders share `order_number`, get updated together on webhook
5. Idempotency key collision → returns 200 with existing order (no duplicate DB write)
6. Stock cannot go below 0 (guarded by `WHERE stock_quantity >= ?` in reduceStock)

---

## Future Global Expansion Considerations

### Phase 2 — Notifications
- Email notifications via Cloudflare Email Workers or SendGrid
- Push notifications via Web Push API
- Add `notification_preferences` to users table

### Phase 3 — Multi-Currency
- Real-time exchange rates via Workers KV (cache daily)
- Display prices in user's preferred currency
- Settlement in seller's base currency

### Phase 4 — Regional Compliance
- GDPR data deletion endpoints (EU)
- PCI DSS: never store raw card data (Toss handles tokenization)
- Korea: 통신판매업 신고 integration
- Japan: 特定商取引法 disclosure pages

### Phase 5 — Performance
- R2 for product images (CDN, global edge)
- KV for product catalog caching (reduce D1 reads)
- Durable Objects for real-time inventory locking
- Analytics Engine for purchase funnel metrics

### Phase 6 — Seller Onboarding
- Seller dashboard (product CRUD, order fulfillment)
- Seller KYC (business verification)
- Automated payouts via bank transfer API

### Known Remaining Items (Non-blocking)
- [ ] Toss cancel API call on order cancel (Phase 2)
- [ ] User push notification for `payment.failed` (Phase 2)
- [ ] bcrypt/argon2 for passwords (currently SHA-256 + salt)
- [ ] Rate limiting on auth endpoints (use Cloudflare WAF rules)
- [ ] Optimistic UI for cart updates

---

## Branch Strategy

```
main (production)
  └── genspark_ai_developer (this PR — multi-seller MVP)
        ├── feature/toss-webhook
        ├── feature/multi-seller-cart
        └── feature/global-i18n
```

### Suggested PR: `multi-seller-mvp`

**Title**: `feat: Multi-seller cart, Toss webhook HMAC, global i18n`

**Description**:
- ✅ Toss Payments server webhook with HMAC-SHA256 verification
- ✅ Multi-seller cart grouping in Zustand + CartPage UI
- ✅ Multi-seller checkout: one order per seller, shared Toss payment
- ✅ Idempotency: webhook events + order creation  
- ✅ Stock reduce/restore on payment.confirmed/cancelled
- ✅ Global i18n: 7 languages, 12 currencies
- ✅ 20 Playwright E2E tests
- ✅ Zero TypeScript errors

---

## License

MIT
# Production deployment Mon Mar 16 03:59:52 UTC 2026
