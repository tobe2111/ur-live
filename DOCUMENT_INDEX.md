# 📚 프로젝트 문서 목록 및 경로

## 📂 문서 위치
**경로**: `/home/user/webapp/*.md` (프로젝트 루트)

모든 문서는 프로젝트 최상위 디렉토리에 있습니다.

---

## 🎯 최신 핵심 문서 (2026-02-25 작성)

| 문서명 | 설명 | 중요도 | 크기 |
|-------|------|--------|------|
| **COMPLETE_FEATURE_SPECIFICATION.md** | 전체 서비스 기능 명세서 (80개 기능) ⭐️⭐️⭐️ | 🔴 필수 | 35KB |
| **STOCK_RESERVATION_IMPLEMENTATION.md** | 재고 예약 시스템 구현 상세 (비관적 락) | 🔴 필수 | 15KB |
| **RACE_CONDITION_ANALYSIS.md** | 동시성 문제 분석 및 해결 방안 | 🔴 필수 | 20KB |
| **JWT_DETAIL_IMPROVEMENTS.md** | JWT 인증 시스템 개선 (공개 API, 로그아웃) | 🔴 필수 | 14KB |
| **CRON_SETUP_GUIDE.md** | 재고 예약 만료 Cron 작업 설정 가이드 | 🟡 높음 | 6KB |
| **ENV_VARS_CHECKLIST.md** | 환경변수 체크리스트 및 설정 가이드 | 🟡 높음 | 5KB |

---

## 🗂️ 카테고리별 문서 분류

### 1. 시스템 아키텍처 & 명세서
```
COMPLETE_FEATURE_SPECIFICATION.md  (최신 전체 명세서)
FINAL_SPECIFICATION.md              (이전 명세서)
SERVICE_INTRODUCTION.md             (서비스 소개)
ARCHITECTURE.md                     (시스템 아키텍처)
ACCOUNT_SYSTEM_ARCHITECTURE.md      (계정 시스템)
README.md                           (프로젝트 개요)
```

### 2. 인증 & 로그인
```
JWT_DETAIL_IMPROVEMENTS.md          (JWT 인증 개선 - 최신)
ADMIN_JWT_AUTH_FIX_REPORT.md         (관리자 JWT 수정)
AUTH_SYSTEM_CENTRALIZATION_COMPLETE.md
KAKAO_LOGIN_COMPLETED.md             (카카오 로그인)
LOGIN_SYSTEM_COMPLETE.md
```

### 3. 재고 & 결제
```
STOCK_RESERVATION_IMPLEMENTATION.md  (재고 예약 - 최신)
RACE_CONDITION_ANALYSIS.md           (동시성 문제 - 최신)
PAYMENT_SYSTEM_COMPLETE.md
CHECKOUT_FLOW_COMPLETE.md
TOSSPAYMENTS_INTEGRATION_GUIDE.md
```

### 4. 라이브 스트림
```
LIVEPAGEV2_ARCHITECTURE.md           (라이브 페이지 V2)
PRODUCT_CHANGE_UI_REDESIGN.md        (상품 변경 UI)
SELLER_DASHBOARD_FIX_REPORT.md       (셀러 대시보드)
YOUTUBE_LIVE_STREAM_COMPLETE.md
```

### 5. 배포 & 설정
```
CRON_SETUP_GUIDE.md                  (Cron 설정 - 최신)
ENV_VARS_CHECKLIST.md                (환경변수 - 최신)
DEPLOYMENT.md
DEPLOYMENT_CHECKLIST.md
CLOUDFLARE_DEPLOYMENT_PROTOCOL.md
```

### 6. 성능 & 최적화
```
CACHE_ANALYSIS.md
PERFORMANCE_OPTIMIZATION_COMPLETE.md
EDGE_CACHING_COMPLETE_STRATEGY.md
SELECT_STAR_OPTIMIZATION_REPORT.md
```

### 7. UI/UX 개선
```
CART_REDESIGN_REPORT.md
PRODUCT_DETAIL_REDESIGN_REPORT.md
MOBILE_DESIGN_SYSTEM_COMPLETE.md
UI_UX_FIX_FINAL_REPORT.md
```

### 8. 테스트 & 가이드
```
COMPREHENSIVE_TEST_GUIDE.md
MANUAL_TEST_GUIDE.md
TEST_RESULTS_REPORT.md
TROUBLESHOOTING.md
```

---

## 🔍 문서 검색 방법

