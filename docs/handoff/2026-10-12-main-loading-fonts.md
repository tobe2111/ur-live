# 2026-10-12 — 메인 로딩: 첫 페인트를 막던 **외부 폰트 CSS** (+ PR 둘 머지)

**[E2]** 코드·가드·빌드까지. **E4(라이브 판정)는 배포 후**이고 명령이 아래 §1 에 있다.

대표: *"모두 머지해주고, 메인페이지 로딩 속도 문제도 확인해줘 느려"*

---

## 1. 다음 세션의 첫 액션 — 배포 후 E4 (셋, 순서대로)

### ⓐ **1순위** — 들여온 CSS 가 제대로 서빙되는가
```bash
curl -sI https://urdeal.kr/static/fonts/pretendard-dynamic-subset-v1.3.9.css | grep -iE '^(HTTP|content-type|cache-control)'
```
기대: `200` · `content-type: text/css` · `cache-control: public, max-age=31536000, immutable`

🔴 **여기가 틀리면 Pretendard 가 통째로 폴백 폰트로 떨어진다**(화면은 뜨고 글꼴만 바뀐다 — 에러 0).
`/static/*` 은 `_routes.json` **exclude** 라 Pages 가 직접 서빙하는데, 이 폴더에 `.css` 를 둔 것은 처음이다
(기존엔 `.woff2` 만 있었고 `font/woff2` 로 정상이었다). MIME 이 틀리면 즉시 롤백(§5).

### ⓑ 효과가 실제로 났는가
```bash
PROXY_RELAY=1 BASE=https://urdeal.kr node scripts/probe-loading.mjs /
```
그리고 외부 호스트 목록에 **`fonts.googleapis.com` 이 없어야** 한다. 머지 전 기준선:
```
HTML→FCP   677ms (611·667·677·875 — 편차 264ms)   → 기대 337ms 안팎(편차 40ms대)
```
⚠️ **절대 ms 로 판정하지 말 것** — 이 컨테이너는 프록시 릴레이라 TTFB 가 부풀려진다(같은 라이브를
3회 재니 TTFB 가 1.63·1.73·0.57s 였다). 판정은 **HTML→FCP 델타**와 **편차**다.

### ⓒ 숫자 폰트도 캐시되는가
```bash
curl -sI https://urdeal.kr/static/fonts/roboto-digits-400.woff2 | grep -iE 'cache-control|cf-cache'
```
머지 전: `no-cache, no-store, must-revalidate` + `cf-cache-status: BYPASS`(= 매 요청이 오리진까지).

---

## 2. 완료분

| | |
|---|---|
| PR **#1710** 머지 | `42d5e02a` — 업로드 413 수리 + 🧨 도매몰 전면 철거(177파일) |
| PR **#1713** 머지 | `20cf8a3a` — 다른 세션의 로딩 묶음(sentry 431→129KB · ko 300→105KB · charts 388→7.7KB). **01:40 에 이미 머지돼 있었다** |
| 이 작업 | 아래 §3 (별도 PR) |

---

## 3. 무엇을 쟀고 무엇을 고쳤나

### 서버는 안 느렸다
```
워커 응답        71ms      Server-Timing: total;dur=71.0, kv;dur=10, edge;dur=11
X-SSR-Status     MAIN:kv-hit
풀스크린 로더     0회       ← 2026-10-08 서버 첫 화면이 제 일을 하고 있다
```

### 느린 것은 **HTML 도착 후 첫 페인트까지 677ms** 였다
같은 로드 안에서 비교하면 명백하다(아이폰13 에뮬, **preconnect 는 둘 다 이미 있었다**):

| 렌더를 막는 CSS | 출처 | 걸린 시간 |
|---|---|---|
| `index-*.css` **37KB** | 우리 오리진 | **92ms** |
| `pretendard…subset.min.css` 12KB | cdn.jsdelivr.net | **384ms** |
| Poppins `…&text=urdeal` **0.2KB** | fonts.googleapis.com | **382ms** |

