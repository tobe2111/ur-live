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
