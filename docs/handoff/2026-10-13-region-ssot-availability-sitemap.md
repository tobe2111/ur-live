# 2026-10-13 — 지역 경로 SSOT · 쇼핑 availability · sitemap 제출 계약 · 검색 스니펫 문체

대표 지시: **"머지해주고, 너가 할 수 있는 건 최대한 이상적으로 다 해줘. 그러고도 남은건 자세히 설명해줘."**

## 0. 머지 (먼저 요청받은 것)

- **PR #1762 머지 완료** (squash `4da40ff1d` 이후 main). `Verify` 초록 확인 후 머지했고,
  중간에 **머지 충돌**이 한 번 났다 — main 이 `vite.config.ts` 의 같은 자리를 건드렸다.
  🩸 **원인이 값지다**: 같은 장애(`kakao-place-url` TDZ 청크 순환)를 **두 세션이 각자 고쳐 둘 다
  머지**했고(각각은 초록이었다), 양쪽이 중복 규칙을 제거하면서 주석만 달라졌다. 규칙은 한 줄로
  합쳤고 *"중복 잠금은 각 잠금을 시험 불가능하게 만든다"* 교훈을 주석에 남겼다.

## 1. 이번에 한 것 (E2 — 머지 전)

| # | 무엇 | 왜 |
|---|---|---|
| #53 | **지역 경로 조립 5벌 → 1벌** (`regionPath` SSOT, 퍼센트 인코딩) | sitemap 이 `/region/서울` 제출 ↔ 페이지 canonical 은 `/region/%EC%84%9C%EC%9A%B8`. 그리고 **같은 페이지가 클라 `<SEO>` 는 날것 · 워커 주입은 인코딩**으로 서로 다른 canonical 을 내보냈다 |
| #53 | sitemap `<loc>` 에 **비ASCII 그물**(`asciiLoc`, 멱등) | 조립 통합이 근본 처방이고, 이건 *새 경로가 또 날것으로 들어오는 것*을 막는 마지막 방어선 |
| #55 | **쇼핑 `Offer.availability` 를 재고로** | 품절도 "재고 있음" 이었다. 구글 상품 정책은 페이지와의 일치를 요구한다 |
| #43 | `/join`·`/terms/seller` sitemap 제출 + **초안 약관 2건 noindex** | 색인 대상인데 제출이 빠진 7개를 전수로 재니 **본문이 6자인 것이 5개**였다 |
| #46 | 죽은 디자인 토큰 파일 2개 삭제 | importer 0 (`styles/tokens.ts`·`styles/themes.ts`) |
| #56 | **블로그 제목 14편 em-dash 제거** + 틀 흩뜨리기 + 가드 범위 확장 | 21편 중 14편이 `주제 — 설명` **한 틀**이었다. 그 제목이 검색결과에 그대로 뜬다 |
| 신규 | **검색 스니펫 11건 em-dash 제거** | 아래 §3 참조 — 가드 사각지대의 더 비싼 자리였다 |
| #48 | **`/urshorts` 크롤러 본문 6자 → 465자** + sitemap 제출 | 아래 §2-2 — `VideoObject` 는 **일부러 안 냈다** |

### 🩸 측정이 처방을 뒤집은 자리 — #43

처음엔 *"색인 대상인데 sitemap 이 제출 안 하는 표면 5개를 넣는다"* 였다. **Googlebot UA 로 실제로
재 보니 처방이 반대였다**:

```
/join                 200  index,follow  body  134    ← 제출 OK
/terms/seller         200  index,follow  body  229    ← 제출 OK
/gdpr                 200  index,follow  body    6
/influencer/rankings  200  index,follow  body    6
/urshorts             200  index,follow  body    6
/terms/influencer     200  index,follow  body    6    ← 게다가 **법무 검토 전 초안**
/terms/group-buy      200  index,follow  body    6    ← 게다가 **법무 검토 전 초안**
```

본문 6자를 제출하면 soft-404 를 쌓는다(이 레포가 세운 **짝 주장**: 제출했으면 본문이 있어야 한다).
⇒ 본문 있는 둘만 넣고, **초안 약관 둘은 noindex 로 돌렸다**. 그 두 페이지는 스스로 *"본 약관은
초안이며, 실제 시행 전 법무 검토가 필요합니다"* 라고 화면에 적어 두고도 `index, follow` 였다.
페이지는 그대로 200 이다(가입 흐름에서 링크로 연다) — 색인만 뺐다.

