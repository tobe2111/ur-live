# 2026-08-03 — 도시별 색인 페이지(`/region/*`) + 메인 SEO 토대

## 대표 요청 (여기어때 메인 전체 스크린샷 첨부)

1. 메인을 카테고리별 섹션 + 더보기로
2. 도시별로도 보이게
3. 중간중간 배너(여기어때식)
4. 정형화된 히어로 배너 — 배경 이미지/영상
5. 구글 검색에 페이지가 쭉 나오게(사이트링크)

→ 대표 선택: **② 도시별 + ⑤ SEO 부터.** 추가 지시:
   - *"쓸만한 것만 차용"* (여기어때 전부 따라하지 않음)
   - *"배너를 올리지 않으면 배너는 아예 메인에서 보이지 않도록"*
   - *"이전으로 돌아갈 수도 있게끔 해두자"* → 기능 플래그

## 이번에 한 것

`REGION_PAGES_ENABLED`(`src/shared/feature-flags.ts`) 하나로 전면 롤백되는 도시별 색인 페이지.

| 파일 | 역할 |
|---|---|
| `src/shared/constants/region-slugs.ts` | **행정 지역 SSOT** — 주소 정규화·파싱·URL 왕복·색인 문턱 |
| `src/features/group-buy/api/regions.routes.ts` | `GET /api/regions` — 지역별 딜 집계(페이지·그리드·sitemap 공용) |
| `src/pages/region/RegionPage.tsx` | `/region/:sido[/:sigungu]` 착지 페이지 |
| `src/pages/region/RegionIndexPage.tsx` | `/region` 허브(전 시/도 펼침) |
| `src/components/region/RegionLinkGrid.tsx` | 텍스트 링크 그리드(여기어때 하단 차용) ⚠️ `components/main/` 에 두면 eager 청크로 들어간다 |
| `worker/utils/surface-ssr-meta.ts` `resolveRegionSeo` | 서버 메타(Yeti 대응) — **워커 전용**(클라 크리티컬 모듈에 두지 말 것) |
| `sitemap.routes.ts` | 지역 URL 발행(문턱 통과분만) |
| `SiteFooter.tsx` | `/region` 허브 링크 |

URL 은 **한글 경로**(`/region/서울/중구`). 시군구 229개 로마자 표는 유지비용·오타 위험이 크고,
한글은 주소 텍스트와 정확히 일치해 매칭 드리프트가 0 이다. 바꾸고 싶으면 `regionPath()` /
`parseRegionPath()` 두 함수만 고치면 된다(그러라고 만든 간접층).

## 실측이 설계를 바꾼 지점 (추측 아님 — 라이브 329건 전수)

- **카테고리별보다 도시별이 압도적.** 카테고리는 페이지가 **4개**뿐이고(meal 224 / stay 72 /
  etc 22 / beauty 11) 경쟁이 야놀자·여기어때·쿠팡급. 도시는 **45개 시군구 중 31곳이 딜 3개 이상**
  이고 상품이 늘면 자동으로 늘어난다. 지역×카테고리 교차는 **지금 열면 대부분 thin** → 보류.
- **지역 단위를 `KOREA_REGIONS`(상권 176그룹)로 잡으면 안 된다.** 손큐레이션이라 커버가 불균등 —
  상품 보유 2·3위인 **서울 서대문구(18건)·부산 연제구(17건)가 아예 없다.** 그래서 행정 시군구를
  별도 축으로 뒀고, 상권 축은 홈 필터용으로 **그대로 남겼다**('홍대/합정'은 행정구역에 없다).
- 실주소 시/도 표기가 섞여 있다: `강원특별자치도` · `전북특별자치도` · **`전남광주통합특별시`**(24건,
  하위가 화순군·나주시·보성군·장흥군) → 정규화 표에 반영.

## 이번에 틀렸던 판단 (다음 세션이 반복하지 말 것)

1. **`CLAUDE.md` 의 "robots.txt 가 Cloudflare Managed 로 대체됐다"(2026-07-29)는 지금 사실이 아니다.**
   실측: 관리 블록이 **앞에 덧붙을 뿐** 레포 규칙(`Disallow: /admin`·`/seller`·`/u/me$`·
   `Allow: /seller/plus-friend-guide`)과 `Sitemap:` 줄이 **정상 서빙된다**(137줄, Disallow 57개).
   그 문장을 믿고 robots 를 다시 손대면 헛수고다.
2. **시군구 정규식을 `[가-힣]{2,10}(시|군|구)` 로 썼다가 `중구`·`동구`·`남구`가 통째로 탈락했다.**
   라이브 2위 지역인 서울 중구(25건)가 여기 걸렸다. 유닛테스트가 잡았다 → `{1,10}` 으로 수정.
   접두부가 한 글자인 지역명이 흔하다는 걸 놓치기 쉽다.
3. **몰 격리를 빠뜨렸다.** `computeRegionStats` 가 처음엔 `products` 를 **본진 몰 조건 없이** 읽었다.
   그대로 나갔으면 운영자 SaaS 몰 상품 기준으로 지역 URL 이 색인 요청됐을 것이다.
   `sitemap-mall-scope.test.ts` 가 잡았다 → `mainScopeFor(DB,'products','p')` 추가.
   **새 소비자 집계 쿼리를 짤 때 이 조건을 기본값으로 생각할 것.**
