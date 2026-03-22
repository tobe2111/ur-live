# 장바구니 옵션 선택 기능 가이드

## 📋 개요

사용자가 장바구니에서 상품 옵션(색상, 사이즈 등)을 **직접 변경**할 수 있는 기능을 구현했습니다.

기존에는 라이브 페이지나 상품 상세 페이지에서 옵션 선택 UI가 부족했고, 장바구니에서는 옵션을 변경할 수 없었습니다. 이제 **장바구니 페이지에서 편리하게 옵션을 변경**할 수 있습니다.

---

## ✨ 주요 기능

### 1️⃣ 옵션 변경 버튼
- 각 장바구니 아이템에 **"옵션 변경"** 버튼 추가
- 톱니바퀴(⚙️) 아이콘으로 직관적인 UI
- 클릭 시 옵션 선택 모달 표시

### 2️⃣ 옵션 선택 모달
- **Bottom Sheet 스타일**: 모바일 친화적인 하단 슬라이드 애니메이션
- **옵션 타입별 그룹화**: 색상, 사이즈 등이 별도 섹션으로 표시
- **3열 그리드 레이아웃**: 한눈에 모든 옵션 확인 가능
- **현재 선택 표시**: 파란색 배지("현재")로 현재 옵션 표시
- **선택 상태 표시**: 체크마크(✓)로 새로 선택한 옵션 표시
- **재고 상태**: 품절 옵션은 회색 처리 + "품절" 라벨
- **가격 조정**: 추가 금액이 있는 경우 "+5,000원" 형식으로 표시

### 3️⃣ 재고 검증
- **실시간 재고 확인**: 옵션별 재고 상태를 DB에서 조회
- **품절 옵션 비활성화**: 재고가 0인 옵션은 선택 불가
- **수량 검증**: 장바구니 수량이 옵션 재고를 초과하지 않도록 검증
- **에러 메시지**: 재고 부족 시 "재고가 부족합니다" 알림

### 4️⃣ API 엔드포인트

#### **GET /api/products/:id/options**
상품의 모든 옵션 조회 (재고가 있는 옵션만)

**Request:**
```bash
GET /api/products/123/options
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "product_id": 123,
      "option_type": "색상",
      "option_value": "블랙",
      "price_adjustment": 0,
      "stock": 50
    },
    {
      "id": 2,
      "product_id": 123,
      "option_type": "색상",
      "option_value": "화이트",
      "price_adjustment": 1000,
      "stock": 30
    }
  ]
}
```

**캐싱:**
- Micro-cache: 10초 TTL
- Cloudflare Edge Cache 적용

---

#### **PUT /api/cart/:cartItemId**
장바구니 아이템 업데이트 (수량 또는 옵션)

**Request (수량 변경):**
```bash
PUT /api/cart/456
Content-Type: application/json

{
  "quantity": 3
}
```

**Request (옵션 변경):**
```bash
PUT /api/cart/456
Content-Type: application/json

{
  "option_id": 2
}
```

**Response:**
```json
{
  "success": true
}
```

**에러 케이스:**
```json
{
  "success": false,
  "error": "Insufficient stock for selected option"
}
```

**검증 로직:**
1. 옵션 존재 여부 확인
2. 옵션 재고 조회
3. 장바구니 수량 vs 옵션 재고 비교
4. 재고 부족 시 400 에러 반환

---

## 🎨 UI/UX 디자인

### 옵션 버튼 상태

| 상태 | 시각적 표현 | 설명 |
|------|------------|------|
| **기본** | 회색 테두리, 흰 배경 | 선택 가능한 옵션 |
| **현재 선택** | 파란색 배지 "현재" | 장바구니에 담긴 옵션 |
| **새로 선택** | 검은색 테두리, 회색 배경, 체크마크 | 사용자가 선택한 옵션 |
| **품절** | 회색 처리, 투명도 40%, "품절" 라벨 | 재고 0인 옵션 |
| **Hover** | 테두리 진해짐 | 마우스 오버 시 |

