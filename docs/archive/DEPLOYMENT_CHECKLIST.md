# 🚀 Deployment Checklist for UR Live

## 📋 환경 변수 (Environment Variables)

### 1. Cloudflare Pages Secrets (Production)

다음 명령어로 프로덕션 환경에 시크릿을 설정하세요:

```bash
# JWT Secret (토큰 생성 키)
npx wrangler pages secret put JWT_SECRET --project-name ur-live

# Kakao REST API Key (카카오 로그인)
npx wrangler pages secret put KAKAO_REST_API_KEY --project-name ur-live

# Resend API Key (이메일 알림)
npx wrangler pages secret put RESEND_API_KEY --project-name ur-live

# Toss Payments Secret Key (결제)
npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live

# Email From Address (이메일 발신 주소)
npx wrangler pages secret put EMAIL_FROM --project-name ur-live
# 예: "UR Live <noreply@live.ur-team.com>"

# Discord Webhook URL (알림 - 선택사항)
npx wrangler pages secret put DISCORD_WEBHOOK_URL --project-name ur-live
```

### 2. Local Development (.dev.vars)

로컬 개발 환경용 `.dev.vars` 파일:

```env
JWT_SECRET=your-local-jwt-secret-key-here
KAKAO_REST_API_KEY=5dd74bccb797640b0efd070467f3bafd
RESEND_API_KEY=your-resend-api-key-here
TOSS_SECRET_KEY=test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R
EMAIL_FROM="UR Live Dev <dev@ur-team.com>"
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-url
```

**⚠️ 주의:** `.dev.vars`는 `.gitignore`에 포함되어 있어 커밋되지 않습니다.

### 3. Frontend Environment Variables (Vite)

`.env` 파일 (로컬 개발):

```env
VITE_KAKAO_REST_API_KEY=5dd74bccb797640b0efd070467f3bafd
VITE_SENTRY_DSN=your-sentry-dsn-here
VITE_SENTRY_ENVIRONMENT=development
VITE_APP_VERSION=1.0.0
```

프로덕션에서는 Cloudflare Pages Dashboard의 Environment Variables에서 설정:

- `VITE_KAKAO_REST_API_KEY`: 카카오 REST API 키
- `VITE_SENTRY_DSN`: Sentry 오류 추적 DSN
- `VITE_SENTRY_ENVIRONMENT`: production
- `VITE_APP_VERSION`: 버전 번호

---

## 🗄️ Cloudflare Services Configuration

### D1 Database

```toml
[[d1_databases]]
binding = "DB"
database_name = "toss-live-commerce-db"
database_id = "d9530ba6-7a26-4c02-9295-3ce5aef112a3"
```

**마이그레이션 실행:**
```bash
# 로컬 개발
npx wrangler d1 migrations apply toss-live-commerce-db --local

# 프로덕션
npx wrangler d1 migrations apply toss-live-commerce-db
```

### KV Namespaces

1. **SESSION_KV** (세션 저장소)
   - binding: `SESSION_KV`
   - id: `3b522e69651f4d4f84a0cdf9430eeb72`

2. **CACHE_KV** (일반 캐시)
   - binding: `CACHE_KV`
   - id: `25ecc9ce2c464dd59edf5eb7d5fd1a10`

3. **LIVE_CACHE** (라이브 실시간 캐시)
   - binding: `LIVE_CACHE`
   - id: `e6667599e01d4af8b4687560eb39394c`
   - preview_id: `750e3b6ed7714a8999abe19d8771be00`

---

## 🌐 Domain & DNS Configuration

### Production Domain
- **Primary**: `https://live.ur-team.com`
- **Cloudflare Pages**: `https://ur-live.pages.dev`

### DNS Records (Cloudflare DNS)
```
CNAME live ur-live.pages.dev (Proxied)
```

---

## 🔒 Security Checklist

- [x] JWT_SECRET은 강력한 랜덤 키 사용 (최소 32자)
- [x] TOSS_SECRET_KEY는 실제 Toss Payments에서 발급받은 키 사용
- [x] KAKAO_REST_API_KEY는 프로덕션 앱 키 사용
- [x] 모든 시크릿은 Cloudflare Pages Secrets로 관리 (환경 변수 X)
- [x] `.dev.vars` 파일은 `.gitignore`에 포함
- [x] GitHub Actions에서 시크릿은 Repository Secrets로 관리

---

## 📊 Performance & Monitoring

### Sentry Error Tracking
- **DSN**: Sentry 대시보드에서 발급
- **Environment**: development / production 구분
- **Source Maps**: 프로덕션 빌드 시 업로드

### Discord Notifications (Optional)
- 주문 알림
- 에러 알림
- 라이브 시작/종료 알림

---

## 🚀 Deployment Steps

### 1. 로컬 빌드 테스트
```bash
npm run build
npx wrangler pages dev dist --d1=toss-live-commerce-db --local
```

### 2. 프로덕션 배포
```bash
# 자동 배포 (GitHub Push)
git push origin main

# 수동 배포
npm run deploy
# 또는
npx wrangler pages deploy dist --project-name ur-live
```

### 3. 배포 후 확인 사항
- [x] 라이브 페이지 접속 확인
- [x] 로그인/회원가입 테스트
- [x] 상품 추가/수정 테스트
- [x] 결제 플로우 테스트 (Toss Payments)
- [x] 실시간 시청자 수 업데이트 확인
- [x] 채팅 기능 확인
- [x] 품절 처리 확인
- [x] 관리자/셀러 대시보드 확인

---

## 🐛 Troubleshooting

### 환경 변수가 작동하지 않을 때
```bash
# 시크릿 목록 확인
npx wrangler pages secret list --project-name ur-live

# 시크릿 삭제 후 재설정
npx wrangler pages secret delete JWT_SECRET --project-name ur-live
npx wrangler pages secret put JWT_SECRET --project-name ur-live
```

### D1 마이그레이션 실패 시
```bash
# 마이그레이션 상태 확인
npx wrangler d1 migrations list toss-live-commerce-db

# 로컬 데이터베이스 초기화
rm -rf .wrangler/state/v3/d1
npx wrangler d1 migrations apply toss-live-commerce-db --local
```

### 캐시 문제 시
```bash
# KV 네임스페이스 전체 삭제 (주의: 모든 데이터 삭제)
npx wrangler kv:bulk delete --namespace-id=e6667599e01d4af8b4687560eb39394c --force
```

---

## 📝 Notes

1. **JWT_SECRET**: 프로덕션 환경에서는 반드시 강력한 랜덤 키를 사용하세요.
   ```bash
   # 랜덤 키 생성 (예시)
   openssl rand -base64 32
   ```

2. **Toss Payments**: 테스트 키와 프로덕션 키를 구분하여 사용하세요.
   - 테스트: `test_sk_*`
   - 프로덕션: `live_sk_*`

3. **Kakao Login**: 프로덕션 앱 등록 후 Redirect URI를 `https://live.ur-team.com/auth/callback/kakao`로 설정하세요.

4. **Resend Email**: 발신 도메인을 Resend에 등록하고 DNS 레코드를 설정하세요.

---

**Last Updated**: 2024-02-25
**Version**: 1.0.0
