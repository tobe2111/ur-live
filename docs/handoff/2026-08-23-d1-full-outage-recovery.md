# 2026-08-23 — 본진 D1 이 꽉 차서 쓰기가 멈췄다 · 중복 460MB 회수로 복구

## 0. 다음 세션의 첫 액션

**백업이 실제로 도는지 확인한다.** 매시 50분에 cron 이 돌므로 그 직후:

```bash
curl -sS "https://live.ur-team.com/api/admin/cron-heartbeats" -H "Authorization: Bearer $TOK" -H "User-Agent: $UA" \
  | python3 -c "import sys,json;print([r for r in (json.load(sys.stdin).get('data') or []) if 'backup' in (r.get('name') or '')])"
curl -sS "https://live.ur-team.com/api/admin/tools/backup-chunk" -H "Authorization: Bearer $TOK" -H "User-Agent: $UA"
```
- `cron_hb:d1-backup-chunked` 가 생기고 `backup_chunk:ads` 커서가 전진하면 정상.
- ⚠️ **수동 실행 엔드포인트는 아직 못 쓴다** — `POST /api/admin/tools/backup-chunk` 가 `reason:"no-binding"` 을
  돌려준다. 어드민 API 는 **Pages** 에서 도는데 `BACKUP_BUCKET` 이 **Worker 에만** 붙어 있다.
  (Pages production 의 R2 는 `MEDIA_BUCKET` 뿐, preview 는 아예 없음 — 실측.) 대표 조치 필요(§3).

## 1. 무슨 일이 있었나

**본진 DB(`toss-live-commerce-db`)가 무료 한도 500MB 를 꽉 채워 새 행 INSERT 가 실패했다.**

증상이 흩어져 보였지만 원인은 하나였다:
- 어드민 로그인 429 — 문구가 *"요청을 처리할 수 없습니다"*(rate-limit 문구인 *"요청이 너무 많습니다"* 가
  **아니다**). `rateLimit` 미들웨어가 `rate_limit_attempts` **INSERT 에 실패**하고, 로그인은 auth-sensitive 라
  **fail-closed** 로 429 를 준다. 실측: 그 테이블에 **102분간 새 행 0건**.
- cron 하트비트 129개 전멸 — `INSERT OR REPLACE`(= delete+insert)라 새 페이지가 필요하다.
- 반면 **기존 행 in-place UPDATE 는 계속 성공**했다(lane 커서 등). 그래서 "DB 는 멀쩡해 보이는데
  일부만 죽은" 그림이 나왔다.

⇒ **소비자 주문·회원가입도 같은 방식으로 실패할 수 있는 상태였다.**

## 2. 조치 (대표 승인 "먼저 유실분 옮기고 지우기")

본진에 남아 있던 **유어애즈 중복 테이블 7개**가 용량의 대부분이었다(이미 유어애즈 DB 로 이관 완료된 것).

1. **유실분 먼저 이동** — 개수 차이가 아니라 **고유키 집합 전수 대조**로 "본진에만 있는 행"을 찾았다:
   `store_prospects 7,286` · `ad_influencer_leads 317` · `ad_company_leads 21` · `ad_discovery_keywords 6`
   = **7,630행**을 유어애즈 DB 로 복사(`INSERT OR IGNORE`, id 제외해 PK 충돌 회피).
2. **재대조** — 6개 테이블 전부 **"본진에만 = 0"** 확인.
3. **DROP TABLE 7개**.

```
본진 499,998,720 (100.00%)  →  39,981,056 (8.00%)      -460MB
```

검증: 소비자 `urdeal.kr/` 200 · 동네딜 API 200 · 어드민 로그인 200 · **하트비트 130개 즉시 복구**
(age 0~5분) · 어드민 유어애즈 통계 355,119건 정상(= 라우터가 새 DB 를 읽는다).

## 3. 대표 조치 대기

**ur-live *Pages* 에 R2 바인딩 `BACKUP_BUCKET → ur-live-backups` 추가**(production + preview).
- 없으면 수동 백업 실행이 `no-binding` 으로 끝난다. cron(Worker)만으로는 **회차당 ~1만 행**이라
  유어애즈 75만 행 스냅샷 1벌에 **3일 이상** 걸린다. 수동 경로가 열리면 그날 안에 끝낼 수 있다.
- 경로: Workers & Pages → **ur-live**(도메인에 `urdeal.kr` 이 보이는 쪽) → Settings →
  `Choose Environment` → Bindings → Add → **R2 bucket** / 이름 `BACKUP_BUCKET` / 버킷 `ur-live-backups`.

## 4. 🩸 이번에 틀렸던 판단

1. **"본진 쓰기가 막혔다"를 어제 한 번 제기했다가 스스로 철회했는데, 그게 맞았다.**
   철회한 근거가 `platform_settings` 에 최근 쓰기가 있다는 것이었는데, 그건 **기존 행 UPDATE** 였다.
   ⇒ **"쓰기가 되는가"를 UPDATE 로 판정하면 안 된다. 새 행 INSERT 로 판정해야 한다.**
2. **429 를 rate limit 으로 단정했다.** 에러 **문구**가 두 원인을 구분해 주는데 안 읽었다.
   같은 상태코드라도 본문이 다르다 — 코드만 보고 원인을 정하지 말 것.
3. **"D1 은 지워도 file_size 가 안 줄 수 있다"고 적어 뒀는데 틀렸다.** 실측: DROP 직후
   **100% → 8.00%** 로 즉시 반영됐다. (2026-08-22 자 인계의 "판정 불가" 항목은 이걸로 해소.)
4. `--only` 로 좁게 돌린 가드 검증은 **내가 만든 구조 결함을 못 잡는다**(병합이 만든 빈 항목을
   CI 가 잡았다). 병합 후에는 **구조 검증 + 이름 집합 대조**를 먼저.
5. 어드민 로그인은 **IP당 5회/5분**이다. 회차마다 로그인하는 스크립트를 쓰면 스스로 잠근다 — 토큰 재사용.

## 5. 지금 상태

```
본진      39,981,056 (8.00%)      유어애즈  ~460,000,000 (~92%)
계정 D1   7개 / 10개 한도          총량     ~0.5GB / 5GB
```
⚠️ **유어애즈 DB 는 여전히 92%** 다. 같은 벽이 그쪽에 온다. 처방은 §3 백업 확보 후
**종류별 DB 분리**(라우터에 줄 추가 + D1 3개 생성 — 남은 슬롯 3개와 정확히 일치).
