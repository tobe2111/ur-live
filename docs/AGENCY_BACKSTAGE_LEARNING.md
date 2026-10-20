# TikTok Agency Backstage 학습 노트 (이미지 기반)

> 작성일: 2026-04-26 (1차)
> 출처: 사용자가 보내준 TikTok Backstage 부트캠프 Ver.2 + 본격 비즈니스 + Bootcamp 전반 스크린샷 17장
> 목적: 우리 서비스(`ur-live`)에 접목할 수 있는 부분을 정리. 추가 이미지가 오면 계속 업데이트.
>
> ⚠️ 이 문서는 **공개 교육 자료 기준의 운영 모델 학습**입니다. TikTok 의 내부 시스템 사양/UI 를 그대로 복제하지 않고, 우리 서비스에 맞는 형태로 추출/재해석합니다.

---

## 0. TikTok Backstage 코스 전체 구조 (확인된 부분)

### 1장: TikTok LIVE 비즈니스 준비 (신규 에이전시 부트캠프 Ver.2)
| 섹션 | 부 | 핵심 내용 |
|---|---|---|
| 1.1 에이전시 관리 | 1부: 팀 구조 | 에이전시 내 역할 (오너/매니저/스태프 등 다중 권한) |
| | 2부: 백스테이지 기능 | Backstage 메뉴 구성, 데이터 흐름 |
| 1.2 비즈니스 이해 | 1부: 틱톡이란/트래픽 로직 | 기본 유입/콘텐츠 구조 |
| | 2부: 수익 모델 / 손익 교육 | 다이아몬드 → 기프트, 시청자 충전, 크리에이터 분배 50%~5.7% |
| | 3부: 운영 정책/거버넌스/헬스 스코어 | 멀티 계정 규칙, 자금 부정 사용, 트라이얼 |
| | 4부: 에이전시 수수료 및 보상 제도 | Junior/Senior 구분, 의무 작업 (육성/매출/활성화) |
| 1.3 크리에이터 영업 | 1부: 공식 계정 만들기 | TikTok 비즈니스 계정 → Backstage 연결 |
| | 2부: 짧은 동영상 모집 기능 사용법 | RoW 가이드-3 |
| 1.4 크리에이터 관리 | 1부: 기본 방송 시작 기능 이해 | 계정명/아이콘/조명/소품, 자기소개 10~20초, 시청자 선물 심리 |
| | 2부: 기본 데이터 이해 | **핵심 지표 6가지** (다이아몬드/라이브 평가/유효 평가/활성/유효 활성/신규) |

### 2장: 본격 LIVE 비즈니스 성장기
| 섹션 | 부 |
|---|---|
| 2.1 비즈니스 이해 | 1부 다이아 증가 / 2부 팔로워 증가 / 3부 트래픽-플레어 카드/프로모션 / 4부 기본 활동 이해 |
| 2.2 크리에이터 영입 | 1부 QR 코드 스카우트 / 2부 짧은 동영상 모집 |
| 2.3 크리에이터 관리 | 1부 기본 교육 / 2부 펜/후원자 관리 |
| 2.4 크리에이터 활성화 | 1부 방송 콘텐츠 교육 / 2부 라이브 방송 이해 / 3부 트래픽 / 4부 기본 활동 이해 |

### 3장: 에이전시 비즈니스 향상기 (Road to Graduation)
| 섹션 | 부 |
|---|---|
| 3.1 크리에이터 영입 | 에이전트 영입 권한 부여, 공식 계정 영입, 특성값 살리기로 모집 |
| 3.2 크리에이터 관리 | 펜/후원자 관리 심화 |
| 3.3 크리에이터 활성화 | 우수 라이브 크리에이터 모집의 5대 오해 / 1단계 프로필 정의 / 2단계 모집 채널 (LinkedIn/Trust/Glassdoor) / 3단계 인터뷰 절차 최적화 |

