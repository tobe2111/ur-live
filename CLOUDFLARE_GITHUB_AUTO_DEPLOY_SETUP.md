# 🚀 Cloudflare Pages GitHub 자동 배포 설정 가이드

**목표:** GitHub에 push만 하면 자동으로 live.ur-team.com에 배포되도록 설정

**예상 소요 시간:** 10-15분

---

## 📋 **사전 준비사항**

- ✅ Cloudflare 계정 (로그인 정보)
- ✅ GitHub 저장소: https://github.com/tobe2111/ur-live
- ✅ 도메인: live.ur-team.com (이미 Cloudflare에 등록됨)

---

## 🎯 **Step 1: 현재 상태 확인**

1. **Cloudflare 대시보드 접속**
   ```
   https://dash.cloudflare.com/
   ```

2. **Workers & Pages 메뉴 클릭**

3. **"ur-live" 프로젝트 확인**
   
   **A. Settings 탭에 "Builds & deployments" 섹션이 있는 경우:**
   - ✅ 이미 GitHub 연동됨
   - → Step 3으로 이동 (설정 확인)
   
   **B. Settings 탭에 "Builds & deployments" 섹션이 없는 경우:**
   - ❌ Direct Upload 방식 (wrangler로 수동 업로드)
   - → Step 2로 이동 (새 프로젝트 생성 필요)

---

## 🔧 **Step 2: 새 프로젝트 생성 (GitHub 연동)**

### **2-1. 프로젝트 생성 시작**

1. **"Create application" 버튼 클릭**
2. **"Pages" 탭 선택**
3. **"Connect to Git" 버튼 클릭**

### **2-2. GitHub 계정 연결**

1. **"Connect GitHub" 클릭**
2. **GitHub 로그인**
3. **저장소 접근 권한 부여**
   - "Install & Authorize" 클릭
   - "tobe2111/ur-live" 선택 (또는 All repositories)

### **2-3. 저장소 선택**

1. **저장소 목록에서 "ur-live" 선택**
2. **"Begin setup" 클릭**

### **2-4. Build 설정**

```yaml
Project name: ur-live
Production branch: main

Build settings:
├─ Framework preset: None
├─ Build command: npm run build:kr
├─ Build output directory: dist
└─ Root directory: (비워둠)
```

**입력 화면:**

```
┌─────────────────────────────────────────┐
│ Set up builds and deployments          │
├─────────────────────────────────────────┤
│ Project name                            │
│ [ur-live                             ]  │
│                                         │
│ Production branch                       │
│ [main                                ]  │
│                                         │
│ Framework preset                        │
│ [None                                ▼] │
│                                         │
│ Build command                           │
│ [npm run build:kr                    ]  │
│                                         │
│ Build output directory                  │
│ [dist                                ]  │
│                                         │
│ Root directory (optional)               │
│ [                                    ]  │
└─────────────────────────────────────────┘
```

### **2-5. 환경 변수 설정 (중요!)**

**"Environment variables" 섹션에서 "Add variable" 클릭:**

#### **필수 환경변수 (KR Region):**

