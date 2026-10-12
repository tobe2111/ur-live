# 2026-10-12 — AI 검색(GEO)에 줄 문장을 만든다 · 제미나이 해제

**[E4 라이브 판정됨]** — 머지 `c6db580bd`, 배포 후 실측 통과(아래 표).
**(E2 당시)** — tsc 0 · 신규 가드 26건 + 인접 6파일 137건 pass · 주입 13건 전부 빨간불 · build 0 ·
pre-push 게이트 가드 100개. **E4(라이브 판정)는 배포 후.**

## 다음 세션의 첫 액션 — 배포되면 이걸 그대로 돌린다

```bash
UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
# ① FAQPage 구조화 데이터가 서버 HTML 에 생겼는가 (배포 전 0건)
curl -sS -A "$UA" https://urdeal.kr/faq | grep -c FAQPage          # ← 1 이상
# ② 본문 글자수가 올라갔는가 (배포 전 /faq 33 · /about 30 · /region/서울 26)
for p in /faq /about /region/서울; do
  printf '%s ' "$p"
  curl -sS -A "$UA" "https://urdeal.kr$p" | python3 -c "
import sys,re,html
s=sys.stdin.read(); s=re.sub(r'(?is)<script.*?</script>|<style.*?</style>','',s)
t=html.unescape(re.sub(r'(?s)<[^>]+>',' ',s)); print(len(re.sub(r'\s+',' ',t).strip()),'자')"
done
# ③ 제미나이 — robots 차단 그룹에 Google-Extended 가 없는가 (**주석 제외하고** 센다)
curl -sS -A "$UA" https://urdeal.kr/robots.txt | grep -v '^\s*#' | grep -c '^User-agent: Google-Extended$'   # ← 0
# ④ 학습 봇은 계속 막혀 있는가
curl -sS -A "$UA" https://urdeal.kr/robots.txt | grep -v '^\s*#' | grep -cE '^User-agent: (GPTBot|ClaudeBot|CCBot)$'  # ← 3
# ⑤ 소비자 표면이 안 깨졌는가
for p in / /vouchers /pass/2919 /u/jiwon1228 /faq /about /region/서울; do
  printf '%s %s\n' "$p" "$(curl -sS -o /dev/null -w '%{http_code}' -A "$UA" "https://urdeal.kr$p")"; done  # ← 전부 200
```

🩸 **③·④ 에 `grep -v '^\s*#'` 가 반드시 필요하다** — 이 PR 의 robots 주석이 제거한 문구를 **인용**하고 있어서,
안 걸러내면 "아직 막혀 있다" 로 **오진한다.** #1720 의 E4 판정에서 실제로 그 함정을 밟았다
(`공개 인덱스 대상` 1건이 잡혔는데 그게 제 주석이었다).

## 이번에 끝낸 것

| | 무엇 | 라이브 실측(배포 전) |
|---|---|---|
| #1720 | 철거된 도매몰 URL → **410 Gone** | **E4 통과** (머지 `9d93fe6fb`) |
| ① | `robots.txt` 에서 `Google-Extended` 제거 → **제미나이 인용 가능** | 차단돼 있었다 |
| ② | 신규 SSOT `shared/seo/concept-content.ts` — FAQ 14건(컨셉 4 추가) + 소개 5줄 | — |
| ③ | `FAQPage.tsx` 가 그 SSOT 를 쓴다(두 벌 금지) | 화면에만 있었다 |
| ④ | 서버 `FAQPage` JSON-LD (`/faq` 에만) | **0건** |
| ⑤ | `<noscript>` 요약 — `/faq`·`/about`·`/region/*` | 33 · 30 · 26자 |
| ⑥ | `/region/*` SSR 시드(홈과 같은 캐시 키) + 지역 `ItemList` | 항목 0건 |
| ⑦ | 6개 언어 로케일에 `faq.q11~q14`·`a11~a14` | — |

## 이번에 내가 틀린 것 (같은 오진 반복 방지)

1. **`Google-Extended` 는 "학습 전용" 이 아니다.** 제가 2026-10-11 에 robots.txt 와 CLAUDE.md 에
   *"막아도 노출이 안 깎인다"* 고 적어 뒀는데 **반만 맞았다** — AI 개요는 무관하지만 그 토큰은
   **그라운딩(=제미나이 인용)까지** 묶는다. ⚠️ **애플(`Applebot-Extended`)과 묶어 보지 말 것** —
   애플은 진짜로 학습 전용이고 색인은 `Applebot` 이 따로 한다. 그 혼동이 오기의 출처였다.
2. **`git checkout -- <file>` 로 커밋 안 한 변경분을 날렸다.** 되돌려-검증 뒤 복원하려고 썼는데
   그 파일의 **내 작업 전체**가 사라져 워커 편집 3곳을 다시 적용했다. 주입 러너는 *자기가 고친*
   소스만 되돌린다 — 손으로 심은 결함은 손으로 되돌려라.
3. **HTML 탈출은 상수로 못 잰다.** 컨셉 문구엔 `&`·`<` 가 없어 탈출을 없애도 결과가 같다.
   탐침 시드(`a&b` · `x</script><b>y`)로 **동작**을 재야 판정이 된다.
