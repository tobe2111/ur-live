# 🧹 Cloudflare Pages 프로젝트 정리 가이드

## 📊 현재 상황

### 중복된 프로젝트가 생긴 이유
1. **수동 생성**: 이전에 Cloudflare Dashboard에서 직접 프로젝트 생성
2. **테스트 프로젝트**: 개발 중 여러 번 테스트하면서 생성
3. **이름 변경**: `toss-live-commerce` → `ur-live`로 변경하면서 이전 프로젝트 남음

### 프로젝트 목록 (총 5개)
```
1. ur-live (GitHub 연결, 빌드 실패)          ← 🎯 메인 프로젝트 (유지)
   - live.ur-team.com
   - Latest build failed
   - 1h ago

2. ur-live (No Git connection)               ← ❌ 삭제 필요 (중복)
   - ur-live.pages.dev + 1 other domain
   - 3h ago

3. ur-live-global (No Git connection)        ← ❌ 삭제 필요 (중복)
   - ur-live-global.pages.dev
   - 1d ago

4. ur-live-global (GitHub 연결)              ← 🎯 메인 프로젝트 (유지)
   - world.ur-team.com
   - 1d ago

5. toss-live-commerce (No Git connection)    ← ❌ 삭제 필요 (구버전)
   - toss-live-commerce.pages.dev
   - 6d ago
```

---

## 🎯 유지할 프로젝트 (2개)

### 1. ur-live (KR 버전)
- ✅ **도메인**: live.ur-team.com
- ✅ **GitHub 연결**: tobe2111/ur-live
- ✅ **용도**: 한국 사용자용 (Kakao + Toss)
- ⚠️ **상태**: 환경 변수 설정 필요

### 2. ur-live-global (GLOBAL 버전)
- ✅ **도메인**: world.ur-team.com
- ✅ **GitHub 연결**: tobe2111/ur-live
- ✅ **용도**: 글로벌 사용자용 (Google + Stripe)
- ⚠️ **상태**: 환경 변수 설정 필요

---

## ❌ 삭제할 프로젝트 (3개)

### 1. ur-live (중복, No Git connection)
- ❌ Git 연결 없음
- ❌ 사용하지 않음
- ❌ 도메인도 pages.dev만 있음

### 2. ur-live-global (중복, No Git connection)
- ❌ Git 연결 없음
- ❌ 사용하지 않음
- ❌ 도메인도 pages.dev만 있음

### 3. toss-live-commerce (구버전)
- ❌ 6일 전 마지막 활동
- ❌ 이전 프로젝트 이름
- ❌ 더 이상 사용 안 함

---

## 🗑️ 삭제 방법 (5분)

### Step 1: Cloudflare Dashboard 접속
1. https://dash.cloudflare.com/ 접속
2. **Workers & Pages** 클릭

### Step 2: 프로젝트 삭제 (3개)

#### 삭제 1: ur-live (No Git connection)
1. **ur-live** 프로젝트 중 **"No Git connection"** 표시된 것 클릭
2. **Settings** 탭
3. 아래로 스크롤 → **Delete project** 버튼
4. 프로젝트 이름 `ur-live` 입력
5. **Delete** 확인

#### 삭제 2: ur-live-global (No Git connection)
1. **ur-live-global** 프로젝트 중 **"No Git connection"** 표시된 것 클릭
2. **Settings** 탭
3. 아래로 스크롤 → **Delete project** 버튼
4. 프로젝트 이름 `ur-live-global` 입력
5. **Delete** 확인

#### 삭제 3: toss-live-commerce
1. **toss-live-commerce** 프로젝트 클릭
2. **Settings** 탭
3. 아래로 스크롤 → **Delete project** 버튼
4. 프로젝트 이름 `toss-live-commerce` 입력
5. **Delete** 확인

---

## ✅ 삭제 후 최종 상태

