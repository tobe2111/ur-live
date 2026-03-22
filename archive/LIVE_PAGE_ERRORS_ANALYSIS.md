# 라이브 페이지 에러 분석 및 해결 방안

**작성일**: 2026-03-03  
**페이지**: https://live.ur-team.com/live/20

---

## 📊 로딩 플로우 (정상 작동 부분)

### 1️⃣ 초기화 단계 ✅
```
1. TossPayments SDK 로드
2. Firebase Auth 확인
   - User UID: BpcLipJtvwasGTs162L2Dz56bD12
   - Backend에서 user_id=5 조회 성공
3. AuthContext 렌더링 완료
```

### 2️⃣ 데이터 로딩 ✅
```
1. GET /api/streams → 3개 스트림 로드
   - Stream 20 (현재)
   - Stream 19
   - Stream 15

2. 각 스트림의 상품 조회:
   - Stream 20: 3개 상품
   - Stream 19: 3개 상품  
   - Stream 15: 4개 상품

3. Reels 생성: 3개
4. Active index: 0 (Stream 20)
```

### 3️⃣ 실시간 연결 ✅
```
Firebase 구독:
- useFirebaseChat × 3
- useFirebaseStream × 3
- useFirebaseProduct × 3

결과:
- Stream 20: 6개 메시지, Product 21 (stock=10)
- Stream 19: 메시지 없음, Product 21
- Stream 15: 메시지 없음, Product 20 (stock=100)
```

### 4️⃣ YouTube 플레이어 ✅
```
3개 플레이어 초기화:
- Stream 20: XN71R4Sf5DQ
- Stream 19: VB4o0skZ4Lk
- Stream 15: 69xU_b5TfY8
```

---

## 🚨 발견된 에러 (우선순위별)

### 🔴 **1. 시청자 수 API 500 에러** (Critical)

**에러 메시지:**
```
GET /api/streams/20/viewer-count → 500 Internal Server Error
[LivePageV2] Failed to fetch viewer count
```

**발생 빈도:** 10초마다 반복

**원인:**
```sql
-- DB 쿼리에서 존재하지 않는 컬럼 참조
SELECT manual_viewer_count FROM live_streams WHERE id = ?
```

**근본 원인:**
- 마이그레이션 `0102_add_seller_manipulation_permissions.sql`이 **프로덕션 DB에 적용되지 않음**
- 로컬에서만 `npm run db:migrate:prod` 실행 (로컬 DB에만 적용)
- Cloudflare D1 원격 DB에는 미적용

**해결 방법:**

#### A. 원격 DB 마이그레이션 실행
```bash
# 원격 DB에 마이그레이션 적용
cd /home/user/webapp
npx wrangler d1 migrations apply toss-live-commerce-db --remote

# 또는 Cloudflare Dashboard에서 수동 실행
# https://dash.cloudflare.com/d1
```

#### B. 임시 해결책 (API 수정)
```typescript
// src/index.tsx Line 8190
app.get('/api/streams/:streamId/viewer-count', async (c) => {
  const { DB, SESSION_KV } = c.env;

  try {
    const streamId = c.req.param('streamId');

    // 1️⃣ D1에서 스트림 존재 확인 (컬럼 제거)
    const stream = await DB.prepare(
      'SELECT id FROM live_streams WHERE id = ?'  // manual_viewer_count 제거
    ).bind(streamId).first();

    if (!stream) {
      return c.json({ success: false, error: 'Stream not found' }, 404);
    }

    // 2️⃣ KV에서 실제 시청자 수 카운트
    const prefix = `stream:${streamId}:viewer:`;
    const list = await SESSION_KV.list({ prefix });
    const actualCount = list.keys.length;

    return c.json({ 
      success: true, 
      data: { 
        viewer_count: actualCount,
        is_manual: false
      } 
    });
  } catch (err) {
    console.error('[Viewer Count] Error:', err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});
```

**권장:** 원격 마이그레이션 실행 (A)

---

### 🟡 **2. Firebase 인덱스 경고** (Performance)

**경고 메시지:**
```
FIREBASE WARNING: Using an unspecified index. 
Consider adding ".indexOn": "timestamp" at /chats/stream20
```

**발생 위치:** 3개 스트림 모두

**영향:**
- 성능 저하 (클라이언트에서 필터링)
- 불필요한 데이터 다운로드

**해결 방법:**

#### Firebase Console에서 인덱스 추가
```json
// Firebase Realtime Database Rules
{
  "rules": {
    "chats": {
      "$streamId": {
        ".indexOn": ["timestamp"],
        ".read": true,
        ".write": "auth != null"
      }
    }
  }
}
```

**URL:** https://console.firebase.google.com/project/urteam-live-commerce-5b284/database/rules

---

### 🟢 **3. YouTube postMessage 경고** (Minor)

**경고 메시지:**
```
Failed to execute 'postMessage' on 'DOMWindow': 
The target origin provided ('https://www.youtube.com') 
does not match the recipient window's origin ('https://live.ur-team.com')
```

**원인:**
- YouTube IFrame API와 호스트 간 Cross-Origin 통신 시도
- YouTube 내부 동작으로 인한 경고 (무시 가능)

**영향:** 없음 (플레이어는 정상 작동)

**해결:** 불필요 (YouTube 내부 이슈)

---

