# 🛠️ 운영 측 액션 가이드 — 2026-05-19

> 코드 작업은 완료. 이 문서의 액션을 순서대로 처리하면 KT Alpha 상품권 정산 + 미디어 업로드 + 비사업자 셀러 정산이 모두 production 에서 동작합니다.
>
> 예상 소요 시간: **약 90분** (KT Alpha 키 발급 대기 시간 제외, 발급은 영업일 2-3일).

---

## 📌 한눈에 보기

| # | 액션 | 어디서 | 소요 | 차단성 |
|---|---|---|---|---|
| 1 | D1 migration 0264 + 0265 적용 | 로컬 PowerShell | 5분 | 🔴 필수 (KT Alpha 동작 안 함) |
| 2 | R2 bucket 'ur-live-media' 생성 + binding | Cloudflare Dashboard | 10분 | 🔴 필수 (사업자등록증 업로드 안 됨) |
| 3 | KT Alpha 상용 Key 신청 | KT Alpha 비즈센터 콘솔 | 30분 + 영업일 2-3일 | 🟡 발송만 차단 (테스트 모드는 가능) |
| 4 | Cloudflare Secret 등록 (KT Alpha 3종) | Cloudflare Dashboard | 5분 | 🔴 KT Alpha 키 받은 후 |
| 5 | platform_settings 초기 설정 | 어드민 페이지 | 5분 | 🟡 |
| 6 | 카탈로그 초기 sync | 어드민 페이지 | 2분 | 🟡 |
| 7 | KV namespace 등록 (rate limiting) | Cloudflare Dashboard | 5분 | 🟢 권장 |
| 8 | ALIGO 알림톡 템플릿 KISA 승인 | ALIGO 콘솔 | 10분 + 영업일 1-2일 | 🟢 알림톡만 |

---

## 1️⃣ D1 migration 적용 (5분)

**왜?** KT Alpha 카탈로그 테이블(`gift_catalog`) + 마진 설정(`platform_settings`) 이 production DB 에 없으면 코드가 500 에러.

### 명령

```powershell
# PC PowerShell — 프로젝트 루트
cd C:\path\to\ur-live

# 1) Cloudflare 로그인 (1회만)
npx wrangler@3 login

# 2) production D1 에 migration 적용
npx wrangler@3 d1 execute toss-live-commerce-db `
  --remote `
  --file=migrations/0264_kt_alpha_gift_catalog.sql

npx wrangler@3 d1 execute toss-live-commerce-db `
  --remote `
  --file=migrations/0265_kt_alpha_markup.sql
```

### 검증

```powershell
# 테이블 존재 확인
npx wrangler@3 d1 execute toss-live-commerce-db `
  --remote `
  --command="SELECT name FROM sqlite_master WHERE type='table' AND name='gift_catalog'"

# 설정 키 존재 확인
npx wrangler@3 d1 execute toss-live-commerce-db `
  --remote `
  --command="SELECT key, value FROM platform_settings WHERE key LIKE 'kt_alpha%'"
```

**기대 결과:** `kt_alpha_markup_pct = 5`, `kt_alpha_user_id = ''`, `kt_alpha_callback_no = ''`, `kt_alpha_biz_money_balance = '0'`.

---

## 2️⃣ R2 bucket 생성 + binding (10분)

**왜?** 셀러가 사업자등록증을 업로드할 때 / 숙소 객실 이미지 / 상품 이미지 등 모두 R2 에 저장. 현재 `MEDIA_BUCKET` binding 미설정 → `/api/upload/image` 가 503 응답.

### 2-1. R2 bucket 생성

1. **Cloudflare Dashboard** → 왼쪽 메뉴 **R2 Object Storage** 클릭
2. **Create bucket** 버튼 클릭
3. Bucket name: **`ur-live-media`** (정확히 이 이름 — 다르면 코드 수정 필요)
4. Location: **Asia-Pacific (APAC)** 선택
5. **Create bucket** 클릭

### 2-2. Pages 프로젝트에 binding 등록

1. Dashboard → **Workers & Pages** → **ur-live** (Pages 프로젝트) 클릭
2. **Settings** 탭 → **Bindings** 섹션
3. **Add binding** → **R2 bucket** 선택
4. Variable name: **`MEDIA_BUCKET`** / Bucket: **`ur-live-media`**
5. **Save** 클릭
6. **Production** + **Preview** 둘 다 등록 (각 환경 별도)

### 2-3. (선택) Custom Domain 연결

이미지 URL 을 `https://media.ur-team.com/...` 형식으로 노출하려면:

1. R2 → `ur-live-media` 클릭 → **Settings** → **Public access**
2. **Connect Domain** → `media.ur-team.com` 입력 → DNS 자동 설정
3. Dashboard → Pages → ur-live → Settings → **Variables and Secrets** →
   `PUBLIC_R2_URL = https://media.ur-team.com` 추가 (Production 환경)

### 검증

다음 배포 후 셀러 로그인 → 사업자등록증 업로드 시도 → 정상 업로드되어야 함.

---

