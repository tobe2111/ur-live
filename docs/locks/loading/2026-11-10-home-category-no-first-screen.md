# [UNLOCK_LOADING] 2026-11-10 — 홈 `?category=` 에서는 서버가 "전체" 홈 첫 화면을 그리지 않는다 (대표 "계속 최적화")

라이브 실측(폰 4G · CPU 4배): `/?category=meal_voucher` **CLS 0.83**(`/meal-vouchers` 리다이렉트와 홈 칩·링크가 이 주소를 쓴다). `?sort=`·utm 은 0.0001.

## 원인
워커의 폰 홈 첫 화면 분기는 쿼리를 안 봤다 → 전체 홈(지역 사진 머리 + 첫 섹션 카드)을 그렸다. 앱(`MobileHomePage`)은 카테고리를 고르면 그 편성을 숨기고 카테고리 목록을 맨 위에 올린다 → 마운트 때 화면이 통째로 바뀐다.

## 잠금표 접촉
`src/worker/index.ts` HTMLRewriter SSR inject 블록 — 폰 홈 분기 조건 끝에 `&& !homeCategoryOf(url.search)` 한 토막 + import 한 토막(같은 줄, 2672줄 유지). 그 주소에서는 첫 화면이 **빠진다**(로더 → 앱)이라 "약화" 에 해당해 `[UNLOCK_LOADING]` 으로 적는다. 대표의 상시 승인("계속 최적화" · 로딩 밀림 수리) 범위. 전체 홈·`?category=all`·`?sort=`·추적 쿼리는 종전 그대로 그린다. PC 홈은 이미 `!url.search` 조건이라 해당 없음.

## 내용
`shared/home-query.ts` — 카테고리 목록 SSOT + `homeCategoryOf(search)`. 화면 훅(`useHomeQuerySync`)이 같은 목록을 읽는다(한쪽만 늘면 새 카테고리에서 다시 밀린다).

## 잃는 것 / 못 보는 것
그 주소의 첫 글자는 서버 첫 화면(≈0.5s)에서 로더 뒤(≈2s)로 늦어진다 — 틀린 그림을 보여 주고 통째로 바꾸는 것보다 낫다는 판단이고, 다음 처방은 카테고리 화면 자체의 서버 첫 화면이다(미착수). 실제 밀림 수치는 배포 뒤 라이브로 잰다.

## 가드
`home-category-first-screen-2026-11-10.test.ts` 5건 · 주입 4건(둘은 반대 방향).
