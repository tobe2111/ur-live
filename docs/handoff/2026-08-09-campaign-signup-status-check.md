# 2026-08-09 — 캠페인 신청 페이지(방배) + 현황 확인 5건

## 이 세션이 한 일

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
