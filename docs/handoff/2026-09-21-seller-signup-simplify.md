# 사업자 유저 가입 화면 — "너무 복잡함" 시안 5안 (2026-09-21)

대표: *"`urdeal.kr/seller/register/supplier?from=kakao&userName=정지원` 여기 UI 디자인 수정 필요.
너무 복잡함. 심플하게 진행 필요. 시안 필요"* → *"시안 더 대기업스럽게 완성도있게 시안 여러개 만들어서 줘."*

어느 서비스인가: **유어딜**(소비자 → 사업자 유저 전환 관문). 도매·공구 서비스·유어애즈 무접촉.
머니 경로: **없음**(시안만 — 가입 화면 코드 0).

## 다음 세션의 첫 액션

1. **대표 선택 대기** — A/B/C/D/E/F 중. 시안 덱 https://claude.ai/artifact/4YcRBe48GZiTYEPQSS34He
   배포 뒤에는 `urdeal.kr/design/variants?set=seller-signup`(데이터 스위치·폭 전환).
   **섞어 고를 수 있다** — 축이 셋이다(화면 수 · 입력 옷 · OCR). 예: "B 구조 + C 옷".
2. 고르면 그 안을 `src/pages/SellerRegisterSupplierPage.tsx` 에 구현.
   착수 지점·함정은 `docs/design/seller-signup-simplify-2026-09-21.md` §4.
3. 안 F 를 고르면 **먼저 둘**: 가입 전 호출 가능한 공개 OCR 통로(지금은 셀러 토큰 필수)
   + OCR 정확도 실측(09-16 인계가 "유일한 미검증 축" 이라 남긴 그것).

## 완료분 (이번 세션)

| 무엇 | 파일 |
|---|---|
| 시안 세트 6안(실제 부품 렌더) | `src/pages/design-variants/sets/seller-signup.tsx` (신규) |
| 시안 공용 부품(대형 앱 치수) | `src/pages/design-variants/sets/seller-signup-parts.tsx` (신규) |
| 갤러리 등록 2줄 | `src/pages/design-variants/registry.ts` |
| 시안 문서 + 실측 표 | `docs/design/seller-signup-simplify-2026-09-21.md` (신규) |
| 폰 430px 렌더 12장 | `docs/design/assets/seller-signup-simplify-2026-09-21/` |
| 아카이브 표·갤러리 목록 | `docs/design/README.md` · `docs/design/variant-gallery.md` |

## 실측 (코드만 봐서는 안 보였던 것)

`node scripts/visual-preview.mjs --route=/seller/register/supplier --auth=user`:
**블록 10개 · 진행 숫자 5종(`1/3` `0/3` `0/2` `3 남음` `필수 0/5`) · 1,893px.**
폰 한 화면은 약 830px 이라 **지금 화면만 스크롤해야 다음 칸이 보인다.**

🔑 **렌더로만 드러난 것 둘**:
1. **헤더 `1 / 3` 은 고아다.** 09-16 이 3단계 사다리를 지웠는데 헤더의 숫자는 남았다.
   지금 화면 어디에도 "3단계" 가 없다.
2. **매장 종류·주소를 두 번 친다.** 여기 값은 `sellers.description` 에
   `[카테고리: …][주소: …]` **문자열**로만 들어가고 매장 행을 안 만든다.
   가입 뒤 `StoreRegisterModal`(4스텝)이 카카오맵에서 **다시** 받는다.

서버 필수는 **셋**(가게명·사업자번호·연락처, `seller-registration.routes.ts:387`).
대표자명·개업일은 국세청 자동 승인용이라 다섯을 받는다
⇒ **칸을 줄이면 자동 승인이 죽는다. 줄일 것은 칸이 아니라 블록이다.**

## 이번에 틀렸던 판단

