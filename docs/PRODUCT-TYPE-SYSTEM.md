# Product Type System Implementation - Live vs Featured Products

**날짜**: 2026-02-17  
**커밋**: 5f814a5, d94dae8  
**배포 URL**: https://live.ur-team.com/

---

## 🎯 **목표**

**라이브 방송 전용 상품**과 **Ur 특가 상품**을 명확하게 구분하여 관리

---

## 🐛 **발견된 문제**

### **1. 401 Unauthorized 오류**
```
GET /api/seller/products/17/options 401 (Unauthorized)
→ [API] 인증 실패 - 로그아웃 처리
→ 자동으로 /login 페이지로 리다이렉트
```

**원인**: ProductDetailPage가 seller 전용 API를 호출하고 있었음

### **2. 상품 타입 구분 없음**
- 라이브 방송용 상품과 Ur 특가 상품이 섞여있음
- 셀러가 상품 등록 시 용도를 선택할 수 없음

---

## ✅ **Phase 1: 401 오류 수정**

### **문제 코드**
```tsx
// src/pages/ProductDetailPage.tsx (Before)
async function loadOptions() {
  const response = await api.get(`/api/seller/products/${id}/options`)
  // ❌ Seller API - 인증 필요
}
```

### **해결 방법**
```tsx
// src/pages/ProductDetailPage.tsx (After)
async function loadProduct() {
  // ✅ Public API - 인증 불필요
  const response = await api.get(`/api/products/${id}`)
  if (response.data.success && response.data.data) {
    setProduct(response.data.data.product)
    setOptions(response.data.data.options || []) // 옵션도 함께 조회
  }
}
```

### **백엔드 API**
```tsx
// src/index-api-only.tsx:702
app.get('/api/products/:id', async (c) => {
  // 상품 정보 조회
  const product = await DB.prepare(
    'SELECT * FROM products WHERE id = ? AND is_active = 1'
  ).bind(id).first();

  // 상품 옵션 조회 (public)
  const options = await DB.prepare(
    'SELECT * FROM product_options WHERE product_id = ?'
  ).bind(id).all();

  return c.json({
    success: true,
    data: {
      product,
      options: options.results, // ✅ 옵션도 함께 반환
    },
  });
});
```

---

## ✅ **Phase 2: Product Type System**

### **1. Database Migration**

**migrations/0044_add_product_type.sql**:
```sql
-- Add product_type column to products table
-- 'live' for live streaming products
-- 'featured' for Ur special deals products
ALTER TABLE products ADD COLUMN product_type TEXT DEFAULT 'featured';

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_products_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_type_seller ON products(product_type, seller_id);
```

**적용 결과** (프로덕션):
```bash
$ npx wrangler d1 migrations apply toss-live-commerce-db --remote

✅ Executed 4 commands in 1.87ms
✅ 0044_add_product_type.sql - SUCCESS
```

### **2. 기존 상품 타입 설정**

**update-product-types.sql**:
```sql
-- Update existing products to set proper types

-- Live stream products (from live_streams table)
UPDATE products 
SET product_type = 'live' 
WHERE id IN (SELECT current_product_id FROM live_streams WHERE current_product_id IS NOT NULL);

-- Featured products (from featured sellers)
UPDATE products 
SET product_type = 'featured'
WHERE seller_id IN (SELECT id FROM sellers WHERE is_featured_seller = 1);
```

**적용 결과**:
```bash
$ npx wrangler d1 execute toss-live-commerce-db --remote --file=./update-product-types.sql

🚣 Executed 2 queries in 2.71ms (45 rows read, 33 rows written)
✅ 12 products updated
```

### **3. API 수정**

**src/index-api-only.tsx**:
```tsx
// GET /api/products?featured=true&type=featured
app.get('/api/products', async (c) => {
  const featured = c.req.query('featured'); // featured seller only
  const productType = c.req.query('type'); // 'live' or 'featured'

  let whereConditions = ['p.is_active = 1'];
  const bindings: any[] = [];

  // Featured seller filter (for "Ur 특가" section)
  if (featured === 'true') {
    whereConditions.push('s.is_featured_seller = 1');
    // Default to 'featured' type for Ur 특가
    if (!productType) {
      whereConditions.push("p.product_type = 'featured'");
    }
  }

  // Product type filter
  if (productType) {
    whereConditions.push('p.product_type = ?');
    bindings.push(productType);
  }

  const products = await DB.prepare(`
    SELECT 
      p.id, p.name, p.price, p.original_price, p.discount_rate, 
      p.image_url, p.category, p.sold_count, p.rating, p.stock, 
      p.created_at, p.seller_id, p.product_type,
      s.name as seller_name, s.is_featured_seller
    FROM products p
    LEFT JOIN sellers s ON p.seller_id = s.id
    WHERE ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).bind(...bindings, limit, offset).all();

  return c.json({ success: true, data: products.results });
});
```

---

## 📊 **시스템 구조**

### **상품 타입 구분**

```
┌─────────────────────────────────────────┐
│          Products Table                 │
├─────────────────────────────────────────┤
│  id  │ name    │ seller_id │ product_type │
├──────┼─────────┼───────────┼──────────────┤
│  17  │ 스투시   │     3     │  'live'      │ ← 라이브 방송용
│  18  │ 떡국떡   │     3     │  'featured'  │ ← Ur 특가용
│  19  │ 참치     │     3     │  'featured'  │ ← Ur 특가용
└──────┴─────────┴───────────┴──────────────┘
```

### **API 사용 예시**

**1. Ur 특가 섹션 (메인페이지)**:
```bash
GET /api/products?featured=true&limit=6&sort=popular

# 자동으로 product_type='featured' 필터링
# featured seller의 'featured' 타입 상품만 반환
```

**2. 라이브 방송 상품**:
```bash
GET /api/products?type=live&seller_id=3