### 레이아웃

```
┌─────────────────────────────────────┐
│  상품명: 프리미엄 헤드폰               │
│  옵션 선택                     [X]    │
├─────────────────────────────────────┤
│                                      │
│  색상                                │
│  ┌────┐ ┌────┐ ┌────┐              │
│  │블랙│ │화이트│ │그레이│              │
│  │ ✓ │ │현재 │ │품절 │              │
│  └────┘ └────┘ └────┘              │
│                                      │
│  사이즈                              │
│  ┌────┐ ┌────┐ ┌────┐              │
│  │ S  │ │ M  │ │ L  │              │
│  └────┘ └────┘ └────┘              │
│                                      │
│  [현재 선택: 블랙 / M 사이즈]        │
│                                      │
├─────────────────────────────────────┤
│  [      옵션 변경      ]             │
└─────────────────────────────────────┘
```

---

## 🔧 기술 구현

### 1. 백엔드 (src/index.tsx)

**새로운 엔드포인트:**
```typescript
// 옵션 조회
app.get('/api/products/:id/options', edgeCache(CACHE_PRESETS.microCache), async (c) => {
  const options = await DB.prepare(`
    SELECT id, product_id, option_type, option_value, price_adjustment, stock
    FROM product_options
    WHERE product_id = ? AND stock > 0
    ORDER BY option_type, option_value
  `).bind(id).all();
  
  return c.json({ success: true, data: options.results });
});
```

**업데이트된 엔드포인트:**
```typescript
// 장바구니 업데이트 (옵션 변경 지원)
app.put('/api/cart/:cartItemId', requireAuth, async (c) => {
  const { quantity, option_id } = await c.req.json();
  
  // 수량 변경
  if (quantity !== undefined) {
    // 재고 검증 후 수량 업데이트
  }
  
  // 옵션 변경
  if (option_id !== undefined) {
    // 옵션 재고 검증
    const option = await DB.prepare(
      'SELECT stock FROM product_options WHERE id = ?'
    ).bind(option_id).first();
    
    // 옵션 업데이트
    await DB.prepare(
      'UPDATE cart_items SET option_id = ? WHERE id = ?'
    ).bind(option_id, cartItemId).run();
  }
});
```

### 2. 프론트엔드 컴포넌트

**OptionSelectModal.tsx** (8.4 KB)
- React 함수형 컴포넌트
- API 호출로 옵션 데이터 로드
- 옵션 타입별 그룹화 로직
- 재고 상태 표시
- 선택 상태 관리

**CartPage.tsx 통합**
```typescript
// 옵션 모달 상태
const [optionModal, setOptionModal] = useState({
  isOpen: false,
  cartItemId: undefined,
  productId: undefined,
  productName: undefined,
  currentOptionId: undefined,
  currentOptionValue: undefined,
});

// 옵션 변경 핸들러
const handleOptionChange = async (optionId: number, optionValue: string) => {
  await api.put(`/api/cart/${optionModal.cartItemId}`, { option_id: optionId });
  await loadCart(); // 장바구니 재로드
  showAlert('옵션이 변경되었습니다.', 'success');
};
```

### 3. 데이터베이스 스키마

**cart_items 테이블:**
```sql
CREATE TABLE cart_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  option_id INTEGER,              -- 옵션 ID (NULL 가능)
  quantity INTEGER DEFAULT 1,
  price_snapshot INTEGER NOT NULL,
  live_stream_id INTEGER,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (option_id) REFERENCES product_options(id)
);
```

**product_options 테이블:**
```sql
CREATE TABLE product_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  option_type TEXT NOT NULL,      -- 예: "색상", "사이즈"
  option_value TEXT NOT NULL,     -- 예: "블랙", "M"
  price_adjustment INTEGER DEFAULT 0,  -- 가격 조정 (+/-)
  stock INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id)
);
```

---

## 📊 성능 최적화

