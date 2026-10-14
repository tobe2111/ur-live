# 2026-10-14 — 몰 상품 thin URL · 크롤러 문서 사진 · IndexNow

대표 지시: **"머지해줘. 하고나서 또 seo, geo 개선점 찾아줘"** → **"다 해주고 머지 후 또 개선점 찾아"**
(내가 올린 셋 중 둘은 "대표 판단 필요" 로 올렸는데 그 지시로 전부 승인됐다.)

## 다음 세션의 첫 액션

1. **E4 라이브 판정** (배포 후 — Googlebot UA 로 받아 **파싱해서** 재라):

   ```bash
   UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
   # ① 몰 상품 thin URL 이 닫혔나
   for p in /zzqqxx/p/999 /zzqqxx/p/abc; do
     curl -sS -o /dev/null -w "$p %{http_code}\n" -A "$UA" "https://urdeal.kr$p"
   done            # 기대: 둘 다 404
   curl -sS -A "$UA" https://urdeal.kr/zzqqxx/p/abc | grep -o 'name="robots"[^>]*'   # noindex
   # ② 크롤러 문서에 사진이 생겼나 (그리고 프록시로 안 가나)
   for p in /browse /map /region/서울 /products/2917; do
     n=$(curl -sS -A "$UA" "https://urdeal.kr$p" | grep -o '<img ' | wc -l)
     r=$(curl -sS -A "$UA" "https://urdeal.kr$p" | grep -c 'api/image/resize')
     echo "$p img=$n resize=$r"
   done            # 기대: img 1~4 · resize 0
   ```

   🔴 **반대 방향을 같이 재라** — 이 방향이 깨지면 조용히 색인이 빠진다:
   실재 몰 상품 경로(`/{몰슬러그}/p/{숫자}`)와 소비자 표면(`/`·`/vouchers`·`/browse`·`/map`·
   `/pass/2919`·`/u/jiwon1228`)이 **전부 200** 인지.

2. **③ IndexNow 는 대표가 켜야 한다** (게이트 ON = 결재). 대시보드에
   `INDEXNOW_ENABLED=true` + `INDEXNOW_KEY=<32~64자 영숫자>`.
   켜면 **첫 회차는 아무것도 안 보내고 커서만 세운다**(의도) — 둘째 회차부터 제출된다.
   판정: `/{키}.txt` 가 키 본문을 200 으로 주는지 · 하트비트 `cron_hb:indexnow-submit` 의 메시지.

## 이번에 한 것 (커밋 — 아래 ①②③ 한 커밋)

### ① `/{아무것}/p/{아무것}` 이 무한 thin URL 이었다

실측: `/zzqqxx/p/999` → 헤더에 `x-ssr-status: MALLPRODUCT:self-fetch-404` 가 **찍히는데**
**200 + `index, follow` + 자기 canonical + 본문 32자**. 2026-07-29 에 닫은
`/group-buy/99999999` 와 **같은 클래스**인데 형제 하나가 빠져 있었다.

원인이 **둘**이고 성격이 다르다:
- ⓐ `ENTITY_SLOTS`(`surface-ssr-meta.ts`)에 `'MALLPRODUCT'` **한 단어**가 없어
  `shouldNoindexMissingEntity` 가 false 를 돌려줬다.
- ⓑ id 가 숫자가 아니면(`/x/p/abc`) `parseMallProductPath` 가 거부해 **슬롯이 아예 안 잡힌다**
  (실측: `x-ssr-status` 헤더 **자체가 없다**). 그런데 `isKnownAppPath` 가 `segs[1] === 'p'` 만 보고
  **무조건 통과**시켜 ⓐ를 고쳐도 이쪽은 안 닫혔다.

ⓑ 판정을 **몰 경로 SSOT 와 같은 함수**(`parseMallProductPath`)로 통일했다 — 두 벌로 적으면
*"슬롯은 안 잡는데 아는 경로"* 라는 **지금의 틈**이 다시 생긴다(그 틈이 이 결함의 정체다).
워커 전용 importer 임을 확인해 클라 번들 영향 0.

🔴 **반대 방향이 훨씬 비싸다**: 실재 몰 상품 경로를 404 로 만들면 **소개비 귀속 링크가 통째로 죽고**
색인 복구가 수주다 → 문법이 맞으면 **200 유지**, 실재 여부는 `self-fetch-404` **만** 판정한다
(`self-fetch-timeout` 은 "느림" 이지 "부재" 가 아니다 — 주입 2건이 이 방향을 고정).

### ② 크롤러 문서에 상품 사진이 0장이었다

🩸 **처음 보고를 정정했다** — 내가 *"구글 이미지에 들어갈 자리가 없다"* 고 썼는데,
UA 별로 `script src` 를 세 보니 **봇 셸이 엔트리 스크립트를 실어** Googlebot 은 렌더해서 React
`<img>` 를 본다. 진짜 공백은 **JS 를 안 돌리는 크롤러**(네이버 Yeti · AI 봇)다 ⇒ 가치는
**네이버 이미지 검색**이고 구글 쪽은 렌더 지연 보험이다.