🔑 **비용은 바이트가 아니라 외부 오리진의 왕복이다.** 0.2KB 가 37KB 보다 4배 걸렸다.

### A/B (각 4회 중위값 — 두 CSS 를 우리 오리진에 둔 것과 같게 즉시 응답)
```
A 현재          HTML→FCP 677ms   (611·667·677·875  편차 264ms)
B 자가호스팅     HTML→FCP 337ms   (328·329·337·370  편차  42ms)   Pretendard 적용 OK
                → 340ms(50%) 단축
```
**빨라진 것보다 편차가 264→42ms 로 준 게 더 중요하다** — 지금까지 매 접속이 남의 CDN 사정에 걸려 있었다.

### 수정 (링크 2줄 + 사본 1개 + 캐시 블록 1개)
- `public/static/fonts/pretendard-dynamic-subset-v1.3.9.css` — 들여온 사본. **`src` 92개를 jsdelivr
  절대주소로** 바꿨다(업스트림은 `url(../../../)` 상대경로 → 우리 오리진에 그대로 두면 **폰트 92개 전부 404**).
  🔒 **woff2 는 일부러 jsdelivr 에 남겼다** — 렌더를 안 막고(`swap`) preconnect 가 있고 1년 immutable 이다.
- `public/static/fonts/poppins-800-urdeal-v24.woff2` — **876바이트**. 그 외부 CSS 가 하는 일이
  `@font-face` 하나뿐이라 인라인 `<style>` 로 옮겼다. `unicode-range`(u·r·d·e·a·l)는 원본 그대로.
- `public/_headers` — `/static/fonts/*` 1년 immutable (§4 ②)

### 🩸 같은 자리에서 찾은 **거짓 주석 둘**
1. `index.html:409` 가 이 비용을 **"~50ms"** 라고 적어 뒀다. 실측 **384ms — 8배**. 2026-04-30 이후
   아무도 다시 재지 않았다. ⇒ **추정값을 주석에 적고 떠나지 말 것.**
2. `@font-face { font-family:'Pretendard Variable'; font-display:optional; ascent/descent-override }` 가
   **한 번도 적용된 적이 없다.** `@font-face` 는 `src` 가 없으면 **규칙 전체가 무효**다(라이브 실측:
   Pretendard face 들의 `display` 가 **전부 `swap`**, optional 0건). 주석이 약속한 *"swap 없음 → LCP
   영향 0"* 도, 줄 높이 튐을 막으려던 메트릭 오버라이드도 **둘 다 죽어 있었다.** 지워도 렌더는 1px 도
   안 바뀐다(이미 no-op). ⚠️ **되살리려면** `src` 를 가진 유효한 규칙이어야 하고 그러면 **줄 높이가 실제로
   바뀌어 앱 전체 레이아웃이 움직인다** → 별건으로 측정하고 들어갈 일이다.

---

## 4. 이번에 틀렸던 판단 / 밟은 함정

### ① 릴레이 수치로 자산별 ms 를 읽으려 했다
첫 측정을 `PROXY_RELAY=1`(모든 요청을 Node fetch 로 중계)로 했더니 자산 durations 가 전부
부풀려졌다(`app-routes` 832ms 등). **중계는 직렬이라 자산별 ms 가 의미 없다.** 직결(`proxy: {server: HTTPS_PROXY}`)로
바꿔서야 진짜 폭포가 나왔다. ⇒ **릴레이로 재도 되는 것은 순서·개수뿐이다.**

### ② `/static/fonts/*` 캐시 — 헤더는 확실하지만 클라 효과는 과장하지 말 것
`curl` 로 본 헤더(`no-store` + `cf-cache-status: BYPASS`)는 **확실하다**. 그런데 브라우저 재방문을
3회 재니 `1회차 26KB → 2회차 26KB → 3회차 0KB` 로 **일관되지 않았다**(2회차 전체 전송이 1회차보다
크게 나오기도 했다 — 측정 잡음). ⇒ 고치는 근거는 **"엣지가 BYPASS 라 매 요청이 오리진까지 온다"** 로
충분하고, "브라우저가 매번 재다운로드한다" 는 **단정하지 않았다**.

