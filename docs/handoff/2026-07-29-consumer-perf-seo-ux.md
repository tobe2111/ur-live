## 🔎 2026-07-29 — 소비자(urdeal.kr) 성능·SEO·UX 실측 점검 + 수리

대표 지시: *"소비자 쪽(urdeal.kr)을 실제로 열어서 성능·SEO·UX를 점검해"* → *"모두 진행하고 추가 개선할 것들 확인해줘"*.
직전 세션은 *"컨테이너에서 HTML이 전부 301이라 관측 자체를 못 했다"* 로 끝나 있었다.

### 🔴 다음 세션이 가장 하기 쉬운 실수 — 이번에 내가 실제로 저지른 것

**`head` 로 잘라 본 응답을 "전부"라고 판정하지 말 것.**
`curl .../robots.txt | head -60` 을 보고 *"레포 robots.txt 가 서빙되지 않는다(Cloudflare Managed 로 대체)"* 라고
대표에게 **최우선 결함으로 보고했는데 틀렸다.** Cloudflare 는 관리 블록을 **앞에 덧붙일 뿐**이고,
레포 규칙 51줄과 `Sitemap:` 은 137줄짜리 응답의 **아래쪽에 그대로 있다**(전체를 받아 대조해 확인).
`scripts/check-live-contracts.mjs` 의 robots 본문 대조는 **정상 동작 중이었고 초록이 맞았다** —
가드를 의심하기 전에 내 관측을 의심했어야 했다.
> 남은 관찰(미검증): 관리 블록의 `User-agent: *` 그룹이 **우리 그룹보다 먼저** 온다. 구글은 동일 UA 그룹을
> 병합하므로 우리 `Disallow` 가 살아 있지만, 첫 그룹만 취하는 파서라면 무시될 수 있다. 네이버 Yeti 동작은
> 확인 못 했다. 판정하려면 서치어드바이저의 robots 해석 화면을 봐야 한다(코드로는 알 수 없다).

### 🛠 관측 방법 — 이 환경에서 소비자 화면을 실제로 여는 법 (다음 세션이 그대로 재사용)

1. **`urdeal.kr` 은 지금 프록시를 통과한다(200).** CLAUDE.md 의 *"프록시가 urdeal.kr 을 차단(CONNECT 403)"* 은
   **더 이상 유효하지 않다.** 직전 세션이 본 "전부 301" 은 `live.ur-team.com` 으로만 봤기 때문이다
   (그 도메인은 HTML 전 경로 영구 301, `/api/*` 만 예외).
2. **브라우저는 프록시로 TLS 를 못 뚫는다.** urdeal.kr 뿐 아니라 `example.com`·`api.cloudflare.com` 까지
   **전부** `ERR_CONNECTION_RESET`(프록시 로그엔 거부 기록 없음 = CONNECT 후 핸드셰이크에서 리셋).
   시도해 봤지만 **안 되는 것**: 프록시 CA SPKI 핀(`--ignore-certificate-errors-spki-list`) ·
   post-quantum 비활성(`--disable-features=PostQuantumKyber`) · HTTP/2·QUIC 비활성. 다시 시도하지 말 것.
3. **되는 방법 = Playwright 라우트 인터셉트.** `page.route('**/*')` 로 모든 요청을 가로채 **Node(undici
   `ProxyAgent`)가 대신 수행**하고 `route.fulfill()` 로 돌려준다. 페이지 오리진은 진짜 `https://urdeal.kr`
   이라 상대 URL·쿠키·CSP 가 전부 정상 동작한다. 스크립트: 이 세션 스크래치패드 `probe2.mjs`(휘발) —
   필요하면 위 3줄 설명으로 30줄 안에 다시 짤 수 있다.
   - ⚠️ **네트워크 타이밍(LCP/TTFB)은 이 방식으로 믿으면 안 된다** — Node 왕복이 끼어 부풀려진다.
     타이밍은 `curl -w` 로 따로 잰다. DOM·레이아웃·CLS·콘솔·리소스 그래프·바이트는 진짜다.
   - ⚠️ 바이트를 잴 때 `accept-encoding: gzip` 으로 받아 Node 가 **압축을 풀어** 버린다. 그대로 합산하면
     전송량이 아니라 원본 크기다(내가 처음에 "sentry 431KB" 라고 적었는데 실제 전송은 137KB gz 였다).

