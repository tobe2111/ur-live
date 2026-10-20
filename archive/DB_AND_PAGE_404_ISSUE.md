# 🚨 DB 및 페이지 404 오류 문제 분석

## 📋 문제 상황

### 1. 페이지 404 오류
- `/live/:id` → 404
- `/product/:id` → 404
- `/cart` → 404

### 2. API는 정상 작동
- ✅ `/api/live-streams/:id` → 200 OK (데이터 반환)
- ✅ `/api/products/:id` → 200 OK (데이터 반환)

### 3. D1 Database는 연결됨
- ✅ `wrangler.toml`에 D1 Database 설정 존재
- ✅ Database ID: `d9530ba6-7a26-4c02-9295-3ce5aef112a3`
- ✅ Database Name: `toss-live-commerce-db`
- ✅ Binding: `DB`

---

## 🔍 근본 원인 분석

### 원인 1: Static HTML 파일 배포 누락
```bash
# 로컬에는 파일 존재
$ ls dist/static/
cart.html ✅
live.html ✅

# Cloudflare Pages에서 접근 불가
$ curl -I https://live.ur-team.com/static/live.html
HTTP/2 308  # Redirect to /static/live (파일 없음)
```

**문제**: Cloudflare Pages가 `dist/static/` 디렉터리를 제대로 배포하지 않음

---

### 원인 2: SSR 라우트 로직 확인
```typescript
// src/index.tsx Line 12888
app.get('/live/:id', async (c) => {
  try {
    // Cloudflare Pages에서 정적 파일 가져오기
    const staticUrl = new URL('/static/live.html', c.req.url)
    const response = await fetch(staticUrl.toString())
    let html = await response.text()
    
    // ...환경 변수 주입...
    
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    })
  } catch (err) {
    console.error('Error serving live page:', err)
    return new Response('<h1>Error loading live page</h1>', {
      status: 500,  // ❌ 실제로는 404로 처리됨
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    })
  }
})
```

**문제**: 
- `/static/live.html` 파일을 fetch하려고 하는데 파일이 없음
- 에러 핸들러가 500을 반환하려 하지만 실제로는 404

---

### 원인 3: Cloudflare Pages Direct Upload 모드
```toml
# wrangler.toml
name = "ur-live"
pages_build_output_dir = "./dist"
```

**문제**:
- Direct Upload 모드에서는 빌드를 로컬에서 수행
- `npx wrangler pages deploy dist`로 배포
- 하지만 최근 배포가 없음 (문서만 커밋됨)

---

## ✅ 해결 방안

### 방법 1: 즉시 배포 (Direct Upload) - 권장 ⭐

#### Step 1: 로컬 빌드 확인
```bash
cd /home/user/webapp
npm run build:kr

# 빌드 결과물 확인
ls -la dist/static/
# cart.html ✅
# live.html ✅
```

#### Step 2: Wrangler로 배포
```bash
# Wrangler 로그인
npx wrangler login

# Direct Upload 배포
npx wrangler pages deploy dist --project-name=ur-live-kr

# 또는 기존 프로젝트 이름으로
npx wrangler pages deploy dist --project-name=ur-live
```

#### Step 3: 배포 확인
```bash
# 3~5분 후
curl -I https://live.ur-team.com/static/live.html
# HTTP/2 200 OK ✅

curl -I https://live.ur-team.com/live/1
# HTTP/2 200 OK ✅
```

**예상 소요 시간**: 5~10분

---

### 방법 2: Git 연동 자동 배포 (장기적 해결)

#### Step 1: Cloudflare Pages 프로젝트 설정 변경
1. https://dash.cloudflare.com/ 접속
2. Workers & Pages → `ur-live` (또는 `ur-live-kr`)
3. Settings → Builds & deployments
4. **Build configuration** 설정:
   ```
   Framework preset: None
   Build command: npm run build:kr
   Build output directory: /dist
   Root directory: /
   ```
5. **Git 연동**:
   - Connect to Git: GitHub
   - Repository: `tobe2111/ur-live`
   - Production branch: `main`
   - Enable automatic deployments: ✅

#### Step 2: 환경 변수 추가
Settings → Environment variables → Production

**Build 환경 변수** (15개):
```bash
VITE_FIREBASE_API_KEY=AIzaSyCxmgG3NEXsWtHKbE425dvq5EWs3WHXOh8
VITE_FIREBASE_AUTH_DOMAIN=urteam-live-commerce-5b284.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=urteam-live-commerce-5b284
VITE_FIREBASE_STORAGE_BUCKET=urteam-live-commerce-5b284.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=352937066044
VITE_FIREBASE_APP_ID=1:352937066044:web:e5bfd5e1d8f61688e30d39
VITE_FIREBASE_MEASUREMENT_ID=G-TEST123456
VITE_FIREBASE_DATABASE_URL=https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app
VITE_KAKAO_REST_API_KEY=5dd74bccb797640b0efd070467f3bafd
VITE_KAKAO_JAVASCRIPT_KEY=975a2e7f97254b08f15dba4d177a2865
VITE_KAKAO_AUTH_URL=https://kauth.kakao.com
VITE_TOSS_CLIENT_KEY=test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
VITE_REGION=KR
VITE_DEFAULT_LANGUAGE=ko
VITE_API_BASE_URL=https://live.ur-team.com
```

