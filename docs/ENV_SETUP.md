# 🔐 환경변수 설정 가이드 (Cloudflare Pages)

> **배경**: 2026-05-23 Toss 사건 — `TOSS_CLIENT_KEY` 와 `VITE_TOSS_CLIENT_KEY` env 불일치로 1주일간 결제 깨짐. 같은 사고 재발 방지용.

## 🎯 핵심 룰

### 1️⃣ 두 종류 env 구분
Cloudflare Pages 에는 **두 가지 env 공간** 이 있고 각각 따로 설정해야 함:

| 종류 | 명명 규칙 | 사용처 | 변경 시 |
|---|---|---|---|
| **Build-time** | `VITE_*` prefix | Vite 가 build 시 client JS 에 내장 | **재배포** 필요 |
| **Runtime** | prefix 없음 또는 일반 변수 | Worker 가 request 마다 읽음 | 즉시 반영 |

같은 값을 양쪽에 동일하게 넣어야 함 (예: `TOSS_CLIENT_KEY` + `VITE_TOSS_CLIENT_KEY` 짝).

### 2️⃣ Production / Preview 분리
Cloudflare Pages → Settings → **Environment variables and secrets** 페이지에 두 탭:

- **Production** — `live.ur-team.com` 도메인 (실 사용자) 
- **Preview** — PR / 브랜치 배포 (테스트)

**두 환경에 모두 설정 필요** (Preview 에 있어도 Production 안 가져옴).

### 3️⃣ Live ↔ Test 키 일관성
- `live_*` 와 `test_*` prefix 가 다른 키는 절대 섞지 말 것
- 모두 `live_*` 또는 모두 `test_*` — 일관성 유지
- 변경 시 4 변수 모두 동시 변경 (`TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`, `VITE_TOSS_CLIENT_KEY`)

## 📋 필수 환경변수 목록

### Toss Payments (결제)
```
TOSS_CLIENT_KEY=live_gck_xxxxxxxxxxxxxxxxxxxx     # runtime + Production tab
TOSS_SECRET_KEY=live_sk_<your_secret_key>       # Secret + Production tab (한 번 입력 후 값 안 보임)
VITE_TOSS_CLIENT_KEY=live_gck_xxxxxxxxxxxxxxxxxxxx # build-time + Production tab
```
⚠️ `TOSS_CLIENT_KEY` 와 `VITE_TOSS_CLIENT_KEY` 값은 **반드시 동일**.

### Firebase (인증)
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
FIREBASE_PRIVATE_KEY=...  # Secret. server-side admin SDK
```

### Kakao OAuth
```
VITE_KAKAO_REST_API_KEY=...        # build-time
KAKAO_REST_API_KEY=...              # runtime (server-side OAuth flow)
KAKAO_CLIENT_SECRET=...             # Secret
```

### JWT / 암호화
```
JWT_SECRET=<32+자 랜덤 문자열>      # Secret. 변경 시 모든 세션 무효화
DATA_ENCRYPTION_KEY=<32+자>          # Secret. DB 의 token 암호화 (사용자 access_token 등)
```

### Aligo 알림톡 (선택)
```
ALIGO_API_KEY=...        # Secret
ALIGO_USER_ID=...
ALIMTALK_SENDER_KEY=...  # Secret
```

### Rate Limiting (필수)
```
RATE_LIMIT_KV         # Bindings → KV Namespace
                       # 없으면 fail-OPEN (모든 rate limit 통과)
