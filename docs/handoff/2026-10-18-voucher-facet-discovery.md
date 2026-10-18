# 교환권 facet 17종이 발견 경로 0 — 기계는 멀쩡했고 길이 없었다 (2026-10-18)

과업 #108. 대표 **착수 승인**(10-18 "승인해줄게 이어서 해") 뒤 수리.

## 다음 세션의 첫 액션

**E4 는 배포 후 라이브 UA 실측이다.** 양방향으로 잰다 — 0 만 보면 *고쳐졌다*와 *측정 실패*를 구분할 수 없다.

```bash
UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
# ① sitemap facet 제출: 3 → 20 (상위가 커피/음료·치킨·편의점 순인지)
curl -sS https://urdeal.kr/sitemap.xml -H "User-Agent: $UA" | grep -c 'vouchers?category='
# ② 허브 내부 링크: 0 → 20, 그리고 **상세 링크는 여전히 0**
curl -sS https://urdeal.kr/vouchers -H "User-Agent: $UA" > /tmp/v.html
grep -o 'href="/vouchers?category=[^"]*"' /tmp/v.html | wc -l      # 기대 20
grep -oE 'href="/(vouchers|pass|products|stays)/[0-9]+' /tmp/v.html | wc -l   # 기대 0 ← 반대 방향
# ③ 대조군(이 방향이 깨지면 조용히 색인이 빠진다): facet 이 self-canonical + index 인지
curl -sS 'https://urdeal.kr/vouchers?category=%EC%B9%98%ED%82%A8' -H "User-Agent: $UA" \
  | grep -oE 'rel="canonical" href="[^"]*"|name="robots" content="[^"]*"'
```

🔴 **①이 3 이면 "미반영" 이 아니라 **집계 폴백**일 수 있다** — `facetsEmitted === 0` 이면 종전 3개가
나온다(DB 부재·쿼리 실패·스키마 미적용). 그때는 제출된 값이 정확히 `편의점`·`커피/음료`·
`베이커리/도넛` **셋뿐**인지 보고, 그러면 집계가 안 돈 것이다(배포 미반영과 구분된다).

⚠️ 캐시: sitemap 은 `publicCache(3600)` 다 — 배포 직후 최대 1시간은 옛 XML 이 나온다.
`?cb=` 를 **붙이지 말 것**(2026-10-15 에 그 습관이 워커 슬롯 조건을 꺼서 오진을 만들었다).

## 실측 — 결함의 모양 (배포 전 기준선)

```
교환권 전수 2,260건 · 카테고리 21종   (pagination.total 은 101 로 **거짓** — 행을 세야 한다)
VOUCHER_FILTER_CATEGORIES 20종  =  /api/vouchers/categories 20종   ← 정확히 일치, 전부 count ≥ 5
sitemap 제출                     3종  (편의점 274 · 커피/음료 775 · 베이커리/도넛 202)
/vouchers 허브 크롤러 문서       본문 295자 · h1·h2 있음 · **a태그 0개**
⇒ 17종이 발견 경로 0
```

🔑 **facet 기계는 이미 멀쩡했다** — 제출 안 된 `?category=치킨` 도 제목(`치킨 기프티콘 교환권 …`)·
self-canonical·`<noscript>` 본문 **275자**를 낸다(2026-10-12 수리가 20종 전부에 걸려 있다).
**비어 있던 것은 발견 경로뿐이고**, 그래서 이 PR 은 본문 생성기를 한 글자도 안 건드린다.

🩸 **그리고 제출 3개는 상위 3종도 아니었다**: 상위는 커피/음료 775 · 치킨 278 · 편의점 274 이고
`베이커리/도넛`(202)은 6위다. 치킨·피자(222)·버거(206)가 더 많은데 빠져 있었다 — 2026-07-29 주석이
*"라이브 실측 상위 카테고리만 남긴 것"* 이라 적어 둔 **그 실측이 낡아 있었다.**

| 카테고리 | 건수 | 종전 제출 | 카테고리 | 건수 | 종전 제출 |
|---|---:|---|---|---:|---|
| 커피/음료 | 775 | 제출 | 백화점상품권 | 18 | |
| 치킨 | 278 | | 올레 | 16 | |
| 편의점 | 274 | 제출 | 마트 · 도서 · 주유상품권 | 15 | |
| 피자 | 222 | | 용역서비스 | 14 | |
| 버거 | 206 | | 영화 | 12 | |
| 베이커리/도넛 | 202 | 제출 | 3사 통합데이터 상품 · 음악 | 7 | |
| 아이스크림 | 97 | | 마트상품권 | 5 | |
| 외식 33 · 기타상품권 24 · 생활/가전/디지털 22 | | | | | |

## 처방 — 제출은 엄격, 링크는 관대

두 방향이 **다른 것이 의도**다. 한쪽 규율을 다른 쪽에 옮기면 안 된다.

