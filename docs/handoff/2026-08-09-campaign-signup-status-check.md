# 2026-08-09 — 캠페인 신청 페이지(방배) + 현황 확인 5건 + A-3/A-4 후속

## 🔴 최우선 — worker gzip 이 Cloudflare Free 한도 코앞이다 (대표 결정 필요)

**#1113 머지 직후 main 배포가 실패했다.** Verify(PR CI)는 통과했는데 **배포 워크플로에만 있는
worker 크기 게이트**에서 막혔다 — 즉 **PR 이 초록이어도 배포는 막힐 수 있다**(게이트 위치가 다르다).

```
_worker.js 4,050KB (비압축) / gzip 999KB ≈ 1,023,000B
게이트(조기 경보선) 1,020,000B  ← 여기서 실패
Cloudflare Free 실한도 1,048,576B (1MiB) ← 아직 ~25KB 남음
```

**한 번 넘으면 내 변경뿐 아니라 이후 모든 머지의 배포가 같이 막힌다.** 그래서 즉시 조치로
게이트를 **1,032,000B** 로 올려 배포를 풀었다(`.github/workflows/main.yml`). 실한도까지 남은 여유 **~16KB**.

⚠️ **이것이 마지막 상향이다** — 다음에 또 넘으면 경보선이 실한도와 겹쳐 조기 경보 기능이 사라진다.
그 전에 **대표가 둘 중 하나를 결정**해야 한다:
- **(a) Workers Paid 전환** → gzip 한도 10MB. 이 문제 영구 소멸(비용 발생).
- **(b) worker 다이어트** — 최대 후보는 **가이드/블로그 시드 산문**: `guide-seed-admin/seller/agency.ts`
  + `blog-seed.ts` 합계 **~3,300줄의 한국어 본문**이 워커 번들에 상주하는데, 실제로는 **시드 버전이
  오를 때만** 쓰인다. R2/정적 JSON 으로 빼면 큰 폭 감축 가능(측정 필요 — 이 환경은 npm 403 로 빌드 불가).

> 🧭 다음 세션 주의: **worker 코드를 늘리는 작업은 위 결정 전까지 사실상 불가**다.
> 새 라우트/유틸을 워커에 얹기 전에 이 절을 먼저 읽을 것.

## ✅ 머지 완료 — PR #1113 → main `a87dc16` (2026-08-10, 사용자 "머지까지 완료해줘")

CI 전부 green(Verify 5,300+ · smoke · Pages) 확인 후 squash 머지. 배포는 main.yml 이 자동 수행.

> 🧯 **머지 때 걸린 것**: GitHub **GraphQL 쿼터만** 소진(REST 는 14,989 남음)이라
> `update_pull_request`(draft 해제)가 막혔다. **draft→ready 전환은 GraphQL 전용**이라 REST 우회가 없다.
> 판정: `curl https://api.github.com/rate_limit` 의 `resources.graphql.remaining` — 0 이면 `reset`(epoch)
> 까지 기다리는 것 말고 방법이 없다(이번엔 5분). ⚠️ 이때 **main 에 직접 push 로 우회하지 말 것** —
> PR 경로를 벗어나면 CI 게이트가 통째로 빠진다.

### 3차 (같은 세션 후속) — 알림톡 재시도 큐 결함 수리
`sendBusinessRegistrationAlimtalk`(admin-sellers.routes.ts)만 `lib/aligo` 를 **직접** 호출해
공용 헬퍼(`sendSystemAlimtalk`)를 우회 → **발송 실패가 `alimtalk_failures` 큐에 안 들어가**
`retry-alimtalk` cron 이 못 잡았다(승인/반려 통보 영구 소실). 발송 호출만 헬퍼 경유로 교체.
- 함께 얻음: dedup·rate-limit(phone+template 1h)·일일 비용 cap·발송 로그.
- ⚠️ **감수한 부작용**: 1시간 내 재반려는 알림톡이 skip 된다. 두 경로 모두 위에서
  `createDashboardNotification` 을 하므로 통보 채널이 0 이 되지는 않는다(그래서 감수 가능하다고 판단).
