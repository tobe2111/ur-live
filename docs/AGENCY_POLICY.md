# 에이전시 운영 정책 (2026-05-21 정착)

이 문서는 에이전시 ↔ 가게 ↔ 셀러 ↔ 플랫폼 관계의 운영 규칙을 정의합니다.
**기술 부채 / 사고를 막기 위한 영구 정책** — 변경 시 INCIDENTS.md 에 사유 기록.

## 1. 에이전시 lock-in (가게 영업권)

### 규칙
- **한 가게 = 한 에이전시 lock-in**
- 가게 (store_owner 셀러) 가입 시 `agency_intro_code` 입력 → 영구 commission 수령자 확정
- `sellers.introduced_by_agency_id` 컬럼이 lock-in 의 single source of truth

### 변경 제한
- 가입 후 `introduced_by_agency_id` **불변 (immutable)**
- 어드민이 강제로 재배정해야 할 때: `/admin/sellers/:id/reassign-agency` endpoint 사용 + 감사 로그 필수
- 6개월 이상 무활동 에이전시는 자동 unlock (별도 cron 으로 처리, 미구현 시 추가)

### 충돌 방지
- 같은 가게에 여러 에이전시 영업 시도 시:
  - 가게가 가입한 시점의 `agency_intro_code` 가 우선
  - 다른 에이전시는 후속 컨택해도 commission 분배 불가
  - 가게 사장님 분쟁 호소 시 → 어드민 reassign 가능 (감사 로그 + 사유 필수)

## 2. 셀러 (인플루언서) ↔ 가게 매칭

### 셀러 책임
- 트래픽 + 콘텐츠 (라이브, 숏폼, 링크 공유)
- 본인 라이브에서 가게 상품 판매 → 매출 commission 수령 (위탁 판매 3자 분배)
- **가게 영업 책임 없음** (영업 활동해도 commission 보너스 없음)

### 위탁 판매 3자 분배
- 가게 (공급자): 매출의 60%
- 셀러 (판매자): 매출의 25%
- 플랫폼: 매출의 15%
- (비율은 `platform_settings.consignment_*_rate` 에서 조정)

## 3. 카테고리별 표준 플로우

### 식사권 / 뷰티 / 헬스 / 펫 (즉시 사용형)
1. 셀러 라이브에서 공구 시작 (목표 인원 + 마감일)
2. 유저 선결제 → 바우처 (QR + PIN) 즉시 발급
3. 유효기간 내 매장 방문 (예약 없음)
4. 사장님이 QR 스캔 / PIN 확인 → `used` 처리
5. 자동 정산

### 숙소 / 액티비티 (예약 필수형)
1. 셀러 라이브에서 공구 시작
2. 유저 선결제 → 바우처 발급 (체크인 코드 포함)
3. **유저가 `external_booking_url` 또는 매장 직접 연락으로 날짜 픽스**
   - `products.external_booking_url` 컬럼이 있으면 사용자에게 바로 링크 노출
   - 없으면 매장 전화번호 노출 (`restaurant_phone`)
4. 체크인 시 코드 제공 → 사장님 확인
5. 자동 정산

### 결정 원칙 (2026-05-21 갱신)
- 한국에 universal 예약 API 부재 (네이버 예약 폐쇄, 야놀자 B2B만)
- **시간 슬롯 기반 자체 예약 캘린더 구축** (뷰티/액티비티/건강/펫)
- 숙소는 기존 `stay_bookings` (날짜 기반) 유지
- 식사권은 예약 불요
- `products.external_booking_url` 은 fallback (자체 시스템 미사용 시)

### 자체 예약 시스템
- 테이블: `product_booking_slots` (요일별 패턴) + `appointment_bookings` (실제 예약)
- atomic INSERT WHERE — race condition 0
- UNIQUE constraint — 같은 유저 중복 예약 차단
- 12시간 이내 취소 시 환불 불가 (admin override 가능)
- 예약 확정 시 매장 + 유저 양쪽 알림톡 자동

## 4. 부트스트랩 (초기 3개월)

### Phase 0 (월 1-2): 운영자 직접
- 운영자 본인이 첫 5-10개 매장 직접 확보 (당신 지역 식당부터)
- 매장 사장님께 "지인 인플루언서 1명씩 추천" 요청
- 첫 셀러 5명 확보

### Phase 1 (월 3-4): viral loop 발동
- 가게가 친구 가게 → `agency_invite` flow 활용
- 셀러가 친구 셀러 → 3단계 referral commission (1=10% / 2=3% / 3=1%)

### Phase 2 (월 5+): 에이전시 영입
- 첫 에이전시 3-5명 직접 영입
- 에이전시 commission 구조 (가입 보너스 ₩30,000 + GMV 2% 영구) 강조
- 지역 단위 에이전시 (강남/성수/부산 등)

## 5. 정책 위반 / 우회 차단

### 자동 차단 (코드 레벨)
- 같은 가게에 여러 에이전시 등록 INSERT 시도 → SQL constraint 또는 application-level 차단
- `introduced_by_agency_id` UPDATE 직접 호출 금지 — admin reassign endpoint 만 허용

### 수동 감시
- `admin_audit_log` 에 reassign 이벤트 기록
- 월 1회 운영자가 reassign 이력 리뷰

## 6. 관련 코드 / 테이블

| 항목 | 위치 |
|---|---|
| 가게 가입 + agency_intro_code | `src/features/seller/api/seller-registration.routes.ts:196` |
| sellers.introduced_by_agency_id | `sellers` 테이블 (repair-schema 에서 ALTER) |
| 에이전시 introduced stores | `src/features/agency/api/agency-introduced-stores.routes.ts` |
| 3단계 referral commission | `src/features/referral/api/referral-tree.routes.ts` |
| 위탁 판매 3자 분배 | `platform_settings.consignment_*_rate` |
| 외부 예약 링크 | `products.external_booking_url` (2026-05-21 추가) |
