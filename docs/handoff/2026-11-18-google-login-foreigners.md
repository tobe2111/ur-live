# 2026-11-18 · 외국인 손님 구글 로그인

**서비스: 유어딜(소비자)** · 머니 경로 접촉 없음 · 롤백: 자격(`GOOGLE_CLIENT_*`)을 지우면 버튼·라우트 전부 무동작, 또는 revert.

## 대표 결정(그대로)
- 버튼은 **기기(브라우저) 언어가 한국어가 아닐 때만** 보인다 — 관광객은 한국 IP 라 IP 나라로 가르지 않는다.
- 서버가 구글이 설정됐다고 할 때만 보인다(`GET /api/auth/google/enabled`). **자격은 아직 Cloudflare 에 없다** → 지금은 아무것도 안 보이고 아무것도 안 한다.

## 무엇을 만들었나
| 조각 | 파일 |
|---|---|
| 라우트 `GET /api/auth/google/enabled` · `GET /auth/google/start` · `GET /auth/google/callback` | `src/features/auth/api/google.routes.ts` (마운트 `src/worker/index.ts`) |
| 토큰 교환(서버만) · id_token 클레임(aud·iss·exp·email_verified) · 계정 찾기/만들기 · 곁표 `user_identities` | `src/features/auth/services/google-oauth.ts` |
| OAuth state 서명·검증 공용(카카오에서 꺼냄 — 클레임 모양 불변) | `src/worker/utils/oauth-signed-state.ts` |
| 세션 확립 티켓 공용(카카오에서 꺼냄 — 본문 불변) | `src/worker/utils/session-establish-ticket.ts` |
| 버튼 | `src/components/auth/GoogleLoginButton.tsx` → `src/pages/LoginPage.tsx` 카카오 버튼 아래 |
| 오류 안내(영어 토스트) `email_in_use_kakao` 등 | `src/App.tsx` 오류 표 |
| 탈퇴 시 구글 신원 끊기 | `src/worker/services/delete-account.service.ts` |
| Firebase 가드 R4(구글 라우트가 Firebase 토큰을 받지 않게) | `scripts/check-no-firebase-auth.mjs` |

규칙:
- 같은 이메일 회원(카카오·이메일)이 있으면 **잇지 않는다** → `/login?error=email_in_use_kakao`(또는 `email_in_use`). 카카오의 `EMAIL_ALREADY_LINKED_TO_OTHER_METHOD` 와 같은 원칙.
- 세션은 카카오와 같다: 302 의 `ur_session` + fragment `#st=` 티켓(iOS). 역할(셀러·에이전시) 토큰은 발급하지 않는다.
- 새 회원은 약관 간주 동의 1회 · 유어샵 핸들 · 어드민 가입 알림(카카오 신규와 같음).

## 대표님이 하실 일 — Google Cloud Console (자격 만들기)
1. https://console.cloud.google.com → 프로젝트 하나 만들기(이름 예: `urdeal-login`).
2. **API 및 서비스 → OAuth 동의 화면**
   - User Type **외부(External)** → 만들기
   - 앱 이름 `UrDeal` · 사용자 지원 이메일 · 앱 로고(선택) · 앱 홈페이지 `https://urdeal.kr` · 개인정보처리방침 `https://urdeal.kr/privacy` · 서비스 약관 `https://urdeal.kr/terms` · 승인된 도메인 `urdeal.kr` · 개발자 연락처 이메일
   - **범위(Scopes)**: `openid` · `.../auth/userinfo.email` · `.../auth/userinfo.profile` 세 개만 (민감 범위가 아니라 구글 심사 불필요)
   - 저장 후 **게시 상태 → 앱 게시(Publish app) → 프로덕션**. (테스트 상태로 두면 등록한 테스트 사용자만 로그인된다)
3. **API 및 서비스 → 사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
   - 애플리케이션 유형 **웹 애플리케이션**
   - 승인된 자바스크립트 원본: `https://urdeal.kr`
   - 승인된 리디렉션 URI: `https://urdeal.kr/auth/google/callback`
   - 만들기 → **클라이언트 ID** 와 **클라이언트 보안 비밀번호** 를 받는다.
4. **Cloudflare → Workers & Pages → ur-live → Settings → Variables and Secrets (Production)**
   - `GOOGLE_CLIENT_ID` = 클라이언트 ID — **일반 텍스트(Plaintext)**
   - `GOOGLE_CLIENT_SECRET` = 보안 비밀번호 — **암호화(Encrypt / Secret)**
   - 저장 후 다음 배포부터 적용(변수만 바꾸면 재배포가 필요할 수 있다).
   - ⚠️ 비밀번호를 채팅·레포에 붙여넣지 말 것.

## 이어받는 세션의 첫 액션(대표가 이 작업을 이어서 하라고 했을 때만)
1. 자격 등록 확인: `curl -sS https://urdeal.kr/api/auth/google/enabled -H "User-Agent: Mozilla/5.0"` → `{"enabled":true}` 이면 등록된 것.
2. 브라우저 언어를 영어로 두고 `https://urdeal.kr/login` → "Continue with Google" 이 카카오 버튼 아래 보이는지, 한국어 브라우저에선 안 보이는지.
3. 실제 구글 계정으로 로그인 → 돌아와 로그인 상태인지(아이폰 사파리 포함 — `#st=` 교환). 이것이 E4.
4. 카카오로 가입된 같은 이메일의 구글 계정 → `This email is already registered with Kakao…` 토스트.

## 완료분
- 커밋: (이 파일과 같은 커밋 — 브랜치 `worktree-agent-af4359bfe72d0484f`)
- 등급: **E2**(시험·타입체크·가드·주입 8건 빨간불 확인). 자격이 없어 라이브 판정(E4) 불가.

## 이번에 틀렸던 판단
- 처음엔 로그인 화면이 `?error=` 를 직접 읽게 하려 했다. 그런데 `App.tsx` 가 앱이 뜨자마자 `?error=` 를 토스트로 띄우고 주소에서 지운다(지연 로딩되는 LoginPage 보다 먼저). 그래서 오류 문구는 App 의 오류 표에 넣었다.
- `/login` 은 `safeRedirect` 가 막는 주소라(자기참조 루프 방지) 콜백의 오류 복귀를 safeRedirect 로 만들면 `/` 로 떨어진다 — 고정 문자열 `loginErrorPath()` 로 만들고 원래 복귀 주소는 `returnUrl` 로 싣는다.
- `check-no-firebase-auth.mjs` R3 은 `googleRoutes` 마운트를 막는다(옛 Firebase ID 토큰 수용 경로). 새 라우트는 이름이 `googleOauthRoutes` 이고 성격이 다르다(서버 code 교환). 같은 클래스가 이 이름으로 돌아오지 않게 R4 를 더했다.

## 남은 결정/대기
- 자격 등록(위 콘솔 절차) — 대표.
- 이미 카카오로 가입한 외국인이 구글로 **잇기**(계정 연결) 기능은 없다. 필요하면 로그인 상태에서 잇는 별도 흐름으로(자동 연결은 하지 않는다).
