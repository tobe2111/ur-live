# UR Live 장기 운영 전략 분석

> **목적**: KR + GLOBAL 듀얼 사이트의 최적 관리 방안 도출  
> **작성일**: 2026-03-05

---

## 🎯 관리 전략 비교

### Option 1: 듀얼 프로젝트 (권장 ⭐⭐⭐⭐⭐)

```
GitHub Repository (1개)
    tobe2111/ur-live (main branch)
         │
         ├─→ Cloudflare Pages: "ur-live-kr"
         │   ├─ Build: npm run build:kr
         │   ├─ Output: /dist
         │   ├─ Domain: live.ur-team.com
         │   └─ Env: KR (Kakao, Toss)
         │
         └─→ Cloudflare Pages: "ur-live-global"
             ├─ Build: npm run build:global
             ├─ Output: /dist-global
             ├─ Domain: world.ur-team.com
             └─ Env: GLOBAL (Google, Stripe)
```

#### ✅ 장점
1. **명확한 분리**: KR/GLOBAL 완전히 독립
2. **환경 변수 관리 용이**: 각 프로젝트에 맞는 변수만
3. **배포 독립성**: 한쪽 실패해도 다른 쪽 영향 없음
4. **모니터링 용이**: 각 사이트별 트래픽/에러 추적
5. **확장성**: 추가 지역(일본, 중국) 쉽게 추가 가능
6. **롤백 독립**: KR만 롤백, GLOBAL만 롤백 가능

#### ❌ 단점
1. **초기 설정 시간**: 프로젝트 2개 설정 필요 (30분)
2. **환경 변수 이중 관리**: Firebase 변수를 두 곳에 입력
3. **Worker Secrets 이중 설정**: 공통 secrets를 두 곳에

#### 📊 운영 시나리오

**일상 개발**:
```bash
# 코드 수정
git add .
git commit -m "feat: Add new feature"
git push origin main

# 자동 발생:
# ├─ ur-live-kr 빌드 시작 (3분)
# └─ ur-live-global 빌드 시작 (3분, 병렬)
# 
# 결과:
# ✅ live.ur-team.com 업데이트
# ✅ world.ur-team.com 업데이트
```

**긴급 핫픽스 (KR만)**:
```bash
# KR 버전에만 문제 발생
git add .
git commit -m "fix(kr): Critical bug in Kakao login"
git push origin main

# 자동 발생:
# ├─ ur-live-kr 빌드 (3분) ✅
# └─ ur-live-global 빌드 (3분) ✅ (변경사항 없어도 빌드)

# 문제: GLOBAL도 불필요하게 빌드됨
```

**환경 변수 변경 (Kakao Key 갱신)**:
```
1. Cloudflare Dashboard → ur-live-kr → Settings
2. VITE_KAKAO_REST_API_KEY 값 수정
3. "Retry deployment" 클릭
4. 3분 후 live.ur-team.com 업데이트 ✅

# ur-live-global은 영향 없음 ✅
```

**롤백 (KR 버전에 버그)**:
```
1. Cloudflare Dashboard → ur-live-kr → Deployments
2. 이전 버전 찾기 → "Rollback"
3. 1분 후 live.ur-team.com 복구 ✅

# world.ur-team.com은 영향 없음 ✅
```

---

### Option 2: 단일 프로젝트 + 브랜치 분리

```
GitHub Repository (1개)
    tobe2111/ur-live
         ├─ main (KR 버전)
         └─ global (GLOBAL 버전)
              │
              ├─→ Cloudflare Pages: "ur-live"
              │   ├─ Production branch: main
              │   ├─ Build: npm run build:kr
              │   └─ Domain: live.ur-team.com
              │
              └─→ Preview branch: global
                  ├─ Build: npm run build:global
                  └─ Domain: world.ur-team.com
```

#### ✅ 장점
1. **프로젝트 1개**: 설정 한 번만
2. **환경 변수 공유**: Firebase 변수 한 번만 입력

#### ❌ 단점
1. **브랜치 관리 복잡**: main ↔ global 동기화 필요
2. **배포 의존성**: main 업데이트 → global에도 merge 필요
3. **롤백 복잡**: 브랜치별 롤백 어려움
4. **확장성 낮음**: 3개 이상 지역 추가 시 브랜치 폭발
5. **환경 변수 충돌**: KR/GLOBAL 변수가 섞임

