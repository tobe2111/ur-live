# [UNLOCK_LOADING] 2026-11-10 — 장바구니 `/cart` 서버 첫 화면(머리줄 + 로더) (대표 "계속 최적화")

라이브 실측(폰 4G · CPU 4배): `/cart` HTML 0.3~0.5s · **첫 그림 2.1s**(로더-먼저만). 머리줄(닫기 · 장바구니)은 고정 모양이고 담긴 것은 API 가 와야 안다. 비로그인도 들어오는 화면이라 세션 조건이 없다.

## 잠금표 접촉
- `src/worker/index.ts`: 알림 분기 뒤에 `/cart` 분기 한 토막(같은 줄 — 2672줄 유지). UA 는 빌더 인자.
- `utils/css-first-boot.ts`: `firstScreenApplies` 폰·PC 가지에 `/cart`, `criticalSurfaceOf` → `cart`. 생성기 ROOTS·SURFACE_ROOTS(표면 CSS 28,872B).

## 본문과 SSOT
`shared/cart-page.ts` — 뿌리(`bg-warm`) · 머리줄(닫기 22px 빈 칸 · 제목 **개수 없음** · 오른쪽 빈 칸). `CartHeader` 가 같은 상수를 읽는다.
🔑 **로딩 분기도 바꿨다**: 종전엔 로딩이 **흰 바탕 + 전체 화면 로더**였다가 완성에서 `bg-warm` + 머리줄로 바뀌었다(앱 안에서도 한 번 튀던 것). 서버가 머리줄을 먼저 그리면 그 로딩 모양이 사이에 끼어 **두 번** 깜빡이므로, 로딩도 [같은 뿌리 + 머리줄(개수 0 → 안 그림) + 로더]로 맞췄다. 전체선택 줄·개수는 데이터 뒤 머리줄 **아래**로 붙는다.

## 로컬 판정(표면 CSS 로 렌더)
폰 390px: 제목 (164,21) · PC 1440px: 제목 x=689(액자 중앙). 배포 뒤: `vitals_nocb.cjs /cart`(종전 FCP 2,100) · `… pc` · CLS < 0.01.

## 가드
`cart-first-screen-2026-11-10.test.tsx` · 주입 6건 되돌려 전부 빨간불 · 재조준 5(critical-css 표면 수 17→18 · 대표 경로 · loader-first/css-first-boot/pc-list 의 "첫 화면 없는 예시" `/cart` → `/checkout` · css-first-boot.mjs 확대 주입 · consumer-popups-dark 뿌리 앵커).

## 후속(같은 날) — 비로그인은 빈 장바구니까지 서버가 그린다
배포 뒤 실측(§41): FCP 2.1 → 0.41~0.50s 인데 **LCP 는 2.0~2.5s 그대로** — 가장 큰 요소가 빈 장바구니 안내(`EmptyCart`)였고 그건 API 뒤였다. 비로그인은 `/api/cart` 가 `requireUser` 401 이라 **언제나** 빈 장바구니다 ⇒ 세션 쿠키가 없으면 [머리줄 + 빈 장바구니](로더 없음 — 화면이 완성)를, 있으면 종전대로 [머리줄 + 로더]를 그린다. `EmptyCart` 클래스·문구는 `CART_EMPTY_CLS`/`CART_COPY` 로 SSOT. 가방 아이콘은 36px 빈 칸. 주입 +3(비로그인에 로더만 · authed 미전달 · 부품 손글씨).
