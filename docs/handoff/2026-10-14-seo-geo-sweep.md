# 인계 — SEO·GEO 스윕 (2026-10-14)

대표 지시: *"머지하고 또 개선점 찾아보자. SEO 와 GEO 부분에서"* (연속 지시 — 재고 고치고 머지하고 또 찾는다).

## 🚩 다음 세션의 첫 액션

```bash
# ① PR #1791 이 머지됐는지 (auto-merge 걸려 있다)
gh api repos/tobe2111/ur-live/pulls/1791 --jq '{state,mergeable,merge_state:.mergeable_state,head:.head.sha}'

# ② 머지됐으면 E4 — 아래 셋을 라이브에서 **파싱해서** 판정한다(문자열 개수로 판정하지 말 것)
UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
#  #72 빵부스러기 — item 1·2 가 서로 다른 URL 인지 + 루트 이름이 전 표면에서 `유어딜` 하나인지
curl -sS -A "$UA" https://urdeal.kr/pass/2823 | python3 -c "
import sys,re,json
for m in re.finditer(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', sys.stdin.read(), re.S):
    d=json.loads(m.group(1))
    for n in (d.get('@graph') or [d]):
        if n.get('@type')=='BreadcrumbList':
            print([(i['position'],i['name'],i['item']) for i in n['itemListElement']])"
#  #74 가게 정본 — /s/ 와 /profile/ 이 **같은 하나**를 가리키는지
for p in /s/store_mux /profile/store_mux; do curl -sS -A "$UA" "https://urdeal.kr$p" | grep -o 'rel="canonical"[^>]*'; done
#  #75 숙소 문구 — cron(04:20 KST) 1회 뒤 줄표가 사라졌는지
curl -sS 'https://urdeal.kr/api/group-buy/stays/2732' | python3 -c "import sys,json;d=json.load(sys.stdin)['data']['product'];print(repr(d.get('description'))[:200])"
```

⚠️ **#75 는 cron 이 한 번 돌아야 판정된다**(일일 티어 04:20 KST). 그 전에 재면 옛 문장이 그대로이고
그것은 회귀가 아니다. 돌았는지는 어드민 `GET /api/admin/cron-heartbeats` 의 `scheduled-cleanup` +
그 회차 `results.stay_desc_healed` 로 본다.

## ✅ 이번 세션 완료분

| # | 무엇 | 커밋 / PR |
|---|---|---|
| 69 | robots 값 SSOT — `max-image-preview:large` 명시 + noindex 가 크롤러별로 갈린 것 | `882fa4089` |
| 70 | `/s/:username` 유어샵 크롤러 본문 6자 → 채움(앞으로 **모든 신규 매장**의 기본 경로) | `b6cb55027` |
| 71 | 상세 제목 SSOT — 숙소는 Googlebot 이 지역을 잃었고 교환권 ~135건이 "교환권 교환권" | `dc1822d3f` · 가드 재조준 `a0bdc35f6` |
| 72 | `/pass` 310건 빵부스러기가 같은 URL 을 두 번 + 루트 이름 두 벌(`홈` 359 ↔ `유어딜` 90+) | `3b2f2dbd3` |
| 74 | 가게 유어샵이 `/s/` 와 `/profile/` 두 URL 로 색인 경쟁(각자 자기를 정본으로) | `6d5e83652` |
| 75 | 숙소 소개 문구 치유가 **한 번도 안 돌았다** — 색인 49건이 대표가 지적한 그 문장 | `7e1beed2c` · 래칫 `e0860288a` |
| — | CI 빨강 수리(🩸 ②) | `57a377e0d` |
| 78 | `/urshorts` 가 색인 대상인데 **내부 링크 0** — 딜이 붙은 행을 그 딜로 링크 | 이 커밋 |
| 49 | (판정 종결) `Product.brand` — `/pass`·`/stays` 는 **이미 낸다** · `/products` 는 **일부러 안 낸다**(셀러 ≠ 브랜드) | 코드 변경 없음 |
| 73 | 한 문서에 같은 `@type` 두 벌(서버 + react-helmet) — 약 380 URL. `SEO.tsx` 에서 거른다 | 이 커밋 |

