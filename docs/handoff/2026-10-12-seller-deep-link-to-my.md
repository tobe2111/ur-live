# 셀러 대시보드 제거 3단계(사장님 몫) — 깊은 링크도 마이에서 (2026-10-12)

서비스: 🎟️ 유어딜(셀러 도구) · 머니 경로 없음 · 등급 A(화면 경로만)
대표: *"셀러 대시보드를 없애는 것을 목표로 하고 마이에서 모두 다 할 수 있게"* → *"머지하고, 또 해야할 건?"* → *"한글로 앞으로 설명해주고 계속"*

## 다음 세션의 첫 액션
1. 이 PR CI 초록 확인 → 대표 지시 있으면 머지. (#1713 머지 뒤 main 위에 올린 브랜치다.)
2. 배포 후 E4: 카카오 사장님 계정으로 알림톡/메일의 `/seller/orders` 링크를 눌러 **마이 + '주문 관리' 시트**가 뜨는지.
   에이전시 직원 좌석으로 같은 주소를 열면 **대시보드 그대로**인지.
3. 로드맵 2단계(에이전시 콘솔에서 매장 판매 화면을 시트로) — 시안 먼저 대표에게.

## 한 것
- `src/lib/seller-deep-link.ts` — 판정 한 곳(`shouldSendOwnerToMy` 이사 · `myRedirectFor` · `readToolParam` · `dashboardFallback`)
- `SellerLayout` — 시트 안 반환 **뒤에** `<Navigate>` (시트 안에서 튕기면 마이가 사라진다)
- `useToolDeepLink`(판매 구역) — 좌석 맞으면 시트 열고 주소에서 `tool` 지움 / 안 맞으면 `?dash=1` 로 대시보드
- `useToolDeepLinkFallback`(마이 페이지) — 가게 목록 실패·0곳이면 판매 구역이 마운트조차 안 되므로 페이지가 되돌린다
- `ToolPageSheet` — 머리 이름을 못 받으면 나브 색인에서 찾는다(`titleForPath`)
- 가드 `seller-deep-link-to-my-2026-10-12.test.tsx` 33건 + 주입 9건 전부 빨간불 확인

## 틀렸던 판단
- 훅을 처음엔 `useLocation` 으로 짰다 — 판매 구역은 라우터 밖에서도 렌더되는 부품이라(시험 `my-awaiting-shell`) 거기서 터졌다.
  `window.location` + `history.replaceState` 로 바꿨다.
- 시험 셋업이 `window.location` 을 평범한 객체로 바꿔 둔다(`tests/setup.ts:141`) — `history.replaceState` 가 location 을 안 바꾼다.

- 판정 함수를 `SellerPage` 에서 옮기고 시트 머리 이름을 `shownTitle` 로 바꾸면서 **다른 가드의 주입 앵커 셋이 낡았다** —
  내 테스트·내 주입만 돌리고 `check-stale-mutation-anchors` 를 안 돌려서 푸시 게이트가 잡을 때까지 몰랐다. 재조준(결함 그대로, 자리만).

## 대기
- 진입점 없는 둘(위탁 `consignment` · `plus-friend-guide`)은 3단계를 막지 않는다 — 둘 다 그대로 둔다(결재 `2026-09-28-dead-seller-screens.md`).
