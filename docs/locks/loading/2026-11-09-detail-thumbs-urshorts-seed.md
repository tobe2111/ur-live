# [LOADING_ADDITIVE] 2026-11-09 — 이용권 상세 썸네일 2칸 preload · 유어쇼츠 목록 시드 주입

대표: *"유어쇼츠도 그렇고 너무 늦는데?"* + 상세 캡처(큰 사진 아래 **검은 상자 둘**).

## 잠금표 접촉
- `src/worker/index.ts` HTMLRewriter SSR inject 블록 — **추가만**(새 preload 헤더 2종 · `/urshorts` 시드 주입 해제). 기존 4페이지 inject·`caches.default.match` 무변경. 줄 수 2672 유지(한 줄 안에 붙임).

## 무엇이 느렸나(라이브 실측, Pixel 7 흉내)
- 상세: 썸네일 2칸이 CSS `background-image` 라 늦게·낮은 우선순위로 받고, 칸 색이 `#1D1F29`(다크 카드색) 리터럴이라 **라이트 화면에 검은 상자**로 떴다.
- `/urshorts`: 1.5초 '페이지 로딩 중…' → 목록 `?all=1` 이 앱 뒤 2.2초 출발 → 썸네일 4초. 워커는 그 시드(`/api/urshorts`, 예열 키)를 **크롤러 본문에만 쓰고 버렸다**(`ssrPayload = null`).

## 처방
1. 칸 색 `DETAIL_THUMB_PLACEHOLDER = color-mix(var(--ink) 8%, var(--surface))` — 서버·React 같은 값(shared).
2. 상세·숙소 상세: 폰이면 두 칸 사진을 `Link: rel=preload; as=image; fetchpriority=auto` 로(히어로 high 와 안 다툰다). `appendLcpLink` 에 priority 인자 추가(기본 high — 종전 호출 무변경).
3. `/urshorts`: 시드를 `__SSR_INITIAL_URSHORTS__` 로 주입 + 첫 두 썸네일 preload(auto). 화면은 시드를 첫 렌더에 그리고 **그래도 `?all=1` 전량을 받아 갈아끼운다** — 2026-10-13 규율("10편이 전량을 대체하면 안 된다")은 그대로다. eager 카드 2→4(2열×2줄).

## 가드
- `detail-mobile-thumbs-2026-10-27.test.tsx` +2 · `urshorts-seed-2026-11-09.test.tsx` 7건 · 주입 `detail-thumbs-preload-2026-11-09.mjs`(2) · `urshorts-seed-2026-11-09.mjs`(3) · 재조준 3(lcp-image-link · voucher-facet-body · seo-region-encoding) — 전부 되돌려 빨간불 확인.

## 못 보는 것
- 실제 네트워크 순서·체감(배포 뒤 라이브 실측으로 판정). `color-mix` 미지원 브라우저(2023 이전)는 칸이 투명(흰 면) — 검은 상자보다 낫다.
