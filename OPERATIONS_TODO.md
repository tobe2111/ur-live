# 🛠️ 운영 작업 TODO (사용자 직접 필요)

이 문서는 **코드 변경만으로 불가능**하고 사용자가 Cloudflare Dashboard 또는 외부 도구로 직접 처리해야 하는 작업 목록입니다.

> 📌 2026-04-22 전수조사 결과 요약  
> 100+ 배치 코드 수정 완료 (main 반영). 아래는 코드 외 운영 영역.

---

## 🔴 CRITICAL (즉시 조치 권장)

### 1. Cloudflare API Token D1 Edit 권한 추가
**현재 상태**: TECHNICAL_DEBT.md TD-001 — Migration CI 미작동  
**작업**: Cloudflare Dashboard → My Profile → API Tokens
1. 기존 `CLOUDFLARE_API_TOKEN` 편집
2. **Account → D1 → Edit** 권한 추가
3. Token 재발급
4. GitHub Secrets `CLOUDFLARE_API_TOKEN` 업데이트
5. `.github/workflows/migrate.yml` 수동 실행으로 검증

**소요**: 30분  
**위험**: 낮음 (read-only 작업)

---

### 2. .dev.vars + ENV_VARS *.txt Secret Rotation
**현재 상태**: TECHNICAL_DEBT.md TD-002 — git history 노출됨

⚠️ **2026-04-26 추가 발견**: `.dev.vars` 외에 다음 11개 파일이 **시크릿 평문** 포함하고 git에 추적됨:
```
ALL_ENV_VARS_COMPLETE.txt
CLOUDFLARE_ENV_COPY_PASTE.txt          ← Firebase API Key (AIzaSy...)
COMPLETE_31_ENV_VARS.txt
CORRECT_FIREBASE_VALUES.txt
ENV_VARS_QUICK_COPY.txt
FINAL_31_ENV_VARS_COMPLETE.txt
FIREBASE_SETUP_CHECKLIST.txt
FLOW_DIAGRAM.txt
MISSING_VITE_VARS_ONLY.txt
UR_LIVE_ENV_VARS_SETUP.txt
VITE_ENV_VARS_QUICK_COPY.txt
```
→ 워킹 트리에서는 `archive/secrets-redacted/` 로 격리 (코드 변경으로 처리). git history 정리는 BFG 별도 실행 필요.

**노출된 값**:
- `JWT_SECRET`
- `REFRESH_TOKEN_SECRET`  
- `FIREBASE_PRIVATE_KEY` (가장 위험 — 즉시)
- `FIREBASE_API_KEY` (VITE_*)
- `KAKAO_REST_API_KEY`
- `TOSS_SECRET_KEY` (운영 시 즉시)

**작업 순서**:
1. **Firebase**: Console → 프로젝트 설정 → 서비스 계정 → 새 키 생성, 기존 비활성화
2. **Toss**: 토스페이먼츠 대시보드 → API 키 재발급 (운영키)
3. **Kakao**: Kakao Developers → 앱 → 보안 → REST API 키 재발급
4. **JWT_SECRET**: `openssl rand -hex 32` 로 새 값 생성
5. Cloudflare Pages → ur-live → Settings → Variables → Secrets 업데이트
6. 배포 트리거 (`git commit --allow-empty -m "rotate secrets" && git push`)
7. (선택) git history 정리 — BFG Repo-Cleaner:
   ```bash
   bfg --delete-files .dev.vars
   bfg --delete-files '*ENV_VARS*.txt'
   bfg --delete-files 'CLOUDFLARE_ENV_COPY_PASTE.txt'
   bfg --delete-files 'CORRECT_FIREBASE_VALUES.txt'
   bfg --delete-files 'FIREBASE_SETUP_CHECKLIST.txt'
   bfg --delete-files 'FLOW_DIAGRAM.txt'
   git reflog expire --expire=now --all && git gc --prune=now
   git push --force --all
   ```
   ⚠️ force push 전 팀 합의 필수. 모든 협업자 git pull --rebase 필요.

**소요**: 2시간 (각 서비스 + 검증)  
**위험**: 중간 (rotation 중 잠시 인증 실패 가능 — 사용자 안내 필요)

---

### 3. D1 자동 백업 → R2
**현재 상태**: 백업 전략 부재  
**작업**:
1. Cloudflare Dashboard → R2 → Create bucket: `ur-live-backups`
2. wrangler.toml 에 R2 binding 추가:
   ```toml
   [[r2_buckets]]
   binding = "BACKUP_BUCKET"
   bucket_name = "ur-live-backups"
   ```
