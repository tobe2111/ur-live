# 프로젝트 전체 검토 및 오류 분석

## 📁 프로젝트 구조

### 소스 파일 목록
```
src/App.tsx
src/components/ui/badge.tsx
src/components/ui/button.tsx
src/components/ui/card.tsx
src/durable-object.ts
src/index-api-only.tsx
src/index.tsx
src/lib/utils.ts
src/main.tsx
src/pages/CheckoutPage.tsx
src/pages/HomePage.tsx
src/pages/KakaoCallbackPage.tsx
src/pages/LivePage.tsx
src/pages/MyOrdersPage.tsx
src/pages/SellerLoginPage.tsx
src/pages/SellerPage.tsx
src/renderer.tsx
src/types.ts
```

## 📊 데이터베이스 테이블
```bash
    "results": [
      {
        "name": "_cf_METADATA"
      },
      {
        "name": "admin_sessions"
      },
      {
        "name": "admins"
      },
      {
        "name": "cart_items"
      },
      {
        "name": "d1_migrations"
      },
      {
        "name": "live_streams"
      },
      {
        "name": "order_items"
```

## 🔌 API 엔드포인트 분석

### Backend API Routes (src/index.tsx)
```typescript
app.post('/api/auth/login', cors(), async (c) => {
app.post('/api/auth/logout', cors(), async (c) => {
app.get('/api/auth/verify', cors(), async (c) => {
app.get('/auth/kakao', async (c) => {
app.get('/auth/kakao/callback', async (c) => {
app.post('/api/auth/kakao/logout', cors(), async (c) => {
app.get('/api/auth/user/verify', cors(), async (c) => {
app.get('/api/shipping-addresses/:userId', cors(), async (c) => {
app.post('/api/shipping-addresses', cors(), async (c) => {
app.put('/api/shipping-addresses/:id', cors(), async (c) => {
app.delete('/api/shipping-addresses/:id', cors(), async (c) => {
app.get('/api/streams', async (c) => {
app.get('/api/streams/:id', async (c) => {
app.get('/api/products/:id', async (c) => {
app.get('/api/products/:id/stock', async (c) => {
app.get('/api/streams/:streamId/products', async (c) => {
app.get('/api/cart/:userId', async (c) => {
app.post('/api/users', async (c) => {
app.post('/api/cart', async (c) => {
app.delete('/api/cart/:cartItemId', async (c) => {
app.put('/api/cart/:cartItemId', async (c) => {
app.post('/api/orders', async (c) => {
app.get('/api/streams/:streamId/current-product', async (c) => {
app.post('/api/admin/streams', async (c) => {
app.put('/api/admin/streams/:id', async (c) => {
app.delete('/api/admin/streams/:id', async (c) => {
app.post('/api/admin/streams/:streamId/change-product', async (c) => {
app.get('/api/shipping-addresses/:userId', async (c) => {
app.post('/api/shipping-addresses', async (c) => {
app.put('/api/shipping-addresses/:id', async (c) => {
app.delete('/api/shipping-addresses/:id', async (c) => {
app.put('/api/seller/products/:id', async (c) => {
app.delete('/api/seller/products/:id', async (c) => {
app.get('/api/seller/products/:id/options', async (c) => {
app.post('/api/seller/products/:id/options', async (c) => {
app.delete('/api/seller/products/:productId/options/:optionId', async (c) => {
app.get('/api/seller/stats', async (c) => {
app.get('/api/orders/user/:userId', async (c) => {
app.get('/api/orders/:orderNo', async (c) => {
app.get('/api/seller/orders', async (c) => {
app.patch('/api/seller/orders/:orderNo/status', async (c) => {
app.post('/api/orders/:orderNo/refund', async (c) => {
app.get('/api/admin/orders', async (c) => {
app.get('/api/admin/sellers', async (c) => {
app.post('/api/admin/sellers', async (c) => {
app.put('/api/admin/sellers/:id', async (c) => {
app.delete('/api/admin/sellers/:id', async (c) => {
app.post('/api/admin/sellers/:id/reset-password', async (c) => {
app.get('/api/toss/user-info', async (c) => {
app.post('/api/toss/payment/prepare', async (c) => {
```
