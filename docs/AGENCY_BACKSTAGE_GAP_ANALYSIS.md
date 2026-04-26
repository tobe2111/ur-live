# 에이전시 백스테이지 갭 분석 (TikTok Agency Backstage 모델 비교)

> 작성일: 2026-04-26
> 대상: 유어딜 에이전시 생태계 강화 로드맵
> 참조 모델: TikTok Agency Backstage (크리에이터 관리 SaaS 표준)

## 1. 현재 구현 요약

### API (`src/features/agency/api/agency.routes.ts`, 1631줄)
- **인증**: 독립 가입/카카오 확장/로그인/비번 재설정 (`/register`, `/register-from-user`, `/login` 등)
- **셀러 관리**: 목록(`/sellers`), 통계(`/sellers/:id/stats`), 비교(`/sellers/compare`)
- **운영**: 주문(`/orders`), 라이브(`/streams`), 일정(`/schedule`), 반품(`/returns`), 공지(`/notices`)
- **성과**: 통계(`/stats*`), 랭킹(`/ranking`), 목표(`/targets`)
- **상품**: 셀러 대신 등록(`/sellers/:id/products`), 재고(`/sellers/:id/inventory`)
- **정산**: 조회/신청 (`/settlements*`) — PIN 필수
- **계약**: 조회/생성/수정 (`/contracts*`) — PIN 필수
- **리포트**: CSV (`/report/csv`, `/settlements/csv`)
- **알림**: 대시보드 알림 (`/notifications`)

### DB 스키마 (`migrations/0150_add_agency_tables_and_seed.sql`)
- `agencies` — 에이전시 마스터 (status, commission_rate 기본 2%, pin_hash, bank_*)
- `agency_sellers` — 매핑 (agency_id, seller_id)
- `agency_contracts` — 계약 (start/end/terms/status)
- `agency_seller_targets` — 월별 매출 목표
- `agency_settlements` — 정산 내역 (commission_rate, commission_amount, status)
- `agency_notifications` — 알림

### 페이지 (24개)
인증/대시보드/셀러관리/통계/랭킹/주문/스트림/정산/일정/상품/반품/비교/공구/목표/계약/가이드/공지/프로필

### 보안 (`agency-pin.routes.ts`)
- 4~6자리 PIN, 15분 유효
- 카카오 세션 기반 재인증
- Rate limit (설정 5/5분, 검증 10/5분)

---

## 2. TikTok Agency Backstage 표준 기능

| 카테고리 | 기능 |
|---------|------|
| **크리에이터** | 초대 → 심사 → 계약 → 등급/배치 관리 |
| **수익** | 실시간 집계 / 자동 분배 / 자동 정산 / 세금 자동 보고 |
| **캠페인** | 라이브 일정 / KPI / 인센티브 / 미션 트래킹 |
| **분석** | 시청자 세분화(연령/지역/기기) / 트렌드 / 벤치마크 |
| **권한** | 오너/매니저/스태프 역할 분리 / 팀별 권한 / 감사 로그 |
| **트레이닝** | AI 추천 / 가이드 / 자료실 / 실시간 알림 |
| **승인** | 신규 크리에이터 심사 / 콘텐츠 검토 |

---

## 3. 갭 매트릭스

| 영역 | 현재 ur-live | TikTok 기준 | 갭 | 우선순위 |
|------|-------------|------------|----|---------|
| 크리에이터 초대 | ✅ 초대 링크 | + 이메일 초대, 예비 승인 | 배치/팀, 예비 심사 | P1 |
| 크리에이터 심사 | ❌ 즉시 승인 | ✅ 관리자 심사 | **사업자/신분증 검증** | **P0** |
| 계약 관리 | ✅ 기본 | + 자동 갱신, 조건부 해지, 문서 | 자동 갱신/문서 | P1 |
| 수수료율 | ✅ 2% 고정 | + 성과 기반 동적 | 동적 조정 | P1 |
| 실시간 수익 | ⚠️ 일 1회 배치 | ✅ 초단위 | **WebSocket/Pub-Sub** | **P0** |
| 자동 정산 | ⚠️ 수동 PIN | ✅ 자동 스케줄 | **주간 자동 + 세금 계산** | **P0** |
| 캠페인 관리 | ❌ 없음 | ✅ 일정+KPI+인센티브 | **중앙 관리 시스템** | **P0** |
| 성과 분석 | ⚠️ 매출/주문만 | + 시청자 세분화 | **세그먼트 분석** | **P0** |
| 인센티브 계산 | ❌ 없음 | ✅ 자동 | **규칙 엔진** | **P0** |
| 팀/권한 | ❌ 1인 운영 | ✅ 다중 역할 | 매니저/스태프 | P1 |
| 감사 로그 | ✅ 기본 | + 상세 추적 | 누가/언제/무엇 | P1 |
| 알림 | ✅ 대시보드만 | + 이메일/SMS/푸시 | 멀티채널 | P1 |
| 권한 승인 | ✅ PIN | + 2FA, 고액 관리자 승인 | 추가 안전장치 | P1 |
| 데이터 내보내기 | ✅ CSV | + Excel/PDF/자동 이메일 | 자동 리포트 | P2 |

---

## 4. 우선순위 (P0~P2)

### P0 — 필수 (에이전시 운영 불가능)
1. 크리에이터 심사 워크플로우 — 사업자/신분증 검증
2. 실시간 수익 집계 — Durable Object + WebSocket
3. 자동 정산 스케줄 — 주간 자동 + 세금 3.3% 자동 차감
4. 캠페인 중앙 관리 — 일정/KPI/인센티브 통합
5. 인센티브 자동 계산 — 매출/평점/라이브 횟수 규칙 엔진