- 문안·tpl_code **byte-불변**(카카오 승인 본문 글자 일치 요구).

### 손대지 않기로 한 것 (판단 근거)
`admin-notification-settings` 시드 목록에 `seller_reactivated`·`business_registration_*` 가 없다.
**추가하지 않았다** — 그 발송 경로들은 `dispatchNotification`(설정 테이블을 읽는 쪽)이 아니라
`sendSystemAlimtalk` 을 직접 부른다. 행만 넣으면 **눌러도 아무 일도 안 하는 토글**이 생겨
지금의 "없음"보다 나쁘다. 고치려면 그 발송들을 `dispatchNotification` 으로 옮기는 게 먼저다
(`seller_approved` 행이 이미 그 상태 — 선재 불일치).

## 2차 지시 (같은 세션 후속 — 사용자 "A-1·A-2 보류, A-3 개선, A-4 다 하자")

### A-3 유입 트래킹 개선
- `ProductDetailPage` 의 인라인 ref 저장(중복 구현 — inflow 미발사·숫자검증/본인링크 skip 누락)을
  `storeAffiliateRef`(SSOT)로 통일. 이제 상품 상세 `?ref/?aff` 도 inflow_clicks 적재.

### A-4 상인회 SaaS 갭 마감 (전부 몰 레일 — 머니 무접촉)
1. **몰 상품 OG**: `buildMallProductMeta`(mall-ssr-meta.ts 신설 헬퍼)를 워커 PRODUCT 슬롯에 배선
   — 몰 상품(`mall_id>1`, `consumer_path=1` 잠금) 카톡 공유가 몰 이름·공구가·마감일 카드로.
   실패/본진은 기존 `buildProductMeta` 폴백(fail-closed). 배선 불변식 4건을 `mall-ssr-meta.test.ts` 에 추가.
2. **몰별 GA4/네이버**: `wholesale_malls.ga_id`/`naver_verification` 컬럼(ensure+repair-schema 미러)
   + 어드민 폼(고급 설정 "마케팅·고지" 절) + `MallHomePage` gtag 추가 config + MALL 슬롯 head 에
   `naver-site-verification` 메타 **추가**(전역 메타 보존). ⚠️ 네이버 등록은 도메인 단위라 경로 몰에선
   참고용 — 커스텀 도메인 연결 시 유효(어드민 폼에 명시).
3. **몰 팝업/공지 배너**: `mall_notices` 테이블 + 어드민 CRUD(`/api/admin/wholesale-malls/:id/notices`,
   requireSuperAdmin) + 어드민 목록 행 "공지" 패널(`MallNoticesPanel`) + `MallHomePage` 렌더
   (banner=상단 띠 / popup=모달, "다시 안 보기" localStorage id별 영구, z-10500 표준).
4. **몰 방문자 고지문(전자동의 축의 고지 절반)**: `wholesale_malls.privacy_md` + 어드민 폼 +
   몰 푸터 "이용·개인정보 안내" 모달. ⚠️ 방문자 **동의 수집**(체크박스+증적)은 몰에 동의를 받을
   행위(주문/신청)가 소비자 결제 레일에 있어 이번 범위 밖 — 필요해지면 캠페인 신청 폼 패턴 재사용.

### A-4 에서 코드로 안 되는 것 (대표/운영 몫)
- SSL 커스텀 도메인: DNS·CF 설정(코드 밖 — operator-mall-saas-gap.md §호스트).
- 몰별 GA 는 상인회가 자기 GA4 속성을 만들고 측정 ID 를 어드민에 입력해야 작동.
- 몰 페이지 sitemap 등재는 **의도적 제외 유지**(색인 누수 방지 — 기존 결정 존중, 뒤집으려면 별도 판단).

### 이번에 틀릴 뻔한 판단 (2차)
- `buildMallMeta` 를 워커에 인라인 배선했다가 file-size 래칫(+52줄)에 걸림 → 헬퍼로 추출(+21줄로 축소
  후 rebaseline). **잠금 파일에 새 로직은 처음부터 헬퍼로** — DETAIL/PRODUCT 메타가 이미 그 패턴이다.
