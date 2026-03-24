# SELECT * 쿼리 최적화 컬럼 맵

## 테이블 스키마 정리

### 1. users
```sql
id, toss_user_id, name, email, phone, created_at, updated_at
```
**최적화**: `id, name, email, phone, created_at`

### 2. admins
```sql
id, username, password_hash, name, email, role, is_active, last_login_at, created_at, updated_at
```
**최적화 (로그인)**: `id, username, password_hash, name, email, is_active`
**최적화 (목록)**: `id, username, name, email, role, is_active, last_login_at, created_at`

### 3. sellers
```sql
id, username, password_hash, name, email, phone, business_name, business_number, 
bank_account, status, is_active, last_login_at, approved_by, approved_at, created_at, updated_at
```
**최적화 (로그인)**: `id, username, password_hash, name, email, business_name, status, is_active`
**최적화 (목록)**: `id, username, name, email, business_name, status, is_active, created_at`
**최적화 (상세)**: `id, username, name, email, phone, business_name, business_number, bank_account, status, is_active, approved_at, created_at`

### 4. products
```sql
id, name, description, price, original_price, discount_rate, image_url, stock, category,
live_stream_id, is_active, seller_id, created_at, updated_at
```
**최적화 (목록)**: `id, name, price, original_price, discount_rate, image_url, stock, category, is_active, seller_id`
**최적화 (상세)**: `id, name, description, price, original_price, discount_rate, image_url, stock, category, live_stream_id, is_active, seller_id, created_at`

### 5. live_streams
```sql
id, title, description, youtube_video_id, status, current_product_id, seller_id, 
scheduled_at, started_at, ended_at, thumbnail_url, viewer_count, created_at, updated_at
```
**최적화 (목록)**: `id, title, youtube_video_id, status, seller_id, scheduled_at, started_at, thumbnail_url, viewer_count, created_at`
**최적화 (상세)**: `id, title, description, youtube_video_id, status, current_product_id, seller_id, scheduled_at, started_at, ended_at, thumbnail_url, viewer_count, created_at`

### 6. product_options
```sql
id, product_id, option_type, option_value, price_adjustment, stock, created_at
```
**최적화**: `id, product_id, option_type, option_value, price_adjustment, stock`

### 7. shipping_addresses
```sql
id, user_id, recipient_name, phone, postal_code, address, address_detail, is_default, created_at
```
**최적화**: `id, user_id, recipient_name, phone, postal_code, address, address_detail, is_default`

### 8. admin_sessions
```sql
id, session_token, admin_id, seller_id, user_type, expires_at, created_at
```
**최적화**: `user_type, expires_at, created_at` (session_token으로 WHERE 조회 시)

---

## 최적화 전략

### 우선순위 1: 자주 호출되는 목록 API
- `GET /api/products` (상품 목록)
- `GET /api/live-streams` (라이브 스트림 목록)
- `GET /api/seller/products` (판매자 상품 목록)
- `GET /api/seller/streams` (판매자 스트림 목록)

### 우선순위 2: 로그인/인증
- `POST /api/auth/login` (로그인)
- `GET /api/auth/validate` (JWT 검증)

### 우선순위 3: 상세/단일 조회
- `GET /api/products/:id` (상품 상세)
- `GET /api/live-streams/:id` (스트림 상세)

---

## 제외 항목 (password_hash 포함)
**절대 제외**: `password_hash`, `session_token` (보안)
**응답에서 제외**: 클라이언트로 전송하지 않음

---

## 데이터 전송량 예상
- **기존** (SELECT *): 평균 1.5KB per record
- **최적화 후**: 평균 0.8KB per record
- **절감률**: 약 45%
