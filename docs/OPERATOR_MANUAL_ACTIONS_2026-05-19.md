# 🛠️ 유어딜 운영자 매뉴얼 — KT Alpha 통합 + 인프라 설정

> **이 문서를 처음부터 끝까지 차례대로 따라하세요.**
>
> 컴퓨터 초보를 위해 모든 명령어 / 클릭 위치 / 예상 결과를 자세히 적어놨습니다.
>
> **예상 소요 시간**: 약 2시간 30분 (KT Alpha 영업일 대기 시간 제외)

---

## 📋 한눈에 보기 — 작업 순서

| 순서 | 단계 | 시간 | 차단성 |
|---|---|---|---|
| **Phase 0** | 사전 준비 (Cloudflare 계정 / wrangler 설치) | 10분 | 🔴 |
| **Phase 1** | D1 데이터베이스에 migration 적용 | 5분 | 🔴 |
| **Phase 2** | Cloudflare Secret 4종 등록 (KT Alpha 키) | 5분 | 🔴 |
| **Phase 3** | R2 bucket 생성 + binding | 10분 | 🔴 |
| **Phase 4** | 어드민 페이지 KT Alpha 기본 설정 | 5분 | 🔴 |
| **Phase 5** | 카탈로그 sync + 테스트 발송 | 10분 | 🟡 |
| **Phase 6** | KT Alpha 비즈머니 충전 | 30분 | 🔴 |
| **Phase 7** | KT Alpha 측 "딜 교환 모델" 사전 승인 요청 | 영업일 2-3일 대기 | 🔴 |
| **Phase 8** | 대량 등록 + 노출 ON | 10분 | 🟡 |
| **Phase 9** | KV namespace 등록 (rate limiting) | 5분 | 🟢 |
| **Phase 10** | ALIGO 알림톡 템플릿 KISA 승인 | 영업일 1-2일 | 🟢 |

🔴 = 필수 (안 하면 동작 안 함) / 🟡 = 권장 / 🟢 = 선택

---

# 🚀 Phase 0: 사전 준비 (10분)

## 0-1. Cloudflare 계정 확인

1. https://dash.cloudflare.com 접속 → 로그인
2. 왼쪽 사이드바에서 **Workers & Pages** 클릭
3. `ur-live` 프로젝트가 보이는지 확인 (있으면 OK, 없으면 운영자에게 권한 요청)

## 0-2. PowerShell 열기 (Windows)

1. 시작 버튼 → "PowerShell" 검색 → **Windows PowerShell** 클릭
2. (옵션) **관리자 권한**으로 실행하면 더 안전

## 0-3. Node.js 설치 확인

```powershell
node --version
```

**기대 결과**: `v18.x.x` 이상 표시
**안 나오면**: https://nodejs.org/ko 에서 LTS 버전 다운로드 + 설치

## 0-4. 프로젝트 폴더로 이동

```powershell
# 본인 컴퓨터의 ur-live 폴더 경로로 변경하세요
cd C:\Users\본인계정\ur-live
```

**확인 방법**: `dir` 입력 → `package.json`, `wrangler.toml`, `migrations` 폴더가 보여야 함

## 0-5. Wrangler (Cloudflare CLI) 설치 확인

```powershell
npx wrangler@3 --version
```

**기대 결과**: `⛅️ wrangler 3.x.x` 표시
**안 나오면**: 자동 설치되니까 기다리면 OK

## 0-6. Cloudflare 로그인 (1회만)

```powershell
npx wrangler@3 login
```

→ 브라우저 자동 열림 → Cloudflare 로그인 → **Allow** 클릭 → PowerShell 로 돌아오면 `Successfully logged in` 메시지 확인

---

# 📦 Phase 1: D1 데이터베이스 migration 적용 (5분)

**왜 필요?** 코드에서 사용하는 테이블 (gift_catalog, voucher_orders, tax_withholding_log 등) 을 실제 production DB 에 만들기 위해.