- **처음에 "이 화면을 바로 고치자" 로 갔다가 멈췄다.** `docs/design/README.md` 표가 이 화면을
  **5일 전(09-16) 대표 확정 "안 2 + 시각 C"** 로 기록하고 있다. 대표 지시는 "시안 필요" 였고,
  확정 시안 밖 방향 전환은 등급 C(결재) 다 ⇒ **코드 0, 시안만.**
- **`docs/design/assets/` 에 목업을 손으로 그리려다 관뒀다.** 레포에 더 나은 길이 이미 있다 —
  `/design/variants` 갤러리(09-15 신설)는 **실제 부품으로** 그리므로 손그림과 실물이 갈리지 않는다.
- 🩸 **첫 판 렌더에 갤러리 크롬이 섞여 들어왔다.** `visual-preview.mjs` 는 페이지 전체를 찍는데,
  갤러리 상단 바가 `sticky` 라 긴 시안을 찍을 때 스크롤되며 **그림 위에 겹쳤다**(C 안 상단 200px 가
  picker 바로 덮였다). 요소 단위 스크린샷 + sticky 무력화로 해결.
  ⇒ 시안을 다시 찍을 일이 있으면 스크래치의 `shoot-variants.mjs` 방식을 쓸 것(요소 screenshot).
- 🩸 **시안 덱의 기준선이 73px 어긋나 있었다.** "폰 한 화면(830px)" 점선을 `left: 43.7%` 로 뒀는데
  그건 **라벨 칸(116px)을 포함한 전체 폭** 기준이라 막대 좌표계와 안 맞았다. 그림이 실제보다
  짧아 보이는 거짓말을 한다 → `calc(var(--gut) + (100% - var(--gut)) * 0.437)` 로 고치고
  브라우저에서 **실제로 재서** 확인(mark 638 = 기대 638).
  ⇒ **차트는 눈으로만 보면 안 되고 좌표를 재야 한다.**

- 🩸 **pre-push 게이트가 가짜 빨간불을 냈다.** `BLOG_SEED_VERSION = 13` 이 "main 이 이미 쓴 번호"
  라고 막았는데, 내 브랜치는 그 파일을 건드린 적이 없다. 원인은 **`origin/main` 을 아직 안 받은 상태**
  였던 것 — `check-seed-version-monotonic` 은 merge-base 를 못 구하면 *"모를 땐 검사한다"* 로
  폴백한다(그 자체는 옳은 설계다). `git fetch origin main` 뒤 다시 돌리니 **가드 99개 통과.**
  ⇒ **원격 세션에서 게이트를 돌리기 전에 `git fetch origin main` 을 먼저 할 것.**
  안 그러면 남의 상수 때문에 빨간불이 떠서 엉뚱한 곳을 고치게 된다.

## 검증 (E2)

- tsc **0** · `design-variants-2026-09-15.test.ts` **15건 pass**(세트 규칙 4종을 새 세트에도 강제)
- `npm run build:client` **0**
- **브라우저 렌더 12장**(6안 × 비어 있음/채움) — 눈으로 확인
- 시안 덱 자체도 렌더해서 확인(넓은 화면·폰·다크 3종, 가로 넘침 0) + **기준선 좌표 실측**(638 = 기대 638)
- pre-push 게이트 **가드 99개 통과**(`git fetch origin main` 뒤)
- ⚠️ **E4 아님**: 시안은 라이브에 영향이 없다. 갤러리 세트는 배포돼야 `urdeal.kr/design/variants` 에서 열린다.

## 남은 결정 (대표)

1. **A~F 중 무엇** — 세션 추천은 **B 지금 + F 다음**. 입력 옷(밑줄 B / 박스 C)은 따로 골라도 된다.
2. B 를 고르면 따라오는 작은 결정: 등록증 첨부 칸을 가입 화면에서 **뺄지**
   (09-16 이 "등록증을 손에 들고 있는 순간" 을 노려 넣은 칸이다 — 빼면 그 순간을 잃고, 두면 블록이 하나 는다).
