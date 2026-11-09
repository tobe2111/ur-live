# 2026-11-09 보안 전수조사 수리 (대표 "모두 다 순서대로 진행해줘")

[E2] 코드·시험·주입 검사 통과. 머지·배포 후 E4 판정은 아래 "이어받는 세션의 첫 액션".

## 완료분 (PR tobe2111/ur-live#2245, 항목마다 커밋 하나)
1. 셀러 PIN·비밀번호 검사 3곳 — `verifyPassword` 결과 객체를 `.valid` 로 판정 (`7802aa3d`)
2. 키 게이트 데모 시드 엔드포인트 삭제 (`37e04ea8`)
3. 알림 채널 설정 PUT 열 이름 허용 목록 (`662a4260`)
4. 이미지 변환 프록시 래스터만 + `/api` 응답 nonce 미부착 [UNLOCK_LOADING] (`b87ef410`, 판정 함수 `src/worker/utils/image-proxy-safety.ts`)
5. 로그인 신원 종류를 서명된 값으로만 · 소비자 기능은 `requireUser()` · 재고는 셀러/어드민 · 주문 확정 소유 확인 (`2e9557a5`)
6. 관리자 역할 검사 디코드 경로 · 비밀 설정 가리기 · 내부 DDL 최고관리자 전용 · admins 행 없는 토큰 거부 · 소셜 위임 전 RBAC [UNLOCK_LOADING] (`4e14b937`)
7. 결제 웹훅 확정 전 Toss 결제 조회 [UNLOCK] (`664ef7fe`, 로직은 `src/worker/utils/webhook-toss-verify.ts` 로 분리)

가드: `src/tests/unit/security-hardening-2026-11-09.test.ts` + `scripts/mutations/security-hardening-2026-11-09.mjs`(17건 빨간불 확인) +
`src/tests/unit/webhook-payment.test.ts`(위조 4경우). 잠금 기록: `docs/locks/loading/2026-11-09-*`, `docs/locks/toss/2026-11-09-webhook-toss-lookup.md`.

