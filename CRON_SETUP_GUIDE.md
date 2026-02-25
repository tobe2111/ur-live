# 🕐 재고 예약 만료 Cron 작업 설정 가이드

## 개요
주문 생성 시 예약된 재고(reserved_stock)가 10분 후에도 결제되지 않으면 자동으로 해제하는 Cron 작업입니다.

---

## 📋 구성 요소

### 1. API 엔드포인트 (이미 구현됨 ✅)
- **경로**: `GET /api/cleanup/expired-reservations`
- **기능**: 만료된 재고 예약 자동 해제
- **구현 위치**: `src/index.tsx` (line ~3105)

### 2. Cron Worker (신규 생성 ✅)
- **파일**: `workers/cleanup-cron.ts`
- **스케줄**: 매 5분마다 실행
- **작동 방식**: API 엔드포인트 호출

---

## 🚀 배포 방법

### Option 1: Cloudflare Workers Cron (권장) ⭐️

#### 1단계: Worker 배포
```bash
cd /home/user/webapp

# Cron Worker 배포
npx wrangler deploy --config wrangler-cron.toml
```

#### 2단계: Cron Trigger 확인
```bash
# Cron 스케줄 확인
npx wrangler cron show --config wrangler-cron.toml
```

배포 성공 시 출력:
```
✅ Successfully deployed ur-live-cleanup-cron
Cron Triggers: */5 * * * * (every 5 minutes)
```

#### 3단계: 수동 테스트
```bash
# Cron을 수동으로 실행 (테스트)
npx wrangler cron trigger --config wrangler-cron.toml
```

---

### Option 2: Cloudflare Dashboard에서 설정

#### 1단계: Worker 배포 (Cron 없이)
```bash
cd /home/user/webapp
npx wrangler deploy workers/cleanup-cron.ts --name ur-live-cleanup-cron
```

#### 2단계: Dashboard에서 Cron 설정
1. Cloudflare Dashboard 접속
2. **Workers & Pages** → **ur-live-cleanup-cron** 클릭
3. **Triggers** 탭
4. **Cron Triggers** 섹션에서 **Add Cron Trigger**
5. 스케줄 입력: `*/5 * * * *` (매 5분)
6. **Save** 클릭

---

### Option 3: 외부 스케줄러 사용

#### Cloudflare에서 Cron을 지원하지 않는 경우:

**A. GitHub Actions Cron**
```yaml
# .github/workflows/cleanup-cron.yml
name: Cleanup Expired Reservations
on:
  schedule:
    - cron: '*/5 * * * *'  # 매 5분
  workflow_dispatch:  # 수동 실행 허용

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Call cleanup API
        run: |
          curl -X GET https://live.ur-team.com/api/cleanup/expired-reservations \
            -H "X-Cron-Token: ${{ secrets.CRON_TOKEN }}"
```

**B. Vercel Cron (무료 플랜에서도 사용 가능)**
```json
// vercel.json
{
  "crons": [{
    "path": "/api/cleanup/expired-reservations",
    "schedule": "*/5 * * * *"
  }]
}
```

**C. Uptime Robot (무료, 5분 간격)**
1. https://uptimerobot.com 가입
2. 새 Monitor 생성
   - Type: HTTP(S)
   - URL: `https://live.ur-team.com/api/cleanup/expired-reservations`
   - Monitoring Interval: 5 minutes
3. 저장

---

## 🧪 테스트 방법

### 1. 수동 API 호출 테스트
```bash
curl https://live.ur-team.com/api/cleanup/expired-reservations
```

**예상 응답**:
```json
{
  "success": true,
  "message": "Expired reservations cleaned up",
  "releasedOrders": 3,
  "releasedProducts": [
    {"productId": 1, "releasedStock": 2},
    {"productId": 5, "releasedStock": 1}
  ]
}
```

### 2. 재고 예약 생성 → 만료 → 복구 테스트

#### Step 1: 테스트 주문 생성 (재고 예약)
```bash
curl -X POST https://live.ur-team.com/api/orders \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": 1, "quantity": 2, "price": 10000}],
    "userId": "test-user-id",
    "shippingAddress": {
      "name": "테스트",
      "phone": "010-1234-5678",
      "address": "서울시 강남구",
      "detailAddress": "123-45"
    }
  }'
```

