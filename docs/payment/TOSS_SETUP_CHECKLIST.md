# 🔍 토스페이먼츠 설정 체크리스트

## ✅ 완료된 항목
- [x] Frontend 위젯 키: `test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN`
- [x] Backend 위젯 키: `test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY`
- [x] API 버전: `2022-11-16` (모든 API)
- [x] Amount 타입: `Number()` 변환
- [x] Cloudflare 시크릿 등록 완료

## ⚠️ **필수 확인 사항: 토스 개발자센터 설정**

### 1️⃣ 로그인 및 MID 확인
1. https://developers.tosspayments.com/ 로그인
2. 상점관리자 메뉴 클릭

### 2️⃣ 결제 UI 설정 (가장 중요!)
1. **상점관리자 → 결제 UI 설정** 메뉴 이동
2. **결제 UI 목록**에서 `DEFAULT` variantKey 찾기
3. 해당 UI의 **상점 ID (MID) 확인**
4. **MID가 `turteamizy1`로 매칭되어 있는지 확인**

### 3️⃣ MID 매칭 필요 시
- 결제 UI 설정에서 MID를 `turteamizy1`로 변경
- 저장 후 테스트 재시도

---

## 🚨 핵심 이슈

**결제위젯 연동 키(`test_gck_`, `test_gsk_`)는 사업자번호별 고유 키**이지만,  
**결제 UI 설정에서 MID 매칭**이 안 되어 있으면 `INVALID_API_KEY` 에러가 발생합니다!

---

## 📋 테스트 절차

### **매칭 확인 후 테스트**
1. 토스 개발자센터에서 MID 매칭 완료
2. 새 시크릿 모드 열기
3. https://live.ur-team.com 접속
4. 결제 진행
5. 결과 확인

---

## 🔧 추가 디버깅

### **만약 여전히 에러 발생 시**

**Console에서 실행:**
```javascript
// 1. 현재 사용 중인 클라이언트 키 확인
console.log('Frontend Client Key:', document.querySelector('script[src*="tosspayments"]') ? 'SDK Loaded' : 'SDK Missing');

// 2. API 호출 테스트
fetch('/api/payments/confirm', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    paymentKey: 'test_payment_key',
    orderId: 'test_order',
    amount: 1000
  })
})
.then(r => r.json())
.then(data => {
  console.log('API Response:', JSON.stringify(data, null, 2));
  if (!data.success) {
    console.error('에러 코드:', data.code);
    console.error('에러 메시지:', data.error);
  }
});
```

### **Cloudflare Logs 확인**
1. https://dash.cloudflare.com/ 로그인
2. Workers & Pages → toss-live-commerce
3. Logs 탭에서 실시간 로그 확인
4. `[Payment]` 키워드로 필터링

---

## 🎯 최종 체크포인트

- [ ] 토스 개발자센터 로그인 완료
- [ ] 결제 UI 설정에서 MID 확인
- [ ] MID가 `turteamizy1`로 매칭되어 있음
- [ ] 새 결제 세션으로 테스트 (이전 세션 만료됨)
- [ ] Console/Network 탭에서 에러 확인
