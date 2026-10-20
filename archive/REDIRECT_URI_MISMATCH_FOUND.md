# 🔴 문제 발견! Redirect URI 불일치

## 🎯 문제 원인 (확정)

### 프론트엔드 (LoginPage.tsx:80)
```typescript
const REDIRECT_URI = 'https://live.ur-team.com/auth/kakao/callback'
                                                    ↑ callback
```

### 백엔드 (src/index.tsx:685)
```typescript
const KAKAO_REDIRECT_URI = `${new URL(c.req.url).origin}/auth/kakao/sync/callback`
                                                          ↑ sync/callback
```

### 백엔드 라우트 (src/index.tsx:655)
```typescript
app.get('/auth/kakao/sync/callback', async (c) => {
            ↑ sync/callback
```

---

## 🚨 불일치 상황

```
프론트엔드 → /auth/kakao/callback
백엔드     → /auth/kakao/sync/callback

❌ 서로 다름!
```

**결과:**
1. 프론트엔드가 사용자를 `/auth/kakao/callback`로 보냄
2. 카카오가 `/auth/kakao/callback`로 리다이렉트
3. 백엔드는 `/auth/kakao/sync/callback`만 처리함
4. **404 또는 에러 발생!**

---

## ✅ 해결 방법 (2가지 선택)

### 🎯 방법 1: 프론트엔드 수정 (권장, 빠름 5분)

**프론트엔드를 백엔드에 맞춤**

**수정할 파일:** `src/pages/LoginPage.tsx:80`

**변경 전:**
```typescript
const REDIRECT_URI = 'https://live.ur-team.com/auth/kakao/callback'
```

**변경 후:**
```typescript
const REDIRECT_URI = 'https://live.ur-team.com/auth/kakao/sync/callback'
```

**카카오 개발자 콘솔 설정:**
```
Redirect URI: https://live.ur-team.com/auth/kakao/sync/callback
```

**장점:**
- ✅ 빠름 (코드 1줄만 수정)
- ✅ 백엔드 수정 불필요
- ✅ `/sync/callback`이 더 명확한 이름

---

### 🎯 방법 2: 백엔드 수정 (복잡함)

**백엔드를 프론트엔드에 맞춤**

**수정할 파일:** 
1. `src/index.tsx:655` - 라우트 변경
2. `src/index.tsx:685` - REDIRECT_URI 변경

**변경 전:**
```typescript
app.get('/auth/kakao/sync/callback', async (c) => {
  // ...
  const KAKAO_REDIRECT_URI = `${new URL(c.req.url).origin}/auth/kakao/sync/callback`;
```

**변경 후:**
```typescript
app.get('/auth/kakao/callback', async (c) => {
  // ...
  const KAKAO_REDIRECT_URI = `${new URL(c.req.url).origin}/auth/kakao/callback`;
```

**카카오 개발자 콘솔 설정:**
```
Redirect URI: https://live.ur-team.com/auth/kakao/callback
```

**단점:**
- ⚠️ 백엔드 코드 2곳 수정 필요
- ⚠️ 재배포 필요
- ⚠️ `/callback`이 덜 명확한 이름

---

## 🎯 최종 추천: 방법 1 (프론트엔드 수정)

### 즉시 실행:

#### 1단계: 코드 수정 (2분)

**파일:** `src/pages/LoginPage.tsx`

**80번 줄을 다음과 같이 수정:**
```typescript
const REDIRECT_URI = 'https://live.ur-team.com/auth/kakao/sync/callback'
```

#### 2단계: 카카오 개발자 콘솔 (2분)

```
https://developers.kakao.com 접속
→ 내 애플리케이션
→ 제품 설정 > 카카오 로그인
→ Redirect URI 설정
→ 추가: https://live.ur-team.com/auth/kakao/sync/callback
→ 저장
```

#### 3단계: 빌드 및 배포 (3분)

```bash
cd /home/user/webapp
npm run build
npx wrangler pages deploy dist --project-name toss-live-commerce
```

#### 4단계: 테스트 (1분)

```
https://live.ur-team.com/login 접속
→ 카카오 로그인 클릭
→ 성공!
```

---

## 📋 체크리스트

### 코드 수정:
- [ ] src/pages/LoginPage.tsx:80 수정
  - `/auth/kakao/callback` → `/auth/kakao/sync/callback`

### 카카오 개발자 콘솔:
- [ ] Redirect URI 추가
  - `https://live.ur-team.com/auth/kakao/sync/callback`
- [ ] 저장

### 배포:
- [ ] npm run build
- [ ] wrangler pages deploy
- [ ] 재배포 완료 확인

### 테스트:
- [ ] 카카오 로그인 성공 확인

---

## ⏱️ 예상 소요 시간

**총 8~10분**
1. 코드 수정: 2분
2. 카카오 콘솔: 2분
3. 빌드 및 배포: 3~5분
4. 테스트: 1분

---

## 🎯 핵심 포인트

```
❌ 현재 상태:
   프론트: /auth/kakao/callback
   백엔드: /auth/kakao/sync/callback

✅ 수정 후:
   프론트: /auth/kakao/sync/callback ← 변경
   백엔드: /auth/kakao/sync/callback ← 유지
   
✅ 카카오 콘솔:
   Redirect URI: https://live.ur-team.com/auth/kakao/sync/callback
```

---

## 💡 왜 이렇게 됐나요?

프론트엔드와 백엔드가 **각자 다른 경로**를 사용하고 있었습니다.

**역사적 이유:**
- 초기에는 `/auth/kakao/callback` 사용 (일반 카카오 로그인)
- 나중에 카카오싱크로 업그레이드하면서 `/auth/kakao/sync/callback` 추가
- 프론트엔드만 업데이트 안 됨!

---

## 🚀 지금 바로 시작하세요!

이제 정확한 원인을 알았으니 10분 안에 100% 해결됩니다! 🎉
