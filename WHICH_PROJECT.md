# ❓ 어느 프로젝트에 환경변수를 추가해야 하나?

## 🔍 프로젝트 확인 방법

### 1. Cloudflare Dashboard에서 확인
1. https://dash.cloudflare.com/ 로그인
2. 좌측 메뉴 → **Workers & Pages**
3. 프로젝트 목록에서 다음 중 **어느 것이 실제로 배포되어 있는지** 확인:
   - `ur-live`
   - `ur-live-kr`
   - `ur-live-working`
   - `global-marketplace`

### 2. 배포 중인 프로젝트 찾는 방법
배포 중인 프로젝트는 다음 특징이 있습니다:

✅ **Status**: "Active" 또는 초록색 체크마크  
✅ **Production URL**: `https://live.ur-team.com`로 연결됨  
✅ **최근 배포**: Latest deployment가 최근 시간 (예: "2 hours ago")

---

## 📝 환경변수 추가 단계

### Step 1: 프로젝트 선택
Cloudflare Dashboard → Workers & Pages → **[실제 배포 중인 프로젝트 클릭]**

예상 프로젝트명:
- `ur-live` (wrangler.toml 기본 이름)
- `ur-live-kr` (사용자가 언급한 이름)
- `ur-live-working` (사용자가 언급한 이름)

### Step 2: Settings → Environment variables
1. 상단 탭 → **Settings** 클릭
2. 좌측 메뉴 → **Environment variables** 클릭
3. **Production** 탭 선택 (⚠️ 중요)

### Step 3: 5개 Worker 환경변수 추가
다음 변수들을 **Add variable** 버튼으로 추가:

```
1. FIREBASE_PROJECT_ID = urteam-live-commerce-5b284
2. FIREBASE_PRIVATE_KEY = [Firebase Service Account JSON의 private_key]
3. FIREBASE_CLIENT_EMAIL = firebase-adminsdk-xxxxx@urteam-live-commerce-5b284.iam.gserviceaccount.com
4. FIREBASE_DATABASE_URL = https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app
5. KAKAO_REST_API_KEY = 5dd74bccb797640b0efd070467f3bafd
```

### Step 4: 재배포
1. **Deployments** 탭으로 이동
2. 최신 deployment 우측 **···** 메뉴
3. **Retry deployment** 클릭
4. 3분 대기

---

## 🎯 올바른 프로젝트 확인 방법

### 방법 1: Custom Domain 확인
1. Cloudflare Dashboard → Workers & Pages
2. 각 프로젝트 클릭 → **Custom domains** 탭
3. `live.ur-team.com`이 연결된 프로젝트가 **정답**

### 방법 2: Latest Deployment 확인
1. 각 프로젝트의 **Deployments** 탭 확인
2. 최근에 성공한 deployment가 있는 프로젝트가 **정답**
3. Git commit SHA와 시간 확인

### 방법 3: Production URL 접속
1. 각 프로젝트의 **기본 URL** 클릭 (예: `ur-live.pages.dev`)
2. `https://live.ur-team.com`과 같은 내용이 표시되면 **정답**

---

## ⚠️ 주의사항

### 여러 프로젝트가 있는 경우
- **Production 환경**이 연결된 프로젝트에만 환경변수 추가
- 다른 프로젝트(테스트/개발용)는 무시

### 환경변수 탭 위치
```
Workers & Pages 
  → [프로젝트 선택]
    → Settings 탭
      → Environment variables (좌측 메뉴)
        → Production 탭 ← 여기에 추가!
```

### Git 연동 확인
- **Source** 섹션에서 GitHub 레포지토리 확인
- `tobe2111/ur-live` 레포지토리가 연결된 프로젝트가 **정답**

---

## 🔗 빠른 체크

현재 배포 중인 프로젝트를 빠르게 확인하려면:

1. https://dash.cloudflare.com/ 접속
2. Workers & Pages 메뉴
3. **"live.ur-team.com"** 도메인이 연결된 프로젝트 찾기
4. 그 프로젝트 → Settings → Environment variables → Production
5. 5개 Worker 환경변수 추가

---

## 💬 답변

**"ur-live-working에 변수 입력해야 해?"**

→ **확인 필요합니다!** 

Cloudflare Dashboard → Workers & Pages에서 다음을 확인:
1. `ur-live-working` 프로젝트가 실제로 `live.ur-team.com`에 연결되어 있나?
2. Custom domains 탭에 `live.ur-team.com` 있나?
3. 최근 deployment가 성공했나?

**만약 `ur-live-working`이 맞다면**:
→ ✅ 그 프로젝트의 Production 환경변수에 5개 추가하세요.

**만약 다른 프로젝트라면** (예: `ur-live`, `ur-live-kr`):
→ ⚠️ 실제 배포 중인 프로젝트를 찾아서 거기에 추가하세요.

---

**참고 문서**: `WORKER_ENV_CHECKLIST.md`  
**GitHub**: https://github.com/tobe2111/ur-live/commit/573e4a75
