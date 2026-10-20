# 2026-10-15 — SEO/GEO 재점검: 서빙 문서 무게 + 매장 엔티티 비대칭

대표 *"그래서? Seo, geo 개선해줘"*. 라이브를 다시 쓸었고 **고친 것 둘 · 기각 일곱**이다.
기각 쪽이 더 값지다 — 그 일곱은 다시 파지 말 것.

## 다음 세션의 첫 액션

`#1830` 이 머지됐으면 **E4 를 배포 후 라이브로 판정**한다(둘 다 1분이면 재진다):

```bash
# ① 서빙 문서에서 주석이 빠졌는가 (gzip 약 8KB)
curl -sS --compressed -o /dev/null -w 'gzip=%{size_download}\n' https://urdeal.kr/
curl -sS https://urdeal.kr/ | grep -c '<!--'          # 기대 0
# ② 이용권 매장 노드가 url 을 내는가 (종전 0/30)
curl -sS -A 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' \
  https://urdeal.kr/pass/2919 | python3 -c '
import sys,re,json
h=sys.stdin.read()
for m in re.finditer(r"ld\+json[^>]*>(.*?)</script>",h,re.S):
    t=m.group(1)
    if "FoodEstablishment" in t: print(json.dumps(json.loads(t),ensure_ascii=False)[:400])'
```
기대: `"url": "https://urdeal.kr/pass/2919"` 가 `FoodEstablishment` 안에 있고,
`priceRange`·`description`·`openingHours` 는 **없다**(지어내지 않기로 한 것).

🔴 **주석 0 이 아니면** vite 플러그인이 안 돈 것이다 — `dist/client/index.html` 을 먼저 보라
(머지 전 로컬 빌드에서는 **주석 0 · gzip 16,551B** 로 확인했다).

## 고친 것

### ① 서빙 `index.html` 의 HTML 주석 = gzip 8,073B (#91)

| | raw | gzip |
|---|---|---|
| 소스 `index.html` | 65,471 | 24,331 |
| 주석 제거 후 | 45,914 | 16,258 |
| **차이** | **19,557 (30%)** | **8,073** |

🔢 **퍼센트는 분모를 밝혀야 한다**(2026-10-15 배포 전 라이브 재측정). 위 30% 는 **소스
`index.html` 65,471B** 기준이고, **라이브 서빙 문서**는 워커가 SSR 시드 48,457B 를 더해
126,201B 라 같은 19,557B 가 **15%** 다(시드 제외 77,744B 기준 25%). gzip 기여도 재니
**8,051B**(위 표 8,073 과 22B 차 — 시드가 섞여 측정 시점마다 흔들린다).
⇒ **안정적인 값은 바이트(19,557 raw / ~8KB gzip)** 이고 퍼센트는 하나로 말하면 안 된다.

문서는 임계 경로의 **맨 앞**이라 모든 하드로드가 먼저 받는다. 그런데 `check-bundle-size` 는
dist index.html 의 `script`·`modulepreload` 만 세므로 **그 예산 밖**이었다 — 이 레포가 한
아이콘 다이어트(3.4KB br)·i18n 분리보다 큰 덩어리가 아무도 안 보는 자리에 있었다.
그중 **12개 9,913B** 는 `shared/og-share-image.ts`·`App.tsx 의 useStatusBarTheme()` 같은
내부 파일·심볼 이름을 담은 개발 메모다 — 사람 화면엔 안 보이지만 **언어모델은 토큰으로 읽는다**(GEO).

**처방**: `scripts/strip-html-comments.mjs`(Vite `transformIndexHtml`, `order: 'post'`).
🔒 **소스는 1바이트도 안 바뀐다** — 그 주석은 이 레포의 자산이고, 잠금표가 `index.html` 에서
지키는 것(preload `crossOrigin` 없음 · Speculation Rules · preconnect · 청크 부트가드 ·
폰트 지연 · 지도 SDK 조기 출발)은 전부 **코드**라 주석만 빠지면 byte-불변이다. 방향도 잠금과
같다 — 임계 경로 바이트를 **줄인다**.

