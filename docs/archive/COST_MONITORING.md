# UR Live 비용 모니터링 대시보드

## 📊 실시간 비용 모니터링 가이드

### 1. Cloudflare 대시보드 설정

#### Workers 모니터링
```
URL: https://dash.cloudflare.com/[account]/workers/analytics

핵심 지표:
- Requests (요청 수): 무료 한도 100,000/일
- CPU Time (CPU 시간): 10ms/요청 평균
- Errors (에러율): <1% 유지

알림 설정:
1. Workers & Pages → ur-live → Settings → Alerts
2. "Request volume" 알림 생성
   - Threshold: 90,000 requests/day (무료 한도의 90%)
   - Email notification
```

#### D1 Database 모니터링
```
URL: https://dash.cloudflare.com/[account]/d1/toss-live-commerce-db

핵심 지표:
- Reads: 무료 한도 5,000,000/day
- Writes: 무료 한도 100,000/day
- Storage: 무료 한도 5GB

알림 설정:
1. D1 → Settings → Usage alerts
2. "Read operations" 알림
   - Threshold: 4,500,000 reads/day (90%)
   - Email notification
```

#### KV Namespaces 모니터링
```
URL: https://dash.cloudflare.com/[account]/workers/kv/namespaces

핵심 지표:
- Read operations: 무료 한도 100,000/day (네임스페이스당)
- Write operations: 무료 한도 1,000/day
- Storage: 무료 한도 1GB

현재 사용 중인 KV:
1. SESSION_KV (3b522e69651f4d4f84a0cdf9430eeb72)
2. CACHE_KV (25ecc9ce2c464dd59edf5eb7d5fd1a10)
3. LIVE_CACHE (e6667599e01d4af8b4687560eb39394c)
```

---

### 2. Firebase 대시보드 설정

#### Firebase Console
```
URL: https://console.firebase.google.com/project/urteam-live-commerce-5b284

핵심 서비스:
1. Authentication (무료 50,000 MAU)
2. Realtime Database (무료 1GB 저장, 10GB 다운로드)
3. Storage (무료 5GB 저장, 1GB/day 전송)
```

#### Realtime Database 모니터링 (중요!)
```
경로: Firebase Console → Realtime Database → Usage

핵심 지표:
- Storage: 1GB 무료 (초과 시 $5/GB)
- Downloads: 10GB 무료 (초과 시 $1/GB) ⚠️
- Connections: 100 동시 연결 무료

⚠️ 비용 급증 원인: 채팅 대역폭
- 1,000명 시청 × 1 메시지 = 1MB × 1,000 = 1GB 다운로드
- 월 50GB 초과 시 = $40 추가 비용

알림 설정:
1. Project Settings → Usage and billing
2. "Set budget alerts"
   - Budget: $10/month
   - Threshold: 50%, 90%, 100%
```

#### Firebase Storage 모니터링
```
경로: Firebase Console → Storage → Usage

핵심 지표:
- Stored data: 5GB 무료
- Downloaded data: 1GB/day 무료 (30GB/month)
- Upload operations: 20,000/day 무료

알림 설정:
- Budget alerts 활성화
- 월 $5 이상 사용 시 알림
```

---

### 3. Toss Payments 모니터링

```
URL: https://developers.tosspayments.com/console

핵심 지표:
- 거래 건수 (Transactions)
- 거래 금액 (Transaction amount)
- 수수료 (2.9% 표준)

월간 리포트:
- 매월 1일: 전월 거래 내역 확인
- 수수료 협상 가능 시점: 월 거래액 1억 원 이상

다운로드 경로:
Payment → Analytics → Export CSV
```

---

### 4. Sentry 모니터링

```
URL: https://sentry.io/organizations/[org]/projects/

핵심 지표:
- Events (이벤트 수): 무료 5,000/month
- Issues (이슈 수): 오픈 이슈 < 10개 유지
- Error rate (에러율): <1%

알림 설정:
1. Settings → Alerts → Create Alert Rule
2. "When error rate increases by 50%"
   - Email notification
   - Slack webhook (optional)

Phase 1 최적화 후 예상:
- 100,000 MAU: 500,000 events/month → 250,000 events/month
- 비용: $699/month → $299/month (57% 절감)
```

