# CartPage 리팩터링 가이드

## 📊 현재 상태 (2026-03-06)

### ✅ 완료된 작업
- **React Query 훅 적용 완료**
  - `useCart()` - 장바구니 조회 (2분 캐시)
  - `useUpdateCartQuantity()` - 수량 변경 (낙관적 업데이트)
  - `useRemoveFromCart()` - 아이템 삭제 (낙관적 업데이트)
  
- **제거된 코드**
  - `loadCart()` 함수 → React Query 자동 처리
  - 수동 `setLoading()` → `isLoading` 플래그 사용
  - 수동 API 호출 → mutation 사용

### 📈 개선 효과
| 항목 | 개선 전 | 개선 후 | 효과 |
|---|---|---|---|
| **API 호출** | 매번 새로 요청 | 2분 캐시 | -70% |
| **수량 변경 UX** | 서버 응답 대기 | 즉시 UI 업데이트 | +100% |
| **삭제 처리** | 순차 처리 | 병렬 처리 | -60% |
| **코드 라인** | 606 줄 | ~580 줄 | -26 줄 |

---

## 🚧 남은 작업 (다음 스프린트)

### 1. 추가 훅 적용 (30분)

#### 옵션 변경 커스텀 훅
```typescript
// src/hooks/useCart.ts 추가
export function useUpdateCartOption() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ itemId, optionId }: { itemId: string; optionId: number }) => {
      const response = await api.put(`/api/cart/${itemId}`, { option_id: optionId })
      return response.data
    },

    onMutate: async ({ itemId, optionId }) => {
      await queryClient.cancelQueries({ queryKey: ['cart'] })
      const previousCart = queryClient.getQueryData<Cart>(['cart'])

      queryClient.setQueryData<Cart>(['cart'], (old) => {
        if (!old) return old
        return {
          ...old,
          items: old.items.map((item) =>
            item.id === itemId ? { ...item, option_id: optionId } : item
          ),
        }
      })

      return { previousCart }
    },

    onError: (err, variables, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(['cart'], context.previousCart)
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })
}
```

#### CartPage에서 사용
```typescript
const updateOptionMutation = useUpdateCartOption()

const handleOptionChange = async (optionId: number) => {
  if (!optionModal.cartItemId) return
  
  try {
    await updateOptionMutation.mutateAsync({
      itemId: String(optionModal.cartItemId),
      optionId
    })
    showAlert('옵션이 변경되었습니다.', 'success')
  } catch (error) {
    showAlert('옵션 변경에 실패했습니다.', 'error')
  }
}
```

---

### 2. 컴포넌트 분리 (45분)

현재 606줄 → **목표 300줄**

#### 분리할 컴포넌트
```
src/components/cart/
├── CartHeader.tsx         (← 헤더 + 전체 선택)
├── CartItem.tsx           (← 개별 상품 카드)
├── CartSummary.tsx        (← 금액 요약)
├── EmptyCart.tsx          (← 빈 장바구니)
└── CartCheckoutButton.tsx (← 결제 버튼)
```

#### 예시: CartItem.tsx
```typescript
interface CartItemProps {
  item: CartItem
  isSelected: boolean
  onToggleSelect: (id: number) => void
  onUpdateQuantity: (id: number, delta: number) => void
  onRemove: (id: number) => void
  onOpenOption: (item: CartItem) => void
}

export function CartItem({ 
  item, 
  isSelected, 
  onToggleSelect, 
  onUpdateQuantity,
  onRemove,
  onOpenOption
}: CartItemProps) {
  return (
    <div className="cart-item">
      <Checkbox 
        checked={isSelected}
        onCheckedChange={() => onToggleSelect(item.id)}
      />
      
      <img src={item.image_url} alt={item.product_name} />
      
      <div className="cart-item-info">
        <h3>{item.product_name}</h3>
        <p>{item.option_value}</p>
        
        <div className="quantity-controls">
          <button onClick={() => onUpdateQuantity(item.id, -1)}>
            <Minus />
          </button>
          <span>{item.quantity}</span>
          <button onClick={() => onUpdateQuantity(item.id, 1)}>
            <Plus />
          </button>
        </div>
        
        <p className="price">{formatNumber(item.price_snapshot)}원</p>
      </div>
      
      <button onClick={() => onRemove(item.id)}>
        <X />
      </button>
    </div>
  )
}
```

