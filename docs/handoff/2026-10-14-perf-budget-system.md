# 2026-10-14 — 성능 예산 체계(대기업 수준 · 기능이 늘어나도 유지)

대표 지시: *"대기업 수준의 인프라여야 해. 단발적으로 줄이는게 아니라 최적화가 대기업 수준이어야하고 앞으로 추가로 기능 구현이 되어도 최적화된 상태여야"*

## 한 것
1. **화면별 첫 화면 무게 래칫** — `scripts/check-surface-budgets.mjs` + `scripts/surface-budgets.json`
   - 화면마다 [엔트리 + CSS + 화면 봉투] brotli KB. 늘면(+1.5) 실패 · 줄었는데(−3) 안 잠그면 실패 · 새/사라진 화면 실패.
   - 배선: `verify.yml`(build:worker 뒤, strict) · `bundle-budget-main.yml`. 로컬 pre-push 는 제외(dist 필요 — `local-ci-parity` EXCLUDE).
   - 최초 기준(CI 더미 env 로 빌드): boot 156.0 · home 192.2 · homePc 199.2 · gbDetail 198.0 · voucherDetail 176.8 · product 191.4 · linkshop 190.9 · vouchers 183.6 · browse 178.2 · map 212.5 · urshorts 175.1
2. **실사용 SLO 일일 감시** — `src/worker/utils/vitals-slo.ts`(순수) + `src/worker/cron/vitals-slo.ts`, 슬롯 `20 0 * * *`(09:20 KST)
   - 위반·회귀를 어드민 알림 `perf_slo` 로.
3. 문서: `docs/LOADING_ARCHITECTURE.md` "📏 성능 예산 체계" + 체크리스트 7번 · CLAUDE.md 방어선 2행.

## 다음 세션 첫 액션
- 배포 다음날 09:20 KST 이후 하트비트 `cron_hb:vitals-slo` 의 out 을 본다(`GET /api/admin/cron-heartbeats`).
  `판정 0건` 이면 수집이 멎은 것, `skip:` 이면 KV 바인딩 문제.
- CI 첫 실행에서 surface-budgets 가 로컬 기준과 ±1.5KB 안인지(빌드 환경 차이). 벗어나면 CI 실측으로 `--rebaseline --reason "CI 환경 기준 정렬"`.

## 틀렸던 판단
- **cron 이 읽을 KV 가 cron 워커에 없었다** — 실사용 표본은 Pages(`ANALYTICS_KV`)가 쓰는데 cron 캐리어(wrangler.toml)엔
  그 바인딩이 없어, 그대로 배포했으면 매일 `skip:` 만 남겼을 것이다. pre-push 의 `cron-bindings` 시험이 잡았다.
  Pages 바인딩 id 를 CF API(읽기)로 확인해 `wrangler.toml` 에 선언(18a53635…). ⚠️ wrangler.toml 변경이라 머지 시 cron 워커 재배포가 일어난다. 다만 SLO 테스트의 첫 픽스처가 '절대 변화 하한' 을 못 갈랐다(비율에서 먼저 걸림) — 주입이 잡아 INP 픽스처로 보강.

## 남은 것
- JS 다이어트 후보: CSS 28.8KB br · app-utils 19.7KB br.
- package.json 의 axios·i18next 의존성 제거(코드는 이미 안 씀).
