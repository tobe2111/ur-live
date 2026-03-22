# 🟡 카카오 로그인 오류 해결 가이드 (KOE101)

## 🚨 오류 정보

**오류 코드**: KOE101  
**오류 메시지**: "앱 관리자 설정 오류 - 서비스 설정에 오류가 있어, 이용할 수 없습니다"  
**원인**: 카카오 개발자 콘솔에서 앱 설정이 불완전함

---

## 🔍 KOE101 오류 원인

이 오류는 다음 중 하나 이상이 누락되었을 때 발생합니다:

1. ❌ **Redirect URI 미설정** 또는 잘못된 URI
2. ❌ **플랫폼 등록 누락** (Web)
3. ❌ **카카오 로그인 활성화 안 됨**
4. ❌ **도메인 등록 누락** (JavaScript 키 사용 시)
5. ❌ **앱 상태가 '개발 중'**이고 팀원/테스터 등록 안 됨

---

## ✅ 해결 방법 (단계별)

### 1️⃣ 카카오 개발자 콘솔 접속

```
https://developers.kakao.com/console/app
```

1. 내 애플리케이션 선택: **UR LIVE** (또는 해당 앱)
2. 왼쪽 메뉴에서 확인할 항목들

---

### 2️⃣ 플랫폼 설정 확인

**메뉴**: 앱 설정 > 플랫폼

#### ✅ Web 플랫폼 등록
```
사이트 도메인: https://live.ur-team.com
```

**추가해야 할 도메인**:
- `https://live.ur-team.com`
- `http://localhost:5173` (로컬 개발용)
- `https://staging.ur-team.com` (스테이징, 있다면)

#### 📸 설정 예시
```
[플랫폼]
✅ Web
   - 사이트 도메인: https://live.ur-team.com
   - 사이트 도메인: http://localhost:5173
```

---

### 3️⃣ Redirect URI 설정 (가장 중요!)

**메뉴**: 제품 설정 > 카카오 로그인

#### ✅ Redirect URI 등록
```
https://live.ur-team.com/auth/kakao/callback
```

**반드시 추가해야 할 URI**:
1. `https://live.ur-team.com/auth/kakao/callback` (프로덕션)
2. `http://localhost:5173/auth/kakao/callback` (로컬 개발)
3. `https://staging.ur-team.com/auth/kakao/callback` (스테이징, 있다면)

**⚠️ 주의사항**:
- **정확히 일치**해야 함 (끝에 `/` 있으면 안 됨!)
- HTTP vs HTTPS 구분
- 포트 번호 포함 여부 확인

#### 📸 설정 예시
```
[Redirect URI]
✅ https://live.ur-team.com/auth/kakao/callback
✅ http://localhost:5173/auth/kakao/callback
```

---

### 4️⃣ 카카오 로그인 활성화

**메뉴**: 제품 설정 > 카카오 로그인

#### ✅ 활성화 설정 상태
```
카카오 로그인 활성화 설정: ON (켜짐)
```

**OpenID Connect 활성화 설정**: ON (선택사항, 권장)

---

### 5️⃣ 동의 항목 설정

**메뉴**: 제품 설정 > 카카오 로그인 > 동의 항목

#### ✅ 필수 동의 항목
```
[필수 동의]
✅ 닉네임 (profile_nickname)
✅ 프로필 사진 (profile_image)
✅ 카카오계정 (이메일) - 선택 동의
```

**설정 방법**:
1. 각 항목 옆 "설정" 버튼 클릭
2. "필수 동의" 또는 "선택 동의" 선택
3. 수집 목적 입력 (예: "회원 가입 및 로그인")
4. 저장

---

### 6️⃣ 앱 키 확인

**메뉴**: 앱 설정 > 앱 키

#### ✅ 사용 중인 키 확인
```
JavaScript 키: 975a2e7f97254b08f15dba4d177a2865
REST API 키: [확인 필요]
```

**환경변수와 일치하는지 확인**:
```env
# .env.kr
VITE_KAKAO_APP_KEY=975a2e7f97254b08f15dba4d177a2865
VITE_KAKAO_REST_API_KEY=[REST API 키]

# Cloudflare Pages 환경변수
VITE_KAKAO_APP_KEY=975a2e7f97254b08f15dba4d177a2865
KAKAO_REST_API_KEY=[REST API 키]
```

---

### 7️⃣ 앱 상태 확인

**메뉴**: 앱 설정 > 일반

#### ✅ 앱 상태
```
앱 상태: 서비스 ON
```

**만약 '개발 중'이라면**:
- 팀원/테스터로 카카오 계정 등록 필요
- 또는 "서비스 ON"으로 변경

---

## 🔧 코드 확인 (현재 설정)

### 프론트엔드 (src/index.tsx 또는 kakao init)

현재 사용 중인 Redirect URI 확인:
```typescript
// 카카오 로그인 시작
const KAKAO_AUTH_URL = 
  `https://kauth.kakao.com/oauth/authorize?` +
  `client_id=${KAKAO_REST_API_KEY}&` +
  `redirect_uri=${encodeURIComponent('https://live.ur-team.com/auth/kakao/callback')}&` +
  `response_type=code`