- `buildMallMeta` 의 "URL 이 가리키는 몰" 전제는 `/{slug}/...` 상품 URL 을 상정했지만 실제 몰 카드는
  `/products/:id` 로 링크 — 몰 판정을 payload `mall_id` 기반으로 재해석(스코프 검증은 동일하게 유지).

## 이 세션이 한 일 (1차 — 캠페인 신청)

### 1. 캠페인 신청 페이지 (B — 신규 구현, draft PR)
방배 캠페인 인플루언서 모집: **신청 = 유어딜 인플루언서 파트너 등록**.

- `src/shared/campaign-signup.ts` — 캠페인 레지스트리 SSOT(`bangbae` 등록, `active` 로 접수 종료 제어),
  택소노미(influencer-apply 와 글자 동일 — 유닛테스트가 파일을 읽어 대조), ref 링크 빌더.
- `src/features/marketing/api/campaign-apply.routes.ts` — `POST /api/campaign/:code/apply`(requireAuth +
  rate-limit): `campaign_applications` upsert(UNIQUE(campaign_code,user_id) 멱등, 동의시각 최초값 보존)
  + `ad_influencer_leads` 인바운드 upsert·리드↔유저 연결(fail-soft — 유어애즈 풀에도 잡히게).
  `GET /:code/me` 재방문 복원. **머니 무접촉**(결제·정산·적립 0).
- `src/pages/CampaignApplyPage.tsx` — `/campaign/:code`. 비로그인=카카오 CTA(returnUrl 경로 —
  쿼리는 OAuth 왕복에서 잘리므로 코드를 **경로**로), 프로필(계정URL·플랫폼·카테고리·활동지역·
  팔로워규모·희망 협업 조건·연락처) + **동의 2종 필수**(개인정보 수집·이용 / 마케팅·안내 수신),
  완료 화면 = ref 링크 즉시 표시(`urdeal.kr/?ref={users.id}&c={code}`) + "선정 무관 파트너 등록·
  다음 캠페인 우선 안내" 문구.
- 어드민: `/admin/campaign-applications`(캠페인 코드 필터 + CSV — 수식 인젝션 가드) —
  `admin-campaign-applications.routes.ts` + `AdminCampaignApplicationsPage.tsx` + 네비(유어애즈 절).
- 게이트: `CAMPAIGN_SIGNUP_ENABLED`(feature-flags, true) — 이 라우트만 가림, 기존 가입 무접촉.
- **유입 트래킹 갭 마감**: 루트 `?ref=` 가 inflow_clicks 에 안 남던 것(어필리에이트 share_url 도
  같은 갭) → App.tsx 전역 `captureInflowRef`(유입 기록만 — affiliate_ref 구매귀속은 종전과 동일,
  머니 무접촉) + `affiliate-track.ts` 가 `?c=` 캠페인 코드를 `inflow_clicks.campaign` 에 태움
  (컬럼·서버 파라미터는 07-13부터 있었으나 클라가 안 보내 항상 NULL 이던 것).
- 검증: audit-gate **ALL GREEN 88** · 순수모듈 tsc 0 + 런타임 해네스 OK · 테스트파일 스텁 타입체크 0 ·
  ⚠️ 이 세션 npm 403(node_modules 0) — vitest/전체 tsc/build 는 **CI 판정**.
  file-size 래칫은 배선 성장(App/worker/admin.routes)만큼 rebaseline.

### 2. 알림톡 1코드 2문안 (C — 확인 결과: **이미 완료**)
- `seller_approved`/`seller_reactivated` · `business_registration_verified`/`business_registration_rejected`
  분리는 **2026-07-01 완료**(admin-sellers.routes.ts:495-507, :903-907). 이번엔 문서 함정 1건만 수정:
  `docs/kakao-alimtalk-templates.md` 콘솔 절차에 남아있던 **죽은 env `ALIGO_BUSINESS_REGISTRATION_RESULT`**
  → VERIFIED/REJECTED 로 정정(그 이름으로 설정하면 override 무효).
