# 2026-10-12 — AI 봇 문서의 첫 본문 219자 제거 (#17 완료) · 남은 넷(#18~#21)

## 1. 다음 세션의 첫 액션

**배포 후 E4 판정** (머지되면 바로 — 1분이면 끝난다):

```bash
UA='Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot'
# ① 첫 본문이 "인앱 브라우저에서는" 으로 시작하지 않는지 (=219자가 사라졌는지)
curl -sS -A "$UA" https://urdeal.kr/ | python3 -c "
import sys,re
s=sys.stdin.read(); b=s.find('<body'); t=s[b:]
t=re.sub(r'<script[\s\S]*?</script>','',t); t=re.sub(r'<!--[\s\S]*?-->','',t)
t=re.sub(r'<[^>]+>',' ',t).replace('&nbsp;',' '); t=re.sub(r'\s+',' ',t).strip()
print(repr(t[:200]))"
# ② 폐기 명칭이 라이브 메타에서 사라졌는지 (표에 항목 없는 경로)
curl -sS -A "$UA" https://urdeal.kr/cart | grep -c '링크샵'   # 0 이어야 한다
# ③ 소비자 표면 회귀 0
for p in / /vouchers /browse /map /stays /pass/2919 /u/jiwon1228 /blog /faq /about; do
  printf '%s %s\n' "$p" "$(curl -sS -o /dev/null -w '%{http_code}' -A "$UA" "https://urdeal.kr$p")"; done
```

그리고 **폰(일반 브라우저)으로 홈 한 번** — 첫 화면이 종전과 같은지. (블록이 `display:none` 이었으므로
한 픽셀도 안 바뀌어야 **정상**이다. 바뀌었으면 CSS 를 과하게 지운 것이다.)

## 2. 이번에 한 것 (#17)

| | |
|---|---|
| 지운 것 | `index.html` 의 `#ud-inapp-block` 마크업 31줄 + CSS 13셀렉터 |
| 왜 | AI 검색봇이 받는 **모든 페이지의 첫 본문 219자**가 인앱 안내였다(마크업 1,656바이트) |
| 왜 지워도 되나 | **죽은 코드** — 2026-07-25 이후 `.show` 를 붙이는 코드가 없다(id 참조 index.html 밖 0건) |
| 동반 | 폐기 명칭 **링크샵 → 유어샵 4곳**(라이브 메타에서 서빙되고 있었다) |
| 가드 | `inapp-block-removed-2026-10-12.test.ts` 7건 + 주입 6건 빨간불 확인 |
| 검증 | tsc 0 · 신규 7 + 인접 4파일 85건 pass · 낡은 앵커 0(3,226건) · 잠금 지문 10종 불변 |

**그 봇들이 왜 이 문서를 받나**: `BOT_UA_REGEX`(`worker/index.ts:2331`)에 `googlebot`·`yeti` 는 있지만
AI 검색봇이 **없다** → Googlebot 은 봇 셸을 받아 못 봤고, ChatGPT·Claude·Perplexity 는 보고 있었다.

## 3. 이번에 틀렸던 판단 (같은 함정 반복 방지)

1. **모달 경로를 지어 썼다** — `src/components/common/InAppFeatureBlockedModal.tsx`(실제는 `src/components/`).
   시험이 즉시 잡았다. 가드가 가리키는 고정 경로는 **실재해야 한다**(`check-guard-registry` R2).
2. **219자 ≠ 1,656바이트** — 크롤러가 읽는 것은 태그를 걷어낸 **텍스트**다. 둘을 섞어 보고하지 말 것.
3. **제거를 기록한 주석이 검사 대상 문자열을 인용한다** — 판정은 `<!-- -->` 를 걷어낸
   **실행되는 마크업**으로. (이 레포가 `d1-migrate`·robots 에서 두 번 밟았다.)
4. **2026-10-11 기록이 틀렸다** — *"index.html·모듈의 브랜드 설명에서 링크샵 → 유어샵"* 이라 적었지만
   JSON-LD 만 고치고 **메타 네 곳을 놓쳤다**. 이번에 정정 + 가드로 고정.

## 4. 남은 넷 — 대표 선택 대기 (전부 잠금 파일 아님)