## 이어받는 세션의 첫 액션 (대표가 이 작업을 이어서 하라고 했을 때만)
- 배포 확인: 카드 이미지 정상(`/api/image/resize` 200 image/*) · 카카오 로그인 후 마이·내 이용권·딜 결제 화면 정상 ·
  어드민 플랫폼 설정 화면(최고관리자)에서 Cloudflare 토큰 그대로 보임.
- staging 실결제 `docs/STAGING_CHECKLIST.md` S-WHLOOKUP.

## 이번에 틀렸던 판단
- 감사 게이트를 10분 제한으로 돌리다 끊겨, 그 안의 주입 검사 프로세스가 살아남아 작업 트리를 계속 바꿨다.
  게이트가 끊기면 `ps` 로 `check-guard-mutations` 잔여를 확인하고 멈춘 뒤 `git checkout -- .`.
- 소비자 이메일 로그인 토큰엔 `type` 이 없다 — "type 없으면 거부" 로 고치면 정상 소비자가 막힌다(그래서 purpose 거부 + 경로별 requireUser).

## 남은 결정/대기 (대표)
- Cloudflare `TOSS_WEBHOOK_IP_ALLOWLIST` 설정(추가 방어선 — 코드 수리와 별개).
- `archive/` 문서에 남은 옛 키들이 현재 키와 다른지 확인, 같으면 교체 · 문서 정리.
- 남은 낮음 등급(이용권 코드 6자리·전역 잠금, 카카오 로그인 CSRF, 관리자 PIN 잠금 미연동, 재발급 토큰 혼용, react-router 버전) — 다음 묶음.

## 2026-11-09 후속 — 머지 후 main 빨간불 수리
- #2245 머지(`131c9ac1`) 후 main 의 `src/worker/index.ts` 가 **2673줄**(동결 2672)이 돼 단위 시험 2건이 실패, Pages 배포가 막혔다.
  PR 시점엔 2672 였는데 그 사이 main 에 들어온 변경과 합쳐 1줄 넘쳤다. PR CI 는 바뀐 코드를 보는 시험만 골라 돌려 이 줄 수 시험을 안 돌렸다.
- 처방: 소셜 위임 전 RBAC 줄을 선언 줄에 붙여 1줄 감소(동작 무변경).
- **틀렸던 판단**: 동결 상한 바로 밑(2672/2672)에서 머지하면 main 이 움직이는 순간 넘친다. 상한 근처면 머지 직전에 main 을 합쳐 줄 수를 다시 볼 것.
- 미뤄 둔 대표 할 일(대표 "내가 할 일은 미뤄줘"): staging 실결제 S-WHLOOKUP · `TOSS_WEBHOOK_IP_ALLOWLIST` · archive 옛 키 확인.

## 2차 묶음 — 중간 등급 (대표 "계속 진행")
1. 재발급 토큰을 로그인 토큰과 다른 키로 서명(`utils/refresh-token-key`) — 재발급 주소는 이행기 동안 옛 키도 받는다 [UNLOCK_LOADING kakao.routes]
2. 관리자 PIN 실패를 계정 잠금에 센다(초기화는 PIN 통과 뒤로)
3. 이용권 조회 전체 잠금은 틀린 적 있는 IP 에만(정상 손님 조회를 막지 않게) — 6자리 길이(대표 결정)는 그대로
4. 동시 로그인 허용 관리자를 삭제하면 토큰도 끊는다
5. 응급·cron·웹훅 토큰 상수 시간 비교(`utils/secret-compare`) · 응급 재설정 role 허용 목록 · 삭제 계정 부활 차단
- **건너뜀: 카카오 로그인 서명 state 쿠키 없이 통과** — 2026-06-20 iOS 사파리·카톡 로그인 실패 사고의 처방이라 되돌리면 iPhone 로그인이 깨진다.
  로그인 확정 티켓 1회용화도 안 했다(티켓은 본인 URL fragment 에만 있고, 이중 요청 시 iOS 로그인이 깨질 위험).
- 가드: `src/tests/unit/security-hardening-2-2026-11-09.test.ts` + 주입 `scripts/mutations/security-hardening-2-2026-11-09.mjs`(11건 빨간불).
- **틀렸던 판단**: 로컬에서 단위 시험 전체를 돌리면 이 환경은 수 분 뒤 프로세스가 사라진다 — 전체 검증은 PR CI(전체 3조각)에 맡기고,
  머지 직전 main 합치기로 동결값 충돌을 막는다. 머지 후 원격 브랜치는 자동 삭제되므로 강제 푸시가 필요 없다.

## 3차 묶음 — 낮음 등급 (대표 "계속 진행")
- 공개 결제 점검의 Toss 비밀키 글자 제거 · 재호스팅 래스터만 · 증빙/디지털 링크 http(s)·내부 경로만(저장+화면) ·
  몰 공지 `//` 차단 · SSR 시드 JSON `<` 전부 이스케이프 [UNLOCK_LOADING] · 지오코딩 lazy 백필 IP 당 분 30회.
- 가드: `src/tests/unit/security-hardening-3-2026-11-09.test.ts` + 주입 7건 빨간불.
- **안 한 것과 이유**:
  - Resend 웹훅 서명 필수화 — 라이브에 `RESEND_WEBHOOK_SECRET` 이 없어 켜면 반송 처리가 멎는다(대표가 시크릿을 넣은 뒤에).
  - react-router 보안 수정은 7.x 에만 있다(현재 6.30) — 큰 버전 업그레이드라 별도. 역슬래시 이동은 `safeInternalPath` 가 막는다.
  - Firebase RTDB 규칙(`firebase-rules.json` chats 쓰기 공개) — 레포 파일만 바꿔선 반영되지 않는다(배포된 규칙 확인 필요 · 라이브커머스 중단 상태).
  - 공유 이미지 주소의 외부 이미지 리다이렉트 · 유어애즈 단축링크 — 기능 자체가 외부로 보내는 것이라 막으면 기능이 깨진다.
  - `/api/_errors/log` — 이미 IP 당 분 60회 제한이 있다.

## 4차 묶음 — 대표 "모두 진행해" (개선점 7개)
1. 종류를 안 보는 로그인 경로 57곳(22파일)을 `requireUser()` 로 — 장바구니·쿠폰·추천(출금 포함)·기부·공구 참여·
   경매·디지털·관심·등급·팔로우·알림·타임딜·유입 귀속·소비자 프로필/비밀번호. 셀러·에이전시도 쓰는 15곳은 허용 목록.
   재발 방지: `src/tests/unit/consumer-identity-guard-2026-11-09.test.ts`(허용 목록은 줄기만 · 주입 2건 빨간불).
2. 문서·archive 의 실제 키처럼 생긴 값 131줄 가림(JWT 서명키·CF 토큰·Toss 비밀키·Kakao REST 키 — 키 이름은 남김, 예시 파일·JS 키는 그대로).
   `check-no-secrets.sh` 의 Toss 패턴이 따옴표를 요구해 맨값을 못 잡던 것 → 따옴표 선택 + gsk + Kakao REST 키 패턴.
   ⚠️ git 기록에는 남는다 — 실제 차단은 키 교체(대표 대기 항목).
3. 카카오 로그인 함정 — **코드로 못 막음(검토 결과)**: 서버 1회용 nonce 는 login CSRF 를 못 막고(공격자가 자기 링크를 안 쓰고 넘김),
   UA 결속은 이 경로의 존재 이유인 iOS 카톡앱→사파리 핸드오프를 깨뜨린다. 남은 길은 제품 쪽(로그인 직후 "○○ 계정으로 로그인" 확인).
4·5. 로그인 토큰 판정 SSOT `src/worker/utils/login-token-policy.ts`(`isNonLoginToken`·`verifyLogin`): 용도 토큰 · `token_use:refresh` ·
   **옛 재발급 토큰은 수명으로**(관리자 >2일 · 셀러 >31일) 거부 — 아무도 로그아웃시키지 않고 옛 재발급 토큰의 로그인 사용만 막는다.
   Bearer 를 직접 확인하던 28파일을 `verifyLogin` 으로(가드가 새 직접 사용을 막음).
6. 주간 보안 점검 예약 `trig_01DfT4BgNxp7LYQkeMNs8Fm1` — 매주 월 10:17(KST), 새 세션이 읽기 전용 점검 → `docs/handoff/<날짜>-weekly-security-check.md` 초안 PR · 고칠 것은 결재함. 휴대폰 알림.
7. react-router 7 업그레이드 — **안 함(되돌림)**: 빌드·청크 검사는 통과했지만 화면별 첫 화면 무게가 전부 +5~7KB(허용 1.5KB)였다.
   막으려던 취약점(역슬래시 이동)은 `safeInternalPath` 가 이미 막는다. `react-router-dom/server` → 7 에서는 본 패키지(StaticRouter) — 다시 할 때 참고.
   이용권 8자리 — 대표 확정 "6자리 유지 (추천)"(2026-11-09). 매장 확인코드 + 틀린 시도 잠금으로 막는다. 다시 묻지 말 것.

## 5차 묶음 — 대표 "더 개선 진행"
- 셀러 로그인: 정지·승인대기 응답을 **비밀번호 확인 뒤로** 옮김(비밀번호 없이 계정 존재·상태를 알 수 있었다). 상태가 막힌 계정은 실패 카운터도 안 비운다.
- 딜 후원·충전 확인 금액: `Number.isFinite` → `Number.isInteger`(소수 금액 차단).
- `GET /api/promo/preview/:code` 에 rateLimit(IP당 5분 30회).
- 가드 `security-hardening-5-2026-11-09.test.ts` + 주입 4건 전부 빨간불 확인.
- 🩸 첫 시험이 `verifyPassword(` 첫 등장을 기준으로 잡았는데, 없는 계정용 **더미 해시 호출**이 앞에 있어 주입이 통과했다 → 진짜 확인 줄로 재조준.
- ⏭️ 안 한 것: og 이미지(`/og/group-buy/:id`)가 상품 사진 주소로 302 하는 것 — http(s)만 통과시키고 이미지 미리보기 용도라 위험 낮음, 막으면 카톡 미리보기가 깨질 수 있어 보류.
- 4차(1) #2258 라이브 판정: 관리자 토큰으로 `/api/cart`·`/api/points/balance` → **403**(소비자 전용 확인).

## 6차 묶음 — 대표 "내가 할 것 제외해두고 계속 개선"
- 🩸 **4차 가드의 구멍**: "hono verify 대신 verifyLogin" 시험이 **이름을 바꿔 들여온 verify**(`verify as honoVerify` 등)를 못 봤다.
  그 틈으로 셋이 남아 있었다 → 전부 `verifyLogin`:
  - 셀러 PIN 화면의 로그인 확인(`seller-pin.routes.ts getSellerId`) — 옛 재발급 토큰으로 PIN 변경 가능했다.
  - 유튜브 연결(`youtube.routes.ts`).
  - 로그인 상태 확인 `/api/auth/session` 의 Bearer — type 없는 용도 토큰이 같은 번호 유저 세션으로 읽혔다.
- 새 가드는 **별칭까지 세고, 파일별 허용 개수**로 고정(`security-hardening-6-2026-11-09.test.ts`).
- 사업자등록증 AI 판독(`/business-registration/ocr-verify`): 10MB 제한 + IP당 시간 10회.
- 카카오 장소 프록시: `size`(1~15 정수)·`category`(3자 코드)·좌표 숫자 검증 — 쿼리 값을 카카오 주소에 그대로 붙여 파라미터를 끼울 수 있었다.
- 쓰지 않는 hono `verify` import 2곳 정리. 주입 5건 전부 빨간불 확인.