- 남은 것(이번 PR 범위 밖 — 다음 세션 후보): `sendBusinessRegistrationAlimtalk` 가 공용
  `sendSystemAlimtalk` 를 우회해 **실패 시 재시도 큐(alimtalk_failures)에 안 들어감**
  (admin-sellers.routes.ts:924 근방). 콘솔 등록 후 실발송 전에 고칠 가치 있음.

## 이번에 틀릴 뻔한 판단
- `ensureInfluencerSchema` 를 `influencer-schema.ts` 에서 import 하려 했으나 실제 export 는
  `influencer-discovery.ts:573` (에이전트 보고의 파일명을 그대로 믿지 말고 grep 으로 확정할 것).
- `check-file-size` 를 인자 없이 돌리면 "대상 없음 skip" — audit-gate 는 `-a`(전수)로 돌린다.
  단독 실행 초록을 게이트 통과로 오독하지 말 것.

## 다음 세션 첫 액션
1. CI(verify.yml) 녹색 확인 — 특히 vitest `campaign-signup.test.ts` 6건 + tsc(이 환경 npm 403 로 미실행).
2. 배포 후 실측: `/campaign/bangbae` 진입(비로그인 CTA → 카카오 → 폼 → 완료 ref 링크) +
   `urdeal.kr/?ref={id}&c=bangbae` 클릭 → `inflow_clicks` 에 campaign='bangbae' 행 확인
   (D1: `SELECT campaign, COUNT(*) FROM inflow_clicks GROUP BY campaign`).
3. 어드민 `/admin/campaign-applications` 목록 + CSV 다운로드 1회.

## 남은 결정/대기 (대표)
- 제로페이 강제 여부(재단 확인 중) — 답 나오기 전 상권 쿠폰 지급 레일 추가 작업 보류 (사용자 지시).
- [서식2] 전자동의 갈음 제안 — 승인 시 영수증 플로우에 생년월일 + 동의 2종 + 개인별 지급대장 CSV
  구현 필요(현재 셋 다 부재 — 폼·컬럼·CSV 전부 신규. 예상 공수 1세션 이내, 이번 캠페인 신청 폼의
  동의 패턴 재사용 가능).
- ALIGO_SENDER_KEY 발급·env 등록 + 콘솔 템플릿 등록(사용자 행정) — 등록 시 tpl_code 4종을
  **분리된 이름 그대로**(seller_approved/seller_reactivated/business_registration_verified/_rejected).

---

## 2026-08-10 (2차 세션) — 카카오 발송 마진화 + 유캔사인 철수

대표 지시: **"카카오 발송에서 나는 비용 마진을 남기고 싶어"** → 순서대로 진행("모두 순서대로").
중간에 **"유캔사인은 안 써 / 더이상 도매몰은 안 해"** 로 방향 확정.

### 머지된 것
- `#1113` 캠페인 신청 + 상인회 SaaS 갭 + 유입 트래킹 · `#1116` 알림톡 재시도 큐 · `#1117` 배포 게이트
- `#1121` **알림톡 원가 SSOT + 마진 회계** · **유캔사인 제거(446줄)**

### 🔴 내가 틀렸던 것 — "전자계약은 사실상 0건"
서명형(유캔사인)만 보고 판정했다. **자체 약관 승낙형 전자계약이 이미 가동 중**이다
(`terms_consents`/`terms_agreements`: 버전 스탬프(서버 권위)·IP·핵심조항 개별동의·재동의 게이트).
셀러·에이전시·유저 가입이 그걸로 체결된다. 대표가 *"자체적으로 전자계약 만들었지 않아?"* 로 바로잡아 줬다.
⇒ **전자계약을 조사할 땐 "서명형"과 "승낙형"을 둘 다 볼 것.**

### 마진 구조 (현재 상태)
- 원가 = `platform_settings.alimtalk_unit_cost_krw` / `friendtalk_unit_cost_krw` (어드민 조정, 배포 불필요)
- 판매가 = `alimtalk_packages.price` (기존)
- 마진 계산 SSOT = `shared/alimtalk-pricing.ts` (순수함수 + 유닛)
- 어드민 통계 = 매출(충전 원장) − 원가(발송건수×원가) = 마진(%). **종전 '수익'은 원가 미차감 매출이었다**
- 🔴 `POST /api/seller/alimtalk/charge` 무결제 충전 구멍 → 410 폐쇄

