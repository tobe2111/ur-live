# 안전한 개발 가이드 - 충돌 및 에러 방지

## 🎯 목표
코드 추가 및 개선 시 다른 기능에 영향을 주지 않고 안전하게 배포하기

---

## 📋 필수 체크리스트

### 1️⃣ 코드 작성 전 (Planning Phase)

#### A. 영향 범위 분석
```bash
# 변경하려는 함수/변수가 어디에서 사용되는지 확인
cd /home/user/webapp
grep -r "functionName" src/

# import 되는 곳 확인
grep -r "import.*functionName" src/

# 사용 횟수 확인
grep -r "functionName" src/ | wc -l
```

**예시:**
```bash
# isLoggedIn 함수 사용처 확인
grep -r "isLoggedIn" src/ | grep -v "node_modules"

# 결과 분석:
# - src/utils/auth.ts:42:export function isLoggedIn() {
# - src/pages/LivePage.tsx:62:const [isLoggedIn, setIsLoggedIn] = useState(false)
# ❌ 충돌 발견! 이름 변경 필요
```

#### B. 네이밍 충돌 체크
```bash
# 추가하려는 변수명이 이미 존재하는지 확인
grep -n "const.*isLoggedIn\|let.*isLoggedIn\|var.*isLoggedIn" src/pages/LivePage.tsx

# import 시 alias 필요한지 확인
grep -n "isLoggedIn" src/pages/LivePage.tsx
```

#### C. 타입 호환성 확인
```typescript
// Before: 변경 전 타입 확인
type BeforeType = { id: number; name: string }

// After: 변경 후 타입 확인
type AfterType = { id: number; name: string; email?: string }

// ✅ 하위 호환성 유지 (기존 코드 동작)
// ❌ 하위 호환성 깨짐 (기존 코드 오류 발생)
```

---

### 2️⃣ 코드 작성 중 (Development Phase)

#### A. 점진적 변경 원칙
```typescript
// ❌ 나쁜 예: 한 번에 여러 파일 변경
// - HomePage.tsx 수정
// - LivePage.tsx 수정
// - CartPage.tsx 수정
// - CheckoutPage.tsx 수정
// → 문제 발생 시 원인 파악 어려움

// ✅ 좋은 예: 파일별로 변경 + 테스트
// Step 1: HomePage.tsx만 수정 → 빌드 → 테스트 → 커밋
// Step 2: LivePage.tsx만 수정 → 빌드 → 테스트 → 커밋
// Step 3: CartPage.tsx만 수정 → 빌드 → 테스트 → 커밋
```

#### B. Import Alias 사용
```typescript
// ❌ 나쁜 예: 충돌 가능
import { isLoggedIn } from '@/utils/auth'
const [isLoggedIn, setIsLoggedIn] = useState(false)

// ✅ 좋은 예: Alias로 충돌 방지
import { isLoggedIn as checkIsLoggedIn } from '@/utils/auth'
const [isLoggedIn, setIsLoggedIn] = useState(false)

// ✅ 또는 명확한 네이밍
import { isLoggedIn } from '@/utils/auth'
const [isUserLoggedIn, setIsUserLoggedIn] = useState(false)
```

#### C. 코드 작성 후 즉시 확인
```bash
# 1. TypeScript 타입 체크
cd /home/user/webapp
npx tsc --noEmit

# 2. ESLint 체크
npm run lint

# 3. 빌드 테스트
npm run build

# 4. 문법 에러 확인
grep -r "TODO\|FIXME\|XXX" src/
```

---

### 3️⃣ 테스트 단계 (Testing Phase)

#### A. 로컬 빌드 테스트
```bash
# 1. 전체 빌드
cd /home/user/webapp
npm run build

# 2. 빌드 결과 확인
ls -lh dist/assets/*.js | head -10

# 3. Worker 번들 크기 확인 (10MB 이하 유지)
ls -lh dist/_worker.js
```

#### B. 로컬 서버 테스트
```bash
# 1. PM2로 로컬 서버 시작
fuser -k 3000/tcp 2>/dev/null || true
npm run build
pm2 start ecosystem.config.cjs
sleep 3

# 2. API 엔드포인트 테스트
curl http://localhost:3000/api/streams
curl http://localhost:3000/api/auth/user/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"user123"}'

# 3. 페이지 로드 테스트
curl http://localhost:3000/ -o /dev/null -w "%{http_code}\n"
curl http://localhost:3000/live/20 -o /dev/null -w "%{http_code}\n"

# 4. 로그 확인
pm2 logs --nostream | grep -i "error\|warning"
```

