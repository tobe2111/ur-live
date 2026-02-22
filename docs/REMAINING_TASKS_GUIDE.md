# 남은 작업 구현 가이드

## 완료된 작업 (2/11)

✅ **1. Rate Limiting 구현** - API 요청 제한으로 DDoS 방어  
✅ **2. 백엔드 입력 검증 강화** - 프론트엔드 검증 외 서버 검증 추가

## 남은 작업 (9/11)

### 3. 정산 자동화 Phase 1 ⏳
**목표**: 자동 정산 계산 및 리포트 생성

**구현 계획**:
```typescript
// migrations/0051_add_settlements_automation.sql
CREATE TABLE IF NOT EXISTS settlement_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_sales REAL DEFAULT 0,
  platform_fee REAL DEFAULT 0,
  settlement_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  scheduled_date DATE,
  completed_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);

CREATE INDEX idx_settlement_schedules_seller ON settlement_schedules(seller_id);
CREATE INDEX idx_settlement_schedules_status ON settlement_schedules(status);
```

**API 엔드포인트**:
- `GET /api/admin/settlements/pending` - 미정산 내역 조회
- `POST /api/admin/settlements/calculate` - 정산 계산 실행
- `POST /api/admin/settlements/:id/process` - 정산 처리
- `GET /api/seller/settlements/history` - 셀러 정산 내역

**자동화 로직** (Cloudflare Cron Triggers):
```typescript
// wrangler.jsonc
{
  "triggers": {
    "crons": [
      "0 0 * * 1"  // 매주 월요일 자정
    ]
  }
}

// src/index.tsx - Cron handler
export default {
  async scheduled(event, env, ctx) {
    // 지난 주 정산 계산
    const lastMonday = new Date()
    lastMonday.setDate(lastMonday.getDate() - 7)
    
    await calculateWeeklySettlements(env, lastMonday)
  }
}
```

**예상 작업 시간**: 4-6시간

---

### 4. WebSocket 실시간 통신 구현 ⏳
**목표**: 폴링 방식을 WebSocket으로 대체

**주의**: Cloudflare Workers는 기본적으로 WebSocket을 지원하지만, Pages는 제한적입니다.

**대안 솔루션**:
1. **Cloudflare Durable Objects** (권장)
   - WebSocket 연결 지속
   - 실시간 채팅, 라이브 스트리밍 시청자 수

2. **Server-Sent Events (SSE)**
   - 단방향 실시간 푸시
   - HTTP/2 기반, 간단한 구현

3. **Pusher / Ably 통합**
   - 제3자 실시간 서비스
   - 무료 플랜 있음

**SSE 구현 예시** (가장 간단한 대안):
```typescript
// src/index.tsx
app.get('/api/live-streams/:id/events', async (c) => {
  const streamId = c.req.param('id')
  
  return new Response(
    new ReadableStream({
      async start(controller) {
        while (true) {
          const messages = await getLatestMessages(c.env.DB, streamId)
          const viewerCount = await getViewerCount(c.env.DB, streamId)
          
          controller.enqueue(`data: ${JSON.stringify({ messages, viewerCount })}\n\n`)
          
          await new Promise(r => setTimeout(r, 2000))
        }
      }
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    }
  )
})
```

**예상 작업 시간**: 6-8시간

---

### 5. 푸시 알림 시스템 구현 ⏳
**목표**: Web Push API 활용한 브라우저 알림

**구현 계획**:
```typescript
// public/sw.js - Service Worker
self.addEventListener('push', (event) => {
  const data = event.data.json()
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/logo.png',
      badge: '/badge.png',
      data: { url: data.url }
    })
  )
})

// 클라이언트 측 구독
async function subscribeToPush() {
  const registration = await navigator.serviceWorker.register('/sw.js')
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: PUBLIC_VAPID_KEY
  })
  
  await fetch('/api/push/subscribe', {
    method: 'POST',
    body: JSON.stringify(subscription)
  })
}
```

**DB 스키마**:
```sql
CREATE TABLE push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**예상 작업 시간**: 4-5시간

---

### 6. Recharts 차트 구현 ⏳
**목표**: 셀러 대시보드 매출/주문 차트

**Recharts는 이미 설치됨** (`package.json`에 포함)

**구현 예시**:
```typescript
// src/pages/SellerDashboardPage.tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

function SalesChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="sales" stroke="#8884d8" />
        <Line type="monotone" dataKey="orders" stroke="#82ca9d" />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

**API 엔드포인트**:
```typescript
// src/index.tsx
app.get('/api/seller/dashboard/stats', async (c) => {
  const sellerId = c.get('sellerId')
  const period = c.req.query('period') || '7d' // 7d, 30d, 90d
  
  const stats = await DB.prepare(`
    SELECT 
      DATE(created_at) as date,
      SUM(total_amount) as sales,
      COUNT(*) as orders
    FROM orders
    WHERE seller_id = ?
      AND created_at >= datetime('now', ?)
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `).bind(sellerId, period === '7d' ? '-7 days' : period === '30d' ? '-30 days' : '-90 days').all()
  
  return c.json({ success: true, data: stats.results })
})
```

