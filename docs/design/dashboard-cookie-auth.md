# 대시보드 토큰 httpOnly 쿠키 전환 (XSS 하드닝) — 설계

> 상태: **설계 (구현 전)** · 작성 2026-06-17 · 옵션 "C" (사용자 "모두 가장 이상적으로 진행")
> 범위: seller / admin / agency / supplier 대시보드 인증. **소비자(카카오) 세션은 이미 httpOnly 쿠키라 범위 외.**

## 0. 한 줄 요약
대시보드 토큰이 **localStorage**에 있어 XSS 시 탈취·30일 takeover 가능. 이미 깔린 인프라(세션 쿠키 + CSRF + ud_* 쿠키)를 활용해 **클라가 Bearer 대신 httpOnly 쿠키에 의존**하도록 단계 전환한다. 핵심 선결과제는 "쿠키 인증 쓰기 요청"을 위한 **CSRF 강제 확대**.

## 1. 위협 모델 / 목표
- **위협**: XSS(악성 스크립트·오염 의존성·외부 위젯·확장)가 `localStorage.getItem('admin_token')`을 읽어 외부 유출 → 30일 토큰으로 지속 takeover. 어드민(전권)·제조사/에이전시(돈)에서 치명적. **외부 파트너(도매 admin role·제조사) 증가로 노출 ↑.**
- **목표**: 대시보드 토큰을 **JS가 못 읽는 httpOnly 쿠키**로 → XSS가 토큰을 *빼돌리지* 못하게(방어심화). CSP 위에 얹는 2차 방어선.
- **비목표**: XSS 자체 차단(그건 CSP·입력검증 몫). 소비자 세션 변경(이미 쿠키).

## 2. 현재 상태 (코드 해부 — SSOT)

| 요소 | 현황 | 파일 |
|---|---|---|
| 대시보드 access/refresh 토큰 | **localStorage** (`{seller,admin,agency,supplier}_token` + `_refresh_token`) | `lib/api.ts`, `lib/supplier-api.ts` |
| 클라 인증 첨부 | `Authorization: Bearer` (localStorage 에서) | `lib/api.ts` 요청 인터셉터 |
| **세션 쿠키** (`ur_session`/`ur_seller_session`/…) | **이미 존재** — 로그인 시 `createSessionCookie()` 발급, 미들웨어가 **전 메서드** 검증 | `worker/utils/session.ts`, `auth.ts:350-373`, `seller.routes:322`/`admin:167`/`agency:464` |
| `ud_*` 토큰 쿠키 | dual-write(카카오·로그인) 됨. 미들웨어가 **GET/HEAD 전용** 검증(CSRF 미적용이라 쓰기 제외) | `worker/utils/auth-cookies.ts`, `auth.ts:375-408` |
| CSRF | `csrfProtection()` HMAC double-submit **존재**. **Bearer 요청은 skip**. 현재 `/api/auth/{logout,profile,change-password}` **3곳만** 적용 | `lib/csrf.ts`, `worker/index.ts:907-909` |
| 클라 CSRF | GET 응답의 `csrf_token` 쿠키를 읽어 변경요청에 `X-CSRF-Token` 헤더 자동 첨부 — **이미 준비됨** | `lib/api.ts:221-237` |
| 단일 세션 | iat 에포크(`dashboard_sessions.min_valid_iat`) — Bearer·세션쿠키·ud_* 경로 모두 검사 | `worker/utils/dashboard-session.ts`, `auth.ts:314/356/389` |

### 핵심 통찰
1. **세션 쿠키는 이미 전 메서드 인증이 된다** → "토큰을 쿠키로 옮기는" 인프라는 사실상 완성. 남은 건 **클라가 Bearer를 끊고 쿠키에 의존**하게 하는 것.
2. `ud_*`가 GET 전용인 유일한 이유 = **쓰기 요청 CSRF 미보장**. 따라서 C의 진짜 선결과제 = **대시보드 변경 엔드포인트에 `csrfProtection()` 확대** (Bearer skip이라 현행 클라 무영향 = 추가형).
3. **refresh 토큰**도 localStorage → 쿠키 전환 대상(아니면 XSS가 refresh로 영구 재발급). 세션 쿠키 자체 만료(셀러 24h/어드민 8h/30일 등) vs refresh 흐름 정합 설계 필요.

## 3. 목표 아키텍처
- access/refresh 토큰 = **httpOnly·Secure·SameSite=Lax 쿠키** (JS 접근 0).
- 모든 대시보드 변경요청(POST/PATCH/DELETE) = **쿠키 인증 + CSRF(X-CSRF-Token) 강제**.
- Bearer 경로는 전환 기간 **병행 유지**(dual-auth) 후, 전 표면 쿠키 검증 확인되면 **클라에서 제거** → 마지막에 서버 Bearer 제거(또는 모바일앱 호환 위해 유지 결정).
- 단일 세션(iat)·로그아웃·멀티탭 = 기존 메커니즘 그대로(쿠키에도 iat 있음).

