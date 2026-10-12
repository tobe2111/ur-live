# 2026-10-12 — 숙소 첫 화면 · 사진 alt · 교환권 noindex 근거

대표 지시: **"머지해줘. 그리고 seo,geo 더 개선할 건?"** → (재조사 보고) → **"모두 다 진행해줘"**

## 1. 다음 세션의 첫 액션

### ⓐ ~~PR #1746 의 E4~~ — ✅ **끝났다**(이 세션에서 실측·기록 완료)

머지 `e64bbe34e`. **세 가지 전부 통과**했고 CLAUDE.md 의 해당 두 audit 항목에 `✅ E4 판정 통과`
를 기록했다. 측정값:

| | 결과 |
|---|---|
| ① canonical | 여덟 표면 **전부 정확히 1개**(종전 2개) · `/pass/2887` → **`/stays/2887` 하나만** · `/pass/2919` 자기 자신 |
| ② soft-404 | 쓰레기 4경로 **404 + `noindex, follow`** · 소비자·대시보드 **18경로 전부 200**(위험한 방향 안 일어남) |
| ③ 얇은 본문 | `/partners` 275 · `/creators` 268 · `/influencer` 263 · `/introduce` 236 · `/new-openings` 195 · `/area-report` 178 · `/creators/apply` 177자 — 전부 `<noscript>` 에 페이지 원문이 실렸다 |

재현 명령(다음에 또 필요하면):

```bash
UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

# ① canonical 이 표면마다 정확히 1개인가 — **전수로 세라**(re.search 로 첫 매치만 보면 오진한다)
for p in / /blog /vouchers /browse /u/jiwon1228 /pass/2887 /stays/2887; do
  echo -n "$p  "; curl -sS -A "$UA" "https://urdeal.kr$p" | grep -o 'rel="canonical" href="[^"]*"' | sort -u | tr '\n' ' '; echo
done
#   기대: 전부 1개. `/pass/2887` 은 **`/stays/2887` 하나만**(자기 자신이 함께 나오면 실패).

# ② soft-404 — **양방향**을 다 봐야 한다
for p in /zzz-nonexistent-abc /products /이런페이지는없다; do
  echo -n "$p "; curl -so /dev/null -w '%{http_code}\n' -A "$UA" "https://urdeal.kr$p"; done   # 기대 404
for p in / /vouchers /browse /map /stays /blog /faq /about /seller /admin /agency; do
  echo -n "$p "; curl -so /dev/null -w '%{http_code}\n' -A "$UA" "https://urdeal.kr$p"; done   # 기대 200
#   🔴 소비자·대시보드가 404 면 **즉시 롤백**(색인은 돌아오는 데 수주다).

# ③ 얇은 표면 본문 — 기대치(머지 전 로컬 실측): 237 / 239 / 234 / 205 / 154 / 141자
for p in /partners /creators /creators/apply /influencer /new-openings /introduce /area-report; do
  echo -n "$p "; curl -sS -A "$UA" "https://urdeal.kr$p" | python3 -c "
import sys,re; h=sys.stdin.read()
b=re.sub(r'<(script|style)[^>]*>.*?</\1>','',h,flags=re.S)
print(len(re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',b)).strip()))"; done
```

⚠️ **남은 것은 Notion 한 줄뿐이다** — 개발 업데이트 로그(데이터소스 `571b32b9-cefb-4453-9b84-78928c619451`)에 한 줄(서비스=유어딜 ·
유형=결함 수정 · PR URL). ⚠️ `머니 경로` 속성은 **넣지 마라** — `Invalid input` 으로 거부된다.

### ⓑ 이 브랜치(PR 미생성) — 초록 확인 후 대표 지시 대기

커밋 `5783a502c`(사진 alt + 교환권 근거) · `353fd750d`(숙소 첫 화면). **머지는 지시받고** 한다.

배포 후 E4:
- `/stays/2887` 하드로드 프레임에서 사진·제목이 첫 프레임에 뜨고 **마운트 때 안 움직이는지**
- `curl -A "$UA" https://urdeal.kr/stays/2887` 본문이 **146자에서 올라갔는지**(로컬 195자)
- 유형 라벨이 화면과 같은지 — `guesthouse` 숙소의 서버 메타가 **"스테이"**(종전 "게스트하우스")
- `/u/jiwon1228` 진열 사진 4장의 `alt` 이 비어 있지 않은지

## 2. 이번에 한 것

