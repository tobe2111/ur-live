# 알리고 알림톡 간편 구현 가이드 (셀러 친화적)

**작성일**: 2026-02-22  
**버전**: 2.0 - Simplified  
**리셀러**: 알리고 (smartsms.aligo.in)

---

## 🎯 핵심 아이디어: "UR Live가 대신 관리"

### ❌ 복잡한 방식 (각 셀러가 직접 관리)
```
셀러 1 → 알리고 계정 생성 → API 키 발급 → UR Live 입력
셀러 2 → 알리고 계정 생성 → API 키 발급 → UR Live 입력
셀러 3 → 알리고 계정 생성 → API 키 발급 → UR Live 입력
...
❌ 문제: 셀러가 직접 알리고 가입, API 키 관리, 충전 → 너무 복잡!
```

### ✅ 간단한 방식 (UR Live가 통합 관리)
```
UR Live → 알리고 마스터 계정 1개 (대량 충전)
         ↓
    셀러 1, 2, 3... → UR Live 내에서만 충전/발송
    
✅ 해결: 셀러는 UR Live 대시보드에서만 관리 → 알리고 몰라도 됨!
```

---

## 🏗️ 간소화된 아키텍처

### 1. 전체 구조
```
┌─────────────────────────────────────────────────────────┐
│                     UR Live Platform                     │
│                                                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │  Seller A  │  │  Seller B  │  │  Seller C  │        │
│  │  잔액: 500 │  │  잔액: 300 │  │  잔액: 200 │        │
│  └────────────┘  └────────────┘  └────────────┘        │
│         │                │                │              │
│         └────────────────┴────────────────┘              │
│                         │                                │
│              ┌──────────────────┐                        │
│              │  Alimtalk API    │                        │
│              │   (UR Live가     │                        │
│              │    통합 관리)    │                        │
│              └──────────────────┘                        │
│                         │                                │
└─────────────────────────┼────────────────────────────────┘
                          ↓
                ┌──────────────────┐
                │   알리고 API     │
                │  (마스터 계정)   │
                │  user_id: urlive │
                │  api_key: xxx    │
                └──────────────────┘
                          ↓
                ┌──────────────────┐
                │  Kakao BizMsg    │
                └──────────────────┘
```

### 2. 셀러 입장에서 본 플로우
```
1. UR Live 대시보드 로그인
   ↓
2. "알림톡" 메뉴 클릭
   ↓
3. 카카오톡 채널 ID만 입력 (예: @myshop)
   ↓
4. UR Live가 자동으로 알리고 연동 완료
   ↓
5. 충전하기 (TossPayments로 UR Live에 결제)
   ↓
6. 템플릿 등록 (UR Live 대시보드에서)
   ↓
7. 발송 (자동 or 수동)
   
✅ 셀러는 알리고를 전혀 몰라도 됨!
```

---

## 📋 단계별 구현 가이드

### Step 1: UR Live 마스터 계정 설정 (1회만)

#### 1-1. 알리고 마스터 계정 생성
```
1. https://smartsms.aligo.in 회원가입
2. 사업자 정보 등록 (UR Team)
3. API 키 발급 신청
4. 대량 충전 (예: 100만건 × 6.5원 = 650만원)
```

#### 1-2. 환경 변수 설정
```bash
# .dev.vars (로컬)
ALIGO_API_KEY=your_api_key_here
ALIGO_USER_ID=urlive

# 프로덕션 (Cloudflare Secrets)
npx wrangler secret put ALIGO_API_KEY --project-name ur-live
npx wrangler secret put ALIGO_USER_ID --project-name ur-live
```

---

### Step 2: 셀러 온보딩 프로세스 (간소화)

