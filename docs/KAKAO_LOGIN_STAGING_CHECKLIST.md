# 카카오 로그인 — 사파리 / 카톡 인앱 staging 검증 체크리스트

> 2026-06-20 전수조사 수정(C1~C3 + A1~A4) 검증용. 이 환경은 실기기 E2E 불가 →
> 아래는 **대표(또는 QA)가 staging(또는 prod canary)에서 직접 수행**해야 하는 수동 검증.
> 관련 커밋/배경: `docs/CURRENT_WORK.md` 2026-06-20 항목.

## 0. 사전 조건 (배포 전 1회)
- [ ] Cloudflare env **`JWT_SECRET`** 설정 확인 — A1 의 서명 state 발급/검증에 필수.
      미설정 시 `/auth/kakao/start` 가 `{error:'Auth not configured'}` 500 반환(의도된 명시 실패).
- [ ] 카카오 개발자 콘솔 Redirect URI 에 `https://<도메인>/auth/kakao/sync/callback` 등록 확인(기존).

## 1. A1 — 사파리 state-쿠키 유실에도 로그인 성공 (최우선)
사파리는 "사이트 간 추적 방지"(설정 > Safari)가 기본 ON. 이 상태에서 검증.
- [ ] **iOS 사파리 (일반)**: 로그아웃 → `/login` → 카카오 로그인 → 홈 진입 + 로그인 유지. URL 에 `?error=oauth_state_*` **없어야** 함.
- [ ] **iOS 사파리 프라이빗 브라우징**: 위와 동일하게 로그인 성공해야 함(기존엔 여기서 자주 `oauth_state_expired`).
- [ ] **macOS 사파리**: 로그인 성공.
- [ ] (회귀) 정상 크롬/안드로이드 크롬: 로그인 성공 + `?login=success` 처리 정상.
- [ ] **CSRF 회귀 확인**: 쿠키가 있는 정상 흐름에서 로그인 정상(서명+nonce 바인딩 모두 통과). 의도적으로 `state` 파라미터를 변조한 URL 로 콜백 접근 시 → `/?error=oauth_state_mismatch` (서명 검증 실패 거부).

## 2. A2 — "로그인 직후 자동 로그아웃" 재발 없음
- [ ] iOS 사파리에서 로그인 직후 홈에서 **새로고침 없이** 1~2초 관찰 → 로그아웃되지 않아야 함(localStorage wipe 안 일어남).
- [ ] 로그인 후 마이페이지 진입 → 사용자 정보 정상 표시(세션 쿠키 실제 적용 확인).
- [ ] (역검증) 진짜 비로그인 상태에서 마이페이지 등 보호 페이지 → 정상적으로 로그인 유도.

## 3. C1 / A3 — 카톡 인앱 (안드로이드/아이폰/아이패드)
- [ ] **안드로이드 카톡 인앱**(가능하면 **Chrome 미설치/삼성인터넷 기본** 단말): 카톡 채팅방에서 `https://<도메인>/` 링크 탭 → 외부 브라우저로 이동 **또는** 인앱에서라도 앱이 정상 렌더(빈 화면 ❌). 이어서 카카오 로그인 성공.
- [ ] **iOS 카톡 인앱**: 링크 탭 → 사파리로 외부 이동 → 로그인 성공.
- [ ] **iPadOS 사파리 카톡 인앱**(있으면): 외부 열기 버튼이 iOS 경로로 정상 동작(A3).
- [ ] (회귀) 네이버/인스타/페북 인앱: 안드로이드는 Chrome intent + fallback 으로 빈 화면 없이 진입, 상단 "외부 브라우저" 안내 배너 표시.

## 4. C3 — `/auth/kakao/callback` SPA 경로 (휴면 경로 안전성)
- [ ] 주 로그인 흐름(`/auth/kakao/start`)은 서버 `/sync/callback` 처리 → 영향 없음 확인(=1번 통과면 OK).
- [ ] (선택) 카카오 콘솔에 `/auth/kakao/callback` 도 등록돼 있다면 그 경로로 들어오는 code 도 토큰교환 성공(redirect_uri 일치).

## 5. 배포 직후 transient (정상 — 안내용)
- 배포 순간 **이미 카카오 동의화면에 머물던** in-flight 사용자는 구 UUID state 를 들고 돌아와 1회 `oauth_state_mismatch`/`oauth_state_expired` 가능 → **재시도하면 정상**. 수 초 윈도우, self-heal.

## 롤백 포인트 (문제 시)
- A1: `kakao.routes.ts` 의 `verifyOAuthState`/`buildOAuthState` 도입 블록 + `/sync/callback` state 해석 블록.
- A2: `auth-callback-bootstrap.ts` `didFreshLogin` 가드.
- C1/A3: `index.html` 인라인 intent fallback + isIOS, `in-app-browser.ts` isIOS.
- C3: `KakaoCallbackPage.tsx` redirect_uri 1줄.
