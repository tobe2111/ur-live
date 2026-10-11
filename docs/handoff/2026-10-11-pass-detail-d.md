# 2026-10-11 이용권 상세 D안 인계

## 다음 세션의 첫 액션
1. PR 머지·배포 후 라이브 판정(E4): iPhone UA 로 `https://urdeal.kr/pass/2915` 하드로드 →
   서버가 그린 머리 카드(가게·제목)가 마운트 때 **안 움직이는지**(첫 프레임 vs 마운트 후 h1 박스 비교).
2. staging 결제 1회: 구매하기 → 구매 창 → 결제까지(결제 로직은 무접촉, 누르는 경로만 1→2회).

## 완료
- 시안 C·D·E 보관: `docs/design/pass-detail-redesign-2026-10.md` (+ assets)
- D안 구현: `PassHeadCard` · `shared/pass-head.ts` · `DealBottomBar` 구매 창 · `UsageGuide`/`RedeemHowTo` 타일 ·
  `StoreLocation` 가게 보기 · `detail-ssr-body.ts` 머리 카드 미러 · CLAUDE.md 로딩 audit log

## 이번에 틀렸던 판단
- 첫 시안(A·B)을 **첫 화면만** 그려 보냈다 — 대표는 "맨 밑까지 한 번에" 를 원했다. 상세 시안은 전체 길이로.

## 남은 결정
- 헤더 아이콘 3개(찜·유어샵 담기·공유) 유지 여부 — 시안 D 는 공유만이었다. 담기는 유어샵 핵심이라 남김.
- 판매자 정보·취소·환불 규정 접기 섹션(시안에만) — 데이터·법적 문구 확인 후 별건.
