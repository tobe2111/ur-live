# Cloudflare Pages 배포 문제 해결 가이드

## 🚨 현재 상황

**문제**: 전체 페이지에서 404 Not Found 오류 발생

**원인**: Cloudflare Pages 배포가 올바른 디렉토리 구조로 되지 않음

## 📋 근본 원인 분석

### 1. 빌드 구조
```
dist/
├── _worker.js          # Cloudflare Workers 코드
├── _routes.json        # 라우팅 설정
└── client/             # 실제 웹사이트 파일
    ├── index.html
    ├── assets/
    ├── _worker.js      # 복사본
    └── _routes.json    # 복사본
```

### 2. 현재 설정
- `wrangler.toml`: `pages_build_output_dir = "dist"`  
- `vite.config.ts`: `outDir: 'dist/client'`
- `package.json build:prepare`: `dist/_worker.js` → `dist/client/_worker.js` 복사

### 3. 문제점
Cloudflare Pages가 `dist/`를 기준으로 배포하려고 하지만, 실제 웹 파일은 `dist/client/`에 있음

## ✅ 해결 방법

### 방법 1: wrangler.toml 수정 (권장)

```toml
# wrangler.toml 9번째 줄 수정
pages_build_output_dir = "dist/client"  # "dist"에서 "dist/client"로 변경
```

### 방법 2: Vite 설정 수정

```typescript
// vite.config.ts
export default defineConfig({
  // ...
  build: {
    outDir: 'dist',  // 'dist/client'에서 'dist'로 변경
    emptyOutDir: true,
  },
});
```

이 경우 `build:prepare` 스크립트도 제거 가능

### 방법 3: 배포 명령 변경

```bash
# 직접 dist/client 배포
npm run build
npx wrangler pages deploy dist/client --project-name=ur-live
```

## 🔧 즉시 적용 가능한 해결책

### Step 1: wrangler.toml 수정

```bash
cd /home/user/webapp
sed -i 's/pages_build_output_dir = "dist"/pages_build_output_dir = "dist\/client"/' wrangler.toml
```

### Step 2: 재배포

```bash
npm run build
npx wrangler pages deploy dist/client --project-name=ur-live
```

## 📝 참고사항

### 환경 변수 확인됨 ✅
- Cloudflare Pages 프로젝트 `ur-live`에 27개의 환경 변수 설정 완료
- 로컬 `.env.production`에 올바른 Firebase API 키 설정 완료
- 빌드 파일 (`dist/client/assets/index-*.js`)에 올바른 API 키 포함 확인:
  ```
  VITE_FIREBASE_API_KEY:"AIzaSyA8Lsr6o9gRjMARI-mWaFGrciRs9z2CH7s"
  ```

### API Token 문제
현재 사용 중인 Cloudflare API Token이 만료되었거나 권한 부족:
```
Error: Authentication error [code: 10000]
```

**해결**: Cloudflare 대시보드에서 새 API Token 생성 필요
- Pages 프로젝트 편집 권한 포함
- 생성 후 환경 변수에 설정:
  ```bash
  export CLOUDFLARE_API_TOKEN="새_토큰"
  ```

## 🎯 최종 권장 조치

1. **wrangler.toml 수정** (가장 간단)
   ```bash
   cd /home/user/webapp
   nano wrangler.toml  # 9번째 줄: pages_build_output_dir = "dist/client"
   ```

2. **재빌드**
   ```bash
   npm run build
   ```

3. **Cloudflare 대시보드에서 수동 배포**
   - https://dash.cloudflare.com/로 이동
   - Pages → ur-live 프로젝트 선택
   - "Create deployment" 클릭
   - `dist/client` 디렉토리 업로드

4. **또는 새 API Token 생성 후 CLI 배포**
   ```bash
   export CLOUDFLARE_API_TOKEN="새_발급받은_토큰"
   npx wrangler pages deploy dist/client --project-name=ur-live
   ```

## 📊 검증 체크리스트

배포 후 다음 사항 확인:

- [ ] https://[deployment-id].ur-live.pages.dev/ 접속 가능
- [ ] 콘솔에 `VITE_FIREBASE_API_KEY` = `AIzaSyA8Lsr6o9gRjMARI-mWaFGrciRs9z2CH7s` 확인
- [ ] 카카오 로그인 정상 작동
- [ ] `auth/api-key-not-valid` 오류 없음
- [ ] 모든 페이지 404 해결

---

**작성일**: 2026-03-18 13:45 KST  
**버전**: dist/client (179 files)  
**API Key**: AIzaSyA8Lsr6o9gRjMARI-mWaFGrciRs9z2CH7s ✅
