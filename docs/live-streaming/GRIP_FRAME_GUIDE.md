# 🖥️ 그립(Grip) 스타일 웹뷰 프레임 가이드

## 📋 개요

PC 웹에서도 **모바일 앱을 쓰는 것 같은 경험**을 제공하는 웹뷰 프레임 구조를 구현했습니다.  
그립(Grip) 라이브 커머스 사이트와 동일한 디자인 철학을 적용했습니다.

---

## 🎯 핵심 구조

### 1️⃣ 전체 배경
- **배경색**: 연한 회색 그라데이션 (`from-gray-50 via-gray-100 to-gray-50`)
- **목적**: 모바일 프레임을 돋보이게 하는 중성적인 배경

### 2️⃣ 모바일 프레임 컨테이너
- **너비**: 최대 `450px` (모바일 앱 느낌)
- **높이**: PC에서 `calc(100vh - 80px)` (상하 여백), 최대 `900px`
- **위치**: 
  - **Desktop**: 우측 정렬 (`lg:justify-end lg:pr-20`)
  - **Mobile**: 전체 화면 꽉 차게 (`w-full`)
- **스타일**: 
  - 둥근 모서리 (`lg:rounded-3xl`)
  - 큰 그림자 (`lg:shadow-2xl`)
  - 흰색 배경 (`bg-white`)

### 3️⃣ PC 배경 브랜딩 영역
- **위치**: 좌측 영역 (`justify-start px-20`)
- **표시**: Desktop only (`hidden lg:flex`)
- **컨텐츠**:
  - 로고 + 서비스명
  - 슬로건 ("라이브 커머스의 새로운 기준")
  - 주요 기능 3가지
  - 통계 수치 (셀러, 거래, 만족도)

---

## 🎨 디자인 상세

### 로고 & 브랜딩
```typescript
// 그라데이션 아이콘
w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl

// 타이포그래피
<h1 className="text-4xl font-black text-gray-900">UR Live</h1>
<p className="text-lg text-gray-600">by 리스터코퍼레이션</p>
```

### 슬로건
```typescript
<h2 className="text-3xl font-bold text-gray-900">
  라이브 커머스의<br />
  새로운 기준
</h2>
<p className="text-lg text-gray-600">
  셀러와 인플루언서가 만드는<br />
  프리미엄 영상 쇼핑 경험
</p>
```

### 주요 기능 (3가지)
1. **실시간 라이브 쇼핑** (파란색 아이콘)
2. **숏폼 영상 커머스** (보라색 아이콘)
3. **안전한 결제 시스템** (초록색 아이콘)

### 통계 수치
```typescript
<div className="flex gap-8 pt-4">
  <div>
    <p className="text-3xl font-bold text-blue-600">1,000+</p>
    <p className="text-sm text-gray-600">셀러 파트너</p>
  </div>
  <div>
    <p className="text-3xl font-bold text-purple-600">10,000+</p>
    <p className="text-sm text-gray-600">누적 거래</p>
  </div>
  <div>
    <p className="text-3xl font-bold text-green-600">99%</p>
    <p className="text-sm text-gray-600">고객 만족도</p>
  </div>
</div>
```

---

## 📱 반응형 디자인

### Desktop (1024px 이상)
```css
/* 배경 브랜딩 영역 표시 */
.hidden.lg\:flex { display: flex; }

/* 모바일 프레임 우측 정렬 */
.lg\:justify-end { justify-content: flex-end; }
.lg\:pr-20 { padding-right: 5rem; }

/* 프레임 크기 */
.lg\:w-\[450px\] { width: 450px; }
.lg\:h-\[calc\(100vh-80px\)\] { height: calc(100vh - 80px); }
.lg\:max-h-\[900px\] { max-height: 900px; }

/* 프레임 스타일 */
.lg\:rounded-3xl { border-radius: 1.5rem; }
.lg\:shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
```

### Mobile (1024px 미만)
```css
/* 배경 브랜딩 영역 숨김 */
.hidden { display: none; }

/* 프레임 전체 화면 */
.w-full { width: 100%; }
.h-screen { height: 100vh; }

/* 둥근 모서리 없음 */
/* 그림자 없음 */
```

---

## 🔧 사용 방법