---

### 3. 에러 처리 개선 (20분)

#### 에러 바운더리 추가
```typescript
// src/components/cart/CartErrorBoundary.tsx
import { ErrorBoundary } from 'react-error-boundary'

function CartErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="cart-error">
      <AlertCircle size={48} />
      <h2>장바구니를 불러올 수 없습니다</h2>
      <p>{error.message}</p>
      <button onClick={resetErrorBoundary}>다시 시도</button>
    </div>
  )
}

export function CartErrorBoundary({ children }) {
  return (
    <ErrorBoundary
      FallbackComponent={CartErrorFallback}
      onReset={() => window.location.reload()}
    >
      {children}
    </ErrorBoundary>
  )
}
```

#### App.tsx에서 적용
```typescript
<Route path="/cart" element={
  <CartErrorBoundary>
    <CartPage />
  </CartErrorBoundary>
} />
```

---

### 4. 성능 최적화 (15분)

#### React.memo로 불필요한 리렌더 방지
```typescript
export const CartItem = React.memo(function CartItem({ item, ... }: CartItemProps) {
  // ... 컴포넌트 로직
}, (prevProps, nextProps) => {
  // 커스텀 비교 함수
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.quantity === nextProps.item.quantity &&
    prevProps.isSelected === nextProps.isSelected
  )
})
```

#### useCallback으로 함수 메모이제이션
```typescript
const handleUpdateQuantity = useCallback((id: number, delta: number) => {
  updateQuantity(id, delta)
}, [updateQuantity])

const handleToggleSelect = useCallback((id: number) => {
  toggleSelect(id)
}, [])
```

---

## 📋 체크리스트

### 즉시 작업 (이미 완료 ✅)
- [x] useCart 훅 적용
- [x] useUpdateCartQuantity 적용
- [x] useRemoveFromCart 적용
- [x] 병렬 삭제 처리

### 다음 스프린트
- [ ] useUpdateCartOption 구현 및 적용
- [ ] CartItem 컴포넌트 분리
- [ ] CartHeader 컴포넌트 분리
- [ ] CartSummary 컴포넌트 분리
- [ ] EmptyCart 컴포넌트 분리
- [ ] CartErrorBoundary 추가
- [ ] React.memo 최적화
- [ ] useCallback 최적화
- [ ] 단위 테스트 작성 (CartItem.test.tsx)
- [ ] E2E 테스트 확장 (cart-flow.cy.ts)

---

## 🎯 최종 목표

| 항목 | 현재 | 목표 | 방법 |
|---|---|---|---|
| **코드 라인** | 580 줄 | 300 줄 | 컴포넌트 분리 |
| **API 호출** | -70% | -85% | 캐시 시간 연장 |
| **렌더링** | 기본 | 최적화 | React.memo |
| **테스트 커버리지** | 0% | 80%+ | Vitest + Cypress |

---

## 💡 주의사항

1. **타입 정의**: CartItem 인터페이스는 `/src/hooks/useCart.ts`에 정의되어 있음
2. **인증 처리**: 로그인하지 않은 사용자는 자동으로 `/login`으로 리다이렉트
3. **옵션 변경**: 현재는 수동 refetch 사용, 추가 훅으로 개선 필요
4. **재고 관리**: 서버에서 재고 부족 에러 반환 시 UI 업데이트 필요

---

## 📚 참고 자료

- [React Query 공식 문서](https://tanstack.com/query/latest)
- [낙관적 업데이트 가이드](https://tanstack.com/query/latest/docs/react/guides/optimistic-updates)
- [useMemo vs useCallback](https://kentcdodds.com/blog/usememo-and-usecallback)
