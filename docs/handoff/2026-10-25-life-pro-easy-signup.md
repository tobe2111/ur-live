# 2026-10-25 · 생활 업체 — 심사 중에도 견적 · 한 화면 가입

대표: *"1번은 해줘. 일단 생활 관련 업체는 가입 쉽게 할 수 있도록 해줄래? 2번은 생활 카테고리만 그런거지? 그렇다면 그렇게 해줘. 업체 모집이 중요하기 때문에"*

## 한 것
- **심사 중(pending) 업체도 견적** — 매칭·업체 수·보관 요청·견적 보내기의 상태 판정을 `proStatusOpen`(shared/home-service.ts) 하나로. 막는 것은 정지·반려뿐.
- **`사업자 인증` 표시** — 손님 견적 카드(`LifeRequestDetailPage`)에 승인·활성 업체만. 값은 서버 `verified`.
- **한 화면 가입** `POST /api/home-service/pro/signup` (`home-service-pro-signup.ts`) — 카카오 세션만으로 [상호 · 하는 일 · 지역 · 알림 번호 · 약관]. 내 가게가 이미 있으면 그 가게를 쓴다. 새 매장은 `pending` + `seller_meta.life_pro_signup=1` + 주인 좌석 → 화면이 `enterStoreSeat` 로 좌석에 앉는다.
- 검증·저장 SSOT `home-service-pro-profile.ts`(`PUT /pro/me` 와 가입이 같이 씀).
- 랜딩에서 `/store/new`(이용권 가게 등록) 안내 제거.

## 그대로 둔 것 (반대 방향)
- 이용권 판매·메인 노출은 승인 매장만(`approvedSellerProductSql`).
- 제휴 업체 지정·제휴 알림은 승인 매장만.
- 참여권 충전 게이트(`home_service_charge_enabled`)는 그대로 OFF.

## 다음 세션 첫 액션
- 배포 뒤 라이브: 새 카카오 계정으로 `/life/pro` → 가입 → 무료 참여권 3장 · 요청함이 뜨는지(E4). 어드민 매장 목록에 `life_` 로 시작하는 pending 매장이 생기는지.
- 운영 지표: 미인증 업체 견적 비율, 선택률 차이(인증 vs 미인증).

## 틀린 판단
- 없음(이번 변경은 대표 지시 그대로).
