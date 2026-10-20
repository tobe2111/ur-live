## 🔑 2026-07-28 — 🚨 **CF API 토큰 public 레포 유출**(대표 조치 필요) + 🌙 자동 정비 무음 정지 근본수리 + ur-live-global 진단

### 🚨 ① 보안 — `.env.deploy` 에 **살아있는 CLOUDFLARE_API_TOKEN** 이 커밋돼 있었다 (public 레포)
`1a835daec`(#737)에 들어갔고, 이 세션이 **그 토큰으로 실제 계정 워커 설정을 읽는 데 성공**했다(= 유효·활성).
그 토큰이면 ur-ads 의 **모든 환경변수가 평문으로 읽힌다**(전부 `plain_text` 타입): `JWT_SECRET`(세션·광고주·어드민
토큰 위조 가능) · `KAKAO_REST_API_KEY` · `GSHEETS_SA_KEY`(구글 서비스계정 개인키) · `NAVER_SEARCHAD_SECRET_KEY` ·
`YOUTUBE_API_KEY` · `NEIS_API_KEY` · `PUBLIC_DATA_SERVICE_KEY` · `WORK24_API_KEY`.
- **코드 조치(이 커밋)**: 파일 tracking 제거 + `.gitignore` 명시 예외 + **가드 2건 수리** —
  ⓐ `check-no-secrets.sh` 의 CF/JWT 패턴이 **따옴표를 필수**로 요구해 dotenv 형식(`KEY=value`)을 통째로 놓쳤다
  ⓑ 같은 패턴의 `grep -v "…\$\{"` 가 BRE 문법 오류(`Unmatched \{`)라 **grep 이 실패 → 패턴 3·4 가 무음으로 죽어 있었다**
  → 따옴표 선택 + `-E` 전환 + **dotenv 파일 자체를 커밋 금지**(패턴 0) 신설. 재현 테스트로 검출 확인.
- **⏳ 대표 조치(코드로 해결 불가)**: ① CF 토큰 폐기·재발급 ② `JWT_SECRET` 회전 ③ 나머지 키 회전
  ④ ur-ads 변수들을 plaintext → **Secret 타입** 전환(현재는 대시보드/API 로 전부 열람 가능).
  ⚠️ git history 에 남아 있으므로 **회전 전까지는 계속 유출 상태**다.

#### ▶️ 다음 세션 착수 목록 (2026-07-28 말 기준 — 우선순위 순)

**1. ur-ads 인라인 스케줄 7곳에 하트비트·실패통지** ← 가장 먼저
`src/worker-ads/index.ts` 의 `scheduled()` 진입점은 **18개**인데, #828 에서 덮은 건 `kick()` 경유 **11개**뿐이다.
나머지 **7개는 인라인 `ctx.waitUntil((async () => { try … catch { /* fail-soft */ } })())`** 형태라
여전히 (a) 실패를 삼켜 `cron_failures`·어드민 벨에 도달하지 않고 (b) 실행 기록도 안 남는다.
→ `kick()` 안의 `adsBeat(name, ok, ms, err)` 를 그대로 재사용해 각 블록을 감싸면 된다.
⚠️ **이 환경(원격 세션)은 `node_modules` 부재로 tsc/vitest 를 못 돌린다.** cron 진입점은 깨지면
   "조용히 안 도는" 쪽이라, **타입 검사가 가능한 상태에서** 하는 것을 권한다(그래서 07-28 에 보류했다).

**2. ur-live(Pages) 평문 31개 → Secret 전환** — 대표가 값을 비밀번호 관리자에 보관했다고 확인하면 즉시 실행.
절차는 ur-ads 에서 성공한 그대로(스냅샷 → no-op 카나리 PATCH → 32/32·D1·SELF byte-동일 확인 → 실제 변경 → 스모크).

**3. (선택) CF 토큰 목록 2페이지 5개 정리** — 안 쓰는 토큰은 삭제(토큰 하나가 공격면 하나).
**4. (선택) 어드민에 `cf_api_token` 편집 UI** — 없어서 세션이 라이브 인프라를 진단할 수 없다.

**⛔ 코드로 못 잡는 영역(가드 미보유 — `AUDIT_INVARIANTS.md`)**: 결제 금액 정확성 · 런타임 크래시 ·
외부 PG 실응답. **staging 실결제로만** 확인된다 — 코드 읽기로 대체하지 말 것.

#### ✅ 2026-07-28 마감 — 처리 결과와 **대표 결정**(다음 세션은 이걸 다시 권하지 말 것)

| 항목 | 상태 |
|---|---|
| GitHub **Secret Protection + Push Protection** | ✅ ON (대표) — 시크릿 든 push 가 **사전 차단**된다 |
| **CF API 토큰 회전** | ✅ 완료 — 유출본(`93dddc54…`) 무효 확인 3중(`verify`=Invalid / Pages 401 / 워커설정 401). **⚠️ 같은 값이 2026-03-05 ~ 07-27 약 5개월간 public 이었다**(초기 판단 "1일"은 오기였다 — 커밋별 값 대조로 정정) |
| **ur-live-global** Git 연결 해제 | ✅ 완료 (대표) — PR 체크에서 `Workers Builds: ur-live-global` 실패가 사라진 것으로 확인. 폐기 확정은 #804 |
| **Firebase 토큰 수용 경로 제거** | ✅ #806 — 아래 별도 항목 |
| 🚫 **Firebase 서비스계정 키 폐기** | **대표 결정: 하지 않음.** 근거: #806 으로 그 키로는 **우리 서비스에 로그인할 수 없게** 됐다(수용 경로 제거). 남는 노출은 GCP 프로젝트 내부 권한뿐이고 해당 프로젝트는 미사용 |
| 🚫 **Stripe 시크릿키 폐기** | **대표 결정: 하지 않음.** 글로벌 미런칭이라 현재 위험 ≈ 0 |
| ur-live(Pages) 평문 31개 → Secret | ⏸️ 미완. **우선순위 하락** — 이 값들을 읽을 수 있던 유출 토큰이 죽었다. 진행 조건: 대표가 값을 비밀번호 관리자에 보관 후 지시 |

> ⚠️ **글로벌(해외판) 오픈 시 선결**: Firebase 서비스계정 키·Stripe 키는 **열기 전에 반드시 교체**할 것.
> 지금 안전한 이유는 "안 쓰기 때문"이지 "키가 안전해서"가 아니다. 두 키 모두 git history 에 영구 잔존한다.

**private 전환 판단자료(실측)**: 무료 Actions 한도 2,000분/월. 고정비 = `uptime`(10분마다) **4,320분** + `prod-smoke`(3시간) 480분 → **uptime 을 별도 public 레포로 빼는 것이 전제**(절차: `docs/ops/uptime-external.md`).
그러고도 개발 가용분은 ~1,500분인데, 2026-07-28 실측이 **2시간에 112분**(집중 작업일)이라 월 ~27시간 개발이면 소진된다.
한도를 없애려면 self-hosted runner(분 소모 0). ⚠️ private 로 가면 **무료 Push Protection 을 잃는다**(public 전용) — 대신 오늘 만든 3중 가드가 그 역할을 한다.
**현재 결론: public 유지**(시크릿 유출은 가드로 막혔고 코드 자체는 해자가 아님). 복제 정황이 실제로 보이면 재검토.

#### 🚨 2026-07-28 12:00 UTC — **유출은 CF 토큰 1건이 아니었다** (전수 스캔 결과)
`.env.deploy` 를 계기로 **추적 파일 전수 스캔**을 돌린 결과, `archive/` 아래 **19개 `.md`/`.txt` 파일**에
실제 시크릿 자재가 **지금(HEAD)까지 추적된 채** 남아 있었다. public 레포이고 **2026-03월부터** 그 상태였다.

| 자재 | 파일 | 4/27 회전 목록에 있었나 | 판단 |
|---|---|---|---|
| **Google/Firebase 서비스계정 개인키** | `archive/secrets-redacted/*.txt` 4개 + `ACCOUNT_DATABASE_INFO`·`COMPLETE_ERROR_REPORT`·`COPY_TO_UR_LIVE_WORKING`·`ENV_VARIABLE_EXPLANATION`·`LOGIN_FUNCTIONALITY_STATUS`·`CART_401_DEBUG_FIX`·`ENV_VARS_INFINITE_LOOP_FIX`·`FIREBASE_CUSTOM_TOKEN_ERROR_FIX` | ❌ **없음** | 🔴 **아직 유효 가정 — 대표 조치 필요**(GCP 콘솔에서 해당 키 *삭제*. 한국 서비스는 카카오 전용이라 교체 없이 삭제로 끝날 가능성) |
| **Toss live 시크릿키** | `archive/PAYMENT_IMPLEMENTATION_COMPLETE.md` | ✅ 있음(`Toss live sk/ck 재발급`) | 🟢 무효화됨 |
| **Stripe 시크릿키** | `archive/MANUAL_ACTIONS_TODO.md`·`PROJECT_STATUS_2026-03-17.md`·`SECURITY_AUDIT_REPORT.md` | ❌ 없음 | 🟡 글로벌 미런칭이라 영향 낮으나 **대시보드에서 폐기 권장** |
| `JWT_SECRET`·`REFRESH_TOKEN_SECRET` | `archive/SETUP_CLOUDFLARE_SECRETS.md` | ✅ 있음 | 🟢 **무효화 실측 확인** — 유출본 해시 ≠ 라이브 값 |

**왜 안 잡혔나**: `verify.yml` 의 `Hardcoded secret 검출` 은 **`src/` 아래 `.ts/.tsx` 만** 스캔하고,
`check-no-secrets.sh` 는 **키 이름 패턴** 위주다. `.md`/`.txt` 안의 **키 본문**은 둘 다 사각지대였다.
게다가 폴더명이 `secrets-redacted/` 라 **레닥션된 것으로 보였지만 실제로는 원문 그대로**였다
(`OPERATIONS_TODO.md` 에 2026-04-26 자로 "11개 파일 시크릿 평문" 이 이미 적혀 있었는데, 파일을 옮기기만 하고
값은 지우지 않은 채 종결된 것으로 보인다).

**조치(이 커밋)**: 19개 파일 제거 + **`scripts/check-secret-material.mjs` 신설**
(확장자·경로 무관 전수 스캔 — PEM 개인키 실제 본문/Toss live/Stripe/AWS/Slack/Anthropic/OpenAI/GitHub PAT.
자리표시자·스텁은 오탐 제외, `secret-material-ok` 주석으로 예외). **verify.yml strict + audit-gate + pre-commit** 3중 배선.
검증: 삭제 후 3,804 파일 통과 · 자리표시자 오탐 0 · 합성 실키 탐지 1/1.

⚠️ **파일 제거는 절반이다** — git history·포크·스캐너 캐시에 남는다. **Firebase 서비스계정 키 폐기**가 실제 조치.

#### 🔓 ur-live(Pages) 환경변수 31개가 평문 (2026-07-28 실측)
ur-ads 는 이번에 secret 전환했으나 **메인 Pages 프로젝트가 그대로**였다 — 63개 중 **평문 31개**:
`JWT_SECRET`(현재 라이브 값) · `TURNSTILE_SECRET` · `INTERNAL_CRON_TOKEN` · `ALIGO_API_KEY` ·
`NAVER_CLIENT_SECRET` · `NAVER_SEARCHAD_SECRET_KEY` · `KT_ALPHA_TOKEN_KEY` · `VAPID_PRIVATE_KEY` ·
`NTS_API_KEY` · `UCANSIGN_API_KEY` 등.
→ **유출된 CF 토큰 하나로 전부 열람 가능**(이 세션이 실제로 `JWT_SECRET` 을 읽어 위 대조에 사용했다).
**CF 토큰 회전이 시급한 진짜 이유**가 이것이다(세션 위조 가능). Secret 전환은 대표 확인 후 진행 예정.

#### 🔐 후속 처리 (2026-07-28 10:29 UTC — 대표 지시로 실행/보류 확정)
- ✅ **④ Secret 타입 전환 완료** — 대표 승인("보안 부분은 내가 책임진다") 하에 **CF API replace-all** 로 실행.
  `plain_text` 11개(`JWT_SECRET`·`GSHEETS_SA_KEY`·`KAKAO_REST_API_KEY`·`NAVER_SEARCHAD_ACCESS_LICENSE`·
  `NAVER_SEARCHAD_SECRET_KEY`·`NAVER_SEARCH_CLIENT_ID`·`NAVER_SEARCH_CLIENT_SECRET`·`NEIS_API_KEY`·
  `PUBLIC_DATA_SERVICE_KEY`·`WORK24_API_KEY`·`YOUTUBE_API_KEY`) → `secret_text`. **API 로 값 열람 불가 확인**.
  평문 유지 19개(ADS_* 게이트·`ADS_ENRICH_BUDGET`·`NAVER_SEARCHAD_CUSTOMER_ID`·`GSHEETS_SHEET_ID`/`SA_EMAIL`·
  `SUPPLY_MAKER_COLLECT_ENABLED`) — 운영 중 눈으로 봐야 하는 값들.
  - ⚠️ **replace-all 은 바인딩 전체를 다시 쓰는 방식**(필드 1개만 틀려도 D1/SELF 소실 → 유어애즈 전면 중단).
    안전 절차: **① 스냅샷 GET → ② 아무것도 안 바꾸는 no-op PATCH(카나리) → ③ GET 재조회로 32/32·D1·SELF
    byte-동일 확인 → ④ 그 다음에만 실제 변경 → ⑤ 재검증 + 라이브 스모크.** 카나리 없이 바로 쏘지 말 것.
  - 검증: 바인딩 32→32(이름집합 동일) · `d1:DB`(`d9530ba6…`)·`service:SELF` 무변경 · 비대상 19개 무변경 ·
    라이브 `x-served-by: ur-ads` 응답 정상 · `/l/*`(D1 경로) 301 · 메인 `/api/version` 200.
  - 🚫 **개별 변수만 Secret 으로 바꾸는 API 는 없다** — `PUT /secrets` 는 같은 이름이 평문으로 있으면
    `code 10053: Binding name already in use`. 대시보드 토글 또는 위 replace-all 뿐.
- 🚫 **② `JWT_SECRET` 회전 — 대표 결정 "회전 안 함"**(2026-07-28). 악용 징후 0·노출 창 ~1일 판단.
  ⚠️ 따라서 **유출된 시크릿 값은 여전히 유효**하다(암호화는 *추가* 열람만 막을 뿐 기존 유출을 무효화 못 함).
  재고 시 **ur-ads·ur-live(Pages) 두 곳을 반드시 동시 교체**(한쪽만 바꾸면 유어애즈 로그인 즉시 파손) + 전원 재로그인.
- ⏳ **① CF 토큰 회전은 대표 진행 예정** — 재발급 후 **어드민 → 도구 → 설정의 `cf_api_token` 값도 함께 교체**할 것.
  모든 세션이 그 D1 값에서 토큰을 꺼내 쓰므로(CLAUDE.md), 갱신 누락 시 다음 세션부터 인프라 진단이 전부 막힌다.
  GitHub Actions 시크릿(`CLOUDFLARE_API_TOKEN`, 별개면 `CLOUDFLARE_D1_BACKUP_TOKEN`)도 함께 교체해야 배포가 안 깨진다.
- ⏸️ **④ `ur-live-global`/`world.ur-team.com` — 보류**(대표 지시). 레포·`wrangler.global.toml` 무접촉 유지.
  살리기로 정하면 Workers 용 재작성은 그때 진행(추가로 `VITE_REGION=GLOBAL` 등 GLOBAL 전용 변수 필요).

### ✅ ② 검색광고 고객ID — 이미 정상(바꿀 것 없었음)
대표가 08:50 UTC 대시보드에서 이미 `3228755` 로 바꿔 배포한 상태였다(코드 아님 — 워커 바인딩).
3중 실측 확인: 바인딩 값 `3228755` · 네이버 API 직접 HMAC 호출 `/keywordstool` **200**·`/ncc/campaigns` **200** ·
라이브 `/api/ads/keywords/related?seed=커피` **200 success**. 연관키워드·기회키워드 둘 다 살아났다.
(`/searchad/campaigns` 의 `NOT_CONNECTED` 는 정상 — 광고주별 개별 연결 요구 설계. 전역 폴백 허용 여부는 별도 결정.)

### 🌙 ③ 자동 정비가 07-26 이후 멈춘 이유 — **한 인보케이션에 수백~수천 D1 연산** (근본수리)
**배제 완료(실측)**: cron 등록 ✅(`0 * * * *`) · 게이트 ✅(`ADS_AUTO_MAINTENANCE_ENABLED` 미설정=ON) ·
`SELF` 바인딩 ✅ · 코드 배포 ✅(`1a835dae` 07-27 04:10 UTC + deploy-ads 전부 success) · `/__ads/maintenance` 가드 없음 ✅.
**남은 원인 = 예산**. `runNightlyMaintenance` 는 4단계를 한 인보케이션에서 돌리는데:
중복통합 그룹당 3쿼리 × 150그룹 × 4패스 + 재추출/재분류 3.6만 행 전수 페이징 = **수백~수천 D1 연산**.
Cloudflare 는 **D1 쿼리도 서브리퀘스트 한도에 넣고**(#784 확증) 이 계정 실효 상한은 학습값 **29**.
게다가 모든 D1 호출이 `.catch(() => null)` 이고 **결과 스탬프 쓰기가 맨 마지막**이라, 한도에서 죽으면
**기록조차 안 남는다** → 어드민엔 "07-26 이후 아무것도 안 돎". (스탬프가 0으로라도 찍혔어야 정상.)
**추가 발견(더 큰 낭비)**: `ensureInfluencerSchema` 가 매 인보케이션 **16 DDL**(+품질 3) 을 던진다 —
컬럼이 다 있는 지금은 전부 no-op 인데 **예산 29 중 19를 먹었다**. 정비·수집 모든 레인이 같이 손해였다.
**수리**:
- 🧱 `ads-schema-guard.ts` — DDL **체크섬 1회 조회**로 16+3 쿼리 생략(목록이 바뀌면 값이 바뀌어 자동 재적용 → 버전 bump footgun 없음)
- 🧮 `maintenance-budget.ts` — 예산 래퍼(소진 시 **DB 무접촉 no-op** + `exhausted`/`limitHit` 관측). throw 안 하는 이유는
  기존 호출부가 예외를 전부 삼켜 신호가 못 되기 때문.
- 단계당 **1 인보케이션**(fresh 예산) + **매시간 1단계 순환**(`hourUTC % 4`) — 하루 24회(단계별 6회). **새 cron 0개**
  (무료 계정 cron **5/5 소진** 상태라 추가 불가: ur-ads 1 · ur-live 3 · ur-live-cleanup-cron 1).
- 커서 신설/보존: 재추출·재분류에 id 커서 추가(둘 다 OFFSET 전수스캔이라 예산 안에선 **영원히 앞부분만** 돌았다) +
  품질 패스 포함 **"예산 소진"을 "완료"로 오판해 커서를 0 으로 리셋하던 버그** 차단(전화 스윕 커서 버그와 동일 클래스).
- ⭐ 결과 스탬프를 **예산 밖에서 항상** 기록(`ops/cap/paused/limit_hit`) + 어드민 패널 노출 → 무음 정지 구조적 불가.
- 유닛 `ads-maintenance-budget.test.ts` — 소진 후 DB 무접촉·batch 1연산·exhausted 관측·한도예외 학습·체크섬 민감도 고정.

### 🌐 ④ ur-live-global 빌드 0초 실패 — **빌드 로그는 못 봤다**(토큰 스코프 없음)
`/accounts/{acc}/builds/*` **403**(존재하지 않는 경로는 400/7003 이므로 경로가 아니라 권한). ur-ads 는 Workers Logs 도
`observability: null` 로 꺼져 있어 남은 로그도 없다. **대신 실측으로 더 중요한 걸 찾았다**:
- `ur-live-global` 은 **Pages 가 아니라 Worker**(Pages 프로젝트 목록에 없음), 2026-03-03 생성, `last_deployed_from: "dash"`,
  내용은 **대시보드 Hello World 템플릿 그대로** — 빌드가 한 번도 성공한 적 없다.
- 그런데 **Custom Domain `world.ur-team.com` 이 이 워커에 붙어 있고**(enabled), 실제로 지금 `"Hello world"` 를 서빙 중이다(실측).
- **0초 실패의 유력 원인(미확증)**: `wrangler.global.toml` 은 **Pages 설정**이다 — `pages_build_output_dir` 가 있고
  Workers 필수인 `main` 이 없다 → wrangler 가 설정 검증에서 즉시 거부(빌드 명령 시작 전 = 0초). 루트 `wrangler.toml` 을
  읽는 경우엔 `name = "ur-live"` 라 이름 불일치로 역시 즉시 실패 — **이쪽은 실패하는 게 다행**(성공했으면 2026-04-22
  "Workers 가 Custom Domain 가로채기" 사고 재현).
- **⏳ 대표 결정 필요**: 글로벌 버전을 띄울 계획이 없으면 → Git 연결 해제 + Custom Domain 회수(또는 워커 삭제)가 정답.
  띄울 거면 → `wrangler.global.toml` 을 Workers 용으로 재작성하거나 Pages 프로젝트로 재생성. **둘 다 대시보드 작업**이다.

### 💡 무료 플랜 유지 시 알아둘 천장 (대표 확정 "일단 무료")
- 인보케이션당 서브리퀘스트 **50**(학습 실효 29) — D1 쿼리 포함. Paid 는 1,000(20배).
- 계정 전체 cron **5개**(현재 5/5 — 하나도 못 늘린다). Paid 250. → 새 주기 작업은 **매시간 틱 안에서 순환**으로만 가능.
- `ur-live-cleanup-cron`(`*/5`)이 슬롯 1개를 쓰고 있다 — 아직 필요한지 점검하면 슬롯 1개 회수 가능.
- ⚠️ **ur-ads 에 KV 바인딩이 0개**(실측 2026-07-28: 바인딩 32개 = plain_text 19 + secret 11 + d1 1 + service 1).
  `RATE_LIMIT_KV` 미등록 = CLAUDE.md 규칙상 **레이트리밋 fail-OPEN(무제한 통과)** → `/api/ads/*` 가 현재 그 상태다.
  필수는 아니나(트래픽 적음) 대시보드에서 메인과 같은 namespace 연결 3분이면 끝난다. `SESSION_KV`/`CACHE_KV` 도 동일.