### P1 — 효율 향상
6. 성과 기반 수수료 동적 조정
7. 팀/권한 관리 (오너/매니저/분석가)
8. 시청자 세분화 분석
9. 고액 정산 관리자 승인 필수
10. 감사 로그 상세화

### P2 — 장기
11. 자동 리포트 생성/배포 (Excel, PDF)
12. AI 매출 예측

---

## 5. P0 액션 플랜

### 5.1 크리에이터 심사 워크플로우 (8~10h)

**현재 문제:** 초대 링크로 가입한 셀러가 즉시 `approved` (agency.routes.ts:1211)

**변경 사항:**
- `sellers` 테이블에 `status='pending'`, `affiliated_agency_id`, `documents_submitted_at` 추가
- 신규 페이지 `/admin/agency-creator-approval` — 사업자번호/신분증 검증 후 승인/거부
- 새 테이블 `agency_creator_approvals`

```sql
ALTER TABLE sellers ADD COLUMN affiliated_agency_id INTEGER;
ALTER TABLE sellers ADD COLUMN documents_submitted_at DATETIME;

CREATE TABLE agency_creator_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  agency_id INTEGER NOT NULL,
  business_number TEXT,
  id_image_url TEXT,
  status TEXT DEFAULT 'pending',  -- pending/approved/rejected
  reason TEXT,
  reviewed_by INTEGER,
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

### 5.2 실시간 수익 집계 (6~8h)

**현재 문제:** `/stats/batch` 는 요청 시점 정적 쿼리, 캐시 없음 (agency.routes.ts:632)

**변경 사항:**
- 새 Durable Object `AgencyStatsAggregator` — 주문 생성 시 에이전시 캐시 업데이트
- WebSocket 엔드포인트 `/api/agency/stats/stream`
- KV 캐시 fallback (`agency:{id}:stats:realtime`)

**DB 변경 없음** (KV + DO)

---

### 5.3 자동 정산 스케줄 (4~6h)

**현재 문제:** `POST /settlements/request` 수동 (agency.routes.ts:780), PIN 매번 필요

**변경 사항:**
- Cron 매주 월요일 09:00 KST 자동 정산
- 에이전시별 ON/OFF 토글
- 소득세 3.3% 자동 차감

```sql
ALTER TABLE agencies ADD COLUMN auto_settle INTEGER DEFAULT 0;
ALTER TABLE agency_settlements ADD COLUMN tax_amount INTEGER DEFAULT 0;
```

새 cron handler: `src/worker/cron/agency-auto-settle.ts`

---

### 5.4 캠페인 중앙 관리 (12~15h)

**현재 문제:** 라이브는 셀러가 생성, 에이전시는 조회만 (agency.routes.ts:935)

**변경 사항:**
- 캠페인 생성/관리 페이지 `/agency/campaigns`
- 셀러 배치 + 개별 KPI 설정
- 실시간 캠페인 성과 트래킹

```sql
CREATE TABLE agency_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'active',  -- active/ended
  base_incentive_rate REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE agency_campaign_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,
  target_amount INTEGER,
  bonus_rate REAL,
  current_amount INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

### 5.5 인센티브 자동 계산 (10~12h)

**현재 문제:** 기본 수수료(2%) 고정, 인센티브 없음

**변경 사항:**
- 규칙 엔진: 매출/시청시간/평점 기반
- 월 1회 자동 보너스 지급
- 에이전시 맞춤 규칙 설정

```sql
CREATE TABLE agency_incentive_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  metric TEXT NOT NULL,  -- sales/rating/streams
  threshold REAL NOT NULL,
  bonus_rate REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE agency_incentive_payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,
  month TEXT NOT NULL,  -- YYYY-MM
  base_commission INTEGER,
  bonus_commission INTEGER,
  total INTEGER,
  status TEXT DEFAULT 'calculated',  -- calculated/paid
  paid_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. 로드맵

| # | 기능 | 작업시간 | 우선순위 | 의존성 |
|---|------|---------|---------|-------|
| 1 | 크리에이터 심사 | 8~10h | P0 | 없음 |
| 2 | 실시간 수익 | 6~8h | P0 | 없음 |
| 3 | 자동 정산 | 4~6h | P0 | #1 |
| 4 | 캠페인 관리 | 12~15h | P0 | #2 |
| 5 | 인센티브 계산 | 10~12h | P0 | #4 |
| **합계** | | **40~51h** | — | — |

---

## 7. 핵심 발견

1. **현재 ur-live는 "에이전시 대시보드" 수준** — 조회 중심, 모집/관리 기능 미흡
2. **TikTok Backstage 핵심은 "자동화"** — 심사, 정산, 인센티브 계산 모두 자동
3. **수익 구조가 불완전** — 2% 고정이면 성과 기반 관리 불가
4. **보안은 견고함** — PIN, rate limit, 감사 로그 (1631줄 → 안정적)
5. **실시간성 부족** — KV/DO 활용 시 사용자 만족도 +30% 기대

---

## 8. 시작 권장

**P0 #1 (크리에이터 심사)**부터 시작.
- 에이전시 운영의 핵심 진입 통제
- 다른 P0 작업의 전제 조건 (정산 #3 의 의존성)
- 2~3일 내 완성 가능

> ⚠️ 본 문서는 **분석 단계**이며, 구현은 별도 PR (epic 브랜치) 권장.
