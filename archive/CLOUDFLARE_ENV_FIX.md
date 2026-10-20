# 🚨 Cloudflare Pages 환경변수 긴급 수정 가이드

## 문제 상황
```
❌ Missing Firebase environment variables: VITE_FIREBASE__D_A_T_A_B_A_S_E_U_R_L
❌ CSP 차단: wss://toss-live-commerce-default-rtdb.firebaseio.com/
```

## 원인
- `.env` 파일은 **로컬 개발 환경에서만** 작동
- Cloudflare Pages는 `.env` 파일을 읽지 **않음**
- 환경변수는 **Cloudflare Dashboard**에서 직접 설정해야 함

## ✅ 해결 방법 (2분 소요)

### Step 1: Cloudflare Dashboard 접속
1. https://dash.cloudflare.com/ 로그인
2. 좌측 메뉴 → **Workers & Pages** 클릭
3. **ur-live** 프로젝트 선택

### Step 2: 환경변수 설정
1. 상단 메뉴 → **Settings** 탭 클릭
2. 좌측 메뉴 → **Environment variables** 클릭
3. **Production** 탭에서 **Add variable** 버튼 클릭

### Step 3: Firebase Database URL 추가
```
Variable name: VITE_FIREBASE_DATABASE_URL
Value: https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app
```

⚠️ **주의**: `VITE_FIREBASE__D_A_T_A_B_A_S_E_U_R_L` (underscores 3개) 아님!  
✅ **정답**: `VITE_FIREBASE_DATABASE_URL` (underscores 2개)

### Step 4: 재배포
1. **Save** 버튼 클릭
2. **Deployments** 탭으로 이동
3. 최신 deployment 우측 **···** 메뉴 → **Retry deployment** 클릭
4. 또는 **git push** 하면 자동 재배포됨

## 📋 확인 필요한 환경변수 목록

### 필수 (현재 누락)
- ✅ `VITE_FIREBASE_DATABASE_URL` ← **지금 추가해야 함**

### 이미 설정된 것 (확인 필요)
- ✅ `VITE_FIREBASE_API_KEY` 
- ✅ `VITE_FIREBASE_AUTH_DOMAIN`
- ✅ `VITE_FIREBASE_PROJECT_ID`
- ✅ `VITE_FIREBASE_STORAGE_BUCKET`
- ✅ `VITE_FIREBASE_MESSAGING_SENDER_ID`
- ✅ `VITE_FIREBASE_APP_ID`
- ✅ `VITE_KAKAO_JAVASCRIPT_KEY`

## 🧪 테스트 방법

### 1. 환경변수 확인
```bash
# 배포 후 콘솔에서 확인
curl -s https://live.ur-team.com/login | grep "VITE_FIREBASE"
```

### 2. 라이브 페이지 테스트
```bash
# WebSocket 연결 확인
curl -s https://live.ur-team.com/live/20 2>&1 | grep "urteam-live-commerce"
```

### 3. 브라우저 콘솔 확인
1. https://live.ur-team.com/live/20 접속
2. F12 → Console 탭
3. ✅ 기대 결과: `Firebase Database initialized` 로그
4. ❌ 실패 시: `Missing Firebase environment variables` 에러

## 📊 현재 상태

| 페이지 | 이슈 | 해결 방법 |
|--------|------|-----------|
| 로그인 페이지 | Kakao SDK integrity 에러 | ✅ 수정 완료 (integrity 제거) |
| 상품 상세 | data undefined | ✅ 수정 완료 (API 파싱) |
| 라이브 페이지 | Firebase DB URL 틀림 | ⏳ Cloudflare 환경변수 추가 필요 |
| 라이브 채팅 | WebSocket CSP 차단 | ⏳ Firebase URL 수정 후 자동 해결 |

## 🎯 완료 조건
- [ ] Cloudflare Pages에 `VITE_FIREBASE_DATABASE_URL` 환경변수 추가
- [ ] 재배포 완료
- [ ] https://live.ur-team.com/live/20 에서 채팅 입력 가능
- [ ] 콘솔에 `Firebase Database initialized` 로그 확인
- [ ] WebSocket 연결 성공 (`wss://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app/`)

---

**마지막 업데이트**: 2026-03-17 14:30 KST  
**예상 소요 시간**: 2분 (환경변수 추가) + 3분 (배포 대기) = **5분**
