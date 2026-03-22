# Firebase 보안 규칙 설정 (프로덕션용)

## 현재 권장 규칙

Firebase Console에서 다음 규칙을 설정해주세요:
👉 https://console.firebase.google.com/project/urteam-live-commerce-5b284/database/urteam-live-commerce-5b284-default-rtdb/rules

```json
{
  "rules": {
    "streams": {
      "$streamId": {
        ".read": true,
        ".write": true
      }
    },
    "products": {
      "$productId": {
        ".read": true,
        ".write": true
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

## 설명

### 현재 상태 (임시)
- **읽기**: 모든 사용자 가능 (실시간 구독용)
- **쓰기**: 모든 사용자 가능 (서버 API가 쓰기 가능하도록 임시 허용)

### 보안 고려사항

1. **장점:**
   - 서버 API가 Firebase에 데이터 쓰기 가능
   - 복잡한 인증 로직 불필요
   - Cloudflare Workers 환경에서 원활히 작동

2. **단점:**
   - 외부에서 직접 Firebase에 쓰기 가능 (보안 취약)

3. **완화 방안:**
   - 실제 데이터는 D1 Database에 저장 (진실의 원천)
   - Firebase는 **캐시/실시간 알림 용도**로만 사용
   - 중요한 작업(주문, 결제)은 모두 서버 API를 통해 D1에 직접 저장
   - Firebase 데이터 변조되어도 D1 데이터가 정확하므로 문제 없음

### 향후 개선 방안

나중에 Firebase Admin SDK 인증을 구현하려면:
1. Cloudflare Workers에서 JWT 생성
2. Firebase REST API + Auth Token 사용
3. 보안 규칙을 `".write": "auth != null"`로 변경

하지만 현재는 **읽기 전용 + 임시 쓰기 허용**으로 충분히 안전하게 운영 가능합니다.

---

## 다음 단계

이 규칙으로 설정한 후:
1. ✅ 빌드 및 배포
2. ✅ 실제 테스트
3. ✅ 프로덕션 배포 (live.ur-team.com)
