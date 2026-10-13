# 2026-10-12 — 처음 오는 기기의 로딩: CSS 먼저 → 스크립트 (+ 셸 부품 4종 조건부 마운트)

**[E2]** 코드·가드·빌드까지. **E4 는 배포 후 라이브 실측**(§1).

대표: *"페이지들 로딩이 너무 느려 특히 처음 접속하는 디바이스 유저는"* · *"첫 로딩이 중요해. 이용권 사진들도
너무 늦게 뜨고"* · *"가장 이상적으로"* · *"대기업 수준이어야 해. 속도"* → 잠금 해제 `AskUserQuestion` 승인 "허가 — 진행".

## 1. 다음 세션의 첫 액션 — 배포 후 E4
```bash
# ① 폰 UA 홈에 부팅 스크립트·지연 rel 이 붙었나 (없으면 미배포)
curl -s -A 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' https://urdeal.kr/ | grep -c 'ur-modulepreload\|type="ur-module"'
# ② PC UA·/vouchers 목록엔 안 붙어야 한다
curl -s -A 'Mozilla/5.0 (Windows NT 10.0) Chrome/126' https://urdeal.kr/ | grep -c 'ur-module'   # 기대 0
# ③ 앱이 실제로 뜨는가 — 브라우저(아이폰13 에뮬)로 / · /pass/2919 · /u/jiwon1228 열어 하단 탭이 생기는지
```
그리고 측정기(§4)로 라이브를 다시 녹화해 base 와 비교. 🔴 **앱이 안 뜨면 즉시 롤백**: `cssFirstApplies` 가 `false` 를 돌려주게(한 줄) — 부팅 스크립트가 유일한 부팅 경로다.

## 2. 무엇을 쟀나 (라이브 응답 녹화 → 이 컴퓨터 안에서 재생, 느린 4G 150ms/1.6Mbps · CPU 4배, 5회 중간값)
| | 지금 사진(LCP) | 적용 후 | 지금 조작가능 | 적용 후 |
|---|---|---|---|---|
| 홈 | 3.65s | **1.90s** | 5.0s | 6.4s |
| 이용권 상세 | 3.30s | **1.27s** | 4.5s | 5.1s |
| 유어샵 | 4.74s | **1.24s** | 4.6s | 5.6s |
원인: HTML 직후 **CSS(렌더 차단 33KB)·modulepreload 20여 개·사진 preload 4장이 동시 출발**해 느린 회선을 나눠 썼다. CSS 가 2.5초에야 끝나 이미 받은 사진이 못 그려졌다.

## 3. 이번에 틀렸던 판단 (같은 오진 반복 방지)
- **사진·폰트가 범인인 줄 알았다** — 사진 preload 제거/우선순위 낮춤, 3x→2x, 폰트 미루기/제거 **전부 오차 안**. 병목은 동시 출발이었다.
- **"조작 가능 0.3~0.4초 늦어짐"이라고 대표에게 먼저 말했는데 틀렸다** — 측정기를 고친 뒤 재니 0.6~1.4초였다. 정정 보고함.
- **프록시 경유 실측은 판정에 못 쓴다** — 같은 조건 '다 받음'이 5.8~10.4초로 흔들렸다. 녹화-재생 측정기(§4)로 바꾸고 나서야 판정이 됐다.
- 폰트를 앱 마운트 뒤로 미뤄도 조작가능은 안 줄었다 — 그 구간은 회선이 아니라 **폰 CPU**(4배 스로틀에서 JS 실행)다.

## 4. 측정기 (스크래치 — 레포에 안 넣음, 필요하면 재작성)
녹화: playwright 로 `ctx.route` 릴레이해 모든 응답을 파일로 저장 → 재생: Node `http2.createSecureServer`(자체서명) 를 모든 호스트로
매핑(`--host-resolver-rules=MAP * 127.0.0.1:8443`, **`--no-proxy-server` 필수** — 없으면 크롬이 HTTPS_PROXY 를 타 `ERR_RESPONSE_HEADERS_TRUNCATED`),
CDP `emulateNetworkConditions`+`setCPUThrottlingRate 4`. 헤더는 content-type/cache-control 만 남길 것.