🩸 **이 레포가 다섯 번 밟은 자리를 피했다**: 순진한 주석 제거기는 문자열 안의 구분자를 주석
시작으로 읽어 코드를 먹는다. 오늘 인라인 스크립트에 `<!--`·`-->` 가 **0개**라 안전하지만
**내일 하나 생기면 조용히 깨진다** ⇒ 플러그인이 매 빌드 **무손실을 자기검증**하고 어긋나면
**빌드를 멈춘다**(인라인 블록 내용 + 태그 8종 개수).

**실측(로컬 `npx vite build`)**: dist index.html raw 47,097 · gzip **16,551** · 주석 **0** ·
preconnect 8 · Speculation Rules 1 · nonce 2 · script 15 **전부 보존**.

### ② 매장 엔티티 `url` 비대칭 (#92)

실측(Googlebot UA, 표본 44):

| 빌더 | `url` | `priceRange` | `description` |
|---|---|---|---|
| `LodgingBusiness` (숙소) | 14/14 | 14/14 | 14/14 |
| `FoodEstablishment` (이용권) | **0/30** | 0/30 | 0/30 |

빌더 단위로 정확히 쪼개진다 — 데이터가 없어서가 아니라 **그 자리에 안 적혀 있어서**다.
`url` 은 구글 LocalBusiness 권장 필드이고 `canonical` 은 이미 계산돼 있어 **새 조회 0**.

🔑 **페이지 간 모순이 안 생기는지 먼저 쟀다**: 활성 딜 **359건의 고유 매장 358**(1매장=1딜,
2개인 곳 한 곳). 한 매장이 여러 딜을 가지면 각 딜 페이지가 서로 다른 `url` 을 주장하는데
실측 분포가 1:1 이라 그 일이 안 일어난다.

🔴 **`priceRange`·`description` 은 일부러 안 넣었다** — 숙소는 상품이 곧 그 숙소라 객실
가격대·소개가 그 업체의 것이지만, **이용권은 상품 ≠ 매장**이다. 딜 한 건의 값을 식당의
가격대·소개라고 말하는 것은 지어내기다. 주입 ⑦이 그 방향을 막는다("일관성" 을 이유로 몰지 말 것).

## 🧾 결함 아님으로 판정 — 다시 파지 말 것

| 재 본 것 | 실측 | 판정 |
|---|---|---|
| `/products/:id` 의 `Product.brand` 부재 | `brand_name` 이 응답에 **없다**(빌더가 늘 `undefined`). 쓸 값은 `restaurant_name` 인데 실측 **`구서 우성아파트`**(장소명). sitemap 의 `/products` **0건** | 데이터가 브랜드가 아니고 색인 대상도 아니다 |
| 제목·설명 중복 | 표본 50(`/pass` 34·`/stays` 16) **고유 50/50** · 제목 18~41자 · 설명 76~109자 | 정상 |
| 산문 ⭐평점 ↔ `aggregateRating` | 표본 60 **불일치 0** | 정상 |
| UA 별 본문·구조화 데이터 | Googlebot·Yeti·OAI·Perplexity·iPhone **전부 동일**(139/228/451/350/451자, ld 2) | **측정기 오류였다**(아래) |
| 유어샵이 자기 상품을 안 링크한다 | 원문에 `<a href="/pass/2919">`·`<a href="/products/2917">` 실재 | **해석 오류였다**(아래) |
| `openingHours`·`servesCuisine` | `/api/group-buy/products/:id` 응답에 시간 키 **0개** | 데이터가 없다 |
| `Organization`·`WebSite`·`ItemList.numberOfItems`·image sitemap(359)·sitemap 분할(455 ≪ 50,000) | 전부 완비 | 정상 |

## 🩸 이번에 틀렸던 판단 — 측정기를 세 번 의심해야 했다

1. **주석 제거기**: 본문 추출을 `<[^>]+>` 로 했더니 **주석 안의 `>` 에서 끊겨** 나머지를 본문으로
   셌다. 그래서 *"Googlebot 139자 vs AI 봇 290자 — 트래픽 주는 엔진이 더 적게 받는다"* 로 읽고
   결함으로 보고할 뻔했다. `<!--[\s\S]*?-->` 를 **먼저** 지우니 전부 동일.
   🔑 그 오류가 **진짜 결함(주석 8KB)을 알려 줬다** — 틀린 쪽이 더 많이 알려 준 경우다.
