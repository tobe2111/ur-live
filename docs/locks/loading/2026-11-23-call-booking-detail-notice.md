# 2026-11-23 `[LOADING_ADDITIVE]` 전화 예약형 이용권 — 상세의 구매 전 안내 한 줄

- **바꾼 잠금 파일**: `src/features/group-buy/api/group-buy-public.routes.ts`(2줄 수정, 줄 수 불변) · `src/pages/GroupBuyDetailPage.tsx`(1줄 수정, 줄 수 불변)
- **대표 승인(그대로)**: *"응 허가해줄게."* — 직전 질문: "이용권 상세 페이지에 '구매 후 매장에 전화해 날짜를 예약해요' 한 줄을 넣으려 합니다 … 기존 내용은 건드리지 않고 한 줄만 추가하는 방식으로 진행해도 될까요?"

## 무엇을 왜
전화 예약형 이용권(tobe2111/ur-live#2466)은 산 뒤에야 "예약이 필요하다" 를 알게 됐다. 사기 전에 알려야 한다.
- 상세 응답에 `call_booking: true` 를 **있을 때만** 싣는다 — 값은 이미 읽어 둔 `metaMap`(`product_supply_meta`)에서 나온다. **쿼리 추가 0 · 라운드트립 추가 0.**
  해석은 `detail-meta-enrich.ts`(비잠금) 가 하고, 라우트는 구조분해 이름 하나와 스프레드 하나만 더했다.
- 화면은 `<UsageGuide … callBooking={…} />` 로 값만 넘긴다. 문구는 `UsageGuide.tsx`(비잠금)의 이용 안내 안, 첫 화면 아래다.

## 불변으로 지킨 잠금 항목
- `Cache-Control: max-age=60` / `CDN-Cache-Control: max-age=900` 분리 · `group_buy_tiers` 서버 parse → array · materialized 경로 — 무접촉
- `__SSR_INITIAL_DETAIL__` 즉시 사용 · CountdownRing/폴링/below-fold lazy — 무접촉
- 서버 첫 화면(`detail-ssr-body.ts`)은 이용 안내를 그리지 않으므로 서버 그림 ↔ 앱 그림 차이 없음(첫 화면 밖)
- 두 잠금 파일 모두 **줄 수 불변**(파일 크기 래칫)

## 가드·주입
`src/tests/unit/visit-plan-call-booking-2026-11-23.test.ts` 에 3건 추가(메타 → 응답 값 · 라우트 스프레드 · 화면 전달) + 주입 3건(`scripts/mutations/visit-plan-2026-11-23.mjs`) 빨간불 확인.

## E4 판정 · 롤백
- 판정: 배포 뒤 전화 예약을 켠 이용권의 `/api/group-buy/products/:id` 에 `call_booking:true` 가 있고, 안 켠 이용권엔 키가 없다. `node scripts/measure-live-vitals.mjs /pass/<id>` 로 FCP·CLS 가 평소 범위인지.
- 롤백: 이 커밋 revert(값 하나·문구 한 줄).
