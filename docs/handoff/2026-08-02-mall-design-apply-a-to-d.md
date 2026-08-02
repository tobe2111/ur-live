# 2026-08-02 — 운영자 몰 파일럿 시안 적용 (화면 A · A-2 · B · C · D)

> 앞 세션(`2026-08-02-mall-consumer-surface-boundary.md`, PR #971)이 **코드 경계**까지 했고,
> 이 세션이 그 위에 **시안**을 얹었다. 브랜치 `claude/mall-design-apply-a-to-d` (base = PR #971).

## 다음 세션의 첫 액션

**① 이 브랜치를 푸시하고 PR 을 연다.** 이 컨테이너는 **푸시 자격 증명이 없다**
(`could not read Username for 'https://github.com'`, `add_repo` 를 push 권한으로 2회 호출해도 안 붙음).
`gh` CLI 도 없다. 커밋 4개가 **로컬에만** 있다:

```
dcec8dd feat(product-detail): 화면 A-2 픽업 안내를 "가격만큼" 올림
1f5036a feat(mall): 화면 A 가게 홈 · 화면 C 주문 목록 모바일 뷰
c3c50d4 feat(seller): 화면 B 빠른 공구 등록 · 화면 D 반품 큐
94d58eb docs(design): 시안 5개 화면 보관 + 대응표 + 다이클로 이미지 10장 복구
```

**② PR #971 이 먼저 머지돼야 한다.** 이 브랜치의 base 다. `main` 에는 경계 가드도
A-2 의뢰서도 아직 없다(2026-08-02 시점 `main` HEAD = `163c0c5` #970).

**③ 배포 후 실측** — 앞 세션이 못 한 2줄이 그대로 남아 있다(파일럿 몰 0개라 `urdeal.kr/{슬러그}` 미개통).

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

## 남은 결정 / 대기

### 🔴 화면 C 는 아직 의뢰서가 정의한 일을 못 한다

의뢰서 §4 = *"오늘 픽업하러 올 사람이 누구고 뭘 가져가나"*. 시안은 **픽업일**로 묶는다.
**그런데 `GET /api/seller/orders` 의 `Order` 에 픽업일이 없다**(`created_at` 뿐).
없는 값을 있는 척하지 않고 **주문일로 묶고 라벨도 "주문"** 이라고 썼다.

**필요**: `seller-orders.routes.ts` 주문 목록이 라인의 `pickup_date`(`product_supply_meta`)를 실어야 한다.
그 뒤 `MobileOrderList` 의 `kstOf(o.created_at)` → 픽업일, 통계 라벨 → `오늘 픽업`. **머니 무접촉(읽기 enrich)**.

### 🔴 운영자 색 대비 가드가 없다 (코드 가드 필요 — 디자인으로 못 막는다)

운영자가 옅은 색을 고르면 아바타 이니셜·안전결제 띠의 **흰 글자가 안 보인다.**
`branding.ts` 주석이 *"대비는 취향이 아니라 규격(WCAG AA)"* 이라고 선언해 놓고 **검사는 없다.**
파일럿은 몰 1개라 안 터지지만 몰이 늘면 터진다.
⇒ `validateMallSlug`/`validateMallName` 옆에 **`validateMallColor`** 가 저장 시점에 필요하다.

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

`tsc` 0 · `quick-gb-form` 13/13 · `mall-surface-boundary` 23/23 · 관련 유닛 69/69 ·
file-size 래칫 ✓(`ProductDetailPage` 978 유지 · `SellerOrdersPage` 615→600) ·
테마 일관성 ✓ · mobile-viewport ✓ · 대시보드 `dark:` 0건 · pre-commit 9단계 ✓

⚠️ **못 한 것**: 렌더 검증(E2E·실기기). 이 세션은 정적 검사까지다. 특히 `--mall` CSS 변수의
라이트/다크 전환은 단위 테스트가 안 본다 — **실기기에서 몰 홈을 다크로 열어 아바타·안전결제 띠가
`#5FBF95` 인지** 확인이 유일한 판정이다.