### ③ `index.html` 주석 닫기(`-->`)를 하나 흘렸다
②번 편집에서 `~50ms` 줄을 지우면서 그 줄 끝의 `-->` 까지 같이 지웠다. HTML 은 **깨지지 않고**
두 주석이 하나로 합쳐져 조용히 통과한다. 주석 균형 검사(`<!--` 28 / `-->` 28 + 중첩 0)로 잡았다.
⇒ **주석을 지울 때 그 줄이 블록을 닫고 있는지 보라.**

### ④ 기존 가드·주입이 내 변경에 낡았다 — 지우지 않고 재조준
2026-09-21 의 *"로고 폰트는 swap, optional 아님"* 이 `…&display=swap` **URL 쿼리**를 앵커로 쓰고 있었고
그 URL 자체가 사라졌다. 지키려던 것은 그대로이므로 앵커만 `@font-face` 의 `font-display` 로 옮겼다
(그 측정표와 결론은 한 글자도 안 건드렸다). 주입도 같은 이유로 재조준.

### ⑤ #1713 을 머지하려는데 이미 머지돼 있었다
`state: closed` 를 보고 "닫힌 건가?" 했는데 `merged: True`(01:40, `tobe2111`)였다.
⇒ **`state` 만 보면 안 되고 `merged` 를 봐야 한다.**

---

## 5. 롤백

```
index.html  href → https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css
index.html  Poppins <link rel="stylesheet"> 복원 (fonts.googleapis.com/css2?family=Poppins:wght@800&text=urdeal&display=swap)
```
그때 `self-hosted-fonts-2026-10-12.test.ts` 가 빨간불이 되므로 **함께 판단할 것**.
`_headers` 블록은 롤백 대상이 아니다(그건 별건 수리이고 되돌리면 캐시가 다시 꺼진다).

---

## 6. 남은 것 — **대표 판단 대기**

### ① 첫 화면 아래 작업을 미룰까 (실측 완료, 대표가 "미루면 어떻게 되는데?" 물어 답했고 아직 결정 전)
CPU ×4(실제 폰 모사), 3회 중위값:
```
A 현재                   FCP후 longtask 3,522ms(17건)   메인쓰레드 바쁨끝 +7.4s
B 쇼츠 썸네일 차단         2,875ms(14건)                         +6.7s   → 647ms 줄음
C 쇼츠+카드prefetch 차단   2,492ms(14건)                         +6.4s   → 1,030ms 줄음
```
- **첫 페인트는 안 바뀐다**(1,101 ↔ 1,215ms = 측정 편차 수준).
- 얻는 것은 **"화면은 떴는데 스크롤·탭이 안 먹는 시간"이 1초 줄는 것**이다.
- 🟢 **유어쇼츠 썸네일 10개(149KB, +3.2s)는 미루는 비용이 없다** — 첫 화면 밖이라 보일 때 받으면 된다
  (`IntersectionObserver` — `RestaurantMiniMap` 의 `shouldLoadSdk` 가 같은 처방의 선례).
- 🟡 **카드 prefetch 4건 + `GroupBuyDetailPage` 청크(+2.6s)는 비용이 있다** — "클릭 시 0ms" 가 목적이라
  더 미루면 그 이득이 줄 수 있다. 잠금표가 지키는 항목이기도 하다(`rootMargin:'100px'`·viewport prefetch).

### ② 쓰이지 않게 된 preconnect 둘 (`fonts.googleapis.com` · `fonts.gstatic.com`)
Poppins 를 자가호스팅했으니 **아무도 안 쓴다.** 그런데 **잠금표가 preconnect 제거를 금지**해서 남겼다.
쓰이지 않는 preconnect 는 연결 슬롯 하나 + DNS+TLS 를 공짜로 태우고 Lighthouse 가 "사용 안 함" 으로
경고한다(2026-05-27 에 정확히 그 이유로 14→3 으로 줄인 전례가 있다). **떼는 것은 대표 판단.**

