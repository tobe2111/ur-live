# [UNLOCK_LOADING] 카카오 로그인 — 번호·마케팅 약관 받기(스위치, 기본 꺼짐) — 2026-11-04

- **바꾼 잠금 파일**: `src/features/auth/api/kakao.routes.ts` — 환경변수 타입 3개, authorize 에 `service_terms`(설정 시),
  id_token 빠른 길 조건에 `!kakaoNeedsUserInfo`, 응답 뒤(waitUntil) 마케팅 동의 기록 한 줄.
  잠긴 항목(`issueLinkedRoleTokens` 의 `seller.username`)은 **불변**. `KakaoAuthService.ts` 는 **안 건드렸다**(번호는 이미 `getUserInfo` 가 읽는다).
- **대표 허가(그대로)**: *"허가 — 꺼 둔 채로 넣어줘"* (AskUserQuestion 응답).
- 스위치가 전부 꺼져 있으면 동작은 오늘과 같다(가드 `kakao-phone-terms-2026-11-04` ①).
- 설정 순서: `docs/KAKAO_CONSENT_SETUP_2026-11-04.md`

## 롤백
환경변수 제거 → 재배포. 코드는 revert.