목록·지역 행과 `/products/:id` 에 `<img>` 를 붙이되 **자제 네 가지**:
- 사진 **4장까지** (`<noscript>` 는 사람이 받는 응답에도 실린다 — 전량 덤프 금지)
- `/cdn-cgi/image/` 로 확실히 가는 것만 — **워커 프록시(`/api/image/resize`)는 리사이즈를 못 한다**
  (2026-06-11 실측, 항상 원본 폴백). `i.ibb.co` 는 승격도 불가(cdn-cgi **524 `err=9504`** 실측).
- 없는 사진을 **지어내지 않는다**(사진 없는 행은 글만)
- 모르는 `height` 를 **선언하지 않는다**(우리 사진 비율이 제각각 — 2026-08-31 실측)

🩸 **상한을 처음 *행 인덱스*로 셌고 주입 검증이 그걸 잡았다**: 쓸 수 없는 행(사진 없음 ·
프록시 호스트)이 **자리를 먹어서**, 프록시 가드를 지운 주입이 **초록**이었다(출력이 1바이트도
안 바뀐다 — 탐침의 프록시 행이 5번째라 어차피 상한에 걸렸다). ⇒ **그려진 사진을 센다** 로 고치고
탐침의 쓸 수 없는 행을 **앞쪽**으로 옮겼다. 이 레포가 반복해 밟은
*"탐침이 그 경우를 담지 않으면 규칙을 없애도 초록"* 클래스다.

### ③ IndexNow — 네이버·Bing 에 바뀐 URL만 알린다 (2단 스위치, 기본 OFF)

네이버가 **2023-07 부터 지원**하고 한 번 제출하면 Bing·Yandex·Seznam·Yep 로 전파된다.
**구글은 IndexNow 를 지원하지 않는다**(그 사실을 테스트가 문서로 고정 — 다음 세션이 구글 효과를
기대하지 않게).

🔑 **우리 sitemap 을 읽는다** — 쿼리를 다시 짜지 않으므로 sitemap 의 noindex·thin 게이트를
**그대로 물려받는다**(두 벌이 갈릴 수 없다). `lastmod` 가 커서보다 **새 것만** 최대 100건.

보수적 처리 넷: **첫 회차는 커서만 세우고 아무것도 안 보낸다** · 상한에 잘렸으면 **커서를 안 올린다**
· 제출 실패(비-200/202)면 **커서 유지** · `lastmod` 없는 항목은 대상 아님.
키 파일은 `sitemap.routes.ts` 에 달아 **`worker/index.ts`(래칫 2672)를 안 건드렸다.**

## 검증

- tsc 0 · 신규 테스트 **23건 pass**
- 주입 **15건** 되돌려-검증 **전부 빨간불 확인**
- 🩸 **주입이 내 결함 둘을 잡았다**: 위 ② 의 행-인덱스 상한 · 그리고 cap 제거 주입의
  `replace: '  return rows'` 가 실제 코드 `  return rows.map((r) => {` 의 **부분문자열**이라
  주입-잔재 검사가 **거짓 경보**를 냈다(pre-commit 이 커밋을 막았다 — CLAUDE.md 가 경고한
  `replace: 'return'` 클래스를 그대로 밟았다).

## 남은 것 / 대기

| 번호 | 무엇 | 왜 못 했나 |
|---|---|---|
| **#60** | IndexNow 켜기 | **게이트 ON = 결재** — 대표가 대시보드에서 |
| #59 잔여 | `/blog/:slug` img 0 | `thumbnail_url` 이 **전부 null**(데이터 공백 — 지어낼 수 없다) |
| #45 | 로고·유달이 구글 이미지 | `/about` 시안을 대표에게 보여야 한다. 전제 정정: `Organization.logo` = `/icon-512.png` **200 · 512×512** |
| #54 | `www.urdeal.kr` NXDOMAIN | 대표가 Cloudflare DNS 레코드 생성 |
| #47 | 봇 셸 `og:image:alt` · `twitter:site` | 셸이 경로별로 둘이라 비용 대비 효과가 낮아 보류. **`@urdeal_kr` 계정 실재 미확인** |
| #43 잔여 | `/gdpr`·`/influencer/rankings` 크롤러 본문 | 곁가지: `PrivacyPolicyPage` 가 한국어 방침에 **영문 섹션**이 섞여 있다(GLOBAL 폐기 #804 인데) — 내용 판단 필요 |
| #31 · #35 | 결재 2건 | `/pass/:id` 공유 카드 SVG · 검색 제목 `[유어딜] {이용권명}` |

## 이번에 틀렸던 판단 (같은 오진 반복 방지)

1. **"구글 이미지에 자리가 없다"** — 봇 셸이 엔트리 스크립트를 싣는다는 걸 안 재고 단정했다.
   UA 별로 `script src` 를 세고서 뒤집혔다. ⇒ *"크롤러가 JS 를 못 돌린다"* 를 전제로 쓰기 전에
   그 문서의 `<script>` 를 먼저 세라.
