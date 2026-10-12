# 2026-10-12 — 정본 주소 불변식 셋 (필터 · /products · 엔티티 400)

대표 지시: **"머지해주고 더 개선할 건?"** → **"Seo,geo 더 개선할 건?"** → **"다 개선하고 또 개선할 것 있는지 찾아줘"**

선행 머지: **#1748** `62990cbee` (숙소 상세 서버 첫 화면 · 상품 사진 alt · 교환권 noindex 근거)

---

## 다음 세션의 첫 액션

### ① #1748 의 E4 (배포 후 — 아직 안 했다)

```bash
UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
curl -sS -A "$UA" https://urdeal.kr/stays/2887 | python3 -c "
import sys,re;h=sys.stdin.read()
h=re.sub(r'(?is)<script.*?</script>|<style.*?</style>','',h)
print(len(re.sub(r'\s+',' ',re.sub(r'(?s)<[^>]+>',' ',h)).strip()),'자')"   # 기대 146 → 195 안팎
```
- `/stays/2887` 하드로드 프레임에서 사진·제목이 **첫 프레임**에 뜨고 마운트 때 **안 움직이는지**
- `guesthouse` 숙소의 서버 메타 유형이 **스테이**(종전 `게스트하우스`)인지
- `/u/jiwon1228` 진열 4장의 `alt` 가 **비어 있지 않은지**

### ② 이 PR 의 E4 (배포 후)

```bash
# 쓰레기 facet → 맨 경로로 통합
for q in "?category=zzz" "?category=테스트123" "?brand=스타벅스" "?category=zzz&brand=yyy"; do
  curl -sS -A "$UA" "https://urdeal.kr/vouchers$q" | grep -o 'rel="canonical"[^>]*href="[^"]*"'
done            # 기대: 전부 href="https://urdeal.kr/vouchers"
# 🔴 반대 방향도 **같이** 볼 것 — 이쪽이 깨지면 조용히 색인을 잃는다
curl -sS -A "$UA" "https://urdeal.kr/vouchers?category=%EC%B9%98%ED%82%A8" | grep -o 'rel="canonical"[^>]*'
                # 기대: ?category=%EC%B9%98%ED%82%A8 유지 + <title> 이 `치킨 …`
# /products 정본
curl -sS -A "$UA" https://urdeal.kr/products/2919 | grep -o 'rel="canonical"[^>]*'   # 기대 /pass/2919
curl -sS -A "$UA" https://urdeal.kr/products/2887 | grep -o 'rel="canonical"[^>]*'   # 기대 /stays/2887
curl -sS -A "$UA" https://urdeal.kr/products/2192 | grep -o 'rel="canonical"[^>]*'   # 기대 **self 유지** + noindex
# 엔티티 슬롯 400
for p in /vouchers/abc /pass/abc /products/abc /stays/abc /group-buy/abc; do
  echo -n "$p "; curl -sS -o /dev/null -w '%{http_code}\n' -A "$UA" "https://urdeal.kr$p"; done
                # 기대: 전부 404 (종전 200 + index,follow)
# 🔴 그리고 소비자 표면이 200 을 유지하는지 — 이 방향이 더 위험하다
for p in / /vouchers /browse /map /stays /blog /faq /pass/2919 /stays/2887 /u/jiwon1228; do
  echo -n "$p "; curl -sS -o /dev/null -w '%{http_code}\n' -A "$UA" "https://urdeal.kr$p"; done
```

---

## 이번에 한 것

| # | 무엇 | 파일 | 크기 |
|---|---|---|---|
| 23 | 엔티티 슬롯의 `self-fetch-400` 을 404 와 같이 취급 | `surface-ssr-meta.ts` | Set 1줄 |
| 26 | 필터 파라미터 허용 **값** 검증 + 경로 정규화 + sitemap SSOT | `consumer-surfaces.ts` · `sitemap.routes.ts` | 함수 2곳 |
| 27 | `/products/:id` canonical → `canonicalDetailPath` | `detail-ssr-meta.ts` | 한 줄 |

가드 `src/tests/unit/canonical-facet-entity-2026-10-12.test.ts` **16건** + 주입
`scripts/mutations/canonical-facet-entity-2026-10-12.mjs` **11건 되돌려-검증 전부 빨간불 확인**
(절반이 **반대 방향** — 과차단·신호 충돌. 이 영역은 "너무 많이 막는" 쪽 피해가 더 크다).
검증: `tsc 0` · 인접 SEO 가드 8파일 **144건 pass**(회귀 0).

### 측정값 (배포 전 라이브, Googlebot UA)

```
/vouchers?category=zzz-no-such     200 index,follow  48자  canonical=자기자신   ← 무한 thin URL
/vouchers?category=테스트123        200 index,follow  43자  <title>테스트123 기프티콘 교환권…
/vouchers?brand=zzz-no-such        200 index,follow  48자
/browse?category=general           200 index,follow  31자  (general 은 2026-07-02 에 카탈로그에서 뺀 값)
/products/2919  canonical=/products/2919 ❌   ↔  /pass/2919  canonical=/pass/2919
/products/2887  canonical=/products/2887 ❌   ↔  /stays/2887 canonical=/stays/2887
/vouchers/abc · /pass/abc · /products/abc · /stays/abc · /group-buy/abc  → 전부 200 index,follow
   (그 API 들은 400 "Invalid product ID" — 404 가 아니라서 기계가 안 돌았다)
```

---

## 🩸 이번에 **틀렸던 판단** (가장 값진 부분)

1. **`/business` 를 "본문 0자 빈 문서" 로 오진할 뻔했다** — 실은 **301 리다이렉트 본문**이고
   sitemap 에도 없다. 측정이 리다이렉트를 안 따라간 것.
2. **`/u/:handle/p/:id` canonical 이 틀렸다고 보고했다 → 철회.** 그 경로는 CURATOR 슬롯이고
   canonical 이 `/u/:handle` 을 가리키는 것은 **thin 귀속 URL 을 가게 홈으로 합치는 정상 장치**다.
3. **`/products/:id` 에 `offers` 가 없다고 보고했다 → 철회.** 처음 잰 2192 가 **교환권(딜 결제)** 이라
   Offer 생략이 **맞는 동작**이었다. 원화 상품으로 다시 재니 멀쩡하다.
   ⇒ **상품 종류를 안 밝힌 한 건으로 전체를 판정하지 말 것.**
