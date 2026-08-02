# 2026-08-01 — 소비자 실측(성능·SEO·UX) → 어드민 수리 → **딜 원장 전수조사**

머지: `#884`(소비자 표면·어드민 500·KST) · `#924`(원장 조사 경로·모바일 결함 2) ·
**`#928`(원장 전수조사·가입 보너스 중단)** · `#935`(인계) · **`#940`(추천 보너스 삼킴 — §6)**

---

## 1. 다음 세션의 첫 액션

### (a) 원장 불일치가 **늘었는지**만 본다 — 줄었는지가 아니라

```bash
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
BODY=$(python3 -c "import json,os;print(json.dumps({'email':os.environ['URDEAL_ADMIN_EMAIL'],'password':os.environ['URDEAL_ADMIN_PASSWORD']}))")
TOK=$(curl -sS -X POST https://live.ur-team.com/api/admin/login -H 'Content-Type: application/json' -H "User-Agent: $UA" \
  --data-binary "$BODY" | python3 -c "import sys,json;d=json.load(sys.stdin);dd=d.get('data') or {};print(dd.get('accessToken') or dd.get('token') or d.get('token') or '')")
curl -sS "https://live.ur-team.com/api/admin/ledger-integrity" -H "Authorization: Bearer $TOK" -H "User-Agent: $UA"
```

**판정 기준**: `total` 이 **4 이면 정상**(기존 4명 — 3·32·33·24). **5 이상이면 수리가 안 먹혔다**는 뜻이고,
그때는 새 행의 `note` 가 어느 방향인지(잔액>거래합 = 적립 기록 누락 / 잔액<거래합 = 차감 기록 누락)를 보고
그 방향의 코드를 찾는다. **기존 4명이 줄어들 일은 없다** — 잔액 교정을 안 했기 때문이다(§4).

머지 직후 배포본에서 재조회해 `total: 4` 동일, 신규 0 확인함(2026-08-02 04:0x KST).

### (b) 가입 보너스가 정말 안 나가는지

```bash
curl -sS "https://live.ur-team.com/api/admin/tools/settings" -H "Authorization: Bearer $TOK" -H "User-Agent: $UA" \
  | python3 -c "import sys,json;d=json.load(sys.stdin).get('data') or {};print(d.get('signup_bonus_amount','(미설정=0=지급안함)'))"
```
현재 **미설정** → 코드 기본값 0 → `grantSignupBonus` 가 잔액 UPSERT 전에 조기 반환한다.
되살리려면 어드민에서 이 키에 금액만 넣으면 된다(코드 배포 불필요 — 그러라고 옮겼다).

---

## 2. 완료분

### 소비자 표면 (#884) — 라이브 실측으로 확인
| 항목 | before → after |
|---|---|
| `favicon.ico` | 404(구글이 지구본 표시) → 200. ICO 컨테이너(16/32/48) + `_routes.json` exclude + 3자 동기 테스트 24 |
| `/group-buy/99999999` | 200 + 홈 메타 + `index,follow`(soft-404) → **404 + noindex** |
| 별칭 4개 | 200(홈 복제본) → 301 |
| sitemap `/products` | 500건(대부분 KT 기프티콘) → 11 |
| `/vouchers` CLS | 0.188 → **0.001** |
| `/area-report/{지역}` | 서버 메타 없음 → 동적 메타 + 지역명 아니면 noindex |
| 정적 표면 5종 | 홈 메타 공유 → 표면별 title/canonical |

### 어드민 (#884, #924)
- `/admin/reviews` **500 2건** — 라이브 `product_reviews` 는 `is_visible`(1=보임)인데 코드가 `is_hidden` 을 썼다.
  ⚠️ **2026-07-01 의 "수리"가 원인이었다** — repair-schema 선언을 믿고 뒤집었는데 선언 쪽이 틀렸다.
  이번엔 **선언도 함께 고쳤다**(`is_visible DEFAULT 1` + `is_sponsored`). 실측 119,009건 · 평균 4.56
