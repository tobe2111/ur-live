# 코드베이스 종합 감사 결과 (2026-05-06)

> 자동 감사 + 수동 검토. 심각도: 🔴 critical / 🟡 medium / 🟢 low

---

## 1. 보안 (Security)

🟡 `src/shared/config/region.ts:264-270` — console.log DEV 게이트 없음 (프로덕션 노출)
🟡 `src/worker/middleware/auth.ts:93,171,192,198,205,220,229,244,254` — Firebase 검증 에러를 DEV 게이트 없이 console.error → 공격자 정보 수집 용이
🟡 `src/worker/routes/payment.routes.ts:123,135` — 결제 관련 민감 데이터(userId, amount) DEV 게이트 없이 console.error
🟡 `src/shared/config/env-validator.ts:60,76,112,140-141` — 검증 실패 시 console.error/warn DEV 게이트 없음
🟡 `src/features/seller/api/seller-settlements.routes.ts:50-51` — pagination limit/offset 범위 검증 없음 (limit=999999 가능) → `Math.max(1, Math.min(200, limit))` 추가 필요
🟡 `src/worker/routes/public-utility.routes.ts:119,127` — 에러 시 HTTP 200 반환 (`{ success: false }`) → 4xx/5xx 로 수정 필요

---

## 2. TypeScript 품질

🟡 `src/durable-object.ts:22,25,127` — `any` 타입 남용 (currentProduct, env, message 파라미터)
🟡 `src/types.ts:121`, `src/types/api.ts:26`, `src/types/payment.ts:76,91` — `data: any`, `details?: any` → 제네릭 또는 proper 타입으로
🟡 `src/shared/stores/useAuthKR.ts:313` — `(import.meta as any).env` → Vite 타입 사용
🟡 `src/main.tsx:92,96` — `(window as any).gtag`, `(window as any).requestIdleCallback` → 타입 선언 추가
🟡 `src/components/auth/RouteGuards.tsx:98-99` — `useAuthWorld((s: any) => s.user)` → selector 타입 명시
🟡 `src/components/PushNotificationSetup.tsx:64` — non-null assertion `reg!` 설명 주석 없음
🟡 `src/components/ProductOptionForm.tsx:57` — `value: any` → union type으로

---

## 3. 성능 (Performance)

🟡 `src/components/live/ReelCard.tsx` — 1321줄 대형 컴포넌트 (TD-006 대상)
🟡 `src/App.tsx` — 1070줄, 40+ 라우트 정의 → 라우트 모듈 분리 권장
🟡 `src/pages/CheckoutPage.tsx` — 759줄 → 서브 컴포넌트 추출 가능

---

## 4. 에러 핸들링

🟡 `src/worker/routes/webhook.routes.ts:438` — `.catch(() => {})` → `swallow()` 유틸로 교체
🟡 `src/components/SideBanner.tsx:22-24` — 빈 catch (네트워크 에러 완전 무시)
🟡 `src/shared/stores/useAuthKR.ts:521` — 토큰 저장 에러 복구 없이 삼킴
🟡 `src/components/DashboardNotificationBell.tsx:46` — 빈 catch, 재시도 없음

---

## 5. React 패턴

🟡 `src/App.tsx:26` — 컴포넌트 함수 바디에서 localStorage 접근 (렌더마다 실행, SSR 불안)
🟡 `src/components/AgencyLayout.tsx:108` — `useState(localStorage.getItem(...))` — SSR 불안
🟡 `src/components/AdminLayout.tsx:122` — 컴포넌트 바디에서 localStorage 접근 → useEffect 로
🟡 `src/components/PushNotificationSetup.tsx:25-27` — localStorage 다중 접근 (useEffect 밖)
🟡 `src/shared/stores/useAuthWorld.ts:72` — 스토어 초기화 시점에 localStorage 접근 → lazy getter 로

---

## 6. 접근성 (Accessibility)

🟡 `src/components/main/BottomNav.tsx` — 아이콘 버튼 일부 aria-label 미흡
🟡 `src/components/live/ReelCard.tsx` — 인터랙티브 요소 일부 aria-label/role 없음

---

## 7. 번들 / 빌드

🟡 `src/App.tsx` — 루트 라우팅이 너무 커서 코드 스플리팅 효과 감소 → 라우트 그룹별 분리
🟡 `src/components/live/ReelCard.tsx` — 1321줄 → 코드 스플리팅 이점 감소

---

## 8. 테스트 커버리지

🔴 **API 라우트 148개 중 약 77% 미테스트** — 결제/주문/정산/웹훅 핵심 경로 테스트 없음
🟡 Admin API 라우트 전체 (`admin-sellers/settlements/products.routes.ts`) 전용 테스트 없음
🟡 IDOR/소유권 검증 시나리오 테스트 없음 (미들웨어 신뢰에만 의존)

---

## 9. API / 백엔드

🟡 `src/features/seller/api/seller-settlements.routes.ts:50-51` — pagination 상한 없음 (↑ 보안과 중복)
🟡 `src/worker/routes/public-utility.routes.ts:119,127` — 에러 시 HTTP 200 (↑ 보안과 중복)

---

## 우선순위 정리

| 순위 | 항목 | 파일 | 예상 공수 |
|---|---|---|---|
| 1 | 결제/auth console.error DEV 게이트 | auth.ts, payment.routes.ts | 30분 |
| 2 | pagination limit 상한 | seller-settlements.routes.ts | 10분 |
| 3 | HTTP 200 on error 수정 | public-utility.routes.ts | 15분 |
| 4 | durable-object.ts any 타입 | durable-object.ts | 1시간 |
| 5 | localStorage SSR 패턴 정리 | AgencyLayout, AdminLayout, App.tsx | 2시간 |
| 6 | API 라우트 테스트 (결제/웹훅) | tests/ | 1-2일 |
| 7 | ReelCard + App.tsx 파일 분할 | TD-006 | 2-3시간 |

---

## 잘 된 것 ✅

- JWT HS256 알고리즘 고정 (alg-confusion 방지)
- 결제 IDOR + 금액 서버 재계산 완비
- SQL 파라미터 바인딩 (인젝션 없음)
- 웹훅 중복 처리 방지 (이벤트 dedup)
- dangerouslySetInnerHTML → DOMPurify 적용
- 모든 메인 페이지 lazy() 로드
- ARIA 레이블 알림벨 완비