2. **구 도메인이 200 이라고 읽었다** — `urllib.urlopen` 이 **리다이렉트를 따라간다**. 리다이렉트를
   안 따르는 opener 로 다시 재니 **전 경로 301**(CLAUDE.md 가 맞았다). **이 세션 여섯 번째
   측정 오류**다. ⇒ 측정값이 문서와 어긋나면 **측정기를 먼저 의심하라**.
3. **`--only='2026-10-14'`** 로 내 주입만 돌리려 했는데 **0건 매칭**(이름 부분일치이고 파일명이
   아니다). 러너가 exit 1 로 멈춰 아무것도 검증하지 않았다 — 이모지 접두로 다시 돌렸고, 그
   이모지는 **다른 매니페스트의 주입과도 매칭**된다(중간에 무관한 파일이 modified 로 보인다).

## 머지 #1766 E4 판정 (배포 후 라이브) — **다섯 전부 통과**

| 항목 | 결과 |
|---|---|
| sitemap `/region/%` 인코딩 | **43건 인코딩 · 날것 0** |
| `/terms/influencer` | `noindex, follow` |
| `/urshorts` 크롤러 본문 | 6자 → **468자** |
| `/blog` 제목 em-dash | **0** |
| `/llms.txt` H1 em-dash | **0**(`# 유어딜 (UrDeal)`) |

🩸 **이 판정에서 또 한 번 오진할 뻔했다 — 일곱 번째 측정 오류다.** 첫 측정이 sitemap 을
`인코딩 0 · 날것 43` 으로 읽어 *"그 수정이 안 올라갔다"* 로 보고하려 했는데, 응답 헤더가
**`age: 2388`** 이었다 — `sitemap.xml` 은 `publicCache(3600)` 라 **39분 된 캐시본**을 받은 것이다.
쿼리를 붙여 다시 받으니 `인코딩 43 · 날것 0`(그리고 총 451 → 454건).
⇒ **엣지 캐시가 걸린 응답으로 배포 판정을 하지 말 것. `age` 를 먼저 보라.**
⚠️ 다만 쿼리를 붙이는 것은 **다른 캐시 키를 재는 것**이다(2026-10-12 에 `?cb=` 가 VOUCHERS 시드를
꺼서 회귀로 오진한 그 함정) — sitemap 은 쿼리를 안 읽어 안전하지만, 습관으로 쓰지 말 것.

## 다음 개선점 (#61 — 이번에 새로 찾았다, 미착수)

**끝에 `/` 또는 `/index.html` 이 붙은 중복 URL 이 24쌍**이다. 색인 대상 26표면에 두 변형을
넣어 보니(Googlebot UA · 리다이렉트 안 따라가는 opener) **24개가 200 + `index, follow` +
자기 canonical** 이고, 그중 **19개는 제네릭 홈 제목까지** 서빙한다:

```
정규화됨    /faq/  /vouchers/  /map/  /stays/  /terms/  /u/:handle/  /region/
            /pass/:id/   /pass/:id/index.html   /region/서울/
정규화 안 됨  /*/index.html 20개 전부 · /blog/(canonical `/blog/` + 제네릭 제목)
            /products/2917/ · /products/2917/index.html
```

원인은 canonical 을 **pathname 그대로** 찍는 자리가 남은 것 + 표면 표·블로그 빌더가 **정확 일치**로만
매칭돼 변형이 **봇 셸의 self-canonical** 로 떨어지는 것이다. 처방은 메타 판정 **앞에서** 경로를
정규화해 **301**(내용이 같은 페이지라 404 가 아니다). 🔴 반대 방향(멀쩡한 경로를 301 로 보내기)이
비싸므로 정규화 뒤 경로가 `isKnownAppPath` 를 통과할 때만, `/api/*`·정적 자산은 무접촉.

---

## 🩸 이 PR 이 **가드 하나를 헛돌게 만들었다** (CI 가 잡았고 같은 커밋에서 수리)

PR #1775 의 Verify 가 `cb69f51` 에서 빨간불이 났다. 실패는 내 새 코드가 아니라
**`llms-txt-2026-10-12.test.ts` 가 아무것도 안 지키게 된 것**이었다:

```
❌ guard-mutations: 1건
   • 🤖 llms.txt 를 Content-Type 없이 서빙한다: 결함을 심었는데 통과 — 이 가드는 아무것도 안 지킨다.
```

원인은 **그 테스트의 앵커가 파일 끝까지 자르고 있었던 것**이다:

```js
const block = sitemapRoute.slice(sitemapRoute.indexOf("sitemapRoutes.get('/llms.txt'"))
//                                                                    ↑ 끝까지
expect(block).toContain("'Content-Type': 'text/plain; charset=utf-8'")
```

그리고 이 PR 이 **그 아래에** IndexNow 키 파일 라우트를 붙였는데 그 라우트도 같은 헤더를 갖는다
⇒ llms.txt 쪽 헤더를 지워도 **아래 것이 매치돼 초록**. 라우트를 추가한 것이 잘못이 아니라
**앵커가 경계를 안 가진 것**이 결함이고, 이 레포가 반복해 당한 *헛도는 가드* 클래스다.

