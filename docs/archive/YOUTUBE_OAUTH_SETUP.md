# YouTube OAuth 설정 가이드

## 🎯 문제
Seller 대시보드에서 YouTube 계정 연동 시 500 에러 발생:
```
YouTube OAuth가 설정되지 않았습니다. 관리자에게 문의하세요.
```

## ✅ 해결 방법

### 1️⃣ Google Cloud Console 설정

**A. 프로젝트 생성 (이미 있다면 skip)**
1. https://console.cloud.google.com/ 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택

**B. YouTube Data API v3 활성화**
1. APIs & Services → Library
2. "YouTube Data API v3" 검색
3. **Enable** 클릭

**C. OAuth 2.0 클라이언트 ID 생성**
1. APIs & Services → Credentials
2. **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `UR Live YouTube Integration`
5. **Authorized redirect URIs** 추가:
   ```
   https://live.ur-team.com/seller/youtube/callback
   ```
   ⚠️ **정확히 일치해야 함** (끝에 `/` 없음, `https://` 필수)

6. **Create** 클릭
7. ✅ **Client ID**와 **Client Secret** 복사 (잘 보관!)

**D. OAuth Consent Screen 설정**
1. OAuth consent screen 탭 클릭
2. User Type: **External** (테스트용) 또는 **Internal** (조직 내부용)
3. App name: `UR Live`
4. Support email: 본인 이메일
5. Scopes 추가:
   - `https://www.googleapis.com/auth/youtube`
   - `https://www.googleapis.com/auth/youtube.force-ssl`
   - `https://www.googleapis.com/auth/youtube.readonly`
6. **Save and Continue**

---

### 2️⃣ Cloudflare Pages 환경 변수 설정

**방법 1: Cloudflare Dashboard (권장)**

1. https://dash.cloudflare.com/ 접속
2. **Workers & Pages** → `ur-live` 프로젝트 선택
3. **Settings** → **Environment variables** 탭
4. **Production** 환경에 다음 변수 추가:

| Variable Name | Value | 비고 |
|--------------|-------|------|
| `YOUTUBE_CLIENT_ID` | (Google Console에서 복사한 Client ID) | 필수 |
| `YOUTUBE_CLIENT_SECRET` | (Google Console에서 복사한 Client Secret) | 필수 (Encrypt!) |
| `YOUTUBE_REDIRECT_URI` | `https://live.ur-team.com/seller/youtube/callback` | 필수 |

5. **Encrypt** 체크박스를 `YOUTUBE_CLIENT_SECRET`에 반드시 체크!
6. **Save** 클릭

**방법 2: Wrangler CLI**

```bash
cd /home/user/webapp

# Client ID 설정
npx wrangler pages secret put YOUTUBE_CLIENT_ID --project-name=ur-live
# 입력 프롬프트에서 Client ID 붙여넣기

# Client Secret 설정
npx wrangler pages secret put YOUTUBE_CLIENT_SECRET --project-name=ur-live
# 입력 프롬프트에서 Client Secret 붙여넣기

# Redirect URI 설정
npx wrangler pages secret put YOUTUBE_REDIRECT_URI --project-name=ur-live
# 입력: https://live.ur-team.com/seller/youtube/callback
```

**설정 확인:**
```bash
npx wrangler pages secret list --project-name=ur-live | grep YOUTUBE
```

출력 예시:
```
YOUTUBE_CLIENT_ID: ✓ Set
YOUTUBE_CLIENT_SECRET: ✓ Set (encrypted)
YOUTUBE_REDIRECT_URI: ✓ Set
```

---

### 3️⃣ 재배포

환경 변수 설정 후 **재배포 필요**:

```bash
cd /home/user/webapp
npm run build
git add .
git commit -m "chore: Configure YouTube OAuth environment variables"
git push origin main
```

또는 Cloudflare Dashboard에서:
- **Deployments** 탭 → **Retry deployment** 클릭

---

### 4️⃣ 테스트

1. https://live.ur-team.com/seller/login 접속 및 로그인
2. **라이브 방송** 메뉴 클릭
3. **YouTube 계정 연동** 버튼 클릭
4. ✅ Google OAuth 화면이 정상적으로 표시되는지 확인

---

## 🔍 트러블슈팅

### 에러: "YouTube OAuth가 설정되지 않았습니다"
→ `YOUTUBE_CLIENT_ID`가 설정되지 않음
→ Cloudflare Dashboard 환경 변수 재확인

### 에러: "redirect_uri_mismatch"
→ Google Console의 Authorized redirect URIs와 `YOUTUBE_REDIRECT_URI`가 다름
→ 정확히 `https://live.ur-team.com/seller/youtube/callback` 확인 (끝에 `/` 없음)

### 에러: "invalid_client"
→ `YOUTUBE_CLIENT_SECRET`이 잘못됨
→ Google Console에서 Client Secret 재확인 및 재설정

### 에러: "access_denied"
→ OAuth Consent Screen에서 Scopes 누락
→ YouTube API scopes 재확인

---

## 📚 참고 문서

- [Google OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [YouTube Data API v3 Reference](https://developers.google.com/youtube/v3)
- [Cloudflare Pages Environment Variables](https://developers.cloudflare.com/pages/platform/environment-variables/)