| # | 무엇 | 함정 |
|---|---|---|
| **#18** | 숙소 **49건**이 `/pass/:id` 와 `/stays/:id` 두 URL 로 색인 경쟁 | **둘을 같은 커밋에서** — (a) 상세 canonical (b) `sitemap.routes.ts:114` 의 하드코딩 `loc`. 하나만 고치면 불일치가 남는다. SSOT 는 `canonicalDetailPath` |
| **#19** | `/region` **44** + `/blog` **23** 에 `BreadcrumbList` 0건 | `crumbTrail` 이 `CONSUMER_SURFACE_SEO[acc].crumb` 를 찾는데 둘은 **동적 세그먼트**라 표에 없다 → 체인 길이 1 → 0건. 지역은 이미 해석된 `regionRefOf` 를 쓸 것(표를 늘리면 44행이 된다) |
| **#20** | 공개 API 가 AI 봇별로 갈린다 — `Applebot`·`MistralAI-User`·`YouBot` 200 | `SCRAPER_UA_PATTERNS`(`bot-detection.ts:150`)에 **세 줄 추가**. HTML 은 무영향(이 목록은 JSON API 전용) |
| **#21** | 딜 3건 미만 지역 페이지가 `index, follow` + 본문 26자 | `resolveRegionSeo` 가 DB 를 안 본다. **그런데 요약(`ssr:region-digest`)이 이미 KV 에 있고 워커가 읽는다** ⇒ 조회 0 으로 게이트 가능. ⚠️ **요약이 없을 때(KV miss·cron 전)는 절대 noindex 하지 않는다** — 데이터 부재는 thin 이 아니다 |

## 5. 남은 결정 / 기록

- **데모 색인은 대표 결정으로 유지**(2026-10-12 *"그냥 두기"*) — 실제 가게 이름·주소로 `index, follow`.
- **실제 입점 매장 2곳** — 기술로 안 되는 부분이다. 지금 작업은 *실물이 늘면 바로 인용되게* 준비하는 몫.
- `/refund` 에 **다른 서비스 문구**가 섞여 있다(`제22조 (환불) · 가. 경기 결제 회원`) — 법무 문구라 대표 확인 필요.

---

## 6. 같은 세션 후속 — #20·#19 완료 (2026-10-12)

### #20 GEO: 공개 API 의 형제 비대칭 셋
라이브 실측(UA 11종 × API/HTML):

```
GPTBot            API=403 HTML=403     Applebot           API=200 HTML=200  ← 검색엔진(의도)
OAI-SearchBot     API=403 HTML=200     Applebot-Extended  API=200 HTML=200  ← 목록에 있는데 200
ClaudeBot         API=403 HTML=403     MistralAI-User     API=200 HTML=200  ← 형제는 403
Claude-SearchBot  API=403 HTML=200     YouBot             API=200 HTML=200  ← 형제는 403
PerplexityBot     API=403 HTML=200     Googlebot          API=200 HTML=200
```

- **세 줄 추가**: `MistralAI-User`·`MistralAI-Index`·`YouBot`. HTML 은 그대로 200
  (`scrapeProtection` 은 `/api/*` 만 가린다 — 시험이 그 방향도 고정).
- 🚧 **`Applebot-Extended` 는 손대지 않았다.** `LEGIT_BOT_PATTERNS` 의 `/Applebot/i` 가 먼저
  통과시키고, 애초에 애플·구글은 그 토큰을 **robots.txt 전용**으로 쓴다(UA 는 늘 `Applebot`).
  **'살리려고' LEGIT 을 좁히면 애플 검색 색인이 통째로 막힌다** — 주입이 그 방향을 고정.
- 🩸 **내 애초 보고가 반만 맞았다**: "`Applebot` 200 = 비대칭 결함" 은 **틀렸다**(검색엔진이므로
  의도된 200). 진짜 결함은 `Applebot-Extended` 항목이 **도달 불가**라는 것이고, 그건 고칠 게 없다.
- 🩸 **기존 가드가 내 주석에 거짓 빨간불**: *"검색엔진은 수확 목록에 없다"* 가 `read(BOT)` **원문**을
  봐서, 제가 쓴 설명의 `Googlebot` 을 위반으로 집었다. **`code()` 로 재조준** + *진짜로 `/Googlebot/i`
  를 넣는* 주입으로 느슨해지지 않았음을 확인.
