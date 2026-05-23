# 🛠️ 개발 구현 플레이북 (Claude 세션 절대 룰)

> **배경**: 2026-05-23 Toss 사건. "통일/단순화" 명목으로 dual-mode 제거 → 사용자 환경 회귀. 개발 시 같은 실수 방지 절차.

## 🛑 절대 금지

1. **"통일/단순화" 핑계로 dual-mode 제거 X** — 기존 분기는 이유가 있음
2. **사용자 환경 가정 X** — 키 type / DB 컬럼 / env 변수 등은 데이터로 확인
3. **"가장 이상적이고 영구적" 명령 받았을 때 큰 리팩토링 X** — 작은 검증 가능한 변경부터
4. **새 파일 / 새 helper 추가 전에 기존 grep 필수** — 패턴 중복 방지
5. **CLAUDE.md 룰 위반 X** — schema/theme/i18n/payment/auth 룰 무조건 우선

## ✅ 새 기능/변경 작성 절차

### Step 1: 사용자 의도 명확화 (1분)
"X 해주세요" 받았을 때 자문:
- **변경 범위가 명확한가?** (한 함수 / 한 페이지 / 여러 파일?)
- **기존 동작 깨질 가능성 있나?** (yes → 분기 추가 / no → 직접 수정)
- **사용자 환경 dependency 있나?** (env, DB, 외부 API → 데이터 확인 먼저)

불명확하면 `AskUserQuestion` 으로 1-2개 옵션 제시. 추측 금지.

### Step 2: 기존 패턴 확인 (5분)
**필수 grep**:
```bash
# 비슷한 기능이 이미 있나?
grep -rn "<유사 키워드>" src/ --include="*.ts" --include="*.tsx"

# 동일 도메인 helper 찾기
ls src/lib/ src/utils/ src/shared/

# 동일 라우트 패턴 찾기  
grep -rn "router.<method>" src/worker/routes/ src/features/
```

이미 있으면 그것 사용. 없으면 새로 만들 결심.

### Step 3: CLAUDE.md 룰 매핑 (1분)
변경 영역에 해당하는 활성 룰 확인:
- **DB 변경** → `docs/SCHEMA.md` + production-schema.ts
- **결제** → confirmTossPayment 헬퍼 / Toss 키 type 룰
- **인증** → safeInternalPath / Kakao OAuth 룰
- **새 페이지** → SEO + 테마 + i18n + console.log 금지
- **셀러 role** → isInfluencer() 등 헬퍼 사용 (직접 비교 금지)
- **숫자 표시** → formatNumber / formatWon / safeNum

위반 없는지 확인.

### Step 4: 최소 변경 단위 결정 (2분)
**큰 작업 분해**:
- 한 commit = 한 논리 단위
- 큰 리팩토링은 **반드시 사용자 동의** 받은 후
- 새 기능 추가 시 기존 분기/fallback 유지 (`dual-mode preserve`)

**예시**:
- ❌ "결제 통일" — 5개 caller 한 번에 리팩토링
- ✅ "GroupBuy 의 토스 결제 init endpoint 추가" — 1 caller, 1 commit

### Step 5: 검증 가능한 형태로 작성 (5-30분)
- 코드 작성
- `npx tsc --noEmit --skipLibCheck` 통과
- `npm run build` 성공
- 변경 영역 관련 check script 실행 (예: `bash scripts/check-api-auth.sh`)

### Step 6: 사용자에게 검증 요청 (필수)
**"영구 fix" 라벨 commit 메시지에 쓰기 전**:
- 사용자가 실제 환경에서 동작 확인 필요
- 아직 검증 안 됐으면 "candidate fix" 로 표현

## 📐 패턴별 가이드라인

### A. 새 API endpoint 추가 시
```ts
// Pattern (src/features/<domain>/api/<name>.routes.ts)
import { Hono } from 'hono'
import type { Env } from '../../../worker/types/env'

export const xxxRoutes = new Hono<{ Bindings: Env }>()

xxxRoutes.<method>('/...', requireXxx(), async (c) => {
  let stage = 'init'                       // stage 추적 (PLAYBOOK 룰)
  try {
    stage = 'parse'; ...
    stage = 'validate'; ...
    stage = 'db'; ...
    return c.json({ success: true, data: ... })
  } catch (err) {
    return safeError(c, err, '한국어 메시지', `[<domain>:${stage}]`)  // PLAYBOOK 룰
  }
})
```

