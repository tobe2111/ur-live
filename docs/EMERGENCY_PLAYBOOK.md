# 긴급 트래픽 대응 절차 (Emergency Playbook)

유어딜 백엔드가 갑작스러운 트래픽 급증을 받을 때 따라야 할 절차입니다.
목표: **checkout / payment / login 같은 핵심 플로우를 계속 살아있게 유지**.

---

## 아키텍처 요약

- **Feature Flags (Kill Switches)**: `src/worker/utils/feature-flags.ts`
  - KV 키 `feature_flags`에 저장 (SESSION_KV binding)
  - 30초 in-memory 캐시 → 토글 반영까지 최대 1분
- **Admin API**: `/api/admin/flags/*` (adminApp 하위 — requireAdmin + IP whitelist + audit)
- **적용된 엔드포인트**:
  - `POST /api/reviews` → `enable_reviews`
  - `GET /api/products/search/suggestions` → `enable_search_suggestions`
  - `GET /api/shorts/feed` → `enable_shorts_feed`
  - `POST /api/push/subscribe` → `enable_push_notifications`

**핵심 원칙**: checkout / payment / login 은 **절대로** 플래그 뒤에 두지 않습니다.

---

## 증상: 갑작스러운 트래픽 급증으로 서비스 지연

### 1. 즉시 (0-30초)
Cloudflare 대시보드에서 Rate Limiting Rules 및 Workers Analytics(Requests / Errors / CPU time)
그래프를 확인합니다. 비정상 오리진 IP는 WAF에서 차단.

### 2. 1분 이내 — Emergency Mode 활성화

```bash
# 모든 비핵심 기능을 한 번에 OFF (쇼츠 피드는 engagement 용도로 ON 유지)
curl -X POST https://live.ur-team.com/api/admin/flags/emergency-mode \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enable": true}'
```

응답:
```json
{
  "success": true,
  "mode": "emergency",
  "flags": {
    "enable_reviews": false,
    "enable_chat": false,
    "enable_analytics_tracking": false,
    "enable_push_notifications": false,
    "enable_shorts_feed": true,
    "enable_search_suggestions": false,
    "enable_realtime_viewer_count": false,
    "enable_donation_live_toast": false
  }
}
```

플래그는 30초 캐시 TTL을 가지므로, 전세계 모든 Worker isolate에 **최대 1분 이내**로 반영됩니다.

### 3. 단일 기능만 토글하고 싶다면

```bash
# 리뷰만 OFF
curl -X PATCH https://live.ur-team.com/api/admin/flags/enable_reviews \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": false}'

# 현재 상태 조회
curl https://live.ur-team.com/api/admin/flags \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 4. Sentry / Discord 확인
에러 패턴을 파악합니다:
- 5xx 스파이크 vs 4xx 스파이크
- 특정 엔드포인트 집중 여부 (→ 해당 기능 플래그 OFF)
- DB 타임아웃 → Cloudflare D1 상태 확인

### 5. 복구 확인 후 Emergency Mode 해제

```bash
curl -X POST https://live.ur-team.com/api/admin/flags/emergency-mode \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enable": false}'
```

---

## 플래그 의미

| 플래그 | OFF 시 동작 |
|---|---|
| `enable_reviews` | `POST /api/reviews` → 503 + retry_after=300 |
| `enable_search_suggestions` | `GET /search/suggestions` → `{ data: [] }` |
| `enable_shorts_feed` | `GET /shorts/feed` → `{ data: [], degraded: true }` |
| `enable_push_notifications` | `POST /push/subscribe` → 200 `{ skipped: true }` (재시도 루프 방지) |
| `enable_chat` | (예약됨 — chatRoutes에 추가 가능) |
| `enable_analytics_tracking` | (예약됨) |
| `enable_realtime_viewer_count` | (예약됨 — Durable Object 브로드캐스트 스로틀링) |
| `enable_donation_live_toast` | (예약됨 — 후원 실시간 알림) |

---

## 항상 ON (절대 플래그 뒤에 두지 말 것)

- `POST /api/payments/confirm` (결제)
- `POST /api/orders` (주문)
- `POST /api/auth/login` + `POST /api/seller/login` + `POST /api/admin/login`
- `GET  /health`, `GET /api/health` (모니터링)

---

## 플래그 추가하는 법

1. `src/worker/utils/feature-flags.ts` 의 `FeatureFlags` 인터페이스와 `DEFAULT_FLAGS`,
   `EMERGENCY_MODE_FLAGS`, `NORMAL_MODE_FLAGS` 에 새 키 추가.
2. 해당 라우트 핸들러 맨 앞에:
   ```ts
   const flags = await getFeatureFlags((c.env as Env).SESSION_KV);
   if (!flags.enable_XXX) {
     return c.json({ success: true, data: [] }); // 또는 503
   }
   ```
3. 이 문서 "플래그 의미" 표에 동작 추가.
