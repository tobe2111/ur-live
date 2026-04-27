# 세션 작업 요약 (2026-04-26)

> 브랜치: `claude/fix-empty-text-block-FbMjF`
> 시작 커밋: `25270dc` (이전 main)
> 최종 커밋: `1704e4f`
> **추가된 커밋: 49개**

---

## 0. 한 줄 요약

TikTok Agency Backstage 학습 → 우리 에이전시 시스템 풀스택 재설계 → 검증/운영 도구 + 모바일 통합 토대까지.

---

## 1. 추가된 마이그레이션 (15개)

| # | 파일 | 내용 |
|---|---|---|
| 0207 | agency_creator_approvals | P0 #1 셀러 심사 큐 |
| 0208 | agency_auto_settle | P0 #3 자동 정산 + 세금 |
| 0209 | agency_campaigns | P0 #4 캠페인 + participants |
| 0210 | agency_incentive_engine | P0 #5 규칙 + payouts |
| 0211 | auction_winner_history | TD-007 낙찰 이력 |
| 0212 | agency_tier | Q1 등급제 (new/junior/senior) |
| 0213 | agency_creator_evaluation | Q3 30일 자동 평가 |
| 0214 | agency_message_templates | Q2 템플릿 + sends |
| 0215 | agency_monthly_tasks | Q6 의무 작업 |
| 0216 | coupons_agency_distribution | Q7 쿠폰 캐스케이드 |
| 0217 | agency_members | M4 멀티 권한 |
| 0218 | agency_live_notes | M5 라이브 캘린더 노트 |
| 0219 | settlement_invoices | M6 송장 |
| 0220 | seller_platform_links | T1 TikTok 연동 |
| 0221 | tiktok_videos_cache | T2 비디오 캐시 |

---

## 2. 추가된 cron handler (8개)

| 파일 | 스케줄 | 동작 |
|---|---|---|
| `agency-auto-settle.ts` | 월 09:00 KST | 자동 정산 + 세금 차감 |
| `agency-tier-eval.ts` | 월 1주차 | 등급 평가 (전월 매출 + 가입일) |
| `agency-creator-eval.ts` | 매일 18:00 UTC | 30일 경과 셀러 자동 평가 (+TikTok 가산) |
| `agency-monthly-tasks.ts` | 매일 18:00 UTC | 의무 작업 actual 갱신 |
| `agency-monthly-invoices.ts` | 월 1주차 | 송장 자동 발행 (HTML + R2 옵션) |
| `tiktok-videos-sync.ts` | 매일 18:00 UTC | TikTok 비디오 sync |
| `d1-backup.ts` | 일 20:00 UTC | D1 → R2 백업 (R2 binding 시 활성) |
| `recomputeAllActiveCampaigns` | 매일 18:00 UTC | 캠페인 누적 매출 재집계 |

---

## 3. 추가된 API 라우터 (12개)

| 경로 | 기능 |
|---|---|
| `/api/admin/agency-creator-approvals` | 셀러 심사 큐 (5 endpoints) |
| `/api/admin/metrics/webhook-failures` | TD-009 webhook 실패 모니터링 |
| `/api/agency/campaigns` | 캠페인 (9 endpoints) |
| `/api/agency/incentives` | 인센티브 규칙 (6 endpoints) |
| `/api/agency/messages` | 메시지 템플릿 (6 endpoints) |
| `/api/agency/coupons` | 쿠폰 캐스케이드 (3 endpoints) |
| `/api/agency/members` | 멀티 권한 (7 endpoints) |
| `/api/agency/calendar` | 라이브 캘린더 + 노트 (6 endpoints) |
| `/api/agency/stats/realtime` | KV 캐시 30초 |
| `/api/agency/stats/kpi` | 핵심 지표 6 |
| `/api/agency/monthly-tasks` | 의무 작업 진행률 |
| `/api/seller/tiktok` | TikTok OAuth + Display API (7 endpoints) |
| `/api/auction/:id/forfeit-winner` | 낙찰 차순위 자동 승격 |
| `/api/health/migrations` | 마이그레이션 적용 검증 |
| `/api/debug/build-info` `/bindings` | 운영 디버그 (분리됨) |
| `/api/csp-report` `/manifest.webmanifest` `/api/version` | 공개 유틸 (분리됨) |
| `/api/...kakao/place/...` `/api/.../naver/...` | 외부 프록시 (분리됨) |

