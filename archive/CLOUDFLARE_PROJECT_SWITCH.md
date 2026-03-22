# 🔄 Cloudflare Pages 프로젝트 전환 가이드

## 현재 상황
- Git Repository: ✅ `tobe2111/ur-live` (올바름)
- Cloudflare Pages: ❓ `ur-live-working` 사용 중 (확인 필요)
- 환경변수: 기존 `ur-live` 프로젝트에 이미 설정되어 있음

## 🎯 해결 방법

### 옵션 1: Cloudflare Pages 프로젝트 이름 변경 (권장)

#### Step 1: 기존 `ur-live` 프로젝트 확인
1. https://dash.cloudflare.com/ 로그인
2. Workers & Pages 메뉴
3. **ur-live** 프로젝트 찾기
4. Settings → Environment variables 확인
   - FIREBASE_PROJECT_ID ✅
   - FIREBASE_PRIVATE_KEY ✅
   - FIREBASE_CLIENT_EMAIL ✅
   - FIREBASE_DATABASE_URL ✅
   - KAKAO_REST_API_KEY ✅

#### Step 2: `ur-live-working` 삭제
1. Workers & Pages → **ur-live-working** 선택
2. Settings → **Delete project**
3. 프로젝트 이름 입력하여 확인

#### Step 3: 기존 `ur-live` 프로젝트 재배포
1. Workers & Pages → **ur-live** 선택
2. Deployments 탭
3. **Retry deployment** 클릭
4. 또는 Git push로 자동 배포:
   ```bash
   git commit --allow-empty -m "chore: Trigger redeploy on ur-live"
   git push origin main
   ```

---

### 옵션 2: GitHub Repository 연결 확인

#### `ur-live` 프로젝트가 `ur-live` 레포지토리와 연결되어 있는지 확인

1. https://dash.cloudflare.com/
2. Workers & Pages → **ur-live**
3. Settings → **Builds & deployments**
4. **GitHub repository** 확인:
   - ✅ `tobe2111/ur-live` 연결되어 있어야 함
   - ❌ 다른 레포지토리 또는 연결 안 됨 → 재연결 필요

---

## 🧪 확인 방법

### 1. 어느 프로젝트가 배포 중인지 확인
```bash
# 최근 push 후 배포 URL 확인
curl -I https://live.ur-team.com/ 2>&1 | grep -i "cf-ray"
```

### 2. Cloudflare Pages 배포 로그 확인
1. Workers & Pages → **ur-live** 또는 **ur-live-working**
2. Deployments 탭
3. 최신 deployment 클릭
4. 배포 시간, 커밋 해시 확인

### 3. 환경변수 비교
```
ur-live (기존):
  ✅ FIREBASE_PROJECT_ID
  ✅ FIREBASE_PRIVATE_KEY
  ✅ FIREBASE_CLIENT_EMAIL
  ✅ FIREBASE_DATABASE_URL
  ✅ KAKAO_REST_API_KEY
  ✅ VITE_* (14개)

ur-live-working (새로 만든 것):
  ❌ Worker 환경변수 없음
  ✅ VITE_* (14개)
```

---

## 📝 권장 작업 순서

### 1. 기존 `ur-live` 프로젝트 확인 (2분)
- Cloudflare Dashboard에서 환경변수 모두 설정되어 있는지 확인
- GitHub 연결 상태 확인

### 2. `ur-live-working` 삭제 (1분)
- 불필요한 프로젝트 정리

### 3. `ur-live` 프로젝트 재배포 (3분)
```bash
cd /home/user/webapp
git commit --allow-empty -m "chore: Deploy to ur-live with existing env vars"
git push origin main
```

### 4. 테스트 (2분)
- https://live.ur-team.com/login
- 카카오 로그인 테스트
- 환경변수 에러 사라졌는지 확인

---

## ⚠️ 주의사항

### Custom Domain 설정
- `live.ur-team.com` 도메인이 어느 프로젝트에 연결되어 있는지 확인
- 기존 `ur-live` 프로젝트에 연결되어 있어야 함

### DNS 설정
- Cloudflare DNS에서 CNAME 레코드 확인:
  ```
  live.ur-team.com → ur-live.pages.dev
  ```

---

## 🎯 예상 결과

### Before (현재)
```
❌ ur-live-working 사용 중
❌ Worker 환경변수 누락
❌ 로그인 500 error
```

### After (전환 후)
```
✅ ur-live 사용
✅ 환경변수 모두 설정됨
✅ 로그인 정상 작동
```

---

## 🔗 빠른 링크

- Cloudflare Dashboard: https://dash.cloudflare.com/
- GitHub Repository: https://github.com/tobe2111/ur-live
- Live Site: https://live.ur-team.com/

---

**작성일**: 2026-03-17  
**예상 소요 시간**: 8분 (확인 2분 + 삭제 1분 + 재배포 3분 + 테스트 2분)