### ✅ 이번에 고친 것 (PR — 아래 "커밋" 참조)

| # | 문제(실측) | 수리 |
|---|---|---|
| 1 | `/vouchers` 브랜드 칩이 **32×32 로 렌더하면서 원본 JPEG**를 받음. 1장 176,870B → 리사이저 경유 5,261B(33배). 칩 82개 | `BrandChip` 추출 + `cfImage(width:96)` — PC/모바일 중복 마크업도 하나로 |
| 2 | `/`·`/vouchers`·`/browse` 가 **홈 메타를 그대로 서빙**(title/desc 동일, `og:url` 전부 `https://urdeal.kr`, canonical 없음) | 워커 서버 메타 rewrite 신설(`shared/seo/consumer-surfaces` SSOT) |
| 3 | `/s/:username` 도 같은 상태(`/u/:handle` 만 개인화돼 있었음) | SELLER 슬롯 메타 rewrite 신설 |
| 4 | `<title>` 이 `교환권 - 유어딜 - 유어딜` | `withSiteName` 이 중복 흡수(SEO.tsx 1곳) |
| 5 | `/` 와 `/vouchers` 에 **실제 h1 이 없음** — 유일한 h1 이 index.html 의 숨겨진 인앱 차단 화면 | 그 h1 → `<p class="blk-title">` 강등 + 두 표면에 `sr-only` h1 |
| 6 | `/vouchers` **CLS 0.188**(첫 방문). 카테고리 칩(50px)+브랜드 스트립(113px)이 SSR 로 먼저 그려진 목록 위로 늦게 삽입 | `sectionsReady` 로 자리 예약(높이는 실측값) |
| 7 | 비로그인이 딜 상세를 열 때마다 콘솔 401 (`/api/fcfs/:id/me`) | 비로그인이면 호출 안 함 |
| 8 | sitemap 의 storefront 8건이 **전부 상품 0개**, 그중 6건이 QA 계정(`테스트 상점`·`검증상호`…) | **콘텐츠 게이트**(상품≥1 OR 핀≥1). 이름 패턴으로 거르지 않음 — 자기유지되는 기준 |
| 10 | **같은 교환권이 두 URL 로 갈려 한쪽만 noindex** — `/vouchers/2192` 는 `noindex`(2026-07-07 결정)인데 `/products/2192` 는 `index,follow` 였고 **sitemap 이 후자를 500건 제출**. 즉 색인 제외 결정이 다른 URL 로 우회되고 있었다. 제출 500건 중 ~485건이 KT-Alpha 기프티콘(`seller_id` 없음·`bizimg.giftishow.com`)이고 소비자 쇼핑 카탈로그엔 15건뿐 | sitemap `/products` 에서 `deal_only=1` 제외 + `buildProductMeta` 가 deal_only 를 noindex — **두 경로가 일치** |
| 11 | 랜딩 4종(`/about`·`/creators`·`/creators/apply`·`/partners`)이 서버 메타 제네릭 홈 | `CONSUMER_SURFACE_SEO` 에 편입 + **그 페이지들의 `<SEO>` 도 같은 표를 읽게** 배선(문구 두 벌 방지) |
| 12 | 유어애즈 `influencer-auto-collect.ts` 602줄 — main 에서 이미 audit-gate RED | 키워드 저장소(DDL·시드·CRUD)를 `influencer-keyword-store.ts` 로 분리(602→528). **audit-gate ALL GREEN 75** |
| 9 | **사라진 상세가 `200 + index,follow`** — `/group-buy/99999999` 가 제네릭 홈 메타로 색인 가능. 워커 self-fetch 는 그 순간 404 를 받고도(`X-SSR-Status: DETAIL:self-fetch-404`) 안 썼다. sitemap 이 상세 829건 제출 → 내려갈 때마다 홈 중복 1개 | `shouldNoindexMissingEntity` — 엔티티 슬롯 + `self-fetch-404` 일 때만 noindex **+ HTTP 404 응답**(본문은 SPA 셸 그대로 → 클라가 "없는 상품" 화면 정상 렌더). **타임아웃은 제외**("느리다"≠"없다") |

### 3차 — 공개 표면 전수(30개) + 다크 모드