| | 재료 | 왜 |
|---|---|---|
| **sitemap 제출** | **D1 재고 집계** (`voucherFacetsByStock`) | "색인해 달라" 라서 엄격하다. 빈 목록을 제출하면 soft-404 로 집계돼 크롤 예산이 깎인다(2026-07-29 영문 슬러그 6건 사고) |
| **허브 내부 링크** | **코드 SSOT 20종** (`voucherFacetLinks`) | "여기 있다" 다. canonical 이 이미 그 20종을 self-canonical 로 허용하므로 **링크와 canonical 이 같은 SSOT** 를 쓴다 |

### 왜 링크는 집계를 안 보나 (= `/region` 과 다른 선택)

`/region` 은 요약이 없으면 링크를 **0** 으로 둔다(주소에서 파싱해야 아는 동적 값이라, 없는 데이터로
링크를 만들면 **지어내기**다). 교환권 카테고리는 **코드에 선언된 고정 집합**이고 라이브와 정확히
일치한다(실측 20 = 20) ⇒ 지어내기가 아니다. 그리고 이 요약을 KV 로 읽으면 **사람 요청마다** 비용을
물리는데 그 값은 `<noscript>` 전용이라 사람에게는 렌더조차 안 된다.

⚠️ **대가**: 어떤 카테고리가 재고 0 이 되면 **빈 facet 으로 가는 내부 링크 하나**가 남는다.
색인 피해는 없다 — sitemap 이 그 facet 을 제출하지 않는다.

### 집계는 `products.category` 로 센다 — `gift_catalog` JOIN 이 아니다

실측에서 두 기준이 **20종 전부 일치**하고 `건강/식품/주방` 만 갈렸다(categories API **0** ↔ facet **3**).
`/api/vouchers/categories`(화면 칩)는 `gift_catalog` INNER JOIN 인데 그 3건은 거기 안 걸린다.
**제출의 짝은 *본문*이므로 본문을 만드는 쪽 기준이 맞다.** 그 3건은 `VOUCHER_FILTER_CATEGORIES` 에
없어 canonical 이 `/vouchers` 로 통합한다 — **설계대로이고 결함이 아니다**(3건짜리 꼬리를 색인할
가치도 없고, 사람도 칩에서 그 facet 에 도달할 수 없다).

### 폴백 방향이 중요하다

집계가 0건이면 **종전 3개로 폴백**한다. 🔴 0 을 "재고 0" 으로 읽어 제출을 비우면 **이미 색인된 3건이
빠지고 색인은 돌아오는 데 수주다**(부재 ≠ 재고 0 — `region-digest.ts` 가 같은 규율을 지킨다).
반대로 facet 이 하나라도 집계됐으면 그 결과를 믿는다(재고가 정말 줄어든 경우를 폴백으로 덮으면
빈 목록을 색인 요청한다).

## 완료분

| | |
|---|---|
| `shared/seo/voucher-facet.ts` | `VOUCHER_FACET_MIN_ITEMS`(3) · `voucherFacetPath` · `voucherFacetsByStock` · `voucherFacetLinks` |
| `worker/routes/sitemap.routes.ts` | 하드코딩 3개 → D1 `GROUP BY` 집계 + `facetsEmitted === 0` 폴백 |
| `worker/utils/crawler-noscript.ts` | `/vouchers` 분기에만 facet 링크(`facetLinksHtml`) |
| 가드 | `voucher-facet-discovery-2026-10-18.test.ts` **26건** + 주입 **13건 전부 빨간불 확인** |
| 재조준(풀지 않음) | `crawler-internal-links` · `voucher-facet-body`×2 · `list-surface-noscript` |

문턱 3 의 근거(실측): 가장 작은 `마트상품권`(5건)도 본문 **159자 · 항목 5 · 사진 4**로 thin 이 아니다
(`음악` 7건 258자 · `영화` 12건 270자 — 8줄 상한 전까지 건수가 곧 본문 길이다).

## 이번에 틀렸던 판단 (제일 값진 부분)

1. 🩸 **제 가드가 헛돌았고 주입이 잡았다.** 첫 판의 단언이 `voucherFacetsByStock(` 가 소스에 있는지만
   봐서, 주입 *"집계 대신 하드코딩 3개로 돌아간다"*(인자를 `[]` 로 바꾼다)가 **통과했다** — 호출은
   남고 결과만 빈다. 이 레포가 반복해 당한 ***"계산은 하는데 쓰지 않는다"*** 클래스(2026-08-02
   `goneStatus`). ⇒ 가짜 D1(`node:sqlite`)로 **sitemap 라우트를 실제로 돌려 XML 을 세도록** 바꿨다.
   **문자열 검사로 배선을 판정하지 말 것.**
