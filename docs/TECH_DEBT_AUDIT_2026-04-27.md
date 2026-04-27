# 기술 부채 감사 보고서 — 2026-04-27

> Phase 1 + 2 + 3 완료 후 전체 점검. 누적 21개 신기능 + 8개 마이그레이션 추가됨.

---

## 🟢 정상 (안정 상태)

| 항목 | 상태 |
|---|---|
| TypeScript 에러 | **0건** ✅ |
| Vite 빌드 | **성공** (23s) ✅ |
| 단위 테스트 | **1058개 통과** (60 파일) ✅ |
| i18n 6개 언어 동기 | **완전 일치** ✅ |
| DB 스키마 참조 | **금지 컬럼 0건** ✅ |
| 결제/주문 에러 처리 | **정상** ✅ |
| `<img>` alt 속성 | **모두 있음** ✅ |
| Debug 엔드포인트 DEV 가드 | **누락 0건** ✅ |
| 인증 미들웨어 (admin sub-routers) | **부모 `adminApp.use('*', requireAdmin())` 로 처리됨** — 가짜 양성 ✅ |

---

## 🟡 경고 (개선 권장)

### 1. 거대 파일 5개 (1500줄+) — TD-006 진행 중
| 파일 | 줄수 | 비고 |
|---|---|---|
| `pages/SellerLiveBroadcastPage.tsx` | 2510 | UI 페이지 — 위험 큼 (라이브 핵심) |
| **`worker/index.ts`** | **2219** | 라우터 마운트 + inline endpoints |
| `features/seller/api/seller-management.routes.ts` | 2101 | 셀러 관리 — sub-router 분할 후보 |
| `features/agency/api/agency.routes.ts` | 1978 | 에이전시 메인 — 분할 후보 |
| `worker/openapi.ts` | 1544 | 자동 생성 — 분할 불필요 |

**진행도**: scheduled.ts 분리 (Phase 1) 로 worker/index.ts -97줄. 추가 분리는 별도 PR.

### 2. 에러 삼키기 패턴 15개 (스크립트 검출)
- 대부분 **의도된 graceful degradation** — 마이그레이션 미적용 시 fallback
- 그러나 일부는 진짜 dev console.error 로 보강 권장
- **위험도**: 낮음 (운영에 영향 X)

### 3. Idempotency-Key 미사용 Toss 호출 5개
- 결제 reconciliation 시점 / 환불 / 캔슬 호출
- 네트워크 재시도 시 중복 결제 방지 위해 권장
- **위험도**: 중간 — 별도 PR 권장

### 4. 번들 크기
- `index` chunk: **693KB** (gzip ~217KB) — 600KB 권고 초과
- chrome-extension 같은 환경 X 라 큰 영향 없음
- **위험도**: 낮음 (lazy loading 추가로 줄일 수 있음)

---

## 🔴 운영 이슈 (사용자 액션 필요)

### 1. 마이그레이션 미적용 가능성 — 가장 시급
이번 누적 세션에 **11개 마이그레이션** 추가됨 (0220~0230):

| 마이그레이션 | 내용 | 의존하는 기능 |
|---|---|---|
| 0220 | seller_platform_links | 셀러 외부 연동 |
| 0221 | tiktok_videos_cache | TikTok 비디오 sync + 발굴 |
| 0222 | ensure_agency_aux_tables | 에이전시 알림/계약/정산 |
| **0223** | **agency_invite_codes** | **QR 영입** ⭐ |
| **0224** | **seller_onboarding** | **셀러 부트캠프** ⭐ |
| **0225** | **agency_public_profile** | **에이전시 공개 페이지** ⭐ |
| **0226** | **live_stream_metrics** | **라이브 KPI 카드** ⭐ |
| **0227** | **donation_boosters** | **후원 부스터** ⭐ |
| **0228** | **pk_battles** | **PK 이벤트** ⭐ |
| **0229** | **seller_transfer** | **셀러 이전** ⭐ |
| **0230** | **casting_marketplace** | **캐스팅** ⭐ |

**검증**:
```powershell
$token = "어드민_JWT"
curl.exe -H "Authorization: Bearer $token" https://live.ur-team.com/api/_internal/migration-status
```

**일괄 적용** (D1 권한 있을 때):
```bash
for f in migrations/02{2,3}*.sql; do
  npx wrangler d1 execute toss-live-commerce-db --remote --file="$f"
done
```

