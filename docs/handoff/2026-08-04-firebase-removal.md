# 인계 — Firebase 클라이언트 전면 제거 (2026-08-04)

대표 승인: *"firebase는 안쓸텐데? ... 1번 하자"* + 잠금 파일 개별 허가(`AskUserQuestion`).
직전 세션이 남긴 **"다음 세션 우선 과제"** 를 실행한 것.

## 왜 지웠나 (사용자 체감이 아니라 위생·보안)

⚠️ **먼저 정정**: 이 378KB 는 **한국 사용자에게 다운로드되지 않았다.** 세 군데가 막고 있었다 —
`api.ts:365` `if (isKorea()) return config` · `useAuthKR.initializeAuth` 즉시 종료 ·
`LoginPage` 구글 버튼 GLOBAL 전용. ⇒ **속도 이득은 0이다.** 그걸 이득이라고 보고하지 말 것.

진짜 이유 셋:
1. **번들 예산이 계속 헛울렸다** — 8번 상향(마지막은 초과분 1,298B). 이제 **처음으로 내렸다**(8.95 → 8.6).
2. **안 쓰는 인증 코드는 위험 표면이다** — 2026-07-28 서비스계정 키 유출(#798)이 바로 이 Firebase 였다.
3. 서버 수용은 이미 끊겨 있었다(#806) — 클라만 남아 "살아 있는 것처럼" 보였다.

## 실측 결과

| | 전 | 후 |
|---|---|---|
| 총 raw JS | 8.9012 MB | **8.5069 MB** (−0.39) |
| 총 gzip | 2.780 MB | 2.697 MB |
| critical path | 217.7 KB | 216.1 KB (17청크 불변) |

## 삭제/수정 목록

**삭제(8)**: `lib/firebase-auth.ts` · `lib/firebase-config.ts` · `lib/firebase.ts` ·
`lib/firebase-utils.ts` · `lib/firebase-admin.ts` · `shared/stores/useAuthWorld.ts` ·
`features/auth/services/FirebaseAuthService.ts` · `features/auth/api/google.routes.ts`
(마지막 둘은 2026-07-28 에 이미 마운트 해제돼 있던 죽은 서버 코드)

**수정(14)**: `App.tsx` · `lib/api.ts`(2블록) · `utils/auth.ts`(3블록) · `LoginPage`(구글 버튼·핸들러) ·
`AdminLoginPage` · `SellerLoginPage` · `KakaoCallbackPage` · `CheckoutPage` · `RegisterPage` ·
`ProductDetailPage` · `UserProfilePage` · `login-flow.service.ts` · `shared/stores/index.ts` ·
`features/auth/index.ts` · `useAuthKR.ts`(타입 로컬화 + `initializeAuth` 단순화, 597→446줄)

**잠금 파일 2건**(각각 CLAUDE.md audit log 기록):
- `PaymentSuccessPage.tsx` — Toss V2 잠금. **대표 명시 승인** 후 GLOBAL 전용 대기 블록만 제거.
  Toss confirm/금액검증/TossPaymentObject 표시 byte-불변.
- `RouteGuards.tsx` — 로딩 잠금. `GlobalUserProtectedRoute` 제거.
  **잠금 항목인 `isAdminLoggedIn`/`isUserLoggedIn`/`isSellerLoggedIn` 토큰 검사는 불변.**

**의존성**: `firebase` · `firebase-admin` npm 제거 · vite 청크 규칙 2개 제거.

## ⚠️ 다음 세션의 첫 액션 — 배포 후 로그인 확인 (이게 전부다)

인증을 건드렸으므로 **라이브에서 실제 로그인 3종을 눈으로** 확인할 것:
1. **카카오 소비자 로그인** → `/` 진입 → 마이 페이지 표시
2. **셀러 로그인**(`/seller/login`) → 대시보드
3. **어드민 로그인**(`/admin/login`) → 콘솔
그리고 **결제 성공 1회**(`PaymentSuccessPage` 를 건드렸다 — KR 은 원래 그 블록을 건너뛰었지만 확인).

## 남은 잔재 (무해, 지금은 그대로 둠)

- `users.firebase_uid` 컬럼 + `KakaoAuthService.updateFirebaseUID()` — DB 컬럼 삭제는 별도 마이그레이션.
- `localStorage` 의 `firebase_token` 레거시 키 읽기 — 옛 세션 호환용 폴백이라 남겨둠.
- 주석 속 "Firebase" 언급 — 히스토리 설명이라 유지.

## 다음 정리 후보 (또 예산에 닿으면)

`charts` 520KB · `sentry` 431KB · `locale-ja`/`locale-ko` 각 ~280KB. **전부 lazy 라 사용자 체감 0** —
저장소 위생 관점에서만 의미가 있다. 상향으로 넘기지 말 것(8번 올렸다가 이번에 겨우 한 번 내렸다).