---

## 4. 추가된 프론트엔드 페이지 (10개)

| 경로 | 페이지 |
|---|---|
| `/admin/agency-creator-approval` | 셀러 심사 |
| `/agency/campaigns` | 캠페인 관리 |
| `/agency/incentives` | 인센티브 규칙 (3 탭) |
| `/agency/messages` | 메시지 템플릿 (2 탭) |
| `/agency/coupons` | 쿠폰 배포 + 통계 |
| `/agency/members` | 팀 멤버 |
| `/agency/calendar` | 라이브 캘린더 + 노트 |
| `/seller/tiktok-callback` | TikTok OAuth 콜백 |
| (대시보드 확장) | KPI 6 카드 + 의무 작업 진행률 |
| (관리자 확장) | 등급 select + auto_settle 토글 |
| (정산 확장) | 송장 다운로드 섹션 |

---

## 5. 검증/자동화 도구 (5개)

| 도구 | 목적 |
|---|---|
| `scripts/verify-schema.mjs` | migrations ↔ TS interface diff |
| `scripts/check-bundle-size.mjs` (강화) | --json / --budget / Cloudflare Pages 경로 |
| `scripts/rotate-secrets.mjs` | JWT/REFRESH/CRON/WEBHOOK 자동 생성 |
| `.github/workflows/verify.yml` | PR 검증 (정적 + 빌드 + 번들 예산) |
| `.github/workflows/main.yml` (확장) | Sentry 소스맵 자동 업로드 |
| `/api/health/migrations` | 18개 핵심 컬럼/테이블 적용 검증 (어드민) |

---

## 6. 분석/전략/Runbook 문서 (12개)

```
docs/
├── AGENCY_BACKSTAGE_GAP_ANALYSIS.md    # TikTok 학습 갭 분석
├── AGENCY_BACKSTAGE_LEARNING.md        # 17장 이미지 종합
├── AGENCY_STRATEGY_QUICKWIN.md         # Q1~Q7 로드맵
├── DOUBLE_ROUTING_AUDIT.md             # TD-004 downgrade
├── RECONNAISSANCE_DIRS.md              # 디렉토리 정찰
├── CAPACITOR_RECONNAISSANCE.md         # 모바일 앱 상태
├── PDF_GENERATION_ROADMAP.md           # PDF 도입 로드맵
├── SECRET_ROTATION_RUNBOOK.md          # TD-002 9단계 가이드
├── TIKTOK_INTEGRATION_T1.md            # TikTok 정책/사용자작업
├── VERIFICATION_PROCEDURE.md           # 14섹션 배포 전 체크
├── SESSION_2026-04-26_SUMMARY.md       # (이 문서)
```

---

## 7. 단위 테스트

| 파일 | 케이스 |
|---|---|
| `agency-permissions.test.ts` | 16 (역할 4종 디폴트, JSON override, 보안 규칙) |
| `agency-tier-eval.test.ts` | 29 (isUpgrade, determineTier, tierBaseCommissionRate) |
| **합계** | **45** |

순수 함수 추출 패턴: `determineTier`, `isUpgrade`, `effectivePermissions` — 향후 다른 cron 도 같은 패턴으로 테스트 가능.

---

## 8. i18n 6언어 동기화

| 영역 | 키 |
|---|---|
| `seller.guide.*` (TikTok 학습 반영) | 신규 `live-mastery` 섹션 |
| `seller.bundle*`, `seller.discount*` | 13개 키 추가 |
| `sellerWaiting.*` | 14개 키 (페이지 i18n) |
| `sellerRegisterBusiness.*` | 30개 키 (페이지 i18n) |
| `agency.nav.*` | 28개 키 (사이드바 17 메뉴 + 5 그룹) |
| **합계** | **~85개 신규 키 × 6언어 = ~510 항목** |

`comm` 검증: ko vs en/ja/zh/es/fr 누락 0건 (100% 동기화).

---

## 9. TikTok 통합 (Tier 1+2 — 정책 안전 범위)

