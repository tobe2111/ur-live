# 🚀 Cloudflare R2 활성화 가이드 (선택사항)

## ⚠️ 중요: R2는 선택사항입니다
R2를 활성화하지 않아도 시스템은 **정상 작동**합니다. Base64 인코딩 방식으로 이미지를 저장합니다.

**현재 상태:** R2 바인딩이 비활성화되어 있습니다 (배포 안정성을 위해)

## 📋 개요
이 가이드는 Cloudflare R2 Object Storage를 활성화하여 이미지 업로드 성능을 향상시키는 방법을 설명합니다.

## ⚡ R2 활성화 시 장점
- ✅ **무제한 용량**: 고화질 이미지 업로드 가능 (Base64는 1MB 제한)
- ✅ **99% 빠른 로딩**: URL만 DB에 저장 (Base64는 전체 이미지 저장)
- ✅ **무료**: 월 10GB까지 무료 (Egress 무료!)
- ✅ **CDN**: 전 세계 빠른 배포

## 🔴 R2 없이 사용하기 (기본 설정)
R2를 설정하지 않으면:
- ✅ 이미지는 Base64로 D1 데이터베이스에 저장됩니다
- ✅ 최대 1MB 크기 제한
- ✅ 추가 설정 불필요
- ⚠️ 대용량 이미지 업로드 시 성능 저하 가능

---

## 🟢 R2 활성화하기 (선택사항)

R2를 활성화하려면 아래 단계를 따르세요:

## 🔧 1단계: Cloudflare R2 활성화 (브라우저)

### 1️⃣ R2 구독
```
1. https://dash.cloudflare.com 접속
2. 좌측 메뉴 → "R2 Object Storage" 클릭
3. "Purchase R2" 또는 "Get Started" 클릭
4. 신용카드 등록 (10GB까지 무료)
5. "Subscribe" 클릭
```

### 2️⃣ R2 버킷 생성
```
1. R2 대시보드에서 "Create bucket" 클릭
2. Bucket name: ur-live-images
3. Location: Automatic
4. "Create bucket" 클릭
```

### 3️⃣ Preview 버킷 생성 (개발용)
```
1. "Create bucket" 클릭
2. Bucket name: ur-live-images-preview
3. Location: Automatic
4. "Create bucket" 클릭
```

---

## 🔧 2단계: Cloudflare Pages 바인딩 설정

### Cloudflare Pages 대시보드에서:
```
1. Workers & Pages → "ur-live" 클릭
2. Settings → "Functions" 탭
3. "R2 bucket bindings" 섹션 찾기
4. "Add binding" 클릭:
   - Variable name: IMAGES
   - R2 bucket: ur-live-images
5. "Save" 클릭
```

### Preview 환경 바인딩:
```
1. Settings → "Functions" → "Preview" 탭
2. "R2 bucket bindings" 섹션
3. "Add binding" 클릭:
   - Variable name: IMAGES
   - R2 bucket: ur-live-images-preview
4. "Save" 클릭
```

---

## 🔧 3단계: wrangler.toml 수정

프로젝트 루트의 `wrangler.toml` 파일을 수정합니다:

```toml
# 아래 주석을 제거하세요:
[[r2_buckets]]
binding = "IMAGES"
bucket_name = "ur-live-images"
preview_bucket_name = "ur-live-images-preview"
```

---

## 🔧 4단계: 코드 배포

```bash
# 변경사항 커밋
git add wrangler.toml
git commit -m "feat(r2): Enable R2 bucket binding"
git push origin main

# 또는 직접 배포
npm run build
npx wrangler pages deploy dist --project-name=ur-live
```

배포 후 2-3분 기다리면 R2가 활성화됩니다.

---

## 🔧 5단계: 로컬 개발 설정 (선택사항)

로컬에서 R2를 테스트하려면:

```bash
# R2 버킷 생성 확인
npx wrangler r2 bucket list

# wrangler.toml의 주석을 제거했다면 자동으로 연결됨
# 로컬 개발 서버 실행
npm run dev
```