#### C. 영향 받는 페이지 모두 테스트
```bash
# 변경된 파일과 관련된 모든 페이지 테스트
# 예: auth.ts 변경 시
PAGES=(
  "/"
  "/login"
  "/live/20"
  "/cart"
  "/checkout"
  "/my-orders"
)

for page in "${PAGES[@]}"; do
  echo "Testing: $page"
  curl -s "http://localhost:3000$page" -o /dev/null -w "%{http_code}\n"
done
```

---

### 4️⃣ 배포 전 (Pre-Deployment Phase)

#### A. Git Commit 전 체크리스트
```bash
# 1. 변경 파일 확인
git status

# 2. 변경 내용 검토
git diff

# 3. 빌드 테스트
npm run build

# 4. 불필요한 파일 제외
git status | grep -E "\.log|\.bak|node_modules"

# 5. 커밋 메시지 작성 (명확하게)
git commit -m "fix: Resolve isLoggedIn naming conflict in LivePage

- Import isLoggedIn as checkIsLoggedIn to avoid state variable conflict
- Tested: HomePage, LivePage, CartPage, CheckoutPage
- No breaking changes"
```

#### B. Staging 환경 배포 (Preview URL)
```bash
# 1. 빌드
npm run build

# 2. Preview 배포
npx wrangler pages deploy dist --project-name toss-live-commerce

# 3. Preview URL 테스트
PREVIEW_URL="https://xxxxx.toss-live-commerce.pages.dev"
curl -s "$PREVIEW_URL/" -o /dev/null -w "%{http_code}\n"
curl -s "$PREVIEW_URL/live/20" -o /dev/null -w "%{http_code}\n"
curl -s "$PREVIEW_URL/api/streams" | jq .success

# 4. 브라우저 콘솔 체크
# Playwright로 에러 확인 (자동화)
```

#### C. Production 배포 전 최종 확인
```bash
# 1. Preview에서 모든 기능 테스트 완료
# 2. 주요 페이지 수동 테스트 완료
# 3. API 응답 정상 확인
# 4. 콘솔 에러 없음 확인

# 5. Production 배포
npm run deploy

# 6. 배포 후 즉시 확인 (5분 이내)
sleep 10
curl -s "https://live.ur-team.com/" -o /dev/null -w "%{http_code}\n"
curl -s "https://live.ur-team.com/live/20" -o /dev/null -w "%{http_code}\n"
```

---

## 🛡️ 자동화 도구 설정

### 1. ESLint 설정 강화
```bash
cd /home/user/webapp
cat > .eslintrc.json << 'EOF'
{
  "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  "rules": {
    "no-shadow": "error",
    "no-redeclare": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "prefer-const": "error"
  }
}
EOF
```

### 2. Pre-commit Hook 설정
```bash
cd /home/user/webapp
mkdir -p .husky

cat > .husky/pre-commit << 'EOF'
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "🔍 Running pre-commit checks..."

# 1. TypeScript 타입 체크
echo "📝 Checking TypeScript..."
npm run type-check || exit 1

# 2. ESLint
echo "🔧 Running ESLint..."
npm run lint || exit 1

# 3. 빌드 테스트
echo "🏗️  Testing build..."
npm run build || exit 1

echo "✅ All checks passed!"
EOF

chmod +x .husky/pre-commit
```

### 3. package.json 스크립트 추가
```json
{
  "scripts": {
    "type-check": "tsc --noEmit",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "test:build": "npm run build",
    "test:local": "npm run build && pm2 restart all",
    "test:api": "node scripts/test-api.js",
    "pre-deploy": "npm run type-check && npm run lint && npm run build"
  }
}
```

---

## 📊 체크리스트 템플릿

### 변경 작업 시 체크리스트

