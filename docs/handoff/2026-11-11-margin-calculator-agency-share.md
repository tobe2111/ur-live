# 2026-11-11 — 이용권 마진 계산기에 '에이전시 몫' 줄 추가

대표: 파트너 질문 7번(할인율 몇 %) → *"이용권 등록 시 계산기처럼 나오지 않아?"* → 1번(에이전시 몫+소개비 중복) 논의 중
*"일단 2번 계산기 보강"*.

## 한 것 (표시 전용 — 정산·적립 무접촉)
- `GET /api/seller/fee-context` 가 `agency_shares: [{name, pct}]` 를 같이 준다 — 이 매장을 **지금 맡은(active)** 에이전시와
  그 **지금 %**(`agency_share_terms` 최신). % 0·미설정·끝난 맡김은 빠진다. SSOT `activeAgencySharesForStore`(`agency-share.ts`).
- `NetProceedsCard`(이용권 등록·수정 화면 계산기): 에이전시 몫 줄을 더해 최종 마진에서 뺀다. 여러 에이전시면 **가장 큰 %**.
  지급 스위치(`agency_share_payout_enabled`)가 꺼져 있어도 보인다 — 그때도 사장님이 에이전시에게 직접 내는 돈이라서.
- 채널 라벨 "중개 운영" → "에이전시 운영"(2026-10-11 명칭 통일).
- `voucherMargin` 에 선택 인자 `agencyPct`(없으면 종전과 같은 값 — 첫 이용권 화면 무변경).
- 가드 `voucher-margin-agency-share-2026-11-11.test.tsx` 7건(실제 SQLite 포함) · 주입 4건(필터·active·차감·최댓값) 전부 빨간불 확인.

## 틀렸던 판단
- import 를 기존 줄 끝(`// 주석` 뒤)에 붙여 **주석 안으로 들어갔다** — vitest 는 초록, `tsc` 만 잡았다(TS2304). 줄 끝 주석 뒤에 코드를 붙이지 말 것.
- `tsc` 첫 실행이 heap 부족으로 죽었는데 종료코드가 0 으로 보였다(`| tail` 의 종료코드). `NODE_OPTIONS=--max-old-space-size=8192` + `PIPESTATUS`.

## 남은 것 / 결정
- 1번(같은 사람이 에이전시 몫 + 소개비 둘 다 받는 문제)의 규칙 변경은 **결재(C)** 사항 — 대표 미결정.
- 첫 이용권 화면(`/store/first-voucher`)은 에이전시 줄이 없다(가입 직후라 맡은 에이전시가 대개 없음).
