# 안전한 개발을 위한 실전 가이드 요약

## 🎯 문제가 발생한 이유

### 타임라인
1. **2월 11일 08:19** - 커밋 `947baa2`: 인증 중앙화 작업
   - 목적: 모든 페이지에서 `auth.ts` 유틸리티 사용
   - 변경: `LivePage.tsx`에 `isLoggedIn` 함수 import 추가

2. **충돌 발생**
   ```typescript
   // 문제 코드
   import { isLoggedIn } from '@/utils/auth'  // 함수 import
   const [isLoggedIn, setIsLoggedIn] = useState(false)  // 같은 이름 state
   
   // 런타임 에러
   if (isLoggedIn()) {  // state(boolean)를 함수로 호출 → TypeError!
   ```

3. **결과**: 모든 라이브 페이지에서 ErrorBoundary 발동

### 왜 못 잡았나?
- **컴파일 타임**: TypeScript가 variable shadowing을 허용
- **빌드 타임**: 빌드는 성공 (문법 오류 없음)
- **런타임**: 실제 실행 시에만 에러 발생

---

## ✅ 앞으로 이렇게 하세요!

### 1. 개발 전 필수 체크

#### A. 영향 범위 확인
```bash
# 변경하려는 함수/변수가 어디서 사용되는지
cd /home/user/webapp
grep -r "isLoggedIn" src/
```

#### B. 네이밍 충돌 자동 체크
```bash
# 특정 파일 체크
npm run check:conflicts src/pages/LivePage.tsx

# 전체 파일 체크
npm run check:conflicts
```

#### C. TypeScript 타입 체크
```bash
npm run type-check
```

---

### 2. 개발 중 안전한 패턴

#### ✅ Import Alias 사용 (권장)
```typescript
// ✅ 좋은 예
import { isLoggedIn as checkIsLoggedIn } from '@/utils/auth'
const [isLoggedIn, setIsLoggedIn] = useState(false)

if (checkIsLoggedIn()) {
  setIsLoggedIn(true)
}
```

#### ✅ 명확한 네이밍
```typescript
// ✅ 좋은 예
import { isLoggedIn } from '@/utils/auth'
const [isUserLoggedIn, setIsUserLoggedIn] = useState(false)

if (isLoggedIn()) {
  setIsUserLoggedIn(true)
}
```

#### ❌ 피해야 할 패턴
```typescript
// ❌ 나쁜 예
import { isLoggedIn } from '@/utils/auth'
const [isLoggedIn, setIsLoggedIn] = useState(false)  // 충돌!
```

---

### 3. 배포 전 필수 절차

#### A. 로컬 전체 체크
```bash
# 한 번에 모든 체크 실행
npm run pre-commit

# 개별 실행
npm run type-check         # TypeScript 체크
npm run check:conflicts    # 네이밍 충돌 체크
npm run build             # 빌드 테스트
```

#### B. 안전한 배포 스크립트 사용
```bash
# Preview 배포 (자동으로 모든 체크 수행)
npm run deploy:safe

# Production 배포 (확인 프롬프트 포함)
npm run deploy:safe:prod
```

---

## 🛠️ 새로 추가된 도구

### 1. 문서
- **SAFE_DEVELOPMENT_GUIDE.md**: 상세한 개발 가이드
  - 단계별 체크리스트
  - 자동화 도구 설정
  - 문제 발생 시 대응 방법

### 2. 스크립트

#### A. 안전한 배포 스크립트
```bash
./scripts/safe-deploy.sh [preview|production]
```

**수행 작업:**
1. Pre-flight 체크 (uncommitted changes)
2. TypeScript 타입 체크
3. 빌드 테스트
4. API 엔드포인트 테스트 (로컬)
5. Cloudflare Pages 배포
6. Post-deployment 체크

#### B. 네이밍 충돌 체크 스크립트
```bash
./scripts/check-naming-conflicts.sh [filename]
```

**기능:**
- import된 변수와 선언된 변수 비교
- 충돌 발견 시 경고 출력
- 전체 프로젝트 스캔 가능

