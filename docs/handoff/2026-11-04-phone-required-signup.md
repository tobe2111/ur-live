# 2026-11-04 가입 시 휴대폰 번호 필수

## 대표 지시 · 확정
- *"가입 시, 전화번호는 필수로 입력하게끔 해줄래? 예약 및 소식 알림을 위한 목적으로"*
- 확정(질문 답): **새 가입자만** · **예약·이용 안내는 필수 + 소식(할인·이벤트) 알림은 선택 체크(기본 꺼짐)** — 광고성 정보는 필수 동의로 못 묶는다(정보통신망법 제50조).

## 구현
- 판정 SSOT `src/shared/phone-required.ts` — `users.created_at >= 2026-11-04 00:00:00`(UTC) 이고 번호 없음 → 필수.
- `/api/auth/me` 두 분기(세션 쿠키·Bearer)가 `phone_required` 를 내린다.
- `PATCH /api/auth/profile` — 번호는 숫자만 저장 · `marketing_agreed`(boolean) 오면 `terms_agreements` 에 `marketing` 기록.
- 창 `src/components/onboarding/PhoneRequiredGate.tsx` — 닫기 없음 · 하단 탭 위(z-[10000]) · 약관/개인정보/로그인/대시보드 경로에선 안 뜸. App 이 로그인 소비자 + 기기에 `user_phone` 없을 때만 마운트.
- 카카오 잠금 파일(KakaoAuthService·kakao.routes·KakaoCallbackPage)은 **안 건드렸다**.
- 가드 `phone-required-signup-2026-11-04.test.tsx` 8건 + 주입 5건 빨간불 확인.

## 틀렸던 판단 / 주의
- 첫 렌더에서 확인 버튼이 하단 탭(z-[9999]) 뒤에 가려졌다 → 풀스크린 모달 규칙 z-[10000] 로.
- `?new=1` 로 판정하면 창을 닫고 나간 사람이 영영 빠져나간다 → 서버 `created_at` 판정으로.

## 남은 것
- 라이브 E4: 새 카카오 가입 1건으로 창 노출 → 저장 → `users.phone` 숫자 저장 · `terms_agreements` marketing 행 확인.
- 환영 창(WelcomeOnboardingModal) 3단계의 알림톡 토글이 **기본 켜짐**이다 — 광고성이면 같은 법 문제. 이번 범위 밖, 대표 판단 필요 시 결재함.

## 2026-11-04 후속 — 가입 환영 창 제거
- 대표: *"어차피 카카오로 로그인 시에 알림 설정은 받게 안되어있어? 그리고 신규 환영 쿠폰은 따로 없어. 관심 분야 저것도 굳이 없애도 돼."*
- 실측(라이브 Pages env): `KAKAO_OIDC_ENABLED=1`, `KAKAO_CHANNEL_ADD_ENABLED` 없음 → 카카오 동의 화면은 이메일·닉네임·프로필사진뿐. **알림·광고 동의도, 채널 추가도, 휴대폰 번호도 안 받는다**(OIDC 경로는 phone 을 아예 안 읽는다 — 그래서 번호가 비어 있었다).
- `WelcomeOnboardingModal`·`OnboardingTrigger` 삭제 + App 마운트 제거. 가입하면 번호 창 하나만.
- 알림톡 토글은 원래 저장되지 않았다(`/api/users/onboarding` 라우트 없음 · 읽는 곳 없음).