```markdown
## 작업: [기능명]

### ✅ 작업 전 확인
- [ ] 영향 받는 파일 목록 작성
- [ ] 네이밍 충돌 확인 (grep -r)
- [ ] 타입 호환성 확인
- [ ] 기존 테스트 코드 확인

### ✅ 개발 중 확인
- [ ] 파일별 점진적 변경
- [ ] Import alias 사용 (필요 시)
- [ ] TypeScript 타입 체크 (npx tsc --noEmit)
- [ ] 빌드 테스트 (npm run build)

### ✅ 테스트
- [ ] 로컬 빌드 성공
- [ ] 로컬 서버 테스트 (curl 테스트)
- [ ] 영향 받는 모든 페이지 테스트
- [ ] API 엔드포인트 테스트
- [ ] 브라우저 콘솔 에러 확인

### ✅ 배포 전
- [ ] Git commit 메시지 명확하게 작성
- [ ] Preview URL 배포 및 테스트
- [ ] 주요 기능 수동 테스트
- [ ] 롤백 계획 수립

### ✅ 배포 후
- [ ] Production URL 즉시 확인
- [ ] 주요 페이지 정상 동작 확인
- [ ] 에러 모니터링 (5분간)
- [ ] 문제 발생 시 즉시 롤백
```

---

## 🚨 문제 발생 시 대응

### 1. 즉시 롤백
```bash
# 1. 이전 커밋으로 되돌리기
git log --oneline -5  # 이전 커밋 확인
git revert HEAD  # 최신 커밋 되돌리기

# 2. 빌드 및 재배포
npm run build
npm run deploy

# 3. 확인
curl -s "https://live.ur-team.com/" -o /dev/null -w "%{http_code}\n"
```

### 2. 에러 로그 수집
```bash
# 1. Cloudflare Workers 로그
npx wrangler pages deployment tail --project-name=toss-live-commerce

# 2. 브라우저 콘솔 캡처
# Playwright 사용

# 3. Git 히스토리 확인
git log --oneline --all --since="1 hour ago"
git diff HEAD~1 HEAD
```

### 3. 원인 분석 및 수정
```bash
# 1. 문제 커밋 찾기
git bisect start
git bisect bad HEAD
git bisect good HEAD~5

# 2. 각 커밋 테스트
npm run build && npm run deploy
# 정상: git bisect good
# 문제: git bisect bad

# 3. 문제 커밋 확인
git bisect reset
git show [problem_commit]
```

---

## 📚 권장 개발 플로우

### A. 작은 변경 (1-2개 파일)
```
1. 영향 범위 확인 (grep)
2. 코드 수정
3. TypeScript 체크
4. 빌드 테스트
5. 로컬 테스트
6. Commit
7. Preview 배포
8. 테스트
9. Production 배포
```

### B. 중간 변경 (3-5개 파일)
```
1. 영향 범위 분석 문서 작성
2. 파일별 순차 수정
   - 파일 1 수정 → 빌드 → 테스트 → 커밋
   - 파일 2 수정 → 빌드 → 테스트 → 커밋
   - ...
3. 전체 통합 테스트
4. Preview 배포
5. 주요 기능 전부 테스트
6. Production 배포
7. 모니터링 (30분)
```

### C. 대규모 변경 (6개 이상 파일 또는 Breaking Change)
```
1. 설계 문서 작성
2. 영향 범위 전체 분석
3. 테스트 계획 수립
4. Feature Branch 생성
5. 단계별 구현 + 테스트
6. Preview 환경에서 충분한 테스트 (1-2일)
7. 주요 사용자에게 Preview URL 공유
8. 피드백 수집 및 수정
9. Production 배포 (트래픽 적은 시간대)
10. 집중 모니터링 (1-2시간)
11. 문제 없으면 정식 공지
```

---

## 🎯 핵심 원칙

### 1. **점진적 변경 (Incremental Changes)**
- 한 번에 하나씩 변경
- 각 변경마다 테스트
- 문제 발생 시 쉽게 롤백

### 2. **철저한 테스트 (Thorough Testing)**
- 로컬 테스트 필수
- Preview URL 테스트 필수
- 영향 받는 모든 페이지 확인

### 3. **명확한 커밋 (Clear Commits)**
- 커밋 메시지 명확하게
- 변경 이유 설명
- 테스트 결과 포함

### 4. **빠른 피드백 (Fast Feedback)**
- 배포 후 즉시 확인
- 5분 내 주요 기능 테스트
- 문제 발견 시 즉시 롤백

### 5. **문서화 (Documentation)**
- 주요 변경사항 문서화
- 알려진 이슈 기록
- 해결 방법 공유

---

## 📖 참고 자료

- TypeScript Strict Mode: https://www.typescriptlang.org/tsconfig#strict
- ESLint Rules: https://eslint.org/docs/latest/rules/
- Git Bisect: https://git-scm.com/docs/git-bisect
- Cloudflare Workers Limits: https://developers.cloudflare.com/workers/platform/limits/

---

**마지막 업데이트**: 2026-02-11  
**작성자**: AI Development Team
