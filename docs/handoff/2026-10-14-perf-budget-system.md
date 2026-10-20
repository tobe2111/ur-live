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


---

## 2부 — 대시보드·실행 비용 (대표 *"대시보드랑 실행비용도 최적화 해줘"*)

### 한 것
1. **대시보드·마이 무게 예산** — `dash:my`·`dash:admin`·`dash:agency` 를 `check-surface-budgets` 에 편입.
   route-chunk-map 밖이라 그동안 아무도 안 쟀다. Vite 매니페스트 정적 폐쇄로 잰다. 진입점 SSOT `scripts/dashboard-surfaces.mjs`.
2. **실행 비용 래칫** — `scripts/check-exec-cost.mjs` + 하네스 `visual-preview.mjs --cpu`(V8 커버리지 · CPU 4배 감속 · `CPU_RESULT`).
   손님 7 + 대시보드 3 화면. 판정은 '실행된 JS' 하나(결정적 — 반복 0.3KB 안). 시간·TBT 는 출력만(2배 흔들림).
   배선: verify(빌드 뒤 chromium 설치 → 실행) · bundle-budget-main · 로컬 pre-push 제외(EXCLUDE 사유).
   에이전시 콘솔 스텁: `scripts/preview-seeds/agency-console.json`. 하네스에 `--auth=admin` 추가.
3. **처방 — cn()/tailwind-merge 가 지도 봉투에 끌려가 있던 것**: `app-ui-utils` 를 묶음기 보호 목록에 + clsx·tailwind-merge 규칙.
   마이 303.8→278.5 · 어드민 320.6→296.0 · 에이전시 329.1→305.1 KB br, 실행된 JS 각 −18KB. 손님 화면 ±0.2.
4. **처방 — 번역 JSON 을 `JSON.parse` 문자열로**(`json.stringify: true`). 파싱 5.6→3.0ms(데스크톱 실측, 폰은 몇 배).

### 다음 세션 첫 액션
- 이 PR 의 첫 CI 에서 `First-screen execution cost budget` 이 로컬 기준(scripts/exec-cost-baseline.json)과 ±4KB 안인지.
  CI 크로미움 판이 달라 어긋나면: CI 로그의 값으로 `node scripts/check-exec-cost.mjs --rebaseline --reason "CI 크로미움 기준 정렬"`.
- 대시보드 무게의 남은 큰 덩어리: `app-components`(26.6KB — 손님·대시보드 공용 봉투) · `lz-gbDetail`(15.4KB, 어드민·에이전시가 끌고 옴) ·
  `lucide`(아이콘 214개 봉투 10.4KB) · `embla` 6.5 · 마이의 `capacitor` 5KB(판매 구역 경유).

### 틀렸던 판단 (버린 길 — 다시 파지 말 것)
- **아이콘만 화면별 봉투로 떼기** → 공용 봉투(app-components)가 남은 `lucide` 봉투를 계속 정적으로 끌고 와서 +1.6KB 로 **나빠졌다.**
- **대시보드·목록 밖 화면을 묶음기 '사용자' 로 세기(extraUsers + 목록 밖 `x` 라벨)** → 대시보드 −27~33KB 지만 손님 화면이
  파일 수 증가·압축 손실로 +1.3~1.6KB(홈·상세). 손님 우선이라 버렸다. 문턱(20KB)·라이브러리 한정 변형도 재 봤다 — 손님은 지켰지만 대시보드 이득 0.
  ⇒ 대시보드를 더 줄이려면 묶음기가 아니라 **공용 봉투 app-components 를 쓰는 쪽끼리 쪼개는** 별도 설계가 필요하다.
- 로컬 `prerender:main` 은 `window is not defined` 로 실패한다 — **이 변경 전 코드에서도 똑같다**(build 가 graceful skip 처리). 회귀 아님.

### 남은 것
- 워커(서버) 실행 비용 게이트는 없다 — 워커 번들 예산 + TTFB SLO 뿐.
- 홈(모바일) TBT 가 4배 감속에서 ~1초(긴 작업 9~11개) — 실행 비용 래칫이 늘어나는 것은 막지만 줄이는 건 별도 작업.
