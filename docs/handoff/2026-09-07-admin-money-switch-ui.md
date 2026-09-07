# 어드민에 없던 머니 스위치 셋을 붙였다 (2026-09-07)

대표 *"모두 어드민에 붙혀줘"*. 그 앞 대화: *"지금 이 스위치 전체 목록 간단히 켜고 끄게끔도 구현되어있지?"*
→ 실측해 보니 **절반만** 이었다.

## 무엇이 없었나 (실측)

| 키 | 읽는 곳 | 쓰는 화면 |
|---|---|---|
| `affiliate_program_enabled` | 2곳 (`affiliate-credit.ts:139` 지급 · `affiliate-program.ts:33` 표시) | **0** |
| `platform_fee_pct_direct` / `_brokered` | `ledger-commission-policy.ts:59` | **0** (매장 카드는 **표시 전용**) |

`affiliate_program_enabled` 는 **담기 적립의 주 스위치**다. 켜려면 D1 을 직접 고쳐야 했고,
머니 스위치를 그렇게 켜면 오타값(`'True'`/`'1'`)이 저장돼도 read-site 의 `=== 'true'` 가
**조용히 OFF 로 읽는다**. 2026-09-07 에 대표가 교환권 **길 B**(딜은 적립으로만 준다)를 확정하면서
이 스위치가 결국 켜야 할 것이 됐다 — 그래서 지금 붙였다.

## 🩸 왜 기존 가드가 이걸 못 봤나 (이게 이 인계에서 제일 값지다)

`ops-gate-reachable` 는 *"게이트를 만들었으면 켤 화면도 있어야 한다"* 를 강제한다.
그런데 **`OPS_GATES` 에 등재된 것만** 본다. `affiliate_program_enabled` 는 등재를 안 했으니
검사 대상이 아니었다. 가드가 헛돈 게 아니라 **범위 밖**이었고, 그래서 한 달 넘게 조용했다.

⇒ **등재가 곧 검사 범위다.** 새 게이트를 만들면 `OPS_GATES` 에 넣어야 그 시험이 지켜 준다.
(같은 커밋에서 등재했으므로 앞으로는 이 키도 reachability 검사를 받는다.)

## 바꾼 것

- `AdminPlatformSettingsPage.tsx` — "머니 스위치" 섹션에 필드 3개 추가.
  `affiliate_program_enabled` 는 **select**(자유 입력이면 오타값이 저장된다), 요율 둘은 숫자 입력.
- `platform-settings-validation.ts` — `affiliate_program_enabled: boolStr` 등재
  (요율 둘은 이미 `optionalPct` 로 등재돼 있었다 — 화면만 없었다).
- `admin-system-monitoring.routes.ts` — `OPS_GATES` 에 등재(`kind: 'setting'`).

**동작·계산·기본값 전부 무변경.** 손잡이만 붙였다.

## 🔴 이 변경이 처음 만든 위험 하나

요율 칸이 생기면서 **"비울 수 있는 입구"** 가 처음 생겼다. `Number('')` 는 **0** 이고 0 은
0~100 범위를 통과하므로, read-site 가 `Number()` 였다면 칸을 비우는 순간 **수수료가 0% 로 걷힌다**.

실제 코드는 `Number.parseFloat('')` → `NaN` → 폴백(직접 10 / 중개 5)이라 **안전하다**.
그 안전판을 테스트로 고정했고(④-b), 주입 매니페스트에도 넣었다 —
`Number.parseFloat` → `Number` 로 바꾸면 빨간불이 뜬다.

## 검증

- `admin-money-switch-ui-2026-09-07.test.ts` 7건 + 주입 3건 **되돌려-검증 빨간불 확인**
  (스위치 제거 / 옵션값 `'True'` / 폴백을 `Number()` 로).
- 변경 파일을 건드리는 기존 테스트 13파일 109건 pass · tsc 0 ·
  file-size(staged) · dashboard-theme(dark: 0) · theme-consistency GREEN.
- 🩸 테스트를 처음 짤 때 `fieldEntry` 를 **첫 `},` 로 잘라** options 배열 첫 원소에서 끊겼고,
  옵션이 하나만 보여 **가짜 빨간불**이 났다. 중괄호를 세는 방식으로 고쳤다.

## 다음 세션의 첫 액션

`git log --oneline -1` · `bash scripts/install-git-hooks.sh`(원격 세션은 매번 필요).

**이 PR 은 스위치를 켜지 않는다** — 손잡이만 만든다. 켜는 것은 대표 판단이고 순서가 있다:

1. 매장을 **직접 채널**로 붙인다 (담을 남의 가게가 있어야 적립이 의미를 갖는다)
2. `promo_funding_source` = `owner` — **이게 먼저여야** 딜의 출처가 매장이다.
   `platform` 인 채로 프로그램을 켜면 매장이 건 소개비를 유어딜이 문다.
3. `seller_promo_field_enabled` → `affiliate_program_enabled`
4. KT 비즈머니 충전 (라이브 잔액 **10,000원** — 교환권 평균가 15,245원짜리 한 장도 못 낸다)

⚠️ 머니 경로다. 실제 flip 은 **단독 세션 + staging 실결제**.

## 남은 결정 (대표)

- 위 순서를 **언제** 시작할지 (권고 기준선: 매장 10곳)
- 매장 채널 기본값 — 실제 매장은 홍대돈까스 1곳(`brokered`)뿐
- KT 매입가 확인 — 정가보다 6% 싸게 사는 게 맞다면 교환권 건당 876원이 남는다
  (현재 소비자 마크업 0% 라 팔려도 유어딜 몫 0원)

정리 문서: https://claude.ai/code/artifact/9c6841b4-d6e4-4b83-9dca-417a2f04e027