| # | 문제(실측) | 수리 |
|---|---|---|
| 13 | **공개 라우트 30개 전부** 홈 메타 + `index, follow` + canonical 없음 | 원인 2종으로 분리해 각각 수리(아래) |
| 14 | `App.tsx` 에 `<Navigate>` 로만 있는 **별칭 7개**가 200+색인가능 = 홈 복제본 7개 | 워커 진입부 **서버 301**(`consumer-redirects.ts`). SPA 내부 이동은 서버를 안 타므로 `<Navigate>` 는 **그대로 둔다** |
| 15 | `/search`·`/gb-market` 은 클라가 **noindex 선언인데 서빙 HTML 은 `index, follow`** | 표에 `noindex` 플래그 신설 → 서버도 막는다 |
| 16 | 콘텐츠 표면 14개가 서버 메타 없음 | `CONSUMER_SURFACE_SEO` 확장 + **그 페이지 17곳이 같은 표를 읽게** 배선(i18n 은 `defaultValue` 로 유지) |
| 17 | `RefundPolicyPage` 의 `url="/refund-policy"` 가 이제 301 별칭 — canonical 이 리다이렉트를 가리킴 | `/refund` 로 정정 |

**다크 모드**: 7개 표면(`/`·`/vouchers`·`/faq`·`/stays`·`/new-openings`·`/join`·`/group-buy/2847`)을
`ur_theme_mode_v1='dark'` + `colorScheme:'dark'` 로 렌더 — **라이트 잔재 0 · 안 보이는 글자 0 · JS 에러 0**.
`check-theme-consistency` 가 실제로 일하고 있다. (스크린샷으로도 확인.)

🐛 **이번에 테스트가 내 버그를 잡았다**: `/faq` 를 페이지에 배선해 놓고 표 항목을 빠뜨려
`undefined.title` 런타임 크래시 직전이었다. 배선 드리프트 가드가 없었으면 FAQ 페이지가 그대로 나갔을 것.

부수: DETAIL/STAYDETAIL/PRODUCT/CURATOR 의 **똑같은 `.on()` 체인 4벌**을 `applySurfaceMeta` 하나로 통일
(`worker/index.ts` 2620→2591줄, 파일크기 래칫 준수). 출력 불변 — 셀렉터·순서·값 동일.

### 🧪 가드 (규율은 문서가 아니라 테스트로)

- `src/tests/unit/consumer-surface-seo.test.ts` (**37**) — 접미사 1회·canonical 자기참조·표면별 상이·
  추적파라미터 제거 + **배선 드리프트**(페이지 17곳이 실제로 표를 읽는지 소스에서 확인).
- `src/tests/unit/surface-ssr-meta.test.ts` (**15**) — 가짜 HTMLRewriter 로 어떤 셀렉터에 무엇이 들어가는지
  + `shouldNoindexMissingEntity`(타임아웃 제외 포함).
- `src/tests/unit/consumer-redirects.test.ts` (**10**) — 별칭 301. **`App.tsx` 를 읽어 대조**하므로
  라우트가 사라지거나 `<Navigate>` 가 아니게 되면 빨간불(죽은 301 방지).
- 되돌려-검증 완료: `withSiteName` 의 중복 흡수 1줄 제거 → 4개 빨강, 복원 → 초록.
- ⚠️ **못 막는 것**: `worker/index.ts` 가 `applySurfaceMeta` 를 *호출하지 않게* 되는 회귀. HTMLRewriter 는
  Workers 런타임 전용이라 여기서 실행 못 한다. **배포 후 아래 명령이 유일한 판정**이다.

### ▶️ 다음 세션의 첫 액션 (배포 후 1분)

```bash
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
for p in / /vouchers "/vouchers?category=%ED%8E%B8%EC%9D%98%EC%A0%90" /browse /s/jea1612; do
  echo "== $p"; curl -sS -A "$UA" "https://urdeal.kr$p" \
    | grep -oE '<title>[^<]*|rel="canonical" href="[^"]*' | head -2
done
```
**판정**: 다섯 경로의 `<title>` 이 서로 달라야 하고, 전부 canonical 이 **자기 URL** 이어야 한다.
하나라도 `유어딜 - 돈버는 쇼핑…` 이 나오면 워커 배선이 안 탄 것(값이 아니라 배선을 볼 것).

