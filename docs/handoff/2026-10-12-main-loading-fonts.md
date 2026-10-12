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
