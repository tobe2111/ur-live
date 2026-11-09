# 2026-11-09 [UNLOCK_LOADING] 카카오 로그인의 에이전시 재발급 토큰을 별도 키로 서명

- **잠금 파일**: `src/features/auth/api/kakao.routes.ts` (`issueLinkedRoleTokens` 안 `agency_refresh_token` 서명 한 곳)
- **대표 승인**: 보안 전수조사 2차 *"계속 진행"* (2026-11-09).

## 무엇을 왜
재발급 토큰이 로그인 토큰과 같은 키로 서명돼, Bearer 로 보내면 로그인 토큰으로 통했다. 토큰을 직접 확인하는 곳이 30곳 가까이라
키를 갈랐다(`src/worker/utils/refresh-token-key.ts`). 관리자·셀러·소비자 재발급 토큰도 같은 커밋에서 바꿨다(잠금 파일 아님).

## 불변으로 지킨 잠금 항목
- `issueLinkedRoleTokens` 응답의 `seller.username` 포함 · seller/agency 로그인 토큰 서명 · 단일 세션 갱신 그대로.

## 가드 · 롤백
`src/tests/unit/security-hardening-2-2026-11-09.test.ts` ① + 주입 4건 빨간불. 롤백: 이 커밋 revert.