## 5. 남은 것 / 대표 판단
- **조작가능이 0.6~1.4초 늦어지는 대가** — 대표 승인한 교환. 그 사이 첫 화면 카드는 진짜 `<a>` 라 탭하면 이동은 된다.
- 다음 레버(미착수): **부팅 JS 의 CPU 비용**(엔트리 정적 그래프 ~800KB 해석) · 교환권 목록·지도는 서버 첫 화면이 없어 이 처방이 안 맞는다(서버 첫 화면을 그리는 게 다음 수).
- **CSS 를 HTML 에 인라인**하는 안도 쟀다: 조작가능 손해 0(오히려 빠름)이지만 사진 개선이 작다(홈 3.65→2.25, 상세는 악화). 재방문 HTML 이 33KB 늘어난다.
- Notion 개발 로그: 머지 후 기록할 것(이 세션 미기록).

## 6. 후속 (같은 PR) — 대표 *"마트 새 폰으로 첫 페이지가 10초"*
- **재현 실패를 먼저 적는다**: 녹화-재생으로 "좋은 회선 + 먼 서버(왕복 0.2초)" 를 재면 홈이 **1.0초**에 뜬다. 10초는 이 측정기가 모델링하지 않는 것(DNS·TLS 연결 수립 · 한국 콜로가 차가움 · 이미지 리사이저 첫 요청 · 예기치 않은 reload) 쪽이다.
- **실사용자 표본**(`GET /api/analytics/summary?day=`, 어드민 토큰): 2026-10-12 홈 LCP p50 2.6 / p75 3.7 / p95 5.6s · TTFB p50 0.45s(워커 자체 0.07s) · `/map` LCP p75 **10.4s**.
- ⚠️ 그 TTFB 는 `responseStart - requestStart` 라 **DNS·연결·TLS 가 빠져 있었다** — 새 기기에서 가장 비싼 부분이 계측 밖이었다.
- 그래서 추가: ① 워커가 HTML 에 `Server-Timing: colo;desc="XXX"` ② 클라가 `CONN`(= connectEnd) 과 `TTFB@colo:XXX` 표본을 보낸다 ③ `Link: rel=preload as=style`(앱 CSS + 폰트 CSS — Early Hints 103 원천, 생성기가 `ENTRY_CSS` 를 낸다).
- **다음 세션 첫 액션(배포 + 하루 뒤)**: `summary` 에서 `vitals:<day>:TTFB:colo:*` 키를 보면 한국 사용자가 어느 데이터센터로 붙는지 나온다. `ICN` 이 아니면 요금제/라우팅 비교표를 결재함에 올릴 것(대표 판단).
- **Cloudflare 존 설정(실측, 무료 플랜)**: http3 on · tls1.3 on · brotli on · **early_hints off · 0rtt off** → 대표가 켜기로 함(2026-10-12). 세션은 켜지 않는다(조회 전용 규율).
- 기각(실측 효과 없음): locale-ko·app-utils-deferred 선행 preload · 폰트를 앱 마운트 뒤로. 조작가능 시간은 **폰 CPU**(엔트리 정적 그래프 해석)가 정한다 — 다음 레버는 부팅 JS 다이어트.
- KV 쓰기: vitals 표본이 페이지뷰당 2건 늘어난다(표본율 0.25, 현재 하루 ~100건 → 무료 1천 한도 안).