### 2. D1 마이그레이션 CI 권한 미발급 (TD-001 미해결)
- `CLOUDFLARE_API_TOKEN` 에 `Account > D1 > Edit` 권한 추가 필요
- 영구 해결: GitHub Actions `migrate.yml` 자동 적용 가능
- **소요**: 30분 (Cloudflare My Profile 에서 토큰 권한 편집)

### 3. (선택) Resend API 키 미등록
- Phase 2-6 자동 월간 리포트 메일 발송에 필요
- 미설정 시 → 대시보드 알림만 발송 (기능 정상)

---

## 📊 전체 누적 통계 (이번 세션 시작 ~ 현재)

| 카테고리 | 개수 |
|---|---|
| 마이그레이션 추가 | 11개 (0220~0230) |
| 신규 cron handlers | 7개 (inactive-sellers, live-metrics, monthly-report, pk-tick, monthly-tasks, monthly-invoices, tiktok-sync) |
| 신규 API 라우터 | 14개+ |
| 신규 페이지 | 4개 (AgencyInvitesPage, AgencyPublicPage, /a/:slug, AgencyPublic) |
| 신규 컴포넌트 | 5개 (SecurityRelogin, SellerOnboarding, LiveStartGuide, PLSimulator, others) |
| 신규 utility | 3개 (agency-tier, viewer-loyalty, chat-moderation) |
| 신규 단위 테스트 | 4개 (agency-incentives, monthly-tasks, permissions, tier-eval) |
| 문서 추가 | 8개+ (LEARNING_v2, ROTATION, ROADMAP 등) |

---

## 🎯 우선순위별 권장 후속 작업

### 🔴 즉시 (이번 주)
1. **마이그레이션 11개 프로덕션 적용** (사용자 액션, D1 wrangler)
2. **결제 1000원 실제 검증** (Phase 1 시크릿 회전 후 미실시)

### 🟡 단기 (이번 달)
3. **D1 CI 권한 발급** (TD-001 영구 해결)
4. **Idempotency-Key 통합** (Toss 호출 5개)
5. **신규 페이지 UI** — PK 매칭 페이지, 부스터 발동 버튼, 캐스팅 셀러 알림 (백엔드 다 됨)

### 🟢 중기 (분기)
6. **거대 파일 분할** — SellerLiveBroadcastPage, seller-management.routes.ts
7. **번들 lazy loading 강화** — index chunk 693KB → 400KB 목표
8. **라이브 클립 자동 생성** — Cloudflare Stream 통합 (별도 인프라 계약 필요)

### ⚪ 장기 (선택)
9. **AI 모더레이션 강화** — Claude/GPT 통합 (현재는 패턴 기반)
10. **광고/캐스팅 결제 통합** — PG 연동 (현재는 수동)
11. **Sentry 에러 모니터링 활성화 검증**

---

## 💪 이번 세션 누적 성과

- 🔒 시크릿 4종 회전 + 토스 라이브 웹훅 + ENVIRONMENT=production
- ⚙️ Phase 1: 7개 (등급/QR영입/부진알림/KPI/부트캠프/라이브가이드/공개페이지)
- ⚙️ Phase 2: 7개 (가이드/PL시뮬/충성도/라이브KPI/부스터/월간리포트/PK이벤트)
- ⚙️ Phase 3: 6개 (최적시간/FAQ봇/모더레이션/TikTok발굴/Network/캐스팅) + 1개 보류 가이드
- 🛠️ TS 에러 0 / 빌드 성공 / 1058 테스트 통과 / i18n 동기

**총 신기능 21개**, **신규 코드 ~5000줄**, **TypeScript 안전성 유지**.

---

## 🆘 막힐 때

| 영역 | 참조 문서 |
|---|---|
| 시크릿 회전 절차 | `docs/POST_ROTATION_USER_ACTIONS.md` |
| 마이그레이션 적용 | `docs/MIGRATION_AND_ROLLBACK_RUNBOOK.md` |
| TikTok 학습 인사이트 | `docs/TIKTOK_BACKSTAGE_LEARNING_v2.md` |
| 라이브 클립 로드맵 | `docs/LIVE_CLIP_AUTOGEN_ROADMAP.md` |
| 전체 기술 부채 | `TECHNICAL_DEBT.md` |