### ③ 측정 기준점이 바뀐다
위 전송량(**1,716KB / 123 요청** — JS 602 · 이미지 644 · 폰트 408 · CSS 50KB)은 **#1713 이전** 라이브 값이다.
#1713 이 배포되면 sentry·번역·차트가 줄어 숫자가 달라진다. 다시 잴 때 그 사실을 섞지 말 것.

### ④ 앞 세션에서 넘어온 미결 (그대로 대기)
`role='wholesale'` 어드민 4개 · `utongstart.com` 도메인 · `ur-wholesale` Pages 프로젝트 ·
🏪 공구 서비스 존치 여부(측정 결과 **존치 권고**) · 업로드 한도 결재(`docs/decisions/2026-10-11-upload-body-limit.md`).

### ⑤ 미착수 (실측만 해 둔 것)
`i18n` · `axios` · `app-routes` 청크(CLAUDE.md 잠금표 주석의 그 항목들) — 이번 범위 밖.
**`PcHomePage` 와 `MobileHomePage` 가 둘 다 modulepreload 된다**(각 4.7·2.2KB). 폰이 PC 홈 청크를,
PC 가 폰 홈 청크를 함께 받는다. 작지만 `route-chunk-map` 이 둘을 같은 표면으로 보는 탓이다.

---

## 7. 같은 세션에서 추가로 처리한 것 (2026-10-12 후반)

### ① 이용권 상세 **C안** (대표 확정, 커밋 `c73bcee7`)
대표 *"왜 사진을 가리고 있고, 더 투박해졌지?"* → 시안 A·B·C → **"C가 낫네 차라리"**.
`PASS_HEAD.card` 에서 `-mt-7`(겹침 28px)·판(`bg`·`shadow-lift`·`rounded-2xl`) 제거 + `아껴요` 상자 제거.
워커 SSR 이 같은 문자열을 import 하므로 서버 첫 화면도 자동으로 따라간다.
가드 +2 / 주입 +3(빨간불 확인).

### ② 🔴 "밍밍하다" 의 진짜 원인 — **디자인이 아니라 콘텐츠가 0이다** (실측)
대표 *"아무튼 뭔가 너무 밍밍해, 상세페이지가"*. 라이브 `/pass/2915` 전수:
```
문서 높이 1,793px (2.1 화면)      본문 글자수 422자 (대부분 UI 문구)
description      = 제목과 똑같은 글자
long_description = null      ← 상세 설명 0
voucher_terms    = null      ← 유의사항 0 (DEFAULT_TERMS 2줄 폴백만)
detail_images    = []        ← 상세 사진 0장
images           = 1장 (히어로와 동일)
```
**이 상품만이 아니다** — 샘플 6/6 전부 `long_description`·`voucher_terms`·`detail_images` 가 비었고,
활성 이용권 **50건 중 43건이 사진 1장 이하**. `seller_id` 가 붙은 실매장 상품은 **2건**뿐.
⇒ **어떤 디자인도 이 데이터로는 두 화면을 못 채운다.** 근본 처방은 상품 등록에서 설명·사진·유의사항을
받는 것이고 그건 운영/기획 결정이다(대표 판단 대기).

🩸 **이 과정에서 결함을 하나 잘못 신고할 뻔했다**: 본문 덤프에 "유의사항" 뒤가 비어 있어 *빈 섹션*이라고
판단했는데, `<details>` 가 접혀 있어 `innerText` 가 summary 만 준 것이었고 `DEFAULT_TERMS` 폴백도 있다.
**접힌 요소는 텍스트 덤프에 안 나온다 — 덤프의 공백을 결함으로 읽지 말 것.**

