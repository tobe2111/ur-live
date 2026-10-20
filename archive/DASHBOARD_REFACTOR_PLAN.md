# 셀러 대시보드 통합 리팩토링 계획

## 현재 상태
- **SellerPage**: 메인 대시보드 (통계 카드, Quick Access, 라이브/상품 목록, 최근 활동)
- **SellerDashboardPage**: 통계 전용 (차트, 상세 통계)

## 통합 목표
단일 페이지에서 모든 핵심 기능 제공

## 새로운 구조 (SellerPage 개선)

### 섹션 1: Header (유지)
- 홈 버튼, 타이틀, 알림, 라이브 컨트롤, 프로필, 로그아웃

### 섹션 2: Welcome + 기간 선택
- "안녕하세요, {sellerName}님!" 
- 기간 선택 버튼 (7일/30일/90일) 추가

### 섹션 3: 통계 카드 (확장)
- 총 매출 ✅
- 총 주문 ✅
- 활성 라이브 ✅
- 총 시청자 ✅
- **추가**: 대기 중 주문
- **추가**: 취소율

### 섹션 4: 차트 (SellerDashboardPage에서 이동)
- 일별 매출 추이 (Line Chart)
- 상품별 매출 Top 5 (Bar Chart + Table)

### 섹션 5: Quick Access (간소화)
- 8개 → 6개로 축소 (나중에 결정)

### 섹션 6: 라이브 스트림 (유지)
- 최대 3개 표시

### 섹션 7: 상품 관리 (유지)
- 최대 3개 표시

## 삭제할 섹션
- ❌ 최근 활동 (하드코딩)
- ❌ 셀러 공개 페이지 링크 박스 (너무 눈에 띔)

## API 변경
- `/api/seller/stats` → `/api/seller/dashboard/stats?period=7d` 통합

## 성능 최적화
- Recharts lazy load
- 차트 데이터 캐싱
- 이미지 lazy loading (이미 적용됨)
