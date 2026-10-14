# 2026-10-14 — 몰 상품 thin URL · 크롤러 문서 사진 · IndexNow

대표 지시: **"머지해줘. 하고나서 또 seo, geo 개선점 찾아줘"** → **"다 해주고 머지 후 또 개선점 찾아"**
(내가 올린 셋 중 둘은 "대표 판단 필요" 로 올렸는데 그 지시로 전부 승인됐다.)

## 다음 세션의 첫 액션

1. **E4 라이브 판정** (배포 후 — Googlebot UA 로 받아 **파싱해서** 재라):

   ```bash
   UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
   # ① 몰 상품 thin URL 이 닫혔나
   for p in /zzqqxx/p/999 /zzqqxx/p/abc; do
     curl -sS -o /dev/null -w "$p %{http_code}\n" -A "$UA" "https://urdeal.kr$p"
   done            # 기대: 둘 다 404
   curl -sS -A "$UA" https://urdeal.kr/zzqqxx/p/abc | grep -o 'name="robots"[^>]*'   # noindex
   # ② 크롤러 문서에 사진이 생겼나 (그리고 프록시로 안 가나)
   for p in /browse /map /region/서울 /products/2917; do
     n=$(curl -sS -A "$UA" "https://urdeal.kr$p" | grep -o '<img ' | wc -l)
     r=$(curl -sS -A "$UA" "https://urdeal.kr$p" | grep -c 'api/image/resize')
     echo "$p img=$n resize=$r"
   done            # 기대: img 1~4 · resize 0
   ```

   🔴 **반대 방향을 같이 재라** — 이 방향이 깨지면 조용히 색인이 빠진다:
   실재 몰 상품 경로(`/{몰슬러그}/p/{숫자}`)와 소비자 표면(`/`·`/vouchers`·`/browse`·`/map`·
   `/pass/2919`·`/u/jiwon1228`)이 **전부 200** 인지.

2. **③ IndexNow 는 대표가 켜야 한다** (게이트 ON = 결재). 대시보드에
   `INDEXNOW_ENABLED=true` + `INDEXNOW_KEY=<32~64자 영숫자>`.
   켜면 **첫 회차는 아무것도 안 보내고 커서만 세운다**(의도) — 둘째 회차부터 제출된다.
   판정: `/{키}.txt` 가 키 본문을 200 으로 주는지 · 하트비트 `cron_hb:indexnow-submit` 의 메시지.

## 이번에 한 것 (커밋 — 아래 ①②③ 한 커밋)

### ① `/{아무것}/p/{아무것}` 이 무한 thin URL 이었다

실측: `/zzqqxx/p/999` → 헤더에 `x-ssr-status: MALLPRODUCT:self-fetch-404` 가 **찍히는데**
**200 + `index, follow` + 자기 canonical + 본문 32자**. 2026-07-29 에 닫은
`/group-buy/99999999` 와 **같은 클래스**인데 형제 하나가 빠져 있었다.

원인이 **둘**이고 성격이 다르다:
- ⓐ `ENTITY_SLOTS`(`surface-ssr-meta.ts`)에 `'MALLPRODUCT'` **한 단어**가 없어
  `shouldNoindexMissingEntity` 가 false 를 돌려줬다.
- ⓑ id 가 숫자가 아니면(`/x/p/abc`) `parseMallProductPath` 가 거부해 **슬롯이 아예 안 잡힌다**
  (실측: `x-ssr-status` 헤더 **자체가 없다**). 그런데 `isKnownAppPath` 가 `segs[1] === 'p'` 만 보고
  **무조건 통과**시켜 ⓐ를 고쳐도 이쪽은 안 닫혔다.

ⓑ 판정을 **몰 경로 SSOT 와 같은 함수**(`parseMallProductPath`)로 통일했다 — 두 벌로 적으면
*"슬롯은 안 잡는데 아는 경로"* 라는 **지금의 틈**이 다시 생긴다(그 틈이 이 결함의 정체다).
워커 전용 importer 임을 확인해 클라 번들 영향 0.

🔴 **반대 방향이 훨씬 비싸다**: 실재 몰 상품 경로를 404 로 만들면 **소개비 귀속 링크가 통째로 죽고**
색인 복구가 수주다 → 문법이 맞으면 **200 유지**, 실재 여부는 `self-fetch-404` **만** 판정한다
(`self-fetch-timeout` 은 "느림" 이지 "부재" 가 아니다 — 주입 2건이 이 방향을 고정).

### ② 크롤러 문서에 상품 사진이 0장이었다

🩸 **처음 보고를 정정했다** — 내가 *"구글 이미지에 들어갈 자리가 없다"* 고 썼는데,
UA 별로 `script src` 를 세 보니 **봇 셸이 엔트리 스크립트를 실어** Googlebot 은 렌더해서 React
`<img>` 를 본다. 진짜 공백은 **JS 를 안 돌리는 크롤러**(네이버 Yeti · AI 봇)다 ⇒ 가치는
**네이버 이미지 검색**이고 구글 쪽은 렌더 지연 보험이다.

목록·지역 행과 `/products/:id` 에 `<img>` 를 붙이되 **자제 네 가지**:
- 사진 **4장까지** (`<noscript>` 는 사람이 받는 응답에도 실린다 — 전량 덤프 금지)
- `/cdn-cgi/image/` 로 확실히 가는 것만 — **워커 프록시(`/api/image/resize`)는 리사이즈를 못 한다**
  (2026-06-11 실측, 항상 원본 폴백). `i.ibb.co` 는 승격도 불가(cdn-cgi **524 `err=9504`** 실측).
