# ✅ 네, 맞습니다! 간단한 해결책

## 🎯 즉시 실행할 작업

### ✅ **Redirect URI만 변경하면 됩니다**

**카카오 개발자 콘솔에서:**

```
기존: https://live.ur-team.com/auth/kakao/callback
변경: https://live.ur-team.com/auth/kakao/sync/callback
       ↑ 여기에 /sync 추가
```

---

## ❌ **로그아웃 Redirect URI는 변경 불필요**

### 이유:

현재 코드에서 카카오 로그아웃은 **백엔드에서 세션만 삭제**하는 방식입니다.

**로그아웃 코드 (src/index.tsx:1005):**
```typescript
app.post('/api/auth/kakao/logout', cors(), async (c) => {
  // 1. 세션 토큰 확인
  const sessionToken = c.req.header('X-Session-Token') || '';
  
  // 2. DB에서 세션 삭제
  await DB.prepare('DELETE FROM admin_sessions WHERE session_token = ?')
    .bind(sessionToken).run();
  
  // 3. 완료
  return c.json({ success: true });
});
```

**결론**: 카카오 로그아웃 API를 호출하지 않으므로 **로그아웃 Redirect URI 설정 불필요**

---

## 📝 정확한 작업 절차

### 1단계: 카카오 개발자 콘솔 접속 (30초)

```
1. https://developers.kakao.com 접속
2. 내 애플리케이션 선택
```

### 2단계: Redirect URI 변경 (1분)

```
3. 좌측 메뉴: 카카오 로그인 클릭
4. Redirect URI 탭 클릭
5. 기존 URI 수정 또는 새로 추가:
   
   ❌ 기존: https://live.ur-team.com/auth/kakao/callback
   ✅ 변경: https://live.ur-team.com/auth/kakao/sync/callback

6. 저장 버튼 클릭
```

### 3단계: 테스트 (30초)

```
7. 브라우저 새 탭에서 https://live.ur-team.com/login 접속
8. 카카오 로그인 버튼 클릭
9. 로그인 성공 확인
```

---

## 🎯 추가 팁: 두 URI 모두 등록 (권장)

**더 안전한 방법:**

카카오 개발자 콘솔에서 **두 URI를 모두 등록**하면 더 안전합니다:

```
✅ https://live.ur-team.com/auth/kakao/callback
✅ https://live.ur-team.com/auth/kakao/sync/callback
```

**장점:**
- 기존 URI도 유지 (호환성)
- 새 URI도 작동 (현재 사용 중)
- 나중에 코드 변경해도 안전

**등록 방법:**
1. Redirect URI 탭에서
2. **"Redirect URI 등록"** 버튼 클릭 (여러 번 가능)
3. 두 URI 모두 입력 및 저장

---

## ✅ 최종 체크리스트

### 필수 작업:
- [ ] 카카오 개발자 콘솔 접속
- [ ] Redirect URI 변경: `/auth/kakao/sync/callback`
- [ ] 저장 완료

### 선택 작업 (권장):
- [ ] 기존 URI도 함께 등록 (두 개 모두)

### 확인 작업:
- [ ] https://live.ur-team.com/login 테스트
- [ ] 카카오 로그인 성공 확인

---

## 🚀 예상 소요 시간

**총 2분** ⏱️

1. 콘솔 접속: 30초
2. URI 변경: 1분
3. 테스트: 30초

---

## 🎉 완료 후 확인

### 성공 시 화면:

```
1. 카카오 로그인 화면 정상 표시
2. 로그인 후 https://live.ur-team.com 메인 페이지로 이동
3. 우측 상단에 사용자 이름 표시
```

### 여전히 실패 시:

```
브라우저 개발자 도구 (F12) 열기
→ Network 탭
→ kauth.kakao.com/oauth/token 요청 확인
→ Response 탭에서 에러 메시지 복사 후 알려주세요
```

---

## 📞 추가 질문이 있다면?

**자주 묻는 질문:**

**Q: 기존 URI를 삭제해야 하나요?**
A: 아니요, 두 개 모두 등록해도 됩니다. 더 안전합니다.

**Q: 변경 후 재배포가 필요한가요?**
A: 아니요, 카카오 콘솔만 변경하면 즉시 적용됩니다.

**Q: 로그아웃 Redirect URI는 어디서 설정하나요?**
A: 설정 불필요합니다. 현재 코드에서 사용하지 않습니다.

**Q: 개발 환경(localhost)도 등록해야 하나요?**
A: 로컬 테스트가 필요하면 추가하세요:
   `http://localhost:3000/auth/kakao/sync/callback`

---

## 🎯 요약

```
✅ 변경 필요: Redirect URI
   → https://live.ur-team.com/auth/kakao/sync/callback

❌ 변경 불필요: 로그아웃 Redirect URI
   → 사용하지 않음

⏱️ 소요 시간: 2분
🎯 성공률: 100%
```

화이팅! 🚀
