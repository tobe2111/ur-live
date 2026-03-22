# 알림톡 비즈니스 모델 구현 가이드

**작성일**: 2026-02-22  
**버전**: 1.0  
**작성자**: Claude Code Agent

---

## 📊 Executive Summary

**알림톡 비즈니스는 UR Live의 제2 수익원**으로, 라이브 커머스 플랫폼과 시너지가 큰 모델입니다.

### 💰 예상 수익 구조
- **라이브 커머스**: 판매 수수료 (거래액의 5-10%)
- **알림톡 서비스**: 셀러당 월 5만원-50만원 (발송량 기반)
- **예상 마진**: 건당 3-5원 (도매 10원 → 소매 13-15원)

---

## 🎯 알림톡 비즈니스 모델 개요

### 1. 비즈니스 구조
```
카카오 비즈메시지 API
        ↓
  리셀러 (중개업체)
        ↓ API 연동
   UR Live 플랫폼
        ↓ 충전 & 발송
    셀러 (고객)
```

### 2. 수익 모델
| 항목 | 설명 | 예시 |
|------|------|------|
| **도매가** | 리셀러에게 구매 | 건당 10-12원 |
| **소매가** | 셀러에게 판매 | 건당 13-15원 |
| **마진** | 차액 수익 | 건당 3-5원 |
| **월 발송량** | 셀러당 평균 | 3,000-10,000건 |
| **월 수익** | 셀러당 | 9,000-50,000원 |

### 3. 타겟 사용자
- **기존 셀러**: 라이브 커머스 판매자 (주문/배송 알림 필요)
- **신규 셀러**: 알림톡만 사용하는 소규모 사업자
- **대형 셀러**: 월 10만건 이상 발송 (대량 할인)

---

## 🏗️ 시스템 아키텍처

### 1. 전체 구조
```
┌─────────────────────────────────────────────────────────┐
│                     UR Live Platform                     │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Seller    │  │  Alimtalk    │  │   Billing    │  │
│  │  Dashboard  │  │   Service    │  │   System     │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  │
│         │                │                  │           │
│         └────────────────┴──────────────────┘           │
│                         │                                │
├─────────────────────────┼────────────────────────────────┤
│                         ↓                                │
│              ┌──────────────────┐                        │
│              │  Alimtalk API    │                        │
│              │   Integration    │                        │
│              └──────────────────┘                        │
│                         │                                │
└─────────────────────────┼────────────────────────────────┘
                          ↓
                ┌──────────────────┐
                │  Reseller API    │
                │ (쿨에스엠에스,     │
                │  다이렉트센드)     │
                └──────────────────┘
                          ↓
                ┌──────────────────┐
                │  Kakao BizMsg    │
                │      API         │
                └──────────────────┘
```

### 2. 데이터베이스 설계

#### **테이블 1: alimtalk_accounts (알림톡 계정)**
```sql
CREATE TABLE alimtalk_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  kakao_channel_id TEXT NOT NULL,         -- 카카오톡 채널 ID
  channel_name TEXT NOT NULL,              -- 채널명
  status TEXT DEFAULT 'pending',           -- pending, active, suspended
  api_key TEXT,                            -- 리셀러 API 키 (암호화)
  balance INTEGER DEFAULT 0,               -- 잔액 (건수)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);

CREATE INDEX idx_alimtalk_accounts_seller ON alimtalk_accounts(seller_id);
```

#### **테이블 2: alimtalk_templates (템플릿)**
```sql
CREATE TABLE alimtalk_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  template_code TEXT NOT NULL,             -- 템플릿 코드
  template_name TEXT NOT NULL,             -- 템플릿명
  template_content TEXT NOT NULL,          -- 템플릿 내용
  template_type TEXT DEFAULT 'basic',      -- basic, extra, channel, complex
  status TEXT DEFAULT 'pending',           -- pending, approved, rejected
  approved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES alimtalk_accounts(id)
);

CREATE INDEX idx_alimtalk_templates_account ON alimtalk_templates(account_id);
CREATE INDEX idx_alimtalk_templates_code ON alimtalk_templates(template_code);
```

