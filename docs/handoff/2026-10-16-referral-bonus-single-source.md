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

## 다음 세션의 첫 액션
1. PR 상태 확인 후 머지(auto-merge 무장). 머지되면 **E4 는 라이브 원장**:
   `point_transactions WHERE type='referral_bonus'` 가 **계속 0행**인지(배포 후에도).
2. 작업 #105 닫기.
3. 내일 04:20 KST `trig_01DsifhCXUKqmev9UiuRroEZ`(#1854 cron E4) — 건드리지 말 것.