## 1-1. Migration 파일 5개 순서대로 실행

PowerShell 에서 하나씩 복사-붙여넣기 → Enter:

```powershell
npx wrangler@3 d1 execute toss-live-commerce-db --remote --file=migrations/0264_kt_alpha_gift_catalog.sql
```

**기대 결과**: `🌀 Executing on remote database... ✅ Successful` (몇 초 안에 끝남)

```powershell
npx wrangler@3 d1 execute toss-live-commerce-db --remote --file=migrations/0265_kt_alpha_markup.sql
```

```powershell
npx wrangler@3 d1 execute toss-live-commerce-db --remote --file=migrations/0266_kt_alpha_banner_template.sql
```

```powershell
npx wrangler@3 d1 execute toss-live-commerce-db --remote --file=migrations/0267_kt_alpha_check_constraints.sql
```

```powershell
npx wrangler@3 d1 execute toss-live-commerce-db --remote --file=migrations/0268_kt_alpha_consumer_products.sql
```

## 1-2. 적용 확인

```powershell
npx wrangler@3 d1 execute toss-live-commerce-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('gift_catalog','voucher_orders','tax_withholding_log')"
```

**기대 결과**: 위 3개 테이블 이름이 모두 표시되면 성공.

```powershell
npx wrangler@3 d1 execute toss-live-commerce-db --remote --command="SELECT key, value FROM platform_settings WHERE key LIKE 'kt_alpha%' ORDER BY key"
```

**기대 결과**: `kt_alpha_markup_pct = 5`, `kt_alpha_consumer_markup_pct = 20` 등 11개 키 표시.

## 🆘 에러 발생 시

| 에러 메시지 | 원인 | 해결 |
|---|---|---|
| `database not found` | DB 이름 다름 | `wrangler.toml` 의 `database_name` 확인 |
| `duplicate column name` | 이미 적용됨 | 무시하고 다음 단계 진행 |
| `Authentication failed` | 로그인 만료 | `npx wrangler@3 login` 다시 |

---

# 🔐 Phase 2: Cloudflare Secret 4종 등록 (5분)

**왜 필요?** Worker 코드가 KT Alpha API 호출할 때 사용할 인증 키. **절대 코드에 직접 쓰면 안 됨** (git 에 노출됨).

## 2-1. Cloudflare Dashboard 접속

1. https://dash.cloudflare.com 로그인
2. 좌측 메뉴: **Workers & Pages** 클릭
3. `ur-live` 프로젝트 클릭
4. 상단 탭: **Settings** 클릭
5. 좌측 메뉴: **Variables and Secrets** 클릭

## 2-2. Secret 4개 등록

**Production** 탭 선택 → **Add variable** 버튼 → 다음 4개 차례대로:

### Secret 1: KT_ALPHA_AUTH_CODE
- **Variable name**: `KT_ALPHA_AUTH_CODE`
- **Type**: 우측 드롭다운에서 **Secret (encrypted)** 선택
- **Value**: `REALdf5b541208704704a2af3a7782c136ec`
- **Save** 클릭

### Secret 2: KT_ALPHA_TOKEN_KEY
- **Variable name**: `KT_ALPHA_TOKEN_KEY`
- **Type**: **Secret (encrypted)**
- **Value**: `1DBUFBQ+r+8Wdm+FOjZJmA==`
- **Save** 클릭

### Secret 3: KT_ALPHA_DEV_MODE
- **Variable name**: `KT_ALPHA_DEV_MODE`
- **Type**: **Plain text** (이건 비밀이 아님)
- **Value**: `Y` ← 처음엔 반드시 `Y` (테스트 모드)
- **Save** 클릭

### Secret 4 (생략 가능): KT_ALPHA_AUTH_TOKEN
- 등록하지 마세요. TOKEN_KEY 가 있으면 자동 계산됩니다.

