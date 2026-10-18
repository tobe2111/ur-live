# 2026-10-18 화면별 무게 예산 — 10개 상한 밖을 못 보던 구멍

## 무엇이 문제였나
`check-surface-budgets` 가 손님 화면의 봉투를 **route-chunk-map**(워커 미리받기 맵)에서 읽었다. 그 맵은 head 링크 스팸을
막으려고 js 를 **10개(`MAX_LINKS`)에서 자른다** ⇒ 11번째부터는 무게 예산에서도 안 보였다.
- #1912 에서 stayDetail 이 **아무것도 안 늘었는데 +6.0KB** 로 빨간불(다른 봉투 하나가 사라져 11번째였던 `lz-vouchers` 가 상한 안으로 들어옴).
- 반대 방향이 더 나빴다 — 11번째 뒤로 30KB 가 붙어도 초록.

## 고친 것
- 손님 화면도 대시보드처럼 **매니페스트 정적 폐쇄**로 잰다(`routeSurfacesFrom` = `closureSurfacesFrom(…, '')`, 상한 없음).
- 맵은 **대조**에만 쓴다 — `mapSubsetErrors`: 맵의 js 가 폐쇄의 부분집합이 아니면 실패(생성기·측정기가 다른 진입점을 읽는 것 차단).
- 기준 재잠금(코드 변화 0, 사유 기록). 드러난 숨은 무게:
  | 화면 | 종전 | 정정 | 숨어 있던 것 |
  |---|---|---|---|
  | cart | 233.3 | 266.4 | **lz-gbDetail 16.2**(이용권 상세 코드!) · embla 6.5 · lz-productL 3.7 · app-cart 3.7 |
  | guestMy | 224.1 | 249.7 | embla 6.5 · app-utils-deferred 6.4 · lz-product 5.6 · lz-productL 3.7 |
  | stayDetail | 222.0 | 229.9 | lz-home-homePc-vouchers 5.8 |
- 시험 ④ 4건 + 주입 3건(되돌려-검증 8/8 빨간불).

## 다음 세션 첫 액션
**장바구니가 이용권 상세 코드 16KB 와 캐러셀(embla) 6.5KB 를 첫 화면에 정적으로 받는다.** `CartPage` 의 정적 import 폐쇄에서
`lz-gbDetail`·`embla` 를 끌고 오는 모듈을 찾아(`dist/client/.vite/manifest.json` 의 imports 를 거꾸로 따라간다) lazy 로 내릴 수 있는지 볼 것.
guestMy(로그아웃 마이)도 embla·상품 상세 봉투를 받는다 — 같은 원인일 가능성. 줄이면 `--rebaseline`(개선 잠금).

## 이번에 틀렸던 판단
- 처음엔 이 구멍을 "#1912 의 측정 착시" 로만 봤다. 정정해 보니 **실제 화면 셋이 25~33KB 를 숨기고 있었다** — 착시가 아니라 가드의 눈먼 자리였다.
