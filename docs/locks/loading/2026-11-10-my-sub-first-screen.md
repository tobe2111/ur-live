# [LOADING_ADDITIVE] 2026-11-10 — 마이 하위 화면 여섯 서버 첫 화면 (대표 "계속 최적화")

주문내역(`/my-orders`·`/orders`) · 쿠폰함 · 내 리뷰 · 내 숙소 예약 · 딜 사용 내역 · 내 단골 가게. 여섯 화면은 같은 머리줄(`SubPageHeader`) 아래 목록 로더라는 같은 모양이고, 폰에서 첫 글자가 앱 부팅 뒤(1.7~1.9s)였다.

## 잠금표 접촉(추가만)
`src/worker/index.ts` HTMLRewriter 블록 — 알림 분기 앞에 `authed && mySubPageOf(url.pathname) && 폰` 한 토막 + import(같은 줄, 2672줄 유지). 기존 분기 무변경.

## 내용
- `shared/my-sub-pages.ts` — 경로 → 제목 SSOT(`mySubPageOf`). 제목은 화면의 한국어 문구(번역 파일·소스 리터럴)와 시험이 대조.
- `worker/utils/notifications-first-screen.ts` `buildMySubFirstScreen(title, loader)` — 머리줄 + 로더. 뿌리에서 `min-h-[100dvh]` 는 뺀다(로더가 화면 밖으로 밀린다).
- 첫 화면 CSS 는 알림 표면을 같이 쓴다(클래스가 부분집합) — 새 표면·ROOT 없음.
- **세션 쿠키가 있을 때만 · 폰만**(PC 는 화면마다 액자/전폭이 달라 미착수). `/wishlist`·`/my-gifticons` 는 뿌리가 달라 제외.

## 못 보는 것
세션이 필요한 화면이라 이 환경에서 라이브 실측을 못 한다 — 판정은 RUM(`/my-orders` 등 FCP) 또는 대표 폰. 한국어가 아닌 사용자는 마운트 때 제목이 번역으로 바뀐다. 알림 첫 화면은 뿌리가 100dvh 라 로더가 화면 아래에 있다(같은 처방 후보 — 미착수).

## 가드
`my-sub-first-screen-2026-11-10.test.tsx` 18건 · 주입 6건 되돌려 전부 빨간불.
