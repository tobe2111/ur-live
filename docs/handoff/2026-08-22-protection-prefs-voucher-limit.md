# 2026-08-22 — 사진/크롤링 보호 · 어드민 즐겨찾기 · 이용권 1인당 한도 · 홈 섹션 0-RTT

브랜치 `claude/service-page-ui-redesign-gkm900` (PR #1178). 대표 지시 4건 + 최적화.

## 🔴 다음 세션의 첫 액션

**배포 후 판정 명령** (이 4건은 배포돼야 판정된다):

```bash
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36'
# ① 수확 봇 차단이 실제로 먹는가 (403 이어야 함)
curl -s -o /dev/null -w '%{http_code}\n' -A 'GPTBot/1.2' https://urdeal.kr/api/sections
# ② 검색엔진은 통과하는가 (200 이어야 함 — 여기가 막히면 색인이 죽는다)
curl -s -o /dev/null -w '%{http_code}\n' -A 'Yeti/1.1 (+http://naver.me/spd)' https://urdeal.kr/api/sections
# ③ 홈 섹션 0-RTT (스크립트 태그가 있어야 함)
curl -s https://urdeal.kr/ | grep -c '__SSR_INITIAL_SECTIONS__'
# ④ robots 가 실제로 우리 파일인가 (Cloudflare Managed robots.txt 로 덮이는 사고 전례 있음)
curl -s https://urdeal.kr/robots.txt | grep -c 'GPTBot'
```

**손으로 볼 것 2가지**
- 어드민 ★ 하나 토글 → **다른 브라우저**로 로그인해 그대로 있는지.
  ⚠️ 같은 브라우저에서만 보면 로컬 캐시 때문에 고쳐진 것처럼 보인다.
- **뷰티 이용권** 하나 열어 1인당 한도 저장 → 소비자 상세에 "1인당 최대 N개" 표시 →
  한도만큼 산 뒤 하나 더 담으면 `PER_PERSON_LIMIT`.

## ✅ 완료 (commit)

| 커밋 | 내용 |
|---|---|
| `3f9d498` | PR #1178 머지 충돌 해소(main 이동 — 매니페스트 union) |
| `5d120ab` | 사진 우클릭 저장 억제 + 수확 크롤러 차단 |
| `19313d1` | 어드민 즐겨찾기 초기화 — 저장을 브라우저 → 계정 |
| `8551e17` | 1인당 이용권 한도 — 이용권 4종 전부에서 설정 가능 |
| (이 커밋) | 홈 섹션 SSR 0-RTT + 파일 크기 래칫 복구 5건 |

## 🩸 이번에 틀렸던 판단 (제일 값진 것)

1. **"즐겨찾기가 사라진다" 의 원인을 코드 버그로만 찾다가 헛돌았다.** localStorage 를 지우는
   코드는 **없었다**(prefix wipe 도 없다). 진짜 원인은 **저장 위치**였다 — localStorage 는
   오리진·브라우저·프로필마다 따로다. 게다가 최초 기본값 시드를 **저장하지 않아** 저장소가
   비면 항상 기본 4개로 돌아갔다. ⇒ *"어느 트리거인가"* 를 특정하려 하지 말고
   **증상이 불가능한 저장 위치**로 옮기는 쪽이 옳았다.

2. **"1인당 한도를 셀러가 설정 못 한다" 를 미구현으로 읽을 뻔했다.** 서버는 2026-07-01 부터
   저장·강제를 다 하고 있었다. 막고 있던 건 **화면의 한 줄**(`category === 'meal_voucher'`)이었고,
   그래서 **식사 이용권으로 테스트하면 멀쩡히 동작한다.** 신고를 받으면 "없다" 가 아니라
   "**어떤 경우에만** 없나" 를 먼저 볼 것.

3. **주석 제거 헬퍼가 경로 `'/api/products/*'` 의 `/*` 를 블록주석 시작으로 오인**해 파일 뒤쪽을
   통째로 잘랐다. 그대로 뒀으면 "배선 확인" 가드가 헛돌았다. → 줄 단위 검사로 교체.

4. **같은 쿼리가 두 곳에 있는 걸 모르고 "파일에 있는가" 로 판정**해 가드가 헛돌았다(한쪽을
   지워도 초록). 되돌려-검증이 잡았다. → **개수** 판정으로 교체.
   ⇒ 이 레포의 재발 클래스 그대로다: *실패할 수 없는 가드*.

5. **컨테이너가 리셋되며 미커밋 작업(홈 섹션 SSR)이 통째로 날아갔다.** 로컬 브랜치가
   `origin` 보다 뒤처져 있었고(PR #1177 이 squash 머지돼 해시가 갈렸다), 그대로 작업했으면
   덮어쓸 뻔했다. ⇒ **세션 시작 시 `git fetch` + `git log origin/<branch>` 로 실제 tip 확인.**

## 🧱 파일 크기 래칫 — 이번에 5건 걸렸고 전부 **실제 분리**로 풀었다

주석을 깎아 카운터를 맞추는 건 코드의 설명력을 깎는 것이라 하지 않았다. 새로 생긴 파일:

| 새 파일 | 무엇 |
|---|---|
| `worker/utils/ssr-payload.ts` | SSR 3계층(엣지→KV→self-fetch) SSOT. **잠긴 로딩 최적화** — 순서·타임아웃 불변 |
| `features/auth/api/admin-2fa.routes.ts` | 어드민 2FA setup/verify/validate (한 세트) |
| `features/auth/api/admin-prefs.routes.ts` | 어드민 개인설정 GET/PUT |
| `features/seller/api/product-field-writers.ts` | 컬럼별 개별 UPDATE(마이그레이션 미실행 대비 — 합치지 말 것) |
| `pages/seller-product-edit/VoucherFields.tsx` | 이용권 입력 묶음(4종 공통) |
| `worker/routes/repair-schema/admin-tables.ts` | 어드민 테이블 복구 정의 |

⚠️ **분리하면 가드가 "낡은 지도"가 된다.** 실제로 전체 테스트에서 5건이 빨개졌다(가드가 옛 파일을
가리켰다). 각 가드에 **"분리된 것이 실제로 마운트/렌더되는가"** 검사를 함께 넣었다 —
파일만 있고 안 붙으면 화면에서 조용히 사라지기 때문이다.

## ⏳ 남은 것

- **못 본 시안 1건** — 2026-08-19 대표가 보낸 "앱+모바일 메인 디자인" 첨부 2장이 **빈 파일로
  도착**했다. 다시 받아야 한다.
- **PC 친화성 전수 점검 나머지** — 15개 라우트 중 9개를 풀너비로 등재했고, `/referral` 은
  `lg:hidden` 없는 하단 고정바 때문에 **일부러 제외**(등재하면 PC 에서 CTA 가 사라진다).
- **대표 판단 대기**: 어드민 542KB / 유어애즈 321KB 워커 분리 · 도매 잔재 154KB.

## 🔒 보호 기능의 한계 (대표에게 이미 말했지만 다음 세션도 알 것)

사진 우클릭 차단은 **억제이지 보호가 아니다.** URL 이 있으므로 개발자도구로 받을 수 있다.
막는 것은 우클릭 저장·드래그·iOS 길게 눌러 저장이라는 **손쉬운 경로**뿐이다.
⚠️ **iOS 는 CSS(`-webkit-touch-callout`)가 본체다** — Safari 는 길게 눌러도 `contextmenu` 를
안 쏘므로, CSS 를 지우면 PC 에선 멀쩡한데 **모바일에선 기능이 통째로 없다.**

---

# 📉 유어딜 최적화 — 실측 기록 (2026-08-22 후반)

대표: *"유어딜 최적화는 해야하지 않을까?"*

## 🩸 먼저: 제가 한 번 오진했다. 같은 함정을 반복하지 말 것

*"홈 HTML 112KB 중 SSR 시드가 57KB — 1순위"* 라고 보고했는데 **압축 전 숫자**였다.

```
raw   111,967B
wire   33,950B  (brotli, content-encoding: br)   ← 실제
```

URL 이 반복되는 JSON 은 brotli 가 3.3배로 줄인다. ⇒ **압축 후로 재지 않으면 우선순위가 통째로
틀린다.** (CLAUDE.md 의 `check-bundle-size` 사고 — gzip 사이드카가 없어 측정값이 늘 0이던 것 —
과 같은 클래스다.)

그리고 시드는 **줄이면 안 된다**: `useMapProducts` 는 `seed.length < 50` 이면 "마지막 페이지"로
간주하고 나머지를 **아예 안 받는다**(`_cache.set` 후 return). 12개로 줄였다면 홈에 상품이 12개만
뜨고 끝났을 것이다. (`HomeSections` 는 `refetchOnMount:'always'` 라 다르다 — 두 훅을 혼동하지 말 것.)

## 압축 후 실측 — 무게는 JS/CSS 에 있다

```
JS/CSS  377KB   ← 11배
HTML     34KB
```

| 자산 | wire | 메모 |
|---|---|---|
| app-components | 61KB | 공유 |
| react-core | 46KB | |
| **index.css** | **34KB** | CSS 하나가 HTML 전체와 같다 — **미조사, 다음 후보** |
| app-utils | 33KB | |
| ~~RestaurantMapPage~~ | ~~23KB~~ | ✅ 이번에 제거(419460222) |
| i18n | 21KB | |
| axios | 18KB | |
| app-wholesale-hooks | 2.5KB | 🚫 **손대지 않기로 판단** — 공유 청크(`app-components`)가 끌어와서 떼려면 잠긴 `manualChunks` 를 건드려야 하는데 이득이 2.5KB 뿐 |

## ✅ 이번에 고친 것 (`419460222`)

`scripts/generate-route-chunk-map.mjs` 의 `ROUTES` 는 **라우팅이 바뀌어도 자동으로 안 따라온다.**

① **홈이 안 쓰는 지도 청크 23KB 를 미리 받고 있었다** — `home: ['RestaurantMapPage.tsx']` 가
2026-07-15 "홈=지도" 잔재. 홈은 `HomeRoute`(PC/모바일 분기)로 바뀐 지 오래다. **양쪽 손해**였다:
지도 23KB 를 받고, 정작 쓰는 `PcHomePage`(4.8KB)+`MobileHomePage`(2.0KB)+`GroupBuyFeed`(3.6KB)는
병렬화를 못 받았다.

② **링크샵의 `SellerPublicPage` 가 `MAX_LINKS` 10 에 잘려 있었다** — 진입점이 둘인데 첫 키의
폐쇄가 캡을 채웠다. 사업자 링크샵의 본체인데도. ⇒ 각 진입점의 **페이지 청크를 먼저** 모으고
공유 청크를 뒤로.

가드: `route-chunk-surfaces.test.ts` — **`HomeRoute` 의 lazy import 를 읽어 표와 대조**한다.

## 🔴 다음 세션 최적화 첫 액션

1. **배포 후 효과 판정**: `curl -s https://urdeal.kr/ | grep -c RestaurantMapPage` → **0**
   (생성 맵은 빌드 산출물이라 커밋본은 비어 있다 — CI 빌드에서 채워진다.)
2. **`index.css` 34KB 조사** — 이번에 손 못 댔다. Tailwind 빌드 산출이라 미사용 유틸리티가
   얼마나 되는지, 대시보드 전용 CSS 가 소비자 표면에 실리는지 볼 것.
3. ⚠️ **측정은 반드시 `Accept-Encoding: br, gzip` 으로.** raw 로 재면 또 틀린다.

---

# 🔬 소비자 첫 화면 최적화 — 전수 실측 결론 (2026-08-22 최종)

**결론부터: 소비자 첫 화면은 이미 잘 최적화돼 있다. 실재하던 낭비는 지도 청크 23KB 하나였고
그건 고쳤다(`#1178`). 나머지 후보 4개는 전부 "이미 최적" 또는 "위험 대비 이득 없음" 이다.**

⚠️ **다음 세션은 아래를 다시 파지 말 것.** 근거를 남기는 이유가 그것이다.

## 실측 방법 (이대로 해야 안 틀린다)

```bash
# ① 반드시 압축 후로 — raw 로 재면 우선순위가 통째로 뒤집힌다(내가 한 번 틀렸다)
curl -sS --compressed -A "$UA" https://urdeal.kr/ -o /tmp/h.html -w '%{size_download}\n'
# ② 실제 첫 화면 바이트는 브라우저로 — HTML 만 보면 폰트/이미지를 놓친다
CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node ./_measure.mjs
#    ⚠️ 스크립트를 **레포 루트에** 두어야 playwright 모듈이 해석된다(/tmp 는 ERR_MODULE_NOT_FOUND)
```

## 모바일 390px 첫 화면 실측 (라이브, br 압축)

```
font         15개   358KB   ← 최대 항목이지만 렌더 무영향(아래)
image        11개   171~496KB
stylesheet    3개    12KB
HTML                 34KB
```

## 후보별 판정 — 왜 안 건드렸는가

| 후보 | 실측 | 판정 |
|---|---|---|
| **SSR 시드 57KB** | raw 57KB지만 **wire 34KB**(brotli 3.3×) | 🚫 게다가 `useMapProducts` 가 `seed.length<50` 을 "마지막 페이지"로 봐서 **줄이면 홈에 12개만 뜬다** |
| **index.css 34KB** | `cache-control: public, max-age=31536000, **immutable**` | 🚫 첫 방문 1회뿐, 재방문 0바이트. 표면별 CSS 분리는 구조 변경 — 위험 대비 이득 없음 |
| **Pretendard 358KB** | `font-display: **optional**` 강제(index.html:383) | 🚫 늦으면 아예 안 쓰고 시스템 폰트로 그린다 → **LCP 영향 0**. 주석에 2MB 통짜로 받다 LCP 13.8s 났던 이력까지 있다 |
| **capacitor 4KB** | 플러그인은 전부 `await import()`, 정적은 `Capacitor` 판정용 1개 | 🚫 이미 옳다 |
| **이미지** | 과대해상도 **0건**, 전부 `cdn-cgi/image` + `format=auto` + `quality=85` + `onerror=redirect` | 🚫 이미 옳다 |
| **app-wholesale-hooks 2.5KB** | 공유 청크(`app-components`)가 끌어옴 | 🚫 떼려면 잠긴 `manualChunks` 를 만져야 하는데 이득 2.5KB |
| ~~**지도 청크 23KB**~~ | `ROUTES.home` 이 `RestaurantMapPage` 를 가리키는 낡은 지도 | ✅ **고침** — 배포 후 preload 0 확인 |

## 🔑 이 조사에서 얻은 규칙

1. **압축 후로 재라.** raw 숫자는 3배 넘게 부풀어 있다.
2. **캐시 헤더를 보라.** `immutable` 자산은 첫 방문 1회 비용이라 우선순위가 낮다.
3. **`font-display` 를 보라.** 큰 폰트가 곧 느린 폰트는 아니다(`optional`/`swap`이면 렌더 무영향).
4. **HTML 만 재지 말고 브라우저로 재라.** 폰트 358KB 는 HTML 을 아무리 봐도 안 보인다.

## 남은(미조사) 것

- **PC(1024px+) 첫 화면**은 안 쟀다 — 모바일만 측정했다. `PcHomePage` 경로는 별도 확인 필요.
- `index.html` 의 kakao preconnect 주석이 *"모바일 = RestaurantMapPage"* 를 근거로 삼는데
  **그 전제가 뒤집혔다**(이제 피드). 지도 SDK preconnect 가 홈에서 불필요해졌을 수 있다 — 작지만 실재.

---

# 🔍 2026-08-23 이어서 — 화질 신고 + 예열 cron 예산 초과 (대표 "이미지 화질이 깨지는 문제는? 다른 곳 더 최적화할 곳 봐줘")

## ① 화질 — 진짜 결함은 **히어로 한 곳**뿐이었다 (`72a3ebe`)

```
PC 히어로: 표시 1,037px × DPR2 = 필요 2,074px  →  요청 width=900  (0.43배)
카드:      필요 800  →  실제 800×449                                 (정상)
상세:      필요 512  →  512                                          (정상)
```

⚠️ **리사이저는 정상이다** — 요청한 폭을 그대로 준다(`width=1200` → `1080×607` 실측).
   **우리가 작게 요청한 것**이 원인이라 `quality` 를 올려도 안 고쳐진다.

수정: 단일 폭 → `cfSrcSet(photoSrc, 1024)`(1x 1024 / 2x 2048 / 3x 3072 중 브라우저가 한 장) +
폴백 `src` 900→1280, quality 72→76. `loading="eager"`·`fetchPriority="high"` 불변.

### 🩸 `naturalWidth` 를 믿고 **두 번** 오진했다

카드도 흐리다고 두 번 보고했는데 틀렸다. 페이지 안 `<img>.naturalWidth` 가 400 이었지만
**같은 URL 을 독립 `new Image()` 로 로드하면 800×449** — Chrome 이 AVIF 를 메모리 절약을 위해
**축소 디코드**한 값이었다. ⇒ 화질 판정은 반드시 `currentSrc` 를 **독립 로드**해서 잴 것.

## ② 예열 cron 이 서브리퀘스트 예산을 **76+/50** 으로 넘고 있었다

라이브 실측에서 시작했다:

```
/vouchers  x-ssr-status: VOUCHERS:self-fetch-hit   server-timing: edge;dur=4, kv;dur=128, self;dur=30
/browse    x-ssr-status: BROWSE:self-fetch-hit     server-timing: edge;dur=2, kv;dur=145, self;dur=25
```

**KV 를 128~145ms 지불하고 100% miss** 하는데, 그게 대체하려던 self-fetch 는 25~30ms 다.
CF API 로 확인하니 `CACHE_KV`(=`ur-cashe` 25aef979…) 의 **`ssr:` 키가 0개** — 2026-07-12 에 넣은
전역 워밍이 **한 번도 기록된 적이 없다**.

원인: 무료 플랜 서브리퀘스트 상한은 **인보케이션당 50** 이고 `fetch` 뿐 아니라 **KV·D1 도 센다.**
```
normalize D1 3 + HOT_PATHS 23 + KV put ≤4 + 도매 4 + 동적 D1 3 + 동적 fetch 40  =  77
```
소스 주석은 *"HOT 13 + dynamic 20 = 33 안전"* 이라고 적혀 있었다 — **2026-06-04 에 셀러당 sub-data 를
한 줄 더 넣고 큐레이터 10개가 붙어 두 배가 됐는데 주석만 그대로**였다. 초과분은
`catch { dynFailed++ }` 가 삼켜 **에러 없이** 실패한다. 그래서 몇 달간 아무도 몰랐다.

**수정**: `/api/sections` 중복 1건 제거 + `rotateForBudget()` — 자르지 말고 **회전**(회차당 12개,
5분×12슬롯이면 한 시간에 40개를 여러 번 돈다). 앞에서 자르면 뒤쪽(큐레이터 링크샵)이 **영영** 안 데워진다.
가드: `cache-prewarm-budget.test.ts` 7건 + 주입 매니페스트 2건(되돌려-검증 4건 red 확인).

## ③ 🔴 대표 판단 필요 — **무거운 */5 cron 두 개가 83~88분째 안 돌고 있다**

```
cache-prewarm         age 83분  ms 3658  stale=true     ← 가장 무거운 축
group-buy-feed-cache  age 88분  ms 6263  stale=true
(같은 시각 가벼운 */5 cron 13개는 age 0분)
```
가장 오래 걸리는 둘만 stale 이다. ②의 예산 초과가 원인일 가능성이 크고, 이번 수정으로 회복되는지
**배포 후 판정**할 것. 회복 안 되면 그건 코드가 아니라 스케줄러/플랜 문제다(유료 전환 = 서브리퀘스트 1,000).

## 판정 명령 (배포 후)

```bash
# 1) 히어로 화질 — srcSet 후보가 나가는지
curl -s https://urdeal.kr/ | grep -o 'cdn-cgi/image/width=[0-9]*[^"]*' | sort -u | head

# 2) KV 가 실제로 채워졌는지 (15분 표본화라 :00/:15/:30/:45 이후)
#    → x-ssr-status 가 VOUCHERS:kv-hit 로 바뀌면 성공
curl -sI https://urdeal.kr/vouchers | grep -i "x-ssr-status\|server-timing"

# 3) cron 이 다시 도는지
#    /api/admin/cron-heartbeats 에서 cache-prewarm 의 age_minutes < 10
```

## 이번에 틀렸던 판단 (다음 세션이 반복하지 말 것)

1. **롤백된 트리의 파일로 최신 코드를 덮어썼다** — `/tmp` 에 보존해 둔 `HomeHeroDefault.tsx` 가
   `loading="lazy"` 시절 것이라 `eager` 회귀를 만들었다. 가드 2개가 잡았다.
   ⇒ **세션 재개 후에는 `git fetch` + `reset --hard origin/…` 이 먼저다. 보존본을 믿지 마라.**
2. **캐시버스트 쿼리(`?cb=$RANDOM`)로 SSR 캐시를 쟀다** — 엣지 캐시 키가 달라져 전부 miss 로 보였고
   슬롯 매처가 `!url.search` 를 요구하는 표면은 슬롯 자체가 안 잡혔다. **SSR 측정에 쿼리를 붙이지 마라.**
3. **KV 네임스페이스를 이름으로 골랐다** — 계정에 `CACHE_KV` 라는 **동명의 다른 네임스페이스**가 있고
   실제로 쓰는 것은 제목이 `ur-cashe` 인 25aef979… 다. `wrangler.toml` 주석이 이미 경고하고 있었다.
4. **Pretendard CSS 가 FCP 를 막는 줄 알았다** — A/B(차단 vs 아님)로 재니 FCP 1208 ↔ 1232 로
   **차이 없음**. 인라인화하려던 것을 접었다. **고치기 전에 A/B 로 재라.**
