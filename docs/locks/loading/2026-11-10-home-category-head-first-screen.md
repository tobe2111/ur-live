# [LOADING_ADDITIVE] 2026-11-10 — 홈 `?category=` 머리 첫 화면 (대표 "계속 최적화")

#2298 이 그 주소에서 전체 홈 첫 화면을 걷은 뒤 라이브 실측: 첫 글자 0.85s → **2.9~3.7s**. 머리(로고 · 위치 · 카테고리 줄)는 카테고리와 무관하게 같은 모양이라 서버가 그릴 수 있다.

## 잠금표 접촉(추가만)
`src/worker/index.ts` HTMLRewriter 블록 — 폰 홈 분기 **앞**에 `homeCategoryOf(url.search)` 일 때의 분기 한 토막 + import(같은 줄, 2672줄 유지). 전체 홈 분기는 글자 그대로.

## 내용
`worker/utils/home-first-screen.ts` `buildHomeCategoryFirstScreen(category, loader, cookie)` — 전체 홈과 같은 `chromeHtml`(사진 머리·위치 라벨은 같은 쿠키 판정)에 켜진 탭만 그 카테고리, 그 아래 로더(34dvh). 목록은 그리지 않는다(시드 없음 · 새 캐시 키 0). 첫 화면 CSS 는 홈 표면 그대로(경로가 `/`).

## 못 보는 것
머리 아래(정렬 줄 · 목록)는 여전히 앱 마운트 뒤 · 로더 → 목록 전환 때의 밀림은 로더가 화면 흐름 밖이라 없을 것으로 보지만 배포 뒤 잰다.

## 가드
`home-category-first-screen-2026-11-10.test.ts` 7건 · 주입 7건(이번 추가 2).