## 2-3. Preview 환경에도 동일하게 등록

1. 같은 페이지에서 **Preview** 탭 클릭
2. 위 3개 (1, 2, 3) 동일하게 추가

## 2-4. 자동 재배포

Secret 저장 후 **자동으로 워커가 재시작**됩니다 (몇 초 소요). 별도 작업 불필요.

## 🆘 확인 방법

PowerShell 에서:
```powershell
npx wrangler@3 pages secret list --project-name=ur-live
```

**기대 결과**: `KT_ALPHA_AUTH_CODE`, `KT_ALPHA_TOKEN_KEY` 표시됨 (값은 안 보임 — 정상).

---

# 🪣 Phase 3: R2 Bucket 생성 + binding (10분)

**왜 필요?** 셀러가 사업자등록증을 올리거나, 숙소 객실 이미지 등을 저장할 공간.

## 3-1. R2 Bucket 만들기

1. Cloudflare Dashboard → 좌측 메뉴 **R2 Object Storage** 클릭
2. **Create bucket** 버튼 클릭
3. **Bucket name**: `ur-live-media` ← 정확히 이 이름!
4. **Location**: `Asia-Pacific (APAC)` 선택
5. **Standard storage** 선택 (default)
6. **Create bucket** 클릭

## 3-2. Pages 프로젝트에 binding 등록

1. 다시 좌측 메뉴 **Workers & Pages** → **ur-live** 클릭
2. **Settings** 탭 → **Bindings** 섹션 (Variables 아래)
3. **Add binding** → **R2 bucket** 선택
4. **Variable name**: `MEDIA_BUCKET`
5. **R2 bucket**: `ur-live-media` 선택
6. **Production** 선택 → **Save**
7. **Add binding** 다시 클릭 → 위와 동일하게 **Preview** 에도 등록

## 3-3. (선택) Custom Domain 연결

이미지 URL 을 `https://media.ur-team.com/abc.jpg` 형식으로 깔끔하게 노출하려면:

1. R2 → `ur-live-media` 클릭 → **Settings** 탭
2. **Public access** 섹션 → **Connect Domain** 버튼
3. `media.ur-team.com` 입력 → DNS 자동 설정 확인 → **Continue**
4. 다시 Pages → Settings → Variables → **`PUBLIC_R2_URL`** 변수 추가 (Plain text):
   - Value: `https://media.ur-team.com`

이 단계 안 해도 업로드는 동작합니다 (URL 모양만 r2.dev 형식).

## 🆘 확인 방법

브라우저에서 `https://live.ur-team.com` → 셀러 로그인 → 사업자등록증 업로드 시도 → 정상 업로드 (503 에러 X) 확인.

---

# 🎛️ Phase 4: 어드민 페이지 KT Alpha 기본 설정 (5분)

**왜 필요?** 마진율 / 회원 ID / 발신번호 / 카드·배너 ID 등을 설정해야 발송 동작.

## 4-1. 어드민 페이지 접속

1. 브라우저: `https://live.ur-team.com/admin/login`
2. 어드민 계정으로 로그인
3. URL 직접 입력: `https://live.ur-team.com/admin/kt-alpha`

## 4-2. 페이지 구조 확인

화면에 다음 섹션들이 보여야 함:
- 상단 **비즈머니 잔액 카드** (현재 ₩0 표시 — Phase 6 에서 충전)
- **KPI 4개** (활성 상품 / 발송 시도 / 발송 성공 / 누적 거래액)
- **운영 설정** (마진율 / 개발모드 / 회원 ID / 발신번호 / 카드 ID / 배너 ID / API 활성화)
- **카탈로그 미리보기** (현재 0개 — Phase 5 에서 sync)
- **소비자 직판 (딜 교환 전용)** amber 박스

## 4-3. 운영 설정 입력

**운영 설정** 섹션에서 다음 값 입력:

| 필드 | 값 | 설명 |
|---|---|---|
| **마진율 (셀러 정산용)** | `5` ~ `20` 슬라이더 | 셀러 적립금 차감 시 마진. 비사업자 보호 위해 5-10% 권장 |
| **개발/상용 모드** | `개발 (Y)` | ⚠️ **처음엔 반드시 개발 모드** — 실제 발송 X, 테스트 가능 |
| **KT Alpha 회원 ID** | (KT Alpha 콘솔에서 받은 본인 회원 ID) | 0301 잔액 조회 / 0204 발송에 필수 |
| **발신 번호** | `01012345678` (회사 등록 발신번호, - 제외) | MMS 발신자 표시 |
| **MMS 카드 ID** | `202507100302725` | 받으신 카드 아이디 |
| **MMS 배너 ID** | `202507100352984` | 받으신 배너 아이디 |
| **API 활성화** | `활성 (셀러가 voucher 선택 가능)` | 셀러 모달에 옵션 노출 |

→ 하단 **설정 저장** 클릭 → "설정 저장됨" 토스트 확인

## 4-4. 소비자 직판 마진 별도 설정 (선택)

소비자 직판용 마진은 위 셀러 마진과 별도입니다 (default 20%). 변경하려면:

PowerShell 에서:
```powershell
npx wrangler@3 d1 execute toss-live-commerce-db --remote --command="UPDATE platform_settings SET value = '15' WHERE key = 'kt_alpha_consumer_markup_pct'"
```

(예: 15% 로 변경. 변경 후 대량 등록 다시 하면 갱신됨)

---

# 📥 Phase 5: 카탈로그 sync + 테스트 발송 (10분)

## 5-1. 카탈로그 sync (KT Alpha 상품 5000개 받아오기)

1. `/admin/kt-alpha` 페이지 상단 **'Sync 지금 실행'** 버튼 클릭
2. 확인창 → **확인** → 진행 표시 (약 1-2분)
3. 완료 메시지: `"4321건 sync · 0건 비활성 · 잔액 ₩0"` 형태

## 5-2. 카탈로그 확인

같은 페이지 하단 **카탈로그 미리보기** 섹션 새로고침 → 상품 30개 표시되면 성공.

PowerShell 에서 총 개수 확인:
```powershell
npx wrangler@3 d1 execute toss-live-commerce-db --remote --command="SELECT COUNT(*) as total FROM gift_catalog WHERE is_active = 1 AND goods_state = 'SALE'"
```

**기대 결과**: `total = 5000` 가까이.

## 5-3. 개발 모드로 테스트 발송 (본인 폰)

⚠️ **dev_mode='Y' 인 상태에서만 진행** (실제 비즈머니 차감 X)

### 옵션 A — 셀러 측에서 테스트

1. 셀러 계정 로그인: `https://live.ur-team.com/seller/login`
2. `https://live.ur-team.com/seller/settlements` 접속
3. **'🎁 상품권으로 받기'** 버튼 클릭
4. 모달에서 상품 1개 선택 (예: 스타벅스 5천원권)
5. 수량 1, 휴대폰 본인 번호 (셀러 등록 번호로 자동 잠금)
6. **약관 2종 (+ 비사업자 시 원천징수)** 체크박스 모두 체크
7. **🎁 ₩XXX 차감 후 발송** 클릭
8. 본인 폰에 MMS 도착 확인 (10초~1분 소요)

### 옵션 B — 어드민 직접 테스트 (PowerShell 호출)

이 옵션은 좀 복잡 — 셀러 옵션 A 가 더 편함.

### 5-4. 발송 이력 확인

`https://live.ur-team.com/seller/voucher-orders` → 발송 1건 보임. status `sent` 확인.

## 🆘 발송 실패 시

