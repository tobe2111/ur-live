# 2026-11-04 에이전시 첫 화면 안 A + 비밀번호 바꾸기 · 문의 · 로그아웃 · 유어샵 탭 안내

대표: *"들어오면 너무 뭐가 없이 나온다"* → 시안 A/B/C → *"A로 하자. 그리고 남은 1,2,3도 다 해줘."*
레일: 공구 서비스(에이전시 마이). 머니 경로 없음. 롤백 revert. 시안: `docs/design/agency-first-screen-2026-11-04.md`.

## 완료
- `AgencyGettingStarted`(시작 3단계) — `AgencyStoresPanel` 의 `firstRun`(토스 판 · 운영 매장 0 · 관리자)
- `POST /api/agency-console/me/password`(`agency-password.routes.ts`, `agencyStaffRoutes` 에 끼움) + `AgencyPasswordPanel`
- 에이전시 전용 마이 설정: 비밀번호 바꾸기 · 문의하기 · (손님으로도 쓰기 · 테마) · 로그아웃 맨 아래(`hideLogout`)
- 손님 유어샵 화면 맨 아래 '에이전시 매장 관리는 마이에서'(BottomNav 잠금 무접촉)
- 가드 `agency-first-run-2026-11-04.test.tsx` 15건 · 주입 4건 빨강 확인 · `agency-toss-2026-11-03` 2건 재조준

## 이번에 틀렸던 판단
- `verifyPassword` 는 boolean 이 아니라 `{ valid, isLegacy }` 를 준다 — 처음엔 `if (!(await verifyPassword(...)))` 로 써서
  **틀린 비밀번호도 통과**했다. 시험이 잡았다(지금 `.valid`).

## 이어받는 세션의 첫 액션 (대표가 이어서 하라고 할 때만)
배포 뒤 '메일 시험' 에이전시(tobe2111@naver.com, 매장 0곳)로 마이를 열어 '시작하기 0 / 3' 이 보이는지 · 설정의 비밀번호 바꾸기 시트.