4. **thin 표면 7개를 "미수리" 로 올렸다 → 철회(작업 #24 완료 처리).** `surface-copy.ts` SSOT 가
   **이미 있고** 156~323자가 실제로 배달된다. 제가 잰 154자가 바로 그 결과였다.
   ⇒ **글자수만 보고 thin 이라 부르면 *고쳐 둔 것*과 *안 고친 것*을 구분하지 못한다.**
5. 구현 중 **`//vouchers` 가 표 조회부터 실패**하는 것을 발견했다(canonical 만 정규화해서).
   정규화를 **조회 시점**으로 옮겨야 한다 — probe 를 돌려서 알았고, 소스만 읽었으면 놓쳤다.
6. 교환권에 cross-canonical 을 겹치려다 **오전 audit log 의 경고**(noindex + canonical 은 반대 신호)를
   읽고 self 유지로 바꿨다. 덕분에 교환권 2,260건은 byte-동일이다.

---

## 남은 것

### 대표 판단 (결재함)
- **`/refund` 가 남의 서비스 환불약관을 띄운다** — `제22조 (환불)` · `가. 경기 결제 회원` ·
  `결기간은 300일로 이용료를 일할로 나눈 금액을 환불` · `결제 금액의 10%를 제외`. 유어딜엔
  300일 구독도 "경기 결제" 도 없다. 그런데 **sitemap 제출 + 푸터 링크**이고, 같은 서비스의 구매
  버튼은 *"미사용 시 100% 자동환불"* 을 약속한다 — 소비자용 문서 둘이 다른 환불 규칙을 말한다.
  세션이 법무 문구를 지어낼 수 없으므로 **코드에서 현행 규칙을 뽑은 초안**까지가 세션의 몫이다
  (`order-refund.ts` · `returns.routes.ts` · `voucher-partial-refund.ts` · `expired-voucher-refund-sql.ts`).

### 값이 낮아 **권하지 않는 것** (재 봤으니 숫자만)
- `/urshorts` 32자 · `index, follow` · 브랜드 JSON-LD 만 · **sitemap 미제출** · `video:` 0건.
  ⚠️ 썸네일이 `img.youtube.com` 이라 **YouTube 호스팅**이고, `VideoObject` 를 넣어도 비디오
  캐러셀에서 YouTube 를 못 이긴다. 빵부스러기+본문만 싸게 붙이는 건 가능.
- **IndexNow 배선 0건.** ⚠️ **구글은 IndexNow 를 안 쓴다**(Bing 계열만). 네이버 지원 여부는
  이 컨테이너에서 확인 못 했다(외부 도메인 다수 차단) — 확인 전엔 근거가 없다.
- sitemap `lastmod` 359/453(정적·지역 94건에 없음). 경미.

### 🔴 기술로 안 되는 것
활성 50건 중 **실매장이 2곳**(48이 데모)이다. SEO 의 천장은 여기다 — 위 수리들은 *실물이 늘어나는
순간 바로 색인되게* 준비해 두는 몫까지다.

---

## 🖼️ 추가분 — 공유 카드 치수 (#28·#29) · /partners 수수료 메타 (#30)

같은 PR(#1751)에 이어 붙였다. 위 정본 작업과 **독립**이고 롤백도 따로 된다.

### 무엇을 고쳤나

| | 종전(라이브 실측) | 지금 |
|---|---|---|
| `/stays/:id` og:image | 원본 **1397×748 · 530,546B** | cdn-cgi `fit=pad` **1200×630 · 197,972B** |
| `/vouchers/:id`·`/products/:id` | 남의 CDN 원본 **500×500 · 258,475B** | **1200×630 · 54,819B** |
| `/{몰}/p/:id` | 원본 + 폴백 **SVG** | 1200×630 + 폴백 **`og-image.png`**(라스터) |
| 봇 셸 `og:image:width/height` | **0건**(6표면 전부) | SSOT 상수로 선언 |
| `/partners` 메타·llms.txt 수수료 | **5%**(화면은 10%) | `PARTNER_FACTS.feeDirect` 경유 |
| `/pass/:id` · `/u/:handle` | 1200×630 | **불변**(건드리지 않았다) |

🔴 **JSON-LD `Product.image` 는 원본을 유지했다** — 소셜 카드와 구글 상품 사진은 다른 축이다
(빌더가 `photo` ↔ `ogImage` 를 따로 들고 간다). 주입 하나가 "일관성" 으로 한 축에 몰는 방향을 막는다.

### E4 — 배포 후 할 것

```bash
UA='KakaoTalk-Scrap/1.0'
# ① 숙소·교환권 카드 주소
curl -s -A "$UA" https://urdeal.kr/stays/2887   | grep -o 'og:image[^>]*'   # fit=pad 1200x630 이어야
curl -s -A "$UA" https://urdeal.kr/vouchers/2192 | grep -o 'og:image[^>]*'
# ② 치수 선언 — 종전 0건
for p in / /pass/2919 /stays/2887 /u/jiwon1228 /vouchers; do
  echo -n "$p "; curl -s -A "$UA" "https://urdeal.kr$p" | grep -c 'og:image:width'; done
# ③ 🔬 그림을 **파싱해서** 잰다 — 헤더만 보면 contain 회귀(630×630)와 구분이 안 된다
#    (JPEG SOF 파싱: 이 PR 의 측정 스크립트 참고)
# ④ /pass/:id 는 대표 확정 카드 주소 **불변**이어야
curl -s -A "$UA" https://urdeal.kr/pass/2919 | grep -o 'og:image" content="[^"]*"'   # /api/og/group-buy/2919?v=1
# ⑤ 수수료 — 스니펫과 llms.txt 가 10%
curl -s -A "$UA" https://urdeal.kr/partners | grep -o 'name="description" content="[^"]*"'
curl -s https://urdeal.kr/llms.txt | grep -o '수수료 [0-9]*%'
```

⚠️ **못 잴 것 = 실제 카톡방 카드.** 사진이 잘리지 않고 large card 로 뜨는지는 **대표만** 판정한다.
그리고 카카오는 **주소 단위로 캐시**하므로 전에 공유해 본 링크는 옛 카드가 나올 수 있다 —
**아직 공유 안 한 숙소·교환권 링크**로 볼 것.

### 이번에 틀렸던 것 (같은 함정 반복 금지)

1. **픽스처 모양을 지어 썼다** — 숙소는 `{ data: { product, rooms } }` 다. 평평하게 쓰니 빌더가
   `null` 을 돌려줘 시험이 **아무것도 판정하지 못했다**.
2. **숫자 비교가 헛돌았다** — `expect(SHARE_CARD_W).toBe(OG_CARD_W)` 는 하드코딩 값이 마침 같으면
   늘 참이다. 지키려는 것은 "같은 값" 이 아니라 **파생**이므로 소스를 봐야 한다.
3. **스프레드가 내 주입을 덮었다** — 객체 리터럴에서 앞에 키를 더해도 뒤 스프레드가 이긴다.
   앵커를 **스프레드 자체**로 옮겨야 행동이 바뀐다(두 번 틀렸다).
4. **`/api/media/` 치환을 상대 모양만 봤다** — 호출부가 먼저 origin 을 붙이므로 전부 놓쳤다.
   빌더를 **실제로 돌려** 출력을 보고서야 드러났다(같은 바이트에 1.9배 차이).
5. **`--only` 는 이름 부분일치다** — 파일명으로는 안 걸린다(0건 + 안내 출력).

---

## 🖼️ 후속 ② — og:image 가 SVG 인 자리 둘 (`f118e8c24`)

`/blog/:slug` 의 og:image 가 `/blog/og/:slug`(**`image/svg+xml` · 853B**)이고, `/{몰슬러그}` 는
로고 없으면 `og-image.svg` 였다. 근본 원인은 **낡은 전제** — `blog-seo.routes.ts` 머리말이
*"사이트 기본 OG 가 이미 SVG 라 동일 호환"* 이라 적어 뒀는데 기본 OG 는 그 사이
`og-image.png`(1200×630 라스터 44,972B)로 바뀌었다. 전제가 사라졌는데 결론만 남았다.

🩸 **그때 내가 근거를 과장했다(정정됨)**: *"카카오·페북·트위터가 SVG 를 안 읽어 23편이 전부
**빈 카드**"* 라고 썼는데, **카카오는 틀렸다** — 2026-10-09 audit log 가 *"카드는 떴고 그 안의
외부 `<image href>` 만 비었다"* 는 **우리 실측**을 적어 뒀다. 정확히는 ① 트위터·페북·슬랙은
그림이 **안 뜨고** ② 카카오는 뜨지만 그 배너가 **제목을 그림에 또 그려** `og:title` 과 중복이었다.
같은 세션이 `/pass/:id` 결재 파일엔 카카오 지원을 정확히 적고 여기엔 과장을 적었다.
**근거를 과장하면 다음 세션이 그 과장을 전제로 삼는다** — 코드 주석·CLAUDE.md·시험 메시지를
모두 정정했고, 가드 ④ 가 과장의 재발을 막는다(주입 없음 — 대상이 주석이라 러너가 거부한다).

## 🗓️ 후속 ③ — 블로그 날짜가 거짓말을 하고 있었다 (비잠금)

```
/api/blog/public  21편의 published_at
  2026-09-24 09:51:07 · 09-21 09:51:07 · 09-18 09:51:08 … 07-26 09:51:10
  시:분:초가 네 값뿐(09:51:07~10) · 인접 간격 전부 3일
/blog/what-is-urdeal JSON-LD
  "datePublished":"2026-09-24T09:51:07.000Z"
  "dateModified" :"2026-09-24T09:51:07.000Z"      ← 항상 같다
sitemap  loc 453 · lastmod 359   ← 상품은 내고 **블로그 22건은 빠져 있었다**
```

그 값은 발행일이 아니라 **"마지막 재시드 한 순간 − 3i일"** 이었다. 재시드 UPDATE 가
`published_at=datetime('now', -3i days)` 를 **매 `BLOG_SEED_VERSION` bump 마다 다시 썼다**
⇒ 구글이 보는 발행일이 배포마다 앞으로 점프하고 오래된 글이 나이를 못 쌓는다.

**수정 셋** — ① 재시드는 발행일을 다시 쓰지 않는다(INSERT 에서만 분산) ② `dateModified` ←
`updated_at`(수정이 발행보다 **앞서면** 안 쓴다) ③ sitemap 블로그에 `lastmod` ← `updated_at`.
⚠️ **잃는 것**: 목록이 `ORDER BY published_at DESC` 라 **시드 배열 순서를 바꿔도 기존 글 순서는
안 따라온다**(어드민에서 발행일을 고쳐야 한다).

가드 `blog-dates-honest-2026-10-12.test.ts` 11건 + 주입 7건 빨간불.
🩸 첫 판이 헛돌았다 — `indexOf('UPDATE blog_posts')` 가 **레거시 `is_seed=1` 문장**을 집어
날짜가 없는 문장을 검사했다(늘 통과) ⇒ 지문을 `seed_version=?` 로.

### 다음 세션의 첫 액션 (E4)

```bash
UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
# ① 블로그 카드 — .svg 0건
curl -s -A "$UA" https://urdeal.kr/blog/what-is-urdeal | grep -o 'og:image" content="[^"]*"'
curl -s -o /dev/null -w '%{http_code}\n' https://urdeal.kr/blog/og/what-is-urdeal   # 살려 둔 것 → 200
# ② 두 날짜가 갈리는지(다음 bump 뒤) + 발행일이 **안 움직이는지**
curl -s -A "$UA" https://urdeal.kr/blog/what-is-urdeal | grep -o '"date[A-Za-z]*":"[^"]*"'
# ③ sitemap lastmod 359 → 381
S=$(curl -s -A "$UA" https://urdeal.kr/sitemap.xml); echo "loc=$(grep -c '<loc>' <<<"$S") lastmod=$(grep -c '<lastmod>' <<<"$S")"
```

### 전수에서 **결함이 아니라고** 판정한 것 (다시 파지 말 것)

- `twitter:card` — 7표면 전부 `summary_large_image` · `og:type`·`og:site_name` 전 표면 정상
- **중복 메타 0** — `og:*`·`description` 이 표면마다 1개씩(canonical 과 달리 `setAttribute` 교체다)
- `<html lang="ko">` 8표면 전부
- sitemap 커버리지 453건 — `/join`(149자 thin)만 미제출이고 **그게 맞다**
- RSS 는 `/blog` 에서만 발견 가능(글 상세엔 link 없음) — 가치 대비 미미, 안 했다

---

## 🍞 후속 ④ — 쇼핑 상세에 빵부스러기가 없었다 (`86e6b687e` 다음 커밋)

같은 지시(*"다 개선하고 또 개선할 것 있는지 찾아줘"*)로 **색인 대상 표면을 전수로 다시 쟀다**
(Googlebot UA 로 서버 HTML 을 받아 JSON-LD 를 **파싱해서** 노드 타입을 셌다 — grep 이 아니다):

```
표면                robots           BreadcrumbList
/pass/2919          index, follow    O
/stays/2887         index, follow    O
/u/jiwon1228        index, follow    O
/blog/:slug         index, follow    O   ← 오전에 고쳤다
/region/서울         index, follow    O   ← 〃
/products/2917      index, follow    X   ← 남아 있었다
/                   index, follow    X   ← 루트라 **의도**(한 단계 체인은 무의미)
/vouchers/:id       noindex          -    (JSON-LD 자체가 0 — noindex 라 무해)
```

즉 색인 대상 상세 **넷 중 하나만** 빵부스러기가 없었다. `buildProductMeta` 가 `[product]`
**하나만** 내보내고 있었고(형제 둘은 breadcrumb 를 낸다), 오전 처방이 그 빌더까지 오지 않았다.

**수정 (`src/worker/utils/detail-ssr-meta.ts` 한 블록)**
`홈 › 쇼핑 › 상품명` — 중간 라벨은 `CONSUMER_SURFACE_SEO['/browse'].crumb` 에서 **받는다**
(손으로 적으면 목록 표면의 빵부스러기와 갈리는데 에러가 전혀 안 난다).

🩸 **빌더를 돌려 눈으로 보고서 조건을 좁혔다.** 첫 판은 무조건 달았는데, 이용권
(`/products/2919` → canonical `/pass/2919`)에도 `홈 › 쇼핑 › 닭도리탕` 이 붙었다 — 그 정본의
**제 빵부스러기는 `홈 › 동네딜 › …`** 이라, 같은 항목에 두 URL 이 서로 다른 경로를 주장한다.
⇒ **이 페이지가 정본인 순수 쇼핑 상품일 때만** 낸다(`canonicalPath == null`). 교환권(noindex)도
쇼핑이 아니라 제외. 실측 확인: 쇼핑 **O** / 이용권 **X** / 숙소 **X** / 교환권 **X**.

🩸 **그리고 마지막 항목이 `canonical` 인지는 동작으로 판정할 수 없다** — 그 게이트 때문에
`canonical` 은 언제나 `${origin}${pathname}` 과 같은 값이라, `pathname` 으로 바꿔도 출력이
1바이트도 안 바뀐다(주입이 실제로 **초록**을 냈다). 조건을 나중에 넓히면 그때부터 조용히
어긋나므로 **소스 단언으로 의도를 고정**했고, 그 단언의 첫 판은
`indexOf('const jsonLd …')` 를 **파일 앞에서** 찾아(그 이름은 형제 빌더에도 있다) **빈 블록**을
검사하고 있었다 — 제 하한 단언(`length > 80`)이 잡았다.

**가드**: `src/tests/unit/product-breadcrumb-2026-10-12.test.ts` 10건 +
`scripts/mutations/product-breadcrumb-2026-10-12.mjs` **5건 되돌려-검증 전부 빨간불 확인**.
검증: tsc 0 · 인접 가드 5파일 70건 pass · 낡은 앵커 0(3,318건).

### 같은 실측에서 **결함이 아니라고 판정한 것**
- **sitemap `lastmod`** 가 `/region` 44 · `/u` 6 · 정적 표면에 없다 → **값을 지어내지 않는다**
  (상품 359건은 실제 `updated_at` 이 있어서 낸다. 블로그 22건은 `86e6b687e` 가 추가했다)
- **유어샵 17곳 중 6곳만 제출** → 기준이 *핀 1개 이상 또는 상품 1개 이상*이라 **빈 가게는 thin**
- **제목 23표면 중복 0**(8~33자) · description 14~104자
- `Offer.priceValidUntil`·`shippingDetails`·`hasMerchantReturnPolicy` **미발행** → 권장 필드지만
  이용권은 배송하지 않고 마감 개념도 없다(2026-09-04 대표 확정) ⇒ **지어내면 거짓**
- `/products/2192`(교환권)의 `Product` 에 `offers` 가 없는 것 → 가격이 **딜**이라 KRW 스키마
  부적합. 의도이고 그 페이지는 noindex 다

### 📌 대표 판단 사항 (코드로 안 바꿨다)
`/pass/:id` 제목이 `{가게} {메뉴} 공동구매 - {가게명}` 으로 끝나 **다른 전 표면의 `- 유어딜`** 과
다르고 **310건**이 그 모양이다(예: `달빛한스푼 닭도리탕 공동구매 - 달빛한스푼`). 두 가지가 걸린다 —
① 브랜드 suffix 가 가게명이라 검색결과에서 유어딜이 안 보인다 ② 경제는 즉시판매인데(2026-06-27
명칭 SSOT · 2026-09-04 *"마감 개념은 없어"*) 제목이 **공동구매**라고 말한다. 이미 색인된 310건의
제목을 바꾸는 일이라 **올리고 기다린다**.

---

## 🔗 후속 ⑤ — 크롤러 문서에 내부 링크가 0개였다 (`e18c032d4` 다음 커밋)

같은 지시로 이번엔 **JSON-LD 가 아니라 `<a href>` 를 셌다**(Googlebot UA · 파싱). 둘은 다른 것이다:

```
표면            본문      a태그          (비교)
/region/서울     364자      0            /pass/:id    2  ← 서버 첫 화면의 빵부스러기
/vouchers        231자      0            /u/:handle   4  ← 첫 화면 진열
/map             359자      0            /blog       21  ← 글 목록
/stays           436자      0
/browse           36자      0
```

⇒ **상세 → 허브는 이어져 있는데 허브 → 상세가 통째로 비어 있었다.** 목록이 가게·메뉴·판매가를
*글로는* 말하면서 그 상품으로 가는 길을 하나도 안 줬다.

🔑 **`ItemList` 로는 대체되지 않는다** — 그건 *"이 목록의 항목"* 이라는 설명이고, 크롤 발견과
내부 링크 가치는 `<a href>` 가 만든다. JS 를 렌더하는 Googlebot 은 SPA 링크를 보지만
**Yeti(네이버)·AI 검색봇은 이 문서가 전부**다(대표 *"네이버도 해주고"*).
즉 453건이 **sitemap 으로만** 발견되고 내부 링크 가치는 0 이었다.

**수정 (`src/worker/utils/crawler-noscript.ts` — 잠금 파일 아님)**
행을 `{text, href}` 로 바꿔 `<li><a href>` 로 감싼다. 주소는 **정본 SSOT** 를 지난다
(`canonicalDetailPath`, 순수 쇼핑 폴백은 `FLOW_CONFIG.standard_checkout.detailPath`) —
`ItemList`·sitemap 과 **세 벌이 될 수 없다**.

🔴 **교환권(`deal_only=1`)은 링크하지 않는다** — 그 상세는 2026-07-07 결정으로 noindex 이고
2,260건에 크롤 경로를 열면 *색인 말라고 한 URL* 로 예산이 빠진다. **글은 그대로 남는다.**

🩸 **빌더를 돌려 눈으로 보고서 결함 하나를 잡았다**: `canonicalDetailPath` 는 순수 쇼핑 상품에
**`null`**(= cross-canonical 아님)을 주는데 그걸 "링크 없음" 으로 읽어 `/browse`·`/map` 의
쇼핑 상품만 글로 남았다(실측 `id 2917`). 그 경우의 정본은 `/products/:id` 다.

🩸 **그리고 내 주입 하나가 헛돌았다** — *"id 가 없어도 링크를 만든다"* 가 통과했다. 그때 주소가
`/pass/undefined` 로 나오는데 내 단언은 `href === ''` 와 `endsWith('/')` 만 보고 있었다
(**모양을 짐작했다**) ⇒ ① 그 행이 `<a>` 밖인지 ② 모든 href 가 `/^\/[a-z]+\/\d+$/` 인지로 교체.

🕳️ **기존 주입 둘이 낡았고 둘 다 풀지 않고 재조준했다** — `geo-concept-surfaces` ·
`list-surface-noscript` 의 *"시드 값을 탈출 없이 마크업에 넣는다"*. 불변식은 그대로이고 탈출
경로가 **셋으로 갈렸다**(링크 안쪽 글자 · 링크 없는 분기 · **주소**). `list-surface` 쪽은 처음
*링크 없는 분기*로 조준했더니 **그 테스트의 탐침 시드가 그 분기를 안 지나가서 헛돌았다**
(id 가 다 있어 전부 링크가 붙는다) → 링크 안쪽 글자로 다시 조준.

**가드**: `crawler-internal-links-2026-10-12.test.ts` 9건 +
`scripts/mutations/crawler-internal-links-2026-10-12.mjs` **6건 + 재조준 2건, 전부 빨간불 확인**.
검증: 인접 가드 8파일 161건 pass · 낡은 앵커 0(3,324건).

### 다음 세션의 E4 (배포 후 1분)
```bash
UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
for p in /region/서울 /map /browse /stays /vouchers; do
  printf '%-16s ' "$p"
  curl -sS -A "$UA" "https://urdeal.kr$p" | grep -o 'href="/[a-z]*/[0-9]*"' | sort -u | tr '\n' ' '; echo
done
```
기대: 앞 넷이 **0 → N**(주소가 전부 `/pass/`·`/stays/`·`/products/`) · **`/vouchers` 는 0 유지**
(이 방향이 깨지면 noindex URL 로 크롤 예산이 빠진다).

### 안 한 것 (판단과 함께)
- **봇 셸에 전역 네비(푸터)를 안 넣었다** — 상세는 빵부스러기가 허브로 잇고 있고(`a` 2개),
  링크가 0 인 `/faq`·`/about` 은 리프다. 넣으려면 `worker/index.ts`(잠금 파일 · 래칫 2672 포화)를
  건드려야 해서 **얻는 것 대비 비용이 크다** — 필요해지면 별건.

---

## 🛍️ 후속 ⑥ — sitemap 이 제출한 유어샵·쇼핑 상세가 크롤러에게 **빈 문서**였다 (같은 지시)

### 측정 (Googlebot UA 로 받아 **태그를 걷어내고** 본문 글자를 셌다)

```
sitemap URL              슬롯      시드      첫 화면   noscript   본문
/u/jiwon1228             CURATOR   2639B     O         1          383자
/u/user40                CURATOR   2179B     X         0          **6자**
/u/user31                CURATOR    402B     X         0          **6자**
/u/jongmun               CURATOR    429B     X         0          **6자**
/s/store_muxlddtf74b     SELLER     520B     X         0          **6자**
/s/store_mt9rvbhg1i6     SELLER     520B     X         0          **6자**
/products/2917           PRODUCT    872B     X         0          **6자**
```

**7건 중 6건이 `index, follow` + sitemap 제출인데 서버 문서가 비어 있었다.** 그리고 시드는
**전부 도착해 있었다**(`X-SSR-Status: *:edge-hit`) — 쓰지 않고 있었을 뿐이다.

### 🩸 원인 — sitemap 이 스스로 적어 둔 "짝" 주장이 세 군데서 깨져 있었다

`sitemap.routes.ts` 는 *"핀 ≥ 1 만 내보내면 **제출한 URL 은 전부 본문이 있다**"* 고 선언했다.

1. **센 것은 `product_pins` 행**이고 API 의 `pins` 는 `is_active = 1 AND
   consumerVisibleProductSql` 를 통과한 것만이다 ⇒ **"핀 행이 있다" ≠ "핀이 보인다"**.
   `/u/jongmun` 의 핀은 **활성인 도매 원본**(`Canvas Tote Bag`, id 6)이고 소비자 API 어디에도
   없어 클릭하면 404 다 — `consumer-visible-product.ts` 머리말이 그 상품을 **이름까지** 적어
   뒀는데 sitemap 쪽은 그 조건을 안 봤다.
2. 첫 화면 빌더는 `pins.length === 0` 말고도 **`linked_seller` 가 있으면** `''` 를 준다
   (React 가 `SellerPublicPage` 를 그리므로 레이아웃이 통째로 다르다) — `/u/user40` 이 그
   경우이고 그 주석은 **그 분기를 몰랐다**.
3. **`/s/:username`(SELLER 슬롯)엔 첫 화면 빌더가 아예 없다.**

### 처방 — 층을 나눴다

| | 처방 | 대상 |
|---|---|---|
| 재료 있음 | **본문을 메운다** — CURATOR 폴백 `curatorNoscriptFromPayload`(숙소 상세가 쓰는 그 처방) | `/u/user40` 및 앞으로의 사업자 유어샵 전부 |
| 재료 있음 | `/products/:id` `<noscript>` — **정본일 때만**(빵부스러기와 같은 게이트) | 쇼핑 상세 |
| 재료 없음 | **색인 요청을 안 한다** — 핀 EXISTS 를 **API 와 같은 술어**로 | `/u/user31`·`/u/jongmun` |
| 미해소 | 페이로드에 상품이 안 담겨 **문서에 재료가 없다** | `/s/*` 2건 ← **다음 세션** |

🔴 **이름만 적어 글자수를 늘리지 않았다** — `<title>` 이 이미 그 이름을 말하고, 그러면 본문
글자수는 늘지만 thin 인 사실은 그대로다(**측정만 좋아 보인다**). 소개·진열이 없는 유어샵은
`''` 를 내고 sitemap 에서 빠진다.

🔒 **가게·주소·전화는 쇼핑 요약에 안 넣었다** — `ProductDetailPage` 는 그 줄을
`category === 'meal_voucher'` 일 때만 그리는데(실측 `:647`) `lifestyle` 상품 응답에도 그
필드가 담겨 온다(`구서 우성아파트`·`010-2207-3904`) ⇒ 넣으면 **화면에 없는 말**이고 클로킹이다.

📏 **워커는 줄 수 중립** — PRODUCT 전용 `#root` 분기를 만들지 않고 catch-all 의
`buildStaticSurfaceNoscript` 에 얹었다(래칫 2672 에 꽉 차 있어 내 주석 1줄을 압축했다).

🧹 같은 커밋에서 `consumer-visible-product.ts` 머리말이 *"sitemap 에 인라인으로 복사돼 있다 …
다음에 만질 때 이 상수로 모으면 된다"* 고 적어 둔 **인라인 사본 2곳**을 SSOT 로 모았다.

### 🔬 빌더를 돌려 눈으로 봤다 (라이브 시드 그대로)

```
/u/user40     첫화면 없음  폴백 83B   "현정 유어샵 / 프리미엄 무선아이폰 — 구서 우성아파트 · 10,000원"
/u/user31     첫화면 없음  폴백  0B   (재료 0 — sitemap 에서 뺀다)
/u/jongmun    첫화면 없음  폴백  0B   (재료 0)
/u/jiwon1228  첫화면 7876B  그 안 요약에 **이름 없음**(규율 ② 유지)
/products/2917 (lifestyle)  56B  "프리미엄 무선아이폰 / 판매가 10,000원"   ← 가게·전화 없음
/products/2919 (이용권)      0B   /products/2887 (숙소) 0B   /products/2192 (교환권) 0B
폴백: 시드 없음·깨짐 → 둘 다 ''
```

### 🕳️ 기존 가드·주입 셋이 낡았고 셋 다 **풀지 않고 재조준**했다

- `sitemap-urshop-users-2026-10-11` 픽스처 — `product_pins.product_id`·도매 컬럼 추가 +
  **비활성 · 도매 원본 · 재판매 복제본** 세 경우를 **추가**(불변식은 그대로이고 강해졌다).
- `curator-ssr-first-screen-2026-10-09` ⑥ — 불변식(*"`''` 면 로더로 폴백"*) 그대로. 달라진
  것은 폴백이 로더 **앞에** 요약을 깐다는 것뿐이고, **로더가 그 자리에 남아 있는지**를 계속 고정.
- 주입 `🔎 유어샵 요약이 핀을 중첩 구조로 읽는다` — 조립이 `row()` 헬퍼로 옮겨갔다.

### 🩸 이번에 제 시험이 네 번 헛돌거나 터졌다

1. **`node:sqlite` 를 그냥 import** 하면 vite 가 번들하려다 **테스트가 아예 안 돈다**
   (`Cannot bundle Node.js built-in`) → `createRequire` 우회. 선례:
   `legacy-seller-lookup-owner-seat-2026-10-10.test.ts`.
2. 쿼리를 소스에서 뗄 때 마커가 템플릿 **안**에 있는데 `indexOf('\`')` 로 열린 백틱을 찾아
   **닫는** 백틱을 집었다 → SQL 이 다음 리터럴까지 섞여 `near ")"` 로 터졌다(`lastIndexOf`).
3. `ssrSlot === 'CURATOR' && ssrPayload` 는 **메타 rewrite 분기에도** 있어(line 900) 엉뚱한
   블록을 봤다 → 빌더 호출로 앵커. **같은 세션에서 두 번째다**(앞서 `buildDetailMeta` 에서도).
4. 기존 테스트의 `sqlOf` 가 `${...}` 를 통째로 지워 `AND )` 를 만들었다 → SSOT 호출만
   **실제 술어로 치환**한 뒤 나머지를 지운다.

### ⏭️ 다음 세션의 첫 액션 — E4 (배포 후, **양방향**)

```bash
UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
# ① 메워졌나
for p in /u/user40 /products/2917; do
  curl -sS -A "$UA" "https://urdeal.kr$p" | python3 -c "
import sys,re,html; h=sys.stdin.read()
t=re.sub(r'<[^>]+>',' ',h[h.find('<body'):]); print(len(' '.join(html.unescape(t).split())))"
done        # 기대: 6자 → 올라간다 (user40 ~70자 · 2917 ~30자)
# ② 색인 요청에서 빠졌나 / 🔴 **그리고 멀쩡한 것은 남았나**
curl -sS https://urdeal.kr/sitemap.xml | grep -o '<loc>[^<]*</loc>' | grep -cE '/(u|s)/'
#   기대: 6 → 4  (user31·jongmun 빠짐 / jiwon1228·user40·store_* 2건 **유지**)
curl -sS https://urdeal.kr/sitemap.xml | grep -c '<loc>'   # 453 → 451 안팎, /pass 310 유지
```

⚠️ **②의 반대 방향을 꼭 함께 볼 것** — 기준을 조이는 변경이라, 멀쩡한 유어샵이 빠지면 색인이
조용히 사라지고 돌아오는 데 수주다(쓰레기 URL 이 남는 것보다 이쪽이 더 나쁘다).

### ⏭️ 남은 것 — `/s/:username` 2건 (별건)

`달빛한스푼`·`홍대돈까스` 는 **상품이 있다**(sitemap 의 products EXISTS 를 통과한다) — thin 이
아니라 **그 재료가 서버 문서에 안 담겨 있다**. SELLER 페이로드(`buildSellerPublicPayload`)는
셀러 프로필만 담고 상품은 `SellerPublicPage` 가 따로 받는다. 처방은 curator 응답이
`linked_seller_products` 를 동봉하는 것과 같은 방식으로 **페이로드에 상품을 더하는 것**이고,
그건 API·KV 캐시(300s)를 건드리므로 별건으로 잡을 것. ❌ 이름만 넣은 noscript 로 때우지 말 것.

---

## 🎟️ 후속 ⑦ — sitemap 의 **모든 경로 모양**을 전수로 재서 facet 3건을 찾았다

후속 ⑥(유어샵·쇼핑 상세)을 고친 뒤, 같은 질문을 **sitemap 전체**에 던졌다 — *"제출한 URL 중
크롤러 본문이 비는 게 또 있나?"* Googlebot UA 로 453건을 31개 경로 모양으로 묶어 샘플링해
본문 글자수를 셌고, **8자(로더 워드마크뿐)** 가 다섯 나왔다:

```
/u/:handle ×4        8자   ← 후속 ⑥ 수정분(배포 전)
/s/:handle ×2        8자   ← 아래 '남은 것'(별건)
/products/2917       8자   ← 후속 ⑥ 수정분(배포 전)
/vouchers?category=  8자 ×3  ← 🆕 이번에 고친 것
/privacy · /refund   8자   ← 🆕 찾았으나 **안 고쳤다**(아래 이유)
```

비교: `/pass/:id` 98~143자 · `/stays/:id` 176~178 · `/region/*` 386~464 ·
`/blog/:slug` 1,007~1,035 · `/terms` 327 · `/faq` 1,490.

### 무엇이 원인이었나 — 워커 조건 한 줄

VOUCHERS 슬롯 조건이 `url.pathname === '/vouchers' && !url.search` 다. 2026-05-27 에
*"쿼리 없는 기본 페이지"* 용으로 쓴 조건이고 그 자체로는 맞다. 그런데 2026-07-29 에
facet 3건을 sitemap 에 넣을 때 **그 짝을 아무도 안 봤다** — 제출은 했는데 쿼리가 붙는 순간
시드를 아예 안 받으니 본문이 빈다. `<title>`·description·canonical 은 카테고리별로 멀쩡하고
`index, follow` 라 **재 본 사람만 안다.**

### 재료는 이미 있었고, 고아 예열 키 하나를 되살렸다

`/api/products` 는 `category=` 를 서버에서 필터해 20건을 준다(세 카테고리 전부 실측 20건).
그리고 **`커피/음료` 키는 `cache-prewarm.ts` HOT_PATHS 에 이미 있다** — 2026-06-04
*"홈 = 교환권"* 이던 시절 들어갔고 홈이 딜 피드로 바뀐 뒤 **요청하는 곳이 0** 인 고아였다
(소스 전수 확인: `deal_only=1&sort=price_low` 를 요청하는 곳은 워커 VOUCHERS 슬롯 하나이고
거기엔 category 가 없었다). 이제 그 키가 다시 쓰인다 ⇒ **HOT_PATHS 추가·제거 0.**

### 눈으로 본 결과

```
편의점      237자  a태그 0   교환권 GS25 — 퍼페티)츄파춥스300 판매가 300원 CU — 농심)…
커피/음료   262자  a태그 0   교환권 컴포즈커피 — 아메리카노(Hot)(TAKE-OUT) 판매가 1,500원 …
베이커리    221자  a태그 0   교환권 파리바게뜨 교환권 1천원 판매가 1,000원 …
```

a태그 0 은 **의도**다 — 교환권 상세는 2026-07-07 결정으로 noindex 이므로 항목 링크를 달지
않는다(후속 ④ 내부 링크 처방과 같은 규율).

### 🩸 이번에 내가 틀린 것 둘 (둘 다 가드가 잡았다)

1. **주석 제거기를 새로 썼다.** 순진한 `/\/\*[\s\S]*?\*\//g` 가 문자열 안의 `/*` 를 주석
   시작으로 읽어 워커 소스를 대부분 먹었고, 소스 단언 셋이 **전부 거짓 빨간불**이 났다.
   이 레포가 **네 번** 밟아 `check-comment-stripper` 를 만든 그 자리인데 **다섯 번째를
   내가 밟았다** → SSOT `tests/helpers/source-text.ts` 의 `readCode`/`readRaw` 로 교체.
2. **픽스처를 스크래치패드 파일에 뒀다.** 없으면 `return` 하도록 썼는데 CI 에는 그 파일이
   없으니 그 검사 셋이 **조용히 건너뛰어진다**(= 헛도는 가드). 라이브 응답 모양에서 만든
   **인라인 탐침**으로 교체했다.

### ⏭️ 안 고친 것 — `/privacy`·`/refund` (판단을 적어 둔다)

`/terms` 는 본문이 `src/pages/terms/consumer-terms-content.ts` 라는 **데이터 SSOT** 로 있어
327자가 나온다. `/privacy`·`/refund` 는 **25KB·20KB JSX 안에만** 있다. 데이터로 빼면 본문이
생기지만 그건 별건이고, 특히 **`/refund` 는 내용 자체가 결재 대기**다(남의 서비스 환불약관 —
결재 #25 / `docs/decisions/`). **틀린 약관을 SSOT 로 추출하는 쪽이 더 나쁘다** ⇒ 결재가
내려온 뒤에 그 글을 고치면서 함께 데이터로 빼는 것이 맞다.

### ✅ 다음 세션의 첫 액션 — E4 (배포 후, **양방향**)

```bash
UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
body(){ curl -sS -A "$UA" "$1" | sed 's/<[^>]*>/ /g' | tr -s ' \n' ' ' | sed 's/^ //' ; }
# ① 채워졌나 — 세 facet 전부 (기대 ~220~260자, 종전 8자)
for c in %ED%8E%B8%EC%9D%98%EC%A0%90 %EC%BB%A4%ED%94%BC%2F%EC%9D%8C%EB%A3%8C %EB%B2%A0%EC%9D%B4%EC%BB%A4%EB%A6%AC%2F%EB%8F%84%EB%84%9B; do
  echo -n "$c  "; body "https://urdeal.kr/vouchers?category=$c" | wc -c; done
# ② 🔴 반대 방향 — 임의 값엔 **여전히** 본문이 없고 /vouchers 로 통합돼야 한다
body 'https://urdeal.kr/vouchers?category=테스트123' | wc -c          # 기대: 짧게(8자대)
curl -sS -A "$UA" 'https://urdeal.kr/vouchers?category=테스트123' | grep -o 'rel="canonical"[^>]*'
# ③ 맨 경로 회귀 0 — 240자 + 시드 주입 실재
body 'https://urdeal.kr/vouchers' | wc -c
curl -sS -A "$UA" https://urdeal.kr/vouchers | grep -c '__SSR_INITIAL_VOUCHERS__'   # 기대 1
# ④ facet 에는 시드를 **안** 싣는다(사람 응답 낭비 0)
curl -sS -A "$UA" 'https://urdeal.kr/vouchers?category=%ED%8E%B8%EC%9D%98%EC%A0%90' | grep -c '__SSR_INITIAL_VOUCHERS__'  # 기대 0
```

⚠️ ②·③·④ 를 함께 보지 않으면 판정이 안 된다 — ①만 보면 *"허용목록이 통째로 열린 것"* 과
*"설계대로 세 건만 받은 것"* 을 구분할 수 없다.

---

## 🎟️↩️ 후속 ⑧ — `/faq` 가 **자기 설명이 약속한 답**을 안 주고 있었다 (같은 지시)

### 실측 (Googlebot UA · 라이브)

```
title        자주 묻는 질문 - 이용권 사용·**환불**
description  이용권은 어떻게 쓰는지, **유효기간이 지나면 어떻게 되는지**, 환불은 언제 되는지
────────────────────────────────────────────────────────────────────────
Q&A 14건 중  유효기간 만료 답        **0건**
             유일한 환불 답(q6)      **배송 상품** 절차("상품 회수 확인 후 3-7 영업일")
```

`/faq` 는 소비자 표면 중 크롤러 본문이 가장 길다(**1,515자**) — AI 검색이 브랜드 질의에 가장
많이 인용하는 페이지다. 그런데 *"유어딜 이용권 환불돼?"* 를 물으면 **택배 반품 절차**가 인용된다.
간판 상품(이용권)의 환불 경로가 그 페이지에 **한 글자도 없었다.**

🩸 **이건 내가 만든 구멍이다** — 2026-10-12 오전에 그 description 을 쓰면서 *"유효기간이 지나면"*
을 약속해 놓고 Q&A 를 안 넣었다. **메타에 약속을 적을 때 그 답이 실재하는지 같이 볼 것.**

### 코드에서 확인한 것만 적었다 (지어내기 금지)

| 답 | 근거 |
|---|---|
| q15 만료 자동환불 | `handleExpiredVoucherRefunds`(`worker/cron/auto-settlement.ts`, `0 18 * * *`) — 미사용 만료분을 **신청 없이** 환불 + 알림. `deal_points` → `adjustUserPoints`(딜로) · `toss\|CARD` → 토스 취소(카드로) |
| q16 사용 전 환불 요청 | `pages/my-vouchers/QRModal.tsx` '환불 요청' → `POST /api/returns/request`, 토스트 *"접수되었어요. 확인 후 처리해 드릴게요"* |

- 🔴 **교환권(기프티콘)은 아무 말도 안 한다** — 그 레일은 `voucher_orders`/KT 라 같은 규칙이라고
  말할 근거가 없다(주입이 그 방향을 고정).
- 🔢 **비율(100%)은 안 적었다** — 규율 ③(수치 금지) + 기존 가드가 컨셉 문구의 `%` 를 막는다.
  비율의 SSOT 는 **구매 화면**(`DealBottomBar`·`DealPurchaseBox` 의 *"미사용 시 100% 자동환불"*)이고,
  그 약속이 사라지면 FAQ 의 "자동으로 환불" 도 근거를 잃으므로 **시험이 둘을 묶는다.**

### 같은 커밋에서 q5·q6 **질문만** 스코프

`교환/반품은 어떻게 하나요?` → **`배송 상품의` 교환/반품…** · `환불은 언제 되나요?` → **`배송 상품` 환불…**
**답변은 byte-불변**이다 — 정책을 바꾼 게 아니라 범위를 밝혔다(쇼핑 레인은 죽지 않았다: 탭만 숨김,
`/browse` 라우트·llms.txt 항목 생존). 여섯 언어 로케일의 `q5`·`q6` 도 함께 옮겼다.

### 출력 (빌더를 돌려 눈으로 봤다)

```
/faq 크롤러 본문   1,515 → **1,735자**
FAQPage Q&A        14 → **16**
llms.txt           두 답 실림 (유효기간 · '환불 요청')
스코프된 질문       배송 상품의 교환/반품… / 배송 상품 환불은 언제…
```

### 🩸 이번에 틀린 것 셋

1. **`--list` 는 지원 플래그가 아니다.** `node scripts/check-guard-mutations.mjs --list` 가
   목록을 찍는 대신 **전수 주입을 시작했고**, 그걸 끊자 `money-switch-fields.ts` 에 주입분이
   **남았다**(`affiliate_program_enabled` → `..._REMOVED`). `check-no-injection-in-progress.sh`
   로 찾아 복원했다. ⇒ **러너는 모르는 플래그를 무시하고 전수로 돈다. 끊은 뒤에는 반드시
   주입 잔존 검사를 돌릴 것.**
2. **`--only` 접두가 겹쳤다.** 새 8건이 기존 facet 주입과 같은 `🎟️` 로 시작해 88건이 잡혔다 →
   `🎟️↩️` 로 **고유 접두**를 줬다(`--only` 는 이름 부분일치다).
3. **내 단언 하나가 헛돌았다**(주입이 잡았다): 구매 화면 둘을 `bar + box` 로 **이어 붙여**
   검사해서, 한쪽에서 약속을 지워도 다른 쪽 문자열이 남아 통과했다 → **파일별로** 본다.
   ⇒ 이어 붙인 텍스트 검사는 "둘 중 하나만 있어도 통과" 다. 같은 함정을 이 세션에서 두 번 밟았다
   (앞선 건은 `check-guard-registry` 의 러너 텍스트 이어 붙이기).

### 가드

`src/tests/unit/faq-voucher-refund-2026-10-12.test.ts` **12건** — ①메타 약속↔답 **양방향**
②배송 답과 섞이지 않음(+교환권 레일 침묵) ③**코드 근거 생존**(cron·딜/카드 분기·알림·환불요청 경로·
화면 약속) ④출력 셋(FAQPage·noscript·llms.txt) ⑤여섯 언어.
주입 `scripts/mutations/faq-voucher-refund-2026-10-12.mjs` **8건 되돌려-검증 전부 빨간불 확인**.
🕳️ 기존 `geo-concept-surfaces` ④를 **풀지 않고 재조준** — 마크업을 **디코딩한 뒤** 대조한다
(`'` 가 든 답변은 `&#39;` 로 나가 원문 비교가 **거짓 빨간불**을 낸다. 그 파일의 탈출 단언은
시드 값으로 재므로 무접촉).

검증: tsc **0** · 신규 12 + 인접 5파일 **114건 pass** · pre-push 게이트 **가드 100 · 시험 212** ·
주입 잔재 **0**(3,352건 확인).

### ⚠️ 다음 세션 — E4 (배포 후)

```bash
UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
# ① 본문이 1,515 → 1,700자 대로 올랐는지 + 두 답이 실렸는지
curl -sS -A "$UA" https://urdeal.kr/faq \
  | python3 -c "import sys,re;h=sys.stdin.read();t=re.sub(r'<[^>]+>',' ',h);t=re.sub(r'\s+',' ',t).strip();print(len(t));print('유효기간' in t, '따로 신청하지 않아도' in t, '환불 요청' in t)"
# ② FAQPage Q&A 가 16건인지 (재귀로 훑어서 — @graph 중첩에 주의)
curl -sS -A "$UA" https://urdeal.kr/faq | grep -o '"@type":"Question"' | wc -l
# ③ 배송 답이 스코프됐는지 · llms.txt 에도 실렸는지
curl -sS https://urdeal.kr/llms.txt | grep -c "배송 상품 환불은 언제"
curl -sS https://urdeal.kr/llms.txt | grep -c "유효기간이 지나면 어떻게 되나요"
```

⚠️ **못 보는 것**: AI 가 실제로 그 답을 인용하는지(외부 판정 · 수일~수주) · 만료 환불 cron 이
라이브에서 실제로 도는지(하트비트·원장만 안다 — 2026-09-30 에 그 cron 이 **환불 0건**이던 사고가
있었다) · 다섯 언어 번역 품질(기존 관례대로 `[TODO:xx] <한국어>` 자리표시자다).

---

## 🔗🗺️ 후속 ⑨ — 색인 대상 지역 44개로 들어가는 **내부 링크가 0개**였다 (같은 지시)

### 실측 (Googlebot UA · 라이브 · sitemap 정적·목록 23건 전수)

```
     8자  a=0  /privacy · /refund · facet 3건            ← 앞 항목들(미머지)
    45자  a=0  /browse        120자 a=0  /region   ←★ 허브
   368자  a=0  /map           445자 a=0  /stays
   369자  a=4  /              2230자 a=21 /blog
  1512자  a=0  /faq
```

🔑 **a=0 은 대부분 미머지 탓이지만, 허브는 머지 뒤에도 0 이다.** 후속 ⑥(크롤러 내부 링크)이 넣은
것은 *목록 → 상품* 링크이고, **지역 트리**(허브 → 시/도 → 시군구)는 아무도 안 만들었다:

```
/region        본문 120자 · a태그 0   ← 허브인데 자식 시/도로 가는 길이 없다
/region/서울    본문 364자 · 상품만    ← 자식 시군구 32곳으로 가는 길이 없다
```

⇒ **색인 대상 43~44개가 sitemap 으로만 발견되고 내부 링크 가치는 0** 이다. JS 를 렌더하는
Googlebot 은 화면 링크를 보지만 **Yeti(네이버)·AI 검색봇은 이 문서가 전부**다.

### 수정 — 잠긴 파일 **0개 접촉**

| 파일 | 변경 |
|---|---|
| `shared/seo/region-digest.ts` | `regionDigestApplies` 에 `'/region'` 추가 + 신규 `regionChildLinks(path, digest)` |
| `worker/utils/crawler-noscript.ts` | 신규 `childLinksHtml()` 한 곳에서 조립 + 허브·시/도 두 자리 배선 |

🔑 **워커(`worker/index.ts`)는 한 글자도 안 고쳤다** — `regionDigestApplies` 는 함수고,
`buildStaticSurfaceNoscript(url.pathname, crawlerPayload)` 는 **경로로 갈리는 단일 호출**이다.
래칫 2672 에 여유가 0 이라 이게 결정적이었다.

🔗 **링크 집합 = 색인 집합.** 판정이 `regionThinByDigest` 와 **같은 데이터·같은 술어**
(`addressInRegion` + `REGION_INDEX_MIN_DEALS`)라 *"링크한다"* ⟺ *"thin 이 아니다"* 가 구조적으로
보장된다. 시험이 그 동치를 **양방향**으로 잰다(링크된 것은 thin 아님 · 빠진 인천은 thin).

🔴 **요약이 없으면 링크를 안 만든다** — 그리고 그건 방어 코드가 아니라 **구조**다(루프가 행에서만
후보를 만든다). 위험한 방향은 *"cron 전이라도 허브엔 링크가 있어야 한다"* 며 전국 목록을
폴백으로 넣는 것이고, 주입이 그쪽을 지킨다.

### 눈으로 본 출력

```
허브 자식   [서울, 경기]              (인천 2건=thin 제외 · 대구 교환권뿐 제외)
서울 자식   [종로구, 중구]            경기 자식 [파주시]      종로구(잎) []
요약 없음   []  →  허브 본문 **종전과 byte-동일**
href       /region/%EC%84%9C%EC%9A%B8  = resolveRegionSeo canonical (강원특별자치도 → 강원 도 확인)
```

### 🩸 이번에 틀린 것 — **같은 규칙의 세 번째 사본**

주입이 두 번 통과했다(= 가드가 지키는 척). 원인은 픽스처가 아니라 **규칙이 세 곳에 있었다**:

1. `if (!rows.length) return []` — 루프가 이미 0 을 내므로 **아무것도 더 안 지킨다** → 제거.
2. 후보 수집 루프의 `deal_only` 제외 — 세는 루프가 또 거르므로 **중복** → 제거(한 곳만 남김).
3. 그런데 그 **세는 루프**조차 `buildRegionDigest` 가 이미 교환권을 버리기 때문에, 요약으로
   만든 픽스처에서는 지워도 결과가 같았다. **실제로 그 규칙이 일하는 자리는 요약이 없을 때**다 —
   워커가 `crawlerPayload = digestRaw || ssrPayload` 를 넘기므로 KV miss 면 **MAIN 시드 원본**
   (교환권 포함)이 온다 ⇒ 봉투를 **손으로 만들어** 그 경우를 재는 시험을 추가해 빨간불 확인.

> 🧭 **교훈: 같은 규칙을 두 군데 두면 어느 쪽도 출력으로 판정할 수 없다**(CLAUDE.md 가 2026-10-11
> 에 적어 둔 그 교훈을 같은 파일에서 다시 밟았다). 그리고 **주입이 통과하면 픽스처를 의심하기
> 전에 "이 규칙이 실제로 일하는 입력이 무엇인가" 를 먼저 물을 것.**

### 가드

`src/tests/unit/region-child-links-2026-10-12.test.ts` **19건** — ①링크⟺색인 **양방향** + 교환권
②부재 → 0 (+허브 본문 byte-동일) ③트리 모양(잎·모르는 시/도·깊은 경로) ④**href = resolver
canonical**(정규화 케이스 포함) ⑤배선(허브가 요약을 받는가 · 조립 한 곳 · 상품이 먼저).
주입 `scripts/mutations/region-child-links-2026-10-12.mjs` **9건 되돌려-검증 전부 빨간불**.

🕳️ **기존 가드·주입 셋을 풀지 않고 재조준**: `region-digest` ⑤(허브도 요약을 쓴다 — 경계는 그대로) ·
`crawler-internal-links` ③(상한 8 은 **상품 줄**의 양을 지킨다 → `<ul>` 두 벌을 따로 센다) ·
주입 2건(`regionDigestApplies` 앵커 · thin 판정의 교환권 제외 — 같은 줄이 두 곳이 돼 함수 맥락까지
포함. **결함은 한 글자도 안 바꿨고** 둘 다 다시 빨간불 확인).

검증: tsc **0** · 신규 19 + 인접 **60건 pass** · 앵커 3,361건 실재 · pre-push 게이트
**가드 100 · 시험 215** · 주입 잔재 0.

### ⚠️ 다음 세션 — E4 (배포 후)

```bash
UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
# ① 허브에 시/도 링크가 생겼는지 (종전 a=0)
curl -sS -A "$UA" https://urdeal.kr/region | grep -o 'href="/region/[^"]*"' | sort -u
# ② 시/도 페이지에 자식 시군구 링크가 생겼는지 + 상품 링크가 **먼저**인지
curl -sS -A "$UA" https://urdeal.kr/region/서울 | grep -o 'href="/\(pass\|region\)/[^"]*"' | head -20
# ③ 🔴 반대 방향 — thin 지역이 링크되지 않았는지 (인천·세종·울산은 noindex 다)
curl -sS -A "$UA" https://urdeal.kr/region | grep -c '인천\|세종\|울산'
# ④ 허브가 여전히 index 인지 (허브는 noindex 대상이 아니다)
curl -sS -A "$UA" https://urdeal.kr/region | grep -o 'name="robots"[^>]*'
```

⚠️ **KV 에 요약이 있어야 링크가 생긴다**(cron `:15` 1회). 요약이 없으면 링크 0 이고 그건
**설계대로**다 — ①이 비면 먼저 `X-SSR-Status`/cron 하트비트를 볼 것.
