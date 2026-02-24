# JWT_SECRET 프로덕션 설정 가이드

## 즉시 조치 필요 (보안 필수)

현재 코드에 하드코딩된 JWT Secret:
```
'ur-live-commerce-jwt-secret-2026-CHANGE-THIS-IN-PRODUCTION'
```

**⚠️ 이 Secret을 프로덕션에서 반드시 변경해야 합니다!**

---

## 1단계: 강력한 JWT Secret 생성

### 방법 1: OpenSSL (권장)
```bash
openssl rand -base64 64
```

### 방법 2: Node.js
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

### 방법 3: 온라인 생성기
https://generate-secret.vercel.app/64

**생성 예시:**
```
Kp7X9Qw2RtYu3Zv8Bn5Mj4Hg6Fd1Sc0Lk9Po8Iu7Yt6Xr5Wq4Vp3Un2Tm1Sl0Rk9QnMjLiKhJgFeDcBaA8Z7Y6X5W4V3U2T1S0R=
```

---

## 2단계: Cloudflare Pages에 Secret 추가

### 방법 A: Wrangler CLI (권장)
```bash
# JWT_SECRET 추가
npx wrangler pages secret put JWT_SECRET --project-name ur-live

# 입력 프롬프트에 생성한 Secret 붙여넣기
# (입력 중에는 화면에 표시되지 않음)

# 설정 확인
npx wrangler pages secret list --project-name ur-live
```

### 방법 B: Cloudflare Dashboard
1. https://dash.cloudflare.com 접속
2. Workers & Pages → **ur-live** 선택
3. Settings → Environment variables
4. Production 탭에서 **Add variable** 클릭
5. 변수명: `JWT_SECRET`
6. 값: (생성한 Secret 붙여넣기)
7. **Encrypt** 체크
8. Save

---

## 3단계: 로컬 개발 환경 설정

### `.dev.vars` 파일 생성
```bash
# 프로젝트 루트에 .dev.vars 파일 생성
cat > .dev.vars << 'EOF'
JWT_SECRET=로컬-개발용-시크릿-키-12345678
EOF
```

### `.gitignore`에 추가 (이미 추가되어 있음)
```bash
# .gitignore에 이미 포함되어 있는지 확인
grep ".dev.vars" .gitignore
```

---

## 4단계: 배포 및 검증

### 배포
```bash
npm run build
npx wrangler pages deploy dist --project-name ur-live
```

### 프로덕션 로그인 테스트
```bash
# Admin 로그인
curl -X POST https://live.ur-team.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","userType":"admin"}'

# 응답에 JWT 토큰이 포함되어 있어야 함:
# {
#   "success": true,
#   "data": {
#     "accessToken": "eyJ0eXAi...",
#     "refreshToken": "eyJ0eXAi..."
#   }
# }
```

---

## 5단계: 보안 체크리스트

- [ ] JWT_SECRET 생성 (64자 이상)
- [ ] Cloudflare Pages Production에 JWT_SECRET 추가
- [ ] .dev.vars 파일 생성 (로컬 개발용)
- [ ] .dev.vars가 .gitignore에 포함되어 있는지 확인
- [ ] 프로덕션 로그인 테스트 성공
- [ ] 기존 JWT 토큰 모두 무효화 (사용자 재로그인 필요)

---

## Secret 교체 (선택사항)

JWT_SECRET을 변경해야 하는 경우:

1. **새 Secret 생성**
2. **JWT_SECRET_NEW 추가** (기존 Secret과 병행)
3. **코드에서 두 Secret 모두 지원** (토큰 검증 시 둘 다 시도)
4. **30일 대기** (모든 Refresh Token이 만료될 때까지)
5. **JWT_SECRET_NEW → JWT_SECRET으로 이름 변경**
6. **기존 JWT_SECRET 제거**

---

## 보안 모범 사례

1. **Secret 절대 커밋 금지**: Git에 JWT_SECRET 포함 금지
2. **대시보드 접근 제한**: Cloudflare 대시보드 접근 권한 최소화
3. **2FA 활성화**: Cloudflare 계정에 2FA 설정
4. **정기 교체**: 6개월마다 JWT_SECRET 교체 권장
5. **모니터링**: 비정상 로그인 시도 감지 (Discord webhook)
6. **토큰 오용 감지**: 동일 토큰 다수 IP에서 사용 시 경고

---

## 참고 문서

- Cloudflare Pages Secrets: https://developers.cloudflare.com/pages/platform/environment-variables/
- Wrangler CLI: https://developers.cloudflare.com/workers/wrangler/
- JWT Best Practices: https://datatracker.ietf.org/doc/html/rfc8725
