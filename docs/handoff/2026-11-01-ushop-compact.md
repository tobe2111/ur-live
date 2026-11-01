# 유어샵 — 긴 이름 두 줄 + 컴팩트 시안 (2026-11-01)

## 다음 세션의 첫 액션

**대표가 1~4안 중 무엇을 골랐는지 확인하고 그 안을 구현한다.** 시안·실측·대가는
`docs/design/ushop-compact-2026-11-01.md` 하나에 다 있다(캔버스: https://claude.ai/artifact/QBryDbgXcHVuTr1hMYoGEs).
**아직 소스 변경 0** — 이번 세션은 측정과 시안까지다.

구현 전에 반드시 읽을 것: 그 문서 §5(구현 시 주의). 요약하면 —
`CuratorHeader.tsx` 를 고치면 **같은 커밋에서** `src/worker/utils/curator-ssr-body.ts` 의
`CURATOR_FS_CLASS` 를 함께 고쳐야 한다(글자 하나까지 같아야 하고 테스트가 진짜 컴포넌트를 렌더해 대조한다).

## 이번 세션에 확인한 것 (추측 아님 · 전부 실측)

- 라이브 `/u/jiwon1228` 시드 조회: 이름 **`리스터코퍼레이션` 8자** · 소개 14자 · 핀 **1개** ·
  SNS 2 · 프로필 사진 있음 · `linked_seller` **없음**(= `CuratorPage` 경로) · `ushop_sold` 0.
  **sitemap 의 `/u/` 는 지금 이 하나뿐**이다.
- 390px 박스 실측: 머리 **220px** · 첫 상품 **281px** · **이름 칸 폭 132px 고정**.
- **PC(1440)는 이미 한 줄**(h1 높이 30) — 2026-10-25 수정 덕분. ⇒ 폰 전용 문제.
- 24px 한글은 132px 에 **5자**. 그래서 8자가 두 줄.
- 정렬('추천순') 버튼에 **상품 수 게이트가 없다** — 칩은 1종이면 `null` 인데 정렬만 남아 혼자 뜬다.

## 이번 세션에 틀렸던 판단

1. **`--css` 에 여러 줄을 넣었더니 조용히 첫 줄만 적용됐다.** 하네스 인자 파서가
   `/^--([^=]+)(?:=(.*))?$/` 라 `.` 이 줄바꿈에 안 걸린다. 네 안이 전부 기준선과 **같은 수치**로
   나와서 처음엔 "CSS 가 안 먹는다" 가 아니라 "변화가 없다" 로 읽을 뻔했다.
   ⇒ **`--css` 는 반드시 한 줄로.**
2. **"얼굴을 없애면 컴팩트해진다" 가 틀렸다.** 실측상 세로 이득 0(이름 칸이 얼굴보다 높다).
   재 보기 전에 시안 후보로 올렸다가 수치를 보고 뺐다.
3. **어드민 `/api/admin/users` 응답은 `data` 가 배열**이고 `handle` 컬럼이 **없다**.
   유어샵 이름 길이 분포는 그 엔드포인트로 못 잰다 → sitemap + 서버 HTML 의 `<title>` 로 쟀다.

## 함께 넣은 도구 변경 (유일한 소스 변경)

`scripts/visual-preview.mjs` 에 옵션 셋 추가 — `--ushop-name=` · `--ushop-bio=` · `--ushop-sns`.
`--pins=N` 과 같은 성질이다(경계는 눈으로 봐야 한다). 기존 동작 불변(옵션 없으면 종전 시드).

## 시안 재현 CSS (한 줄씩 — 복사해서 `--css=` 로)

공통 꼬리(모든 안): `.border-b.border-rule{padding-top:12px !important} .border-b.border-rule .ml-auto{display:none !important} header .min-w-0.flex-1>p{-webkit-line-clamp:1 !important}`

**1안 (A)**
```
header .max-w-3xl{position:relative} header .ml-3{position:absolute !important;top:0;right:20px;margin-left:0 !important} header .gap-4.px-5{padding-top:10px !important} header .mt-4.px-5{margin-top:10px !important} header .h-4{height:10px !important}
```

**2안** = 1안 + `header .w-14{width:40px !important;height:40px !important} header h1{font-size:17px !important;line-height:1.3 !important}`

**3안** = 1안 + `header .mt-4.px-5{margin-top:0 !important;height:0 !important;overflow:visible !important;padding:0 !important} header .mt-4.px-5>p{display:none !important} header .mt-4.px-5>div{position:absolute !important;top:0;right:124px} header .mt-4.px-5>div span.h-8{font-size:0 !important;width:34px;padding:0 !important;justify-content:center}`

**4안** = 1안 + `.ur-ushop-rows{display:grid !important;grid-template-columns:repeat(2,minmax(0,1fr)) !important;gap:16px !important;padding-top:16px !important} .ur-ushop-rows>a{display:block !important;padding:0 !important} .ur-ushop-rows>a>div:first-child{width:100% !important;height:auto !important;aspect-ratio:1/1 !important;margin-bottom:10px !important}`

⚠️ 이 CSS 는 **시안용 주입**이다. 구현은 CSS 덮어쓰기가 아니라 `CuratorHeader` 마크업을 고치고
`curator-ssr-body.ts` 를 같이 고치는 쪽이다.

## 남은 결정 / 대기

- **대표 선택**: 1~4안.
- **아래쪽 빈 공간**(상품 1개 뒤 400px)을 무엇으로 채울지 — 4안(큰 카드)이거나 목록 아래 추천.
  ⚠️ 4안은 **핀 1개면 반쪽 카드 하나만** 남아 지금 라이브에는 오히려 나쁘다(실측).
- **3안을 고르면** `이용권 N · 누적 구매 M` 숫자를 포기하는 것이다(누적 구매는 그 줄에만 있다).

## 못 잰 것

- 실제 폰에서의 체감(렌더는 시스템 글꼴로 떨어진다 — 자간·행간 판단 불가, 배치·높이만 유효).
- 사업자 유어샵(`linked_seller` 있는 경우)의 전체 화면 — 헤더는 같은 컴포넌트지만 아래 레이아웃이
  `SellerPublicPage` 라 다르다. 라이브에 그런 유어샵이 sitemap 에 없어 못 쟀다.
