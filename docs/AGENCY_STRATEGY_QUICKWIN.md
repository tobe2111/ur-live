# 유어딜 — TikTok Backstage 학습 기반 전략 (Quick Win)

> 작성일: 2026-04-26
> 참조: `docs/AGENCY_BACKSTAGE_LEARNING.md` (학습 노트)
> 대상: 즉시 ~ 2주 내 적용 가능한 항목만. 중장기는 별도 문서로 분리 예정.

---

## 0. 핵심 인사이트 (한 줄 요약)

TikTok Backstage 의 본질은 **"에이전시가 크리에이터를 자동으로 발굴/육성/평가/보상"** 하는 운영 자동화 플랫폼입니다.
유어딜은 현재 "에이전시 = 대시보드" 수준에 머물러 있어, **자동화 루프 5개**(영입·평가·정산·인센티브·등급)를 단계적으로 갖추는 것이 전략 목표입니다.

이미 G 코스에서 P0 5개를 구현했으므로, 다음 단계는 **운영 루프를 닫는 것** — 즉, 에이전시가 의식적으로 손대지 않아도 데이터가 흐르고, 자동으로 평가/보상되는 구조.

---

## 1. Quick Win 7개 (이번 주 내 적용 가능)

### Q1. **에이전시 등급제 (Tier: New / Junior / Senior)** 🔥
**왜?** TikTok 의 핵심 운영 메커니즘. 등급별 기대치/보상 차등화로 활성도 동기 부여.

**구현 (소요 4~6h):**
- migration 0212: `agencies.tier`, `tier_evaluated_at` 컬럼 추가
- cron 매월 1일: 가입일 + 전월 매출(딜) 기준 자동 평가
  - **신규**: 가입 6개월 이내 + 전월 매출 미달
  - **주니어**: 6개월 이상 + 전월 매출 미달
  - **시니어**: 전월 매출 기준선 ↑
- `commission_rate` 와 별개로 `tier` 보존 (호환성 유지)
- 어드민 UI: `/admin/agencies` 에 tier 컬럼 + 수동 override 옵션

**기준선 설정 (제안):**
- 시니어 컷오프: **월 500만 딜** (TikTok 의 500만 다이아 기준 그대로 채택)
- 6개월 → 한국 기준 90일/180일 등으로 조정 가능

**예상 효과:** 에이전시 활성도 향상의 동기 부여 메커니즘. 인센티브 엔진 (G3) 의 입력값으로 활용.

---

### Q2. **메시지 템플릿 + 알림톡 통합** 🔥
**왜?** TikTok 의 IM Scout 핵심. 우리는 알림톡 인프라가 이미 있는데 활용 안 됨.

