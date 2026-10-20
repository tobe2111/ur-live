# 🚨 긴급: 프로덕션 배포 문제 해결

**현재 상황**: 2026-03-16  
**문제**: 배포는 성공했으나 모든 API가 500 에러 발생

---

## 🔴 핵심 문제

**GitHub Actions가 잘못된 경로를 배포하고 있습니다!**

```yaml
# 현재 (잘못됨)
run: npx wrangler pages deploy dist --project-name=ur-live

# 올바른 경로
run: npx wrangler pages deploy dist/client --project-name=ur-live
```

**차이점**:
- `dist/` : 빌드 결과물만 (HTML, JS, CSS)
- `dist/client/` : **_worker.js + _routes.json 포함** ← DB 바인딩 포함!

**결과**:
- ❌ Worker가 배포되지 않음
- ❌ DB 바인딩 없음 → `Cannot read properties of undefined (reading 'prepare')`
- ❌ 모든 API 500 에러

---

## ✅ 즉시 해결 방법

### 옵션 1: 수동 배포 (가장 빠름)

```bash
cd /home/user/webapp

# 1. 빌드가 최신인지 확인
ls -lh dist/client/_worker.js

# 2. 수동 배포 스크립트 실행
./deploy-manual.sh

# 또는 직접 명령어
npx wrangler pages deploy dist/client --project-name=ur-live --branch=main
```

**⚠️ 주의**: Cloudflare 인증이 필요할 수 있습니다:
```bash
npx wrangler login
```

### 옵션 2: GitHub Actions 수정 (권한 필요)

GitHub 웹에서 직접 수정:
1. https://github.com/tobe2111/ur-live/blob/main/.github/workflows/main.yml
2. 49번 줄 수정:
   ```yaml
   run: npx wrangler pages deploy dist/client --project-name=ur-live --branch=main
   ```
3. Commit 후 자동 배포 대기

---

## 🔍 문제 확인 방법

### dist vs dist/client 비교

```bash
# dist/ 구조 (잘못된 배포)
dist/
├── _routes.json
├── _worker.js
└── index.html
└── assets/

# dist/client/ 구조 (올바른 배포)
dist/client/
├── _routes.json      ← API 라우팅
├── _worker.js        ← Worker 코드 (DB 바인딩 포함!)
├── index.html
└── assets/
```

### 현재 배포된 내용 확인

```bash
# 1. Worker가 있는지 확인
curl -I https://live.ur-team.com/api/products/3

# 2. 에러 메시지
curl https://live.ur-team.com/api/products/3
# 예상: {"success":false,"error":"Cannot read properties of undefined (reading 'prepare')"}
```

---

## 📋 배포 후 확인 체크리스트

올바른 경로로 재배포 후:

```bash
# 1. API 테스트
curl https://live.ur-team.com/api/products?limit=3
# 예상: {"success":true,"data":[...]}

curl https://live.ur-team.com/api/streams?status=live
# 예상: {"success":true,"data":[...]}

# 2. 브라우저 확인
# - https://live.ur-team.com (메인 페이지 정상 로드)
# - https://live.ur-team.com/login (카카오 로그인 버튼 표시)
# - 상품 페이지 정상 로딩
```

---

## 🛠️ package.json deploy 스크립트 수정 제안

```json
{
  "scripts": {
    "deploy": "npm run build && npx wrangler pages deploy dist/client --project-name=ur-live --branch=main",
    "deploy:kr": "npm run build && npx wrangler pages deploy dist/client --project-name=ur-live",
    "deploy:global": "npm run build && npx wrangler pages deploy dist/client --project-name=ur-live-global"
  }
}
```

---

## 🎯 다음 단계

1. **즉시**: `./deploy-manual.sh` 실행 또는 수동 배포
2. **확인**: API 정상 작동 확인
3. **수정**: GitHub Actions 워크플로우 파일 수정 (권한 있는 사용자)
4. **테스트**: 다음 배포 시 자동화 정상 작동 확인

---

## ❓ FAQ

**Q: 왜 이전에는 작동했나요?**  
A: 이전에는 `dist/` 루트에 _worker.js가 있었을 수 있습니다. 빌드 구조가 변경되었습니다.

**Q: dist/client는 언제 생성되나요?**  
A: `npm run build` → `npm run build:prepare`에서 생성됩니다:
```bash
cp dist/_worker.js dist/client/_worker.js
cp dist/_routes.json dist/client/_routes.json
```

**Q: 로컬은 왜 작동하나요?**  
A: 로컬은 `npx wrangler pages dev dist`를 사용하며, wrangler.toml 설정을 참조합니다.

---

**작성**: 2026-03-16  
**우선순위**: 🔥 긴급 (CRITICAL)  
**예상 해결 시간**: 5분 (수동 배포)

---

## 📞 지원

문제가 계속되면:
1. `dist/client/_worker.js` 파일 존재 확인
2. Cloudflare Pages 대시보드에서 배포 로그 확인
3. `npx wrangler login` 실행 후 재시도