### ③ 🟡 딜 결제가 느린 이유 (측정만 · **고치지 않았다** — 머니 경로)
대표 *"이용권 결제하는데 시간이 왜이리 많이 걸리지? 특히 딜로만 결제를 하는건데도"*.
`POST /api/group-buy/join/:id` 정적 분석:
```
동기 await 107개 / waitUntil 안 5개
행복 경로(딜 전용)만 세어도 D1 을 차례로 ~20번 왕복한다
```
- ✅ **무죄로 확인된 것**: `ensureTables`(waitUntil) · `ensureOrdersForeignKeysSane`(WeakSet 메모이즈) ·
  `ensureDealBuckets`(메모이즈) · KT-Alpha 발송·알림톡(둘 다 waitUntil). 외부 HTTP 는 이미 다 미뤘다.
- 🔴 **남은 것은 "한 번에 큰 것" 이 아니라 직렬 왕복 누적**이다. 묶을 수 있어 보이는 자리:
  `getSupplyMeta`·`checkPerPersonLimit`·`checkFcfsPurchasable`(서로 독립 읽기 → `Promise.all`) ·
  `isVoucherDealPaymentAllowed`+`isSelfOwnedGroupBuy`(product 뒤 병렬) ·
  `blocked`+`sellerRow`(병렬) · `UPDATE commission`+`recordLedger`(batch) ·
  `creditBrokerShare`(멱등이면 waitUntil 후보).
- ⚠️ **결제 경로 = 머니 경로 = 등급 C.** 단독 세션 + staging 실결제 없이는 손대지 않는다. 그래서 이 세션은
  **재기만 했다.** 다음 세션은 먼저 `Server-Timing` 을 이 엔드포인트에 붙여 **추정이 아니라 실측**으로
  어느 왕복이 비싼지 보고 들어갈 것(정적 카운트는 "몇 번" 만 말하고 "몇 ms" 는 말하지 않는다).

### ④ 📱 앱 설치 유도 오버레이 — **지금은 안 함** (대표 "다음에")
대표가 리뷰노트 시안을 보내며 *"다음에 앱 개발이 된다면 … 지금은 아니긴 한데 다음에 말이야."*
기록만 했다 → `docs/design/app-ready-audit-2026-07.md` 맨 아래 + 시안
`docs/design/assets/reviewnote-app-interstitial-ref.jpg`. **전제: 스토어 앱이 실제로 있어야 한다.**
그리고 이미 설치 유도가 둘 있다(`PWAInstallPrompt`·`AddToHomeHint`) — 만들기 전에 대체인지 추가인지 정할 것.

---

## ⑤ 🎫 홈 상단 배너 2:1 + 홈 패널 테마 추종 (대표 확정 — 이 세션 마지막 작업)

대표 지시가 넷 겹쳤다: *"인기 이용권 위에 배너"* → 시안 → *"이정도 배너 퀄리티는 되어야"*(NOL) →
*"디자인은 E … 밑에 인기 이용권이랑 되게 따로 노는 느낌"*(리뷰노트) → *"가득 찼다 여백은 좀"* +
*"좌우로 넘기는 거 자연스럽고 부드럽게"* → *"숫자가 이렇게 들어가는거야"* → **"2로 가자"**.

### 무엇이 바뀌었나
| | 전 | 후 |
|---|---|---|
| 배너 틀 | 96px 띠 · 전폭 · 모서리 16 | **2:1**(폰 362×181) · 거터 14 · 모서리 14 |
| 넘김 | 74% + 다음 장 미리보기 | 한 장씩 꽉 + `scroll-snap`(스와이프 네이티브) |
| 장수 표시 | 아래 **점 줄** | 배너 **안** 오른쪽 아래 `1 / 3` **누를 수 있는** 알약 |
| 항목 간격 | `gap-3`(12) | **`gap-7`(28 = 거터×2)** |
| 홈 패널 | `light-island` + `#fff` 하드코딩 | `var(--surface)` — **테마 추종** |

