# 셀러별 배송비 설정 기능

## 📋 개요

각 셀러가 자신만의 배송비 정책을 설정할 수 있도록 시스템이 개선되었습니다.

---

## 🎯 주요 기능

### 1. 셀러별 배송비 설정
```sql
-- sellers 테이블에 추가된 컬럼
shipping_fee INTEGER DEFAULT 3000  -- 기본 배송비 (원 단위)
free_shipping_threshold INTEGER DEFAULT 0  -- 무료배송 최소 금액
```

### 2. 무료배송 조건
```typescript
// 무료배송 로직
if (free_shipping_threshold > 0 && orderAmount >= free_shipping_threshold) {
  shippingFee = 0  // 무료배송
} else {
  shippingFee = shipping_fee  // 일반 배송비
}
```

### 3. 자동 계산
- 장바구니의 상품을 셀러별로 그룹화
- 각 셀러의 배송비 정책 적용
- 무료배송 조건 자동 체크
- 최종 배송비 합산

---

## 📊 데이터 구조

### sellers 테이블
```sql
CREATE TABLE sellers (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE,
  -- ... 기존 컬럼들 ...
  shipping_fee INTEGER DEFAULT 3000,           -- 배송비
  free_shipping_threshold INTEGER DEFAULT 0    -- 무료배송 기준 금액
);
```

### 설정 예시
```sql
-- 셀러 A: 배송비 3,000원, 무료배송 없음
INSERT INTO sellers (username, shipping_fee, free_shipping_threshold) 
VALUES ('seller_a', 3000, 0);

-- 셀러 B: 배송비 2,500원, 50,000원 이상 무료배송
INSERT INTO sellers (username, shipping_fee, free_shipping_threshold) 
VALUES ('seller_b', 2500, 50000);

-- 셀러 C: 배송비 무료 (항상)
INSERT INTO sellers (username, shipping_fee, free_shipping_threshold) 
VALUES ('seller_c', 0, 0);
```

---

## 💻 API 변경사항

### 장바구니 API 응답
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "product_name": "상품명",
      "price_snapshot": 10000,
      "quantity": 2,
      "seller_id": 1,
      "seller_name": "판매자명",
      "shipping_fee": 3000,
      "free_shipping_threshold": 50000
    }
  ]
}
```

---

## 🎨 UI 표시

### CheckoutPage 배송비 표시
```
┌────────────────────────────┐
│ 결제 금액                   │
├────────────────────────────┤
│ 상품 금액      45,000원    │
├────────────────────────────┤
│ 배송비                      │
│   판매자 A     3,000원     │  ← 셀러별 배송비
│   판매자 B     무료배송     │  ← 조건 충족 시
│   ─────────────────────    │
│   총           3,000원     │
├────────────────────────────┤
│ 총 결제금액    48,000원    │
└────────────────────────────┘
```

---

## 🔧 배송비 설정 방법

### 방법 1: SQL로 직접 설정
```sql
-- 배송비 변경
UPDATE sellers 
SET shipping_fee = 2500 
WHERE username = 'my_shop';

-- 무료배송 조건 설정 (3만원 이상)
UPDATE sellers 
SET free_shipping_threshold = 30000 
WHERE username = 'my_shop';

-- 무료배송 조건 제거
UPDATE sellers 
SET free_shipping_threshold = 0 
WHERE username = 'my_shop';
```

### 방법 2: API를 통한 설정 (향후 구현 예정)
```typescript
// PUT /api/seller/shipping-settings
{
  "shipping_fee": 2500,
  "free_shipping_threshold": 30000
}
```

---

## 📱 셀러 대시보드 UI 추가 (TODO)

### 배송 설정 페이지
```typescript
// SellerShippingSettingsPage.tsx (미구현)
interface ShippingSettings {
  shipping_fee: number
  free_shipping_threshold: number
}