**예상 작업 시간**: 2-3시간

---

### 7. 이미지 최적화 ⏳
**목표**: WebP 변환 및 CDN 통합

**Cloudflare Images 사용 (권장)**:
```typescript
// src/index.tsx - 이미지 업로드
app.post('/api/products/:id/images/upload', async (c) => {
  const file = await c.req.file()
  
  // Cloudflare Images로 업로드
  const formData = new FormData()
  formData.append('file', file)
  
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/images/v1`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CF_IMAGES_TOKEN}`
      },
      body: formData
    }
  )
  
  const result = await response.json()
  return c.json({ success: true, url: result.result.variants[0] })
})
```

**이미지 최적화 URL**:
```
https://imagedelivery.net/{account_hash}/{image_id}/public
```

**대안**: R2 + Cloudflare Polish
```typescript
// R2에 이미지 저장 후 Polish로 자동 최적화
const imageUrl = `https://live.ur-team.com/images/${filename}`
// Cloudflare Polish가 자동으로 WebP 변환
```

**예상 작업 시간**: 3-4시간

---

### 8. 데이터 내보내기 기능 ⏳
**목표**: CSV/Excel 내보내기

**CSV 내보내기 구현**:
```typescript
// src/index.tsx
app.get('/api/seller/orders/export', async (c) => {
  const sellerId = c.get('sellerId')
  
  const orders = await DB.prepare(`
    SELECT * FROM orders WHERE seller_id = ?
  `).bind(sellerId).all()
  
  // CSV 생성
  const csv = [
    ['주문ID', '날짜', '상품명', '수량', '금액', '상태'].join(','),
    ...orders.results.map(order => 
      [order.id, order.created_at, order.product_name, order.quantity, order.amount, order.status].join(',')
    )
  ].join('\n')
  
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orders_${new Date().toISOString()}.csv"`
    }
  })
})
```

**Excel 내보내기** (SheetJS - 브라우저에서 생성):
```typescript
// 클라이언트 측
import * as XLSX from 'xlsx'

function exportToExcel(data) {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Orders')
  XLSX.writeFile(wb, `orders_${Date.now()}.xlsx`)
}
```

**예상 작업 시간**: 2-3시간

---

### 9. 알림톡 어드민 요금제 관리 UI 구현 ⏳
**목표**: 어드민 대시보드에서 요금제 관리

**페이지 구성**:
```typescript
// src/pages/admin/AlimtalkPricingPage.tsx
import React, { useState, useEffect } from 'react'

