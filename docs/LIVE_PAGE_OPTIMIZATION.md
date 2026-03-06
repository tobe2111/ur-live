# LivePageV2 최적화 가이드

## 📊 현재 상태
- **14개의 useEffect**: 복잡한 상태 관리
- **5개의 API 호출**: 순차적 실행
- **번들 크기**: 37.28 KB (gzip: 12.06 KB)
- **성능 점수**: 54점 (개선 필요)

## 🎯 최적화 전략

### 1단계: React Query 훅 적용
```typescript
// Before: 여러 useEffect + useState
const [stream, setStream] = useState(null)
const [products, setProducts] = useState([])
useEffect(() => { fetchStream() }, [])
useEffect(() => { fetchProducts() }, [])

// After: React Query 훅
const { data: stream } = useLiveStream(streamId)
const { data: products } = useStreamProducts(streamId)
```

### 2단계: API 병렬화
```typescript
// Before: 순차 실행 (총 5초)
await fetchStream()      // 1초
await fetchProducts()    // 1초
await fetchChat()        // 1초
await fetchViewer()      // 1초
await fetchStats()       // 1초

// After: Promise.all (총 1초)
await Promise.all([
  fetchStream(),
  fetchProducts(),
  fetchChat(),
  fetchViewer(),
  fetchStats()
])
```

### 3단계: useEffect 통합
```typescript
// Before: 14개의 개별 useEffect
useEffect(() => { initStream() }, [])
useEffect(() => { setupWebSocket() }, [])
useEffect(() => { trackViewer() }, [])
// ... 11개 더

// After: 커스텀 훅으로 통합
function useLiveStreamSetup(streamId) {
  useQuery(['stream', streamId], fetchStream)
  useWebSocket(streamId)
  useViewerTracking(streamId)
}
```

### 4단계: 메모이제이션
```typescript
// useMemo로 무거운 계산 캐시
const sortedProducts = useMemo(
  () => products.sort((a, b) => b.price - a.price),
  [products]
)

// useCallback으로 함수 재생성 방지
const handleAddToCart = useCallback(
  (productId) => { /* ... */ },
  [dependencies]
)
```

## 📈 예상 개선 효과
- **초기 로딩**: 5초 → 1초 (80% 개선)
- **메모리 사용**: 14개 listener → 3개 (78% 감소)
- **재렌더링**: 빈번한 re-render → 최소화
- **캐싱**: 없음 → 자동 캐싱 (중복 요청 제거)

## 🚀 단계별 적용
1. ✅ useLiveStream 훅 생성 완료
2. ⏳ LivePageV2에 훅 적용
3. ⏳ useEffect 통합
4. ⏳ 메모이제이션 추가
5. ⏳ 성능 측정 & 최적화

## 💡 주요 Hook
- `useLiveStream(streamId)`: 스트림 상세 조회
- `useStreamProducts(streamId)`: 상품 목록
- `useAddToCart()`: 장바구니 추가 (optimistic update)
- `useChangeCurrentProduct()`: 현재 상품 변경

