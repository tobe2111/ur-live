# 🔧 카카오 로그인 설정 가이드

## 📋 문제 상황
**카카오 로그인 시 "앱 관리자 설정 오류 (KOE006)" 발생**

---

## 🔍 원인 분석

### KOE006 오류란?
카카오 개발자 콘솔에서 **Redirect URI가 등록되지 않았거나 일치하지 않음**

### 현재 설정
```typescript
// src/pages/LivePage.tsx (254줄)
const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?
  client_id=aa88264eac0ae190a132205063753960
  &redirect_uri=${encodeURIComponent(window.location.origin + '/auth/kakao/callback')}
  &response_type=code
  &state=${encodeURIComponent(currentUrl)}`
```

### 사용 중인 Redirect URI
- **Production**: `https://live.ur-team.com/auth/kakao/callback`
- **Local**: `http://localhost:3000/auth/kakao/callback`

---

## ✅ 해결 방법

### 1. 카카오 개발자 콘솔 접속
1. https://developers.kakao.com 접속
2. 로그인
3. **내 애플리케이션** 선택
4. 해당 앱 선택 (App Key: `aa88264eac0ae190a132205063753960`)

### 2. Redirect URI 등록
1. 좌측 메뉴에서 **"카카오 로그인"** 클릭
2. **"Redirect URI 등록"** 섹션으로 이동
3. 다음 URI들을 **모두 추가**:
   ```
   https://live.ur-team.com/auth/kakao/callback
   http://localhost:3000/auth/kakao/callback (개발용)
   ```
4. **"저장"** 버튼 클릭

### 3. 활성화 설정 확인
1. **"카카오 로그인"** 활성화 상태 확인
2. **"동의 항목"** 확인:
   - 닉네임 (필수)
   - 프로필 사진 (선택)
   - 카카오계정 (이메일) (선택)

---

## 🎯 설정 체크리스트

### 필수 설정
- [ ] **앱 키 확인**: `aa88264eac0ae190a132205063753960`
- [ ] **Redirect URI 등록**: `https://live.ur-team.com/auth/kakao/callback`
- [ ] **카카오 로그인 활성화**: ON
- [ ] **동의 항목 설정**: 닉네임(필수)

### 선택 설정
- [ ] **개발용 Redirect URI**: `http://localhost:3000/auth/kakao/callback`
- [ ] **추가 동의 항목**: 이메일, 프로필 사진

---

## 🔧 코드 정보

### 카카오 로그인 사용 위치
1. **LivePage.tsx** (라이브 페이지에서 구매 버튼 클릭 시)
2. **CheckoutPage.tsx** (결제 페이지)

### OAuth 플로우
```
1. 사용자가 구매 버튼 클릭
   ↓
2. 로그인 체크 (isLoggedIn)
   ↓
3. 미로그인 시 → 카카오 로그인 리디렉션
   URL: https://kauth.kakao.com/oauth/authorize?
        client_id=aa88264eac0ae190a132205063753960
        &redirect_uri=https://live.ur-team.com/auth/kakao/callback
        &response_type=code
        &state={현재페이지URL}
   ↓
4. 카카오 로그인 완료
   ↓
5. Redirect: /auth/kakao/callback?code=xxx&state=xxx
   ↓
6. 백엔드에서 토큰 교환
   ↓
7. 원래 페이지로 복귀 (state 파라미터 사용)
```

---

## 🚨 주의사항

### Redirect URI 정확히 입력
❌ **잘못된 예시**:
- `https://live.ur-team.com/auth/kakao/callback/` (끝에 슬래시)
- `http://live.ur-team.com/auth/kakao/callback` (http)
- `https://www.live.ur-team.com/auth/kakao/callback` (www)

✅ **정확한 URI**:
- `https://live.ur-team.com/auth/kakao/callback`

### 프로토콜 주의
- Production: **HTTPS** 필수
- Local: HTTP 가능

---

## 📝 설정 완료 후 테스트

### 1. 라이브 페이지에서 테스트
```
1. https://live.ur-team.com/live/1 접속
2. 하단 상품 카드의 "구매하기" 버튼 클릭
3. 카카오 로그인 페이지로 리디렉션
4. 로그인 완료
5. 원래 라이브 페이지로 복귀
6. 로그인 상태 확인
```

### 2. 오류 확인
- ✅ 정상: 카카오 로그인 페이지로 이동
- ❌ KOE006: Redirect URI 미등록 또는 불일치
- ❌ KOE101: 앱 키 오류
- ❌ KOE201: 동의 항목 미설정

---

## 🔑 환경별 설정

### Production (live.ur-team.com)
```
App Key: aa88264eac0ae190a132205063753960
Redirect URI: https://live.ur-team.com/auth/kakao/callback
카카오 로그인: 활성화
동의 항목: 닉네임(필수), 이메일(선택)
```

### Local Development (localhost:3000)
```
App Key: aa88264eac0ae190a132205063753960
Redirect URI: http://localhost:3000/auth/kakao/callback
카카오 로그인: 활성화
동의 항목: 닉네임(필수)
```

---

## 📞 문제 해결

### KOE006 오류가 계속 발생하는 경우
1. **캐시 삭제**: 브라우저 캐시 및 쿠키 삭제
2. **URI 재확인**: 카카오 콘솔에서 URI 정확히 입력했는지 확인
3. **저장 확인**: 설정 변경 후 반드시 "저장" 클릭
4. **대기 시간**: 설정 반영까지 1-2분 소요될 수 있음

### 다른 오류 발생 시
- **KOE101**: 앱 키 확인
- **KOE201**: 동의 항목 설정
- **KOE303**: 앱이 비활성화 상태

---

## 🎉 설정 완료 확인

다음이 모두 체크되면 완료:
- [x] 카카오 개발자 콘솔에 로그인
- [x] 앱 선택 (App Key: aa88264eac0ae190a132205063753960)
- [x] Redirect URI 등록: `https://live.ur-team.com/auth/kakao/callback`
- [x] 카카오 로그인 활성화
- [x] 동의 항목 설정 (닉네임 필수)
- [x] 저장 완료
- [x] 테스트 완료

---

## 📖 참고 문서
- 카카오 개발자 문서: https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api
- 오류 코드: https://developers.kakao.com/docs/latest/ko/kakaologin/trouble-shooting

---

## 🚀 배포 정보
- **Production**: https://live.ur-team.com
- **Kakao App Key**: aa88264eac0ae190a132205063753960
- **Callback URL**: https://live.ur-team.com/auth/kakao/callback

**설정을 완료하면 카카오 로그인이 정상 작동합니다!**
