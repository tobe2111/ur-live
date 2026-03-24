# ✅ Cloudflare Secret 삭제 및 재생성 가이드

## 🎯 즉시 실행 (5분)

### 1단계: Cloudflare Dashboard 접속 (30초)

```
https://dash.cloudflare.com 접속
→ 로그인
→ Workers & Pages 클릭
→ toss-live-commerce 프로젝트 클릭
```

---

### 2단계: 기존 Secret 삭제 (1분)

```
Settings 탭 클릭
→ Variables and Secrets 메뉴 찾기
→ KAKAO_REST_API_KEY 찾기
→ 오른쪽 끝 "..." (점 3개) 메뉴 클릭
→ "Delete" 선택
→ 삭제 확인 팝업에서 "Delete" 클릭
```

**확인:**
- KAKAO_REST_API_KEY가 목록에서 사라짐

---

### 3단계: 새로운 Secret 생성 (2분)

```
"Add variable" 버튼 클릭

입력란이 나타나면:

┌─────────────────────────────────────────┐
│  Variable name                          │
│  ┌───────────────────────────────────┐ │
│  │ KAKAO_REST_API_KEY                │ │  ← 정확히 입력
│  └───────────────────────────────────┘ │
│                                         │
│  Type                                   │
│  ○ Text   ● Secret                     │  ← Secret 선택!
│                                         │
│  Value                                  │
│  ┌───────────────────────────────────┐ │
│  │ 5dd74bccb797640b0efd070467f3bafd  │ │  ← 공백 없이 입력
│  └───────────────────────────────────┘ │
│                                         │
│  [ Deploy ]                             │  ← 클릭
└─────────────────────────────────────────┘
```

**입력값 (복사해서 붙여넣기):**
```
Variable name: KAKAO_REST_API_KEY
Type: Secret
Value: 5dd74bccb797640b0efd070467f3bafd
```

**중요:**
- Type은 반드시 **Secret** 선택 (Text 아님!)
- Value 앞뒤에 공백 없이 정확히 입력
- Deploy 버튼 클릭

---

### 4단계: 재배포 확인 (2~3분)

```
"Deploy" 버튼 클릭 후:

→ 자동으로 재배포 시작
→ Deployments 탭으로 이동
→ 최신 배포 확인
→ 상태가 "Building..." → "Success" 변경 대기
→ 약 2~3분 소요
```

**확인 방법:**
```
Deployments 탭에서:
- 최신 배포 시간: 방금 전 (예: "2 minutes ago")
- 상태: Success ✅
- Environment: Production
```

---

### 5단계: 테스트 (1분)

```
1. 브라우저 새 탭 열기
2. https://live.ur-team.com/login 접속
3. Ctrl + Shift + R (강력 새로고침, 캐시 삭제)
4. 카카오 로그인 버튼 클릭
5. 카카오 로그인 화면으로 이동 확인
6. 로그인 후 메인 페이지로 리다이렉트 확인
```

---

## 📋 체크리스트

### Secret 삭제:
- [ ] Cloudflare Dashboard 접속
- [ ] Workers & Pages > toss-live-commerce
- [ ] Settings > Variables and Secrets
- [ ] KAKAO_REST_API_KEY 찾기
- [ ] ... 메뉴 > Delete 클릭
- [ ] 삭제 확인

### Secret 재생성:
- [ ] "Add variable" 클릭
- [ ] Variable name: `KAKAO_REST_API_KEY` 입력
- [ ] Type: **Secret** 선택 (중요!)
- [ ] Value: `5dd74bccb797640b0efd070467f3bafd` 입력
- [ ] Deploy 클릭

### 재배포 확인:
- [ ] Deployments 탭 이동
- [ ] 최신 배포 "Success" 확인
- [ ] 2~3분 대기

### 테스트:
- [ ] https://live.ur-team.com/login 접속
- [ ] Ctrl + Shift + R (캐시 삭제)
- [ ] 카카오 로그인 성공 확인

---

## 🎯 핵심 포인트

### ⚠️ 주의사항

**1. Type 선택:**
```
❌ Text 선택하면 안 됨!
✅ Secret 선택해야 함!
```

**2. Value 입력:**
```
✅ 정확히: 5dd74bccb797640b0efd070467f3bafd
❌ 공백 포함:  5dd74bccb797640b0efd070467f3bafd 
❌ 개행 포함: 5dd74bccb797640b0efd070467f3bafd\n
```

**3. 재배포 확인:**
```
Deploy 버튼 클릭 후 반드시 Deployments 탭에서
"Success" 확인하고 2~3분 대기!
```

---

## ⏱️ 예상 소요 시간

```
1. Secret 삭제: 1분
2. Secret 재생성: 2분
3. 재배포 대기: 2~3분
4. 테스트: 1분
───────────────────────
총 소요 시간: 6~8분
```

---

## 🔍 만약 여전히 실패한다면?

### 확인 사항:

1. **Secret 이름 확인**
   ```
   정확히: KAKAO_REST_API_KEY
   대소문자 구분됨!
   ```

2. **재배포 완료 확인**
   ```
   Deployments 탭에서 "Success" 확인
   시간: 방금 전 (2~3 minutes ago)
   ```

3. **브라우저 캐시 완전 삭제**
   ```
   Chrome: Ctrl + Shift + Delete
   → 전체 기간 선택
   → 캐시된 이미지 및 파일 체크
   → 데이터 삭제
   ```

4. **에러 메시지 확인**
   ```
   F12 > Network 탭
   → 카카오 로그인 클릭
   → kauth.kakao.com/oauth/token 요청 찾기
   → Response 탭에서 에러 메시지 복사
   → 알려주세요!
   ```

---

## 🎉 성공 확인

### 성공 시:

```
✅ 카카오 로그인 화면으로 이동
✅ 로그인 후 https://live.ur-team.com 메인 페이지로 리다이렉트
✅ 우측 상단에 사용자 이름 표시
✅ 프로필 아이콘 표시
✅ 에러 없음
```

### 실패 시:

```
❌ KOE006 에러 여전히 발생
→ URL 확인: ?error=...&detail=...
→ F12 Network 탭에서 에러 메시지 확인
→ 복사해서 알려주세요
```

---

## 💡 추가 팁

### Secret vs Text 차이

**Secret:**
- 암호화되어 저장됨 (Value encrypted)
- 값을 다시 볼 수 없음
- API 키, 비밀번호 등에 사용
- ✅ KAKAO_REST_API_KEY는 Secret 사용!

**Text:**
- 평문으로 저장됨
- 값을 언제든 볼 수 있음
- 일반 설정값에 사용
- ❌ API 키에는 사용하지 않음!

---

## 🚀 지금 바로 시작하세요!

```
1. https://dash.cloudflare.com 접속
2. toss-live-commerce 선택
3. Settings > Variables and Secrets
4. KAKAO_REST_API_KEY 삭제
5. 새로 추가 (Secret 타입으로)
6. Deploy 클릭
7. 2~3분 대기
8. 테스트!
```

화이팅! 🎉
