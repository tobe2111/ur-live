# 🚨 누락된 Cloudflare 환경변수 (긴급 설정 필요)

## 📋 현재 상황

### ✅ 이미 설정됨 (6개)
1. ✅ FIREBASE_API_KEY
2. ✅ FIREBASE_CLIENT_EMAIL
3. ✅ FIREBASE_PRIVATE_KEY
4. ✅ JWT_SECRET
5. ✅ TOSS_CLIENT_KEY
6. ✅ TOSS_SECRET_KEY

### ❌ 누락됨 (7개) - 즉시 추가 필요!

---

## 🔥 추가해야 할 환경변수

### 1. FIREBASE_DATABASE_URL
```
https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app
```

### 2. FIREBASE_PROJECT_ID
```
urteam-live-commerce-5b284
```

### 3. FIREBASE_AUTH_DOMAIN
```
urteam-live-commerce-5b284.firebaseapp.com
```

### 4. FIREBASE_STORAGE_BUCKET
```
urteam-live-commerce-5b284.firebasestorage.app
```

### 5. FIREBASE_MESSAGING_SENDER_ID
```
352937066044
```

### 6. FIREBASE_APP_ID
```
1:352937066044:web:e5bfd5e1d8f61688e30d39
```

### 7. REFRESH_TOKEN_SECRET
```
9xqG4JnS0qT33VM9QvpDgAF+hUKslumNkaB0C0o31Qo=
```

---

## 📝 설정 방법

### Cloudflare Dashboard에서 설정

1. **Cloudflare Dashboard 접속**
   - https://dash.cloudflare.com
   - Workers & Pages → **ur-live** 선택

2. **Settings → Environment variables**

3. **Production 환경 선택**

4. **"Add variable" 또는 "Edit variables" 클릭**

5. **위의 7개 환경변수를 하나씩 추가**:
   - Name: `FIREBASE_DATABASE_URL`
   - Value: `https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app`
   - Type: **Plain text** (Secret 아님)
   
   (나머지도 동일하게)

6. **"Save" 클릭**

7. **재배포 트리거**:
   - Settings → Builds & deployments → "Retry deployment"
   - 또는 GitHub에 빈 커밋 푸시

---

## ⚠️ 중요 사항

### 타입 선택
- **Plain text**: 일반 설정값 (URL, ID 등)
- **Secret**: 비밀 키 (이미 설정된 FIREBASE_PRIVATE_KEY, JWT_SECRET 등)

위의 7개는 모두 **Plain text** 또는 **Secret** 타입으로 설정 가능합니다.
(보안을 위해 Secret 타입 권장)

### Environment
- **Production** 환경에 추가해야 합니다
- Preview 환경은 선택사항

---

## 🧪 설정 후 확인 방법

### 1. 재배포 완료 대기 (3-5분)

### 2. 프로덕션 접속
```
https://live.ur-team.com
```

### 3. 브라우저 개발자 도구 (F12) 확인
- **Console 탭**: 로그가 찍히는지 확인
  ```
  [App] 🚀 앱 시작...
  [Firebase] 🔥 초기화 시작...
  [Firebase] ✅ Firebase initialized successfully
  ```

- **Network 탭**: HTML이 로드되는지 확인 (200 OK)

### 4. 정상 동작 확인
- 메인 페이지 로딩
- 카카오 로그인 테스트

---

## 🚀 빠른 복사용 (Cloudflare Dashboard에서 붙여넣기)

```
Name: FIREBASE_DATABASE_URL
Value: https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app
Type: Secret

Name: FIREBASE_PROJECT_ID
Value: urteam-live-commerce-5b284
Type: Secret

Name: FIREBASE_AUTH_DOMAIN
Value: urteam-live-commerce-5b284.firebaseapp.com
Type: Secret

Name: FIREBASE_STORAGE_BUCKET
Value: urteam-live-commerce-5b284.firebasestorage.app
Type: Secret

Name: FIREBASE_MESSAGING_SENDER_ID
Value: 352937066044
Type: Secret

Name: FIREBASE_APP_ID
Value: 1:352937066044:web:e5bfd5e1d8f61688e30d39
Type: Secret

Name: REFRESH_TOKEN_SECRET
Value: 9xqG4JnS0qT33VM9QvpDgAF+hUKslumNkaB0C0o31Qo=
Type: Secret
```

---

## 📊 전체 환경변수 체크리스트 (총 13개)

### Firebase (9개)
- [x] FIREBASE_API_KEY ✅
- [ ] FIREBASE_DATABASE_URL ❌
- [ ] FIREBASE_PROJECT_ID ❌
- [ ] FIREBASE_AUTH_DOMAIN ❌
- [ ] FIREBASE_STORAGE_BUCKET ❌
- [ ] FIREBASE_MESSAGING_SENDER_ID ❌
- [ ] FIREBASE_APP_ID ❌
- [x] FIREBASE_PRIVATE_KEY ✅
- [x] FIREBASE_CLIENT_EMAIL ✅

### JWT (2개)
- [x] JWT_SECRET ✅
- [ ] REFRESH_TOKEN_SECRET ❌

### Toss Payments (2개)
- [x] TOSS_CLIENT_KEY ✅
- [x] TOSS_SECRET_KEY ✅

### 선택사항 (2개)
- [ ] RESEND_API_KEY (선택사항 - 이메일 발송용)
- [ ] EMAIL_FROM (선택사항)

---

## 🎯 예상 결과

### 환경변수 설정 전 (현재)
- ❌ 흰 화면
- ❌ 콘솔 로그 없음
- ❌ Firebase 초기화 실패

### 환경변수 설정 후 (예상)
- ✅ 정상 페이지 로딩
- ✅ 콘솔에 로그 출력
- ✅ Firebase 정상 작동
- ✅ 카카오 로그인 가능

---

**이 파일을 참고하여 Cloudflare Dashboard에서 7개 환경변수를 추가해주세요!**

작성일: 2026-03-01
상태: 🚨 긴급 조치 필요
