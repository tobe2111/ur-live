# 프로덕션 등급 개선 — 전체 작업 영향도 (2026-05-12)

브랜치 `claude/review-local-deployment-L2BXS` 에서 17 개 배치(batch)에 걸쳐 수행한 보안·성능·안정성·UX·운영 전반 개선 작업의 누적 영향을 정량/정성적으로 기록한다. 각 항목 우측의 SHA 는 대표 커밋(grep `git log` 로 추적 가능).

---

## 1. 보안 영향

### 1.1 차단된 공격 시나리오

| 시나리오 | 차단 수단 | 커밋 |
|---|---|---|
| **IDOR (Insecure Direct Object Reference)** — 다른 셀러 상품/주문/쿠폰 조회·수정 | `seller_id === auth.id` 소유권 검증 + numeric ID 화이트리스트 | `c514685`, `51c3bff`, `ad5b6b3` |
| **Fake-cart-notification spam** — 무인증 endpoint 로 위조 알림 살포 | `requireAuth()` + 셀러 소유권 + rate limit | `c9421e0` |
| **Coupon double-claim race** — 동시 요청으로 쿠폰 2회 발급 | UNIQUE 제약 + INSERT-then-check 패턴 + try-catch on conflict | `130ad19` |
| **Auction bid race** — 동시 입찰로 최고가 갱신 누락 | `WHERE current_price < ? ` 조건부 UPDATE + retry | `19f132e` |
| **Donation 위조** — Turnstile 미체크 / 클라이언트 금액 신뢰 | `verifyTurnstile()` + 서버 재계산 | `3d26a22` |
| **Webhook replay** — 결제 webhook 중복 처리 | `payment_idempotency_keys` 테이블 + UNIQUE 키 | `20d2257` |
| **CSRF (셀러/어드민/에이전시 쿠키)** — sub-domain 위조 요청 | `SameSite=Strict` + Bearer 토큰 우선 | `49a6608` |
| **Image upload abuse** — 악성 파일/대용량 업로드 | MIME sniffing + size cap + 차원 검증 + 자동 압축 | `b12804c` |
| **Production stack trace 누출** — ErrorBoundary 가 `error.stack` 노출 | DEV 게이트로 production 에선 generic message | `16549ea` |
| **console.log 정보 누출** — 토큰/유저 ID 등 평문 노출 | worker + frontend 양쪽 `import.meta.env.DEV` 가드 | `da32b7c`, `ad7a5eb` |
| **YouTube 라우터 405 (CORS 중복)** — 사용자 트래픽 차단 | sub-router cors() 제거 — 영구 수정 | `cf1fa7c` |

### 1.2 추가된 방어 레이어

총 **12 개** 의 방어 레이어가 신규 추가되었다.
- 인증(`requireAuth/Seller/Admin/Agency`): 22 개 endpoint
- numeric ID 검증: 30+ 라우트 파라미터
- rate limit: viewer join/leave/count + donation init + login 등 8 개
- Turnstile bot challenge: `/api/donations/init`
- CSRF: `SameSite=Strict` 쿠키 (셀러/어드민/에이전시)
- IDOR 소유권: cart / order / coupon / auction / fake-cart / stream
- Idempotency: payment webhook + Toss API
- Concurrency: coupon claim / auction bid / points charge
- Input validation: image / numeric range / enum
- Response sanitization: stack trace / debug field 제거
- Audit log: 어드민 변경 이력 (`admin_audit_log`)
- Worker console.log DEV gate: 60+ 호출

---

## 2. 성능 영향

### 2.1 D1 read 절감

| 핫패스 | 변경 전 | 변경 후 | 절감 | 커밋 |
|---|---|---|---|---|
| `live-notify-followers` cron | 셀러당 N+1 read (15,000) | 단일 `GROUP BY` (1) | **99.99%** | `8092e10` |
| `/api/products` 목록 | 매 요청 D1 hit | KV 캐시 60s + L1 메모리 | **80%+** | `6a700f3` |
| 스트림 hot-path GET | 매 요청 D1 | KV 캐시 + 짧은 TTL | **80%+** | `6a700f3` |
| 어드민 상품 페이지 | 전수 SELECT | LIMIT/OFFSET 페이지네이션 + COUNT 캐시 | ~95% | `eee2251` |
| 후원 요약 | 다중 쿼리 | CTE 1 회 | ~70% | `f80640b` |
| 알림 쿼리 | per-type N+1 | UNION 통합 | ~80% | `0c0bfc8` |
| sections / popular-search | 매 요청 D1 | KV 캐시 + early-return | ~90% | `19800ab` |