체크리스트:
- [ ] `requireAuth()` / `requireSeller()` / `requireAdmin()` 등 인증 미들웨어 (변경성 endpoint 필수)
- [ ] 입력 validation (`Number.isFinite`, 길이, enum)
- [ ] 권한 체크 (resource ownership — IDOR 방지)
- [ ] 결제 endpoint 면 `confirmTossPayment()` 헬퍼만 사용
- [ ] catch → `safeError(c, err, ..., '[domain:stage]')`
- [ ] worker/index.ts 에 `app.route()` 등록
- [ ] CHECK constraint / NOT NULL / FK 검증 (`check-status-constraints.mjs` 사전 실행)

### B. 새 페이지 추가 시
```tsx
// Pattern (src/pages/XxxPage.tsx)
import { useEffect, useState } from 'react'
import SEO from '@/components/SEO'

export default function XxxPage() {
  return (
    <div className="min-h-screen ..."> {/* 테마 룰 — 다크 / 화이트 */}
      <SEO title="제목 - 유어딜" description="..." url="/path" />
      {/* 컨텐츠 */}
    </div>
  )
}
```

체크리스트:
- [ ] `<SEO />` (관리자/콜백 제외)
- [ ] 테마: 다크 / 화이트 / 셀러-어드민 (CLAUDE.md 매핑)
- [ ] `text-gray-900` 명시 (화이트 input)
- [ ] `console.log` 는 `import.meta.env.DEV` 게이트
- [ ] 숫자: `formatNumber` / `formatWon` / `safeNum`
- [ ] flex+input+button: `min-w-0` 패턴
- [ ] i18n: `t('key', { defaultValue: '한글' })`
- [ ] App.tsx lazy import + Route 등록

### C. SDK 사용 시 (Toss / Stripe / Kakao 등)
**필수 사전**:
1. `node_modules/<sdk>/types/index.d.ts` 읽고 어느 함수가 어느 throw 하는지 확인
2. SDK 의 키 type / 환경 (live/test) 분리 확인
3. 다른 caller 와 일관성 유지 (dual-mode 깨지 말 것)

체크리스트:
- [ ] SDK 함수 throws 매핑 → catch 별 메시지 분기
- [ ] 키 type 자동 감지 (`detectTossClientKeyType` 등 헬퍼 사용)
- [ ] timeout 보호 (`Promise.race` 8초)
- [ ] preload 모듈 (`toss-preload.ts`) 사용 — 중복 로드 X
- [ ] redirect 흐름이면 `safeInternalPath` 로 successUrl/failUrl 검증

### D. DB 변경 시
- SSOT: `src/shared/db/production-schema.ts`
- 새 컬럼 → `production-schema.ts` 업데이트 + `repair-schema.routes.ts` 에 ALTER 등록
- 신규 테이블 → `repair-schema.routes.ts` 에 CREATE TABLE IF NOT EXISTS 등록
- 마이그레이션 직접 작성 안 함 (D1 권한 없음, repair-schema 가 응급 처치)
- INSERT 시 NOT NULL 컬럼 모두 포함 (`check-sql-not-null-insert.mjs` 통과)

### E. 새 어드민/셀러/에이전시 페이지
- 라이트 테마 강제 (`dark:` variant 추가 금지 — `check-dashboard-theme.sh` 차단)
- 가이드 (`docs/operation_guides` 의 admin/seller/agency) 같은 commit 업데이트
- i18n 6개 언어 추가 (셀러는 필수)

## 🧪 검증 도구 매핑

