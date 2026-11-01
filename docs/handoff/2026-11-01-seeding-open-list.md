# 2026-11-01 — 체험 목록(`/influencer/seeding`) · 모집 깔때기의 착지

서비스: 🎟️ 유어딜 소비자(이용권) · 머니 접촉: **없음**(목록 읽기만 · 신청권/결제 무접촉) · 롤백: `git revert`

## 먼저 — 앞 세션(#2048) 상태 확인 결과 [E4 일부 통과]
라이브 실측(2026-11-01):
- `GET /api/seeding/offer/2917` → **200 `{"enabled":false}`** — 테이블 자동 생성 확인
- D1: `seeding_offers·applications·pass_balance·pass_tx·penalties` **5개 실재**(전부 0행 — 아직 아무도 안 켰다)
- cron `seeding-sweep` 하트비트 **ok** (`missed=0 reminded=0 checked=0`)
- 상세 번들에 `팔아보기`·`seeding` 문자열 실재 → `SellThisCard` **배포됨**
- 🩸 제가 `/api/seeding/passes/bundles` 를 찔러 404 를 받고 결함으로 볼 뻔했다 — **그런 라우트가 없다**(묶음은 `/me` 가 준다). 없는 주소의 404 를 결함으로 읽지 말 것.

## 🔴 이번에 찾은 구멍 — 신청할 수 있는 것의 **목록이 없었다**
신청은 상세(`/pass/:id`)의 [이 이용권 팔아보기] 에서만 열린다. 즉 **그 상세 주소를 이미 아는 사람만**
신청할 수 있었다. `/my-seeding` 빈 상태가 *"이용권 상세의 … 에서 신청할 수 있어요"* 라고 말하면서
**링크를 못 주고 있던 것**이 그 증거다. 모집 메일·DM 이 착지할 곳이 없었다.

## 만든 것 [E2 — 타입 0 · 빌드 0 · 유닛 80파일 1,463건 · 가드 101개 · 주입 10건 빨간불, 배포 전]
- 서버 `listOpenOffers`(seeding-db) + `GET /api/seeding/open`(공개 · 엣지 60s)
  - 소비자 가시(`consumerVisibleProductSql`) · 승인 매장(`approvedSellerProductSql`) **SSOT 경유**
  - **자리 남은 것만** · 이번 달(`month_key`) 기준 · 거절·취소는 자리를 돌려준다
  - 🔗 **상세 주소를 응답에 안 담는다** — 화면이 `detailHref` SSOT 로 만든다(두 벌이면 같은 상품이 두 URL)
- 화면 `/influencer/seeding`(`InfluencerSeedingPage`) — 로그인 없이 보인다 · `noindex` · 줄은 `DealRow` SSOT
- 막다른 길 둘을 이었다: `SellThisCard` 의 *"제공하지 않아요"* → [다른 체험 보기] · `/my-seeding` → [체험 찾기]
- 가드 `seeding-open-list-2026-11-01.test.ts` **18건**(실제 SQLite) + 주입 10건(절반이 반대 방향)

### 왜 `/seeding` 이 아니라 `/influencer/seeding` 인가
1세그먼트는 `KNOWN_SINGLE_ROUTES` 와 **몰 예약어**를 함께 고쳐야 하고, 빠뜨리면 워커가 404 를 준다.
`influencer` 는 이미 `KNOWN_PARENT_SEGMENTS` 라 **known-routes 무접촉**이다(가드가 그 셋을 실제로 판정한다).

## 이번에 틀렸던 판단
- 주입 *"매장 없는 플랫폼 상품까지 가린다"* 의 첫 판이 `COALESCE(status,'')` → `'x'` 였는데 **둘 다 승인
  목록 밖이라 결과가 같았다**(= 행동을 안 바꾸는 가짜 주입). 러너가 "가드가 지키는 척만 한다" 로 잡았고,
  `NOT EXISTS` → `EXISTS` 로 방향을 실제로 뒤집어 교체했다.
- 응답 키 검사를 `/url|href|path/i` 로 썼더니 **정당한 `image_url`** 에 걸렸다 — 금지 대상은 *상세 링크*다.
- `App.tsx` 의 lazy import 를 `// 주석` **뒤에** 붙여 새 const 가 통째로 주석 안에 들어갔다(바로 잡음).

## 곁다리로 드러난 것 (내 변경 탓이 아니다)
`src/worker/generated/critical-css.ts` 의 머리 주석이 **폐쇄 65개**라고 적혀 있었는데 실제 폐쇄는 **66개**다
(내 두 파일을 stash 하고 다시 세도 66 — 즉 **전부터 어긋나 있었다**). **CSS 본문은 byte-동일**(59416B)이라
화면·가드 영향은 0 이고, 이번 빌드가 그 주석만 갱신했다. 그 가드는 CSS 를 보지 주석의 숫자를 안 봐서
이 드리프트를 못 잡는다 — 다음에 그 가드를 만지면 개수도 함께 대조할 것.

## 다음 세션 첫 액션
1. 배포 후 `curl -s https://urdeal.kr/api/seeding/open` → `{"success":true,"data":{"offers":[]}}`
2. `/influencer/seeding` 가 **200**(워커 404 아님)인지 — known-routes 판정이 라이브에서 맞는지
3. 제공을 켠 이용권이 **생긴 뒤** 그 상품이 목록에 뜨는지(E4 의 양의 방향 — 0건만 보면 판정이 안 된다)

## 🧾 대표님이 해야 켜지는 것 (코드 밖 — #2048 인계에서 이어짐, 아직 **하나도 안 됨**)
라이브 `alimtalk_approved_templates` 실측 — 등록된 7종에 **체험 7종이 없다**(= 사장님 알림톡이 안 나간다):
`voucher_issued, seller_first_voucher, voucher_refunded, seller_approved, business_registration_rejected, seller_bank_changed, payout_completed`
1. 인스타/유튜브/틱톡 리디렉션 URI·범위 등록 (#2048 인계 1~3)
2. 알림톡 7종 SENS 심사 → 승인되면 세션이 `alimtalk_approved_templates` 에 추가
3. 신청권 구매는 `seeding_pass_charge_enabled` **기본 OFF** — staging 실결제 S-SEED 후 어드민에서 켠다

## 남은 결정
- 모집 메일의 법적 성격(제휴 제안 ↔ 광고성). 정보통신망법 **50조의2**(자동 수집 이메일)는 내용 성격과
  무관하게 **수집 방식**을 문제 삼으므로, 대량 발송 전 법무 확인이 필요하다 — 코드가 아니라 결정 사항.