추가 판정 (2·3차분):
```bash
# ① 사라진 상세 = HTTP 404 (이전엔 200)
curl -sS -o /dev/null -w '%{http_code}\n' https://urdeal.kr/group-buy/99999999      # → 404
# ② 교환권은 어느 URL 로 와도 noindex (이전엔 /products/:id 만 index,follow)
curl -sS https://urdeal.kr/products/2192 | grep -o 'name="robots" content="[^"]*"'   # → noindex, follow
# ③ sitemap 에서 교환권이 빠졌나 (이전 500건 → 실제 쇼핑 상품만)
curl -sS https://urdeal.kr/sitemap.xml | grep -c '<loc>https://urdeal.kr/products/'  # → 15 안팎
# ④ 별칭 7개가 301 (이전엔 200 + index,follow)
for p in /group-buy /restaurant-map /terms-of-service /privacy-policy /refund-policy /shipping-policy /product/2687; do
  printf '%-20s ' "$p"; curl -sS -o /dev/null -w '%{http_code} → %{redirect_url}\n' "https://urdeal.kr$p"
done
# ⑤ 콘텐츠 표면이 자기 메타를 갖나 (이전엔 30개 전부 홈 메타)
for p in /stays /faq /business /new-openings /terms; do
  printf '%-16s ' "$p"; curl -sS "https://urdeal.kr$p" | grep -oE '<title>[^<]*' | head -1
done
```

⚠️ **Pages 프리뷰로는 검증할 수 없다** — `*.pages.dev` 를 이 환경의 이그레스 정책이 403 으로 막는다
(시도했고 막혔다. 다시 시도하지 말 것). 배포 후 위 curl 이 유일한 판정이다.

### 🔭 머지하며 본 것 — 다음 세션 참고

main 이 `src/worker/utils/mall-ssr-meta.ts`(`buildMallMeta`)를 새로 넣었다. **메타를 만들기만** 하고
`worker/index.ts` 에는 아직 배선돼 있지 않다(grep 0). 나중에 배선할 때는 `.on()` 체인을 새로 쓰지 말고
**`surface-ssr-meta.applySurfaceMeta` 를 재사용할 것** — 이 PR 이 상세 4벌의 복붙을 그 하나로 합쳤고,
noindex·jsonLd·ogImage 를 이미 지원한다. 체인이 또 늘면 같은 복붙이 다시 시작된다.
(⚠️ 이 세션에서 `influencer-keyword-store.ts` 를 양쪽이 각자 만들어 충돌한 전례가 있다 — 새 헬퍼를
만들기 전에 `git log origin/main -- <경로>` 로 main 이 이미 만들었는지 먼저 볼 것.)

### 📋 남은 항목 (대표 판단 / 다음 세션)