| 작업 영역 | 사전 실행 script | CI 차단 여부 |
|---|---|---|
| SQL 변경 | `node scripts/check-sql-bind-params.mjs -s` | yes |
| SQL INSERT | `node scripts/check-sql-not-null-insert.mjs` | warn |
| SQL 컬럼 | `node scripts/check-sql-column-exists.mjs -s` | yes |
| Status enum | `node scripts/check-status-constraints.mjs -s` | yes |
| API 인증 | `bash scripts/check-api-auth.sh` | yes |
| 스키마 참조 | `bash scripts/check-schema-refs.sh` | yes |
| 라우터 패턴 | `bash scripts/check-router-patterns.sh` | yes |
| 빌드 명령 | `bash scripts/check-build-command.sh` | yes |
| 시크릿 노출 | `bash scripts/check-no-secrets.sh` | yes |
| 대시보드 테마 | `bash scripts/check-dashboard-theme.sh` | yes |
| 셀러 role helper | `bash scripts/check-seller-role-helper.sh` | yes |
| Sentry 누출 | `node scripts/check-pii-logs.mjs` | warn |
| 번들 사이즈 | `npm run check:bundle:budget` | yes |
| 타입 (frontend) | `npx tsc --noEmit --skipLibCheck` | yes |
| 타입 (worker) | `npx tsc --noEmit --skipLibCheck -p tsconfig.worker.json` | yes |

**커밋 전 한 번에**: `bash scripts/quality-check.sh`

## 🧠 사용자와의 협업 룰

### 큰 변경 (3 파일 이상 / 새 패턴 도입) 전:
1. 변경안을 한 문단으로 요약 → 사용자 확인 받기
2. 영향 받는 영역 명시 (어느 페이지/API/DB)
3. 회귀 위험 명시
4. 사용자 "go" 받고 진행

### 작은 변경 (1 파일, 명확한 버그 fix):
1. 즉시 수정 + commit
2. commit 메시지에 변경 이유 + 영향 명시

### 검증 안 끝난 fix 표현:
- ❌ "영구 fix 완료" 
- ✅ "candidate fix push 완료 — 시크릿 창 검증 부탁드립니다"

## 📋 신규 작업 시작 체크리스트

작업 들어가기 전 다음 순서로 확인:

- [ ] `docs/CURRENT_WORK.md` 첫 줄에 진행 중 항목 추가
- [ ] CLAUDE.md 활성 룰 중 해당 영역 매핑
- [ ] `docs/ERROR_DEBUGGING_PLAYBOOK.md` 첫 한번 스캔
- [ ] `docs/KNOWN_ERRORS.md` 에서 동일 에러 사례 검색
- [ ] `grep -rn` 으로 기존 유사 구현 확인
- [ ] 작은 단위로 분해 → 첫 commit 부터 작성

## 🎯 이번 사고 (2026-05-23) 의 핵심 lesson 매핑

| 사고 패턴 | 어디서 막혀야 했나 |
|---|---|
| Toss 키 type 거꾸로 가정 | Step 2 (SDK types 읽기) — `node_modules/@tosspayments/.../types/*.d.ts` 단어 그대로 grep |
| widget-only "통일" | Step 4 (큰 리팩토링 사용자 동의 X) — dual-mode 제거는 회귀 위험 |
| /api/payments/client-key 제거 (perf) | Step 4 (env 미스매치 안전성 < perf) |
| 5번 추구 fix | ERROR_DEBUGGING_PLAYBOOK — 진단 페이지 먼저 |
| "영구 fix" 라벨 검증 전 부여 | Step 6 — candidate fix 만 가능 |

## 📎 관련 문서

- `docs/ERROR_DEBUGGING_PLAYBOOK.md` — 에러 발생 시 절차
- `docs/KNOWN_ERRORS.md` — 알려진 에러 ↔ 원인 ↔ 해결 매핑
- `CLAUDE.md` — 활성 개발 룰
- `docs/SCHEMA.md` — DB 룰
- `docs/ROUTES.md` — 라우트 매핑
- `docs/CURRENT_WORK.md` — 진행 중 작업 SSOT

---

**마지막 업데이트**: 2026-05-23 (Toss 사건 직후)
**우선순위**: 모든 개발 작업 전 본 문서 1회 스캔 필수