- `/admin/reviews` 상품 선택 — 스크롤 대신 `ProductPicker`(검색 = 상품명+**매장명**, 카테고리 칩, "리뷰 없는 상품만")
- `/admin/errors` — `user_agent`·`stack` 을 저장만 하고 응답에 안 실었다. 진단 보조(`shortUA` 는 인앱 웹뷰를 먼저 본다 —
  카톡/네이버 UA 안에 Safari·Chrome 문자열이 들어 있어 순서를 뒤집으면 전부 오분류)
- 부트 워치독이 **prerendering 중에도 울렸다** → 억제 + `prerenderingchange` 재무장, beacon 에 `nav=`/`vis=` 추가
- `/admin/policy` — policy.ts 8개 그룹 중 **4개가 대시보드에 아예 없었다** → `policy-rows.ts` + 동기화 테스트 13
- `/admin/social` — 앤트로픽 없이 도는 결정론 초안기(`social-compose.ts`). 216조합 전수 테스트 11
  (금칙어·이모지·`!`·상투어 0, 주제/논스별 상이, 결정론). **테스트가 실제 결함을 잡았다** — 문단 길이가
  거의 균일한 조합이 있어 `ensureRhythm` 추가
- KST 전량 교정 — D1 은 `Z` 없는 UTC 라 `new Date()` 가 로컬로 오해석한다

### 딜 원장 (#928) — 이번 세션의 본론
잔액을 움직이는 **19개 파일 전수 확인**, 5곳 수리. 상세는 PR #928 본문.

---

## 3. 이번에 틀렸던 판단 — **여기가 제일 값지다**

### ① "근본원인 수리했다"고 두 번 말했고 두 번 다 성급했다
`creditFreePoints` 하나 고치고 근본원인이라 했다. **아니었다** — 3,000딜을 실제로 적립하는 건
`grantSignupBonus` 라는 **별도 함수**였고 똑같이 삼키고 있었다. 대표 질문("원인은 다 찾았어?")이 없었으면
그대로 넘어갔다.

그래서 손으로 더 뒤지는 대신 **가드를 먼저 만들었다**(`check-balance-without-ledger`). 결과:
**가드가 내가 못 찾은 3곳을 더 찾았다.** 함수 목록을 사람이 외워서 막을 일이 아니었다.

### ② 그 가드도 처음엔 반쪽이었다
적립(`+`)만 봤다. 그래서 **차감 케이스를 못 잡았다** — user 3(−22,480)의 유력한 출처인
추천 커미션 회수가 `balance - ?` 만 하고 원장에 아무것도 안 남기고 있었다. `MUTATES_BALANCE`(±)로 넓혔다.

### ③ 파일 크기 래칫 — 로컬 초록, CI 빨강
`--changed-only` 는 `git diff origin/main` 을 보는데 **새 파일이 untracked 면 판정에서 빠진다.**
`git add` 전에 돌려서 통과한 걸 통과로 믿었다. → 새 파일을 만들었으면 **stage 후** 돌릴 것.

### ④ 파일을 가르면 **경로를 하드코딩한 가드가 깨진다** (3종 발견)
`repair-schema.routes.ts` → `repair-schema/column-repairs.ts` 분리에서:
- `check-product-detail-fields-repairable` — 등록분 69개를 **0개로** 봤다(RED, 눈에 띔)
- `point-credit-ledger-row.test` — 확장 컬럼 검사 실패(RED, 눈에 띔)
- `check-migration-repair-drift` — **조용한 오답.** 새 컬럼은 거의 항상 분리된 쪽에 들어가므로
  "이번 커밋에 repair 반영 없음"을 **영원히** 말했을 것이다. 빨강이 안 떠서 안 보인다

⇒ **경로 하드코딩 가드는 코드 이동에 약하고, 약해지는 방향이 항상 눈에 띄지도 않는다.**

### ⑤ 되돌려-검증에서 **내 규칙 자체가 틀렸다**
`column-repairs` 매니페스트 가드에 "항목은 한 줄"이라고 썼다. 이 파일엔 여러 줄 `CREATE TABLE` 템플릿이
25개 있다 — 그건 로직이 아니라 그냥 긴 SQL 이다. 진짜 신호는 줄 수가 아니라 **보간(`${}`)** 이었다.
그리고 배열 본문만 검사해서 **헬퍼를 선언 위에 심으면 초록**이었다. 파일 전체를 보게 고쳤다.