## 4. 선결과제 — CSRF 강제 확대 (Phase 0, 가장 안전·먼저)
- `csrfProtection()` 을 **대시보드 변경 라우트 전반**(`/api/admin/*`, `/api/seller/*`, `/api/agency/*`, `/api/supplier/*` 의 비-GET)에 mount.
- **추가형·무회귀**: csrfProtection 은 **Bearer 요청 skip** → 현행 localStorage-Bearer 클라는 그대로 통과. 쿠키-only 요청만 CSRF 검사. 클라는 이미 `X-CSRF-Token` 첨부.
- 단위 테스트로 검증 가능(브라우저 불필요): Bearer→skip, 쿠키+유효헤더→통과, 쿠키+헤더없음→403.
- ⚠️ 로그인/refresh/공개 GET 은 제외(부트스트랩 데드락 방지). 파일 업로드(multipart)·웹훅 예외 점검.

## 5. 단계 전환 (각 단계 독립 배포 + 롤백)
역할별로 분리해 락아웃 리스크 격리. **권한·리스크 큰 순서.**

- **Phase 1 — 어드민** (전권, 가장 가치 큼): 어드민 변경 라우트 CSRF 강제 확인 → 로그인이 httpOnly access/refresh 쿠키 발급(이미 세션쿠키 발급 중, ud_admin_token 추가) → 미들웨어가 admin 쿠키를 **전 메서드** 수용 → 클라가 admin 호출에서 Bearer 첨부 중단(쿠키 의존) → **staging E2E 통과 후** 배포.
- **Phase 2 — 제조사/에이전시** (외부·돈): 동일. supplier 는 자체 fetch 클라(`supplier-api.ts`)라 별도. 도매 도메인(utongstart.com) **호스트-only 쿠키** 검증 필수.
- **Phase 3 — 셀러** (최다·권한 낮음): 동일. 모바일/카톡 인앱 비중 높아 웹뷰 E2E 최우선.

각 단계 = (a) 쿠키 발급 추가 → (b) 서버 dual-read(쿠키+Bearer) → (c) **staging E2E** → (d) 클라 Bearer 중단 → (e) 모니터링 → (f) 안정 후 다음 단계.

## 6. 리스크 체크리스트 (각 단계 staging 에서 반드시)
- [ ] **SameSite=Lax** — 대시보드는 자기 출처 XHR 위주라 Lax OK. 크로스사이트 POST 없음 확인.
- [ ] **Domain**: `live.ur-team.com`↔`beta.ur-team.com` = `Domain=.ur-team.com` 공유 OK. **`utongstart.com`·`*.pages.dev` = host-only** → 해당 호스트에서 직접 발급/검증되는지 확인(현 `domainAttr` 동작).
- [ ] **카카오 인앱/웹뷰** — 쿠키 저장·전송, 3rd-party 쿠키 차단 영향(과거 사고 이력). 가장 위험.
- [ ] **CSRF**: 변경요청 헤더 누락 시 403, Bearer 요청 skip, 토큰 회전 1h TTL 갱신.
- [ ] **401 자동갱신**: refresh 가 쿠키 기반일 때 인터셉터 흐름 재검(현 `refreshDashboardToken` 은 body refreshToken 가정).
- [ ] **단일 세션(iat)**: 쿠키 토큰 iat 가 `min_valid_iat` 검사 통과/차단 정상.
- [ ] **멀티탭/로그아웃**: `useMultiTabSync`(localStorage storage 이벤트 기반)는 쿠키 전환 시 신호원 변경 필요 — 로그아웃 시 쿠키 clear + 브로드캐스트 대안.
- [ ] **로그아웃**: `clearAuthData` 가 서버 `logout-cookies` 호출(이미 있음) — 전 역할 쿠키 만료 확인.

## 7. 롤백 (단계별)
- 클라 Bearer 중단을 **feature flag** 뒤에 두고, 문제 시 flag off → 즉시 Bearer 복귀(쿠키는 추가형이라 공존). 서버 dual-read 유지하므로 무중단 롤백.

## 8. 절대 하지 말 것
- ❌ CSRF 강제 **전에** 쿠키 인증을 변경요청(POST/PATCH/DELETE)으로 확대 — **CSRF 구멍**(ud_* 가 GET 전용인 이유).
- ❌ staging(특히 카톡 인앱) E2E 통과 **전에** 클라 Bearer 제거 — 전 대시보드 락아웃 위험.
- ❌ 새 토큰 포맷 발명 — 쿠키 값 = 기존 JWT 그대로(검증 경로 단일 유지, auth-cookies.ts 주석 원칙).
- ❌ 4역할 한 번에 — 반드시 역할별 분리 배포.

## 9. 검증 한계 (정직)
이 작업은 **실제 브라우저·카톡 인앱·크로스서브도메인 쿠키 동작**을 staging 에서 확인해야 한다. 코드 환경(tsc/unit/build)만으로는 쿠키 전송·SameSite·웹뷰를 검증 불가 → **각 단계 클라 컷오버 전 staging E2E 가 게이트**다. 그래서 본 설계는 "한 번에 구현"이 아니라 "검토→단계→측정"으로 진행한다.

## 10. 다음 액션
1. **Phase 0(CSRF 강제 확대)** 구현 — 추가형·단위테스트 가능·무회귀(권장 첫 코드 스텝).
2. Phase 1(어드민) 쿠키 발급+dual-read → staging E2E → 클라 컷오버.
3. 이후 단계 순차.