### 🩸 재고 컬럼이 두 벌이라 순진하게 고치면 **더 나빠진다**

라이브 실측 `/api/products/2917`: **`stock: 200` ↔ `stock_quantity: 0`**.
한쪽만 보면 **재고 200개 상품이 `OutOfStock`** 으로 나가고 그건 오늘보다 나쁘다.
⇒ 판정을 화면(`ProductDetailPage` 구매 버튼 `disabled`, 2026-07-02 에 같은 갭으로 값을 치른 줄)과
**같은 술어**로 맞췄고, 시험이 두 소스를 대조한다.

🏨 **숙소는 `InStock` 유지가 맞다**(두 축이다): `AggregateOffer.availability` 는 "하나라도 살 수
있는가" 이고 그 분기는 이미 *가격 붙은 활성 객실 ≥ 1* 일 때만 들어온다. 날짜별 잔여는 **달력**이
쥐고 있고 페이로드엔 안 온다 — 모른 채 `OutOfStock` 으로 내리면 멀쩡한 숙소를 품절이라 말한다.
⚠️ "일관성" 을 이유로 한쪽으로 몰지 말 것. 주입이 그 방향을 고정한다.

### 🎬 #48 `/urshorts` — 왜 `VideoObject` 를 안 냈나

본문은 **6자 → 465자**(라이브 시드로 빌더를 돌려 눈으로 봤다). 시드는 **공짜였다** —
`/api/urshorts` 는 `cache-prewarm` HOT_PATHS 에 **이미 있는 키**라 그 키를 그대로 쓰면 새 캐시 키·
새 왕복이 **0**(`/stays` 가 MAIN 시드를 재사용한 그 수법). 워커 diff 는 **1줄 추가 + 1줄 수정**이고
파일 래칫 2672 를 그대로 맞췄다.

🔴 **`VideoObject` 는 안 낸다.** 이 10편은 **남의 유튜브 영상**이다(실측 채널: 부산일보TV ·
해피푸게더 · 슬아투니 · 부산이야 · 파인예플 · 재슐랭가이드). 우리가 업로더가 아닌 영상에
`VideoObject` 를 발행하면 원 채널의 리치결과와 경쟁하면서 *우리가 그 영상의 출처*라고 말하는
셈이다 — 이 레포가 `sameAs`·`aggregateRating`·`brand` 에서 지키는 **지어내지 않는다** 와 같은 축이다.
같은 이유로 본문에 **채널명을 반드시 함께** 쓴다(출처 표기). ⚠️ 우리가 직접 올린 영상이 생기면
그때 그 건에만 낼 것.

🔒 **주입하지 않는다** — 화면은 `?all=1`(전량)을 받고 이 시드는 **10편**이다. `initialData` 로
먹이면 목록이 도로 짧아진다(2026-10-12 지역 요약에서 값을 치른 규율). 워커가 `ssrPayload = null`
로 끊고 크롤러 본문 빌더에만 넘긴다.

## 2. 가드 (가드가 없으면 전부 되돌아온다)

- 신규 시험 `src/tests/unit/seo-region-encoding-availability-2026-10-13.test.ts` **25건**
- 신규 주입 `scripts/mutations/seo-region-encoding-2026-10-13.mjs` **15건 — 되돌려-검증 전부 빨간불 확인**
- `check-anti-slop-copy.mjs` 에 **블로그 시드 제목 0 잠금 + 본문 래칫(39) + 0건이면 실패**

### 🕳️ 기존 가드·주입 넷이 내 변경에 낡았고 **넷 다 풀지 않고 재조준**했다

`breadcrumb-region-blog`(2건) · `place-sameas` · `region-child-links` · `voucher-facet-body`(주입+시험).
전부 *불변식은 그대로이고 앵커만* 옮겼다. `check-stale-mutation-anchors` 가 잡았다(0초).

### 🩸 이번에 값을 치르고 배운 것 넷