### ⑥ `/api/admin/ops-status` 응답을 오독하고 회귀를 보고할 뻔했다
main 이 엔드포인트 모양을 바꿨는데(gates/cron_health) 옛 필드(active_products)를 찾다가 없다고 판단했다.
**파싱 실패를 데이터 부재로 읽지 말 것** — raw body 를 먼저 볼 것.

---

## 4. 남은 결정 / 대기 항목

### 대표 판단 필요
1. **어긋난 4명의 잔액 교정** — 합 −16,380딜. 세션은 **손대지 않았다**. 머니 교정은 사람 판단.
   - user 3(정지원, −22,480) · 24(디스크프리, +100) = **대표 계정**
   - user 32(소싱스타트 최수정M) · 33(류한울) = 각 +3,000, **가입 보너스**
   - **고객 피해 건 없음**
2. **user 24 의 100딜 경로 미확정** — 성격만 좁혔다(아래 §6). 소액이라 더 파지 않았다.
3. **가입 보너스를 다시 켤지** — 지금은 0. 켜려면 `platform_settings.signup_bonus_amount`.

### 세션이 못 하는 것 (권한 밖)
1. **구글 AI 검색 노출** — Cloudflare **Managed robots.txt** 가 레포 robots.txt 를 통째로 대체하면서
   `Google-Extended: Disallow: /` 를 앞에 붙이고 있다(GPTBot·ClaudeBot·CCBot 등도 함께).
   **데이터 문제가 아니다** — Organization JSON-LD 는 홈에 이미 정상이다.
   → 대시보드 **AI Crawl Control** 에서 `Google-Extended` 를 Allow 로. 대표만 가능.
   ⚠️ `platform_settings.cf_api_token` 은 **죽어 있다**(`/user/tokens/verify` → Invalid API Token).
   CF API 를 쓰려는 세션은 **verify 부터** 할 것.
2. **`/admin/social` 실제 발행** — 초안 생성은 이제 앤트로픽 없이 돌지만, 발행에는 플랫폼 액세스 토큰 +
   `SOCIAL_*_ENABLED` 가 필요하다(OAuth 라 세션이 못 함).

### 운영 메모
데모 상품 9개(id 1,2,3,4,5,17,19,20,21 — `seller_id` null + unsplash)를 어드민 일괄작업으로
`is_active=0` 처리했다(**가역**). 소비자 카탈로그 15 → 실상품 6.

---

## 5. 새로 생긴 가드 (다음 세션이 믿어도 되는 것)

