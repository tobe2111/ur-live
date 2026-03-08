# 🚨 긴급: 404 오류 최종 해결 가이드

## 📋 문제 상황

### **환경 변수는 설정됨, 하지만 여전히 404**

```
✅ 환경 변수: 17개 설정 완료
✅ Dashboard 배포: 성공
❌ 페이지 접속: 404 오류
```

**원인**: Cloudflare Pages Dashboard에서 "Retry deployment"는 **빌드를 다시 하지 않습니다**. 기존 파일만 재배포합니다.

**해결**: 로컬에서 빌드 → Wrangler로 직접 배포

---

## 🎯 **해결 방법 (5~10분)**

### **Step 1: Wrangler 로그인**

Windows PowerShell 또는 터미널에서:

```bash
cd /home/user/webapp
npx wrangler login
```

- 브라우저가 자동으로 열림
- Cloudflare 로그인
- "Allow" 클릭
- 터미널로 돌아오기

---

### **Step 2: 로컬 빌드 (이미 완료됨)**

```bash
npm run build:kr
```

→ 이미 실행되어 있으므로 **건너뛰어도 됨**

---

### **Step 3: Wrangler로 배포**

```bash
npx wrangler pages deploy dist --project-name=ur-live
```

**출력 예시**:
```
✨ Success! Uploaded 150 files (3.2 sec)

✨ Deployment complete! Take a peek over at https://xxxxx.ur-live.pages.dev
```

---

### **Step 4: 확인 (3~5분 후)**

```bash
# 메인 페이지
https://live.ur-team.com

# 라이브 페이지
https://live.ur-team.com/live/1

# 상품 페이지
https://live.ur-team.com/product/1
```

---

## 🔧 **문제 해결**

### **"Authentication required" 오류**

```bash
npx wrangler logout
npx wrangler login
```

---

### **"Project not found" 오류**

프로젝트 이름 확인:

```bash
npx wrangler pages list
```

출력에서 실제 프로젝트 이름 확인 후:

```bash
npx wrangler pages deploy dist --project-name=[실제-프로젝트-이름]
```

---

## 📊 **왜 Dashboard 배포는 안 되나요?**

### **Dashboard "Retry deployment"**
- ❌ 빌드 안 함
- ✅ 기존 파일만 재배포
- ✅ 환경 변수만 업데이트

### **Wrangler CLI 배포**
- ✅ 로컬 빌드 결과물 업로드
- ✅ 모든 파일 포함 (static/, assets/, _worker.js 등)
- ✅ 즉시 반영

---

## 🎯 **즉시 실행 명령어 3줄**

```bash
cd /home/user/webapp
npx wrangler login
npx wrangler pages deploy dist --project-name=ur-live
```

**끝!** 🎉

---

## ⚠️ **주의사항**

### **1. 프로젝트 이름 확인**

현재 `wrangler.toml`에 정의된 이름:
```toml
name = "ur-live"
```

실제 Cloudflare Pages 프로젝트 이름이 다를 수 있습니다.

확인:
```bash
npx wrangler pages list
```

---

### **2. Git 연동 vs Direct Upload**

**Dashboard에서 배포 (Git 연동)**:
- GitHub push → 자동 빌드 → 자동 배포
- ⚠️ 환경 변수 필요
- ⚠️ 빌드 시간 길음 (~10분)

**Wrangler 배포 (Direct Upload)**:
- 로컬 빌드 → 직접 업로드
- ✅ 환경 변수 로컬 `.env` 사용
- ✅ 빌드 시간 짧음 (~30초)
- ✅ 즉시 반영

---

## 🚀 **배포 후 확인 사항**

### **1. Static 파일 접근**
```bash
curl -I https://live.ur-team.com/static/live.html
```

기대 결과: `HTTP/2 200 OK`

---

### **2. 페이지 렌더링**
```
https://live.ur-team.com/live/1
```

기대 결과: 라이브 페이지 정상 표시

---

### **3. 카카오 로그인**
- 로그인 버튼 클릭
- 카카오 인증 페이지로 이동
- 로그인 후 리다이렉트

---

## 📁 **배포되는 파일 목록**

```
dist/
├── _worker.js           ← SSR Worker (필수!)
├── static/
│   ├── live.html       ← 라이브 페이지
│   ├── cart.html       ← 장바구니 페이지
│   └── ...
├── assets/             ← JS, CSS
├── index.html          ← 메인 페이지
└── ...
```

**Dashboard 배포는 `_worker.js`만 업데이트**, `static/` 폴더는 안 올라감!

---

## 🎯 **최종 체크리스트**

- [ ] Wrangler 로그인 완료
- [ ] 로컬 빌드 확인 (`dist/` 폴더 존재)
- [ ] Wrangler 배포 실행
- [ ] 배포 성공 메시지 확인
- [ ] 3~5분 대기
- [ ] https://live.ur-team.com/live/1 접속
- [ ] 404 오류 해결 확인

---

## 💡 **요약**

**문제**: Dashboard "Retry deployment"는 빌드 안 함

**해결**: 
```bash
npx wrangler login
npx wrangler pages deploy dist --project-name=ur-live
```

**시간**: 5~10분

**결과**: 404 오류 완전 해결

---

**작성일**: 2026-03-05  
**목적**: 404 오류 최종 해결 - Wrangler Direct Upload  
**상태**: ⏳ 사용자 실행 필요