## 7. 후속 (같은 PR) — 지도(`/map`) LCP p75 10.4s 의 근본 원인
- **원인(재생 실측)**: 가장 큰 그림 = 카카오 지도 타일. 그 앞이 전부 직렬 — 앱 부팅 → 지도 청크 → `sdk.js`(5.2s) → `kakao.js` → 타일(7.9s~). LCP 12.2s.
- **처방**: `index.html` `<head>` 맨 앞 인라인 스크립트가 `/map` 에서만 `sdk.js` 를 0.25s 에 출발시킨다(`window.__urKakaoMaps`) → `ensureKakaoMaps` 가 이어받음. 실패하면 자기 태그를 지우고 정상 경로로.
- **결과**: LCP 12.2 → 11.0s(3회 중간값). `kakao.js` 는 2.7s 에 끝나지만 **타일 12장 × ~58KB(2x HD) ≈ 700KB** 가 1.6Mbps 에서 5초를 먹는다 — 이게 남은 병목.
- **남은 판단(대표)**: `kakao.maps.disableHD()` — 타일 용량 약 4분의 1(추정 −3초대)이지만 레티나에서 지도 글자가 흐려진다. 화질 교환이라 세션이 정하지 않는다.
- 측정 주의: 재생 하네스 `replay3.mjs` 의 LCP 관찰자가 `for` 밖에서 `e` 를 읽어 **요소를 못 찍고 있었다**(고침). 6초 창은 타일이 끝나기 전에 잘려 LCP 가 **짧게** 나온다 — 지도는 `WAIT=16000` 으로 잴 것.

## 8. 후속 (같은 PR) — 첫 방문 폰트 420KB 를 앱 뒤로
- **원인**: 홈 첫 방문에서 Pretendard woff2 **17개 · 약 420KB** 가 최우선순위(VeryHigh)로 앱 스크립트와 회선을 다툰다.
- 🩸 **이전 판단 정정**: §2 의 "웹폰트 미루기/제거 → 오차 안" 은 **측정기 오류**였다. 제거 정규식이 `<link\n rel=… href=…>`(속성 여러 줄)과 안 맞아 폰트가 그대로 받아졌다. 고친 뒤 재니 폰트 제거만으로 조작 가능 6.1→4.3s.
- **처방**: 표식(`ur_font_warm`) 없는 첫 방문은 시트를 `media=print` 로 꺼 두고 load+idle(백스톱 12초)에 켠다. 재방문은 종전 그대로.
- **실측**: 조작 가능 홈 6.0→4.5 · 상세 4.9→3.9 · 교환권 3.9→3.5s, 첫 페인트 불변.
- **E4(배포 후)**: 새 시크릿 창으로 홈 → 처음엔 시스템 글꼴, 몇 초 뒤 Pretendard. 새로고침하면 처음부터 Pretendard. DevTools 네트워크에서 첫 방문의 jsdelivr woff2 가 load 이후에 시작하는지.
- **측정기 교훈**: xform 은 **적용 안 되면 던지게** 쓸 것(xforms11 `fontlazy` 가 그렇게 짜여 있다).

## 9. 후속 — 자가호스팅 폰트 캐시가 **실제로는 꺼져 있었다** (라이브 실측)
- `curl -sI https://urdeal.kr/static/fonts/roboto-digits-400.woff2` → `Cache-Control: no-cache, no-store, must-revalidate, public, max-age=31536000, immutable` + `Pragma: no-cache` + `Expires: 0` · `cf-cache-status: BYPASS`.
- 원인: `/static/*` 는 `_routes.json` 에서 워커 제외 → Pages 가 `_headers` 를 적용하는데 **맞는 규칙의 헤더를 합친다**. 맨 위 `/*` 의 no-store 가 이긴다. (`/assets/*` 는 워커가 서빙해서 멀쩡했다.)
- 처방: `/static/fonts/*`·`/manifest.webmanifest`·`/.well-known/*` 블록에 `! Cache-Control` / `! Pragma` / `! Expires` 로 떼고 다시 단다.
- **E4(배포 후 1분)**: 위 curl 이 `public, max-age=31536000, immutable` **하나만** 내고, 두 번째 요청에 `cf-cache-status: HIT`.
- 🩸 같은 날 앞 세션의 audit log(`_headers` immutable 추가)는 라이브에서 **효과가 없었다** — 헤더 파일이 바뀌었는지가 아니라 응답 헤더를 재야 판정된다.
- ⚠️ 이 환경에서 `! Header` 문법을 프리뷰로 확인하지 못했다(`*.pages.dev` 차단). 배포 후 curl 이 유일한 판정.

