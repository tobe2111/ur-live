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

## 2. 가드 (가드가 없으면 전부 되돌아온다)

- 신규 시험 `src/tests/unit/seo-region-encoding-availability-2026-10-13.test.ts` **19건**
- 신규 주입 `scripts/mutations/seo-region-encoding-2026-10-13.mjs` **12건 — 되돌려-검증 전부 빨간불 확인**
- `check-anti-slop-copy.mjs` 에 **블로그 시드 제목 0 잠금 + 본문 래칫(39) + 0건이면 실패**

### 🕳️ 기존 가드·주입 넷이 내 변경에 낡았고 **넷 다 풀지 않고 재조준**했다

`breadcrumb-region-blog`(2건) · `place-sameas` · `region-child-links`.
전부 *불변식은 그대로이고 앵커만* 옮겼다. `check-stale-mutation-anchors` 가 잡았다(0초).

### 🩸 이번에 값을 치르고 배운 것 넷

1. **주석을 바꾸는 주입은 행동을 안 바꾼다.** noindex 주입의 첫 판이 주석 접두만 고쳐서 **통과했다**.
2. **`replace` 가 파일의 다른 곳과 같은 글자면 복원 검사가 오발한다.** `availability: 'https://…/InStock',`
   는 숙소 분기에도 있다 → 앵커에 앞줄을 포함했다. (CLAUDE.md 가 `replace: 'return'` 으로 적어 둔 그 클래스.)
3. **래칫을 *끄는* 결함은 그 가드를 돌려서 못 잡는다**(끄면 초록이다) → 시험이 소스로 고정 + 가드를
   **자식 프로세스로 실제로 돌리는** 시험을 따로 뒀다.
4. **러너는 `cmd:` 를 지원하지 않는다** — `test:` 만 본다. 가드 스크립트를 겨누는 주입은 그 가드를
   돌리는 *시험*을 가리켜야 한다.

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
   - **반대 방향**: 소비자 표면이 전부 **200** 인지, `/region/서울` 이 여전히 **200 + index** 인지
2. 아래 §5 의 남은 항목 중 **#48 → #47 → #43 잔여** 순을 권한다(이유는 각 항목에).

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
  (`docs/decisions/2026-10-12-pass-title-groupbuy.md`). **대표 답을 기다린다.**
- **`twitter:site` = `@urdeal_kr`** — 그 핸들이 **레포 전체에서 `SEO.tsx:79` 한 줄에만** 있고
  푸터 링크도 `sameAs` 도 없다. 실재하지 않으면 **죽은 계정을 가리키는 메타**이고 그건 신뢰 신호를
  깎는다(이 레포가 브랜드 `sameAs` 에서 지키는 규율). x.com 이 이 환경에서 막혀 확인 못 했다.
  ⇒ **대표 확인 필요**: 그 계정이 있습니까? 없으면 그 줄을 지우는 게 맞습니다.

### 내가 할 수 있지만 이번 범위에 안 넣은 것

- **#48 `/urshorts`** — `index, follow` 인데 크롤러 본문 **6자** · `VideoObject` 0 · sitemap 0.
  유어쇼츠는 영상 표면이라 `VideoObject` 가 리치결과를 받을 수 있는 몇 안 되는 자리다. **다음 1순위.**
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
- **anti-slop 가드 범위를 `consumer-surfaces.ts`·`surface-copy.ts` 까지** (위 §3 끝).

## 6. ⚠️ 이번 작업이 **못 보는 것**

- 구글이 canonical 통합·색인 제외를 실제로 적용하는지 — **수일~수주**, 판정은 서치콘솔에서 **대표만** 본다
- 인코딩된 `<Link to>` 가 브라우저에서 실제로 열리는지(`parseRegionPath` 왕복만 시험했다)
- 라이브에 **품절 상품이 실제로 있는지** — 없으면 `OutOfStock` 경로는 라이브에서 판정 못 한다
- 블로그 재시드가 실제로 돌았는지(`BLOG_SEED_VERSION 13 → 14`, 배포 후 첫 접근 때 동기화)
