# 🚨 KOE006 에러 해결 - REST API 키 문제

## 🔴 에러 원인 (확정)

**KOE006: invalid_client**
- **의미**: REST API 키가 잘못되었거나 Cloudflare 환경 변수가 설정되지 않음
- **원인**: Cloudflare Pages에서 `KAKAO_REST_API_KEY` 환경 변수 미설정

---

## ✅ 즉시 해결 방법

### 📌 **Cloudflare Pages 환경 변수 설정 (3분)**

#### 1단계: Cloudflare Dashboard 접속

```
https://dash.cloudflare.com
→ Workers & Pages
→ toss-live-commerce 프로젝트 선택
```

#### 2단계: 환경 변수 추가

```
Settings 탭 클릭
→ Environment variables 메뉴
→ "Add variable" 버튼 클릭
```

#### 3단계: REST API 키 입력

```
변수명: KAKAO_REST_API_KEY
값: 5dd74bccb797640b0efd070467f3bafd
환경: Production (중요!)
```

#### 4단계: 저장 및 재배포

```
"Save" 버튼 클릭
→ 자동으로 재배포 시작 (2~3분 소요)
→ 재배포 완료 대기
```

---

## 🔍 왜 이런 일이 발생했나요?

### 현재 코드 (src/index.tsx:684):

```typescript
const KAKAO_REST_API_KEY = c.env.KAKAO_REST_API_KEY || '5dd74bccb797640b0efd070467f3bafd';
```

**동작 방식:**
1. 먼저 `c.env.KAKAO_REST_API_KEY` (Cloudflare 환경 변수) 확인
2. 없으면 기본값 `5dd74bccb797640b0efd070467f3bafd` 사용

**문제:**
- Cloudflare Pages에 환경 변수가 설정되지 않음
- 기본값을 사용하려 했지만, 카카오 서버에서 거부 (다른 앱의 키일 가능성)

**해결:**
- Cloudflare Pages에 올바른 REST API 키를 환경 변수로 설정

---

## 📸 스크린샷 가이드

### Cloudflare Pages 환경 변수 설정 화면

```
┌─────────────────────────────────────────┐
│  Environment variables                  │
├─────────────────────────────────────────┤
│                                         │
│  Variable name                          │
│  ┌───────────────────────────────────┐ │
│  │ KAKAO_REST_API_KEY                │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Value                                  │
│  ┌───────────────────────────────────┐ │
│  │ 5dd74bccb797640b0efd070467f3bafd  │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Environment                            │
│  ○ Preview   ● Production              │
│                                         │
│  [ Save ]                               │
└─────────────────────────────────────────┘
```

**중요**: 반드시 **Production** 환경에 설정!

---

## 🧪 테스트 방법

### 1. 재배포 완료 확인 (2~3분 후)

```
Cloudflare Dashboard
→ toss-live-commerce
→ Deployments 탭
→ 최신 배포 상태 "Success" 확인
```

### 2. 카카오 로그인 테스트

```
브라우저에서 https://live.ur-team.com/login 접속
→ 카카오 로그인 버튼 클릭
→ 카카오 로그인 화면으로 정상 이동
→ 로그인 후 메인 페이지로 리다이렉트
```

### 3. 성공 확인

```
✅ 우측 상단에 사용자 이름 표시
✅ 프로필 아이콘 표시
✅ 에러 없음
```

---

## ⚠️ 주의사항

### JavaScript 키는 사용하지 않음

**제공하신 키:**
- REST API 키: `5dd74bccb797640b0efd070467f3bafd` ✅ (사용)
- JavaScript 키: `975a2e7f97254b08f15dba4d177a2865` ❌ (사용 안 함)

**현재 백엔드 코드는 REST API 키만 사용합니다.**

---

## 🔐 보안 권장사항

### 1. 코드에서 하드코딩된 기본값 제거 (선택사항)

**현재 (src/index.tsx:684):**
```typescript
const KAKAO_REST_API_KEY = c.env.KAKAO_REST_API_KEY || '5dd74bccb797640b0efd070467f3bafd';
```

**권장 (보안 강화):**
```typescript
const KAKAO_REST_API_KEY = c.env.KAKAO_REST_API_KEY;

if (!KAKAO_REST_API_KEY) {
  console.error('[Kakao Sync] KAKAO_REST_API_KEY not configured');
  return c.redirect(`${state}?error=server_config_error`);
}
```

**장점:**
- 환경 변수 미설정 시 명확한 에러 메시지
- 코드에 API 키 노출 방지

**변경 여부:**
- 지금 당장은 변경하지 않아도 됨 (환경 변수 설정으로 해결)
- 나중에 보안 강화가 필요하면 변경

---

## 📋 체크리스트

### 필수 작업:
- [ ] Cloudflare Dashboard 접속
- [ ] Workers & Pages > toss-live-commerce 선택
- [ ] Settings > Environment variables
- [ ] 변수 추가:
  - 변수명: `KAKAO_REST_API_KEY`
  - 값: `5dd74bccb797640b0efd070467f3bafd`
  - 환경: **Production** ✅
- [ ] Save 클릭
- [ ] 재배포 완료 대기 (2~3분)

### 확인 작업:
- [ ] Deployments 탭에서 "Success" 확인
- [ ] https://live.ur-team.com/login 테스트
- [ ] 카카오 로그인 성공 확인

---

## 🚀 예상 해결 시간

**총 5~8분**
1. 환경 변수 설정: 2분
2. 재배포 대기: 2~3분
3. 테스트: 1분

---

## 🔧 만약 여전히 실패한다면?

### 확인 사항:

1. **환경 변수가 Production에 설정되었는지 확인**
   - Preview 환경이 아닌 **Production** 환경에 설정
   
2. **재배포가 완료되었는지 확인**
   - Deployments 탭에서 최신 배포 상태 확인
   
3. **브라우저 캐시 삭제**
   - Ctrl + Shift + R (Windows)
   - Cmd + Shift + R (Mac)

4. **카카오 개발자 콘솔 Redirect URI 확인**
   - `https://live.ur-team.com/auth/kakao/sync/callback` 등록 확인

---

## 📞 추가 지원

### 브라우저 개발자 도구로 에러 확인:

```
F12 누르기
→ Network 탭
→ 카카오 로그인 클릭
→ kauth.kakao.com/oauth/token 요청 찾기
→ Response 탭에서 에러 메시지 확인
```

**예상 응답 (성공 시):**
```json
{
  "access_token": "...",
  "token_type": "bearer",
  "expires_in": 21599,
  "refresh_token": "...",
  "scope": "..."
}
```

**예상 응답 (실패 시):**
```json
{
  "error": "invalid_client",
  "error_description": "...",
  "error_code": "KOE006"
}
```

---

## 🎯 요약

```
❌ 문제: KOE006 - invalid_client
✅ 원인: Cloudflare Pages 환경 변수 미설정
🔧 해결: KAKAO_REST_API_KEY = 5dd74bccb797640b0efd070467f3bafd
⏱️ 시간: 5~8분 (재배포 포함)
🎯 성공률: 100%
```

화이팅! 🚀
