# Firebase 채팅 마이그레이션

## 🎯 목표
SSE 폴링 방식 채팅을 Firebase Realtime Database로 마이그레이션하여 0.2초 실시간 채팅 구현

## 📊 Firebase 데이터 구조

```json
{
  "chats": {
    "stream20": {
      "message_1234567890": {
        "id": 1234567890,
        "userId": 42,
        "userName": "홍길동",
        "userType": "viewer",
        "message": "안녕하세요!",
        "timestamp": 1740640000000,
        "isSeller": false,
        "isAdmin": false
      },
      "message_1234567891": {
        "id": 1234567891,
        "userId": 0,
        "userName": "🎉 시스템",
        "userType": "system",
        "message": "김**님이 아이폰 15 Pro를 담았습니다!",
        "timestamp": 1740640005000,
        "isSeller": false,
        "isAdmin": true
      }
    }
  }
}
```

## 🔄 마이그레이션 단계

### Phase 1: Firebase 채팅 훅 생성
- `useFirebaseChat.ts` 생성
- Firebase Realtime 리스너 구현
- 메시지 전송 함수 구현

### Phase 2: LivePageV2 통합
- `useLiveChat` → `useFirebaseChat` 교체
- 시스템 메시지 Firebase로 전송

### Phase 3: 서버 API 업데이트
- 채팅 메시지 POST → Firebase 저장
- D1은 히스토리 용도로만 유지 (선택)

## ⚡ 성능 비교

| 항목 | SSE 폴링 | Firebase |
|-----|---------|----------|
| 지연 | 5초 | 0.2초 |
| 서버 부하 | 높음 | 없음 |
| 비용 | D1 read 多 | 무료 |

## 🎉 기대 효과
- 채팅 응답 속도 **96% 개선** (5초 → 0.2초)
- 서버 부하 **100% 감소**
- 비용 **100% 절감**
