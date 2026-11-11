# [LOADING_ADDITIVE] 2026-11-11 — 로그인한 사람의 내 이용권 서버 첫 화면 (대표 "계속 최적화")

실사용 표본(RUM, 2026-11-10)이 실제로 있는 화면은 홈 · 내 이용권 · 마이 · 숙소 · 상세 정도였다(약관·제휴 문의 같은 화면은 표본 0). 그중 내 이용권은 **로그인 상태면 서버가 아무것도 안 그렸다**(게스트만 첫 화면) — 로더 약 2초.

## 잠금표 접촉(추가만)
`src/worker/index.ts` HTMLRewriter 블록 — 게스트 탭 분기 **앞**에 `authed && guestTabOf(…) === 'pass' && 폰` 한 토막 + import(같은 줄, 2672줄 유지). 게스트 분기는 글자 그대로.
`MyVouchersPage.tsx`(잠금 파일)는 **손대지 않았다** — 시험이 그 소스의 글자열과 서버 상수를 대조한다.

## 내용
`worker/utils/guest-first-screen.ts` `buildAuthedPassFirstScreen(loader, nonce)` — 제목 줄(`shared/guest-page.ts` `AUTHED_PASS_CLS`) + 로더(34dvh). 목록은 본인 데이터라 그리지 않는다. 첫 화면 CSS 는 게스트 표면(`guest`) 그대로.
쿠키는 있는데 기기가 로그아웃 상태면(앱이 게스트 화면을 그린다) 바로 뒤 스크립트가 제목을 걷어낸다 — 게스트 스크립트의 반대 방향.

## 못 보는 것
세션이 필요해 이 환경에서 라이브 실측을 못 한다(RUM `/my-vouchers` FCP · 대표 폰) · PC(액자) · 마이(`/user/profile`)·유어샵(`/u/me`)의 로그인 상태 첫 화면(미착수).

## 가드
`authed-pass-first-screen-2026-11-11.test.tsx` 6건 · 주입 6건(하나는 반대 방향) · 기존 가드 2건 재조준(`css-first-boot` 전제 · 게스트 주입 앵커).