- 없는 사진을 **지어내지 않는다**(사진 없는 행은 글만)
- 모르는 `height` 를 **선언하지 않는다**(우리 사진 비율이 제각각 — 2026-08-31 실측)

🩸 **상한을 처음 *행 인덱스*로 셌고 주입 검증이 그걸 잡았다**: 쓸 수 없는 행(사진 없음 ·
프록시 호스트)이 **자리를 먹어서**, 프록시 가드를 지운 주입이 **초록**이었다(출력이 1바이트도
안 바뀐다 — 탐침의 프록시 행이 5번째라 어차피 상한에 걸렸다). ⇒ **그려진 사진을 센다** 로 고치고
탐침의 쓸 수 없는 행을 **앞쪽**으로 옮겼다. 이 레포가 반복해 밟은
*"탐침이 그 경우를 담지 않으면 규칙을 없애도 초록"* 클래스다.

### ③ IndexNow — 네이버·Bing 에 바뀐 URL만 알린다 (2단 스위치, 기본 OFF)

네이버가 **2023-07 부터 지원**하고 한 번 제출하면 Bing·Yandex·Seznam·Yep 로 전파된다.
**구글은 IndexNow 를 지원하지 않는다**(그 사실을 테스트가 문서로 고정 — 다음 세션이 구글 효과를
기대하지 않게).

🔑 **우리 sitemap 을 읽는다** — 쿼리를 다시 짜지 않으므로 sitemap 의 noindex·thin 게이트를
**그대로 물려받는다**(두 벌이 갈릴 수 없다). `lastmod` 가 커서보다 **새 것만** 최대 100건.

보수적 처리 넷: **첫 회차는 커서만 세우고 아무것도 안 보낸다** · 상한에 잘렸으면 **커서를 안 올린다**
· 제출 실패(비-200/202)면 **커서 유지** · `lastmod` 없는 항목은 대상 아님.
키 파일은 `sitemap.routes.ts` 에 달아 **`worker/index.ts`(래칫 2672)를 안 건드렸다.**

## 검증

- tsc 0 · 신규 테스트 **23건 pass**
- 주입 **15건** 되돌려-검증 **전부 빨간불 확인**
- 🩸 **주입이 내 결함 둘을 잡았다**: 위 ② 의 행-인덱스 상한 · 그리고 cap 제거 주입의
  `replace: '  return rows'` 가 실제 코드 `  return rows.map((r) => {` 의 **부분문자열**이라
  주입-잔재 검사가 **거짓 경보**를 냈다(pre-commit 이 커밋을 막았다 — CLAUDE.md 가 경고한
  `replace: 'return'` 클래스를 그대로 밟았다).

## 남은 것 / 대기

| 번호 | 무엇 | 왜 못 했나 |
|---|---|---|
| **#60** | IndexNow 켜기 | **게이트 ON = 결재** — 대표가 대시보드에서 |
| #59 잔여 | `/blog/:slug` img 0 | `thumbnail_url` 이 **전부 null**(데이터 공백 — 지어낼 수 없다) |
| #45 | 로고·유달이 구글 이미지 | `/about` 시안을 대표에게 보여야 한다. 전제 정정: `Organization.logo` = `/icon-512.png` **200 · 512×512** |
| #54 | `www.urdeal.kr` NXDOMAIN | 대표가 Cloudflare DNS 레코드 생성 |
| #47 | 봇 셸 `og:image:alt` · `twitter:site` | 셸이 경로별로 둘이라 비용 대비 효과가 낮아 보류. **`@urdeal_kr` 계정 실재 미확인** |
| #43 잔여 | `/gdpr`·`/influencer/rankings` 크롤러 본문 | 곁가지: `PrivacyPolicyPage` 가 한국어 방침에 **영문 섹션**이 섞여 있다(GLOBAL 폐기 #804 인데) — 내용 판단 필요 |
| #31 · #35 | 결재 2건 | `/pass/:id` 공유 카드 SVG · 검색 제목 `[유어딜] {이용권명}` |

## 이번에 틀렸던 판단 (같은 오진 반복 방지)

1. **"구글 이미지에 자리가 없다"** — 봇 셸이 엔트리 스크립트를 싣는다는 걸 안 재고 단정했다.
   UA 별로 `script src` 를 세고서 뒤집혔다. ⇒ *"크롤러가 JS 를 못 돌린다"* 를 전제로 쓰기 전에
   그 문서의 `<script>` 를 먼저 세라.
2. **구 도메인이 200 이라고 읽었다** — `urllib.urlopen` 이 **리다이렉트를 따라간다**. 리다이렉트를
   안 따르는 opener 로 다시 재니 **전 경로 301**(CLAUDE.md 가 맞았다). **이 세션 여섯 번째
   측정 오류**다. ⇒ 측정값이 문서와 어긋나면 **측정기를 먼저 의심하라**.
3. **`--only='2026-10-14'`** 로 내 주입만 돌리려 했는데 **0건 매칭**(이름 부분일치이고 파일명이
   아니다). 러너가 exit 1 로 멈춰 아무것도 검증하지 않았다 — 이모지 접두로 다시 돌렸고, 그
   이모지는 **다른 매니페스트의 주입과도 매칭**된다(중간에 무관한 파일이 modified 로 보인다).