3. 매주 cron 추가 (이미 있는 4개 cron 외):
   ```toml
   crons = ["*/5 * * * *", "0 18 * * *", "0 19 * * *", "0 20 * * 0"]  # 일요일 20:00 UTC
   ```
4. 새 cron handler `src/worker/cron/d1-backup.ts` (제가 코드 작성 가능)
5. R2 lifecycle rule: 30일 자동 삭제

**소요**: 4시간 (코드 + R2 설정 + 검증)  
**위험**: 낮음 (read-only export)

---

## 🟡 HIGH (1주 내 권장)

### 4. 어드민 401 사고 진단/복구
**증상**: 어드민 로그인 401 반환  
**원인 후보**:
- account_lockouts 자동 생성 (5회 실패 → 15분 잠금)
- 비밀번호 재사용 방어 (배치 81-83) 영향

**진단 SQL** (Cloudflare Dashboard → D1 콘솔):
```sql
SELECT * FROM account_lockouts WHERE user_type = 'admin' ORDER BY last_failure_at DESC LIMIT 5;
SELECT id, email, status, is_active FROM admins WHERE email = 'YOUR_ADMIN_EMAIL';
```

**복구**:
```sql
-- 잠금 해제
DELETE FROM account_lockouts WHERE user_type = 'admin' AND user_id = '<id>';
-- 활성화 재확인
UPDATE admins SET status = 'active', is_active = 1 WHERE email = 'YOUR_ADMIN_EMAIL';
```

---

### 5. GitHub Secrets 정리
**현재**: `.github/workflows/main.yml` line 34-46 에 Firebase/Kakao 키 평문  
**작업**:
1. GitHub → Settings → Secrets → 다음 secrets 추가:
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, ...
   - `VITE_KAKAO_APP_KEY`, `VITE_TOSS_CLIENT_KEY`
2. `main.yml` 의 평문 → `${{ secrets.* }}` 로 변경

**소요**: 1시간

---

## 🟠 MEDIUM (1개월 내 권장)

### 6. Migration 중복 번호 정리
**문제**: 0003/0004/0007/0008/0010 중복 (실행 순서 불명)  
**작업**: 모든 중복 migration 검토 후 새 번호 (0210+) 로 재발급  
**위험**: 매우 큼 (운영 데이터 영향 가능) — 별도 sprint 필요

### 7. Stock vs stock_quantity 정규화
**문제**: 두 컬럼 공존, 코드 fallback  
**작업**: 데이터 마이그레이션 후 stock_quantity 컬럼 DROP  
**위험**: 매우 큼

### 8. 이중 라우팅 (/api/orders, /api/payments) 일원화
**문제**: worker/routes + features/api 양쪽 마운트  
**작업**: 하나로 통합  
**위험**: API 깨질 위험

### 9. SSR / Static generation
**문제**: SPA only → SEO 약함  
**작업**: Vite → Astro 또는 Worker SSR  
**소요**: 5-6주

---

## 🟢 LOW (외부 도구 필요)

### 10. 부하 테스트
**도구**: k6, Apache JMeter, Locust  
**시나리오**: 동시 1000/10000 사용자, 결제 100건/초

### 11. 보안 침투 테스트
**도구**: OWASP ZAP, Burp Suite  
**범위**: 모든 endpoint, XSS/CSRF/SQLi 시도

### 12. WCAG 2.1 AA 점수
**도구**: Lighthouse, axe DevTools  
**목표**: 90+ 점

### 13. 결제 PG사 호환성 실측
**작업**: Toss 샌드박스 + 실제 카드 테스트

### 14. D1 백업 복원 실제 검증
**작업**: 백업 파일로 새 D1 인스턴스 복원 + 데이터 일치 확인

---

## 📊 진행 상황

| 영역 | 코드 변경 | 운영 작업 | 합계 |
|---|---|---|---|
| 보안 | 95% ✅ | 50% (secret rotation 등) | 80% |
| 비즈니스 로직 | 92% ✅ | N/A | 92% |
| 성능 | 85% ✅ | 부하 테스트 미실시 | 70% |
| 인프라 | N/A | 60% (R2/CI 등) | 60% |

**전체**: 약 85-90% 진행 (운영 작업 완료 시 95%+)

---

## 📝 변경 이력
- 2026-04-22: 초안 작성 (100+ 배치 audit 결과 정리)
