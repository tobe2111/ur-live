# 🚀 하이브리드 채팅 시스템 - 급증 대비 전략

## 문제 정의
라이브 커머스는 갑작스러운 트래픽 급증 가능성 높음:
- 인플루언서 1명 홍보 → 수천 명 유입
- Firebase 동시 100명 제한 초과 시 서비스 마비
- 급증 시 비용 폭증 ($50~500/월)

## 해결책: 3단계 하이브리드 전략

### Phase 1: 즉시 적용 (0.5일 작업)
**자동 페일오버 시스템**

```typescript
// src/hooks/useAdaptiveChat.ts
export function useAdaptiveChat(streamId: number) {
  const [mode, setMode] = useState<'firebase' | 'polling'>('firebase')
  const firebaseChat = useFirebaseChat(streamId, mode === 'firebase')
  const pollingChat = usePollingChat(streamId, mode === 'polling')
  
  // Firebase 연결 실패 시 자동 전환
  useEffect(() => {
    if (mode === 'firebase' && firebaseChat.error) {
      console.warn('[Adaptive] Firebase failed, switching to polling')
      setMode('polling')
    }
  }, [firebaseChat.error])
  
  return mode === 'firebase' ? firebaseChat : pollingChat
}
```

**장점:**
- Firebase 100명 초과 시 자동으로 SSE 폴링으로 전환
- 기존 코드 거의 수정 없음
- 비용: 여전히 무료 (Cloudflare Workers)

### Phase 2: 중기 대응 (2일 작업)
**Cloudflare Durable Objects 추가**

```typescript
// 시청자 수에 따라 자동 선택
if (viewers < 100) {
  use Firebase (무료)
} else if (viewers < 1000) {
  use Durable Objects ($2/월)
} else {
  use 샤딩 (여러 Durable Objects)
}
```

### Phase 3: 장기 확장 (5일 작업)
**완전 분산 시스템**

- Cloudflare Durable Objects 메인
- Firebase는 백업
- Redis 캐싱 추가
- CDN 최적화