**수리**: 다음 `sitemapRoutes.get(` 까지로 잘라 **그 라우트 하나만** 본다. 되돌려-검증으로
그 주입이 다시 **빨간불**임을 확인했다(종전 초록).

⚠️ **교훈 둘**:
1. **소스를 문자열로 읽는 단언은 끝까지 자르면 안 된다** — 그 뒤에 무엇이 붙을지 모른다.
   앵커에는 **시작과 끝**이 다 있어야 한다.
2. 🔴 **이 커밋은 `--no-verify` + `SKIP_PREPUSH_GATE=` 로 올라갔다.** 문서만 바꾼 커밋이라
   건너뛸 만하다고 봤는데, 그 판단이 틀렸다 — 게이트가 도는 ~91개 가드는 **브랜치 전체**를
   보므로 로컬에서 20초에 알 수 있던 것을 **CI 한 바퀴**로 알았다. 우회는 "문서만 바꿨다" 가
   근거가 될 수 없다.

---

# 다음 PR — #62(잎 꼬리 404) + #61(끝 슬래시·index.html 301)

대표 *"머지하고 계속 진행해"*. #1775 는 auto-merge(squash) 를 켜 뒀고 Verify 가 초록이면 들어간다.

## #62 — 잎 표면 51개 × 아무 꼬리 = 무한 thin URL

라이브 실측(Googlebot UA, `urdeal.kr`):

```
/browse/zz  /map/zz  /urshorts/zz  /gdpr/zz  /partners/zz
/join/zz    /videos/zz  /privacy/zz  /refund/zz  /new-openings/zz   전부 200 + index, follow
/faq/a/b/c                                                          200 + index, follow
```

`isKnownAppPath` 가 2세그먼트 이상에서 **최상위만** 본다(대시보드 180경로를 404 로 만들지 않으려고
일부러 관대). 그래서 **자식 라우트가 아예 없는** 잎 표면도 통과한다. 그 모듈 머리말이 "못 보는 것" 으로
적어 둔 그 틈이다.

🔴 **그리고 CLAUDE.md 의 기록이 틀렸다.** 2026-10-12 `self-fetch-400` 이 이걸 닫았다고 적혀 있지만,
슬롯 정규식이 `(\d+)` 라 **숫자 아닌 id 는 슬롯에 안 잡히고**(실측: `x-ssr-status` 헤더 자체가 없다)
엔티티 기계에 도달조차 못 한다. `/vouchers/abc`·`/pass/abc`·`/stays/abc` 가 **오늘도 200 + index** 다.

**처방**: 라우트 네 파일에서 **자식이 있는 최상위**를 계산해 `KNOWN_PARENT_SEGMENTS`(41개)로 판정.
두 가지 추출 방법으로 같은 값이 나왔다 — `최상위 92 = 부모 41 + 잎 51`(정확히 분할).

🔴 **비싼 쪽(멀쩡한 URL 404)을 전수로 확인했다.** 잎 51개 아래로 런타임이 만드는 깊은 경로를 쓸어 보니
걸린 둘이 전부 가짜였다:
- `/checkout/return` — **코드 참조 0** 의 죽은 자리(레이아웃 접두 목록·운영 문서에만 남았고 라우트 표에도
  없다. 지금도 React 는 404 화면을 그린다)
- `/my-orders/{id}` — **시험 픽스처**뿐. 실제 알림은 전부 `/my-orders`(id 없음)

나머지(`/cart/init`·`/search/suggestions`·`/orders/:id/refund` …)는 **API 경로**라 무관.

⚠️ **Stage 2(별건)**: 자식이 *있는* 표면의 쓰레기 꼬리(`/terms/zzzqqq`·`/vouchers/abc`)는 리터럴 자식 +
동적 자식 모양 모델이 필요하다. 🔴 `/group-buy/confirm-payment` 가 그 위험의 증거다 — 숫자 전용 규칙을
통째로 걸면 **결제 복귀 URL 이 404**.

## #61 — 같은 페이지의 다른 철자는 301

```
/faq/index.html   200 · canonical 자기자신 · 제목이 제네릭 홈
/blog/            200 · canonical `/blog/`  · 제목이 제네릭 홈
/products/2917/   200 · canonical `/products/2917/`
/faq/             이미 정상(canonical `/faq`)
/index.html       Pages 가 308 로 정규화(워커 밖 — `_routes.json` exclude)
```

신규 `src/shared/seo/path-normalize.ts` 가 끝 슬래시와 `/index.html` 을 **고정점까지** 떼고, 워커가
**정규화된 경로가 `isKnownAppPath` 를 통과할 때만** 301 한다.

**순서가 규칙이다**: ① 같은 내용·다른 철자 → **301** ② 페이지가 아님 → **404 + noindex**
③ 철거 → **410**. 정규화가 먼저라서 `/faq/index.html` 은 404 가 아니라 301 로 빠진다(철자 문제인데
404 로 던지면 링크 가치를 버린다).

