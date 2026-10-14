# 인계 — SEO·GEO 스윕 (2026-10-14)

대표 지시: *"머지하고 또 개선점 찾아보자. SEO 와 GEO 부분에서"* (연속 지시 — 재고 고치고 머지하고 또 찾는다).

## 🚩 다음 세션의 첫 액션 — **#89 는 끝났다. 결재 3건이 대표 판단 대기다**

> ✅ **#89 판정 완료(표본 5/5 · 2026-10-15 04~08시 KST).** 전체 수치·근거는 `## #89` 절의
> `📊 정각 표본 누적표`. 결론 셋:
> 1. **알람 체인은 죽지 않는다** — 런타임이 밀린 알람을 다음 정각에 쓸어서 배달한다
>    (`set_ok` 5표본 전부 `true`). 고장이 아니라 유휴 Durable Object 의 배달 지연이다.
> 2. **간격 공식 4/4** — `간격 ≈ (60 − 멎은 분) + sweep 착지 지연(6초~1분 42초)`.
>    관측 최대 **60분 08초** · 구조적 상한 약 **62분**. 현재 경보 임계는 **32분**이라
>    시간대마다 울리고 안 울린다(표본 1 안 울림 / 2~4 울림).
> 3. **회차 수가 측정량을 그대로 정한다** — 회차당 100명 안팎.
>    `04시 27회→3,123` vs `05~08시 1~3회→150~345` = **약 20배 손실이 4시간 연속**.
>
> 🔴 **그래서 고칠 자리가 우리 코드에 없다.** `ADS_PLAN` 은 이미 `paid` 이고 근본 원인은
> Cloudflare 런타임의 유휴 DO 알람 배달이다. 남은 선택은 *무엇을 감시할지* 뿐이라
> **결재로 올렸다**: `docs/decisions/2026-10-15-ads-alarm-stall-alert.md`.
> ❌ **기각된 가설 둘**: `+60분 고정 지연`(표본 1의 31분이 기각) · `collect`·`collect-neis`
> 레인 단위 알람 소실(표본 5에서 null 집합이 돌았다 — 같은 절의 ❌ 참조).
>
> 🚫 **정각 체크인을 더 걸지 말 것.** 표본은 충분하고, 그 이상은 같은 값을 다시 재는 것이다.
> 🚫 `staleGapMinutes`·`RUNS_PER_HOUR_PAID`·`ALARM_DEAD_AFTER_MS` 를 **손대지 말 것** —
> 결재가 답을 받기 전까지는 임계 변경이 "이 손실을 안 보이게 하는" 쪽으로 기울 수 있다.

### 그래서 다음 액션: **결재함 3건을 대표가 보기를 기다린다** (재촉하지 말 것)

| 결재 | 무엇 |
|---|---|
| `2026-10-15-ads-alarm-stall-alert.md` | 유어애즈 경보를 느슨하게 할까, 측정량 경보로 바꿀까(기본안 2번) |
| `2026-10-14-pass-description.md` | 이용권 310건의 화면측 description(구글이 `0명 함께 구매 중` 을 본다) |
| `2026-10-14-locked-emdash.md` | 잠금표 `worker/index.ts` 의 라이브 줄표 3건 |

**세션이 할 일은 없다.** 새로 팔 것을 찾으려면 아래 "결함 아님으로 판정" 표들을 먼저 읽을 것 —
이미 재 보고 기각된 것이 많다.

#### 🔬 #89 을 다시 재야 할 때의 명령 (참고용 — 지금 돌릴 이유는 없다)

```bash
# 어드민 토큰 → CF 토큰 → D1 레인 스탬프 + 부트스트랩 하트비트
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
BODY=$(python3 -c "import json,os;print(json.dumps({'email':os.environ['URDEAL_ADMIN_EMAIL'],'password':os.environ['URDEAL_ADMIN_PASSWORD']}))")
TOK=$(curl -sS -X POST https://live.ur-team.com/api/admin/login -H 'Content-Type: application/json' \
  -H "User-Agent: $UA" --data-binary "$BODY" \
  | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print(d.get('token') or d.get('accessToken'))")
CFJ=$(curl -sS https://live.ur-team.com/api/admin/tools/settings -H "Authorization: Bearer $TOK" -H "User-Agent: $UA")
CFT=$(echo "$CFJ" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['cf_api_token'])")
ACC=$(echo "$CFJ" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['cf_account_id'])")
DB=d9530ba6-7a26-4c02-9295-3ce5aef112a3
python3 -c "import json;json.dump({'sql':\"SELECT key,value FROM platform_settings WHERE key LIKE 'ads_lane_alarm_last:%' OR key LIKE 'cron_hb:ads:lane-alarm-boot:%' ORDER BY key\"},open('/tmp/q.json','w'))"
curl -sS -X POST "https://api.cloudflare.com/client/v4/accounts/$ACC/d1/database/$DB/query" \
  -H "Authorization: Bearer $CFT" -H 'Content-Type: application/json' --data-binary @/tmp/q.json
```

**함정 셋**(이번에 전부 밟았다): `at`·`next_at` 은 **epoch-ms 와 ISO 둘 다**로 온다 ·
**부트 하트비트의 `at` 은 배치 플러시 시각이라 타이밍 근거가 못 된다**(쓸 수 있는 것은 `r` 의
`started`·`alarmAt`) · 그 `alarmAt` 이 스탬프 `next_at` 과 **같으면 관측 레이스**라 그 레인은
판정에서 뺀다. 측정량 컬럼은 **`perf_checked_at`**(`enriched_at` 은 없다).

### 그 밖에 남은 것