| 에러 | 원인 | 해결 |
|---|---|---|
| "KT Alpha 운영자 설정 미완료" | Phase 4-3 미완료 | user_id + callback_no 입력 |
| "KT Alpha 키 미설정" | Phase 2 미완료 | Secret 4 종 등록 재확인 |
| "잔액 부족" | 비즈머니 0원 | Phase 6 충전 (개발 모드는 차감 X 인데 일부 응답에서 잔액 체크) |
| "phoneNo 형식 오류" | 셀러 phone 미등록 | `/seller/profile` 에서 휴대폰 등록 |

---

# 💳 Phase 6: KT Alpha 비즈머니 충전 (30분)

⚠️ **상용 발송하려면 필수**. 현재 잔액 0원 = 실제 발송 차단.

## 6-1. 충전 액수 정하기

초기 운영 권장:
- **테스트**: 10만원 (약 20-30건 발송 가능)
- **소규모 런칭**: 100만원 (약 200-300건)
- **본격 운영**: 500만원 ~

## 6-2. KT Alpha 콘솔 로그인

1. https://bizgift.giftishow.co.kr/ 접속
2. 본인 회원 ID 로 로그인

## 6-3. 비즈머니 충전 메뉴

1. 상단 메뉴 **"비즈머니 충전"** 또는 **"입금 신청"** 클릭
2. 충전 금액 입력
3. 입금 계좌 정보 확인 (KT Alpha 가 안내하는 가상계좌)
4. 회사 법인계좌에서 위 가상계좌로 송금

**입금 후 충전 반영**: 영업일 기준 약 10분~2시간

## 6-4. 충전 확인

`/admin/kt-alpha` 페이지에서 **'잔액 갱신'** 버튼 클릭 → 비즈머니 잔액 카드 업데이트 확인.

또는 자동: 매일 KST 12시 cron 자동 갱신.

## 6-5. 잔액 부족 자동 알림

10만원 이하로 떨어지면 어드민에게 자동 알림 (24h 중복 방지):
- `/admin/dashboard` 또는 알림센터에 `⚠️ KT Alpha 비즈머니 잔액 부족` 표시
- 발송은 0원 시점부터 차단

---

# 📧 Phase 7: KT Alpha 측 "딜 교환 모델" 사전 승인 요청

⚠️ **노출 ON 하기 전 반드시 사전 승인 필요**. 무단 진행 시 Key 회수 위험.

## 7-1. 이메일 작성

KT Alpha 비즈센터 (kt-alpha-biz@kt.com 또는 담당자 이메일) 에 발송:

```
제목: [유어딜] 자체 포인트(딜) 교환 모델 운영 가능 여부 문의

안녕하세요. 유어딜 (live.ur-team.com) 입니다.

저희 플랫폼의 자체 포인트인 '딜(Deal)' 을 모바일 상품권 교환에
사용하는 모델을 운영하려고 합니다. 비즈 API 가이드라인에 부합하는지
사전 확인 부탁드립니다.

## 자금 흐름

[사용자]                  [유어딜 플랫폼]
   |                            |
충전 (1원=1딜) → 카드 결제 → 자사 통합 매출 계정
   |
딜 잔액 보유
   |
"딜로 교환" 클릭 (카드 결제 옵션 없음, 딜만 가능)
   |
딜 잔액 차감 → 자사 비즈머니에서 KT Alpha API 호출
                            |
                    KT Alpha 비즈머니 차감
                            |
                  사용자 본인 명의 휴대폰으로 MMS 발송

## 핵심 설계

1. 발송 대상은 **사용자 본인 명의 휴대폰만** (시스템 강제, 타인 발송 차단)
2. 마진 20% 추가 (KT Alpha 공급가의 1.2배 가 딜 차감액)
3. 카드/PG 직결제 옵션 차단 — 딜 교환만 가능
4. 30일 유효기간 / 환불 불가 사용자 동의 강제 (체크박스 + 약관 명시)
5. 자사 이용약관 제2조의2 에 "모바일 상품권 직접 판매 안 함, B2B 정산 용도" 명시

## 첨부 (운영 화면)

1. 어드민 페이지 (https://live.ur-team.com/admin/kt-alpha) 캡처
2. 상품 상세 페이지 — "딜 교환 전용" 배지 + 30일 유효기간 고지
3. 결제 화면 — 딜 결제 옵션만 노출 (카드 결제 차단)
4. 이용약관 제2조의2 — "직접 판매 안 함" 명시 화면
5. 발송 이력 페이지 (/admin/orders 또는 /seller/voucher-orders)

## 운영 규모 예상

- 초기 일 50-100건
- 3개월 후 일 500-1000건
- 발송 대상 100% 사용자 본인 명의 휴대폰 (CI 또는 휴대폰 인증으로 검증)

위 모델이 비즈 API 가이드라인에 부합하는지,
또는 별도 계약/조건이 필요한지 회신 부탁드립니다.

감사합니다.
유어딜 드림
```