#### 2-1. 셀러가 해야 할 일 (2단계만!)
```
1. 카카오톡 채널 생성 (https://center-pf.kakao.com/)
   - 채널 이름: "마이샵"
   - 채널 검색용 ID: @myshop
   - 비즈니스 인증: 사업자등록증 업로드

2. UR Live 대시보드에서 채널 ID 입력
   - [알림톡 관리] > [채널 등록]
   - 채널 ID: @myshop
   - [등록 요청] 클릭
   
✅ 끝! UR Live가 나머지는 자동 처리
```

#### 2-2. UR Live가 자동으로 처리하는 것
```
1. 알리고 API로 카카오 채널 인증 요청
2. 채널 등록 (UR Live 마스터 계정에 연결)
3. 기본 템플릿 자동 생성 (주문 확인, 배송 안내 등)
4. 셀러 DB에 채널 정보 저장
5. 셀러에게 "승인 완료" 알림
```

---

### Step 3: 충전 시스템 (UR Live 내부)

#### 3-1. 셀러 충전 플로우
```
셀러 대시보드
    ↓
[알림톡 충전] 버튼 클릭
    ↓
요금제 선택
    - 기본: 1,000건 / 15,000원 (건당 15원)
    - 스탠다드: 5,000건 / 65,000원 (건당 13원)
    - 프리미엄: 20,000건 / 220,000원 (건당 11원)
    ↓
TossPayments 결제
    ↓
UR Live DB에 셀러 잔액 증가
    - alimtalk_accounts.balance += 1000
    
✅ 알리고 계정은 건드리지 않음!
```

#### 3-2. 마진 구조
```
알리고 도매가: 6.5원 (알리고 최저가!)
UR Live 소매가: 13-15원
순이익: 6.5-8.5원 (마진율 50-130%)

예시:
셀러가 1,000건 충전 (15,000원)
  → UR Live DB: seller_balance += 1000
  → 알리고 잔액: 변동 없음 (이미 충전되어 있음)
  → UR Live 수익: 15,000원 (즉시 수익 발생!)
  
발송 시:
  → UR Live DB: seller_balance -= 1
  → 알리고 API 호출 (UR Live 마스터 계정으로 발송)
  → 알리고 잔액 차감: 6.5원
  → UR Live 실제 이익: 15 - 6.5 = 8.5원
```

---

## 🔌 알리고 API 연동 코드

### 1. 알리고 API 토큰 생성
```typescript
// src/lib/aligo.ts
export async function getAligoToken(
  env: any
): Promise<{ token: string; expire: number }> {
  const response = await fetch('https://smartsms.aligo.in/admin/api/akv10/token/create/30/s/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      apikey: env.ALIGO_API_KEY,
      userid: env.ALIGO_USER_ID
    })
  })

  const result = await response.json()
  
  if (result.result_code !== '1') {
    throw new Error(`Aligo token error: ${result.message}`)
  }

  return {
    token: result.token,
    expire: result.urtime
  }
}
```

### 2. 카카오 채널 등록 (셀러 온보딩)
```typescript
// src/lib/aligo.ts
export async function registerKakaoChannel(
  env: any,
  channelId: string,  // @myshop
  phoneNumber: string
): Promise<{ success: boolean; senderKey?: string }> {
  // 1. 토큰 생성
  const { token } = await getAligoToken(env)

  // 2. 카카오 채널 인증 요청
  const authResponse = await fetch('https://smartsms.aligo.in/admin/api/akv10/plus/request/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      token: token,
      userid: env.ALIGO_USER_ID,
      plusid: channelId,
      phonenumber: phoneNumber
    })
  })

  const authResult = await authResponse.json()

  if (authResult.result_code !== '1') {
    throw new Error(`Kakao channel auth error: ${authResult.message}`)
  }

  // 3. 채널 등록 (인증 후 자동 등록)
  const registerResponse = await fetch('https://smartsms.aligo.in/admin/api/akv10/plus/add/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      token: token,
      userid: env.ALIGO_USER_ID,
      plusid: channelId,
      phonenumber: phoneNumber
    })
  })

  const registerResult = await registerResponse.json()

  if (registerResult.result_code !== '1') {
    throw new Error(`Kakao channel register error: ${registerResult.message}`)
  }

  return {
    success: true,
    senderKey: registerResult.senderkey  // 발송에 필요한 키
  }
}
```

