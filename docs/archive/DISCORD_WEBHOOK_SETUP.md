# 🔔 Discord Webhook 설정 가이드

## 1️⃣ Discord Webhook URL 생성 (5분)

### **Discord 서버 생성 또는 선택**
1. Discord 앱 또는 웹 (https://discord.com) 접속
2. 좌측 서버 목록에서 "+" 클릭 → "내 서버 만들기"
3. 서버 이름: "UR LIVE 모니터링" (원하는 이름)
4. 서버 생성 완료

### **에러 알림 채널 생성**
1. 서버에서 우클릭 → "채널 만들기"
2. 채널 이름: `#error-alerts` 또는 `#서버-에러`
3. 채널 타입: 텍스트 채널
4. 채널 생성 완료

### **Webhook URL 생성**
1. `#error-alerts` 채널 우클릭
2. "채널 편집" 클릭
3. 좌측 메뉴 → "통합" (Integrations)
4. "웹후크" (Webhooks) 섹션에서 "웹후크 만들기" 클릭
5. 웹후크 이름: "Error Monitor"
6. 웹후크 URL 복사 (예: `https://discord.com/api/webhooks/123456789/abcdefg...`)

---

## 2️⃣ Cloudflare Pages 환경변수 등록 (3분)

### **방법 1: Wrangler CLI 사용 (권장)**
```bash
cd /home/user/webapp

# Discord Webhook URL 등록
npx wrangler pages secret put DISCORD_WEBHOOK_URL --project-name ur-live

# 프롬프트가 나오면 복사한 Webhook URL 붙여넣기
# 예: https://discord.com/api/webhooks/123456789/abcdefg...
```

### **방법 2: Cloudflare 대시보드 사용**
1. https://dash.cloudflare.com 로그인
2. Workers & Pages → ur-live 프로젝트 클릭
3. Settings → Environment variables
4. Production 탭에서 "Add variable" 클릭
5. 변수 이름: `DISCORD_WEBHOOK_URL`
6. 값: 복사한 Webhook URL 붙여넣기
7. "Save" 클릭

---

## 3️⃣ 로컬 개발 환경 설정 (선택)

```bash
# .dev.vars 파일 생성 또는 수정
cd /home/user/webapp

cat >> .dev.vars << 'DEVVARS'
# Discord Webhook (로컬 테스트용)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_URL
DEVVARS
```

**⚠️ 주의**: `.dev.vars` 파일은 `.gitignore`에 포함되어 있어야 합니다 (이미 설정됨)

---

## 4️⃣ 테스트 (2분)

### **에러 발생시켜서 Discord 알림 확인**

```bash
# 프로덕션 배포
npm run build
npx wrangler pages deploy dist --project-name ur-live

# 배포 후 임의로 에러 발생시키기
# 예: 존재하지 않는 API 호출
curl https://live.ur-team.com/api/non-existent-endpoint
```

### **Discord 채널 확인**
- `#error-alerts` 채널에 빨간색 에러 카드가 나타나야 함
- 에러 메시지, 발생 시각, API 경로, 사용자 정보 포함

---

## 5️⃣ 알림 예시

### **에러 알림**
```
🚨 서버 에러 발생
━━━━━━━━━━━━━━━━
에러 메시지: Cannot read property 'id' of undefined
발생 시각: 2026-02-26 10:30:15
HTTP 메소드: POST
API 경로: /api/orders
사용자 ID: 123
사용자 타입: user
에러 스택:
```
TypeError: Cannot read property 'id' of undefined
    at /app/src/index.tsx:1234:56
    at async dispatch (...)
```
```

### **중요 이벤트 알림** (향후 추가 가능)
```
💰 결제 완료
━━━━━━━━━━━━━━━━
주문번호: ORD-260226-ABCDE
결제금액: ₩125,000
사용자: ID 456
```

```
🎉 신규 셀러 가입
━━━━━━━━━━━━━━━━
셀러명: Premium Shop
이메일: seller@example.com
사업자번호: 123-45-67890
```

---

## 6️⃣ 고급 설정 (선택)

### **알림 필터링 (특정 에러만 알림)**
```typescript
// src/index.tsx에서 조건 추가
app.onError(async (err, c) => {
  // 404 에러는 Discord 알림 안 보냄
  if (err.status === 404) {
    return c.json({ success: false, error: 'Not found' }, 404)
  }
  
  // 중요한 에러만 Discord 알림
  if (c.env.DISCORD_WEBHOOK_URL && err.status >= 500) {
    await sendDiscordAlert(...)
  }
  
  // ...
})
```

### **Discord 역할 멘션 (긴급 알림)**
```typescript
// 심각한 에러 발생 시 역할 멘션
const criticalError = {
  content: '<@&ROLE_ID>', // 역할 ID 멘션
  embeds: [{ ... }]
}
```

---

## 📊 예상 효과

### **기존 (Sentry)**
- ❌ 월 $26 비용
- ❌ 설정 복잡
- ❌ 무료 플랜 제한 (5,000 에러/월)

### **현재 (Discord Webhook)**
- ✅ **완전 무료**
- ✅ 설정 간단 (5분)
- ✅ **실시간 푸시 알림** (모바일 앱)
- ✅ 무제한 알림
- ✅ 채널별 분류 가능

---

## ✅ 체크리스트

- [ ] Discord 서버 생성
- [ ] `#error-alerts` 채널 생성
- [ ] Webhook URL 생성 및 복사
- [ ] Cloudflare Pages 환경변수 등록
- [ ] 프로덕션 배포
- [ ] 테스트 에러 발생시켜서 확인
- [ ] Discord 모바일 앱 설치 (선택)
- [ ] 알림 소리 설정 (선택)

---

**작성일**: 2026-02-26  
**소요 시간**: 총 10분  
**난이도**: ⭐ (매우 쉬움)
