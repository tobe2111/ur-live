# 2026-10-26 카카오로 만든 에이전시 · 이메일 계정으로 옮기기 — 2단계

1단계(마이 안 구역)는 `docs/handoff/2026-10-26-agency-in-my.md` · PR #2027.

## 다음 세션의 첫 액션
배포 후 E4 — 테스트 카카오 계정으로:
1. `/agency/signup` → [카카오로] → 만들기 → 마이에 '에이전시' 구역이 뜨는지
2. 직원 시트에 "혼자 쓰는 계정이에요" + [이메일 계정으로 옮기기] (초대 칸 없음)
3. 옮기기 → 받은 메일의 버튼(`/agency/verify?kind=move&token=…`) → 마이로, 초대 칸이 열렸는지
4. 그 이메일로 `/agency/login` 로그인 → 마이 자리에 에이전시 마이
5. 카카오 로그아웃 → `/user/profile` 에 카카오로 이은 에이전시가 **안 남는지**(이메일 로그인은 남는다)
D1 확인: `SELECT id, email, user_id, pending_email FROM agency_staff WHERE user_id IS NOT NULL` (메인 DB).

## 완료 (이 PR)
- 서버 `features/agency-console/api/agency-kakao.routes.ts`(`agency-staff.routes` 가 `/` 로 끼움 — `worker/index.ts` 무접촉)
  - `POST /kakao/create` · `/kakao/session` — `requireAuth` + `csrfProtection` + 손님(`type='user'`)만. 셀러 토큰 거절.
  - `POST /move-to-email`(카카오 계정 주인만) → `pending_email`·`pending_password_hash` + 확인 메일(kind `move`, 24시간)
  - `POST /verify-move` — 링크 한 번만, 유일 인덱스가 그사이 선점을 막는다.
- 스키마: `agency_staff.user_id`·`pending_email`·`pending_password_hash` + `idx_agency_staff_user`(user_id 유일).
- 카카오 계정의 직원 행 이메일 = 자리표시 `kakao-{uid}@kakao.agency.urdeal.invalid`(SSOT `shared/agency-kakao.ts`, 화면엔 "카카오 로그인").
- 직원 초대: 카카오 계정이면 409 `KAKAO_SOLO`.
- 화면: 가입 화면 [회사 이메일로 / 카카오로] · 직원 시트 '혼자 쓰는 계정' · 구역 줄 '이메일 계정으로 옮기기' + 시트 · 인증 착지점 `kind=move` · 로그인 화면 아래 "카카오로 만든 에이전시는 카카오 로그인으로".
- 마이: 에이전시 로그인이 없으면 **한 탭에 한 번, 첫 화면 뒤**(`runAfterLoad`) `/kakao/session` 을 물어 이어 준다(코드는 그때 lazy).
- 묶음: 카카오로 이은 로그인은 `agency_console_kakao_uid` 에 그 손님 id 를 적고, 손님이 다르거나 없으면 지운다(`lib/agency-presence.ts` — 마이·마이 자리 공용, 거울 두 벌을 하나로).
- 마이 안 입력칸 다크 수정: `panelInputCls`(1단계에서 생긴 흰 바탕·흰 글자).
- 결재 문서 10-11 에 10-26 말씀 원문 + 정리 · 플랫폼 모델 행·구현 로그.
- 가드 `agency-kakao-2026-10-26.test.tsx` 19건(진짜 SQLite·실제 라우트·실제 JWT) + 주입 8건 빨간불 확인. 1단계 거울 단언·주입은 새 모듈로 재조준.

## 이번에 틀렸던 판단
- 선확인(이미 있는 에이전시?)과 user_id 유일 인덱스가 **같은 결과**를 내서, 선확인을 꺼도 시험이 통과했다(중복 잠금). 선확인은 `sqlite_sequence`(만들었다 지운 흔적)로, 인덱스는 직접 INSERT 로 따로 쟀다.
- 인증성 요청(`verify` 가 이름에 든 레이트리밋)은 저장소가 없으면 429 로 **닫힌다** — 시험 픽스처에 표가 없어 처음엔 429 가 났다(코드는 맞다).

## 못 잰 것
- 실제 카카오 세션 쿠키 경로(시험은 Bearer 손님 토큰) · 메일 배달 · 화면 렌더(카카오+에이전시 두 신원은 하네스가 못 심는다).
- 첫 방문 손님 마이에 요청 하나가 늘었다(한 탭 한 번, load 뒤) — 카카오 에이전시가 있는 사람은 구역이 늦게 뜨며 아래 손님 줄이 밀린다(드물다).

- 사장님의 '에이전시에 맡기기'는 **에이전시 관리자 이메일**로 찾는다(`seller-agency-link.routes.ts`) — 카카오 계정은 이메일이 없어 이 길로는 안 찾아진다. 카카오 에이전시는 **매장 초대 링크**로 매장을 받는다(이메일로 옮기면 두 길 다 열린다).

## 남은 결정
- 없음. (소개서 다운로드 버튼은 제안서 PDF 가 옛 모델이라 보류 — 별건.)