2. **place 노드 census**: `@id` 가 `#place` 로 끝나는 것으로 찾았더니 `availableAtOrFrom` **참조**가
   잡혀 `place keys x60: ['@id']` 가 나왔다. `@type` 으로 찾아야 한다.
3. **`a태그 1개` 해석**: "로고뿐, 상품 링크 0" 으로 읽었는데 **봇 셸엔 로고 `<a>` 가 없어서**
   그 1개가 바로 상품 링크였다. 본문 64자도 결함이 아니라 **그 가게 상품이 1개**라서다.
4. **`tsc exit=$?`**: 파이프(`| head`) 뒤라 **`head` 의 종료코드**를 읽었다. 판정으로 쓸 수 없다.
5. **주입 탐침 방향**: 스크립트에 `-->` 를 심었는데 **홀로 있는 `-->` 는 매치를 시작하지 않는다**
   (무해). 위험한 방향은 **스크립트 안의 `<!--`** 가 뒤 주석의 `-->` 까지 먹는 것이다.
6. **주입 `replace` 가 `find` 의 부분문자열**: `'    } : null'` 로 썼더니 그 문자열이 파일에 3번
   나와 **거짓 "복원 실패"** 가 떴다(CLAUDE.md 가 적어 둔 그 함정). 읽히지 않는 이름
   (`urlOmitted`)으로 바꿨다 — 결함은 그대로다.

### 7. `.mjs` 를 import 하는 시험은 `.d.mts` 형제 선언이 필요하다 (선례 13건)

제 tsc 실행이 그 경로를 안 봐서 "tsc 0" 으로 보고했는데 **pre-commit 이 TS7016 으로 막았다.**
레포엔 길이 둘이다 — `.d.mts`(실제 타입, 13건) ↔ `@ts-ignore`(any, 2건). 전자를 썼다: 후자는
시그니처가 바뀌어도 안 잡힌다. ⚠️ **"tsc 0" 을 보고하기 전에 전체 tsc 가 그 파일을 셌는지 볼 것.**

### 8. auto-merge 는 `merge_method` 를 빼면 422 다 (CLAUDE.md 에 기록)

본문 없이 `PUT /ccr/auto_merge` → `Merge method merge commits are not allowed`. 이 레포는 squash
전용이다. 그 문장을 *"auto-merge 를 못 쓴다"* 로 읽으면 2026-10-14 규칙이 막으려던 자리로 돌아간다.

### 9. 퍼센트를 분모 없이 적었고, GEO 숫자는 **과소**했다

머지 대기 중에 라이브를 다시 재서 문서·시험·주석을 셋 다 고쳤다.

| 적었던 것 | 실제 | 왜 틀렸나 |
|---|---|---|
| "서빙 문서의 주석이 30%" | 소스 65,471B 기준 30% · **서빙 문서 기준 15%** | 워커가 SSR 시드 48,457B 를 더한다 — 분모가 다르다 |
| "내부 이름 담은 주석 9개 3,116B" | **12개 9,913B** | 세는 패턴이 좁았다(`src/`·`.ts`·`fn()` 를 다 봐야 한다) |

바이트(19,557 raw / ~8KB gzip)는 어느 기준에서도 같다 ⇒ **퍼센트보다 바이트로 말한다.**
CLAUDE.md 가 적어 둔 *"근거를 과장하면 다음 세션이 그 과장을 전제로 삼는다"* 의 **과소** 쪽이고,
과소도 같은 값을 치른다 — 9개로 알고 있으면 GEO 효과를 3분의 1로 보고 처방을 접는다.

## 가드

`src/tests/unit/seo-doc-weight-place-url-2026-10-15.test.ts` 14건 +
주입 `scripts/mutations/seo-doc-weight-place-url-2026-10-15.mjs` 7건(셋이 **반대 방향**).

⚠️ **못 보는 것**: ①이 실제로 **빠른지**(바이트는 쟀지만 TTFB·LCP 는 브라우저가 판정한다) ·
Vite 가 `transformIndexHtml` 을 부르는 런타임 배선(빌드를 돌려야 보인다 — 머지 전 실측으로 확인) ·
②를 구글이 실제로 쓰는지(색인 수일~수주 · 서치콘솔은 **대표만** 본다).

## ✅ E4 라이브 판정 통과 (배포 후, 머지 `1d2bb6e85` · 10:19 KST)

