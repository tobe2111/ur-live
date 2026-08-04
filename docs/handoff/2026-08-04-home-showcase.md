# 인계 — 홈 쇼케이스 ①③④ (2026-08-04)

대표 요청 5가지 중 **②도시별 · ⑤구글 사이트링크는 이미 머지**(PR #1037·#1039).
이 세션은 나머지 **① 카테고리 섹션+더보기 · ③ 중간 배너 · ④ 히어로 배너(이미지/영상)** 를 구현했다.
설계 SSOT: `docs/design/home-showcase-2026-08.md`.

## 다음 세션의 첫 액션

**배포 후 라이브에서 확인할 것 — 코드로는 판정이 안 되는 부분이다.**

1. **아무것도 안 올렸을 때 홈이 그대로인가** (대표 확정 규칙 ①)
   `https://urdeal.kr/` PC 로 열어 히어로·섹션·배너가 **하나도 안 보이는지**.
   지금 DB 에 `homepage_sections` 행도, `banner_type='hero'` 배너도 없으므로 **현행 홈과 픽셀 동일해야 한다.**
   → 뭐라도 보이면 그건 버그다(플래그 OFF 로 즉시 원복).

2. **어드민에서 하나씩 켜 보기**
   - `/admin/banners` → "새 배너" → 자리 **히어로** + 이미지 URL → 홈 최상단에 뜨는지
   - 같은 배너에 **영상 URL** 추가 → 배경이 영상으로(무음·자동재생·반복), 로딩 동안 이미지가 표지로 뜨는지
     ⚠️ **모바일 사파리에서도 재생되는지 반드시 확인** — `muted`·`playsInline` 을 넣었지만 실기기 확인이 유일한 판정이다.
   - `/admin/home-sections` → "새 섹션" → 규칙 **인기순** → 홈에 줄이 생기는지
   - 규칙 **마감 임박** 으로 하나 더 → **상품이 없으면 그 줄이 아예 안 나오는 게 정상**이다(고장 아님)

3. **컬럼이 실제로 생겼는지** (둘 중 하나면 충분)
   `POST /api/_internal/repair-schema` 실행 후, 또는 `/api/banners?type=hero` 가 200 이면 ALTER 가 돈 것.

## 완료분

| 무엇 | 어디 |
|---|---|
| SSOT(자리·소스·클램프) | `src/shared/constants/home-showcase.ts` |
| 배너 자리 + 영상 컬럼 | `banners.banner_type`(기본 `inline`) · `banners.video_url` |
| 섹션 규칙 컬럼 | `homepage_sections.source`/`source_value`/`limit_count`/`more_href` |
| 규칙 해석기 | `src/features/sections/api/section-rules.ts` |
| 소비자 컴포넌트 3종 | `src/components/home/{HomeHeroBanner,HomeBannerStrip,HomeSections}.tsx` |
| 홈 배선 | `src/pages/pc-home/PcHomePage.tsx` — `HOME_SHOWCASE_ENABLED` 게이트 |
| 어드민 | `/admin/banners`(자리·영상) · `/admin/home-sections`(신규) |
| 불변식 | `src/tests/unit/home-showcase.test.ts` 24건 |

검증: tsc 0 · build 0 · **vitest 4937 pass(377 파일)** · audit-gate **ALL GREEN 87** · critical-chunks 17(불변).

## ⚠️ 이번에 틀렸던 판단 (다음 세션이 같은 함정에 안 빠지게)

1. **가드가 헛돌았다 — 플래그 게이트 테스트가 게이트를 지워도 초록이었다.**
   `HOME_SHOWCASE_ENABLED` 가 파일 어딘가에 있으면 통과하게 짰는데, **import 줄이 항상 먼저 나와서**
   렌더 게이트를 통째로 지워도 통과했다. 손으로 결함을 주입해 보고서야 알았다(5개 중 1개만 헛돌았다).
   → 지금은 게이트 **블록 범위를 중괄호로 계산**해 모든 렌더 위치가 그 안에 있는지 본다.
   **교훈: "심볼이 파일에 있다"는 배선 검사가 아니다.** 이 레포가 이미 여러 번 당한 클래스다.

2. **카드 링크를 손으로 찍었다가 숙소를 틀린 상세로 보낼 뻔했다.**
   처음엔 `getProductFlow` 결과로 `/vouchers` ↔ `/group-buy` 이지선다를 짰는데,
   ⓐ `ProductFlow` 는 객체가 아니라 문자열 유니온이라 `.kind` 가 아예 없었고(tsc 가 잡음)
   ⓑ 진짜 SSOT 는 **`canonicalDetailPath`** 이며 그건 **숙소를 `/stays/:id`** 로 보낸다.
   내 이지선다는 숙소 카드를 객실·날짜 없는 상세로 떨어뜨렸을 것이다.
   → **상세 경로는 `canonicalDetailPath` 하나만 쓴다.** 테스트가 하드코딩 삼항의 부활을 막는다.

3. **수동 섹션 쿼리에 몰 격리가 없었다.** 규칙 쿼리에는 넣고 기존 `section_products` JOIN 은 그대로 뒀는데,
   그러면 운영자 SaaS 몰 상품이 유어딜 홈 섹션에 섞인다. 2026-08-03 지역 집계와 **똑같은 누락**이다.
   → **소비자 집계 쿼리에는 `mainScopeFor` 가 기본값이라고 생각할 것.**

## 남은 결정 / 대기

- **모바일 홈**: 손대지 않았다(풀스크린 지도 `RestaurantMapPage`). 배너·섹션을 지도 위에 얹을지는 대표 판단.
- **수동(`manual`) 섹션의 상품 담기 UI**: 지금 어드민은 규칙 섹션 생성·삭제·노출토글까지다.
  `manual` 로 만들면 `POST /api/sections/:id/products` 를 직접 호출해야 상품이 담긴다(화면 없음).
  규칙 섹션만으로 시안이 충족돼 뒤로 미뤘다 — 필요해지면 그때 만들면 된다.
- **섹션 순서 변경 UI**: API(`POST /api/sections/reorder`)는 있고 화면은 없다.