- 🩸 **내 새 단언이 거짓 전제**: `Google-Extended` 가 robots 차단에 있다고 썼는데 **2026-10-12 대표
  승인으로 일부러 뺀 줄**이었다(제미나이 그라운딩). 가드가 잡았고, 이제 **되살아나는 방향**을 막는다.

### #19 SEO: 지역 44 + 블로그 23 의 BreadcrumbList
- 지역은 `regionRef`(이미 해석됨)에서 단계를 쌓는다 — 표에 44행을 넣지 않는다.
- `/region` 허브는 **실재하는 페이지**(`resolveRegionSeo` 가 제 canonical 을 준다) → 중간 단계 OK.
  (유어샵의 `/u` 는 없는 URL 이라 중간 단계를 못 넣는다 — 그 차이가 이 판단의 핵심.)
- URL 은 **리졸버의 canonical 과 대조**한다(`강원특별자치도` → `/region/강원`).
- 블로그는 `유어딜 › 블로그 › 제목`, **시드 없어도 빵부스러기는 낸다**(종전 `''` → 0건).
- 🔗 **같은 체인을 두 벌 싣던 것 정리** — 전 목록 표면이 `@graph` + `breadcrumb` 양쪽에 동일 노드를
  넣고 있었다 → `@id` 참조 한 벌(이 JSON 은 사람이 받는 응답에도 실린다).

### 부수 — 러너가 부르는데 없는 가드 3건 (레지스트리 R3)
`install-git-hooks.sh` 가 2026-10-11 도매 철거로 사라진 가드 셋을 `|| true` 로 부르며 **스택트레이스만**
찍고 있었다. R1(파일→러너)·R2(가드→대상) 둘 다 못 보는 방향 → **R3 신설**.
🩸 그 R3 의 첫 판이 같은 클래스에 빠졌다: 러너 텍스트(셸·YAML·JS **이어 붙인 것**)에 블록 주석
제거기를 쓰니 한 파일의 `/*` 가 다른 파일의 `*/` 와 짝지어 **206,871 → 54,215자(74% 증발)**,
찾아야 할 호출이 그 안에 있어 **죽은 호출을 못 보고 초록**이 떴다 ⇒ 줄 주석만 걷는다.

## 7. #18 + #21 완료 (2026-10-12 · 대표 *"둘 다 잠금 해제하고 가장 이상적으로 개선"*)

**둘 다 `worker/index.ts`(잠금) 을 지난다** → `[UNLOCK_LOADING]` + CLAUDE.md 로딩 audit log 기재 완료.
워커 diff 는 **변수 분리 2줄 + 메타 삼항 1줄 + STAYDETAIL 분기 2줄** 뿐이고 래칫 **2672 유지**(`--rebaseline` 안 썼다).

| | #18 숙소 정본 단일화 | #21 thin 지역 noindex |
|---|---|---|
| 결함 | 같은 `products.id` 가 `/pass/2887`·`/stays/2887` **둘 다 200·canonical 자기자신·index,follow** | `/region/인천`·`세종`·`울산`·`서울/없는구` 가 **200 + index,follow + 본문 26자** |
| 수정 | `/stays/:id` 에 `Product`+`AggregateOffer`+크롤러 본문 → **그 다음에** canonical 을 거기로 + sitemap 도 같은 SSOT | 요약(`ssr:region-digest`)으로 그 지역 항목을 세어 임계값 미만이면 noindex (**DB 조회 0**) |
| 실측(전→후) | noscript **6 → 146자** · Offer **0 → AggregateOffer(149,000~209,000 · 2건)** | 서울/종로구 false · 경기/파주시 true · 인천 true · 요약 없음 false |

**🔴 다음 세션이 절대 뒤집지 말아야 하는 방향 둘** (주입이 각각 잠그고 있다):
1. **요약이 없으면 noindex 하지 않는다**(`!digestJson` · `!rows.length` 두 문 모두). 부재 ≠ thin —
   뒤집으면 배포 직후 색인 대상 **44개가 통째로** 빠지고 색인은 돌아오는 데 **수주** 걸린다.
