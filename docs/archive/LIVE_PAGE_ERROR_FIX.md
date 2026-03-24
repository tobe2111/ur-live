# 🚨 라이브 페이지 에러 해결 가이드

## 📋 문제 현상
- **URL**: https://live.ur-team.com/live/20
- **에러**: "앗! 오류가 발생했습니다 - 예상치 못한 오류가 발생했습니다"
- **API 에러**: `{"success": false, "error": "Cannot read properties of undefined (reading 'call')"}`

---

## 🔍 원인 분석

### 1차 원인: D1 Database Binding 누락
**증상**:
```bash
curl https://live.ur-team.com/api/live-streams/20
# → {"success": false, "error": "Cannot read properties of undefined (reading 'call')"}
```

**원인**:
- Cloudflare Pages에 D1 database binding이 설정되지 않음
- `wrangler.jsonc`에는 설정되어 있지만, Cloudflare Pages 프로젝트에는 binding 누락

---

## ✅ 해결 방법

### 🔴 필수: Cloudflare Pages에 D1 Binding 추가

#### 방법 1: Cloudflare 대시보드 (권장)

1. **Cloudflare 대시보드 접속**
   - https://dash.cloudflare.com
   - Workers & Pages → `toss-live-commerce` 프로젝트 선택

2. **Settings 탭**
   - Settings → Functions → **D1 database bindings** 섹션

3. **D1 Binding 추가**
   ```
   Variable name: DB
   D1 database: toss-live-commerce-db
   ```

4. **저장 및 재배포**
   - Save
   - 자동으로 재배포됨 (또는 수동으로 npm run deploy)

#### 방법 2: Wrangler CLI

```bash
# Cloudflare Pages 프로젝트에 D1 binding 추가
cd /home/user/webapp

# 프로젝트 재배포 (binding이 적용됨)
npx wrangler pages deploy dist --project-name toss-live-commerce
```

---

### 🟡 추가 확인사항

#### 1. KV Namespace Binding도 확인
```
SESSION_KV → 3b522e69651f4d4f84a0cdf9430eeb72
CACHE_KV → 25ecc9ce2c464dd59edf5eb7d5fd1a10
```

#### 2. 환경 변수 확인
Cloudflare Pages → Settings → Environment variables

**필수 환경 변수**:
```
TOSS_SECRET_KEY=test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY  # (이미 설정됨)
KAKAO_REST_API_KEY=...  # (이미 설정됨)
```

---

## 🧪 확인 방법

### 1. API 테스트
```bash
# 라이브 스트림 조회
curl https://live.ur-team.com/api/live-streams/20

# 예상 응답 (정상)
{
  "success": true,
  "data": {
    "id": 20,
    "title": "...",
    ...
  }
}

# 예상 응답 (에러 - Binding 누락)
{
  "success": false,
  "error": "Cannot read properties of undefined (reading 'call')"
}
```

### 2. 브라우저 테스트
```
https://live.ur-team.com/live/20
→ 라이브 페이지 정상 표시
```

---

## 📊 현재 상태

### 코드 레벨
- ✅ **PaymentProvider import 수정**: 파일 상단으로 이동 완료
- ✅ **wrangler.jsonc**: D1 binding 설정 완료
- ✅ **빌드**: 성공
- ✅ **배포**: 성공

### 인프라 레벨
- ❌ **Cloudflare Pages D1 Binding**: **누락 (해결 필요)**
- ✅ **KV Namespace Binding**: 정상
- ✅ **환경 변수**: 정상

---

## 🎯 해결 우선순위

### 🔴 즉시 필수
1. **Cloudflare 대시보드에서 D1 Binding 추가**
   - 소요 시간: 2-3분
   - Settings → Functions → D1 database bindings
   - Variable name: `DB`
   - D1 database: `toss-live-commerce-db`

### 🟡 확인 사항
2. **KV Namespace Binding 확인**
   - SESSION_KV
   - CACHE_KV

3. **환경 변수 확인**
   - TOSS_SECRET_KEY
   - KAKAO_REST_API_KEY

---

## 🚀 완료 후 확인

### 1. API 테스트
```bash
curl https://live.ur-team.com/api/live-streams/20 | jq '.'
# → {"success": true, "data": {...}}
```

### 2. 브라우저 테스트
```
https://live.ur-team.com/live/20
→ 라이브 페이지 정상 로드
```

### 3. 전체 플로우 테스트
```
1. 메인 페이지 접속
2. 라이브 스트림 클릭
3. 상품 표시 확인
4. 장바구니 담기
5. 결제 테스트
```

---

## 📚 참고 자료

### Cloudflare D1 Binding 문서
- https://developers.cloudflare.com/pages/platform/functions/bindings/#d1-databases

### wrangler.jsonc 설정
```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "toss-live-commerce-db",
      "database_id": "d9530ba6-7a26-4c02-9295-3ce5aef112a3"
    }
  ]
}
```

### 에러 로그 확인
```bash
# Cloudflare 대시보드
Workers & Pages → toss-live-commerce → Logs
```

---

## 💡 추가 팁

### D1 Binding이 적용되지 않는 경우
1. **Cloudflare 대시보드에서 수동 재배포**
   - Deployments 탭
   - 최신 배포 선택
   - "Retry deployment" 클릭

2. **wrangler CLI로 재배포**
   ```bash
   npx wrangler pages deploy dist --project-name toss-live-commerce
   ```

3. **캐시 무효화**
   ```bash
   # Cloudflare 대시보드
   Caching → Purge Everything
   ```

---

## 🎉 결론

**문제**: Cloudflare Pages에 D1 database binding 누락

**해결책**: 
1. Cloudflare 대시보드 → Settings → Functions → D1 database bindings
2. Variable name: `DB`, D1 database: `toss-live-commerce-db`
3. 저장 → 자동 재배포

**예상 소요 시간**: 2-3분

**완료 후**: https://live.ur-team.com/live/20 정상 작동

---

**작성일**: 2026-02-11  
**작성자**: AI Assistant  
**프로젝트**: Toss Live Commerce  
**상태**: ⚠️ 해결 대기 (Cloudflare 대시보드 설정 필요)