#### **테이블 3: alimtalk_messages (발송 내역)**
```sql
CREATE TABLE alimtalk_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  template_id INTEGER NOT NULL,
  order_id INTEGER,                        -- 주문 연동 (선택)
  recipient_phone TEXT NOT NULL,           -- 수신자 전화번호
  message_content TEXT NOT NULL,           -- 실제 발송 내용
  status TEXT DEFAULT 'pending',           -- pending, sent, failed
  sent_at DATETIME,
  failed_reason TEXT,
  cost INTEGER DEFAULT 0,                  -- 발송 비용 (원)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES alimtalk_accounts(id),
  FOREIGN KEY (template_id) REFERENCES alimtalk_templates(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX idx_alimtalk_messages_account ON alimtalk_messages(account_id);
CREATE INDEX idx_alimtalk_messages_status ON alimtalk_messages(status);
CREATE INDEX idx_alimtalk_messages_created ON alimtalk_messages(created_at);
```

#### **테이블 4: alimtalk_charges (충전 내역)**
```sql
CREATE TABLE alimtalk_charges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,                 -- 충전 건수
  price INTEGER NOT NULL,                  -- 충전 금액 (원)
  unit_price INTEGER NOT NULL,             -- 건당 단가 (원)
  payment_method TEXT DEFAULT 'card',      -- card, bank_transfer
  payment_status TEXT DEFAULT 'pending',   -- pending, completed, failed
  payment_id TEXT,                         -- TossPayments 결제 ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES alimtalk_accounts(id)
);

CREATE INDEX idx_alimtalk_charges_account ON alimtalk_charges(account_id);
CREATE INDEX idx_alimtalk_charges_status ON alimtalk_charges(payment_status);
```

#### **테이블 5: alimtalk_pricing (요금제)**
```sql
CREATE TABLE alimtalk_pricing (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_name TEXT NOT NULL,                 -- 기본, 스탠다드, 프리미엄
  min_quantity INTEGER NOT NULL,           -- 최소 충전 건수
  max_quantity INTEGER,                    -- 최대 충전 건수
  unit_price INTEGER NOT NULL,             -- 건당 단가 (원)
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 기본 요금제 삽입
INSERT INTO alimtalk_pricing (plan_name, min_quantity, max_quantity, unit_price) VALUES
  ('기본', 1000, 4999, 15),
  ('스탠다드', 5000, 19999, 13),
  ('프리미엄', 20000, NULL, 11);
```

---

## 🔌 API 설계

### 1. 셀러 API (알림톡 관리)

#### **GET /api/seller/alimtalk/account**
셀러의 알림톡 계정 정보 조회
```typescript
// Response
{
  "success": true,
  "account": {
    "id": 1,
    "kakao_channel_id": "kakao_123456",
    "channel_name": "마이샵",
    "status": "active",
    "balance": 5000,  // 잔액 (건수)
    "created_at": "2026-02-22T10:00:00Z"
  }
}
```

#### **POST /api/seller/alimtalk/account**
알림톡 계정 생성
```typescript
// Request
{
  "kakao_channel_id": "kakao_123456",
  "channel_name": "마이샵"
}

// Response
{
  "success": true,
  "account_id": 1,
  "message": "알림톡 계정이 생성되었습니다. 심사 승인 후 사용 가능합니다."
}
```

#### **GET /api/seller/alimtalk/templates**
템플릿 목록 조회
```typescript
// Response
{
  "success": true,
  "templates": [
    {
      "id": 1,
      "template_code": "ORDER_CONFIRM_001",
      "template_name": "주문 확인",
      "template_content": "안녕하세요, #{고객명}님!\n주문이 접수되었습니다.\n주문번호: #{주문번호}",
      "status": "approved",
      "approved_at": "2026-02-20T10:00:00Z"
    }
  ]
}
```

#### **POST /api/seller/alimtalk/templates**
템플릿 등록 신청
```typescript
// Request
{
  "template_code": "DELIVERY_NOTICE_001",
  "template_name": "배송 안내",
  "template_content": "안녕하세요, #{고객명}님!\n상품이 배송 시작되었습니다.\n송장번호: #{송장번호}",
  "template_type": "basic"
}

// Response
{
  "success": true,
  "template_id": 2,
  "message": "템플릿 심사가 신청되었습니다. 승인까지 1-2일 소요됩니다."
}
```

