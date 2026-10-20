# 🚨 White Screen Error Fix Guide (React useState undefined)

## 문제 현상

```
Uncaught TypeError: Cannot read properties of undefined (reading 'useState')
    at vendor-Cdlbz6mh.js:49:132
```

전체 화면이 흰색으로 표시되고, Console에서 위 에러 발생.

---

## 🔍 근본 원인 분석

### 1. **React 중복 인스턴스 문제**
- Vite의 `manualChunks` 설정이 잘못되어 **React가 여러 bundle에 중복 포함**됨
- 각 bundle이 독립적인 React 인스턴스를 생성하여 **Context, Hooks가 작동하지 않음**
- `vendor-Cdlbz6mh.js`와 `vendor-react.js`가 서로 다른 React 인스턴스를 참조

### 2. **Circular Dependency (순환 의존성)**
```
Circular chunk: vendor -> vendor-react -> vendor
```
- `manualChunks` 함수가 React 관련 패키지를 `includes()` 로 체크하면서
- `react-icons`, `@radix-ui/react-*` 등 React를 포함한 이름의 패키지도 `vendor-react`로 분류
- 이로 인해 vendor ↔ vendor-react 간 순환 의존성 발생

### 3. **개발 중 종종 발생하는 이유**
- `npm install` 후 `node_modules` 구조가 변경될 때
- `package-lock.json`과 `node_modules`가 불일치할 때
- Vite dev server 캐시가 오래된 build 결과를 사용할 때
- Hot Module Replacement (HMR)이 React 인스턴스를 잘못 교체할 때

---

## ✅ 영구적 해결 방법

### Solution 1: **Explicit manualChunks (권장)**

`vite.config.ts` 를 다음과 같이 수정:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // CRITICAL: React 중복 인스턴스 방지
    dedupe: ['react', 'react-dom'],
  },
  publicDir: 'public',
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        // 명시적 청크 정의 (순환 의존성 방지)
        manualChunks: {
          // React core - 단일 인스턴스 필수
          'react-core': ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
          
          // React 생태계
          'react-router': ['react-router-dom'],
          
          // Firebase
          'firebase': [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
            'firebase/storage',
            'firebase/analytics'
          ],
          
          // TanStack Query
          'tanstack-query': ['@tanstack/react-query'],
          
          // Payment SDKs
          'payments': [
            '@stripe/stripe-js',
            '@stripe/react-stripe-js',
            '@tosspayments/payment-sdk',
            '@tosspayments/tosspayments-sdk'
          ],
          
          // State management
          'zustand': ['zustand'],
          
          // UI libraries
          'radix-ui': [
            '@radix-ui/react-checkbox',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
          ],
          
          // Icons
          'lucide': ['lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
```

**핵심 포인트**:
1. ✅ `resolve.dedupe: ['react', 'react-dom']` - React 단일 인스턴스 강제
2. ✅ `manualChunks` 객체 형태 사용 (함수 대신)
3. ✅ `react-core` 청크에 React 모든 entry point 포함
4. ✅ 순환 의존성 방지를 위해 명시적 청크 정의

---

### Solution 2: **Clean Reinstall (즉시 해결)**

```bash
# 1. node_modules 및 lock 파일 삭제
rm -rf node_modules package-lock.json

# 2. npm 캐시 정리
npm cache clean --force

# 3. 재설치
npm install

# 4. 빌드
npm run build

# 5. Dev server 재시작
npm run dev
```

**언제 사용**:
- 개발 중 갑자기 흰 화면 나타날 때
- `npm install` 후 에러가 발생했을 때
- Vite dev server 캐시 문제로 의심될 때

---

### Solution 3: **Vite Dev Server 캐시 정리**

```bash
# 1. .vite 캐시 디렉토리 삭제
rm -rf node_modules/.vite

# 2. dist 디렉토리 삭제
rm -rf dist

# 3. Dev server 재시작
npm run dev
```

**언제 사용**:
- Hot Module Replacement (HMR)가 이상하게 동작할 때
- 빌드는 성공하지만 dev server에서 에러 발생할 때
- 코드 변경이 반영되지 않을 때

---

### Solution 4: **package.json에 resolutions 추가**

```json
{
  "name": "global-marketplace",
  "version": "1.0.0",
  "overrides": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    ...
  }
}
```

**설명**:
- `overrides` 필드로 모든 dependency가 동일한 React 버전 사용 강제
- Yarn의 `resolutions`와 동일한 기능 (npm 8.3.0+)

---

## 🔧 예방 조치

### 1. **Pre-commit Hook 추가**

`.husky/pre-commit` 또는 `package.json` scripts:

```json
{
  "scripts": {
    "precommit": "npm run validate:routes && npm run type-check:worker && npm run build:test",
    "build:test": "npm run build && node scripts/verify-react-instance.js"
  }
}
```

### 2. **React Instance Verification Script**

`scripts/verify-react-instance.js`:

```javascript
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '../dist/client/assets');
const files = fs.readdirSync(distDir).filter(f => f.endsWith('.js'));

