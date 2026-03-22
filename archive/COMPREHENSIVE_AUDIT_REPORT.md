# 🔍 종합 코드 감사 리포트

> 생성일: 2026-03-01T15:51:51.911Z
> 감사 대상: 5개 파일 (AuthContext, LoginPage, CheckoutPage, UserProfilePage, auth utils)

## 📊 요약

- 🔴 심각한 문제: **3개**
- ⚠️ 경고: **6개**
- ℹ️ 정보: **8개**

---

## 🔴 심각한 문제 (Critical)


### 1. [URL params] src/contexts/AuthContext.tsx:10

**문제**: signInWithCustomToken (line 10) 전에 replaceState가 없을 수 있음

**해결**: URL 파라미터를 signInWithCustomToken 호출 전에 제거해야 무한 루프 방지


### 2. [URL params] src/contexts/AuthContext.tsx:443

**문제**: signInWithCustomToken (line 443) 전에 replaceState가 없을 수 있음

**해결**: URL 파라미터를 signInWithCustomToken 호출 전에 제거해야 무한 루프 방지


### 3. [flow] src/contexts/AuthContext.tsx

**문제**: URL 파라미터 제거와 signInWithCustomToken 순서 확인 불가

**해결**: replaceState를 signInWithCustomToken 전에 호출해야 함


---

## ⚠️ 경고 (Warning)


### 1. [navigate] src/contexts/AuthContext.tsx:307

**경고**: 조건 없는 navigate() 호출: navigate('/login', { replace: true })

**권장**: 조건부로 호출되는지 확인 필요


### 2. [async] src/contexts/AuthContext.tsx:94

**경고**: onAuthStateChanged 콜백이 async 함수 - 비동기 작업이 많음

**권장**: async 작업 전에 동기적으로 상태 체크 필요


### 3. [state] src/contexts/AuthContext.tsx

**경고**: setIsAuthReady() 호출이 4개 - 너무 많음

**권장**: setState 호출을 최소화하고 배치로 처리


### 4. [getUserId] src/utils/auth.ts:88

**경고**: getUserId()이 localStorage에 의존함

**권장**: Custom Claims에서 user_id가 저장되므로 괜찮지만, Firebase UID 사용 권장


### 5. [setTimeout] src/pages/LoginPage.tsx:46

**경고**: setTimeout과 navigate를 함께 사용: navigate('/', { replace: true })  // ✅ 즉시 실행 (setTimeout 제거)

**권장**: setTimeout 제거하고 즉시 navigate 권장


### 6. [legacy] src/pages/CheckoutPage.tsx

**경고**: CheckoutPage가 구형 auth 함수 사용 (getUserId, isLoggedIn)

**권장**: useAuth() 훅으로 마이그레이션 권장 (기능은 정상)


---

## ℹ️ 정보 (Info)


1. **[useEffect]** src/contexts/AuthContext.tsx: useEffect #1: 빈 의존성 배열 (한 번만 실행)


2. **[useEffect]** src/contexts/AuthContext.tsx: useEffect #2: 의존성 = [searchParams, navigate]


3. **[localStorage]** src/contexts/AuthContext.tsx: localStorage 작업: get=3, set=14, remove=7, clear=1


4. **[isLoggedIn]** src/utils/auth.ts: isLoggedIn()이 Firebase Auth만 체크 ✅


5. **[redirect]** src/pages/LoginPage.tsx: hasRedirected useRef 사용 ✅


6. **[guard]** src/pages/CheckoutPage.tsx: isAuthReady 가드 사용 ✅


7. **[guard]** src/pages/UserProfilePage.tsx: 완벽한 인증 가드 (isAuthReady + isLoggedIn) ✅


8. **[rate-limit]** src/index.tsx: Rate Limit: 60초 ✅


---

## 🎯 최종 판단

❌ **심각한 문제가 발견되었습니다!** 즉시 수정이 필요합니다.

---

_자동 생성 리포트 - 종합 코드 감사 시스템 v1.0_
