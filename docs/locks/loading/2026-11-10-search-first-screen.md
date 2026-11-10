# [UNLOCK_LOADING] 2026-11-10 — 검색 화면 `/search` 서버 첫 화면 (대표 "계속 최적화")

라이브 실측(폰 4G · CPU 4배): `/search` HTML 0.3~0.5s · **첫 그림 2.25s**(로더-먼저만 걸려 있어 토큰판 + 로더뿐). 헤더(뒤로 · 검색창 · 가방)와 빈 검색 안내(유달이 · 두 줄)는 전부 고정 모양인데 앱 코드가 다 와야 그려졌다. 홈 머리의 돋보기를 누르면 바로 보는 화면이다.

## 잠금표 접촉
- `src/worker/index.ts`: 지도 분기 뒤에 `/search` 분기 한 토막(같은 줄 — 2672줄 유지). UA 는 조건이 아니라 빌더 인자. `buildStaticSurfaceNoscript` 는 종전 catch-all 과 같게 뒤에 붙인다.
  🩸 첫 판은 그 줄 **꼬리 주석 뒤에** 코드를 붙여 통째로 주석이 됐다 — tsc 도 텍스트 시험도 초록이었고 **주입 검사**(`워커가 폰에만 그린다` → "주입 대상이 주석에만 있다")가 잡았다. 긴 한 줄 분기에 덧붙일 땐 `// ` 앞인지 반드시 볼 것.
- `utils/css-first-boot.ts`: `firstScreenApplies` 폰·PC 가지에 `/search`, `criticalSurfaceOf` → `search`. `generate-critical-css.mjs` ROOTS·SURFACE_ROOTS 에 `search-first-screen.ts`(표면 CSS 30,235B · 상한 40,000 안).

## 본문
[헤더(쉬는 상태 — 포커스 전 테두리·돋보기 path 는 공유 상수, 뒤로·가방 아이콘은 같은 크기 빈 칸)] + [검색어 없음: 유달이 96px eager + 안내 두 줄] + 로더(34dvh).
검색어가 있으면 입력창에 되돌려 넣고(`escAttr`) 결과 자리는 로더(API 가 와야 안다 — self-fetch·새 캐시 키 0).
최근 검색어는 기기 저장값이라 서버가 모른다 → 바로 뒤 스크립트가 `recent_searches_v1` 이 비어 있지 않으면 안내 그림을 걷어낸다(React 가 그 자리에 칩).
PC: `/search` 는 430 액자(풀폭 목록에 없다) → 게스트 탭과 같은 [네비 높이 예약 + 액자] 상수.

클래스·문구 SSOT `shared/search-page.ts` — `SearchPage`·`SearchHeader`·`SearchStates` 가 같은 상수를 읽는다(손으로 적은 클래스 0, 시험이 대조). 유달이는 `priority`(첫 화면 자리).

## 로컬 판정(표면 CSS 로 렌더)
폰 390px: 검색창 (52,8) 290×44 · 안내 (20,100). PC 1440px: 검색창 x=557(= (1440−430)/2 + 52) · y=121(= 네비 113 + 8). 배포 뒤: 폰 `vitals_nocb.cjs /search`(종전 FCP 2.25s) · PC `/search pc` · CLS < 0.01.

## 못 보는 것
최근 검색어가 있는 사람의 마운트 모양(서버는 그 자리를 비운다 — 안내 → 칩이 아니라 빈칸 → 칩) · 인기 검색어 섹션은 마운트 뒤 아래로만 붙는다.

## 가드
`search-first-screen-2026-11-10.test.tsx` 31건 · 주입 8건 되돌려 전부 빨간불 · 재조준 3(css-first-boot ⑤ · loader-first ①③ · critical-css 표면 수 14→15 + 대표 경로).
