# 2026-10-20 생활(이사·청소) 카테고리 신설

대표: *"유어딜에 식당, 숙소 말고도 이사, 청소 등의 서비스도 넣고싶어. 데모 데이터 넣는 것도"* → 제안(청소·에어컨=정찰가 이용권, 이사=할인권) → *"응 그렇게 해줘."*

## 완료
- `home_voucher`(라벨 '생활') — SSOT `src/shared/constants/voucher-categories.ts`
- SQL 손 목록 14곳 → `VOUCHER_CATEGORY_SQL_IN` (구매 경로 `group-buy.routes` 2곳 포함)
- 소비자 칩: 홈(`deal-cats`)·PC 레일·지도(`voucher-types`)·숙소·지역·라이브 티커 / 아이콘 `HomeServiceLineIcon`(+지도 마커 거울)
- 셀러 등록·상품 수정·어드민 동네딜 도구·데모 생성 업종 3종(입주청소·에어컨청소·포장이사), 이사는 `fixed`(할인율 0, 1,000원 할인권)
- 홈 칩 예열 1경로 추가(`cache-prewarm` HOT_PATHS), 피드 퍼지 경로 추가
- 6개 언어 키 `map.voucher.home`, `seller.voucher.categoryHome(+Desc)`
- 가드 `home-service-category-2026-10-20.test.ts` + 주입 5건(전부 빨간불 확인)

## 다음 세션의 첫 액션
1. 배포 뒤 데모 생성: 어드민 `/admin/dongnedeal-import` → 카테고리 '생활 (이사·청소)' · 9개 · **오픈 예정형(prelaunch)** 권장
   (API `POST /api/admin/products/dongnedeal/seed-demo` `{category:'생활',count:9,mode:'prelaunch'}`).
   데모 규칙상 카카오 **실제 업체**에 매칭된다(2026-07-03 대표 "데모는 실제 있는 매장이어야"). prelaunch 면 리뷰 없이 '오픈 협의 중' 문구가 붙는다.
2. `urdeal.kr/?category=home_voucher` 칩·지도 '생활' 칩에 9개가 뜨는지 확인(E4).

## 남은 것
- 🔒 `group-buy-public.routes.ts`(로딩 잠금) 손 목록 3곳 — 라이브 티커·진단 SQL 이 생활 구매를 안 센다. 대표 승인 뒤 SSOT 로.
- 결제 직후 '이사 고객 패키지' 노출 · 이사 날짜 기반 알림톡(발송 = 결재 C).

## 틀렸던 판단
- 제안 때 "데모에 실제 업체명 안 씀"이라 했는데, 데모 생성 규칙이 실업체 매칭을 강제한다(대표 07-03 확정). 대신 **prelaunch 모드**로 '오픈 협의 중'을 밝히는 쪽으로 정리.

## 후속 (같은 날)
- PR #1966 머지(`e7ea3ad`) · 배포 완료 · 라이브 `category=home_voucher` 인식 확인.
- 데모 9개 생성(어드민 `POST /api/admin/dongnedeal/seed-demo` `{category:'생활',count:9,mode:'prelaunch'}`) → id 2921~2929, 실사진 8/9, 전부 좌표·주소 있음.
  - ⚠️ 카카오 상호가 그냥 "입주청소" 인 곳이 2건(2922·2925) — 업종명이 상호인 업체. 거슬리면 어드민 동네딜 목록에서 개별 삭제.
- 💰 대표 확정 *"20% 받자. 생활은."* — 하청이 아니라 **중개 + 수수료 20%**. 지금 생활 파트너 셀러 0곳이라 적용할 대상이 없다.
  파트너가 들어오면 어드민에서 그 셀러의 매장별 수수료를 20% 로 설정한다(기존 기능, 코드 변경 없음).
  카테고리 단위 자동 요율이 필요해지면 머니 경로 작업(단독 세션 + staging 실결제).