앞서 머지된 것들: `#1789`(제목·alt 표 SSOT) · `#1785`(sitemap↔색인의도↔본문 짝 전수) ·
`#1783`(법정문서 본문) · `#1778`(thin URL 두 갈래 + 공개 API 수수료율 차단).

## 🩸 이번에 틀렸던 판단 (같은 오진 반복 방지 — 이게 제일 값지다)

**① 하마터면 거짓 결함을 보고할 뻔했다.** `/pass`·`/stays` 의 JSON-LD `image` 가 R2 공개 도메인이
아니라 `/api/media/` 라서 *"3.5배 느리다"* 고 보고하려 했다 — 근거는 CLAUDE.md 에 적힌 숫자였고
**기억으로 인용**한 것이었다. 실측하니 워커 0.207s ↔ R2 0.199s 로 **차이가 없었다**. 그 3.5배는
*Cloudflare 리사이저가 원본을 가져올 때*의 숫자이고 소비자가 다르다. ⇒ **문서의 숫자를 다른
소비자에 옮겨 쓰지 말 것.**

**② `handoff-index-sidecar` 시험이 "가드가 제 일을 하는 순간" 빨간불이었다.** 그 단언이
`'인계 문서 동기화'` 를 앵커했는데 그 문구는 `check-current-work-sync.mjs` 의 **✅ 경로에만** 있다
(`:39·46·54·58·62`). 경고 경로는 `⚠️ 인계 문서 미갱신` 이라, *소스를 바꿨는데 인계 문서가 없는
브랜치* = **가드가 정확히 신고해야 하는 상태**에서 시험이 터진다. main 에서는
`기본 브랜치 (skip)` 라 늘 초록이어서 **몇 달간 안 보였고**, 이 PR 이 CI 를 그걸로 **네 번** 태웠다
(`882fa408`·`a0bdc35f`·`7d38ce72`·`c0150ea9`). ⇒ 시험의 일은 *판정이 무엇인가*가 아니라
**판정에 도달했는가**다. 되돌려-검증 둘로 확인했다(출력 0 → 빨강 · 결론 없는 출력 → 빨강).
🔑 그리고 **그 가드가 옳았다** — 이 세션이 소스 21개를 바꾸고 인계를 안 쓰고 있었다(이 문서가 그 수습).

**③ 내 JSON-LD 계수기가 중첩 노드를 세고 있었다.** `Organization: 2`(브랜드 + `parentOrganization`)
`BlogPosting: 40` 을 중복으로 읽을 뻔했다. 중복의 믿을 만한 신호는 **helmet 표식**(`data-rh`)
개수다 — 실제로 클라가 더하는 JSON-LD 가 있는 곳은 `/pass`(2)·`/products`(1) 뿐이다.

**④ 측정기 사고 둘** — `buildDetailMeta` 인자 순서를 `(payload, pathname, origin)` 으로 잘못 호출해
`유어딜=/pass/2823/` 가 나왔다(실제는 `(ssrPayload, origin, pathname)`). 그리고 게이트 출력 필터가
`Error:` 를 집어 `no such table: rate_limit_attempts` 30줄이 **진짜 실패를 덮었다** — 파일 선택을
직접 재현하고 vitest 를 직접 돌려 `^ *FAIL` 로 찾았다.

## 🔎 2차 스윕 — 측정으로 **기각한 것**이 더 많았다

재 보고 **결함이 아님**으로 닫은 것들(다시 파지 말 것):

