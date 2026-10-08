# 2026-10-08 — 이용권 인증 화면(`/v/:code`) 시안 구현

서비스: 🎟️ 유어딜(소비자 이용권 사용 처리). 머니 경로: 없음(사용 처리 권한·원장 무변경).

## 완료
- `src/pages/VoucherVerifyPage.tsx` 전면 재작성 — 시안 다섯 상황 + 조회 전. TicketCard 한 장, 이모지 0, 용어 '이용권·매장 확인코드'.
- 결함 수리: 사장님이 처리에 성공해도 곧장 "이미 사용된 바우처" ✕ 화면이 뜨던 것 → 완료 화면(처리 시각 + 다음 손님 QR 찍기 → `/seller/scan`).
- 서버 `GET /api/vouchers/verify/:code` 에 `can_redeem` 추가(`scanOrSellerAuth` 재사용 — use-by-seller 와 같은 판정). 다른 매장 사장님은 처음부터 "다른 매장의 이용권" 안내.
- `use-by-seller` 성공 문구 `✅ 메뉴 제공:` → `사용 처리했어요:`.
- 6개 언어 `voucher.verify.*` 키 갱신(안 쓰는 옛 키 13개 제거).
- `visual-preview.mjs --verify=` 스텁 추가.

## 다음 세션 첫 액션
배포 후 `urdeal.kr/v/<내 매장 미사용 코드>` 를 셀러 로그인 상태로 열어 ① "이 메뉴를 드리면 돼요" 가 뜨는지(= 핸들러 안에서 호출한 `scanOrSellerAuth` 가 실제로 user 를 채우는지 — 단위 시험이 못 보는 부분) → 사용 처리 → ② 완료 화면. 다른 매장 계정으로 ⑤ 확인.

## 틀렸던 판단
없음. 단 `can_redeem` 판정이 미들웨어를 핸들러에서 직접 호출하는 방식이라(선례: `requireAdminRole`) 라이브 판정 전까지 E2.