## 3️⃣ KT Alpha 상용 Key 신청 (30분 + 영업일 2-3일)

**왜?** 현재는 dev_flag='Y' (테스트 모드) 만 가능. 실제 상품권 발송하려면 상용 Key 필수.

### 3-1. KT Alpha 비즈센터 가입

1. **https://bizgift.giftishow.co.kr/** 접속
2. **회원가입** → 사업자등록증 + 통신판매업 신고증 첨부
3. 가입 승인 대기 (영업일 1-2일)

### 3-2. 상용 Key 신청 폼 작성

KT Alpha 콘솔 로그인 → **API 관리** → **상용 Key 신청**

다음 정보를 첨부해야 합니다:

| 항목 | 값 |
|---|---|
| 서비스명 | 유어딜 (live.ur-team.com) |
| 서비스 유형 | 라이브 커머스 정산 (셀러 상품권 지급) |
| 일 예상 발송 건수 | 100건 (런칭 초기) → 1000건 (3개월 후) |
| 발송 대상 | 자사 셀러(개인사업자 미등록자) 본인 명의 휴대폰 |
| 보안 조치 | 발송 권한 본인 인증 필수, 발신번호 통합관리 등록 |
| 콜백 URL | https://live.ur-team.com/api/webhooks/kt-alpha (옵션) |

### 3-3. 스크린샷 캡처 (6종 필수 첨부 — KT Alpha 가 "B2B 정산" 증명 요구)

KT Alpha 비즈 API 가이드라인: "최종 소비자가 직접 구매 금지" — 우리는 셀러 정산용임을 증명해야 함.

1. **어드민 페이지 전체**: `https://live.ur-team.com/admin/kt-alpha` 캡처
   - 비즈머니 잔액 카드 + KPI 4종 + 마진율 설정 + 카탈로그 미리보기 모두 나오게
2. **셀러 발송 모달 (동의 강제)**: `/seller/settlements` → '🎁 상품권으로 받기' 클릭 → 모달 캡처
   - 30일 유효기간 + 환불 불가 + B2B 본인 발송 경고 배너 보이게
   - 2개 약관 체크박스 (30일 / B2B) 명시
3. **셀러 발송 이력**: `/seller/voucher-orders` 페이지 캡처 (테스트 발송 1건 이상)
4. **셀러 약관 (KT Alpha 조항)**: `/terms/seller` → "제7조의2" KT Alpha 조항 캡처
5. **공용 이용약관 (직접 판매 안 함)**: `/terms` → "제2조의2 회사가 판매하지 않는 항목" 캡처
6. **테스트 발송 성공 MMS**: dev_flag='Y' 로 본인 폰에 받은 테스트 MMS 캡처

**스크린샷 첨부 시 강조 포인트**:
- 모달의 "본인 명의 휴대폰만 발송 가능 (시스템 강제)" 문구
- 약관의 "회사가 자사 셀러에게 정산금 지급 수단으로" 문구
- 어드민 페이지의 "비즈머니 = 자사 충전" 표기

### 3-4. Key 발급 (영업일 2-3일)

승인 완료 시 KT Alpha 측에서 이메일로 3종 발급:
- `auth_code` (영구)
- `token_key` (영구)
- `auth_token` (영구)

→ 다음 4번 단계로 이동.

---

## 4️⃣ Cloudflare Secret 등록 (5분)

**왜?** Worker 가 KT Alpha API 호출 시 위 3종 키가 환경변수에 있어야 인증.

### 명령

```powershell
# PowerShell 에서 실행 — 입력 프롬프트에 값 붙여넣기
npx wrangler@3 pages secret put KT_ALPHA_AUTH_CODE --project-name=ur-live
# → 발급받은 auth_code 입력 후 Enter

npx wrangler@3 pages secret put KT_ALPHA_TOKEN_KEY --project-name=ur-live
# → token_key 입력 후 Enter

npx wrangler@3 pages secret put KT_ALPHA_AUTH_TOKEN --project-name=ur-live
# → auth_token 입력 후 Enter

# Dev 모드 ON (실제 발송 안 함, 테스트만)
npx wrangler@3 pages secret put KT_ALPHA_DEV_MODE --project-name=ur-live
# → 'Y' 입력 (테스트) 또는 'N' (실제 발송 — 비즈머니 차감!)
```

### 검증

```powershell
npx wrangler@3 pages secret list --project-name=ur-live
```

기대 결과: 위 4개 secret 모두 표시.

### Dashboard 대안 (CLI 안 되면)

1. Dashboard → Workers & Pages → ur-live → **Settings** → **Variables and Secrets**
2. **Encrypt** 체크 → 위 4개 secret 각각 추가
3. **Production** 환경 등록 필수

---

## 5️⃣ platform_settings 초기 설정 (5분)

1. 어드민 계정으로 로그인 → `/admin/kt-alpha` 접속
2. **설정** 섹션에서:
   - **마진율 (markup_pct)**: 기본 5 → 운영 정책에 맞게 조정 (3~10% 권장)
   - **KT Alpha User ID**: KT Alpha 콘솔에서 받은 사용자 ID (비즈머니 잔액 조회에 필요)
   - **발신번호 (callback_no)**: 등록된 발신번호 (010-XXXX-XXXX 형식)
