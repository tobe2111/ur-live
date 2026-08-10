# 2026-08-09 — 캠페인 신청 페이지(방배) + 현황 확인 5건 + A-3/A-4 후속

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