1. **주석을 바꾸는 주입은 행동을 안 바꾼다.** noindex 주입의 첫 판이 주석 접두만 고쳐서 **통과했다**.
2. **`replace` 가 파일의 다른 곳과 같은 글자면 복원 검사가 오발한다.** `availability: 'https://…/InStock',`
   는 숙소 분기에도 있다 → 앵커에 앞줄을 포함했다. (CLAUDE.md 가 `replace: 'return'` 으로 적어 둔 그 클래스.)
3. **래칫을 *끄는* 결함은 그 가드를 돌려서 못 잡는다**(끄면 초록이다) → 시험이 소스로 고정 + 가드를
   **자식 프로세스로 실제로 돌리는** 시험을 따로 뒀다.
4. **러너는 `cmd:` 를 지원하지 않는다** — `test:` 만 본다. 가드 스크립트를 겨누는 주입은 그 가드를
   돌리는 *시험*을 가리켜야 한다.
5. **`git push` 가 실패해도 exit 0 으로 보일 수 있다.** pre-push 게이트가 막은 푸시가 백그라운드에서
   `exit 0` 으로 보고됐고, `git status -sb` 의 upstream 이 `origin/main` 인 것(= `-u` 가 안 걸렸다)만이
   단서였다. ⇒ **푸시 성공은 `git ls-remote --heads origin <branch>` 로 확인할 것.**
   🟢 그리고 **게이트가 제 일을 했다**: `/urshorts` 블록이 `crawler-noscript.ts` 를 **627줄**로
   밀어 600 래칫을 넘겼고 CI 한 바퀴(실측 최대 95분) 전에 로컬 21.3초가 잡았다. `--rebaseline`
   대신 **추출**했다(`worker/utils/urshorts-noscript.ts`, 598줄로 복귀) — CLAUDE.md 가 요구하는 방향.

## 3. 같은 사각지대의 **더 비싼 자리** — 검색 스니펫 (신규 발견·수리)

`check-anti-slop-copy` 는 `walk()` 가 **`.tsx` 만** 훑는다. 그런데 문구는 `.ts` SSOT 로 옮겨가 있었다:

```
src/shared/seo/consumer-surfaces.ts   em-dash 7   ← meta description = 검색결과 스니펫
src/shared/seo/surface-copy.ts        em-dash 4   ← 크롤러 본문
src/features/blog/api/blog-seed.ts    em-dash 57  ← 제목 14 + 본문 43
```

11건 전부 고쳤다. ⚠️ `surface-copy.ts` 는 **각 줄이 페이지 소스에 실재하는지** 가드가 대조하므로
`NewOpeningsPage.tsx`·`AreaReportPage.tsx` 의 **같은 문장도 함께** 고쳤다(한쪽만 고치면 빨간불).
블로그 본문 43 → 39 는 **동결만** 했다(산문을 기계로 고치면 품질이 더 나빠진다).

⚠️ **남은 사각지대**: 가드는 아직 `.tsx` + `blog-seed.ts` 만 본다. `consumer-surfaces.ts`·
`surface-copy.ts` 는 지금 0 이지만 **감시되지 않는다** — 그 둘을 범위에 넣는 것이 다음 개선이다.

## 4. 다음 세션의 첫 액션

1. **E4 라이브 판정** (배포 후, Googlebot UA):
   - `curl -s https://urdeal.kr/sitemap.xml | grep -c '/region/%'` 가 **43건 안팎**이고 날것 한글 **0**
   - `/sitemap.xml` 에 `/join`·`/terms/seller` 가 있고 `/terms/influencer`·`/terms/group-buy` 는 **0**
   - `/terms/influencer` 의 `name="robots"` 가 **`noindex`**
   - `/blog` 제목 21편에 `—` **0건**
   - 품절 상품 상세의 `availability` 가 `OutOfStock` 인지 (⚠️ 라이브에 품절 상품이 있는지 먼저 확인)
   - `/urshorts` 크롤러 본문이 **6자에서 올라갔는지** + sitemap 에 실재하는지
   - **반대 방향**: 소비자 표면이 전부 **200** 인지, `/region/서울` 이 여전히 **200 + index** 인지