2. 🩸 **`pagination.total` 이 거짓이다.** `/api/products?deal_only=1` 이 `total: 101` 을 주는데 실제는
   **2,260건**이고, 카테고리별로는 전부 `2` 를 줬다. 그 값으로 분포를 재면 통째로 틀린다 ⇒
   **행을 직접 세야 한다**(페이징 전수).
3. 🩸 **공백이 든 카테고리에서 표기가 갈릴 자리가 있었다.** `3사 통합데이터 상품` 은 유일하게 공백이
   있고, `URLSearchParams.toString()` 을 쓰면 `+` 가 되는데 canonical 은 `%20` 이다(라이브 실측 —
   `+` 로 요청해도 `%20` 으로 통합한다). `encodeURIComponent` 로 맞춰 있지만 **우연이 아님을
   `buildCanonical` 을 실제로 돌려** 대조하는 단언을 넣었다(그게 이 PR 의 중심 단언이다).
4. 🩸 **눈 확인이 그 셋 중 둘을 찾아냈다.** 빌더를 라이브 시드로 돌려 마크업을 보고서야 `%20` 을
   의식했고, 제출 20건의 우선순위 분포도 그때 봤다. 문자열 단언만으로는 안 보였다.

## 남은 것

- **E4** — 위 첫 액션. 배포 + sitemap 캐시(1시간) 뒤.
- ⚠️ **못 보는 것**: 구글·네이버가 그 facet 을 실제로 색인하는지(수일~수주 · 서치콘솔은 **대표만**
  본다) · SSOT 20종이 라이브와 어긋나는 순간(테스트는 라이브를 못 본다 — `check-live-contracts` 도
  `loc` 이 변수라 이 facet 은 범위 밖이다) · HTMLRewriter 런타임 배선.
- **#109** 가리는 E4(실행비용 바닥값 추정기) — 진폭 7KB+ 회차 대기 중. 며칠 걸린다.

---

## 🩸 이번에 제 변경이 **기존 가드를 헛돌게** 만들었다 (주입이 잡았다)

`region-child-links-2026-10-12.test.ts` ⑤ 의 탈출 단언이 **파일 전체 정규식**이었다:

```js
expect(c).toMatch(/href="\$\{esc\(k\.href\)\}">\$\{esc\(k\.label\)\}/)
```

`crawler-noscript.ts` 에 그 모양의 빌더가 **하나**(`childLinksHtml`)뿐일 때는 사실상 그 함수에
걸려 있었다. 그런데 제가 **같은 모양**의 `facetLinksHtml` 을 같은 파일에 더하자 —

```
573: facetLinksHtml   `<li><a href="${esc(k.href)}">${esc(k.label)}</a></li>`   ← 내가 추가
583: childLinksHtml   `<li><a href="${esc(k.href)}">${esc(k.label)}</a></li>`   ← 원래 보호 대상
```

주입이 583 의 탈출을 지워도 **573 이 매치를 만들어 줘서 가드가 통과**했다(지역 자식 링크의
`esc()` 가 사라졌는데 초록). 즉 **제 변경이 남의 가드의 보호 범위를 조용히 비웠다.**

**재조준(풀지 않았다)** — 지키려던 불변식(*라벨·주소 둘 다 탈출을 지난다*)은 그대로이고
**범위만 넓혔다**: 링크 `<li>` 를 만드는 **모든 자리**를 세고 그 전부가 탈출형인지 본다.

```js
const liBuilders = (c.match(/<li><a href=/g) || []).length
expect(liBuilders).toBeGreaterThanOrEqual(2)
const escaped = (c.match(/<li><a href="\$\{esc\(k\.href\)\}">\$\{esc\(k\.label\)\}<\/a><\/li>/g) || []).length
expect(escaped).toBe(liBuilders)
```

세 번째 빌더가 생기면 자동으로 걸린다. 깨뜨려서 빨간불 확인했다(583 탈출 제거 → ⑤ FAIL).

🧭 **교훈**: *파일 전체를 보는 단언은 그 파일에 같은 모양의 코드가 하나일 때만 범위가 좁다.*
빌더를 하나 더 더하는 것만으로 남의 가드가 헛돌 수 있고, **빌드·시험·화면 전부 초록이다.**
새 헬퍼를 기존 파일에 더할 때는 그 파일을 앵커로 쓰는 가드가 있는지 보라.

## 🔁 함께 재조준한 낡은 지도 1건

`canonical-facet-entity-2026-10-12.mjs` 의 주입 `🔗 sitemap 이 카테고리를 손으로 적는다` 가
`const SITEMAP_VOUCHER_CATEGORIES` 를 앵커로 쓰고 있었다 — 제가 그 상수를
`SITEMAP_VOUCHER_FALLBACK` 으로 **이름만** 바꿨다(제출이 D1 집계로 옮겨가고 이 배열은 폴백이 됐다).
지키는 불변식(*제출분은 허용분의 부분집합*)은 **폴백에도 그대로 성립**하므로 앵커만 옮겼다.
