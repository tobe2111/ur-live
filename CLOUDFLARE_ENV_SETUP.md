# Cloudflare Pages 환경변수 설정 가이드

## 🔑 필수 환경변수

### 1. Toss Payments 클라이언트 키
**변수명**: `VITE_TOSS_CLIENT_KEY`  
**값**: `test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN` (테스트)  
**용도**: 프론트엔드 결제 위젯 초기화

### 2. Toss Payments 시크릿 키
**변수명**: `TOSS_SECRET_KEY`  
**값**: `test_sk_...` (비공개)  
**용도**: 백엔드 결제 승인 API

---

## 📝 Cloudflare Pages Dashboard 설정 방법

### Step 1: Cloudflare Dashboard 접속
1. https://dash.cloudflare.com 로그인
2. **Pages** 선택
3. **toss-live-commerce** 프로젝트 선택

### Step 2: Environment Variables 설정
1. **Settings** 탭 클릭
2. **Environment variables** 섹션 찾기
3. **Add variable** 버튼 클릭

### Step 3: 변수 추가

#### Production 환경
```
Variable name: VITE_TOSS_CLIENT_KEY
Value: test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
Environment: Production
```

```
Variable name: TOSS_SECRET_KEY
Value: test_sk_zXLkKEypNArWmo50nX3G69R5gvNL (실제 값으로 교체)
Environment: Production
Type: Secret (권장)
```

#### Preview 환경 (선택)
```
Variable name: VITE_TOSS_CLIENT_KEY
Value: test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
Environment: Preview
```

```
Variable name: TOSS_SECRET_KEY
Value: test_sk_zXLkKEypNArWmo50nX3G69R5gvNL
Environment: Preview
Type: Secret
```

### Step 4: 재배포
환경변수를 설정한 후 **반드시 재배포**해야 적용됩니다:

```bash
cd /home/user/webapp
npm run deploy:prod
# 또는
npm run deploy
```

---

## ⚠️ 현재 상태

### 임시 해결책 (코드에 하드코딩)
```typescript
// src/pages/CheckoutPage.tsx
const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY || 'test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN'
```

**문제점**:
- ❌ 테스트 키가 코드에 노출됨
- ❌ Git에 커밋되어 공개 저장소에 노출될 수 있음
- ❌ 운영 키로 쉽게 전환하기 어려움

### 권장 방법 (환경변수 사용)
```typescript
// src/pages/CheckoutPage.tsx
const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY
// Cloudflare Pages Dashboard에서 설정된 값 사용
```

**장점**:
- ✅ 키가 코드에 노출되지 않음
- ✅ 환경별로 다른 키 사용 가능 (테스트/운영)
- ✅ 키 변경 시 재배포만 하면 됨

---

## 🔒 보안 주의사항

### 1. 클라이언트 키 (VITE_TOSS_CLIENT_KEY)
- **공개 가능**: 브라우저에서 보임
- **타입**: Plain text
- **용도**: 프론트엔드 결제 위젯 초기화

### 2. 시크릿 키 (TOSS_SECRET_KEY)
- **비공개 필수**: 절대 노출 금지
- **타입**: Secret (암호화됨)
- **용도**: 백엔드 결제 승인 API

### ⚠️ 절대 하지 말 것
```typescript
// ❌ 시크릿 키를 프론트엔드에 노출 금지!
const secretKey = 'test_sk_...' // 절대 안됨!

// ❌ .env 파일을 Git에 커밋 금지!
git add .env  // 절대 안됨!
```

---

## 🧪 테스트 방법

### 1. 환경변수 설정 확인
```bash
# Cloudflare Pages에서 환경변수 확인
npx wrangler pages project list
npx wrangler pages project view toss-live-commerce
```

### 2. 로컬 테스트 (.env.local)
```bash
# .env.local 파일 생성 (Git에 커밋하지 않음)
cat > .env.local << 'EOF'
VITE_TOSS_CLIENT_KEY=test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
TOSS_SECRET_KEY=test_sk_zXLkKEypNArWmo50nX3G69R5gvNL
EOF

# 로컬 개발 서버 실행
npm run dev
```

