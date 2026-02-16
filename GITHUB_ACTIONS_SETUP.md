# GitHub Actions 자동 배포 설정 완료 가이드

## ✅ 체크리스트

### 1단계: GitHub Secrets 설정
- [ ] GitHub Repository Settings 접속: https://github.com/tobe2111/ur-live/settings/secrets/actions
- [ ] `CLOUDFLARE_API_TOKEN` 추가 완료
- [ ] `CLOUDFLARE_ACCOUNT_ID` 추가 완료

### 2단계: Cloudflare API Token 생성
1. https://dash.cloudflare.com/profile/api-tokens 접속
2. "Create Token" 클릭
3. 권한 설정:
   - **Account** → Cloudflare Pages → **Edit**
4. "Continue to summary" → "Create Token"
5. 생성된 토큰 복사 (⚠️ 한 번만 표시됨!)
6. GitHub Secrets의 `CLOUDFLARE_API_TOKEN`에 붙여넣기

### 3단계: Cloudflare Account ID 확인
1. https://dash.cloudflare.com/ 접속
2. 우측 사이드바에서 Account ID 확인
3. 32자리 16진수 복사 (예: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)
4. GitHub Secrets의 `CLOUDFLARE_ACCOUNT_ID`에 붙여넣기

### 4단계: GitHub Actions 실행 확인
- [ ] https://github.com/tobe2111/ur-live/actions 접속
- [ ] "Add GitHub Actions auto-deploy workflow" 액션 확인
- [ ] 빌드 성공 (✅ 초록색 체크마크)
- [ ] 배포 완료 확인

### 5단계: 테스트
- [ ] https://live.ur-team.com/checkout 접속 (모바일)
- [ ] 결제 수단 UI 정상 표시 확인
- [ ] 반응형 레이아웃 정상 작동 확인

---

## 🔧 문제 해결

### Actions 실행 실패 시
1. Actions 탭에서 실패한 workflow 클릭
2. 빌드 로그 확인
3. 에러 메시지에 따라 아래 해결 방법 적용:

#### "Error: Unable to find project"
→ `wrangler.jsonc`의 프로젝트 이름이 `ur-live`인지 확인

#### "Error: Authentication failed"
→ `CLOUDFLARE_API_TOKEN` 재생성 및 재설정
→ 권한에 "Cloudflare Pages - Edit" 포함되어야 함

#### "Error: Account not found"
→ `CLOUDFLARE_ACCOUNT_ID` 값 재확인
→ Cloudflare 대시보드에서 정확한 ID 복사

---

## 🚀 향후 사용 방법

GitHub Actions가 설정되면:

```bash
# 1. 코드 수정
git add .
git commit -m "feat: 새로운 기능 추가"

# 2. GitHub에 푸시
git push origin main

# 3. 자동으로 빌드 & 배포됨! (3-4분 소요)
```

✨ 샌드박스 메모리 걱정 없이 자동 배포!

---

## 📊 빌드 현황

- **빌드 서버**: GitHub Actions (무료)
- **빌드 시간**: 약 2-3분
- **배포 시간**: 약 1분
- **총 소요 시간**: 3-4분
- **월 무료 한도**: 2,000분 (약 500회 빌드)

---

## 📝 커밋 히스토리

- `e675f87` - 모바일 체크아웃 반응형 수정
- `4a389b1` - requireLogin 파라미터 수정  
- `1097be2` - GitHub Actions workflow 추가 ← 현재

