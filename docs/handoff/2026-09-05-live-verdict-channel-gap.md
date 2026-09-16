# 배포 판정 + 실측에서 나온 것: 직접 10% 가 걷히는 매장이 0곳 (2026-09-05)

대표 *"판정 제대로 하고 남은 업무는?"* 에 답하려고 라이브를 실제로 재 보다 나왔다.

## 다음 세션의 첫 액션

대표 판단 **둘**을 기다리는 상태다. 그전에 ②-b 를 켜지 말 것.

1. **`promo_funding_source='owner'`** (어드민) — 안 켜면 매장이 건 소개비를 유어딜이 문다.
   런북 `docs/design/commission-funding-restructure.md` §1. `commission_budget_enabled` 도 함께 평가.
   ⚠️ 라이브 `platform_settings` **쓰기는 세션에서 막혀 있다** → 대표가 어드민에서 직접.
2. **활성 매장 3곳의 채널 확정** (아래 §2).

승인 후 내가 할 것: `SELLER_PROMO_FIELD_ENABLED=true` + 서버 게이트 → 실결제 1건으로
소개비가 **매장 쪽에서** 빠지는지 확인.

## 1. 오늘 머지·배포된 것 (전부 라이브 확인)

| PR | 무엇 | 배포 |
|---|---|---|
| #1350 | 가입 시 매장 채널 확정 | ✅ |
| #1353 | 담기 CTA 가로채기 차단 + '적립' 문구 4곳 | ✅ |
| #1354 | 이용권 사용법 3단계 + 모바일 드롭다운 잘림 | ✅ run #4665 |
| #1357 | 크리에이터 매장영입 2% 폐지 | ✅ run #4667 |
| #1358 | 적립률 표시 SSOT · 소개비 관리 레버 · 라우트 중복 가드 | ✅ `512570b` |

**#1354 는 배포된 번들을 직접 받아 확인**했다(`/assets/GroupBuyDetailPage-*.js` 에 3단계 문구 3종 +
"매장에서만" 존재, **옛 한 줄 `매장에서 교환권 제시` 는 사라짐**).
⚠️ 브라우저로 라이브를 여는 것은 **이 환경 프록시가 막는다**(`ERR_CONNECTION_RESET`) — 번들
문자열까지가 세션이 할 수 있는 최대이고, 화면 배치는 사람이 봐야 한다.
🔴 `curl` 로 HTML 을 받을 땐 **`-L` 필수** — 없으면 0바이트가 오고 "없다"로 오판한다(오늘 밟았다).

## 2. 🔴 직접 10% 가 실제로 걷히는 매장이 **0곳**

```
활성 매장 3곳 (sellers.is_active=1)
  id 5   UR Team                → 채널 미지정
  id 12  Lister Corporation     → 채널 미지정
  id 14  홍대돈까스               → brokered (중개 5%)
전체 11곳 중 채널이 박힌 곳은 1곳뿐(나머지 10곳 미지정 — 대부분 비활성 레거시)
```

`platform_settings`: `fee_channel_rates_enabled=true` · `platform_fee_pct_direct=10` **둘 다 켜져 있다.**
그런데 **미지정이면 `channelPlatformRate` 가 `undefined` 를 돌려주고 중개(5%)로 폴백**한다
(낮은 쪽으로 떨어뜨리는 것은 의도된 설계다 — 우리가 더 떼는 쪽으로 추정하지 않는다).
⇒ 기능은 살아 있는데 **적용 대상이 없다.**

**저장 위치 주의**: 채널은 `sellers.store_channel` 이 **아니다**(그런 컬럼 없다 — sellers 는 100컬럼
한도라 새 컬럼을 못 만든다). `seller_meta(seller_id, key='store_channel', value)` 다.
컬럼명은 `key`/`value` 이지 `meta_key`/`meta_value` 가 아니다(오늘 둘 다 헛짚었다).

**당장 손해는 아니다** — 최근 30일 결제 **0건**, 성장 커미션 지급 이력 **전 기간 0건**
(`affiliate_earnings` 0 · `influencer_attributions` 0). 첫 실매출 전에 정하면 된다.

## 3. 이번에 틀렸던 판단

- **운영백서 드리프트를 표현식으로 막으려다 행을 통째로 날릴 뻔했다.**
  `AFFILIATE_COMMISSION_PCT: DEFAULT_AFFILIATE_RATE * 100` 로 뒀더니
  `generate-ops-handbook.mjs` 가 정적 파싱(`/^([0-9._]+)\s*,/`)이라 못 읽고 **행을 버렸다**.
  틀린 숫자(5%)보다 나쁘다 — 없는 항목은 아무도 못 알아챈다. ⇒ 리터럴 유지 + 드리프트는 **테스트**로.
- **겹친 방어는 단일 주입점이 못 된다.** 새 가드의 오탐 필터 3겹이 서로 겹쳐, 하나 빼도 안 무너진다.
  "이 필터를 빼면 소음이 돌아온다" 고 매니페스트에 등록했는데 **주입해도 초록**이었다.
  ⇒ 진짜 단일 실패점(판정 임계 `at.length > 1`)으로 교체.
- **파생만 검사하는 가드는 헛돈다.** `A === B*100` 식 검사는 둘 다 같은 상수에서 오면 상수를
  되돌려도 통과한다. **값 자체를 못박을 것**(`expect(DEFAULT_AFFILIATE_RATE).toBe(0.02)`).

## 4. 참고 — 지금 라이브 숫자

- 활성 상품 2,606개 **전부** `referral_enabled=1` · `referral_commission_rate` **전부 NULL**
  · `affiliate_commission_rate` 미설정 ⇒ 모든 상품 적립 **2%**(현재 플랫폼 부담).
- `promo_funding_source` · `commission_budget_enabled` · `seller_promo_field_enabled` **전부 미설정**.
