# 2026-10-10 · 머니 경로 감사 수리 6건 (정산 화면 · 계좌 스냅샷 · 계좌 재확인 · 중개사 몫 역전 · 좌석 · 딜 % 상한)

서비스: 🎟️ 유어딜(소비자 셀러 정산·이용권 커미션). 도매·공구 서비스 무접촉.
대표 지시: 감사 후 *"가장 이상적으로 모두 고쳐줘"*. 게이트·env 변경 0, 배포 0, push 0(로컬 커밋만).

## 다음 세션의 첫 액션

1. **staging 실결제(E4 판정)** — 머니 경로라 단위시험(E2)으로 끝나지 않는다. `docs/STAGING_CHECKLIST.md` S-BROKER 와 함께:
   - 중개 매장(broker_share_enabled=true, 중개사 좌석 있음) 이용권 2장 결제 → 1장 환불 → `ledger_entries` 에
     `attribution_reversal` 1행(몫의 절반) · 2장째 환불 후 `seller:N` 순액 0 확인.
   - 사장님이 중개사 좌석 회수 → 다음 결제에서 `broker_share` attribution 0행.
   - 셀러 계좌 변경 → `/admin/payouts` 승인 시 409 `PAYOUT_ACCOUNT_UNVERIFIED` → `verify-account` 후 통과.
   - 주간 cron 생성분이 이체 CSV(`/api/admin/payouts/transfer-csv`)에 실리는지(`X-Skipped-Count` 0).
2. 매장 사장님 계정으로 `/seller/settlements` 에서 store_owner payout 이력이 보이는지 눈 확인.

## 완료분

| # | 무엇 | 커밋 |
|---|---|---|
| 1 | 셀러 정산 화면이 `store_owner` payout·`merchant:N` 적립을 센다 · 어드민 승인 가드가 접힌 계정(`seller:N`)으로 원장을 묻는다 | `98b13c024` |
| 2 | 계좌 스냅샷 SSOT `resolvePayeeAccount` — cron·수동 생성·손바뀜 마감이 `bank_name`·예금주(account_holder 우선)를 싣는다 · 수동 생성 승인 게이트 · 수동 생성 기간창 OR 우선순위 | `ad67d0bb6` |
| 3 | `checkPayeeAccountCurrent` — 계좌 미재확인(`PAYOUT_ACCOUNT_UNVERIFIED`) · 생성 뒤 바뀐 계좌(`PAYOUT_ACCOUNT_STALE`)를 승인·송금·일괄·이체파일에서 막음 | `68e85e8ad` |
| 4 | 환불 시 중개사 몫·인플루언서 커미션 원장 역전(`attribution-ledger-reversal.ts`) · 주문 단위 환불이 커미션 회수 호출 · 어드민 강제/폐업 환불을 SSOT 로 | `4f2ef3d15` |
| 5 | 좌석 회수된 중개사는 적립 0 (`canOperateStore`) | `75e2f7027` |
| 6 | 딜 % 검증 SSOT(`validateInfluencerDealPct`) — 0~90 · 매장 상한 · 중개사 몫 합 ≤ 90 을 모든 딜 작성 경로에 | (이 커밋) |

가드: 신규 시험 6파일 + 주입 매니페스트 `scripts/mutations/payout-money-audit-2026-10-10.mjs`(전부 빨간불 확인).

## 이번에 틀렸던 판단

- 항목 1 커밋 직후 `payout-hold-seller-view` 시험과 주입 앵커 3건이 낡았다(쿼리를 함수로 추출하며 문자열이 바뀜) — `check-stale-mutation-anchors` 가 잡았고 fixup 으로 같은 커밋에 합쳤다. **쿼리를 추출할 땐 그 파일을 앵커로 쓰는 주입·시험을 먼저 grep 할 것.**
- `check-guard-mutations.mjs --help` 는 도움말이 아니라 **전수 주입 실행**이다(인자 무시). 중간에 죽이면 주입된 결함이 작업트리에 남는다 — 실제로 `VideosPage.tsx` 가 남아 `git checkout` 으로 복원했다.

## 남은 결정/대기

- 이미 **지급된(paid)** 커미션은 환불돼도 회수하지 않는다(종전 정책 — 원장을 되돌리면 플랫폼이 떠안는다). 회수 정책은 별건.
- 결제 시점 % 계산(`findActiveDealPct`)은 작성 시점 검증을 믿는다 — 매장이 상한을 **낮춘 뒤** 기존 딜은 그대로다.
- 영입자(store_intro) 커미션은 이용권 일부 환불에서 여전히 회수되지 않는다(주문 단위 헬퍼뿐).
