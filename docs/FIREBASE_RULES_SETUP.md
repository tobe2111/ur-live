# Firebase 보안 규칙 설정 가이드

## ⚠️ 중요: 지금 바로 보안 규칙을 설정해주세요!

### 1단계: Firebase Console 규칙 페이지 열기
👉 https://console.firebase.google.com/project/urteam-live-commerce-5b284/database/urteam-live-commerce-5b284-default-rtdb/rules

### 2단계: 다음 규칙을 붙여넣기

```json
{
  "rules": {
    "streams": {
      "$streamId": {
        ".read": true,
        ".write": "auth != null"
      }
    },
    "products": {
      "$productId": {
        ".read": true,
        ".write": "auth != null"
      }
    },
    "chats": {
      "$streamId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

### 3단계: "게시" 버튼 클릭

⚠️ **주의**: 보안 규칙을 설정하지 않으면 데이터 읽기/쓰기가 차단됩니다!

---

## 설명

- **streams**: 방송 정보 (모두 읽기 가능, 서버만 쓰기)
- **products**: 상품 정보 (모두 읽기 가능, 서버만 쓰기)
- **chats**: 채팅 메시지 (모두 읽기/쓰기 가능)

서버는 Firebase Admin SDK를 통해 인증되므로 `auth != null` 조건을 통과합니다.
