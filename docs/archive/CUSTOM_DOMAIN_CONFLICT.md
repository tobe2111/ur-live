# 🌐 Cloudflare Custom Domain 중복 문제 해결

## 문제 상황
```
"You have already added this custom domain. 
Select another custom domain or check your project configuration."
```

**원인**: `live.ur-team.com` 도메인이 이미 다른 프로젝트에 연결되어 있음

---

## 🔍 현재 상태 확인

### 1. 어느 프로젝트에 연결되어 있는지 확인

#### Cloudflare Dashboard에서 확인:
1. https://dash.cloudflare.com/
2. **Workers & Pages** 메뉴
3. **ur-live** 프로젝트 선택
4. **Custom domains** 탭 확인
   - `live.ur-team.com` 있는지 확인

5. **ur-live-working** 프로젝트 선택 (있다면)
6. **Custom domains** 탭 확인
   - `live.ur-team.com` 있는지 확인

---

## ✅ 해결 방법

### 시나리오 A: `live.ur-team.com`이 기존 `ur-live`에 연결되어 있음 (가장 가능성 높음)

**이 경우 아무것도 할 필요 없습니다!**

1. `ur-live` 프로젝트가 이미 `live.ur-team.com`을 사용 중
2. Git push만 하면 자동으로 `ur-live`에 배포됨
3. **`ur-live-working`은 삭제**만 하면 됨

**확인 방법**:
```
Workers & Pages → ur-live → Custom domains
→ live.ur-team.com이 목록에 있으면 OK!
```

---

### 시나리오 B: `live.ur-team.com`이 `ur-live-working`에 연결되어 있음

**이 경우 도메인을 이동해야 합니다:**

#### Step 1: `ur-live-working`에서 도메인 제거
```
1. Workers & Pages → ur-live-working
2. Custom domains 탭
3. live.ur-team.com 우측 ··· 메뉴
4. "Remove" 클릭
5. 확인
```

#### Step 2: `ur-live`에 도메인 추가
```
1. Workers & Pages → ur-live
2. Custom domains 탭
3. "Set up a custom domain" 버튼
4. Domain: live.ur-team.com
5. "Continue" 클릭
6. DNS 설정 확인 (이미 되어 있을 것)
7. "Activate domain" 클릭
```

#### Step 3: `ur-live-working` 삭제
```
1. Workers & Pages → ur-live-working
2. Settings → 하단 "Delete project"
3. 프로젝트 이름 입력하여 확인
```

---

### 시나리오 C: 도메인이 다른 계정/프로젝트에 있음

**가능성 낮음, 하지만 이 경우:**

1. Cloudflare 계정에 로그인한 사용자 확인
2. 다른 계정이 있다면 그쪽에서 도메인 제거
3. 또는 Cloudflare Support에 문의

---

## 🎯 권장 작업 순서 (5분)

### 1. 기존 `ur-live` 프로젝트 확인 (2분)
```bash
Cloudflare Dashboard
→ Workers & Pages
→ ur-live
→ Custom domains 탭

확인사항:
□ live.ur-team.com이 목록에 있는가?
```

### 2-A. 도메인이 `ur-live`에 있으면 (정상)
```
✅ 아무것도 안 해도 됨
→ 그냥 ur-live-working만 삭제
→ Git push하면 자동 배포
```

### 2-B. 도메인이 `ur-live-working`에 있으면
```
1. ur-live-working에서 도메인 제거 (1분)
2. ur-live에 도메인 추가 (2분)
3. ur-live-working 프로젝트 삭제 (1분)
```

### 3. 배포 확인 (1분)
```bash
# 이미 push한 커밋이 자동 배포됨
git log -1 --oneline
# 06ef437f docs: Add Cloudflare project switching guide
```

### 4. 테스트
```
https://live.ur-team.com/login
→ 카카오 로그인 테스트
```

---

## 🧪 확인 명령어

### DNS 레코드 확인
```bash
# 현재 DNS가 어디를 가리키는지 확인
dig live.ur-team.com CNAME +short

# 기대 결과:
# ur-live.pages.dev (올바름)
# 또는
# ur-live-working.pages.dev (잘못됨, 변경 필요)
```

### 현재 배포된 프로젝트 확인
```bash
curl -sI https://live.ur-team.com/ | grep -i "x-served-by\|cf-ray"
```

---

## 📊 프로젝트 비교

| 항목 | ur-live (기존) | ur-live-working (새) |
|------|----------------|---------------------|
| 환경변수 | ✅ 모두 설정됨 | ❌ 누락 |
| Custom Domain | ✅ live.ur-team.com | ❓ 확인 필요 |
| GitHub 연결 | ✅ tobe2111/ur-live | ❓ 확인 필요 |
| 상태 | ✅ 사용 | ❌ 삭제 예정 |

---

## 💡 이해하기

### Custom Domain은 1개 프로젝트에만 연결 가능
```
❌ 불가능:
  ur-live → live.ur-team.com
  ur-live-working → live.ur-team.com (동시 사용 불가!)

✅ 가능:
  ur-live → live.ur-team.com
  ur-live-working → (도메인 없음, 삭제 예정)
```

### 프로젝트 vs 도메인
- **프로젝트**: Cloudflare Pages 앱 (여러 개 가능)
- **Custom Domain**: 사용자 지정 도메인 (1개만 연결)
- **pages.dev**: 각 프로젝트의 기본 도메인 (항상 있음)

---

## 🎯 예상 결과

### Before
```
❌ 도메인 중복 에러
❌ ur-live-working에 도메인 연결 불가
```

### After
```
✅ ur-live에만 live.ur-team.com 연결
✅ ur-live-working 삭제됨
✅ https://live.ur-team.com/ → ur-live 프로젝트
```

---

## 🔗 빠른 링크

- **Cloudflare Dashboard**: https://dash.cloudflare.com/
- **Workers & Pages**: https://dash.cloudflare.com/ (좌측 메뉴)
- **DNS 관리**: Cloudflare → Websites → ur-team.com → DNS

---

## ⚠️ 주의사항

### DNS 전파 시간
- 도메인 변경 시 최대 5-10분 소요
- 캐시 때문에 이전 프로젝트가 보일 수 있음
- Ctrl+F5로 강제 새로고침

### 프로젝트 삭제 전 확인
- Custom Domain 제거 먼저
- 그 다음 프로젝트 삭제
- 순서 중요!

---

**작성일**: 2026-03-17  
**예상 소요 시간**: 5분  
**우선순위**: 🔴 High (도메인 설정 필요)