**구현 (소요 3~4h):**
```sql
CREATE TABLE agency_message_templates (
  id INTEGER PRIMARY KEY,
  agency_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  body TEXT NOT NULL,         -- {{seller_name}}, {{agency_name}} 변수
  category TEXT,              -- 'invite' | 'follow_up' | 'reactivation'
  is_active INTEGER DEFAULT 1,
  usage_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**API:**
- `GET/POST/PATCH/DELETE /api/agency/message-templates`
- `POST /api/agency/message-templates/:id/send` — 셀러 ID 배열 받아서 알림톡 일괄 발송
- 변수 치환: `{{seller_name}}`, `{{agency_name}}`, `{{commission_rate}}` 등

**예상 효과:** 영입 효율 +30%. 카톡으로 일일이 메시지 작성하던 것 → 템플릿 1클릭.

---

### Q3. **셀러 신청 자동 평가 (30일 활동 트래킹)** 🔥
**왜?** TikTok 의 신청 평가 모델 (라이브 시청 시작 후 30일 라이브 진행 시간 평가). 어드민 부담 감소.

**구현 (소요 3h):**
- `agency_creator_approvals` 에 `evaluated_at`, `evaluation_score`, `auto_decision` 컬럼 추가
- cron 일일: pending 신청 중 30일 경과한 것 자동 평가
  - 라이브 진행 시간 ≥ 5시간 + 매출 ≥ 10만원 → auto_approve 추천
  - 활동 0 → auto_reject 추천
  - 어드민이 최종 승인 (자동 처리는 X — 추천만)

**예상 효과:** 어드민의 신청 검토 시간 50% 감소. 품질 게이트 강화.

---

### Q4. **셀러 가이드 콘텐츠 강화 (TikTok 학습 반영)** 🔥
**왜?** TikTok 1.4 의 "라이브 환경 / 자기소개 / 시청자 심리" 콘텐츠는 우리 셀러에게도 가치.

**구현 (소요 2h):**
`src/features/guides/api/guide-seed.ts` 의 `seller` 가이드에 추가:
1. **"라이브 첫 30초 — 자기소개 템플릿"** (10~20초 자기소개 4종 예시)
2. **"시청자가 후원하는 4가지 심리"** (콘텐츠 인정 / 응원 / 자기 만족 / 거리감 좁히기)
3. **"라이브 환경 체크리스트"** (인덕/배경/조명/카메라)
4. **"라이브 종료 후 후속 조치"** (시청자 인사, SNS 후속, 데이터 리뷰)

**예상 효과:** 신규 셀러 첫 방송 성공률 ↑. 매출 평균 ↑.

---

### Q5. **에이전시 핵심 지표 6가지 대시보드 카드**
**왜?** TikTok 1.4 의 핵심 지표 6가지는 이미 우리 데이터로 계산 가능. 표시만 하면 됨.

**구현 (소요 4h):**
- `/api/agency/stats/kpi` 신규 엔드포인트
- 반환:
  ```json
  {
    "diamond_total": 1234567,           // 받은 딜 총합 (=다이아몬드 등가)
    "live_rate": 0.45,                  // 라이브 진행 셀러 / 총 소속 셀러
    "effective_live_rate": 0.30,        // 1시간 이상 라이브 진행 셀러 / 총
    "active_creators": 15,              // 라이브 진행 셀러 수 (탈퇴/게스트 제외)
    "effective_active_creators": 10,    // 1시간 이상 진행 셀러 수
    "new_creators_today": 2             // 오늘 영입한 셀러
  }
  ```
- 에이전시 대시보드 (`/agency`) 에 6장 카드로 표시

**예상 효과:** 에이전시가 매일 봐야 하는 지표 명확화. KPI 의식 ↑.

---

### Q6. **의무 작업 (Mandatory KPI Tasks) — 표시만 우선**
**왜?** TikTok 의 매월 의무 작업 3종 (육성/매출/활성화). 강제 페널티는 후속이지만, **표시는 즉시 가능**.

**구현 (소요 3h):**
- migration 0213: `agency_monthly_tasks` 테이블
- cron 매일: 자동 actual_value 갱신
- 에이전시 대시보드에 **3가지 진행률 바** 표시:
  - "이번 달 매출 진행률: 320만 / 500만 (64%)"
  - "이번 달 신규 영입: 3 / 5 명"
  - "이번 달 활성 라이브 셀러: 8 / 10 명"
- **페널티 없음 (1차)** — 표시만으로도 행동 유도. 후속 PR 에서 등급 평가에 반영.

---

### Q7. **에이전시 → 셀러 쿠폰 캐스케이드 (1단계)**
**왜?** TikTok 5.3 의 프로모션 쿠폰 3단 흐름. 우리는 1단(셀러→유저) 만 있음.

**구현 (소요 4h):**
- `coupons` 테이블에 `distributed_by_agency_id` 컬럼 추가
- 새 API: `POST /api/agency/coupons/distribute`
  - body: `{ template_coupon_id, seller_ids[], quantity_per_seller }`
  - 효과: 에이전시가 만든 템플릿 쿠폰을 N개 셀러에게 배포 → 각 셀러가 시청자에게 발급
- 에이전시는 사용율 / 매출 효과 분석 가능

---

## 2. 우선순위 (실행 순서)

| # | 항목 | 소요 | 의존성 | 즉시 가치 |
|---|---|---|---|---|
| **Q4** | 가이드 콘텐츠 | 2h | 없음 | 즉시 셀러 행동 변화 |
| **Q1** | 에이전시 등급제 | 4~6h | 없음 | 인센티브 엔진(G3) 와 결합 |
| **Q5** | 6가지 KPI 대시보드 | 4h | 없음 | 가시성 ↑ |
| **Q3** | 신청 자동 평가 | 3h | G P0 #1 (있음) | 어드민 부담 ↓ |
| **Q2** | 메시지 템플릿 + 알림톡 | 3~4h | alimtalk feature (있음) | 영입 효율 ↑ |
| **Q6** | 의무 작업 표시 | 3h | Q5 와 함께 | 행동 유도 |
| **Q7** | 쿠폰 캐스케이드 | 4h | coupons feature (있음) | 마케팅 도구 |

**합계:** 23~26시간. **3~4일 풀 작업** 분량.

---

## 3. 즉시 시작 가능한 항목 — 추천 순서

### 오늘 할 수 있는 것 (안전, 위험 0)
1. **Q4 — 가이드 콘텐츠 강화** (2h, `guide-seed.ts` 만 수정)
2. **Q5 — KPI 대시보드 API** (4h, 기존 stats 확장)

### 내일 할 수 있는 것
3. **Q1 — 등급제** (6h, migration + cron + UI)
4. **Q3 — 자동 평가** (3h, cron 추가)

### 후속
5. **Q2 — 메시지 템플릿** (4h)
6. **Q6 — 의무 작업** (3h, Q5 의 확장)
7. **Q7 — 쿠폰 캐스케이드** (4h)

---

## 4. 중기 / 장기 (별도 문서로 분리)

이 문서는 Quick Win 만 다룹니다. 다음 항목은 별도 문서:

**중기 (M)**:
- 에이전트 권한 (Multi-role: owner/manager/agent/analyst) — JWT 구조 변경 큼
- 라이브 캘린더 + 에이전트 노트 — 캘린더 UI 큰 컴포넌트
- 정산 송장 (PDF 생성 + R2 업로드 + 검증)

**장기 (L)**:
- AI 영입 후보 스코어링 — 데이터 + ML
- 라이브 실시간 모니터링 (WebSocket / Durable Object)
- TikTok 의 Trial 프로그램 (수습 기간 제도)

---

## 5. 위험 / 주의사항

- **Q1 등급제**: 기존 `commission_rate` 와 충돌 안 나도록 신규 컬럼 추가 (호환성 유지). 기존 데이터 마이그레이션 시 모두 'new' 로 시작.
- **Q3 자동 평가**: 어드민 최종 승인 필수 (자동 거절은 추천만).
- **Q6 의무 작업**: 1차에는 페널티 없이 **표시만**. 페널티 도입은 사용자 합의 후.
- **Q2 알림톡**: 발송 비용 발생. rate limit + 일일 한도 필수.

---

## 6. 시작 신호

진행 의사 있으시면 **Q4 (가이드 콘텐츠)** 부터 시작하겠습니다 — 가장 안전하고 즉시 효과 보입니다. 아니면 다른 우선순위로 시작해도 됩니다.

작업 시작 시 commit 별로 끊어서 진행 (한 항목 = 한 commit, stream timeout 회피).