---

## 📈 주간 모니터링 체크리스트

### 매주 월요일 오전 (10분 소요)

```markdown
## Week of [날짜]

### Cloudflare
- [ ] Workers 요청 수: _______/day (목표: <90,000)
- [ ] D1 Read operations: _______/day (목표: <4M)
- [ ] KV Read operations: _______/day (목표: <90,000)
- [ ] 에러율: _______% (목표: <1%)

### Firebase
- [ ] Realtime DB 저장: _______GB (목표: <0.8GB)
- [ ] Realtime DB 다운로드: _______GB/month (목표: <40GB)
- [ ] Storage 사용량: _______GB (목표: <4GB)
- [ ] Auth MAU: _______ (무료 한도: 50,000)

### Toss Payments
- [ ] 이번 주 거래 건수: _______
- [ ] 이번 주 거래 금액: ₩_______
- [ ] 예상 수수료: ₩_______ (2.9%)

### Sentry
- [ ] 이번 주 이벤트 수: _______
- [ ] 오픈 이슈 수: _______
- [ ] 평균 에러율: _______%

### 총 예상 비용
- Cloudflare: $_______
- Firebase: $_______
- Toss Payments: ₩_______
- Sentry: $_______
- **월간 총 비용**: ₩_______ (~$_______)

### 이상 징후
- [ ] 비용 급증 항목: _______
- [ ] 조치 필요 사항: _______
```

---

## 🚨 알림 설정 요약

### Critical (즉시 대응)
| 서비스 | 지표 | 임계값 | 알림 방법 |
|--------|------|--------|-----------|
| Cloudflare Workers | Requests | 90,000/day | Email |
| Firebase Realtime DB | Downloads | 8GB/day (240GB/month) | Email + Slack |
| D1 Database | Reads | 4.5M/day | Email |
| Toss Payments | Daily transaction | ₩10M/day | Dashboard 확인 |

### Warning (주간 검토)
| 서비스 | 지표 | 임계값 | 알림 방법 |
|--------|------|--------|-----------|
| Firebase Storage | Storage | 4GB | Email |
| KV Namespaces | Reads | 80,000/day | Dashboard 확인 |
| Sentry | Events | 20,000/week | Email |

---

## 💡 비용 절감 자동화 스크립트

### Cloudflare Workers Analytics API
```typescript
// src/scripts/monitor-costs.ts
import { Resend } from 'resend';

interface CostAlert {
  service: string;
  metric: string;
  current: number;
  threshold: number;
  percentage: number;
}

async function checkCloudflareUsage() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics/workers`,
    {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      },
    }
  );
  
  const data = await response.json();
  const dailyRequests = data.result.requests;
  const threshold = 90000; // 90% of free tier
  
  if (dailyRequests > threshold) {
    await sendAlert({
      service: 'Cloudflare Workers',
      metric: 'Daily Requests',
      current: dailyRequests,
      threshold,
      percentage: (dailyRequests / 100000) * 100,
    });
  }
}

async function sendAlert(alert: CostAlert) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  
  await resend.emails.send({
    from: 'alerts@ur-team.com',
    to: 'admin@ur-team.com',
    subject: `🚨 Cost Alert: ${alert.service} at ${alert.percentage.toFixed(0)}%`,
    html: `
      <h2>비용 알림</h2>
      <p><strong>서비스:</strong> ${alert.service}</p>
      <p><strong>지표:</strong> ${alert.metric}</p>
      <p><strong>현재 사용량:</strong> ${alert.current.toLocaleString()}</p>
      <p><strong>임계값:</strong> ${alert.threshold.toLocaleString()}</p>
      <p><strong>사용률:</strong> ${alert.percentage.toFixed(1)}%</p>
      <hr>
      <p>조치가 필요합니다.</p>
    `,
  });
}

