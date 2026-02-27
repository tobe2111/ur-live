# Firebase Authentication 설정 가이드

## 🎯 필수 작업 (Firebase Console)

### 1. Authentication 활성화
```
1. Firebase Console 열기:
   https://console.firebase.google.com/project/urteam-live-commerce-5b284

2. 좌측 메뉴에서 "Authentication" 클릭

3. "Get Started" 클릭

4. "Sign-in method" 탭에서 다음 제공업체 활성화:
   ✅ Email/Password (이메일 링크 비활성화, 비밀번호만)
   ✅ Custom (카카오 로그인용)
```

### 2. 비밀번호 재설정 이메일 설정
```
1. "Templates" 탭으로 이동

2. "Password reset" 선택

3. 발신자 이메일 설정 (예: noreply@ur-team.com)

4. 템플릿 언어: 한국어로 변경 (선택사항)

5. "Save" 클릭
```

### 3. Web API Key 확인
```
1. 프로젝트 설정 (톱니바퀴) → "일반" 탭

2. "웹 API 키" 복사:
   AIzaSyCxmgG3NEXsWtHKbE425dvq5EWs3WHXOh8
```

### 4. Service Account 키 확인 (이미 있음)
```
✅ 이미 설정 완료:
   firebase-adminsdk-fbsvc@urteam-live-commerce-5b284.iam.gserviceaccount.com
```

---

## ✅ 완료 체크리스트

- [ ] Authentication 활성화
- [ ] Email/Password 제공업체 활성화
- [ ] Custom 제공업체 활성화 (카카오용)
- [ ] 비밀번호 재설정 이메일 템플릿 설정

---

**이 작업을 완료하시면 다음 단계로 진행하겠습니다!**

Firebase Console에서 위 설정을 완료한 후 알려주세요.
또는 제가 코드 작업을 먼저 시작할 수도 있습니다.

**어떻게 진행하시겠습니까?**
A) Firebase Console 설정을 먼저 완료하고 알려주기
B) 코드 작업을 먼저 시작하고 나중에 Console 설정하기 (권장)
