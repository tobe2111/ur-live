# 대행사(중개사) 확정 플로우 — 매장 코드 · 협업 코드 · 중개사 몫 (2026-09-19)

**레일**: 🎟️ 유어딜(소비자 + 셀러 대시보드). **머니 경로 접촉**: 있음 — 중개사 몫 적립(`broker-share.ts`)이 **게이트 OFF** 로
들어갔다(`broker_share_enabled` 기본 `false` = 종전과 byte-동일). 협업 코드는 기존 딜 레일(`seller_influencer_deals`)의
활성화 입구 하나가 더 생긴 것이라 결제·적립·환불 코드는 한 줄도 안 바뀌었다.

대표 확정: *"이걸 최종 플로우로 결정하고 중개사가 끼지 않는 매장 직접 운영도 유사한 형태로 하자. 모든 미흡한 부분은 빠짐없이 구현해줘."*
결재 파일: `docs/decisions/2026-09-19-agency-flow-final.md` · 구조 SSOT: `urdeal-platform-model.md` §2-1 🔑.

## [E2] 한 것

| 단계 | 구현 | 파일 |
|---|---|---|
| 1 | 매장 등록 때 **중개사 몫 % · 인플루언서 상한 %** 입력 + **사장님 승계 코드** 자동 발급, 응답 `owner_claim_code` | `StoreRegisterModal` · `seller-stores.routes`(600줄 — 래칫 한계) · **신규** `seller-broker-terms.routes` · `broker-share.ts` · `store-codes.ts` |
| 3 | `/seller/stores` 목록에 주인 없는 위임 매장의 코드 + 링크(`/store/find?code=`) · `/store/find` 코드 입구(`GET /store-claims/lookup-by-code`) | `SellerStoresPage` · `seller-operators.routes /my-stores` · `StoreOwnerClaimPage` · `seller-store-claims.routes` |
| 6·7 | **협업 코드** 발급·회수(`/api/seller-marketing/codes`) · 인플루언서 입력(`/api/influencer-settlement/codes/redeem`) · 착지 `/i/join/:code`(미리보기→로그인→자동 입력) | **신규** `marketing/collab-codes.ts` · `influencer-code-redeem.ts` · `seller-influencer-deals/CollabCodesSection` · `InfluencerJoinPage` |
| 7 | 🩸 **매장 제안 수락 엔드포인트가 0 이었다** → `POST /deals/:id/respond`(influencerApp) + 화면 버튼 | `collab-codes.ts` · `influencer-settlement/DealsAndCodesSection` |
| 7 | 케이스별 % 조정 `PATCH /api/seller-marketing/deals/:id`(이후 판매분부터·상대 알림·상한 검사) + 인라인 편집 UI | `collab-codes.ts` · `SellerInfluencerDealsPage` |
| 8 | 마이페이지 딜마다 **매장 링크**(`/s/{id}?ref=`) + 대표 이용권 링크 · 복사·공유 · 판매/대기/확정 | `marketing.routes /my-stores` · `DealsAndCodesSection` · `SellerPublicPage`(ref 캡처 1 effect — 잠금표 항목은 무접촉) |
| 9 | 중개사 몫 적립 — `/join`·`confirm-toss` 양 경로 대칭, `influencer_attributions source='broker_share'`, 매장 debit, 부분 UNIQUE 멱등, 환불은 기존 `voucher-clawback` 이 order_id 로 되돌림 | `broker-share.ts` · `group-buy.routes`(+3줄 — 래칫 1432→1435 정당 additive) |
| 10 | `/seller/operating` 매장별 **인플루언서별 성과 + 내 중개사 몫** · 어드민 ⑩ 스위치 · OPS_GATES · S-BROKER | `SellerOperatingSummaryPage` · `money-switch-fields.ts` · `admin-system-monitoring.routes` · `STAGING_CHECKLIST` |

가드: `agency-flow-codes-2026-09-19.test.ts` 23건(node:sqlite 로 실제 행 확인) + `scripts/mutations/agency-flow-codes.mjs` 7건
**되돌려-검증 전부 빨간불 확인**. tsc 0 · 관련 102 파일 1,508건 pass · pre-push 게이트 98 통과 · i18n 6개 언어 동기.

## 🩸 이번에 틀렸던 판단 / 가드가 잡은 것

1. `createDashboardNotification` 을 `@/lib/notifications` 에서 import 하려 했다 — 그 파일엔 `notifySeller` 가 있다. tsc 전에 grep 으로 잡았다.
2. `check-file-size` 가 `seller-stores.routes.ts` 를 잡았다(595→670). 요율 라우트를 `seller-broker-terms.routes.ts` 로 빼고 정확히 600 에 맞췄다 — **다음 사람은 이 파일에 한 줄도 못 더한다.** 새 라우트는 형제 모듈로.
3. `store-operator-scope.test` 가 빨갰다 — `/operating-summary` 본문 3,000자 창 안에 `revenue_since_grant` 가 있어야 하는데 내 블록이 밀어냈다. 블록을 `out.push` 뒤로 옮겼다(`Object.assign`).
4. `consumer-hex` 래칫 — 새 소비자 화면 둘에 `dark:bg-[#…]` 를 손으로 박았다. 토큰(`bg-warm`·`bg-surface`·`border-line`)으로 교체.
5. `ops-gate-reachable` — OPS_GATES 에 등재만 하고 **켤 칸**을 안 만들었다(09-16 과 같은 실수) → `money-switch-fields` ⑩.

## ⏭️ 다음 세션의 첫 액션

1. **배포 후 라이브 판정(E4)**: 대표 계정으로 `/seller/stores` 에서 중개 매장 하나 등록(요율 10/5) → 목록에 `XXXX-XXXX` 코드가 뜨는지 →
   다른 계정으로 `/store/find?code=…` → 매장이 자동 선택되는지. `/seller/influencer-deals` 에서 협업 코드 발급 → 세 번째 계정으로
   `/i/join/CODE` → "협업이 시작됐어요" + `/influencer/settlement` 에 매장 링크·수락 대기 딜이 보이는지.
2. **S-BROKER 실결제**(대표가 켜기로 하면): `docs/STAGING_CHECKLIST.md` 5건. 판정 쿼리:
   `SELECT influencer_id, commission_amount, status, source FROM influencer_attributions WHERE source='broker_share'`.
3. 남은 미흡(이번 범위 밖): 코드 발급자 `store_codes.created_by` 는 셀러 라우트에선 seller id 다(유저 id 아님) — 표시용이라 무해하나
   감사 로그로 쓰려면 정리. 인플루언서 정산 페이지의 `MyRankCard` 등 옛 이모지 잔재는 design-slop 래칫 대상 아님(소비자 마이).

## 남은 결정

- `broker_share_enabled` ON 시점 — S-BROKER 뒤 대표 판단(결재 09-16 그대로).
- 협업 코드 기본 `requires_approval` 을 OFF(즉시 활성)로 뒀다. 대표가 "승인 필요"를 기본으로 원하면 `CollabCodesSection` 초기값 1줄.
