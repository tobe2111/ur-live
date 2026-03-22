# 🚨 긴급: API Key 캐시 문제

## ❌ 문제

**여전히 잘못된 API Key를 사용 중:**
```
❌ 사용 중: AIzaSyDGy6Wh2FbRQFYGKzP5Y31V3jO6YHzKzgM (toss-live-commerce)
✅ 올바름: AIzaSyA8Lsr6o9gRjMARI-mWaFGrciRs9z2CH7s (urteam-live-commerce)
```

## 🔍 원인

1. **브라우저 캐시**: 이전 빌드의 JavaScript 파일이 캐시됨
2. **Cloudflare CDN 캐시**: CDN에 이전 버전이 캐시됨
3. **개발 서버**: 로컬 개발 서버가 이전 환경 변수 사용

---

## ✅ 해결 방법

### Step 1: 브라우저 캐시 완전 제거

#### Chrome/Edge
1. **개발자 도구 열기**: `F12`
2. **Network 탭** 클릭
3. **Disable cache** 체크박스 선택
4. **페이지 새로고침**: `Ctrl + Shift + R` (Windows) / `Cmd + Shift + R` (Mac)

#### 또는 시크릿 모드
```
Ctrl + Shift + N (Windows/Linux)
Cmd + Shift + N (Mac)
```

### Step 2: Cloudflare 캐시 제거

1. **Cloudflare Dashboard** 접속: https://dash.cloudflare.com/
2. **ur-team.com** 도메인 선택
3. 좌측 메뉴 → **Caching** → **Configuration**
4. **Purge Cache** 섹션
5. **Purge Everything** 클릭
6. 확인 후 **Purge**

### Step 3: 최신 배포 URL 직접 접속

**캐시 없는 최신 배포:**
```
https://e1b79008.ur-live.pages.dev/login
```

이 URL은 **가장 최근 배포**이므로 캐시가 없습니다!

---

## 🧪 검증 방법

### 1️⃣ 개발자 콘솔 확인 (F12)

**올바른 경우:**
```javascript
// Console에서 실행:
console.log(import.meta.env.VITE_FIREBASE_API_KEY)
// 결과: AIzaSyA8Lsr6o9gRjMARI-mWaFGrciRs9z2CH7s ✅
```

**잘못된 경우:**
```
// 결과: AIzaSyDGy6Wh2FbRQFYGKzP5Y31V3jO6YHzKzgM ❌
```

### 2️⃣ Network 탭 확인

1. `F12` → **Network** 탭
2. **Clear** 클릭 (휴지통 아이콘)
3. 페이지 새로고침 (`Ctrl + Shift + R`)
4. `identitytoolkit.googleapis.com` 요청 찾기
5. **Request URL** 확인:
   - 올바름: `...?key=AIzaSyA8Lsr6...` ✅
   - 잘못됨: `...?key=AIzaSyDGy6...` ❌

---

## 🎯 권장 테스트 순서

### Option 1: 최신 배포 URL (추천)
```
https://e1b79008.ur-live.pages.dev/login
```
- ✅ Cloudflare CDN 캐시 없음
- ✅ 최신 빌드 보장
- ✅ 가장 빠른 확인 방법

### Option 2: 메인 도메인 (캐시 제거 후)
```
https://live.ur-team.com/login
```
- ⚠️ Cloudflare 캐시 제거 필요
- ⚠️ 브라우저 캐시 제거 필요
- ⚠️ 시크릿 모드 권장

---

## 📊 Cloudflare 환경 변수 확인

현재 설정된 값을 확인하려면:

```bash
# Cloudflare API로 확인
curl -X GET \
  "https://api.cloudflare.com/client/v4/accounts/1a2c006f0fb54894f81283a5ea787b83/pages/projects/ur-live" \
  -H "Authorization: Bearer 3i3ZxtKpifhT7BjnH-p2VS9jKyoQs83dl4w1_KXC" \
  | jq '.result.deployment_configs.production.env_vars.VITE_FIREBASE_API_KEY'
```

**기대 결과:**
```json
{
  "type": "plain_text",
  "value": "AIzaSyA8Lsr6o9gRjMARI-mWaFGrciRs9z2CH7s"
}
```

---

## 🔗 Quick Links

- **최신 배포** (캐시 없음): https://e1b79008.ur-live.pages.dev/login
- **메인 도메인**: https://live.ur-team.com/login
- **Cloudflare 캐시 제거**: https://dash.cloudflare.com/ → ur-team.com → Caching → Purge Cache
- **Cloudflare Pages**: https://dash.cloudflare.com/ → Workers & Pages → ur-live

---

## ⚠️ 중요 사항

1. **로컬 개발 서버는 사용하지 마세요**
   - `npm run dev:client`는 이전 환경 변수를 사용할 수 있습니다
   - 프로덕션 배포 URL에서 테스트하세요

2. **브라우저 캐시는 완전히 제거하세요**
   - 일반 새로고침은 JavaScript 파일을 캐시에서 가져올 수 있습니다
   - 반드시 `Ctrl + Shift + R` 또는 시크릿 모드 사용

3. **Cloudflare CDN 캐시도 제거하세요**
   - 메인 도메인 사용 시 필수
   - 최신 배포 URL 사용 시 불필요

---

**🎯 가장 빠른 확인: 시크릿 모드에서 https://e1b79008.ur-live.pages.dev/login 접속!**

**작성일**: 2026-03-18 08:50  
**프로젝트**: ur-live  
**상태**: 🚨 캐시 제거 필요
