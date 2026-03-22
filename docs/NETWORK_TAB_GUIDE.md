# 🔍 Network 탭에서 confirm 요청 Response 보는 방법

## 1️⃣ 개발자 도구 열기
- **F12** 키 누르기
- 또는 마우스 우클릭 → "검사" 클릭

## 2️⃣ Network 탭으로 이동
```
Elements | Console | Sources | Network | ... 
                                  ↑
                              여기 클릭!
```

## 3️⃣ 필터 설정 (중요!)
Network 탭 상단에 필터 입력창이 있습니다:
```
🔍 Filter: [여기에 "confirm" 입력]
```

## 4️⃣ "Preserve log" 체크박스 켜기
Network 탭 상단에:
```
☑️ Preserve log  (반드시 체크!)
```
이걸 체크하지 않으면 페이지 이동 시 기록이 사라집니다!

## 5️⃣ 결제 진행
1. 장바구니에서 "결제하기" 클릭
2. 결제 정보 입력
3. "결제하기" 버튼 클릭
4. 결제 완료 → Success 페이지로 이동

## 6️⃣ Network 탭에서 confirm 요청 찾기
```
Name                Status    Type      ...
───────────────────────────────────────────
confirm             400       xhr       ← 이거 클릭!
                    ↑
                  빨간색
```

## 7️⃣ Response 확인
confirm 요청을 클릭하면 오른쪽에 탭들이 나타납니다:
```
Headers | Preview | Response | Initiator | ...
                      ↑
                  여기 클릭!
```

## 8️⃣ Response 내용 복사
Response 탭에 JSON 형태로 에러 메시지가 표시됩니다:
```json
{
  "success": false,
  "error": "잘못된 시크릿키 연동 정보 입니다.",
  "code": "INVALID_SECRET_KEY"
}
```

**이 전체 내용을 복사해서 보내주세요!**

---

## 💡 **더 쉬운 방법 (Console 탭 이용):**

1. **Console 탭**으로 이동
2. 빨간색 에러 메시지 중에서:
   ```
   POST https://live.ur-team.com/api/payments/confirm 400 (Bad Request)
   ```
   이 줄을 **클릭**하면 자동으로 Network 탭의 해당 요청으로 이동합니다!

---

## 📸 **스크린샷으로 보내주셔도 됩니다!**

Network 탭 전체 화면을 스크린샷 찍어서 보내주세요!
