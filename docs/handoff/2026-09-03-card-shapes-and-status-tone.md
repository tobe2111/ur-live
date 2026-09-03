# 2026-09-03 — 딜 카드 형태 3종 통일 + 상태 색이 전부 회색이던 것

대표 지시: *"남은거 다 해줘. 셀러 대시보드는 너가 알아서"*
(앞선 세션이 남긴 두 결정 항목 — ① 카드 형태 3종 ② 구 로즈/핑크 클래스)

## 1. 다음 세션의 첫 액션

1. **결제 화면 시안 결정 대기** — 대표에게 3안을 보냈다(안 2 추천).
   시안: https://claude.ai/code/artifact/ee0685c1-cbe6-412d-91ed-8dae63e19a6a
   대표 승인 문구는 이미 받아 뒀다: **"CTA 색 + 우리 chrome 전체"**(`AskUserQuestion`).
   ⇒ 안이 정해지면 `src/pages/TossWidgetPayPage.tsx` 의 **우리 chrome 만** 수정하고
   **CLAUDE.md Toss V2 audit log 에 `[UNLOCK]` 항목을 같은 커밋에 추가**할 것.
   ⚠️ `requestPayment`·금액 검증·키 분기·상태 전이·위젯 마운트 id/순서는 byte-불변.

2. ~~상태 색 래칫~~ — **끝났다. 래칫 0.** 59파일 전부 이행했고, 남은 넷은
   *상태가 아닌* 자리(KPI 아이콘 타일·가이드 분류·퍼널 숫자·보상 종류 배지)라
   `status-tone-ok` 주석으로 **사유와 함께** 면제했다. 새로 상태를 회색으로 만들면 CI 가 막는다.

3. **구 로즈/핑크 클래스** — 소비자 282 · 대시보드 216. 아직 손대지 않았다.
   🔑 **중요한 전제 정정**: 이것들은 *분홍으로 보이지 않는다.* `tailwind.config.js` 가
   `pink: MONO, rose: MONO` 로 **이미 회색으로 중화**한다(라이브 CSS 실측). 즉 시급한 색 사고가
   아니라 **"브랜드 강조를 의도한 자리가 조용히 무채색이 된 것"** 이다.
   ⇒ 일괄 치환하지 말고 **브랜드 강조가 필요한 자리만** `brand`/`brand-text` 로 올릴 것.

## 2. 이번에 틀렸던 판단 (제일 값진 부분)

- **"구 로즈/핑크 437+156곳" 이라고 이전 세션이 보고한 것은 프레이밍이 틀렸다.**
  그 클래스들은 렌더 시점에 이미 잉크 회색이다. 진짜 문제는 색이 촌스러운 것이 아니라
  **상태 배지가 그 중화된 색조로 상태를 구분하고 있었다**는 것이다. 라이브 CSS 실측:
  ```
  .bg-rose-50    → rgb(248 247 252)   ==   .bg-emerald-50    → rgb(248 247 252)
  .text-rose-700 → rgb(61 60 58)      ==   .text-emerald-700 → rgb(61 60 58)
  ```
  **반려와 승인이 픽셀 단위로 같았다.** 색을 "정리"하는 작업인 줄 알고 시작했는데
  실제로는 **정보가 사라져 있던 결함**이었다.

- **"미니(HomeMiniCard)·줄(VoucherRow) 둘 다 옛 룩" 도 절반 틀렸다.**
  `VoucherRow` 는 이미 09-02 표면으로 고쳐져 있었다. 진짜 남아 있던 옛 대표색 카드는
  `HomeMiniCard` 와 **`BrowseProductCard`**(격자 카드의 **두 번째 벌** — 아무도 안 세고 있었다)였다.
  후자는 쇼핑탭이 숨김이고 `MainHomePage` 가 참조 0이라 **렌더되는 자리가 전부 죽어 있어서** 안 보였다.
  쇼핑을 재오픈하면 그 순간 옛 룩이 같이 살아난다.

- **가드가 파일을 고정하면 리팩토링이 빨간불을 낸다 — 이번에도 세 번.**
  `deal-card-price-block`(포매터 이름) · `voucher-card-discount-once`(마크업이 SSOT 로 이사) ·
  `home-card-unify`(`grad.base` 라는 **이름**만 찾아서, 같은 짓을 `cardColor` 로 하면 통과).
  마지막 것은 되돌려-검증에서 **실제로 통과해 버렸다** — 헛도는 가드였다. 셋 다 규칙으로 다시 겨눴다.

- **`check-image-fallback` 은 `git ls-files` 를 쓴다 → 새 파일은 커밋 전까지 안 보인다.**
  되돌려-검증이 "가드가 통과함"으로 실패했는데 원인은 가드가 아니라 **untracked** 였다.
  새 파일을 만들면 `git add` 후에 되돌려-검증할 것.

## 3. 완료분

### A. 딜 카드 = 형태 셋 (`check-deal-card-unify` 래칫 7 → **0**)
- 신설 SSOT: `src/components/deal/DealMiniCard.tsx`(미니) · `DealRow.tsx`(줄).
  기존 `GroupBuyFeedCard`(격자)와 합쳐 **형태는 셋뿐**이다.
