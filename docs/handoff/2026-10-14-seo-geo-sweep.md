# 인계 — SEO·GEO 스윕 (2026-10-14)

대표 지시: *"머지하고 또 개선점 찾아보자. SEO 와 GEO 부분에서"* (연속 지시 — 재고 고치고 머지하고 또 찾는다).

## 🚩 다음 세션의 첫 액션

```bash
# ① PR #1791 이 머지됐는지 (auto-merge 걸려 있다)
gh api repos/tobe2111/ur-live/pulls/1791 --jq '{state,mergeable,merge_state:.mergeable_state,head:.head.sha}'

# ② 머지됐으면 E4 — 아래 셋을 라이브에서 **파싱해서** 판정한다(문자열 개수로 판정하지 말 것)
UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
#  #72 빵부스러기 — item 1·2 가 서로 다른 URL 인지 + 루트 이름이 전 표면에서 `유어딜` 하나인지
curl -sS -A "$UA" https://urdeal.kr/pass/2823 | python3 -c "
import sys,re,json
for m in re.finditer(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', sys.stdin.read(), re.S):
    d=json.loads(m.group(1))
    for n in (d.get('@graph') or [d]):
        if n.get('@type')=='BreadcrumbList':
            print([(i['position'],i['name'],i['item']) for i in n['itemListElement']])"
#  #74 가게 정본 — /s/ 와 /profile/ 이 **같은 하나**를 가리키는지
for p in /s/store_mux /profile/store_mux; do curl -sS -A "$UA" "https://urdeal.kr$p" | grep -o 'rel="canonical"[^>]*'; done
#  #75 숙소 문구 — cron(04:20 KST) 1회 뒤 줄표가 사라졌는지
curl -sS 'https://urdeal.kr/api/group-buy/stays/2732' | python3 -c "import sys,json;d=json.load(sys.stdin)['data']['product'];print(repr(d.get('description'))[:200])"
```

⚠️ **#75 는 cron 이 한 번 돌아야 판정된다**(일일 티어 04:20 KST). 그 전에 재면 옛 문장이 그대로이고
그것은 회귀가 아니다. 돌았는지는 어드민 `GET /api/admin/cron-heartbeats` 의 `scheduled-cleanup` +
그 회차 `results.stay_desc_healed` 로 본다.

## ✅ 이번 세션 완료분

| # | 무엇 | 커밋 / PR |
|---|---|---|
| 69 | robots 값 SSOT — `max-image-preview:large` 명시 + noindex 가 크롤러별로 갈린 것 | `882fa4089` |
| 70 | `/s/:username` 유어샵 크롤러 본문 6자 → 채움(앞으로 **모든 신규 매장**의 기본 경로) | `b6cb55027` |
| 71 | 상세 제목 SSOT — 숙소는 Googlebot 이 지역을 잃었고 교환권 ~135건이 "교환권 교환권" | `dc1822d3f` · 가드 재조준 `a0bdc35f6` |
| 72 | `/pass` 310건 빵부스러기가 같은 URL 을 두 번 + 루트 이름 두 벌(`홈` 359 ↔ `유어딜` 90+) | `3b2f2dbd3` |
| 74 | 가게 유어샵이 `/s/` 와 `/profile/` 두 URL 로 색인 경쟁(각자 자기를 정본으로) | `6d5e83652` |
| 75 | 숙소 소개 문구 치유가 **한 번도 안 돌았다** — 색인 49건이 대표가 지적한 그 문장 | `7e1beed2c` · 래칫 `e0860288a` |
| — | CI 빨강 수리(아래 🩸 ②) | 이 커밋 |

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

## ⏳ 남은 결정 / 대기 (대표 판단)

- **#76 IndexNow 켜기** — 코드는 완성, 게이트 OFF. 대시보드 → ur-live → Settings → Variables →
  `INDEXNOW_KEY`(영숫자 8~128) + `INDEXNOW_ENABLED=true`. 켠 뒤 `https://urdeal.kr/{key}.txt` 가
  200 + 키 본문인지 확인. (키 파일 라우트는 게이트와 무관하게 응답하므로 **켜기 전에 확인 가능**.)
- **#31 결재** — `/pass/:id` 공유 카드 SVG → 사진 한 장?
- **#35 결재** — `/pass/:id` 310건 검색 제목의 "공동구매" 문구 + 꼬리 가게명
- **#68 결재** — `twitter:site` 가 없는 계정(@urdeal_kr · @utongstart)을 가리키는가

## 🔭 아직 안 재 본 각도 (다음 스윕 후보)

- `/blog/:slug` `BlogPosting.author` 가 Person 인가 Organization 인가(E-E-A-T) · 블로그 **상세**에
  `<link rel="alternate" type="application/rss+xml">` 이 없다(목록에만 있다)
- `/region` 허브의 `ItemList` 커버리지
- `#48` 뒤 `/urshorts` 의 `VideoObject` 실태
- 전 표면 `og:image` URL 중 실제로 404 인 것이 있는지
- **#73(미해결)** — `/pass`·`/products` 가 JSON-LD 를 두 벌 낸다(서버 + react-helmet, `Product` 둘이
  서로 다르다). 🔑 **봇 셸에는 스크립트가 없어 Googlebot 은 영향 0**(실측 `bodyLen 35`) — 영향받는
  것은 JS 를 렌더하는 AI 검색봇뿐이다. 처방 후보: `SEO.tsx` 가 *이미 비-helmet 블록에 있는
  top-level `@type`* 은 건너뛴다(fail-open). ⚠️ `GroupBuyDetailPage.tsx` 의 손으로 쓴 블록을 지우는
  것은 **로딩 잠금표 파일**이라 대표 승인이 필요하다.