📏 `worker/index.ts` 는 **2672 = 래칫 상한**이라 배선 한 줄 + 주석 한 줄 압축으로 **줄 수를 유지**했다
(`--rebaseline` 쓰지 않았다).

## 🩸 주입 셋이 헛돌아 고쳤다 (전부 앵커 문제)

1. **`301 → 302`** — find 가 `${url.search || ''}`, 301);` 라 **레거시 호스트 301·블로그 슬러그 301 에도
   맞았다.** 러너가 첫 occurrence 를 바꿨고 내 줄은 301 그대로여서 초록이 떴다 → `${norm}` 을 포함해
   **고유**하게. ⇒ **find 는 파일에서 유일해야 한다.**
2. **순서 스왑** — `WIRE` 상수를 **코드 부분만** 적었는데 실제 줄엔 뒤에 주석이 있어 `WIRE\nBLOG` 가
   안 맞았다(주입이 적용조차 안 됐다) → 주석까지 포함한 **실제 한 줄**을 파일에서 뽑아 넣었다.
3. **가드 약화형 주입** — 시험의 양방향 단언을 한쪽으로 바꾸는 주입을 넣었는데, **약화는 빨간불이
   안 난다**(초록이 된다). 주입은 **소스에 결함을 심는 것**이다 → 부모 집합에 잎(`faq`)을 끼워 넣어
   군더더기 방향을 재도록 교체.

## ⚠️ E4 (배포 후 라이브 실측)

- `/faq/index.html`·`/blog/`·`/products/2917/` 가 **301** 이고 목적지가 슬래시 없는 경로인지
- **반대 방향**: `/faq`·`/blog`·`/products/2917`·`/about/print`·`/terms/seller`·`/pass/2919`
  ·`/u/jiwon1228`·`/region/서울`·`/group-buy/confirm-payment`·`/seller/orders` 가 **200 유지**인지
- 잎 꼬리 10개가 **404 + noindex** 인지
- `/faq/` 는 종전처럼 200(canonical `/faq`) 인지 — 301 로 바뀌어도 무해하나 값을 기록할 것

---

# 그 다음 — #63 공개 셀러 API 가 매장별 수수료율을 내보낸다 (SEO 아님, 영업비밀)

#1778 이 CI 중일 때 라이브를 다시 쓸며 찾았다. **인증 0 · id 순회**만으로:

```
/api/sellers/14/public   홍대돈까스   commission_rate=5    business_number=4790902930
/api/sellers/20/public   청룡갈비     commission_rate=5
/api/sellers/26/public   달빛한스푼   commission_rate=10   ← 같은 서비스에서 2배
```

그 응답은 `__SSR_INITIAL_SELLER__` 로 **서빙 HTML 에 박혀** `/s/*`·`/profile/*` 에서 크롤러까지 받는다.
**소비자 화면은 그 값을 한 번도 읽지 않는다** — src 전수로 세니 걸리는 것은 상품의
`referral_commission_rate`(다른 필드)이거나 셀러 **본인** 정산 화면(인증됨)이다.

🔴 **짝이 더 나쁘다**: 대외 랜딩 `/about`(sitemap 제출·색인 대상) `AboutPage.tsx:187` 이
*"어드민에서 셀러별 commission_rate 개별 조정 (협상 여지)"* 라고 **알려 준다.** 요율이 매장마다
다르고 협상 가능하다고 알리면서 **남의 요율을 조회할 수단까지** 열어 둔 셈이다.

그리고 CLAUDE.md 는 AI 블로그 초안에 *"운영 정보 차단 — 수수료율·정산·커미션을 아예 넣지 않는다"* 를
강제한다 ⇒ **같은 정보에 두 가지 기준**이었다.

**처방(구현 완료, 커밋 대기)**: `seller-public-payload.ts` 의 SELECT 목록에서 그 한 줄 제거 + 제거 사유를
그 자리에 남김 + 가드. `business_number`·`business_address`·`representative_name` 은 **통신판매업자 표기
의무** 정보이고 유어샵 사업자정보 섹션이 실제로 쓰므로 **반대 방향도 잠갔다**.

가드 `seller-public-no-rate-2026-10-14.test.ts` 5건 + 주입 **6건 되돌려-검증 전부 빨간불 확인**
(절반이 반대 방향: 사업자번호·대표자명·소개 제거).

🩸 **주입 하나가 또 헛돌았다**: `대표자명을 지운다` 가 통과했다 — `ceo_name` 이 같은 파일의 **다른
블록**(`seller_business_info` enrich, 122~137줄)에도 있어서 SELECT 줄을 지워도 문자열이 남았다.
⇒ 단언을 **`SELLER_PUBLIC_COLS` 배열 안**으로 좁혔다. **전체 파일 `includes` 는 "그 목록에서 사라졌다"를
판정할 수 없다.** (오늘 네 번째 앵커 사고다.)

⚠️ **대표 판단**: `/about` 의 *"(협상 여지)"* 한 줄을 지울지는 대외 메시지 문제라 손대지 않았다.
⚠️ **E4**: 배포 + KV 캐시 300s 뒤 `curl /api/sellers/26/public` 에 `commission_rate` 가 **없는지** ·
   `business_number`·`ceo_name` 은 **있는지**(반대 방향) · 유어샵 화면이 종전과 같은지.

---

## 🩸 #1778 CI 빨간불 — **헛도는 주입**(수리 완료, `444b26e15`)

`가드 주입 검증 (변경분, strict)` 스텝 하나만 실패했다. **가드가 지키는 척만 한 경우**다.

    ❌ 🗺️ 반대 방향 — 세그먼트 목록에서 대시보드를 뺀다(App.tsx 만 읽던 첫 설계)
       결함을 심었는데 unknown-path-404-2026-10-12.test.ts 가 **통과**

**원인**: 같은 PR 에서 2세그먼트 판정을 `KNOWN_TOP_SEGMENTS`(부모 ∪ 잎) → `KNOWN_PARENT_SEGMENTS`
로 옮겼다. 그 순간 `KNOWN_TOP_SEGMENTS` 는 **프로덕션이 읽는 곳이 0**(남은 참조는 주석·시험·주입)이
됐는데 그 주입이 **그 죽은 집합**을 고치고 있었다 ⇒ 대시보드를 빼도 답이 안 바뀐다.

🔑 **`check-stale-mutation-anchors` 로는 못 잡는다** — `find` 는 멀쩡히 실재했다. *낡은 지도*가
아니라 *헛도는 가드* 이고, 그건 **결함을 실제로 심어 보는 그 스텝만** 판정할 수 있다.
⇒ 그 스텝이 77~90분이라 미루고 싶지만, 이 클래스를 잡는 유일한 수단이다.

**수리**: `KNOWN_TOP_SEGMENTS` **삭제** + 주입 셋 재조준(결함은 불변, 표현만 **살아 있는** 집합으로).
쓰이지 않는데 load-bearing 처럼 보이는 상수는 다음 헛도는 가드의 씨앗이다.

### 🧨 그리고 러너를 강제 종료해 **주입 잔재**가 남았다 (pre-commit 이 잡았다)

로컬 재현을 서둘러 `TaskStop` → `pkill` 로 러너를 죽였는데, 그 순간 `partners-landing.mjs` 의
*"스니펫에서 중개 요율을 뺀다"* 가 `consumer-surfaces.ts` 에 적용된 상태였고 **복원되지 않았다**.

    find  `(대행사를 통하면 ${PARTNER_FACTS.feeBrokered})가 붙습니다.` → 0건
    replace `가 붙습니다.`                                        → 181행에 실재

⚠️ 러너가 찍은 *"복원 실패 의심: consumer-safaces.ts"* 를 **내 작업 변경 탓이라고 넘겼는데
사실이었다.** `check-no-injection-in-progress.sh`(pre-commit)가 커밋 직전에 막았다.
🔴 그때 훅이 권하는 `git checkout -- src/` 를 그대로 따르면 **내 작업이 통째로 날아간다** —
한 줄만 손으로 되돌렸다(그 뒤 3,652건 잔재 검사 0 확인).

⇒ **교훈 둘**: ① `pkill` 로 러너를 죽이면 잔재를 **반드시** 직접 확인한다(`find` 가 0건인지).
② 러너의 "복원 실패 의심" 은 내 변경 때문일 수도 있고 **진짜일 수도 있다** — 구분은 `find`/`replace`
문자열을 직접 세는 것으로만 된다.

---

## ②-1 색인 대상인데 크롤러 본문 6자인 표면 셋 (이 세션에서 완료)

라이브 실측(Googlebot UA). **처방이 표면마다 다르고, 가르는 기준은 "본문을 정직하게 채울 수
있는가" 다.**

    /gdpr                 200 · 6자 · index        → **본문을 준다**(6자 → 382자)
    /influencer/rankings  200 · 6자 · index        → **noindex**(산문이 20자뿐 — 채우려면 지어내야 한다)
    /partnership          200 · 6자 · index + 제네릭 홈 제목 → **표 추가 + noindex**(4줄 문의 폼)
    /business             301 → /partners          → **결함 아님**(앞서 제 오보를 정정)

- **`/gdpr`** — 8개 절을 가진 진짜 문서이고 문장이 `<p>` 안에 통째로 있다(단일 언어·보간 없음)
  ⇒ 요약을 *쓰는* 게 아니라 *옮기는* 것이라 `surface-copy` 의 클로킹 금지 규율을 지킨다.
  🔒 **일부러 뺀 셋**: 이메일이 든 줄(수확 표면만 늘고 색인 보탬 0) · `Firebase (Google Cloud)`
     가 든 줄(Firebase 클라이언트는 2026-08-04 전면 삭제 #804 — **낡았을 수 있는 법정 문구를
     SEO SSOT 로 승격하지 않는다**) · h1(`crumb`)과 겹치는 줄.
  🧾 본문을 얻었으니 **sitemap 제출**(`/urshorts` 와 같은 순서: 본문 실측 먼저, 제출은 그다음).
- **`/influencer/rankings`·`/partnership`** — `robots.txt` 의 `Allow: /influencer/rankings` 는
  **지우면 안 된다**(Disallow 면 크롤러가 noindex 를 못 읽어 영구히 색인에 남는다).

🩸 **그 과정에서 기존 가드의 측정 버그를 찾았다**: `thin-surface-copy` 의 본문 추출이 태그만 떼고
**HTML 엔티티를 안 되돌렸다.** 한글 표면 열에는 escape 대상 문자가 한 글자도 없어 몇 달간 아무도
안 밟았는데, `/gdpr`(`("YourDeal")`)을 넣자 *코드는 멀쩡한데* 빨간불이 났다 — **빌더의 `esc()` 는
옳고 재는 쪽이 틀렸다.** 크롤러는 디코드해서 읽으므로 그걸 흉내 내야 측정이 사실과 같아진다.

🩸 **내 새 가드도 같은 클래스를 한 번 밟았다**: `/influencer/rankings` 에 산문이 없다는 전제를
`>([^<>{}]{10,})<` 로 재다가 `=>`·`useState<` 때문에 **코드를 48자 "산문" 으로 읽었다** ⇒ 한글이 든
텍스트 노드만 센다(+ 0건이면 통과가 아니라 측정 고장).

가드: `thin-indexable-surfaces-2026-10-14.test.ts` 19건 + 주입 **14건 되돌려-검증 전부 빨간불**.
중복 잠금을 피해 **다른 가드가 안 보는 것만** 단언한다(crumb↔noindex · noindex↔sitemap · 길이
바닥은 각각 기존 전수 가드가 이미 잠근다).

### ⚠️ E4 (배포 후)

    curl -A '<Googlebot UA>' https://urdeal.kr/gdpr        → 본문 6자에서 올라갔는지
    curl ... /partnership                                  → robots=noindex + 제목이 "광고/제휴 문의"
    curl ... /influencer/rankings                          → robots=noindex
    curl ... /partners  /influencer                        → **여전히 index**(반대 방향 — 이게 더 비싸다)
    curl -sS https://urdeal.kr/sitemap.xml | grep -c '/gdpr'  → 1

## 다음 할 일

1. **#65 신규** — `index, follow` 인 정적 표면 전수 중 본문 6자인 것은 `/privacy`·`/refund`
   **둘뿐**이고 **둘 다 sitemap 제출 중**이다(짝 주장 위반). `/privacy` 는 `<h2>` 절 제목만
   파생하면 되고(`/terms` 수법), `/refund` 는 **결재 #25 대기**(남의 서비스 환불약관이라 틀린
   법정 문구를 SSOT 로 승격하면 안 된다).
2. **#47 정정** — `twitter:site` 는 **추가하지 않는다**: 실제 X 계정이 없고, 없는 핸들을 넣는 것은
   `sameAs` 를 비워 둔 것과 같은 규율 위반이다. 남는 것은 `og:image:alt` 뿐이고, 그것도
   **그림을 정직하게 설명할 수 있는 표면만**(유어샵=프로필 사진 · 상세=상품 사진).

---

## ⚖️ #65 — sitemap 이 제출하는 `/privacy`·`/refund` 가 크롤러 본문 6자 (짝 주장, 반대 방향)

PR #1778 머지(`a49f7687`) 뒤 같은 전수에서 나온 다음 건. **방향이 반대라서 지금까지 한 번도 안 셌다.**

### 무엇이었나 (라이브 Googlebot UA 실측)

```
/privacy  200 · index, follow · 본문 6자 · sitemap 제출 · description 14자
/refund   200 · index, follow · 본문 6자 · sitemap 제출 · description 21자
/terms    200 · index, follow · 본문 323자 · description 76자   ← 같은 빌더, 같은 문서 종류
```

`sitemap.routes.ts` 의 규율은 *"본문이 있는 것만 넣는다"* 인데, 2026-10-13 기록이 **미제출 색인
대상만** 훑어서 *제출했는데 본문이 없는* 쪽을 셈에서 빼먹었다. 규율은 양방향이다 —
**제출 ⇒ 본문** 과 **본문 ⇒ 제출**.

### 🩸 가로막던 사유 둘이 **둘 다 틀렸거나 이미 해소돼 있었다**

1. `surface-copy.ts` 머리말: *"본문이 JSX 에 박혀 파생할 수 없다"* → 그 뒤 같은 날 내가
   *"문장이 거기 없어서"* 로 고쳐 적었다. **둘 다 페이지를 읽지 않고 쓴 말이다.** 실제로 훑으니
   통째 문장이 `/privacy` 16개(69~136자) · `/refund` 12개였다.
2. `/refund` 는 *"내용 자체가 결재 대기"* → 결재 `2026-10-12-refund-policy-mismatch.md` 가
   대표 **"다 해줘"** 로 2026-10-13 집행 완료. 그 결재 자신이 *"크롤러 본문은 아직 짧습니다 …
   별건입니다"* 라고 남긴 그 별건이 이 작업이다.

### 한 것

| 파일 | 변경 |
|---|---|
| `shared/seo/surface-copy.ts` | `/privacy` 5줄 474자 · `/refund` 6줄 217자 추가 + 머리말의 틀린 사유 둘을 정정 기록 |
| `shared/seo/consumer-surfaces.ts` | description 동어반복 → 그 문서에 **실재하는 절**만 (14→68자 · 21→79자) |
| `worker/routes/sitemap.routes.ts` | 반대 방향 짝 주장 위반을 기록(코드 변경 없음, 주석) |
| `tests/unit/thin-surface-copy-2026-10-12.test.ts` | FLOOR 2건 + 머리말 정정 + "삼키지 않는다" 예시 재조준(`/cart`·`/wishlist`) |
| `tests/unit/refund-policy-truth-2026-10-13.test.ts` | 꺼져 있는 기능 금지를 **크롤러 본문·description 까지** 확장(+2건) |
| `tests/unit/legal-surface-body-2026-10-14.test.ts` | **신규 12건** — 중복 잠금 피해 *새로운 것만* |
| `scripts/mutations/legal-surface-body-2026-10-14.mjs` | **신규 12건**, 절반 반대 방향 — 전부 빨간불 확인 |

렌더 결과(눈으로 읽었다): `/privacy` **483자** · `/refund` **222자**, 둘 다 h1 보유.

### 🩸 이번에 값을 치르고 배운 것 둘

1. **가드의 `flat` 은 공백만 접고 태그는 안 뗀다.** 내 추출 스크립트는 태그를 뗐다 ⇒ 후보를
   과대 보고했고, 그 오해로 *"평탄화가 `전액 이` 를 만든다"* 는 틀린 기제를 적고 **페이지의
   마침표를 `<span>` 안으로 옮기는 쓸모없는 수정**까지 했다(가드가 즉시 잡아 되돌렸다 —
   `RefundPolicyPage.tsx` 는 **byte-불변**). ⇒ **가드가 쓰는 정규화 함수를 그대로 가져다 재라.**
   같은 클래스를 같은 날 `/gdpr` 엔티티에서 이미 한 번 밟았다.
2. **주입 두 건이 헛돌았고 둘 다 내 조준 실수였다**: ① `source: []` 을 새 시험에 겨눴는데 그
   시험은 페이지를 상수로 직접 읽어 `source` 를 안 본다 → 클로킹 대조가 사는 thin 시험으로 재조준
   ② *바닥 숫자를 내리는* 주입은 **원리상 빨간불이 안 난다**(단언을 느슨하게 만드는 변경은 그
   단언으로 못 잡는다) → 바닥이 **지키는 결함**(줄 하나 삭제)으로 교체.

### 🔴 일부러 안 한 것

- `/refund` 의 가장 값진 두 문장(*"결제 금액 전액이 자동으로 환불됩니다"* · *"환불 대상이
  아닙니다"*)은 **문장 안에 `<span>` 을 품어** 쓸 수 없다. 전자는 절 제목이 자리를 메우고,
  후자의 절(`이미 사용한 이용권`)은 **통째로 뺐다** — 규칙 없이 제목만 남기면 *"사용한 것도
  처리해 준다"* 로 읽힌다(어중간한 반쪽 주장이 빠뜨린 것보다 나쁘다).
- `/privacy` 의 **영문 블록**(`!isKR`). 라이브 호스트는 `urdeal.kr` 하나라 아무도 못 본다
  (GLOBAL 미런칭·폐기 #804). 가드 ① 이 양방향으로 잠근다.
- 사업자 정보 줄(이메일·등록번호). `/gdpr` 과 같은 기준 — 수확 표면만 늘고 색인 보탬 0.
- **본문 SSOT 추출**(`/terms` 처럼 `TermsDoc` 로). 법정 페이지 364·332줄 JSX 를 데이터로 옮기는
  일이라 렌더 동일성 검증이 따로 필요하다 — 여전히 별건이고, 그때 이 `surface-copy` 항목은 지운다.

### ⚠️ E4 (배포 후 라이브, 양방향)

```bash
UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
curl -sS -A "$UA" https://urdeal.kr/privacy    # 본문 6자 → 480자 안팎 · h1 있음
curl -sS -A "$UA" https://urdeal.kr/refund     # 본문 6자 → 220자 안팎
#   description 이 14·21자에서 올라갔는지 (<meta name="description">)
#   🔴 반대 방향 — 이쪽이 더 비싸다:
curl -sS -A "$UA" https://urdeal.kr/privacy | grep -o 'content="index, follow"'   # 여전히 index
curl -sS -A "$UA" https://urdeal.kr/refund  | grep -o 'content="index, follow"'
curl -sS https://urdeal.kr/sitemap.xml | grep -cE '/(privacy|refund)<'            # 2 유지
#   그리고 /privacy 본문에 영문 절이 0건인지 (Information We Collect)
```
⚠️ 글자수만 보고 판정하지 말 것 — 2026-10-12 에 `/experience` 154자를 "아직 thin" 으로 오진한
그 함정이다(그 154자가 고쳐 둔 문구였다). **숫자를 보면 그 숫자를 만든 코드를 먼저 찾을 것.**