| | 내용 | 커밋 |
|---|---|---|
| ① | **상품 사진 `alt` 이 전부 비어 있었다** — sitemap 이 `image:image` 로 359건 제출하면서 그게 무엇인지는 안 말했다. `DealRow` 가 `title` 에서 파생(호출부 6곳 전부 평범한 문자열) + 유어샵은 React·워커 둘 다 | `5783a502c` |
| ② | **교환권 noindex(2,260건)의 근거가 어디에도 없었다** — D1 으로 재서 결정이 옳음을 확인(할인 보유 **195건 = 8.6%**, 즉 91%가 정가 → 같은 SKU·thin/duplicate)하고 숫자를 코드에 남겼다. **뒤집지 않았다** | `5783a502c` |
| ③ | **숙소 상세 서버 첫 화면** — 정본(`/stays/:id`)인데 사본(`/pass/:id`)에만 있었다. 빵부스러기+히어로+성급+h1 까지 | `353fd750d` |
| ③-1 | 유형 라벨 두 벌(화면 8종 ↔ 워커 5종) → SSOT 하나. **라이브 13건**이 갈려 있었다 | 〃 |
| ③-2 | 빵부스러기 간격 `gap-1.5` ↔ `gap-2` 두 벌 → `crumbNavHtml` 한 곳 | 〃 |

## 3. 이번에 틀렸던 판단 (같은 오진 반복 방지)

1. **주입 앵커를 세 번 틀렸다.** 마스코트가 `curator-ssr-body.ts` 에 있다고 믿었는데 실제로는
   **`worker/index.ts:928`**(정적 로더 안)이고, sitemap 앵커는 쉼표 뒤 공백(`deal_only, 0`)이 달랐다.
   ⇒ 매니페스트를 쓰면 **`node -e` 로 `find` 가 소스에 1건인지 먼저 세라**(1초).
2. **묶음 단언이 헛돈다.** `/195건|8.6%|91%/` 로 썼는데 측정표를 통째로 지워도 **아래 산문의
   `91%`** 가 통과시켰다. **묶음은 가장 약한 항만큼만 센다** ⇒ 각각 단언.
3. **정규식 앵커가 주석을 집었다.** 마스코트 부정 단언이 `udal-loader`(소문자·하이픈)였는데 소스는
   `UDAL_LOADER_SRC` 라, 실제로 매치한 것은 **설명 주석 한 줄**이었다(= 영원히 통과).
4. **중복 잠금.** `if (!main) return ''` 과 `if (!heroUrl …) return ''` 이 서로를 덮어 **어느 쪽을
   지워도 결과가 같았다** — 둘 다 시험 불가능. 가드를 하나로 모았다.
5. **측정 하네스가 세 번 거짓말했다** — `#root` 치환 정규식 불일치(서버 쪽 전부 null) ·
   `querySelector('h1')` 이 PC 제목 헤더(`hidden lg:block` → `0,0,0,0`)를 집음 · cdn-cgi 요청에
   HTML 을 돌려줘 React 가 `onError` → `setDead` 로 사진을 지움. ⇒ **A·B 비교에서 한쪽만 비면
   먼저 하네스를 의심할 것.**

## 4. 알아 둘 것

- 🩸 **`handoff-index-sidecar-2026-10-06.test.ts` ④ 는 상태 의존이다.** `check-current-work-sync.mjs`
  의 **"다 맞았다"** 출력에만 앵커가 걸려 있어, `src/` 를 바꾸고 handoff 를 아직 안 쓴 브랜치에서는
  **그 시험이 빨간불**이 난다(이 브랜치가 실제로 그랬다). 가드 자체는 제 일을 한 것이고, 고치는
  법은 이 파일을 쓰는 것이다. ⚠️ 다만 *"가드가 돈다"* 와 *"가드가 조용하다"* 를 한 단언이 겸하고
  있으므로, 다음에 그 시험이 빨간불이면 **코드가 아니라 handoff 부재**를 먼저 의심할 것.
- 🩸 **`pre-push-tests.mjs` 의 실패 보고가 묻힌다.** 필터가 `Error:` 를 포함해서, 무해한
  `Error: no such table: rate_limit_attempts` 30줄이 **진짜 실패를 밀어낸다**. 어느 시험인지 보려면
  선택을 직접 재현해 vitest 를 돌려야 했다(`searchTermsFor` + `TREE_SCAN_PATTERN`, 이 파일 §5).
- 📉 `consumer-hex-baseline.json` 2112 → 1972. 내 변경은 **±0**(hex 2개가 페이지 → SSOT 로
  이동)이고, 줄어든 140 은 **이전 세션들이 이미 줄여 놓고 동결값을 안 갱신한 분**이다.

## 5. 남은 것 / 대표 판단

- **`/refund` 가 다른 서비스의 약관 문구를 싣고 있다** (`제22조 (환불)` · `가. 경기 결제 회원` —
  `RefundPolicyPage.tsx`). 법무 문구라 **세션이 지어낼 수 없다.** 대표가 원문을 주면 교체.
- **교환권 2,260건 색인** — 지금은 noindex 가 맞다(91% 정가). 할인 비율이 올라가면 재검토.
- `ur-wholesale` Pages 프로젝트 삭제 · 실제 입점 매장 2곳(활성 50건 중 48이 데모) — 플랫폼/대표.
- `/vouchers/nonexistent-xyz` 가 404 가 아닌 것 — 그 엔티티 API 가 404 대신 **400** 을 준다(별건).
