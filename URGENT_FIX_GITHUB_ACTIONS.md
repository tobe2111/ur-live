# 🚨 URGENT: GitHub Actions 즉시 수정 필요

## 📋 문제
GitHub Actions가 계속 실패하고 있습니다:
```
Project not found: ur-live-working [code: 8000007]
```

## ⚡ 즉시 해결 (1분 소요)

### 1️⃣ 이 링크를 클릭하세요:
```
https://github.com/tobe2111/ur-live/edit/main/.github/workflows/main.yml
```

### 2️⃣ 51번 라인을 찾아서 수정:

**현재 (잘못됨):**
```yaml
run: npx wrangler pages deploy dist/client --project-name=ur-live-working --branch=main
```

**변경 후 (올바름):**
```yaml
run: npx wrangler pages deploy dist/client --project-name=ur-live --branch=main
```

### 3️⃣ 커밋 메시지:
```
fix: Update project name from ur-live-working to ur-live
```

### 4️⃣ "Commit changes" 버튼 클릭

---

## ✅ 수정 후 결과

배포가 즉시 성공합니다:
```
✨ Deployment complete! 
🌎 https://live.ur-team.com
```

---

## 🔍 변경사항 확인

1. GitHub Actions 탭: https://github.com/tobe2111/ur-live/actions
2. 새 워크플로우 실행 자동 시작
3. 3~5분 후 배포 완료

---

## 📊 현재 상태

| 항목 | 로컬 | GitHub |
|------|------|--------|
| 프로젝트명 | ✅ `ur-live` | ❌ `ur-live-working` |
| Firebase DB URL | ✅ 있음 | ✅ 있음 |
| Kakao AUTH URL | ✅ 있음 | ✅ 있음 |

**문제**: GitHub의 워크플로우 파일만 오래된 프로젝트명 사용 중

---

## 🎯 왜 이 문제가 발생했나요?

1. ✅ 로컬에서는 이미 `ur-live`로 수정 완료
2. ❌ GitHub App 권한 제한으로 워크플로우 파일 푸시 불가
3. ⚠️ GitHub에서 직접 수정 필요

---

## 🔗 Quick Links

- **수정 페이지**: https://github.com/tobe2111/ur-live/edit/main/.github/workflows/main.yml
- **Actions 확인**: https://github.com/tobe2111/ur-live/actions
- **현재 라이브**: https://live.ur-team.com

---

**⏰ 예상 소요 시간: 1분**

지금 바로 수정하세요! 🚀