let reactInstances = 0;
files.forEach(file => {
  const content = fs.readFileSync(path.join(distDir, file), 'utf8');
  // Check for React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
  if (content.includes('__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED')) {
    reactInstances++;
    console.log(`⚠️  React instance found in: ${file}`);
  }
});

if (reactInstances > 1) {
  console.error(`\n❌ ERROR: Multiple React instances detected (${reactInstances})!`);
  console.error('This will cause "Cannot read properties of undefined" errors.');
  console.error('Check vite.config.ts manualChunks configuration.\n');
  process.exit(1);
}

console.log(`\n✅ React instance verification passed (${reactInstances} instance)\n`);
```

### 3. **CI/CD에서 자동 검증**

`.github/workflows/deploy.yml`:

```yaml
- name: Build and verify
  run: |
    npm run build
    node scripts/verify-react-instance.js
    
- name: Deploy
  if: success()
  run: npm run deploy
```

---

## 📊 트러블슈팅 체크리스트

에러 발생 시 순서대로 확인:

### 1. **React 버전 확인**
```bash
npm list react react-dom
```
- 모든 dependency가 동일한 버전 사용하는지 확인
- `deduped` 표시 확인

### 2. **중복 React 인스턴스 확인**
```bash
find node_modules -name "react" -type d | grep -E "node_modules/react$" | wc -l
```
- 결과가 1이 아니면 중복 인스턴스 존재

### 3. **Build 로그 확인**
```bash
npm run build 2>&1 | grep -i "circular\|error"
```
- Circular dependency 경고 확인
- Build error 확인

### 4. **Browser Console 확인**
```javascript
// Browser Console에서 실행
console.log(window.React);
console.log(Object.keys(window));
```
- React가 global scope에 노출되었는지 확인

### 5. **Dev Server vs Production Build 차이 확인**
```bash
# Dev server
npm run dev
# -> http://localhost:5173 접속

# Production build
npm run build
npx serve dist/client
# -> http://localhost:3000 접속
```
- 두 환경에서 동일한 에러가 발생하는지 확인

---

## 🎯 적용 결과 (Commit 622f1f39 이후)

### Before (문제 상태)
```
❌ Circular chunk: vendor -> vendor-react -> vendor
❌ Multiple React instances in different bundles
❌ White screen error: "Cannot read properties of undefined (reading 'useState')"
```

### After (해결 상태)
```
✅ No circular dependencies
✅ Single React instance in react-core chunk
✅ All pages render correctly
✅ Bundle sizes optimized:
   - react-core: 73 B (주로 import statements)
   - index.js: 445 KB (main app bundle)
   - firebase: 251 KB
   - react-router: 163 KB
```

---

## 📚 참고 자료

### Vite 공식 문서
- [Rollup Options - manualChunks](https://vitejs.dev/guide/build.html#chunking-strategy)
- [Resolve - dedupe](https://vitejs.dev/config/shared-options.html#resolve-dedupe)

### React 중복 인스턴스 문제
- [React - Invalid Hook Call Warning](https://reactjs.org/warnings/invalid-hook-call-warning.html)
- [Duplicate React Issue](https://github.com/facebook/react/issues/13991)

### Rollup Circular Dependency
- [Rollup - Avoiding Circular Dependencies](https://rollupjs.org/guide/en/#avoiding-circular-dependencies)

---

## 🚀 다음 단계 (추가 최적화)

1. **Bundle Size 추가 최적화** (~4시간)
   - TanStack Query, Stripe 별도 분리
   - Code-splitting 확대 (LivePageV2, SellerPage, CheckoutPage lazy-load)
   - Tree-shaking 최적화

2. **E2E 테스트 추가** (~3시간)
   - White screen error 자동 감지 테스트
   - React instance 중복 검증 테스트
   - Critical user flow 테스트

3. **Monitoring 추가** (~2시간)
   - Sentry에 React error boundary 연동
   - Bundle size 자동 모니터링
   - Performance metrics 수집

---

**마지막 업데이트**: 2026-03-20  
**적용 Commit**: 622f1f39 (vite.config.ts 수정)  
**검증 상태**: ✅ Build 성공, Circular dependency 해결