2. 아래 §5 의 남은 항목 중 **#47 → #43 잔여 → anti-slop 범위 확장** 순을 권한다(이유는 각 항목에).

## 5. 남은 것 — 왜 안 했는지까지

### 대표 판단이 필요한 것

- **#45 로고·유달이 구글 이미지** (대표 직접 요청). **실측은 끝났다**: 색인 가능한 페이지에 있는
  브랜드 `<img>` 는 로더 하나뿐이고 `alt=""`·`aria-hidden`·68px 라 **구글 이미지가 구조적으로 색인
  할 수 없다**(장식 이미지로 올바르게 표시돼 있다). 로고는 **텍스트 워드마크**라 로고 이미지 파일이
  아예 없다. `Udal` 부품도 `alt=""` 하드코딩이다.
  ⇒ 처방은 **"유달이·로고를 공개 색인 표면의 *콘텐츠 이미지*로 올리는 것"** 이고, 그건 `/about`
  같은 **대외 랜딩의 디자인 결정**이라 대표 승인이 선행이다(CLAUDE.md: 공개 랜딩의 look 은 대표 판단).
  내가 할 수 있는 준비: `Udal` 에 선택 `alt` prop 추가 — 다만 **쓰는 곳이 없으면 죽은 코드**라 안 넣었다.
- **#54 `www.urdeal.kr` NXDOMAIN**. 습관적으로 `www.` 를 치는 사람과 외부 링크가 전부 죽는다.
  🔴 **대표가 Cloudflare 에서 DNS 레코드를 먼저 만들어야** 한다(세션은 플랫폼 쓰기 금지). 그 뒤에야
  워커 301 을 붙일 수 있다 — 레코드 없이 리다이렉트 코드를 넣어도 요청이 우리에게 도달조차 안 한다.
- **#31 결재** `/pass/:id` 공유 카드 SVG → 사진 한 장?
- **#35 결재** `/pass/:id` 310건 검색 제목. 대표 제안(`[유어딜] {이용권명}`)을 **5안으로 기록**해 뒀다
  (`docs/decisions/archive/2026-10-12-pass-title-groupbuy.md`). **대표 답을 기다린다.**
- **`twitter:site` = `@urdeal_kr`** — 그 핸들이 **레포 전체에서 `SEO.tsx:79` 한 줄에만** 있고
  푸터 링크도 `sameAs` 도 없다. 실재하지 않으면 **죽은 계정을 가리키는 메타**이고 그건 신뢰 신호를
  깎는다(이 레포가 브랜드 `sameAs` 에서 지키는 규율). x.com 이 이 환경에서 막혀 확인 못 했다.
  ⇒ **대표 확인 필요**: 그 계정이 있습니까? 없으면 그 줄을 지우는 게 맞습니다.

### 내가 할 수 있지만 이번 범위에 안 넣은 것

- ~~#48 `/urshorts`~~ → **했다**(위 §2-2). 남은 것: 우리가 직접 올린 영상이 생기면 그 건에만 `VideoObject`.
- **#47 봇 셸 `og:image:alt`** — 손대려다 멈췄다. 봇 셸(`app.get('*')`)과 `index.html` **두 셸이 있고
  경로에 따라 다른 쪽이 서빙된다**(실측: `/about` 은 봇 셸 4.5KB · `/` 는 index.html 72KB).
  index.html 에 정적으로 넣으면 상세 페이지에서 **og:image 는 바뀌는데 alt 는 홈 설명으로 남는다**
  (= 다른 그림을 설명하는 alt, 없는 것보다 나쁘다). 제대로 하려면 메타 rewrite 체인에도 넣어야 해서
  별건이다. **SEO 가치는 낮다**(순위 신호가 아니라 접근성).
