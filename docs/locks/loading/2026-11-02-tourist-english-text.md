# 2026-11-02 [UNLOCK_LOADING] 이용권 상세 문구를 번역 함수로 (외국인 관광객 영어)

- **바꾼 잠금 파일**: `src/pages/GroupBuyDetailPage.tsx`(문구만) · `src/pages/GroupBuyConfirmPaymentPage.tsx`(발급 4곳 중 하나 — 문구만)
- **대표 승인(그대로)**: 질문 *"번역 작업을 위해 잠금 파일 수정(문구만, 로딩 구조는 그대로)을 허락하시겠어요?"* → **"허락 (Recommended)"**
- **무엇**: 한국어 문자열을 `t('pass.*' / 'passBuy.*', { defaultValue: '원래 한국어' })` 로 바꿨다. 한국어 화면은 불변(가드 `tourist-english-pass-flow-2026-11-02.test.ts` ①).
- **안 바꾼 것(잠긴 계약)**: `__SSR_INITIAL_DETAIL__` 즉시 사용 · below-fold `lazy(` 3건(시험 3개가 개수를 센다) · CountdownRing·폴링 · `useInvalidateMyVouchers()` 위치 · 훅 순서(기존 `t` 재사용, 새 훅 0).
- **지도**: 외국어 손님용 네이버 지도는 잠금 파일이 아니라 `StoreLocation.tsx` 에서 고른다 — 처음엔 상세 페이지에 `lazy(` 를 하나 더 넣었다가 잠금 지문 시험 3개(`lazy(` 3건 불변)가 빨개져 옮겼다. 카카오 `RestaurantMiniMap` 은 손대지 않았다.
- `MyVouchersPage.tsx` 는 이미 번역 함수를 쓰고 있어 **변경 0**.
