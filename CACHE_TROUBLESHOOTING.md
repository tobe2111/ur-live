# 🔄 캐시 문제 해결 가이드

## 문제: "업데이트가 안 보여요!"

배포는 완료되었지만, 브라우저 캐시 때문에 이전 버전이 보일 수 있습니다.

---

## ✅ 해결 방법 (우선순위 순)

### 1️⃣ 강제 새로고침 (Super Reload)

#### Windows / Linux
```
Ctrl + Shift + R
또는
Ctrl + F5
```

#### Mac
```
Cmd + Shift + R
또는
Cmd + Option + R
```

---

### 2️⃣ 캐시 완전 삭제

#### Chrome / Edge
1. **F12** (개발자 도구 열기)
2. 새로고침 버튼 **우클릭**
3. **"캐시 비우기 및 강력 새로고침"** 클릭

#### Firefox
1. **Ctrl + Shift + Delete** (캐시 삭제 창)
2. **시간 범위**: "전체"
3. **"캐시"** 체크
4. **"지금 삭제"** 클릭

#### Safari
1. **메뉴** → **개발** → **캐시 비우기**
2. 또는 **Cmd + Option + E**

---

### 3️⃣ 시크릿/사생활 보호 모드

새 창에서 테스트:
- **Chrome**: `Ctrl + Shift + N`
- **Firefox**: `Ctrl + Shift + P`
- **Safari**: `Cmd + Shift + N`

---

### 4️⃣ 다른 브라우저로 테스트

다른 브라우저에서 접속하여 확인:
- Chrome → Edge
- Safari → Chrome
- Firefox → Brave

---

### 5️⃣ 모바일에서 테스트

PC 캐시와 무관하게 확인:
1. 모바일에서 https://live.ur-team.com 접속
2. 또는 https://10008ba7.toss-live-commerce.pages.dev 접속

---

## 🔍 배포 확인 방법

### 최신 배포 확인
```bash
# Preview URL (최신)
https://10008ba7.toss-live-commerce.pages.dev

# Production URL
https://live.ur-team.com
```

### 배포 시간 확인
- **최신 배포**: 2026-02-14 05:48 (48분 전)
- **커밋**: `d52bc7c` - Grip frame layout

### 확인해야 할 사항
1. ✅ **PC에서**: 좌측에 "리스터코퍼레이션" 텍스트 보임
2. ✅ **PC에서**: 우측에 450px 모바일 프레임 보임
3. ✅ **PC에서**: 프레임에 그림자 + 둥근 모서리
4. ✅ **모바일에서**: 전체 화면 꽉 참

---

## 🐛 여전히 안 보인다면?

### DevTools Console 확인
1. **F12** (개발자 도구)
2. **Console** 탭 열기
3. 에러 메시지 확인

### Network 탭 확인
1. **F12** → **Network** 탭
2. 페이지 새로고침
3. `index-*.js` 파일 확인
4. **Size** 컬럼에서 "disk cache" 또는 "memory cache" 보이면 → 강제 새로고침 필요

---

## 📊 예상되는 화면

### Desktop (1920x1080)
```
┌──────────────────┬─────────────────┐
│                  │                 │
│   UR Live        │   [모바일 프레임]│
│   리스터코퍼레이션 │   450px 너비    │
│                  │                 │
│   라이브 커머스의 │   - 둥근 모서리  │
│   새로운 기준     │   - 큰 그림자   │
│                  │   - 흰색 배경   │
│   [기능 3가지]    │                 │
│   [통계 수치]     │   [숏폼 영상]   │
│                  │                 │
└──────────────────┴─────────────────┘
```

### Mobile (375px)
```
┌─────────────────┐
│                 │
│   전체 화면     │
│   꽉 참        │
│                 │
│   [숏폼 영상]   │
│                 │
│                 │
└─────────────────┘
```

---

## 🚀 Cloudflare 캐시 퍼지 (개발자용)

### Cloudflare Dashboard
1. Cloudflare 대시보드 접속
2. **Caching** → **Configuration**
3. **Purge Everything** 클릭

### Wrangler CLI
```bash
# 특정 파일만 퍼지
npx wrangler pages deployment tail toss-live-commerce

# 전체 퍼지는 Dashboard에서만 가능
```

---

## ✅ 해결 확인

다음이 보이면 성공:
1. ✅ PC 좌측에 "UR Live" 로고
2. ✅ PC 좌측에 "리스터코퍼레이션" 텍스트
3. ✅ PC 좌측에 "라이브 커머스의 새로운 기준" 슬로건
4. ✅ PC 우측에 450px 흰색 프레임 (둥근 모서리 + 그림자)
5. ✅ 프레임 안에 숏폼 영상

---

## 📞 추가 지원

여전히 문제가 있다면:
1. **브라우저 버전** 확인 (Chrome 최신 버전 권장)
2. **스크린샷** 캡처하여 공유
3. **Console 에러** 메시지 복사

---

**작성일**: 2026-02-14  
**최신 배포**: https://10008ba7.toss-live-commerce.pages.dev  
**Production**: https://live.ur-team.com