**Backend 환경 변수** (5개):
```bash
KAKAO_REST_API_KEY=5dd74bccb797640b0efd070467f3bafd
JWT_SECRET=[openssl rand -base64 32로 생성]
EMAIL_FROM=UR Live <noreply@ur-team.com>
RESEND_API_KEY=[Resend에서 발급]
TOSS_SECRET_KEY=[TossPayments에서 발급]
```

#### Step 3: D1 Database 바인딩
Settings → Functions → D1 database bindings
- Variable name: `DB`
- D1 database: `toss-live-commerce-db`

#### Step 4: 첫 배포 트리거
```bash
# 빈 커밋으로 배포 트리거
git commit --allow-empty -m "trigger: Redeploy with environment variables"
git push origin main
```

**예상 소요 시간**: 30~40분 (설정 20분 + 배포 10~20분)

---

## 📊 현재 상태 요약

| 항목 | 상태 | 비고 |
|------|------|------|
| 로컬 빌드 | ✅ 정상 | dist/static/live.html 존재 |
| API 엔드포인트 | ✅ 정상 | /api/live-streams/:id 작동 |
| D1 Database | ✅ 설정됨 | wrangler.toml에 바인딩 존재 |
| Frontend 페이지 | ❌ 404 | /live/:id 접근 불가 |
| Static 파일 | ❌ 404 | /static/live.html 접근 불가 |
| Cloudflare 배포 | ❌ 미실행 | 최근 Direct Upload 없음 |
| 환경 변수 | ❌ 미설정 | Cloudflare Pages에 없음 |

---

## 🎯 즉시 실행 체크리스트

### 옵션 A: 빠른 수정 (5~10분)
- [ ] `cd /home/user/webapp`
- [ ] `npm run build:kr` (이미 완료)
- [ ] `npx wrangler login`
- [ ] `npx wrangler pages deploy dist --project-name=ur-live-kr`
- [ ] https://live.ur-team.com/live/1 접속 확인
- [ ] https://live.ur-team.com/product/1 접속 확인

### 옵션 B: 완전한 해결 (30~40분)
- [ ] Cloudflare Dashboard 접속
- [ ] Git 연동 설정
- [ ] Build configuration 설정
- [ ] 환경 변수 20개 추가
- [ ] D1 Database 바인딩
- [ ] 빈 커밋으로 배포 트리거
- [ ] 배포 완료 확인 (10~20분)

---

## ⚠️ 주의사항

### 1. Cloudflare 프로젝트 이름 확인 필요
현재 `wrangler.toml`에 정의된 프로젝트:
```toml
name = "ur-live"
```

실제 Cloudflare Pages 프로젝트 이름:
- `ur-live` ?
- `ur-live-kr` ?
- 다른 이름?

**확인 방법**:
```bash
npx wrangler pages list
```

### 2. D1 Database 데이터 확인
```bash
# 로컬 테스트 (Cloudflare 토큰 필요)
npx wrangler d1 execute toss-live-commerce-db --command "SELECT * FROM live_streams LIMIT 5"
npx wrangler d1 execute toss-live-commerce-db --command "SELECT * FROM products LIMIT 5"
```

### 3. Backend Secrets 우선순위
먼저 Frontend 환경 변수 15개만 설정하고 테스트 → 이후 Backend 5개 추가

---

## 📁 관련 파일

### 로컬
- `/home/user/webapp/dist/static/live.html` - 라이브 페이지 (존재)
- `/home/user/webapp/dist/static/cart.html` - 장바구니 페이지 (존재)
- `/home/user/webapp/wrangler.toml` - Cloudflare 설정
- `/home/user/webapp/src/index.tsx` - SSR 라우트 (L12888)

### 문서
- `/home/user/webapp/CLOUDFLARE_ENV_VARS_COPY_PASTE.md` - 환경 변수 복사용
- `/home/user/webapp/CLOUDFLARE_ENV_VARS_SETUP.md` - 전체 설정 가이드
- `/home/user/webapp/FIX_404_COMPLETE_REPORT.md` - 404 수정 보고서

---

## 🚀 빠른 명령어

```bash
# 1. Wrangler 로그인
npx wrangler login

# 2. Cloudflare 프로젝트 확인
npx wrangler pages list

# 3. 배포
npx wrangler pages deploy dist --project-name=ur-live-kr

# 4. 배포 상태 확인
npx wrangler pages deployment list --project-name=ur-live-kr

# 5. 사이트 확인
curl -I https://live.ur-team.com/live/1
curl -I https://live.ur-team.com/static/live.html
```

---

**작성일**: 2026-03-05  
**목적**: DB 및 페이지 404 오류 근본 원인 분석 및 해결 방안  
**상태**: ⏳ 분석 완료, 배포 대기
