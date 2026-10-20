# 최종 감사 라운드 — 가입·탈퇴 엣지 + 어드민 RBAC + PIPA 정합 (2026-07-12)

> 대표 지시 "전수조사 마지막 라운드"의 read-only 결과 박제. 3축 병렬 감사(가입·탈퇴 엣지케이스 / 어드민 권한 매트릭스 / PIPA 개인정보 정합). **코드 사실만 — 법적 판단 아님.** 앞선 감사 2건(`pre-flip-risk-audit-2026-07.md` 5문, `pre-launch-security-audit-2026-07.md` 6문)과 R3 2FA 기머지분과 중복 배제. 성능 스냅샷(②)은 8월 인앱 QA, 인프라 한도(③)는 대표 대시보드 액션으로 분리됨.

## 수리 트랙 분류

| 트랙 | 성격 | 항목 |
|---|---|---|
| **① 즉시 수리(비-머니)** | 명확한 버그/방어공백, 머니계산 무접촉 | A email NULL 덮어쓰기 · C 복원 파손 · D GET-mutation DDL · E commission-settings ops 갭 · F RBAC fail-closed 통일 · G fail-open 역할기본값 · H 탈퇴세션 deleted_at 미확인 · I 무인증 탈퇴이력 조회 · J Sentry 헤더 스크러빙 |
| **② 머니 경로(8월/신중)** | 딜/커미션/정산 접촉 — 8월 머니 세션 | 탈퇴→재가입 3000딜 루프 · 유상딜 무고지 소멸 · holding/pending 커미션 죽은계정 적립 · referral 'cancelled' CHECK 위반 · 복수계정 초대/가입보너스 우회 · admin 역할 머니액션 비대칭 |
| **③ 법무 트랙** | 전금법 의뢰서 + PIPA + 위치정보 병합 | 제3자/위탁 고지 불일치 · GPS 동의/파기 · 간주동의 유효성+소급 · 로그 보유기간 · 만14세 증적 · 평문 PII 암호화 · biz-cert 공개버킷 |

---

## 1. 가입·탈퇴 엣지케이스

### 카카오 email 미제공 (정상 — 사고 없음)
- `users.email` NOT NULL 아님(`0001_initial_schema.sql:48`). 미동의면 NULL 저장(`KakaoAuthService.ts:171,433`). handle 은 첫 핀 추가 시 이름 seed lazy 발급(email 무관, `curator.routes.ts:441`). takeover 검사는 `if(kakaoUser.email)` 게이트 안이라 자연 스킵(안전).
- same-email 셀러 자동연결: email NULL 이면 진입 자체 스킵 + `LOWER(email)=LOWER(?)` 라 NULL=NULL 사고 불가. **단 무알림 스킵** → 수동경로(셀러가입/`link-kakao`/어드민)로만 연결.
- **[① A · 데이터소실]** 동의 철회 후 재로그인 시 기존 UPDATE 가 `email = ?`(`:348`)라 **기존 email 이 NULL 로 덮임**(phone 은 `COALESCE(phone,?)` 보존인데 email 만 비대칭). 수리: `email = COALESCE(?, email)` 1줄.

### 탈퇴 → 재가입
- 탈퇴 = soft delete + 익명화(`delete-account.service.ts:194-249`), `deleted_accounts` 30일 보존(`reregister_available_at=+30일`).
- **[② · 머니]** 딜 잔액 유상 포함 전액 소멸(`zeroOutUserPoints`→`point-ledger.ts:190`), 환급/고지 없음 → 약관 제12조(유상 환급 가능) 불일치.
- **[② · 머니]** `referral_commissions` `granted→'cancelled'`(`:141-147`) 시도가 CHECK 허용값(`pending/granted/withdrawal_requested/paid_out/withdrawn`, `referral-tree.routes.ts:68`)에 없어 **throw→catch swallow = 실제 취소 안 됨**(2026-05-17 youtube 패턴 재발). + `pending`/`holding` 커미션 미처리 → 확정 cron 이 `deleted_at` 미확인으로 죽은 계정에 뒤늦게 적립(`adjustUserPoints` UPSERT 가 zero 처리분 부활).
- **[① C · 기능파손]** "이전 계정 복원": 재가입 새 행이 raw kakao_id 선점 → `restoreUser` 가 옛 행에 `SET kakao_id=raw`(`:330-343`) → UNIQUE 위반 → catch → `{success:false}` = **항상 실패**. 중복 새 행 삭제 로직 부재.
- **[① H · 세션]** 탈퇴 응답이 해당 브라우저 쿠키만 무효화(`account.routes.ts:143`), auth 미들웨어가 `deleted_at` 미확인 → **타 기기 30일 JWT 계속 유효**.
- 데이터 고아: `vouchers`/`stay_bookings`/진행주문 탈퇴서비스에 grep 0건. hard purge cron 은 `deleted_accounts` 행만 삭제(`scheduled-cleanup.ts:856`) → 익명화 users 행·고아 영구 잔존("30일 후 영구삭제" 고지 미이행).