### 1. 컴포넌트 임포트
```typescript
import GripFrameLayout from '@/components/GripFrameLayout'
```

### 2. 페이지 래핑
```typescript
export default function YourPage() {
  return (
    <GripFrameLayout>
      {/* 페이지 컨텐츠 */}
      <div className="h-screen bg-black">
        {/* 숏폼 영상, 라이브 방송 등 */}
      </div>
    </GripFrameLayout>
  )
}
```

### 3. 스크롤 숨김
프레임 내부에는 스크롤바가 보이지 않도록 자동 처리됩니다:
```css
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
```

---

## 🎭 장식 요소 (Decorative Elements)

### 그라데이션 블러 효과
```typescript
// 우측 상단
<div className="hidden lg:block absolute -top-4 -right-4 w-24 h-24 
     bg-gradient-to-br from-blue-500 to-purple-500 
     rounded-full opacity-20 blur-2xl">
</div>

// 좌측 하단
<div className="hidden lg:block absolute -bottom-4 -left-4 w-32 h-32 
     bg-gradient-to-br from-purple-500 to-pink-500 
     rounded-full opacity-20 blur-2xl">
</div>
```

**효과**: 프레임 주변에 부드러운 빛 효과로 입체감 증가

---

## 📊 적용된 페이지

### ✅ 현재 적용
- **ShortFormPage** (메인 숏폼 커머스)

### 🔜 향후 적용 가능
- HomePage (기존 라이브 커머스)
- LivePage (라이브 방송 시청)
- CartPage (장바구니)
- MyOrdersPage (주문 내역)

---

## 🎯 그립(Grip) 스타일 벤치마크

### 참고 사이트
- https://www.grip.show/

### 핵심 특징
1. **중앙 또는 우측 정렬** 모바일 프레임
2. **좌측 브랜딩 영역** (로고, 슬로건, 기능 소개)
3. **최대 450px 너비** (모바일 앱 느낌)
4. **그림자 효과**로 입체감
5. **모바일에서는 전체 화면** 전환

---

## 💡 디자인 철학

### Why Webview Frame?
1. **디자인 비용 절감**
   - 모바일용 디자인 하나만 만들면 PC도 대응
   - 별도 PC 레이아웃 불필요

2. **세로 영상 최적화**
   - 9:16 비율 영상은 좁은 프레임에서 더 예쁨
   - 시청 집중도 향상

3. **PG사 심사 유리**
   - PC에서 접속해도 "모바일 앱 기반" 인상
   - 결제 경로 직관적 확인 가능

4. **일관된 사용자 경험**
   - PC/모바일 동일한 UI
   - 학습 비용 최소화

---

## 🔍 기술 스택

### Layout Container
- **Flexbox** 기반 반응형 레이아웃
- **TailwindCSS** 유틸리티 클래스
- **lg:** 브레이크포인트 (1024px)

### Typography
- **Font Weights**: `font-black`, `font-bold`, `font-semibold`, `font-medium`
- **Text Sizes**: `text-4xl`, `text-3xl`, `text-2xl`, `text-lg`, `text-sm`
- **Colors**: `text-gray-900`, `text-gray-600`, `text-blue-600`, `text-purple-600`

### Effects
- **Gradients**: `bg-gradient-to-br from-* to-*`
- **Shadows**: `shadow-lg`, `shadow-2xl`
- **Blur**: `blur-2xl`
- **Opacity**: `opacity-20`

---

## 🧪 테스트 가이드

### Desktop 테스트 (1920x1080)
1. ✅ 좌측 브랜딩 영역 표시 확인
2. ✅ 우측 모바일 프레임 (450px) 확인
3. ✅ 프레임 그림자 효과 확인
4. ✅ 둥근 모서리 확인
5. ✅ 프레임 내부 콘텐츠 스크롤 확인

### Tablet 테스트 (768px)
1. ✅ 브랜딩 영역 숨김 확인
2. ✅ 프레임 전체 너비 확인

### Mobile 테스트 (375px)
1. ✅ 프레임 전체 화면 꽉 참 확인
2. ✅ 그림자 및 둥근 모서리 없음 확인
3. ✅ 콘텐츠 정상 표시 확인

---

## 📈 성능 최적화