#### **POST /api/seller/alimtalk/send**
알림톡 발송
```typescript
// Request
{
  "template_id": 1,
  "recipient_phone": "01012345678",
  "variables": {
    "고객명": "홍길동",
    "주문번호": "ORD-2026-0001"
  },
  "order_id": 123  // 선택
}

// Response
{
  "success": true,
  "message_id": 456,
  "status": "sent",
  "remaining_balance": 4999
}
```

#### **POST /api/seller/alimtalk/charge**
알림톡 충전
```typescript
// Request
{
  "amount": 5000,  // 충전 건수
  "payment_method": "card"
}

// Response
{
  "success": true,
  "charge_id": 789,
  "price": 65000,  // 총 금액 (5000건 × 13원)
  "unit_price": 13,
  "payment_url": "https://api.tosspayments.com/v1/payment/..."
}
```

#### **GET /api/seller/alimtalk/messages**
발송 내역 조회
```typescript
// Query: ?page=1&limit=20&status=sent
// Response
{
  "success": true,
  "messages": [
    {
      "id": 456,
      "template_name": "주문 확인",
      "recipient_phone": "010****5678",
      "status": "sent",
      "sent_at": "2026-02-22T10:30:00Z",
      "cost": 13
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

#### **GET /api/seller/alimtalk/statistics**
통계 조회
```typescript
// Query: ?start_date=2026-02-01&end_date=2026-02-28
// Response
{
  "success": true,
  "statistics": {
    "total_sent": 10000,
    "total_failed": 50,
    "success_rate": 99.5,
    "total_cost": 130000,
    "messages_by_date": [
      { "date": "2026-02-01", "count": 350 },
      { "date": "2026-02-02", "count": 420 }
    ],
    "messages_by_template": [
      { "template_name": "주문 확인", "count": 4500 },
      { "template_name": "배송 안내", "count": 3200 }
    ]
  }
}
```

### 2. 관리자 API (승인/정산)

#### **GET /api/admin/alimtalk/accounts**
알림톡 계정 목록 조회
```typescript
// Response
{
  "success": true,
  "accounts": [
    {
      "id": 1,
      "seller_name": "홍길동",
      "channel_name": "마이샵",
      "status": "active",
      "balance": 5000,
      "total_sent": 10000
    }
  ]
}
```

#### **PATCH /api/admin/alimtalk/accounts/:id/approve**
계정 승인
```typescript
// Request
{
  "status": "active"  // or "suspended"
}

// Response
{
  "success": true,
  "message": "계정이 승인되었습니다."
}
```

#### **GET /api/admin/alimtalk/settlement**
정산 내역 조회
```typescript
// Query: ?start_date=2026-02-01&end_date=2026-02-28
// Response
{
  "success": true,
  "settlement": {
    "total_revenue": 650000,      // 총 매출
    "total_cost": 500000,          // 총 도매 비용
    "profit": 150000,              // 순이익
    "total_messages": 50000,       // 총 발송 건수
    "by_seller": [
      {
        "seller_id": 1,
        "seller_name": "홍길동",
        "messages_sent": 10000,
        "revenue": 130000,
        "cost": 100000,
        "profit": 30000
      }
    ]
  }
}
```

---

## 🔗 리셀러 API 연동

### 1. 추천 리셀러
| 리셀러 | 도매가 | 특징 | 문서 |
|--------|--------|------|------|
| **쿨에스엠에스** | 10원 | REST API, SDK 제공 | [문서](https://coolsms.co.kr/alimtalk-api) |
| **다이렉트센드** | 10원 | 단일 요금제, API 연동 | [문서](https://directsend.co.kr) |
| **NHN Cloud** | 10-12원 | 엔터프라이즈급, 대량 발송 | [문서](https://www.nhncloud.com/kr/service/notification/kakaotalk-bizmessage) |

### 2. 쿨에스엠에스 API 연동 예시 (추천)

#### **환경 변수 설정**
```bash
# .dev.vars
COOLSMS_API_KEY=your_api_key
COOLSMS_API_SECRET=your_api_secret
COOLSMS_SENDER_KEY=your_sender_key
```

#### **알림톡 발송 함수**
```typescript
// src/lib/alimtalk.ts
import { Hono } from 'hono'

