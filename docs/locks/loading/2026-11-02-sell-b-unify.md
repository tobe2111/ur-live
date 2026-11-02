# 2026-11-02 `[UNLOCK_LOADING]` 이용권 상세 — 팔아보기 B안 한 줄 · 딜 보유자 배너 통합

- **승인**: 대표 `AskUserQuestion` 답 **"허가 — 통합 (추천)"** (질문: 따로 뜨던 '내 링크로 팔리면 N% 적립돼요' 배너를 빼고
  B안 한 줄('딜 10%')로 합치려면 잠금 파일 `GroupBuyDetailPage.tsx` 를 두 줄 고쳐야 한다 — 배너 한 줄 제거 · 매장 번호 넘겨주기).
- **배경**: 대표 *"B가 좋을 것 같은데? … 그 적립이란게 처음에 가게 사장님이 인플루언서에게 산정해준 수수료 퍼센트 아니야? …
  24시간 유효하다고 해야할 것 같은데? … 통합"* → *"응 화면 B 안 해줘."*

## 바꾼 것 (`GroupBuyDetailPage.tsx`)
| 자리 | 전 → 후 |
|---|---|
| `ShareRewardBanner` (딜 보유자에게만, 머리 카드 아래) | **제거**(import 포함 · 파일 삭제) — 그 % 는 팔아보기 줄 오른쪽 값이 됐다 |
| `<SellThisCard …>` | `sellerId={detail.seller_id}` 를 넘긴다(딜 % 조회용) |

## 로딩 영향
- 요청 수 **같음** — 딜 조회(`/api/influencer-settlement/deal-for-seller/:id`)는 배너에서 팔아보기 줄로 옮겨갔을 뿐이다. 로그아웃이면 여전히 0 (10-15 401 수리 승계 — 주입 고정).
- 밀림 **없음** — 줄 높이 52px 고정, 조회 중엔 값 자리를 `invisible` 로 예약(주입 고정). 배너는 딜 보유자에게만 늦게 생겨 아래를 밀었는데 그 원인이 사라졌다.
- 창(`SellThisSheet`)은 누를 때만 받는다(lazy). surface-budgets 27화면 · exec-cost 10화면 예산 안.

## 건드리지 않은 잠금 항목
`__SSR_INITIAL_DETAIL__` 즉시 사용 · CountdownRing/폴링 · below-fold lazy · 히어로 · 서버 첫 화면(`detail-ssr-body.ts` 는 주석 한 줄만).

## 검증
tsc 0 · 신규 `sell-this-b-2026-11-02` 14건 + 재조준 `detail-ssr-first-screen`·`seeding-open-list` · 디자인 가드 6파일 35건 ·
주입 신규 5 + 재조준 3 빨간불 확인 · 하네스 렌더(줄 · 창 라이트/다크 · 약정 없음).
⚠️ 못 잰 것: 라이브 체감(머지 후 E4) · 사장님 알림 실제 도착.
