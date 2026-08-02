# 2026-08-02 — 재해복구가 0이던 것을 켰다 (주간 D1 백업 cron) + 인프라 시크릿 4종

머지: `#968`(문법 수정) · `#972`(슬롯 회수 + 점화) — 앞선 세션 작업은 `2026-08-01-consumer-seo-admin-ledger.md`

---

## 1. 다음 세션의 첫 액션 — **첫 백업 회차 판정** (⏰ 2026-08-03 05:00 KST)

첫 회차는 **일요일 20:00 UTC = 월요일 05:00 KST**. 아래 두 개가 다 있어야 성공이다.

```bash
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
BODY=$(python3 -c "import json,os;print(json.dumps({'email':os.environ['URDEAL_ADMIN_EMAIL'],'password':os.environ['URDEAL_ADMIN_PASSWORD']}))")
TOK=$(curl -sS -X POST https://live.ur-team.com/api/admin/login -H 'Content-Type: application/json' -H "User-Agent: $UA" \
  --data-binary "$BODY" | python3 -c "import sys,json;d=json.load(sys.stdin);dd=d.get('data') or {};print(dd.get('accessToken') or dd.get('token') or d.get('token') or '')")

# ① 하트비트 — d1-backup 이 실행됐는가
curl -sS "https://live.ur-team.com/api/admin/cron-heartbeats" -H "Authorization: Bearer $TOK" -H "User-Agent: $UA" \
 | python3 -c "import sys,json;i=(json.load(sys.stdin).get('data') or {}).get('items') or [];print([x for x in i if 'backup' in x['name']] or '❌ 없음')"

# ② R2 객체 — 실제로 파일이 떨어졌는가 (CF 토큰은 §3 참조)
curl -sS "https://api.cloudflare.com/client/v4/accounts/$CFA/r2/buckets/ur-live-backups/objects" -H "Authorization: Bearer $CFT"
```

**판정**
- ① 있고 ② 있음 → ✅ 끝. 이 항목은 닫는다.
- ① 있는데 `ok:false` → `handleD1Backup` 이 던졌다. `cron_failures` 테이블 + 어드민 벨에 사유가 있다.
  유력 후보는 **`BACKUP_BUCKET` 바인딩이 Worker 에 없음** — 그런데 대표가 2026-08-02 에 넣었고
  화면으로 확인했다(§2). 그 외라면 D1 dump 크기/CPU 한도.
- ① **아예 없음** → cron 이 발화 자체를 안 했다. CF 등록분을 다시 확인(§3 명령).

⚠️ **`/api/debug/bindings` 로 `BACKUP_BUCKET` 을 확인하지 마라.** 그 엔드포인트는 **Pages** 워커에서
돌아서 **Worker(cron) 의 바인딩을 못 본다.** `false` 가 떠도 정상이다 — 이걸 모르면 "안 됐네" 로 오판한다.

---

## 2. 완료분 — 대표 대시보드 작업 4건 + 코드 2건

| 항목 | 어디 | 확인 방법 |
|---|---|---|
| R2 버킷 `ur-live-backups` | R2 | 대시보드 |
| `BACKUP_BUCKET` 바인딩 | **Worker** `ur-live` (Pages 아님 — cron 전용) | 화면 확인 |
| `DATA_ENCRYPTION_KEY` | **Pages** (+Worker 권장 — 소셜 cron 이 `social-store` 로 토큰 복호화) | env-readiness 에서 사라짐 ✅ |
| `INTERNAL_API_TOKEN` · `ANALYTICS_KV` · `DISCORD_WEBHOOK_URL` | Pages | 재배포 후 반영 |
| `ur-live-cleanup-cron` 삭제 | Workers | CF API 워커 목록에서 사라짐 ✅ |
| GitHub `CLOUDFLARE_API_TOKEN` 교체 | GitHub Secrets | 배포 성공으로 입증 ✅ |

**코드**: `#968` 문법(`0`→`SUN`) · `#972` 슬롯 회수 + 점화 + 가드.

**최종 실측 (2026-08-02 15:43Z)**
```
ur-live 등록 cron: 0 18 * * *  ·  0 19 * * *  ·  0 20 * * SUN  ·  */5 * * * *   (4개)
계정 전체 5/5      (ur-live 4 + ur-ads 1 · 나머지 5개 워커는 cron 0)
```

---

## 3. 이번에 틀렸던 판단 — **여기가 제일 값지다**

### ① "문법만 고치면 된다" — 벽이 두 개였다
`0 20 * * 0` 이 CF 문법 밖(code 10100)인 건 맞았다. 고쳐서 배포했더니 **다른 에러**가 나왔다:
**계정당 cron 5개 한도**(code 10072). 계정이 이미 정확히 5였다.

⇒ **첫 번째 벽을 고쳐야 두 번째가 보인다.** "고쳤다"를 배포 전에 선언하지 말 것.

### ② 그리고 그 6번째 트리거가 **배포 파이프라인을 통째로 막았다**
스케줄 PUT 이 원자적이라 거부되면 **그 뒤 모든 worker-deploy 가 실패**한다 — 내 것만이 아니라
**다른 세션의 cron 변경까지** 멈춘다. 되돌리는 게 최우선이었다.
→ 지금은 `check-cron-syntax` 가 `wrangler*.toml` **합산**으로 커밋 시점에 막는다.