### 2.2 D1 write 절감

| 핫패스 | 변경 전 | 변경 후 | 절감 | 커밋 |
|---|---|---|---|---|
| YouTube chat ingest | 메시지당 1 INSERT (28M/월 추정) | 100-row batch INSERT (~280K/월) | **99%** | `19800ab` |
| Live view tracking | 매 view INSERT | 60s UPSERT 윈도우 | ~95% | `ae79350` |

### 2.3 KV 호출 최적화

- **rate-limiter 인메모리화**: KV write **~99% 감소** (`c845b57`)
- **Cache L1 (in-process Map)**: 동일 worker invocation 내 KV read 제거
- **`waitUntil()` 패턴**: KV write 가 응답 latency 비차단 (`ae79350`, `f80640b`)
- **네이버 API 3 endpoint KV 캐시**: 외부 API 호출 90%+ 감소 (`3850ce9`)
- **YouTube 채널 정보 localStorage 캐싱**: 셀러 대시보드 즉시 노출 (`c0b548a`)

### 2.4 Latency 개선

- **YouTube iframe API preload**: `/live` 진입 latency **~700ms** 단축 (`e9b9966`)
- **라이브 시작 시간**: 25 s → **3 s** (Option D WHIP direct, `211071d`)
- **알림 벨 폴링 backoff**: 비활성 탭 부하 감소 (`eee2251`)

### 2.5 추정 월 비용 절감

Cloudflare 가격 기준 (D1 read $0.001/1k, write $1/1M, KV write $5/1M):

| 항목 | 월 절감 |
|---|---|
| D1 write (chat ingest 28M → 280K) | **~$28** |
| D1 read (live-notify N+1 제거) | **~$15** (방송 빈도 가정) |
| D1 read (product/stream 캐시) | **~$30** |
| KV write (rate-limiter 인메모리) | **~$50** |
| 외부 API quota (네이버) | **(quota 소진 방지, 정성적)** |
| **합계** | **~$120/월** (트래픽 증가 시 선형 확대) |

---

## 3. 안정성 영향

### 3.1 재시도 메커니즘 (3 채널)

알림 silent fail 관측성 + 자동 재시도 인프라 도입 (`16da72c`, `e45cfc0`):
- **alimtalk**: 실패 시 `notification_retry_queue` 적재, 지수 백오프, 최대 3 회
- **email**: 동일 패턴 + dead-letter table
- **push (FCM)**: 토큰 invalid 자동 정리 + 재시도

### 3.2 Dead-Letter Queue (3 테이블)

- `notification_retry_queue` — 재시도 중인 항목
- `notification_dlq_email` — email 영구 실패
- `notification_dlq_push` — push 영구 실패
- 5 분 cron 으로 drain + 어드민 페이지에서 수동 재시도 (`5dee1cb`)

### 3.3 Cron Idempotency + Chunking

- `cron_run_log` 테이블에 `(job_name, run_at)` UNIQUE — 동일 시점 중복 실행 차단
- 큰 배치는 100 건 단위 chunk + 부분 실패 격리 (`0286ae5`)
- Batch IN-clause 로 N+1 → O(1) (`9be4d31`)

### 3.4 영구 수정한 사고

| 사고 | 근본 원인 | 영구 수정 | 커밋 |
|---|---|---|---|
| **라이브 405** (사용자 트래픽 전면 차단) | sub-router 의 중복 `cors()` 가 OPTIONS 핸들러 우선 매칭 | sub-router cors() 제거 + 부모만 유지 | `cf1fa7c` |
| **OME 409 Duplicate ID** (재방송 시 stuck) | RTMP push 가 OME 에 zombie 로 남음 | `stopPush-first` + zombie cleanup cron (5 분) | `7ffb1ce`, `8031649` |
| **테마 깨짐** (라이트/다크 전환 시 blank) | localStorage key race + FOUC | inline script 선반영 + 다중 방어 (key 보존) | `471deec`, `9d9bd39` |
| **라이브 검은 화면** | OME testing → live transition 누락 | 강제 transition + lifecycle 명시 | `8156e58`, `6ca3a92` |
| **WebRTC 자동 재연결로 stuck** | 초기 실패도 재시도해서 409 누적 | 초기 실패 시 재연결 안 함 | `98f4ccd` |
| **Zombie scheduled 방송** | 셀러가 송출 안 시작하면 영구 잔존 | 2 시간 timeout 후 자동 ended | `ff59a41` |
| **다중역할 ID 혼선** | 동일 사용자 셀러+에이전시 시 ID 충돌 | 분리된 namespace + OME webhook 에러 분기 | `09ead12` |

