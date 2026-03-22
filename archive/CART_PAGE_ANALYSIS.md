# 🛒 CartPage 분석 및 복원 계획

## 📅 작업 일시
2026-03-17 01:35 UTC

---

## 📋 CartPage 현재 상태

### ✅ 구현된 기능 (코드 분석)

**파일**: `src/client/pages/CartPage.tsx`

#### 1. **기본 구조** ✅
- Zustand store 기반 상태 관리 (`useCartStore`)
- 멀티셀러 그룹핑 UI 구현
- 로컬 상태 관리 (API 호출 없음)

#### 2. **주요 기능** ✅
```typescript
// 라인 149
const { items, removeItem, updateQuantity, getSellerGroups, sellerInfoCache } = useCart();

// 라인 151-154: 계산 로직
const sellerGroups = getSellerGroups(sellerInfoCache);
const grandTotal = sellerGroups.reduce((sum, g) => sum + g.total, 0);
const totalShipping = sellerGroups.reduce((sum, g) => sum + g.shipping_fee, 0);
const totalSubtotal = sellerGroups.reduce((sum, g) => sum + g.subtotal, 0);
```

**구현된 기능**:
1. ✅ 상품 표시 (라인 12-83: `CartItemRow`)
2. ✅ 수량 증가/감소 (라인 52-66)
3. ✅ 상품 삭제 (라인 74)
4. ✅ 판매자별 그룹핑 (라인 86-145: `SellerGroup`)
5. ✅ 배송비 계산 (라인 119-136)
6. ✅ 총액 계산 (라인 152-154)
7. ✅ 빈 장바구니 처리 (라인 156-168)
8. ✅ 결제 버튼 (라인 239-246)

#### 3. **연동 확인 필요**
- ProductDetailPage에서 addItem 호출 (라인 16, 63)
- 장바구니 추가 시 seller info 설정 필요

---

## 🔍 테스트 계획

### Test 1: 빈 장바구니 상태 ✅
**URL**: `https://live.ur-team.com/cart`
**예상 결과**: "장바구니가 비어있습니다" 메시지 + "쇼핑하러 가기" 버튼

### Test 2: 상품 추가 후 Cart 확인
**Steps**:
1. 로그인 (테스트 계정: `buyer@test.com` / `test1234!`)
2. 상품 페이지 이동 (`/products/1`)
3. "장바구니 담기" 클릭
4. `/cart` 페이지 이동
5. 상품이 표시되는지 확인

**검증 포인트**:
- ✅ 상품 이미지, 이름, 가격 표시
- ✅ 수량 증가/감소 버튼 작동
- ✅ 삭제 버튼 작동
- ✅ 판매자별 그룹핑
- ✅ 배송비 계산
- ✅ 총액 계산
- ✅ 결제 버튼 활성화

### Test 3: 멀티셀러 시나리오
**Steps**:
1. 판매자 A 상품 추가
2. 판매자 B 상품 추가
3. `/cart`에서 판매자별 분리 확인

---

## 🚨 예상 이슈 및 해결책

### Issue 1: API 형식 불일치
**증상**: 상품 추가 후 cart에서 undefined 에러
**원인**: ProductDetailPage의 addItem 호출 시 데이터 형식 불일치
**해결**: ProductDetailPage의 addItem 호출 부분 확인 및 수정

### Issue 2: SellerInfo 캐시 누락
**증상**: 판매자 이름이 표시되지 않음
**원인**: `setSellerInfo`가 호출되지 않음
**해결**: ProductDetailPage에서 `setSellerInfo` 추가

---

## 📊 CartPage 상태

| 기능 | 상태 | 비고 |
|------|------|------|
| UI 렌더링 | ✅ | 코드 완성 |
| 상품 표시 | ✅ | 로컬 state |
| 수량 변경 | ✅ | updateQuantity |
| 상품 삭제 | ✅ | removeItem |
| 판매자 그룹핑 | ✅ | getSellerGroups |
| 배송비 계산 | ✅ | seller 정보 기반 |
| 총액 계산 | ✅ | reduce 로직 |
| 결제 페이지 이동 | ✅ | Link to /checkout |
| **실제 테스트** | ⏳ | 로그인 후 진행 |

---

## 🎯 다음 단계

1. ✅ CSP 수정 배포 대기 (GitHub Actions)
2. ⏳ 로그인 테스트 (테스트 계정 사용)
3. ⏳ 상품 추가 → Cart 이동 테스트
4. ⏳ Cart 기능 검증 (추가/수정/삭제)
5. ⏳ Checkout 페이지로 이동

---

## 📝 예상 소요 시간

- CSP 배포 대기: 2분
- CartPage 테스트: 5분
- 이슈 수정 (있을 경우): 10분
- **총 예상 시간**: 15-20분

---

**작성자**: AI Assistant  
**최종 업데이트**: 2026-03-17 01:35 UTC