### ⚠️ 매출이 0인 진짜 이유는 마진이 아니라 **발송이 꺼져 있다**
ALIGO 3종 키(`ALIGO_API_KEY`/`ALIGO_USER_ID`/`ALIGO_SENDER_KEY`) 미설정 → 전 경로 skip.
과거 `' ALIGO_USER_ID'`(앞 공백) 등록으로 **발송 0건이 정상처럼 보인** 사고 기록도 있다.
**대표 행정 선행**: 발신프로필 등록 → senderkey 발급 → env 3종 설정 → 템플릿 4종 콘솔 등록.

### 2단계 설계 정정 — '몰 크레딧' 새 주체를 만들지 않았다
상인회는 **계정이 없고**(몰=어드민이 만드는 데이터 행, 운영자 로그인 부재) 소속 매장은 **이미
크레딧 주체**다. ⇒ **"상인회가 한 번 결제 → 소속 매장에 배분"** 으로 모델링:
`POST /api/admin/alimtalk/grant`(멱등키=지급 참조, 배분 합계=결제금액 보존). 새 테이블 0.

---

## 2026-08-10 (3차) — 🔴 **"몰 = 상인회" 라고 믿고 작업했다. 틀렸다**

### 이번에 틀렸던 판단 (다음 세션이 반복하지 말 것)