| 변수 이름 | 설명 | 예시 값 |
|----------|------|--------|
| `VITE_FIREBASE_API_KEY` | Firebase API Key | `AIza...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain | `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID | `your-project-id` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage | `your-project.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Sender ID | `123456789012` |
| `VITE_FIREBASE_APP_ID` | Firebase App ID | `1:123456789012:web:abc` |
| `VITE_KAKAO_REST_API_KEY` | Kakao REST API Key | (보유한 키 입력) |
| `VITE_KAKAO_JAVASCRIPT_KEY` | Kakao JS Key | (보유한 키 입력) |
| `VITE_TOSS_CLIENT_KEY` | Toss Client Key | `test_gck_...` |

#### **선택 환경변수:**

| 변수 이름 | 설명 |
|----------|------|
| `VITE_SENTRY_DSN` | Sentry 에러 추적 |
| `VITE_FIREBASE_MEASUREMENT_ID` | Firebase Analytics |

**입력 방법:**
1. "Add variable" 클릭
2. Variable name 입력 (예: `VITE_FIREBASE_API_KEY`)
3. Value 입력
4. "Add" 클릭
5. 모든 변수에 대해 반복

### **2-6. 배포 시작**

1. **"Save and Deploy" 버튼 클릭**
2. **첫 배포 진행 (약 3-5분 소요)**
   - Build 로그 실시간 확인 가능
   - 성공 시 "Success" 표시
   - 실패 시 로그에서 에러 확인

### **2-7. Custom Domain 설정**

배포 성공 후:

1. **Settings 탭 → Custom domains**
2. **"Set up a custom domain" 클릭**
3. **도메인 입력: `live.ur-team.com`**
4. **DNS 설정:**
   - 자동 설정 또는
   - 수동 설정 (CNAME 레코드 추가)
   
   ```
   Type: CNAME
   Name: live
   Target: ur-live.pages.dev
   ```

5. **"Activate domain" 클릭**
6. **SSL/TLS 자동 활성화 (수분 소요)**

---

## ✅ **Step 3: 설정 확인 및 최적화**

### **3-1. Build 설정 확인**

**Settings → Builds & deployments:**

```yaml
✓ Production branch: main
✓ Preview branches: All branches (or None)
✓ Build command: npm run build:kr
✓ Build output directory: dist
✓ Root directory: /
✓ Node version: 20.x (자동 감지)
```

### **3-2. 빌드 캐시 활성화 (선택)**

**Settings → Builds & deployments → Build cache:**
- ✅ "Enable build cache" 체크
- 빌드 시간 단축 (약 30-40% 빠름)

### **3-3. Preview 배포 설정**

**Settings → Builds & deployments → Branch deployments:**

- **Production branch:** `main`
- **Preview branches:** 
  - All branches (모든 브랜치 preview 배포) 또는
  - None (main만 배포)

**권장:** `None` (main만 배포하여 비용 절감)

### **3-4. 빌드 알림 설정 (선택)**

**Settings → Notifications:**
- ✅ Email notifications
- ✅ Webhook (Discord 연동 가능)

---

## 🚀 **Step 4: 자동 배포 테스트**

### **4-1. 테스트 커밋**

로컬에서 테스트 커밋:

```bash
cd /home/user/webapp

# 빈 커밋으로 배포 테스트
git commit --allow-empty -m "test: Trigger auto-deployment"
git push origin main
```

### **4-2. 배포 모니터링**

1. **Cloudflare Pages → ur-live → Deployments**
2. **새 배포가 "In progress" 표시**
3. **로그 실시간 확인:**
   - npm install
   - npm run build:kr
   - Upload to Cloudflare
4. **성공 시 "Success" 표시 (3-5분)**

### **4-3. 배포 완료 확인**

```bash
# 브라우저에서
https://live.ur-team.com

# 또는 curl
curl -I https://live.ur-team.com
```

**예상 결과:**
```
HTTP/2 200
content-type: text/html
...
```

---

## 📊 **자동 배포 워크플로우**

### **정상 동작 시:**

```
개발자 작업
    ↓
git commit -m "feat: new feature"
    ↓
git push origin main
    ↓
GitHub (코드 저장)
    ↓
Cloudflare Pages (자동 감지)
    ↓
Build 시작 (npm run build:kr)
    ↓
빌드 성공
    ↓
Cloudflare Edge에 배포
    ↓
live.ur-team.com 자동 업데이트
    ↓
