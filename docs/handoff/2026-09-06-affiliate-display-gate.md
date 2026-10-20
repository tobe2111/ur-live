# 꺼진 프로그램의 적립을 화면이 약속하던 것 (2026-09-06)

## 다음 세션의 첫 액션

이 PR 머지 뒤, 남은 것은 **대표 판단 둘**뿐이다. 세션이 먼저 진행하지 말 것.
1. `promo_funding_source='owner'` (어드민) — 소개비를 매장이 내게 하는 스위치.
2. 매장 채널 확정 — 지금 실제 매장은 **홍대돈까스 1곳(brokered)** 이다.

## 무엇이 잘못돼 있었나

어필리에이트(담아서 팔면 적립)는 **2026-08-22 에 꺼졌다**(`platform_settings.affiliate_program_enabled`,
행 부재 = 꺼짐). 지급 경로 `affiliate-credit.ts creditAffiliateForOrder` 는 그 스위치를 보고 즉시
`PROGRAM_DISABLED` 로 돌아선다. **그런데 스위치를 보는 곳이 거기 하나뿐이었다** — 화면은 몰랐다.

그전까지 안 들킨 이유가 고약하다: 유어샵 배지가 적립률 **단위를 잘못 읽어**(분수를 퍼센트로)
늘 0 이 나와 **아예 안 떴다**. 2026-09-05(#1358)가 그 단위 버그를 고치자 **꺼진 프로그램의
"쓰면 2%" 가 뜨기 시작했다.** 버그가 버그를 가려 주고 있었고, 하나를 고치자 다른 하나가 드러났다.

## 🩸 내가 대표에게 틀리게 보고한 것

처음엔 **표시 3곳**이 약속한다고 보고했다. 라이브 응답을 직접 찍어 보니 **2곳**이었다:

| 화면 | 데이터 출처 | 실측 |
|---|---|---|
| 유어샵 담기 picker | `/api/products` | `referral_enabled: 1` → **배지 뜸** ⚠️ |
| 유어샵 핀 관리 | `/api/curator/*` | `COALESCE(referral_enabled,0)` → **뜸** ⚠️ |
| 상품 상세 공유 문구 | `/api/products/:id` | **`referral_enabled` 키 자체가 없음** → `isReferralEligible=false` → 안전 ✅ |

`PRODUCT_DETAIL_FIELDS` 에 `referral_commission_rate` 는 있는데 `referral_enabled` 는 없다.
⇒ **코드를 읽어 추론하지 말고 응답을 찍어 볼 것.** 두 필드가 늘 같이 다닐 것 같지만 아니다.

## 수리

신규 `worker/utils/affiliate-program.ts`:
- `isAffiliateProgramEnabled(DB)` — 지급 경로와 **같은 키·같은 판정**(`value === 'true'`).
  **fail-closed**(못 읽으면 false — 확인 못 한 돈을 약속하지 않는다).
  WeakMap 메모 + 60s TTL → 엣지 캐시되는 핫 목록 경로에 D1 읽기를 얹지 않는다.
- `gateAffiliateRows(rows, on)` — 꺼져 있으면 행의 `referral_enabled` 를 0 으로 눕힌다.
  화면 SSOT(`shared/affiliate-rate.ts`)가 0 을 '적립 없음'으로 읽어 배지를 감춘다
  ⇒ **클라이언트 변경 0**. 프로그램을 다시 켜면 배지도 그대로 돌아온다(테스트가 그 복귀를 지킨다).

배선 2곳: `ProductRepository.findAll` · `curator.routes`(핀 + 추천 핀).

## 남은 한계 (다음 사람이 알아야 할 것)

- **다른 목록 API 가 `referral_enabled` 를 새로 싣기 시작하면 게이트를 같이 걸어야 한다.**
  지금은 두 곳뿐이라 배선 검사로 고정했지만, 전수 스캔은 아니다.
- 상품 상세는 **필드가 없어서** 안전한 것이지 게이트가 있어서가 아니다. 언젠가
  `referral_enabled` 를 상세에 추가하면 그 순간 공유 문구가 약속을 시작한다.

## 🩸 CI 가 잡은 것 — `-s` 를 또 잘못 읽었다

첫 푸시가 `STRICT_FILE_SIZE` 로 빨간불이 났다. 로컬에서 `check-file-size.mjs -s` 를 돌렸을 때
**"대상 없음 (skip)"** 이 떴는데 그걸 통과로 읽었다 — 그 시점에 staged 가 비어 있어서
**검사가 아무것도 안 본 것**이었다. `-s` 는 STRICT 플래그이지 "staged 검사"가 아니고,
대상 선정은 git 상태가 정한다. ⇒ **`git add` 뒤에 다시 돌려야 실제 판정이다.**
(이 함정은 09-05 인계에도 적혀 있었는데 같은 자리에서 또 밟았다.)

수리는 rebaseline 이 아니라 **줄이기**로 했다 — curator.routes 는 이미 god 파일(1397줄)이고,
래칫이 막으려는 게 정확히 이 드리프트다. 인라인 주석 3줄을 걷어 **정확히 baseline 에 맞췄다**
(이유는 helper 독블록·테스트·이 인계가 이미 담고 있어 정보 손실 없음).

## 가드

`affiliate-program-gate-2026-09-06.test.ts` 11건 + 주입 매니페스트 2건
(목록 게이트 제거 / fail-open 회귀) — **되돌려-검증 둘 다 빨간불 확인**.