| 각도 | 실측 | 판정 |
|---|---|---|
| og:image 404 | 29표면 · 고유 6개 **전부 200** · `og:image:alt` **누락 0** | 깨끗 |
| 크롤러 UA 파리티 | `/`·`/vouchers`·`/pass/:id`·`/u/:handle`·`/faq`·`/region/서울` 에서 Googlebot·Yeti·OAI-Search·Claude-SearchBot·Perplexity·iPhone **본문 길이 전부 동일** | 깨끗 |
| 블로그 `author`·RSS | `author: Organization "유어딜 팀"` · `publisher: @id` · 상세에도 `rel=alternate rss` 1건 | 깨끗 |
| `/urshorts` `VideoObject` 0 | **의도**다. 남의 유튜브 영상이라 발행하면 우리가 출처라고 말하는 셈(모듈 머리말 + 가드) | 비결함 |
| `Vary: User-Agent` 없음 | HTML 은 `cf-cache-status: DYNAMIC` + `cache-control: no-cache` = **아무도 캐시하지 않는다** ⇒ UA 로 문서가 갈려도 섞일 경로가 없다 | 비결함 |
| sitemap thin 4건 | `/browse` 60자·`/products/2917` 46자 → 라이브 쇼핑 상품이 **1건**이라 그렇다(데이터 사실) · `/u/user40` 58자 → 핀 1개(설계대로 본문 생성) · `/s/store_mux…` 22자 → **이 PR 의 #70 이 아직 라이브에 없다** | 비결함 |
| `/region` 허브 `ItemList` 0 | 다른 목록은 다 내는데 허브만 없다. 다만 항목이 **지역 페이지**라 리치결과 가치가 거의 없고 링크 11개는 이미 있다 ⇒ **안 한다**(가치 < 코드) | 보류 |

## 🧬 #73 처방 — 왜 `SEO.tsx` 에서 걸렀나

클라 노드를 내는 자리는 다섯(`GroupBuyDetailPage`·`ProductDetailPage`·`BlogDetailPage`·
`RegionPage`·`RegionIndexPage`)이고 그중 **`GroupBuyDetailPage.tsx` 는 로딩 잠금표 파일**이라
대표 승인이 필요하다. `SEO.tsx` 한 곳에서 거르면 잠금 파일을 안 건드리고 다섯이 함께 해소되며
앞으로 생길 표면도 자동으로 같은 규칙을 받는다.

🩸 **설계를 한 번 되돌렸다.** 처음엔 서버 종류를 모듈 변수에 **캐시**했는데, 그러면 *첫 `<SEO>`
렌더가 언제인지*에 판정이 매달려 **검증할 수 없다** — 실제로 시험이 헛돌았다(서버 노드가 없던
첫 렌더에서 빈 집합이 굳어 두 번째 렌더에서 아무것도 안 걸렀고 **그래도 초록**이었다).
매 렌더에 다시 읽도록 바꾸고, 기준 경로만 **모듈 로드 시점**에 잡는다(엔트리는 defer 라 그때
문서는 이미 파싱돼 있다). 그리고 ④에 **양성 통제**를 넣었다 — *"서버 노드가 없으면 클라 노드가
뜬다"* 를 먼저 단언해야 "0개" 가 *걸러진 것*인지 *helmet 이 안 쓴 것*인지 구분된다.

🩸 **주입 하나가 헛돌아 교체했다.** `if (!serverTypes.size) return list` 를 지우는 주입을 심었는데
통과했다 — 그 줄은 성능 단축이고 빈 집합에서는 `every` 가 전부 false 라 **행동이 같다**.
⇒ 행동이 안 바뀌는 자리에 주입을 두면 커버리지를 가진 척만 한다. 실제로 지켜지는 관용
(깨진 서버 블록 하나가 전체를 못 쓰게 만들지 않는다)으로 옮겼고, 같은 과장이 있던 주석도 정정했다.

## 🩸 2차 스윕에서 틀린 것 — 내 측정기가 거짓 차이를 만들었다