#### 📊 운영 시나리오 (복잡함)

**일상 개발**:
```bash
# main 브랜치에서 개발
git checkout main
git add .
git commit -m "feat: Add new feature"
git push origin main

# KR 사이트 자동 배포 ✅

# GLOBAL 사이트 업데이트하려면:
git checkout global
git merge main
git push origin global

# GLOBAL 사이트 자동 배포 ✅

# 문제: 항상 2번 푸시 필요!
```

**긴급 핫픽스 (KR만)**:
```bash
# KR 버전 수정
git checkout main
git add .
git commit -m "fix(kr): Critical bug"
git push origin main

# ❓ global 브랜치도 merge 해야 하나?
# → 버그가 KR 전용이라면 merge 하면 안됨
# → 브랜치 분기 발생
# → 나중에 충돌 위험 ⚠️
```

---

### Option 3: Monorepo + 별도 저장소

```
GitHub (2개)
    ├─ tobe2111/ur-live-kr (KR 전용)
    └─ tobe2111/ur-live-global (GLOBAL 전용)
```

#### ✅ 장점
1. **완전 독립**: 코드도 완전히 분리

#### ❌ 단점
1. **코드 중복**: 공통 코드를 두 곳에서 관리
2. **동기화 지옥**: 공통 버그 수정을 두 번 해야 함
3. **유지보수 비용 2배**: 팀원도 2배로 필요
4. **패키지 의존성 이중 관리**: package.json 2개

#### 💀 최악의 시나리오
```
1. KR 저장소에서 버그 수정
2. GLOBAL 저장소에 동일 버그 존재
3. 수동으로 복사 붙여넣기
4. 놓치는 부분 발생
5. 버전 불일치 발생
6. 유지보수 불가능 상태 도달
```

---

## 🏆 최종 권장: Option 1 (듀얼 프로젝트)

### ✅ 왜 Option 1이 최고인가?

#### 1. **운영 효율성**
```
일상 작업: git push 한 번 → 양쪽 자동 배포
긴급 대응: 3분 내 배포 완료
롤백: 1분 내 복구
환경 변수: 각 사이트별 독립 관리
```

#### 2. **확장성**
```
현재: KR + GLOBAL (2개)
미래: KR + GLOBAL + JP + CN (4개)

추가 방법:
1. Cloudflare Pages 프로젝트 추가 (ur-live-jp)
2. Build command: npm run build:jp
3. 완료!

소요 시간: 10분
```

#### 3. **팀 협업**
```
개발자 A: KR 기능 개발
개발자 B: GLOBAL 기능 개발
개발자 C: 공통 컴포넌트 개발

→ 모두 main 브랜치에 커밋
→ 자동으로 양쪽 배포
→ 충돌 최소화
```

#### 4. **비용 효율**
```
Cloudflare Pages 무료 한도:
- 프로젝트 100개까지 무료
- 빌드 500회/월 무료
- 대역폭 무제한

현재 사용:
- 프로젝트 2개 (KR, GLOBAL)
- 빌드 약 60회/월 (하루 1번 배포 x 2 x 30일)
- 비용: $0 ✅
```

#### 5. **모니터링 & 디버깅**
```
Cloudflare Analytics (각 프로젝트별):
- ur-live-kr
  • 방문자: 한국 사용자
  • 에러율: KR 전용 에러만
  • 트래픽: live.ur-team.com
  
- ur-live-global
  • 방문자: 해외 사용자
  • 에러율: GLOBAL 전용 에러만
  • 트래픽: world.ur-team.com

→ 문제 발생 시 정확한 지역 특정 가능
→ 디버깅 시간 단축
```

---

## 📋 구체적인 운영 플랜 (Option 1)

### Phase 1: 초기 설정 (1회, 30분)

```
✅ Step 1: ur-live-kr 프로젝트 생성
   - Build command: npm run build:kr
   - Environment variables: 12개 입력
   - Worker secrets: 8개 설정
   - Custom domain: live.ur-team.com

✅ Step 2: ur-live-global 프로젝트 생성
   - Build command: npm run build:global
   - Environment variables: 10개 입력
   - Worker secrets: 8개 설정
   - Custom domain: world.ur-team.com

✅ Step 3: 자동 배포 테스트
   - git push origin main
   - 양쪽 빌드 확인
   - 사이트 접속 테스트
```