✅ 배포 완료 (3-5분)
```

### **배포 시간:**
- 빌드 시간: ~25초
- 업로드 시간: ~10초
- 전파 시간: ~5초
- **총 소요 시간: 약 1분**

---

## 🔧 **트러블슈팅**

### **문제 1: 빌드 실패 - Environment Variable Missing**

**증상:**
```
error: Missing environment variable VITE_FIREBASE_API_KEY
```

**해결:**
1. Settings → Environment variables
2. 누락된 변수 추가
3. "Retry deployment" 클릭

### **문제 2: 빌드 성공했지만 404 에러**

**증상:**
- 빌드는 성공
- 하지만 페이지가 404

**해결:**
1. Build output directory 확인: `dist` (not `/dist`)
2. Settings → Builds & deployments 확인
3. Retry deployment

### **문제 3: CSS/JS 파일이 로드 안 됨**

**증상:**
- 페이지는 뜨지만 스타일 깨짐
- 콘솔에 404 에러

**해결:**
1. Build command 확인: `npm run build:kr`
2. 로컬에서 빌드 테스트:
   ```bash
   npm run build:kr
   ls dist/assets/*.js  # 파일 존재 확인
   ```
3. Cloudflare에서 "Clear cache" 실행

### **문제 4: 배포가 트리거 안 됨**

**증상:**
- GitHub에 push했지만 배포 시작 안 됨

**해결:**
1. Settings → Builds & deployments 확인
2. "Pause deployments" 해제 확인
3. Branch 이름 확인: `main` (not `master`)
4. GitHub 연동 상태 확인:
   - Settings → Git
   - "Reconnect" 클릭

### **문제 5: 빌드 타임아웃**

**증상:**
```
Error: Build timeout after 20 minutes
```

**해결:**
1. `package.json`에서 불필요한 devDependencies 제거
2. Build command 최적화:
   ```bash
   npm ci --production=false
   npm run build:kr
   ```
3. Cloudflare 지원팀에 빌드 시간 제한 증가 요청

---

## 📝 **배포 후 체크리스트**

### **매 배포 후 확인사항:**

- [ ] Deployments 탭에서 "Success" 표시
- [ ] `live.ur-team.com` 접속 확인
- [ ] 콘솔에 에러 없음 확인
- [ ] 주요 페이지 동작 확인:
  - [ ] 홈페이지
  - [ ] 로그인 페이지
  - [ ] 상품 목록
  - [ ] 장바구니
- [ ] Kakao SDK 로드 확인
- [ ] TossPayments SDK 로드 확인

### **주간 점검사항:**

- [ ] 배포 성공률 확인 (목표: >98%)
- [ ] 평균 빌드 시간 확인 (목표: <2분)
- [ ] 에러 로그 검토 (Sentry)
- [ ] 트래픽 모니터링 (Cloudflare Analytics)

---

## 🎯 **최종 결과**

### **Before (수동 배포):**
```
1. 로컬 빌드 (npm run build:kr)
2. wrangler 인증 확인
3. 수동 배포 (npm run deploy)
4. 배포 확인
총 소요 시간: 5-10분
```

### **After (자동 배포):**
```
1. git push origin main
2. (자동으로 모든 것이 진행됨)
3. 3분 후 live.ur-team.com 업데이트 완료
총 소요 시간: 3분 (개발자 작업: 5초)
```

### **이점:**

✅ **시간 절약:** 80% 단축 (10분 → 2분)  
✅ **실수 방지:** 수동 단계 제거  
✅ **투명성:** 모든 배포 로그 기록  
✅ **롤백 용이:** 이전 배포로 즉시 복원  
✅ **팀 협업:** 모든 팀원이 동일한 프로세스  

---

## 📚 **추가 자료**

- [Cloudflare Pages 공식 문서](https://developers.cloudflare.com/pages/)
- [GitHub Integration Guide](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [Environment Variables](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Custom Domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)

---

## 🆘 **도움이 필요하면**

1. **Cloudflare 지원팀:**
   - https://dash.cloudflare.com/ → Support
   - 평균 응답 시간: 24시간

2. **커뮤니티:**
   - https://community.cloudflare.com/
   - Discord: Cloudflare Developers

3. **GitHub Issues:**
   - https://github.com/tobe2111/ur-live/issues

---

**설정 완료 후 이 문서를 저장하고 팀원들과 공유하세요!** 📖

**마지막 업데이트:** 2026-03-05
