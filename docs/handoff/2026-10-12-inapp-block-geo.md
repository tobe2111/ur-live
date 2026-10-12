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

## 7. 남은 둘

| # | 무엇 | 함정 |
|---|---|---|
| **#18** | 숙소 **49건**이 `/pass/:id` 와 `/stays/:id` 두 URL 로 색인 경쟁 | **둘을 같은 커밋에서** — (a) 상세 canonical (b) `sitemap.routes.ts:114` 의 하드코딩 `loc`. SSOT 는 `canonicalDetailPath` |
| **#21** | 딜 3건 미만 지역 페이지가 `index, follow` + 본문 26자 | 요약(`ssr:region-digest`)이 이미 KV 에 있고 워커가 읽는다 ⇒ 조회 0 으로 게이트 가능. ⚠️ **요약이 없을 때는 절대 noindex 하지 않는다** |
