## 스키마 DDL 비용이 어느 예산에도 안 잡혀 있었다 — `partial:true` 조기 사망의 실체

### 🔴 발견 (라이브 진단 메시지를 끝까지 따라간 결과)
인허가 레인 진단에 `⛔ 플랫폼 요청한도 도달` 이 떠 있는데 **우리 계수기는 예산 40 중 일부만 썼다고 말한다**.
둘이 어긋난다는 건 **세지 않는 비용이 있다**는 뜻이다. 찾았다:

| 함수 | DDL 수 | 세어졌나 |
|---|---|---|
| `ensureCompanySchema` | **35** (순수 DDL 21 + 1회성 마이그레이션 14) | ❌ |
| `ensureProspectSchema` | **9** | ❌ |
| `ensureCompanyKeywords` | 시드 배치 | ✅ (07-29 앞서 수리) |

무료 플랜 인보케이션 천장이 50~60 인데 **콜드 격리에서 보강 레인은 예산 60 을 세면서 실제로는 60+35=95** 를 쓴다.
⇒ 라운드가 **잡을 예외도 없이** 중간에 죽는다 → `partial:true` · `limit_hit:false` · `crash` 없음.
같은 이유로 `nextSubreqCap` 에 도달을 못 해 학습 상한이 **172 까지 한 방향 드리프트**했다.
인허가 레인은 40+9=49 로 매번 천장에 닿아 **`total_saved: 0`** 이었다.

> 이 세션 앞부분에서 나는 `partial:true` 의 원인을 "추측하지 않겠다"고 미뤄뒀다. 이제 추측이 아니라
> **숫자로 설명된다**: 세지 않은 35 가 천장의 절반이 넘는다.

### ✅ 수리
- `ensureCompanySchema` / `ensureProspectSchema` 가 **실비를 반환**하고, 예산을 만드는 모든 레인이 차감한다
  (enrich-lane · company-collect 수집/스윕 · localdata 수집/백필 · prospect-enrich · storeinfo · mx-sweep).
- 🛡️ 신규 가드 `check-schema-cost-counted.mjs`(audit-gate 68 · verify strict).
  **공허성 실측**: 처음엔 "파일 어딘가에 `budget.left -=` 가 있으면 통과" 였는데, 대부분 레인이 `spendD1` 로
  그 패턴을 이미 갖고 있어 되돌려도 통과했다 → **ensure 호출 그 줄에서 반환값을 받았는지**만 보도록 좁혔고,
  좁히자마자 내가 놓친 진짜 위반(`runLocalDataBackfill`)을 하나 더 잡았다.

### 🔜 다음 최적화 (측정 끝, 구현만 남음)
`ensureCompanySchema` 의 **순수 DDL 21개를 `runDdlOnce`(ads-schema-guard) 로 옮기면** 따뜻한 DB 는
체크섬 SELECT **1회**로 끝난다 → 콜드 인보케이션마다 **20 을 되찾는다**(예산 60 기준 33%).
인플루언서 레인(`ensureInfluencerSchema`)·시트 미러가 **이미 이 헬퍼를 쓴다** — 검증된 패턴이다.
⚠️ 주의: 그 함수의 뒷부분 `ads_company_key_v2` 블록은 DDL 이 아니라 1회성 데이터 마이그레이션이니
**옮기지 말고 그대로 둘 것**(이미 플래그로 스킵된다).

### ▶️ 다음 세션 첫 액션
1. 배포 후 `ads_enrich_rollup` 의 `중단/라운드` — 스키마 실비를 뺀 뒤 **중단 비율이 떨어져야 한다**.
   안 떨어지면 남은 원인이 따로 있다(그때 다시 파라).
2. 인허가 `diag.error` 에서 `⛔ 플랫폼 요청한도` 가 사라졌는지. 남아 있으면 예산을 더 낮춰야 한다.
3. `ads_subreq_cap_company_enrich` 가 172 → 60 이하로 수렴하는지(이제 라운드가 끝까지 가므로 하향이 걸린다).
