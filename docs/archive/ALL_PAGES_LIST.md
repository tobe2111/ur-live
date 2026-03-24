# 🎯 전체 페이지 목록 (2026-02-05 최종)

## 📱 **프론트엔드 페이지 (총 14개)**

### 🏠 **1. 사용자 페이지** (5개)

#### 1.1 **홈페이지**
- **URL**: `https://live.ur-team.com/`
- **파일**: `src/pages/HomePage.tsx`
- **기능**: 
  - 진행 중인 라이브 목록
  - 라이브 카드 클릭 → 라이브 페이지 이동
  - 카카오 로그인

#### 1.2 **라이브 시청 페이지** ⭐
- **URL**: `https://live.ur-team.com/live/:streamId`
- **파일**: `src/pages/LivePage.tsx`
- **기능**:
  - YouTube 라이브 스트림 재생
  - 탭하여 소리 켜기 오버레이
  - 실시간 채팅
  - 하단 상품 카드 (실시간 업데이트)
  - 담기 버튼 → 장바구니 추가
  - 결제 버튼 → 체크아웃
  - 공유/채팅 버튼

#### 1.3 **결제 페이지**
- **URL**: `https://live.ur-team.com/checkout`
- **파일**: `src/pages/CheckoutPage.tsx`
- **기능**:
  - 장바구니 상품 확인
  - 배송지 입력
  - 나이스페이먼츠 결제
  - 카카오 로그인 필수

#### 1.4 **내 주문 조회**
- **URL**: `https://live.ur-team.com/my-orders`
- **파일**: `src/pages/MyOrdersPage.tsx`
- **기능**:
  - 주문 내역 조회
  - 주문 상태 확인
  - 송장 번호 확인

#### 1.5 **카카오 로그인 콜백**
- **URL**: `https://live.ur-team.com/auth/kakao/callback`
- **파일**: `src/pages/KakaoCallbackPage.tsx`
- **기능**: 카카오 OAuth 리다이렉트 처리

---

### 🛍️ **2. 셀러 대시보드** (9개)

#### 2.1 **셀러 로그인**
- **URL**: `https://live.ur-team.com/seller/login`
- **파일**: `src/pages/SellerLoginPage.tsx`
- **기능**: 
  - 이메일/비밀번호 로그인
  - 판매자 회원가입

#### 2.2 **셀러 대시보드 (메인)** ⭐
- **URL**: `https://live.ur-team.com/seller`
- **파일**: `src/pages/SellerPage.tsx`
- **기능**:
  - 매출 통계 (총 매출, 주문 수)
  - 활성 라이브 수
  - 총 시청자 수
  - 퀵 액세스 메뉴:
    - 🔴 **라이브 컨트롤** (NEW!)
    - 사업자 정보
    - 세금계산서
    - 주문 관리
    - 상품 관리
  - 최근 주문 목록

#### 2.3 **라이브 상품 컨트롤** ⭐⭐⭐ (NEW!)
- **URL**: `https://live.ur-team.com/seller/live-control`
- **파일**: `src/pages/SellerLiveControlPage.tsx`
- **기능**:
  - **실시간 상품 전환** (핵심 기능!)
  - 현재 노출 중인 상품 표시
  - 상품 목록 그리드
  - 클릭으로 즉시 상품 전환
  - 라이브 미리보기 링크
  - 사용 방법 안내

#### 2.4 **상품 관리**
- **URL**: `https://live.ur-team.com/seller/products`
- **파일**: `src/pages/SellerProductsPage.tsx`
- **기능**:
  - 상품 목록 조회
  - 상품 등록 버튼
  - 상품 수정/삭제

#### 2.5 **상품 등록**
- **URL**: `https://live.ur-team.com/seller/products/new`
- **파일**: `src/pages/SellerProductNewPage.tsx`
- **기능**:
  - 상품명, 설명, 가격 입력
  - 할인율, 재고 설정
  - 이미지 URL 입력

#### 2.6 **상품 수정**
- **URL**: `https://live.ur-team.com/seller/products/:id/edit`
- **파일**: `src/pages/SellerProductEditPage.tsx`
- **기능**: 기존 상품 정보 수정

#### 2.7 **주문 관리**
- **URL**: `https://live.ur-team.com/seller/orders`
- **파일**: `src/pages/SellerOrdersPage.tsx`
- **기능**:
  - 주문 목록 조회
  - 주문 상태 변경 (배송 준비 → 배송 중 → 배송 완료)
  - 송장 번호 입력
  - 주문 상세 정보

#### 2.8 **사업자 정보 관리**
- **URL**: `https://live.ur-team.com/seller/business-info`
- **파일**: `src/pages/SellerBusinessInfoPage.tsx`
- **기능**:
  - 사업자 정보 등록/수정
  - 사업자등록번호
  - 회사명, 대표자명
  - 주소, 업태, 종목

#### 2.9 **세금계산서 관리**
- **URL**: `https://live.ur-team.com/seller/tax-invoices`
- **파일**: `src/pages/SellerTaxInvoicesPage.tsx`
- **기능**:
  - 세금계산서 발행 내역
  - 바로빌 연동 상태
  - 세금계산서 조회