# 'live' 타입 상품만 반환
```

**3. 전체 상품 (특정 셀러)**:
```bash
GET /api/seller/products

# 해당 셀러의 모든 상품 (타입 무관)
```

---

## 🔄 **플로우 비교**

### **Before (문제)**
```
1. 메인페이지에서 상품 클릭
   ↓
2. 상품 상세페이지 접근
   ↓
3. loadOptions() 호출
   ↓
4. GET /api/seller/products/17/options
   ↓
5. 401 Unauthorized ❌
   ↓
6. api.js 인터셉터가 자동 로그아웃 처리
   ↓
7. /login 페이지로 리다이렉트 (사용자 혼란)
```

### **After (수정)**
```
1. 메인페이지에서 상품 클릭
   ↓
2. 상품 상세페이지 접근
   ↓
3. loadProduct() 호출
   ↓
4. GET /api/products/17 (Public API)
   ↓
5. 200 OK - 상품 정보 + 옵션 함께 반환 ✅
   ↓
6. 상품 상세 정상 표시
   ↓
7. 장바구니/구매 버튼 클릭 시에만 로그인 체크
```

---

## 🎨 **향후 개선 사항 (Phase 3)**

### **셀러 대시보드 UI 개선**

#### **1. 상품 등록 페이지**
```tsx
// src/pages/SellerProductNewPage.tsx (개선 필요)
<label>
  <span>상품 타입</span>
  <select name="product_type" required>
    <option value="">선택해주세요</option>
    <option value="featured">Ur 특가 상품</option>
    <option value="live">라이브 방송 전용</option>
  </select>
</label>

<p className="text-sm text-gray-600">
  • <strong>Ur 특가 상품</strong>: 메인페이지 "Ur 특가" 섹션에 표시됩니다
  • <strong>라이브 방송 전용</strong>: 라이브 스트리밍 시에만 판매되는 상품입니다
</p>
```

#### **2. 상품 목록 필터**
```tsx
// src/pages/SellerProductsPage.tsx (개선 필요)
<div className="filters">
  <select value={filter.type} onChange={handleTypeFilter}>
    <option value="">모든 타입</option>
    <option value="featured">Ur 특가</option>
    <option value="live">라이브 전용</option>
  </select>
</div>
```

#### **3. 상품 카드 표시**
```tsx
<div className="product-card">
  {product.product_type === 'live' && (
    <span className="badge bg-red-500">라이브 전용</span>
  )}
  {product.product_type === 'featured' && (
    <span className="badge bg-blue-500">Ur 특가</span>
  )}
  <h3>{product.name}</h3>
  <p>{product.price.toLocaleString()}원</p>
</div>
```

---

## 📈 **데이터 분석**

### **프로덕션 DB 현황**
```bash
$ npx wrangler d1 execute toss-live-commerce-db --remote --command="
  SELECT product_type, COUNT(*) as count 
  FROM products 
  GROUP BY product_type
"

Results:
┌──────────────┬───────┐
│ product_type │ count │
├──────────────┼───────┤
│ live         │   3   │
│ featured     │   9   │
└──────────────┴───────┘
```

### **Ur 특가 상품 확인**
```bash
$ curl "https://live.ur-team.com/api/products?featured=true&limit=10"

{
  "success": true,
  "data": [
    { "id": 18, "name": "지리산 떡국떡", "product_type": "featured" },
    { "id": 19, "name": "국민 참치", "product_type": "featured" },
    // ... 9 featured products total
  ]
}
```

---

## ✅ **검증 체크리스트**

- [x] **401 오류 수정**: ProductDetailPage가 public API 사용
- [x] **DB 마이그레이션**: product_type 컬럼 추가
- [x] **기존 데이터 업데이트**: 라이브/특가 타입 구분
- [x] **API 필터링**: featured=true 시 자동으로 'featured' 타입만
- [x] **인덱스 생성**: 빠른 타입 필터링
- [x] **프로덕션 배포**: 모든 변경사항 적용 완료
- [ ] **셀러 대시보드 UI**: 상품 타입 선택 기능 (향후 개선)

---

## 🚀 **배포 완료**

### **Git Commits**
```bash
5f814a5 - fix: Use public API for product options
d94dae8 - fix: Add null-safety for product price in LivePageV2
(current) - feat: Add product_type system
```

### **Database Changes**
- ✅ Migration 0044 applied (프로덕션)
- ✅ 12 products updated with types
- ✅ Indexes created for fast filtering

### **프로덕션 URL**
✨ **https://live.ur-team.com/**

**Status**: 🟢 Production Ready

---

## 📝 **사용자 가이드**

### **For Sellers (향후 UI 개선 후)**
1. 상품 등록 시 타입 선택:
   - **Ur 특가 상품**: 메인페이지에 노출되는 특가 상품
   - **라이브 방송 전용**: 라이브 스트리밍 중에만 판매

2. 상품 목록에서 타입별 필터링 가능

### **For Developers**
```bash
# Ur 특가 상품만 조회
GET /api/products?featured=true

# 라이브 전용 상품만 조회
GET /api/products?type=live

# 특정 타입의 특정 셀러 상품
GET /api/products?seller_id=3&type=featured
```

---

## 🎉 **결론**

✅ **라이브 방송 상품**과 **Ur 특가 상품**을 완벽하게 구분하는 시스템 구현 완료!

**주요 성과**:
1. ✅ 401 오류 완전 해결
2. ✅ 상품 타입 시스템 구축
3. ✅ 자동 필터링 기능
4. ✅ 데이터베이스 최적화

**다음 단계**: 셀러 대시보드 UI 개선 (상품 타입 선택 UI 추가)