- `HomeMiniCard.tsx` **삭제**(대표색 그라데이션 룩). 홈 '우리 동네딜' → `DealMiniCard`.
- `BrowseProductCard` · 검색 `ProductCard` → **격자 SSOT 어댑터**로 재작성(호출부 props 불변).
  검색 카드의 **아무 일도 안 하던 하트**(`onClick={e => e.preventDefault()}`)가 진짜 찜으로 바뀌었고,
  사진 위 30% 할인 배지가 08-31 규칙대로 본문으로 내려갔다.
- `VoucherRow` → `DealRow` 위임. **잠금 이미지 계약은 `thumb` 슬롯으로 통째로 넘겨 byte-불변.**
- `SameStoreDeals` · `LocalTownPage`(그리드+체험단 줄) · `GbMarketplacePage` · `InfluencerDiscoverPage`
  · `RecentlyViewedSection` 전부 공유 부품으로.
- `GroupBuyFeedCard` 에 additive prop 3개: `titleNode`(검색어 하이라이트) · `overlayExtra`(핀 버튼) · `className`.
- 🐛 **함께 고쳐진 실제 결함 2건**
  - 교환권 가격 단위: 카드가 `원` 을 하드코딩해 **유어샵 핀의 교환권이 '원', /vouchers 목록에선 '딜'** 이었다.
    → `formatPrice(price, { dealOnly })`.
  - **온누리 가맹 배지**가 상권관(`/local/:code`)의 자체 카드에만 있었다 — 같은 딜이 홈·검색·유어샵에
    뜰 땐 표시가 사라졌다(B2G 약속). 이제 카드 SSOT 가 그리므로 어디에 뜨든 따라간다.
- `PinButton` 이모지(📌/➕) → lucide, `bg-pink-500` → `bg-brand`, 찜 하트와 겹치던 자리 분리.
- `FeaturedCard`(유어샵 '이번 주 픽')의 하드코딩 오렌지 `#DE5F27`·피치 `#FFC7A6` → 브랜드/흰색.
- `GroupBuyFeedCard` 의 `cardGradient(cardColor)` **참조 0인 죽은 계산** 제거 + 마감임박 배지 `⏰` 제거.

### B. 상태 색 — 중화를 통과하지 않는 `tone` 토큰 (신규 불변식 #104)
- `src/index.css` `--tone-{ok,warn,bad,info}` + `-bg`. 다크 값 별도, **always-light 래퍼 5종에서
  라이트 값 되박기**(`--lift`/`--rule` 과 같은 자리 — 안 하면 html.dark 에서 흰 카드 위에 다크용 색).
- `tailwind.config.js` `colors.tone` (MONO 중화 **밖**).
- `src/components/ui/status-pill.tsx` — `StatusPill` · `TONE_PILL` · `TONE_TEXT`.
- 12파일 상태표를 tone 으로 이행(도매 주문/예치금/출금/클레임/제안/세금계산서 · 어드민 주문/정산 ·
  공급자 정산/출금/세금계산서 · 내 원장).
- 가드 `scripts/check-status-tone.mjs`(양성/음성 대조 내장 · 래칫 59파일) → verify.yml strict + audit-gate.

## 4. 남은 결정 / 대기

| 항목 | 상태 |
|---|---|
| 결제 화면 3안 | **대표 결정 대기** (안 2 추천). 잠금 해제 승인은 이미 받음 |
| ~~상태 색 래칫~~ | **완료** — 래칫 0 |
| ~~구 로즈/핑크 클래스~~ | **완료** — 소스·6개 언어 문구까지 `pink-*` 0. `brand`/`brand-text`/`brand-tint`/`brand/N` 로. `rose-*` 는 **안 건드렸다**(대부분 의미색 — tone 또는 기능 빨강으로 갈 것, 별개 판단) |
| 결제 상품 칸을 사진까지 채우기 | **시안 3안 대기**. `/pay/widget` 은 쿼리로 `orderId·amount·orderName·clientKey` 넷만 받아 사진·매장명·정가가 **화면에 도착조차 안 한다** — 호출부(공구 상세·숙소·충전)가 이미 갖고 있으니 쿼리에 실어 보내면 된다(새 fetch 0). 표시용이라 위조 위험은 `orderName` 과 동급 |
| 검색 결과 화면 | 시안 작성 중 대표가 결제 우선으로 돌림. **실측 결함 3건 발견**: ⓐ `SortFilterBar` 필터 칩 5개가 전부 무동작(`onFilterChange` prop 자체가 없다) ⓑ "함께 검색된 키워드" 6개가 `DEFAULT_RELATED_KEYWORD_KEYS` 하드코딩 — 검색어와 무관하고 누르면 0건(진짜 `/api/search/popular` 는 빈 검색 화면에서만 쓰인다) ⓒ 결과 개수가 `text-red-500`(기능색 오용) |
| 구 로즈/핑크 (소비자 282 · 대시보드 216) | 방침 재정의 필요(§1-3) |
| 셀러 대시보드 방향 | 내가 정했다: **③ 대시보드 전용 규칙** — "상태가 읽히는가"를 1순위로. 이번 커밋의 tone 작업이 그 1단계 |
