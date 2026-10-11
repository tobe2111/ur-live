# 2026-10-11 에이전시 1단계(PR-A) — 이메일 전용 계정 · 로그인(안 A) · 직원 초대

서비스: 🎟️ 유어딜(소비자 플랫폼의 운영 주체). 머니 경로 접촉: **없음**(계정·로그인·직원만).

## 다음 세션의 첫 액션
1. PR 머지·배포 뒤 라이브 판정(E4):
   - `curl -sS https://urdeal.kr/api/agency-console/me -H "User-Agent: Mozilla/5.0"` → **401 `AGENCY_AUTH_REQUIRED`** 이면 마운트·인증 정상.
   - 브라우저 `/login` 맨 아래 "에이전시이신가요? · 에이전시 로그인" → `/agency/login` 이 뜨는지.
   - `/agency/signup` 으로 실제 업무 메일 하나 가입 → 인증 메일 도착 → 링크 → `/agency` 콘솔 → 직원 초대 메일 → 합류. (메일 발송은 `sendSystemEmail` — 라이브에서만 판정된다.)
2. 2단계(PR-B): 매장 연결(사장님이 에이전시에 운영을 맡김) + 직원 매장 좌석 토큰 + 가드. 결정 파일의 규칙 1~4 참조.
3. 3단계(PR-C, 머니 — 단독 세션 + staging 실결제): 중개 매장 4곳 이전 · 몫 규칙 1~3 · 정산 분리.

## 완료분
- 서버: `src/features/agency-console/api/` — `agency-schema.ts`(테이블 3개, WeakSet 메모) · `agency-session.ts`(**별도 서명 열쇠**·매 요청 DB 대조) · `agency-auth.routes.ts`(가입·인증·로그인·재설정·me) · `agency-staff.routes.ts`(직원 목록·초대·재발송·내보내기·합류·정보수정). 워커 마운트 `/api/agency-console`.
- 화면: `src/pages/agency-console/` 6화면 + `src/routes/agency-console.routes.tsx`. 손님 `/login` 입구 한 줄 + 6개 언어. 손님 이메일 로그인에 에이전시 이메일 → `AGENCY_ACCOUNT` 안내.
- 일몰 시험 재고정(`agency-sunset-final.test.ts` — 새 것은 목록 6개뿐, 옛 것은 계속 막힘) · 신규 시험 `agency-console-2026-10-11.test.ts` · 주입 8건(`scripts/mutations/agency-console-2026-10-11.mjs`) 전부 빨간불 확인.
- robots `Disallow: /agency$` · `/agency/` (`/agency-partner` 를 삼키지 않게 앵커).
- `check-internal-links.mjs` 라우트 파일 목록을 손 목록 → `src/routes/*.routes.tsx` 파생으로.
- `src/lib/api.ts`: `/agency` 화면에서 소비자 401 이 와도 `/agency/login` 으로 하드 이동하지 않게(가입·합류 화면 보호).
- 문서: 플랫폼 모델 §2·§4·§14·구현 로그 · CLAUDE.md 명칭 표 · 시안 문서 체크리스트 · 결재 파일 반영 커밋.

## 이번에 틀렸던 / 조심할 판단
- **공용 `requireAuth()` 는 `JWT_SECRET` 으로 서명된 토큰이면 종류를 안 가리고 `sub` 를 사용자 id 로 쓴다.** 직원 토큰을 같은 열쇠로 서명했다면 직원 3번이 소비자 users.id=3 으로 통했다. 열쇠를 `${JWT_SECRET}::agency-console:v1` 로 가르고 `sub` 를 안 쓴다 — 시험이 실제 서명·검증으로 잰다.
- 옛 잔재(`kakao.routes.ts issueLinkedRoleTokens` 의 `agency_token` — 잠금 파일, `api.ts` 의 옛 refresh 분기)는 **안 건드렸다.** 새 콘솔은 다른 토큰 자리(`agency_console_token`)라 섞이지 않는다.
- `check-internal-links` 가 라우트 파일을 손 목록으로 들고 있어 새 라우트 모듈이 "없는 라우트" 로 보였다 — 반대 방향(라우트가 빠짐)이었으면 조용히 헛돌았을 것.

## 남은 결정/대기
- `docs/decisions/2026-10-11-broker-share-switch-off.md` (open) — 대표가 어드민에서 `broker_share_enabled` 를 끌지.
- 2단계 착수 시점.

## 🔴 2026-10-11 후속 — 라이브에 메일 발송 설정이 없다 (실측)

- CF Pages `ur-live` production env 를 읽기 API 로 조회: **`RESEND_API_KEY` 없음 · `RESEND_FROM` 없음**
  (`FRONTEND_URL` 은 있음). `/api/version` 의 `secrets.RESEND_API_KEY` 도 `false`.
- 그 상태에서 공용 `sendSystemEmail` 은 **조용히 건너뛴다**(skipped) — 에이전시 가입은 "메일을 보냈어요" 를
  띄우는데 인증 메일이 영영 안 와 **들어올 방법이 없다**(가입·초대·비밀번호 찾기의 유일한 문이 메일 링크).
- 처방(이 PR): `agencyMailReady(env)` = 키와 보낸 사람 주소가 **둘 다** 있어야 준비됨. 아니면 가입·비번찾기·
  초대·다시보내기 네 자리가 **503 `MAIL_NOT_CONFIGURED`** 로 멈추고 화면에 그 문장을 띄운다(가입은 계정 행을
  만들기 전에 멈춘다). 그리고 에이전시 계정 메일은 `ignorePreference` 로 소비자 알림 수신 끔에 안 막힌다.
- **대표 작업 필요**: Cloudflare → Workers & Pages → ur-live → Settings → Variables and Secrets 에
  `RESEND_API_KEY`(Resend 키) · `RESEND_FROM`(예: `유어딜 <no-reply@urdeal.kr>` — Resend 에서 urdeal.kr 도메인
  인증 필요) 등록. 이 둘이 생기기 전까지 에이전시 가입은 "지금은 메일을 보낼 수 없어요" 로 멈춘다.
- ⚠️ 같은 원인으로 **사이트 전체의 시스템 메일**(주문·알림 메일 등)도 지금 안 나가고 있을 가능성이 높다 — 이번
  범위 밖이라 손대지 않았다. 다음 세션이 `sendSystemEmail` 호출처(7곳)와 `email_failures` 를 확인할 것.
