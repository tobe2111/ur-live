# 매장 계산대 화면 간결화 (2026-11-03)

대표: *"너무 필요이상으로 글자가 많아. 심플하고 간결하며 세련되게 만들어줘. 페이지를"* (매장 계산대 스크린샷)

## 완료분
- `StoreScanPage` — 안내 두 문단 삭제, 머리 가게 아이콘 삭제, 가게 이름을 머리 오른쪽 알약 한 칸으로.
- `VoucherScanner` — '사진으로 읽기' 테두리 버튼 → 조용한 글자 버튼.
- 되돌릴 수 없다는 경고는 사용 처리 **확인창**(2026-10-06)이 한다 → 가드 `seller-inline-seat-2026-09-25` 재조준 + 주입 재조준.

## 이번에 틀렸던 판단
- 없음. 다만 '찍기 전에 경고' 가드가 머리 문구에 묶여 있었다 — 확인창 도입(10-06) 뒤엔 그 자리가 확인창이다.

## 대기
- 같은 날 대표 신고 *"로그인을 했는데도 왜 이렇게 뜨지?"*(PC 계정 메뉴가 손님용) — 원인 미확정. 헤더는 `hasConsumerSession()`
  (localStorage `user_id`/`session_login`)만 본다. 카카오·이메일 소비자 로그인은 둘 다 그 값을 쓰므로, 에이전시·사장님 로그인만 한
  상태일 가능성이 높다. 어떤 로그인이었는지 대표 확인 대기.

## 추가 (같은 날)
- 대표 *"매장 계산대 시안도 보여주고 만들어야지"* → PR #2140 자동 머지 **해제**, 시안 안 A(구현분)·안 B(카메라 전체) 제시. 선택 대기.
- 로그인 표시 문제 — 대표 *"카카오로 로그인 했어"*. 실측: user 3 `last_login_at` 13:00 KST · kakao-login-diag desktop_chrome `establish_ok` ·
  헤더 찜 배지 1(서버는 소비자로 인증) ⇒ **서버 세션은 살아 있는데 localStorage `user_id`/`session_login` 만 비어 있다.**
  지운 주체는 못 좁혔다. 처방: 부팅 때 역할 토큰만 있고 소비자 흔적이 없으면 탭당 1회 `/api/auth/session/health` 로 되살림
  (`auth-callback-bootstrap.ts` + `lib/consumer-session-event.ts` + DesktopTopNav 재그리기). 가드 `consumer-session-restore-2026-11-03` + 주입 3.
- ⚠️ 이번에 틀렸던 판단: 처음엔 "에이전시 로그인만 한 상태일 것" 이라고 추정했다 — 대표는 카카오였다. 찜 배지(=서버 인증)를 먼저 봤으면 바로 알았다.
- ✅ 대표 *"안 B로 해줘"* → 안 B 구현(FullScanView · UseConfirmSheet 분리). 가드 store-scan-plan-b-2026-11-03 + 주입 2, 재조준 4.
- 🪟 대표 *"카메라를 열 수 없어요 저 팝업 디자인, 팝업 디자인 통일화하기로 한대로"* → 카메라 위 오류·결과를 토스트와 같은 유리 알약(`ur-glass ur-pop-toast`)으로, 도움말은 유리 판. 렌더 `docs/design/assets/store-scan-glass-2026-11-03.png`.