### 별도 트랙: Bootcamp (라이브 백스테이지 기능 소개)
| 섹션 | 핵심 |
|---|---|
| **3장: 기본 크리에이터 모집 가이드** | 3.1 공식 계정 안내 / 3.2 크리에이터 조회 / 3.3 **IM (인스턴트 메시지) 스카우트** + **메시지 템플릿** / 3.4 라이브 모집 / 3.5 QR 코드 모집 / 3.6 짧은 동영상 모집 |
| **5장: 크리에이터 LIVE 퍼포먼스 향상** | 5.1 **에이전시 주도 활동 기능 (셀프 캠페인 이벤트)** / 5.2 **라이브 캘린더로 모니터링** / 5.3 **에이전시 프로모션 쿠폰 사용법** / 5.4 폭죽 카드 기능 가이드 |
| 정산 (1.2) | 정산 정책, 정산 프로세스 가이드, 송장 보내기, 정산 디테일, 환불 |

---

## 1. 핵심 비즈니스 모델 (학습 결과)

### 1.1 에이전시 보상 구조 (Backstage 1.2 - 4부)

```
크리에이터 ── 받은 다이아몬드 ──> 에이전시 매출 측정
   │
   ├─ 시청자: 앱 내 충전 → 기프트 발송
   ├─ 크리에이터: 50% ~ 5.7% 분배 받음 (등급별)
   └─ 에이전시: Fee policy 에 따라 매월 수수료 받음
```

**에이전시 등급 (Tier):**
| 등급 | 조건 |
|---|---|
| **신규** (New) | 계약 후 6개월 이내, 전월 다이아 500만 ↓ |
| **주니어** (Junior) | 계약 후 6개월 이상, 전월 다이아 500만 ↓ |
| **시니어** (Senior) ⭐ | 전월 다이아 500만 ↑ |

**의무 작업 (반드시 지켜야 하는 작업의 종류):**
| 과제명 | 주의사항 | 내용 |
|---|---|---|
| 유키 크리에이터 육성 과제 | 주기 크리에이터당 = 150,000 다이아 이하 | 육성 |
| 매출 과제 (신규/주니어 대상) | 무조건 월 500만 다이아 획득 | 매출 |
| 크리에이터 활성화 작업 | 15만 다이아 이상 크리에이터 대상, 당월 7일 15시간 완료 | 활성화 |

### 1.2 핵심 데이터 지표 6가지 (Backstage 1.4 - 2부)

| 지표 | 정의 |
|---|---|
| **다이아몬드** | 모든 라이브 크리에이터가 받은 다이아몬드 총합 (게스트 방송 다이아 미포함) |
| **라이브 평가** | 라이브 진행 크리에이터 수 ÷ 에이전시 소속 총 라이브 크리에이터 수 |
| **유효한 라이브 평가** | 1시간 넘게 라이브 진행 크리에이터 수 ÷ 총 라이브 크리에이터 수 |
| **활성 라이브 크리에이터** | 라이브 진행 크리에이터 수 (탈퇴/게스트 전용 제외) |
| **유효한 활성 크리에이터** | 1시간 넘게 라이브 진행한 크리에이터 수 |
| **새 라이브 크리에이터** | 매니지먼트 관계가 오늘 시작되는 크리에이터 수 (탈퇴 제외) |

---

## 2. 우리 서비스(ur-live) 와의 갭 — 영역별 비교

