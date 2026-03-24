# 🔐 토스페이먼츠 시크릿 키 설정 가이드

## 🚨 문제: 결제 승인 실패

```
POST /api/payments/confirm 400 (Bad Request)
결제 승인 실패
잘못된 시크릿키 연동 정보 입니다.
```

**원인**: Cloudflare Pages 환경 변수에 `TOSS_SECRET_KEY`가 설정되지 않음

---

## ✅ 해결 방법

### **1단계: 토스페이먼츠 시크릿 키 확인**

토스페이먼츠 개발자 센터에서 확인:
- 로그인: https://developers.tosspayments.com/
- 내 개정 → API 키
- **시크릿 키 (테스트용)** 복사

```
테스트 키 형식:
test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R
```

---

### **2단계: Cloudflare Pages에 시크릿 추가**

#### A. CLI로 추가 (추천)

```bash
cd /home/user/webapp

# Cloudflare 인증 확인
npx wrangler whoami

# 시크릿 추가
npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live
```

**프롬프트가 나타나면:**
```
Enter a secret value: 
```
→ 시크릿 키 붙여넣기 (예: `test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R`)

**확인:**
```bash
# 시크릿 목록 확인 (값은 안보임)
npx wrangler pages secret list --project-name ur-live
```

#### B. 대시보드로 추가 (대안)

1. https://dash.cloudflare.com/ 로그인
2. Pages 프로젝트 선택 (`ur-live`)
3. Settings → Environment variables
4. Production 탭
5. Add variable 클릭
   - Variable name: `TOSS_SECRET_KEY`
   - Value: `test_sk_...` (시크릿 키 붙여넣기)
   - Type: Secret (암호화됨)
6. Save

---

### **3단계: 재배포** (중요!)

시크릿 추가 후 **반드시 재배포**해야 적용됩니다:

```bash
cd /home/user/webapp

# 빌드
npm run build

# 배포
npx wrangler pages deploy dist --project-name ur-live
```

---

### **4단계: 검증**

배포 후 결제 테스트:

1. https://live.ur-team.com/checkout 접속
2. 결제하기 클릭
3. 테스트 결제 진행
4. 승인 성공 확인

**성공 로그:**
```
[Payment] 🚀 결제 승인 API 호출됨
[Payment] ✅ TOSS_SECRET_KEY 확인됨: test_sk_zXLkKEypNA...
[Payment] 🌐 토스페이먼츠 API 호출 시작...
[Payment] ✅✅✅ 승인 성공!
```

---

## 🔍 문제 진단

### 현재 상태 확인:

```bash
# 1. Cloudflare 인증 확인
npx wrangler whoami

# 2. 프로젝트 확인
npx wrangler pages project list | grep ur-live

# 3. 시크릿 목록 확인
npx wrangler pages secret list --project-name ur-live
```

---

## 📝 토스페이먼츠 키 종류

### 1. **클라이언트 키** (프론트엔드)
```javascript
// CheckoutPage.tsx에서 사용
const CLIENT_KEY = 'test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN'

// 용도: 결제 위젯 초기화
const widgets = await PaymentWidget(CLIENT_KEY, customerKey)
```

### 2. **시크릿 키** (백엔드)
```typescript
// src/index.tsx에서 사용
const secretKey = c.env.TOSS_SECRET_KEY

// 용도: 결제 승인 API 호출
const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
  headers: {
    'Authorization': 'Basic ' + btoa(secretKey + ':')
  }
})
```

---

## 🚨 보안 주의사항

### ✅ 올바른 사용:
- 시크릿 키는 **환경 변수**로 저장
- 코드에 하드코딩 금지
- Git에 커밋 금지

### ❌ 잘못된 사용:
```typescript
// ❌ 절대 이렇게 하지 마세요!
const secretKey = 'test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R'
```

### ✅ 올바른 사용:
```typescript
// ✅ 환경 변수에서 읽기
const secretKey = c.env.TOSS_SECRET_KEY
```

---

## 🎯 체크리스트

- [ ] 토스페이먼츠 시크릿 키 확인
- [ ] Cloudflare 인증 확인 (`wrangler whoami`)
- [ ] 시크릿 추가 (`wrangler pages secret put`)
- [ ] 시크릿 목록 확인 (`wrangler pages secret list`)
- [ ] 프로젝트 재배포 (`wrangler pages deploy`)
- [ ] 결제 테스트
- [ ] 승인 성공 확인

---

## 💡 트러블슈팅

### 문제 1: `wrangler` 명령어를 찾을 수 없음
```bash
npm install -g wrangler
```

### 문제 2: 인증 실패
```bash
# Cloudflare API 키 재설정
npx wrangler login
```

### 문제 3: 프로젝트를 찾을 수 없음
```bash
# 프로젝트 이름 확인
npx wrangler pages project list

# 올바른 이름 사용
npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live
```

### 문제 4: 시크릿 추가 후에도 실패
```bash
# 배포가 완료되었는지 확인
npx wrangler pages deployment list --project-name ur-live

# 최신 배포 확인
# 가장 위에 있는 배포가 Production이고 Status가 Success인지 확인
```

---

## 🚀 빠른 해결 명령어

```bash
# 1. 시크릿 추가
npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live
# → 프롬프트에서 시크릿 키 입력

# 2. 확인
npx wrangler pages secret list --project-name ur-live

# 3. 재배포
cd /home/user/webapp
npm run build
npx wrangler pages deploy dist --project-name ur-live

# 4. 테스트
# https://live.ur-team.com/checkout에서 결제 테스트
```

---

## 📚 참고 문서

- 토스페이먼츠 개발자 센터: https://developers.tosspayments.com/
- Cloudflare Pages 환경 변수: https://developers.cloudflare.com/pages/configuration/environment-variables/
- Wrangler CLI: https://developers.cloudflare.com/workers/wrangler/

---

## ✅ 최종 확인

시크릿 추가 후:

1. **대시보드 확인**:
   - https://dash.cloudflare.com/
   - ur-live 프로젝트
   - Settings → Environment variables
   - `TOSS_SECRET_KEY` 존재 확인

2. **배포 확인**:
   ```bash
   npx wrangler pages deployment list --project-name ur-live
   ```
   - 최신 배포 Status: Success

3. **결제 테스트**:
   - 장바구니 → 결제하기
   - 토스 테스트 결제
   - 승인 성공 확인

**성공하면**: "결제가 완료되었습니다!" 메시지 표시 ✅
