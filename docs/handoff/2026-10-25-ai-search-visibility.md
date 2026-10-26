# 2026-10-25 AI 검색 노출 — IndexNow 전수 제출 · robots 콘텐츠 신호

대표 질문: *"GPT·제미나이·그록에서 유어딜 이용권 정보가 정확히 나와?"* → *"코드로 할 수 있는 거 최대한 다 해줘"*

## 실측 (2026-10-25 01~02시 KST)
- AI 검색 크롤러(OAI-SearchBot·ChatGPT-User·PerplexityBot·Claude-SearchBot·xAI-Bot·Grokbot·Googlebot·bingbot) 전부 `/pass/2888`·`/llms-full.txt` **200**. GPTBot 403(의도).
- `/llms-full.txt` 이용권 351건 · 매시간 갱신 — 라이브.
- 웹검색 "유어딜 urdeal.kr 이용권" · "강릉 여행 할인 이용권 urdeal" → **우리 사이트 0건**(색인 부족이 원인. 구글 색인 1건).
- 🔴 **라이브 robots.txt 맨 앞에 Cloudflare 관리형 블록(Bot Preference Sync)이 붙어 `Google-Extended: Disallow /`** — 대표 10-12 결정(제미나이 그라운딩 허용)을 덮고 있다. 대시보드 → AI Crawl Control → *Enable Bot Preference Sync* 토글. **대표만 바꿀 수 있다**(토큰은 조회 전용).
- IndexNow 는 이미 켜져 매일 04:50 KST 에 돈다(하트비트 `indexnow: 변경 0건 … 커서 2026-10-20T14:26:01Z`). 그런데 **변경분만** 보내서, 안 바뀐 페이지는 한 번도 제출된 적이 없다.

## 이번 PR
1. `shared/seo/indexnow.ts` + `cron/indexnow-submit.ts` — 버전 표식(`indexnow_backfill_v`)이 `1` 이 아니면 sitemap **모든** `<loc>`(lastmod 없는 90건 포함, ~476건)를 한 번 제출하고 표식·커서를 세운다. 0건·실패면 표식 안 세움. 게이트 뒤.
2. `public/robots.txt` — `User-agent: *` 에 `Content-Signal: search=yes, ai-input=yes, ai-train=no`. 관리형 블록을 끄면 이 파일이 그대로 서빙되므로 그 블록이 하던 신호를 여기서 낸다(ai-input 은 명시적 허용으로).
3. 가드: `indexnow-backfill-2026-10-25.test.ts` 5건 + 주입 4건(전부 빨간불 확인), 기존 주입 1건 재조준.

## E4 (배포 다음 날 04:50 KST 이후)
- `GET /api/admin/cron-heartbeats` 의 `indexnow-submit` result 가 `전수 제출 476건 (v1)` 류인지 → 그 다음 날은 다시 `변경 N건`.
- 대표가 Bot Preference Sync 를 끄면: `curl https://urdeal.kr/robots.txt | head` 가 `User-agent: *` / `Content-Signal: …` 로 시작하고 `Google-Extended` 가 **0건**.

## 이번에 틀렸던 판단
- 10-12 E4 는 robots 의 Google-Extended 0건을 "주석 제외" 로 쟀는데, 지금 라이브에선 Cloudflare 블록이 다시 막고 있다(블록이 그 뒤에 켜졌거나 그때 레포 부분만 봤다). **robots 판정은 서빙 파일 전체로**.

## 이미 끝낸 것 (같은 세션)
- #1977 홈 크롤러 푸터 — E4 통과: Yeti 홈 `<noscript><footer>` 실재, a태그 5 → 24.
- #1980 허브 noimageindex — E4 통과: `/`·`/region/서울`·`/stays` 1개, `/pass/2919` 0개.
- #1983 marketing-data orphan 수정 머지.

## 2026-10-26 04:50 KST 회차 — E4 실패 (429) + 후속 수리

- 하트비트: `indexnow: 전수 제출 실패 (429) · 495건, 표식 유지` (19:50:29 UTC, 2.9초). 표식이 안 섰으니 **다음 날 같은 슬롯에 전수가 다시 시도된다**.
- 429 는 IndexNow 의 "요청 과다(스팸 의심)"다. 공개 자료상 **보내는 IP 기준** 레이트리밋이고, Cloudflare Workers 는 수많은 사이트가 같은 송신 IP 를 나눠 쓴다 — 우리 코드가 아니라 공유 IP 평판일 가능성이 크다(확정 아님).
- 🩸 **드러난 결함**: 전수가 실패하면 그 자리에서 반환해 **변경분 제출까지 멎었다**(에러 0). 수리: 전수 실패·0건 분기에서도 `submitChanges()` 를 부른다. 시험 ⑥ + 주입 1건.
- robots.txt: `Content-Signal: search=yes, ai-input=yes, ai-train=no` 서빙 확인 · `User-agent: Google-Extended` 실행줄 0건(주석만) — Cloudflare 관리형 블록 해제 유지.
- **다음 첫 액션**: 10-27 04:50 KST 회차 하트비트. 또 429 면 전수를 하루 100건씩 나눠 보내는 쪽(커서 offset)을 검토 — 같은 IP 라 효과는 보장 못 한다.
