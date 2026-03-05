# Cloudflare Pages 환경 변수 설정 가이드

## 🎯 목적
Cloudflare Pages에 카카오 REST API 키를 환경 변수로 추가하여 KOE101 오류 해결

---

## 📝 설정할 환경 변수

```bash
VITE_KAKAO_REST_API_KEY=5dd74bccb797640b0efd070467f3bafd
```

---

## 🔧 설정 방법 (Cloudflare Dashboard)

### Step 1: Cloudflare Pages 대시보드 접속

1. 브라우저에서 https://dash.cloudflare.com 접속
2. 로그인 (Jiwon@ur-team.com 계정)
3. 좌측 메뉴에서 **"Workers & Pages"** 클릭

### Step 2: ur-live 프로젝트 선택

1. Pages 탭 클릭
2. 프로젝트 목록에서 **"ur-live"** 클릭

### Step 3: 환경 변수 설정

1. 상단 탭에서 **"Settings"** 클릭
2. 좌측 메뉴에서 **"Environment variables"** 클릭 (또는 아래로 스크롤)
3. **"Production"** 섹션 찾기
4. **"Add variable"** 버튼 클릭

### Step 4: 변수 추가

다음 정보를 입력:

| 필드 | 값 |
|------|-----|
| Variable name | `VITE_KAKAO_REST_API_KEY` |
| Value | `5dd74bccb797640b0efd070467f3bafd` |
| Environment | Production (체크) |

### Step 5: 저장

1. **"Save"** 버튼 클릭
2. 변경사항이 저장되었는지 확인

### Step 6: 재배포

환경 변수가 추가되면 **자동으로 재배포**됩니다.  
또는 수동으로 재배포하려면:

1. **"Deployments"** 탭 클릭
2. 최신 배포의 **"..."** 메뉴 클릭
3. **"Retry deployment"** 선택

---

## 🧪 환경 변수 확인 방법

### 방법 1: 디버그 페이지 (권장)

배포 완료 후 다음 URL 접속:
```
https://live.ur-team.com/debug/kakao
```

**기대 결과**:
```
✅ VITE_KAKAO_REST_API_KEY: 설정됨 (5dd74bccb79...)
```

### 방법 2: 브라우저 콘솔

1. https://live.ur-team.com 접속
2. F12 키로 개발자 도구 열기
3. Console 탭에서 다음 입력:
```javascript
console.log('KAKAO_REST_API_KEY:', import.meta.env.VITE_KAKAO_REST_API_KEY)
```

**기대 결과**:
```
KAKAO_REST_API_KEY: 5dd74bccb797640b0efd070467f3bafd
```

---

## ✅ 카카오 로그인 테스트

환경 변수 설정 완료 후:

1. https://live.ur-team.com/login 접속
2. **"카카오로 시작하기"** 버튼 클릭
3. KOE101 오류 없이 카카오 로그인 페이지로 리다이렉트 확인
4. 로그인 완료 후 정상적으로 앱으로 돌아오는지 확인

---

## 🚨 주의사항

### 1. 환경 변수 적용 시간
- 환경 변수를 추가하면 **자동 재배포**가 트리거됩니다
- 재배포 완료까지 약 **1-2분** 소요
- 재배포가 완료될 때까지 기다려야 합니다

### 2. 캐시 문제
환경 변수가 즉시 반영되지 않으면:
- 브라우저 **시크릿 모드**로 테스트
- 또는 **브라우저 캐시 삭제** (Ctrl+Shift+Delete)

### 3. Preview vs Production
- **Production** 환경에만 환경 변수 추가하세요
- Preview 배포는 별도로 설정 가능하지만 현재는 불필요

---

## 🔐 보안 고려사항

### REST API 키 노출 위험
현재 클라이언트 사이드에서 REST API 키를 사용하고 있어 **보안 위험**이 있습니다.

**권장 개선 방안** (향후 작업):
1. 서버 사이드에서만 REST API 키 사용
2. 클라이언트는 JavaScript SDK만 사용
3. OAuth 플로우를 백엔드 API로 처리

**현재 구조** (임시):
```
클라이언트 -> 카카오 OAuth (REST API 키 사용)
```

**권장 구조** (향후):
```
클라이언트 -> 백엔드 API -> 카카오 OAuth (REST API 키 사용)
```

---

## 📊 현재 상태

### 로컬 환경 ✅
```bash
# .env.kr 파일
VITE_KAKAO_REST_API_KEY=5dd74bccb797640b0efd070467f3bafd
```

### Cloudflare Pages (Production) ⏳
```bash
# 설정 필요
VITE_KAKAO_REST_API_KEY=5dd74bccb797640b0efd070467f3bafd
```

---

## 🔗 유용한 링크

- Cloudflare Dashboard: https://dash.cloudflare.com
- Workers & Pages: https://dash.cloudflare.com/?to=/:account/workers-and-pages
- 디버그 페이지: https://live.ur-team.com/debug/kakao
- 카카오 개발자 콘솔: https://developers.kakao.com/console/app

---

## 📞 문제 해결

### Q: 환경 변수를 추가했는데 여전히 KOE101 오류가 발생합니다

**A**: 다음을 확인하세요:
1. 재배포가 완료되었는지 확인 (Deployments 탭)
2. 브라우저 캐시 삭제 또는 시크릿 모드 사용
3. 디버그 페이지에서 환경 변수 상태 확인
4. 카카오 개발자 콘솔에서 Redirect URI 등록 확인

### Q: 디버그 페이지에서 환경 변수가 "설정되지 않음"으로 표시됩니다

**A**: 
1. Cloudflare Pages 대시보드에서 환경 변수가 올바르게 저장되었는지 확인
2. 변수 이름이 정확히 `VITE_KAKAO_REST_API_KEY`인지 확인 (대소문자 구분)
3. Production 환경에 추가되었는지 확인
4. 재배포가 완료되었는지 확인

### Q: Cloudflare Dashboard에 접근할 수 없습니다

**A**: 
- Jiwon@ur-team.com 계정으로 로그인
- 계정에 Workers & Pages 권한이 있는지 확인
- 필요시 계정 관리자에게 문의

---

**작성일**: 2026-03-05  
**버전**: v1.0  
**상태**: ✅ 로컬 설정 완료, Cloudflare Pages 설정 대기 중
