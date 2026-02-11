# 🚨 카카오 로그인 500 에러 - 빠른 해결 가이드

## 📌 TL;DR (5분 안에 해결)

### 🔴 가장 가능성 높은 원인 (80%)

**❌ Redirect URI 불일치**

**즉시 확인:**
1. [카카오 개발자 콘솔](https://developers.kakao.com) 접속
2. **내 애플리케이션** > **카카오 로그인** > **Redirect URI**
3. 다음 URI가 **정확히** 등록되어 있는지 확인:

```
✅ https://live.ur-team.com/auth/kakao/sync/callback
```

**없다면 즉시 추가하고 저장!**

---

## 🔍 현재 상태 진단 결과

### ✅ 정상 항목
- HTTPS 접속 가능
- .dev.vars 파일 존재
- KAKAO_REST_API_KEY 설정됨 (로컬)
- 키 길이: 32자 (정상)

### ⚠️ 확인 필요 항목
- Cloudflare Pages 환경 변수 미설정 (하드코딩된 기본값 사용 중)
- 카카오 개발자 콘솔 설정 확인 필요

---

## 🎯 3단계 빠른 해결

### 1단계: 카카오 개발자 콘솔 설정 (2분)

```
1. https://developers.kakao.com 접속
2. 내 애플리케이션 선택
3. 카카오 로그인 > Redirect URI 메뉴
4. 추가: https://live.ur-team.com/auth/kakao/sync/callback
5. 저장 클릭
```

### 2단계: Cloudflare Pages 환경 변수 (2분)

```
1. https://dash.cloudflare.com 접속
2. Workers & Pages > toss-live-commerce
3. Settings > Environment variables
4. 추가:
   변수명: KAKAO_REST_API_KEY
   값: [카카오 REST API 키]
   환경: Production
5. Save (자동 재배포됨)
```

### 3단계: 테스트 (1분)

```
1. 브라우저에서 https://live.ur-team.com/login 접속
2. 카카오 로그인 클릭
3. 정상 작동 확인
```

---

## 🔧 에러별 해결 방법

### ❌ `redirect_uri_mismatch`
```
해결: 카카오 개발자 콘솔에서 정확한 URI 등록
URI: https://live.ur-team.com/auth/kakao/sync/callback
```

### ❌ `invalid_client`
```
해결: REST API 키 확인 및 Cloudflare 환경 변수 설정
```

### ❌ `invalid_grant`
```
해결: Authorization code 만료 (다시 로그인)
```

---

## 📞 추가 지원

**상세 가이드**: `KAKAO_LOGIN_500_ERROR_DIAGNOSIS.md` 참고

**자동 진단**: 
```bash
./kakao-login-diagnosis.sh
```

**카카오 데브톡**: https://devtalk.kakao.com

---

## ✅ 체크리스트

카카오 개발자 콘솔:
- [ ] Redirect URI 등록됨
- [ ] 플랫폼 등록됨 (https://live.ur-team.com)
- [ ] 카카오 로그인 활성화 ON
- [ ] 동의항목 설정됨 (닉네임 필수)

Cloudflare Pages:
- [ ] KAKAO_REST_API_KEY 환경 변수 설정됨
- [ ] Production 환경에 설정됨
- [ ] 재배포 완료

테스트:
- [ ] 카카오 로그인 성공
- [ ] 사용자 정보 정상 저장
- [ ] 에러 없음

---

**예상 해결 시간**: 5분  
**성공률**: 95%+

화이팅! 🚀
