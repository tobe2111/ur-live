# 2026-11-18 라이브 텔레메트리 2차 — 대표 "개선할 것 더 찾아줘"

조사: 읽기 전용 에이전트(CF GraphQL d1QueriesAdaptiveGroups · D1 SELECT/EXPLAIN · 하트비트). 아래는 코드로 검증한 뒤 고친 것.

## 고친 것
| # | 무엇 | 라이브 근거 | 위치 |
|---|---|---|---|
| 1 | `schemaPresent` 메모 키를 `dbKey(DB)` 로 | 메모 뒤에도 하루 1,961회 × 1,116줄(세션 객체로 불러 매번 빗나감) | `worker/utils/d1-read-replica.ts` |
| 2 | 상품 목록 색인 `(is_active, created_at DESC, id DESC)` | findAll 1회 4,823줄 + 임시 정렬 · 하루 약 330만 줄 | `repair-schema/index-repairs.ts` |
| 3 | 유어애즈 연결 유저 조회 `INDEXED BY` | 연결 0건인데 하루 14 × 58.8만 줄(라이브 EXPLAIN 으로 강제 색인 사용 확인) | `marketing/api/lead-claim.ts` |
| 4 | 이미지 건강 모니터 — 브라우저 전용 호스트 제외 · 못 닿음 ≠ 깨짐 · 5개씩 · 결과 하트비트 | 한 회 181초 · 결과 없음 · 표본 거의 전부 giftishow(해외 차단) | `cron/image-health-monitor.ts` · `utils/rehost-image.ts` `imageLoadStatus` |
| 5 | Resend 웹훅 비밀값 없음 503 → 202(무시) | 01:58 5xx_path + 5xx_spike 경보 · 발신 쪽 재시도 | `notifications/api/resend-webhook.routes.ts` |
| 6 | 도매 재입고 알림 cron 삭제 | 매시 하루 6.2만 줄 · notified=0 · 죽은 링크 | `scheduled.ts` · `cron-beat-retirement.ts`(beat-retire-ok) |

## 하지 않은 것(이유)
- **유어애즈 이름 병합 색인**(하루 2,690만 줄): 58만 행 표에 식 색인을 더하면 크롤 쓰기마다 색인 쓰기가 붙는다. 읽기는 요금제 포함량 안이라 비용 문제가 아니다 → 쓰기 비용과 맞바꿀 근거 부족. 하려면 유어애즈 처리량 판단과 같이.
- **교환권 카테고리 KV TTL 300초 연장 · 피드 캐시 24행 touch · cache-prewarm 정렬** — 로딩 잠금 파일(`public-utility.routes.ts`·`group-buy-public.routes.ts`·`cache-prewarm.ts`). 대표 승인 필요.
- **하트비트 쓰기 샘플링**(메인 쓰기 38%): 경보 판정의 기반이라 잘못 줄이면 침묵 감시가 깨진다 — 별도 설계.
- 데모 이름·사진 cron(매시 결과 0) — 데모 데이터 운영 판단이라 두었다.

## 판정(배포 뒤)
- 메인 D1 `sqlite_master` 확인 쿼리 호출 수가 하루 1,961 → 수십으로.
- `EXPLAIN QUERY PLAN` findAll → `idx_products_active_created`, TEMP B-TREE 없음.
- 하트비트 `image-health-monitor` 결과 `checked=… unreachable=… browser_only=…` 가 찍히는지, ms 가 181초 → 수 초.

## 이어서 ③ — 주요 화면 실측 + 대표 승인 2건 (머지 #2433)
- 폰 4G 실측(FCP / LCP): 홈 1.10~1.52 / 1.17~1.60 · 이용권 0.56~1.40 / 1.42~2.30 · 상세 0.74~0.89 / 0.92~1.13 · 지도 0.68~1.45 / 2.73~3.33 · 검색 0.64~0.90 / 0.73~1.05 · 숙소 1.13~1.54 / 1.19~1.56.
- 지도 LCP 는 카카오 지도 바탕 타일(bg_tile.png) — 지도 자체 로딩이라 손댈 여지 작음.
- 홈·숙소만 `MAIN:kv-hit`(전역 KV) → **지역 복사본 1분**([UNLOCK_LOADING], `ssr-payload.ts`). 교환권 카테고리 **KV 6시간 + KT 동기화 때 삭제**([UNLOCK_LOADING]). 근거 `docs/locks/loading/2026-11-18-kv-edge-copy-and-voucher-cat-ttl.md`.
- 🩸 틀릴 뻔한 것: 직접 만든 측정 스크립트가 영어 브라우저라 `locale-en` 을 받는 것을 "한국 화면에 영어 번역을 받는다"로 읽을 뻔했다 — 오늘(11-18)부터 화면 언어가 폰 언어를 따른다. 공식 `measure-live-vitals.mjs` 는 이미 `ko-KR`.