## 10. 후속 — 상세·유어샵 첫 응답의 콜드 D1 대기 (대표 승인 "허가 — 진행")
- 실측: `/pass/2919` 첫 요청 `self;dur=418` · `/u/jiwon1228` `self;dur=552` → 두 번째 28~37ms. 엣지 TTL 120~300s 가 지나면 다시 콜드.
- 처방: `ssr-payload.ts` 에 직전 사본(1시간, Cache API) 계층 — 엣지 miss 면 사본을 바로 쓰고 응답 뒤 새로고침.
- **E4**: `curl -sI -A '<iPhone UA>' https://urdeal.kr/pass/2919` 를 3분 간격 두 번 → 두 번째 `X-SSR-Status: DETAIL:stale-hit` + `Server-Timing` 에 `self;` 없음. 실사용자 TTFB 중앙값(`/api/analytics/summary`)이 0.45s 에서 내려가는지(하루 뒤).
- 같은 세션의 다른 수: 첫 렌더 CPU(`formatNumber` 포매터 캐시 · 비로그인 찜 하트 구독 제거), 카드 사진 2x 상한, `_headers` 폰트 캐시 수리, 첫 방문 폰트 미루기, 지도 SDK 조기 출발.

## 11. 후속 — 첫 부팅 코드 다이어트 (같은 PR)
- **Capacitor 를 웹 첫 부팅에서 뺐다**: `lib/native.ts` 가 app-utils 에 섞여 모든 페이지가 capacitor 청크를 끌어왔다. `lib/native-platform.ts`(import 없이 판정) + 규칙 `lib/native.ts → capacitor`. critical-chunks 17 → 16.
- **어드민 라우트 표를 `/admin/*` lazy 하위 Routes 로**: app-routes 52 → 21KB, 소비자 이동마다 어드민 경로 100개 매칭 제거. 렌더 확인 `/admin/login` · 없는 어드민 경로 404.
- **첫 렌더 CPU**: `formatNumber` 포매터 캐시, 비로그인 찜 하트 구독 제거. 재생 측정 편차 안이라 숫자는 못 말한다(동작만 고정).
- 🩸 **측정기 교훈 2**: 재생 하네스의 "웹폰트 제거" 변형이 링크 모양과 안 맞아 **적용이 안 된 채** 이전 세션 결론("효과 없음")을 만들었다. 이제 변형은 적용 안 되면 던진다(`xforms11`).
- 🩸 **테스트 주석 제거기 함정**: App.tsx 줄 주석에 `/admin/*` 를 쓰자 `urshorts-core` 의 주석 제거가 `/*` 를 블록 주석 시작으로 읽어 무관한 시험이 깨졌다 — 줄 주석에 `/*` 를 쓰지 말 것(제거기 결함은 별건).
- **E4 체크(배포 후)**: ① 홈 문서 modulepreload 에 `capacitor-*` · `app-routes-admin-*` 없음 ② `/admin/login` 정상 ③ `/static/fonts/*` 캐시 헤더 ④ 상세 `stale-hit` ⑤ 새 시크릿 창 첫 방문 시스템 글꼴 → Pretendard.

## 12. 2026-10-13 — 손님 페이지 lazy 코드 페이지별 묶음 (대표 "아직 대기업 수준은 아니잖아")

