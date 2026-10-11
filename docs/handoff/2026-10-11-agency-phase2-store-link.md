# 2026-10-11 에이전시 2단계 — 매장 연결 (PR-B)

서비스: 🎟️ 유어딜(소비자 셀러 쪽) — 도매·공구 서비스·유어애즈 무접촉.
머니 경로: **없음**(운영 권한만. 에이전시 몫·정산 분기는 3단계).
결정: `docs/decisions/2026-10-11-agency-model-email-only.md` (대표 *"다음 단계 먼저 영구적이고 이상적으로 해줘"*).
앞 단계: `docs/handoff/2026-10-11-agency-phase1-accounts.md` (PR #1695 머지 `5f62684`).

## 다음 세션의 첫 액션
1. 이 PR 의 CI 확인 → 대표가 머지 지시하면 머지.
2. 배포 뒤 E4: 테스트 에이전시 하나 + 테스트 매장 하나로
   사장님 `셀러 → 운영자 관리 → 에이전시에 맡기기` → 에이전시 `/agency` 에서 수락 → `[운영하기]` → 셀러 화면 상단 "에이전시로 운영 중" 띠 →
   사장님이 끊기 → 에이전시 직원 화면의 다음 요청이 401(`STORE_SEAT_REVOKED`)인지.
   ⚠️ 라이브엔 메일 키(`RESEND_API_KEY`·`RESEND_FROM`)가 없어 에이전시 **가입** 자체가 503 으로 멈춘다(1단계 인계 참조) — E4 전에 대표가 키를 넣어야 한다.

## 무엇을 만들었나
- 테이블 `agency_store_links`(agency_id, seller_id, status pending/active/declined/ended, 요청자·결정자·끊은 쪽). 행은 지우지 않는다.
  **한 매장 한 에이전시** = 부분 UNIQUE `(seller_id) WHERE status IN ('pending','active')`.
- 사장님(`/api/seller`, 현재 매장 소유자만): `GET /agency-link` · `POST /agency-link {email}`(에이전시 **관리자** 이메일만) · `POST /agency-link/end`.
- 에이전시(`/api/agency-console`): `GET /stores`(모든 직원) · `POST /stores/:linkId/accept|decline|release`(관리자) · `POST /stores/:sellerId/seat`(모든 직원).
- 좌석 토큰 = 기존 셀러 토큰 모양(`type:'seller'`) + `agency_staff_id`·`agency_id`·`store_role:'operator'`, 7일.
  `store-seat-guard.verifyStoreSeat` 가 매 요청 (맡김 active · 직원 active · 에이전시 active · `iat >= tokens_valid_after`)을 본다.
- 화면: 에이전시 홈 "맡은 매장"(요청 수락/거절 · 운영하기 · 내려놓기) · 셀러 화면 "에이전시로 운영 중" 띠(`AgencySeatBar`, 토큰 claim 으로 판정) · 사장님 `AgencyLinkCard`(운영자 관리 화면).

## 🔐 가장 중요한 것 — 에이전시 직원은 사장님으로 되짚히지 않는다
셀러 쪽엔 "토큰에 사람이 없으면 `linked_user_id`(매장 주인)로 본다" 는 폴백이 여러 곳에 있다. 에이전시 좌석엔 소비자 사람이 없다.
막은 자리: `resolveTokenActorUserId`(null) · `resolveStoreActor`(claim 만으로 isOwner false · isAgency) · 카카오 봇 연결(거절) ·
협업 코드 발급자(주인 id 대신 매장 id) · `/my-stores`·`/summary`(맡은 매장 하나로 답 — 401 이면 셀러 화면이 로그아웃시킨다) ·
카카오 연동 권유 배너(미노출) · 진입 시 그 브라우저의 다른 셀러 refresh 토큰 삭제.

## 🩸 이번에 찾은 기존 구멍 (같이 고쳤다)
`POST /api/seller/switch-to-user` 가 **매장 토큰만 보고 사장님의 소비자 세션 쿠키를 발급**했다. 위임받은 운영자(중개사)가 이 호출 하나로
사장님 카카오 계정이 될 수 있었다(프론트 호출 0이라 아무도 몰랐다). 이제 토큰의 사람 == `linked_user_id` 일 때만.

## 이 단계에 없는 것
- 직원별 매장 배정(지금은 그 에이전시 직원 누구나 맡은 매장 전부) — 필요하면 다음.
- 에이전시가 직접 매장을 등록(`/store/new` brokered)하는 길 · 기존 중개사 매장 4곳 이관 · 몫 규칙 1~3 · 정산 분기 = 3단계(머니).
- 셀러 화면 안의 "중개사" 라벨 → "에이전시" 이름 바꾸기.

## 검증
- `agency-stores-2026-10-11.test.ts` 24건 — 실제 라우트·실제 JWT·실제 SQLite(맡기기→수락→좌석→끊기/내려놓기/직원 내보내기/에이전시 정지 각각 401, 폴백 거절).
- 주입 9건 추가(전부 빨간불 확인) · `agency-sunset-final` 허용 목록 재고정(마운트 셋 · 옛 테이블 검사는 폴더 전체로).
- 기존 셀러 좌석 관련 51파일 802건 통과(`seller-d3` 단언 1건 재조준 — 판정이 `resolveStoreScope` 로 모였다).

## 이번에 틀렸던 판단
- 처음엔 에이전시 좌석 판정을 `verifyStoreSeat` 결과(`live`)에 기대려 했다. 그러면 D1 이 흔들리는 순간 `unknown` → 아래 폴백으로 샌다.
  ⇒ 소유자 판정·카카오 봇은 **claim 만으로** 거절한다.

## 🔗 추가 — 매장 초대 링크 (대표 *"응 링크 방식도 넣어줘. 그리고 가장 전체적으로 이상적인 형태를 찾아봐줘"*)
- 테이블 `agency_store_invites`(토큰 원문 저장 — 들고 있는 사람에게 권한을 주지 않아서 관리자가 언제든 다시 복사하게). 에이전시당 살아 있는 링크 하나 · 30일.
- 에이전시 `GET/POST /api/agency-console/store-invite` · `POST /store-invite/revoke`(관리자).
- 사장님 `/store/agency/:token`(로그인 필수 라우트) → `GET /api/store-agency-invite/:token` · `POST /api/store-agency-invite/accept`.
  경로를 `/api/seller/*` 밖에 둔 이유: 공용 axios 가 seller_token 을 붙이면 회수된 토큰이 전역 가드 401 → 셀러 로그아웃을 부른다.
  소유 판정 = 소비자 세션 쿠키 하나 · CSRF(`csrfProtection`)를 라우트보다 먼저 건다.
- 링크 수락 = 바로 active(링크를 만든 것이 에이전시의 수락). 같은 에이전시 대기 요청이 있으면 수락으로 올린다. 다른 에이전시면 409.
- 시험 +7(총 31) · 주입 +5(전부 빨간불 확인).
- 전체 그림: `docs/design/agency-ideal-shape-2026-10-11.md` · 판단 대기: `docs/decisions/2026-10-11-agency-ideal-open-questions.md`(개인 중개 길을 에이전시로 일원화할지).
- **다음 권하는 작업(머니 무관)**: 어드민 에이전시 목록·정지(지금 정지 버튼이 없다) → 사장님용 "에이전시 활동 기록" → 사업자 진위확인.
