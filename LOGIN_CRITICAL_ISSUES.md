# 🚨 카카오 로그인 치명적 이슈 진단 및 해결

## 현재 상황
**URL**: `https://live.ur-team.com/?login=success&session=b25f4fb8-f6c6-4438-9417-82eea048be12&userId=3&userName=%EC%A0%95%EC%A7%80%EC%9B%90`

### 발견된 치명적 문제들
1. ❌ **헤더 UI 업데이트 안 됨**: 로그인 성공했지만 UI에 반영 안 됨
2. ❌ **라이브 페이지 → 홈으로 강제 이동**: 로그인 후 원래 페이지로 복귀 실패
3. ❌ **장바구니 데이터 소멸**: 라이브 페이지에서 담은 상품 사라짐
4. ❌ **세션 파라미터 미처리**: URL에 세션 정보가 있지만 localStorage에 저장 안 됨

---

## 문제 원인 분석

### 1. URL 파라미터 처리 누락 ⚠️ P0
**파일**: `src/pages/HomePage.tsx`

**현재 상태**:
```typescript
useEffect(() => {
  loadStreams()
  loadScheduledStreams()
  loadPopularProducts()
  loadUserInfo()  // localStorage만 체크
}, [])
```

**문제**:
- `useEffect`가 URL 파라미터를 전혀 체크하지 않음
- 백엔드가 `?login=success&session=xxx&userId=xxx&userName=xxx`를 전달해도 무시됨
- 사용자는 로그인했지만 UI는 로그인 전 상태 유지

**영향**:
- 헤더에 로그인 상태 표시 안 됨
- 세션이 localStorage에 저장 안 되어 새로고침 시 로그아웃
- 모든 페이지에서 동일한 문제 발생 가능

---

### 2. 리다이렉트 URL 손실 ⚠️ P0
**파일**: `src/pages/LoginPage.tsx`

**현재 흐름**:
1. 사용자가 `/live/123`에서 "장바구니 담기" 클릭
2. 로그인 필요 → `/login`으로 이동
3. 카카오 로그인 → 백엔드 콜백
4. 백엔드가 `state` 파라미터를 `/`로 리다이렉트 ❌

**문제**:
- `state` 파라미터가 항상 `/`로 고정됨
- 원래 페이지(`/live/123`) 정보 손실
- 사용자 경험 최악 (보던 라이브 사라짐)

**영향**:
- 사용자가 라이브 페이지에서 로그인 → 홈으로 튕김
- 장바구니에 담으려던 상품 정보 손실
- 구매 전환율 대폭 하락

---

### 3. 장바구니 임시 저장 복원 실패 ⚠️ P0
**파일**: `src/pages/KakaoCallbackPage.tsx`

**현재 상태**:
```typescript
const tempCartItem = getTempCartItem()
if (tempCartItem) {
  // 500ms 후 복원 시도
  setTimeout(async () => {
    await axios.post('/api/cart', {
      userId: user.id.toString(),
      productId: tempCartItem.productId,
      quantity: tempCartItem.quantity,
      priceSnapshot: tempCartItem.priceSnapshot,
      liveStreamId: tempCartItem.liveStreamId
    })
  }, 500)
}
```

**문제**:
- KakaoCallbackPage는 `/auth/kakao/callback` 경로에서만 실행
- 백엔드는 GET `/auth/kakao/sync/callback`에서 직접 리다이렉트
- KakaoCallbackPage를 거치지 않음 → 임시 장바구니 복원 안 됨

**영향**:
- 라이브 페이지에서 "장바구니 담기" → 로그인 → 상품 소멸
- 임시 저장 로직이 작동하지 않음
- 사용자가 다시 라이브 찾아야 함 (이탈 발생)

---

### 4. 세션 저장 로직 불일치 ⚠️ P1
**문제**:
- **Backend**: `session`, `userId`, `userName` URL 파라미터 전달
- **KakaoCallbackPage**: `accessToken`, `userId`, `userName` localStorage 저장
- **HomePage**: `user_id`, `user_name`, `session` localStorage 체크
- **다른 페이지들**: 다양한 키 조합 사용

**영향**:
- 키 불일치로 인한 인증 실패
- 페이지마다 다른 로그인 상태 표시
- 디버깅 극도로 어려움

---

## 긴급 수정 계획

### Phase 1: URL 파라미터 처리 (최우선) ⏱️ 10분
1. **HomePage.tsx**: URL 파라미터에서 세션 정보 추출 및 저장
2. **App.tsx**: 전역적으로 URL 파라미터 처리
3. **모든 페이지**: 동일한 로직 적용

### Phase 2: 리다이렉트 복원 ⏱️ 15분
1. **LivePage.tsx**: 로그인 전 현재 URL 저장
2. **LoginPage.tsx**: returnUrl 파라미터 전달
3. **Backend**: state 파라미터에 returnUrl 반영

### Phase 3: 장바구니 복원 로직 수정 ⏱️ 20분
1. **Backend 리다이렉트**: KakaoCallbackPage 경유하도록 수정
2. **또는**: HomePage에서 임시 장바구니 복원 로직 추가
3. **테스트**: 전체 플로우 검증

### Phase 4: 세션 키 통일 ⏱️ 30분
1. **auth.ts**: 표준 키 정의 (`session`, `user_id`, `user_name`)
2. **전체 코드**: 표준 키로 마이그레이션
3. **레거시 키**: 하위 호환성 유지하며 단계적 제거

---

## 예상 효과
✅ **로그인 후 UI 즉시 업데이트**
✅ **원래 페이지로 정확히 복귀**
✅ **장바구니 데이터 100% 보존**
✅ **일관된 세션 관리**
✅ **사용자 경험 대폭 개선**

---

## 총 소요 시간
- Phase 1: 10분 (긴급)
- Phase 2: 15분 (긴급)
- Phase 3: 20분 (중요)
- Phase 4: 30분 (중요)
- **총: 약 1.5시간**

---

## 즉시 시작
**Phase 1부터 즉시 수정 시작합니다!**