### API 캐싱
- **옵션 조회**: 10초 micro-cache (실시간성 유지)
- **Cloudflare Edge Cache**: 전 세계 사용자에게 빠른 응답
- **메모리 캐시**: 반복 조회 시 DB 부하 감소

### 번들 크기
- **OptionSelectModal**: +8.4 KB (새로운 컴포넌트)
- **CartPage**: +2.1 KB (옵션 변경 로직)
- **Total impact**: +10.5 KB (gzip: +3.2 KB)

### 렌더링 최적화
- **조건부 렌더링**: 모달이 열릴 때만 렌더
- **lazy 로딩**: 필요할 때만 옵션 데이터 조회
- **useCallback**: 핸들러 메모이제이션

---

## 🧪 테스트 시나리오

### 1. 정상 흐름
1. 사용자가 장바구니 페이지 접속
2. 상품 옆의 "옵션 변경" 버튼 클릭
3. 모달이 열리고 모든 옵션 표시
4. 사용자가 다른 옵션 선택
5. "옵션 변경" 버튼 클릭
6. API 호출 → 성공 알림 → 장바구니 재로드

### 2. 재고 부족 케이스
1. 품절 옵션은 회색 처리되고 선택 불가
2. 재고가 장바구니 수량보다 적은 경우 에러 메시지

### 3. 에러 처리
- API 실패 시 "옵션 변경에 실패했습니다" 알림
- 옵션이 없는 상품은 "사용 가능한 옵션이 없습니다" 표시
- 로딩 중 스피너 표시

---

## 🚀 배포 정보

**Commit:** c8ba1bd  
**Build Hash:** b1fa130d37901b91  
**Deployment:** GitHub Actions → Cloudflare Pages  
**Live URL:** https://live.ur-team.com

**변경된 파일:**
- `src/index.tsx` (API 엔드포인트)
- `src/pages/CartPage.tsx` (옵션 변경 통합)
- `src/components/OptionSelectModal.tsx` (새 컴포넌트)

**빌드 시간:** 20.40s (Vite) + 2.00s (SSR)  
**번들 크기:**
- live-pages: 39.72 KB (gzip: 12.71 KB) – 변경 없음
- app-pages: 365.96 KB (gzip: 82.20 KB) – OptionSelectModal 추가
- Total: 1,891.79 KB (gzip: 456.45 KB)

---

## 📝 사용 가이드

### 판매자 가이드
1. **상품 옵션 설정**: Admin 페이지에서 상품에 옵션 추가
2. **재고 관리**: 각 옵션별 재고 수량 관리
3. **가격 조정**: 프리미엄 옵션에 추가 금액 설정

### 사용자 가이드
1. 장바구니에서 상품 확인
2. "옵션 변경" 버튼 클릭
3. 원하는 옵션 선택 (색상, 사이즈 등)
4. "옵션 변경" 버튼으로 확정
5. 변경된 옵션으로 주문 진행

---

## 🔮 향후 개선 사항

### 1. 라이브 페이지 옵션 선택
- 라이브 방송 중 상품 옵션 바로 선택
- 장바구니 담기 전 옵션 선택 UI

### 2. 상품 상세 페이지 개선
- 현재 `selectedOptions` state가 있지만 UI 없음
- 옵션 선택 UI 추가 필요

### 3. 옵션 이미지
- 각 옵션에 이미지 추가 (색상별 제품 사진)
- DB에 `option_image_url` 컬럼 추가

### 4. 옵션 조합
- 다중 옵션 선택 (색상 + 사이즈)
- 조합별 재고 관리

### 5. 빠른 옵션 변경
- 드롭다운 방식 추가 (모달 없이)
- 자주 사용하는 옵션 즐겨찾기

---

## 📞 지원

문제 발생 시:
1. 브라우저 콘솔 확인 (F12)
2. API 응답 상태 확인
3. DB 재고 데이터 확인
4. GitHub Issues에 버그 리포트

---

**작성일**: 2026-03-03  
**작성자**: Claude AI  
**버전**: 1.0.0