### 3. Production 테스트
```
1. https://live.ur-team.com/checkout 접속
2. 브라우저 콘솔 열기 (F12)
3. 결제 위젯 로드 확인
4. 오류 메시지 확인
```

---

## 📊 환경별 설정

### Development (로컬)
```bash
# .env.local (Git에 커밋 안됨)
VITE_TOSS_CLIENT_KEY=test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
TOSS_SECRET_KEY=test_sk_zXLkKEypNArWmo50nX3G69R5gvNL
```

### Preview (Cloudflare Pages)
```
Cloudflare Dashboard → Environment Variables
Environment: Preview
VITE_TOSS_CLIENT_KEY=test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
TOSS_SECRET_KEY=test_sk_zXLkKEypNArWmo50nX3G69R5gvNL
```

### Production (Cloudflare Pages)
```
Cloudflare Dashboard → Environment Variables
Environment: Production
VITE_TOSS_CLIENT_KEY=live_ck_... (운영 키)
TOSS_SECRET_KEY=live_sk_... (운영 시크릿 키)
```

---

## 🚀 Go-Live 체크리스트

### 운영 환경 전환 시
- [ ] Toss Payments 심사 완료
- [ ] 운영 클라이언트 키 발급받기
- [ ] 운영 시크릿 키 발급받기
- [ ] Cloudflare Pages에 운영 키 설정
- [ ] 코드에서 하드코딩된 테스트 키 제거
- [ ] 재배포 및 테스트
- [ ] 실제 결제 테스트 (소액)

---

## 🔧 문제 해결

### 1. "등록할 수 있는 결제 수단이 존재하지 않습니다"
**원인**: 클라이언트 키가 없거나 잘못됨

**해결**:
```bash
# 1. Cloudflare Dashboard에서 VITE_TOSS_CLIENT_KEY 설정 확인
# 2. 재배포
npm run deploy:prod
```

### 2. "결제 승인에 실패했습니다"
**원인**: 시크릿 키가 없거나 잘못됨

**해결**:
```bash
# 1. Cloudflare Dashboard에서 TOSS_SECRET_KEY 설정 확인
# 2. 타입을 Secret으로 설정
# 3. 재배포
```

### 3. 환경변수가 적용되지 않음
**원인**: 환경변수 설정 후 재배포하지 않음

**해결**:
```bash
# 반드시 재배포 필요!
npm run deploy:prod
```

---

## 📚 참고 자료

### Cloudflare Pages 공식 문서
- [Environment Variables](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Secrets](https://developers.cloudflare.com/pages/configuration/secrets/)

### Toss Payments 공식 문서
- [API Keys](https://docs.tosspayments.com/reference/using-api/api-keys)
- [결제위젯 SDK](https://docs.tosspayments.com/reference/widget-sdk)

### 프로젝트 문서
- `PAYMENT_WIDGET_FIX.md`: 결제 위젯 수정 가이드
- `PAYMENT_FIX_SUMMARY.md`: 결제 시스템 요약
- `SAFE_DEVELOPMENT_GUIDE.md`: 안전한 개발 가이드

---

## 📝 현재 배포 상태

### URLs
- **Preview**: https://2e24bd41.toss-live-commerce.pages.dev
- **Production**: https://live.ur-team.com

### Git 커밋
```
[main 23c465d] fix: Add fallback Toss Payments client key for testing
```

### 다음 단계
1. **브라우저 테스트**: https://live.ur-team.com/checkout
2. **환경변수 설정**: Cloudflare Dashboard
3. **하드코딩 제거**: 환경변수 설정 후 코드 정리
4. **재배포 및 최종 테스트**

---

**작성일**: 2026-02-11  
**커밋**: 23c465d  
**작성자**: AI Assistant
