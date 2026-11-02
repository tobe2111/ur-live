# 2026-11-02 소비자 팝업 유리 통일

**대표 지시**: *"팝업들의 디자인이 별로야. 전체적으로 통합관리해서 변경"* → 시안 4차 끝에 *"블러 없이 유리로 하자"*.
시안·결정 기록: `docs/design/popup-system-2026-11.md` · PR https://github.com/tobe2111/ur-live/pull/2112

## 완료분
- `src/index.css` — 토큰 `--glass` · `--glass-rule` · `--veil` · `--pop-shadow`(라이트/다크) + 클래스 `.ur-glass` · `.ur-veil` · `.ur-glass-rule` · `.ur-dialog-in`.
  흐림 미지원 · `prefers-reduced-transparency` → 불투명 `--surface` 대체.
- `confirm-dialog.tsx`(ConfirmHost) — 폰·PC 모두 가운데 유리 카드, 선으로 나눈 글자 버튼(위험=빨강 글자, 나머지 브랜드 글자).
- `seller-section/Sheet.tsx` — 폰에서 8px 떠 있는 유리 판 + 손잡이(lg+ 가운데 창 유지).
- `ToastContainer.tsx` — 유리 알약, 15px. 죽은 `components/Toast.tsx` 삭제(import 0).
- 화면별 팝업 약 45곳: 뒤 막 `bg-black/NN`(9종) → `.ur-veil`, 판 `bg-surface`/`bg-white` → `.ur-glass`, 모서리 28, 폰에서 `p-2` 띄움. 코드모드는 스크래치(세션 한정) — 대상 목록은 이 PR diff.
- 시험 재조준: `consumer-popups-dark` ④ · `consumer-plate-flat` ③ · `my-seller-all-in-my` 앵커.

## 일부러 안 한 것
- 대시보드(셀러/어드민/에이전시) 전용 팝업 · 전체화면 뷰어(갤러리·스캐너·통계 확대) · 운영자 몰(`MallHomePage` — 공구 서비스) · 유어애즈(`AdsTossPayModal`).
- 잠금표 파일(`GroupBuyDetailPage` 등)의 팝업 — 잠금 절대 룰.
- z-index 15종 통일 — 겹침 순서를 바꾸는 일이라 별도.

## 틀렸던 판단
- 1차 인벤토리에서 "알림 부품 두 벌"이라 했는데 옛 `Toast.tsx` 는 import 0 인 죽은 파일이었다(실제 화면은 한 벌).
- B2 시안 캡처에서 버튼이 찌그러진 것은 시안 CSS(`flex-col` + `flex:1`) 탓이었다 — 코드와 무관.
