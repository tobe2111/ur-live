# 상품 상세페이지 DB 업데이트 가이드

## 📋 개요
프로덕션 환경에서 상품 상세 이미지와 설명을 추가하기 위한 DB 업데이트 가이드입니다.

## 🚀 빠른 실행 (Cloudflare Dashboard)

### 1단계: Cloudflare D1 Console 접속
```
https://dash.cloudflare.com/
→ Workers & Pages
→ D1 Database
→ toss-live-commerce-db
→ "Open Console" 클릭
```

### 2단계: 컬럼 추가 (이미 있으면 스킵)
D1 Console에서 다음 SQL 실행:

```sql
-- detail_images 컬럼 추가 (없으면)
ALTER TABLE products ADD COLUMN detail_images TEXT;

-- long_description 컬럼 추가 (없으면)
ALTER TABLE products ADD COLUMN long_description TEXT;

-- compare_at_price 컬럼 추가 (없으면)  
ALTER TABLE products ADD COLUMN compare_at_price INTEGER;
```

### 3단계: 더미 데이터 주입
`seed-complete-products.sql` 파일의 내용을 D1 Console에 복사 & 붙여넣기 후 실행

또는 wrangler CLI 사용:
```bash
# 로컬에서 실행
wrangler d1 execute toss-live-commerce-db --remote --file=seed-complete-products.sql
```

## 📝 생성된 더미 데이터

### 상품 목록 (6개)
1. **Premium Wireless Headphones** (89,000원)
   - 카테고리: fashion
   - 상세 이미지 4장
   - 옵션: Black, Silver, Blue (3가지 색상)

2. **Classic White Sneakers** (120,000원)
   - 카테고리: fashion
   - 상세 이미지 4장
   - 옵션: 250mm, 260mm, 270mm, 280mm (4가지 사이즈)

3. **Leather Backpack** (75,000원)
   - 카테고리: goods
   - 상세 이미지 4장
   - 옵션: Dark Brown, Black, Cognac (3가지 색상)

4. **Sports Watch** (189,000원)
   - 카테고리: fashion
   - 상세 이미지 4장
   - 옵션: Black, Navy, White (3가지 색상)

5. **Designer Sunglasses** (125,000원)
   - 카테고리: fashion
   - 상세 이미지 4장
   - 옵션: Gray, Brown, Green, Mirror Silver (4가지 렌즈 색상)

6. **Canvas Tote Bag** (45,000원)
   - 카테고리: goods
   - 상세 이미지 4장
   - 옵션: Natural, Black, Navy (3가지 색상)

### 상품 옵션 (20개)
각 상품마다 3~4개의 옵션이 있으며, `product_options` 테이블에 저장됩니다.

## 🧪 테스트 절차

### 1. 상품 상세페이지 확인
```
https://live.ur-team.com/products/1
https://live.ur-team.com/products/2
https://live.ur-team.com/products/3
...
```

**확인 사항:**
- [ ] 상품 메인 이미지 표시
- [ ] 상품 이름, 가격, 할인가 표시
- [ ] 상품 간단 설명 표시
- [ ] 수량 선택 버튼
- [ ] 장바구니 담기 버튼
- [ ] **상세 이미지 4장 표시 (새로 추가)**
- [ ] **상세 설명 섹션 표시 (새로 추가)**

### 2. 장바구니 기능 테스트
```
상품 상세페이지 → 장바구니 담기 → /cart → 수량 변경 → 다음 단계
```

**확인 사항:**
- [ ] 장바구니에 상품 추가됨
- [ ] 상품 이미지, 이름, 가격 표시
- [ ] 수량 증감 버튼 동작
- [ ] 상품 삭제 버튼 동작
- [ ] 총 금액 계산 정확
- [ ] 배송비 계산 (3,000원, 50,000원 이상 무료)

### 3. 결제 페이지 테스트
```
/cart → "주문하기" 클릭 → /checkout
```

**확인 사항:**
- [ ] 주문 상품 목록 표시
- [ ] 배송 정보 입력 폼
- [ ] 결제 금액 계산 (상품 + 배송비)
- [ ] Toss Payments 결제 위젯 로드
- [ ] 테스트 결제 진행

### 4. E2E 플로우 테스트
```
홈페이지 → 상품 클릭 → 상세페이지 → 장바구니 → 결제 → 주문 완료
```

## 🔧 트러블슈팅

### Q1. 상세 이미지가 안 보여요
**A:** `detail_images` 컬럼이 추가되었는지 확인:
```sql
SELECT detail_images FROM products WHERE id = 1;
```

NULL이면 3단계(더미 데이터 주입)를 다시 실행하세요.

### Q2. 옵션 선택이 안 돼요
**A:** `product_options` 테이블 데이터 확인:
```sql
SELECT * FROM product_options WHERE product_id = 1;
```

데이터가 없으면 `seed-complete-products.sql` 재실행.

### Q3. 가격이 이상해요
**A:** `compare_at_price` (할인 전 가격)와 `price` (판매 가격) 비교:
```sql
SELECT id, name, price, compare_at_price FROM products;
```

## 📊 현재 배포 상태

- **Commit**: `8b557be4` (feat: Add complete product detail page)
- **Live URL**: https://live.ur-team.com
- **Repository**: https://github.com/tobe2111/ur-live
- **Branch**: main

## 📁 관련 파일

- `/seed-complete-products.sql` - 완전한 더미 데이터
- `/src/client/pages/ProductDetailPage.tsx` - 상세페이지 컴포넌트
- `/src/features/products/types/index.ts` - Product 타입 정의
- `/migrations/0004_add_product_detail_images.sql` - 컬럼 마이그레이션

## 🎯 다음 단계

1. ✅ 상품 상세페이지 구현 (완료)
2. ⏳ DB 데이터 업데이트 (이 가이드 실행)
3. ⏳ Cart 페이지 테스트
4. ⏳ Checkout 페이지 테스트
5. ⏳ E2E 플로우 테스트
6. ⏳ 심사 제출

---

**작성일**: 2026-03-17  
**작성자**: AI Assistant  
**목적**: 프로덕션 환경 상품 상세페이지 데이터 업데이트