### 가능한 것 (구현됨)
- ✅ TikTok Login Kit (OAuth 2.0)
- ✅ Display API: 사용자 정보 + 비디오 (녹화)
- ✅ 셀러 프로필 위젯 (비디오 12개 표시)
- ✅ 매일 자동 sync (cron)
- ✅ 인증 셀러 → Q3 자동 평가 +20 가산
- ✅ 셀러 측 위젯 표시 토글

### 정책상 불가능 (구현 X)
- ❌ Live RTMP 외부 송출
- ❌ Live Backstage API
- ❌ 다이아몬드/정산 sync
- ❌ 자동 영입 / IM 메시지

---

## 10. 기술 부채 변화

| TD | 이전 | 이후 |
|---|---|---|
| TD-001 (CI 마이그레이션) | 🔴 | 🔴 미해결 (사용자 작업) |
| TD-002 (시크릿 노출) | 🔴 | 🔴 미해결 (도구 + runbook 만 추가) |
| TD-003 (유령 Workers) | 🔴 | 🔴 미해결 (사용자 작업) |
| TD-004 (이중 라우팅) | 🟡 | 🟢 **downgrade** (audit 완료) |
| TD-005 (스키마 이중화) | 🟡 | 🟡 미해결 (위험) |
| TD-006 (worker/index.ts) | 🟡 | 🟡 부분 해소 (-7%) |
| TD-007 (auction capacity) | 🟡 | ✅ **해결** |
| TD-008 (CRON_TOKEN) | 🟡 | ✅ 이미 해결 (배치 120) |
| TD-009 (webhook 실패) | 🟡 | ✅ **해결** (UI 노출) |
| TD-010 (i18n 셀러) | 🟡 | ✅ **해결** (모든 페이지 + 사이드바) |
| TD-011 (CVE) | 🟢 | 🟢 변화 없음 |

---

## 11. 사용자가 직접 해야 할 일

### 🔴 Critical
1. **TD-002 시크릿 rotation** — `docs/SECRET_ROTATION_RUNBOOK.md` 따라가기
2. **TD-001 D1 Edit 권한** — Cloudflare API Token
3. **TD-003 유령 Workers 삭제**

### 🟡 Important
4. **마이그레이션 0207~0221 적용** — `wrangler d1 execute` 또는 `/api/_internal/repair-schema`
5. **R2 bucket 생성** (`ur-live-backups`) — D1 백업 + 송장 R2 활성화
6. **TikTok for Developers 앱 등록** + `TIKTOK_CLIENT_KEY/SECRET` 등록
7. **GitHub Secrets**: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`

### 🟢 Optional
8. CI 에 verify.yml 활성화 확인
9. `bash scripts/quality-check.sh` 정기 실행
10. `node scripts/verify-schema.mjs` 출력 검토 → drift 발견 시 정리

---

## 12. 검증 (배포 후)

```bash
# 1. 마이그레이션 적용 상태
curl -H "Authorization: Bearer $ADMIN" \
  https://live.ur-team.com/api/health/migrations | jq '.summary'
# 기대: { total: 18, applied: 18, missing: 0, errors: 0 }

# 2. 핵심 KPI API
curl -H "Authorization: Bearer $AGENCY_TOKEN" \
  https://live.ur-team.com/api/agency/stats/kpi | jq '.data | keys'
# 기대: 6개 지표 + meta

# 3. TikTok 통합 상태 (TIKTOK_CLIENT_KEY 등록 후)
curl -H "Authorization: Bearer $SELLER" \
  https://live.ur-team.com/api/seller/tiktok/auth-url | jq '.data.auth_url'
```

---

## 13. 미진행 (별도 epic)

- TD-005 스키마 이중화 정리
- DO + WebSocket 실시간 매출
- PDF 생성 (Browser Rendering API)
- Capacitor 앱 빌드/배포 검증
- 신규 L 페이지 5개 deep i18n
- 에이전시 멀티 권한 Phase 3 (DB override + audit log)

---

## 14. 누계

- **49 commits**
- **15 migrations**
- **8 cron handlers**
- **12 API routers**
- **10 frontend pages**
- **5 verification tools**
- **12 documentation files**
- **45 unit test cases**
- **~85 i18n keys × 6 languages**

브랜치 `claude/fix-empty-text-block-FbMjF` — 머지 가능 상태.