AI 검색봇이 **모든 표면에서 정확히 +151자**를 받는다고 읽고 *"#17 과 같은 클래스(봇 문서에 상수
보일러플레이트)"* 로 보고하려 했다. 그 151자의 정체는 `index.html` 의 **HTML 주석**이었다 —
내 본문 추출기가 `<[^>]+>` 로 태그를 지우는데 그 주석 안에 `<SEO>` 가 있어 `<!-- … <SEO>` 까지만
한 태그로 먹고 **주석 뒷부분을 본문으로 셌다**. 브라우저·크롤러는 `<!-- … -->` 를 통째로
주석으로 읽으므로 **아무도 그 글자를 안 본다.** 주석을 먼저 지우고 다시 재니 여섯 UA 가 **전부 동일**했다.

⇒ **이 레포의 `check-comment-stripper` 가 막는 그 클래스를 내 하네스가 밟았다.** 레포 가드는
괜찮다(확인: `index.html` 을 읽는 `inapp-block-removed` 는 `execMarkup` 이 주석을 **먼저** 지운다 ·
나머지는 전부 *우리 빌더 출력*을 재므로 주석이 없다). **HTML 본문을 잴 때는 주석을 먼저 지운다.**
이 세션 세 번째 측정 오류다(앞의 둘: 기억으로 인용한 이미지 속도 · 중첩 `@type` 계수).

## ⏳ 남은 결정 / 대기 (대표 판단)

- **#76 IndexNow 켜기** — 코드는 완성, 게이트 OFF. 대시보드 → ur-live → Settings → Variables →
  `INDEXNOW_KEY`(영숫자 8~128) + `INDEXNOW_ENABLED=true`. 켠 뒤 `https://urdeal.kr/{key}.txt` 가
  200 + 키 본문인지 확인. (키 파일 라우트는 게이트와 무관하게 응답하므로 **켜기 전에 확인 가능**.)
- **#31 결재** — `/pass/:id` 공유 카드 SVG → 사진 한 장?
- **#35 결재** — `/pass/:id` 310건 검색 제목의 "공동구매" 문구 + 꼬리 가게명
- **#68 결재** — `twitter:site` 가 없는 계정(@urdeal_kr · @utongstart)을 가리키는가

## 🔭 아직 안 재 본 각도 (다음 스윕 후보)

- `/pass/:id` 에 `review` 노드(개별 후기) — `review_count 6`·`avg_rating 4.7` 이 있고
  `aggregateRating` 은 이미 나간다. 별은 그걸로 충분해 **가치가 작다**(후기 본문·작성자 데이터를
  먼저 재야 한다).
- `/urshorts` 행의 `product_image`(우리 사진)를 크롤러 본문에 넣을지 — #59 와 같은 축이지만
  `thumb_url`(남의 유튜브 썸네일)과 섞이지 않게 **우리 사진만** 골라야 한다(별건).
- `/products/:id` 는 **렌더 뒤 `h1` 이 0개**다(실측). 크롤러 본문(`<noscript>`)엔 `<h1>` 이 있지만
  화면에는 없다. 라이브 소비자 쇼핑 상품이 **1건**이라 지금 가치는 작다 — 쇼핑을 다시 열 때 볼 것.
- **문서가 UA 로 갈리는 구조를 글로 남겨 둘 것** (이 세션에 처음 실측했다): `BOT_UA_REGEX` 에
  걸리는 UA 는 **스크립트·스타일시트가 아예 없는 문서**를 받는다(`/pass/2823` 에서 script/link
  태그 15개 전수 확인 — 엔트리 `<script>` 없음). 그래서 Googlebot·Yeti 는 **서버 첫 화면 +
  `<noscript>` + JSON-LD** 만 본다. AI 검색봇은 그 목록에 **없어서** `index.html`(앱 포함)을 받는다.
  ⚠️ 2026-10-12 에 *"AI 봇을 BOT_UA_REGEX 에 넣지 않았다 — 얻는 것이 보일러플레이트 제거뿐"* 이라고
  적었는데, 그 전제는 이제 틀렸다(#73 중복도 함께 사라진다). 다만 JS 를 렌더하는 AI 봇에게는
  **내용이 줄어드는** 쪽이라 교환이고, #73 을 `SEO.tsx` 에서 고친 뒤에는 남는 이득이 48KB 절약뿐이다.
