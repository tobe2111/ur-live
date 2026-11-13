# 2026-11-13 — 결제 0건 원인 찾기 1차: 퍼널 숫자부터 바로잡기

대표: *"응응"*(결제 0건 원인 찾기) → *"응 해봐"*(① 로그인 흐름 ② 자동 방문 걸러내기). 서비스: 유어딜(소비자). 머니 경로 없음.

## 실측 (메인 D1, 2026-11-13)
- 30일: app_open 2,625명 → login_wall_shown 34명(이용권 화면 `/pass/*` 에서는 약 7명) → checkout_started 1 → 결제 0.
- 전기간: login_wall_shown 230 · **login_succeeded 0**(8월부터) — 계측 고장. 실제 로그인은 서버 콜백 → `?login=success`
  → `auth-callback-bootstrap.ts` 로 끝나는데 계측은 안 쓰이는 `KakaoCallbackPage` 에만 있었다.
- 유입(`inflow_clicks`) 251건 = 251 명의 '새 방문자', ref_id 3(대표) · 착지 `/u/jiwon1228` 가 거의 전부.
  유어샵을 열면 주인을 소개자로 심는 구조라(`CuratorPage` → `storeAffiliateRef`) **유어샵 방문**이 '인플루언서 유입' 으로 집계된다.
  자동 브라우저 판정이 없어 점검 스크립트(Playwright, 회차마다 새 브라우저)가 매번 새 방문자로 찍혔을 가능성이 크다.

## 고친 것
- 로그인 성공: bootstrap 이 `sessionStorage.ur_login_ok_pending` 표식 → App 의 app_open 자리가 `login_succeeded` 전송(신규 가입이면 `{new:1}`).
- `navigator.webdriver === true` 면 퍼널(`lib/funnel.ts`)·유입(`affiliate-track.ts fireInflowClick`) 모두 안 보낸다.
- 가드 `funnel-login-and-bots-2026-11-13.test.ts` 3 + 주입 3.

## 🩸 틀린 판단
- 전날 대표에게 "인플루언서 링크 클릭 108명, 결제 0" 이라고 보고했다 — 그건 **유어샵 방문**(대부분 대표 본인 유어샵)이었다.
  `inflow_clicks` 이름을 믿고 의미를 확인하지 않았다.

## 이어받는 세션의 첫 액션
- 배포 하루 뒤: `SELECT event, COUNT(*) FROM funnel_events WHERE created_at > <배포시각> GROUP BY 1` — `login_succeeded` 가 0 이 아니게 찍히는지,
  `login_wall_shown` 대비 비율. `inflow_clicks` 하루 증가가 크게 줄었는지(자동 방문 제외 효과).
- 그 다음 단계: 이용권 상세 → 구매 누름 비율(2주 ~280 조회 중 로그인 벽 ~7) 개선 시안.

## 후속 (같은 날, 대표 *"계속 해"*)
- 숙소 예약도 다른 기기 결제 소개 성과(`stay-referral.ts unifiedStayReferrer` 가 계정 기록 먼저 — 결재 2026-11-12 범위).
- 로그인 벽 → 돌아오면 그 수량으로 구매 창(대표 "응, 고쳐줘"): `/pass/:id?via=login&qty=N` · 보존 키 프론트/서버 둘 다.
  로그인 화면에 '사던 중인 이용권' 보여주기는 대표 "아니, 지금대로" — 하지 말 것.
- 관찰(손님 시점 캡처): 이용권 2919 할인율 11%(35,000→31,000) — 제안 매력 자체가 약할 수 있다. 다음 판단 재료.

## 영구 해결 (대표 *"영구적으로 해결해"*)
- 로그인 왕복의 **복귀 주소 규칙을 한 파일로**: `src/shared/login-return-query.ts`(보존 꼬리 화이트리스트 + 차단 경로 판정).
  프론트 `safe-internal-path.ts` 와 워커 `kakao.routes.ts safeRedirect` 가 둘 다 import — "양쪽 같이 갱신" 주석으로 묶인 복사본 두 벌이
  2026-09-20(매장 코드)·2026-11-13(구매 수량) 두 번 갈렸다. 이제 갈릴 수 없다.
- 가드: 두 파일이 공용 파일을 import 하고 자기 복사본(목록·차단 경로)을 두지 않는다 + 같은 입력에 같은 답(6 사례). 주입 2(복사본 부활 · 공용 규칙 훼손).
