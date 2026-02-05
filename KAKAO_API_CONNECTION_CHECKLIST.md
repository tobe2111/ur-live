# 카카오 로그인 API 연동 체크리스트

## ✅ 완료된 작업

### 코드 구현
- [x] 백엔드 카카오 로그인 라우트 구현
- [x] 프론트엔드 로그인 콜백 처리
- [x] 환경 변수 설정 (Cloudflare Pages)
- [x] 배포 완료

### 환경 변수 설정
```
KAKAO_REST_API_KEY=4fd3d6ea625c446c4c445d7fb28c3759
KAKAO_REDIRECT_URI=https://live.ur-team.com/auth/kakao/callback
```

---

## ❓ 카카오 개발자 콘솔 설정 확인 필요

**카카오 개발자 콘솔**: https://developers.kakao.com

### 1️⃣ REST API 키 확인
```
위치: 내 애플리케이션 → 앱 설정 → 앱 키

확인 사항:
- REST API 키가 4fd3d6ea625c446c4c445d7fb28c3759 인지 확인
```

### 2️⃣ 카카오 로그인 활성화 확인
```
위치: 제품 설정 → 카카오 로그인

확인 사항:
- [  ] 카카오 로그인 활성화: ON
- [  ] 상태: 활성화 됨
```

### 3️⃣ Redirect URI 등록 확인
```
위치: 제품 설정 → 카카오 로그인 → Redirect URI

확인 사항:
- [  ] https://live.ur-team.com/auth/kakao/callback 등록됨
- [  ] 저장됨
```

### 4️⃣ Client Secret 확인
```
위치: 제품 설정 → 카카오 로그인 → 보안 → Client Secret

확인 사항:
- [  ] Client Secret: OFF (비활성화)
     ↑ 반드시 OFF여야 함!
```

### 5️⃣ 동의 항목 확인 (선택)
```
위치: 제품 설정 → 카카오 로그인 → 동의 항목

권장 설정:
- [  ] 닉네임: 필수 동의
- [  ] 프로필 사진: 선택 동의
- [  ] 카카오계정(이메일): 선택 동의
```

---

## 🧪 연동 테스트 방법

### 테스트 1: 카카오 로그인 버튼 클릭
```
1. 시크릿 창 열기 (Ctrl+Shift+N)
2. https://live.ur-team.com/live/1 접속
3. "구매하기" 클릭
4. 카카오 로그인 페이지로 이동하는지 확인
```

**예상 결과:**
- ✅ 카카오 로그인 페이지로 이동
- ✅ URL: https://kauth.kakao.com/oauth/authorize?client_id=4fd3d6ea625c446c4c445d7fb28c3759&redirect_uri=https%3A%2F%2Flive.ur-team.com%2Fauth%2Fkakao%2Fcallback...

**에러 발생 시:**
- ❌ `KOE006`: Redirect URI가 등록되지 않음
- ❌ `invalid_client`: REST API 키가 잘못됨
- ❌ `KOE101`: 카카오 로그인이 활성화되지 않음

### 테스트 2: 로그인 완료
```
1. 카카오 계정으로 로그인
2. "동의하고 계속하기" 클릭
3. 라이브 페이지로 복귀하는지 확인
```

**예상 결과:**
- ✅ 라이브 페이지로 복귀
- ✅ "로그인 되었습니다!" 알림
- ✅ localStorage에 access_token, user_id 저장

**에러 발생 시:**
- ❌ `error=token_failed&detail=invalid_client`: REST API 키 오류
- ❌ `error=token_failed&detail=invalid_grant`: code가 만료되거나 이미 사용됨
- ❌ `error=user_info_failed`: 사용자 정보 조회 실패

### 테스트 3: 로그인 상태 확인
```
개발자 도구 > Application > Local Storage > https://live.ur-team.com

확인:
- [  ] access_token: (값 있음)
- [  ] user_id: (숫자)
- [  ] user_name: (이름)
```

---

## 🚨 자주 발생하는 문제

### 문제 1: KOE006 에러
```
원인: Redirect URI가 등록되지 않음

해결:
1. 카카오 개발자 콘솔
2. 제품 설정 → 카카오 로그인
3. Redirect URI 섹션
4. https://live.ur-team.com/auth/kakao/callback 등록
5. 저장
```

### 문제 2: invalid_client 에러
```
원인: REST API 키가 잘못됨

해결:
1. 카카오 개발자 콘솔 → 앱 설정 → 앱 키
2. REST API 키 확인: 4fd3d6ea625c446c4c445d7fb28c3759
3. 다르면 올바른 키로 환경 변수 업데이트:
   echo "올바른_키" | npx wrangler pages secret put KAKAO_REST_API_KEY --project-name toss-live-commerce
4. 재배포
```

### 문제 3: 카카오 로그인 페이지로 이동 안 됨
```
원인: 카카오 로그인이 활성화되지 않음

해결:
1. 카카오 개발자 콘솔
2. 제품 설정 → 카카오 로그인
3. 카카오 로그인 활성화: ON으로 변경
4. 저장
```

---

## 📝 현재 상태 요약

### 완료됨 ✅
- 코드 구현
- 환경 변수 설정
- 배포

### 확인 필요 ❓
- 카카오 개발자 콘솔의 설정들
  - REST API 키 일치 여부
  - 카카오 로그인 활성화
  - Redirect URI 등록
  - Client Secret OFF

### 다음 단계
1. 위의 체크리스트로 카카오 개발자 콘솔 설정 확인
2. 테스트 진행
3. 에러 발생 시 위의 해결 방법 참고

---

**마지막 업데이트**: 2026-02-05
**상태**: ⚠️ 카카오 개발자 콘솔 설정 확인 필요
