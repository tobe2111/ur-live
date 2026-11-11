# [LOADING_ADDITIVE] 2026-11-11 — `/products/:id` 가 이용권·교환권·숙소면 서버가 정본으로 바로 302 (대표 *"아직 개선할 게 많다니까. 계속 최적화 해 대기업급으로"*)

핀 공유 주소(#2311)와 같은 클래스를 입구 주소 15개에서 찾았다(문서 요청·주소 변화 추적, 폰 4G·CPU 4배):

```
/products/2919(이용권)  200 쇼핑 상세 껍데기 → 앱 부팅 → 상품 조회 → navigate(/pass/2919)   누름→첫 글자 2.0s
/pass/2919              바로                                                              0.7s
```

## 잠금표 접촉(추가만)
`src/worker/index.ts` — `ssrSlot` 을 정하는 줄 끝에 한 토막 + import(2672줄 유지). SSR inject 블록·시드 조회 무접촉(이미 받아 둔 PRODUCT 시드를 읽기만 한다 — 새 조회 0).

## 머니 경로
접촉 없음 — **쿼리가 없는 주소만** 넘긴다. `/products/:id?ref=…` 는 `ProductDetailPage` 가 넘기기 전에 소개자를 기기에 적으므로(귀속) 종전 그대로 앱이 처리한다.

## 판정
화면과 같다: 몰 상품이면 손대지 않고(`mallRedirectPathFor`), 아니면 `canonicalDetailPath`(교환권 `/vouchers` · 숙소 `/stays` · 이용권 `/pass`). 시드의 상품 번호가 주소와 다르면 넘기지 않는다.

## 롤백
그 한 토막 제거 → 종전(앱이 넘긴다). 화면의 안전판(`ProductDetailPage`)은 그대로 있다.

## 같은 훑기에서 본 것(미착수)
- `/videos`(유어쇼츠 뷰어): 첫 글자 1.5~1.7s · LCP 3.0~3.2s — 서버 첫 화면이 없다. 대부분 앱 안에서 들어오는 화면.
- `/my-store` → `/user/profile` 은 앱이 넘긴다(1.6s) — 로그인 화면이라 서버 301 후보.
- 별칭 301(`/browse`·`/business`·`/creators`·`/group-buy/:id`)은 이미 서버가 넘긴다.

## 가드
`product-canonical-redirect-2026-11-11.test.ts` 14건 · 주입 5건(하나는 귀속 방향).
