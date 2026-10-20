# 어드민 가이드

## 어드민 로그인

1. `/admin/login` 페이지 접속
2. 어드민 이메일/비밀번호 입력 (환경변수 `ADMIN_EMAIL`, `ADMIN_PASSWORD`로 설정)
3. JWT 토큰 발급 -> `admin_token`으로 localStorage에 저장
4. Rate limit: 5회/5분 (로그인 시도 제한)

> **보안**: 어드민 API는 IP 화이트리스트(`ADMIN_IP_WHITELIST`) + 감사 로그(audit log)가 적용됩니다.

---

## 대시보드

어드민 대시보드 (`/admin`)에서 전체 서비스 현황을 확인할 수 있습니다:

- 총 주문 수, 매출
- 진행 중인 라이브 방송
- 신규 셀러 승인 대기
- 최근 주문 목록

---

## 주문 관리

**경로**: `/admin/orders` (`AdminOrdersPage`)

### 기능
- 전체 주문 목록 조회 (필터: 상태별, 날짜별, 셀러별)
- 주문 상세 확인 (주문자 정보, 상품, 결제 정보)
- **주문 상태 변경**: PENDING -> DONE -> PREPARING -> SHIPPING -> DELIVERED
- **운송장 등록**: 택배사, 운송장 번호 입력
- **배송 정보 확인**: 배송 추적

### 주문 상태
| 상태 | 설명 |
|------|------|
| `PENDING` | 결제 대기 |
| `DONE` | 결제 완료 |
| `PREPARING` | 상품 준비 중 |
| `SHIPPING` | 배송 중 |
| `DELIVERED` | 배송 완료 |
| `CANCELLED` | 주문 취소 |

---

## 상품 관리

**경로**: `/admin/products` (`AdminProductsPage`)

### 기능
- 전체 상품 목록 조회
- **상품 등록**: 이름, 가격, 이미지, 재고, 카테고리, 셀러 지정
- **대량 등록**: CSV 파일 업로드 (`/api/bulk-upload/*`)
- 상품 수정/삭제
- 활성/비활성 토글 (`is_active`)
- **카테고리 관리**: 카테고리 생성/수정/삭제

---

## 셀러 관리

**경로**: `/api/admin/*` (어드민 관리 API)

### 기능
- 셀러 목록 조회
- **승인**: 신규 셀러 가입 승인 (`pending` -> `approved`)
- **정지**: 문제 셀러 정지 (`approved` -> `suspended`)
- **거절**: 가입 거절 (`pending` -> `rejected`)
- 셀러별 수수료율 설정 (`commission_rate`)
- 셀러 상세 정보 확인 (사업자 정보, 매출, 상품 수)

---

## 정산 관리

**경로**: `/admin/settlements` (`AdminSettlementPage`)

### 기능
- 셀러별 정산 내역 조회
- 정산 대기 목록 확인
- **정산 처리**: 정산 승인 (`pending` -> `settled`)
- **CSV 내보내기**: 정산 데이터를 CSV로 다운로드 (은행 이체용)
- 기간별 정산 현황 리포트

### 정산 계산
```
셀러 정산액 = 주문 총액 - (주문 총액 x 수수료율)
수수료율: 셀러별 commission_rate (기본 10%)
```

---

## 배너 관리

**경로**: `/admin/banners` (`AdminBannersPage`)

### 메인 배너
- 홈페이지 상단 슬라이드 배너
- 이미지 업로드, 링크 URL 설정
- 노출 순서(`sort_order`) 설정
- 활성/비활성 토글

### 사이드 배너
- 모바일 레이아웃 우측 사이드 배너
- `side_banners` 테이블 관리
- 이미지, 링크, 노출 순서 설정

---

## 홈페이지 섹션 관리

**API**: `/api/sections/*`

### 기능
- 홈페이지 섹션 순서 및 구성 관리
- 섹션 타입: 배너, 상품 목록, 라이브 목록 등
- 섹션별 노출/숨김 설정
- 드래그앤드롭 순서 변경

---

## 라이브 관리

### 기능
- 진행 중인 라이브 방송 목록 확인
- 라이브 방송 상태 관리 (`scheduled` / `live` / `ended`)
- 라이브 방송 상세 정보 (셀러, 상품, 시청자 수)
- 문제 방송 강제 종료

---

## 브랜드메시지 패키지 관리

**경로**: `/admin/alimtalk-pricing` (`AdminAlimtalkPricingPage`)

### 기능
- 브랜드메시지 크레딧 패키지 가격 설정
- 패키지 종류별 크레딧 수량, 가격 관리
- 셀러별 크레딧 사용 현황 조회