### ① 주석 제거

| UA | 받는 문서 | 주석 | 문서 바이트 | gzip |
| --- | --- | --- | --- | --- |
| iPhone(사람) | `index.html` | **31 → 0** | 138,976 → 119,436 | **38,576 → 30,456** (−8,120) |
| OAI-SearchBot | `index.html` | **31 → 0** | 139,0xx → 119,516 | 38,588 → 30,469 (−8,119) |
| Googlebot | 봇 셸 | 1 → 1 (264B) | 76,375 → 76,371 | 15,218 → 15,214 |
| Yeti(네이버) | 봇 셸 | 1 → 1 (264B) | 76,375 → 76,375 | 15,219 → 15,214 |

**보존**(같은 UA · 캐시 우회 없음 · 전후 대조): `<script>` 18 → 18 · `<link>` 71 → 71 ·
`<meta>` 29 → 29 · `<div>` 36 → 36 · `<noscript>` 0 → 0 · `<title>` 1 → 1 ·
preconnect 8 · speculationrules 1 · csp-nonce 2 · preload 9 · `ur-pre-react` 10 ·
`ur-first-screen` 1. 유일한 차이는 엔트리 청크 해시(새 빌드라 당연).

### ② 매장 엔티티 `url`

`/pass/2919`(달빛한스푼) · `/pass/2888`(홍대돈까스) 둘 다 `url` 실재 · **`url == canonical`** ·
`@id` 는 `#place` 유지 · **지어낸 필드 0**(`priceRange`·`description`·`openingHours`·`servesCuisine` 부재).
`/stays/2887` 은 종전대로 `priceRange` 보유 — **설계다**(`detail-ssr-meta.ts:289`: 숙소는 상품이 곧
그 숙소지만 이용권은 상품 ≠ 매장).

### 🔑 이 판정이 새로 확정한 사실 — UA 별로 문서가 두 종류다

```
사람(iPhone) · AI 검색봇(OAI-SearchBot)  →  index.html   139KB · 주석 31개
구글(Googlebot) · 네이버(Yeti)           →  봇 셸        76KB · 주석  1개
```

⇒ 주석 제거의 효과는 **사람 + AI 검색봇** 경로이고 **구글·네이버는 원래 해당이 없었다.**
그리고 네 UA 전부 **보이는 본문 451자 byte-동일** · title·description·canonical·robots 동일
⇒ **클로킹 위험 0**(dynamic serving 의 요구 조건은 바이트가 아니라 본문 동등성).

## 🩸 측정 교훈 — 이 세션에서 제 측정기가 **다섯 번** 거짓말했다

전부 보고 전에 잡았지만 **다섯 번 다 "결함처럼 보이는" 모양**이었다. 그게 이 목록을 남기는 이유다.

| # | 무엇 | 왜 위험했나 |
| --- | --- | --- |
| 1 | `walk(v,out)` 재귀에 인자 하나 누락 → `TypeError` 를 `except Exception: pass` 가 삼킴 | 네 표면 전부 "Product 0 · Offer 0" → *"상세 전체에 상품 구조화 데이터가 사라졌다"* 대형 오진 직전 |
| 2 | f-string 안 역슬래시 `SyntaxError` | 섹션 하나가 통째로 안 돌았는데 출력만 보면 "매장 노드 0건" |
| 3 | **`?cb=$RANDOM` 캐시 우회가 워커 슬롯 조건(`!url.search`)을 끔** | 첫 화면·noscript 0 → 나온 값(`/browse` 23 · `/map` 38)이 **하필 2026-10-12 수리 전 값과 같아** 회귀로 오진할 자리. 같은 오염으로 `<script` 기준선도 17(참값 18) |
| 4 | 파이썬 `len(str)` 이 **문자 수** — 한글을 1자=1B 로 셈 | 19,557B 를 12,277 로 읽고 **제 문서가 틀린 줄 알았다**(둘 다 맞고 단위가 달랐다) |
| 5 | 이용권 전용 판정 기준(`priceRange` 금지)을 전 표면에 적용 | 숙소의 **의도된** `priceRange` 에 "지어낸 필드" 라벨 |