function SellerShippingSettingsPage() {
  const [settings, setSettings] = useState<ShippingSettings>()
  
  return (
    <div>
      <h2>배송비 설정</h2>
      
      {/* 기본 배송비 */}
      <Input
        label="기본 배송비"
        type="number"
        value={settings.shipping_fee}
        onChange={(e) => setSettings({
          ...settings,
          shipping_fee: parseInt(e.target.value)
        })}
      />
      
      {/* 무료배송 조건 */}
      <Input
        label="무료배송 최소 주문 금액 (0 = 무료배송 없음)"
        type="number"
        value={settings.free_shipping_threshold}
        onChange={(e) => setSettings({
          ...settings,
          free_shipping_threshold: parseInt(e.target.value)
        })}
      />
      
      <Button onClick={handleSave}>저장</Button>
    </div>
  )
}
```

---

## 🧪 테스트 시나리오

### 시나리오 1: 단일 셀러 (무료배송 없음)
```
상품: 판매자 A의 상품 1개 (15,000원)
배송비: 3,000원
───────────────────
총액: 18,000원
```

### 시나리오 2: 단일 셀러 (무료배송 조건 충족)
```
상품: 판매자 B의 상품 (55,000원)
조건: 50,000원 이상 무료배송
배송비: 0원 (무료배송)
───────────────────
총액: 55,000원
```

### 시나리오 3: 다중 셀러
```
상품 1: 판매자 A의 상품 (20,000원) → 배송비 3,000원
상품 2: 판매자 B의 상품 (60,000원) → 배송비 무료 (조건 충족)
상품 3: 판매자 C의 상품 (10,000원) → 배송비 2,500원
───────────────────────────────────────────
상품 금액: 90,000원
총 배송비: 5,500원 (3,000 + 0 + 2,500)
───────────────────
총액: 95,500원
```

---

## 🚀 배포 정보

### 마이그레이션
```bash
# 로컬 DB
npx wrangler d1 migrations apply toss-live-commerce-db --local

# 운영 DB (완료됨 ✅)
npx wrangler d1 migrations apply toss-live-commerce-db --remote
```

### 배포 URL
- **Preview**: https://448c787e.toss-live-commerce.pages.dev
- **Production**: https://live.ur-team.com

---

## 📚 관련 파일

### 백엔드
- `migrations/0035_add_seller_shipping_fee.sql` - DB 마이그레이션
- `src/index.tsx` - 장바구니 API 수정 (셀러 정보 포함)

### 프론트엔드
- `src/pages/CheckoutPage.tsx` - 배송비 계산 및 표시 로직

---

## 💡 향후 개선사항

### 1. 셀러 대시보드 UI
- [ ] 배송비 설정 페이지 구현
- [ ] 무료배송 프로모션 관리
- [ ] 배송비 정책 히스토리

### 2. 고급 배송비 정책
- [ ] 지역별 차등 배송비
- [ ] 상품별 배송비
- [ ] 배송비 템플릿 (무게/부피 기반)
- [ ] 묶음 배송 할인

### 3. 관리 기능
- [ ] 배송비 변경 알림
- [ ] 배송비 통계 대시보드
- [ ] 배송비 최적화 제안

---

## 🔑 핵심 정리

### Before (고정 배송비) ❌
```typescript
const SHIPPING_FEE = 3000  // 모든 주문에 동일
const totalAmount = subtotal + SHIPPING_FEE
```

### After (셀러별 배송비) ✅
```typescript
// 셀러별 그룹화 및 배송비 계산
const shippingFee = calculateShippingFeeBySellerGroups(cartItems)
const totalAmount = subtotal + shippingFee
```

### 장점
1. ✅ **셀러 자율성**: 각 셀러가 자신의 배송비 정책 설정
2. ✅ **유연한 프로모션**: 무료배송 이벤트 가능
3. ✅ **경쟁력**: 셀러별 차별화된 배송 정책
4. ✅ **사용자 경험**: 무료배송 조건 명확히 표시

---

**작성일**: 2026-02-11  
**버전**: v1.0  
**커밋**: `5bb0a0a`

**이제 각 셀러가 자신의 배송비를 설정할 수 있습니다!** 🚀