- **#43 잔여 3개** `/gdpr`·`/influencer/rankings`·`/urshorts` 크롤러 본문.
  🩸 `/privacy` 를 파다 **별건 하나를 찾았다**: `PrivacyPolicyPage.tsx` 가 한국어 개인정보처리방침과
  **영어 섹션(`1. Information We Collect` …)을 같이** 갖고 있다. GLOBAL 은 미런칭·폐기(#804)인데
  남아 있는 것으로 보인다 — 내용 판단이 필요해 손대지 않았다.
- **#49 쇼핑 Product `brand`** — **코드는 이미 멀쩡하다**(`brand_name` 이 있으면 낸다). 라이브
  상품에 `brand_name` 이 **없어서** 안 나가는 것이므로 **데이터 문제**다(지어내면 안 된다).
  `/blog` 의 `img 0` 은 라이브 전 글의 `thumbnail_url` 이 null 이라는 2026-10-12 기록과 같은 원인.
- **#56 블로그 본문 em-dash 39** — 동결만 했다(위 §3).
- ~~anti-slop 가드 범위를 `consumer-surfaces.ts`·`surface-copy.ts` 까지~~ → **했다**(아래 §3-2).

### 3-2. anti-slop 범위를 문구 SSOT 까지 (`src/shared/seo/*.ts`)

§3 에서 그 두 파일의 em-dash 11건을 고쳤는데 **가드는 여전히 그 파일을 못 봤다** — `walk()` 가
`.tsx` 만 훑기 때문이다. 즉 고친 자리가 **무검사**라 조용히 되돌아올 수 있었다. 같은 커밋에서
기준을 0 으로 내리는 이 레포의 규율대로(**"개선했으면 같은 커밋에서 기준을 내린다"**) 범위를 넓혔다.

- 범위는 **파일 목록이 아니라 디렉터리 규칙**(`src/shared/seo/[A-Za-z0-9-]+\.ts$`) — 새 문구 파일이
  조용히 새지 않는다. 그 디렉터리가 소비자 표면의 `<title>`·description·크롤러 본문·`/llms.txt`
  문구 SSOT 다(`consumer-surfaces`·`surface-copy`·`concept-content`·`llms-txt`).
- **실측 결과 신규 1건**: `llms-txt.ts` 의 H1 `# 유어딜 (UrDeal) — ${base}` → `# 유어딜 (UrDeal)` +
  주소를 **줄로 분리**(내용 한 글자도 안 줄었다). 빌더를 돌려 눈으로 봤다(103줄, 나머지 동일).
- R2·R3(섹션번호·한글 uppercase)은 범위가 늘어도 **0 유지**(새 파일에 해당 패턴이 없다).
- 🔑 **범위가 좁아지는 것을 가드 자신이 잡는다** — 자기검사 픽스처 `FIXTURE_TS_BAD`(`.ts` 경로에
  em-dash 가 든 합성 파일)가 매 실행마다 돈다. 범위를 지우면 hits 는 0 이라 래칫은 초록인데
  **자기검사가 "가드 자신이 고장났다"로 exit 1** 이다(되돌려-검증으로 확인). 그게 이 클래스의
  핵심이다 — *"검사가 실패한다"* 가 아니라 *"검사가 실패할 수 없다"* 를 막는다.
- `seoCopyFiles.length < 8` 이면 **통과가 아니라 실패**(디렉터리가 옮겨지면 무검사로 돌아간다).
- 가드: 시험 3건 추가 + 주입 1건(`🎨 anti-slop 범위가 .tsx 로 되돌아간다`) **되돌려-검증 빨간불 확인**.

⚠️ **여전히 못 보는 것**: 이 가드는 em-dash·섹션번호·한글 uppercase 셋만 본다. eyebrow 예산과
레이아웃 계열 반복은 **렌더해서 눈으로** 봐야 한다(CLAUDE.md 가 그렇게 적어 뒀다).
그리고 `.tsx` 쪽 `MARKETING` 은 아직 **파일 목록**이다 — 새 대외 페이지를 만들면 손으로 추가해야 한다.

## 6. ⚠️ 이번 작업이 **못 보는 것**

- 구글이 canonical 통합·색인 제외를 실제로 적용하는지 — **수일~수주**, 판정은 서치콘솔에서 **대표만** 본다
- 인코딩된 `<Link to>` 가 브라우저에서 실제로 열리는지(`parseRegionPath` 왕복만 시험했다)
- 라이브에 **품절 상품이 실제로 있는지** — 없으면 `OutOfStock` 경로는 라이브에서 판정 못 한다
- 블로그 재시드가 실제로 돌았는지(`BLOG_SEED_VERSION 13 → 14`, 배포 후 첫 접근 때 동기화)