```

## 🚀 신규 환경 셋업 절차

### Step 1: Toss 키 발급
1. https://developers.tosspayments.com 가입
2. 좌측 메뉴 → **API 키**
3. **결제위젯 연동 키** 섹션에서:
   - 클라이언트 키 (`live_gck_*`) 복사
   - 시크릿 키 (`live_sk_*`) 복사

### Step 2: 결제위젯 등록 (live 환경)
1. https://dashboard.tosspayments.com/payment-widget-service/
2. **새 위젯 만들기** → variantKey 설정:
   - 결제수단 위젯 variantKey: `DEFAULT` (또는 원하는 이름)
   - 약관 위젯 variantKey: `AGREEMENT`
3. 도메인 관리에 `live.ur-team.com` 등록

### Step 3: Cloudflare 환경변수 등록
1. Cloudflare Dashboard → Pages → `ur-live` → Settings → **Environment variables and secrets**
2. **Production** tab 선택
3. 다음 변수 추가:
   ```
   TOSS_CLIENT_KEY      = live_gck_xxxxxxxxx  (Variable)
   TOSS_SECRET_KEY      = live_sk_xxxxxxxxx   (Secret — Encrypted)
   VITE_TOSS_CLIENT_KEY = live_gck_xxxxxxxxx  (Variable, 위와 동일 값!)
   ```
4. 필요시 **Preview** tab 에도 test_* 키로 설정

### Step 4: 재배포
- env 변경 후 자동 재배포 트리거 또는 수동 push
- `VITE_*` 는 build-time 이라 재배포 반드시 필요

### Step 5: 검증
1. https://live.ur-team.com/admin/env-check 접속 (어드민 로그인)
2. 모든 항목 ✅ 확인:
   - TOSS_CLIENT_KEY 값 = VITE_TOSS_CLIENT_KEY 값
   - 모든 키가 `live_*` (또는 모두 `test_*`)
   - 발견된 issues: 없음

issue 있으면 위 화면이 정확히 어디 잘못됐는지 안내.

## 🔄 키 변경 / 회전 (rotation)

### Toss 시크릿 키 회전
1. Toss 콘솔에서 새 시크릿 키 발급
2. Cloudflare Production 의 `TOSS_SECRET_KEY` 값 갱신
3. 옛 키는 24시간 후 Toss 콘솔에서 비활성화 (graceful)
4. `/admin/env-check` 로 검증

### Live ↔ Test 전환
**전체** 4 변수 한 번에 변경:
- `TOSS_CLIENT_KEY` → live_gck_ ↔ test_gck_
- `TOSS_SECRET_KEY` → live_sk_ ↔ test_sk_
- `VITE_TOSS_CLIENT_KEY` → live_gck_ ↔ test_gck_

⚠️ 부분 변경 시 결제 깨짐. `/admin/env-check` 가 mismatch 감지하지만 사용자 결제 시도 후에야 발견.

## 🚨 자주 발생하는 사고

### 사고 1: "결제위젯 연동 키는 지원하지 않습니다" 에러
**원인**: VITE 키와 server 키 prefix 다름 (한쪽 live, 한쪽 test).
**해결**: `/admin/env-check` 에서 두 값 비교 → 동일하게 변경 → 재배포.

### 사고 2: "테스트 환경" 배너 + 실거래 안 됨
**원인**: `TOSS_CLIENT_KEY` 가 `test_*` 키.
**해결**: Production 환경의 `TOSS_CLIENT_KEY` 를 `live_gck_*` 로 변경.

### 사고 3: variantKey 404 (`결제 위젯 설정 누락`)
**원인**: Toss 콘솔에 widget 미등록 또는 variantKey 이름 불일치.
**해결**:
- Toss 콘솔에서 위젯 생성 + variantKey 'DEFAULT' / 'AGREEMENT' 등록
- OR `VITE_TOSS_VARIANT_PAYMENT` env 로 실제 등록 이름 매핑

### 사고 4: build env 가 Preview 에만 설정됨
**원인**: Cloudflare Pages 의 Production / Preview tab 분리. Preview 에 넣어도 Production 미적용.
**해결**: Production tab 에 동일 변수 추가 → 재배포.

## 📎 관련 페이지

- `/admin/env-check` — 환경변수 실시간 검증
- `/admin/errors` — frontend 에러 telemetry (env_mismatch type 발생 시 자동 등록)
- `/toss-debug` — Toss SDK 진단 (개발자용)
- `/api/_healthcheck/payments` — 결제 사전 점검 API
- `/api/_selftest` — 전체 인프라 자가 점검 (admin only)

---

**마지막 업데이트**: 2026-05-23
**유지 보수**: env 추가 / 변경 시 본 문서 + `.env.example` 동시 업데이트
