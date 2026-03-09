# 🚀 배포 확인 가이드

**작성일**: 2026-03-09  
**커밋**: e3b9bfda  
**문제**: CSP 위반으로 인한 Firebase 로그인 실패

---

## 📋 수정 내역

### 문제
```
❌ Firebase Custom Token 로그인 실패
❌ Sentry 에러 리포팅 차단
❌ Google Analytics 연결 차단

원인: Content Security Policy의 connect-src에 필요한 도메인 누락
```

### 해결
```diff
connect-src 'self' 
  https://api.ur-team.com 
+ https://live.ur-team.com                    ← 추가
  https://firebasestorage.googleapis.com 
  https://*.firebase.google.com 
  https://*.firebaseio.com 
+ https://identitytoolkit.googleapis.com       ← 추가
+ https://securetoken.googleapis.com           ← 추가
+ https://www.googleapis.com                   ← 추가
  https://api.stripe.com 
  https://api.tosspayments.com
+ https://*.sentry.io                          ← 추가
+ https://o4510992097935360.ingest.us.sentry.io ← 추가
+ https://www.google-analytics.com             ← 추가
```

---

## ⏱️ 배포 타임라인

| 시간 | 단계 | 상태 |
|------|------|------|
| 03:40 | Git Push 완료 | ✅ |
| 03:40 | GitHub Actions 트리거 | 🔄 |
| 03:41 | Cloudflare Pages 빌드 시작 | 🔄 |
| 03:42 | 빌드 진행 중 | 🔄 |
| 03:43 | 배포 완료 (예상) | ⏳ |

**예상 소요 시간**: 2-3분

---

## 🔍 배포 확인 방법

### 방법 1: Cloudflare Dashboard
1. https://dash.cloudflare.com 접속
2. Pages → ur-live 선택
3. Deployments 탭 클릭
4. 최신 배포 상태 확인:
   - 🟡 Building → 빌드 중
   - 🟢 Success → 배포 완료
   - 🔴 Failed → 빌드 실패 (로그 확인 필요)

### 방법 2: cURL로 헤더 확인
```bash
curl -I https://live.ur-team.com | grep -i "content-security-policy"
```

**예상 결과**:
```
Content-Security-Policy: default-src 'self'; script-src... connect-src 'self' https://api.ur-team.com https://live.ur-team.com https://firebasestorage.googleapis.com https://*.firebase.google.com https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://api.stripe.com https://api.tosspayments.com https://*.sentry.io https://o4510992097935360.ingest.us.sentry.io https://www.google-analytics.com...
```

### 방법 3: 브라우저에서 확인
1. **시크릿 모드** (Ctrl+Shift+N) 열기
2. https://live.ur-team.com/login 접속
3. **F12** → **Network** 탭
4. **Headers** 하위 탭에서 `Content-Security-Policy` 확인

---

## 🧪 테스트 시나리오

### 1️⃣ Firebase 로그인 테스트 (Critical)
**목표**: CSP 오류 없이 Firebase Custom Token 로그인 성공

**단계**:
1. 시크릿 모드로 https://live.ur-team.com/login 접속
2. **Kakao 로그인** 버튼 클릭
3. Kakao 계정으로 로그인
4. 콜백 처리 대기

**예상 결과**:
```javascript
// Console 로그
[LoginFlow] 🔑 Firebase Custom Token으로 직접 로그인
[LoginFlow] ✅ Firebase 로그인 성공: uid=kakao_473531125
[useAuthKR] ✅ User logged in: { uid: 'kakao_473531125', email: 'tobe2111@kakao.com' }

// ❌ 이전 오류 (사라져야 함)
// Fetch API cannot load https://identitytoolkit.googleapis.com/...
// Refused to connect because it violates the document's Content Security Policy
```

**성공 기준**:
- ✅ CSP 오류 없음
- ✅ Firebase 로그인 성공
- ✅ 사용자 프로필 페이지로 리다이렉트

---

### 2️⃣ Sentry 에러 리포팅 테스트
**목표**: Sentry에 에러가 정상적으로 전송됨

**단계**:
1. 시크릿 모드로 https://live.ur-team.com 접속
2. **F12** → **Console** 탭
3. 다음 명령 실행:
   ```javascript
   window.Sentry?.captureException(new Error('CSP 수정 후 테스트 - 2026-03-09'));
   ```

**예상 결과**:
```javascript
// Console 로그
[Sentry] Event sent successfully

// ❌ 이전 오류 (사라져야 함)
// Fetch API cannot load https://o4510992097935360.ingest.us.sentry.io/...
// Refused to connect because it violates the document's Content Security Policy
```

**Sentry Dashboard 확인**:
1. https://o4510992097935360.sentry.io/issues/ 접속
2. 5-10분 후 **Issues** 탭 확인
3. "CSP 수정 후 테스트 - 2026-03-09" 에러 확인

