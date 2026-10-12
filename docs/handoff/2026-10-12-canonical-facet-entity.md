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
