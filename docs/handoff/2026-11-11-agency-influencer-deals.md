# 2026-11-11 — 에이전시 인플루언서 소개비(총 마케팅 비용 상한 안) · 스위치 OFF

대표 *"계속 진행해"* — 결재 `docs/decisions/2026-11-11-agency-share-auto-split.md` ⑤.

## 한 것 (머니 경로 — 게이트 `agency_influencer_deals_enabled` 기본 OFF, 머지돼도 돈 흐름 무변경)
- SSOT `src/features/agency-console/api/agency-influencer-deals.ts`: 표 `agency_influencer_deals` · `fitsBudget` · `capDealPct` ·
  `proposeAgencyDeal`(상한 안=active, 초과/미정=pending_owner) · `decideAgencyDeal`(CAS) · `endAgencyDeal` · `agencyDealPctForSale`(정산).
- 정산 배선: `group-buy.routes.ts`·`helpers.ts` 가 `agencyDealPctForSale ?? 가게 단위 계약`. 에이전시가 **맡은 이용권**(맡은 기간 + 맡김 active)에만.
- 옛 규칙 1(`isOwnAgencyReferral`) 삭제 + 그 시험·주입 정리 · S-AGENCYSHARE-4 폐기 표기.
- API: 에이전시 `GET/POST /api/agency-console/stores/:id/influencer-deals` · `POST …/:id/end` / 사장님 `GET /api/seller/agency-link/deals` · `POST …/:id/decide` · `…/:id/end`.
- 화면: 에이전시 판매 내역 시트 안 `AgencyDealsSection` · 사장님 에이전시 카드 안 `OwnerAgencyDeals`(스위치 OFF 면 둘 다 안 그린다).
- 알림: 상한 초과 시 사장님 앱 알림 + 알림톡 `agency_deal_approval`(검수 문안 `docs/alimtalk-register-list.md` §30, 승인 전엔 앱 알림만) · 딥링크 `to=agency`.
- 운영: 어드민 손잡이(money-switch-fields) · OPS_GATES · `STAGING_CHECKLIST.md` S-AGENCYDEAL 7건.
- 가드 `agency-influencer-deals-2026-11-11.test.ts` 15건(진짜 SQLite) · 주입 `scripts/mutations/agency-influencer-deals-2026-11-11.mjs` 6건 전부 빨간불.

## 다음(대표 몫)
1. 카카오 채널 관리자에서 `agency_deal_approval` 검수 신청(문안 §30).
2. staging S-AGENCYDEAL 7건 → 스위치 ON.

## 못 한 것 · 한계
- ✅ (후속 PR) 이용권 상세 '이 이용권 팔기 · 딜 N%' 는 `?product_id=` 로 결제와 같은 순서(에이전시 계약 먼저)를 본다.
- 아직: 유어샵 카탈로그·소개 마켓 목록(`findActiveDealPctsBySeller` — 매장 단위 맵)은 에이전시 계약을 안 보여 준다. 목록은 매장 단위라 이용권별 계약을 얹으려면 이용권 번호별 맵이 필요하다(정산엔 영향 없음, 표시만).
- 숙소(`stay-referral.ts`) 경로는 배선 안 함(숙소 기능 비활성).
- 월간 명세서에 수수료·소개비·합계 분리 표시는 아직.
