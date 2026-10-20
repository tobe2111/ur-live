# 🎯 유어라이브(UR LIVE) - 최종 기능 명세서 및 테스트 가이드

## 📋 목차
1. [프로젝트 개요](#프로젝트-개요)
2. [시스템 아키텍처](#시스템-아키텍처)
3. [전체 기능 명세](#전체-기능-명세)
4. [API 엔드포인트 목록](#api-엔드포인트-목록)
5. [핵심 테스트 시나리오](#핵심-테스트-시나리오)
6. [미해결 과제](#미해결-과제)
7. [런칭 체크리스트](#런칭-체크리스트)

---

## 📝 프로젝트 개요

### 서비스 정보
- **서비스명**: 유어라이브 (UR LIVE)
- **타입**: 라이브 커머스 플랫폼
- **주요 기능**: 실시간 라이브 방송 + 상품 판매 + 결제 시스템
- **타겟 사용자**: 일반 구매자, 셀러(판매자), 관리자

### 기술 스택
- **프론트엔드**: React + TypeScript + Vite + TailwindCSS
- **백엔드**: Hono (Cloudflare Workers)
- **데이터베이스**: Cloudflare D1 (SQLite)
- **스토리지**: Cloudflare R2
- **인증**: JWT (JSON Web Token) + Kakao OAuth
- **결제**: Toss Payments (토스페이먼츠)
- **알림톡**: Kakao Alimtalk API
- **라이브 스트리밍**: YouTube Live API
- **배포**: Cloudflare Pages

### 프로젝트 통계
- **총 페이지 수**: 73개
- **총 컴포넌트 수**: 45개
- **총 API 엔드포인트**: 192개
- **주요 데이터 테이블**: 20개 이상

---

## 🏗️ 시스템 아키텍처

### 데이터베이스 스키마 (주요 테이블)

#### 사용자 관련
- `users` - 일반 사용자 정보
- `sellers` - 셀러 계정 정보
- `seller_business_info` - 셀러 사업자 정보
- `admins` - 관리자 계정

#### 상품 관련
- `products` - 상품 마스터 (⭐️ reserved_stock 컬럼 추가됨)
- `product_options` - 상품 옵션 (사이즈, 색상 등)
- `product_categories` - 상품 카테고리

#### 주문 관련
- `orders` - 주문 마스터 (⭐️ reservation_expires_at 추가됨)
- `order_items` - 주문 상세 아이템
- `shipping_addresses` - 배송지 정보
- `payments` - 결제 정보

#### 라이브 스트림 관련
- `streams` - 라이브 방송 정보
- `stream_products` - 방송에 연결된 상품
- `live_stream_views` - 시청자 통계
- `chat_messages` - 채팅 메시지
- `chat_bans` - 채팅 차단 사용자

#### 기타
- `cart` - 장바구니
- `wishlists` - 위시리스트
- `banners` - 메인 배너
- `notifications` - 알림
- `alimtalk_logs` - 알림톡 발송 로그

---

## 🎨 전체 기능 명세

### 1️⃣ 일반 사용자 (고객) 기능 (27개)

#### 인증 & 회원관리 (7)
| 번호 | 기능명 | 설명 | 페이지/API |
|-----|--------|------|-----------|
| 1 | 회원가입 | 이메일/비밀번호 회원가입 | `/login` + `POST /api/auth/user/register` |
| 2 | 로그인 | 이메일 로그인 | `/login` + `POST /api/auth/user/login` |
| 3 | 카카오 로그인 | 카카오 소셜 로그인 | `/login` + `POST /api/auth/kakao/callback` |
| 4 | 카카오 계정 연동 | 기존 계정에 카카오 연동 | `POST /api/auth/kakao/sync` |
| 5 | 로그아웃 | 세션 종료 및 토큰 삭제 | `POST /api/auth/logout` |
| 6 | 토큰 리프레시 | JWT 액세스 토큰 갱신 | `POST /api/auth/refresh` |
| 7 | 회원 정보 조회 | 내 프로필 확인 | `/my` + `GET /api/auth/user/verify` |

#### 상품 탐색 (6)
| 번호 | 기능명 | 설명 | 페이지/API |
|-----|--------|------|-----------|
| 8 | 메인 페이지 | 배너, 라이브, 인기 상품 | `/` (HomePage) |
| 9 | 상품 목록 조회 | 전체 상품 리스트 | `/browse` + `GET /api/products` |
| 10 | 상품 검색 | 키워드로 상품 검색 | `/search` + `GET /api/products/search` |
| 11 | 상품 상세 조회 | 상품 정보, 옵션, 재고 | `/product/:id` + `GET /api/products/:id` |
| 12 | 인기 상품 조회 | 인기순 정렬 | `GET /api/products/popular` |
| 13 | 검색 자동완성 | 검색어 추천 | `GET /api/search/suggestions` |

#### 장바구니 & 위시리스트 (6)
| 번호 | 기능명 | 설명 | 페이지/API |
|-----|--------|------|-----------|
| 14 | 장바구니 추가 | 상품을 장바구니에 담기 | `POST /api/cart` |
| 15 | 장바구니 조회 | 내 장바구니 목록 | `/cart` + `GET /api/cart/:userId` |
| 16 | 장바구니 수량 변경 | 상품 수량 증감 | `PUT /api/cart/:cartItemId` |
| 17 | 장바구니 삭제 | 개별 아이템 삭제 | `DELETE /api/cart/:cartItemId` |
| 18 | 위시리스트 추가 | 관심 상품 저장 | `POST /api/wishlists` |
| 19 | 위시리스트 조회 | 내 위시리스트 | `/wishlist` + `GET /api/wishlists/:userId` |

#### 주문 & 결제 (5)
| 번호 | 기능명 | 설명 | 페이지/API |
|-----|--------|------|-----------|
| 20 | 배송지 관리 | 배송지 추가/수정/삭제 | `/address-management` + `/api/shipping-addresses` |
| 21 | 주문서 작성 | 배송지 선택, 결제 준비 | `/checkout` |
| 22 | ⭐️ 재고 예약 | 주문 시 재고 자동 예약 (10분) | `POST /api/orders` (원자적 락) |
| 23 | 결제 실행 | Toss Payments 결제 | `POST /api/payments/confirm` |
| 24 | 주문 내역 조회 | 내 주문 리스트 | `/my-orders` + `GET /api/orders/user/:userId` |

#### 라이브 스트림 (3)
| 번호 | 기능명 | 설명 | 페이지/API |
|-----|--------|------|-----------|
| 25 | 라이브 시청 | 실시간 방송 시청 + 채팅 | `/live/:id` (LivePageV2.tsx) |
| 26 | 숏폼 시청 | 세로형 스와이프 뷰 | `/short/:id` (ShortFormPage.tsx) |
| 27 | 채팅 참여 | 실시간 채팅 (Firebase) | LiveChat 컴포넌트 |

---

### 2️⃣ 셀러 (판매자) 기능 (23개)

#### 셀러 계정 (4)
| 번호 | 기능명 | 설명 | 페이지/API |
|-----|--------|------|-----------|
| 28 | 셀러 회원가입 | 셀러 계정 등록 | `/seller/register` + `POST /api/seller/register` |
| 29 | 셀러 로그인 | JWT 인증 | `/seller/login` + `POST /api/auth/login` |
| 30 | 사업자 정보 등록 | 사업자등록증 등록 | `/seller/business-info` + `POST /api/seller/business-info` |
| 31 | 셀러 프로필 수정 | 프로필 이미지, 소개 등 | `/seller/profile-edit` |

#### 상품 관리 (6)
| 번호 | 기능명 | 설명 | 페이지/API |
|-----|--------|------|-----------|
| 32 | 상품 등록 | 새 상품 추가 | `/seller/products/new` + `POST /api/seller/products` |
| 33 | 상품 목록 | 내 상품 리스트 | `/seller/products` + `GET /api/seller/products` |
| 34 | 상품 수정 | 상품 정보 변경 | `/seller/products/:id/edit` + `PUT /api/seller/products/:id` |
| 35 | 상품 삭제 | 상품 삭제 | `DELETE /api/seller/products/:id` |
| 36 | 옵션 관리 | 사이즈/색상 등 옵션 추가 | `POST /api/seller/products/:id/options` |
| 37 | 이미지 업로드 | 상품 이미지 등록 (R2) | `POST /api/seller/upload-image` |

#### 라이브 방송 관리 (7)
| 번호 | 기능명 | 설명 | 페이지/API |
|-----|--------|------|-----------|
| 38 | 라이브 스트림 생성 | 새 방송 예약 | `/seller/streams/new` + `POST /api/seller/streams` |
| 39 | 라이브 스트림 수정 | 제목, 설명, 상품 변경 | `/seller/streams/:id/edit` + `PUT /api/seller/streams/:id` |
| 40 | 라이브 스트림 삭제 | 방송 취소 | `DELETE /api/seller/streams/:id` |
| 41 | YouTube 라이브 생성 | YouTube API 연동 | `POST /api/seller/youtube/create-live` |
| 42 | YouTube 라이브 종료 | 방송 종료 | `POST /api/seller/youtube/end-live/:streamId` |
| 43 | ⭐️ 라이브 중 상품 변경 | 실시간 소개 상품 전환 | `/seller/live-control` + `POST /api/seller/streams/:streamId/change-product` |
| 44 | 라이브 통계 조회 | 시청자 수, 채팅 수 | `GET /api/seller/youtube/stats/:streamId` |

#### 주문 & 통계 (4)
| 번호 | 기능명 | 설명 | 페이지/API |
|-----|--------|------|-----------|
| 45 | 셀러 주문 내역 | 내 상품 주문 리스트 | `/seller/orders` + `GET /api/seller/orders` |
| 46 | 셀러 대시보드 | 매출, 주문, 재고 통계 | `/seller/dashboard` + `GET /api/seller/dashboard/stats` |
| 47 | 상품별 통계 | 상품별 판매 분석 | `GET /api/seller/analytics/products` |
| 48 | 매출 통계 | 일별/월별 매출 | `GET /api/seller/stats/sales` |

#### 알림톡 (2)
| 번호 | 기능명 | 설명 | 페이지/API |
|-----|--------|------|-----------|
| 49 | 알림톡 대시보드 | 발송 내역, 잔액 조회 | `/seller/alimtalk-dashboard` |
| 50 | 알림톡 발송 | 고객에게 알림톡 전송 | `/seller/alimtalk-send` + `POST /api/seller/alimtalk/send` |

---

### 3️⃣ 관리자 (Admin) 기능 (18개)

#### 관리자 인증 (2)
| 번호 | 기능명 | 설명 | 페이지/API |
|-----|--------|------|-----------|
| 51 | 관리자 로그인 | JWT 인증 | `/admin/login` + `POST /api/admin/login` |
| 52 | 세션 검증 | JWT 토큰 검증 | `verifyAdminSession` 미들웨어 |

#### 셀러 관리 (4)
| 번호 | 기능명 | 설명 | 페이지/API |
|-----|--------|------|-----------|
| 53 | 셀러 목록 조회 | 전체 셀러 리스트 | `/admin` + `GET /api/admin/sellers` |
| 54 | 셀러 승인 | 셀러 상태 활성화 | `PUT /api/admin/sellers/:id/approve` |
| 55 | 사업자 정보 검증 | 사업자등록증 검토 | `GET /api/admin/seller-business` |
| 56 | 사업자 승인 | 사업자 정보 승인 처리 | `PUT /api/admin/seller-business/:id/verify` |

#### 라이브 스트림 관리 (3)
| 번호 | 기능명 | 설명 | 페이지/API |
|-----|--------|------|-----------|
| 57 | 전체 스트림 조회 | 모든 방송 리스트 | `GET /api/admin/streams` |
| 58 | 스트림 생성 | 관리자가 방송 생성 | `POST /api/admin/streams` |
| 59 | 스트림 삭제 | 방송 강제 삭제 | `DELETE /api/admin/streams/:id` |

#### 배너 관리 (5)
| 번호 | 기능명 | 설명 | 페이지/API |
|-----|--------|------|-----------|
| 60 | 배너 목록 조회 | 전체 배너 리스트 | `/admin/banners` + `GET /api/admin/banners` |
| 61 | 배너 등록 | 새 배너 추가 | `POST /api/admin/banners` |
| 62 | 배너 수정 | 배너 정보 변경 | `PUT /api/admin/banners/:id` |
| 63 | 배너 삭제 | 배너 삭제 | `DELETE /api/admin/banners/:id` |
| 64 | 배너 순서 변경 | display_order 조정 | `PUT /api/admin/banners/reorder` |

#### 시스템 관리 (4)
| 번호 | 기능명 | 설명 | 페이지/API |
|-----|--------|------|-----------|
| 65 | 정산 내역 조회 | 셀러별 정산 현황 | `/admin/settlement` + `GET /api/admin/settlements` |
| 66 | 알림톡 가격 설정 | 알림톡 요금 관리 | `/admin/alimtalk-pricing` |
| 67 | KV 모니터링 | Cloudflare KV 스토리지 상태 | `/admin/kv-monitoring` |
| 68 | 만료 예약 정리 | 10분 지난 재고 예약 해제 | `GET /api/cleanup/expired-reservations` |

---

### 4️⃣ 시스템 기능 (자동화/백엔드) (12개)

#### 재고 관리 시스템 ⭐️ (3)
| 번호 | 기능명 | 설명 | 구현 위치 |
|-----|--------|------|----------|
| 69 | 원자적 재고 예약 | 동시 주문 시 레이스 컨디션 방지 | `POST /api/orders` (비관적 락) |
| 70 | 재고 롤백 | 결제 실패 시 예약 해제 | `POST /api/payments/rollback` |
| 71 | 재고 확정 | 결제 성공 시 최종 차감 | `POST /api/payments/confirm` |

#### 결제 시스템 (4)
| 번호 | 기능명 | 설명 | 구현 위치 |
|-----|--------|------|----------|
| 72 | 결제 승인 | Toss Payments API 호출 | `POST /api/payments/confirm` |
| 73 | 결제 취소 | 결제 취소 처리 | `POST /api/payments/:paymentKey/cancel` |
| 74 | 주문 취소 | 주문 상태 변경 | `POST /api/orders/:orderId/cancel` |
| 75 | 환불 처리 | 환불 진행 | `POST /api/orders/:orderNumber/refund` |

#### 알림 시스템 (3)
| 번호 | 기능명 | 설명 | 구현 위치 |
|-----|--------|------|----------|
| 76 | 주문 확인 알림톡 | 결제 성공 시 자동 발송 | `POST /api/payments/confirm` 내부 |
| 77 | 수동 알림톡 발송 | 셀러가 직접 발송 | `POST /api/seller/alimtalk/send` |
| 78 | 알림톡 로그 저장 | 발송 내역 DB 저장 | `alimtalk_logs` 테이블 |

#### 기타 시스템 (2)
| 번호 | 기능명 | 설명 | 구현 위치 |
|-----|--------|------|----------|
| 79 | 이미지 최적화 | R2 업로드 + 압축 | `POST /api/seller/upload-image` |
| 80 | 헬스체크 | 서버 상태 확인 | `GET /api/health` |

---

## 📡 API 엔드포인트 목록 (192개)

### 주요 카테고리별 엔드포인트 수
| 카테고리 | 엔드포인트 수 | 주요 기능 |
|---------|-------------|----------|
| 인증 (Auth) | 18 | 회원가입, 로그인, 카카오 연동, JWT 토큰 |
| 상품 (Products) | 24 | 상품 CRUD, 검색, 옵션 관리 |
| 주문 (Orders) | 16 | 주문 생성, 조회, 취소, 환불 |
| 결제 (Payments) | 8 | 결제 승인, 취소, 롤백, 웹훅 |
| 라이브 스트림 (Streams) | 22 | 방송 관리, 상품 변경, 시청자 수 |
| 셀러 (Seller) | 28 | 상품 관리, 통계, 알림톡 |
| 관리자 (Admin) | 18 | 셀러 관리, 배너, 정산 |
| 장바구니 (Cart) | 8 | 추가, 조회, 수정, 삭제 |
| 위시리스트 (Wishlist) | 6 | 추가, 조회, 삭제 |
| 채팅 (Chat) | 8 | 메시지 전송, 조회, 차단 |
| 배송지 (Shipping) | 8 | 배송지 CRUD |
| 기타 (Misc) | 28 | 헬스체크, 이미지, 통계, KV 모니터링 |

### 주요 엔드포인트 상세

#### 인증 (Auth)
```
POST   /api/auth/user/register         - 회원가입
POST   /api/auth/user/login            - 이메일 로그인
POST   /api/auth/login                 - 통합 로그인 (셀러/관리자)
POST   /api/admin/login                - 관리자 로그인
POST   /api/auth/kakao/callback        - 카카오 로그인 콜백
POST   /api/auth/kakao/sync            - 카카오 계정 연동
POST   /api/auth/refresh               - JWT 토큰 갱신
POST   /api/auth/logout                - 로그아웃
GET    /api/auth/verify                - 토큰 검증
GET    /api/auth/user/verify           - 사용자 정보 조회
```

#### 상품 (Products)
```
GET    /api/products                   - 상품 목록 (캐싱)
GET    /api/products/:id               - 상품 상세
GET    /api/products/:id/stock         - 재고 조회 (마이크로 캐시)
GET    /api/products/search            - 상품 검색
GET    /api/products/popular           - 인기 상품
POST   /api/seller/products            - 상품 등록 (셀러)
PUT    /api/seller/products/:id        - 상품 수정 (셀러)
DELETE /api/seller/products/:id        - 상품 삭제 (셀러)
```

#### 주문 & 결제 ⭐️ (재고 예약 시스템)
```
POST   /api/orders                     - 주문 생성 (재고 예약 10분)
GET    /api/orders/:orderNumber        - 주문 조회
POST   /api/orders/:orderId/cancel     - 주문 취소
POST   /api/payments/confirm           - 결제 승인 (재고 확정)
POST   /api/payments/rollback          - 결제 실패 (재고 롤백)
POST   /api/payments/:paymentKey/cancel - 결제 취소
GET    /api/cleanup/expired-reservations - 만료 예약 정리 (Cron)
```

#### 라이브 스트림
```
GET    /api/streams                    - 라이브 목록 (캐싱)
GET    /api/streams/:id                - 라이브 상세
POST   /api/seller/streams             - 라이브 생성 (셀러)
PUT    /api/seller/streams/:id         - 라이브 수정 (셀러)
POST   /api/seller/streams/:streamId/change-product - 상품 변경 (셀러)
GET    /api/streams/:streamId/current-product - 현재 상품 조회
POST   /api/streams/:streamId/view     - 시청 기록
GET    /api/streams/:streamId/viewer-count - 시청자 수
```

#### 장바구니
```
GET    /api/cart/:userId               - 장바구니 조회
POST   /api/cart                       - 장바구니 추가
PUT    /api/cart/:cartItemId           - 수량 변경
DELETE /api/cart/:cartItemId           - 아이템 삭제
DELETE /api/cart/clear/:userId         - 전체 삭제
```

---

## 🧪 핵심 테스트 시나리오 (5가지)

### 시나리오 1: 전체 라이브 쇼핑 플로우 (일반 사용자) ✅

**목적**: 실제 고객이 라이브 방송을 보고 구매하는 전 과정 검증

#### 1단계: 회원가입 & 로그인
```
1. https://live.ur-team.com/ 접속
2. 우측 상단 "로그인" 클릭
3. "회원가입" 탭 클릭
4. 이메일: test_buyer_001@test.com
   비밀번호: Test1234!
5. "가입하기" 클릭
6. 로그인 성공 → 메인 페이지로 이동
```
**✅ 확인사항**:
- localStorage에 `access_token`, `refresh_token`, `user_type: 'user'` 저장됨
- 우측 상단에 "내 정보" 버튼 표시

#### 2단계: 라이브 방송 시청
```
1. 메인 페이지 "LIVE NOW" 섹션에서 진행 중인 방송 클릭
2. 또는 직접 URL 입력: /live/:streamId
3. YouTube 플레이어 자동 재생
4. 우측 채팅창에서 메시지 입력 테스트
5. 하단에 현재 소개 상품 표시 확인
```
**✅ 확인사항**:
- YouTube 영상 정상 재생
- 채팅 메시지 실시간 전송/수신
- 현재 상품 정보 (이름, 가격, 이미지) 표시
- 시청자 수 증가 (3초마다 폴링)

#### 3단계: 상품 담기 (재고 확인)
```
1. 라이브 화면 하단 "담기" 버튼 클릭
2. 상품 옵션 선택 (사이즈, 색상 등)
3. 수량 선택 (예: 2개)
4. "장바구니에 담기" 확인
5. 우측 상단 장바구니 아이콘에 숫자 표시
```
**✅ 확인사항**:
- 옵션별 재고 수량 표시
- 재고 부족 시 경고 메시지
- localStorage에 `cart_updated_at` 플래그 설정
- 장바구니 카운트 업데이트

#### 4단계: 결제 진행 (재고 예약 테스트)
```
1. 우측 상단 장바구니 아이콘 클릭 → /cart
2. 상품 목록 확인
3. "선택 상품 주문하기" 클릭 → /checkout
4. 배송지 선택 또는 "새 배송지 추가"
5. 결제 수단 선택 (Toss Payments 위젯 로드 확인)
6. 이용약관 동의 체크
7. "결제하기" 버튼 클릭
```
**✅ 확인사항**:
- ⭐️ **재고 예약 발생**: `POST /api/orders` 호출
- `products.reserved_stock` 증가, `stock` 감소 (DB 확인)
- `orders.reservation_expires_at` = 현재시각 + 10분 설정
- `orders.status = 'pending'`, `payment_status = 'pending'`

#### 5단계: 결제 완료
```
1. Toss Payments 팝업에서 테스트 카드 입력
   - 카드번호: 5570-7900-0000-0001
   - 유효기간: 12/25
   - CVC: 123
2. "결제하기" 클릭
3. 결제 승인 대기
4. /payment/success 페이지로 리다이렉트
5. 주문번호 표시 확인
```
**✅ 확인사항**:
- ⭐️ **재고 확정**: `POST /api/payments/confirm` 호출
- `products.reserved_stock` 감소 (최종 차감 완료)
- `orders.status = 'paid'`, `payment_status = 'approved'`
- `orders.reservation_expires_at = NULL` (예약 해제)
- 알림톡 발송 (콘솔 로그 확인)

#### 6단계: 주문 내역 확인
```
1. 우측 상단 "내 정보" → "주문 내역" 클릭
2. 방금 주문한 내역 최상단 표시
3. 주문번호, 상품명, 금액, 상태 확인
4. "상세보기" 클릭 → 배송지, 결제 정보 확인
```
**✅ 확인사항**:
- 주문 상태: "결제 완료" (paid)
- 총 결제 금액 정확
- 배송지 정보 일치

---

### 시나리오 2: 셀러 라이브 제어 (셀러) ✅

**목적**: 셀러가 라이브 방송 중 실시간으로 소개 상품을 변경하는 기능 검증

#### 1단계: 셀러 로그인
```
1. https://live.ur-team.com/seller/login 접속
2. 셀러 계정 로그인
   이메일: seller_test_001@test.com
   비밀번호: Seller1234!
3. 셀러 대시보드 진입
```
**✅ 확인사항**:
- localStorage에 `access_token`, `user_type: 'seller'`, `seller_id` 저장
- 좌측 사이드바 표시

#### 2단계: 라이브 스트림 생성
```
1. 좌측 메뉴 "라이브 방송" 클릭
2. "새 라이브 만들기" 버튼 클릭
3. 제목: "테스트 라이브 방송"
   설명: "상품 변경 테스트용"
   YouTube Video ID: (유효한 라이브 영상 ID)
4. 연결할 상품 3개 선택
5. "생성하기" 클릭
```
**✅ 확인사항**:
- `POST /api/seller/streams` 호출 성공
- DB에 `streams` 레코드 생성
- `stream_products` 테이블에 3개 상품 연결
- `current_product_id` = 첫 번째 상품 ID

#### 3단계: 라이브 제어 페이지 진입
```
1. 라이브 목록에서 방금 생성한 방송 찾기
2. "라이브 제어" 버튼 클릭
3. /seller/live-control 페이지 로드
4. YouTube 플레이어 + 상품 목록 표시 확인
```
**✅ 확인사항**:
- 현재 소개 중인 상품 강조 표시 (보라색 테두리)
- 다른 상품들 리스트 표시
- "이 상품으로 변경" 버튼 활성화

#### 4단계: 상품 변경 실행 ⭐️
```
1. 두 번째 상품 카드 클릭
2. "이 상품으로 변경" 버튼 클릭
3. 로딩 스피너 표시
4. 변경 완료 후 UI 업데이트
```
**✅ 확인사항**:
- `POST /api/seller/streams/:streamId/change-product` 호출
- DB: `streams.current_product_id` 업데이트
- 프론트엔드: 3초 후 폴링으로 새 상품 정보 갱신
- 일반 사용자 라이브 화면에서도 동일하게 업데이트됨 (별도 브라우저로 테스트)

#### 5단계: 통계 확인
```
1. 셀러 대시보드로 돌아가기
2. 통계 카드 확인
   - 오늘 매출
   - 주문 수
   - 재고 부족 상품
3. 라이브 통계 확인
   - 현재 시청자 수
   - 채팅 메시지 수
```
**✅ 확인사항**:
- 통계 데이터 정확성
- 실시간 업데이트

---

### 시나리오 3: 재고 예약 동시성 테스트 (레이스 컨디션 방지) ⭐️⭐️⭐️

**목적**: 재고가 1개 남은 상품에 2명이 동시에 주문할 때 오버셀링 방지 검증

#### 준비 단계: 테스트 상품 생성
```
1. 관리자 또는 셀러 계정으로 로그인
2. 상품 등록
   - 이름: "재고 테스트 상품"
   - 가격: 10,000원
   - 재고: 1개 (⭐️ 중요)
3. 상품 ID 기록 (예: product_id = 999)
```

#### 테스트 실행 (동시 주문 시뮬레이션)
```
방법 1: 수동 테스트 (2개 브라우저)
1. Chrome 브라우저: 사용자 A 로그인 (buyer_A@test.com)
2. Firefox 브라우저: 사용자 B 로그인 (buyer_B@test.com)
3. 두 브라우저 모두 동일 상품 페이지 접속
4. 양쪽에서 동시에 "장바구니 담기" → "결제하기"
5. 거의 동시에 "결제하기" 버튼 클릭

방법 2: 자동화 테스트 (cURL)
터미널 1:
$ curl -X POST https://live.ur-team.com/api/orders \
  -H "Authorization: Bearer USER_A_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": 999, "quantity": 1, "price": 10000}],
    "userId": "user_a_id",
    "shippingAddress": {...}
  }'

터미널 2 (동시 실행):
$ curl -X POST https://live.ur-team.com/api/orders \
  -H "Authorization: Bearer USER_B_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": 999, "quantity": 1, "price": 10000}],
    "userId": "user_b_id",
    "shippingAddress": {...}
  }'
```

#### 예상 결과 ✅
```
사용자 A (먼저 락 획득):
- 응답: { "success": true, "orderId": 1001, "orderNumber": "ORD-260225-XXXXX" }
- DB 상태:
  - products.stock = 0
  - products.reserved_stock = 1
  - orders.status = 'pending'

사용자 B (락 실패):
- 응답: { 
    "success": false, 
    "error": "죄송합니다. 방금 상품이 모두 판매되었습니다."
  }
- DB 상태: 변경 없음
```

#### 검증 포인트 ⭐️
```sql
-- 1. 재고 확인 (음수가 아니어야 함)
SELECT id, name, stock, reserved_stock 
FROM products 
WHERE id = 999;
-- 예상: stock = 0, reserved_stock = 1

-- 2. 주문 확인 (1개만 생성되어야 함)
SELECT COUNT(*) 
FROM orders 
WHERE created_at > datetime('now', '-1 minute');
-- 예상: 1

-- 3. 원자적 업데이트 로그 확인
-- 콘솔에서 다음 로그 검색:
-- "[Order] ✅ Reserved stock for product 999: 1 units"
-- "[Order] ❌ Failed to reserve stock for product 999"
```

#### 결제 실패 시 롤백 테스트
```
1. 사용자 A가 결제 창을 닫거나 타임아웃 발생
2. 10분 후 자동 롤백 (또는 수동으로 /api/payments/rollback 호출)
3. DB 확인:
   - products.stock = 1 (복구됨)
   - products.reserved_stock = 0
   - orders.status = 'cancelled'
```

---

### 시나리오 4: 관리자 셀러 승인 플로우 (관리자) ✅

**목적**: 신규 셀러 가입 → 관리자 승인 → 셀러 활동 시작 전 과정 검증

#### 1단계: 신규 셀러 가입
```
1. https://live.ur-team.com/seller/register 접속
2. 셀러 정보 입력
   이메일: new_seller_002@test.com
   비밀번호: Seller1234!
   이름: 테스트 셀러
   전화번호: 010-1234-5678
3. "가입하기" 클릭
4. 가입 완료 메시지
```
**✅ 확인사항**:
- DB: `sellers` 테이블에 레코드 생성
- `status = 'pending'` (대기 상태)
- 로그인 불가 (승인 전까지)

#### 2단계: 사업자 정보 등록
```
1. 셀러 로그인 (승인 전이어도 로그인은 가능하도록 설정된 경우)
2. 좌측 메뉴 "사업자 정보" 클릭
3. 사업자 정보 입력
   - 사업자 유형: 개인사업자
   - 사업자등록번호: 123-45-67890
   - 상호명: 테스트 상점
   - 대표자명: 홍길동
   - 사업장 주소: 서울시 강남구...
4. "저장" 클릭
```
**✅ 확인사항**:
- `POST /api/seller/business-info` 호출
- `seller_business_info` 테이블에 데이터 저장
- `verification_status = 'pending'`

#### 3단계: 관리자 승인
```
1. 관리자 계정으로 로그인 (https://live.ur-team.com/admin/login)
2. 좌측 메뉴 "셀러 관리" 클릭
3. 상태가 "대기 중"인 셀러 목록 확인
4. "new_seller_002@test.com" 찾기
5. "승인" 버튼 클릭
6. 사업자 정보 탭에서 사업자등록증 검토
7. "사업자 정보 승인" 버튼 클릭
```
**✅ 확인사항**:
- `PUT /api/admin/sellers/:id/approve` 호출
- `sellers.status = 'active'`
- `PUT /api/admin/seller-business/:id/verify` 호출
- `seller_business_info.verification_status = 'verified'`

#### 4단계: 셀러 활동 시작
```
1. 셀러 계정으로 다시 로그인
2. 셀러 대시보드 정상 접근 확인
3. 상품 등록 기능 활성화 확인
4. 테스트 상품 1개 등록
5. 라이브 방송 생성 권한 확인
```
**✅ 확인사항**:
- 모든 셀러 기능 접근 가능
- API 호출 시 권한 에러 없음

---

### 시나리오 5: 에러 핸들링 & 복구 (전체) ✅

**목적**: 예외 상황 발생 시 시스템 안정성 및 사용자 경험 검증

#### 케이스 1: 재고 부족
```
1. 재고가 0인 상품 상세 페이지 접속
2. "구매하기" 버튼 클릭
3. 예상 동작:
   - "죄송합니다. 방금 상품이 모두 판매되었습니다." 메시지
   - 장바구니 추가 차단
```

#### 케이스 2: JWT 토큰 만료
```
1. 로그인 후 15분 경과 (액세스 토큰 만료)
2. API 호출 (예: 장바구니 추가)
3. 예상 동작:
   - 401 Unauthorized 응답
   - axios interceptor가 자동으로 `POST /api/auth/refresh` 호출
   - 새 액세스 토큰으로 원래 요청 재시도
   - 사용자는 중단 없이 계속 사용
```

#### 케이스 3: 결제 실패 (카드 한도 초과)
```
1. 정상적으로 주문서 작성
2. Toss Payments에서 결제 실패 시나리오
3. 예상 동작:
   - /payment/fail 페이지로 리다이렉트
   - "결제에 실패했습니다." 메시지
   - `POST /api/payments/rollback` 자동 호출
   - `products.reserved_stock` 감소 (재고 복구)
   - `orders.status = 'cancelled'`
```

#### 케이스 4: 네트워크 에러
```
1. 개발자 도구 → Network 탭 → Offline 체크
2. 상품 검색 시도
3. 예상 동작:
   - "네트워크 연결을 확인해주세요." Toast 메시지
   - 에러 바운더리로 감싸진 컴포넌트는 폴백 UI 표시
   - 앱 크래시 없음
```

#### 케이스 5: 관리자 권한 없는 접근
```
1. 일반 사용자 계정으로 로그인
2. URL 직접 입력: /admin
3. 예상 동작:
   - `verifyAdminSession` 미들웨어가 401 반환
   - 자동으로 /login으로 리다이렉트
   - "관리자 권한이 필요합니다." 메시지
```

---

## ⚠️ 미해결 과제 (Priority)

### 🔴 긴급 (Urgent) - 런칭 전 필수

| 번호 | 과제 | 현재 상태 | 해결 방법 | 예상 시간 |
|-----|------|----------|----------|----------|
| 1 | ⭐️ DB 마이그레이션 적용 | 파일 생성됨, 미적용 | `npx wrangler d1 migrations apply toss-live-commerce-db --remote` | 5분 |
| 2 | 재고 예약 만료 Cron 작업 | API만 구현됨 | Cloudflare Cron Trigger 설정 (매 5분마다 `/api/cleanup/expired-reservations` 호출) | 30분 |
| 3 | 프로덕션 환경변수 설정 | 일부 누락 가능성 | `TOSS_SECRET_KEY`, `KAKAO_REST_API_KEY`, `ALIMTALK_*` 확인 | 10분 |

### 🟡 높음 (High) - 런칭 후 1주일 이내

| 번호 | 과제 | 현재 상태 | 해결 방법 | 예상 시간 |
|-----|------|----------|----------|----------|
| 4 | 상품 변경 알림 UX | 폴링만 구현 | Toast + Fade 애니메이션 추가 (LivePageV2.tsx 수정) | 30분 |
| 5 | 재고 부족 알림 | 없음 | 재고 < 10 시 셀러에게 알림 전송 | 1시간 |
| 6 | 주문 필터링 | 기본 구현만 | 날짜, 상태, 금액 범위 필터 추가 | 2시간 |
| 7 | 채팅 메시지 저장 | 실시간만 가능 | Firebase → D1 DB 동기화 배치 | 3시간 |

### 🟢 중간 (Medium) - 런칭 후 1개월 이내

| 번호 | 과제 | 현재 상태 | 해결 방법 | 예상 시간 |
|-----|------|----------|----------|----------|
| 8 | 이미지 최적화 | 압축만 구현 | Cloudflare Images 또는 R2 + Worker 조합 | 4시간 |
| 9 | 모바일 앱 PWA 지원 | 기본 설정만 | manifest.json, service worker 강화 | 3시간 |
| 10 | 상품 리뷰 시스템 | 없음 | `reviews` 테이블 + CRUD API + UI | 8시간 |
| 11 | 셀러 정산 자동화 | 수동 처리 | 주간/월간 정산 자동 계산 + 알림 | 6시간 |

### 🔵 낮음 (Low) - 사용자 피드백 후 결정

| 번호 | 과제 | 현재 상태 | 해결 방법 | 예상 시간 |
|-----|------|----------|----------|----------|
| 12 | 쿠폰/할인 시스템 | 없음 | `coupons` 테이블 + 적용 로직 | 12시간 |
| 13 | 라이브 다시보기 | 없음 | YouTube 동영상 아카이브 연동 | 4시간 |
| 14 | 추천 알고리즘 | 없음 | 구매 이력 기반 상품 추천 | 16시간 |
| 15 | 관리자 대시보드 차트 | 기본 테이블만 | Chart.js 연동, 매출 그래프 | 6시간 |

---

## ✅ 런칭 체크리스트

### 필수 항목 (MUST) - 모두 완료해야 런칭 가능

- [ ] **DB 마이그레이션 적용**
  ```bash
  npx wrangler d1 migrations apply toss-live-commerce-db --remote
  # 예상 출력: Migrations applied successfully
  ```

- [ ] **재고 예약 시스템 테스트 통과**
  - [ ] 동시 주문 테스트 (재고 1개, 2명 주문)
  - [ ] 재고 오버셀링 없음 확인
  - [ ] 롤백 로직 동작 확인

- [ ] **결제 시스템 테스트 통과**
  - [ ] Toss Payments 연동 확인
  - [ ] 결제 승인 → 재고 확정
  - [ ] 결제 실패 → 재고 롤백

- [ ] **환경변수 설정 완료**
  ```bash
  # Cloudflare Workers 환경변수 확인
  npx wrangler secret list --name ur-live
  
  # 필수 변수:
  # - JWT_SECRET
  # - TOSS_SECRET_KEY
  # - TOSS_CLIENT_KEY
  # - KAKAO_REST_API_KEY
  # - ALIMTALK_SENDER_KEY
  # - ALIMTALK_PROFILE_KEY
  ```

- [ ] **핵심 테스트 시나리오 실행**
  - [ ] 시나리오 1: 전체 쇼핑 플로우 (회원가입~결제)
  - [ ] 시나리오 2: 셀러 라이브 제어
  - [ ] 시나리오 3: 재고 예약 동시성 테스트
  - [ ] 시나리오 4: 관리자 승인 플로우
  - [ ] 시나리오 5: 에러 핸들링

- [ ] **모바일 반응형 확인**
  - [ ] 메인 페이지
  - [ ] 상품 상세
  - [ ] 장바구니
  - [ ] 결제 페이지
  - [ ] 라이브 시청 페이지

- [ ] **보안 점검**
  - [ ] JWT 토큰 검증 로직 확인
  - [ ] SQL Injection 방어 (Prepared Statements)
  - [ ] XSS 방어 (입력값 검증)
  - [ ] CORS 설정 확인

### 권장 항목 (RECOMMENDED) - 런칭 후 빠르게 추가

- [ ] **모니터링 설정**
  - [ ] Cloudflare Analytics 활성화
  - [ ] 에러 로깅 (Sentry 또는 LogFlare)
  - [ ] 성능 모니터링 (Web Vitals)

- [ ] **백업 설정**
  - [ ] D1 Database 정기 백업 (Cloudflare 자동 백업 확인)
  - [ ] R2 이미지 백업

- [ ] **문서화**
  - [ ] API 문서 (Swagger/OpenAPI)
  - [ ] 관리자 매뉴얼
  - [ ] 셀러 가이드

---

## 🚀 런칭 결정 가이드

### GO 조건 (다음 항목이 모두 충족되면 런칭 가능)

✅ **필수 항목 체크리스트 100% 완료**
✅ **5개 핵심 테스트 시나리오 모두 통과**
✅ **재고 예약 시스템 동작 확인**
- 동시 주문 시 오버셀링 없음
- 결제 실패 시 롤백 정상
- 만료 예약 자동 정리 동작

✅ **결제 시스템 정상 작동**
- Toss Payments 연동 성공
- 테스트 결제 → 실제 결제 전환 확인

✅ **보안 취약점 없음**
- JWT 검증 통과
- SQL Injection 방어
- XSS 방어

### STOP 조건 (다음 항목 중 하나라도 해당되면 런칭 연기)

❌ **DB 마이그레이션 미적용**
- 프로덕션 DB에 `reserved_stock` 컬럼 없음
- `reservation_expires_at` 컬럼 없음

❌ **재고 오버셀링 발생**
- 동시 주문 테스트에서 `stock < 0` 발생
- 2개 이상 주문 생성됨

❌ **결제 시스템 에러**
- 결제 승인 실패
- 롤백 로직 미작동
- 알림톡 발송 실패 (치명적)

❌ **보안 이슈**
- JWT 토큰 검증 우회 가능
- SQL Injection 취약점 발견
- 민감 정보 노출 (API 응답에 비밀번호 해시 포함 등)

❌ **핵심 기능 장애**
- 라이브 시청 불가
- 장바구니 추가 실패
- 로그인 불가

---

## 📊 런칭 후 모니터링 지표

### 비즈니스 지표
- 일간 활성 사용자 (DAU)
- 라이브 방송 시청 시간
- 전환율 (시청 → 구매)
- 평균 주문 금액 (AOV)
- 재구매율

### 기술 지표
- API 응답 시간 (P50, P95, P99)
- 에러율 (< 1% 목표)
- 재고 예약 실패율 (< 5% 목표)
- 결제 성공률 (> 95% 목표)
- Cloudflare Workers CPU Time (< 50ms 목표)

### 알림 설정 (Critical)
- 재고 오버셀링 발생 시 즉시 알림
- 결제 실패율 > 10% 시 알림
- 라이브 방송 중단 시 알림
- DB 응답 시간 > 1초 시 알림

---

## 📞 지원 및 문의

### 기술 지원
- GitHub: https://github.com/tobe2111/ur-live
- 배포 URL: https://live.ur-team.com
- 관리자 패널: https://live.ur-team.com/admin/login

### 긴급 연락처
- 개발 팀: (긴급 상황 시 연락처 추가)
- 인프라 팀: Cloudflare Support

---

## 🎯 마무리

이 문서는 **유어라이브 (UR LIVE)** 서비스의 전체 기능 명세 및 테스트 가이드입니다.

### 핵심 요약
- **총 80개 기능** (일반 27, 셀러 23, 관리자 18, 시스템 12)
- **192개 API 엔드포인트**
- **5개 핵심 테스트 시나리오**
- **⭐️ 재고 예약 시스템 (비관적 락)** - 동시 주문 레이스 컨디션 방지

### 런칭 전 필수 작업
1. ✅ DB 마이그레이션 적용 (5분)
2. ✅ 환경변수 확인 (10분)
3. ✅ 5개 테스트 시나리오 실행 (1시간)
4. ✅ 모바일 반응형 확인 (30분)
5. ✅ 보안 점검 (30분)

**예상 소요 시간**: 약 2시간

---

**작성일**: 2026-02-25
**버전**: 1.0.0
**작성자**: GenSpark AI Assistant
**문서 상태**: 최종 검토 완료 ✅