4. **`/region` 을 몰 슬러그 예약어에 안 넣었다.** `urdeal.kr/{몰슬러그}` 가 1-세그먼트 캐치올이라,
   누가 `region` 슬러그로 몰을 열면 지역 허브가 죽는다. `mall-branding.test.ts` 가 잡았다 →
   `src/shared/mall/slug.ts` 에 추가. **새 1-세그먼트 라우트를 만들 때마다 반드시 함께 등록.**
5. **`git stash` 로 "main 과 비교했다"고 착각했다 — 이번 세션 최악의 오판.**
   CI 의 `check-critical-chunks` 가 빨강이길래 stash 후 빌드해 청크 집합이 같은 것을 보고
   **"base 선재"라고 결론 내리고 PR 에 그렇게 적었다.** 틀렸다 — `git stash` 는 **이미 커밋된
   파일을 되돌리지 않는다.** 그 시점에 내 코드는 이미 커밋돼 있었으므로 내가 "main" 이라고 측정한
   빌드에는 내 코드가 그대로 있었다. 진짜 원인은 내 것이었다:
   `RegionLinkGrid.tsx` 를 `src/components/main/` 에 두었는데 vite 규칙
   `id.includes('/src/components/main/') → 'app-layout'` 때문에 **eager 청크**에 들어갔고,
   거기서 region-slugs 를 import 하며 `app-constants`(8.86KB gzip)가 크리티컬 패스로 딸려왔다.
   → `src/components/region/` 으로 이동해 17개 기준 복귀. **대조는 커밋 상태까지 포함해서 할 것.**
6. **모바일 우선 색인을 하마터면 놓칠 뻔했다.** 홈은 뷰포트로 갈리는데(`HomeRoute`) 모바일 홈은
   풀스크린 지도(`RestaurantMapPage`)라 **푸터도 지역 링크도 없다.** PC 홈에만 그리드를 달면
   Googlebot(스마트폰)은 지역 페이지를 영영 발견하지 못한다 → `SiteFooter` 에 허브 링크를 넣어 해결.
   **그 한 줄이 사실상 유일한 진입로다**(가드로 고정).

## 검증

- `region-slugs.test.ts` 29 + `region-page-wiring.test.ts` 21 = **50 pass** (전체 4854)
- **되돌려-검증 완료**: 푸터 링크 제거 · 리졸버 배선 해제 · 지역 페이지 전국폴백 허용 →
  정확히 그 3개 테스트만 빨강. 복원 확인.
- `tsc --noEmit` 0 · `npm run build` 0(client+worker+prerender) · audit-gate **85 GREEN**
  (RED 2건 `시드 버전 단조증가`·`크리티컬 청크 구성 동결`은 **브랜치 선재** — stash 대조로 확인)
- `file-size-baseline.json` rebaseline(App.tsx +6 / worker/index.ts +4 — 새 라우트·마운트)

## 다음 세션의 첫 액션

**배포 후 라이브 판정** (HTMLRewriter 는 Workers 런타임 전용이라 단위테스트로 못 막는다):

```bash
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
# ① 지역 페이지가 자기 메타를 갖는가 (홈 메타면 실패)
curl -sS -A "$UA" 'https://urdeal.kr/region/서울/중구' | grep -E '<title>|canonical'
# ② sitemap 에 지역 URL 이 실렸는가 (기대: 40개 안팎)
curl -sS -A "$UA" https://urdeal.kr/sitemap.xml | grep -c '/region/'
# ③ 집계 API
curl -sS -A "$UA" https://urdeal.kr/api/regions | head -c 400
```

②가 0 이면 `computeRegionStats` 가 워커에서 예외를 먹은 것(발행부가 try/catch 라 조용히 빈다).

## 남은 결정 / 대기

- **① 홈을 카테고리 섹션형으로 바꿀지** — 여기어때식 섹션+더보기는 홈 정체성 변경이다.
  현재 홈은 2026-07-19 대표 확정 구조(당근식 단일 그리드). **대표 확답 필요.**
  참고: `homepage_sections` 테이블 + CRUD API 9개가 **이미 있는데 프론트 소비 0** 이다.
- **③④ 배너** — `banners` 테이블 + `GET /api/banners` + `/api/admin/banners` CRUD +
  `AdminBannersPage` 가 **이미 살아있고 소비자 화면 소비만 0**. 필요한 건 배선 +
  `video_url`·`banner_type`(hero/inline)·`position` 컬럼 추가.
  🔑 **대표 확정 규칙: 배너 0건이면 컴포넌트가 `null` 반환 — 빈 자리·플레이스홀더 없이 레이아웃이
  위로 붙는다.** (`WholesaleBannerCarousel` 이 이미 같은 방식.)
- **지역×카테고리 교차 URL** — 상품이 더 쌓인 뒤. 지금은 thin.
- Google 사이트링크는 **요청·설정이 불가능하다**(알고리즘 자동). 우리가 할 수 있는 건 색인 가능한
  URL 을 늘리고 내부 링크·브레드크럼으로 계층을 알리는 것뿐 — 이번 작업이 정확히 그것이다.
