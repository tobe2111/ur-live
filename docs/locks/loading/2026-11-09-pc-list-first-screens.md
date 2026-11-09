# [UNLOCK_LOADING] 2026-11-09 — PC 첫 화면 둘: 교환권 목록 `/vouchers` · 유어샵 `/u/:handle` (대표 승인 — "가장 이상적으로 진행")

라이브 실측(1440px · 4G · CPU 4배): PC 교환권 첫 글자 **2.27s** · PC 유어샵 **2.19s**. 둘 다 로더-먼저만 걸려 있었다 — 폰 첫 화면은 PC 에서 스스로 걷어내거나(교환권 가드의 `min-width:1024px`) UA 로 안 그렸다(유어샵).

## 잠금표 접촉
- `src/worker/index.ts` VOUCHERS 분기: UA 를 **조건에서 빼고 빌더 선택**으로(`폰 ? buildVouchersFirstScreen : buildVouchersPcFirstScreen`). CURATOR 분기: UA 를 조건에서 빼고 **빌더 인자**로. 줄 수 2672 유지.
- `utils/css-first-boot.ts` `firstScreenApplies` PC 가지에 `/vouchers` · `/u/:handle`(`/u/me` 제외) 추가.
- `VouchersPage.tsx`(잠금표) **무변경** — 클래스는 `shared/vouchers-pc-first-screen.ts` 로 옮겨 적고 시험이 원본 소스 6개와 글자 대조.

## 교환권 PC 본문
[상단 네비 높이(`PC_HOME_FS.topnav*`)] + 2열 `grid-cols-[248px_minmax(0,1fr)]` [레일: 비로그인 잔액 바 · 내 교환권 줄 | 본문: 브랜드 줄 자리(`PcBrandStripReserve` 미러) · 머리 줄(`커피/음료 교환권 20+` + 정렬 버튼) · `VoucherCard` 격자 3/5열 10장(앞 8 eager · 사진 `fetchpriority=low` — 폰과 같은 실측 근거)]. 가드는 **로그인 흔적만**(넓은 화면 조건 없음 — 이게 PC 본문이다).
그리지 않는 것: 레일의 카테고리 세로 목록(`/api/vouchers/sections` 가 와야 안다 — 레일은 자기 폭 안에서만 자라 격자는 안 움직인다).

## 유어샵 PC 본문
같은 DOM 이 CSS(`.ur-ushop-pc`)로 2열이 된다 → 본문은 폰과 **byte-동일**, PC UA 면 맨 앞에 네비 높이 예약만 더한다.

## 못 보는 것
마운트 때 픽셀 이동(배포 뒤 PC 뷰포트 CLS 실측) · PC 교환권 격자가 React 에서 더 많이 보여도 **아래로만** 늘어난다(기존 카드는 제자리).

## 가드
`pc-list-first-screens-2026-11-09.test.tsx` 40여 건 · 주입 5건 · 재조준 3(vouchers ④ 배선 · curator ⑥ · css-first-boot PC) · curator 주입 1 재조준.
