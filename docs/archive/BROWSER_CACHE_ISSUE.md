# 🔧 브라우저 캐시 문제 해결 가이드

## 📋 문제 상황

### **오류 메시지**
```
GET https://live.ur-team.com/assets/index-BmzL-S6J.js net::ERR_ABORTED 404
GET https://live.ur-team.com/assets/live-pages-zSgW9A0i.js net::ERR_ABORTED 404
GET https://live.ur-team.com/assets/seller-pages-BN8TCa7p.js net::ERR_ABORTED 404
GET https://live.ur-team.com/assets/app-pages-D1RGfUMC.js net::ERR_ABORTED 404
```

### **근본 원인**
- 브라우저가 **옛날 HTML을 캐시**하고 있음
- 옛날 HTML은 옛날 파일 이름(`index-BmzL-S6J.js`)을 가리킴
- 서버에는 **새 파일**(`index-D8225P2C.js`)만 존재
- 브라우저가 존재하지 않는 옛날 파일을 요청 → 404

### **검증**
```bash
# 서버의 실제 HTML (새 해시)
$ curl -s https://live.ur-team.com/ | grep -o 'index-[^"]*\.js'
index-D8225P2C.js ✅

# 서버의 실제 파일 (존재함)
$ curl -I https://live.ur-team.com/assets/index-D8225P2C.js
HTTP/2 200 OK ✅

# 브라우저가 요청하는 파일 (옛날 캐시)
index-BmzL-S6J.js ❌ (존재하지 않음)
```

---

## ✅ **해결 방법 (3가지)**

### **방법 1: 강력 새로고침 (가장 쉬움)** ⭐

#### **Windows / Linux**
```
Ctrl + Shift + R
또는
Ctrl + F5
```

#### **Mac**
```
Cmd + Shift + R
또는
Cmd + Option + R
```

---

### **방법 2: 캐시 완전 삭제**

#### **Chrome**
1. `F12` → DevTools 열기
2. **Network** 탭
3. **Disable cache** 체크
4. 새로고침 (`F5`)

또는:

1. 주소창에 `chrome://settings/clearBrowserData` 입력
2. **시간 범위**: 전체 기간
3. **캐시된 이미지 및 파일** 체크
4. **데이터 삭제**

---

### **방법 3: 시크릿 모드 (즉시 테스트)**

#### **Chrome**
```
Ctrl + Shift + N (Windows/Linux)
Cmd + Shift + N (Mac)
```

#### **Firefox**
```
Ctrl + Shift + P (Windows/Linux)
Cmd + Shift + P (Mac)
```

시크릿 모드에서 https://live.ur-team.com 접속

---

## 🔍 **왜 이런 일이 발생했나?**

### **Vite 빌드 시스템**
```
index.html → index-[HASH].js
```

- 코드가 변경되면 → 해시가 변경됨
- 옛날 빌드: `index-BmzL-S6J.js`
- 새 빌드: `index-D8225P2C.js`

### **배포 과정**
1. ✅ 새 빌드 업로드 (`index-D8225P2C.js`)
2. ✅ 새 HTML 업로드 (새 해시 참조)
3. ❌ 브라우저가 옛날 HTML 캐시 사용

### **결과**
- 서버: 새 HTML + 새 JS ✅
- 브라우저: 옛날 HTML (캐시) + 옛날 JS 요청 → 404 ❌

---

## 🎯 **즉시 해결 (30초)**

### **Step 1: 강력 새로고침**
```
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)
```

### **Step 2: 확인**
F12 → Console 탭에서:
- ✅ 404 오류 없음
- ✅ `index-D8225P2C.js` 로드됨
- ✅ 페이지 정상 작동

---

## ⚠️ **향후 예방 방법**

### **1. Cache-Control 헤더 설정**

`dist/_headers` 파일에 추가:
```
/
  Cache-Control: no-cache, no-store, must-revalidate

/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

→ HTML은 캐시 안 함, JS/CSS는 영구 캐시

---

### **2. Service Worker 제거 (있다면)**

```bash
# public/ 폴더에서 확인
ls public/sw.js
```

Service Worker가 있으면:
1. 브라우저에서 `Application` 탭
2. **Service Workers** → **Unregister**

---

### **3. Cloudflare 캐시 퍼지**

배포 후:
```bash
# Cloudflare API로 캐시 삭제
curl -X POST "https://api.cloudflare.com/client/v4/zones/[ZONE_ID]/purge_cache" \
  -H "Authorization: Bearer [API_TOKEN]" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

---

## 📊 **현재 상태**

| 항목 | 상태 | 비고 |
|------|------|------|
| 서버 HTML | ✅ 최신 | `index-D8225P2C.js` 참조 |
| 서버 JS 파일 | ✅ 존재 | `/assets/index-D8225P2C.js` |
| 브라우저 캐시 | ❌ 옛날 | `index-BmzL-S6J.js` 요청 |
| 해결 방법 | ⏳ 대기 | 강력 새로고침 필요 |

---

## 🚀 **지금 실행**

```
1. Ctrl + Shift + R (강력 새로고침)
2. F12 → Console 확인
3. 404 오류 사라짐 ✅
```

---

## 📝 **추가 정보**

### **파일 목록**
```bash
# 로컬 빌드
dist/assets/index-D8225P2C.js ✅

# 서버 배포
https://live.ur-team.com/assets/index-D8225P2C.js ✅ 200 OK

# 브라우저 요청 (옛날 캐시)
https://live.ur-team.com/assets/index-BmzL-S6J.js ❌ 404
```

### **HTML 참조 확인**
```bash
# 서버 HTML
$ curl -s https://live.ur-team.com/ | grep 'index-.*\.js'
<script type="module" crossorigin src="/assets/index-D8225P2C.js"></script>
```

---

**결론**: 서버는 정상입니다. **브라우저 캐시만 삭제하면 됩니다!**

**해결**: `Ctrl + Shift + R` (강력 새로고침)

---

**작성일**: 2026-03-05  
**목적**: 브라우저 캐시 문제 해결  
**상태**: ⏳ 사용자 새로고침 필요