| 가드 | 막는 것 | 못 막는 것 |
|---|---|---|
| `check-balance-without-ledger` | 잔액을 ± 하면서 원장 미기록·삼킴. **자리 단위** 판정(#940) | 잔액 변동과 기록이 **다른 파일**로 나뉜 경우 |
| `point-credit-ledger-row.test`(17) | 빈 catch 부활 · 폴백 부재 · 확장 컬럼 미등록 · 보너스 재활성 · 추천보너스 dedup 키 | 테이블 자체 부재(repair-schema 소관) |
| `repair-schema-manifest.test`(6) | 크기 면제받은 매니페스트에 로직 유입 | SQL 이 **맞는지**는 안 본다 |
| `favicon-serving.test`(24) | 선언/파일/`_routes.json` 3자 어긋남 | 아이콘이 **예쁜지**는 안 본다 |
| `policy-dashboard-sync.test`(13) | policy.ts 그룹이 대시보드에서 누락 | 값이 **옳은지**는 안 본다 |
| `social-compose.test`(11) | 216조합의 금칙어·단조로움·플랫폼 한도 | 사람이 읽었을 때 **좋은 글인지**는 안 본다 |

`check-guard-mutations` 매니페스트는 현재 **15개**(main 과 충돌 시 **union 이 정답** — 한쪽을 버리면
그 가드가 검증 밖으로 나간다). **CI 가 매번 대신 깨뜨린다.** 새 가드를 만들면 여기 한 줄 추가할 것.

---

## 6. 후속 (같은 세션, `#940`) — 가드가 못 본 모양이 있었다

### user 24 의 100딜 — 성격은 좁혔고, 경로는 여전히 미확정

실측: `tobe211@naver.com`(대표 계정) · **가입 2026-03-11** · 주문 0 · 결제 0 · 리뷰 0 · 거래기록 0.
가입 보너스 아님(그 코드는 07-29 신설) · 어드민 딜 선물 아님(05-25 신설) · 구매/리뷰 보상 아님(전부 0).

⚠️ **왜 더 못 밝혔는지가 중요하다**: 이 컨테이너의 클론이 **2026-07-29부터**라 3월 코드를 볼 수 없다.
같은 한계를 다음 세션도 만난다 — 옛 코드 경로를 추적해야 하면 **먼저 `git log | tail` 로 히스토리
깊이부터 확인**할 것. 얕으면 추측하지 말고 미확정으로 두는 게 맞다.

**재발 경로는 아니다**: 지금 딜을 주는 경로는 전부 `creditFreePoints`(#928 에서 수리)를 지난다 —
대표가 어드민에서 주는 `gift-deal` 도 그 함수를 쓴다.

### 새로 나온 결함 — `#928` 의 가드가 자기 사각지대에 걸렸다

`group-buy.routes.ts` 공구 추천 보너스(양쪽 0.5%)가 잔액을 올린 뒤 원장 INSERT 를
`.catch(swallow('...'))` 로 삼키고 있었다. **`#928` 가드가 못 잡았다** — SWALLOW 패턴을
`() => null` / `() => {}` 두 모양만 알았는데, 이 레포가 제일 많이 쓰는 건 named helper `swallow(...)` 다.

**단순 불일치보다 나쁘다**: 중복 방지(`alreadyRewarded`)가 **그 원장 행을** `description LIKE
'%from:REF%'` 로 읽는다 ⇒ 행이 없으면 같은 (추천인, 참여자) 조합이 **매번 다시 보상**받는다.

⚠️ **지금 터지는 중은 아니다.** `points_amount` 는 프로덕션에 존재함을 확인했다(원장 조회 쿼리가
그 컬럼을 쓰는데 200). 나머지 3개는 읽기 전용 API 로 확인 못 했다 → **잠복**이고, 컬럼 드리프트
창에서 터진다. 08-01 에 3,000딜 2건을 만든 바로 그 창.

**수리**: 두 INSERT 에 최소 컬럼 폴백(description 유지 — 그게 dedup 키다) + 블록을
`referral-bonus.ts` 로 추출(잔액·원장·중복방지 한 세트).

### 이번에도 틀렸던 것 (§3 에 이어서)

7. **가드를 조이다가 정상 코드를 빨간불로 만들었다.** 파일 단위 → 자리 단위로 조였더니
   `ledger.ts`·`internal-admin-tools` 가 걸렸는데, 둘 다 **이미 최소 컬럼**이라 드리프트로 깨질 수가
   없다. 폴백을 요구할 이유가 없었다 → 최소 컬럼 INSERT 면제 추가.
   **조이는 것과 정확한 것은 다르다** — 조이기만 하면 다음 사람이 가드를 끄게 된다.
8. **머지 충돌을 한쪽만 남길 뻔했다.** 변이 매니페스트 끝에 main 과 내가 각자 항목을 추가했다.
   **union 이 정답**이다(한쪽을 버리면 그 가드가 검증 밖으로 나간다) — 15개로 합치고 15/15 재확인.

### 🐛 테스트가 내 리팩토링을 잡았다

라우트 앵커로 추천 보너스 블록을 자르던 검사가 추출 직후 **"블록을 못 찾았다"로 터졌다**.
"측정 0 이면 통과가 아니라 실패"로 만들어 둔 게 실제로 값을 했다 — 조용히 통과했으면 그 뒤로
그 불변식은 아무것도 안 지키는 채로 남았을 것이다.

### 배포 후 실측 (2026-08-02 09:5x KST)

| 확인 | 결과 |
|---|---|
| 원장 불일치 | `total: 4` — 기존 4명 그대로, **신규 0** |
| `ledger-integrity-check` cron | 08-02 03:01 KST · ok · stale 아님 (관측 루프 살아 있음) |
| `signup_bonus_amount` | 미설정 → 기본 0 → 지급 안 함 |

가드 총계 **81** · 변이 매니페스트 **15**.
