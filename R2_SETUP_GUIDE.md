# 🖼️ R2 이미지 업로드 활성화 가이드

## ⚠️ 현재 상태

R2가 활성화되지 않아 **임시로 Base64 방식**을 사용 중입니다.

**Base64 방식의 한계:**
- 이미지가 DB에 저장됨 (용량 큼)
- 최대 1MB 제한
- 성능 저하 가능

**권장: R2 활성화 후 전환**

---

## 🔧 R2 활성화 방법

### 1️⃣ Cloudflare Dashboard 접속
```
https://dash.cloudflare.com/
```

### 2️⃣ R2 활성화
1. 좌측 메뉴에서 **R2** 클릭
2. **"Enable R2"** 버튼 클릭
3. 결제 정보 입력 (무료 티어 사용 가능)
4. 활성화 완료 대기 (1-2분)

### 3️⃣ R2 버킷 생성
```bash
cd /home/user/webapp
npx wrangler r2 bucket create ur-live-images
```

### 4️⃣ wrangler.jsonc 설정
```jsonc
{
  // ... 기존 설정 ...
  "r2_buckets": [
    {
      "binding": "IMAGES",
      "bucket_name": "ur-live-images"
    }
  ]
}
```

### 5️⃣ 코드 전환
`src/index.tsx`에서 R2 관련 주석 해제:
```typescript
// ✅ R2 활성화 후 주석 해제
// const { IMAGES } = c.env;
```

### 6️⃣ 재배포
```bash
npm run build
npx wrangler pages deploy dist --project-name ur-live
```

---

## 💰 R2 무료 티어

- **스토리지**: 10GB / 월
- **Class A 작업** (업로드): 1,000,000 / 월
- **Class B 작업** (다운로드): 10,000,000 / 월
- **다운로드**: 10GB / 월

**예상 용량:**
- 셀러당 20개 상품 × 2개 이미지 × 800KB = 32MB
- 무료 티어로 약 **320명 셀러** 지원 가능

---

## 📊 Base64 vs R2 비교

| 항목 | Base64 (현재) | R2 (권장) |
|------|---------------|-----------|
| 최대 용량 | 1MB | 무제한 |
| 저장 위치 | DB | R2 버킷 |
| 성능 | 느림 | 빠름 |
| CDN | 없음 | 있음 |
| 비용 | 무료 | 10GB까지 무료 |

---

## 🚀 R2 활성화 후 자동 전환

R2를 활성화하고 버킷을 생성하면, 기존 코드가 **자동으로 R2를 사용**합니다.

기존 Base64 이미지는 그대로 유지되며, 새로 업로드되는 이미지만 R2에 저장됩니다.

---

**문서 작성일**: 2026-02-20
