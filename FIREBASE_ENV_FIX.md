# 🔴 Firebase 환경변수 누락 해결 가이드

## 📋 현재 상태:
- ✅ FIREBASE_PRIVATE_KEY: 설정됨 (1703 chars)
- ✅ FIREBASE_CLIENT_EMAIL: 설정됨
- ❌ FIREBASE_PROJECT_ID: **누락** ← 이거 추가 필요!
- ⚠️ FIREBASE_DATABASE_URL: 형식 오류

---

## 🔧 즉시 추가해야 할 환경변수:

### 1️⃣ FIREBASE_PROJECT_ID
**변수 이름:** `FIREBASE_PROJECT_ID`
**값:** `urteam-live-commerce-5b284`

### 2️⃣ FIREBASE_DATABASE_URL
**변수 이름:** `FIREBASE_DATABASE_URL`
**값:** `https://urteam-live-commerce-5b284-default-rtdb.firebaseio.com`

---

## 📝 설정 방법:

1. https://dash.cloudflare.com 접속
2. **Workers & Pages** → **ur-live** 선택
3. **Settings** → **Environment variables**
4. **Production** 섹션에서 **Add variable** 클릭
5. 위의 2개 변수 추가
6. **Save** 후 자동 재배포 대기 (2-3분)

---

## ✅ 설정 완료 후 검증:

```bash
curl https://live.ur-team.com/api/test/env | jq '.results[] | select(.name | startswith("FIREBASE"))'
```

모든 항목이 `"status": "pass"`여야 합니다!