### 🟢 **4. Passive Event Listener 경고** (Minor)

**경고 메시지:**
```
Added non-passive event listener to a scroll-blocking event. 
Consider marking event handler as 'passive'
```

**원인:**
- YouTube Embed Player 내부 코드
- Scroll/Touch 이벤트에 기본 동작 차단

**영향:** 미미 (약간의 스크롤 지연 가능)

**해결:** 
```javascript
// LivePageV2.tsx에서 touch 이벤트 수정
useEffect(() => {
  const handleTouch = (e: TouchEvent) => {
    // 로직
  }
  
  // passive: true 추가
  window.addEventListener('touchstart', handleTouch, { passive: true })
  return () => window.removeEventListener('touchstart', handleTouch)
}, [])
```

---

## 🛠️ 즉시 수정 필요 항목

### 1️⃣ 원격 DB 마이그레이션 (Critical)

**명령어:**
```bash
cd /home/user/webapp

# Cloudflare 원격 D1에 마이그레이션 적용
npx wrangler d1 migrations apply toss-live-commerce-db --remote

# 적용 확인
npx wrangler d1 execute toss-live-commerce-db --remote \
  --command "SELECT sql FROM sqlite_master WHERE type='table' AND name='live_streams'"
```

**예상 결과:**
```sql
-- manual_viewer_count 컬럼이 포함되어야 함
CREATE TABLE live_streams (
  ...
  manual_viewer_count INTEGER DEFAULT NULL,
  ...
)
```

---

### 2️⃣ Firebase 인덱스 추가 (Recommended)

**단계:**
1. https://console.firebase.google.com/project/urteam-live-commerce-5b284/database/rules
2. Rules 탭 클릭
3. 아래 규칙 추가:
```json
{
  "rules": {
    "chats": {
      "$streamId": {
        ".indexOn": ["timestamp"]
      }
    },
    "streams": {
      "$streamId": {
        ".indexOn": ["updated_at"]
      }
    },
    "products": {
      "$productId": {
        ".indexOn": ["updated_at"]
      }
    }
  }
}
```
4. "게시" 버튼 클릭

---

## 📊 에러 영향도 분석

| 에러 | 심각도 | 영향 | 사용자 체감 | 해결 우선순위 |
|------|--------|------|------------|-------------|
| 시청자 수 API 500 | 🔴 High | 시청자 수 표시 안 됨 | ⭐⭐⭐⭐⭐ | 1순위 |
| Firebase 인덱스 | 🟡 Medium | 성능 저하 | ⭐⭐⭐ | 2순위 |
| YouTube postMessage | 🟢 Low | 없음 | - | 무시 |
| Passive Event | 🟢 Low | 미미 | ⭐ | 3순위 |

---

## 🎯 권장 조치 순서

### 즉시 (1시간 이내)
1. ✅ 원격 DB 마이그레이션 실행
2. ✅ 배포 및 시청자 수 API 테스트

### 24시간 이내
3. ✅ Firebase 인덱스 추가
4. ✅ 성능 모니터링 (Firebase 대시보드)

### 선택 사항
5. ⏳ Passive event listener 추가 (개선 효과 미미)

---

## 🧪 테스트 체크리스트

### 마이그레이션 후 테스트
- [ ] https://live.ur-team.com/live/20 접속
- [ ] 콘솔에 500 에러 없는지 확인
- [ ] 시청자 수 표시 확인 (0명 또는 실제 카운트)
- [ ] 10초마다 자동 업데이트 확인

### Firebase 인덱스 후 테스트
- [ ] 콘솔에 Firebase WARNING 없는지 확인
- [ ] 채팅 메시지 로딩 속도 체감

---

## 📝 추가 개선 제안

### 1. 에러 처리 개선
```typescript
// LivePageV2.tsx
const fetchViewerCount = async () => {
  try {
    const response = await axios.get(`/api/streams/${streamId}/viewer-count`)
    if (response.data.success) {
      setViewerCount(response.data.data.viewer_count)
    }
  } catch (error) {
    // 500 에러 시 기본값 0으로 설정 (에러 숨김)
    setViewerCount(0)
    console.warn('[LivePageV2] Viewer count unavailable, using default:',error)
  }
}
```

### 2. 시청자 수 폴링 최적화
```typescript
// 10초마다 → 30초마다로 변경 (API 부하 감소)
const countInterval = setInterval(fetchViewerCount, 30000)
```

### 3. Firebase Query 최적화
```typescript
// useFirebaseChat.ts
const chatQuery = query(
  chatRef,
  orderByChild('timestamp'),
  limitToLast(50)
  // startAt() 추가로 오래된 메시지 제외 가능
)
```

---

## 🔍 결론

### 현재 상태
- ✅ 대부분의 기능 정상 작동
- ❌ 시청자 수 API만 500 에러 (DB 마이그레이션 미적용)
- ⚠️ Firebase 인덱스 없음 (성능 경고)

### 해결 방법
1. **원격 DB 마이그레이션 실행** (5분)
2. **Firebase 인덱스 추가** (5분)
3. **테스트 및 모니터링** (10분)

**총 소요 시간:** 20분  
**예상 효과:** 모든 에러 해결, 성능 개선

---

**작성자:** AI Assistant  
**문서 위치:** `/home/user/webapp/LIVE_PAGE_ERRORS_ANALYSIS.md`
