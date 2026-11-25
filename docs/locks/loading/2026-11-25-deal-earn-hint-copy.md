# 2026-11-25 [LOADING_ADDITIVE] 딜 안내 문구를 한 줄 SSOT 로 (`ProductDetailPage` · `VoucherDetailPage`)

- **무엇을**: 두 잠금 파일에서 "딜이 부족해요. 딜은 친구 초대·유어샵 추천으로 모을 수 있어요." 토스트 문구를 `src/shared/deal-earn-hint.ts` 의 `DEAL_SHORT_MESSAGE` 로 바꿨다(import 한 줄 + 문자열 한 곳씩).
- **왜**: 친구 초대·유어샵 추천 보상은 둘 다 꺼져 있다(2026-10-16 대표 확정 · 설정 0). 없는 혜택을 안내하고 있었다.
- **잠긴 항목에 닿았나**: 아니다. 두 파일의 잠금은 이용권 발급 뒤 `useInvalidateMyVouchers()` 호출이고 그 줄은 그대로다. 로딩 경로·데이터 요청·청크 구성 변화 없음(문자열 상수 1개 추가, 수십 바이트).
- **되돌리는 법**: PR revert.
- **근거 시험**: `src/tests/unit/deal-side-fixes-2026-11-25.test.ts` ③.
