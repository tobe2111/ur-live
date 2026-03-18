# 🌐 DNS 및 도메인 완전 재설정 가이드

## 현재 상황
- ur-live-working 프로젝트 삭제됨
- DNS 레코드도 삭제됨
- ur-live 프로젝트 2개 존재 (Git 연결 있는 것 / 없는 것)

---

## 🎯 목표
live.ur-team.com 도메인을 올바른 ur-live 프로젝트에 연결

---

## Phase 1: 불필요한 ur-live 프로젝트 삭제 (5분)

### Step 1-1: Cloudflare Workers & Pages 확인
👉 https://dash.cloudflare.com/
- Workers & Pages 클릭
- 현재 상태:
  - **ur-live** (맨 위) - No Git connection ❌
  - **ur-live** (아래) - tobe2111/ur-live ✅

### Step 1-2: 맨 위 ur-live 프로젝트 삭제
1. 맨 위 **ur-live** (No Git connection) 클릭
2. Settings 탭
3. 맨 아래로 스크롤
4. **Delete** 버튼 클릭
5. `ur-live` 입력하고 확인
6. 삭제 완료

✅ 결과: Git 연결된 ur-live만 남음

---

## Phase 2: DNS 레코드 재설정 (5분)

### Step 2-1: Cloudflare DNS 관리 페이지 접속
👉 https://dash.cloudflare.com/
1. 좌측 메뉴에서 **Websites** 클릭
2. **ur-team.com** 도메인 선택
3. 좌측 메뉴에서 **DNS** → **Records** 클릭

### Step 2-2: 기존 레코드 확인
현재 상태 확인:
- `live` 레코드가 있는지?
- 있다면 어디를 가리키는지? (*.pages.dev)

### Step 2-3: 기존 레코드 삭제 (있는 경우)
- `live` 또는 `live.ur-team.com` 레코드 찾기
- **Delete** 버튼 클릭
- 삭제 확인

⚠️ **주의**: 이 단계에서는 DNS 레코드를 **직접 추가하지 마세요!**
→ Cloudflare Pages에서 Custom Domain 추가하면 **자동으로 생성**됩니다!

---

## Phase 3: Cloudflare Pages Custom Domain 설정 (5분)

### Step 3-1: ur-live 프로젝트 설정
👉 https://dash.cloudflare.com/
1. Workers & Pages → **ur-live** (tobe2111/ur-live) 클릭
2. **Custom domains** 탭 클릭

### Step 3-2: 도메인 추가
1. **Set up a custom domain** 버튼 클릭
2. Domain 입력: `live.ur-team.com`
3. **Continue** 클릭

### Step 3-3: DNS 자동 설정 확인
Cloudflare가 자동으로:
- DNS CNAME 레코드 생성
- `live.ur-team.com` → `ur-live.pages.dev`
- SSL/TLS 인증서 발급

⏳ **대기 시간**: 약 1-2분

### Step 3-4: 도메인 활성화 확인
- Status가 **Active** (초록색)로 변경되면 완료
- **Pending** → **Active** (1-2분 소요)

---

## Phase 4: 확인 및 검증 (5분)

### Step 4-1: DNS 전파 확인
Windows PowerShell / Mac Terminal에서:
```bash
nslookup live.ur-team.com
```

결과 예시:
```
Name:    live.ur-team.com
Address: [Cloudflare IP]
CNAME:   ur-live.pages.dev
```

### Step 4-2: 브라우저 테스트
1. 👉 https://live.ur-team.com/login
2. 페이지가 로드되는지 확인
3. F12 → Console → 에러 확인

### Step 4-3: Cloudflare DNS Records 최종 확인
👉 https://dash.cloudflare.com/
- Websites → ur-team.com → DNS → Records
- `live` CNAME 레코드 확인:
  - Type: **CNAME**
  - Name: **live**
  - Target: **ur-live.pages.dev**
  - Proxy status: **Proxied** (주황색 구름)

---

## 🚨 문제 해결

### 문제 1: "An A, AAAA, or CNAME record with that host already exists"
**원인**: DNS 레코드가 이미 존재
**해결**:
1. DNS → Records 페이지에서 `live` 레코드 삭제
2. 2분 대기
3. Custom domains에서 다시 추가

---

### 문제 2: "Domain validation failed"
**원인**: DNS 전파 미완료
**해결**:
1. 5-10분 대기
2. Custom domains 페이지 새로고침
3. 여전히 안 되면 DNS Records에서 수동 확인

---

### 문제 3: 도메인은 연결됐는데 404 에러
**원인**: ur-live 프로젝트 배포 실패 또는 미완료
**해결**:
1. ur-live → Deployments 탭
2. 최신 배포 Status 확인
3. 실패했으면 ⋮ → Retry deployment
4. 성공 확인 후 다시 테스트

---

### 문제 4: HTTPS 인증서 오류
**원인**: SSL/TLS 인증서 발급 대기 중
**해결**:
1. 10-30분 대기 (자동 발급)
2. Cloudflare → SSL/TLS → Edge Certificates 확인
3. Universal SSL 활성화 확인

---

## 📊 전체 체크리스트

### Phase 1: 프로젝트 정리
- [ ] Workers & Pages 접속
- [ ] 맨 위 ur-live (No Git) 삭제
- [ ] Git 연결된 ur-live만 남김

### Phase 2: DNS 정리
- [ ] Websites → ur-team.com → DNS 접속
- [ ] 기존 `live` 레코드 확인
- [ ] 있으면 삭제 (없으면 스킵)

### Phase 3: Custom Domain 설정
- [ ] ur-live → Custom domains 접속
- [ ] live.ur-team.com 추가
- [ ] DNS 자동 생성 확인
- [ ] Status = Active 확인

### Phase 4: 검증
- [ ] nslookup 테스트
- [ ] 브라우저 접속 테스트
- [ ] DNS Records 최종 확인
- [ ] HTTPS 작동 확인

---

## 🎯 예상 소요 시간
- Phase 1: 프로젝트 삭제 (5분)
- Phase 2: DNS 정리 (5분)
- Phase 3: Custom Domain 설정 (5분)
- Phase 4: 확인 (5분)
- **총 소요 시간: 약 20분**

---

## 💡 핵심 포인트

### ✅ 올바른 순서:
1. 불필요한 ur-live 프로젝트 삭제
2. DNS 레코드 정리 (있으면 삭제)
3. Cloudflare Pages Custom Domain 추가
4. DNS 자동 생성 확인
5. 테스트

### ❌ 하지 말아야 할 것:
- DNS 레코드를 수동으로 직접 추가하지 마세요
- Custom Domain 추가하면 자동으로 생성됩니다
- 두 곳에서 동시에 설정하면 충돌 발생

---

## 🔗 빠른 링크

- Cloudflare Dashboard: https://dash.cloudflare.com/
- Workers & Pages: https://dash.cloudflare.com/ → Workers & Pages
- DNS Records: https://dash.cloudflare.com/ → Websites → ur-team.com → DNS
- 라이브 사이트: https://live.ur-team.com/login

---

**작성일**: 2026-03-18
**상태**: 준비 완료 - Phase 1부터 시작
