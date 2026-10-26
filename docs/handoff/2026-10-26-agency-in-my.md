# 2026-10-26 에이전시를 마이 안으로 (안 A) — 1단계

## 다음 세션의 첫 액션
2단계(카카오 에이전시)부터: `agency_staff` 에 `user_id` 를 붙이고(UNIQUE where not null), 카카오 손님 세션 →
에이전시 토큰을 주는 엔드포인트, 마이 "에이전시 만들기"(혼자 쓰는 계정 안내 문구는 시안 그대로), "이메일 계정으로 옮기기"
(이메일 인증 + 비밀번호). 시작 전에 **10-11 결정 문서**(`docs/decisions/2026-10-11-agency-model-email-only.md`)의
*"카카오로는 에이전시를 만들 수 없다"* 아래에 10-26 대표 말씀을 그대로 옮겨 적을 것.

## 완료 (이 PR)
- 마이 '에이전시' 구역: `pages/user-profile/MyAgencyZone.tsx`(에이전시 로그인 있을 때만 lazy) → `pages/agency-console/AgencySection.tsx`
  - '내 가게' 바로 아래(폰·PC). 마이 칸이 좁아 `stacked`(한 칸)로 그린다.
- 이메일 전용(손님 로그인 없음): `/user/profile` 의 guest 자리에 `AgencyMyPage`(`routes/agency-console.routes.tsx` `AgencyAwareGuest`).
  공용 `ProtectedRoute`(잠금 파일)는 무접촉.
- `/agency` → 마이로 보내는 문(`AgencyHomePage`). 깊은 링크 `?tool=` 는 마이에서 **`?atool=`**(마이의 `?tool=` 은 사장님 판이 쓴다).
  `sellerEntryRedirect` 는 그대로 `/agency?tool=` 로 보내고 이 문이 이어 준다(테스트·주입 앵커 무변경).
- 에이전시 콘솔 부품 9개에 `dark:` 대응(마이는 다크 토글이 있다). `pages/agency-console/` 는 대시보드 다크 금지 목록 밖이다.
- 가드: `agency-in-my-2026-10-26.test.tsx` 11건 + 주입 4건 빨간불 확인. 재조준: `agency-sunset-final`(화면 모듈 +1) · `agency-console-plate`(넓은 폭 = AgencyMyPage).
- 렌더 확인(합성 응답): 이메일 전용 마이 폰·다크·PC.

## 이번에 틀렸던 판단
- 시안 초안에 *"에이전시 몫은 에이전시에 쌓여요"* 라고 썼다 — 3단계(머니)는 아직이고 몫은 매장이 직접 보낸다(`agency-share.ts`). 게시 전에 "성과와 몫은 에이전시 단위로 잡혀요" 로 고쳤다.

## 못 잰 것
- 카카오 손님 + 에이전시 로그인이 함께 있는 마이(하네스가 두 신원을 동시에 못 심는다) — 배치는 시험이 고정.
- 라이브(로그인 필요). E4: 에이전시 이메일 로그인 → 마이 도착 · 알림 링크 `/agency?tool=` → 마이에서 그 화면이 열리는지.

## 남은 결정
- 없음(2단계 범위는 대표 확정).
