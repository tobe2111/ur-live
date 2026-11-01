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

---

## 🔁 후속 (같은 날, 머지 후) — main 예산 빨간불 수리 + 공유 카드 메타

PR #2058 은 `ae23e02` 로 머지됐다. **E4ⓐ 통과**: `curl https://urdeal.kr/api/seeding/open` →
`200 {"success":true,"data":{"offers":[]}}`(제공 켠 이용권 0건 → 빈 배열, 예측과 일치).
대조군 `/api/seeding/offer/2917` 200 · 없는 1세그먼트 `/seeding` 404.

### 🩸 E4ⓑ 는 판정 근거가 아니다 (이 문서의 앞 절을 정정)

앞에서 **"`/influencer/seeding` 이 200 인지 — known-routes 판정의 실제 증거"** 라고 적었는데 **틀렸다.**
known-routes 는 2세그먼트 이상을 **최상위 세그먼트만** 보고 판정하므로 `influencer` 가 이미 목록에 있어
**배포 전에도 200 이었다**(실측 확인). 즉 ⓑ 는 배포 여부와 무관하게 통과한다 — 다음 세션이 이걸
"배선 증거" 로 읽으면 배포가 안 됐는데 됐다고 오판한다. 실제 증거는 ⓐ(API 200) 하나다.

### main 이 빨간불이었다 — 범인과 터진 화면이 다르다

머지 직후 `Bundle budget (main)` 이 `❌ home: 195.3 → 197.0 KB (+1.7, 허용 1.5) · app-utils.js +1.0`.
**내 커밋 전에 이미 빨간불이었다**(`a36f305` = 문서만 바꾼 PR 에서 처음 실패 — 그 앞 `dbf410e` 회차는
`cancelled` 라 한 번도 측정되지 않았다).

분해(로컬 실측, CI 와 **소수점까지 일치** — 측정 편차 아님):

| 청크 | 기준 | 실측 | 차 |
|---|---|---|---|
| `app-utils.js` | 20.88 | 21.92 | **+1.04** |
| `lz-home.js` | 1.37 | 1.62 | +0.25 |
| `MobileHomePage.js` | 1.81 | 2.04 | +0.23 |
| `lz-common.js` · `index.css` | — | — | +0.14 |

🔑 **마지막 초록 커밋(`1386224`)을 따로 빌드해 재니 거기서도 `app-utils` = 21.92(해시 `B4cGPYv4` 동일).**
`/src/utils/`·`/src/hooks/`·`/src/lib/`(= 그 청크의 소스)는 마지막 초록 이후 **한 글자도 안 바뀌었다.**
⇒ **+1.04 는 코드 증가가 아니라 낡은 기준의 드리프트**이고, 엔트리 청크라 **27개 화면 전부에 +1.2~1.3**
으로 번져 있었다. 그 위에 #2056(홈 지역 사진 — `lz-home`+`MobileHomePage` = +0.48)이 얹혀 **home 만**
허용을 넘겼다. 즉 **터진 화면(home)과 증가의 출처(공용 청크)가 다르다.**

🔬 **"구조적 사각지대" 가 아니다(쓸 뻔한 과장을 정정)**: `__boot__`(엔트리 폐쇄)는 **이미 기준에 있고**
래칫 대상이다 — 드리프트 +1.04 가 그 화면의 허용(1.5) 안이라 통과했을 뿐이고, 그건 *작은 증가는 매번
기준을 안 올린다*는 설계된 허용이다. 새 가드가 필요한 자리가 아니다.

**처방**: `--rebaseline --reason "…"`(사유에 위 분해를 적었다). `--surfaces` 옵션은 **없다** — 그 명령은
전 화면을 실측으로 덮는다(history 의 `surfaces: [...]` 키는 그 세션이 손으로 적은 메모다). 그래서 각
화면이 다음 기능에 온전한 1.5 를 갖게 된다.

### 서버·클라 메타가 갈려 있었다 (내 PR 의 미완성)

배포된 서버 HTML 이 `index, follow` 였다 — 화면에 준 `<SEO noindex />` 는 **react-helmet 이라 JS 를
안 돌리는 크롤러·스크래퍼에 닿지 않는다.** 서버 메타는 `consumer-surfaces` 표가 정하고 그 표에
`/influencer/seeding` 항목이 **없었다.**

🔑 **색인 문제는 아니다** — `robots.txt` 의 `Disallow: /influencer/` 로 크롤이 이미 막혀 있다.
표에 넣는 이유는 **공유 카드** 하나다: 항목이 없으면 이 주소를 카톡·슬랙에 붙였을 때 `index.html`
기본(= 유어딜 홈) 카드가 뜬다. 선례가 정확히 같다 — `/store/new`(*"로그인 뒤 가입 도구 + robots
Disallow ⇒ noindex 공유 카드 메타만"*).

수정: 표에 `noindex: true` + title/description(crumb 는 **비운다** — 2026-10-11 가드) · 페이지가
그 표를 읽는다(두 벌 금지 — 2026-10-18 `/vouchers` 에서 배운 것).

🩸 **가드가 내 첫 판을 잡았다**: 표의 title 에 `- 유어딜` 을 담았더니 `surface-title-contract` ②·⑤가
빨간불(브랜드 접미사는 `withSiteName` 한 곳에서만 — 라이브에서 브랜드가 2번 찍힌 2026-10-14 사고의
가드). 표는 접미사 없는 제목, 페이지가 `withSiteName(...)` 로 붙인다.
⚠️ 그리고 **기존 가드(`consumer-surface-seo`·`breadcrumb-*`)는 "표에 있으면 페이지가 읽는다" 를
안 지킨다** — 페이지를 리터럴로 되돌려 보니 **68건 전부 통과**했다. 그래서 내 시험에 그룹 ⑤(3건)를
추가하고 주입 2건(그중 하나는 **반대 방향** — 색인 허용 + crumb)으로 되돌려-검증했다.

### 다음 세션 첫 액션

1. `node scripts/check-surface-budgets.mjs`(빌드 후) — 초록이어야 한다. 빨간불이면 **범인 화면과
   출처 청크가 다를 수 있으니** 위 분해 방법(마지막 초록 커밋을 따로 빌드해 같은 청크를 재기)을 쓸 것.
2. **E4ⓒ(양의 방향)는 아직 못 쟀다** — 제공을 켠 이용권이 **0건**이라 목록이 빈 배열인지만 확인했다.
   테스트 매장으로 한 건 켜고 `/api/seeding/open` 에 뜨는지, 자리가 차면 빠지는지 봐야 한다.
3. 대표 몫(코드 밖, 아직 하나도 안 됨): 알림톡 7종 SENS 심사 · 인스타/유튜브/틱톡 리디렉션 URI 등록 ·
   신청권 구매 게이트(`seeding_pass_charge_enabled`, 기본 OFF — staging 실결제 후).
