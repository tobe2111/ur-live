# 🌍 Region 전략 - 혼란 제거 방안

## 🎯 현재 문제점

### 혼란의 원인
1. **KR/GLOBAL 빌드가 분리되어 있음**
   - `npm run build` → KR 버전
   - `npm run build:global` → GLOBAL 버전
   - Cloudflare 배포 시 어떤 버전인지 불명확

2. **Runtime detection 복잡성**
   - 빌드 타임 상수 (`__IS_KR__`, `__IS_GLOBAL__`)
   - 환경 변수 (`VITE_REGION`)
   - 호스트네임 감지 (`live.ur-team.com` vs `world.ur-team.com`)

3. **배포 프로세스 복잡**
   - 2개의 별도 Cloudflare Pages 프로젝트 필요
   - 환경 변수 중복 관리
   - 도메인별 빌드 전략

---

## ✅ 해결 방안 (3가지 옵션)

### 📌 Option 1: **단일 빌드 + Runtime Detection** (권장)
**개념**: 한 번만 빌드하고, 런타임에 도메인으로 region 판단

#### 장점
- ✅ **단순함**: `npm run build` 한 번만 실행
- ✅ **배포 단순**: Cloudflare Pages 프로젝트 1개만
- ✅ **혼란 제거**: 빌드 모드 고민 불필요

#### 단점
- ❌ 번들 크기 증가 (KR + GLOBAL 코드 모두 포함)
- ❌ Tree-shaking 불가능 (Toss + Stripe 모두 번들에 포함)

#### 구현
```typescript
// src/shared/config/region.ts
export function isKorea(): boolean {
  const hostname = window.location.hostname
  return hostname.includes('live.ur-team.com') || 
         hostname.includes('kr.')
}

export function isGlobal(): boolean {
  const hostname = window.location.hostname
  return hostname.includes('world.ur-team.com') || 
         hostname.includes('global.')
}
```

```json
// package.json
{
  "build": "vite build && vite build --config vite.worker.config.ts",
  "deploy": "npm run build && wrangler pages deploy dist --project-name ur-live"
}
```

#### 배포
```bash
# 한 번만 빌드
npm run build

# ur-live 프로젝트에 배포
wrangler pages deploy dist --project-name ur-live

# 도메인 설정
# - live.ur-team.com → ur-live.pages.dev (KR 동작)
# - world.ur-team.com → ur-live.pages.dev (GLOBAL 동작)
```

---

### 📌 Option 2: **분리 빌드 + 명확한 명명** (현재)
**개념**: KR/GLOBAL 별도 빌드, 프로젝트 이름으로 구분

#### 장점
- ✅ 번들 최적화 (Tree-shaking)
- ✅ 각 region별 최소 코드만 포함

#### 단점
- ❌ **복잡함**: 2번 빌드, 2번 배포
- ❌ **혼란**: 어떤 명령어를 실행해야 하는지 헷갈림
- ❌ 환경 변수 중복 관리

#### 개선안
```json
// package.json - 명확한 명명
{
  "build:production": "npm run build:kr && npm run build:global",
  "build:kr": "vite build --mode kr && vite build --config vite.worker.config.ts",
  "build:global": "vite build --mode global && vite build --config vite.worker.config.ts",
  
  "deploy:production": "npm run deploy:kr && npm run deploy:global",
  "deploy:kr": "npm run build:kr && wrangler pages deploy dist --project-name ur-live-kr",
  "deploy:global": "npm run build:global && wrangler pages deploy dist --project-name ur-live-global"
}
```

#### 배포
```bash
# KR 버전만
npm run deploy:kr

# GLOBAL 버전만
npm run deploy:global

# 둘 다
npm run deploy:production
```

---

### 📌 Option 3: **KR만 운영 + GLOBAL 제거** (가장 단순)
**개념**: 당분간 KR만 운영, GLOBAL은 완전히 제거

#### 장점
- ✅ **극단적으로 단순**: 혼란 완전 제거
- ✅ 빌드 1번, 배포 1번
- ✅ 환경 변수 1세트만 관리

#### 단점
- ❌ 향후 글로벌 확장 시 다시 작업 필요

#### 구현
```json
// package.json - 단순화
{
  "build": "vite build --mode kr && vite build --config vite.worker.config.ts",
  "deploy": "npm run build && wrangler pages deploy dist --project-name ur-live"
}
```

```typescript
// src/shared/config/region.ts - 단순화
export function isKorea(): boolean {
  return true  // 항상 KR
}

export function isGlobal(): boolean {
  return false  // 항상 false
}
```

#### 코드 정리
```bash
# GLOBAL 관련 파일 삭제
rm -rf dist-global
rm .env.global

# vite.config.ts에서 GLOBAL 분기 제거
```

---

## 🎯 권장 방안: **Option 3 → Option 1 마이그레이션**

### Phase 1: 현재 (KR만 운영)
```
✅ 빌드: npm run build (KR 모드)
✅ 배포: Cloudflare Pages (ur-live)
✅ 도메인: live.ur-team.com
✅ Region: 항상 KR
```

