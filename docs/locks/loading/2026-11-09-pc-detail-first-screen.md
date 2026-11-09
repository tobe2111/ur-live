# [UNLOCK_LOADING] 2026-11-09 — 이용권 상세 **PC(lg+) 서버 첫 화면** (대표 승인 — 2026-09-16 "PC 는 안 그린다" 대체)

라이브 실측(1440px · 4G · CPU 4배): PC 상세 첫 글자 0.76s(빵부스러기) · **LCP 2.47s** — 큰 사진이 앱 코드 뒤에야 그려졌다.

## 잠금표 접촉
- `src/worker/index.ts` DETAIL 분기 한 줄: `buildDetailFirstScreen(…, url.search, isMobileUserAgent(ua))` — UA 인자 추가(줄 수 2672 유지).
- `utils/css-first-boot.ts` `firstScreenApplies` PC 가지에 `/pass|group-buy/:id` 추가(detail 표면 CSS 를 PC 에도 인라인).
- `GroupBuyDetailPage.tsx`(잠금표) **무변경** — 클래스는 `shared/detail-pc-first-screen.ts` 로 옮겨 적고 시험이 원본 소스와 글자 대조.

## 2026-09-16 의 이유 셋을 어떻게 풀었나
1. 2열 그리드 → **그리드 통째로**(좌 열 + 우 360px 빈 `<aside>`). 반쪽이 아니라 마운트 때 가로가 안 줄어든다.
2. 제목 헤더의 SVG(핀) → 15px 빈 칸. 별점은 React 도 글자 ★ 라 그대로.
3. "PC 는 빨리 파싱" → 실측 2.47s. 그리고 PC 손님은 공유 링크로 들어오는 경우가 많다.

## UA 로 가른다
폰 본문엔 PC 블록을, PC 본문엔 폰 슬라이드·`<img>` 를 **넣지 않는다** — `display:none` 인 `<img>` 도 받아지므로 둘 다 넣으면 사진을 두 벌 받는다. 크롤러는 폰 본문(`shouldRenderMobileFirstScreen`).

## 못 보는 것
마운트 때 픽셀 이동(배포 뒤 PC 뷰포트 CLS 실측) · 우측 구매 박스는 상태가 있어야 그려지므로 빈 칸(React 가 채운다 — 좌 열은 밀리지 않는다).

## 가드
`detail-pc-first-screen-2026-11-09.test.tsx` 30건(진짜 `DetailTitleHeader` 렌더 대조 포함) · 주입 4건 되돌려 빨간불 · css-first-boot PC 가지 재조준.
