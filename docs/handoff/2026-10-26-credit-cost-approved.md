# 2026-10-26 — 생활 견적 참여권 장수 적용 · 서버 접속 결재 반려 · 수집 수리 판정

## 대표 결정 (그대로)
- *"큰 일은 참여권 더 받자."* → 안 2: 가게 인테리어 5장 · 집 인테리어 5장 · 간판 3장 · 나머지 1장.
  라이브 `platform_settings.home_service_credit_cost` = `{"store_interior":5,"home_interior":5,"signage":3}`
  (어드민 `PUT /api/admin/home-service/credit-costs` 3회 → `GET` 으로 확인). 코드 변경 없음.
- *"서버 접속 관련으로는 안할거야."* → `2026-10-20-korea-edge-routing` rejected(안 1 유지).
- 두 결재 문서 → `docs/decisions/archive/`, 코드 주석의 경로 갱신.

## 테스트 업체 (대표 요청 "tobe2111 계정으로 만들어 볼 수 있나")
- 그 계정 = `users.id=3` 정지원(DB 이메일은 `tobe2111@kakao.com`). 매장 14·20·25·26 의 **operator** 이고 owner 좌석은 없다.
- 생활 업체 가입은 `POST /api/home-service/pro/signup` 이 **그 사람의 카카오 세션**을 요구한다 — 세션은 어드민 자격으로
  못 만든다(대리 가입은 약관 동의를 대신 찍는 일이라 만들지 않았다). ⇒ 대표가 폰에서 `/life/pro` 로 직접 가입해야 한다.
  owner 좌석이 없으므로 **새 매장(pending)** 이 생긴다 — 심사 전에도 견적은 낼 수 있다.
- 🔎 같은 이유로 **환급 시트의 [가게 정산 계좌]는 대표 계정에선 안 뜬다**(그 기능은 owner 가게만 본다).
  E4 는 owner 좌석이 있는 사장님 계정으로 해야 한다.

## 수집 수리 판정 (2026-10-25 write-budget 인계의 첫 액션)
- ① neis: 최근 12회차 `n` 0~101 vs `f` 13~8,000 → **saved < found**(수리 전엔 같았다). read-budget top 은 이제 `reclassify-company:16`.
- ② 통신판매 detail: 커서 47 → **68** 전진 · `by_service.detail` 생김 · `brno` 100%(ⓐ 통과) · 한글 품목 `ntslPrdlstCn` 20%(ⓑ 통과).
  구체 업종 1,604행 / 424,356 — 남은 병목은 처리 속도(시간당 1페이지)와 detail 레코드의 품목 보유율 20%.

## 에이전시 콘솔 판(안 G)
손대지 않았다. 콘솔은 자기 이용권만 다루고 사용처리·주문·정산이 없어 안 G(사용처리 칸)가 맞지 않는다 —
`agency-console-plate-2026-10-12.test.tsx` ④ 주석이 그 판단을 적어 뒀다. 대표 지시가 오면 그때.

## 틀렸던 판단
- 에이전시 콘솔 정리를 "바로 할 수 있다" 고 보고했다 — 인계를 다시 읽으니 의도된 차이였다.