1. **표에 아직 없는 소비자 표면** — `/area-report`(지역별 동적 제목이라 정적 표에 안 맞음) ·
   `/terms/seller`·`/terms/agency`·`/terms/influencer`·`/terms/group-buy`(문서별로 제목이 달라
   `TermsDocument` 가 동적 생성). 넣으려면 정적 문자열이 아니라 **빌더**가 필요하다.
   ⚠️ 랜딩 4종과 콘텐츠 14종은 **이미 처리됐다**(위 표 #11·#16) — 다시 파지 말 것.
2. **소비자 쇼핑 카탈로그에 데모 상품 9건이 살아 있다** — `/api/products?exclude_deal_only=1` 15건 중 9건이
   `seller_id` 없음 + `images.unsplash.com`(예: `/products/1` "무선 이어폰 프리미엄"). 이건 **코드가 아니라
   데이터** 문제라 손대지 않았다(비활성화는 어드민 작업). 지금은 sitemap 에도 그대로 들어간다.
   ⚠️ 이름/이미지 호스트로 코드에서 거르려 하지 말 것 — 실제 셀러가 같은 패턴을 쓸 수 있다. 데이터를 정리하는 게 맞다.
3. **홈 첫 페인트가 지도**라 Kakao SDK 101KB + 타일 PNG ~500KB 가 붙는다. 홈=지도는 대표 결정(2026-07-15)이라
   건드리지 않았다. 줄이려면 타일 레벨/초기 줌 또는 리스트-우선 진입이 레버.
4. **`useMapProducts` 가 page 2→7 을 순차 호출**(329곳 → 6 왕복). 설계대로(progressive, SOFT_CAP 500)라
   지금은 정상이지만, 상품이 늘면 이 순차가 먼저 아플 자리다.
5. ~~감사 게이트 RED(유어애즈 602줄)~~ → **해소됨. 단, 내 분리가 아니라 main 것이다.**
   머지 시점에 **양쪽이 같은 파일을 각자 분리**했고 파일명(`influencer-keyword-store.ts`)까지 겹쳤다.
   레포 선례대로 main 구조로 통일하고 이쪽 분리는 폐기했다(main 이 이미 523줄로 해결해 목적이 사라짐).
   ⚠️ 이때 `git rm` 이 **main 의 파일을 지울 뻔했다** — 같은 이름의 파일이 양쪽에 새로 생기면
   `git show origin/main:<path>` 로 **어느 쪽 파일인지 먼저 확인**할 것.
   머지 후 `audit-gate.sh` = **ALL GREEN 76**(main 신규 가드 '크리티컬 청크 구성 동결' 포함).

### ❌ 이번에 기각한 것 (다음 세션이 다시 파지 않게)

- **"이미지 alt 누락 68/69"** — 오측이다. `alt=""`(장식용 의도)를 `!getAttribute('alt')` 로 세어 falsy 로 잡았다.
  실제 `alt` 속성 **부재는 0건**. 카드 썸네일 옆에 이름 텍스트가 있으니 `alt=""` 가 맞다.
- **"width/height 누락 → CLS"** — 홈 CLS 는 **0.025**(양호)다. 카드가 CSS 로 고정 박스를 잡아 두기 때문에
  속성이 없어도 안 흔들린다. CLS 문제는 이미지가 아니라 **늦게 삽입되는 블록**이었다(위 #6).
- **"Sentry 431KB 가 critical path"** — 아니다. `main.tsx` 가 idle 5s 로 지연하고 있고 실제 전송은 137KB gz다.
- **"404 페이지가 200"(임의 경로)** — `/nonexistent-page-xyz` 도 200 이지만 이건 SPA catch-all 의 정상 동작이고
  robots 가 막지도 않는다. 다만 **엔티티 상세**는 다르다(대상이 실제로 사라진 것이라 위 #9 로 처리했다).
- **"`/s/*` 가 soft-404"** — 아니다. 내가 존재하지 않는 엔드포인트(`/api/sellers/by-username/…`)로 찔러 404 를
  봤다. 올바른 경로(`/api/sellers/:id/public`)로는 **전부 200**이고 실제 페이지다. 문제는 "죽은 URL" 이 아니라
  **내용이 비어 있고 QA 계정** 이라는 것이다(그래서 콘텐츠 게이트로 고쳤다).

---

## 🔧 2026-08-01 후속 — 어드민 전수 수리 (대표 지시 묶음)

대표 지시: `/admin/errors`·`/admin/system-monitoring` 자가수리 · `/admin/reviews` 매장명+스크롤 대안 ·
`/admin/social` 등록방법+Anthropic 없이 초안 · `/admin/policy` 최신화 · `/admin/commission-settings` 설명 ·
구글 AI 검색/파비콘.

### 🔴 이번에 배운 것 — **선언을 실측보다 믿으면 반대로 고친다**

`/admin/reviews` 500 은 2026-07-01 에 이미 "수리"된 이력이 있는데도 **한 달째 500** 이었다.
원인: 그 수리가 `repair-schema` 의 `CREATE TABLE ... is_hidden` **선언**을 실제 스키마로 믿고
`is_visible → is_hidden` 으로 바꿔 놨다. **라이브에는 `is_hidden` 이 없다.**
- 실측 방법(다음에도 그대로 쓸 것): `GET /api/admin/reviews/product/2847` 이 `SELECT *` 라
  **라이브 컬럼 목록이 그대로 나온다**. 1분이면 끝난다.
- 실제 컬럼: content·created_at·id·images·is_generated·is_sponsored·**is_visible**·order_id·
  product_id·rating·selected_option·seller_reply·seller_reply_at·updated_at·user_id·user_name
- 테이블을 실제로 만드는 곳은 `features/reviews/api/reviews.routes.ts ensureTable` — **그쪽이 정본**.
- 수리하면서 **repair-schema 선언 자체를 현실에 맞췄다**. 안 고치면 다음 사람이 또 반대로 간다.
  (부수효과: `check-sql-column-exists` 가 이제 `is_hidden` 참조를 잡을 수 있게 됐다 — 선언이 맞아야 가드가 산다.)

### ✅ 고친 것 (커밋 `4db72ff`, `04d8e84`)

| 대상 | 문제(실측) | 수리 |
|---|---|---|
| `/admin/reviews` | stats·list 둘 다 500 | 가시성 컬럼 6곳 is_visible 로 되돌림 + repair-schema 선언 교정 |
| `/admin/reviews` | 상품 `<select>` 에 이름만, 서버 100건에서 **잘림** | `ProductPicker` — 매장명 검색(서버 `restaurant_name`)·카테고리 칩·"리뷰 없는 것만"·카드에 매장명/리뷰현황 |
| 구글 지구본 | **`/favicon.ico` 404** + 48배수 아이콘 없음 + `_routes.json` exclude 미등재 | ico(16/32/48) 신설 + 48/96/144 PNG + 선언 + exclude. 가드 `favicon-serving.test.ts`(24) |
| `/admin/policy` | policy.ts 8그룹 중 **4그룹 + 커미션 3키가 화면에 없음** | 행을 `admin-policy/policy-rows.ts` 로 모으고 `policy-dashboard-sync.test.ts`(13)가 전 키 대조 |
| `/admin/social` | 키 없으면 초안 **503 으로 아예 못 만듦** | `social-compose.ts` 조합형 결정론 작성기 + 전수 가드(11, 216조합) |
| `/admin/commission-settings` | 무슨 값인지 화면이 안 말함 | 설명 카드(무엇을·누가 읽는지·여기가 아닌 것·재원 원칙 관계). **머니 무변경** |

### 📌 대표 액션이 필요한 것 (코드로 못 고침)

1. **구글 AI 개요에 안 뜨는 진짜 이유** — `robots.txt` 의 **Cloudflare Managed 블록**(레포 아님)이
   `User-agent: Google-Extended → Disallow: /` + `Content-Signal: ai-train=no` 를 넣고 있다.
   `GPTBot`·`ClaudeBot`·`CCBot`·`Bytespider`·`meta-externalagent`·`Applebot-Extended`·`Amazonbot` 도 전면 차단.
   → **Cloudflare 대시보드 → AI Crawl Control / Managed robots.txt** 에서 조정해야 한다.
   Organization JSON-LD 는 이미 홈에 정상 출력 중이라 **데이터 문제가 아니다**.
2. **`/admin/system-monitoring` 실패 12건 + stale 15건이 전부 `ads:*`** 이고 원인은 하나 —
   **`Worker exceeded CPU time limit`**(ur-ads). 소비자/도매 cron 은 전부 정상.
   `wrangler-ads.toml` 에 `[limits]` 가 없고 무료 플랜이면 CPU 10ms 라 무거운 작업은 구조적으로 못 넘긴다.
   → 플랜 전환 또는 **작업당 배치 축소**(별도 작업 — 12개 잡을 손대야 해서 이번 범위 밖).
3. **`/admin/errors`**: 47건 중 36건이 `[boot-stuck]`. 그중 상당수 URL 이 `/group-buy/99999999?__cb=…` —
   **직전 세션의 내 SEO 진단(Playwright 인터셉트)이 만든 것**이다. 진짜 사용자 신호와 섞여 있다.
   ⚠️ **미해결 수수께끼**: 12초 워치독에서만 나오는 `entry-stalled` 인데 `t=257~751ms` 인 건이 다수다.
   `performance.now()` 는 문서마다 리셋되므로 설명이 안 된다 — **추측하지 말고** 다음 세션이
   beacon 에 `navigation type`(navigate/reload/back_forward/prerender)을 추가해 판별할 것.
   또 `frontend_errors.user_agent` 는 **저장은 되는데 `/api/_errors/recent` 가 안 돌려준다**(triage 불가).
4. `Ledger mismatch (4): user_points_balance_mismatch: 4` — 머니 경로. 4명의 딜 잔액이 원장과 불일치.
   cron 이 매일 감지만 하고 있다. 별도 단독 세션 대상(머니 룰).

### ▶️ 배포 후 판정 (추가분)

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://urdeal.kr/favicon.ico          # → 200 (이전 404)
curl -sS "https://live.ur-team.com/api/admin/reviews/stats" -H "Authorization: Bearer $TOK" -H "User-Agent: $UA"   # → success:true
```