### Phase 2: 일상 운영 (매일)

```
개발 → 커밋 → 푸시 → 자동 배포

git add .
git commit -m "feat: Add feature"
git push origin main

# 끝! 3분 후 양쪽 모두 업데이트 ✅
```

### Phase 3: 환경 변수 관리 (월 1회?)

```
KR 변수 변경:
1. Dashboard → ur-live-kr → Settings
2. 변수 값 수정
3. Retry deployment
4. 완료!

GLOBAL 변수 변경:
1. Dashboard → ur-live-global → Settings
2. 변수 값 수정
3. Retry deployment
4. 완료!
```

### Phase 4: 모니터링 (매일)

```
Cloudflare Dashboard → Analytics

ur-live-kr:
- 트래픽: 한국 사용자
- 에러: KR 전용 에러
- 성능: 한국 기준

ur-live-global:
- 트래픽: 해외 사용자
- 에러: GLOBAL 전용 에러
- 성능: 해외 기준
```

### Phase 5: 긴급 대응 (필요 시)

```
롤백 (KR):
1. Dashboard → ur-live-kr → Deployments
2. 이전 버전 선택 → Rollback
3. 1분 내 복구 ✅

롤백 (GLOBAL):
1. Dashboard → ur-live-global → Deployments
2. 이전 버전 선택 → Rollback
3. 1분 내 복구 ✅
```

---

## 💰 비용 분석

### Cloudflare Pages 요금

```
무료 플랜:
- 프로젝트: 100개까지
- 빌드: 500회/월
- 대역폭: 무제한
- Custom domains: 무제한

현재 사용 예상:
- 프로젝트: 2개 (ur-live-kr, ur-live-global)
- 빌드: ~60회/월 (하루 1번 x 2 x 30일)
- 대역폭: ~100GB/월 (예상)

월 비용: $0 ✅
연 비용: $0 ✅
```

### 확장 시나리오 (일본, 중국 추가)

```
프로젝트: 4개 (KR, GLOBAL, JP, CN)
빌드: ~120회/월 (하루 1번 x 4 x 30일)
대역폭: ~200GB/월

월 비용: $0 ✅ (무료 한도 내)
```

---

## 🎯 최종 결론

### ⭐ 가장 합리적인 방법: Option 1 (듀얼 프로젝트)

```
GitHub Repository (1개): tobe2111/ur-live
    ↓
Cloudflare Pages (2개):
    ├─ ur-live-kr → live.ur-team.com
    └─ ur-live-global → world.ur-team.com
```

### 이유

| 기준 | Option 1 | Option 2 | Option 3 |
|------|----------|----------|----------|
| **설정 시간** | 30분 (1회) | 20분 (1회) | 60분 (1회) |
| **일상 운영** | git push 1번 ⭐ | git push 2번 | git push 2번 |
| **확장성** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐ |
| **롤백** | 독립 ⭐⭐⭐⭐⭐ | 복잡 ⭐⭐ | 독립 ⭐⭐⭐⭐⭐ |
| **환경 변수** | 명확 ⭐⭐⭐⭐⭐ | 충돌 위험 ⭐⭐ | 명확 ⭐⭐⭐⭐⭐ |
| **모니터링** | 지역별 ⭐⭐⭐⭐⭐ | 혼합 ⭐⭐⭐ | 지역별 ⭐⭐⭐⭐⭐ |
| **유지보수** | 쉬움 ⭐⭐⭐⭐⭐ | 복잡 ⭐⭐ | 지옥 ⭐ |
| **비용** | $0 ⭐⭐⭐⭐⭐ | $0 ⭐⭐⭐⭐⭐ | $0 ⭐⭐⭐⭐⭐ |

### 실행 단계

1. ✅ **지금**: 이미 빌드 완료, 템플릿 준비됨
2. ⏳ **다음**: Cloudflare Dashboard에서 2개 프로젝트 설정 (30분)
3. ✅ **이후**: git push만 하면 자동 배포

---

**결론**: **Option 1 (듀얼 프로젝트)**이 **장기적으로 가장 합리적**입니다! 🎯