## 7-2. 첨부 스크린샷 준비 (5종)

브라우저 캡처:

| # | 페이지 URL | 강조 포인트 |
|---|---|---|
| 1 | `/admin/kt-alpha` | "소비자 직판 (딜 교환 전용)" amber 박스 |
| 2 | `/products/{id}` (KT Alpha 상품) | "딜 교환 전용" 배지 + 30일 안내 박스 |
| 3 | `/checkout` (KT Alpha 상품 선택 시) | "딜 결제만" 표시 / 카드 옵션 없음 |
| 4 | `/terms` 제2조의2 | "직접 판매 안 함" 명시 |
| 5 | `/admin/orders` 또는 `/seller/voucher-orders` | 발송 이력 + 본인 폰 발송 확인 |

각 화면 캡처 후 PDF 또는 이미지로 묶어서 첨부.

## 7-3. 회신 대기 (영업일 2-3일)

답변 받기 전까지 **'노출 OFF' 유지**. 답변 시:
- ✅ **승인**: Phase 8 진행
- ❌ **거부**: 다른 공급자 검토 (카카오 선물하기 B2C / 직접 브랜드 계약)
- ⚠️ **조건부 승인**: 조건 반영 후 진행

---

# 📤 Phase 8: 대량 등록 + 노출 ON (10분)

⚠️ **Phase 7 승인 후에만 진행**

## 8-1. dry-run 으로 미리보기

1. `/admin/kt-alpha` 페이지 → **🛒 소비자 직판** 섹션
2. **🔍 미리보기 (dry-run)** 버튼 클릭
3. 알림: `"🔍 미리보기: 신규 5000건 / 갱신 0건"`
4. 아래 흰 박스에 상품 20개 샘플 표시 — 가격이 적절한지 확인
   - 예: `[insert] 스타벅스 카페 아메리카노 T ₩5,400` (액면가 5천원 + 8% 마진)

## 8-2. 가격이 이상하면 마진율 조정

너무 비싸거나 싸면 PowerShell 에서 변경:
```powershell
# 예: 15% 로 변경
npx wrangler@3 d1 execute toss-live-commerce-db --remote --command="UPDATE platform_settings SET value = '15' WHERE key = 'kt_alpha_consumer_markup_pct'"
```

다시 dry-run → 가격 변화 확인.

## 8-3. 실제 대량 등록

1. **📦 대량 등록 5000개** 버튼 클릭
2. 확인창에서 KT Alpha 사전 승인 여부 묻는 질문 → **확인** 클릭
3. 약 1-2분 후 완료 알림: `"✅ 등록 완료 — 신규 5000건 / 갱신 0건 / 마진 20%"`
4. KPI 카드 갱신: 등록 상품 5000 / 노출 중 0 (아직 OFF)

## 8-4. 노출 ON (최종 단계)

1. **🌐 노출 ON** 버튼 클릭
2. 확인창 → **확인**
3. 상태 표시 변경: `숨김` → `노출 중` (emerald)
4. KPI: 등록 상품 5000 / **노출 중 5000**