- **결재 3건** — 위 표 참조(`2026-10-15-ads-alarm-stall-alert.md` · `2026-10-14-pass-description.md` · `2026-10-14-locked-emdash.md`). **재촉하지 말 것.**
- **대표 액션 1건** — IndexNow 게이트 ON(코드 완성 · #76).
- **DNS 1건** — `www.urdeal.kr` 가 DNS 에 없다(#54 · 플랫폼 쓰기라 대표 대시보드).
- 아래 SEO 절들은 전부 끝났다(머지 `2528c3441` 까지 · E4 판정 포함).

## 🚩 (완료) 이전 첫 액션 — SEO 스윕

`#1791` 은 **머지됐다**(`75bea667e`). **PR #1808**(draft)이 여섯 건을 싣고 있었다 —
`#73`(JSON-LD 두 벌) · `#79`(줄표 365건) · `#80`(가게 유어샵 구조화 데이터) · `#81`(`/map` ItemList) ·
`#82`(고아 상세 134건) · `#83`(숙소 별점 49건) + '미해소' 거짓 표기 셋 정정.

```bash
# ① PR 상태
gh api repos/tobe2111/ur-live/pulls/1808 --jq '{state,mergeable,merge_state:.mergeable_state,head:.head.sha}'

UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
IPH='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

# ② E4 #79 (줄표) — 색인 365건의 스니펫에서 줄표가 사라졌는지. **표면별로** 센다.
for p in /pass/2490 /pass/2823 /products/2917 /region /u/user40 /vouchers; do
  printf '%-18s ' "$p"
  curl -sS -A "$UA" "https://urdeal.kr$p" | python3 -c "
import sys,re
h=sys.stdin.read()
t=(re.search(r'<title>(.*?)</title>',h,re.S) or [None,''])[1]
d=re.findall(r'<meta[^>]+name=\"description\"[^>]*content=\"([^\"]*)\"',h)
print('줄표', ('T' if '\u2014' in t else '') + ('D' if d and '\u2014' in d[0] else '') or '0', '|', t[:40], '|', (d[0] if d else '')[:60])"
done
#  🔴 **반대 방향도 본다** — 줄표를 빼면서 구분자를 통째로 잃지 않았는지:
#     /pass 설명에 가게명·상품명·가격이 전부 남아야 하고 /region 제목에 ` - ` 가 있어야 한다.

# ③ E4 #80 (가게 유어샵 구조화 데이터) — ld 블록이 1 → 2 가 됐는지, 종류가 맞는지
for p in /s/store_muxlddtf74b /profile/store_muxlddtf74b /u/jiwon1228; do
  printf '%-30s ' "$p"
  curl -sS -A "$UA" "https://urdeal.kr$p" | python3 -c "
import sys,re,json
h=sys.stdin.read(); bl=re.findall(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>',h,re.S)
ts=[]
for b in bl:
    try: d=json.loads(b)
    except Exception: ts.append('PARSE_FAIL'); continue
    ts += [n.get('@type') for n in (d.get('@graph') or [d]) if isinstance(n,dict)]
print('블록',len(bl),ts)"
done
#  기대: /s/ · /profile/ 둘 다 블록 2 → [Organization,WebSite] + [BreadcrumbList,ProfilePage,ItemList]
#  🔴 반대 방향 — `Person` 이 **0건**이고(가게는 사람이 아니다) 빵부스러기가 `/s` 를 안 가리키는지.

# ④ E4 #73 (JSON-LD 중복) — 아이폰 UA 로 **렌더**해서 `[data-rh]` 가 0 인지.
node scripts/visual-preview.mjs --route=/pass/2823 --ua=iphone 2>/dev/null | tail -5
#  (렌더 하네스가 없으면: 그 파일이 쓰는 방식대로 Playwright 로 띄워 아래를 센다)
#     document.querySelectorAll('script[type="application/ld+json"]').length        → 서버 노드만
#     document.querySelectorAll('script[type="application/ld+json"][data-rh]').length → **0**
#  🔴 반대 방향 — 서버가 **안 내는** 종류(클라 전용 노드)가 사라지지 않았는지도 함께 볼 것.

# ⑤ E4 #75 (숙소 문구) — cron(04:20 KST) 1회 뒤
curl -sS 'https://urdeal.kr/api/group-buy/stays/2732' | python3 -c "import sys,json;d=json.load(sys.stdin)['data']['product'];print(repr(d.get('description_full'))[:200])"

# ⑥ E4 #83 (숙소 별점) — 평점이 `Product` 에 있고 `LodgingBusiness` 에는 **없는지**
curl -sS -A "$UA" https://urdeal.kr/stays/2887 | python3 -c "
import sys,re,json
out=[]
def walk(n):
    if isinstance(n,dict):
        if n.get('aggregateRating'): out.append((n.get('@type'), n['aggregateRating'].get('ratingValue'), n['aggregateRating'].get('reviewCount')))
        if n.get('starRating'): out.append((n.get('@type')+'.starRating', n['starRating'].get('ratingValue'), ''))
        for v in n.values(): walk(v)
    elif isinstance(n,list):
        for v in n: walk(v)
for b in re.findall(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', sys.stdin.read(), re.S):
    try: walk(json.loads(b))
    except Exception: pass
print(out)"
#  기대: [('Product', 4.6, 9), ('LodgingBusiness.starRating', 4, '')]
#  🔴 반대 방향 — `('LodgingBusiness', 4.6, 9)` 가 **같이 나오면 실패**다(같은 리뷰 두 벌 선언).
#     그리고 `/pass/2914`(식사)·`/products/:id` 가 종전과 같은지도 함께 본다.

# ⑦ E4 #82 (고아 상세) + #81 (`/map` ItemList) — **cron `:15` 1회 뒤**(요약이 30/버킷으로 다시 써져야 한다)
for p in /region/%EC%84%9C%EC%9A%B8 /region/%EC%84%9C%EC%9A%B8/%EC%A4%91%EA%B5%AC /region/%EA%B2%BD%EA%B8%B0 /map /stays; do
  printf '%-46s ' "$p"
  curl -sS -A "$UA" "https://urdeal.kr$p" | python3 -c "
import sys,re,json
h=sys.stdin.read()
links=set(re.findall(r'<a [^>]*href="(/(?:pass|stays|products)/\d+)"', h))
items=[]
def walk(n):
    if isinstance(n,dict):
        if n.get('@type')=='ItemList': items.append(len(n.get('itemListElement') or []))
        for v in n.values(): walk(v)
    elif isinstance(n,list):
        for v in n: walk(v)
for b in re.findall(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', h, re.S):
    try: walk(json.loads(b))
    except Exception: pass
print('상세링크', len(links), '· ItemList', items)"
done
#  기대: /region/* 은 상세링크 **30**(종전 8) · /map 은 ItemList **10**(종전 0)
#  🔴 반대 방향 — `/map`·`/stays` 의 **상세링크는 8 그대로**여야 한다(의도된 비대칭)
#     그리고 `/region/*` 의 ItemList 는 **10 그대로**여야 한다(리치결과 무게 — 올리지 않았다)

# ⑧ E4 #82 전체 — 고아가 줄었는지 전수로 다시 센다(허브 95개 크롤 · 약 2분)
#    기대: sitemap 상세 360건 중 내부 링크 도달 **226 → 340 안팎**
#    방법: sitemap 의 비상세 URL 전부 + /map /vouchers / 를 크롤해 `<a href>` 를 모아 상세 집합과 교차.
```

⚠️ **#75 는 cron 이 한 번 돌아야 판정된다**(일일 티어 04:20 KST). 그 전에 재면 옛 문장이 그대로이고
그것은 회귀가 아니다. 돌았는지는 어드민 `GET /api/admin/cron-heartbeats` 의 `scheduled-cleanup` +
그 회차 `results.stay_desc_healed` 로 본다.

✅ **#72·#74 는 머지 후 라이브로 판정했다**(아래 2차 스윕 표) — 다시 재지 말 것.

## ✅ 이번 세션 완료분

| # | 무엇 | 커밋 / PR |
|---|---|---|
| 69 | robots 값 SSOT — `max-image-preview:large` 명시 + noindex 가 크롤러별로 갈린 것 | `882fa4089` |
| 70 | `/s/:username` 유어샵 크롤러 본문 6자 → 채움(앞으로 **모든 신규 매장**의 기본 경로) | `b6cb55027` |
| 71 | 상세 제목 SSOT — 숙소는 Googlebot 이 지역을 잃었고 교환권 ~135건이 "교환권 교환권" | `dc1822d3f` · 가드 재조준 `a0bdc35f6` |
| 72 | `/pass` 310건 빵부스러기가 같은 URL 을 두 번 + 루트 이름 두 벌(`홈` 359 ↔ `유어딜` 90+) | `3b2f2dbd3` |
| 74 | 가게 유어샵이 `/s/` 와 `/profile/` 두 URL 로 색인 경쟁(각자 자기를 정본으로) | `6d5e83652` |
| 75 | 숙소 소개 문구 치유가 **한 번도 안 돌았다** — 색인 49건이 대표가 지적한 그 문장 | `7e1beed2c` · 래칫 `e0860288a` |
| — | CI 빨강 수리(🩸 ②) | `57a377e0d` |
| 78 | `/urshorts` 가 색인 대상인데 **내부 링크 0** — 딜이 붙은 행을 그 딜로 링크 | 이 커밋 |
| 49 | (판정 종결) `Product.brand` — `/pass`·`/stays` 는 **이미 낸다** · `/products` 는 **일부러 안 낸다**(셀러 ≠ 브랜드) | 코드 변경 없음 |
| 73 | 한 문서에 같은 `@type` 두 벌(서버 + react-helmet) — 약 380 URL. `SEO.tsx` 에서 거른다 | PR #1808 |
| 79 | **줄표(em-dash)가 색인 365건의 검색 스니펫에** — 가드 범위가 워커 문구 생성기를 안 봤다 | 이 커밋 |
| 80 | **가게 유어샵(`/s/:username`)에 구조화 데이터 0건** — 개인 유어샵은 ProfilePage+ItemList 를 낸다 | 이 커밋 |
| 81 | **`/map` 이 본문에서 8건을 링크하는데 `ItemList` 는 0건** — 형제 `/stays` 와 같은 클래스의 누락 | 이 커밋 |
| 82 | **색인 상세 360건 중 134건이 고아**(내부 링크 0) — 지역 요약 묶음 캡 10 + noscript 캡 8 이 101건을 잘랐다. 둘을 30 으로 → 도달 **239 → 345** | 이 커밋 |
| 83 | **숙소 49건이 Product 별점을 잃고 있었다** — 평점이 `LodgingBusiness` 에만 있어 **정본(`/stays/:id`)이 사본(`/pass/:id`)보다 약했다** | 이 커밋 |
| 45 | (판정 종결) 로고·유달이가 구글 이미지에 — **코드 결함 아님**(아래 2차 스윕 표) | 코드 변경 없음 |

앞서 머지된 것들: `#1789`(제목·alt 표 SSOT) · `#1785`(sitemap↔색인의도↔본문 짝 전수) ·
`#1783`(법정문서 본문) · `#1778`(thin URL 두 갈래 + 공개 API 수수료율 차단).

## 🩸 이번에 틀렸던 판단 (같은 오진 반복 방지 — 이게 제일 값지다)

**① 하마터면 거짓 결함을 보고할 뻔했다.** `/pass`·`/stays` 의 JSON-LD `image` 가 R2 공개 도메인이
아니라 `/api/media/` 라서 *"3.5배 느리다"* 고 보고하려 했다 — 근거는 CLAUDE.md 에 적힌 숫자였고
**기억으로 인용**한 것이었다. 실측하니 워커 0.207s ↔ R2 0.199s 로 **차이가 없었다**. 그 3.5배는
*Cloudflare 리사이저가 원본을 가져올 때*의 숫자이고 소비자가 다르다. ⇒ **문서의 숫자를 다른
소비자에 옮겨 쓰지 말 것.**

**② `handoff-index-sidecar` 시험이 "가드가 제 일을 하는 순간" 빨간불이었다.** 그 단언이
`'인계 문서 동기화'` 를 앵커했는데 그 문구는 `check-current-work-sync.mjs` 의 **✅ 경로에만** 있다
(`:39·46·54·58·62`). 경고 경로는 `⚠️ 인계 문서 미갱신` 이라, *소스를 바꿨는데 인계 문서가 없는
브랜치* = **가드가 정확히 신고해야 하는 상태**에서 시험이 터진다. main 에서는
`기본 브랜치 (skip)` 라 늘 초록이어서 **몇 달간 안 보였고**, 이 PR 이 CI 를 그걸로 **네 번** 태웠다
(`882fa408`·`a0bdc35f`·`7d38ce72`·`c0150ea9`). ⇒ 시험의 일은 *판정이 무엇인가*가 아니라
**판정에 도달했는가**다. 되돌려-검증 둘로 확인했다(출력 0 → 빨강 · 결론 없는 출력 → 빨강).
🔑 그리고 **그 가드가 옳았다** — 이 세션이 소스 21개를 바꾸고 인계를 안 쓰고 있었다(이 문서가 그 수습).

**③ 내 JSON-LD 계수기가 중첩 노드를 세고 있었다.** `Organization: 2`(브랜드 + `parentOrganization`)
`BlogPosting: 40` 을 중복으로 읽을 뻔했다. 중복의 믿을 만한 신호는 **helmet 표식**(`data-rh`)
개수다 — 실제로 클라가 더하는 JSON-LD 가 있는 곳은 `/pass`(2)·`/products`(1) 뿐이다.

**④ 측정기 사고 둘** — `buildDetailMeta` 인자 순서를 `(payload, pathname, origin)` 으로 잘못 호출해
`유어딜=/pass/2823/` 가 나왔다(실제는 `(ssrPayload, origin, pathname)`). 그리고 게이트 출력 필터가
`Error:` 를 집어 `no such table: rate_limit_attempts` 30줄이 **진짜 실패를 덮었다** — 파일 선택을
직접 재현하고 vitest 를 직접 돌려 `^ *FAIL` 로 찾았다.

## 🔎 2차 스윕 — 측정으로 **기각한 것**이 더 많았다

재 보고 **결함이 아님**으로 닫은 것들(다시 파지 말 것):

| 각도 | 실측 | 판정 |
|---|---|---|
| og:image 404 | 29표면 · 고유 6개 **전부 200** · `og:image:alt` **누락 0** | 깨끗 |
| 크롤러 UA 파리티 | `/`·`/vouchers`·`/pass/:id`·`/u/:handle`·`/faq`·`/region/서울` 에서 Googlebot·Yeti·OAI-Search·Claude-SearchBot·Perplexity·iPhone **본문 길이 전부 동일** | 깨끗 |
| 블로그 `author`·RSS | `author: Organization "유어딜 팀"` · `publisher: @id` · 상세에도 `rel=alternate rss` 1건 | 깨끗 |
| `/urshorts` `VideoObject` 0 | **의도**다. 남의 유튜브 영상이라 발행하면 우리가 출처라고 말하는 셈(모듈 머리말 + 가드) | 비결함 |
| `Vary: User-Agent` 없음 | HTML 은 `cf-cache-status: DYNAMIC` + `cache-control: no-cache` = **아무도 캐시하지 않는다** ⇒ UA 로 문서가 갈려도 섞일 경로가 없다 | 비결함 |
| sitemap thin 4건 | `/browse` 60자·`/products/2917` 46자 → 라이브 쇼핑 상품이 **1건**이라 그렇다(데이터 사실) · `/u/user40` 58자 → 핀 1개(설계대로 본문 생성) · `/s/store_mux…` 22자 → **이 PR 의 #70 이 아직 라이브에 없다** | 비결함 |
| `/region` 허브 `ItemList` 0 | 다른 목록은 다 내는데 허브만 없다. 다만 항목이 **지역 페이지**라 리치결과 가치가 거의 없고 링크 11개는 이미 있다 ⇒ **안 한다**(가치 < 코드) | 보류 |
| **canonical 자기일치 전수** | sitemap **32모양 40표본** 전부 `200` · canonical **정확히 1개** · 자기 자신 · `og:image` 보유 · `index, follow, max-image-preview:large` | 깨끗 (짝 주장 성립) |
| **og:image 실바이트** | 고유 **8종 전부** `200` + `image/*` + 9KB~100KB (카카오 스크래퍼 UA) | 깨끗 |
| **`X-Robots-Tag` 헤더** | 색인 대상 9표면 + sitemap 에 **전부 없음**(메타만 쓴다) | 깨끗 — 조용한 색인 차단 0 |
| **제목·설명 중복** | 32모양 **72표본**에서 제목 중복 0 · 설명 중복 0 | 깨끗 |
| **`Product` 상품 필드** | `/pass`·`/stays` 는 `brand`+`offers`(url·availability·availableAtOrFrom) 완비 · `aggregateRating` 은 **리뷰 있을 때만**(지어내지 않는다) | 깨끗 |
| `sku`·`gtin`·`priceValidUntil`·`itemCondition` | **일부러 안 낸다** — 이용권·숙소는 SKU 체계가 없고 `priceValidUntil` 은 지키지 못할 날짜를 지어내는 것이다 | 비결함 |
| `hasMerchantReturnPolicy`·`shippingDetails` | 구조화 데이터로 환불·배송 정책을 **선언**하는 것인데, `/refund` 본문 자체가 결재 대기(#25 — 남의 서비스 약관이 떠 있다)다. 틀린 정책을 기계가 읽는 형태로 발행하는 쪽이 더 나쁘다 ⇒ **#25 결정 뒤** | 보류(#25 선행) |
| **#45 로고·유달이가 구글 이미지에** | ① `Organization.logo` = `/icon-512.png` → **200 · 186,948B**(실존) ② robots 가 `/assets`·`/icon-*` 을 **안 막는다**(`Googlebot-Image` 로 마스코트 200 · 12,540B) ③ 크롤러 문서에 마스코트 `<img>` 가 **전 표면에 있다** ④ 그런데 `alt` 가 **비어 있고 그게 의도다** — 그건 로딩 스피너이고 장식이다(CLAUDE.md 가 그렇게 적어 뒀다) ⑤ 로고 워드마크는 **그림이 아니라 글자**다(봇 문서 인라인 `<svg>` **0개**) | **비결함** — 구조화 데이터로 되는 일이 아니다. 로딩 스피너에 설명 `alt` 를 달면 접근성 결정을 되돌리는 것이고, 브랜드 존재감의 레버는 구글 이미지가 아니라 **지식 패널**(이미 `Organization.logo` 보유)이다 |
| `/products/:id` `brand` 없음 | 라이브 쇼핑 상품 1건의 `brand_name` 이 **null**(데이터 사실) · 빌더는 값이 있으면 낸다 | 비결함 |
| `app.get('*')` 봇 OG 블록 | `/products`·`/u`·`/blog` 지문을 라이브에서 세니 **0건** — HTMLRewriter 경로가 이긴다(CLAUDE.md 2026-07-01 기록과 일치). 그 안의 `유어딜 블로그 — 라이브 커머스 가이드`(영구중단 기능)도 **서빙되지 않는다** | 죽은 코드 (삭제는 잠금 파일이라 별건) |
| **#78 E4 (라이브)** | `/urshorts` 에 `<a href="/pass/…">` **2건** · 앵커 글자가 `쌀국수 + 분짜 2인 세트 판매가 23,400원 (13% 할인)` · `/vouchers/`·`/products/` **0건**(반대 방향) | ✅ 통과 |

## 🧬 #73 처방 — 왜 `SEO.tsx` 에서 걸렀나

클라 노드를 내는 자리는 다섯(`GroupBuyDetailPage`·`ProductDetailPage`·`BlogDetailPage`·
`RegionPage`·`RegionIndexPage`)이고 그중 **`GroupBuyDetailPage.tsx` 는 로딩 잠금표 파일**이라
대표 승인이 필요하다. `SEO.tsx` 한 곳에서 거르면 잠금 파일을 안 건드리고 다섯이 함께 해소되며
앞으로 생길 표면도 자동으로 같은 규칙을 받는다.

🩸 **설계를 한 번 되돌렸다.** 처음엔 서버 종류를 모듈 변수에 **캐시**했는데, 그러면 *첫 `<SEO>`
렌더가 언제인지*에 판정이 매달려 **검증할 수 없다** — 실제로 시험이 헛돌았다(서버 노드가 없던
첫 렌더에서 빈 집합이 굳어 두 번째 렌더에서 아무것도 안 걸렀고 **그래도 초록**이었다).
매 렌더에 다시 읽도록 바꾸고, 기준 경로만 **모듈 로드 시점**에 잡는다(엔트리는 defer 라 그때
문서는 이미 파싱돼 있다). 그리고 ④에 **양성 통제**를 넣었다 — *"서버 노드가 없으면 클라 노드가
뜬다"* 를 먼저 단언해야 "0개" 가 *걸러진 것*인지 *helmet 이 안 쓴 것*인지 구분된다.

🩸 **주입 하나가 헛돌아 교체했다.** `if (!serverTypes.size) return list` 를 지우는 주입을 심었는데
통과했다 — 그 줄은 성능 단축이고 빈 집합에서는 `every` 가 전부 false 라 **행동이 같다**.
⇒ 행동이 안 바뀌는 자리에 주입을 두면 커버리지를 가진 척만 한다. 실제로 지켜지는 관용
(깨진 서버 블록 하나가 전체를 못 쓰게 만들지 않는다)으로 옮겼고, 같은 과장이 있던 주석도 정정했다.

## 🩸 2차 스윕에서 틀린 것 — 내 측정기가 거짓 차이를 만들었다

AI 검색봇이 **모든 표면에서 정확히 +151자**를 받는다고 읽고 *"#17 과 같은 클래스(봇 문서에 상수
보일러플레이트)"* 로 보고하려 했다. 그 151자의 정체는 `index.html` 의 **HTML 주석**이었다 —
내 본문 추출기가 `<[^>]+>` 로 태그를 지우는데 그 주석 안에 `<SEO>` 가 있어 `<!-- … <SEO>` 까지만
한 태그로 먹고 **주석 뒷부분을 본문으로 셌다**. 브라우저·크롤러는 `<!-- … -->` 를 통째로
주석으로 읽으므로 **아무도 그 글자를 안 본다.** 주석을 먼저 지우고 다시 재니 여섯 UA 가 **전부 동일**했다.

⇒ **이 레포의 `check-comment-stripper` 가 막는 그 클래스를 내 하네스가 밟았다.** 레포 가드는
괜찮다(확인: `index.html` 을 읽는 `inapp-block-removed` 는 `execMarkup` 이 주석을 **먼저** 지운다 ·
나머지는 전부 *우리 빌더 출력*을 재므로 주석이 없다). **HTML 본문을 잴 때는 주석을 먼저 지운다.**
이 세션 세 번째 측정 오류다(앞의 둘: 기억으로 인용한 이미지 속도 · 중첩 `@type` 계수).

## 🩸 3차 스윕에서 틀린 것 / 거짓 주장을 내가 썼다

1. **`stay-property-type.ts` 머리말이 거짓이었다.** 어제(같은 날) 내가 그 파일에
   *"`check-anti-slop-copy` 는 이 파일을 본다"* 고 적어 뒀는데 **사실이 아니었다** — 줄표를
   주입해도 가드가 `em-dash 0` 으로 통과했다(실측). 그 가드의 범위는 `.tsx` + `src/shared/seo/*.ts`
   뿐이고 그 파일은 `src/shared/` 최상위다. ⇒ 범위에 **실제로** 넣고 머리말을 정정했다.
   🧭 **"가드가 본다" 고 적을 때는 주입해서 확인할 것.** 거짓 주장은 다음 세션이 없는 가드를 믿게 만든다.
2. **내 새 시험의 바닥 단언이 헛돌았다.** `COPY_BUILDER_FLOOR` 를 `\d+` 로만 봤는데 **`= 0` 도 숫자다** —
   주입이 바닥을 0 으로 내려도 통과했다. 바닥의 일은 "몇 개여야 한다" 가 아니라 **디렉터리가
   통째로 사라진 것을 잡는 것**이고 0 이면 그걸 못 한다 ⇒ 숫자를 꺼내 `>= 5` + `<= 실제 개수`로.
3. **시험 픽스처를 두 번 지어 썼다.** ⓐ 유어샵 핀은 **평평한 `product_name`** 인데 `name` 으로 썼고
   (그 파일 머리말이 **바로 그 함정을 경고**하고 있었다) ⓑ `buildCuratorNoscript` 는 **객체**를 받는데
   `JSON.stringify` 를 넘겼다(문자열을 받는 건 `curatorNoscriptFromPayload` 다). 둘 다 **에러 없이
   `''` 를 돌려주므로** 단언이 빈 문자열을 검사하게 된다. ⇒ **시드 모양은 기억이 아니라 타입에서.**
4. **가드 findings 는 stderr 다.** 주입 시험을 `e.stdout` 으로 판정했더니 늘 빈 문자열이라
   "무엇 때문에 빨간불인지" 를 못 봤다 ⇒ stdout+stderr 합본을 보는 `runGuard()` 헬퍼로.
5. **`ls public/*.png | head` 로 파일이 없다고 오판할 뻔했다.** `Organization.logo` 가
   `/icon-512.png` 인데 그 목록에 안 보여 "없는 파일을 가리킨다" 로 읽었다. 실제로는 존재하고
   **라이브 200**이다(`head -12` 가 잘랐을 뿐). ⇒ **파일 부재는 목록이 아니라 조회로 판정할 것.**
6. **추정으로 상한을 움직이려 했다.** 지역 요약 묶음 캡을 10 → 30 으로 올리면서 *"실측 104KB →
   약 139KB"* 로 추정해 `REGION_DIGEST_MAX_BYTES` 를 300KB → 600KB 로 올렸다. 그런데 **진짜
   빌더를 라이브 359행에 돌려 보니 83,716B → 111,740B** 였다(종전 주석의 "104KB" 자체도 틀렸다).
   상한의 19% 라 **상향이 애초에 불필요했고** 되돌렸다. 🧭 **이 파일의 빌더는 그냥 돌려서 잴 수
   있다 — 추정으로 방어선을 움직이지 말 것.** 그리고 같은 실측이 분포 시뮬레이션의 예측
   (334)보다 실제가 **345** 로 좋다는 것도 알려 줬다(요약 행이 원본 순서를 보존해 시/도 페이지가
   버킷을 섞는다 — 시뮬레이션은 버킷을 이어 붙여 봤다).
7. **캡에 고정된 개수를 적은 브리틀 시험.** `region-digest` 픽스처가 종로구 `20`건·숙소 `15`건을
   손으로 적어 두고 *"정확히 `REGION_DIGEST_PER_BUCKET`"* 을 단언했다 — 캡이 10 → 30 이 되는
   순간 깨졌다. 🔑 **픽스처가 캡보다 작으면 그 단언은 상한이 아니라 픽스처 크기를 잰다**(캡을
   올리면 깨지고, 캡을 내리면 조용히 헛돈다). `OVER_CAP = 캡 + 5` 로 파생시켜 캡 값과 무관하게
   의미가 서게 했다.
8. **상한 값을 시험에 손으로 적어 둔 자리가 또 있었다.** `crawler-internal-links` 의
   *"상한 8"* 이 지역 페이지에도 `8` 을 단언해서 내 30 변경에 깨졌다(pre-push 게이트가 잡았다).
   🔑 지키려던 불변식은 **"숫자 8"이 아니라 "상한이 있다 · 전량 덤프가 아니다"** 이므로
   `REGION_NOSCRIPT_ROWS` 에서 받아 재고, 목록 표면(`/map`)은 8 그대로임을 함께 단언했다.
   ⚠️ **상한을 두 표면이 공유한다고 전제하지 말 것** — 이제 갈렸고 그게 의도다.
9. **응답 봉투를 또 지어 썼다.** `/api/curator/:handle` 을 `j['data']['pins']` 로 읽었는데 그
   응답은 **`data` 래퍼가 없다**(키가 최상위). 빈 dict 를 읽어 `pins=0 · linked_seller=False` 로
   보고 *"sitemap 과 API 의 술어가 갈렸다"* 는 가짜 결함을 한 사이클 추적했다 — 실제로는
   **핀 1건 + linked_seller 있음**이고 두 술어는 글자까지 같았다. 🧭 **같은 세션에서 두 번째다**
   (앞은 `buildCuratorNoscript` 가 객체를 받는데 문자열을 넘긴 것). **봉투 모양은 먼저 키를 찍어
   보고 쓸 것** — 둘 다 `0`/`''` 를 돌려주므로 "없다" 와 "잘못 읽었다" 가 구분되지 않는다.
   그리고 그 추적 중에 **임계값을 임의로 세운 것**도 오류였다: 본문 60자 미만을 위반으로 쳤는데
   `/u/user40` 의 58자는 그 가게에 상품이 1건뿐이고 소개가 없어서 나온 **정직한 최소 본문**이다.
10. **기존 시험이 두 가지로 낡아 있었고, 내 `/map` 변경이 그걸 드러냈다.**
   `surface-list-jsonld` 의 *"항목을 내는 표면은 `/`·`/browse` 뿐"* 이 **2026-10-12 에 `/stays` 가
   허용목록에 들어간 뒤에도 초록**이었다 — 그 줄이 통과한 이유가 고약하다: 픽스처가 식사권 **1건**
   이라 `/stays` 의 `keepItem` 에 **어차피 걸러졌다**(= 허용목록에서 `/stays` 를 빼도 결과가 같다
   ⇒ 그 줄로는 아무것도 판정되지 않았다). 🧭 **허용목록을 시험할 때는 표면마다 "항목이 생길 수
   있는" 시드를 줘야 한다** — 그러지 않으면 데이터 탓으로 헛돈다(이 레포가 2026-10-11 에 같은
   자리에서 값을 치렀고 그 교훈이 바로 윗줄 주석에 적혀 있었는데도 다시 났다).
   ⇒ 지우지 않고 재조준(허용목록 **넷**을 동작으로 세고, 숙소 행을 함께 넣어 "어차피" 를 없앴다)
   + `/map` 전용 시험 하나 + 주입 하나. 그리고 그 변경이 기존 주입 앵커(`/vouchers`)를 또 낡게
   만들어 그것도 재조준했다 — **허용목록은 자라므로 이 앵커는 또 낡는다.**

## 🔎 4차 스윕에서 재서 **기각**한 것 (다시 파지 말 것)

전부 라이브 크롤러 UA 실측이다. 결함이 아니거나, 처방이 병보다 나쁘거나, 데이터가 없다.

| 각도 | 실측 | 판정 |
|---|---|---|
| 매장 영업시간(`openingHoursSpecification`) | 코드·DB 에 영업시간 필드가 **0개** | 지어낼 수 없다 — **데이터 부재** |
| `priceRange`(LocalBusiness) | 딜 1건의 가격으로 가게의 가격대를 말할 수 없다 | 지어내기 |
| `/u/:handle/p/:id`(소개비 귀속) | 200 + **canonical → `/u/{handle}`**(정상 통합) · 본문 20자 | 통합되므로 색인 안 됨 |
| `/pass/2919` 설명 누락 | DB `description` 이 **9자**(`달빛한스푼 이용권`)이고 그게 본문에 들어 있다 | 데이터 사실 |
| 지역 허브 → 시군구 링크 | 시군구 **32건 전부** 링크됨(`/region` 11 · `/region/서울` 14 …) | 이미 됨 |
| `<html lang>` · `og:locale` · 압축 | 전 표면 `lang=ko` · `ko_KR` · **brotli** | 이미 됨 |
| 지역 44건 제목·설명 중복 | 제목 **고유 44** · 설명 **고유 44** | 이미 됨 |
| `X-Robots-Tag` · `Content-Language` 헤더 | 없음(메타 `robots` 로 충분) | 불필요 |
| 상세 → 상세 연관 링크 | 상세 페이로드 **1,566B 에 형제 딜이 없다** | 새 시드 = 서브리퀘스트 예산 |
| `/vouchers/:id` 빵부스러기·Product 0 | **`noindex, follow`**(2026-07-07 결정) | 의도와 일관 |
| `/products/` 크롤러 본문 46자 · 링크 0 | sitemap 제출이 **1건**(순수 쇼핑 상품이 하나뿐) | 영향 1 URL — 쇼핑 재개 시 재검토 |
| sitemap **짝 주장** 전수(비상세 95 전수 + 상세 40 표본) | 위반 **1건**(`/u/user40` 58자) → 재 보니 핀 1건·소개 없음이라 **폴백이 제대로 일한 결과** | 데이터 사실(상품 1건) |
| `Product` 리치결과 필수 필드 | `/pass`·`/stays`·`/products` 전부 `name`·`image`·`offers`(price·priceCurrency·availability) **누락 0** | 이미 됨 |
| `llms.txt` 최신성 | 9,189B · 수수료 10%(대행사 5%) · 유어샵 · 교환권↔이용권 구분 전부 현재 사실 | 이미 됨 |
| `/products/2917` `brand` 없음 | 응답에 `brand_name` 필드가 **아예 없다**(브랜드가 없는 상품) | 데이터 사실 |

## ⏳ 남은 결정 / 대기 (대표 판단)

**🍞 `/pass` 261건의 빵부스러기가 2단이다 (숙소 49건만 3단)** — 실측:

      /pass/2919  (식사)  LD  유어딜 › 달빛한스푼 닭도리탕            보임  홈 / 식사 이용권 / 제목
      /stays/2887 (숙소)  LD  유어딜 › 숙소 › 그랑블루글램핑&펜션      보임  홈 / 숙소 / 글램핑
      /products/  (쇼핑)  LD  유어딜 › 쇼핑 › 프리미엄 무선아이폰

숙소·쇼핑은 중간 단계가 **정본 표면**(`/stays`·`/browse`)을 가리켜 사슬이 나아간다. 식사·미용·
기타는 그 **정본 표면이 아예 없다** — 보이는 크럼의 중간은 `/?category=meal_voucher` 인데 그
URL 은 `canonical → /` 로 통합된다(2026-10-12 #26 의 결정). ⇒ 선택지 둘:
  ⓐ 지금처럼 2단 유지(유효하고 안전하다 — 접히는 것은 #72 의 의도)
  ⓑ **식사·미용·기타의 정본 카테고리 착지 페이지를 만든다**(`/stays` 와 대칭). 그러면 사슬이
     `유어딜 › 식사 이용권 › 가게명` 이 되고 **색인 대상 허브가 셋 늘어** 고아 상세에도 도움이 된다.
     다만 새 표면 셋 = 메타·본문·sitemap·내부 링크 설계가 붙는 **기획 결정**이다.
⚠️ ⓑ 없이 `/?category=` 를 빵부스러기에 넣는 것은 **권하지 않는다** — 통합되는 URL 을 사슬의
   중간으로 선언하는 것이고, #72 가 *"별칭 URL 을 쓰지 않는다"* 로 이미 배제한 방향이다.


- **#76 IndexNow 켜기** — 코드는 완성, 게이트 OFF. 대시보드 → ur-live → Settings → Variables →
  `INDEXNOW_KEY`(영숫자 8~128) + `INDEXNOW_ENABLED=true`. 켠 뒤 `https://urdeal.kr/{key}.txt` 가
  200 + 키 본문인지 확인. (키 파일 라우트는 게이트와 무관하게 응답하므로 **켜기 전에 확인 가능**.)
- **#31 결재** — `/pass/:id` 공유 카드 SVG → 사진 한 장?
- **#35 결재** — `/pass/:id` 310건 검색 제목의 "공동구매" 문구 + 꼬리 가게명
- **#68 결재** — `twitter:site` 가 없는 계정(@urdeal_kr · @utongstart)을 가리키는가

**🔒 `SellerPublicPage.tsx` 의 `Person` JSON-LD (대표 판단)** — 가게 유어샵 화면이 자기
`<SEO jsonLd>` 로 `@type: 'Person'` 을 내는데 ① **가게는 사람이 아니다** ② `url` 이 **비정본**
`/profile/:username` 이다(2026-10-14 #74 로 정본은 `/s/:username` 이 됐다). 그 파일은 **로딩
잠금표**(잠긴 항목: `__SSR_INITIAL_SELLER__` 즉시 소비)라 객체 리터럴 한 줄도 승인이 필요하다.
🔑 **크롤러에는 도달하지 않는다** — 봇 UA 는 스크립트 없는 문서를 받아 React 가 돌지 않는다
(2026-10-14 실측). 그래서 지금 손해는 **GEO 쪽뿐**이고(AI 검색봇·사람은 JS 를 돌린다),
2026-10-14 의 중복 제거(`jsonld-dedupe`)도 **종류가 안 겹쳐서** 안 지운다.
⇒ 고치는 방법 둘: ⓐ 그 블록을 지운다(서버가 #80 으로 같은 일을 더 정확히 한다) ⓑ `@type` 을
`ProfilePage` 로 바꿔 중복 제거가 삼키게 한다. **ⓐ 가 낫다** — 서버 노드가 정본 URL 과
`Organization` 을 이미 들고 있으므로 클라가 같은 말을 할 이유가 없다.

**🔒 잠금 파일에 남은 줄표 3곳 (대표 판단)** — `src/worker/index.ts` 는 로딩 잠금표 파일이라
문자열 한 줄도 승인이 필요하다. 지금은 **동결만** 해 뒀다(`anti-slop-baseline.json` 의
`lockedEmDash: 7` + 사유). 라이브에서 보이는 것은 셋이다:

| 줄 | 무엇 | 라이브 |
|---|---|---|
| `:832` | `/blog` **제목** `유어딜 블로그 — 이용권·교환권·동네딜·유어샵 가이드` | 보인다(검색결과 제목) |
| `:902` | `/u/:handle` 설명 폴백 `{이름}님의 추천 — 교환권·이용권 모음` | 보인다(소개 없는 유어샵 2건) |
| `:790` | 유어애즈 랜딩 제목 `유어애즈 UR Ads — 네이버 검색광고 …` | 보인다 |

나머지 넷은 **고칠 필요가 없다**: `:1238` 은 내부 헬스체크 문구, `:2403`·`:2415`·`:2459` 는
라이브 실측 **0건인 죽은 코드**(`app.get('*')` 봇 OG 블록). 셋을 고치려면 `[UNLOCK_LOADING]`
audit log 1줄 + 승인이면 되고, 줄 수는 안 늘어난다(문자열만).

## 🔭 아직 안 재 본 각도 (다음 스윕 후보)

- `/pass/:id` 에 `review` 노드(개별 후기) — `review_count 6`·`avg_rating 4.7` 이 있고
  `aggregateRating` 은 이미 나간다. 별은 그걸로 충분해 **가치가 작다**(후기 본문·작성자 데이터를
  먼저 재야 한다).
- `/urshorts` 행의 `product_image`(우리 사진)를 크롤러 본문에 넣을지 — #59 와 같은 축이지만
  `thumb_url`(남의 유튜브 썸네일)과 섞이지 않게 **우리 사진만** 골라야 한다(별건).
- `/products/:id` 는 **렌더 뒤 `h1` 이 0개**다(실측). 크롤러 본문(`<noscript>`)엔 `<h1>` 이 있지만
  화면에는 없다. 라이브 소비자 쇼핑 상품이 **1건**이라 지금 가치는 작다 — 쇼핑을 다시 열 때 볼 것.
- **문서가 UA 로 갈리는 구조를 글로 남겨 둘 것** (이 세션에 처음 실측했다): `BOT_UA_REGEX` 에
  걸리는 UA 는 **스크립트·스타일시트가 아예 없는 문서**를 받는다(`/pass/2823` 에서 script/link
  태그 15개 전수 확인 — 엔트리 `<script>` 없음). 그래서 Googlebot·Yeti 는 **서버 첫 화면 +
  `<noscript>` + JSON-LD** 만 본다. AI 검색봇은 그 목록에 **없어서** `index.html`(앱 포함)을 받는다.
  ⚠️ 2026-10-12 에 *"AI 봇을 BOT_UA_REGEX 에 넣지 않았다 — 얻는 것이 보일러플레이트 제거뿐"* 이라고
  적었는데, 그 전제는 이제 틀렸다(#73 중복도 함께 사라진다). 다만 JS 를 렌더하는 AI 봇에게는
  **내용이 줄어드는** 쪽이라 교환이고, #73 을 `SEO.tsx` 에서 고친 뒤에는 남는 이득이 48KB 절약뿐이다.

### #84 · 이용권 상세 294건이 평점을 **본문에서** 잃고 있었다 (JSON-LD 엔 있다)

**실측(Googlebot UA · noscript 본문과 JSON-LD 를 따로 셌다)**

      표면            JSON-LD aggregateRating      크롤러 본문 '평점'
      /pass/2793      ratingValue 4.7 · 9개 리뷰     ❌ 없음
      /pass/2906      ratingValue 4.8 · 9개 리뷰     ❌ 없음
      /stays/2887     (Product 에 있음 — #83)        ✅ "평점 4.6 (9개 리뷰)"

`/pass` **310건 중 약 294건(95%)** 이 `avg_rating`·`review_count` 를 갖고 있다(API 샘플 60 중 57).
즉 **sitemap 455건의 65%** 가 가진 숫자를 본문에서 잃었다.

**원인은 선언 누락 하나** — 값은 시드에 이미 와 있는데 `NoscriptDetailSeed` 에 두 필드가 없어서
빌더가 쓸 수 없었다. 에러가 안 나고 숙소는 멀쩡해서 재 본 사람만 안다(#83 과 같은 비대칭).

**수리**: 평점 줄을 `ratingLine(avg, count)` **SSOT** 로 뽑아 숙소·이용권이 **같은 함수**를 쓴다
(문구를 베끼면 조용히 갈린다 — 주입이 그 방향을 고정). 자리는 숙소와 같은 `가격 → 평점 → 주소`.
🔴 리뷰 0·별점만·음수는 **아무것도 안 낸다**(2026-10-11 에 `ratingValue: 0` 으로 값을 치른 그 자리).

**빌더를 돌려 눈으로 봤다**: `판매가 32,400원 · 정가 37,000원 · 12% 할인 평점 4.7 (9개 리뷰) 주소 …`
· 반대 경우 셋 전부 평점 없음 · 숙소 출력 **불변**.

가드 `detail-rating-line-2026-10-14.test.ts` 7건 + 주입 **5건 되돌려-검증 전부 빨간불 확인**.
🩸 그중 하나가 **제 가드의 헛돎을 잡았다** — 선언을 파일 전체에서 찾았더니 **숙소 시드에도 같은
두 줄이 있어** 이용권 쪽에서 통째로 지워도 늘 통과했다 ⇒ 인터페이스 블록을 떼어 그 안에서만 센다.

⚠️ **E4**: 배포 후 `curl -A '<Googlebot>' https://urdeal.kr/pass/2793` 의 `<noscript>` 에
`평점 4.7 (9개 리뷰)` 가 있는지 · **반대 방향** `/pass/2919`(리뷰 0)엔 '평점' 이 **0건**인지.

### #85 · 이용권 310건이 할인율을 통째로 잃고 있었다 (+ 설명이 얇았다)

**실측(라이브 API 샘플 45건)**

      current_discount_pct > 0      0건
      discount_rate        > 0      0건
      정가·판매가로 계산    > 0     45건  (중앙 20%)

종전 description 은 `d.current_discount_pct` 를 믿었으므로 `🎉 N% 할인` 분기가
**310건에서 한 번도 돈 적이 없다.** 커머스 스니펫에서 가장 강한 신호가 구조적으로 빠져 있었고,
**같은 파일의 `<noscript>` 본문은 이미 맞게 "11% 할인" 을 말하고 있었다** — description 만 밖에 있었다.
이 레포엔 바로 그 사고를 위해 만든 SSOT 가 있다(`priceDisplay` 의 `Math.max(선언값, 계산값)`,
2026-08-19 대표 신고 *"할인율도 나타나야 할 것 같다"*).

**함께**: 설명이 **중앙값 50자 · 46%가 50자 미만 · 전부 80자 미만**이고 그중 14자가 310건 공통
상투구였다(고유한 부분 25~30자). 숙소는 백필 뒤 **중앙값 71자**로 별점·지역·가격·소개를 담는다
(#83·#84 와 **같은 비대칭**). 가진 값은 다 있었다 — 별점 294/310 · 설명 98% · 주소 · 정가.

**수리**: 할인율을 `priceDisplay` 로 + 별점(`⭐4.7`)·지역(`parseRegionFromAddress` SSOT)·정가·설명.
없으면 그 조각만 빠진다(36~66자로 우아하게 줄어든다).

**빌더를 돌려 눈으로 봤다**: 라이브 모양(선언 0) → `11% 할인` · 선언 30% → `30% 할인`(Math.max) ·
정가=판매가 → 할인율 없음 · 리뷰 0 → `⭐` 없음 · 주소 파싱 실패 → 지역 없음 · 설명=상품명 → 1회만.

가드 `pass-description-2026-10-14.test.ts` 10건 + 주입 **7건 되돌려-검증 전부 빨간불 확인**.
🩸 둘이 제 가드의 결함을 잡았다 — ① 배선 정규식 `\bdiscount > 0` 이 **`pd.discount` 의 점 뒤에서도
매치**돼 멀쩡한 코드에 거짓 빨간불 ② 줄표 단언이 **할인 분기만** 봐서, 줄표 주입이 *할인 없는*
분기에 들어가 통과했다 ⇒ **분기가 둘이면 단언도 둘이어야 한다.**

🔴 **화면 쪽 절반은 결재 대기** — `GroupBuyDetailPage.tsx`(잠금표)의 `<SEO description>` 은 아직
`🎉 N% 할인! … 공동구매 — {group_buy_current}명 함께 구매 중` 이고, react-helmet 이 서버 메타를
덮으므로 **JS 를 렌더하는 Googlebot 이 받는 쪽이 그것**이다(줄표 + 98%가 `0명`).
결재 파일 `docs/decisions/2026-10-14-pass-description.md`. 고쳐진 척하지 말 것.

⚠️ **E4**: 배포 후 `/pass/2793`·`/pass/2919` 의 `description` 에 `% 할인` 과 `⭐` 가 생겼는지 ·
**반대 방향** 할인 없는 상품엔 `% 할인` 이 **0건**인지 · 줄표가 **0건**인지.

### 5차·6차 전수에서 **반려한 것** (다시 파지 말 것)

| 축 | 실측 | 판정 |
|---|---|---|
| 쿼리 변형 canonical | `?sort=`·`?page=` 8종 전부 기본 주소로 통합 | 멀쩡 |
| sitemap 455건 생존 | **200 아님 0 · noindex 0 · canonical 불일치 0** | 멀쩡 |
| Googlebot vs AI 봇 본문 | 측정기를 고치니 **6표면 전부 동일**(115~428자) | 측정 artifact |
| BlogPosting `image` | `thumbnail_url` 전건 null → 일부러 안 낸다 | 2026-10-12 결정 |
| merchant listing 필드 | `shippingDetails`·`hasMerchantReturnPolicy`·`priceValidUntil` 부재 | 메우려면 지어내야 함(환불약관은 결재 #25) |
| RSS 자동발견 | `/blog` 에 `<link rel=alternate>` 있음 · 피드 200/11KB | 멀쩡 |
| `/s/:username` 구조화 데이터 0 | PR #1808 의 ⑤가 **아직 머지 안 됨** | 라이브와 일관 |
| `N명 함께 구매 중` 문구 자체 | 폐기된 것은 *"N명 더 모이면 할인 시작"*·마감 | **제 성급한 단정을 정정** |

### #86 · 블로그 목록 JSON-LD 가 같은 글 20편을 두 벌 (문서의 61%)

**실측(Googlebot UA · 블록별)**

      ld 블록 2개 · 총 20,078바이트 (문서 전체 31,475바이트 = 64%)
        블록0    799바이트  Organization + WebSite (브랜드)
        블록1 19,279바이트  Blog + BreadcrumbList
      headline 40회 (고유 20편) · Organization 노드 42개 · numberOfItems 선언 없음

`Blog.blogPost` 와 `Blog.mainEntity.itemListElement[].item` 이 **같은 BlogPosting 객체를 각각
통째로** 직렬화했다. ⚠️ **이 JSON 은 사람이 받는 응답에도 그대로 실리므로**(크롤러에게만 주면
구글 가이드 위반) 모든 방문자가 쓸모없는 8KB 를 더 받고 있었다 — #73 과 **같은 클래스의 다른 표면**.

**수리**: `mainEntity` 쪽을 남기고 `blogPost` 제거 + `numberOfItems` 선언.
🔑 소비자 표면 전부(`surface-list-jsonld.ts`)가 `ItemList` + 중첩 `item` + `numberOfItems`
**한 벌**로 돌고 **블로그만 밖에 있었다** — 그 모양에 맞추는 것이 바이트도 줄이고 일관성도 되찾는다.

**라이브 시드로 전후를 쟀다**: **19,231 → 10,872바이트(−8,359 · 43%)** · `headline` 40 → 20회 ·
`Organization` 42 → 20 · 항목 20건·순번·상한은 불변 (라이브 측정값 19,279 와 **48바이트 차** — 재현이 맞다).
🩸 **그 절대값은 틀렸고 "48바이트 차 = 재현이 맞다" 도 틀렸다 — 아래 "E4 라이브 판정" 절을 볼 것**
(같은 시드로 다시 재니 **25,638 → 14,184 = −11,454 · 45%**. 불변식과 비율만 맞았다).

가드 `blog-list-jsonld-dedupe-2026-10-14.test.ts` 7건 + 주입 **5건 되돌려-검증 전부 빨간불 확인**.

⚠️ **E4**: 배포 후 `/blog` 의 ld 블록 바이트가 20,078 → 11,700 안팎인지 · `headline` 이 **20회**인지 ·
**반대 방향** 항목이 여전히 **20건**이고 `numberOfItems` 가 선언돼 있는지 · 개별 글(`/blog/:slug`)의
`BlogPosting` 은 **무접촉**인지(Article 리치결과는 그쪽에서 나온다).


---

## #87 — 첫 화면이 없는 유어샵의 크롤러 문서에 **제목 0 · 내부 링크 0**

**실측(Googlebot UA, sitemap 표본 48표면)** — `h1` 이 0개인 표면이 **정확히 하나**였고,
그 한 곳은 **내부 링크도 0개**였다:

```
/u/user40     h1 0 · a 0 · 본문  58자 · ProfilePage+Person+ItemList(Product 1)
/u/jiwon1228  h1 1 · a 5 · 본문 419자
(나머지 46표면)  전부 h1 1
```

🔎 **원인**: `/u/user40` 은 `linked_seller` 유어샵이라 `buildCuratorFirstScreen` 이 **설계대로**
`''` 를 준다(React 가 `SellerPublicPage` 를 그린다 — 레이아웃이 통째로 다르다). 그러면 폴백
`<noscript>`(`curatorNoscriptFromPayload`)가 본문을 메우는데, 그 폴백은 이름을 `<p>` 로 쓰고
행을 **링크 없는 `<li>`** 로 냈다 ⇒ 2026-10-12 의 내부 링크 처방(`rowHref`)과 색인 표면의
heading 처방이 **이 경로에만 오지 않았다.** 에러가 안 나고 본문 글자수는 늘어 있어서
측정만 보면 멀쩡해 보인다.

🔑 **재료는 시드에 이미 있었다** — 핀에 `product_id 2917`·`category 'lifestyle'`·`deal_only 0`
가 전부 온다(실측). **선언만 없었다** — 같은 날 #84(`avg_rating`)와 똑같은 클래스다.

**수정**: `standalone`(= `withName`, 첫 화면이 없는 경로) 하나로 판정을 모아
① 이름을 `h1Of(…)` 로 (제목) ② 행을 목록 표면과 **같은 `rowHref`** 로 링크.
🔴 **첫 화면이 있는 경로는 byte-불변**(h1 0 · a 0) — 그쪽 `#root` 에 제목과 핀 링크가 **이미**
있어서, 여기서 또 내면 `h1` 이 둘이고 같은 URL 로 가는 링크가 두 벌이 된다.
🩸 **"같은 URL" 은 틀렸다 — 아래 "E4 라이브 판정" 절을 볼 것**(첫 화면은 귀속 경로 `/u/:handle/p/:id`, 폴백은 정본 `/products/:id` 다. 제목 쪽 근거만 유효하다).

**빌더를 돌려 눈으로 봤다**(라이브 시드 두 벌):

```
user40    withName=true  113B h1=1 a=1  → /products/2917
user40    withName=false  69B h1=0 a=0  (종전과 byte-동일)
jiwon1228 withName=true  344B h1=1 a=4  → /stays/2887 · /pass/2835 · /pass/2862 · /pass/2919
jiwon1228 withName=false 227B h1=0 a=0  (종전과 byte-동일)
```

`/u/user40` 의 핀이 가리키는 `/products/2917` 은 **sitemap 의 유일한 `/products/` URL** 이라
그 한 건에게는 이것이 유일한 내부 링크 기회다.

🕳️ **기존 가드가 이 변경을 잡았고 풀지 않았다** — `crawler-heading-2026-10-12.test.ts` ⑤
*"`<h1>` 조립은 한 곳에서만"*. 지키려던 불변식(두 자리에서 각자 쓰면 한쪽이 `esc()` 를
빠뜨린다)이 **그대로 옳으므로**, 손으로 쓰던 `<h1>` 을 그 파일의 `h1Of()` 헬퍼 호출로 바꿨다.
가드 수정 0.

🩸 **주입이 내 단언 하나를 헛돈다고 잡았다** — 시드 타입 검사를 `toContain('product_id')` 로
썼더니 `product_id?: never` 로 바꿔도 **통과**했다(이름은 남으니까). 게다가 `category`·
`deal_only` 는 **형제 블록**(`linked_seller_products`)에도 있어 인터페이스를 통째로 보면 늘
걸린다. ⇒ **필드 이름은 선언이 살아 있는지 말해 주지 않는다** — 블록을 나눠 타입까지 대조한다.
⚠️ 이 결함은 타입 층이라 런타임 시험으로는 원리상 못 잡는다(vitest 는 타입체크를 안 한다).

가드: `curator-fallback-head-link-2026-10-14.test.ts` 13건 + 주입 6건 **전부 빨간불 확인**.
⚠️ **못 보는 것**: 구글·네이버가 그 링크를 실제로 따라가는지(외부 판정) · 사람 화면(`<noscript>`
라 JS 가 돌면 렌더조차 안 된다) · 사진은 범위 밖(이번 실측은 heading·링크였다).

⚠️ **E4(배포 후 라이브)**:
```bash
UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
# ① 폴백 유어샵에 제목·링크가 생겼는지
curl -sS -A "$UA" https://urdeal.kr/u/user40 | grep -c '<h1>'          # 0 → 1
curl -sS -A "$UA" https://urdeal.kr/u/user40 | grep -o 'href="/products/[0-9]*"'   # /products/2917
# ② 반대 방향 — 첫 화면이 있는 유어샵은 h1 이 **하나**를 유지하는지(둘이 되면 회귀)
curl -sS -A "$UA" https://urdeal.kr/u/jiwon1228 | grep -c '<h1>'       # 1 유지
```

---

## 📌 이 세션의 머지 상태 (다음 세션이 먼저 볼 것)

- ✅ **PR #1808 머지 완료** — `893068fef`(2026-10-14 14:47Z, squash) · Pages 배포 success(15:02Z) ·
  **E4 라이브 판정 네 건 통과**(맨 아래 절). 내용: #84(평점) · #85(할인율·설명) ·
  #86(블로그 JSON-LD 중복) · #87(폴백 유어샵 제목·링크) · 결재 2건 · 앵커 재조준.
- 🩸 **그 과정에서 겪은 것(다음 세션이 반복하지 말 것)**: 충돌한 PR 은 **Verify 가 실패가 아니라
  *부재*** 다(GitHub 이 머지 커밋을 못 만들면 `pull_request` 워크플로가 디스패치되지 않는다) —
  그래서 auto-merge 가 **아무 신호 없이** 멎어 있었다. 판정은 걸린 시간이 아니라
  `gh api .../pulls/N --jq .mergeable_state` 로 **먼저** 할 것(`dirty` 면 체크가 0개다).

### 🚫 7차 스윕에서 **결함 아님으로 판정** (다시 파지 말 것)

| 재 본 것 | 실측 | 판정 |
|---|---|---|
| 설명 중복·길이 | sitemap 표본 56건 **중복 0** · 160자 초과 **0** · 중앙값 68자 | 정상 |
| `YourDeal` 표기 | 법적 당사자명(`Lister Corporation ("YourDeal")`) — 같은 날 `consumer-surfaces.ts:273` 이 이미 검토·기록 | 의도 |
| `img` alt | 전수 분류: **채워짐 19 · `alt=""` 8 · 속성 없음 0**. `alt=""` 는 전부 유달이 로더 + PC 배너 **배경 레이어**(`aria-hidden`, 제목은 `<strong>` 로 따로 있다) | 정상 — 내 첫 측정이 `alt=""` 를 '없음' 으로 셌다(이 세션 **세 번째** 측정기 오류) |
| `Offer` 필드 | `url`·`priceCurrency`·`price`·`availability`·`availableAtOrFrom` 완비. `priceValidUntil` 은 **없는 사실**이라 안 넣는다(이용권 `voucher_expiry` 는 *사용* 기한이고 *가격* 유효기간이 아니다 — 축이 다르다) | 정상 |
| JSON-LD 모양 두 가지 | `/pass`·`/products` 는 **노드 배열**(각 노드가 자기 `@context` 보유 — 전수 확인) · 나머지는 `{@context,@graph}` | 둘 다 유효 |
| 이미지 sitemap | `xmlns:image` 선언 + `<image:image>` **359건** (#45) | 이미 있다 |
| `llms.txt` 사실 | 수수료 **10%(대행사 5%)** — #30 수리가 그대로 유지 | 정상 |
| 크롤러 전용 바이트 비중 | 최고 `/faq` 68.4%(FAQPage 4.5KB + noscript 2.0KB) — 같은 Q&A 를 두 기제로 내지만 **용도가 다르다**(리치결과 ↔ 비-JS 본문). `#root` 에는 안 그린다(3자리 중복 아님) | 정상 |

---

## ✅ E4 라이브 판정 — #84·#85·#86·#87 (머지 `893068fef` · 배포 15:02Z)

PR #1808 머지 `893068fef`(14:47Z) → Pages 배포 success(15:02Z) 후 Googlebot UA 로 받아
**파싱해서** 쟀다(grep 개수로 세지 않았다 — 이 세션에서 그 함정을 세 번 밟았다).

### #87 — 통과 (양방향)

```
/u/user40     문서 <h1> 0 → 1 · noscript <h1> 1 · noscript <a> 1건 = /products/2917
              본문 37자  "현정 유어샵 프리미엄 무선아이폰, 구서 우성아파트 · 10,000원"
/u/jiwon1228  문서 <h1> 1 유지(둘 아님) · noscript <h1> 0 · noscript <a> 0  ← byte-불변
              첫 화면 노드 있음 · 그 안 <h1> 1개 · 핀 링크 4건
```

`/products/2917` 은 sitemap 의 **유일한 `/products/` URL** 이라 그 한 건에게 이것이
유일한 내부 링크다. 반대 방향(첫 화면이 있는 16 유어샵)은 제목도 링크도 **안 늘었다.**

### #84 — 통과 (양방향)

```
/pass/2793 (리뷰 9건)  "평점" 1회 · 매치 `평점 4.7 (9개 리뷰)`
   "판매가 32,400원 · 정가 37,000원 · 12% 할인 평점 4.7 (9개 리뷰) 주소 서울 종로구 사직로8길 4"
/pass/2919 (리뷰 0건)  "평점" 0회  ← 반대 방향(지어내지 않는다)
```

### #85 — 통과 (양방향)

```
/pass/2793  ⭐4.7 서울 종로구 · 스시호센 모둠초밥 2인 세트 (우동 포함) 32,400원 (정가 37,000원) 12% 할인
/pass/2919  서울 서초구 · 달빛한스푼 닭도리탕 31,000원 (정가 35,000원) 11% 할인 달빛한스푼 이용권
            → "% 할인" 각 1건 · ⭐ 는 리뷰 있는 쪽만 1건 · **줄표 0건**
```

리뷰 0건인 상품에서 `⭐` 조각만 빠지고 나머지는 그대로다(우아한 축소 — 설계대로).
🔴 **화면 쪽 절반은 여전히 결재 대기**(`GroupBuyDetailPage.tsx` 의 `<SEO description>` —
JS 를 렌더하는 Googlebot 이 받는 쪽은 아직 `0명 함께 구매 중` 이다). 고쳐진 척하지 말 것.

### #86 — 통과, 그러나 **제가 적어 둔 절대 바이트가 틀렸다**

측정값(서빙 문서, 블록별):

```
ld 블록 2개 · 총 15,213바이트 (문서 33,938 = 44.8%)
  블록0  1,029바이트  Organization + WebSite
  블록1 14,184바이트  Blog + ItemList + BlogPosting + BreadcrumbList
headline 20회(고유 20편) · Organization 20개 · blogPost 키 0개
numberOfItems 20 · 항목 20건 · position 1..20 연속
```

불변식은 전부 통과다(중복 0 · 항목·순번 불변 · `numberOfItems` 선언 · 개별 글 무접촉).
**그런데 커밋 메시지와 위 #86 절에 적은 `19,231 → 10,872바이트` 가 라이브 시드로 재현되지 않는다.**
같은 시드(`/api/blog/public` 20건, summary 중앙 78자)로 ① 진짜 빌더를 돌리고 ② 서빙된 출력에
**한 줄 diff 만 되돌려** 재니:

```
지금 서빙 (after)         14,184바이트  headline 20회
같은 시드로 되돌린 before  25,638바이트  headline 40회
절감                       11,454바이트 (45%)      ← 예측 8,359 (43%) 보다 **크다**
진짜 빌더 재현 (after)     13,966바이트  (서빙과 218바이트 차 = name·description 인자 차이)
```

⇒ **코드는 맞고 절감은 예측보다 많다. 틀린 것은 제가 적은 절대값이다**(비율 43%↔45% 만 맞았다).
그 숫자는 라이브와 다른 시드에서 나온 것이고, 하필 before 가 `19,231 ↔ 19,279`(48바이트 차)로
가까워서 제가 *"재현이 맞다"* 고 단정했다. **가까운 숫자는 같은 입력의 증거가 아니다** —
이 세션 네 번째 측정 오류이고, 앞 셋(`grep -c` 가 주석을 셈 · `alt=""` 를 '없음' 으로 셈 ·
`@graph` 중첩을 못 봄)과 같은 클래스다. 다음 세션은 **비율로 판정하고 절대값은 같은 시드에서 다시 잴 것.**

### 🔎 판정 중에 드러난 것 — #87 근거 한 줄도 정정

위 #87 절에 *"그쪽 `#root` 에 제목과 핀 링크가 **이미** 있어서, 여기서 또 내면 `h1` 이 둘이고
**같은 URL 로 가는 링크가 두 벌**이 된다"* 고 적었다. **제목 쪽은 맞고 링크 쪽은 틀렸다** —
두 경로의 URL 이 **다르다**:

```
첫 화면(#root)  href="/u/jiwon1228/p/2887"   ← 소개비 귀속 경로
폴백(noscript)  href="/products/2917"        ← 정본
```

그리고 그 귀속 경로를 Googlebot UA 로 받아 보니:

```
/u/jiwon1228/p/2919   200 · robots `index, follow` · canonical = https://urdeal.kr/u/jiwon1228
                      ur-first-screen **없음** · noscript **비어 있음**(본문 0자)
                      ld = ProfilePage + Person + ItemList(Product…)  ← 유어샵의 구조화 데이터
```

canonical 이 자기자신이 아니라 **유어샵**을 가리키고 ld 도 유어샵이라 **모순은 없다**(구글이
통합한다 — 중복 URL 문제 아님). 다만 그 결과로 **유어샵 첫 화면의 핀 링크 4건은 "지금 보고 있는
페이지" 로 통합되어, 상세로 가는 내부 링크로는 아무것도 발견시키지 못한다.**

🔴 **결함으로 올리지 않는다 — 판단 재료만 남긴다**:
- 그 상세들은 #34·#38·#78·#81·#82 로 `/map`·`/region`·`/urshorts`·`/browse`·`/stays` 에서
  **이미 정본 주소로 링크돼 있다** ⇒ 고아가 아니다(놓친 기회이지 깨진 것이 아니다).
- 사람이 누르는 링크를 정본으로 바꾸면 **소개비 귀속이 끊긴다**(머니 경로 — 등급 C).
- 첫 화면이 있는 16 유어샵의 `<noscript>` 에 정본 링크를 **더하는** 길은 열려 있다(위 "두 벌"
  우려가 URL 이 달라 성립하지 않으므로). 다만 그 경로를 byte-불변으로 둔 결정을 뒤집는 것이니
  **값을 먼저 재야 한다** — 그 4건이 이미 다른 데서 링크되는지를 상세별로 세어 보고,
  늘어나는 바이트(사람도 받는다)와 비교할 것.

### ⏭️ 다음 세션의 첫 액션

1. **결재함 2건이 대표 판단 대기** — `docs/decisions/2026-10-14-pass-description.md`(이용권 310건의
   화면측 description — 구글이 지금 `0명 함께 구매 중` 을 본다) · `2026-10-14-locked-emdash.md`
   (잠금표 `worker/index.ts` 의 라이브 줄표 3건). 둘 다 **올려 둔 상태이고 세션이 할 일은 없다.**
2. 새로 팔 것을 찾으려면 위 "결함 아님으로 판정" 표 두 개(7차 · 5·6차)를 먼저 읽을 것 — 14건이
   이미 재 보고 기각됐다.

---

## #88 — 어드민 cron 침묵 판정이 **같은 질문에 규칙 세 벌**, 그중 하나가 틀렸다

7차까지 SEO 를 87건 파서 수확이 얇아져 **축을 바꿨다**(관측·운영). 어드민 진단 API 를 읽었다.

**실측(라이브 `/api/admin/cron-heartbeats`, 143행)**

```
getCronHealth (헬스 게이트)      age > max_gap_min + verdict   →  0건  (ok: true)
HeartbeatCards (어드민 카드)      행의 stale + 유령 제외         →  0건
/cron-heartbeats 의 data.stale   age > 24h **고정** + verdict   →  6건  ← 전부 거짓
교집합                                                            →  없음
```

거짓 6건은 전부 **허용 간격 7.2일인 주간 작업**이고 나이 2.6일이었다(`payouts-generate` ·
`weekly-cohort-report` · `weekly-metrics-summary` · `weekly-tier-batch` · `blog-ai-draft` ·
`user-id-backfill-sweep`). 주간 작업은 7일 중 6일이 "24h 초과" 라 **구조적으로 거의 항상** 그 목록에 뜬다.
허용 7일+ judge 작업이 **6개이고 전부** 거짓이었다.

**🔑 판정 재료는 이미 행에 있었다** — `max_gap_min`(작업이 신고한 주기, 없으면 cron 식에서 유도)과
그것으로 계산된 `stale`. 게이트와 카드는 그걸 쓰는데 **그 한 줄만** 안 썼다. 그리고
`cron-heartbeat.ts:385` 주석이 의도를 직접 적어 뒀다 — *"게이트·경보·어드민이 **같은 판정**을 쓰고,
화면과 알림이 갈라지지 않는다."* 이 줄이 그 예외였다.

**피해는 가정이 아니다 — 두 번 났고 두 번째가 나다.** `admin-system-monitoring.routes.ts` 주석이
*"2026-08-08 에 두 세션이 이 목록을 읽고 '레인 4개 침묵' 으로 보고했지만 진짜는 하나뿐이었다"* 고
기록해 뒀는데, 그때 수리는 **유령만 걸렀고 임계값은 남겼다.** 2026-10-14 에 내가 같은 오진을
재현했다 — 6건을 침묵으로 읽고, 승계된 `d1-backup`(72.8일)을 **"73일째 백업이 안 돌았다"** 로
대표에게 올릴 뻔했다(실제로는 `d1-backup-chunked` 가 `2,17,32,47 * * * *` 로 **방금** 돌았다).
그리고 `AutoRunLog.tsx` 주석은 *"매시간짜리와 주 1회짜리를 같은 잣대로 판정하면 정상인 것을
빨갛게 칠한다"* 고 **요구사항을 적어 두고** 바로 그렇게 하는 서버 필드를 믿고 있었다.

**수정(한 줄)**: `data.stale` 이 행이 이미 계산한 `stale` 을 쓴다 — 게이트와 같은 판정.

```ts
- const stale = items.filter(i => (i.age_minutes ?? 0) > 60 * 24 && (i.verdict ?? 'judge') === 'judge')
+ const stale = items.filter(i => i.stale === true && (i.verdict ?? 'judge') === 'judge')
```

🩸 **피해 범위를 두 번 정정했다**(처음 서술이 과장이었다). 재 보니 **화면엔 안 뜬다** —
목록 화면은 `data.stale` 을 가져오기만 하고 `HeartbeatCards` **Props 에 없어서 넘기지 않는다**(죽은 필드) ·
카드 화면은 행으로 직접 판정 · 로그 화면은 `items` 를 `ads:` 로 걸러 그리므로 그 6건이 안 보인다.
⇒ **거짓 6건을 실제로 읽는 쪽은 이 API 를 ground truth 로 읽는 자동화·세션**이고(CLAUDE.md 가
그렇게 하라고 규정한다), 그게 두 번 오진을 만들었다. 그래도 고칠 값이 있는 이유 둘:
① 규칙이 셋이면 **에러 없이** 갈라진다 ② 로그 화면은 `stale` **이름 목록을 거르지 않으므로**
`ads:` 레인에 주간 주기가 생기는 날 거짓 색이 **바로** 뜬다(잠복 — 가드 ⑦이 그 전제를 고정).

가드: `cron-stale-one-rule-2026-10-14.test.ts` 8건 + 주입 **6건 되돌려-검증 전부 빨간불 확인**.
🔁 그리고 기존 주입 `어드민 침묵 목록이 유령까지 센다`(`cron-heartbeat-verdict.test.ts` 담당)의
앵커가 내 변경으로 낡아 **지우지 않고 재조준**했다(결함은 그대로 = 유령 제외 삭제, 글자만 새 줄로).
⚠️ 그래서 내 주입 #2 는 **같은 결함을 두 번 심지 않도록** 반대 방향(`!== 'judge'` — 유령만 경보)으로
바꿨다. 중복 잠금이면 어느 가드가 잡았는지 출력으로 못 가른다(2026-10-11 에 값을 치른 규칙).

🩸 **그 가드가 제 오류를 세 번 잡았다**: ① `60 * 24` 를 통째로 금지했더니 세 화면의
**시각 포매터**(`'시간 전' / '일 전'`)에 걸려 **거짓 빨간불** ② `setStale` 주변 120자를 봤더니
**다음 줄의 `never_fired` 필터**에 걸려 또 거짓 빨간불 — ①②는 **코드가 아니라 시험이 틀렸다**
(넓은 패턴은 이웃을 집는다. ⇒ 선언 한 줄만 떼어내고, 호출 안만 본다) ③ 그리고 **주입이 통과했다**:
`toMatch(/verdict/)` 로 유령 제외를 단언했더니 판정을 **뒤집어도**(`!== 'judge'` = 유령만 경보)
그 글자는 남아 초록이었다. 게다가 시험 안의 `staleNames()` 는 **내가 베낀 사본**이라
라우트를 뒤집어도 안 변한다 ⇒ **런타임 단언으로는 원리상 못 잡는다.**
⇒ 방향을 **소스에서** 못 박았다(`(i.verdict ?? 'judge') === 'judge'` 정확 일치).
🧭 **교훈: 로직을 베낀 시험은 그 로직의 변경을 못 잡는다** — 베낄 수밖에 없으면 방향·모양을
소스 단언으로 함께 고정할 것.

⚠️ **이 가드가 못 보는 것**: 라이브 D1 의 실제 하트비트 값(합성 행으로 규칙만 판정) · 화면이 그
목록을 어떤 색으로 그리는지 · `max_gap_min` 자체가 맞는지(`cron-expected.test.ts` 의 몫).

⚠️ **E4 는 배포 후 라이브**: `GET /api/admin/cron-heartbeats` 의 `data.stale` 이 **0건**인지
(지금 6건) · **반대 방향** `items` 의 143행과 `never_fired`·`orphan_lanes` 는 **불변**인지 ·
`GET /api/_healthcheck/cron` 의 `ok` 가 여전히 **true** 인지(게이트는 원래 맞았으므로 안 바뀌어야 한다).
🩸 **이 기대값 두 개가 틀렸다 — 아래 "✅ E4 라이브 판정 통과 — #88" 절을 함께 볼 것**
(`stale` 은 0 이 아니라 5건, 게이트 `ok` 는 원래부터 `false` 였다. 수리는 통과했다).

### 같은 전수에서 **결함 아님으로 판정** (다시 파지 말 것)

| 재 본 것 | 실측 | 판정 |
|---|---|---|
| `d1-backup` 72.8일 침묵 | `verdict: superseded` · 후임 `d1-backup-chunked` 가 **0.0일 전**(`2,17,32,47 * * * *`) 정상 | 정상 승계 — 내가 결함으로 올릴 뻔했다 |
| `__tick`·`agency-weekly-batch`·`agency-cron-batch` 38~50일 침묵 | 전부 `superseded`(2026-08-25 `*/5` 재배선) | 유령 잔해 |
| `group-buy-deadline-push` 38.9일 | `retired` | 은퇴 |
| `ads:weekly-report` 고아 레인 1건 | `verdict: retired` · 서버가 이미 고아로 분류 | 관측이 제 일을 하고 있다 |
| `never_fired` | **0건** | 정상 |
| cron 전체 | 143행 중 `judge` 134 · `superseded` 7 · `retired` 2 | 정상 |

### ✅ E4 라이브 판정 통과 — #88 (머지 `f3217621c` · 배포 후 `urdeal.kr` 실측 17:00Z 전후)

**어드민 목록과 게이트가 처음으로 같은 답을 낸다.** 그게 이 수리의 전부였다.

| 재 본 것 | 종전 | 지금 | 판정 |
|---|---|---|---|
| `data.stale` 의 거짓 6건 | 주/일 1회 작업이 고정 24h 잣대로 빨간불 | `payouts-generate`(머니 경로) age 3,848m / gap 10,440m → **false** · `blog-ai-draft` 3,848/10,440 → false · `influencer-payout` 1,313/1,800 → false · `kt-alpha-catalog-sync` 803/1,800 → false | ✅ 제거 |
| 유령 제외 | — | 행 `stale=true` **10개** ↔ 목록 **5개**. 차이 5개가 전부 `superseded`/`retired` | ✅ 유지 |
| 어드민 목록 == 게이트 | 어드민 6건 ↔ 게이트 5건, **겹치는 이름 0** | 양쪽 **같은 5건** | ✅ 규칙이 하나 |
| 반대 방향 | — | `items` **143** · `never_fired` **0** · `orphan_lanes` **1**(`ads:weekly-report`) · `max_gap_min` 선언 **143/143** · `stale=null` **0** | ✅ 불변 |

🩸 **그런데 제가 적어 둔 E4 기대값 두 개가 둘 다 틀렸다.** 둘 다 **같은 오해**에서 나왔다 —
*"거짓 경보를 지우면 목록이 빈다"* 고 가정했는데, 실제로는 **고정 24h 잣대가 원리상 못 보던
자리가 그 자리에 드러났다**(42분 ≪ 1,440분).

- 적은 것: `data.stale` **0건** → 실제 **5건**(`ads:enrich-influencer{,-2,-3,-4}`·`ads:maintenance`,
  전부 `gap=32` 선언에 age 43~49분).
- 적은 것: 게이트 `ok` **true 유지** → 실제 **`false`**. 게이트는 원래 `max_gap_min` 을 쓰므로
  **그 전에도 `false`** 였다. 제가 게이트를 초록이라고 **가정**했을 뿐이고, 확인하지 않았다.

⇒ 교훈: **"고치면 0 이 된다" 는 예측이 아니라 가정이었다.** 같은 규칙으로 판정 범위를 넓히면
전에 안 보이던 것이 보이는 게 당연한데, 기대값을 0 으로 적어 두면 **성공을 실패로 읽게 된다**
(실제로 처음 5건을 보고 "수리가 안 먹었다" 로 읽을 뻔했다).

---

## #89 — 유어애즈 알람 체인이 **매시 1~2회 뒤 죽는다** (설계 60회/시간 · 실측 1~2회/시간)

> 🩸 **이 절을 두 번 썼고 첫 판이 정반대였다.** 처음엔 *"레인이 멈춘 게 아니라 gap 선언이
> 틀렸다 → 경보를 느슨하게"* 로 적었다. 레인 스탬프를 읽고 **뒤집혔다** — 선언은 설계와
> 일치하고 **레인이 실제로 안 돈다.** 즉 그 경보는 **참**이었다. 첫 판 처방대로 갔으면
> *맞는 말을 하는 경보를 입막음*하는 것이었다. 이 레포가 반복 실패 양식으로 기록해 둔 바로 그것이다.

### 측정 1 — 하트비트 (정시 경계 끼고 14샘플)

```
16:59:12  ok=False stale=5  ages=[47,47,48,48,48]
17:00:44  ok=False stale=3  ages=[ 0, 1,49,49,50]   ← 정시에 리셋 시작
17:01:27  ok=True  stale=0  ages=[ 0, 0, 1, 1, 1]
17:09:20  ok=True  stale=0  ages=[ 7, 8, 8, 8, 8]   ← 그 뒤 8분간 리셋 0회
```

### 측정 2 — 레인 스탬프가 원인을 가른다 (D1 읽기, 17:16:45Z · 17:50:13Z 재측정)

> 🩸 **아래 7줄은 전체가 아니다 — 레인은 27개다.** 처음 이 절을 쓸 때 *흥미로운 7줄*만
> 옮겨 적어서, 읽는 사람이 **"레인 시스템이 통째로 죽었다"** 로 읽을 수 있게 됐다.
> 17:50:13Z 에 전수(27개)를 다시 재니 **20개는 설계대로 멀쩡하다**:
>
> | 묶음 | 개수 | cap | next_at | 지연 |
> |---|---|---|---|---|
> | `collect-*`(11) · `sweep-*`(3) · `daily-batch` · `maintenance-rescan` · `match-registry` · `reclassify-company` · `scan-notices` · `sheets-sync` | **20** | 1 | 18:00:00 | **-10분**(미래 = 정상) |
> | `enrich-influencer`·`-2`·`-3`·`-4` · `maintenance` | **5** | 60 | ~17:02 | **+47~48분** |
> | `collect` | **1** | 3 | 17:02:07 | **+48분** |
>
> ⇒ 고장 범위는 **고주기 레인 6개**이고, 하트비트가 신고한 `stale=5` 와 그 묶음이 맞아떨어진다.
> 🔑 **그래서 통제군 논증이 더 강해진다** — `cap=1` 짜리 **20개 전부**가 "다음 정시" 알람으로
> 멀쩡히 사는데 `now+1분` 알람만 여섯이 다 죽었다. 표본 1개가 아니라 20:6 이다.
> ⚠️ 반대로 *"그럼 20개는 괜찮으니 급하지 않다"* 도 아니다 — 죽은 여섯에 **연락처 전환의
> 유일한 병목**(`enrich-influencer` 넷)이 들어 있다.

`platform_settings['ads_lane_alarm_last:*']`:

```
레인                  at        next_at    지연      runs  cap
collect              17:01:07  17:02:07   **15분**   1     3
enrich-influencer    17:00:55  17:01:55   **15분**   1     60
enrich-influencer-2  17:01:58  17:02:58   **14분**   2     60
enrich-influencer-3  17:00:59  17:01:59   **15분**   1     60
enrich-influencer-4  17:01:28  17:02:28   **14분**   2     60
maintenance          17:01:26  17:02:26   **14분**   2     60
maintenance-rescan   17:00:00  18:00:00    -43분     1     1    ← 통제군
```

읽는 법:

- `cap=60 · interval_ms=60000` — **설계는 분당 1회 = 시간당 60회**다(`ADS_PLAN='paid'` 값).
  그러니 `max_gap_min = staleGapMinutes(round(60/60)) = 32` 는 **선언이 맞다.**
- 여섯 레인이 `now + 1분` 을 예약하고 **14~15분이 지나도 안 깨어났다**(지연은 계속 자란다).
- **통제군이 결정적이다** — `maintenance-rescan` 은 `cap=1` 을 소진해 `nextWakeAt` 이 다음
  정시(18:00)로 잡았고, 그래서 **지연이 없다**(-43분 = 아직 미래). 즉 "다음 정시" 로 잡은
  알람은 깨어나고, **"1분 뒤" 로 잡은 알람만 안 깨어난다.**

⇒ **알람 체인이 매시 처음 1~2회 발화 뒤 끊긴다.** 그리고 매 정각 부트스트랩이 되살린다
(`shouldReviveLane` + `ALARM_DEAD_AFTER_MS` 30분 — 59분 지연이면 조건 충족). 그게 하트비트의
톱니 모양이고, 자가치유가 **시간 단위로만** 듣고 있다는 뜻이다.

### 그래서 규모

> 🩸 **이 절의 결론은 아래 "측정 5" 가 정정했다 — 읽고 멈추지 말 것.** 회차 수는 맞지만
> **처리량은 멀쩡하다**(~20,000/일 · 기록된 정상 기준 초과 · 백로그 1일분). 아래 문단의
> *"그 레인이 설계의 30~60분의 1로 돌고 있다"* 는 **입력(회차)을 재고 출력(측정량)을 말한 것**이다.

**설계 60회/시간 → 실측 1~2회/시간.** `CLAUDE.md` 가 측정(`enrichNaverActivity`)을 연락처
전환의 유일한 병목으로 적어 뒀다(*"측정됨 27.7% vs 미측정 1.6%"* · *"처리량이 곧 품질이다"*).
그 레인이 설계의 30~60분의 1로 돌고 있다.

⚠️ **다만 "측정이 30배 줄었다" 로 단정하지 말 것** — 회차당 처리량을 안 재 봤다(한 회차가
`spent 54 / budget 675` 를 쓴다). 정확한 손실은 *회차 수 × 회차당 측정량*이고 뒤쪽은 미측정이다.

### 2026-08-09 과 같은 클래스 (그 파일이 스스로 적어 둔 것)

`lane-alarm-policy.ts:138` 의 사고 기록이 이 모양을 글자 그대로 적어 뒀다 —
*"예약 시각이 3.5시간 전인데 안 깨어난 인스턴스 … 값은 있는데 체인은 죽었다"* ·
*"매 정각 확인하면서 매 정각 못 살리고 있었다."* 그때 처방(`shouldReviveLane`)은 **듣는다** —
다만 30분 문턱 + 시간당 부트스트랩이라 **되살리는 주기가 1시간**이다. 끊기는 원인은 안 고쳐졌다.

### 측정 3 — 후보 둘이 **이미 있던 데이터로** 기각됐다 (17:52Z)

🩸 **먼저 적어 둘 것: 내가 만든 계측은 이미 있던 계측의 두 번째 벌이었다.**
`armed_at` 되읽기를 설계하고 PR 까지 올린 **뒤에** 어드민 하트비트를 읽었는데,
거기에 **매시 부트스트랩이 찍는 `getAlarm()` 되읽기가 이미 있었다** —
`ads:lane-alarm-boot:*` 의 `result` 문자열에 `alarmAt=<ms>` 로. 그 엔드포인트는
#88 때문에 이 세션이 **하루 종일 읽고 있던 바로 그 표**다. 레인 스탬프만 보고
부트스트랩 하트비트는 안 봤다. ⇒ **없는 계측을 만들기 전에 있는 계측을 전수로 읽을 것.**

#### ③ 예산·정지 게이트가 레인을 건너뛴다 → **기각**

`alarm()` 에는 *다음 알람은 걸고 스탬프는 안 쓰는* 조기 반환이 둘 있다
(`lanesPaused` · `budgetBlocked || laneCut`). 그 길로 갔으면 **알람은 살아서 1분마다
울리는데 스탬프만 17:01 에 얼어붙어** 지금 관측과 똑같은 지문이 된다. 이게 내가
처음에 적지도 않은 후보였고, 실측이 바로 기각했다:

```
ads:read-budget   used=66,374,607 / budget=200,000,000   over=false
                  written=982,835 / wbudget=1,365,551    wover=false     cut= (없음)
ads:lanes-paused  paused=false
```

`budgetBlocked = over || writeOver` 가 **false** 이고 `cut` 목록이 **비어 있다**(= `laneCut` 전부 false).
`fail_streak` 도 여섯 레인 전부 0 이다 — 레인이 던지고 있는 것도 아니다.

#### ① `setAlarm` 실패를 삼킨다 → **기각**(적어도 일반 원인은 아니다)

부트스트랩 `alarmAt` 은 `await this.ctx.storage.getAlarm()` **그 값**이다
(`lane-alarm.ts:80`) — **다른 인보케이션에서 한 독립 되읽기**다. 17:01:06.175 측정:

```
레인                 부트스트랩 getAlarm()   스탬프 next_at   runs   판정
enrich-influencer   17:01:55.688          17:01:55         1     ✅ 같다 — 알람 실재
enrich-influencer-3 17:01:59.265          17:01:59         1     ✅ 같다 — 알람 실재
enrich-influencer-2 17:01:51.465          17:02:58         2     부트스트랩 뒤 한 번 더 돌았다
enrich-influencer-4 17:01:22.246          17:02:28         2     〃
maintenance         17:01:11.757          17:02:26         2     〃
collect-commerce    18:00:00.000          18:00:00         1     ✅ (cap=1 묶음)
```

읽는 법 — **`runs=1` 인 두 줄이 결정적이다**: 그 레인의 마지막 `setAlarm` 가 만든 알람을
**11초 뒤 다른 인보케이션이 읽어서 확인**했고, 그 뒤 `runs_this_hour` 가 **1 에서 안 움직였다**
(17:55 까지 53분). 즉 **예약은 실재했고 런타임이 안 깨웠다.** `setAlarm` 실패가 아니다.
(`runs=2` 인 세 줄은 부트스트랩 *뒤에* 한 번 더 울린 것 — 알람이 **적어도 한 번은
정상 발화한다**는 증거라 같은 결론을 보강한다.)

⇒ **알람 체인은 "안 걸린다" 가 아니라 "걸렸는데 한두 번 울고 그친다".**

#### 그래서 남은 후보

- **②** `ADS_PLAN='paid'`(실측 `cap=60 · interval_ms=60000`)인데 계정은 대표 확정 *"일단 무료"* —
  1분 알람이 무료에서 지속적으로 안 받아들여지는지. 고칠 자리는 **대시보드**(대표).
- **④** 알람이 울려서 `alarm()` 이 시작은 하는데 **스탬프·다음 예약 전에 죽는다**
  (CPU·축출). 그러면 스탬프도 새 알람도 없어 지금 지문과 같다.
  ⚠️ `cpu_deaths: 0` 은 **cron 하트비트의 값**이고 DO 알람 인보케이션은 그 집계에 없다 —
  **이 후보는 아직 아무 계측도 없다.**

🔑 **18:00 부트스트랩이 ①·④ 를 한 번 더 가른다 — 예측을 먼저 적어 둔다.**
`enrich-influencer` 의 저장된 알람은 17:01:55 이고 18:00:00 이면 **58분 지연** >
`ALARM_DEAD_AFTER_MS`(30분) ⇒ `alarmReviveKind` 가 `'stale'` 을 돌려주므로 부트스트랩은
**`started=true revived=true staleAt=17:01:55`** 를 찍어야 한다.
그게 찍히면 *"예약이 58분간 걸린 채 안 울렸다"* 가 **세 번째 독립 증거**다.
반대로 `revived=false alarmAt=...` 이 찍히면 그 사이에 울린 것이고 내 관측이 틀렸다.

### 원인 — 후보 둘, **아직 안 가렸다**

> ⚠️ **아래 절은 17:16Z 판단이고 위 "측정 3"(17:52Z)이 그중 ①을 기각했다.**
> 남은 것은 ②(요금제)와 신규 ④(알람 인보케이션 조기 사망)다. 기록으로 남긴다.

1. **`setAlarm` 실패를 삼킨다** — `lane-alarm.ts:168` 이 `setAlarm(at).catch(() => undefined)`
   이고 스탬프는 **그 뒤에** `next_at` 을 적는다. 실패하면 *"예약했다고 기록했는데 실제 예약은
   없다"* 가 되어 **지금 관측과 정확히 같은 지문**이 된다.
2. **`ADS_PLAN='paid'` 인데 계정은 무료** — `paidPlan()` 은 그 env 한 개만 본다
   (`lane-alarm-policy.ts:81`). `CLAUDE.md` 는 대표 확정 *"일단 무료"*(2026-07-28)를 적어 뒀다.
   무료에서 1분 알람이 안 받아들여지면 "다음 정시" 알람만 사는 지금 모양이 된다.

🔑 **가르는 측정**: 스탬프에 `setAlarm` 성공 여부 + 직후 `getAlarm()` 되읽기를 한 줄 추가한다
(관측만 — 동작 무변경). 되읽기가 `null` 이면 후보 1, 값이 있는데 안 깨어나면 후보 2다.
⚠️ **이 측정 없이 처방을 쓰지 말 것** — 둘은 고칠 자리가 완전히 다르고, 후보 2 면
`ADS_PLAN` 은 **대표가 대시보드에서** 바꾸는 값이다(세션은 플랫폼 쓰기를 하지 않는다).

### ✅ E4 라이브 판정 통과 — 되읽기는 작동하고 **후보 ①을 죽였다** (머지 `2528c3441`)

배포(`deploy-ads` run 637) + 18:00 정각 틱 뒤 D1 `platform_settings` 직접 읽기, 18:02:42Z:

```
레인                  at        next_at    지연   runs  cap  set_ok  armed_at   next_at 과 같나
enrich-influencer    18:02:10  18:03:10   -0분    2    60   true   18:03:10   ✅
enrich-influencer-2  18:02:12  18:03:12   -0분    2    60   true   18:03:12   ✅
enrich-influencer-3  18:02:12  18:03:12   -0분    2    60   true   18:03:12   ✅
enrich-influencer-4  18:01:42  18:02:42   +0분    2    60   true   18:02:42   ✅
maintenance          18:01:41  18:02:41   +0분    2    60   true   18:02:41   ✅
collect              18:01:12  18:02:12   +1분    1     3   true   19:00:00   ✅
```

**`set_ok` 6/6 `true` · `armed_at` 6/6 이 `next_at` 과 일치.** 즉 `setAlarm` 은 성공하고,
**같은 인보케이션의 되읽기가 의도한 시각 그대로 걸린 것을 확인한다.**
⇒ **후보 ①(`setAlarm` 실패를 삼킨다)은 끝났다.** 고칠 자리는 그 `.catch` 가 아니다.

### 🩸 예측이 틀렸고, 틀린 쪽이 더 많이 알려 줬다

위 "측정 3" 에서 *"18:01 부트스트랩이 `revived=true` 를 찍어야 한다"* 고 **먼저 적어 두고** 쟀다.
결과는 **`revived=true` 0/6**:

```
collect              started=true  revived=false              ← 알람이 **아예 없었다**(kind='none')
enrich-influencer    started=false alarmAt=18:02:03.686       ← 미래
enrich-influencer-2  started=false alarmAt=18:02:05.680
enrich-influencer-3  started=false alarmAt=18:02:05.866
enrich-influencer-4  started=false alarmAt=18:01:35.759
maintenance          started=false alarmAt=18:01:37.352
```

전부 **미래**다. 즉 18:00~18:01:10 사이에 레인이 **실제로 돌아** 새 알람을 걸었다 —
17:01:55 짜리 58분 지연 알람이 **그때 발화한 것**이다(또는 부트스트랩의 `fetch` 가 DO 를
인스턴스화하면서 밀린 알람이 흘러나왔다. 둘은 아직 못 가린다).
⇒ *"걸렸는데 영영 안 울린다"* 가 아니라 **"걸렸는데 한참 뒤에, 정각 근처에서만 울린다"** 다.

### 측정 4 — 한 시간을 **안에서** 샘플링해 체인의 실제 모양을 봤다

```
18:01:10  부트스트랩(매시 cron)
18:01:12  collect 회차 1
18:01:41  maintenance·enrich-4 회차 2
18:02:10  enrich-influencer 회차 2        → 알람 18:03:10
18:03:1x  회차 3 (발화함 — 체인 기구 자체는 작동한다)
18:04:24  enrich-influencer 회차 4        → 알람 18:05:24 (set_ok=true · armed_at 확인)
18:05:0x  maintenance·enrich-4 회차 5
18:13:04  지연 +7~8분 · runs 4~5 에서 **멈춤** · 알람은 걸린 채
```

**설계 60회/시간(`cap=60 · interval_ms=60000` = `RUNS_PER_HOUR_PAID`) → 실측 4~5회/시간,
그리고 그 4~5회가 전부 정각 직후 ~4분에 몰려 있다.**

> 🩸 **회차 수 이야기다 — 처리량은 아래 "측정 5" 를 볼 것.** 소스가 적어 둔 정상 기준은
> **12회/시간 · 샤드당 ~150명/시간**(`lane-alarm-runners.ts:12`)이고 오늘 실측은
> **샤드당 ~209명/시간**이다. 회차가 적어도 한 회차가 큰 배치를 돈다.

> ⚠️ **앞에 적은 "1~2회/시간" 을 정정한다.** 그 값은 17:00 시간대 실측이고(그 시간대는 실제로
> 1~2회였다) 18:00 시간대는 4~5회다. **회차 수가 시간대마다 다르다** — 한 시간대만 보고
> 숫자를 단정하지 말 것(이 세션에서 관측 창 때문에 세 번 틀렸고 이게 네 번째 자리였다).
> 안전한 표현: **설계의 1/12~1/60**.

> 🔴 **그 "안전한 표현" 조차 안전하지 않았다 — 아래 "측정 6" 을 볼 것.** 19:00 시간대 실측은
> **26~29회**다(4~5 가 아니다). 즉 멎기까지의 회차 수가 **시간대마다 6배 이상** 벌어지고,
> `1/12~1/60` 은 그 분포의 **나쁜 쪽 끝**이다. 이 줄을 "설계의 1/12~1/60 로 돈다" 로 읽지 말 것.

### 원인 — 후보가 **둘로 좁혀졌고, 19:01 이 공짜로 가른다**

남은 둘:

- **②** `ADS_PLAN='paid'` 인데 계정은 대표 확정 *"일단 무료"*. 고칠 자리는 **대시보드(대표)**.
- **④** 알람이 울려서 `alarm()` 이 시작은 하는데 **스탬프·재예약 전에 죽는다**(CPU·축출).

🔑 **가르는 원리**: DO 런타임은 알람을 **배달할 때 저장소에서 먼저 지운다.** 그러니
체인이 멎은 상태에서 `getAlarm()` 이

- **값이 있고 한참 지남** → 배달이 안 된 것 ⇒ **④ 아님**(런타임이 안 깨운다)
- **`null`** → 배달됐고 핸들러가 재예약 전에 죽은 것 ⇒ **④**

🔮 **19:01 부트스트랩이 그 읽기를 공짜로 해 준다**(마지막 회차 ~18:05 · 알람 ~18:06 →
55분 지연 > `ALARM_DEAD_AFTER_MS` 30분):

- `revived=true staleAt=18:06:xx` ⇒ 알람 실재 ⇒ **④ 기각, ② 쪽**
- `started=true revived=false` ⇒ 알람 부재 ⇒ **④**

⚠️ **섞여 나올 수 있다 — 레인별로 읽을 것.** 18:01 에 `collect` 가 이미
`started=true revived=false`(알람 **부재**)였다. 한 레인은 ④, 다섯은 ② 일 수도 있다.
🚫 **이 읽기 전에 `/start` 를 손으로 때리지 말 것** — 그게 바로 되살리는 동작이라
19:01 측정을 망친다(그리고 세션은 라이브 쓰기를 하지 않는다).

### 🔬 ②vs④ — **19:01 부트스트랩으로는 못 가린다. 그래서 직접 표식한다.**

🩸 **바로 위에 적은 19:01 계획에 구멍이 있다(쓰고 나서 찾았다).** 18:01 실측에서 레인 다섯이
**부트스트랩이 보기 직전에 이미 돌아** 신선한 알람을 갖고 있었고, 그래서 `revived` 가 아무것도
말해 주지 않았다(`collect` 하나만 `revived=false` = 알람 부재). 19:01 도 같은 경합이면 같은
무정보 답이 나온다.

**하트비트 `at` 으로 순서를 따져 보려 했고, 그 근거가 안 섰다**: 다섯 레인의 `at` 이
`ads:scheduled`·`ads:lanes-paused`·`ads:read-budget` 과 **ms 까지 동일**(18:01:06.175)인데
`collect-*` 들은 제각기 다르다. `adsBeat` 은 `beats.add` **배치**라 `at` 이 회차 시각이 아니다
⇒ *"런이 부트스트랩보다 2.5초 앞섰다"* 는 추론은 **세울 수 없다.** 그 추론으로 ②를 단정하려다
멈췄다 — 오늘 세 번 밟은 함정의 네 번째 자리였다.

**⇒ 있는 계측을 전수로 읽어 "못 한다" 를 확인한 뒤에** 새 계측을 만들었다(순서가 중요하다 —
바로 위 "측정 3" 에서 그 반대로 해 계측을 두 벌 만들었다).

**표식 (관측만 · 동작 무변경)**: `/start` 가 체인을 새로 세울 때(`kind !== 'alive'`)
`bootKick` 에 시각을 적고, `alarm()` 이 **읽고 지운다.** 창(15초) 안이면 그 회차는
`by: 'boot'`, 아니면 `by: 'alarm'`.

**판정 (배포 + 정각 1회 뒤 스탬프)**

| 매시 **첫 회차**의 `by` | 뜻 | 고칠 자리 |
|---|---|---|
| `'alarm'` | 알람이 **걸린 채 늦게 배달**됐다 | **②** — `ADS_PLAN`(대시보드, **대표**) |
| `'boot'` | 알람이 **없었다**(배달 후 재예약 전 사망) | **④** — 코드(`lane-alarm.ts`) |

2회차 이후는 정상이면 늘 `'alarm'` 이다. 섞여 나올 수 있으니 **레인별로** 읽는다.

⚠️ **비대칭이 의도다**: 조기 반환(킬스위치·일시정지·예산·유령 이름)은 표식을 안 지우므로
낡은 표식은 `'alarm'` 으로 읽혀 **④를 과소보고**한다. 반대로 틀리는 쪽(없는 ④를 만들어
코드를 고치게 하는 것)이 더 나쁘다고 보고 이 방향을 골랐다.

가드: `alarm-arm-readback-2026-10-14.test.ts` 6건 추가(총 12) + 주입 7건 추가(총 13)
**되돌려-검증 전부 빨간불 확인**(그중 둘은 **반대 방향** — 되살리기 `setAlarm(now+1s)` 제거,
창을 10분으로 늘려 정상 회차를 boot 로 삼키기). 검증: tsc 0 · 관련 유닛 79건 pass.

### 🩸 측정 5 — **영향 규모를 내가 과장했다. 처리량은 멀쩡하다.**

위에서 *"`enrich-influencer` 는 연락처 전환의 유일한 병목인데 설계의 1/12~1/60 로 돈다"* 고
썼다. **회차 수는 맞지만 그 함의가 틀렸다.** 제 자신이 적어 둔 경고
(*"회차당 처리량을 안 재 봤다 … 정확한 손실은 회차 수 × 회차당 측정량"*)를 적고 나서
**재지 않았다.** 이제 쟀다(D1 `ad_influencer_leads` 직접 읽기, 19:2xZ):

```
perf_checked_at 날짜별 (= 이 레인들이 쓰는 컬럼)
  10-14  20,028      10-11  16,592      10-08  14,471
  10-13  19,720      10-10  19,362
  10-12  22,364      10-09  16,972          → 9일간 안정, 추세 하락 없음

백로그   전체 358,288 · 미측정 19,102(5.3%) · 이메일 보유 69,327
        현재 속도(≈20,000/일)로 백로그 소진까지 **약 1.0일**
```

**그리고 비교 기준이 소스 안에 있었다** — `lane-alarm-runners.ts:12` 가 적어 둔 실측:

> `enrich-influencer` 알람 전: 마지막 실행 4시간 전 · **알람 후: 12회/시간, 시간당 ~150명 측정**

즉 이 시스템이 **작동할 때의 기준은 12회/시간 · 샤드당 ~150명/시간**이다(`RUNS_PER_HOUR_DEFAULT`
= 무료 기본값). 오늘 실측은 `20,028 ÷ 24 ÷ 4샤드 ≈ **209명/시간/샤드** — 그 기준보다 높다.`

⇒ **회차는 4~5회/시간이지만 처리량은 기록된 정상 기준을 넘는다.** 한 회차가 서브리퀘스트
예산까지 큰 배치를 돌기 때문이고, 회차를 60회로 늘려도 **잴 것이 없다**(백로그 1일분).

#### 그래서 #89 의 성질이 바뀐다

| | 내가 쓴 것 | 실측 |
|---|---|---|
| 알람 체인이 4~5회 뒤 멎는다 | ✅ 참 | ✅ 참 |
| 설계는 60회/시간(`cap=60`) | ✅ 참 | ✅ 참 (`ADS_PLAN='paid'` 값) |
| **처리량이 설계의 1/12~1/60** | ❌ **틀렸다** | ~20,000/일 · 기준치 초과 |
| **연락처 전환이 굶고 있다** | ❌ **틀렸다** | 백로그 5.3% · 1일분 |

> 🔴 **아래 "측정 6" 이 이 절의 결론을 반쯤 뒤집는다.** 여기서 쓴 "멀쩡하다" 는 **일 합계**이고,
> 시간별로 보면 **114 ~ 3,150 (27배)** 로 요동친다 — 평균이 양극 분포를 가린 것이다.
> *평균은 기준치를 넘고, 개별 시간대는 최대의 1/27 까지 떨어진다.* 둘 다 참이다.

**#89 의 실제 피해는 처리량이 아니라 거짓 경보다.** `/api/_healthcheck/cron` 이 매시 상당
시간 `ok:false` 이고 `uptime.yml`(10분)이 이슈·메일을 낸다 — **기준치 이상으로 일하고 있는
파이프라인에 대해서.** 그게 경보 피로이고, 이 레포가 #88 에서 방금 고친 것과 같은 클래스다.

#### ⚠️ 그래서 "`max_gap_min` 은 참을 말한다" 에 단서를 붙인다

그 경보는 **사실로는 참**이다(*"32분간 회차가 없다"*). 그런데 **함의가 거짓**이다
(*"파이프라인이 멈췄다"*). 느슨하게 하는 것도, 그대로 두는 것도 답이 아니다 —
정직한 처방은 **선언한 주기를 런타임이 실제로 배달하는 값에 맞추는 것**이고,
그건 **②vs④ 판정에 달렸다**(④면 핸들러를 고쳐 60회를 되찾을 수도 있다).
⇒ **판정 전에 어느 쪽으로도 손대지 말 것.**

🧭 **교훈**: *"병목이다"* 는 **그 병목의 산출량을 재야** 하는 주장이다. 회차 수는 입력이고
처리량이 출력인데, 입력만 재고 출력을 말했다. 오늘 네 번째 같은 클래스의 실수다.

### 🔬 측정 6 — **간헐이다. 그리고 멎는 순간을 라이브로 잡았다** (19:29~19:33Z)

#### ⓐ 19:00 시간대는 26~29회 돌고 멎었다 (18:00 시간대는 4~5회)

```
읽은 시각 04:29:39 KST   runs_this_hour  26 · 26 · 26 · 27 · 29   (cap 60)
읽은 시각 04:32:41 KST   runs_this_hour  26 · 26 · 26 · 27 · 29   ← 3분간 0회
                         at              04:28:08 ~ 04:29:00
                         next_at         04:29:08 ~ 04:30:00      ← 이미 과거
                         set_ok          true 5/5                 ← 되읽기까지 확인된 알람
                         by              alarm 5/5                ← 마지막 회차는 체인이 스스로 이었다
```

29분에 26~29회 = **분당 1회 = 설계 cadence 그대로**. 그러고 **:29 에 멎었다.**
⇒ 체인은 "정각 직후 4분만 돌고 죽는다" 가 아니라 **한동안 정상으로 돌다가 어느 지점에서 멎는다**.
멎는 지점이 시간대마다 다르다(4~5회 ↔ 26~29회).

#### ⓑ 시간별 산출량 50시간 — 114 ~ 3,150 (27배)

`ad_influencer_leads.perf_checked_at` 을 **시간 버킷**으로 센 값(KST):

```
04시 3150 │ 03시  510 │ 02시  180 │ 01시 1264 │ 00시  990
23시 2357 │ 22시  495 │ 21시 2995 │ 20시 1548 │ 19시  613
18시 1405 │ 17시  551 │ 16시  465 │ 15시 1664 │ 14시  149
13시 1229 │ 12시  114 │ 11시  465 │ 10시  178 │ 09시  456
                                  …  50시간 합 41,906 · 시간평균 838
```

270 미만이 **15시간**, 2,000 이상이 **6시간**. ⇒ **측정 5 의 "멀쩡하다" 는 일 합계로는 참이고
시간 단위로는 거짓이다.** 평균(838/시간)은 소스 기준(12회/시간 → 150명/시간)의 5.6배라
`cap=60`(5배) 설계와 맞아떨어지는데, **그 평균이 좋은 시간대와 나쁜 시간대의 혼합**이다.

⚠️ **회차 수에서 산출량을 역산하지 말 것** — 회차당 측정량이 일정하지 않다(백로그 구성·키워드
수율·API 응답에 따라 달라진다). 27배 변동을 "27배 회차 차이" 로 읽으면 틀린다. 지금 말할 수
있는 것은 **둘 다 크게 변동한다** 까지다.

#### ⓒ 게이트도 간헐이다

`GET /api/_healthcheck/cron` → `ok:true · stale: []`(19:31Z). 측정 5 가 *"매시 상당 시간
`ok:false`"* 라고 쓴 것도 **상시가 아니다.** 경보 피로라는 성질 자체는 유효하지만 빈도는 다시 재야 한다.

#### ⓓ 그래서 ②vs④ 를 **지금** 가를 수 있다

멎은 체인이 **무엇에 의해** 깨어나는지만 보면 된다. `set_ok=true` 로 되읽기까지 확인된 알람이
3분 넘게 안 왔으므로:

| 관측 | 판정 | 고칠 자리 |
|---|---|---|
| 혼자 늦게라도 터진다 (`by='alarm'`, `at` 이 전진) | **②** 런타임 배달 지연 | `ADS_PLAN`·요금제 → **대표 대시보드**(세션은 플랫폼 쓰기 금지) |
| 05:01 부트스트랩이 깨운다 (`by='boot'`) | **④** 알람이 사라졌다 | `lane-alarm.ts` (세션이 고친다) |

감시 중: `scratchpad/watch89.sh`(80초 간격 · 05:05 KST 까지 · 로그 `watch89.log`).
🚫 **`/start` 를 손으로 때리지 말 것** — 되살리는 동작이라 이 측정이 망가진다.

🧭 **교훈(이 세션 다섯 번째 같은 클래스)**: 측정 4·5 는 각각 **한 시간대**와 **일 합계**를 봤다.
주기가 있는 계에서 **관측 창이 주기보다 짧으면** 숫자를 단정할 수 없고, **집계 창이 너무 넓으면**
구조(양극 분포)가 사라진다. 두 창을 **같이** 봐야 했다.

### 🔬 측정 7 — **④ 가 거의 죽었다. 그리고 찾던 계측이 이미 있었다** (19:40Z)

#### 🩸 먼저: 같은 교훈을 한 세션에 두 번 밟았다

②vs④ 를 가르려고 `by` 표식(#1820)을 **새로 만들었다.** 그런데 `lane-alarm-boot.ts` 를 읽어 보니:

```ts
const res  = await ns.get(ns.idFromName(lane)).fetch('https://ur-ads/start', { method: 'POST' })
const body = await res.json().catch(() => null)
await beat(`lane-alarm-boot:${lane}`, res.ok, Date.now() - t0, undefined, undefined, (body ?? {}))
//                                                                               ^^^^^^^^^^^^
//  /start 응답 본문 전체를 하트비트 extra 로 저장한다 — 그리고 #1818 이 그 본문에 alarmAt 을 넣었다
```

⇒ **`alarmAt` 이 매시 :01 마다 `cron_hb:ads:lane-alarm-boot:{lane}` 에 이미 기록되고 있었다.**
전 세션은 레인 스탬프(`set_ok`·`armed_at`)만 읽고 이 `extra` 를 안 읽었다.
`by` 표식은 버리는 게 아니라(회차마다 찍혀서 더 촘촘하다) **먼저 읽었어야 했다.**

#### 19:01Z(04:01 KST) 부트스트랩이 실제로 본 것

```
lane                   부트 시각     started   그때 걸려 있던 알람
enrich-influencer      04:01:09     false     04:01:34   ← 25초 뒤 발화 예정
enrich-influencer-2    04:01:09     false     04:01:33
enrich-influencer-3    04:01:09     false     04:01:33
enrich-influencer-4    04:01:09     false     04:01:10
maintenance            04:01:09     false     04:01:12
```

**둘 다 중요하다**: ⓐ `alarmAt` 이 **null 이 아니다** — 알람이 실재했다 ⓑ `started=false` —
부트스트랩이 `alive` 로 판정해 **손을 안 댔다.**

#### 그래서 측정 4 의 모델이 틀렸다

제가 쓴 것: *"정각 부트스트랩이 되살린다 → 4~5회 돈다 → 죽는다 → 다음 정각이 되살린다."*
실측: **부트스트랩은 아무것도 되살리지 않았다.** 체인이 시간 경계를 **스스로** 넘었다.
⇒ *"매시 정각 부트스트랩이 유일한 생명줄"* 이라는 전제로 처방을 고르지 말 것.

#### ⚠️ 그래도 ④ 를 완전히 못 죽였다 — 창이 다르다

04:01 판독은 **체인이 건강한 순간**의 것이다(그 시각 회차가 정상으로 돌고 있었다).
*멎은 동안* 알람이 남아 있는지는 **아직 안 봤다.** 그걸 보려면 `/start` 를 호출해야 하는데
그건 되살리는 동작이라 측정을 망가뜨린다. ⇒ **05:01 부트스트랩이 공짜로 그 판독을 한다**:

| 05:01 의 `alarmAt` | 뜻 | 판정 |
|---|---|---|
| `null` | 되읽기로 확인된 알람이 그 뒤 사라졌다 | **④** (DO 스토리지 롤백 등) |
| 04:29~04:30 (대폭 초과) | 알람은 있었고 런타임이 안 배달했다 | **②** |
| 05:01+ (갓 걸림) | 그 사이 혼자 되살아났다 | **②** (늦은 배달) |

🔑 **`set_ok=true` 가 ④ 를 죽이지 않는다.** 그 값은 `setAlarm` 직후 **같은 트랜잭션 안에서**
되읽은 것이라, 핸들러가 그 뒤에 throw 해서 DO 스토리지가 롤백되면 **스탬프(외부 D1)만 남는다.**
스탬프는 "걸었다고 믿었다" 를 말하고, 걸려 있는지는 **다음 정각 판독**만 말한다.

### 🔬 측정 8 — **코드는 이미 ② 를 전제로 쓰여 있었다** (19:45Z)

멎음에 **의도적 백오프가 있는지** 코드로 확인했다(추측 금지). 없다:

```ts
// lane-alarm-policy.ts
export function nextWakeAt(now, interval, runsThisHour, cap, failStreak) {
  if (runsThisHour >= cap) { /* 다음 정시로 */ }
  const mult = Math.min(FAIL_BACKOFF_MAX, Math.max(1, failStreak + 1))
  return now + interval * mult          // ← runs 26 < cap 60, failStreak 0 ⇒ 정확히 +60초
}
```

빈 회차(`bio=0 yt=0`)에 대한 분기가 **없다.** 예산도 아니다 — `spent=59 / budget_total=675`(**9%**).
⚠️ 전 세션이 적은 *"회차당 서브리퀘스트 56 중 51(91%)"* 과 혼동하지 말 것. 이 레인의 예산은 675 다.

**그런데 같은 파일이 이미 답을 적어 뒀다:**

```ts
export const ALARM_DEAD_AFTER_MS = 30 * 60_000
//  "간격의 몇 배로 두는 이유: 런타임의 알람 발화는 **정확하지 않다**
//   (수십 초~수 분 지연이 정상). 너무 짧으면 정상 지연을 죽음으로 오판해
//   알람을 계속 덮어써서 **오히려 회차를 잃는다**."
```

⇒ **이 코드의 작성자는 ②(런타임 배달 지연)를 정상 동작으로 전제하고 임계값을 30분으로 잡았다.**
그리고 경보 임계는 `staleGapMinutes(1) = 32분`으로 그와 맞춰져 있다.
**지금 관측한 5~9분 간격은 그 기준으로는 "정상" 이고 경보도 안 울린다.**

#### 그래서 #89 의 질문이 바뀐다

| | 내가 쓴 프레임 | 측정이 지지하는 프레임 |
|---|---|---|
| 현상 | 체인이 매시 죽는다 | 알람 **배달이 불규칙**하고 **드물게 심하다** |
| 경보 | 상시 `ok:false` | 32분 초과 때만 — 간헐 |
| 고칠 수 있나 | 코드 | ② 면 **코드로는 못 고친다**(런타임) |

⇒ 남은 질문은 *"가끔 32분을 넘는 간격이 왜 생기나"* 하나이고, **②면 우리 코드의 일이 아니다.**
판정은 05:01 부트스트랩의 `alarmAt` (측정 7 의 표) 또는 혼자 되살아나는지(감시 중)가 낸다.

### ✅ #88 — 낡은 함의 정정 (`lane-alarm-policy.ts` `alarmReviveKind` docblock)

그 docblock 의 **2026-08-09 기록은 역사로 정확하다**(측정 갈래가 3.5시간 죽어 있었고 그 함수가 고쳤다).
낡은 것은 **함의**다 — *"다음 정각이 되살린다"* 를 일반 해결로 읽으면 안 된다. 구멍이 둘 남는다:

```
구멍 A  :29 에 멎으면 :01 까지 32분을 아무도 안 본다   (실측: 04:29 멎음 → 04:41 에도 그대로)
구멍 B  :40 에 멎으면 :01 에 21분밖에 안 지나 'alive' → 안 되살리고 다음 정각까지 또 기다린다
```

그리고 **`deadAfterMs` 를 낮추는 것이 답이 아니다** — 그 본문이 이미 적어 둔 이유 그대로(정상 지연을
죽음으로 오판해 알람을 덮어쓰면 **오히려 회차를 잃는다**). 고칠 자리는 임계값이 아니라 *배달이 왜 늦는가* 다.
⇒ 주석만 추가했다(코드 무변경). 가드는 안 만들었다 — **주석 정확성은 주입으로 판정할 수 없다**
(러너가 *"주입 대상이 주석에만 있다"* 로 거부한다. 2026-10-12 블로그 날짜 항목에서 같은 이유로 배웠다).

### 🔴 측정 9 — **제 ② 처방이 틀렸다. 그리고 `60` 은 재 본 값이 아니다** (19:50Z)

②(배달 지연)의 고칠 자리를 *"`ADS_PLAN` 을 대표가 켠다"* 로 적어 뒀다(결재 트리거 프롬프트·태스크 설명 포함).
**라이브 바인딩을 읽어 보니 이미 켜져 있다**:

```
ur-ads 바인딩 43개 중
  ADS_PLAN                     = paid        ← 이미 유료로 선언돼 있다
  ADS_LANE_ALARM_RUNS_PER_HOUR = (미설정)    ← 그래서 cap 이 RUNS_PER_HOUR_PAID = 60
  ADS_LANE_ALARM_INTERVAL_MS   = (미설정)
  ADS_INFLUENCER_ENRICH_BUDGET = (미설정)
```

⇒ **②로 판정되어도 대표가 켤 스위치가 없다.** 그 처방을 그대로 보고하면 대표에게 할 일 없는 일을 시킨다.

#### 🔑 그리고 그 상수 자신이 "추측" 이라고 적혀 있다

```ts
export const RUNS_PER_HOUR_DEFAULT = 12
/** 💳 유료 상한 — 분당 1회(=간격 하한과 정합). **이것도 추정이며 전환 후 재측정 대상.** */
export const RUNS_PER_HOUR_PAID = 60
```

**`60` 은 런타임이 배달할 수 있는 값을 재서 정한 게 아니다.** 실측은 19:00 시간대 **26~29회/시간**이다.
⇒ **#89 는 "체인이 죽는 결함" 이 아니라 그 주석이 예고한 "재측정" 일 수 있다** — 레인은 60회를 걸고
런타임은 그만큼 못 배달하며, `max_gap_min` 경보는 *"선언이 실측보다 크다"* 를 알리고 있다.

⚠️ **그래도 단정하지 말 것** — 26~29회/시간이 *런타임의 상한*인지 *이 시간대에만 그랬는지*는
아직 한 시간 표본뿐이다(이 세션에서 관측 창으로 다섯 번 틀렸다). 그리고 **간격을 늘리는 쪽으로 고치면
처리량이 실제로 줄 수 있다** — 지금은 못 배달해서 못 도는 것이지 걸지 않아서가 아니다.
⇒ 선언을 낮추는 변경은 **여러 시간대 표본을 모은 뒤** 별건으로.

### ✅ #89 판정 — **② 확정 · ④ 미성립. 그리고 기제가 보인다** (20:00~20:01Z)

04:29 에 멎은 체인이 **무엇에 깨어나는지** 끝까지 봤다.

```
레인              걸려있던 알람   실제 발화     지연        by
shard 4          04:30:00      05:00:06     30분 06초   alarm
shard 3          04:29:08      05:00:14     31분 06초   alarm
shard 2          04:29:21      05:00:28     31분 07초   alarm
shard 1          04:29:28      05:00:36     31분 08초   alarm
maintenance      04:29:33      05:00:38     31분 05초   alarm
```

#### ④ 기각 — 알람은 사라지지 않았다

**`by=alarm` 5/5** 이고 발화가 **05:00:0x**, 즉 부트스트랩(05:01:08)보다 **먼저**다.
⇒ 알람은 실재했고 **혼자** 발화했다. 2차 독립 판독(부트스트랩)도 같은 말을 한다 —
`started=false` 4/5(이미 살아 있어 손 안 댐).

#### ② 확정 — 런타임이 **31분 늦게** 배달했다

`set_ok=true`·`armed_at==next_at` 는 **처음부터 맞았다.** 걸린 알람이 31분 뒤에 왔을 뿐이다.

#### 🔑 그런데 "31분" 은 지연이 아니라 **정각 일괄 배달**이다

걸린 시각은 **52초**에 걸쳐 흩어져 있는데(`:29:08` ~ `:30:00`) 발화는 **32초 창**에 몰렸다
(`:00:06` ~ `:00:38`). 게다가 **가장 늦게 걸린 shard 4 가 가장 먼저 발화**했다 — 개별 알람에
일정한 지연이 붙은 것이라면 순서가 보존돼야 하는데 뒤집혔다.

⇒ 런타임이 **정각에 밀린 알람을 쓸어서 한꺼번에 배달**한다(DO 하나씩 ~8초 간격으로 깨우며).
*"31분 늦었다"* 는 **"다음 정각까지 기다린 시간"** 이고, 04:29 에 멎었으니 31분이었던 것이다.

#### 🔴 그래서 경보 임계값이 **구조적으로 낮다**

| | |
|---|---|
| `staleGapMinutes(1)` = 경보 임계 | **32분** |
| 이번에 실측한 간격 | **31분 8초** (경보 안 울림 — 52초 차이로) |
| 멎는 시점이 `:02` 였을 때(표본 2 **실측**) | 간격 **58분** → 경보 **울림** |
| 구조적 최악 | 정각 직후 멎으면 **≈60분** |

**즉 임계 32분은 자연 동작의 최댓값(≈60분) 아래에 있다.** 멎는 시점이 `:28` 보다 이르면
경보가 울리고 늦으면 안 울린다 — 그게 간헐 경보의 정체이고, **파이프라인 고장이 아니다.**
그리고 같은 사실이 **27배 시간별 변동**도 설명한다 — 그리고 그건 가설이 아니라 **측정됐다**:
표본 3개에서 `회차 수 × ~110명 = 그 시간대 측정량` 이 그대로 맞는다(아래 📉 절).

#### 📊 정각 표본 누적표 (태스크 #89 — **5개** 모이면 임계값을 정한다 · 현재 **4/5**)

| # | 시간대 | 멎기까지 회차 | 멎은 시각 | 다음 배달 | 간격 | 경보(임계 32분) |
|---|---|---|---|---|---|---|
| 1 | 19:00Z (04시) | **26~29** | 04:29:08~04:30:00 | 05:00:06~05:00:38 | **31분 05~13초** | 안 울림 (52초 차이) |
| 2 | 20:00Z (05시) | **3** | 05:02:20~05:02:50 | 06:00:49~06:01:42 | **57분 59초 ~ 58분 52초** | **울림** |
| 3 | 21:00Z (06시) | **1~2** | 06:01:00~06:01:42 | 07:00:30~07:01:25 | **59분 07초 ~ 60분 08초** | **울림** |
| 4 | 22:00Z (07시) | **1~2** | 07:00:25~07:01:25 | 08:00:33~08:01:05 | **60분 07~08초** | **울림** |
| 5 | 23:00Z (08시) | **1~2** | 08:00:33~08:02:02 | *미관측 — 판정 끝* | — | — |

### ✅ 표본 5개 완료 — 공식이 4/4 (±1분)

| 표본 | 멎은 분 | 예측 `60 − 멎은 분` | 실측 간격 |
|---|---|---|---|
| 1 | `:29` | 31분 | **31분 05~13초** |
| 2 | `:02` | 58분 | **57분 59초~58분 52초** |
| 3 | `:01` | 59분 | **59분 07초~60분 08초** |
| 4 | `:00.5~:01.4` | 59~60분 | **60분 07~08초** |

**관측 최대 간격 = 60분 08초** · 구조적 상한 = `60분 + sweep 착지 지연(실측 최대 1분 42초)` ≈ **62분**.

#### 🧭 표본 5에서 "모델이 깨졌다" 로 오판할 뻔했다 (같은 함정 여섯 번째)

표본 4→5 의 간격이 **다섯 레인 전부 60분 07~08초**(1초 안)이고 **멎은 순서가 배달 순서로
보존**됐다. 그 둘만 보면 *"정각 sweep 이 아니라 알람마다 정확히 +60분 지연"* 으로 읽힌다 —
그러면 표본 1(간격 31분 · 순서 역전)과 모순이라 **모델이 깨진 것**이 된다.
🔑 **아니다.** 표본 4의 멎음이 전부 `:00:3x~:01:2x` 에 몰려 있어서 `60 − 1 = 59분` 과
`+60분` 이 **구분되지 않는 구간**이었다. 모델로 계산하면 59~60분이고 실측 60분 07초가 그 안이다.
순서 보존도 5점 30초 창에서는 증거가 약하다(표본 1·3에서는 역전됐다).
⇒ **두 모델을 가르는 유일한 표본은 1번(`:29` 에 멎어 31분)** 이고, 그것이 `+60분 고정` 을
기각한다. 공식은 4/4 로 살아 있다.

#### ❌ `collect`·`collect-neis` 레인 가설 — **기각됐다**

표본 5에서 `collect-neis` 는 **`by=alarm`** 이고 부트가 `alarmAt=09:00:00` 을 읽었다(알람 실재).
대신 **`enrich-influencer-2`** 가 새로 `started=true revived=false` 다. ⇒ `getAlarm()` null 집합이
시간마다 **돌아간다**(05시 `maintenance`·`collect-neis` / 07시 `collect-neis` / 08시 `shard 2`)
= 레인 단위 알람 소실이 아니라 **배달 레이스**다.
📌 `collect` 만 3/3 로 null 인데, 그 레인의 회차가 매시 **`:01:5x`**(부트보다 ~50초 뒤)라
부트가 들여다본 순간 **배달 대기 중**인 것으로 설명된다.
⚠️ **미해결 하나**: 그런데 `collect` 의 `by` 는 `boot` 다 — 회차가 부트 하트비트 `at` 보다
54초 뒤인데 `BOOT_KICK_WINDOW_MS` 는 15초다. 그 `at` 이 배치 시각이라 둘을 비교할 수 없다는
것과 일관되지만 **정확한 설명은 못 한다.** 지어내지 않고 적어 둔다.

**🎯 가설이 2/2 로 맞았다 — 간격 ≈ `60 − 멎은 분`.**

| 표본 | 멎은 분 | 예측 간격 | 실측 간격 | 차이 |
|---|---|---|---|---|
| 1 | `:29` | 31분 | **31분 05~13초** | +0:05~0:13 |
| 2 | `:02` | 58분 | **57분 59초~58분 52초** | −0:01~+0:52 |
| 3 | `:01` | 59분 | **59분 07초~60분 08초** | +0:07~+1:08 |

**🔧 표본 3이 공식을 다듬었다 — sweep 은 `:00:00` 에 안 온다.** 세 표본의 배달 시각이
`05:00:06~05:00:38` · `06:00:49~06:01:42` · `07:00:30~07:01:25` 이므로 정확히는

> `간격 ≈ (60 − 멎은 분) + sweep 착지 지연`, 그 지연이 실측 **6초 ~ 1분 42초**

다. 공식은 **±2분 안에서** 맞는다고 말해야 정확하다.

🔴 **그리고 한 레인이 60분을 넘겼다**: `enrich-influencer-2` 가 **60분 08초**(06:00:49 →
07:00:57). *"구조적 최악 ≈60분"* 이라고 적어 뒀던 것은 **sweep 지연을 빼고 센 값이라 낮았다** —
현실적 상한은 **약 62분**이다(`60분 + 관측 최대 지연 1분 42초`). ⇒ **임계값을 60으로 잡으면
여전히 간헐 경보가 난다.** 표본 5개를 채운 뒤 정할 값의 하한이 이것으로 올라갔다.
⚠️ 이것은 *"정각을 아예 건너뜀"*(분포의 꼬리)이 **아니다** — 반증 조건에 제가 *"간격이 60분을
넘음"* 이라고 적었어서 **문자 그대로는 발동**했지만, 의도한 뜻은 한 시간을 통째로 건너뛰는
경우였고 그건 아직 안 봤다. **조건을 쓸 때 재는 값과 뜻하는 바를 같이 적어야 한다.**

즉 **"알람이 N분 늦는다" 가 아니라 "다음 정각까지 기다린다"** 이고, 그래서 간격이 0~60분
사이를 **멎은 시각에 따라** 움직인다. 경보 임계 32분은 그 범위의 **중간**에 있다 — 그래서
어떤 시간대는 울리고 어떤 시간대는 안 울린다(표본 1 안 울림 / 표본 2 울림).

**표본 2가 표본 1보다 훨씬 쓸모 있다** — 연속한 두 시간에서 **3회 ↔ 26~29회**로, 27배 시간별
변동을 *같은 계측으로 직접* 봤다. 그리고 표본 2는 **반증 기회**다: 가설(*"배달이 정각에 재개된다"*)이
맞으면 다음 배달이 06:00:0x 이고, **그 전에 재개되면 가설이 틀렸다.**

🔑 **표본 2를 지금 적어 둔 이유**: 레인 스탬프는 **매 회차 덮어써진다**. 06:00 회차가 돌면
*"05시는 05:02 에 3회로 멎었다"* 는 사실이 D1 에서 사라진다. 이력 테이블이 없으므로
**관측한 자리에서 바로 적는 것 말고는 보존 수단이 없다.**

#### 📉 그리고 **회차 수가 그 시간대 측정량을 그대로 정한다** (처방 우선순위가 여기서 나온다)

같은 창의 측정 원장(`ad_influencer_leads.perf_checked_at`, KST 시간대별):

```
04시  3,123   ← 표본 1 (26~29회)   ≈ 116/회
05시    345   ← 표본 2 (3회)       ≈ 115/회
06시    177   ← 표본 3 (1~2회)     ≈  89~177/회
07시    150   ← 표본 4 (1~2회)     ≈  75~150/회
```

**회차당 100명 안팎**이 네 표본에서 일치한다(회차 수가 1~2 로 적은 시간대는 폭이 넓다 —
첫 회차가 `runs=2` 로 관측되면 정확한 회차 수를 모른다). 🩸 여기 처음 *"100~116명"* 이라고
적었는데 **표본 3의 하한 89를 포함한 범위가 아니라 틀렸다** ⇒ 시간대 변동(12시간 창 **177~3,123 · 17.6배**,
50시간 창 27배)은 키워드 고갈도 쿼터도 CPU 도 아니라 **그 시간대의 체인이 몇 분에 멎었는가**
하나로 설명된다. 🔑 **CLAUDE.md 가 "무료 발굴량 = 레인 안정성 × 키워드 신선도" 라고 적어 둔 그
'레인 안정성' 의 실체가 이것이다** — 그리고 지금은 *안정성*이 아니라 **정각 배달 주기**다.

⚠️ 그래도 **처방을 아직 밀지 말 것**: 표본이 3개이고 그중 하나는 진행 중이다. 그리고 이 숫자가
가리키는 처방은 "경보 임계" 가 아니라 **"왜 유휴 DO 의 알람이 정각에만 배달되는가"** 인데,
그건 Cloudflare 런타임 쪽이라 우리 코드에 고칠 자리가 있는지부터 재야 한다.

#### 🔁 같은 두 레인이 두 시간 연속 `by=boot` 이다 (표본 4의 새 관찰)

표본 2·4 에서 **`collect`(cap 3)와 `collect-neis`(cap 1)만** `started=true revived=false`
(= `getAlarm()` null)로 나왔다. 제 기록대로 그 null 은 *알람 소실*과 *sweep 중 소비*를
못 가르지만, **같은 두 레인이 반복**되는 것은 우연으로 보기 어렵다.
⚠️ 아직 결론으로 올리지 않는다 — 표본 5개를 채운 뒤 *"그 둘만 반복되는가 / 다른 레인도 도는가"*
를 보고 판단한다. 그 둘이 특별하다면 `④`(알람 소실)가 **레인 단위로** 존재할 가능성이 열린다.
📌 표본 4의 측정 체인 다섯은 **`by=alarm` 5/5 로 깨끗했다**(표본 2에서 `boot` 였던
`maintenance` 도 이번엔 `alarm`) — sweep(07:00:30~07:01:25)이 부트스트랩(07:01:0x)보다
대체로 앞이라 표식이 안 겹쳤다.

#### ⚠️ 두 정각을 봤다 — 그래도 단정하지 말 것

*"배달이 정각에 재개된다"* 가 이제 **세 정각(표본 1·2·3)**에서 맞았고 공식도 ±2분 안에서
3/3 이다. 이 세션에서 관측 창 때문에 **다섯 번** 틀렸으므로 같은 함정을 여섯 번째로 밟지
않는다 — 3개는 "공식이 산다" 를 말하지만 **분포의 꼬리**는 아직 안 봤다: 멎음이 `:50` 이후인
시간대(간격이 10분 미만이라 경보가 아예 안 울린다) · 정각을 **통째로 건너뛰는** 경우 ·
그리고 멎지 **않는** 시간대(표본 1의 27회가 그 쪽에 가깝다). ⇒ **표본 5개까지 모은 뒤**에
임계값을 손댈 것. 지금까지 관측된 간격 범위는 **31분 05초 ~ 60분 08초**다.

#### 🩸 shard 4 의 `boot` 는 ④ 가 아니라 **관측 레이스**다

shard 4 는 05:01:13 에 `by=boot`·`runs=2` 로 한 번 더 돌았고, 부트스트랩이 그 직전
(05:01:08)에 `alarmAt=NULL` 을 봤다. **그 NULL 을 ④(알람 소실)로 읽으면 안 된다** —
shard 4 는 05:00:06 회차에서 05:01:06 용 알람을 걸었고, 부트스트랩이 들여다본 순간이
바로 그 알람이 큐에서 빠진(발화 직전) 2초 창이다. 그래서 `'none'` 으로 판정돼 되살려졌고
회차 하나가 공짜로 더 돌았다(해롭지 않다).
⚠️ **이 둘(진짜 소실 ↔ 발화 직전 NULL)을 이 데이터로는 못 가른다.** 가르려면 `getAlarm()`
직전·직후를 같은 회차에서 두 번 읽어야 하는데, 지금 그걸 만들 이유가 없다 — 어느 쪽이든
부트스트랩이 올바르게 복구하고 비용은 회차 하나다.

#### 🩸 표본 2 가 **판별기 자신의 한계 둘**을 드러냈다 (이게 이번 판독의 제일 값진 부분)

표본 2에서 `maintenance` 만 `by=boot` 이 나왔고, 부트스트랩 판독이
`started=true revived=false` ⇒ **`getAlarm()` 이 null** 이었다. 전 세션이 만든 판별기의
규약대로라면 그건 **④(알람 소실)** 이다. **그렇게 읽으면 안 된다 — 두 가지 이유로.**

**한계 ①  sweep 이 `:01` 부트스트랩을 *가로지르면* `by` 가 뭉개진다.**
`/start` 는 `kind !== 'alive'` 면 `setAlarm(now + 1_000)` 하고 표식을 남기는데, 원래 밀려
있던 알람이 그 **15초 창**(`BOOT_KICK_WINDOW_MS`) 안에 sweep 으로 배달돼도 **같은 표식을
읽어** `by='boot'` 을 찍는다. 표본 1에서는 sweep 이 05:00:0x 로 부트스트랩(05:01:08)보다
**확실히 먼저** 끝나 `by=alarm` 5/5 가 깨끗했다. 표본 2에서는 sweep 이
**06:00:49~06:01:42** 로 부트스트랩(06:01:0x)을 **걸쳐** 배달됐다.
⇒ **`by` 표식은 sweep 이 `:01` 보다 확실히 앞이나 뒤일 때만 믿을 수 있다.**

**한계 ②  부트 하트비트의 `at` 은 타이밍 근거로 쓸 수 없다.** `collect` 가 그걸 증명한다 —
하트비트 `at`=06:01:05 인데 회차는 **06:01:57**(52초 뒤)이고 `by=boot` 이다. `by=boot` 은
회차가 표식에서 15초 안이라는 뜻이므로 `/start` 는 06:01:42 이후에 불린 것이고, 따라서
**`at`=06:01:05 는 `/start` 시각이 아니다**(`adsBeat` 배치 플러시 시각이다). `lane-alarm.ts`
머리말이 `ads:scheduled` 에 대해 적어 둔 그 경고가 **`lane-alarm-boot` 에도 적용된다.**
🔑 **그 하트비트에서 쓸 수 있는 것은 `r` 본문(`started`·`alarmAt`)뿐이다.**

**반대로 `alarmAt` 값은 단단하다** — 그 값이 스탬프의 `next_at` 과 같은지로 관측 레이스를
가를 수 있다(표본 2 실측):

```
lane                  회차 at    스탬프 next_at   부트가 읽은 alarmAt      판정
enrich-influencer     06:01:00   06:02:00       06:02:00.618   ← next_at   부트가 회차 **뒤**에 봤다(레이스)
enrich-influencer-2   06:00:49   06:01:49       06:01:49.280   ← next_at   같음
enrich-influencer-3   06:01:42   06:02:42       06:01:35.980 · runs=2      1회차가 06:01:05 **전**에 이미 돌았다
enrich-influencer-4   06:01:36   06:02:36       06:01:30.021 · runs=2      같음
maintenance           06:01:22   06:02:22       (null)                     ④ 인지 sweep 중인지 **못 가른다**
```

⇒ **네 shard 는 스스로 재개했다(②, 표본 1과 같다).** `maintenance` 한 레인만 판정 불가이고,
그걸 가르려면 같은 회차에서 `getAlarm()` 을 두 번 읽어야 하는데 **지금 그걸 만들 이유가 없다**
— 어느 쪽이든 부트스트랩이 올바르게 복구하고 비용은 회차 하나다(표본 1의 shard 4 와 같은 결론).

#### 📌 그래서 #89 의 최종 성질

**알람 체인은 죽지 않는다.** 런타임이 밀린 알람을 정각에 쓸어 배달하고, 그 사이 간격이
경보 임계(32분)를 들락날락한다. 고칠 자리는 **체인이 아니라 경보 임계**이고, 그 값은
**여러 정각 표본**이 정한다. `RUNS_PER_HOUR_PAID = 60` 역시 그 분포를 보고 재측정할 값이다
(측정 9 — 그 주석이 이미 "추정" 이라고 적어 뒀다).

### 🚫 하지 말 것

- **`max_gap_min` 을 느슨하게 하지 말 것.** 32 는 설계와 맞고, 그 경보는 지금 **참**을 말한다.
  느슨하게 하면 이 결함이 보이지 않게 된다(제 첫 판이 그 처방이었다).
- 그 전까지 `/api/_healthcheck/cron` 은 **그 시간대가 몇 분에 멎었는가에 따라** `ok:false`
  구간이 달라지고(표본 1 안 울림 / 표본 2 약 26분간 울림 — 간격 58분 − 임계 32분),
  `uptime.yml`(10분)이 이슈·메일을 낸다. **그건 소음이 아니라 신고다.**
  🩸 여기 처음 적어 둔 *"매시 약 28분간"* 은 **표본 1 하나로 일반화한 값이라 틀렸다** —
  경보 구간은 `0분`(일찍 안 멎은 시간대)에서 `~28분`(정각 직후 멎은 시간대) 사이를 움직인다.

### 같은 측정에서 **결함 아님으로 판정** (다시 파지 말 것)

| 재 본 것 | 실측 | 판정 |
|---|---|---|
| `ads:*` 67레인이 전부 48~60분 | 정시에 전부 리셋 | 톱니의 일부 — 처음에 "유어애즈 1시간 정지" 로 오진할 뻔했다 |
| `collect` 가 stale 목록에 없다 | `gap=70` 이라 60분을 못 넘는다. **같은 체인 끊김을 겪는다**(지연 15분) | 선언이 느슨해서 안 보이는 것일 뿐 |
| 본진 cron | `cache-prewarm` 3분 · `d1-backup-chunked` 6분 | 정상 |

🧭 **교훈 둘, 둘 다 이 세션에서 값을 치렀다**
1. **4분 창으로 60분 주기를 판정했다** — 단조증가를 멈춤의 증거로 읽었고 정시를 넘겨서야
   뒤집혔다(`CLAUDE.md` 가 적어 둔 관측 창 함정).
2. **그 뒤 "주기 안의 증가" 로 뒤집고는 반대쪽으로 너무 갔다** — "그러면 선언이 틀린 것" 으로
   단정했는데, 스탬프를 읽으니 선언은 맞고 레인이 진짜 안 돌았다. **두 번 다 추측이 측정을
   앞질렀다.** 경보를 약화시키는 처방은 특히, 그 경보가 틀렸다는 **직접 증거**를 보고 쓸 것.

### 🔬 #89 의 원인을 가르는 측정을 코드에 넣었다 (같은 PR · 관측만)

`lane-alarm.ts` 가 예약 직후 `getAlarm()` 으로 **되읽어** 스탬프에 두 값을 더 남긴다:

```
set_ok    : setAlarm 이 성공했는가 (종전엔 `.catch(() => undefined)` 로 삼켰다)
armed_at  : 되읽은 예약 시각 (ISO — `next_at` 과 눈으로 비교된다)
```

**동작은 1바이트도 안 바뀐다**(예약·간격·상한·스탬프 키 전부 그대로). 되읽기 실패도 삼킨다 —
관측이 레인을 멈추면 안 된다.

✅ **그 판정은 같은 날 18:02:42Z 에 끝났다** — `set_ok` 6/6 `true` · `armed_at` 6/6 이
`next_at` 과 일치 ⇒ **후보 ① 기각**(상세·수치는 위 `## #89` 의 "E4 라이브 판정 통과" 절).
✅ **그 가르기는 끝났다 — ② 확정 · ④ 미성립**(20:00Z 실측). 위 "✅ #89 판정" 절을 볼 것. 다음 액션은 가르기가 아니라 **정각 표본 모으기**이고 문서 맨 위에 있다.

가드: `alarm-arm-readback-2026-10-14.test.ts` 6건 + 주입 6건 **되돌려-검증 전부 빨간불 확인**
(그중 하나는 **반대 방향** — 관측을 넣다가 예약을 빼 버리는 쪽. 그게 더 조용하고 더 나쁘다).
🩸 그 시험의 첫 판이 `indexOf('getAlarm()')` 로 앵커를 잡아 **되살리기 경로(`:70`)의 같은
호출**에 걸려 멀쩡한 코드에 빨간불을 냈다 — 이 세션에서 **세 번째** 같은 실수다.