### 값이 왜 그 값인가 (임의값 0 — 전부 실측·파생)
- **거터 14 · 모서리 14** = `.ur-home-panel` 모바일 값. *"따로 논다"* 의 원인은 크기가 아니라 **리듬**이었다
  (패널은 거터 14·모서리 14 인데 배너만 전폭·모서리 16). 가드가 **CSS 에서 읽어** 대조한다 — 손으로 안 적는다.
- **`gap-7`(28) = 거터×2** 🩸 처음 `gap-3`(12)로 뒀더니 **다음 장이 오른쪽 거터 안으로 2px 삐져나왔다**
  (실측: 카드 14..376 · 다음 장 388 · 화면 390). 간격이 거터 두 벌이면 다음 장이 정확히 화면 밖(404)에서
  시작해 *"한 장씩 꽉"* 이 글자 그대로 성립한다. `STRIP_GAP_PX` 상수도 28 로 **같이** 옮겼다(가드가 둘을 대조).
- **알약 `right-[26px] bottom-3`** = 거터 14 + 안쪽 12. 왼쪽 아래는 `자세히 보기` 자리다.

### 🩸 이 작업에서 실제로 밟은 것 (다음 세션이 다시 밟지 말 것)
1. **`w-[calc(100%-1.75rem)]` → 거터가 두 번 빠진다.** 스크롤러가 이미 `px-3.5` 를 갖고 있어 `100%` 가
   362 다. 실측 334px · 다음 장 42px 삐져나옴 → **`w-full` 이 맞다.**
2. **`gap-2`→`gap-3` 로 바꾸고 `STRIP_GAP_PX = 8` 을 안 고쳤다** — 점/숫자가 손가락과 어긋난다.
   **가드가 그걸 잡았다**(그 가드가 이 커밋에서 값을 번 자리).
3. **가드가 두 번 헛돌았다**: ① `toContain('px-3.5')` 가 `scroll-px-3.5` 안의 **부분일치**로 통과
   ② 경계를 줘도 카드 안 `자세히 보기` 버튼의 `px-3.5` 에 걸려 통과. ⇒ **범위를 스크롤러 className 한
   줄로 좁혀야** 판정이 된다. RAIL 전체를 보는 한 어딘가의 같은 글자에 늘 걸린다.
4. **내가 쓴 주석이 내 단언을 깨뜨렸다** — 설명 주석이 `w-[calc(100%-…)]` 를 **예시로 인용**하고 있어서
   원문을 보면 코드가 멀쩡해도 빨간불. `codeOnly()`(주석 제거본)로 봐야 한다.
5. **React 재렌더가 DOM 주입 시안을 지운다** — 시안 비교는 DOM 삽입 말고 **CSS `::after`** 로.

### 숫자 알약은 **누를 수 있어야 한다** (불변식)
점이 갖고 있던 조작을 잃지 않는다. 숫자만 두고 탭을 빼면 **스와이프를 모르는 사람에게 둘째 장이 영원히
안 보인다.** 가드가 `<button>` + `goTo((active+1) % n)` 배선 + `absolute right-` + 포함 블록(`relative`)
넷을 함께 못 박는다. 자동 재생은 **여전히 안 한다**(첫 화면에서 저절로 움직이면 읽기를 방해한다).

### 홈 패널 테마 추종 — 2026-09-02 확정 "안 A" 를 **대체**한다
대표 *"다크모드에선 흰배경, 화이트모드에선 다크배경으로 되어있는 것 같은데 그걸 한번 없앤 상태"*.
`.ur-home-panel` 의 `background: #fff` → `var(--surface)`, 모바일·PC 둘 다 `light-island` 제거.
⚠️ **`light-island` 는 `--surface` 를 `#FFFFFF` 로 되박으므로** 토큰만 고치고 섬을 남기면 다크에서
흰 판이 그대로다 — 둘은 쌍이다(주입 2건이 양쪽을 고정).
⚠️ **PC 는 대표에게 안 보여주고 같이 바꿨다** — 같은 CSS 한 줄이라 쪼개면 PC 만 흰 판으로 남는다.
마음에 안 들면 `PcHomePage.tsx` 에 `light-island` 를 도로 붙이면 PC 만 되돌아간다.