### 3. NPM 스크립트

```json
{
  "type-check": "TypeScript 타입 체크",
  "check:conflicts": "네이밍 충돌 체크",
  "pre-commit": "커밋 전 모든 체크 실행",
  "deploy:safe": "안전한 Preview 배포",
  "deploy:safe:prod": "안전한 Production 배포"
}
```

---

## 📊 실전 워크플로우

### 작은 변경 (1-2개 파일)
```bash
# 1. 코드 수정
vim src/pages/LivePage.tsx

# 2. 모든 체크 실행
npm run pre-commit

# 3. 커밋
git add .
git commit -m "fix: Update LivePage authentication"

# 4. 안전한 배포
npm run deploy:safe

# 5. Preview URL 테스트
# 6. 문제 없으면 Production 배포
npm run deploy:safe:prod
```

### 대규모 변경 (여러 파일)
```bash
# 1. Feature branch 생성
git checkout -b feature/auth-centralization

# 2. 파일별로 순차 작업
# File 1
vim src/pages/HomePage.tsx
npm run pre-commit
git commit -m "feat: Centralize auth in HomePage"

# File 2
vim src/pages/LivePage.tsx
npm run pre-commit
git commit -m "feat: Centralize auth in LivePage"

# 3. 전체 테스트
npm run deploy:safe

# 4. Preview 환경에서 충분한 테스트 (1-2일)

# 5. Main에 병합
git checkout main
git merge feature/auth-centralization

# 6. Production 배포
npm run deploy:safe:prod
```

---

## 🚨 문제 발생 시 대응

### 1. 즉시 롤백
```bash
# 이전 커밋으로 되돌리기
git revert HEAD
npm run deploy:safe:prod
```

### 2. 원인 분석
```bash
# 문제 커밋 찾기
git log --oneline -10
git diff HEAD~1 HEAD

# 특정 파일 변경 이력
git log -p src/pages/LivePage.tsx
```

### 3. 수정 후 재배포
```bash
# 수정
vim src/pages/LivePage.tsx

# 체크 + 배포
npm run pre-commit
npm run deploy:safe
```

---

## 🎓 핵심 교훈

### 1. **항상 체크하라**
- 배포 전 `npm run pre-commit` 필수
- 로컬 테스트 후 Preview 배포
- Preview 테스트 후 Production 배포

### 2. **점진적으로 변경하라**
- 파일별로 나눠서 작업
- 각 단계마다 테스트
- 문제 발생 시 쉽게 롤백

### 3. **명확하게 네이밍하라**
- Import 충돌 시 alias 사용
- 변수명은 명확하고 구체적으로
- 자동 체크 스크립트 활용

### 4. **자동화를 활용하라**
- 안전한 배포 스크립트 사용
- Pre-commit hook 설정
- CI/CD 파이프라인 구축

### 5. **문서화하라**
- 주요 변경사항 기록
- 알려진 이슈 문서화
- 해결 방법 공유

---

## 📚 참고 파일

- `SAFE_DEVELOPMENT_GUIDE.md`: 상세 가이드
- `scripts/safe-deploy.sh`: 자동 배포 스크립트
- `scripts/check-naming-conflicts.sh`: 충돌 체크 스크립트
- `package.json`: NPM 스크립트 정의

---

## 🎯 다음 단계

1. **지금 바로 실행**
   ```bash
   npm run check:conflicts  # 전체 프로젝트 스캔
   ```

2. **앞으로 모든 배포 시**
   ```bash
   npm run deploy:safe  # Preview 배포
   npm run deploy:safe:prod  # Production 배포
   ```

3. **팀과 공유**
   - SAFE_DEVELOPMENT_GUIDE.md 읽기
   - 새 스크립트 사용법 익히기
   - Best practices 적용

---

**작성일**: 2026-02-11  
**최종 수정**: 2026-02-11  
**작성자**: AI Development Team

**Git Commit**: `fa5b6e4` - "feat: Add comprehensive safety tools and deployment automation"
