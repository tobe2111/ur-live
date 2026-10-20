# Service Level Agreement (SLA) — 유어딜 (ur-live)

> 버전: 1.0 | 작성: 2026-05-12 | 검토 주기: 분기별

---

## 1. 가용성 (Availability)

| 서비스 계층 | 목표 가용성 | 허용 월간 다운타임 |
|---|---|---|
| **결제 경로** (checkout, payment, donations) | **99.9%** | 43분/월 |
| **라이브 방송 API** (streams, WebRTC 시그널링) | **99.5%** | 3.6시간/월 |
| **쇼핑 API** (products, browse, search) | **99.5%** | 3.6시간/월 |
| **어드민/셀러 대시보드** | **99.0%** | 7.2시간/월 |
| **비핵심 기능** (쇼츠 피드, 리뷰, 추천) | **98.0%** | 14.4시간/월 |

> 계획된 유지보수(Cloudflare Pages 배포 < 5분)는 다운타임에 포함하지 않음.

---

## 2. 응답 시간 (Latency)

| 엔드포인트 | p50 목표 | p95 목표 | p99 목표 |
|---|---|---|---|
| `GET /api/health` | < 10ms | < 50ms | < 100ms |
| `GET /api/products` (KV 캐시 히트) | < 30ms | < 100ms | < 200ms |
| `GET /api/products` (KV 미스) | < 100ms | < 300ms | < 500ms |
| `GET /api/streams/live` | < 50ms | < 200ms | < 400ms |
| `POST /api/payments/confirm` | < 500ms | < 2s | < 5s |
| `POST /api/donations/confirm` | < 500ms | < 2s | < 5s |
| `GET /` (홈페이지 HTML) | < 100ms | < 500ms | < 1s |

> Toss 결제 API 응답 시간(약 300ms~1.5s)이 지배적 — 자체 처리만 측정 시 p95 < 200ms

---

## 3. 에러율 (Error Rate)

| 경로 | 허용 5xx 비율 |
|---|---|
| 결제/후원 | < **0.1%** |
| 인증 (login) | < **0.5%** |
| 기타 API | < **1.0%** |

> 4xx (잘못된 요청, 인증 실패)는 에러율에 포함하지 않음.

---

## 4. 처리량 (Throughput)

| 시나리오 | 목표 동시 사용자 |
|---|---|
| 정상 운영 | 500 동시 사용자 |
| 피크 (인기 라이브 방송) | 2,000 동시 시청자 |
| 최대 처리량 (긴급 모드 활성화 시) | 5,000 요청/분 |

> Cloudflare Workers: 글로벌 엣지 CDN + 자동 스케일. 실제 한계는 D1 D쿼리 처리량에 의존.

---

## 5. 복구 목표 (Recovery Objectives)

| 지표 | 목표 |
|---|---|
| **RTO** (복구 시간 목표) | **< 30분** — 배포 롤백 포함 |
| **RPO** (복구 시점 목표) | **< 1시간** — D1 자동 백업 (Cloudflare 관리) |
| 장애 감지 → 알림 | **< 5분** — Discord 알림 (error-rate-monitor) |
| 장애 감지 → 대응 시작 | **< 15분** — 1인 운영 기준 |

---

## 6. SLA 측정 방법

### 자동 모니터링
- **`/api/health`** — Cloudflare Workers Analytics의 error rate 확인
- **`error-rate-monitor.ts`** — 1분 윈도우 5xx 스파이크 감지 → Discord 알림
- **`/api/health/detailed`** — D1 연결, KV 연결, 외부 API 상태 점검

### 수동 측정 (월간)
```bash
# p95 응답 시간 측정 (k6 설치 필요)
k6 run tests/load/critical-paths.js --env BASE_URL=https://live.ur-team.com

# 에러율 확인 (Cloudflare Dashboard → Analytics → Workers)
# Workers & Pages → ur-live → Analytics → Error Rate
```

### SLA 위반 기준
- 결제 경로 5분 이상 다운 → P0 인시던트
- p95 latency 30분 이상 2s 초과 → P1 인시던트
- 에러율 1% 이상 10분 지속 → P1 인시던트

---

## 7. 긴급 조치 (Emergency Procedures)

트래픽 폭증 또는 장애 시 `docs/EMERGENCY_PLAYBOOK.md` 참조:
1. Feature Flag 비핵심 기능 Kill-Switch
2. Cloudflare WAF Rate Limiting 강화
3. 배포 롤백: `git revert HEAD && git push` → 자동 재배포

---

## 8. 제외 항목 (Exclusions)

다음은 SLA 계산에서 제외됩니다:
- Cloudflare 전체 네트워크 장애 (CF Status Page 확인)
- Toss 결제 시스템 장애 (서킷 브레이커로 503 반환, SLA 미포함)
- YouTube API 할당량 소진 (quota tracker로 사전 감지)
- 계획된 배포 (< 5분, 사전 공지)
- 불가항력 (자연재해, 법적 조치 등)

---

## 9. 현재 기술 부채 및 SLA 영향

| 부채 항목 | SLA 위험도 | 영향 |
|---|---|---|
| DB 마이그레이션 CI 없음 | 🔴 | 배포 후 스키마 불일치 시 결제 실패 가능 |
| 스테이징 환경 없음 | 🟡 | 프로덕션 직접 배포 → 롤백 시간 포함 |
| E2E 테스트 없음 | 🟡 | 회귀 발견 지연 → MTTR 증가 |
| 로드 테스트 없음 | 🟡 | 피크 처리량 미검증 |

> 자세한 부채 목록: `TECHNICAL_DEBT.md`