4. **`--only` 는 정규식이 아니라 이름 부분일치**다. `--only='🧭'` 를 주면 기존 🧭 주입 50건이
   함께 돈다(틀린 건 아니지만 내 13건만 보려면 이름 조각으로 하나씩 돌려야 한다).

## 남은 것 / 대표 판단 대기

- **🔴 데모 재고 — 대표가 "그냥 두기" 로 결정**(기록만 남긴다). 활성 50건 중 **48건이 데모**이고
  sitemap `/pass` **359건** 샘플 10개가 전부 데모다. 그 페이지들은 `index, follow` 로
  **실제 가게 이름·주소·전화**(예 `기천한우직판장 · 031-944-6463`)에 **살 수 있는 Offer**(96,400원)를
  붙여 발행한다. AI 가 인용하면 사용자가 그 번호로 없는 이용권을 문의하게 된다.
  ⇒ 지금은 열어 둔 상태이므로, 제휴 발송·AI 노출이 실제로 늘기 **전에** 다시 올릴 항목.
- **`/stays` ItemList** — 여행 질의의 핵심인데 그 표면엔 SSR 슬롯이 없다. 새 self-fetch 가 필요해
  서브리퀘스트 예산(무료 50/인보케이션, 실측 ~49)을 먼저 재야 한다. **별건.**
- **`/u/zzz-does-not-exist-9999` 가 200 + `index, follow`** — `X-SSR-Status: CURATOR:self-fetch-400`
  이라 `shouldNoindexMissingEntity`(`self-fetch-404` 만 본다)가 발동하지 않는다. 400 을 술어에 넣을지
  (400 = "핸들 모양이 틀림" 이라 404 와 의미가 다르다) 워커의 400 을 고칠지 **판단이 먼저**.
- **`BOT_UA_REGEX` 에 AI 검색봇 추가** — 지금 그들은 `index.html`(70KB, 인앱브라우저 안내문구가
  본문에 섞인다)을 받는다. 봇 셸(9KB)이 깨끗하지만 **JS 를 렌더하는 봇에겐 손해**라 보류했다.
- **다국어/hreflang 0건** · **`llms.txt` 404** — 둘 다 대표 판단 대기(이전 세션부터).
- **실제 입점 매장 2곳.** 기술로 못 메운다. 이게 "동네 맛집" 질의 노출의 진짜 상한이다.

## ✅ E4 판정 결과 (배포 후 라이브, Googlebot UA 로 파싱해서 쟀다)

| 재 본 것 | 배포 전 | 배포 후 |
|---|---|---|
| `/faq` `FAQPage` 노드 | **0건** | **1개 · Q&A 14건** (컨셉 넷 전부 실재) |
| `/faq` 본문 | 33자 | **1,515자** (noscript 1,481) |
| `/about` 본문 | 30자 | **288자** |
| `/region/서울` 본문 | 26자 | **399자** |
| `/region/서울` `ItemList` | 0건 | **10건** · `position` 1..10 연속 · 전부 `/pass/` |
| robots 차단 그룹의 `Google-Extended`(주석 제외) | 있음 | **0** |
| 학습봇 3종 차단 | 3 | **3 유지** |
| 비공개 `Disallow` | — | **54줄 유지** |
| 소비자 11경로 | 200 | **200** (`/wholesale` 410 유지) |
| **AI 검색봇 넷** (`OAI-SearchBot`·`Claude-SearchBot`·`xAI-Bot`·`PerplexityBot`) | — | **전부 `FAQPage` 1 + Q&A 14** |

지역 정규화도 산다: `강원특별자치도` 주소가 `/region/강원` 에서 **3건** · 전북 1 · 경북 1.

### 🩸 `/region/경기`·`/region/대구` 는 항목 0 — 결함이 아니라 이 설계의 대가다

지역 페이지는 홈과 **같은 캐시 키**(`MAIN_SEED_PATH`)를 써서 추가 비용을 0 으로 만든다. 그 시드는
홈 피드 **1페이지 50건**이고 실측 분포가 `서울 44 · 강원 3 · 전북 1 · 부산 1 · 경북 1` 이다 ⇒
**시드 첫 페이지에 없는 지역은 요약·ItemList 가 빈다**(빵부스러기·`WebPage` 는 정상).

지역별 시드를 따로 뽑으면 **캐시 키가 44개로 갈려** 예열을 못 맞고 콜드 D1 + 서브리퀘스트가 붙는다
(무료 50/인보케이션, 실측 ~49). 고치려면 그 비용을 먼저 재야 한다 — **별건**.

### 🧭 측정기가 또 틀렸다 (같은 세션 네 번째)

시드를 `__SSR_INITIAL_MAIN__\s*=\s*` 로 찾아 **"시드 주입 False"** 가 나왔고 *"경기는 시드를 못
받는다"* 로 오진할 뻔했다. 실제 모양은 `id="__SSR_INITIAL_MAIN__" type="application/json">{…}` 이고
`X-SSR-Status` 는 네 지역 **전부 `MAIN:kv-hit`** 였다.

같은 클래스 네 번: grep 개수 ≠ 노드 수 · nonce 때문에 블록 0개 · `@graph` 중첩 · 이번 주입 모양.
⇒ **0 이 나오면 먼저 측정기를 의심할 것.**
