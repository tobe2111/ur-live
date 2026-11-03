# [UNLOCK_LOADING] 안 보이는 유달이 로더 그림을 받지 않는다 — 2026-11-03

- **바꾼 잠금 파일**: `index.html`(유달이 preload 줄 제거 — 잠긴 항목 preload crossOrigin 없음·Speculation Rules·preconnect **불변**) ·
  `src/worker/index.ts`(정적 로더 문자열의 `<img>` 제거 — SSR inject 구조 불변)
- **대표 승인(그대로)**: *"3,4 해결해줘"* — 4 = 세션이 보고한 *"유달이 그림은 로딩 화면에서 숨겼지만 그림 파일은 아직 받고 있습니다(약 5KB). 잠금 파일이라 따로 허가가 필요합니다."*
- **배경**: 2026-11-02 대표 *"아예 안 보이게"* 로 첫 진입 로더가 visibility:hidden 이 됐는데, preload 가 **보이지 않는 그림**을
  최우선으로 받았고(로더가 첫 화면인 표면), 워커 로더 `<img>` 와 React 로더 `<img>` 도 그 그림을 받았다.

## 무엇을
- `index.html` 유달이 preload 제거 · 워커 정적 로더 `<img>` 제거(안 쓰게 된 import 정리) · `BrandLoader` 숨긴 상태(`hide`)에서 그림을 안 그린다.
- 유달이는 **보이는 로더**(문구 로더 "결제 승인 중" 등)에만 남는다.
- 시험 재조준 6건(inapp ⑦ · voucher-alt · mascot-preload ②④ · udal-mascot 2) + 주입 재조준 4건.

## 롤백
revert.
