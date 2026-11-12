# [LOADING_ADDITIVE] 2026-11-12 교환권 상세 PC — 서버 첫 화면이 상단 네비를 먼저 그린다

- 대상: `src/worker/index.ts`(교환권 상세 분기 인자 한 개) · `src/worker/utils/voucher-detail-ssr-body.ts`
- 왜: PC 실측(1440 · CPU 4배) `/vouchers/:id` CLS **0.33** — 앱의 `DesktopTopNav`(풀너비 표면, 68+1+44px)가 `#root` 맨 위에 서는데 서버 그림엔 그 자리가 없어 마운트 때 본문 전체가 114px 내려갔다.
- 무엇: 데스크톱 UA 면 PC 홈(#2343)과 같은 상단 네비(로고 · 검색창 · 메뉴 글자, 켜짐 = 교환권)를 본문 앞에 그린다. 폰은 종전 그대로.
  네비 마크업은 `worker/utils/pc-topnav-first-screen.ts` 로 떼어 두 화면이 같이 쓴다. 틀 클래스는 `shared/pc-topnav-frame.ts`(상세 표면 CSS 상한 때문에 따로).
- 배포 전 라이브 HTML 끼워 재기(2회씩): CLS **0.3329 · 0.3325 → 0.0003 · 0.0003**.
- 롤백: 인자를 `undefined` 로(분기 한 줄).