## 8-5. 검증 — 일반 사용자 시점

1. 시크릿/익명 브라우저 창 열기 (로그아웃 상태)
2. `https://live.ur-team.com` 접속
3. 상단 검색 → "스타벅스" 검색
4. KT Alpha 상품권이 검색 결과에 나타나는지 확인
5. 클릭 → 상품 상세 진입 → "**🎁 딜 교환 전용**" 배지 확인
6. 하단 버튼: "**🎁 딜로 교환**" (amber) 표시 확인

## 8-6. 실제 결제 1건 (본인 계좌로)

⚠️ Phase 4-3 에서 **dev_mode 를 'N' (상용) 로 변경 후** 진행 — 실제 비즈머니 차감됨

1. 일반 사용자 계정으로 로그인
2. 딜 충전 (예: 5만원)
3. 스타벅스 5천원권 선택 → "🎁 딜로 교환" 클릭
4. 본인 폰에 MMS 도착 확인
5. MMS 의 바코드/PIN 으로 매장에서 사용 가능

## 🆘 노출 OFF 긴급 차단

KT Alpha 측에서 갑자기 차단 요청 / 문제 발생 시:

1. `/admin/kt-alpha` → **🔒 노출 OFF** 버튼 클릭
2. 즉시 모든 KT Alpha 상품 일반 사용자에게 숨김
3. 이미 결제된 건은 영향 없음 (이미 발송됨)

---

# 🔒 Phase 9: KV namespace 등록 (rate limiting, 5분 — 권장)

**왜 필요?** 로그인/결제 등 민감 API 가 일시적으로 429 거부될 수 있음. KV 등록하면 안정적 rate limit.

## 9-1. KV namespace 생성

PowerShell:
```powershell
npx wrangler@3 kv:namespace create RATE_LIMIT_KV
```

**기대 결과**: `id = "abc123..."` 같은 ID 표시 → 메모해두기

```powershell
npx wrangler@3 kv:namespace create SESSION_KV
```

→ 또 다른 ID 메모

## 9-2. Dashboard binding

1. Cloudflare Dashboard → Workers & Pages → ur-live → Settings → Bindings
2. **Add binding** → **KV Namespace**
3. **Variable**: `RATE_LIMIT_KV` / **Namespace**: 위 ID 선택 → Save
4. 동일하게 **SESSION_KV** 도 추가
5. **Production** + **Preview** 둘 다

## 9-3. 검증

```powershell
curl -I https://live.ur-team.com/api/products
```

응답 헤더에 `X-RateLimit-Limit`, `X-RateLimit-Remaining` 있으면 정상.

---

# 📱 Phase 10: ALIGO 알림톡 템플릿 (영업일 1-2일 — 권장)

**왜 필요?** 결제 완료 / 배송 시작 / voucher 발송 알림을 카카오톡으로 보내려면.

## 10-1. 5종 템플릿 등록

1. https://smartconsole.aligo.in/ 가입 + 로그인
2. **알림톡** → **템플릿 관리** → **신규 등록**
3. 5종 등록:

| 코드 | 본문 |
|---|---|
| `ur_payment_done` | `[유어딜] #{상품명} 결제 완료\n주문번호: #{주문번호}` |
| `ur_shipping_start` | `[유어딜] 배송 시작\n운송장: #{운송장번호}` |
| `ur_voucher_sent` | `[유어딜] 기프티쇼 상품권 발송 완료\n30일 이내 사용해주세요` |
| `ur_stay_booking` | `[유어딜] #{숙소명} 예약 확정\n체크인: #{날짜}` |
| `ur_settlement` | `[유어딜] #{금액}원 정산 완료` |

각 템플릿마다 **KISA 심사 신청** 클릭 → 영업일 1-2일 대기.

## 10-2. ALIGO API 키 발급 + 등록