### 3. 템플릿 등록
```typescript
// src/lib/aligo.ts
export async function registerTemplate(
  env: any,
  senderKey: string,
  templateData: {
    name: string
    content: string
    templateCode: string
  }
): Promise<{ success: boolean; templateCode?: string }> {
  const { token } = await getAligoToken(env)

  const response = await fetch('https://smartsms.aligo.in/admin/api/akv10/template/add/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      token: token,
      userid: env.ALIGO_USER_ID,
      senderkey: senderKey,
      tpl_name: templateData.name,
      tpl_content: templateData.content,
      tpl_code: templateData.templateCode
    })
  })

  const result = await response.json()

  if (result.result_code !== '1') {
    throw new Error(`Template register error: ${result.message}`)
  }

  return {
    success: true,
    templateCode: result.tpl_code
  }
}
```

### 4. 알림톡 발송 (핵심!)
```typescript
// src/lib/aligo.ts
export async function sendAlimtalk(
  env: any,
  data: {
    senderKey: string
    templateCode: string
    to: string  // 수신자 전화번호 (01012345678)
    message: string  // 치환된 메시지 내용
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { token } = await getAligoToken(env)

  const response = await fetch('https://smartsms.aligo.in/admin/api/akv10/alimtalk/send/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      token: token,
      userid: env.ALIGO_USER_ID,
      senderkey: data.senderKey,
      tpl_code: data.templateCode,
      receiver_1: data.to,
      subject_1: '알림톡',
      message_1: data.message,
      // 버튼 추가 (선택)
      button_1: JSON.stringify({
        button: [
          {
            type: 'WL',
            name: '주문 확인',
            url_mobile: 'https://live.ur-team.com/orders',
            url_pc: 'https://live.ur-team.com/orders'
          }
        ]
      })
    })
  })

  const result = await response.json()

  if (result.result_code !== '1') {
    return {
      success: false,
      error: result.message
    }
  }

  return {
    success: true,
    messageId: result.msg_id
  }
}
```

---

## 🎨 셀러 대시보드 UI (초간단)