**DB 확인** (재고 예약됨):
```sql
SELECT stock, reserved_stock FROM products WHERE id = 1;
-- 예: stock = 48, reserved_stock = 2
```

#### Step 2: 10분 대기 (또는 DB에서 강제로 만료 시간 변경)
```sql
-- reservation_expires_at을 과거로 변경 (테스트용)
UPDATE orders 
SET reservation_expires_at = datetime('now', '-1 hour')
WHERE status = 'pending' AND id = LAST_INSERT_ROWID();
```

#### Step 3: Cleanup API 호출
```bash
curl https://live.ur-team.com/api/cleanup/expired-reservations
```

#### Step 4: DB 확인 (재고 복구됨)
```sql
SELECT stock, reserved_stock FROM products WHERE id = 1;
-- 예: stock = 50, reserved_stock = 0 (복구됨!)

SELECT status FROM orders WHERE id = ?;
-- status = 'cancelled'
```

---

## 📊 모니터링

### Cloudflare Workers 로그 확인
```bash
# 최근 로그 조회
npx wrangler tail ur-live-cleanup-cron --format pretty

# 실시간 로그 스트리밍
npx wrangler tail ur-live-cleanup-cron
```

### 예상 로그 출력
```
[Cron] 🕐 Starting cleanup of expired reservations...
[Cron] ✅ Cleanup completed: {
  "success": true,
  "releasedOrders": 2,
  "releasedProducts": [...]
}
```

### 에러 로그
```
[Cron] ❌ Cleanup failed: API call failed: 500 Internal Server Error
```

---

## 🔒 보안 (선택사항)

### Cron API에 인증 추가

#### 1. 환경변수 설정
```bash
# Cron Worker에 비밀 토큰 추가
npx wrangler secret put CRON_TOKEN --config wrangler-cron.toml
# 입력: some-random-secret-token-12345
```

#### 2. Worker 코드 수정
```typescript
// workers/cleanup-cron.ts
const response = await fetch(apiUrl, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'X-Cron-Token': env.CRON_TOKEN  // 환경변수에서 읽기
  }
});
```

#### 3. API 엔드포인트 검증 추가
```typescript
// src/index.tsx
app.get('/api/cleanup/expired-reservations', async (c) => {
  // Cron 토큰 검증
  const cronToken = c.req.header('X-Cron-Token');
  if (cronToken !== c.env.CRON_TOKEN) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // 기존 로직...
});
```

---

## ⚠️ 주의사항

### 1. Cloudflare Pages의 한계
- **Pages는 Cron을 직접 지원하지 않습니다!**
- 별도의 Worker를 배포하거나 외부 스케줄러를 사용해야 함

### 2. Worker 비용
- **무료 플랜**: 하루 10만 요청 (5분 간격 Cron = 하루 288회 → 충분함)
- **유료 플랜**: 무제한

### 3. 실행 보장
- Cloudflare Workers Cron은 최대 99.9% 보장
- 중요한 작업은 재시도 로직 추가 권장

---

## ✅ 완료 체크리스트

- [ ] `workers/cleanup-cron.ts` 파일 생성됨
- [ ] `wrangler-cron.toml` 설정 파일 생성됨
- [ ] Worker 배포 완료
- [ ] Cron Trigger 설정 완료
- [ ] 수동 테스트 성공
- [ ] 재고 예약 → 만료 → 복구 플로우 확인
- [ ] 로그 모니터링 설정

---

## 📦 배포 커맨드 요약

```bash
# 1. Cron Worker 배포
cd /home/user/webapp
npx wrangler deploy --config wrangler-cron.toml

# 2. Cron 스케줄 확인
npx wrangler cron show --config wrangler-cron.toml

# 3. 수동 테스트
npx wrangler cron trigger --config wrangler-cron.toml

# 4. 로그 확인
npx wrangler tail ur-live-cleanup-cron --format pretty

# 5. Worker 삭제 (필요 시)
npx wrangler delete ur-live-cleanup-cron
```

---

## 🎯 결론

재고 예약 만료 시스템이 완성되었습니다!

- ✅ API 엔드포인트 구현 완료
- ✅ Cron Worker 파일 생성
- ✅ 배포 가이드 문서 작성
- ⚠️ **아직 배포는 안 함** (다음 단계에서 진행)

**다음 작업**: 긴급 과제 3 (환경변수 확인) 진행 예정

작성일: 2026-02-25
문서 상태: 완료 ✅