### ③ CF 토큰이 "죽었다"는 내 진단은 절반만 맞았다
`platform_settings.cf_api_token` 이 `Invalid API Token` 이라 **토큰이 죽었다**고 적었다.
다른 세션이 `#974` 에서 밝힌 진짜 원인은 **저장 UI** 였다(값이 온전히 안 들어갔다).
대표가 다시 넣자 **같은 토큰이 `status: active`** 로 살아났다.

⇒ 이 세션은 그 오진 때문에 **몇 시간 동안 "CF 는 내가 못 한다"고 전제**했다.
   다음 세션은 **`verify` 부터 찔러 볼 것** — 문서의 "죽었다" 를 믿지 말 것.

### ④ 저장소가 두 개인 걸 대표에게 늦게 설명했다
- `platform_settings.cf_api_token` → **세션(진단·조회)용**
- GitHub Actions Secret `CLOUDFLARE_API_TOKEN` → **worker-deploy / main.yml(Pages) 용**

대표가 어드민에만 넣고 "왜 아직도?" 가 됐다. **완전히 다른 저장소**이고 둘 다 넣어야 한다.
오늘 토큰을 새로 만드시면서 GitHub 쪽 옛 토큰이 죽어 **Pages 배포까지 3회 연속 실패**했다
(프로덕션이 `163c0c50` 에 몇 시간 멈춰 있었다 — 아무도 몰랐다).

### ⑤ 경로 하드코딩, 하루에 네 번
`repair-schema` 분리에서 3건, 추천보너스 추출에서 1건, 그리고 `wrangler-cron.toml` 삭제에서
`wholesale-invariants.test` 가 ENOENT 로 터졌다. 전부 `readdirSync`/합산 패턴으로 교정.
⚠️ **터지는 방향보다 반대가 더 위험하다** — 새 파일이 생겼는데 하드코딩 목록에 없으면 **조용히 빠진다**.

---

## 4. 남은 결정 / 대기

### 대표 판단
1. **어긋난 4명 잔액 교정** — 합 −16,380딜. 08-01 세션에서 손대지 않았다(머지 교정은 사람 판단).
2. **가입 보너스 재활성** — 지금 0. `platform_settings.signup_bonus_amount` 에 금액만 넣으면 켜진다.
3. **Workers Paid 전환 여부** — 지금 cron **5/5 로 꽉 찼다.** 트리거가 하나 더 필요해지면
   유료(한도 1,000)로 가거나 또 자리를 비워야 한다. `docs/design/cron-staged-ignition-plan-2026-07.md`
   의 3·4단계(매시간·주간 payouts)가 **전부 이 제약에 걸린다.**

### 세션이 못 하는 것
- **구글 AI 검색**: CF **Managed robots.txt** 가 레포 robots.txt 를 통째로 대체하며
  `Google-Extended: Disallow: /` 를 붙인다. 데이터 문제가 아니다(JSON-LD 정상).
  → 대시보드 **AI Crawl Control** 에서 Allow. **CF 토큰이 살아났으니 다음 세션은 API 로 시도해 볼 것.**
- 소셜 발행 토큰(OAuth).

---

## 5. 새 가드 (다음 세션이 믿어도 되는 것)

| 가드 | 막는 것 | **못 막는 것** |
|---|---|---|
| `check-cron-syntax` + `cron-schedule.test`(9) | CF 문법(**DOW 0 금지**) · 5필드 · 중복 · **계정 합 ≤ 5** · 백업 트리거 존재 · `safeCron` 배선 · 세 표기 수용 | **CF 에 실제 등록됐는지는 모른다** — 유일한 답은 `worker-deploy` 로그의 `schedule:` 목록. 배열에서 항목을 **빼는**(=삭제) 실수도 못 막는다 |

`check-guard-mutations` 매니페스트 등록 완료 — 6번째 트리거를 주입하면 CI 가 빨강을 낸다.

⚠️ **가드는 레포만 본다.** 계정에 다른 워커(다른 레포/수동 생성)가 cron 을 달면 합산에서 빠진다.
실제 계정 값은 CF API 로만 알 수 있다:

```bash
# CF 자격은 어드민에서 (2026-08-02 기준 유효 — 하지만 verify 로 먼저 확인할 것)
CFJSON=$(curl -sS "https://live.ur-team.com/api/admin/tools/settings" -H "Authorization: Bearer $TOK" -H "User-Agent: $UA")
CFT=$(echo "$CFJSON" | python3 -c "import sys,json;print((json.load(sys.stdin).get('data') or {}).get('cf_api_token',''))")
CFA=$(echo "$CFJSON" | python3 -c "import sys,json;print((json.load(sys.stdin).get('data') or {}).get('cf_account_id',''))")
curl -sS "https://api.cloudflare.com/client/v4/user/tokens/verify" -H "Authorization: Bearer $CFT"   # 먼저 이것부터

for w in $(curl -sS "https://api.cloudflare.com/client/v4/accounts/$CFA/workers/scripts" -H "Authorization: Bearer $CFT" \
  | python3 -c "import sys,json;print(' '.join(x['id'] for x in json.load(sys.stdin)['result']))"); do
  echo -n "$w: "
  curl -sS "https://api.cloudflare.com/client/v4/accounts/$CFA/workers/scripts/$w/schedules" -H "Authorization: Bearer $CFT" \
    | python3 -c "import sys,json;s=(json.load(sys.stdin).get('result') or {}).get('schedules') or [];print(len(s), [x['cron'] for x in s])"
done
```