### 2.1 ✅ 이미 구현됨 / 부분 구현
| TikTok Backstage 기능 | 우리 구현 상태 | 위치 |
|---|---|---|
| 에이전시 가입 (status pending → 승인) | ✅ | `agencies.status`, `/admin/agencies` |
| 셀러(크리에이터) 초대 | ✅ → ✨ 심사 추가 (G 코스 P0 #1) | `agency.routes.ts:1208~`, `admin-agency-approvals.routes.ts` |
| 에이전시 매출 통계 | ✅ | `/api/agency/stats`, `stats/batch`, `stats/daily` |
| **실시간 매출** | ✨ KV 캐시 30초 (G 코스 P0 #2) | `/api/agency/stats/realtime` |
| 정산 신청/이력 | ✅ + ✨ 자동 정산 cron (P0 #3) | `agency_settlements`, `cron/agency-auto-settle.ts` |
| **에이전시 캠페인** | ✨ 신규 (P0 #4) | `agency_campaigns`, `agency-campaigns.routes.ts` |
| **인센티브 규칙 엔진** | ✨ 신규 (P0 #5) | `agency_incentive_rules`, `agency-incentives.routes.ts` |
| 셀러 KPI 목표 | ✅ | `agency_seller_targets` (월별 매출) |
| 셀러 PIN (민감 액션) | ✅ | `agency-pin.routes.ts` |

### 2.2 ❌ 아직 없음 / 약함 — TikTok 에서 학습한 것

#### A. **에이전시 등급 시스템** (Tier: New/Junior/Senior)
- **TikTok 모델**: 계약 기간 + 전월 다이아 기준으로 자동 등급 계산. 등급별 fee policy 다름.
- **우리 모델**: `agencies.commission_rate` 단일 % 만 있음. 등급 개념 없음.
- **접목 제안**:
  ```sql
  ALTER TABLE agencies ADD COLUMN tier TEXT DEFAULT 'new';  -- new/junior/senior
  ALTER TABLE agencies ADD COLUMN tier_evaluated_at DATETIME;
  ```
  - cron 매월 1일: 가입일 + 전월 매출(다이아 환산) 기준으로 tier 자동 갱신
  - 기준값: 우리 통화는 "딜포인트". `500만 다이아 ≈ 500만 딜` 로 1:1 매핑
  - tier 별로 commission_rate 또는 인센티브율 자동 적용

#### B. **의무 작업 (Mandatory KPI Tasks)**
- **TikTok 모델**: 에이전시가 매월 반드시 완료해야 하는 작업 3종 (육성/매출/활성화). 미달 시 등급 강등 또는 보상 제외.
- **우리 모델**: 없음. 에이전시는 자율 운영.
- **접목 제안**:
  ```sql
  CREATE TABLE agency_monthly_tasks (
    id INTEGER PK,
    agency_id INTEGER,
    month TEXT,        -- YYYY-MM
    task_type TEXT,    -- 'creator_growth' | 'sales_quota' | 'activation'
    target_value INTEGER,
    actual_value INTEGER DEFAULT 0,
    status TEXT,       -- 'in_progress' | 'completed' | 'failed'
    completed_at DATETIME
  );
  ```
  - cron 매일 actual_value 갱신 (집계)
  - 매월 1일: 전월 결과로 status 결정 → 등급 평가 입력값으로 사용

#### C. **메시지 템플릿 (IM Scout)** — Bootcamp 3.3 IM 모집
- **TikTok 모델**: 에이전시가 인스턴트 메시지 템플릿을 만들어 셀러 영입에 사용. 변수 치환 (이름, 채널 등). 에이전트들이 공유.
- **우리 모델**: 없음. 영입은 카톡 / 이메일 외부.
- **접목 제안**:
  ```sql
  CREATE TABLE agency_message_templates (
    id INTEGER PK,
    agency_id INTEGER,
    name TEXT,
    body TEXT,           -- {{seller_name}}, {{agency_name}} 변수 지원
    category TEXT,       -- 'invite' | 'follow_up' | 'reactivation'
    is_active INTEGER DEFAULT 1,
    created_by INTEGER,
    usage_count INTEGER DEFAULT 0
  );
  ```
  - 알림톡 (이미 있는 `alimtalk` feature) 와 결합하면 1차 영업 자동화 가능
  - 사용 횟수 추적으로 어떤 템플릿이 효과적인지 분석

#### D. **라이브 캘린더** (Live Calendar) — Bootcamp 5.2
- **TikTok 모델**: 에이전시가 소속 크리에이터의 라이브 일정을 한눈에 보고, 진행 중인 라이브 빠르게 찾기, 시기적절한 가이드 제공.
- **우리 모델**: `/api/agency/schedule` 페이지는 있지만 단순 목록.
- **접목 제안**:
  - 기존 `/api/agency/streams` + `/api/agency/schedule` 확장
  - 캘린더 뷰 (월별/주별), 진행 중인 라이브 실시간 위치 표시
  - 라이브 중 에이전트가 메모 / 가이드 남기는 기능
  ```sql
  CREATE TABLE agency_live_notes (
    id INTEGER PK,
    agency_id INTEGER,
    live_stream_id INTEGER,
    agent_user_id INTEGER,
    note TEXT,
    type TEXT,        -- 'guidance' | 'issue' | 'highlight'
    created_at DATETIME
  );
  ```

#### E. **에이전트 권한 (Multi-role)** — Backstage 1.1, 3.1
- **TikTok 모델**: 에이전시 안에 **오너 / 매니저 / 에이전트 / 그룹 관리자** 등 다중 역할. 각자 권한 다름 (영입권/조회권/정산권).
- **우리 모델**: 에이전시 = 1개 계정. 다중 사용자 지원 없음.
- **접목 제안**:
  ```sql
  CREATE TABLE agency_members (
    id INTEGER PK,
    agency_id INTEGER,
    user_email TEXT,
    role TEXT,        -- 'owner' | 'manager' | 'agent' | 'analyst'
    permissions TEXT, -- JSON: {invite:true, settle:false, ...}
    invited_at DATETIME,
    joined_at DATETIME,
    is_active INTEGER DEFAULT 1
  );
  ```
  - JWT 에 `role` 추가 → 권한별 미들웨어 분기
  - 정산/계약 변경은 owner 만, 영입은 agent/manager, 조회는 analyst

#### F. **프로모션 쿠폰 (Promotion Coupon)** — Bootcamp 5.3
- **TikTok 모델**: 에이전시 → 크리에이터 → 시청자 로 이어지는 3단계 쿠폰 배포. 에이전트 권한 부여.
- **우리 모델**: `coupons` feature 는 있지만 셀러→유저 단방향. 에이전시 → 셀러 단계 없음.
- **접목 제안**:
  - `coupons.distributed_by_agency_id` 컬럼 추가
  - 에이전시가 쿠폰 만들어 → 본인 소속 셀러에게 배포 → 셀러가 시청자에게 발급
  - 에이전시가 쿠폰 사용 효과 (매출/사용율) 분석

#### G. **신청 평가 (Application Evaluation)** — Backstage 3.1
- **TikTok 모델**: 크리에이터가 영입 신청 후, 라이브 시청 시작부터 30일 동안 진행 시간 평가. 자격 미달 시 자동 거절.
- **우리 모델**: 신청 평가 자동화 없음. 어드민이 수동 승인 (P0 #1 추가).
- **접목 제안**:
  - `agency_creator_approvals.evaluated_at` 컬럼 추가
  - cron: 신청 후 30일 동안의 셀러 활동 (라이브 시간/매출/팔로워 증가율) 자동 평가
  - 임계치 미달 시 status='auto_rejected' 처리 + 알림

#### H. **시청자 선물 심리 / 자기소개 가이드** — Backstage 1.4
- **TikTok 모델**: 셀러 교육 콘텐츠 (자기소개 10~20초, 시청자 선물 보낼 때 4가지 심리, 라이브 환경 인덕/배경/조명).
- **우리 모델**: 셀러 가이드는 있지만 일반론. 라이브 운영 노하우 부족.
- **접목 제안**:
  - `guide-seed.ts` 의 `seller` 가이드에 다음 섹션 추가:
    - "라이브 첫 30초 - 자기소개 템플릿"
    - "시청자가 후원하는 4가지 심리"
    - "라이브 환경 세팅 (조명/배경/카메라 각도)"
    - "라이브 종료 후 후속 조치"

#### I. **라이브 백스테이지 정산 송장 (Settlement Invoice)** — Bootcamp 1.2
- **TikTok 모델**: 매월 정산 명세서를 PDF/문서로 받음. 에이전시가 검토 → 송장(invoice) 제출 → 결제 받음.
- **우리 모델**: 정산 신청은 있지만 송장 발행/검토 흐름 없음.
- **접목 제안**:
  - `agency_settlements` 에 `invoice_url`, `invoice_uploaded_at`, `invoice_verified_at` 추가
  - 어드민: 정산 명세서 PDF 자동 생성 (HTML → PDF)
  - 에이전시: 송장 PDF 업로드 (R2)
  - 어드민: 송장 검토 → 결제 처리

---

## 3. 우선순위 추천 (TikTok Backstage 학습 기준 재조정)

### 🔴 P1 (빠르게 영향 큼)
1. **에이전시 등급 시스템 (Tier: New/Junior/Senior)** — 등급별 차등 인센티브의 기반
2. **메시지 템플릿 + 알림톡 통합** — 이미 인프라 있음, 영업 효율 ↑
3. **에이전트 권한 (Multi-role)** — 에이전시 운영 규모화 필수
4. **신청 자동 평가 (30일)** — 어드민 부담 감소

### 🟡 P2 (중기)
5. **의무 작업 (Mandatory KPI Tasks)** — 에이전시 활성도 강제 (등급 평가 입력값)
6. **라이브 캘린더 + 에이전트 노트** — 캠페인 기능과 자연 연결
7. **에이전시 → 셀러 → 시청자 쿠폰** — 마케팅 캐스케이드

### 🟢 P3 (장기)
8. **셀러 운영 가이드 콘텐츠 강화** — 자기소개 템플릿, 시청자 심리, 환경 세팅
9. **정산 송장 흐름** — PDF 자동 생성 + R2 업로드 + 검증 워크플로우
10. **AI 추천** — 영입 후보 스코어링 (TikTok 처럼 데이터 기반)

---

## 4. 즉시 적용 가능한 설계 결정 (작은 변화)

### A. **commission_rate → tier 기반으로 개편**
현재 `agencies.commission_rate` 가 단일 % 인 구조 → tier 별 base % + 인센티브 규칙으로 분리.

```ts
// 기존: agency.commission_rate = 2.0
// 신규:
const TIER_BASE_RATE = { new: 1.5, junior: 2.0, senior: 2.5 };
const baseRate = TIER_BASE_RATE[agency.tier] ?? 2.0;
const finalRate = baseRate + bonusFromIncentiveRule;
```

**호환성**: `commission_rate` 는 deprecated 처리 (기존 값 유지하되 신규 계산은 tier 기반).

### B. **G 코스에서 만든 인센티브 엔진의 metric 확장**
현재 metric: `sales/rating/streams/orders/viewers` → TikTok 등급 평가 metric 추가:
- `effective_streams` (1시간 넘게 진행한 라이브 수)
- `mandatory_tasks_completed` (의무 작업 완료 수)
- `new_creators_30d` (30일 내 영입한 신규 크리에이터)

### C. **셀러 가이드 (`guide-seed.ts`) 에 TikTok 콘텐츠 반영**
- "라이브 첫 30초 자기소개" 섹션 신규
- "시청자 후원 심리 4가지" 섹션 신규
- "라이브 환경 체크리스트 (인덕/배경/조명/카메라)" 섹션 신규

---

## 5. 다음에 받으면 좋을 이미지 (분석 정밀도 향상)

이미 받은 영역 외에 추가로 보고 싶은 화면:
1. **2장 2.1 다이아 증가 / 팔로워 증가** — 트래픽 부스팅 메커니즘 상세
2. **2.4 크리에이터 활성화 - 4부 기본 활동 이해** — 활동 의무화 로직
3. **3장 3.2 펜/후원자 관리** — 시청자 충성도 관리 기능
4. **5.1 에이전시 셀프 캠페인 이벤트** 의 구체 설정 화면 (KPI/리워드 입력 폼)
5. **5.4 폭죽 카드 (Firework Card)** — 무엇인지, 우리에게 매핑 가능한가
6. **데이터 분석 화면 (Backstage Data Analytics)** — 어떤 차트/필터/내보내기 제공하는지

---

## 6. 변경 이력

| 일자 | 내용 | 추가된 영역 |
|---|---|---|
| 2026-04-26 (1차) | 초기 작성. 받은 17장 종합 | 1~5장 부트캠프 + Bootcamp 3장 모집 가이드 + 5장 퍼포먼스 향상 + 정산 |