2차 세션 내내 나는 **`wholesale_malls` 멀티-몰 = 상인회 플랫폼**이라고 전제했다. 그 전제로
A-4 갭(GA·네이버 웹마스터·팝업·개인정보 고지)을 `MallHomePage` 에 붙였고(#1113, 머지·배포됨),
"상인회 알림톡 판매"·"상인회 전자계약"·"상인회 운영자 콘솔"을 순서대로 계획했다.

대표가 멈춰 세웠다 — *"도매몰은 공동구매로 변경되었고 상인회는 아예 다른 방향 아니야?"*

**대표가 맞다.** 문서가 이미 그렇게 적고 있었고 내가 안 읽었다:
- `docs/design/pickup-groupbuy-wholesale-link.md` §3 — 도매몰 코드는 세 모드로 재활용.
  **모드 A·B = 공구 서비스**(매장 업주가 자기 몰을 열고 픽업 공구 판매) ← `urdeal.kr/{슬러그}` 몰이 이것.
- `src/pages/admin/wholesale-malls/mall-form.ts:4` — *"지금 이 화면으로 만드는 건 대부분 **공구 몰**"*.
- CLAUDE.md 서비스 분리 절이 **이 혼동을 경고 사례로 이미 박아 뒀다**(2026-08-03 세션이 공구 서비스
  항목을 "유어딜 일"로 보고했다가 대표가 바로잡은 기록). 나는 같은 함정을 다시 밟았다.

🔑 **교훈**: "이건 넷 중 어디인가"(도매 / 유어딜 소비자 / 공구 서비스 / 유어애즈)를 **코드를 쓰기 전에
문서로 확정**할 것. 나는 그걸 *추정*하고 3개 PR 을 진행한 뒤에야 검증했다.
⚠️ 그리고 **표면 이름이 축을 말해 주지 않는다** — `wholesale_malls`·`MallHomePage` 는 도매몰 시절
이름 그대로인데 담는 것은 공구 몰이다.

### 대표 확정 (2026-08-10)
- **상인회는 이 작업 범위에서 제외** ("상인회는 무시해줘 그냥" / "상인회는 상관없어").
  ⇒ 상인회 관련 계획(전자계약·알림톡 판매 대상 등)은 **더 파지 말 것.** 대표가 다시 꺼낼 때까지 중단.
- **`/mall-admin` 은 공구 서비스용으로 완성** ← 이번 세션이 그걸 했다.

### 한 것 — 몰 운영자 콘솔 `/mall-admin` (공구 서비스)
**왜**: 몰은 어드민이 만드는 데이터 행이고 **운영자 로그인이 없었다** — 공지 한 줄도 어드민 대행.
SaaS 로 팔 수 없는 상태였다.

- `src/features/mall/api/mall-admin.routes.ts` — `GET /me` · `POST /agree` · 공지 CRUD.
  **새 인증 체계 0** — 카카오 세션 재사용. `wholesale_malls.operator_user_id` 로 서버가 "내 몰" 확정.
  🔴 **URL 로 몰 id 를 받지 않는다** = 남의 몰을 지목할 파라미터 자체가 없다(IDOR 구조적 차단).
- `src/shared/mall/operator-terms.ts` — 운영자 약관 v1.0(**승낙형 전자계약**, 외부 서명 서비스 없음).
  동의 증적은 셀러/에이전시와 **같은 레일**(`terms_consents`: 버전·IP·주체).
- `src/pages/MallAdminPage.tsx` — 4상태(로그인 / 비운영자 / 약관동의 / 콘솔).
- 어드민: 몰 폼에 **운영자 회원번호** 입력(생성·수정 **양쪽**). 서버가 `users` 실재를 확인해 400.
- 가드: `src/tests/unit/mall-operator-console.test.ts` 8케이스.
  **주입 4건으로 빨강 확인 완료**(mall_id 제거 / 동의 재확인 제거 / URL 몰 id / 머니 테이블 접촉).

#### 설계 판단 2개 (근거 남김)
1. **생성 경로에도 `operator_user_id` 를 받는다.** INSERT 컬럼에서 빼면 어드민이 만들며 입력한 값이
   **에러 없이 사라진다** — 저장된 줄 알고 콘솔을 열면 403 이고 원인이 화면에 안 나타난다.
2. **동의 기록 후 재조회한다.** `recordTermsConsent` 는 fail-soft라 write 실패해도 throw 안 한다.
   그대로 success 를 주면 화면은 "동의 완료"인데 `GET /me` 는 미동의 → **동의 화면 무한 반복**.
   ⇒ 실재 확인 실패 시 `500 CONSENT_NOT_RECORDED`. 증적이 없으면 체결됐다고 말하지 않는다.

#### ⚠️ 코드로 판정 못 하는 것 — 배포 후 스모크 필수
1. 비로그인 `/mall-admin` → 카카오 로그인 화면
2. 운영자 미지정 계정 → 403 "운영 중인 몰이 없습니다"
3. 어드민에서 `test` 몰(id=3)에 본인 `users.id` 지정 → 재진입 시 **약관 화면**
4. 동의 → 콘솔 · **새로고침해도 약관이 다시 안 뜰 것**(위 판단 2 검증)
5. 공지 게시 → `urdeal.kr/test` 상단 띠 반영
6. 다른 계정으로 `PATCH /api/mall-admin/notices/{그 id}` → **404**(몰 스코프 격리)

### 다음 세션 첫 액션
1. 위 스모크 6단계 — 특히 4번(동의 반복)과 6번(격리)은 **런타임에서만** 판정된다.
2. ALIGO 키 설정 여부 확인 → 설정됐으면 실발송 1건 + `alimtalk_logs` 행 확인
3. 어드민 알림톡 단가 화면: 원가 저장 → 마진율 표시 · 일괄 지급 1회(같은 참조 재실행 시 no-op)

### 대표 결정 대기
- **도매몰**: 현행 "비노출 유지" vs "라우트·화면 실제 삭제". `wholesale-teardown-plan.md` 가
  *"제거가 아니라 비노출"* 로 확정해 뒀고 삭제엔 새 지시가 필요하다고 명시. ⚠️ 삭제 시
  `features/supply` **통째 삭제 금지** — 소비자 주문확정·환불·cron 이 그 안의 정산 엔진을 부른다.
- **worker gzip**: 2026-08-10 3차 실측 **1,024,566 B** — 배포 게이트(1,032,000)까지 **7.4KB**,
  실한도(1,048,576)까지 24KB. 게이트는 이미 한 번 상향해 **더 못 올린다.**
  ⇒ 다음 번들 증가는 **Paid 전환** 또는 **시드 산문 외부화** 없이는 배포가 막힌다.