### Phase 2: 글로벌 확장 시 (6개월 후)
```
✅ 빌드: npm run build (Runtime detection)
✅ 배포: Cloudflare Pages (ur-live) 동일 프로젝트
✅ 도메인:
   - live.ur-team.com → KR 동작
   - world.ur-team.com → GLOBAL 동작
✅ Region: 런타임 판단 (hostname 기반)
```

---

## 📋 즉시 적용 계획

### 1️⃣ 코드 단순화 (10분)
```typescript
// src/shared/config/region.ts
export function isKorea(): boolean {
  return true  // 당분간 항상 KR
}

export function isGlobal(): boolean {
  return false  // GLOBAL 비활성화
}

// ⚠️ 향후 확장 시 hostname 기반 detection으로 변경
```

### 2️⃣ package.json 명확화 (5분)
```json
{
  "build": "vite build --mode kr && vite build --config vite.worker.config.ts",
  "deploy": "npm run build && wrangler pages deploy dist --project-name ur-live",
  
  "// 주석": "GLOBAL 버전은 당분간 사용 안 함",
  "build:global": "echo 'GLOBAL version not implemented yet' && exit 1",
  "deploy:global": "echo 'GLOBAL version not implemented yet' && exit 1"
}
```

### 3️⃣ 환경 변수 정리 (3분)
```bash
# .env.global 삭제 (또는 주석 처리)
# dist-global 폴더 삭제
rm -rf dist-global
```

### 4️⃣ 문서 업데이트 (5분)
```markdown
# README.md

## Supported Regions
- ✅ **Korea (KR)**: live.ur-team.com (Production)
- ⏳ **Global**: Coming soon (6-12 months)

## Build & Deploy
\`\`\`bash
# Production build (KR only)
npm run build

# Deploy to Cloudflare Pages
npm run deploy
\`\`\`

## Future: Global Expansion
글로벌 버전은 다음 조건이 충족되면 활성화:
- [ ] world.ur-team.com 도메인 확보
- [ ] Stripe 계정 승인
- [ ] 영어 번역 100% 완료
- [ ] 국제 배송 파트너 계약
```

---

## 🎉 결과: 혼란 제거

### Before (복잡)
```bash
# 어떤 명령어를 써야 하지? 🤔
npm run build          # GLOBAL로 빌드됨 (실패)
npm run build:kr       # KR로 빌드됨 (성공)
npm run build:global   # GLOBAL로 빌드됨 (사용 안 함)
```

### After (단순)
```bash
# 항상 이것만 ✅
npm run build    # KR로 빌드 (유일한 명령어)
npm run deploy   # Cloudflare에 배포
```

---

## 💡 핵심 원칙

### 1. YAGNI (You Aren't Gonna Need It)
> 지금 필요 없는 기능은 만들지 마라

- GLOBAL 버전은 **지금** 필요 없음
- 6개월 내에 필요할 가능성 낮음
- 필요할 때 추가해도 늦지 않음

### 2. KISS (Keep It Simple, Stupid)
> 단순하게 유지하라

- 빌드 명령어: 1개만
- 배포 프로세스: 1개만
- Region: KR만

### 3. DRY (Don't Repeat Yourself)
> 중복을 제거하라

- 환경 변수: `.env.kr` 1개만
- Cloudflare 프로젝트: `ur-live` 1개만
- 배포 워크플로우: 1개만

---

## 🚀 실행 계획

### 지금 바로 (10분)
```bash
# 1. GLOBAL 관련 파일 정리
rm -rf dist-global

# 2. region.ts 단순화
# isKorea() → true
# isGlobal() → false

# 3. package.json 명확화
# build:global → 비활성화

# 4. 커밋 & 푸시
git add .
git commit -m "refactor: Simplify region strategy (KR only)"
git push origin main
```

### 향후 확장 시 (6개월 후)
```bash
# 1. region.ts에서 hostname detection 활성화
# isKorea() → hostname.includes('live.ur-team.com')
# isGlobal() → hostname.includes('world.ur-team.com')

# 2. world.ur-team.com 도메인 추가
# Cloudflare Pages → Custom domains → Add

# 3. Stripe 환경 변수 추가
# VITE_STRIPE_PUBLISHABLE_KEY 등

# 4. 영어 번역 파일 완성
# public/locales/en/translation.json
```

---

## ✅ 성공 기준

### 개발자 경험
- [ ] `npm run build` 한 번만 실행
- [ ] 빌드 모드 고민 불필요
- [ ] 배포 과정에서 혼란 없음

### 코드 품질
- [ ] Region 로직 단순 명확
- [ ] 불필요한 분기 제거
- [ ] 유지보수 비용 감소

### 문서
- [ ] README에 명확한 안내
- [ ] 향후 확장 계획 문서화
- [ ] 개발자 온보딩 간소화

---

**작성일**: 2026-03-05  
**작성자**: UR Live Development Team  
**버전**: v1.0 (Region Strategy Simplification)