3. **저장** 클릭

---

## 6️⃣ 카탈로그 초기 sync (2분)

1. `/admin/kt-alpha` 페이지 우상단 **'Sync 지금 실행'** 버튼 클릭
2. 진행 표시 → 완료 (약 1~2분, 상품 5000개까지)
3. 페이지 새로고침 → 카탈로그 미리보기에 상품 표시되면 성공

### 자동 sync 동작
- 매일 KST 12:00 (UTC 03:00) 자동 실행
- 비즈머니 잔액도 함께 체크 → 10만원 이하 시 자동 알림

---

## 7️⃣ KV namespace 등록 (rate limiting, 5분 — 권장)

**왜?** 현재 `RATE_LIMIT_KV` 미설정 → 로그인/결제 등 민감 API 일시 429 가능성.

### 명령

```powershell
npx wrangler@3 kv:namespace create RATE_LIMIT_KV
# → 출력에 id 표시. 예: id = "abc123..."

npx wrangler@3 kv:namespace create SESSION_KV
# → 또 다른 id
```

### Dashboard binding 등록

1. Pages → ur-live → Settings → Bindings → **Add binding** → **KV Namespace**
2. Variable: `RATE_LIMIT_KV` / Namespace: 위에서 받은 id 선택
3. 동일하게 `SESSION_KV` 도 등록
4. **Production** + **Preview** 모두 등록

### 검증

```powershell
curl -I https://live.ur-team.com/api/products
# → X-RateLimit-Limit / X-RateLimit-Remaining 헤더 있어야 정상
```

---

## 8️⃣ ALIGO 알림톡 템플릿 KISA 승인 (10분 + 영업일 1-2일 — 권장)

**왜?** 결제완료/배송시작/voucher 발송 등 알림톡으로 보내려면 카카오 KISA 사전승인된 템플릿 필요.

### 필요 템플릿 5종

| 코드 | 사용처 | 본문 (예시) |
|---|---|---|
| `ur_payment_done` | 결제 완료 | "[유어딜] #{상품명} 결제 완료\n주문번호: #{주문번호}" |
| `ur_shipping_start` | 배송 시작 | "[유어딜] 배송 시작 (#{운송장번호})" |
| `ur_voucher_sent` | 상품권 발송 | "[유어딜] 기프티쇼 상품권 발송 완료" |
| `ur_stay_booking` | 숙소 예약 | "[유어딜] #{숙소명} 예약 확정" |
| `ur_settlement` | 정산 완료 | "[유어딜] #{금액}원 정산 완료" |

### 등록 절차

1. **https://smartconsole.aligo.in/** 로그인
2. **알림톡** → **템플릿 관리** → **신규 등록**
3. 위 5종 각각 등록 (변수는 `#{}` 형식)
4. **KISA 심사 신청** → 영업일 1~2일 대기
5. 승인 완료 시 Cloudflare secret 에 `ALIGO_API_KEY` + `ALIGO_USER_ID` + `ALIGO_SENDER_KEY` 등록

---

## ✅ 완료 확인 체크리스트

모든 액션 완료 후:

- [ ] `/admin/kt-alpha` 접속 → 비즈머니 잔액 정상 표시 (0 이상)
- [ ] `/admin/kt-alpha` 카탈로그에 상품 5000개 가까이 표시
- [ ] 셀러 계정으로 `/seller/settlements` → '🎁 상품권으로 받기' 모달 정상 동작
- [ ] dev_flag='Y' 로 본인 폰에 테스트 발송 → MMS 수신 성공
- [ ] (dev_flag='N' 전환 후) 실제 발송 1건 → 셀러 적립금 정확히 차감 + voucher_orders 'sent' 기록
- [ ] 셀러 사업자등록증 업로드 → R2 정상 저장 (403 아님)
- [ ] `curl -I .../api/products` → X-RateLimit-* 헤더 확인

---

## 🆘 문제 발생 시

| 증상 | 원인 | 해결 |
|---|---|---|
| `/admin/kt-alpha` 가 500 | migration 미적용 | 액션 1 재실행 |
| 카탈로그 sync 실패 | KT Alpha 키 미등록 | 액션 3, 4 확인 |
| 셀러 voucher 발송 시 'KT Alpha 키 미설정' | secret 미등록 | 액션 4 재확인 |
| 비즈머니 잔액 '확인 안 됨' | user_id 미설정 | 액션 5 에서 KT Alpha User ID 입력 |
| 사업자등록증 업로드 503 | R2 binding 누락 | 액션 2 재확인 |
| 모든 API 429 | KV fail-closed | 액션 7 등록 또는 임시로 Bindings 에서 RATE_LIMIT_KV 제거 |

문제 지속 시 `docs/INCIDENTS.md` 에 사고 기록 + 어드민에게 슬랙 알림.

---

**마지막 업데이트**: 2026-05-19 KT Alpha 통합 완료 직후
