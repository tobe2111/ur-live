# 2026-10-12 — SEO/GEO E4 라이브 판정 통과 + 다음 다섯 건

## 1. 다음 세션의 첫 액션

**아무것도 급하지 않다.** #1731 은 머지·배포·E4 판정까지 끝났다. 남은 것은 **대표가 고를 다섯 건**이고,
그중 하나만 승인이 필요하다. 대표가 "진행" 이라고 하면 아래 표의 순서로 간다.

| 할 일 | 등급 | 잠금 | 한 줄 |
|---|---|---|---|
| #17 | 🔴 | ⚠️ `index.html` 승인 필요 | 인앱 안내 **219자**가 AI 봇 문서의 맨 앞 — 상세 본문의 61% |
| #18 | 🔴 | — | 숙소 **49건**이 `/pass/:id` ↔ `/stays/:id` 두 URL 로 색인 경쟁 |
| #19 | 🟠 | — | `/region` 44 + `/blog` 23 = **67페이지**에 `BreadcrumbList` 0건 |
| #20 | 🟠 | — | 공개 API 가 AI 봇별로 갈림(`Applebot`·`MistralAI-User`·`YouBot` 만 200) |
| #21 | 🟡 | — | 딜 3건 미만 지역이 `index` + 26자 — **이번 요약으로 게이트를 닫을 수 있다** |

각 항목의 근거·수리 방향·함정은 할 일(#17~#21)의 description 에 그대로 적어 뒀다. 재현 명령은 §3.

## 2. 완료분 (#1731, 스쿼시 `92755d85e` · 배포 자산 `index-DUSlwuGS.js`)

네 건 전부 **E4 통과**. 상세 수치는 CLAUDE.md 의 해당 audit 항목에 ✅ 로 박아 뒀다.

- **지역 요약** — 색인 대상 시/도 **11곳 전부** 항목이 찼다(경기 `26자·0항목 → 414자·10항목`). 시군구도 산다.
  `/stays` **5 → 10항목**. 🔒 **홈은 종전과 동일**(395자·`ItemList` 10·전부 `/pass/`) = 요약이 주입으로 안 샜다.
- **목록 네 표면** — `/vouchers` 36→268 · `/browse` 23→60 · `/map` 38→398 · `/stays` 34→308.
  `/vouchers` 는 `ItemList` **0 유지**(의도).
- **thin 12표면** — 15~40자 → **98~154자**. `/terms` 334 · `/terms/seller` 246(약관 목차는 문서 자체에서 파생).
- **`/llms.txt`** 404 → **200**(8,781 bytes) · **다국어 거짓 선언 제거**(5경로 전부 `og:locale:alternate` 0 ·
  `hreflang` 0 · `og:locale` = `ko_KR`).
- 소비자 **15경로 전부 200**(회귀 0).

## 3. 이번에 틀렸던 판단 (같은 오진 반복 방지)

측정기 오류가 **이 세션에서만 일곱 번**이다. 전부 "0 또는 없음" 으로 읽혀 결함으로 오진할 뻔했다.

1. `grep -c '#organization'` — **노드 수가 아니다**(참조도 센다).
2. `ld+json` 정규식에 `[^>]*` 없음 — CSP `nonce` 때문에 **블록 0개**로 읽혔다.
3. `@graph` **top-level 만** 훑음 — `ItemList` 는 `CollectionPage.mainEntity` **안**에 중첩.
4. 시드 탐색을 `__SSR_INITIAL_MAIN__\s*=\s*` 로 — 실제는 `id="…" type="application/json">`.
5. "전" 값으로 `limit=100&page=1`(100행)을 씀 — **라이브 MAIN 시드는 `limit` 없는 50행**이다.
6. **JSON 스칼라만 출력하는 필터** — `Product.image` 가 **배열**이라 "image 누락" 으로 읽혔다(있다).
7. sitemap 의 `/region/경기` 를 **내가 만든 퍼센트 인코딩**으로 grep — 0건이 나왔다(디코드해서 보면 **44건 중 실재**).

⇒ **0 이 나오면 먼저 측정기를 의심할 것.** 구조화 데이터는 **재귀로 훑어서**, 문구 검사는 **주석(`^#`·`/* */`)을
걷어내고**, 전·후 비교는 **"전" 이 정말 라이브와 같은 입력인지 먼저 확인하고** 판정한다.

그리고 기록 오류 하나를 정정했다 — CLAUDE.md 에 적혀 있던 *"Meta AI 는 애초에 차단 목록에 없다"* 는 **틀렸다**
(라이브 robots 실행줄 `:75` 에 `Meta-ExternalAgent` 가 있다). 정책은 일관되고 기록만 틀렸다.

## 4. 재현 명령

```bash
UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

# 숙소 중복(#18) — 둘 다 200 + index + 자기참조 canonical 이면 미수리
for u in /pass/2887 /stays/2887; do curl -s -A "$UA" "https://urdeal.kr$u" \
  | grep -oE '<link rel="canonical" href="[^"]+"|name="robots" content="[^"]+"'; done
curl -s https://urdeal.kr/sitemap.xml | grep -c '/stays/'      # 0 이면 정본 미제출

# 빵부스러기(#19) — region·blog 가 0 이면 미수리
for u in "/region/%EC%84%9C%EC%9A%B8" /blog /vouchers; do
  echo -n "$u "; curl -s -A "$UA" "https://urdeal.kr$u" | grep -c BreadcrumbList; done

# AI 봇 API 비대칭(#20) — Applebot·Mistral·YouBot 만 200 이면 미수리
for b in OAI-SearchBot Claude-SearchBot PerplexityBot Applebot MistralAI-User YouBot; do
  echo -n "$b "; curl -s -o /dev/null -w '%{http_code}\n' -A "$b/1.0" \
    "https://urdeal.kr/api/group-buy/products?status=active&limit=1"; done

# 지역 thin 게이트(#21) — index, follow 면 미수리
curl -s -A "$UA" "https://urdeal.kr/region/%EC%9D%B8%EC%B2%9C" | grep -o 'content="index, follow"'

# 인앱 안내(#17) — AI 봇과 Googlebot 본문 차이가 220자면 미수리
for b in "OAI-SearchBot/1.0" "$UA"; do curl -s -A "$b" https://urdeal.kr/pass/2919 \
  | python3 -c "import sys,re;s=sys.stdin.read();b=re.sub(r'<script[\s\S]*?</script>|<style[\s\S]*?</style>|<!--[\s\S]*?-->','',s);print(len(re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',b)).strip()))"; done
```

## 5. 남은 결정 / 대기

- **#17 만 대표 승인이 필요하다**(`index.html` 잠금표 파일). 잠긴 항목 셋(preload `crossOrigin`·
  Speculation Rules·preconnect)과는 무관하고, 2026-04-28 흰화면 방어 영역이라 승인 경유가 맞다.
  🔑 **옮겨도 잃는 것이 없다** — 그 블록은 `display:none` 이고 `.show` 를 **JS 만** 붙이므로
  "JS 차단 환경에서도 표시" 라는 `:464` 주석은 이미 성립하지 않는다(`:648` 이 자백해 뒀다).
- 데모 색인은 **대표 결정으로 유지**(2026-10-12 *"그냥 두기"*). 바꾸지 말 것.
- **기술로 안 되는 것**: 실입점 매장이 **2곳**(활성 359건 중 357건 데모)이라 "동네 맛집" 질의에
  우리를 쓸 이유 자체가 적다. 위 다섯 건은 *실물이 늘어나는 순간 바로 인용되게* 준비해 두는 몫까지다.
