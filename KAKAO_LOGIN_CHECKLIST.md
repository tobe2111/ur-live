# ✅ 카카오 로그인 완전 수정 체크리스트

## 🎯 2가지 작업 모두 필요!

### 1️⃣ 카카오 개발자 콘솔 (2분)

**Redirect URI 변경:**

```
https://developers.kakao.com 접속
→ 내 애플리케이션 선택
→ 카카오 로그인 > Redirect URI
→ 추가: https://live.ur-team.com/auth/kakao/sync/callback
→ 저장
```

- [ ] 완료

---

### 2️⃣ Cloudflare Pages (3분)

**환경 변수 설정:**

```
https://dash.cloudflare.com 접속
→ Workers & Pages
→ toss-live-commerce 선택
→ Settings > Environment variables
→ Add variable:
   변수명: KAKAO_REST_API_KEY
   값: 5dd74bccb797640b0efd070467f3bafd
   환경: Production ✅
→ Save
→ 재배포 대기 (2~3분)
```

- [ ] 완료
- [ ] 재배포 완료 확인

---

## 🧪 테스트 (1분)

```
https://live.ur-team.com/login 접속
→ 카카오 로그인 클릭
→ 로그인 성공 확인
```

- [ ] 성공

---

## 📊 진행 상황

```
[ ] 1단계: Redirect URI 변경 (카카오 콘솔)
[ ] 2단계: 환경 변수 설정 (Cloudflare)
[ ] 3단계: 재배포 완료 대기
[ ] 4단계: 테스트 성공
```

---

## ⏱️ 총 소요 시간

**약 6~8분**

1. 카카오 콘솔: 2분
2. Cloudflare 설정: 3분
3. 재배포 대기: 2~3분
4. 테스트: 1분

---

## 🎉 완료!

두 작업을 모두 완료하면 카카오 로그인이 정상 작동합니다! 🚀