**성공 기준**:
- ✅ CSP 오류 없음
- ✅ Sentry Dashboard에 에러 표시됨

---

### 3️⃣ Google Analytics 테스트
**목표**: GA 이벤트가 정상적으로 전송됨

**단계**:
1. 시크릿 모드로 https://live.ur-team.com 접속
2. **F12** → **Network** 탭
3. **Filter**: `google-analytics.com`
4. 페이지 새로고침

**예상 결과**:
- ✅ `https://www.google-analytics.com/g/collect?...` 요청 성공 (Status: 200)
- ❌ CSP 오류 없음

---

## 📊 체크리스트

### 배포 확인
- [ ] GitHub Actions 완료
- [ ] Cloudflare Pages 빌드 성공
- [ ] CSP 헤더에 모든 도메인 포함
- [ ] 캐시 클리어 (Ctrl+Shift+R)

### 기능 테스트
- [ ] Firebase 로그인 성공
- [ ] Sentry 에러 전송 성공
- [ ] Google Analytics 연결 성공
- [ ] 콘솔에 CSP 오류 없음

### 모니터링
- [ ] Sentry Dashboard에서 에러 확인
- [ ] Cloudflare Analytics 확인
- [ ] 실제 사용자 로그인 테스트

---

## 🚨 문제 발생 시 대응

### Case 1: 여전히 CSP 오류 발생
**증상**: 배포 후에도 CSP 오류 계속 발생

**원인 가능성**:
1. 캐시 문제
2. CDN 전파 지연
3. 헤더 파일 미배포

**해결**:
```bash
# 1. 브라우저 캐시 완전 삭제
- 시크릿 모드 사용
- Ctrl+Shift+Delete → 캐시 삭제
- 브라우저 재시작

# 2. Cloudflare 캐시 퍼지
- Cloudflare Dashboard → Caching → Purge Everything

# 3. 배포 상태 재확인
curl -I https://live.ur-team.com | grep -i "content-security-policy"

# 4. 재배포 (마지막 수단)
git commit --allow-empty -m "chore: Force redeploy CSP fix"
git push origin main
```

---

### Case 2: Firebase 로그인은 되지만 Sentry는 차단
**증상**: Firebase는 성공, Sentry만 CSP 오류

**원인**: Sentry 도메인 누락 또는 와일드카드 문제

**해결**:
1. `public/_headers` 확인:
   ```
   https://*.sentry.io
   https://o4510992097935360.ingest.us.sentry.io
   ```
2. 두 도메인 모두 존재하는지 확인
3. 없으면 추가 후 재빌드

---

### Case 3: 빌드는 성공했지만 헤더가 반영 안 됨
**증상**: dist/_headers는 올바르지만 실제 사이트에서는 구 헤더 사용

**원인**: Cloudflare Pages 설정 문제

**해결**:
1. Cloudflare Dashboard → Pages → ur-live → Settings
2. **Build configuration** 확인:
   - Build command: `npm run build`
   - Build output directory: `dist`
3. **Environment variables** 확인
4. 강제 재배포:
   - Deployments → 최신 배포 → ... → Retry deployment

---

## 📚 참고 문서

| 문서 | 용도 |
|------|------|
| `public/_headers` | 원본 헤더 설정 |
| `dist/_headers` | 빌드 후 배포되는 헤더 |
| `TECH_DEBT_RESOLUTION.md` | 보안 시스템 상세 |
| `COMPLETE_PROJECT_STATUS_AND_ROADMAP.md` | 프로젝트 전체 현황 |

---

## 🔗 중요 링크

| 항목 | URL |
|------|-----|
| **Production** | https://live.ur-team.com |
| **Cloudflare Dashboard** | https://dash.cloudflare.com |
| **Sentry Dashboard** | https://o4510992097935360.sentry.io/ |
| **GitHub Actions** | https://github.com/tobe2111/ur-live/actions |
| **최신 커밋** | https://github.com/tobe2111/ur-live/commit/e3b9bfda |

---

## 🎯 다음 단계

### 배포 완료 후 (3분 후)
1. ✅ 테스트 시나리오 1, 2, 3 실행
2. ✅ 체크리스트 완료
3. ✅ Sentry Dashboard 확인

### 테스트 통과 후
- **High Priority 작업**:
  1. 백엔드 리팩토링 (8-12시간)
  2. UI 완성도 (11시간)
  
- **Medium Priority 작업**:
  3. 성능 최적화 (5-7일)
  4. 기능 확장 (7-10일)

---

**작성일**: 2026-03-09 03:40 KST  
**예상 배포 완료**: 2026-03-09 03:43 KST  
**다음 확인 시간**: 03:45 (배포 후 2분)

**연락처**: tobe2111@naver.com  
**GitHub**: https://github.com/tobe2111/ur-live