---

### 👨‍💼 **3. 관리자 대시보드** (0개 - 없음!)

**❌ 관리자 전용 페이지가 없습니다!**

현재는 **API만 존재**:
- `GET /api/admin/sellers` - 판매자 목록
- `POST /api/admin/sellers/:id/approve` - 판매자 승인
- `POST /api/admin/streams/:streamId/change-product` - 상품 전환
- `DELETE /api/admin/streams/:id` - 라이브 삭제

**필요 시 구현 가능**:
- 관리자 로그인 페이지
- 판매자 승인 대시보드
- 라이브 스트림 관리
- 전체 주문/매출 통계

---

## 📊 **페이지 카테고리별 정리**

| 카테고리 | 페이지 수 | 상태 |
|---------|----------|------|
| **사용자** | 5개 | ✅ 완성 |
| **셀러** | 9개 | ✅ 완성 |
| **관리자** | 0개 | ❌ 없음 |
| **총합** | **14개** | - |

---

## 🎯 **주요 페이지 접근 경로**

### **사용자 흐름**
```
홈페이지 (/)
    ↓
라이브 페이지 (/live/1)
    ↓ 담기 클릭
장바구니 → 카카오 로그인
    ↓
결제 페이지 (/checkout)
    ↓
내 주문 조회 (/my-orders)
```

### **셀러 흐름**
```
셀러 로그인 (/seller/login)
    ↓
셀러 대시보드 (/seller)
    ↓
🔴 라이브 컨트롤 (/seller/live-control) ← 실시간 상품 전환!
    ↓
상품 관리 (/seller/products)
    ↓
주문 관리 (/seller/orders)
    ↓
사업자 정보 (/seller/business-info)
    ↓
세금계산서 (/seller/tax-invoices)
```

---

## 🚀 **배포된 URL**

### **프로덕션**
- **메인**: https://live.ur-team.com
- **홈페이지**: https://live.ur-team.com/
- **라이브**: https://live.ur-team.com/live/1
- **셀러**: https://live.ur-team.com/seller
- **라이브 컨트롤**: https://live.ur-team.com/seller/live-control

### **최신 배포**
- https://c70ce502.toss-live-commerce.pages.dev

---

## 📝 **페이지별 상세 기능**

### **🔥 핵심 페이지 TOP 3**

#### 1. **라이브 페이지** (`/live/:streamId`)
- YouTube 라이브 스트림 재생
- 탭하여 소리 켜기 UX
- 실시간 채팅
- 하단 상품 카드 (3초마다 업데이트)
- 담기/결제 버튼

#### 2. **셀러 라이브 컨트롤** (`/seller/live-control`) ⭐ NEW!
- **실시간 상품 전환** (클릭 한 번)
- 현재 노출 상품 표시
- 상품 그리드 (이미지 + 가격)
- 라이브 미리보기 링크

#### 3. **셀러 대시보드** (`/seller`)
- 매출/주문 통계
- 퀵 액세스 메뉴
- 최근 주문 목록

---

## 🎨 **UI/UX 특징**

### **공통 디자인**
- Apple-style 디자인 시스템
- Tailwind CSS
- 모바일 반응형
- Lucide 아이콘

### **색상 팔레트**
- 파란색: `#0064FF` (결제, 메인 액션)
- 주황색: `#FF6B35` (담기, 라이브)
- 빨간색: `#ff3b30` (라이브 상태)
- 그레이: `#1d1d1f`, `#6e6e73` (텍스트)

---

## ❌ **없는 페이지**

### **관리자 대시보드** (구현 필요 시)
- `/admin` - 관리자 메인
- `/admin/login` - 관리자 로그인
- `/admin/sellers` - 판매자 관리
- `/admin/streams` - 라이브 관리
- `/admin/statistics` - 전체 통계

### **기타 미구현 페이지**
- `/seller/streams` - 라이브 생성/관리 (API는 있음)
- `/seller/analytics` - 상세 분석
- `/seller/reviews` - 리뷰 관리
- `/seller/coupons` - 쿠폰 관리

---

## 🎉 **최종 요약**

### **현재 운영 중인 페이지**
- ✅ **사용자**: 5개 (홈, 라이브, 결제, 주문, 로그인)
- ✅ **셀러**: 9개 (대시보드, 라이브 컨트롤, 상품, 주문, 사업자, 세금계산서 등)
- ❌ **관리자**: 0개 (API만 존재)

### **핵심 기능 페이지**
1. 🥇 **라이브 시청** (`/live/:streamId`)
2. 🥈 **라이브 컨트롤** (`/seller/live-control`) - NEW!
3. 🥉 **셀러 대시보드** (`/seller`)

### **프로덕션 상태**
- **총 14개 페이지** 모두 배포 완료 ✅
- **YouTube 라이브 연동** 완성 ✅
- **실시간 상품 전환** 완성 ✅
- **결제/세금계산서** 완성 ✅

---

**모든 페이지가 프로덕션에서 정상 작동 중입니다!** 🎉

**작성일**: 2026-02-05  
**배포 URL**: https://live.ur-team.com  
**상태**: 🟢 Production Ready (14 pages)