---

## ✅ 6단계: 테스트

### 배포 후 테스트 (약 2-3분 후):
```
1. https://live.ur-team.com/seller/products/new 접속
2. 이미지 업로드 시도
3. ✅ "R2가 활성화되지 않았습니다" 경고 사라짐
4. ✅ 고화질 이미지 (2-5MB) 업로드 가능
5. ✅ 업로드된 이미지 URL 확인: /api/images/products/...
```

### 업로드된 이미지 확인:
```
1. Cloudflare 대시보드 → R2 → ur-live-images
2. "Objects" 탭에서 업로드된 파일 확인
3. products/{seller_id}/ 폴더에 저장됨
```

---

## 📊 R2 사용량 모니터링

```
1. Cloudflare 대시보드 → R2
2. ur-live-images 버킷 클릭
3. "Metrics" 탭에서 확인:
   - 저장 용량 (10GB 무료)
   - API 요청 수
   - Egress (무료!)
```

---

## 💰 비용 (무료 할당량)

| 항목 | 무료 할당량 | 초과 시 비용 |
|------|------------|-------------|
| 저장 용량 | 10GB/월 | $0.015/GB |
| Class A 작업 (PUT) | 100만 건/월 | $4.50/백만 건 |
| Class B 작업 (GET) | 1,000만 건/월 | $0.36/백만 건 |
| Egress | **무료!** | **무료!** |

**예상 비용**: 월 1000개 상품 × 800KB = 800MB → **$0/월** ✅

---

## 🔧 문제 해결

### "R2가 활성화되지 않았습니다" 경고가 계속 표시됨
```
1. Cloudflare Pages → ur-live → Settings → Functions
2. R2 bucket bindings 확인:
   - Variable name: IMAGES (대문자)
   - Bucket: ur-live-images
3. 설정 후 재배포 (자동 또는 git push)
4. 2-3분 후 다시 테스트
```

### 이미지 업로드 실패
```
1. 브라우저 콘솔 (F12) → Console 탭 확인
2. Network 탭 → /api/seller/upload-image 요청 확인
3. Response에서 에러 메시지 확인
4. Cloudflare Workers 로그 확인:
   - Workers & Pages → ur-live → Logs
```

### R2 버킷에 이미지가 없음
```
1. 업로드가 성공했는지 확인 (200 OK)
2. R2 → ur-live-images → Objects 확인
3. products/{seller_id}/ 폴더 확인
4. 권한 문제:
   - R2 bucket binding이 올바른지 확인
   - Variable name이 정확히 "IMAGES"인지 확인
```

---

## 🎯 완료 체크리스트

### R2 사용하지 않는 경우 (기본 설정)
- [x] wrangler.toml에서 R2 바인딩 주석 처리됨
- [x] Base64 이미지 저장 방식 사용 중
- [x] 별도 설정 불필요

### R2 활성화 시
- [ ] Cloudflare R2 구독 완료
- [ ] ur-live-images 버킷 생성
- [ ] ur-live-images-preview 버킷 생성
- [ ] Cloudflare Pages R2 바인딩 설정 (Production)
- [ ] Cloudflare Pages R2 바인딩 설정 (Preview)
- [ ] wrangler.toml에서 R2 바인딩 주석 제거
- [ ] 코드 커밋 및 배포
- [ ] 자동 재배포 완료 (2-3분)
- [ ] 이미지 업로드 테스트 성공
- [ ] "R2 활성화" 경고 메시지 사라짐
- [ ] R2 버킷에 이미지 확인

---

## 📚 추가 리소스

- [Cloudflare R2 문서](https://developers.cloudflare.com/r2/)
- [R2 가격](https://www.cloudflare.com/products/r2/)
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)

---

**현재 상태: R2 비활성화 (Base64 사용 중)** ✅

R2를 활성화하려면 위의 단계를 따르세요. R2 없이도 시스템은 정상 작동합니다! 🚀