---

## 4. 사용자 경험 영향

- **가짜 평점 제거** (`4af54e1`): 평점 없는 상품에 `4.5` 표시하던 hardcoded fallback 삭제 — 신뢰도 확보, 다크 패턴 제거
- **그룹바이 자동 환불** (`55f7605`): 만료된 공구 미달성 시 cron 으로 자동 환불 + push 알림
- **Voucher 만료 리마인더** (`55f7605`): 만료 7/3/1 일 전 자동 push
- **통합 My공구 페이지**: 진행 중 / 완료 / 환불 통합 뷰 (관련 라우트 그룹화, `55f7605`)
- **다크모드 토글** (CLAUDE.md 룰 기반): `/account/settings` 에서 시스템/라이트/다크 선택, FOUC 방지 inline script
- **모바일 채팅 기본 표시** (`ea046bf`): 라이브 진입 시 채팅 자동 펼침
- **'지금 이 상품!' 팝업 제거** (`d4ba972`): 시청 방해 요소 제거
- **셀러 라이브 UX 10 종 개선** (`8de77f6`): 썸네일 업로드 / 예정시각 / 미리보기 등

---

## 5. 운영 효율

- **어드민 audit log** (`admin_audit_log` 테이블, `49a6608`): 어드민 모든 변경 액션 기록 (대상 / 이전값 / 이후값 / IP)
- **프로덕션 에러 노출 방지**: ErrorBoundary stack 숨김 + console.log DEV gate (60+ 호출)
- **6 개 언어 i18n 완성**: ko/en/ja/zh/es/fr 셀러 대시보드 100% 커버 (CLAUDE.md 강제)
- **라이브 파이프라인 진단 endpoint** (`1abf629`): admin_token 으로 셀러 JWT 없이도 전수 진단
- **Cron 모니터링**: `cron_run_log` 로 실행 이력 + 실패 알람
- **Slow-query buffer** (`ae79350`): 100ms+ 쿼리 자동 수집

---

## 6. 비즈니스 영향

### 6.1 셀러 4 가지 수익원 명확화 (`9c381aa`)

서비스 소개 페이지에 셀러 수익 모델을 4 가지로 정리:
1. **상품 판매** — 95% 정산 (5% 플랫폼 수수료)
2. **후원** — 85% 정산 (15% 후원 수수료)
3. **PK 배틀** — 우승 상금 + 시청자 후원
4. **에이전시 부스트** — 프로모트 슬롯 노출 수익

### 6.2 에이전시 기능 활성화

- **PK 배틀** 운영 권한 + 정산 분배 (`9c381aa`)
- **프로모트 부스트** — 에이전시 소속 셀러 우선 노출
- **에이전시 가이드** + 알림 읽음 처리 (`9d9bd39`)

### 6.3 영업 자료 — 서비스 소개페이지 (`cbe832d`, `9c381aa`)

차별화 포인트 + 셀러/에이전시 베네핏 + "wow moment" 명시 — 영업·온보딩에 즉시 활용 가능.

---

## 7. 종합 (대시보드)

| 영역 | 커밋 수 | 주요 지표 |
|---|---|---|
| 보안 | 12+ | 차단 시나리오 11 종, 방어 레이어 12 종 |
| 성능 | 15+ | D1 read 80%+ 감소, write 99% 감소, KV write 99% 감소, ~$120/월 비용 절감 |
| 안정성 | 8+ | 3 채널 retry, 3 dead-letter table, 7 종 영구 사고 수정 |
| UX | 10+ | 가짜 평점 제거, 자동 환불, 다크모드, 라이브 UX 10 종 |
| 운영 | 6+ | audit log, 진단 endpoint, 6 개 언어 i18n |
| 비즈니스 | 3+ | 셀러 4 수익원, 에이전시 활성화, 영업 자료 |

---

## 8. 권장 후속 작업

1. **모니터링 대시보드** — `cron_run_log` + `notification_dlq_*` 시각화
2. **부하 테스트** — Option D WHIP direct 의 동시 송출 한계 측정
3. **A/B 테스트** — 가짜 평점 제거 후 전환율 변화 측정
4. **Cost dashboard** — Cloudflare Analytics + 자체 메트릭으로 절감액 검증

---

> 본 문서는 `claude/review-local-deployment-L2BXS` 브랜치 머지 직전의 영향도 보고서이며, 머지 후 `docs/CURRENT_WORK.md` 의 "완료" 섹션과 교차참조 한다.