### 검증
tsc 0 · build 0 · 유닛 27건(배너 23 + 패널 4) pass · 주입 **10건 전부 빨간불 확인**
(`--only='🎫2:1'` 7 · `--only='🌓'` 3) · 낡은 앵커 0(3,033건) ·
390×844 라이트/다크 렌더 실측 `카드 14×148×362×181` · `알약 322×291×42×26` · 탭 → `2 / 3` · `scrollLeft 390`.

### 대표 판단 대기
- **배너 실제 콘텐츠** — 지금 라이브 strip 배너는 **0장**이라 아무것도 안 뜬다(등록해야 보인다).
- **섹션 상품 고르기** — 제목은 `이런 이용권은 어떠세요?` 로 **이미 라이브 반영**(어드민 API).
  상품은 아직 `source: 'popular'`(많이 팔린 순 자동). 손으로 고르려면 `/admin/home-sections` 에서
  `source: 'manual'` 로 바꾸고 상품을 담으면 된다 — **화면 코드 변경 없이** 바로 바뀐다.
- **PC 패널 다크**(위 ⚠️).

---

## ⑥ ⏱️ 로딩 실측 2차 — 유어쇼츠 · 페이지별 (대표 *"유어쇼츠가 늦게 … 빠른게 좋은거지"*)

### 라이브 실측 (urdeal.kr · iPhone 13 에뮬 · 프록시 경유라 **절대 ms 는 부풀려져 있다**, 비교용)
```
경로          FCP    풀스크린 로더      본문 도착
/            1652   1회 400ms         2814
/vouchers     980   1회 750ms         1837
/browse       756   1회 250ms         1203
/map         1008   1회 800ms         2058
/my-vouchers  620   2회 150ms         1130
/user/profile 612   1회 150ms         1157
/urshorts     704   1회 1200ms        1996   ← 로더가 가장 길다
/blog         848   1회 550ms          828
```
**모든 페이지가 같은 모양이다**: HTML 500~800ms → **아무 일도 안 일어나는 1,000~1,200ms** → 데이터.
그 공백이 JS 다(홈 기준 script 40개 1,404KB decoded, 마지막 도착 1,981ms). 즉 **유어쇼츠만의 문제가 아니다.**

### 유어쇼츠가 늦는 이유 — 셋으로 쪼개진다
```
React 마운트 ~1,700ms → /api/urshorts(콜드 콜로 478ms / 따뜻하면 99ms) → 레일 DOM 2,455ms → 썸네일 2,618ms
```
1. 🔴 **썸네일이 `/api/image/resize`(워커 프록시)로 가고 있었다.** 그 경로는 **리사이즈를 못 한다**
   (2026-06-11 실측). 125×222 카드에 `hqdefault.jpg` **30,801B** × 10장 = 308KB.
   cdn-cgi 로 w=250 요청 시 `cf-resized: internal=ok` · **7,361B**(4.2×). `i.ytimg.com`·`mqdefault` 도 동일 확인.
   ⇒ `CDN_CGI_VERIFIED` 승격. 🩸 **처음에 엉뚱한 목록에 넣었다** — 이 파일엔 비슷한 이름이 둘이고
   (모듈 스코프 `EXTERNAL_PROXY_HOSTS` / **함수 안의 `CDN_CGI_VERIFIED` 배열**) 경로를 정하는 건 뒤쪽이다.
   앞쪽만 고치면 **빌드도 테스트도 초록인 채 여전히 프록시로 간다.** 가드가 둘 다 본다.