### 남은 프로젝트 (2개)
```
1. ur-live
   ├─ 도메인: live.ur-team.com
   ├─ GitHub: tobe2111/ur-live (main branch)
   ├─ 빌드: npm run build:kr
   └─ 환경 변수: 20개 (Firebase 8, Kakao 3, Toss 1, 기타 8)

2. ur-live-global
   ├─ 도메인: world.ur-team.com
   ├─ GitHub: tobe2111/ur-live (main branch)
   ├─ 빌드: npm run build:global
   └─ 환경 변수: 13개 (Firebase 8, Google 1, Stripe 1, 기타 3)
```

---

## 🔧 삭제 후 해야 할 작업

### 1. ur-live 프로젝트 환경 변수 설정
```bash
# 환경 변수 가이드 보기
cat /home/user/webapp/CLOUDFLARE_ENV_VARS_COPY_PASTE.md
```

#### Cloudflare Dashboard에서:
1. **ur-live** 프로젝트 클릭 (GitHub 연결된 것)
2. **Settings** → **Environment variables** → **Production**
3. 위 파일의 **KR 프로젝트 20개 변수** 추가

### 2. ur-live-global 프로젝트 환경 변수 설정
1. **ur-live-global** 프로젝트 클릭 (GitHub 연결된 것)
2. **Settings** → **Environment variables** → **Production**
3. **GLOBAL 프로젝트 13개 변수** 추가:
   - Firebase 8개 (KR과 동일)
   - Google OAuth 1개
   - Stripe 1개
   - 기타 3개 (VITE_REGION=GLOBAL, VITE_DEFAULT_LANGUAGE=en, VITE_API_BASE_URL=https://world.ur-team.com)

### 3. 두 프로젝트 모두 재배포
**방법 A: Dashboard에서 Retry**
- Deployments → 최신 deployment → **...** → **Retry deployment**

**방법 B: Git push**
```bash
cd /home/user/webapp
git commit --allow-empty -m "trigger: Redeploy after cleanup"
git push origin main
```

---

## ⏱️ 예상 소요 시간

| 작업 | 시간 |
|------|------|
| 프로젝트 삭제 (3개) | 5분 |
| 환경 변수 설정 (ur-live) | 10분 |
| 환경 변수 설정 (ur-live-global) | 10분 |
| 재배포 대기 (자동) | 5~10분 |
| **합계** | **30~35분** |

---

## 📋 체크리스트

### 삭제 작업
- [ ] ur-live (No Git connection) 삭제
- [ ] ur-live-global (No Git connection) 삭제
- [ ] toss-live-commerce 삭제
- [ ] 남은 프로젝트 2개만 있는지 확인

### 환경 변수 설정
- [ ] ur-live: 20개 변수 추가
- [ ] ur-live-global: 13개 변수 추가

### 재배포
- [ ] ur-live: Retry deployment
- [ ] ur-live-global: Retry deployment
- [ ] live.ur-team.com 접속 확인
- [ ] world.ur-team.com 접속 확인

---

## ⚠️ 주의사항

### 삭제 시 확인할 것
1. **도메인 확인**: 
   - 삭제 전 프로젝트의 도메인이 `.pages.dev`만 있는지 확인
   - `live.ur-team.com`, `world.ur-team.com`이 있으면 삭제하면 안 됨!

2. **Git 연결 확인**:
   - "No Git connection" 표시된 것만 삭제
   - GitHub 연결된 것은 유지

3. **마지막 활동 확인**:
   - 오래된 프로젝트 (6일 전 등)는 안전하게 삭제 가능

---

## 🔗 관련 문서

- [CLOUDFLARE_ENV_VARS_COPY_PASTE.md](./CLOUDFLARE_ENV_VARS_COPY_PASTE.md) - 환경 변수 복사용
- [DB_AND_PAGE_404_ISSUE.md](./DB_AND_PAGE_404_ISSUE.md) - 404 오류 분석
- [FIX_404_COMPLETE_REPORT.md](./FIX_404_COMPLETE_REPORT.md) - 수정 보고서

---

**작성일**: 2026-03-05  
**목적**: Cloudflare Pages 프로젝트 정리 및 중복 제거  
**상태**: ⏳ 사용자 작업 필요 (Cloudflare API로 자동 삭제 불가)
