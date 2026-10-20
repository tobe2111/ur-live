# SSR Phase 2 — 인증 쿠키 전환 설계 (localStorage JWT → httpOnly 쿠키 병행 발급)

> 2026-06-11 작성. **설계 문서만 — 구현은 B세션과 조율 후** (본체 `src/` 수정 필요, 카카오/잠금 파일 인접).
> 상위 계획: `docs/SSR_MIGRATION_PLAN.md` Phase 2. 이 문서가 구현 SSOT.

## 1. 왜 필요한가

SSR 서버(apps/ssr loader)는 브라우저 localStorage 를 **못 본다**. 현재 유저/셀러 인증 토큰이
localStorage 에만 있으므로, SSR 이 로그인 개인화(도매 등급가 · 내 딜 잔액 · 내 주문)를 그릴 수 없다.
요청에 자동으로 실려오는 **httpOnly 쿠키**로 토큰을 병행 발급해야 SSR loader 가 `Cookie` 헤더로
본 사이트 `/api/*` 를 호출해 개인화 데이터를 받을 수 있다.

## 2. 현황 (2026-06-11 코드 기준)

### 토큰 저장 — localStorage (SPA 전용, SSR 불가시)
`src/features/auth/auth-callback-bootstrap.ts` 기준 키:

| 키 | 내용 |
|---|---|
| `user_type` / `user_id` / `session_login` / `active_role` | 유저 세션 식별 (카카오 세션 쿠키와 병행) |
| `seller_token` / `seller_id` / `seller_name` / `seller_username` | 셀러 JWT (HS256, 30일) |
| `agency_token` / `agency_id` | 에이전시 JWT |
| (admin 토큰 키) | 어드민 — 구현 시 키 이름 실코드 재확인 필요 |

### 이미 쿠키인 것
- **카카오 유저 세션**: `kakao.routes.ts` 가 세션 쿠키 발급 — 한국(live.ur-team.com) 유저는 **이미 SSR-ready**.
  콜백이 `seller_token`/`agency_token` 을 **임시 쿠키 → localStorage 이전** 하는 브릿지도 존재
  (`auth-callback-bootstrap.ts` readCookie 패턴) — 즉 "쿠키로 토큰 전달" 전례가 이미 코드에 있음.

### JWT 발급/검증
- 발급: `jwtSign(payload, JWT_SECRET)` (hono/jwt) — seller 페이로드 `{ sub, seller_id, type:'seller', exp: 30d }`.
- 검증: `src/worker/middleware/auth.ts` `verifyJWT` — **HS256 고정**(alg-confusion 방어), secret env `JWT_SECRET`.
- 미들웨어 순서: **Bearer 우선 → 세션 쿠키 차선** (CLAUDE.md 인증 룰).

## 3. 설계 — "쿠키+localStorage 동시 발급" (dual-write, 제거는 Phase 3 컷오버 후)

### 3.1 쿠키 스펙
| 항목 | 값 | 근거 |
|---|---|---|
| 이름 | `ud_user_session`(기존 카카오 그대로) / `ud_seller_token` / `ud_agency_token` | 기존 임시쿠키 이름과 충돌 회피, 신규 prefix `ud_` |
| 속성 | `HttpOnly; Secure; SameSite=Lax; Path=/` | XSS 탈취 차단 + 일반 내비게이션 GET 에 동승 |
| Domain | `.ur-team.com` | **핵심**: beta.ur-team.com(SSR)과 live.ur-team.com(API)이 쿠키 공유 |
| Max-Age | 기존 JWT exp 와 동일(30일) | 토큰-쿠키 수명 불일치 방지 |

⚠️ **workers.dev 파일럿 주소로는 불가** — cross-site 라 쿠키 미동승. **beta.ur-team.com 연결이 선행 조건**
(Phase 1 게이트에서 이미 사용자 액션으로 등록됨).

### 3.2 발급 지점 (dual-write 추가 — 기존 응답 바디/localStorage 흐름 불변)
1. 셀러 로그인 endpoint (이메일/패스워드) — 응답에 `Set-Cookie: ud_seller_token` 추가.
2. 카카오 콜백의 seller/agency 토큰 브릿지 — 임시쿠키를 httpOnly 영구쿠키로 **추가** 발급(기존 이전 흐름 유지).
3. 토큰 자동갱신(`useTokenAutoRefresh`) — 갱신 시 서버가 새 쿠키 재발급 (endpoint 응답에 Set-Cookie).
4. 로그아웃 — `clearAuthData()` 호출 경로에서 서버 쿠키 삭제 endpoint(`POST /api/auth/logout-cookies`) 호출 추가.

