// Firebase Realtime Database 구조 설계
// /home/user/webapp/docs/firebase-structure.md

# Firebase Realtime Database 구조

## 📊 데이터베이스 스키마

### 1. streams/{streamId} - 라이브 방송 상태
```json
{
  "streams": {
    "stream123": {
      "id": 123,
      "title": "오늘의 특가 라이브",
      "status": "live",  // "live" | "scheduled" | "ended"
      "current_product_id": 456,
      "viewer_count": 150,
      "seller_id": 789,
      "youtube_video_id": "abc123xyz",
      "started_at": 1234567890000,
      "updated_at": 1234567890000
    }
  }
}
```

### 2. products/{productId} - 상품 실시간 재고
```json
{
  "products": {
    "product456": {
      "id": 456,
      "name": "무선 이어폰",
      "price": 59000,
      "original_price": 89000,
      "discount_rate": 33,
      "stock": 25,  // 실시간 재고
      "image_url": "https://...",
      "updated_at": 1234567890000
    }
  }
}
```

### 3. stream_products/{streamId} - 방송별 상품 목록
```json
{
  "stream_products": {
    "stream123": {
      "products": {
        "product456": {
          "id": 456,
          "stock": 25,
          "is_current": true,
          "order": 1
        },
        "product457": {
          "id": 457,
          "stock": 50,
          "is_current": false,
          "order": 2
        }
      }
    }
  }
}
```

### 4. chats/{streamId} - 채팅 (기존 구조 유지)
```json
{
  "chats": {
    "stream123": {
      "msg1": {
        "username": "사용자1",
        "text": "안녕하세요!",
        "timestamp": 1234567890000,
        "isSystem": false
      }
    }
  }
}
```

## 🔒 Security Rules

```json
{
  "rules": {
    "streams": {
      "$streamId": {
        ".read": true,
        ".write": "auth != null && auth.uid === 'admin'"
      }
    },
    "products": {
      "$productId": {
        ".read": true,
        ".write": "auth != null && auth.uid === 'admin'"
      }
    },
    "stream_products": {
      "$streamId": {
        ".read": true,
        ".write": "auth != null && auth.uid === 'admin'"
      }
    },
    "chats": {
      "$streamId": {
        ".read": true,
        ".write": true,
        ".validate": "newData.hasChildren(['username', 'text', 'timestamp'])"
      }
    }
  }
}
```

## 📡 실시간 구독 패턴

### 클라이언트 (시청자)
```typescript
// 방송 상태 구독
database.ref(`streams/${streamId}`).on('value', (snapshot) => {
  const stream = snapshot.val()
  updateStreamInfo(stream)
})

// 현재 상품 재고 구독
database.ref(`products/${productId}`).on('value', (snapshot) => {
  const product = snapshot.val()
  updateProductStock(product.stock)
})
```

### 서버 (Admin SDK)
```typescript
// 재고 차감
await admin.database().ref(`products/${productId}`).update({
  stock: newStock,
  updated_at: Date.now()
})

// 상품 변경
await admin.database().ref(`streams/${streamId}`).update({
  current_product_id: newProductId,
  updated_at: Date.now()
})
```

## 🎯 데이터 흐름

### 1. 재고 변경 (주문 완료 시)
```
시청자 주문 완료
  ↓
서버 API (/api/orders)
  ↓ (병렬 처리)
├─ D1 Database 업데이트 (영구 저장)
└─ Firebase 업데이트 (실시간 동기화)
  ↓
Firebase 리스너 트리거
  ↓
모든 시청자 UI 즉시 업데이트 (0.1~0.3초)
```

### 2. 상품 변경 (셀러 제어)
```
셀러 상품 변경
  ↓
서버 API (/api/seller/streams/:id/change-product)
  ↓ (병렬 처리)
├─ D1 Database 업데이트 (영구 저장)
└─ Firebase 업데이트 (실시간 동기화)
  ↓
Firebase 리스너 트리거
  ↓
모든 시청자 UI 즉시 업데이트 (0.1~0.3초)
```

## 📊 연결 최적화

### 연결 관리 전략
```typescript
// 페이지 진입 시 연결
useEffect(() => {
  const streamRef = database.ref(`streams/${streamId}`)
  streamRef.on('value', handleUpdate)
  
  // 페이지 이탈 시 연결 해제
  return () => {
    streamRef.off()
    console.log('Firebase 리스너 해제')
  }
}, [streamId])
```

### 연결 수 최소화
- ✅ LivePage: 1개 연결 (streams/{streamId})
- ✅ SellerLiveControl: 1개 연결 (streams/{streamId})
- ✅ ChatComponent: 1개 연결 (chats/{streamId}) - 기존
- **총 연결 수 = 동시 방송 수 × 2~3개**

## 🔍 모니터링

### 연결 수 추적
```typescript
// Firebase Admin SDK
const connectedRef = admin.database().ref('.info/connected')
connectedRef.on('value', (snapshot) => {
  if (snapshot.val() === true) {
    // 연결 카운트 증가
    connectionCount++
    
    if (connectionCount >= 90) {
      sendDiscordAlert('Firebase 연결 수 90개 도달!')
    }
  }
})
```

## 💰 비용 최적화

### 무료 플랜 한도
- 동시 연결: 100개
- 저장소: 1GB
- 다운로드: 10GB/월

### 예상 사용량 (50개 방송/일)
- 동시 연결: 15개 (피크 시간)
- 저장소: ~50MB (방송 + 상품 데이터)
- 다운로드: ~2GB/월
- **결론: 무료 플랜 범위 내** ✅

## 🎯 성능 목표

| 항목 | 목표 | 측정 방법 |
|------|------|----------|
| 재고 변경 반영 | 0.2초 이내 | Firebase 리스너 콜백 시간 |
| 상품 변경 반영 | 0.2초 이내 | Firebase 리스너 콜백 시간 |
| 연결 안정성 | 99.9% | Firebase 재연결 빈도 |
| API 호출 감소 | 95% 이상 | Workers 로그 분석 |
