# 🎬 숏폼 커머스 페이지 - 요고(yo-go) 스타일

## 📋 개요

**UR Live**의 메인페이지를 요고(yo-go) 스타일의 숏폼 커머스 레이아웃으로 전면 개편했습니다.
셀러/인플루언서 마켓 느낌의 모바일 최적화 세로 영상 커머스 플랫폼입니다.

---

## 🎯 주요 기능

### 1️⃣ Full-Screen Vertical Video
- **9:16 비율** 세로 영상이 전체 화면을 채움 (Viewport Height 100%)
- `object-fit: cover`로 영상 크기 최적화
- 모바일 우선 디자인 (PC에서도 최대 450px 중앙 정렬)

### 2️⃣ Overlay UI (영상 위 요소들)

#### 📍 Header (상단)
- 투명한 그라데이션 배경 (`from-black/60 to-transparent`)
- 로고 + 카테고리 탭 (추천/라이브)
- 뒤로가기 버튼 및 메뉴 버튼

#### 📍 Side Interaction Bar (우측 하단)
- **틱톡 스타일** 세로 배치
- 좋아요, 공유하기, 장바구니 아이콘
- 반투명 배경 (`bg-black/30 backdrop-blur-sm`)

#### 📍 Bottom Info Section (하단 30%)
- 셀러 프로필 + 팔로우 버튼
- 상품명 (최대 2줄 표시)
- 가격 (할인율 + 정가 + 현재가)
- **"지금 구매하기" 버튼** (흰색 배경, 큰 폰트)

#### 📍 Bottom Navigation Bar (고정 하단 탭바)
- 홈 / 둘러보기 / 장바구니 / 마이페이지
- 반투명 배경 (`bg-black/80 backdrop-blur-md`)

### 3️⃣ Interaction & UX

#### 🔄 Snap Scrolling
- 마우스 휠 또는 스와이프로 다음 상품으로 이동
- 부드러운 전환 애니메이션 (`transition-transform duration-500`)
- 세로 프로그레스 인디케이터 (좌측 중앙)

#### ▶️ Auto Play
- 영상이 화면에 들어오면 자동 재생
- 기본적으로 뮤트(Mute) 상태
- 음소거 토글 버튼 (우측 상단)

#### 🛒 결제 Drawer (Slide-up)
- **"지금 구매하기" 버튼** 클릭 시 하단에서 슬라이드 업
- 상품 요약 + 수량 선택 + 총 결제금액
- **"결제하기" 버튼** → 토스페이먼츠 결제 페이지로 이동
- 취소 버튼으로 Drawer 닫기

---

## 🎨 Design Aesthetic

### 색상 팔레트
- **배경**: 검은색 (`bg-black`)
- **텍스트**: 흰색 (`text-white`)
- **강조**: 빨간색 할인율 (`text-red-400`)
- **버튼**: 흰색 배경, 검은색 텍스트 (`bg-white text-black`)
- **반투명**: `bg-black/30`, `bg-black/60`, `bg-black/80`

### 타이포그래피
- **상품명**: `text-lg font-bold`
- **가격**: `text-2xl font-bold`
- **버튼**: `text-lg font-bold`
- **라벨**: `text-xs font-medium`

### 애니메이션
- **영상 전환**: `transition-transform duration-500`
- **Drawer 슬라이드**: `animate-slide-up` (0.3s ease-out)
- **버튼 호버**: `hover:bg-gray-100 transition`

---

## 📱 라우팅 구조

### 변경 사항
```typescript
// 이전
/ → HomePage (기존 라이브 커머스 홈)

// 이후
/ → ShortFormPage (요고 스타일 숏폼 커머스) ⭐ NEW
/browse → HomePage (기존 홈페이지)
```

### 주요 경로
- `/` - **숏폼 커머스 메인** (새로운 메인페이지)
- `/browse` - 라이브 스트리밍 목록 (기존 홈페이지)
- `/checkout` - 결제 페이지 (토스페이먼츠 위젯)
- `/cart` - 장바구니
- `/orders` - 주문 내역
- `/s/:sellerId` - 셀러 공개 프로필

---

## 🛠️ 기술 스택

### Frontend
- **React** 18.x + TypeScript
- **TailwindCSS** 3.x (유틸리티 클래스)
- **Lucide React** (아이콘)

### Video Handling
- Native HTML5 `<video>` 태그
- `loop`, `muted`, `playsInline` 속성
- `autoplay` with user gesture handling

### State Management
- React `useState` + `useRef`
- `videoRefs.current[]` 배열로 여러 비디오 제어

---

## 🎬 비디오 소스 관리

### 현재 구현
```typescript
// 임시 플레이스홀더 비디오 (Mixkit)
video_url: 'https://assets.mixkit.co/videos/preview/mixkit-woman-showing-a-product-in-a-video-call-50292-large.mp4'
```

### 프로덕션 권장사항
1. **Cloudflare Stream** 사용 (CDN 최적화)
2. **다양한 해상도** 제공 (360p, 720p, 1080p)
3. **썸네일** 자동 생성 (`poster` 속성)
4. **파일 크기** 최적화 (10MB 이하 권장)
5. **포맷**: MP4 (H.264 코덱)

---

## 🔗 토스페이먼츠 연동

