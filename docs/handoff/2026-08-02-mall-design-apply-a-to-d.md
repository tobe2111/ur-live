# 2026-08-02 — 운영자 몰 파일럿 시안 적용 (화면 A · A-2 · B · C · D)

> 앞 세션(`2026-08-02-mall-consumer-surface-boundary.md`, PR #971)이 **코드 경계**까지 했고,
> 이 세션이 그 위에 **시안**을 얹었다. 브랜치 `claude/mall-design-apply-a-to-d` (base = PR #971).

## 다음 세션의 첫 액션

**① PR 머지 순서 = #971 → #1001.** #1001(이 브랜치)의 base 가 #971 이다. `main` 에는 경계 가드도
A-2 의뢰서도 아직 없다(2026-08-02 시점 `main` HEAD = `163c0c5` #970). **#971 을 먼저 머지하지 않으면
#1001 의 diff 가 경계 가드까지 포함한 것처럼 보인다.**

**② 배포 후 실측** — 파일럿 몰이 **0개**라 `urdeal.kr/{슬러그}` 가 아직 열리지 않는다
(`wholesale_malls` 에 `consumer_path=1` 인 행 0). 몰을 1개 만들어야 A·A-2 를 실기기에서 볼 수 있다.

**③ 커밋 서명은 이 컨테이너에서 검증 불가다.** `gpgsig -----BEGIN SSH SIGNATURE-----` 헤더는
**실제로 붙어 있다.** 그런데 `git verify-commit` 이 실패한다 — `gpg.ssh.program` 이 `/tmp/code-sign`
이고 그게 `-Y verify` 를 모른다(`unsupported code-sign operation`), `ssh-keygen` 도 없다.
⚠️ `gpg.ssh.allowedSignersFile` 을 세팅하면 `%G?` 가 **N → B(BAD)** 로 바뀐다(더 나빠진다) — 되돌렸다.
GitHub 에서 **Verified** 를 띄우려면 대표가 `github.com/settings/keys` → New SSH key →
Key type **Signing Key** 로 공개키를 등록해야 한다(Developer settings 아님 — 거긴 앱/토큰이다).

## 이번에 한 것

시안 5종이 **전부 이미 있는 화면의 재디자인**이었다(새 화면 0개). 대응표·판정 근거·원본 시안은
`docs/design/operator-mall-pilot.md` + `operator-mall-pilot.dc.html`.

🎁 인계 문서가 *"오늘 다이클로 이미지가 그렇게 사라졌다"* 고 적은 **경쟁사 화면 10장이
핸드오프 번들에 들어 있었다** → `docs/design/assets/operator-mall-pilot/daiclo-ref-01..10.png` 로 복구.

## 🔴 이번에 틀렸던 판단 (제일 값진 것)

### 1. 의뢰서 §5.1 을 그대로 믿을 뻔했다

의뢰서는 *"주 버튼·강조 = 로즈 `#E0526B`"* 라고 적었고 시안도 그렇게 그렸다. 그런데
`shared/mall/branding.ts` 에 **2026-07-29 대표 확정**이 있다 — `MALL_COLOR_LIGHT = '#2E7D5B'`,
*"유어딜 본진(로즈 `#E0526B`)과 **구분**되되"*. **의뢰서를 쓴 세션이 코드를 안 보고 썼다.**

⇒ **의뢰서와 코드가 어긋나면 코드에 박힌 대표 확정이 우선이다.** 대표가 지적해 줘서 뒤집었다.
그대로 갔으면 전 화면을 유어딜 본진 색으로 칠해 "구분되되"를 정면으로 깰 뻔했다.

### 2. 화면 B 의 대응 화면을 처음에 틀리게 짚었다

`GroupBuyOpenPanel`(공구 세션 패널)이라고 보고했는데 실제로는 **`SellerQuickGbPage.tsx`**
(전용 라우트 `/seller/products/quick` + 전용 테스트)가 있었다. `grep '빠른 공구'` 한 번이면 됐다.
**"없는 것 같다"를 보고하기 전에 이름으로 한 번 더 찾을 것.**

### 3. 다크 모드에 운영자 색을 쓸 뻔했다

`resolveMallBranding`(`branding.ts:89`)은
`colorDark: color ? MALL_COLOR_DARK : MALL_COLOR_DARK` — **삼항 양쪽이 같다.**
운영자 지정과 무관하게 항상 `#5FBF95`. 코드만 훑으면 "운영자 색이 다크에도 반영된다"고 읽기 쉽다
(그렇게 생긴 삼항이다). 위 주석이 *"파생이 AA 를 깰까 봐 P0 보류"* 라고 설명한다.

## 🔵 그 뒤에 마감한 것 (`6e83a72` + 배선/자동화 후속 커밋)

앞 절이 "남은 결정"으로 넘겼던 세 건을 **같은 브랜치에서 전부 닫았다.** 그 과정에서
**정적 검사가 초록인 채로 살아 있던 결함 2개**가 드러났다 — 아래 "렌더로만 잡힌 것".

### ✅ 화면 C — 픽업일이 실제로 배선됐다

`seller-orders.routes.ts` 가 `product_supply_meta.pickup_date` 를 주문에 실어 준다.
추출: `src/worker/utils/order-list-enrich.ts`(`enrichSellerOrderRows`) — 라우트가 1457→**1440**줄
(동결 baseline 아래). `MobileOrderList` 는 이제 **픽업일**로 묶고 `오늘 픽업 N건` 을 센다.
픽업일 없는 주문은 키 `'ZZZ'` 로 **맨 아래 "픽업일 미정"** — 주문일로 대신 채우지 않는다
(이 화면의 유일한 질문이 *"오늘 누가 오나"* 라 다른 날짜를 넣으면 화면이 통째로 거짓말을 한다).
**머니 무접촉**(읽기 enrich), `handleRefund` 무수정.

### ✅ 운영자 색 대비 가드 — 순수함수 + **배선**

`shared/mall/branding.ts` 에 `relativeLuminance` / `contrastRatio` / `validateMallColor`
(+ `MALL_ON_COLOR_LIGHT`·`MALL_ON_COLOR_DARK`·`MALL_CONTRAST_MIN=4.5`).
실측: `#2E7D5B` vs 흰 글자 **5.00:1** ✅ · `#5FBF95` vs 흰 글자 **2.24:1** ❌ · vs 잉크 **7.94:1** ✅.

🔴 **순수함수만 만들고 끝내지 않았다** — 이 레포가 반복해 만난 *"가드가 있는데 안 돎"* 클래스라
**세 자리 전부** 배선했다: 몰 **생성** 경로 · 몰 **수정** 경로(한쪽만 막으면 수정으로 우회된다) ·
어드민 폼 실시간 힌트. `mall-color-contrast.test.ts` **R4** 가 그 배선 자체를 불변식으로 고정한다
(수정 경로는 `'brand_color' in body` 블록 **안**에서 호출되는지까지 본다).

### ✅ 렌더 스모크 — `npm run smoke:mall` (24/24)

`scripts/smoke-mall-render.mjs`. 스크린샷을 눈으로 보는 게 아니라 **계산된 색을 읽어 대비를 직접 잰다.**
라이트/다크 몰 홈 + 사장님 B·D. CI 는 `.github/workflows/render-smoke.yml`
(`workflow_dispatch` + 경로 필터 `pull_request`, 스크린샷 아티팩트 업로드).
⚠️ **PR 하드 게이트로 승격하지 말 것** — `live-contracts.yml` 과 같은 판단(외부 의존 간헐 실패가 머지를 막는다).

### 🔴 렌더로만 잡힌 것 2개 (정적 검사는 둘 다 초록이었다)

1. **다크 모드 몰 색 면 위 흰 글자 = 2.24:1.** 두 모드 공통으로 흰 글자를 얹고 있었다.
   눈으로는 "초록 위 흰 글씨"라 멀쩡해 보이고 단위 테스트는 색을 안 본다.
   ⇒ `dark:text-[#1A1719]`(7.94:1). 스모크가 두 모드 모두 ≥4.5:1 을 잰다.
2. **`bg-rose-600` 이 화면에선 네이비였다.** `tailwind.config.js` 가 `rose: MONO` 로
   **브랜드 색조를 잉크에 리맵**한다 — 살아남는 기능색은 `red` 하나뿐
   (그 파일 주석: *"유일 예외 = red(에러/삭제/마감임박/안읽음 = 기능 신호)"*).
   마감 배지와 할인율이 조용히 네이비로 나가고 있었다. ⇒ `red-*`, 그리고 스모크에
   **"마감 배지가 빨강 계열인가"**(R > G+60 && R > B+60) 불변식을 추가했다.

> 📌 교훈: 이 레포의 시안 작업은 그동안 전부 정적 검사였다. 그건 *"틀리지 않았다"* 만 말하고
> *"보인다"* 는 말하지 못한다. 위 2건은 **둘 다 tsc·유닛·가드 전부 초록**이었다.

## 남은 결정 / 대기

### 🟡 A-2 상품 상세 — 옵션 / 수량 스테퍼 / 하단 고정 바

시안 A-2 의 나머지다. `ProductDetailPage.tsx` 가 **정확히 978줄로 동결**돼 있어
(`file-size-baseline.json`) 한 줄도 못 늘린다 ⇒ `src/pages/product-detail/` 로 **추출이 선행**돼야 한다
(`ReceiveMethodNotice.tsx` 가 그 폴더의 선례). 이 파일은 **본진 공용**이라 몰 전용 분기를 넣지 말 것 —
경계는 `isMallProduct`/`hasPickupInfo` 가 판정한다.

### 리뷰 요망 — 행동이 바뀐 것 2개 (표면이 아니다)

1. **화면 B 사진 필수화.** 의뢰서 §4 가 필수를 *사진·상품명·가격·마감* 으로 못박았고 시안 B-2 가
   오류 항목으로 그렸다. 이전엔 사진 없이 제출 가능.
2. **화면 B 마감 시각 `등록 시각 + N일` → `그날 KST 23:59:59`.** 시안이 `밤 11시 59분에 마감돼요` 를
   그렸는데 그 문구를 띄우려면 실제로 그래야 한다. 되돌리려면 `deadlineAt()` 하나만.

### 손대지 않은 것

`STORAGE_NOTICE` · `PAYMENT_TRUST_NOTE` · `ReturnPolicySection` 본문 — **법무 대기(X4c)**.
시안이 전부 ~어요체로 바꿔 그렸지만 그대로 뒀다. 앞 세션 방침(*"고지 문구를 조용히 바꾸지 않았다"*) 유지.
`SellerOrdersPage.handleRefund` 등 **머니 경로 전부 무접촉**. PC 주문 표는 `hidden md:block` 래핑만.

## 검증

`tsc` 0 · **전체 유닛 4263/4263**(326 파일) · **렌더 스모크 24/24**(라이트·다크 몰 홈 + B·D) ·
file-size 래칫 ✓(`ProductDetailPage` 978 유지 · `SellerOrdersPage` 615→600 ·
`seller-orders.routes` 1457→1440) · 테마 일관성 ✓ · 대시보드 `dark:` 0건 ·
`guard-registry` 102개 전부 등록 ✓ · pre-commit 전 단계 ✓

### 🔴 전체 스위트를 돌려야 하는 이유 (이번에 실제로 당했다)

시안이 문구를 ~어요체로 통일하면서(`불러오지 못했습니다` → `못했어요`)
`seller-returns-queue.test.ts` 가 깨졌다. **타겟 테스트만 돌렸을 땐 안 보였고 전체(4255개)에서 나왔다.**
고칠 때도 문구를 되돌리지 않고 **검사를 어미에서 풀었다**(`/불러오지 못했/`) —
지킬 것은 *실패를 말하는 문구가 있는가*이지 문장 끝이 아니다.
⚠️ 그 직전에 내가 "검증 완료"라고 보고했었다. **관련 테스트 초록 ≠ 검증 완료.**

### ⚠️ 아직도 못 한 것

**실기기.** 스모크의 API 응답은 라우트 인터셉트로 **가짜**다 — 계약이 바뀌면 스모크는 초록인 채
실물이 깨진다(계약은 `mall-surface-boundary` 같은 소스 가드가 지킨다).
그리고 파일럿 몰이 0개라 `urdeal.kr/{슬러그}` 자체가 아직 안 열린다.

**Playwright 주의**: 이 컨테이너의 브라우저는 `/opt/pw-browsers/chromium-1194` 이고 레포 핀과
빌드 번호가 다르다. `npx playwright install` **금지**(환경 방침) — 스모크가 `executablePath` 를
직접 준다(`PW_CHROME` 로 덮어쓸 수 있다). CI 에서는 `npx playwright install chromium` 이 정상 경로다.