### CSS 최적화
- **조건부 렌더링**: `hidden lg:flex` (Desktop only)
- **GPU 가속**: `transform`, `opacity` 사용
- **최소한의 DOM**: 불필요한 wrapper 제거

### 반응형 이미지
```typescript
// 추후 적용 권장
<picture>
  <source media="(min-width: 1024px)" srcSet="desktop-bg.webp" />
  <source media="(max-width: 1023px)" srcSet="mobile-bg.webp" />
  <img src="fallback.jpg" alt="Background" />
</picture>
```

---

## 🚀 배포 정보

### 최신 배포
- **Preview URL**: https://10008ba7.toss-live-commerce.pages.dev
- **Production URL**: https://live.ur-team.com
- **커밋**: `d52bc7c` - "feat: Add Grip-style webview frame layout"
- **배포 시간**: 2026-02-14

### 배포 확인사항
✅ Desktop에서 좌측 브랜딩 영역 표시  
✅ 우측 450px 모바일 프레임  
✅ 모바일에서 전체 화면  
✅ 스크롤바 숨김 처리  
✅ 그림자 및 둥근 모서리 정상  

---

## 🎨 커스터마이징 가이드

### 브랜딩 색상 변경
```typescript
// GripFrameLayout.tsx
// 로고 그라데이션
from-blue-600 to-purple-600  // 기본
from-red-600 to-orange-600   // 레드 테마
from-green-600 to-teal-600   // 그린 테마
```

### 프레임 크기 조정
```typescript
// 너비 변경
lg:w-[450px]  // 기본 (모바일 L)
lg:w-[375px]  // 작게 (모바일 S)
lg:w-[540px]  // 크게 (태블릿)

// 높이 여백 조정
lg:h-[calc(100vh-80px)]   // 기본 (상하 40px씩)
lg:h-[calc(100vh-120px)]  // 크게 (상하 60px씩)
lg:h-[100vh]              // 여백 없음
```

### 배치 변경
```typescript
// 우측 정렬 (기본)
justify-end lg:pr-20

// 중앙 정렬
justify-center

// 좌측 정렬
justify-start lg:pl-20
```

---

## 📞 PG사 승인 대비

### 그립 스타일 프레임의 장점

| 항목 | 기존 전체 화면 | 그립 스타일 프레임 |
|------|---------------|-------------------|
| **PC 인상** | 웹사이트 느낌 | 모바일 앱 느낌 ✅ |
| **디자인 일관성** | PC/모바일 다름 | 완전히 동일 ✅ |
| **브랜딩** | 상단 헤더만 | 좌측 전체 영역 ✅ |
| **결제 플로우** | 분산된 느낌 | 집중된 경험 ✅ |

### 심사 시 강조 포인트
> "PC 웹에서도 모바일 앱과 동일한 경험을 제공합니다.  
> 그립(Grip) 스타일의 웹뷰 프레임으로 결제 플로우가 명확하고 직관적입니다.  
> 셀러/인플루언서 중심의 영상 커머스 플랫폼으로 전환율이 높습니다."

---

## 🔮 향후 개선 사항

### 우선순위 높음
- [ ] 다크 모드 지원 (브랜딩 영역)
- [ ] 애니메이션 효과 추가 (프레임 진입)
- [ ] 브랜딩 영역 콘텐츠 CMS 연동

### 우선순위 중간
- [ ] A/B 테스트 (중앙 vs 우측 배치)
- [ ] 프레임 크기 사용자 설정
- [ ] 브랜딩 영역 비디오 배경

### 우선순위 낮음
- [ ] 3D 효과 (프레임 입체감)
- [ ] 마우스 인터랙션 (프레임 흔들림)
- [ ] 테마 전환 애니메이션

---

## 📚 참고 자료

- **그립(Grip) 공식 사이트**: https://www.grip.show/
- **Behance 디자인**: https://www.behance.net/gallery/93555399/Live-shopping-app-Grip-UXUI
- **TailwindCSS 문서**: https://tailwindcss.com/docs
- **반응형 디자인 가이드**: https://web.dev/responsive-web-design-basics/

---

**작성일**: 2026-02-14  
**작성자**: UR Team Dev  
**문서 버전**: 1.0
