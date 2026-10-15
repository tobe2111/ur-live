# 2026-10-16 — 0.5% 공구 추천 보너스 지급 경로 제거 (설정을 무시하던 자리)

대표: ***"0.5%는 안주는거야. 소개비는 매장 사장님이 설정했다면 매장에서 부담하는거."***

## 🩸 이번에 제가 틀렸던 것 (이게 제일 값지다)

전날(10-15) 결재 이행(PR #1861)에서 서버 레일을 남기며 **"비율이 0이라 아무 일도 안 한다"** 고
보고했다. **틀렸다.** 그리고 그 틀린 문장을 `ref-bonus-dead-promise-2026-10-15.test.ts` 머리말에도
적어 놔서 다음 세션이 그대로 믿을 뻔했다(이번에 정정).

경로가 둘이었다:

| | 자리 | 비율 출처 | 상태 |
|---|---|---|---|
| **A** | `group-buy.routes:477` · `commission-rates.calcSplit` · `helpers.applyGroupBuyReferral` | `platform_settings.user_referral_bonus_pct`(**0**) | 꺼짐 |
| **B** | `group-buy.routes:905` → `referral-bonus.ts` | **`COMMISSION_DEFAULTS.REFERRAL_BONUS_BOTHSIDES_PCT` 0.5 상수** | **켜짐** |

B 는 `POST /join/:id`(딜 결제) 안이고 `refRaw` 는 `X-Affiliate-Ref` 헤더인데 `lib/api.ts:179` 가
저장된 소개 ref 를 **모든 요청에 자동 첨부**한다 ⇒ 소개 링크로 들어온 사람이 딜로 참여하면
양쪽에 0.5% 가 실제로 나갔을 것이다. 라이브 `point_transactions type='referral_bonus'` **0행** —
**안 터진 이유는 정책이 아니라 트래픽**이었다(지뢰).

🔑 **교훈: 한 층만 읽고 "꺼져 있다" 고 말하지 말 것.** 어드민 설정이 0 인 것을 확인했어도, 그 설정을
*읽는지* 를 따로 봐야 한다. 이번엔 상수였다.

## 수리

- `group-buy.routes` 호출 + `referral-bonus.ts`(106줄) **삭제**
- `policy.ts` 의 `REFERRAL_BONUS_BOTHSIDES_PCT: 0.5` **삭제** — 남기면 어드민 정책표와
  **대외 제안서 2종**이 아무도 안 주는 숫자를 계속 광고한다(실제로 싣고 있었다)
- `admin-policy/policy-rows.ts` 행 · `generate-proposal-refs.mjs` 행 삭제 → 제안서 2종 재생성
- `point-credit-ledger-row.test.ts` 의 그 모듈 전용 describe 5건 은퇴(대상 소멸, 중복 잠금 회피)

## 🔒 안 지운 것 — 대표 두 번째 문장이 경계다

**매장이 건 소개비**(`seller_influencer_deals` 라이브 active **1건** · 상품별
`referral_commission_rate`)는 **매장 부담**이라 살아 있어야 한다. 그리고 **플랫폼 어필리에이트 2%는
이미 꺼져 있다** — `creditAffiliateForOrder` 맨 위 킬스위치(`affiliate_program_enabled` 행 **부재**,
2026-08-22 대표 *"어필리에이트 전략은 빼려고 해. 심플하게"*).

⚠️ **그래서 제가 전날 올린 "소개 귀속 감시" 제안은 전제가 틀렸다** — `affiliate_earnings` 0행의
이유를 *"아무도 안 썼다"* 로만 봤는데 **프로그램 자체가 꺼져 있다**. `referral_enabled=1` 상품
2,622건은 **그 킬스위치 아래**라 한 번도 상담되지 않는다. 감시를 만들려면 대상이
`seller_influencer_deals` 쪽인데 active 1건·주문 0건이라 지금은 아무것도 안 울린다 ⇒ **철회**.

## 가드

`referral-bonus-single-source-2026-10-16.test.ts` 12건 + 주입 7건(넷이 반대 방향) 전부 빨간불 확인.

🩸 **그중 셋이 처음에 헛돌았다** — 주입이 아니었으면 초록인 채 머지됐다:
1. `if (userBonusAmount > 0)` 만 봐서 `Math.max(1, …)` **바닥깔기**를 놓쳤다(설정 0 인데 1딜 지급).
2. 설정 키가 `commission-rates.ts` 에 **네 군데**(타입·DEFAULTS·KEY_MAP·조회목록) 있어
   `toContain` 이 조회 목록에서만 빼도 통과했다.
3. `toContain('seller_influencer_deals')` 가 `seller_influencer_deals_REMOVED` 를 **부분문자열로**
   통과시켰다(`_` 는 단어 문자라 `\b` 가 안 붙는다 → `FROM … \b` 로 앵커).

## ⚠️ 다음 세션 주의

- **`check-guard-mutations.mjs` 를 `node -e "import(...)"` 로 열지 말 것** — import 가 곧 실행이라
  4,074건 전수(80분+)가 시작된다. 이번에 그렇게 띄웠다가 죽였다(작업트리 오염은 없었다 — 첫 주입에서
  끊겼고 `git status` 로 확인). 필터는 `--only='[태그]'`(**이름 부분일치**, 파일명/정규식 아님).
- staging 실결제는 **안 했다.** 이 변경은 지급을 **없애는** 쪽이고 그 경로가 한 번도 발화한 적이
  없다(원장 0행). 실제 위험은 `/join` 자체를 깨뜨리는 것이라 tsc 0 · 관련 유닛 pass 로 막았다.

## ✅ E4 판정 통과 (배포 후 라이브, 머지 `0e58ab293` · 2026-10-16 03:30 KST)

auto-merge 가 초록인데도 멎어 있어 REST `PUT /merge` 로 직접 끝냈다(`merge_method` 를 빼면 422).

**① 번들 — 양방향으로 쟀다.** 판정은 라이브 번들에서 한다 — 어드민 정책표 행은 **클라가 그리므로**
서버 메타를 봐도 아무 신호가 없다(2026-10-13 공유 카드 E4 가 부호 안 맞는 기준으로 한 번 오판한 그 자리).
🔑 **배포 *전에* 기준점을 먼저 잡았다** — 배포 후 0 만 보면 *지워졌다*와 *원래 없었다*를 구분할 수 없다.
청크 해시가 바뀐 뒤(`AdminPolicyDashboardPage-DGJunL-A` → **`Dj4TW5DE`**, 15,029 → 14,888B) 재니:

| 라이브 어드민 정책 청크 | 배포 전 | 배포 후 |
|---|---|---|
| `공구 양쪽 보너스` | 1 | **0** |
| `REFERRAL_BONUS_BOTHSIDES_PCT` | 2 | **0** |
| `추천인 + 피추천인` | 1 | **0** |
| 대조군 `원천징수` | 4 | **4** |
| 대조군 `어필리에이트` · `커미션` | 1 · 1 | **1 · 1** |

**② 원장 — 0행 유지 + 대조군.** `point_transactions` 유형별 전수가
`donate 10 · charge 9 · refund 7 · legacy_reconcile 4 · bucket_reclass 2` 이고
**`referral_bonus`·`invite_reward` 는 배포 전후 모두 0행**이다. 대조군이 다섯 종류를 실수로 돌려주므로
그 0 은 "쿼리가 비었다"가 아니라 "그 유형이 없다"다. 설정 `user_referral_bonus_pct` = **0**(유일한 출처).

**③ 반대 방향 — 소개비 레일이 살아 있다.** 약정 **1건**(매장 15 ↔ 인플 37, **5%**, `status:active`) ·
귀속 원장 **1건**(`broker_share`, pending) · 소스 참조 `seller_influencer_deals` **16파일** ·
`referral_commission_rate` **25파일**. 하나도 과잉 삭제되지 않았다. 설정 경로도 그대로다
(`group-buy.routes:477` · `helpers.ts:213` · `commission-rates.ts` SSOT).

⚠️ **못 잰 것 — ④ 워커 코드가 배포된 번들에서 사라졌는지.** 지운 모듈은 **워커** 모듈이고 `_worker.js` 는
공개로 읽히지 않는다. 행동으로 증명하려면 **소개 링크로 들어와 딜로 참여**해야 하는데 그건 머니 경로라
세션이 못 한다. ⇒ ①②③ 까지가 여기서 잴 수 있는 전부이고, **①만 보고 "통과" 라고 말하지 않는다.**

🩸 **측정하며 두 번 틀렸다**: `seller_influencer_deals` 의 컬럼을 `is_active`·`commission_rate` 로 짐작했는데
실제는 `status`·`commission_pct` 다. 래퍼가 400 을 스택트레이스로만 던져 원인이 안 보였다 →
**오류 원문을 찍도록 고쳤다**. 컬럼 이름은 `pragma_table_info` 로 먼저 확인할 것.

## 다음 세션의 첫 액션
1. **`Bundle budget (main)` 이 이 머지에서 빨간불이다** — `First-screen execution cost budget`.
   직전 `8be41a099` 는 초록이라 형식상 내 커밋이 만들었는데, **내 클라 변경은 어드민 첫 화면 청크에
   지문 0건**(별도 lazy 라우트)이라 +5~11KB 를 설명하지 못한다. 상세는 아래 §실행비용 래칫.
2. 내일 04:20 KST `trig_01DsifhCXUKqmev9UiuRroEZ`(#1854 cron E4) — 건드리지 말 것.

## 실행비용 래칫 빨간불 (미해결 — 다음 세션이 이어받는다)

**로컬 재현**(같은 컨테이너, 3회 중앙값): 홈 333.3→341.8(+8.5) · 교환권 320.7→326.2(+5.5) ·
어드민 529.8→541.1(+11.3) · 에이전시 478.1→488(+9.9). 허용오차 4KB.

🔴 **그런데 이 숫자로 판정하면 안 된다.** `scripts/exec-cost-baseline.json` 의 `history` 가 스스로 적어 뒀다 —
*"로컬 크로미움이 CI 보다 ~7KB 크게 재서 절댓값을 쓰면 예산이 그만큼 헐거워진다"* · *"추정 대신 그 CI
실행의 3회 중앙값을 그대로 기준으로 삼는다"*. 즉 **기준은 CI 값으로 잠겨 있고 로컬 값과 단위가 다르다.**

🕳️ **그리고 이 환경은 CI 숫자를 읽을 수 없다** — `actions/jobs/<id>/logs` 는 blob 스토리지로 302 되고
이 세션의 `gh` 는 api.github.com 밖으로 안 간다. 아티팩트도 0건, check-run `output` 도 비어 있다.
annotation 에는 `Process completed with exit code 1` 만 온다. ⇒ **워크플로 머리말이 지시하는
*"로그의 실측을 읽고 올려라"* 를 세션은 구조적으로 수행할 수 없다.**

**그래서 지금 돌리는 대조군**: `8be41a099` 를 **같은 컨테이너·같은 크로미움**으로 빌드해 재면
로컬-CI 오프셋이 상수로 상쇄되어 *"내 변경 탓인가"* 가 판정된다(워크트리
`scratchpad/ctrl-8be41a09`). 그 결과가 **다음 세션의 첫 입력**이다:
- 대조군도 +8.5 류로 나오면 → 내 변경은 무죄이고, 빨간불의 원인은 **#1865(lazyPage)가 올린
  실행비용을 홈 한 화면만 잠근 것**일 가능성이 크다(실측: 홈 받은 JS 727.8→854.6KB · 교환권 700.5→846.0
  — 이건 내 diff 로 설명 불가능한 크기다). 처방은 **CI 값으로 `--rebaseline --reason`**.
- 대조군이 ~0 이면 → 내 변경이 정말 올린 것이고 그 경로를 찾아야 한다.

🔧 **그 전에 고쳐야 할 더 근본적인 것**: 이 가드는 실패를 **stdout 으로만** 말한다. `::error::`
annotation 과 `$GITHUB_STEP_SUMMARY` 로 숫자를 내보내면 **세션이 CI 값을 읽을 수 있다** —
`check-surface-budgets`·`check-bundle-size` 도 같은 눈먼 자리를 공유한다(main 전용 래칫 셋 전부).
⚠️ 이건 우회가 아니라 **관측 가능성 수리**다: 지금은 빨간불이 떠도 *무엇이 얼마나* 를 아무도 못 본다.