### 복수계정 자기추천 우회
- self 차단 전부 user_id 동일성만(`affiliate-credit.ts:139,416` · `referral-tree.routes.ts:226,500`). **2차 동일인 탐지(이메일/전화/기기) 0건**(fingerprint/device_id grep 0). IP 가드는 affiliate 24h 3건뿐, invite-reward·트리 커미션엔 그조차 없음.
- **[② · 머니]** 가입보너스 3000딜 dedup 이 `user_id` 기준(`signup-bonus.ts:26`) → **탈퇴→재가입 루프로 카카오 1개도 무한 반복**. free bucket 이라 출금은 막히나 결제 free 우선소진으로 현금성 누수. 초대보상 1000딜 = pair-UNIQUE 뿐(N계정 N회), 월예산 캡 **기본 미설정=무제한**(`invite-reward.ts:79`).

---

## 2. 어드민 RBAC 권한 매트릭스 (R3 2FA 기머지분 제외)

- 역할 SSOT 2군데 불일치: `admin-roles.ts:21`(7종) vs `auth.ts:508`(`requireAdminRole` 타입 4종 — admin/viewer/wholesale 누락).
- **[① G · fail-open]** `normalizeAdminRole` 미지값→**super**(`admin-roles.ts:30`) · `requireAdminRole` role NULL→**super**(`auth.ts:529,544`). role 손상/NULL 레거시 row = 사실상 전권.
- **[① E · 갭]** ops 가 셀러 수수료율 변경 가능: SENSITIVE 정규식이 `commission-settings` 미매칭(`admin-roles.ts:115`) + seg=`sellers`가 ops WRITE_DOMAINS → `internal-admin-tools.routes.ts:983` `requireAdmin()`만. 자매 `/sellers/:id/commission` 은 finance 전용이라 명백한 비대칭.
- **[① D · GET-mutation]** `GET /api/admin/optimize-db`(DDL 실행, `internal-admin-tools.routes.ts:779`) — viewer 포함 전 역할. 읽기전용 불변식 위반(피해 낮음, idempotent).
- **[① F · fail-open]** `admin-rbac.ts:65` 쿠키경로 role 조회 실패 `catch→null→next` = **D1 일시오류 창에서 role 스코핑 소멸**(라우트 `requireAdmin()`만 남음). `requireAdminRole`(fail-closed)과 정반대. 라우트게이트 없이 전역미들웨어만 의존하는 엔드포인트(셀러승인/commission-settings/gift-deal/payout-center/user status)가 노출.
- **[② · 머니거버넌스]** `admin` 역할 머니액션 비대칭: payout **생성/취소**·payout-center 입금완료·gift-deal·tools 정산일괄·인플 payout 은 admin 실행 가능한데, payout **승인/송금/정산**은 finance 전용 → 일관성 없는 재무분리. (정책 결정: admin 유지 vs finance 승격.)
- Bearer JWT role-claim staleness: Bearer 경로는 DB 재확인 안 함(`admin-rbac.ts:50`), 역할 변경 시 `min_valid_iat` bump 안 함 → 강등해도 기존 토큰 만료까지 구권한. 쿠키경로(매요청 DB)와 비대칭.
- 서비스 분리(도매/에이전시/셀러)·권한상승(super only 역할부여) 정상. 토큰형 백도어(`BOOTSTRAP_TOKEN`/`INTERNAL_API_TOKEN`)는 시크릿 관리 이슈.

---

## 3. PIPA 개인정보 정합 (③ 법무 트랙)

- **간주동의**: 카카오 신규가입(주경로) UI 체크 없이 서버가 service+privacy 1회 기록(`kakao.routes.ts:777`), 고지는 LoginPage 문구. **2026-07-05 이전 기존회원 동의증적 무기록**(간주동의 블록 `isNewUser`만 진입). `marketing`/`location` 은 카카오 경로 전혀 미기록.
- **[① I · PII 노출]** 무인증 엔드포인트: `GET /api/account/check-restriction?email=`(탈퇴이력 여부), `GET /api/account/restorable?kakao_id=`(`original_name` 반환) — `account.routes.ts:176-221`.
- **[① J · PII 유출]** Sentry 전송에 **Cookie/Authorization 포함 전체 헤더 + IP + 이메일** 스크러빙 없음(`sentry.ts:177-201`). D1 request_traces 는 마스킹 있는데 Sentry 만 없음.
- **제3자/위탁 고지 불일치**: 실제 반출 9곳+(KT알파·알리고·카카오·Toss·바로빌·Mailgun·Sentry·NTS·CF AI) vs 처리방침 기재 2곳(토스·CF, `PrivacyPolicyPage.tsx:235`).
- **위치정보(R5 재확인)**: location 동의 UI/기록 0건 상태로 GPS 수집·전송·`voucher_redemptions` 원시좌표 영구저장·파기 cron 없음.
- **암호화 공백**: 계좌번호·전화·주소 평문(`encryptAtRest`는 토큰/키만), KEK 미설정 시 평문 폴백. biz-cert 공개버킷 무인증 서빙(`/api/media/:key` prefix 검사만) — TECHNICAL_DEBT 기록됨.
- **파기 공백**: alimtalk 로그(전화+본문)·GPS좌표·audit로그 무기한. 탈퇴 후 원본 kakao_id prefix 무기한 잔존 + 카카오 토큰 컬럼 미삭제(`delete-account.service.ts:204-208` 세트목록 누락).
- **아동**: 만14세 확인이 이메일가입 클라 체크뿐(서버 `age_confirmed` 미저장 `users.routes.ts:79`), 카카오 경로 없음, 법정대리인 절차 grep 0건.
- **열람권**: 본인 열람/정정 있으나 다운로드(이동권)·어드민 조회(READ)로그 부재(자동로깅 POST/PUT/PATCH/DELETE만).

