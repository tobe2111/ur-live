# 거대 파일 분할 계획 (TD-006)

> 본 세션에서는 **계획만** 작성. 실제 분할은 회귀 테스트 충분히 거친 별도 PR 권장.

## 1. seller-management.routes.ts (2101줄)

### 현재 endpoint 분포 (33개)

| 카테고리 | endpoint | 줄수 |
|---|---|---|
| 가입/전환 | register, register-from-user, my-seller-status, switch-to-seller, switch-to-user | ~150 |
| 프로필 | profile, business-info, personal-info, change-password | ~300 |
| 통계 | stats, dashboard/stats | ~120 |
| 업로드 | upload-image | ~70 |
| **정산** | settlements, settlements/request, settlements/stats, settlements/summary, settlements/:id/download | ~200 |
| 공개 | public/:sellerId, :sellerId/products-public | ~60 |
| 상품 옵션 | products/:id/options (GET/POST) | ~80 |
| **알림톡** | alimtalk (GET/POST), alimtalk/balance, alimtalk/test, alimtalk/send, alimtalk/messages, alimtalk/charge | ~700 |
| 카카오 연동 | link-kakao, unlink-kakao | ~140 |

### 분할 후보 (안전 우선)

#### Phase A (가장 안전, 1~2시간)
1. **`seller-settlements.routes.ts`** — 정산 5개 endpoint (path: `/api/seller/settlements`)
   - 마운트: `app.route('/api/seller/settlements', sellerSettlementsRoutes)`
   - settlements 는 mount sub-path 라 충돌 없음
   - 코드 약 200줄 추출 → seller-management 약 2101 → 1900 줄

#### Phase B (중간 위험, 2~3시간)
2. **`seller-alimtalk-extra.routes.ts`** — 알림톡 8개 endpoint
   - 기존 `features/alimtalk/api/alimtalk.routes.ts` 와 병합 권장
   - 약 700줄 추출 → 2101 → 1400 줄
   - **위험**: 일부 alimtalk endpoint 가 `/api/seller/alimtalk` (sub-path) 로 마운트되는데, parent 라우터(seller-management)와 별도 라우터(alimtalk) 의 path 충돌 검증 필요

#### Phase C (위험, 신중)
3. **`seller-profile.routes.ts`** — profile / business-info / personal-info
4. **`seller-auth-extra.routes.ts`** — register / switch-to-* / link-kakao

### 회귀 테스트 권장 시나리오 (분할 후 필수)
- 신규 셀러 가입 흐름 (register → 어드민 승인 → 로그인)
- 카카오 사용자 → 셀러 전환 흐름
- 정산 신청 → 어드민 승인 → 입금 흐름
- 알림톡 발송 → 잔액 차감 흐름
- 상품 옵션 추가 / 수정

---

## 2. SellerLiveBroadcastPage.tsx (2510줄) — **위험 높음**

### 현재 구성
- 라이브 스트림 시작/종료 흐름
- WebSocket 실시간 채팅
- YouTube/TikTok 라이브 임베드
- 상품 진열 / 경매 / 타임딜
- DonationBoosterButton + PKLiveBanner (이번 세션 추가)

### 분할 후보 (마지막 권장)

| 추출 컴포넌트 | 줄수 | 위험도 |
|---|---|---|
| `useLiveBroadcastState.ts` (커스텀 훅) | ~300 | 🟡 중간 |
| `LiveBroadcastSetupForm.tsx` | ~200 | 🟢 낮음 |
| `BroadcastDiagnostic.tsx` (이미 추출됨?) | - | - |
| `LiveStatsBar.tsx` (이미 컴포넌트) | - | - |
| `ShareLiveLink.tsx` (이미 컴포넌트) | - | - |

### 권장 진행 방식
- **운영 안정 후 분할**: 라이브는 핵심 매출 흐름이라 회귀 시 큰 손실
- **e2e 테스트 강화 선행**: Playwright 로 라이브 시작 / 채팅 / 종료 흐름 자동 검증
- **점진적**: 1주에 1개 컴포넌트만 추출

---

## 3. 분할의 ROI 평가

### 효과 (분할로 얻는 것)
- 가독성 ↑ (한 파일 700줄 이하)
- 머지 충돌 감소
- IDE 응답 속도 ↑
- 새 개발자 진입 장벽 ↓

### 비용 (분할의 위험)
- 회귀 가능성 (특히 path 마운트 순서)
- 정산/결제 흐름 같은 중요 로직 손상 시 매출 손실
- 테스트 부족 시 prod 에서만 발견

### 결론
- **즉시 효과**: 적음 (이미 작동 중)
- **장기 효과**: 큼 (3개월 후 새 기능 추가 시 가독성/안전성)
- **권장**: Phase A (정산 분리) 만 단독 PR 로 진행 후 1주 안정 확인 → Phase B 진행.

---

## 4. 본 세션에서 진행한 것

### ✅ 완료 (안전한 분리)
- `worker/index.ts` 의 cron scheduled handler → `worker/scheduled.ts` (97줄 분리)
- `admin-management.routes.ts` 192줄까지 축소 (이전 세션)

### ⏭️ 보류 (별도 PR)
- `seller-management.routes.ts` 분할
- `SellerLiveBroadcastPage.tsx` 분할
- `agency.routes.ts` 분할 (1978줄)
- `worker/openapi.ts` 분할 (자동 생성이라 불필요)

---

## 다음 PR 단위 권장

### PR 1: settlements 분리
- 새 파일 `seller-settlements.routes.ts`
- 5개 endpoint 이동
- 통합 테스트 추가 (정산 신청 e2e)

### PR 2: alimtalk 통합 정리
- seller-management 의 alimtalk 8개 → 기존 alimtalk.routes.ts 통합
- path 충돌 검증

### PR 3: SellerLiveBroadcastPage 작은 컴포넌트만
- `LiveBroadcastSetupForm.tsx` 추출 (가입 시 라이브 설정 폼)
- 회귀 위험 낮음

각 PR 후 **최소 1주 prod 안정** 확인 후 다음 PR 진행.
