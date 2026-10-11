# 2026-10-11 — 크롤러가 우리 본문을 보게 (네이버 본문 · 브랜드 이름 · 이용권 매장 엔티티)

대표 지시: *"머지해줘. **네이버도 해주고.** 그리고 SEO, GEO 모두 가장 이상적인 형태인지 알아봐줄래? 우리 서비스로
트래픽이 몰려야해"* → *"언제나 최상단에 노출이 될 수 있게끔 세계최고의 SEO, GEO를 자랑하게 만들어줘"* →
*"특히 이용권 페이지들은 더욱"* → (구글 SERP 스크린샷 2장) *"저렇게 야놀자처럼 나타나는거 코드로 개선할 수 있어?"*

> ⚠️ 제가 대표에게 먼저 분명히 말한 것: **"언제나 최상단"은 어떤 SEO 로도 보장할 수 없습니다**(경쟁·도메인 나이·
> 콘텐츠 양이 정합니다). 보장할 수 있는 것은 **우리 쪽 결함을 0 으로 만드는 것**이고, 이 세션이 한 일이 그것입니다.

## 다음 세션의 첫 액션 — 배포 뒤 1분이면 재는 것

```bash
UA_YETI='Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)'
for p in / /u/jiwon1228 /pass/2915 /vouchers/2192; do
  n=$(curl -sS -A "$UA_YETI" "https://urdeal.kr$p" \
      | sed -e 's/<script[^>]*>.*<\/script>//g' -e 's/<[^>]*>/ /g' \
      | tr -s ' \n' ' ' | wc -c)
  echo "$p  본문 ${n}자"
done
```
**판정**: 네 경로 전부 **수백 자 이상**이면 통과. ✅ **이미 판정됐다**(PR #1712 머지 후 라이브):
`/` 363자 · `/u/jiwon1228` 406자 · `/pass/2915` 129자 · `/vouchers/2192` 1,214자 (배포 전 6·6·49·37자).
Googlebot·DaumOA 도 같은 값. sitemap `/u/` **4건**(배포 전 1).

🔴 **아직 안 잰 것 — 브랜드 노드(후속 커밋)**. 위 `sed` 로 글자수를 세지 말 것(greedy 라 한 줄 HTML 에서
첫 `<script>` ~ 마지막 `</script>` 를 통째로 지운다 — 실제로 `/` 와 `/u/` 가 **똑같이 1054자**로 나와서
그걸 알아챘다. **같은 값이 나오면 먼저 측정기를 의심하라**). 브랜드 판정은 이 한 줄이다:

```bash
curl -sS -A "$UA_YETI" https://urdeal.kr/ | grep -c '#organization'   # 0 → 1 이어야 한다
```

⚠️ **그 뒤 E4 는 우리가 못 잰다** — 색인은 수일~수주 걸리고 판정 화면(**서치콘솔 · 네이버 서치어드바이저**)은
**대표만** 볼 수 있다. 위 curl 은 *"우리가 줄 것을 주고 있는가"* 까지만 판정한다.

## 완료분

| | 무엇 | 왜 |
|---|---|---|
| ① | `shared/seo/crawler-ua.ts` 신규 — `shouldRenderMobileFirstScreen` = **폰 ∪ 검색 크롤러** | 서버 첫 화면이 `isMobileUserAgent` 뒤에 있었고 **Yeti UA 엔 `Mobi\|Android\|iPhone` 이 하나도 없다** |
| ② | `worker/utils/crawler-noscript.ts` 신규 — `<noscript>` 본문 요약 | 첫 화면은 [사진·제목]까지만 그린다(의도) → 크롤러에겐 "내용 없는 페이지" |
| ③ | 🩸 **되돌렸다가 되살렸다** — `shared/seo/brand-jsonld.ts` 를 **봇 셸 `<head>` 에만** 꽂았다(아래 "틀렸던 판단" ①) | `index.html` 에 있는 건 사실이지만 **봇 UA 는 그 문서를 안 받는다**(실측 `#organization` = 0). `alternateName` 의 도메인 별칭도 뺐다 |
| ④ | `detail-ssr-meta.ts` — 매장을 **독립 `LocalBusiness` 엔티티**로 + `offers.availableAtOrFrom` | `address`·`geo` 가 `Product` 안이라 **구글이 버린다** → 로컬 신호가 한 번도 전달된 적 없음 |
| ⑤ | `aggregateRating` 을 리뷰 있을 때만 | 0건에 `ratingValue: 0` 은 구글 정책 위반 + 0점짜리로 읽힌다 |

가드 `src/tests/unit/seo-crawler-visibility-2026-10-11.test.ts` 20건 + 주입 15건(`scripts/mutations/seo-crawler-visibility.mjs`)
**되돌려-검증 전부 빨간불 확인**. tsc 0 · 관련 가드 5파일 122건 pass.

## ③-2 브랜드 노드를 **봇이 받는 문서**에 (후속 커밋)

`index.html:495` 의 `Organization`+`WebSite` `@graph` 를 **데이터로** `shared/seo/brand-jsonld.ts` 에 두고,
봇 셸 `<head>` 에 `${brandJsonLdScript()}</head>` **한 줄**로 꽂았다.

- **🔴 중복은 구조적으로 불가능하다** — 두 셸은 **상호배타**다(봇 UA 면 최소 HTML, 아니면 `index.html`).
  각 문서에 정확히 한 벌이고, 제가 1차 정정에서 두려워한 결함은 **`index.html` 쪽 경로에도 넣을 때만**
  생긴다(가드가 그 방향을 고정한다).
- **🔒 값은 deep-equal 로 묶었다** — 두 벌이 갈리면 사람과 크롤러가 **다른 브랜드 설명**을 받는데 에러가
  안 난다. 시험이 양쪽을 **원문 그대로 파싱해**(주석 제거 금지 — 위 "틀렸던 판단" ②) 대조한다.
- **📏 파일 줄 수 2671 불변** — import 는 `worker/index.ts` 의 기존 한 줄 체인(`// 한 줄: 파일크기 래칫 안`)에
  덧붙이고 주석 한 줄을 제자리에서 고쳤다(`--rebaseline` 안 썼다).
- **동반**: 브랜드 설명의 폐기 명칭 **"링크샵" → "유어샵"**(2026-08-26 대표 확정). 그 문장은 **검색 AI 가
  읽는 우리 자기소개**인데 `check-legacy-domain` 류 가드의 검사 경로(`src/pages`·locales) 밖이라 지금까지
  옛 이름으로 남아 있었다.

가드: 같은 테스트 파일 `③-2` **5건** + 주입 **5건 되돌려-검증 전부 빨간불 확인**.

### ✅ E4 판정 통과 (배포 후 라이브 — 머지 `482239ee8`, PR #1714)

UA 를 바꿔 같은 경로를 받아 파싱해 재니:

| | Yeti | Googlebot | DaumOA | iPhone |
|---|---|---|---|---|
| `#organization` | **1** (이전 0) | **1** (0) | **1** (0) | 1 |
| `ld+json` 블록 | 1 | 1 | 1 | 1 |

- **Yeti 의 JSON 이 iPhone·Googlebot 과 deep-equal** — 사람과 크롤러가 같은 브랜드 설명을 받는다.
  `WebSite.name = 유어딜` · `Organization.alternateName = [urdeal, UrDeal]`(도메인 품은 별칭 없음).
- 🧷 **매달린 참조 0건** — 크롤러가 받는 `/blog`·`/pass/:id`·`/u/:handle`·`/vouchers`·`/map` 전부
  정의되지 않은 `@id` 없음(이전엔 `/blog` 가 없는 `#organization`·`#website` 를 가리켰다).

🩸 **이 측정에서 두 번 헛짚었다 — 다음 세션이 같은 함정에 빠지지 말 것**:
1. iPhone 에서 `grep -c '#organization'` 이 **2** 라 중복으로 보였다. 실제로는 하나가 노드 정의,
   하나가 `publisher: {"@id": …}` **참조**였다(`"@type":"Organization"` 도 2인데 둘째는
   `parentOrganization`). **grep 개수는 노드 수가 아니다** — 파싱해서 셀 것.
2. `<script type="application/ld+json">` 정규식이 **0개**를 냈다. 서빙 태그엔 CSP `nonce` 가 붙는다
   (`<script type="application/ld+json" nonce="…">`) → `[^>]*` 없이는 못 잡는다. 여기서도 **0 은
   결함과 측정 실패를 구분하지 못한다.**

⚠️ **사이트 이름이 실제로 `유어딜` 로 바뀌는 것은 보장되지 않는다** — 구글 공식 문서가 *"확신이 낮으면
도메인을 쓸 수 있다"* 고 명시한다. 우리가 한 것은 그 신호를 **처음으로 배달한 것**까지다. 남은 요인은
코드 밖이다(화면 로고가 `urdeal` 영문 워드마크 · 도메인 이전이 3개월 전).


## ④ 목록·유어샵 표면의 구조화 데이터 (후속 PR)

**실측이 먼저였다** — Yeti UA 로 받아 **파싱해서** 세니:

| 경로 | 받은 노드 |
|---|---|
| `/pass/2919` (상세) | `Product` · `Offer` · `FoodEstablishment` · `BreadcrumbList` ✅ |
| `/vouchers` · `/map` · `/stays` · `/browse` · `/u/:handle` | `Organization` · `WebSite` **뿐** ❌ |

🔎 **원인은 빠뜨린 인자 하나**였다: `applySurfaceMeta` 는 `jsonLd` 자리를 **이미** 갖고 있고
블로그 목록이 그 자리를 쓴다. 소비자 목록 표면만 아무도 넘기지 않았다.

신규 `src/worker/utils/surface-list-jsonld.ts`(순수) + 배선 2줄:
- 목록/정적 → `BreadcrumbList` + `CollectionPage`(항목 있으면) / `WebPage`
- 유어샵 → `BreadcrumbList` + `ProfilePage`(`mainEntity: Person`) + `ItemList`

**두 규율** (둘 다 "에러가 안 나는" 종류다):
1. **추가 요청 0** — 항목은 그 표면이 이미 받아 둔 SSR 시드에서만. 시드가 없는 표면
   (`/map`·`/stays`)은 빵부스러기만. 구조화 데이터를 위해 self-fetch 를 만들지 않는다.
2. **noindex 를 가리키지 않는다** — 항목을 내는 표면은 **허용목록 한 줄**(`/`·`/browse`)이고
   `/vouchers`(교환권 목록)는 거기 없다. 다른 목록에서도 `deal_only=1` 항목만 뺀다.

**SSOT 둘을 그대로 쓴다**: 항목 URL `canonicalDetailPath` · 유어샵 순서 `curatorHomePins`.
빵부스러기 체인은 **경로 접두를 되짚어** 만든다(`/terms/seller` → 유어딜 › 이용약관 › 판매자 약관) —
라벨은 `CONSUMER_SURFACE_SEO.crumb`, **noindex 표면엔 일부러 비워 둔다**(가드가 양방향 고정).

🔬 **라이브 시드로 렌더해서 눈으로 봤고, 그게 결함 둘을 잡았다**:
1. 유어샵 핀 사진이 `/api/media/...` **상대 경로**로 나갔다 — 구조화 데이터 `image` 는 절대 URL
   이어야 하고, 상대 경로면 구글이 그 필드를 **버리면서 에러를 안 낸다**.
2. 항목 20개면 JSON 이 **10.3KB** 였다. 이 JSON 은 **사람이 받는 응답에도 실리므로**
   (크롤러에게만 주는 것은 구글 가이드 위반) 상한을 10 으로 → **5.4KB**.

🩸 **주입 러너가 같은 자리를 두 번 잡았다 — 두 번째가 더 값지다**:
1. *"`/vouchers` 가 ItemList 를 낸다"* 주입이 **통과**했다 — 픽스처의 시드를 전부 `deal_only=1` 로
   둬서 **항목이 어차피 걸러졌기** 때문이다. 규칙을 통째로 없애도 초록이었다.
   ⇒ **"걸러지는 데이터로 걸러짐을 시험하면 아무것도 시험하지 않는다."**
2. 픽스처를 고치고 규칙을 *슬롯 허용목록 + 경로 차단목록* **두 겹**으로 만들었더니 **또** 통과했다 —
   한 겹을 없애도 다른 겹이 같은 결과를 내므로 **어느 쪽도 출력으로 판정할 수 없다.**
   ⇒ **중복 잠금은 각 잠금을 시험 불가능하게 만든다.** 규칙을 경로 허용목록 **한 줄**로 모았다
   (슬롯 겹은 애초에 지키는 게 없었다 — 모양이 다른 시드는 `listItem` 이 행마다 걸러 자연히 0건).
   그리고 시험이 *같은 시드를 허용 경로(`/`)에 주면 항목이 **생긴다***를 함께 단언한다.

가드: `surface-list-jsonld-2026-10-11.test.ts` **33건** + 주입 **17건 되돌려-검증 전부 빨간불 확인**.

⚠️ **E4(다음 세션 첫 액션)** — 배포 후 UA 별 실측:
```bash
UA='Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)'
for p in / /vouchers /u/jiwon1228 /map; do
  echo "== $p"; curl -sS -A "$UA" "https://urdeal.kr$p" \
  | grep -o '<script[^>]*application/ld+json[^>]*>[^<]*' | python3 -c "
import sys,re,json
for l in sys.stdin:
    b=re.sub(r'^<script[^>]*>','',l.rstrip())
    try: d=json.loads(b)
    except Exception: continue
    print(' ', [n.get('@type') for n in (d.get('@graph') or [d])])"
done
```
판정: `/vouchers`·`/map` 에 `BreadcrumbList` 가 생겼는지 · `/`·`/u/:handle` 에 `ItemList` 가
생겼는지 · 항목 URL 이 전부 `/pass/`·`/stays/`·`/products/` 이고 **`/vouchers/` 가 0건**인지.
⚠️ 정규식에 `[^>]*` 를 빼면 CSP `nonce` 때문에 **블록 0개**로 읽힌다(③-2 에서 겪었다).

## 이번에 틀렸던 판단 (이게 제일 값지다)

1. 🔴🔴 **같은 항목에서 두 번 틀렸다 — 그리고 두 번째가 더 비쌌다.** 순서대로:
   - **1차 진단**: *"홈 JSON-LD 가 0건이라 사이트 이름이 도메인으로 떨어졌다"* → `shared/seo/brand-jsonld.ts`
     를 만들었다.
   - **1차 정정(이게 틀렸다)**: `index.html:495` 에 `Organization`+`WebSite` `@graph` 가 **이미** 있고
     `name` 이 `유어딜` 이고 `@id` 까지 똑같은 것을 보고 *"내 코드는 같은 `@id` 두 벌 = 중복"* 이라며
     모듈을 **통째로 지웠다**(`inLanguage` 가 `ko` ↔ `ko-KR` 로 어긋난 것도 사실이었다).
   - **2차 정정(라이브 UA 실측이 결판)**: 같은 경로를 UA 만 바꿔 받아 보니 —

         UA                         서빙 셸                            `#organization`
         iPhone · PC                index.html(정적 @graph 포함)        있음
         Yeti · Googlebot · DaumOA  app.get('*') 의 손으로 쓴 최소 HTML    **0**

     **즉 `WebSite.name = 유어딜` 은 어떤 검색 크롤러도 한 번도 받은 적이 없다.** `index.html` 에
     있는 건 사실이지만 **봇 UA 는 그 문서를 받지 않는다**(2026-04-28 카톡 인앱 무한 reload 사고 때
     만든 최소 셸 — meta 만 있고 script·stylesheet·JSON-LD 가 없다). 제가 두려워한 중복은 두 셸이
     **상호배타**라 구조적으로 불가능했다.
   ⇒ **교훈 둘.** ① *"코드에 없다" ≠ "라이브에 없다"*(1차 오진 — 정적 `index.html` 은 소스 검색에 잘
      안 걸린다). ② ***"파일에 있다" ≠ "크롤러가 받는다"***(2차 오진 — 이쪽이 더 함정이다. 파일을
      열어 눈으로 확인하면 "있다" 가 확실해 보이지만, **누가 그 문서를 받는지**는 파일이 말해 주지
      않는다). 두 번 다 **라이브를 UA 별로 재서야** 결판났다.
   🧷 **같은 실측에서 더 나쁜 것도 드러났다**: 크롤러가 받는 `/blog` 의 JSON-LD 는
      `publisher: {"@id": ".../#organization"}` · `isPartOf: {"@id": ".../#website"}` 로 **정의되지
      않은 `@id`** 를 참조하고 있었다(dangling reference — 그 두 노드가 그 문서에 없다). 즉 사이트
      전체가 없는 브랜드 노드를 가리키고 있었다.
   ✅ **수리**: 모듈을 되살려 **봇 셸 `<head>` 에만** 꽂았다(`${brandJsonLdScript()}</head>` 한 줄,
      사람 셸은 byte-동일). 값은 `index.html` 블록과 **deep-equal** 로 고정(두 벌이 갈리면 사람과
      크롤러가 다른 브랜드 설명을 받는데 에러가 안 난다). 기존 가드의 *"모듈이 되살아나면 중복"*
      단언은 **지우지 않고** *"존재 + 사람 셸 쪽 경로엔 안 들어간다"* 로 재조준했다.
2. 🔴 **그 수정에서 또 하나 깨뜨렸다 — 주석을 JSON 안에 넣었다.** JSON 에 주석은 못 들어가므로 그
   JSON-LD 가 통째로 무효가 되는데, **제 확인 스크립트가 주석을 먼저 지우고 파싱해서 "OK" 가 떴다.**
   브라우저도 구글도 주석을 지워 주지 않는다. ⇒ **검사기가 입력을 정규화하면 그 결함을 영원히 못 본다.**
   가드를 *원문 그대로 파싱* 으로 고쳐서 잡았다(주입으로 빨간불 확인).
3. **"GEO = 0" 이라고 보고하려 했다.** 대표가 보내 준 스크린샷에 **구글 AI 개요가 유어딜을 정확히 설명하고 있었다.**
   AI 개요는 **Googlebot 색인**으로 만들어지므로 GPTBot 차단과 무관하다. 막힌 것은 ChatGPT·Claude·Perplexity 쪽뿐이다.
   ⇒ *"AI 크롤러가 막혔다"* 에서 *"AI 검색 전부가 안 된다"* 로 번역하면 틀린다.
5. **주입을 주석에 심어 헛돌았다.** `/** Yeti… */` 로 결함을 심었는데 `readCode` 가 주석을 걷어내 단언이 못 봤다
   (이 레포가 반복해 밟은 자리). **판정 대상은 코드다** — 술어의 정규식 자체에 심어야 빨간불이 난다.
6. 🩸 **주입 하나가 헛돌아 함수 모양이 바뀌었다.** *"브랜드 JSON-LD 를 HTML escape 한다"* 결함을
   심었는데 테스트가 **통과**했다 — 지금 브랜드 데이터엔 `&`·`<` 가 **한 글자도 없어서** escape 를
   끼워 넣어도 결과가 같다. **상수만 싸는 함수는 "escape 를 했는가" 를 판정할 수 없다.**
   ⇒ 탈출 처리를 인자를 받는 `jsonLdScriptTag(data)` 로 빼고 **탐침 값**(`a&b` · `1<2` · `x</script>y`)
   으로 **동작을 재도록** 고쳤다. 주입 러너가 없었으면 "지키는 척" 하는 단언으로 남았다.
7. **핀 구조를 중첩으로 가정했다.** `pins[].product.name` 으로 썼는데 SSOT(`CuratorSeedPin`)는 **평평하다**
   (`pins[].product_name`). 중첩으로 읽으면 전부 `undefined` 가 되는데 **에러가 안 나고 `<noscript>` 가 조용히 빈다.**
   시드 모양은 기억이 아니라 타입에서 가져올 것.
7. **`isScraperUA` 가 미배선이라고 단정했다** — grep 에 테스트만 잡혀서였다. 실제로는 `scrapeProtection` 안에서 쓰이고
   그 미들웨어는 마운트돼 있다(단 `/api/products`·`/api/group-buy/*` 세 접두어에만).

## 🔎 전수 실측 — "또 개선할 부분" (2026-10-11, 라이브)

소비자 표면 10개 전수: **전부 200 · canonical 1개 · og:image 있음 · 깨진 URL 0.** 위생은 좋다.
문제는 **구조화 데이터와 색인 요청의 커버리지**다.

| 발견 | 실측 | 성격 |
|---|---|---|
| ✅ **유어샵 색인 누락 — 이 PR 에서 고쳤다** | 내용 있는 유어샵 **4곳 중 3곳 누락**(sitemap `/u/` **1개**) → 4곳 전부 제출 | **구조적** — `sitemap.routes.ts` 쿼리가 `FROM sellers` 로 시작했다. 유어샵은 **모든 유저**가 갖는데(명칭 SSOT) 사업자가 아니면 `sellers` 행이 없어 **들어갈 수가 없었다**. `FROM users` 쿼리를 **추가**(핀 ≥ 1, 중복 Set 으로 제외) |
| 🟡 유어샵에 페이지 고유 구조화 데이터 **0** | `/u/jiwon1228` = `Organization`+`WebSite`(브랜드 블록)뿐 | 공유로 퍼지는 표면인데 구글이 *이 페이지가 무엇인지* 모른다. `ProfilePage`+`ItemList`(진열 이용권) 후보 |
| 🟡 목록 표면 구조화 데이터 **0** | `/vouchers`·`/browse`·`/map`·`/stays` 전부 브랜드 블록뿐 | sitemap priority 0.9 로 제출되는데 `ItemList`·`BreadcrumbList` 없음 |
| 🟢 `llms.txt` **404** | — | AI 검색이 보는 관례 파일 |
| ✅ 교환권 상세 `noindex` | `/vouchers/2192` → `noindex, follow` · sitemap `/vouchers/` 상세 **0건** | 2026-07-07 결정대로 **정상**(우회 없음) |
| ✅ sitemap 451 URL | `/pass/` 360 · `/blog/` 21 · 죽은 URL 0 | 정상 |

**sitemap 유어샵 쿼리의 실측 근거**(D1, 읽기 전용):
```
핸들 보유 유저(유어샵 주소 있음)        17
핀(담기) 보유 유저                       4
  그중 sellers 행 없음 = 구조적 누락     3   ← 색인 요청 불가
현재 sitemap 제출(셀러 경유)             3   (handle 있는 건 1 → /u/ 1개)
```

### ✅ 그 누락을 이 브랜치에서 고쳤다 (추가 커밋)

`sitemap.routes.ts` 에 **`FROM users` 쿼리를 추가**했다(기존 셀러 쿼리는 한 글자도 안 건드렸다):

```sql
SELECT u.handle FROM users u
 WHERE u.handle IS NOT NULL AND TRIM(u.handle) <> ''
   AND EXISTS (SELECT 1 FROM product_pins pp WHERE pp.user_id = u.id)
 ORDER BY u.id DESC LIMIT 200
```

- **콘텐츠 기준은 기존 블록과 같다** — 핀 1개 이상. 이름 패턴으로 거르지 않는다(2026-07-29 의 그 이유).
- 🔑 **그 기준이 워커 첫 화면 빌더와 짝이다**: `buildCuratorFirstScreen` 은 `pins.length === 0` 이면
  `''` 를 돌려주므로 핀 0 을 제출하면 크롤러가 받는 것은 로더뿐이다(= soft-404). 핀 ≥ 1 만 내보내면
  **제출한 URL 은 전부 본문이 있다.** 가드가 양쪽을 같이 본다.
- **중복은 `Set` 으로 막는다** — 승인 셀러가 연결된 유어샵은 앞 블록이 이미 `/u/{handle}` 을 냈다.
  같은 `<loc>` 이 두 번이면 sitemap 자체가 무효 취급될 수 있어, 고치려던 것이 더 큰 결함이 된다.
- **몰 스코프를 걸지 않는다** — `users` 에 `mall_id` 가 없고(유저는 몰에 속하지 않는다), 제출하는 것은
  상품 URL 이 아니라 **유어딜 본진 표면**인 `/u/{handle}` 이다.

**실측 검증(라이브 D1, 읽기 전용)**: 새 쿼리 → `['user40','user31','jongmun','jiwon1228']`,
중복 제외 후 **신규 3건**(`user31`·`jongmun`·`jiwon1228`).

가드: `sitemap-urshop-users-2026-10-11.test.ts` **10건** — SQL 문자열을 **소스에서 뽑아 `node:sqlite` 에
넣고 실제로 돌린다**(베껴 쓰면 두 벌이 갈린다). ① 기존 쿼리만으론 `user40` 하나뿐임을 **회귀 앵커로 고정**
② 핀 ≥ 1 만 집는가 · 핀을 다 떼면 0건인가(늘 통과하는 쿼리가 아님) ③ 중복 Set 의 기록·확인이 **쌍인가**
④ 첫 화면 빌더와 기준이 같은가. 주입 **6건 되돌려-검증 전부 빨간불 확인**.

🩸 그 시험의 첫 판이 **거리 앵커**(`[\s\S]{0,200}`)를 써서 빨간불이 났다 — 사이에 주석 한 줄만 들어가도
깨지는 모양이고, 2026-10-08 에 이미 값을 치른 자리다 ⇒ **블록을 잘라** 각 루프 안을 보도록 고쳤다.

**⚠️ E4 는 배포 후**: `curl -sS https://urdeal.kr/sitemap.xml | grep -c '<loc>https://urdeal.kr/u/'`
→ **4**(배포 전 1). 색인 자체는 서치콘솔에서 대표만 보실 수 있다.

## 남은 결정 / 대기 (대표 판단)

- **🔴 AI 크롤러 정책** — GPTBot·ClaudeBot 이 **Cloudflare 엣지에서 403**(우리 코드 아님: `server: cloudflare`,
  25바이트 응답, 워커 헤더 0). 2026-08-22 대표 *"크롤링도 마찬가지"* 의 결과이고, **학습 크롤러와 검색·인용 크롤러가
  구분되지 않은 채** 함께 막혀 있다. 되돌리면 ChatGPT·Perplexity 가 유어딜을 인용할 수 있다. **대시보드는 대표 소관**이고
  세션은 플랫폼 쓰기를 하지 않는다 ⇒ 결재함 항목.
- **다국어** — `hreflang` **0건** · 서버 HTML `<html lang="ko">` 고정 · `og:locale` `ko_KR` 하나 · 언어별 URL 없음.
  클라 i18n 6개 언어는 **JS 뒤에 바뀌므로 색인되지 않는다.** 인바운드 관광 수요를 노리려면 `/en/pass/:id` 식 URL 체계가
  필요하고 라우팅·사이트맵·캐시키·SSR 시드까지 닿는 **큰 변경**이다. 한국어 색인이 먼저 서야 한다는 것이 제 의견.
- **사이트링크(야놀자의 6줄)** — **신청 수단이 없다.** 구글 자동 선정이고 `SearchAction` 검색창 사이트링크는 2024-11
  지원 종료. 코드로 되는 둘(파비콘 #1704 · 사이트 이름 이번 PR)은 끝냈다. 앱 설치 카드는 앱이 있어야 한다.
- **남은 점검** — 유어샵 페이지 고유 구조화 데이터(`ProfilePage`+`ItemList`) · 목록 표면 `BreadcrumbList`
  (`/vouchers`·`/map`·`/stays`·`/browse` 전부 0건) · `llms.txt`(현재 404).

## 못 한 것 · 범위 밖

- **PC(lg+) 첫 화면은 그대로다** — 크롤러는 모바일 HTML 을 받는 것이 정상(Dynamic Serving)이고, PC 사용자 응답은
  byte-동일이다.
- `<noscript>` 는 **첫 화면이 안 그리는 것만** 담는다. 안내 문구를 지어내 넣지 말 것(클로킹이 된다 — 그 규율이
  `crawler-noscript.ts` 머리말에 있다).

---

## ⑤ GEO — AI 검색·인용 크롤러는 페이지 허용 / API 차단 (PR 대기)

대표 *"SEO, GEO 모두 가장 이상적인 형태인지"* · *"세계최고의 SEO, GEO를 자랑하게 만들어줘"* ·
*"우리 서비스로 트래픽이 몰려야해"*.

### 🔎 실측이 바꾼 진단 — 이전 판("학습과 검색이 구분 안 된 채 함께 막혀 있다")은 **반만 맞았다**

`urdeal.kr/` HTML 을 UA 만 바꿔 받아 봤다(2026-10-11):

| UA | HTTP | 성격 |
|---|---|---|
| GPTBot · ClaudeBot | **403** | 학습 |
| OAI-SearchBot · ChatGPT-User | **200** | 검색·인용 |
| Claude-SearchBot · PerplexityBot | **200** | 검색·인용 |
| Googlebot | 200 | 색인 |

⇒ **엣지(Cloudflare)는 이미 둘을 정확히 가르고 있었다.** 구분이 없던 쪽은 **우리 `public/robots.txt`**
하나였다 — 거기서 `OAI-SearchBot`·`ChatGPT-User`·`PerplexityBot`·`Perplexity-User` 가 학습 봇과
같은 `Disallow: /` 그룹에 들어 있었다.

🔑 **그래서 이것은 정책 선택이 아니라 내부 불일치였다.** 그리고 어긋난 방향이 가장 나쁜 쪽이다 —
검색·인용 크롤러는 robots 를 **지키는** 봇이라, 결과는 *"ChatGPT·Perplexity 답변에 우리를 링크로
인용해 줄 수 있는 크롤러에게만 오지 마라고 말하기"* 였다. 엣지는 통과시키는데 우리가 돌려보냈다.
그 블록의 주석 자신이 *"둘은 다른 봇이다"* 라고 적어 두고도 한 덩어리로 묶여 있었다(2026-08-22
당시엔 사업자들이 봇을 안 쪼갰다 — 그 뒤 쪼갰고 우리 파일만 그대로였다).

### 수정 — 목록에서 **빼기만** 했다 (전용 그룹을 안 만든 이유)

- `public/robots.txt`: 다섯(위 넷 + `Claude-SearchBot`)을 차단 목록에서 제거 → `User-agent: *`
  그룹(= 공개 허용 + 비공개 Disallow)으로 떨어진다.
- 🔴 **`Allow: /` 전용 그룹을 만들면 안 된다**: robots.txt 그룹은 **합쳐지지 않고 가장 구체적인 하나만**
  적용된다. 제 이름 그룹이 생기는 순간 그 봇은 `*` 의 `/admin`·`/seller/login` … Disallow **71개를
  통째로 무시**한다. 비공개 목록을 두 벌로 베끼는 것도 답이 아니다(반드시 갈린다). 그래서 "빼서
  폴백" 이 정답이고, 가드가 *전용 그룹이 생기지 않았는지* + *`*` 그룹이 실제로 비공개를 막는지* 를 함께 본다.
- `src/worker/middleware/bot-detection.ts`: 다섯을 `SCRAPER_UA_PATTERNS` 에 **그대로 남긴다**
  (+ 빠져 있던 `Claude-SearchBot` 추가) → `/api/products`·`/api/group-buy/*` 등 공개 JSON 은 계속 403.

### 🔀 비대칭이 의도다 (이게 이 변경의 핵심이고, 가장 되돌려지기 쉬운 지점)

**robots 는 페이지를 허용 / 헤더는 API 를 차단.** 검색 크롤러가 필요한 것은 서버가 그려 주는
**HTML**(①~④ 가 만든 첫 화면 + `<noscript>` 요약 + JSON-LD)이라 **GEO 손실이 0** 이고, 가격표를
벌크로 긁는 경로는 닫힌 채 남는다. ⚠️ 한쪽만 보면 "목록이 어긋났다" 며 맞추고 싶어진다 —
어느 방향으로 맞춰도 손해다(robots 에 다시 넣으면 유입이 끊기고, 헤더에서 빼면 API 가 열린다).
가드가 **양방향으로** 고정한다.

🔒 **SSR 은 영향 없다**: self-fetch 는 자기 UA(`ur-live-ssr-prefetch/1.0`, `ssr-payload.ts:98`)를
쓰므로 이 403 에 걸리지 않는다(기존 가드가 이미 그걸 고정하고 있었다).
📌 **`Google-Extended` 는 차단 유지** — 그것은 Gemini *학습* 거부이고 구글 AI 개요(AI Overviews)는
`Googlebot` 색인을 쓴다. 즉 막아도 AI 개요 노출은 안 깎인다(흔한 오해).

### 가드

`content-protection.test.ts` 에 describe 1개(5건) 추가 — 기존 4건은 **풀지 않았다**(차단 목록이
줄기만 해서 그대로 통과한다). 주입 `scripts/mutations/geo-ai-search.mjs` **6건 되돌려-검증 전부
빨간불 확인**(robots 재차단 2 · 헤더 제거 2 · 학습 해제 1 · `*` 그룹 Disallow 제거 1).
검증: 유닛 18건 pass · `check-robots-private-routes` 386라우트 통과 · pre-push 게이트 가드 103개.

⚠️ **이 가드가 못 보는 것**: 그 봇들이 실제로 크롤하는지 · ChatGPT·Perplexity 답변에 인용되는지
(둘 다 외부 판정, 수일~수주) · **Cloudflare 엣지의 AI 봇 차단 설정**(대시보드이고 레포가 못 본다 —
세션은 읽기 전용, 대표만 바꾼다. GPTBot·ClaudeBot 403 은 거기서 온다).

### E4 (배포 후, 한 줄)

```bash
curl -sS --max-time 15 https://urdeal.kr/robots.txt | grep -cE '^User-agent: (OAI-SearchBot|ChatGPT-User|PerplexityBot|Perplexity-User|Claude-SearchBot)$'
# → 4 → **0** 이어야 한다 (배포 전 4건: Claude-SearchBot 은 원래 없었다)
curl -sS --max-time 15 https://urdeal.kr/robots.txt | grep -cE '^User-agent: (GPTBot|ClaudeBot|CCBot|Google-Extended|Bytespider)$'
# → **5 유지** (학습 쪽은 그대로 막혀야 한다)
curl -sS -o /dev/null -w '%{http_code}\n' -A 'Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)' https://urdeal.kr/api/products
# → **403** (페이지는 열고 API 는 닫은 그 비대칭이 살아 있는지)
```
⚠️ **"이 PR 이 ChatGPT 답변에 우리를 띄웠다" 고 보고하지 말 것** — 우리가 한 것은 *돌려보내지
않기*까지다. 인용 여부는 그들이 정하고 수일~수주 걸린다.

### 📌 남은 것 (대표 판단 대기)

- **다국어(hreflang 0건)** — 언어별 URL 은 큰 변경. 내 의견: 한국어 색인이 먼저.
- **`llms.txt` 404** — 비표준이고 어느 엔진도 공식 지원을 announce 하지 않았다. 값 불확실.

---

## ✅ E4 판정 — ④ #1715 · ⑤ #1716 둘 다 통과 (배포 `1e6881238`)

둘이 한 배포에 실렸다(#1715 의 `cc67a296c` 배포는 #1716 푸시에 밀려 취소됐고, `1e6881238` 이 둘을 모두 포함).

### ④ 목록·유어샵 구조화 데이터 (머지 `cc67a296c`)

Yeti UA 로 받아 **파싱해서** 셌다:

| 경로 | BreadcrumbList | ItemList | 항목 | 접두 |
|---|---|---|---|---|
| `/` | — (루트라 의도) | 1 | **10** | `/pass` 10 |
| `/browse` | `유어딜 › 쇼핑` | 1 | 1 | `/products` 1 |
| `/u/jiwon1228` | `유어딜 › 정지원임` | 1 | 4 | `/pass` 3 · `/stays` 1 |
| `/vouchers` | `유어딜 › 교환권` | 0 | 0 | — (의도) |
| `/map` | `유어딜 › 동네딜 지도` | 0 | 0 | — |
| `/stays` | `유어딜 › 숙소 이용권` | 0 | 0 | — |
| `/terms/seller` | `유어딜 › 이용약관 › 판매자 약관` | 0 | 0 | — |
| `/pass/2919` | `홈 › 동네딜 › 달빛한스푼 닭도리탕` | 0 | 0 | (상세 종전대로) |

그리고: `/u/jiwon1228` 에 **`ProfilePage` + `Person`** 실재 · **`position` 이 전 표면에서 1..N 연속** ·
**항목 URL 중 `/vouchers/` 0건** · **상대 URL·상대 이미지 0건** · **매달린 `@id` 0건**(`/blog`·`/pass/:id`
포함 7경로 — #1714 가 해소한 성질이 새 노드에서도 유지된다).

🩸 **이 판정의 첫 측정이 `/` 와 `/browse` 를 "항목 0건" 으로 읽어 결함으로 오진할 뻔했다.**
내 측정기가 `@graph` **top-level 만** 훑었는데 `ItemList` 는 `CollectionPage.mainEntity` **안**에
중첩돼 있다(유어샵만 top-level 이라 그쪽만 보였다). 라이브 시드를 따로 받아 보니 `deal_only=0`
짜리가 **50건** 멀쩡히 있었고, 그제서야 측정기를 의심했다.
⇒ **같은 세션에서 세 번째다**: ① `grep -c` 개수 ≠ 노드 수(`publisher` 참조를 중복으로 오독)
② 서빙 태그의 CSP `nonce` 때문에 정규식이 블록 **0개**로 읽음 ③ 이번 중첩.
**구조화 데이터 판정은 재귀로 훑어서 할 것.** 재사용 가능한 측정기를 스크래치패드에 두었다
(`e4b.py` — `walk()` 가 `mainEntity` 등 중첩까지 전부 모은다).

### ⑤ AI 검색·인용 크롤러 분리 (머지 `1e6881238`)

```
robots.txt  검색·인용 5종(OAI-SearchBot·ChatGPT-User·PerplexityBot·Perplexity-User·Claude-SearchBot)   4 → 0 ✅
robots.txt  학습 5종(GPTBot·ClaudeBot·CCBot·Google-Extended·Bytespider)                                 5 유지 ✅

라이브 비대칭 실측            HTML   API(/api/products)
  OAI-SearchBot                200        403    ← 페이지 허용 / API 차단
  PerplexityBot                200        403
  Claude-SearchBot             200        403
  Googlebot                    200        200    ← 한 번도 안 막힌다
```

의도한 비대칭이 라이브에서 그대로 성립한다.

### 📌 다음 세션의 첫 액션

**없다 — 이 라인은 열린 작업이 없다.** 대표 판단 대기 두 건만 남아 있고, 먼저 시작하지 말 것:

1. **다국어(hreflang 0건)** — 언어별 URL 은 큰 변경. 내 의견: 한국어 색인이 먼저.
2. **`llms.txt` 404** — 비표준이고 어느 엔진도 공식 지원을 announce 하지 않았다. 값 불확실.

### ⚠️ 이번에 틀렸던 판단 (같은 오진 반복 방지)

- **브랜드 신호를 두 번, 서로 반대 방향으로 오진했다**(③·③-2 참조). 결판은 **UA 별 라이브 실측**이
  냈다 — **파일에 있다 ≠ 크롤러가 받는다.** 두 셸(봇 최소 HTML / `index.html`)은 상호배타다.
- **"0" 을 세 번 결함으로 읽었다**(위 ④ 참조). **0 이 나오면 먼저 측정기를 의심할 것.**
- **중복 잠금은 각 잠금을 시험 불가능하게 만든다** — 주입 러너가 그걸 잡았다(④ 규칙을 두 겹으로
  짰더니 한 겹을 없애도 다른 겹이 같은 결과를 냈다). 규칙은 한 줄로 모을 것.