### 1. 알림톡 메인 대시보드
```tsx
// src/pages/seller/AlimtalkDashboard.tsx
export default function AlimtalkDashboard() {
  const [account, setAccount] = useState(null)
  const [stats, setStats] = useState(null)

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">📱 알림톡 관리</h1>

      {/* 잔액 & 통계 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>잔여 건수</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{account?.balance || 0}건</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>이번 달 발송</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.monthly_sent || 0}건</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>성공률</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.success_rate || 0}%</p>
          </CardContent>
        </Card>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-4">
        <Button onClick={() => router.push('/seller/alimtalk/charge')}>
          💳 충전하기
        </Button>
        <Button variant="outline" onClick={() => router.push('/seller/alimtalk/templates')}>
          📄 템플릿 관리
        </Button>
        <Button variant="outline" onClick={() => router.push('/seller/alimtalk/history')}>
          📊 발송 내역
        </Button>
      </div>

      {/* 채널 미등록 시 */}
      {!account && (
        <Card className="mt-6 border-yellow-300 bg-yellow-50">
          <CardHeader>
            <CardTitle>⚠️ 카카오톡 채널을 등록해주세요</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">알림톡 발송을 위해 카카오톡 채널 등록이 필요합니다.</p>
            <Button onClick={() => router.push('/seller/alimtalk/register')}>
              채널 등록하기
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

### 2. 채널 등록 페이지 (초간단!)
```tsx
// src/pages/seller/AlimtalkRegister.tsx
export default function AlimtalkRegister() {
  const [channelId, setChannelId] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    setLoading(true)
    
    try {
      const response = await api.post('/api/seller/alimtalk/register', {
        channel_id: channelId,
        phone_number: phoneNumber
      })

      if (response.data.success) {
        alert('채널 등록이 완료되었습니다! 승인까지 1-2일 소요됩니다.')
        router.push('/seller/alimtalk')
      }
    } catch (error) {
      alert('채널 등록 실패: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">카카오톡 채널 등록</h1>

      <Card>
        <CardHeader>
          <CardTitle>채널 정보 입력</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block mb-2">채널 검색용 ID</label>
            <Input
              placeholder="@myshop"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
            />
            <p className="text-sm text-gray-500 mt-1">
              카카오톡 채널 관리자에서 확인 가능합니다.
            </p>
          </div>

          <div>
            <label className="block mb-2">발신번호 (사업자 대표번호)</label>
            <Input
              placeholder="01012345678"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
          </div>

          <Button 
            onClick={handleRegister} 
            disabled={loading || !channelId || !phoneNumber}
            className="w-full"
          >
            {loading ? '등록 중...' : '채널 등록 요청'}
          </Button>
        </CardContent>
      </Card>

      {/* 안내 사항 */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>📌 등록 전 준비사항</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2">
            <li>카카오톡 채널 생성 (https://center-pf.kakao.com/)</li>
            <li>비즈니스 인증 완료 (사업자등록증 업로드)</li>
            <li>채널 검색용 ID 확인</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
```

### 3. 충전 페이지 (기존 TossPayments 재사용)
```tsx
// src/pages/seller/AlimtalkCharge.tsx
export default function AlimtalkCharge() {
  const [selectedPlan, setSelectedPlan] = useState('standard')

  const plans = {
    basic: { amount: 1000, price: 15000, unit: 15 },
    standard: { amount: 5000, price: 65000, unit: 13 },
    premium: { amount: 20000, price: 220000, unit: 11 }
  }

  const handleCharge = async () => {
    const plan = plans[selectedPlan]
    
    // TossPayments 결제 (기존 결제 시스템 재사용!)
    const response = await api.post('/api/seller/alimtalk/charge', {
      amount: plan.amount,
      price: plan.price
    })

    // TossPayments 결제 페이지로 이동
    window.location.href = response.data.payment_url
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">💳 알림톡 충전</h1>

      <div className="space-y-4">
        {Object.entries(plans).map(([key, plan]) => (
          <Card 
            key={key}
            className={`cursor-pointer ${selectedPlan === key ? 'border-blue-500' : ''}`}
            onClick={() => setSelectedPlan(key)}
          >
            <CardContent className="p-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold">
                    {key === 'basic' && '기본 플랜'}
                    {key === 'standard' && '스탠다드 플랜 (인기)'}
                    {key === 'premium' && '프리미엄 플랜'}
                  </h3>
                  <p className="text-gray-600">
                    {plan.amount.toLocaleString()}건 / {plan.price.toLocaleString()}원
                  </p>
                  <p className="text-sm text-gray-500">건당 {plan.unit}원</p>
                </div>
                <div className="text-2xl">
                  {selectedPlan === key ? '✅' : '⚪'}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button onClick={handleCharge} className="w-full mt-6">
        결제하기 {plans[selectedPlan].price.toLocaleString()}원
      </Button>
    </div>
  )
}
```

---

## 🚀 자동 발송 설정 (주문/배송 연동)

### 주문 확인 알림톡 자동 발송
```typescript
// src/index.tsx - 주문 생성 API 수정
app.post('/api/orders', async (c) => {
  const { env } = c
  // ... 기존 주문 생성 로직 ...

  // 주문 생성 성공 후 알림톡 자동 발송
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first()
  const seller = await env.DB.prepare('SELECT * FROM sellers WHERE id = ?').bind(order.seller_id).first()
  
  // 셀러의 알림톡 계정 조회
  const alimtalkAccount = await env.DB.prepare(
    'SELECT * FROM alimtalk_accounts WHERE seller_id = ? AND status = ?'
  ).bind(seller.id, 'active').first()

  if (alimtalkAccount && alimtalkAccount.balance > 0) {
    // 템플릿 조회
    const template = await env.DB.prepare(
      'SELECT * FROM alimtalk_templates WHERE account_id = ? AND template_code = ? AND status = ?'
    ).bind(alimtalkAccount.id, 'ORDER_CONFIRM', 'approved').first()

    if (template) {
      // 알림톡 발송
      const message = template.template_content
        .replace('#{고객명}', order.user_name)
        .replace('#{주문번호}', order.order_number)
        .replace('#{총금액}', order.total_amount.toLocaleString())

      const result = await sendAlimtalk(env, {
        senderKey: alimtalkAccount.sender_key,
        templateCode: 'ORDER_CONFIRM',
        to: order.user_phone,
        message: message
      })

      if (result.success) {
        // 발송 내역 저장
        await env.DB.prepare(`
          INSERT INTO alimtalk_messages 
          (account_id, template_id, order_id, recipient_phone, message_content, status, sent_at, cost)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          alimtalkAccount.id,
          template.id,
          orderId,
          order.user_phone,
          message,
          'sent',
          new Date().toISOString(),
          13
        ).run()

        // 잔액 차감
        await env.DB.prepare(
          'UPDATE alimtalk_accounts SET balance = balance - 1 WHERE id = ?'
        ).bind(alimtalkAccount.id).run()

        console.log('✅ 주문 확인 알림톡 자동 발송 성공:', result.messageId)
      }
    }
  }

  return c.json({ success: true, order_id: orderId })
})
```

---

## 💰 비용 분석 (알리고 vs 다른 리셀러)

### 알리고 vs 쿨에스엠에스 vs 다이렉트센드
| 리셀러 | 도매가 | UR Live 소매가 | 순이익 | 마진율 |
|--------|--------|----------------|--------|--------|
| **알리고** | **6.5원** | 13-15원 | **6.5-8.5원** | **50-130%** ✅ |
| 쿨에스엠에스 | 10원 | 13-15원 | 3-5원 | 30-50% |
| 다이렉트센드 | 10원 | 13-15원 | 3-5원 | 30-50% |

**결론: 알리고가 마진이 2배 이상 높음! 🎉**

---

## 🎯 핵심 요약

### ✅ 셀러가 해야 할 일 (2단계)
1. 카카오톡 채널 생성 & 비즈니스 인증
2. UR Live에 채널 ID 입력

### ✅ UR Live가 처리하는 것 (자동)
1. 알리고 API로 채널 등록
2. 템플릿 심사 대행
3. 발송 API 통합
4. 잔액 관리 (셀러별 독립)
5. 통계 & 분석

### ✅ 셀러가 몰라도 되는 것
- ❌ 알리고 계정 생성
- ❌ API 키 발급
- ❌ 알리고 충전
- ❌ 복잡한 API 호출

### 💰 수익 구조
```
셀러 충전: 1,000건 × 15원 = 15,000원 (즉시 수익!)
실제 발송 비용: 1,000건 × 6.5원 = 6,500원
UR Live 순이익: 8,500원 (마진율 130%)

✅ 선충전 방식이므로 현금 흐름 우수!
```

---

## 📚 참고 자료

- [알리고 알림톡 API 문서](https://smartsms.aligo.in/alimapi.html)
- [알리고 API 예제](https://smartsms.aligo.in/shop/kakaoexample.html)
- [카카오 비즈니스 채널](https://center-pf.kakao.com/)

---

**문의**: dev@ur-team.com  
**작성자**: Claude Code Agent  
**버전**: 2.0 - Simplified (2026-02-22)