1. ALIGO 콘솔 → **API 키 관리**
2. **API Key** 발급 → 복사
3. Cloudflare Secret 등록 (Phase 2 와 동일 절차):
   - `ALIGO_API_KEY`
   - `ALIGO_USER_ID` (ALIGO 가입 ID)
   - `ALIGO_SENDER_KEY` (발신 프로필 키)

---

# 📊 운영 시작 후 일일 체크리스트

## 매일 아침 09:00

1. `/admin/kt-alpha` 접속
2. **비즈머니 잔액** 확인 — 10만원 이하면 충전 알림
3. **발송 성공률** 확인 — 95% 미만이면 KT Alpha 콘솔에서 상태 확인
4. **카탈로그 마지막 sync** 확인 — 24시간 이상 안 됐으면 수동 sync

## 매주 월요일

1. `/admin/withholding` → 전주 원천징수 누계 확인
2. `/admin/orders` 비정상 status 알림 처리
3. 환불/취소 분쟁 확인

## 매월 1일

1. 전월 셀러 정산 자동 송금 (cron 자동)
2. 비즈머니 사용량 기반 다음 달 충전 예산 책정
3. 시스템 알림 정리

## 매년 1월

1. `/admin/withholding` → 전년도 **'300만 초과 CSV'** 다운로드
2. 홈택스 → "기타소득 지급명세서" → CSV 업로드 → 제출
3. 제출 후 **'제출 완료 마킹'** 버튼 클릭

---

# 🆘 통합 트러블슈팅

## 자주 발생하는 문제

| 증상 | 원인 | 해결 |
|---|---|---|
| `/admin/kt-alpha` 500 | Migration 미적용 | Phase 1 재실행 |
| 카탈로그 sync 실패 | Secret 미등록 | Phase 2 재확인 |
| "비즈머니 0원" 표시 | 충전 미입금 | Phase 6 / KT Alpha 콘솔 확인 |
| 셀러 voucher 발송 0건 | API 활성화 OFF | Phase 4-3 → API 활성화 = 활성 |
| 사용자가 "딜 교환" 버튼 안 보임 | 노출 OFF | Phase 8-4 → 노출 ON |
| MMS 도착 안 함 | dev_mode='Y' | 상용 발송하려면 'N' 로 |
| 본인 폰 외 발송 차단됨 | 정상 동작 | sellers.phone 등록 필요 (`/seller/profile`) |
| 모든 API 429 거부 | RATE_LIMIT_KV 미설정 | Phase 9 등록 또는 임시 binding 제거 |
| 사업자등록증 업로드 503 | R2 binding 누락 | Phase 3 재확인 |

## 긴급 차단 절차

KT Alpha 측 항의 / 정책 위반 발견 / 사고 발생 시:

1. **즉시**: `/admin/kt-alpha` → **🔒 노출 OFF** 클릭
2. **5분 내**: Cloudflare Dashboard → Secrets → `KT_ALPHA_DEV_MODE` 를 `Y` 로 변경 (실제 발송 중단)
3. **30분 내**: KT Alpha 측 담당자에게 상황 보고
4. **24시간 내**: 원인 분석 + 재발 방지 대책 `docs/INCIDENTS.md` 에 기록

---

# 📞 연락처

| 문제 영역 | 담당 |
|---|---|
| KT Alpha API / 비즈머니 | KT Alpha 비즈센터 (kt-alpha-biz@kt.com) |
| Cloudflare 인프라 | Cloudflare Support (Dashboard 우측 아이콘) |
| 토스 결제 | Toss Payments Support |
| ALIGO 알림톡 | ALIGO 콘솔 채팅 |
| 코드 / 시스템 버그 | 개발팀 (claude.ai/code 세션) |

---

**마지막 업데이트**: 2026-05-19 — 소비자 직판 (딜 교환 전용) 모델 추가 후
**다음 검토 예정**: KT Alpha 사전 승인 답변 받은 후