### 터미널에서 검색
```bash
# 1. 전체 문서 목록 (최신순)
cd /home/user/webapp
ls -lht *.md

# 2. 특정 키워드로 검색
ls -lh *.md | grep -i "JWT\|AUTH\|LOGIN"

# 3. 문서 내용 검색
grep -l "재고 예약" *.md
grep -l "Cron" *.md

# 4. 최근 7일 내 수정된 문서
find . -maxdepth 1 -name "*.md" -mtime -7 -ls

# 5. 문서 크기 순 정렬
ls -lhS *.md | head -20
```

### GitHub에서 확인
```
https://github.com/tobe2111/ur-live/blob/main/
└── [문서명].md
```

---

## 📊 문서 통계

### 총 문서 수
- **전체**: 약 270개 Markdown 파일
- **최신 (2월 25일)**: 6개
- **핵심 문서**: 20개

### 문서 크기 분포
- 🔴 대형 (15KB+): 20개 (상세 가이드, 전체 명세서)
- 🟡 중형 (5-15KB): 80개 (기능별 문서, 분석 리포트)
- 🟢 소형 (< 5KB): 170개 (체크리스트, 간단한 가이드)

---

## 🎯 런칭 시 참고할 문서 (우선순위)

### 1순위 (필수 확인)
1. **COMPLETE_FEATURE_SPECIFICATION.md** - 전체 기능 명세 + 테스트 가이드
2. **STOCK_RESERVATION_IMPLEMENTATION.md** - 재고 예약 시스템
3. **CRON_SETUP_GUIDE.md** - Cron 작업 설정
4. **ENV_VARS_CHECKLIST.md** - 환경변수 체크리스트

### 2순위 (권장 확인)
5. **JWT_DETAIL_IMPROVEMENTS.md** - JWT 인증 개선사항
6. **RACE_CONDITION_ANALYSIS.md** - 동시성 문제 이해
7. **DEPLOYMENT_CHECKLIST.md** - 배포 체크리스트

### 3순위 (선택 확인)
8. **COMPREHENSIVE_TEST_GUIDE.md** - 전체 테스트 가이드
9. **TROUBLESHOOTING.md** - 문제 해결 가이드
10. **SERVICE_INTRODUCTION.md** - 서비스 소개

---

## 🗑️ 정리 대상 문서 (오래된 문서)

**다음 문서들은 이전 버전이거나 중복된 내용이므로 정리 가능:**

```
# 중복된 로그인 문서 (통합됨)
KAKAO_LOGIN_SETUP.md
KAKAO_LOGIN_FIX_COMPLETE.md
LOGIN_FIRST_FIX.md
...

# 중복된 결제 문서 (통합됨)
PAYMENT_FLOW_ANALYSIS.md
PAYMENT_FIX_SUMMARY.md
...

# 이전 버전 문서
ARCHITECTURE_OLD.md
DEPRECATED_*.md
```

**정리 명령어:**
```bash
# 백업 디렉토리 생성
mkdir -p /home/user/webapp/docs/archive

# 오래된 문서 이동 (예시)
mv /home/user/webapp/KAKAO_LOGIN_SETUP.md docs/archive/
```

---

## 📝 문서 작성 규칙 (향후 참고)

### 파일명 규칙
```
[카테고리]_[기능]_[상태].md

예:
- STOCK_RESERVATION_IMPLEMENTATION.md (구현 완료)
- JWT_DETAIL_IMPROVEMENTS.md (개선사항)
- CRON_SETUP_GUIDE.md (설정 가이드)
```

### 문서 구조
```markdown
# 제목 (기능명 또는 주제)

## 개요
- 목적
- 배경

## 구현 내용
- 주요 변경사항
- 코드 위치

## 테스트 방법
- 단계별 테스트 가이드

## 참고사항
- 주의사항
- 관련 문서

작성일: YYYY-MM-DD
문서 상태: 완료 ✅ / 진행 중 ⏳ / 계획 중 📋
```

---

## 🚀 빠른 접근 명령어

```bash
# 프로젝트 루트로 이동
cd /home/user/webapp

# 최신 문서 6개 보기
ls -lht *.md | head -6

# 전체 명세서 읽기
less COMPLETE_FEATURE_SPECIFICATION.md

# 재고 시스템 문서 읽기
less STOCK_RESERVATION_IMPLEMENTATION.md

# Cron 가이드 읽기
less CRON_SETUP_GUIDE.md

# 환경변수 체크리스트 읽기
less ENV_VARS_CHECKLIST.md
```

---

작성일: 2026-02-25
문서 상태: 완료 ✅