2. **워커는 `digestRaw`(요약 원본)를 넘긴다.** `crawlerPayload` 는 봉투 모양이 같아(`{success,data:[]}`)
   받는 쪽이 구분할 수 없고, KV miss 면 MAIN 시드(서울 44 편중)가 흘러들어 **멀쩡한 지역이 noindex** 가 된다.

**가드**: `stay-canonical-thin-region-2026-10-12.test.ts` 14건 + 주입 `scripts/mutations/stay-canonical-thin-region-2026-10-12.mjs` **14건 전부 빨간불 확인**.
**기존 주입 둘 재조준**(지우지 않았다 — 불변식 그대로, 앵커만): `pass-route-migration`(sitemap 옛 주소) · `region-digest-2026-10-12`(요약이 주입으로 샌다).

### E4 (배포 후 — 이게 판정이다)

```bash
UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
# ① 정본이 채워졌는지 (종전 본문 6자 · Offer 0)
curl -sS -A "$UA" https://urdeal.kr/stays/2887 | grep -o 'AggregateOffer\|"@type":"Product"' | sort | uniq -c
# ② /pass(숙소) 가 /stays 를 정본으로 지목하는지
curl -sS -A "$UA" https://urdeal.kr/pass/2887 | grep -o 'rel="canonical" href="[^"]*"'
# ③ sitemap 이 같은 SSOT 를 지나는지 — /stays/ 0 → 49건 · /pass/ 359 → 310 안팎
curl -sS https://urdeal.kr/sitemap.xml | grep -c '/stays/'
curl -sS https://urdeal.kr/sitemap.xml | grep -c '/pass/'
# ④ thin 지역은 noindex · 멀쩡한 지역은 index (⚠️ 이 방향이 깨지면 조용히 색인이 빠진다)
for r in 인천 세종 울산 서울 경기; do
  printf '%s %s\n' "$r" "$(curl -sS -A "$UA" "https://urdeal.kr/region/$r" | grep -o 'name="robots" content="[^"]*"' | head -1)"; done
```

⚠️ **④는 cron(`:15`)이 1회 이상 돈 뒤에 재야 한다** — 요약이 KV 에 없으면 설계대로 **전부 index** 로 나온다
(그게 정상이다. "안 걸렸다"로 오판하지 말 것).

## 8. 안 한 것 — `/stays/:id` 서버 첫 화면

`/pass/:id` 처럼 사진·제목을 서버가 그리는 것. `StayDetailPage` 의 히어로 래퍼가 구조가 다르다
(`-mx-4 -mt-5` 전폭 · `bg-gray-100` · `lg:rounded-2xl` · 별도 `DetailTitleHeader` · 조건부 성급 줄 ·
`?ref=` 배너) → **박스를 재야** 한다(2026-10-08 교환권 상세에서 쓴 방법: 라이브 시드로 워커 HTML 과
React 를 각각 렌더해 박스를 대조). 본문은 `<noscript>` 가 밀림 0 으로 이미 배달하므로 급하지 않다.

## 9. 🩸 이번에 틀렸던 판단 — #18 방향이 실측으로 뒤집혔다

제가 올린 처방은 *"`/pass` → canonical `/stays`"* 였다. **반만 맞았다.**

      /pass/2887   본문 188자 · Product + Offer + LodgingBusiness   ← 리치
      /stays/2887  본문   6자 · LodgingBusiness 만 (Offer 0)        ← 빈 페이지

그대로 했으면 **리치 페이지에서 빈 페이지로 정본을 옮기는** 셈이었다. 원인은 분명하다 —
**SSOT(`canonicalDetailPath`)만 읽고 각 URL 이 실제로 무엇을 내는지 안 쟀다.**
⇒ 정본으로 지목하기 **전에** 그 페이지를 먼저 채웠다. 이 순서가 이 변경의 요점이다.

**교훈**: "어느 쪽이 정본인가" 는 SSOT 가 답하지만 **"지금 어느 쪽이 더 많이 말하는가" 는 실측만 답한다.**
canonical 을 옮기는 작업은 두 URL 의 **본문 글자수와 구조화 데이터를 먼저 세고** 시작할 것.