export default function AlimtalkPricingPage() {
  const [pricingPlans, setPricingPlans] = useState([])
  
  useEffect(() => {
    fetchPricingPlans()
  }, [])
  
  async function fetchPricingPlans() {
    const response = await fetch('/api/admin/alimtalk/pricing')
    const data = await response.json()
    setPricingPlans(data.data)
  }
  
  async function updatePrice(id, newPrice) {
    await fetch(`/api/admin/alimtalk/pricing/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit_price: newPrice })
    })
    fetchPricingPlans()
  }
  
  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">알림톡 요금제 관리</h1>
      
      <div className="grid gap-4">
        {pricingPlans.map(plan => (
          <div key={plan.id} className="border rounded-lg p-4">
            <h3 className="font-bold">{plan.name}</h3>
            <p className="text-gray-600">{plan.description}</p>
            
            <div className="mt-4 flex items-center gap-4">
              <input
                type="number"
                value={plan.unit_price}
                onChange={(e) => updatePrice(plan.id, Number(e.target.value))}
                className="border rounded px-3 py-2"
              />
              <span>원/건</span>
            </div>
            
            <div className="mt-2 text-sm text-gray-500">
              할인율: {plan.discount_rate}% | 월 {plan.monthly_quota}건
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**예상 작업 시간**: 2-3시간

---

### 10. 알림톡 셀러 대시보드 UI 구현 ⏳
**목표**: 셀러가 알림톡 충전, 발송, 내역 조회

**페이지 구성**:
```typescript
// src/pages/seller/AlimtalkDashboardPage.tsx
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function AlimtalkDashboardPage() {
  const [balance, setBalance] = useState(0)
  const [messages, setMessages] = useState([])
  const [templates, setTemplates] = useState([])
  const navigate = useNavigate()
  
  useEffect(() => {
    fetchData()
  }, [])
  
  async function fetchData() {
    const [balanceRes, messagesRes, templatesRes] = await Promise.all([
      fetch('/api/seller/alimtalk/balance'),
      fetch('/api/seller/alimtalk/messages'),
      fetch('/api/seller/alimtalk/templates')
    ])
    
    setBalance((await balanceRes.json()).data.balance)
    setMessages((await messagesRes.json()).data)
    setTemplates((await templatesRes.json()).data)
  }
  
  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">알림톡 관리</h1>
      
      {/* 잔액 카드 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">알림톡 잔액</h2>
        <p className="text-3xl font-bold text-blue-600">{balance.toLocaleString()}원</p>
        <button
          onClick={() => navigate('/seller/alimtalk/charge')}
          className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg"
        >
          충전하기
        </button>
      </div>
      
      {/* 템플릿 목록 */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4">템플릿 관리</h2>
        <div className="grid gap-4">
          {templates.map(template => (
            <div key={template.id} className="border rounded-lg p-4">
              <h3 className="font-bold">{template.name}</h3>
              <p className="text-sm text-gray-600 mt-1">{template.content}</p>
              <span className={`mt-2 inline-block px-3 py-1 rounded text-sm ${
                template.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {template.status}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* 발송 내역 */}
      <div>
        <h2 className="text-lg font-semibold mb-4">발송 내역</h2>
        <table className="w-full border">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">날짜</th>
              <th className="p-3 text-left">수신번호</th>
              <th className="p-3 text-left">템플릿</th>
              <th className="p-3 text-left">상태</th>
              <th className="p-3 text-right">비용</th>
            </tr>
          </thead>
          <tbody>
            {messages.map(msg => (
              <tr key={msg.id} className="border-t">
                <td className="p-3">{new Date(msg.created_at).toLocaleString()}</td>
                <td className="p-3">{msg.recipient_phone}</td>
                <td className="p-3">{msg.template_name}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-sm ${
                    msg.status === 'sent' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {msg.status}
                  </span>
                </td>
                <td className="p-3 text-right">{msg.cost}원</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

**예상 작업 시간**: 3-4시간

---

### 11. 알림톡 주문/배송 자동 발송 연동 ⏳
**목표**: 주문 생성, 배송 시작, 배송 완료 시 자동 알림톡 발송

**구현 계획**:
```typescript
// src/lib/alimtalk-auto.ts
export async function sendOrderConfirmation(env, orderId: number) {
  const order = await getOrder(env.DB, orderId)
  
  // 알림톡 발송
  await sendAlimtalk(env, {
    senderKey: order.seller_kakao_channel,
    templateCode: 'order_confirm',
    to: order.buyer_phone,
    message: `[주문 확인]\n주문번호: ${order.id}\n상품명: ${order.product_name}\n금액: ${order.total_amount}원\n배송지: ${order.shipping_address}`
  })
}

export async function sendShippingNotification(env, orderId: number) {
  const order = await getOrder(env.DB, orderId)
  
  await sendAlimtalk(env, {
    senderKey: order.seller_kakao_channel,
    templateCode: 'shipping_start',
    to: order.buyer_phone,
    message: `[배송 시작]\n주문번호: ${order.id}\n택배사: ${order.carrier}\n운송장번호: ${order.tracking_number}`
  })
}

// src/index.tsx - 주문 생성 시 자동 발송
app.post('/api/orders', async (c) => {
  // ... 주문 생성 로직
  
  // 자동 알림톡 발송
  try {
    await sendOrderConfirmation(c.env, orderId)
  } catch (error) {
    console.error('Failed to send order confirmation:', error)
    // 알림톡 실패해도 주문은 생성됨
  }
  
  return c.json({ success: true, orderId })
})
```

**예상 작업 시간**: 2-3시간

---

## 총 예상 작업 시간

| 작업 | 예상 시간 | 우선순위 |
|------|-----------|----------|
| 3. 정산 자동화 Phase 1 | 4-6시간 | High |
| 4. WebSocket 실시간 통신 | 6-8시간 | Medium |
| 5. 푸시 알림 시스템 | 4-5시간 | Medium |
| 6. Recharts 차트 구현 | 2-3시간 | High |
| 7. 이미지 최적화 | 3-4시간 | High |
| 8. 데이터 내보내기 | 2-3시간 | Medium |
| 9. 알림톡 어드민 UI | 2-3시간 | High |
| 10. 알림톡 셀러 UI | 3-4시간 | High |
| 11. 알림톡 자동 발송 | 2-3시간 | High |
| **총 예상 시간** | **28-39시간** | - |

## 우선순위별 구현 순서

### Week 1 (High Priority - 13-19시간)
1. **Recharts 차트 구현** (2-3h)
2. **이미지 최적화** (3-4h)
3. **알림톡 어드민 UI** (2-3h)
4. **알림톡 셀러 UI** (3-4h)
5. **알림톡 자동 발송** (2-3h)
6. **정산 자동화 Phase 1** (4-6h)

### Week 2 (Medium Priority - 15-20시간)
7. **데이터 내보내기** (2-3h)
8. **푸시 알림 시스템** (4-5h)
9. **WebSocket 실시간 통신** (6-8h)
10. **테스트 및 버그 수정** (3-4h)

## 참고 문서

- [Rate Limiting Guide](./RATE_LIMITING_GUIDE.md) ✅
- [Backend Validation Guide](./BACKEND_VALIDATION_GUIDE.md) ✅
- [Alimtalk Business Model](./ALIMTALK_BUSINESS_MODEL.md)
- [Aligo Alimtalk Simple Guide](./ALIGO_ALIMTALK_SIMPLE_GUIDE.md)

## 다음 단계

1. **Week 1 High Priority 작업 착수**
2. **Daily Progress Tracking**
3. **중간 배포 및 테스트**
4. **Week 2 Medium Priority 작업**
5. **최종 통합 테스트 및 배포**