// Cloudflare Workers Cron Trigger로 매일 실행
export default {
  scheduled: async (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    await checkCloudflareUsage();
    // Firebase, Sentry 등 다른 서비스 체크...
  },
};
```

### Cron 설정 (wrangler.toml)
```toml
# 매일 오전 9시 (KST) 비용 체크
[triggers]
crons = ["0 0 * * *"]  # UTC 00:00 = KST 09:00
```

---

## 📊 비용 대시보드 예시

### 예상 월간 비용 (10,000 MAU 기준)

```
┌─────────────────────────────────────────────────────┐
│  UR Live 운영 비용 대시보드 (2026-03)               │
├─────────────────────────────────────────────────────┤
│  MAU (월간 활성 사용자): 10,000                      │
│  거래 건수: 1,000건                                  │
│  거래 금액: ₩30,000,000                             │
├─────────────────────────────────────────────────────┤
│  📊 서비스별 비용 내역                               │
├─────────────────────────────────────────────────────┤
│  ☁️  Cloudflare                                     │
│     ├─ Workers: $43.50                              │
│     ├─ D1 Database: $0.00 (무료)                    │
│     ├─ KV: $0.00 (무료)                             │
│     └─ 소계: $43.50 (₩57,800)                       │
├─────────────────────────────────────────────────────┤
│  🔥 Firebase                                         │
│     ├─ Auth: $0.00 (무료)                           │
│     ├─ Realtime DB: $375 (Phase 1 후 $375→$112)    │
│     ├─ Storage: $3.57                               │
│     └─ 소계: $378.57 → $115.57 (₩153,200)          │
├─────────────────────────────────────────────────────┤
│  💳 Toss Payments                                   │
│     └─ 수수료: ₩870,000 (2.9%)                      │
├─────────────────────────────────────────────────────┤
│  🐛 Sentry                                          │
│     └─ 비용: $69 → $29 (₩38,500)                   │
├─────────────────────────────────────────────────────┤
│  💰 총 비용                                          │
│     ├─ Before Phase 1: ₩1,551,000 ($1,170)         │
│     ├─ After Phase 1: ₩1,085,000 ($818)            │
│     └─ 절감액: ₩466,000 (30% ↓)                    │
└─────────────────────────────────────────────────────┘

🎯 Phase 1 최적화 효과:
   ✅ Firebase 채팅 최적화: $375 → $112 (70% 절감)
   ✅ Sentry 샘플링: $69 → $29 (58% 절감)
   ✅ KV 캐시 강화: D1 무료 한도 유지
```

---

## 🔗 유용한 링크

### Cloudflare
- [Workers Analytics](https://dash.cloudflare.com/workers/analytics)
- [D1 Database Dashboard](https://dash.cloudflare.com/d1)
- [KV Namespaces](https://dash.cloudflare.com/workers/kv)
- [Pages Analytics](https://dash.cloudflare.com/pages)

### Firebase
- [Console](https://console.firebase.google.com/project/urteam-live-commerce-5b284)
- [Usage & Billing](https://console.firebase.google.com/project/urteam-live-commerce-5b284/usage)
- [Realtime Database](https://console.firebase.google.com/project/urteam-live-commerce-5b284/database)
- [Pricing Calculator](https://firebase.google.com/pricing)

### Others
- [Toss Payments Console](https://developers.tosspayments.com/console)
- [Sentry Dashboard](https://sentry.io/organizations/)
- [GitHub Repository](https://github.com/tobe2111/ur-live)

---

## 📝 다음 단계

### Phase 2 준비 (1-3개월)
1. **Firebase → Cloudflare Durable Objects 마이그레이션 검토**
   - 예상 절감: $375/월 → $56/월 (85% 절감)
   - 구현 난이도: 중
   - 예상 소요 시간: 2-4주

2. **결제 수수료 협상**
   - 목표: 2.9% → 2.5%
   - 조건: 월 거래액 1억 원 이상
   - 예상 절감: ₩1,160,000 → ₩750,000 (14% 절감)

3. **사용자 행동 분석**
   - 불필요한 API 요청 제거
   - 페이지 로드 최적화
   - 이미지/동영상 압축

---

**작성일**: 2026-03-02  
**최종 업데이트**: Phase 1 최적화 적용 후  
**다음 검토**: 2026-03-09 (1주일 후)