interface AlimtalkMessage {
  templateCode: string
  to: string
  variables: Record<string, string>
}

export async function sendAlimtalk(
  env: any,
  message: AlimtalkMessage
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = env.COOLSMS_API_KEY
  const apiSecret = env.COOLSMS_API_SECRET
  const senderKey = env.COOLSMS_SENDER_KEY

  // 1. HMAC 서명 생성
  const timestamp = Date.now().toString()
  const saltKey = crypto.randomUUID()
  const signature = await generateHMAC(
    apiSecret,
    timestamp + saltKey
  )

  // 2. API 요청
  try {
    const response = await fetch('https://api.coolsms.co.kr/kakao/v1/alimtalk/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${timestamp}, salt=${saltKey}, signature=${signature}`
      },
      body: JSON.stringify({
        senderKey: senderKey,
        templateCode: message.templateCode,
        to: message.to,
        content: formatTemplate(message.variables),
        buttons: []  // 버튼 설정 (선택)
      })
    })

    const result = await response.json()

    if (response.ok) {
      return {
        success: true,
        messageId: result.messageId
      }
    } else {
      return {
        success: false,
        error: result.errorMessage
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

// HMAC 서명 생성
async function generateHMAC(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(message)

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, messageData)
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}

// 템플릿 변수 치환
function formatTemplate(variables: Record<string, string>): string {
  let content = '안녕하세요, #{고객명}님!\n주문이 접수되었습니다.\n주문번호: #{주문번호}'
  
  for (const [key, value] of Object.entries(variables)) {
    content = content.replace(`#{${key}}`, value)
  }
  
  return content
}
```

#### **Hono API 엔드포인트**
```typescript
// src/index.tsx
app.post('/api/seller/alimtalk/send', async (c) => {
  const { env } = c
  const { template_id, recipient_phone, variables, order_id } = await c.req.json()

  // 1. 세션 검증
  const sessionToken = c.req.header('X-Session-Token')
  const session = await getSessionInfo(env, sessionToken)
  if (!session || session.user_type !== 'seller') {
    return c.json({ success: false, error: 'Unauthorized' }, 401)
  }

  // 2. 알림톡 계정 조회
  const account = await env.DB.prepare(
    'SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = ?'
  ).bind(session.user_id, 'active').first()

  if (!account) {
    return c.json({ success: false, error: 'Alimtalk account not found' }, 404)
  }

  // 3. 잔액 확인
  if (account.balance < 1) {
    return c.json({ success: false, error: 'Insufficient balance' }, 400)
  }

  // 4. 템플릿 조회
  const template = await env.DB.prepare(
    'SELECT * FROM alimtalk_templates WHERE id = ? AND account_id = ? AND status = ?'
  ).bind(template_id, account.id, 'approved').first()

  if (!template) {
    return c.json({ success: false, error: 'Template not found or not approved' }, 404)
  }

  // 5. 알림톡 발송
  const result = await sendAlimtalk(env, {
    templateCode: template.template_code,
    to: recipient_phone,
    variables: variables
  })

  if (!result.success) {
    return c.json({ success: false, error: result.error }, 500)
  }

  // 6. 발송 내역 저장
  const messageResult = await env.DB.prepare(`
    INSERT INTO alimtalk_messages 
    (account_id, template_id, order_id, recipient_phone, message_content, status, sent_at, cost)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    account.id,
    template_id,
    order_id || null,
    recipient_phone,
    formatTemplate(template.template_content, variables),
    'sent',
    new Date().toISOString(),
    13  // 건당 단가
  ).run()

  // 7. 잔액 차감
  await env.DB.prepare(
    'UPDATE alimtalk_accounts SET balance = balance - 1, updated_at = ? WHERE id = ?'
  ).bind(new Date().toISOString(), account.id).run()

  return c.json({
    success: true,
    message_id: messageResult.meta.last_row_id,
    status: 'sent',
    remaining_balance: account.balance - 1
  })
})
```

---

## 💳 결제 & 충전 시스템

### 1. 요금제 설계
| 플랜 | 충전 건수 | 건당 단가 | 총 금액 | 할인율 |
|------|----------|----------|---------|--------|
| **기본** | 1,000건 | 15원 | 15,000원 | 0% |
| **스탠다드** | 5,000건 | 13원 | 65,000원 | 13% |
| **프리미엄** | 20,000건 | 11원 | 220,000원 | 27% |
| **대량** | 100,000건 | 10원 | 1,000,000원 | 33% |

### 2. 충전 플로우
```
셀러 대시보드
    ↓
"알림톡 충전" 버튼 클릭
    ↓
요금제 선택 (1,000건, 5,000건, 20,000건)
    ↓
TossPayments 결제 (카드, 계좌이체)
    ↓
결제 성공 → alimtalk_charges 테이블 저장
    ↓
잔액 증가 (alimtalk_accounts.balance += 충전 건수)
    ↓
충전 완료 알림
```

### 3. 자동 충전 옵션 (선택)
```typescript
// 잔액이 100건 이하일 때 자동 충전
if (account.balance <= 100) {
  await autoCharge(account.id, 1000)  // 기본 플랜 자동 충전
}
```

---

## 🎨 UI/UX 설계

### 1. 셀러 대시보드 - 알림톡 섹션
```
┌────────────────────────────────────────────────────────┐
│  📱 알림톡 관리                                         │
├────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐│
│  │  잔여 건수   │  │   이번 달    │  │   성공률     ││
│  │              │  │   발송 건수  │  │              ││
│  │   5,000건    │  │   3,450건    │  │    99.8%     ││
│  └──────────────┘  └──────────────┘  └──────────────┘│
│                                                         │
│  [💳 충전하기]  [📄 템플릿 관리]  [📊 발송 내역]      │
│                                                         │
├────────────────────────────────────────────────────────┤
│  📋 최근 발송 내역                                      │
├────────────────────────────────────────────────────────┤
│  주문 확인  |  010****1234  |  성공  |  02/22 10:30   │
│  배송 안내  |  010****5678  |  성공  |  02/22 10:25   │
│  배송 완료  |  010****9012  |  성공  |  02/22 10:20   │
└────────────────────────────────────────────────────────┘
```

### 2. 알림톡 충전 페이지
```
┌────────────────────────────────────────────────────────┐
│  💳 알림톡 충전                                         │
├────────────────────────────────────────────────────────┤
│                                                         │
│  현재 잔액: 500건                                       │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │ ⭕ 기본 플랜                                      │ │
│  │    1,000건 / 15,000원 (건당 15원)                │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │ ⚪ 스탠다드 플랜 (인기)                           │ │
│  │    5,000건 / 65,000원 (건당 13원, 13% 할인)     │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │ ⚪ 프리미엄 플랜                                  │ │
│  │    20,000건 / 220,000원 (건당 11원, 27% 할인)   │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
│  [결제하기 15,000원]                                    │
│                                                         │
└────────────────────────────────────────────────────────┘
```

### 3. 템플릿 관리 페이지
```
┌────────────────────────────────────────────────────────┐
│  📄 알림톡 템플릿 관리                                  │
├────────────────────────────────────────────────────────┤
│                                                         │
│  [+ 새 템플릿 추가]                                     │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │ 주문 확인 (ORDER_CONFIRM_001)            ✅ 승인 │ │
│  │ 안녕하세요, #{고객명}님!                          │ │
│  │ 주문이 접수되었습니다.                            │ │
│  │ 주문번호: #{주문번호}                             │ │
│  │                                                   │ │
│  │ [수정] [삭제] [발송 테스트]                       │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │ 배송 안내 (DELIVERY_NOTICE_001)          ⏳ 심사 │ │
│  │ 안녕하세요, #{고객명}님!                          │ │
│  │ 상품이 배송 시작되었습니다.                       │ │
│  │ 송장번호: #{송장번호}                             │ │
│  │                                                   │ │
│  │ [수정] [삭제]                                     │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
└────────────────────────────────────────────────────────┘
```

---

## 📊 비즈니스 시뮬레이션

### 시나리오 1: 소규모 셀러 (월 3,000건)
```
발송 건수: 3,000건/월
셀러 단가: 13원 (스탠다드 플랜)
UR Live 수익: 3,000건 × 3원 = 9,000원/월
연간 수익: 108,000원/셀러
```

### 시나리오 2: 중규모 셀러 (월 10,000건)
```
발송 건수: 10,000건/월
셀러 단가: 11원 (프리미엄 플랜)
UR Live 수익: 10,000건 × 1원 = 10,000원/월 (마진 낮음)
연간 수익: 120,000원/셀러

※ 대량 플랜은 마진이 낮으므로 VIP 서비스로 제공
```

### 시나리오 3: 플랫폼 전체 (100명 셀러)
```
평균 발송: 5,000건/셀러/월
평균 마진: 3원/건
월 수익: 100명 × 5,000건 × 3원 = 1,500,000원
연간 수익: 18,000,000원

※ 라이브 커머스 수수료와 함께 안정적인 수익원
```

---

## 🚀 구현 로드맵

### Phase 1: 기본 인프라 (2주)
- ✅ 데이터베이스 마이그레이션
- ✅ 리셀러 API 연동 (쿨에스엠에스)
- ✅ 기본 API 엔드포인트 구현
- ✅ TossPayments 충전 시스템

### Phase 2: 셀러 UI (1주)
- ✅ 알림톡 대시보드
- ✅ 충전 페이지
- ✅ 템플릿 관리
- ✅ 발송 내역 조회

### Phase 3: 자동 발송 (1주)
- ✅ 주문 확인 자동 발송
- ✅ 배송 안내 자동 발송
- ✅ 배송 완료 자동 발송
- ✅ 재고 알림 자동 발송

### Phase 4: 분석 & 최적화 (1주)
- ✅ 발송 통계 차트
- ✅ 성공률 분석
- ✅ 비용 최적화 제안
- ✅ 관리자 정산 대시보드

---

## ⚠️ 주의사항

### 1. 법적 준수 사항
- **정보통신망법**: 광고성 정보 전송 제한 준수
- **개인정보보호법**: 전화번호 암호화 저장 필수
- **전자상거래법**: 수신 동의 관리 필수

### 2. 기술적 제약
- **카카오 정책**: 템플릿 심사 1-2일 소요
- **발송 제한**: 초당 100건 이하 (리셀러 제한)
- **실패율**: 1-2% 정도 발생 (번호 오류, 차단 등)

### 3. 비즈니스 리스크
- **도매가 변동**: 리셀러 가격 변동 대응 필요
- **경쟁 심화**: 다른 플랫폼도 알림톡 서비스 제공 중
- **마진 축소**: 대량 플랜은 마진이 매우 낮음

---

## 🎯 핵심 추천 사항

### 1. 초기 전략
- **무료 체험**: 신규 셀러에게 500건 무료 제공
- **자동 발송**: 주문/배송 알림 자동 연동으로 사용성 극대화
- **번들 판매**: 라이브 커머스 + 알림톡 패키지 할인

### 2. 마케팅 포인트
- 📱 "라이브 커머스와 완벽 연동!"
- 💰 "문자보다 저렴한 알림톡"
- 🚀 "주문/배송 자동 알림으로 시간 절약"
- 📊 "발송 통계로 고객 응답률 분석"

### 3. 차별화 전략
- **자동화**: 주문 상태별 자동 발송 (타 플랫폼 대비 우위)
- **통합 관리**: 라이브 커머스 + 알림톡 하나의 대시보드
- **합리적 가격**: 건당 13-15원 (경쟁사 대비 저렴)
- **빠른 심사**: 템플릿 심사 대행 서비스

---

## 📚 참고 자료

- [카카오 비즈메시지 가이드](https://kakaobusiness.gitbook.io/main/ad/infotalk)
- [쿨에스엠에스 API 문서](https://coolsms.co.kr/alimtalk-api)
- [NHN Cloud 알림톡 가이드](https://www.nhncloud.com/kr/service/notification/kakaotalk-bizmessage)
- [정보통신망법 광고성 정보 전송 제한](https://www.law.go.kr)

---

**문의**: dev@ur-team.com  
**작성자**: Claude Code Agent  
**버전**: 1.0 (2026-02-22)