```

**확인 사항**:
1. `redirect_uri`가 카카오 콘솔에 등록된 URI와 **정확히 일치**하는가?
2. URL 인코딩이 올바른가?
3. HTTPS 프로토콜 사용하는가?

---

## 🧪 테스트 방법

### 1. 로컬에서 테스트
```bash
# 1. 로컬 서버 실행
npm run dev:kr

# 2. 브라우저에서 접속
http://localhost:5173

# 3. 카카오 로그인 버튼 클릭
# → 카카오 로그인 페이지로 이동
# → 로그인 후 콜백 확인
```

### 2. 프로덕션에서 테스트
```bash
# 1. 브라우저에서 접속
https://live.ur-team.com

# 2. 카카오 로그인 버튼 클릭
# → 정상 작동 확인
```

### 3. 오류 디버깅
```javascript
// 브라우저 콘솔에서 확인
console.log('Kakao App Key:', window.Kakao?.VERSION)
console.log('Current URL:', window.location.href)
console.log('Redirect URI:', 'https://live.ur-team.com/auth/kakao/callback')
```

---

## 📋 체크리스트

### 카카오 개발자 콘솔
- [ ] 플랫폼 > Web 등록 (https://live.ur-team.com)
- [ ] 카카오 로그인 > 활성화 ON
- [ ] Redirect URI 등록 (https://live.ur-team.com/auth/kakao/callback)
- [ ] Redirect URI 등록 (http://localhost:5173/auth/kakao/callback)
- [ ] 동의 항목 > 닉네임, 프로필 사진 설정
- [ ] 앱 상태 > "서비스 ON" 또는 테스터 등록

### 코드 확인
- [ ] 환경변수에 올바른 Kakao App Key
- [ ] Redirect URI가 카카오 콘솔과 일치
- [ ] HTTPS 프로토콜 사용 (프로덕션)

### Cloudflare Pages 환경변수
- [ ] VITE_KAKAO_APP_KEY 설정
- [ ] VITE_KAKAO_REST_API_KEY 설정
- [ ] KAKAO_REST_API_KEY 설정 (백엔드)

---

## 🚀 빠른 해결 (5분)

### 단계 1: 카카오 콘솔 접속
```
https://developers.kakao.com/console/app
→ UR LIVE 앱 선택
```

### 단계 2: Redirect URI 등록
```
제품 설정 > 카카오 로그인 > Redirect URI
→ [Redirect URI 등록] 버튼 클릭
→ https://live.ur-team.com/auth/kakao/callback 입력
→ 저장
```

### 단계 3: 플랫폼 등록
```
앱 설정 > 플랫폼 > [Web 플랫폼 등록]
→ 사이트 도메인: https://live.ur-team.com
→ 저장
```

### 단계 4: 카카오 로그인 활성화
```
제품 설정 > 카카오 로그인
→ 활성화 설정: ON
→ 저장
```

### 단계 5: 테스트
```
https://live.ur-team.com
→ 카카오 로그인 클릭
→ 정상 작동 확인 ✅
```

---

## 💡 자주 발생하는 실수

### 1. Redirect URI 오타
```
❌ https://live.ur-team.com/auth/kakao/callback/  (끝에 / 있음)
✅ https://live.ur-team.com/auth/kakao/callback

❌ http://live.ur-team.com/auth/kakao/callback   (http)
✅ https://live.ur-team.com/auth/kakao/callback  (https)
```

### 2. 도메인 미등록
```
❌ 플랫폼에 도메인 미등록
✅ 앱 설정 > 플랫폼 > Web에 도메인 등록
```

### 3. 카카오 로그인 비활성화
```
❌ 제품 설정 > 카카오 로그인 > OFF
✅ 제품 설정 > 카카오 로그인 > ON
```

### 4. 앱 키 불일치
```
❌ 코드의 App Key ≠ 카카오 콘솔의 App Key
✅ 환경변수와 카카오 콘솔 키 일치 확인
```

---

## 🔗 참고 링크

- 카카오 개발자 문서: https://developers.kakao.com/docs/latest/ko/kakaologin/common
- 오류 코드 설명: https://developers.kakao.com/docs/latest/ko/kakaologin/trouble-shooting
- 카카오 로그인 가이드: https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api

---

## 📞 추가 도움이 필요하면

1. **카카오 개발자 콘솔 스크린샷 확인**
   - 앱 설정 > 플랫폼 페이지
   - 제품 설정 > 카카오 로그인 페이지
   - Redirect URI 목록

2. **브라우저 콘솔 에러 메시지**
   - F12 → Console 탭
   - 카카오 로그인 클릭 시 에러 메시지

3. **현재 Redirect URI 확인**
   ```javascript
   // 브라우저 콘솔에서 실행
   console.log(window.location.href)
   ```

---

**해결 후 반드시 테스트하세요!** ✅  
로컬 → 스테이징 → 프로덕션 순서로 확인
