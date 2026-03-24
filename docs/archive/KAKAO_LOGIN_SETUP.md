# Kakao 로그인 설정 가이드

## 📋 개요
이 프로젝트는 Kakao OAuth 2.0을 사용한 소셜 로그인을 지원합니다.

---

## 🔑 1단계: Kakao Developers 설정

### A. 애플리케이션 생성/설정
1. [Kakao Developers](https://developers.kakao.com) 접속
2. **내 애플리케이션** > 앱 선택 또는 생성
3. **앱 키** 메뉴에서 **REST API 키** 복사

### B. 플랫폼 설정
1. **플랫폼 설정** 메뉴
2. **Web 플랫폼 등록** 클릭
3. **사이트 도메인** 등록:
   - 로컬: `http://localhost:3000`
   - 프로덕션: `https://live.ur-team.com`

### C. Redirect URI 등록
1. **카카오 로그인** > **Redirect URI** 메뉴
2. 다음 URI 등록:
   ```
   http://localhost:3000/auth/kakao/callback
   https://live.ur-team.com/auth/kakao/callback
   ```

### D. 동의항목 설정
1. **카카오 로그인** > **동의항목** 메뉴
2. 다음 항목 설정:
   - ✅ **닉네임** (필수)
   - ✅ **카카오계정(이메일)** (선택 - 수집 목적: 회원 식별)
   - ✅ **프로필 사진** (선택)

### E. 카카오 로그인 활성화
1. **카카오 로그인** 메뉴
2. **활성화 설정** ON

---

## 🛠️ 2단계: 로컬 개발 환경 설정

### A. 환경 변수 설정
`.dev.vars` 파일을 생성하고 Kakao REST API Key를 입력하세요:

```bash
# .dev.vars
KAKAO_REST_API_KEY=your_actual_rest_api_key_here
KAKAO_REDIRECT_URI=http://localhost:3000/auth/kakao/callback
```

### B. 로컬 서버 재시작
```bash
npm run build
pm2 restart webapp
```

### C. 로컬 테스트
```bash
# 브라우저에서 접속
http://localhost:3000/auth/kakao
```

---

## 🚀 3단계: 프로덕션 배포

### A. Cloudflare Pages 환경 변수 설정
1. [Cloudflare Dashboard](https://dash.cloudflare.com) 접속
2. **Workers & Pages** > `toss-live-commerce` 프로젝트 선택
3. **Settings** > **Environment variables** 메뉴
4. 다음 환경 변수 추가:

```
변수명: KAKAO_REST_API_KEY
값: your_actual_rest_api_key_here
환경: Production
```

```
변수명: KAKAO_REDIRECT_URI
값: https://live.ur-team.com/auth/kakao/callback
환경: Production
```

### B. 재배포
환경 변수 추가 후 자동으로 재배포됩니다.

### C. 프로덕션 테스트
```bash
# 브라우저에서 접속
https://live.ur-team.com/auth/kakao
```

---

## 🔄 로그인 플로우

```
1. 사용자가 /auth/kakao 접속
   ↓
2. Kakao 로그인 페이지로 리다이렉트
   ↓
3. 사용자가 Kakao 계정으로 로그인
   ↓
4. /auth/kakao/callback으로 리다이렉트 (code 파라미터 포함)
   ↓
5. 서버에서 code로 access_token 요청
   ↓
6. access_token으로 사용자 정보 조회
   ↓
7. DB에 사용자 정보 저장/업데이트
   ↓
8. 세션 생성 및 홈페이지(/)로 리다이렉트
   ↓
9. 로그인 완료!
```

---

## 📝 API 엔드포인트

### 로그인 시작
```
GET /auth/kakao
→ Kakao 로그인 페이지로 리다이렉트
```

### OAuth 콜백
```
GET /auth/kakao/callback?code=xxx
→ 자동 처리 후 홈으로 리다이렉트
```

---

## 🐛 트러블슈팅

### 문제: "Redirect URI mismatch" 에러
**해결:** Kakao Developers에서 Redirect URI가 정확히 등록되었는지 확인
- `http://localhost:3000/auth/kakao/callback`
- `https://live.ur-team.com/auth/kakao/callback`

### 문제: "Invalid client" 에러
**해결:** 
- KAKAO_REST_API_KEY가 올바른지 확인
- Kakao Developers에서 카카오 로그인이 활성화되었는지 확인

### 문제: 로컬에서만 작동하고 프로덕션에서 안 됨
**해결:** Cloudflare Pages 환경 변수가 설정되었는지 확인

---

## 🔒 보안 고려사항

1. ✅ `.dev.vars`는 `.gitignore`에 포함되어 GitHub에 업로드되지 않음
2. ✅ 프로덕션 환경 변수는 Cloudflare Dashboard에서만 관리
3. ✅ REST API Key는 절대 프론트엔드 코드에 노출되지 않음
4. ✅ 세션 토큰은 24시간 후 자동 만료

---

## ✅ 체크리스트

### Kakao Developers
- [ ] 애플리케이션 생성
- [ ] REST API Key 발급
- [ ] Web 플랫폼 등록 (localhost + 프로덕션)
- [ ] Redirect URI 등록 (2개)
- [ ] 동의항목 설정 (닉네임 필수)
- [ ] 카카오 로그인 활성화

### 로컬 개발
- [ ] `.dev.vars` 파일 생성
- [ ] KAKAO_REST_API_KEY 입력
- [ ] 로컬 서버 재시작
- [ ] http://localhost:3000/auth/kakao 테스트

### 프로덕션
- [ ] Cloudflare 환경 변수 설정 (KAKAO_REST_API_KEY)
- [ ] Cloudflare 환경 변수 설정 (KAKAO_REDIRECT_URI)
- [ ] 재배포 확인
- [ ] https://live.ur-team.com/auth/kakao 테스트

---

## 📞 문의
Kakao 로그인 관련 문제가 있으면 [Kakao Developers 고객센터](https://devtalk.kakao.com)를 참고하세요.
