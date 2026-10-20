# TypeScript Any Type Replacement - Progress Report

**생성 일시**: 2026-03-20  
**상태**: 🔄 진행 중 (Phase 1 완료)  
**목표**: 332개 → 100개 핵심 수정

---

## 📊 진행 현황

### 전체 개요
| 지표 | Before | After | 진행률 |
|------|--------|-------|--------|
| **Total any types** | 332 | **311** | **6.3%** |
| **Files with any** | 100+ | 98 | 2% |
| **High-priority fixed** | 0 | **2** | ✅ |

### Phase 1 완료 (핵심 유틸리티)

#### 1. `src/worker/utils/response.ts` ✅
**수정**: 8개 `any` → `unknown` 또는 제네릭 타입

**Before**:
```typescript
export interface SuccessResponse<T = any> {
  details?: any;
}
export function jsonSuccess(c: Context, data: any, ...
```

**After**:
```typescript
export interface SuccessResponse<T = unknown> {
  details?: Record<string, unknown>;
}
export function jsonSuccess<T = unknown>(c: Context, data: T, ...
```

**영향**:
- 모든 API 응답에 타입 안전성 추가
- 에러 details는 Record<string, unknown>으로 명확화
- Context 상태 코드 `as any` 제거

#### 2. `src/worker/utils/database.ts` ✅
**수정**: 13개 `any` → `unknown` 또는 제네릭 타입

**Before**:
```typescript
async query<T = any>(sql: string, ...params: any[]): Promise<T[]>
where: Record<string, any>
params: any[] = []
```

**After**:
```typescript
async query<T = unknown>(sql: string, ...params: unknown[]): Promise<T[]>
where: Record<string, unknown>
params: unknown[] = []
```

**영향**:
- 모든 DB 쿼리에 타입 안전성 추가
- SQL 파라미터는 unknown으로 명확화
- QueryBuilder의 where 조건 타입 안전

---

## 🎯 다음 우선순위 (Phase 2-5)

### Phase 2: API Routes (19개 any 사용)
**파일**: `src/features/seller/api/seller-management.routes.ts`

**수정 계획**:
```typescript
// Before
catch (err: any) {
  return c.json({ error: err.message }, 500);
}

// After
catch (err) {
  const message = err instanceof Error ? err.message : 'Unknown error';
  return c.json({ error: message }, 500);
}
```

### Phase 3: Error Handling (11개 any 사용)
**파일**: `src/lib/aligo.ts`, `src/lib/firebase-admin.ts`

**수정 계획**:
- `catch (error: any)` → `catch (error: unknown)`
- Type guard 함수 추가: `isError(err: unknown): err is Error`

### Phase 4: Frontend Pages (8개 any 사용)
**파일**: `src/pages/LivePageV2.tsx`, `src/pages/LoginPage.tsx`

**수정 계획**:
- API 응답 타입 정의
- Event handler 타입 명시

### Phase 5: Utility Functions (나머지)
**파일**: `src/utils/logger.ts`, `src/lib/errors.ts`

---

## 📈 예상 효과

### 코드 품질
- ✅ 컴파일 타임 오류 감지 증가
- ✅ IDE 자동완성 개선
- ✅ 리팩토링 안전성 향상

### 개발 생산성
- ✅ 버그 조기 발견 (개발 단계)
- ✅ API 문서화 자동화 (타입 기반)
- ✅ 코드 리뷰 시간 단축

---

## ⏱️ 예상 시간

| Phase | 예상 시간 | 우선순위 |
|-------|----------|---------|
| Phase 1 (완료) | ✅ 0.5h | 높음 |
| Phase 2 (API Routes) | 1h | 높음 |
| Phase 3 (Error Handling) | 0.5h | 중간 |
| Phase 4 (Frontend) | 1h | 중간 |
| Phase 5 (Utils) | 0.5h | 낮음 |
| **총계** | **3.5h** | - |

---

## 🔄 다음 작업

현재 우선순위:
1. ✅ Phase 1: 핵심 유틸리티 (완료)
2. ⏳ **Bundle Size 최적화** (다음 단계)
3. ⏳ Phase 2: API Routes (이후 진행)

---

**Phase 1 완료 ✅**  
**진행률: 6.3% (21개 / 332개)**  
**다음: Bundle Size 최적화 →**