### 3.3 검증 지점 (additive — Bearer 우선 순서 불변)
`src/worker/middleware/auth.ts` 의 토큰 추출에 3순위 추가:
```
1. Authorization: Bearer …   (기존 — SPA, 불변)
2. 기존 세션 쿠키            (기존 — 카카오, 불변)
3. ud_seller_token / ud_agency_token 쿠키   (신규 — SSR 경유 요청)
```
SSR loader 는 브라우저가 보낸 `Cookie` 헤더를 **그대로 전달(forward)** 해 `/api/*` 호출:
`fetch(API + path, { headers: { cookie: request.headers.get('cookie') ?? '' } })`.

### 3.4 CSRF 방어 (쿠키 인증의 새 표면)
- Phase 2 SSR 개인화는 **읽기(GET) 전용** (잔액/등급가/내 정보 표시) — 상태 변경 없음.
- 상태 변경(POST/PATCH/DELETE)은 **계속 Bearer 전용** 유지 — 쿠키만으로는 쓰기 불가 → CSRF 표면 0.
  (미들웨어 3순위 쿠키 fallback 을 **GET/HEAD 요청에만 적용**하는 가드를 구현 조건으로 명시.)
- 추후 SSR form action 도입 시: Origin/Referer 검증 + double-submit 토큰 — 별도 PR.

### 3.5 보안 체크리스트 (CLAUDE.md 룰 매핑)
- [ ] 카카오 OAuth 룰 준수: `safeRedirect`/state CSRF/`encryptToken` 흐름 **무수정** — Set-Cookie 추가만.
- [ ] `kakao.routes.ts` 는 **로딩 최적화 잠금 파일**(`linkUserExtraRoles` 응답 seller.username) —
      수정 전 `AskUserQuestion` + `[UNLOCK_LOADING]` audit log 필수.
- [ ] 쿠키 값 = 기존 JWT 그대로 (새 토큰 포맷 발명 금지 — 검증 경로 단일 유지).
- [ ] `(err as Error).message` 노출 금지 — `safeError` 패턴.
- [ ] 이중 로그인(admin↔user) race: `KakaoCallbackPage` user_type 보존 로직(잠금)과 충돌 없는지 회귀 확인.

## 4. 구현 순서 (B세션 조율용 — 각 단계 독립 배포 가능)

| 단계 | 작업 | 파일 | 잠금 여부 |
|---|---|---|---|
| A | beta.ur-team.com → SSR 워커 연결 (Cloudflare 사용자 액션) | — | — |
| B | 미들웨어 쿠키 fallback (GET 전용 가드 포함) | `src/worker/middleware/auth.ts` | 비잠금 |
| C | 셀러/에이전시 로그인 응답 Set-Cookie dual-write | 각 login routes | 비잠금 |
| D | 카카오 콜백 브릿지 쿠키 영구화 | `kakao.routes.ts` 등 | **잠금 — UNLOCK 절차** |
| E | 로그아웃 쿠키 삭제 endpoint + 클라 배선 | auth routes + `clearAuthData` | 비잠금 |
| F | SSR loader cookie forward + 개인화 슬롯(잔액/등급가) | `apps/ssr/` | 파일럿 전용 |

검증 게이트: ① 기존 SPA 로그인/로그아웃 회귀 0 (localStorage 흐름 불변이므로 기대값 동일)
② beta 에서 로그인 상태로 `/wholesale` 진입 시 등급가 SSR 렌더 ③ 시크릿창(비로그인) byte-identical.
롤백: 미들웨어 fallback 1곳 + Set-Cookie 라인 제거로 즉시 원복 (클라 코드 의존 없음 — dual-write 라 안전).

## 5. 명시적 비범위 (Phase 2 에서 안 함)
- localStorage 제거 (Phase 3 컷오버 후), 결제 페이지 SSR(Toss 위젯 = 클라 전용),
  어드민/셀러 대시보드 SSR(계획상 SPA 유지), refresh-token 회전 도입(현행 30일 JWT 유지).
