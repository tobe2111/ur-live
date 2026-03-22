# 🔧 Cloudflare Pages D1 바인딩 설정 가이드

**날짜**: 2026-03-16  
**문제**: 프로덕션 API가 "Cannot read properties of undefined (reading 'prepare')" 오류 발생  
**원인**: Pages 프로젝트에 D1 Database 바인딩이 설정되지 않음

---

## 🎯 즉시 해야 할 일

### 1️⃣ Cloudflare 대시보드 접속

```
https://dash.cloudflare.com/
```

**계정**: Jiwon@ur-team.com's Account  
**Account ID**: `1a2c006f0fb54894f81283a5ea787b83`

---

### 2️⃣ Pages 프로젝트 설정 열기

1. 왼쪽 메뉴 → **Workers & Pages**
2. **ur-live** 프로젝트 선택
3. 상단 탭 → **Settings**

---

### 3️⃣ D1 Database 바인딩 추가

**경로**: Settings → Functions → **D1 database bindings**

#### Production 환경 설정
1. **Add binding** 클릭
2. 다음 정보 입력:
   ```
   Variable name: DB
   D1 database: toss-live-commerce-db
   ```
3. **Save** 클릭

#### Preview 환경 설정 (선택)
1. **Preview** 탭으로 전환
2. 동일하게 바인딩 추가:
   ```
   Variable name: DB
   D1 database: toss-live-commerce-db
   ```
3. **Save** 클릭

---

### 4️⃣ KV Namespace 바인딩 추가 (있는 경우)

**경로**: Settings → Functions → **KV namespace bindings**

현재 로컬에서 사용 중인 KV:
- `SESSION_KV`
- `CACHE_KV`
- `LIVE_CACHE`

**각각 추가**:
1. **Add binding** 클릭
2. 정보 입력:
   ```
   Variable name: SESSION_KV
   KV namespace: (드롭다운에서 선택 또는 새로 생성)
   ```
3. 반복 (CACHE_KV, LIVE_CACHE)
4. **Save** 클릭

---

## 🔄 설정 후 확인

### 1. 재배포 (자동)
바인딩 설정을 저장하면 Pages가 **자동으로 재배포**됩니다.
- 예상 시간: 1-2분
- 진행 상황: Pages 프로젝트 → **Deployments** 탭

---

### 2. API 테스트 (30초 후)
```bash
# Products API
curl https://live.ur-team.com/api/products?limit=3

# 예상 결과
{
  "success": true,
  "data": [...]
}
```

```bash
# Streams API
curl https://live.ur-team.com/api/streams?status=live

# 예상 결과
{
  "success": true,
  "data": []
}
```

---

### 3. 브라우저 테스트
```
https://live.ur-team.com/login
→ 카카오 로그인 버튼 확인
→ 로그인 테스트

https://live.ur-team.com/
→ 상품 목록 표시 확인
→ 무한 로딩 해결 확인
```

---

## 📋 체크리스트

- [ ] Cloudflare 대시보드 로그인
- [ ] Pages 프로젝트 "ur-live" 선택
- [ ] Settings → Functions → D1 database bindings
- [ ] Production 환경에 "DB" 바인딩 추가 (toss-live-commerce-db)
- [ ] Preview 환경에 "DB" 바인딩 추가 (선택)
- [ ] KV 바인딩 추가 (SESSION_KV, CACHE_KV, LIVE_CACHE)
- [ ] Save 클릭
- [ ] 재배포 완료 대기 (1-2분)
- [ ] API 테스트 (curl 명령)
- [ ] 브라우저 테스트 (로그인, 상품 페이지)

---

## 🔍 트러블슈팅

### 바인딩 설정 후에도 오류 발생 시

1. **바인딩 이름 확인**
   - Variable name이 정확히 **"DB"**인지 확인 (대문자)
   - D1 database가 **toss-live-commerce-db**인지 확인

2. **재배포 확인**
   - Deployments 탭에서 최신 배포 상태 확인
   - 배포 로그에서 "Deployment successful" 확인

3. **Worker 로그 확인**
   - Pages 프로젝트 → **Functions** 탭
   - **Logs** 확인
   - 에러 메시지 확인

4. **수동 재배포**
   - 만약 자동 재배포가 안 되면:
   ```bash
   cd /home/user/webapp
   npx wrangler pages deploy dist/client --project-name=ur-live --branch=main
   ```

---

## 📚 참고 문서

- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [D1 Bindings](https://developers.cloudflare.com/d1/get-started/#4-bind-your-worker-to-your-d1-database)
- [Pages Environment Variables](https://developers.cloudflare.com/pages/configuration/env-variables/)

---

## 🎯 왜 이 문제가 발생했나?

### wrangler.toml vs Cloudflare Pages

```yaml
# wrangler.toml에 설정했지만...
[[d1_databases]]
binding = "DB"
database_name = "toss-live-commerce-db"
```

**하지만**: Cloudflare Pages는 `wrangler.toml`의 바인딩을 **무시**합니다.

**Pages 배포 방식**:
1. `wrangler pages deploy` → 파일만 업로드
2. 바인딩 설정 → **대시보드에서만 가능**
3. Worker 실행 → 대시보드 바인딩 사용

**Workers 배포 방식** (참고용):
- `wrangler deploy` → `wrangler.toml` 바인딩 자동 적용
- Pages와 다름!

---

## ✅ 결론

**지금 상황**:
- ✅ Worker 코드: 정상 (env.DB 참조)
- ✅ D1 Database: 정상 (스키마 확인 완료)
- ✅ 배포: 성공 (dist/client/ 올바르게 배포)
- ❌ 바인딩: **누락** (대시보드 설정 필요)

**해결 후 기대 효과**:
- ✅ 모든 API 정상 작동
- ✅ 상품 페이지 로딩
- ✅ 카카오 로그인 작동
- ✅ 라이브 스트림 표시

---

**다음 단계**: 위 체크리스트 따라 바인딩 추가 → 자동 재배포 대기 → API 테스트

**작성**: 2026-03-16  
**우선순위**: 🔴 CRITICAL