### 결제 플로우
```
1. 숏폼 영상 시청
   ↓
2. "지금 구매하기" 버튼 클릭
   ↓
3. 하단 Drawer 슬라이드 업 (상품 정보 + 수량 선택)
   ↓
4. "결제하기" 버튼 클릭
   ↓
5. CheckoutPage로 이동 (state로 상품 정보 전달)
   ↓
6. 토스페이먼츠 결제 위젯 렌더링
   ↓
7. 결제 완료 → /payment/success
```

### 코드 예시
```typescript
function handleCheckout() {
  const userId = getUserId()
  if (!userId) {
    navigate('/login')
    return
  }

  // CheckoutPage로 이동 + 상품 정보 전달
  navigate('/checkout', {
    state: {
      products: [selectedProduct],
      fromShortForm: true
    }
  })
}
```

---

## 📊 성능 최적화

### Video Lazy Loading
- 현재 보이는 영상만 재생
- 다른 영상은 `pause()` 처리
- 메모리 사용량 최소화

### Image Optimization
- `loading="lazy"` 속성
- 썸네일 우선 로드 (`poster` 속성)
- WebP 포맷 권장

### Code Splitting
- ShortFormPage는 즉시 로드 (lazy loading 없음)
- 빠른 초기 렌더링

---

## 🐛 알려진 이슈 & 해결

### 1. 자동 재생 차단 (Autoplay Policy)
**문제**: 브라우저가 소리 있는 자동 재생 차단  
**해결**: 기본적으로 `muted` 상태로 재생 시작

```typescript
const [isMuted, setIsMuted] = useState(true)

<video muted={isMuted} />
```

### 2. iOS Safari 전체화면 문제
**문제**: Safari에서 `height: 100vh` 주소창 포함  
**해결**: `height: 100dvh` (Dynamic Viewport Height) 사용 고려

### 3. 스크롤 민감도
**문제**: 마우스 휠 이벤트가 너무 민감  
**해결**: `Math.abs(diff) > 50` 임계값 설정

---

## 📈 향후 개선 사항

### 우선순위 높음
- [ ] 실제 비디오 콘텐츠 업로드 시스템
- [ ] 좋아요/팔로우 기능 백엔드 연동
- [ ] 공유하기 기능 완성 (카카오톡, 페이스북 등)
- [ ] 시청 시간 트래킹 (Analytics)

### 우선순위 중간
- [ ] 비디오 프리로딩 (다음 2개 영상)
- [ ] 스와이프 제스처 개선
- [ ] 영상 품질 자동 조절 (네트워크 속도에 따라)
- [ ] 댓글 기능 추가

### 우선순위 낮음
- [ ] 영상 북마크 기능
- [ ] 플레이리스트 큐레이션
- [ ] AI 기반 추천 알고리즘
- [ ] A/B 테스트 (버튼 위치, 색상 등)

---

## 🧪 테스트 가이드

### 모바일 테스트
```bash
# 1. 로컬 빌드 및 실행
npm run build
npm run dev:sandbox

# 2. 브라우저 DevTools 모바일 시뮬레이션
- F12 → 모바일 아이콘 클릭
- iPhone 14 Pro (430x932) 해상도 선택
- 스와이프 제스처 테스트
```

### PC 테스트
```bash
# 1. 마우스 휠 스크롤 테스트
- 위/아래 스크롤로 영상 전환 확인

# 2. 반응형 레이아웃 확인
- 최대 450px 너비 중앙 정렬
- 양쪽 검은 배경 확인
```

---

## 🚀 배포 정보

### 최신 배포
- **Preview URL**: https://144ba28b.toss-live-commerce.pages.dev
- **Production URL**: https://live.ur-team.com
- **커밋**: `2b424d5` - "feat: Add ShortForm commerce page"
- **배포 시간**: 2026-02-14

### 배포 확인사항
✅ 빌드 성공 (`npm run build`)  
✅ Cloudflare Pages 배포 완료  
✅ 숏폼 페이지가 메인(/) 경로로 설정됨  
✅ 기존 홈페이지는 /browse로 이동  
✅ 토스페이먼츠 결제 연동 유지  

---

## 📞 PG사 승인 대비

### 변경 사항 요약
| 항목 | 이전 | 이후 |
|------|------|------|
| 메인 컨셉 | 라이브 커머스 | 셀러/인플루언서 마켓 |
| 레이아웃 | 카드 그리드 | 세로 영상 Full-Screen |
| 주요 기능 | 라이브 스트리밍 | 숏폼 상품 영상 |
| 사용자 경험 | 클릭 & 탐색 | 스와이프 & 즉시 구매 |

### 강조 포인트 (토스페이먼츠 심사용)
1. **셀러 중심 마켓플레이스** - 개별 셀러가 상품 판매
2. **영상 기반 상품 소개** - 인플루언서 마케팅 플랫폼
3. **간편 결제 플로우** - 영상 → 구매 → 결제 (3단계)
4. **모바일 최적화** - MZ세대 타겟 쇼핑 경험

---

## 📝 참고 자료

- **요고(yo-go) 벤치마크**: 세로 영상 커머스 레이아웃
- **틱톡(TikTok) 참고**: 사이드 인터랙션 바
- **인스타그램 릴스**: Snap Scrolling UX
- **토스페이먼츠 공식 문서**: https://docs.tosspayments.com

---

**작성일**: 2026-02-14  
**작성자**: UR Team Dev  
**문서 버전**: 1.0