2. `/api/urshorts` 가 예열 밖 → 콜드 콜로 478ms. `edgeCache(300)` 은 이미 있었다. HOT_PATHS 추가.
3. 마운트 시점 자체(~1.7s)는 아래 ⑦ 의 문제다. **SSR 시드로 당기는 것은 일부러 안 했다** —
   레일은 첫 화면 **아래**인데 시드를 하나 더 넣으면 워커 self-fetch 가 늘어 **첫 화면 HTML 이 늦어진다**.

### ⑦ 🔴 `requestIdleCallback` 은 "콘텐츠가 뜬 뒤" 가 아니다 (이번 세션 최대 발견)
`main.tsx` 는 센트리를 `ric(..., {timeout:5000})` 로 미루며 *"FCP/LCP 후 5초"* 를 의도했다.
**ric 은 메인스레드가 잠깐이라도 한가하면 부른다** — 부팅 중엔 네트워크를 기다리느라 한가한 구간이 계속 생긴다.
```
/vouchers 라이브 — 센트리 envelope POST 1,004ms   vs   화면 본문 도착 1,151ms   ← 데이터보다 먼저 떴다
로컬 4× CPU 스로틀 longtask 합계 (센트리 유무)
  /vouchers  1,741ms → 389ms      /urshorts  1,569ms → 440ms      /  4,579ms → 3,430ms
```
⇒ `load` 이벤트 뒤 + idle 로 옮겼다(백스톱 12s). **일의 총량은 그대로이고 기다리는 창 밖으로 옮긴 것**이다.
🔒 전제: 맨 위 `installErrorTelemetry()` 가 `window.onerror`·`unhandledrejection` 을 센트리와 **무관하게**
처음부터 잡는다 — 그래서 미뤄도 초기 에러에 구멍이 안 난다(가드가 그 순서를 고정).

### ⑧ `/api/side-banners` — 캐시 헤더가 **하나도 없었다**
소비자 전 페이지가 여는 주소인데 매번 콜드 D1 **388ms**, 게다가 핸들러가 요청마다
`CREATE TABLE IF NOT EXISTS` 를 돈다(왕복 2회 — CLAUDE.md 가 금지하는 per-request DDL).
⇒ `edgeCache(600)`. ⚠️ 배너 변경이 최대 10분 늦게 반영된다(어드민 편성은 드물어 수용).
`/api/consumer-settings`(368ms)도 함께 예열.

### 🩸 측정에서 두 번 틀렸다
1. 첫 A/B 에서 *"센트리를 막으면 시간이 절반"* 이라고 읽었다(1639→708). **그 통제가 잘못됐다** —
   `abort()` 는 CPU 뿐 아니라 요청 자체를 없애고, 더 나쁜 건 import 거절이 연쇄해 `/vouchers` 가
   **아예 본문에 도달하지 못했다**(9999). 3초 **지연**으로 다시 재니 차이가 노이즈(±600ms) 안이었다.
   ⇒ **차단과 지연은 다른 실험이다.** 주장은 longtask(메인스레드) 쪽만 남겼다.
2. 프록시 경유 wall-clock 은 같은 설정에서 901~2125ms 로 흔들린다. **400ms 미만 차이는 말하지 말 것.**

### 아직 안 한 것 (다음 후보 — 숫자만 적어 둔다)
- **Pretendard 한글 서브셋 15개 · 383KB 가 jsdelivr(제3자)에서 1,687~2,110ms 에 내려온다.**
  차단 A/B 로는 본문 도착이 거의 안 변했다(노이즈 안) — **바이트는 크지만 체감 경로는 아니다.**
  자체 호스팅하면 같은 커넥션·우리 캐시가 되지만 woff2 290개 벤더링이 필요하다(별건).
- **홈 script 40개 1,404KB.** `app-components 150KB` · `locale-ko 102KB` · `lucide 54KB` ·
  `app-routes 52KB` · `validation 52KB`. 첫 페인트 폐쇄를 다시 떠서 줄일 여지(2026-09-02 선례).
- `/urshorts` 로더 1,200ms — 이 페이지는 SSR 첫 화면이 없다(홈·상세·유어샵·교환권엔 있다).
