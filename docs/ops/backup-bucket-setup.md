# 🗄️ `BACKUP_BUCKET` 생성·바인딩 절차 (대표 대시보드 작업)

> **대표 지시 2026-07-29**: *"백업 선행조건(BACKUP_BUCKET 생성·바인딩)은 내 대시보드 작업 목록에 추가하라 —
> 절차를 적어줄 것."*
>
> 실측 근거: `GET /api/health/env-readiness` → `infra_missing: ["BACKUP_BUCKET", ...]` (2026-07-29 production).
> 관련: `docs/design/cron-staged-ignition-plan-2026-07.md` §3 1단계의 **선행조건**.
>
> **2026-07-29 대표 승인 — 절차 그대로 진행.** 대표 인계 순서상 **③번**이다
> (① Trigger Events 원문 → ② 예치금 숫자 → **③ 버킷** → ④ 키). 바인딩 완료 통보가 오면 세션이
> `env-readiness` 로 확인하고, **트리거 추가는 1단계에서 별도로** 한다(바인딩 ≠ 백업 동작).

---

## 0. 지금 상태 한 줄

**워커의 주간 D1 백업(`d1-backup`, `0 20 * * 0`)은 트리거와 무관하게 애초에 동작할 수 없다** — R2 버킷이
바인딩돼 있지 않다. 트리거만 켜면 **매주 조용히 실패**한다(백업은 실패해도 아무도 안 아파서 제일 오래 안 들킨다).

> 🟢 **당장 백업이 0인 것은 아니다.** `.github/workflows/d1-backup.yml` 이 **매주 수요일 20:00 UTC** 에
> `wrangler d1 export` 로 받아 GitHub artifact 로 보관한다. 지금의 실질 백업선은 이쪽이다.
> 이 작업은 *"주간 1회 + 아티팩트 보존기간 의존"* 을 *"R2 상시 보관"* 으로 올리는 일이다.

---

## 1. 대시보드 작업 — 3단계

### ① R2 버킷 생성

Cloudflare 대시보드 → **R2 Object Storage** → **Create bucket**

| 항목 | 값 | 이유 |
|---|---|---|
| 이름 | `ur-live-backup` | 기존 `MEDIA_BUCKET`(미디어)과 **반드시 분리**. 백업이 공개 미디어 버킷에 섞이면 URL 노출 위험 |
| Location | Automatic (또는 APAC) | — |
| **Public access** | **비활성(기본)** ⚠️ | 🔴 **절대 공개하지 말 것.** D1 전체 덤프다 — 사용자 개인정보·주문·정산이 전부 들어 있다. `MEDIA_BUCKET` 은 `media.ur-team.com` 으로 공개돼 있으니 그 감각으로 만들지 말 것 |

### ② 워커에 바인딩

Workers & Pages → **ur-live** → Settings → **Bindings** → Add → **R2 bucket**

| 항목 | 값 |
|---|---|
| Variable name | `BACKUP_BUCKET` (대소문자 정확히) |
| R2 bucket | `ur-live-backup` |

> ⚠️ **cron 은 Pages 가 아니라 Workers 스크립트 `ur-live` 에서 돈다**(`wrangler.toml` `name = "ur-live"`).
> Pages 프로젝트 쪽에만 붙이면 `d1-backup` 은 여전히 바인딩을 못 본다.
> **양쪽 이름이 같아 헷갈리기 쉬우니 Workers 스크립트 쪽인지 확인할 것.**

### ③ 보존 정책 (선택, 권장)

버킷 → Settings → **Object lifecycle rules** → 예: 90일 후 삭제.
안 걸면 무한 누적된다(D1 덤프는 회당 수십 MB 규모까지 커진다).

---

## 2. 확인 — 바인딩됐는지 어떻게 아나

```
GET https://live.ur-team.com/api/health/env-readiness      (어드민 로그인 필요)
```
응답 `summary.infra_missing` 배열에서 **`BACKUP_BUCKET` 이 사라지면** 성공.
(현재는 `["BACKUP_BUCKET","ANALYTICS_KV","RATE_LIMITER"]`)

세션이 대신 확인할 수 있다 — 작업 후 알려주시면 즉시 조회해 보고합니다.

---

## 3. 그 다음 — 여기서 멈출 것

바인딩이 됐다고 백업이 도는 것은 **아니다.** `0 20 * * ?` 트리거가 아직 등록돼 있지 않고,
그 등록은 **단계 점화 계획 1단계**에 묶여 있다(`cron-staged-ignition-plan-2026-07.md` §3).

⚠️ 그리고 그 트리거 문자열(`0 20 * * 0`)은 **Cloudflare 가 거부하는 표기**다
(`invalid cron string [code: 10100]` — 실측). 0단계에서 표기를 먼저 풀어야 한다.

**순서**: 버킷 바인딩(이 문서) → 0단계 표기 교정 → 1단계 트리거 추가 → 다음 일요일 하트비트로 판정.

---

## 4. 같은 화면에서 함께 볼 것 (참고 — 이 작업의 일부는 아님)

`env-readiness` 가 함께 비었다고 보고한 항목들:

| 키 | 지금 영향 | 급한가 |
|---|---|---|
| **`DATA_ENCRYPTION_KEY`** | 카카오/외부 토큰 **평문 저장** | 🔴 별도 보안 트랙 — `docs/ops/token-encryption-migration.md` |
| `ANALYTICS_KV` | 분석 write skip (무해) | 🟢 낮음 |
| `RATE_LIMITER` (Durable Object) | in-memory 폴백. `RATE_LIMIT_KV` 는 정상 동작 중(실측 `x-ratelimit-limit: 300`) | 🟢 낮음 |
| `SENTRY_DSN` | 에러 모니터링 0 | 🟡 X7 |

---

## 구현 로그

- 2026-07-29 신설 — 대표 지시 *"대시보드 작업 목록에 추가 · 절차를 적어줄 것"*. 코드 변경 0.