- 무엇: `scripts/surface-chunks.mjs` + `scripts/lucide-deep-imports.mjs` + 홈 폰/PC 표면 분리. CLAUDE.md 로딩 audit log 2026-10-13.
- 실측(brotli, 첫 화면 다음 바이트): 상세 120→40 · 상품 128→32 · 유어샵 118→32 · 교환권 111→25 · 지도 126→52 · 폰 홈 37→31.
- 재생(느린 4G·CPU4): 상세 ready 4.1→2.9s · 유어샵 4.2→2.9s · 홈 4.2→3.9s (이 수치는 PR #1741 의 폰트·CSS-first 를 **빼고** 잰 것 — 합치면 더 낮다).
- 하네스: scratchpad `xforms12.mjs`(라이브 HTML 의 preload 를 dist·맵 기준으로 바꿔 끼운다) + `replay5.mjs`.
- E4(배포 후): `curl -A '<iPhone UA>' https://urdeal.kr/pass/2919 | grep -o 'modulepreload[^>]*lz-[^"]*'` 로 lz- 청크가 실리는지, PC UA 로 `/` 에 PcHomePage 가, 폰 UA 로 MobileHomePage 가 실리는지.
- 다음 후보(숫자만): 첫 화면 CSS 279KB raw/29KB br(대시보드 클래스 포함) · axios 16KB br · i18n 18KB br · 지도 타일 disableHD(대표 판단).

## 13. 유어샵 "왜 이렇게 늦게 뜨지" (2026-10-13)

- **라이브엔 이 PR(#1741)의 개선이 하나도 없다** — 라이브 HTML 에 `ur-modulepreload`·`ur_font_warm` 0건. 대표 체감은 머지 전 상태다.
- 느린 4G·CPU 4배 재생(유어샵 `/u/jiwon1228`): 라이브 첫 내용 **2.5초** · LCP 4.3초 → PR 적용 **1.1초 · 1.1초**(서버 첫 화면이 바로 보인다). 조작 가능은 4.7초 그대로 — 회선(1.6Mbps)이 JS 총량에 묶여 있다.
- 같은 측정에서 찾아 고친 낭비: 상세 코드 18KB(엔트리 동적 import 가 상세 봉투에 섞임) · qrcode 17KB(폰에서 숨은 QR 마운트) · capacitor 5KB(웹 상태바) · zod 11KB(부팅 직후 → load 뒤).
- 실험: 번역 파일(locale-ko 33KB) 미리받기는 **효과 없음**(회선 대역 한계 — 순서만 바뀐다). 하지 않았다.
- 남은 큰 덩어리: react-core 42 · locale-ko 33 · i18n 20 · axios 18 KB br. 조작 가능 시간을 더 줄이려면 총량을 깎아야 한다(번역 파일을 표면별로 쪼개는 것이 다음 후보).
- ⚠️ 아직 /api/curator 를 첫 화면 뒤에 한 번 더 받는다(시드가 있는데 csrf-token 뒤 4.9초) — 다음 확인 대상.

## 14. "계속 해 영구적으로" (2026-10-13 후속)

- 묶음기: 페이지의 lazy 사용을 `<표면>L` 로 센다 → 상세가 받는 총량 335 → 259KB(br, 렌더 실측 `scratchpad/rtbytes.mjs` 방식: visual-preview --trace-api --no-idle 로 받은 청크를 brotli 합산).
- 🩸 그 변경이 처음엔 `src/lib/sentry-sdk` 를 lz-common 으로 끌어가 **sentry 가 전 화면 미리받기에 들어갔다**(측정에서 표면별 +38KB 로 드러남). `LIBRARY_ENVELOPES` 로 막고 vite 규칙과 대조하는 시험을 붙였다. ⇒ 묶음기를 고치면 반드시 표면별 미리받기 목록에 `sentry` 가 없는지 볼 것.
- 신규 가드 `check-surface-chunk-runtime.mjs` + `surface-chunk-runtime.yml`(PR 게이트 아님). 하네스에 `--no-idle` 추가, FETCH_RESULT 에 `chunks` 추가, 해시 제거 정규식이 `-` 든 해시를 놓치던 것 수리.
- ⚠️ 판정 함수에서 해시를 다시 떼지 말 것 — `gbDetail` 이 8글자라 해시로 오인된다.
- 유어샵 시드 재요청은 load 뒤로(주인은 즉시).
- 남은 후보: ① 번역 파일(locale-ko 33KB br)을 표면별로 쪼개기 ② 홈 카드 viewport prefetch 의 **상세 청크**(약 40KB)를 idle 로 미루기 — `GroupBuyFeedCard` 잠금 파일이라 대표 승인 필요(2026-08-27 aboveFold 미루기와 같은 처방).

## §15 (2026-10-13) 카드 상세 미리받기 load 뒤로 — 대표 승인
- `GroupBuyFeedCard` 의 aboveFold idle 경로·observer 교차 경로 둘 다 `runAfterLoad`(신규 `src/lib/after-load.ts`).
- 런타임 청크: 홈 33→26 · 쇼핑 32→25. `PREFETCH_OK` 비움 + 베이스라인 갱신.
- E4(배포 후): 홈 하드로드에서 `lz-gbDetail*` 가 `load` 이벤트 **뒤**에만 요청되는지, 카드 탭 시 상세가 즉시 뜨는지.

## §16 (2026-10-13) 홈 피드 첫 렌더 상한 — `useProgressiveCap`
- 홈 피드(편성 섹션 아래, 첫 화면 밖)가 50장을 첫 렌더에 다 지었다. 첫 렌더는 6장(최상단 피드면 12장), 나머지는 load 뒤 idle + `startTransition`.
- 뒤로가기(POP, key≠default)는 처음부터 전부(스크롤 복원). 덜 그린 동안 무한 스크롤 센티넬 끔.
- 재생(느린 4G·CPU 4배, 5회 중간값): 첫 마운트 4,227 → 3,703ms · 그 순간 긴 작업 1,080 → 330ms.
- 🩸 측정 주의: 이 컨테이너엔 한글 시스템 글꼴이 없어(unifont/wqy 폴백) **레이아웃 시간이 부풀려진다** — 151개 객체 레이아웃이 401ms. 트레이스의 Layout 수치를 폰 값으로 읽지 말 것. JS 시간은 쓸 만하다.
- 같은 트레이스: 지연 로딩된 Pretendard 파일이 하나 올 때마다 전체 재레이아웃(load 뒤라 첫 화면엔 무영향).

## §17 (2026-10-13) 폰이 PC 전용 부품을 받던 것
- 프로모 바: 넓은 화면에서만 마운트(폰 하드로드마다 `/api/promo-bar` 1건 제거). PC 사이드바: lazy + 768+ 만 + 봉투 `app-desktop-chrome`(런타임 검사 금지 목록).
- 보류: `DesktopTopNav` — lazy 로 하면 PC 상단 네비가 늦게 끼어든다(PC 밀림). 하려면 워커가 PC UA 에 그 청크를 modulepreload 해야 한다.
- 기각(실측): 번역 파일(locale-ko)을 load 뒤로 — 기본 문구 없는 `t()` 1,374곳(로그인·장바구니 등) 이라 키 이름이 보인다. 홈·유어샵·교환권·상세·지도 첫 화면은 locale 없이도 키 노출 0(지도 검색창 placeholder 1건 제외)이었지만 전 화면 보장이 안 된다.
- 실사용자 vitals(10-12, 홈 43건): LCP p50 2.57 · p75 3.73s · TTFB p50 476ms. `/pass/:id` 서버 self-fetch 590ms 는 이 PR 의 SSR 직전 사본(SWR)이 배포되면 사라진다.

## §18 (2026-10-13) 머지 직전 — 묶음기가 만든 청크 순환으로 /checkout 전체가 오류 화면
- 다크 대비 검사(PR 게이트 아님)가 `/checkout` "측정 4개" 로 실패 → 단독 재현 시 7 이라 처음엔 흔들림으로 봤으나, 화면 텍스트를 찍으니
  **"문제가 발생했습니다"**(ErrorBoundary). 원인 문구는 `window.Sentry` 를 가로채서 얻었다: `stripe-*.js` 에서 `Cannot access 't' before initialization`.
- 원인: 묶음기가 이름 없는 `prop-types`(@stripe/react-stripe-js 의존)를 `lz-boot-gbDetailL-mapL-productL` 로 옮겨 `stripe ↔ lz` 순환.
- 수리: `surface-chunks.mjs` 가 라이브러리끼리만 쓰는 이름 없는 의존은 손대지 않는다. 신규 가드 `check-chunk-cycles.mjs`(순환 0 동결).
- 🩸 교훈 ①: 단독 실행 "7" 은 `route === '/checkout'` 필터가 **다른 항목**을 집은 것이었다(목록에 같은 경로가 둘). 측정기를 먼저 의심할 것.
- 🩸 교훈 ②: 대비 검사가 아니었으면 결제 화면이 깨진 채 머지됐다 — 자동 머지 켜기 전 PR 게이트 밖 검사 결과도 볼 것.
- 실험(효과 없음, 되돌림): 엔트리 파일을 CSS 직후 미리받기 — 3화면 5회 중간값 차이가 오차 안.
- 대기(stash): `useProgressiveCap` 단계 확장(8장씩) — load 뒤 긴 작업 1.6초가 피드 펼치기인지 프로파일로 확인 후 별도 PR.

## §19 (2026-10-13) 대표 "여긴 왜이리 로딩 길어?" — 동탄5동 홈의 회색 섹션 자리
- 라이브 재현(폰 UA): localStorage 에 위치만 있고 `ur_loc` 쿠키가 없으면 서버는 '위치 없음' 섹션 시드를 싣고, 화면은 그걸 버리고
  회색 자리 → `/api/sections?near=` 응답 뒤 동네 섹션(두 번 교체 · 회색 자리는 부팅+요청 시간만큼). 쿠키가 있으면 회색 0.
- 쿠키는 홈 마운트 **뒤에만** 쓰였다 → 지도·PC 위치바에서 위치를 잡고 홈을 새로 열면 늘 이 경로.
- 수리: ① 다른 위치 시드는 placeholder 로 계속 보인다(캐시엔 안 들어감) ② `rememberLoc`(localStorage+쿠키 함께) — 지도 2곳·PC 위치바.
  쿠키 쓰기 SSOT 는 `shared/home-near.writeNearCookie`(라벨: 같은 격자면 보존, 다른 격자면 지움).
- 실측 참고: `/api/sections?near=` 콜드 서버 130~350ms, 쿠키 없는 curl 은 매번 DYNAMIC(쿠키 있는 요청은 엣지 HIT) — 별건 확인 대상.

## §20 (2026-10-13) load 뒤 재배치 폭풍 — 대표 "계속 개선해줘 속도. 대기업 수준으로"
- 트레이스 요약 스크립트: `scratchpad/tsum2.cjs`(Layout>30ms 목록) · 긴 작업 내부 분해는 이 절의 node -e 한 줄(쓴 명령 그대로 handoff 에 없으니 RunTask→inner 이벤트 이름 집계로 재작성).
- 원인 셋(전부 Layout): 폰트 조각마다 재배치 · 피드 40장 한 커밋(상자 800→3,300) · 이후 폰트/썸네일마다 3,300 상자 재배치.
- 처방: 폰트 조각 일괄 preload 후 한 번에 켬(textContent 로 글자 수집) · 8장씩 · `.ur-cv-grid` content-visibility.
- 실측(3회 중간값, load 뒤): 레이아웃 2,920→379ms · TBT 4,046→999ms · 최장 1,362→499ms. 폰트 일괄만으로는 TBT 불변이었다(레이아웃 −22%) — 셋이 함께여야 효과.
- 🩸 측정 함정: 리플레이에 **다른 빌드의 route-chunk-map(MAPJSON)** 을 주면 페이지가 깨져 "레이아웃 0" 처럼 좋아 보인다. dist 마다 dumpmap 을 새로 뜰 것.
- E4(배포 후): 폰 첫 방문 홈에서 스크롤해도 카드가 튀지 않는지(content-visibility 높이 기억) · Pretendard 로 한 번에 바뀌는지.
- §20 후속: 폰트 `hit()` 이중 반복 0.3초 → 이분 탐색 · 지도 목록 `.ur-cv-rows` · 복원(POP) 중 content-visibility 끔. 전체 TBT(2회): 지도 3.81→1.92s · 유어샵 1.86→1.47 · 홈 2.63→2.05.
- 다음 후보: 교환권(/vouchers)·상세는 load 뒤 긴 작업이 작다(150~450ms, 첫 레이아웃 위주). 남은 큰 것 = 첫 레이아웃(서버 첫 화면) 0.4~0.5초 · 엔트리 실행.
