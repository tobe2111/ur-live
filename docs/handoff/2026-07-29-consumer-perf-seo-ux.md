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

부수: DETAIL/STAYDETAIL/PRODUCT/CURATOR 의 **똑같은 `.on()` 체인 4벌**을 `applySurfaceMeta` 하나로 통일
(`worker/index.ts` 2620→2591줄, 파일크기 래칫 준수). 출력 불변 — 셀렉터·순서·값 동일.

### 🧪 가드 (규율은 문서가 아니라 테스트로)

- `src/tests/unit/consumer-surface-seo.test.ts` (17) — 접미사 1회·canonical 자기참조·표면별 상이·추적파라미터 제거.
- `src/tests/unit/surface-ssr-meta.test.ts` (15) — **배선**까지: 가짜 HTMLRewriter 로 어떤 셀렉터에 무엇이 들어가는지.
- 되돌려-검증 완료: `withSiteName` 의 중복 흡수 1줄 제거 → 4개 빨강, 복원 → 17개 초록.
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

추가 판정 3가지:
```bash
# ① 사라진 상세 = HTTP 404 (이전엔 200)
curl -sS -o /dev/null -w '%{http_code}\n' https://urdeal.kr/group-buy/99999999      # → 404
# ② 교환권은 어느 URL 로 와도 noindex (이전엔 /products/:id 만 index,follow)
curl -sS https://urdeal.kr/products/2192 | grep -o 'name="robots" content="[^"]*"'   # → noindex, follow
# ③ sitemap 에서 교환권이 빠졌나 (이전 500건 → 실제 쇼핑 상품만)
curl -sS https://urdeal.kr/sitemap.xml | grep -c '<loc>https://urdeal.kr/products/'  # → 15 안팎
```

### 📋 남은 항목 (대표 판단 / 다음 세션)

1. **랜딩 4종(`/about`·`/creators`·`/creators/apply`·`/partners`) 은 여전히 서버 메타가 제네릭 홈**이다.
   sitemap 에 priority 0.6~0.85 로 제출 중. 고치려면 `CONSUMER_SURFACE_SEO` 에 항목을 추가하고
   **그 페이지의 `<SEO>` 도 같은 상수를 읽게** 바꿀 것(문구가 두 벌이 되면 반드시 갈라진다).
2. **소비자 쇼핑 카탈로그에 데모 상품 9건이 살아 있다** — `/api/products?exclude_deal_only=1` 15건 중 9건이
   `seller_id` 없음 + `images.unsplash.com`(예: `/products/1` "무선 이어폰 프리미엄"). 이건 **코드가 아니라
   데이터** 문제라 손대지 않았다(비활성화는 어드민 작업). 지금은 sitemap 에도 그대로 들어간다.
   ⚠️ 이름/이미지 호스트로 코드에서 거르려 하지 말 것 — 실제 셀러가 같은 패턴을 쓸 수 있다. 데이터를 정리하는 게 맞다.
3. **홈 첫 페인트가 지도**라 Kakao SDK 101KB + 타일 PNG ~500KB 가 붙는다. 홈=지도는 대표 결정(2026-07-15)이라
   건드리지 않았다. 줄이려면 타일 레벨/초기 줌 또는 리스트-우선 진입이 레버.
4. **`useMapProducts` 가 page 2→7 을 순차 호출**(329곳 → 6 왕복). 설계대로(progressive, SOFT_CAP 500)라
   지금은 정상이지만, 상품이 늘면 이 순차가 먼저 아플 자리다.
5. ~~감사 게이트 RED(유어애즈 602줄)~~ → **해소됨**. 키워드 저장소를 분리해 528줄. 지금 `audit-gate.sh` 는 **ALL GREEN 75**.

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