**규칙**: ⓐ 0 이나 안 맞는 값이 나오면 **먼저 측정기를 의심한다** ⓑ 라이브 판정에 **캐시 우회를 붙이지 않는다**
(`?cb=` 는 다른 것을 재는 것이다 — 2026-10-06 항목이 이미 적어 뒀는데 또 밟았다) ⓒ 바이트는 `open(f,'rb')`
로 센다 ⓓ 전·후를 비교할 때 **"전" 이 정말 같은 조건인지** 먼저 확인한다(UA·쿼리·캐시).

## 🩸 커밋 교훈 — `git commit -F -` 에 heredoc 을 먹였다가 **조용히 아무것도 안 커밋됐다**

전경 Bash 명령이 120초 타임아웃을 넘겨 **백그라운드로 옮겨지면 stdin 이 끊긴다** — heredoc 이 사라져
커밋 메시지가 빈 문자열이 되고, git 은 **exit 0** 으로 끝낸다(에러 출력도 없다). HEAD 는 그대로이고
파일은 staged 로 남는데 **작업 결과는 "성공"** 으로 보고된다. 이 세션 **두 번째 조용한 커밋 실패**이고
(첫 번째는 TS7016 pre-commit 차단), 이번엔 **정지 훅의 "uncommitted changes"** 가 알려 줘서야 알았다.
⇒ 긴 메시지는 **파일로 쓰고 `git commit -F <파일>`**, 그리고 커밋 뒤 **`git log --oneline -1` 로 HEAD 가
움직였는지 본다**(exit code 는 커밋이 생겼다는 증거가 아니다).

## 🚫 같은 세션에서 기각한 축 — 다시 파지 말 것

| 축 | 기각 이유 |
| --- | --- |
| `Offer.priceValidUntil` | 쓸 날짜가 `group_buy_deadline` 뿐인데 2026-09-04 대표 확정이 **"마감 개념은 없어"** → 지어내기 + 그 날짜가 지나면 구글이 가격 표시를 내린다 |
| `hasMerchantReturnPolicy`·`shippingDetails` | `/refund` 가 남의 서비스 약관을 띄운 채 **결재 대기**(#25) — 틀린 정책을 기계가 읽는 형태로 못 박는 쪽이 더 나쁘다 |
| `itemCondition` | 이용권은 **서비스**라 새/중고 축이 무의미, 쇼핑만 달면 또 경로별로 갈린다 |
| `sku` · 쇼핑 `brand`·`Offer.seller` | **sitemap 에 `/products/` 0건**(실측 453건: `/pass` 310 · `/stays` 50 · `/region` 44 · `/blog` 22). 색인 안 하는 URL 의 리치결과는 값이 없다. 원인은 빌더가 아니라 **API 경로 비대칭**(이용권은 `LEFT JOIN sellers s` 로 `s.name` 을 고르고 쇼핑은 셀러를 안 조인 — `seller_id=24` 있고 `seller_name=None`)이고, CLAUDE.md 2026-10-14 가 이미 기각해 뒀다 |
| heading·description·lang | 캐시 우회 없이 11표면 재측정 → 전부 **h1 = 1** · `lang=ko` 100% · description 160자 초과 0 · 중복 0 · `og:description` 동일 |
| 제네릭 홈 메타 | 덜 다닌 13표면 재측정 → 전부 고유·구체 제목, **0건** |
| `llms.txt` | 9,189B · 폐기 용어 0 · 5%/10% 둘 다 반영 · **URL 22개 전부 200** |
| 봇 셸 48KB 시드 제거 | Googlebot 은 JS 를 렌더해 시드를 실제로 쓴다. 453×48KB ≈ 22MB 는 크롤 예산에서 의미 없는 양인데 잃을 것은 **구글이 렌더한 본문**이다 |

## 남은 것

- **대표 판단 3건**: 알람 경보 선택(`docs/decisions/2026-10-15-ads-alarm-stall-alert.md`) ·
  `/pass/:id` 공유 카드 · `/pass/:id` 검색 제목
- **대표 액션 2건**: IndexNow 게이트 ON(코드 완성) · `www.urdeal.kr` DNS
- 🚫 `/llms-full.txt` 는 **안 만들었다** — 404 이고 관례이긴 하나 어느 크롤러가 실제로 쓰는지
  근거가 없다. 근거 없이 문서를 하나 더 유지하는 비용이 더 크다.