---

## 후속 트래킹

| 항목 | 트랙 | 상태 |
|---|---|---|
| ① A·C·D·E·F·G·I·J (비-머니 버그/방어 8건) | 즉시 수리 | ✅ 구현·커밋(2026-07-12, 대표 "모두 진행") |
| ① H 탈퇴세션 타기기 무효화 | 즉시 수리이나 **설계 필요** | ⏸ 소비자 세션이 무상태 JWT(로딩최적화 잠금) — 매 요청 `deleted_at` 조회는 퍼포 회귀. 소비자 세션 리보케이션(users.session_epoch bump+검증) 설계 후 별도. |
| ② 3000딜 재가입 루프 | 머니(승인받아 선반영) | ✅ 구현·커밋(2026-07-12, kakao_id 영구 dedup) |
| ② 유상딜 소멸·죽은계정 적립·CHECK위반·복수계정·admin 머니비대칭 | 8월 머니 세션 | 박제 |
| ③ PIPA(고지 불일치·간주동의·파기·아동·평문PII) + 위치정보 | 법무 의뢰 병합 | ⏳ |
| 성능 스냅샷(Lighthouse 3페이지) | 8월 인앱 QA | 분리 |
| 인프라 한도(CF 플랜·D1/R2) | 대표 대시보드 | 분리 |

### 구현 로그 (2026-07-12)
- **A** `KakaoAuthService.ts` — 로그인 시 email `= COALESCE(?, email)`(동의 철회 시 NULL 덮어쓰기 방지, phone 패턴과 통일). 메인+최소 fallback UPDATE 2곳.
- **C** `delete-account.service.ts restoreUser`(+`account.routes /restore`) — 복원 전 신규 중복 row 의 kakao_id 소프트-폐기(`restored_dup_*`)로 UNIQUE 충돌 제거 → 복원 UPDATE 성공. 프론트는 /login 재로그인으로 옛 row 매칭.
- **D** `admin-rbac.ts` — `optimize-db`(GET+DDL)를 읽기 예외에서 제외 → viewer/제한역할 403(super/admin 만).
- **E** `admin-roles.ts` SENSITIVE 패턴 `commission(?:-settings)?` 확장 → ops 의 셀러 수수료율 변경 갭 차단(finance 전용).
- **F** `admin-rbac.ts` 쿠키경로 role 조회 DB 오류 → 재시도+fail-CLOSED(viewer). fail-OPEN 제거(requireAdminRole 정책과 통일).
- **G** `admin-roles.ts normalizeAdminRole` — 미지/손상 non-empty role → viewer(fail-CLOSED). 빈값/NULL(레거시 원조 super)은 super 유지(락아웃 방지).
- **I** `account.routes.ts` — `/restorable` requireAuth+본인 kakao_id 검증(타인 실명 열거 차단)+rate limit, `/check-restriction` rate limit.
- **J** `sentry.ts` — Cookie/Authorization 등 민감 헤더 `[redacted]` 스크러빙.
- **②** `signup-bonus.ts`(+`kakao.routes.ts` 호출부) — kakaoId 기준 영구 dedup(익명화 `deleted_%_<id>` 매칭)로 탈퇴→재가입 3000딜 루프 차단. 금액(3000) 불변 = 계산 무변경, dedup 키만 추가(머니룰 #3).
- 검증: tsc 0(touched)·money-pattern 0·sql-bind/column/table 0·file-size(changed) skip. 머니계산 파일(payment/toss/fee-resolver/commission-budget/refund) diff 0.
- ⚠️ 이 환경 npm 403 으로 build/vitest 미실행 — CI(verify.yml) + staging 검증 권장: (C) 탈퇴→즉시재가입→복원 클릭→옛 이력 복귀, (②) 탈퇴→재가입 시 보너스 미지급(bonus 파라미터 없음), (F) 제한역할 쿠키 로그인 정상 스코핑.
