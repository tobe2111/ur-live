# 트러블슈팅 가이드

## 해결된 문제들

### ✅ 1. GET /api/seller/streams 500 에러 (해결됨)

**문제:**
```
GET https://live.ur-team.com/api/seller/streams 500 (Internal Server Error)
Failed to load live streams: AxiosError: Request failed with status code 500
```

**원인:**
- GET `/api/seller/streams` 엔드포인트가 백엔드에 존재하지 않았음
- 프론트엔드에서 셀러 대시보드 로드 시 해당 API를 호출하는데, 엔드포인트가 없어 500 에러 발생

**해결:**
- 셀러가 자신의 스트림을 조회할 수 있는 GET 엔드포인트 추가:
```typescript
app.get('/api/seller/streams', async (c) => {
  const { DB } = c.env;
  const auth = await verifySellerSession(c);

  if (!auth.success) {
    return c.json({ success: false, error: auth.error }, 401);
  }

  try {
    const sellerId = auth.sellerId;
    
    const result = await DB.prepare(`
      SELECT * FROM live_streams 
      WHERE seller_id = ?
      ORDER BY created_at DESC
    `).bind(sellerId).all();

    return c.json({ 
      success: true, 
      data: result.results || []
    });
  } catch (error: any) {
    console.error('Error loading seller streams:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});
```

**배포:** https://8d2b751f.toss-live-commerce.pages.dev

---

## 남은 문제들

### ⚠️ 2. POST /api/seller/products 400 에러

**문제:**
```
POST https://live.ur-team.com/api/seller/products 400 (Bad Request)
Failed to create product: AxiosError: Request failed with status code 400
```

**가능한 원인:**
1. **필수 필드 누락**: `name`, `price`, `image_url` 중 하나가 비어있음
2. **이미지 URL 검증**: `image_url`이 비어있거나 유효하지 않음
3. **라이브 스트림 권한**: `live_stream_id`가 제공되었지만 소유권이 없음

**디버깅 방법:**
1. 브라우저 Console에서 정확한 에러 메시지 확인:
```javascript
// 에러 응답 예시
{
  success: false,
  error: "Name, price, and image are required"
}
```

2. Network 탭에서 요청 페이로드 확인:
```json
{
  "name": "상품명",
  "description": "설명",
  "price": 10000,
  "stock": 100,
  "image_url": "https://...",  // ← 이 필드가 비어있는지 확인
  "live_stream_id": 15
}
```

**임시 해결책:**
- 상품 등록 시 이미지 URL을 반드시 입력
- 또는 기본 이미지 URL 사용

---

### ℹ️ 3. YouTube 썸네일 404 에러 (정상)

**문제:**
```
GET https://img.youtube.com/vi/testuser/maxresdefault.jpg 404
GET https://img.youtube.com/vi/username/maxresdefault.jpg 404
```

**원인:**
- TikTok 스트림의 경우 `youtube_video_id`에 TikTok 사용자명이 저장됨 (`testuser`, `username`)
- 프론트엔드에서 YouTube 썸네일 URL을 자동으로 생성하는데, TikTok 사용자명으로는 YouTube 썸네일을 찾을 수 없음

**해결 방법:**
1. **플랫폼별 썸네일 처리**:
```typescript
function getThumbnailUrl(stream: LiveStream) {
  if (stream.platform === 'youtube') {
    return `https://img.youtube.com/vi/${stream.youtube_video_id}/maxresdefault.jpg`;
  } else if (stream.platform === 'tiktok') {
    // TikTok 기본 이미지 또는 플레이스홀더
    return 'https://picsum.photos/640/360?random=1';
  }
  return 'https://picsum.photos/640/360?random=2'; // fallback
}
```

2. **onError 핸들러**:
```jsx
<img 
  src={getThumbnailUrl(stream)}
  onError={(e) => {
    e.currentTarget.src = 'https://picsum.photos/640/360?random=3';
  }}
/>
```

---

### ℹ️ 4. YouTube iframe postMessage 경고 (무시 가능)

**문제:**
```
Failed to execute 'postMessage' on 'DOMWindow': 
The target origin provided ('https://www.youtube.com') does not match 
the recipient window's origin ('https://live.ur-team.com')
```

**원인:**
- YouTube Embed API가 iframe을 통해 메시지를 전송하려고 할 때 발생하는 보안 경고
- 브라우저의 Same-Origin Policy에 의한 정상적인 동작

**영향:**
- 기능에는 전혀 영향 없음
- 콘솔 경고일 뿐

**대응:**
- 무시해도 됨
- 또는 YouTube API 초기화 시 `origin` 파라미터 추가:
```javascript
new YT.Player('player', {
  videoId: 'VIDEO_ID',
  playerVars: {
    origin: window.location.origin
  }
});
```

---

### ℹ️ 5. TrustedHTML 경고 (보안 정책)

**문제:**
```
This document requires 'TrustedHTML' assignment. The action has been blocked.
```

**원인:**
- 브라우저의 Content Security Policy (CSP)에 의한 보안 경고
- 외부 스크립트(YouTube, Firebase 등)가 innerHTML을 사용하려 할 때 발생

**영향:**
- 대부분 기능에 영향 없음
- 브라우저가 자동으로 안전하게 처리

**대응:**
- 무시해도 됨
- 또는 CSP 헤더 조정 (권장하지 않음)

---

## 테스트 계정

### 셀러 계정
- **URL**: https://live.ur-team.com/seller/login
- **이메일**: seller@ur-team.com
- **비밀번호**: seller123

### 테스트 방법
1. 셀러 로그인
2. 대시보드에서 스트림 목록 확인 (해결됨 ✅)
3. 상품 등록 페이지 → 모든 필드 입력 후 등록
4. 에러 발생 시 Console에서 정확한 에러 메시지 확인

---

## 업데이트 내역

- **2026-02-09**: GET `/api/seller/streams` 엔드포인트 추가 (500 에러 해결)
- **배포 URL**: https://8d2b751f.toss-live-commerce.pages.dev
- **프로덕션**: https://live.ur-team.com

---

## 다음 단계

1. **상품 등록 400 에러**: 브라우저 Console에서 정확한 에러 메시지 확인 필요
2. **썸네일 처리**: 플랫폼별 썸네일 URL 생성 로직 개선
3. **에러 로깅**: 백엔드 에러 로그 확인 시스템 구축
