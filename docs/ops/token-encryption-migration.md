# 🔐 평문 토큰 암호화 이행 계획 — `DATA_ENCRYPTION_KEY` (별도 보안 트랙)

> **대표 지시 2026-07-29**: *"`DATA_ENCRYPTION_KEY` 는 별도 보안 트랙 — 평문 토큰 암호화 이행 계획을 따로 제시할 것."*
>
> cron 점화 계획(`cron-staged-ignition-plan-2026-07.md`)과 **의존관계 없음.** 독립 진행 가능.
>
> **2026-07-29 대표 승인 — 1~5단계 그대로 진행.** 대표 인계 순서상 **④번(마지막)**이다
> (① Trigger Events 원문 → ② 예치금 숫자 → ③ 버킷 → **④ 키**). 키 등록 통보가 오면 세션이
> `env-readiness` 로 확인하고 4단계(암호문 비율 관측)를 별도 PR 로 낸다.
> 실측 근거: `GET /api/health/env-readiness` → `security_missing: ["DATA_ENCRYPTION_KEY", "INTERNAL_API_TOKEN"]`

---

## 1. 지금 무엇이 평문인가

`encryptAtRest(plaintext, kek)` 는 **KEK 가 없거나 16자 미만이면 평문을 그대로 반환**한다
(`data-crypto.ts:37` — 개발 환경 호환을 위한 fail-open). 키가 없으므로 **아래가 전부 평문으로 DB 에 있다**:

| 대상 | 저장 위치 | 유출 시 영향 |
|---|---|---|
| **카카오 access / refresh 토큰** | `kakao.routes.ts:646·885` | 🔴 사용자 카카오 계정 API 접근 |
| YouTube OAuth access / refresh | `youtube.routes.ts:228·372` | 🔴 셀러 채널 제어 |
| 웹푸시 구독 키(`p256dh`/`auth`) | `push.routes.ts:35` | 🟡 임의 푸시 발송 |
| 네이버 커머스 `client_secret` | `naver-commerce-core.ts:144` | 🔴 외부 상점 API |
| 검색광고 `secret_key` | `searchad-connection.ts` | 🔴 광고 계정 |

> CLAUDE.md 카카오 룰(*"access_token/refresh_token DB 저장 시 반드시 `encryptToken()`"*)은 **코드로는 지켜지고
> 있다** — 호출은 전부 제자리에 있다. **깨진 것은 코드가 아니라 키의 부재**이고, 그 부재가 **아무 에러 없이
> 평문으로 흘러가는 것**이 이 사안의 본질이다.

## 2. 좋은 소식 — 이행이 파괴적이지 않다

`decryptAtRest` 는 **접두사 `v1:` 이 없으면 legacy 평문으로 보고 그대로 반환**한다(`data-crypto.ts:54`).

⇒ **혼재 모드가 설계상 정상이다.** 키를 넣는 순간부터 *새 쓰기만* 암호화되고, 기존 평문 행은 계속 읽힌다.
백필도, 다운타임도, 코드 변경도 필요 없다. **키 설정 하나가 이행의 1단계 전부다.**

## 3. 🔴 그런데 되돌릴 수 없는 지점이 하나 있다

암호문이 하나라도 생긴 뒤 **키를 잃으면 그 값들은 영구 복구 불가**다
(`decryptAtRest` 가 `DATA_ENCRYPTION_KEY missing but encrypted value found` 로 throw).

Cloudflare secret 은 **저장 후 값을 다시 볼 수 없다.** 그러므로:

> 🔑 **키를 만들면 Cloudflare 밖에 먼저 보관하고, 그 다음에 등록한다.** 순서를 바꾸지 말 것.
> 보관처는 대표의 비밀번호 관리자(1Password/Bitwarden 등). **레포·이슈·PR·채팅에 절대 남기지 않는다**
> (public repo — `check-secret-material` 가드가 있지만 최종 방어는 이 규칙이다).

## 4. 이행 단계

### 1단계 — 키 생성·보관 (👤 대표)

```bash
# 32바이트 랜덤 → base64. 로컬 터미널에서 생성할 것(이 세션에서 만들지 않는다).
openssl rand -base64 32
```
생성값을 **비밀번호 관리자에 먼저 저장**(항목명 예: `urdeal / DATA_ENCRYPTION_KEY / 2026-07`).

### 2단계 — 등록 (👤 대표)

Workers & Pages → **ur-live** → Settings → **Variables and Secrets** → Add → **Secret**
- Name: `DATA_ENCRYPTION_KEY` / Value: 위 값

⚠️ **Pages 프로젝트와 Workers 스크립트 양쪽**에 필요하다 — 소비자 요청(Pages)과 cron(Workers)이
같은 코드를 돌린다. 한쪽만 넣으면 **그쪽에서만 암호화**돼 혼재가 더 복잡해진다.

### 3단계 — 확인 (🤖 세션)

```
GET /api/health/env-readiness  →  summary.security_missing 에서 DATA_ENCRYPTION_KEY 사라짐
```
그 다음 **카카오 로그인 1회** → 그 사용자 행의 토큰 컬럼이 `v1:` 로 시작하는지 확인.
(이 확인은 어드민 조회 경로가 없어 대표 확인 또는 별도 조회가 필요하다 — 4단계에서 다룬다.)

### 4단계 — 관측 (🤖 세션, 별도 PR)

지금은 **"암호화가 실제로 걸렸는지" 볼 방법이 없다.** 이게 애초에 부재를 3개월 방치한 이유와 같은 구조다.
`env-readiness` 에 *키 존재* 말고 **암호문 비율**을 더한다:

```
암호화 대상 컬럼별로  SUM(value LIKE 'v1:%') / COUNT(*)
```
- 키 넣기 전: 0%
- 넣은 직후: 0% → 신규 로그인마다 상승
- 목표: 신규 쓰기 100%(기존 행은 자연 소멸/재로그인으로 대체)

**측정 없이 "됐다"고 적지 않는다.** 이 지표가 없으면 다음 세션이 또 같은 판정 불가에 걸린다.

### 5단계 — legacy 평문 정리 (선택, 나중)

토큰은 만료·재발급되므로 **재로그인만으로 자연 대체**된다. 강제 백필은:
- 이득: 옛 평문 즉시 제거
- 비용: 전 행 재작성 + 실패 시 부분 상태
⇒ 4단계 지표가 충분히 올라가면 **불필요할 가능성이 높다.** 지표를 보고 그때 판단한다.

## 4-b. 🔴 같은 세션에서 반드시 함께 — **Workers 쪽 `TOSS_SECRET_KEY`** (2026-08-01 발견)

키를 등록하러 대시보드에 들어간 김에 **이것부터** 처리해야 한다. 성격이 다르다 —
`DATA_ENCRYPTION_KEY` 는 *앞으로 쌓일 것*을 막는 일이지만, 이건 **지금 이 순간 돌고 있는 머니 작업이
조용히 일을 안 하고 있는** 것이다.

cron 은 Workers `ur-live` 에서 도는데 그쪽 시크릿이 **0개**다. 그런데 지금 등록된 세 블록 안에:

| cron | 작업 | 키가 없으면 (에러 없이) |
|---|---|---|
| `*/5` | `scheduled-cleanup` | 만료 선물 자동 환불 **통째 스킵** |
| `0 18` | `auto-settlement` | 만료 바우처 **환불 취소 호출 실패** |
| `0 19` | `reconciliation` | 막힌 주문 **영원히 stuck** |

### 절차 (👤 대표)

1. Workers & Pages → **`ur-live`(Workers 쪽 — Pages 아님)** → Settings → Variables and Secrets
2. Add → **Secret** → Name `TOSS_SECRET_KEY`
3. 값은 **Pages 에 있는 것과 동일**해야 한다.
   🔴 **복사이지 이동이 아니다 — Pages 에서 지우면 소비자 결제가 즉시 죽는다.**
   Cloudflare 는 저장된 시크릿 값을 다시 보여주지 않으므로, 값을 모르면 **토스 개발자센터에서 다시 확인**한다.
4. 같은 화면에서 `DATA_ENCRYPTION_KEY`·`DISCORD_WEBHOOK_URL` 도 함께(둘 다 양쪽 런타임 필요).

### 확인 (🤖 세션)

`GET /api/admin/cron-heartbeats` 에서 **`cron-env-missing` 이 사라지면** 완료.
`*/5` 라 등록 후 5분 안에 판정된다.

> ⚠️ **이 항목은 아직 확정이 아니다**(2026-08-01 기준). `wrangler deploy` 출력이 대시보드 시크릿을
> 원래 안 찍을 가능성이 남아 있어, 배포 로그의 침묵만으로는 증거가 못 된다.
> **`cron-env-missing` 하트비트가 실제로 뜨는지가 판정**이고, 안 뜨면 이 절은 삭제한다.

---

## 5. 함께 처리할 것 — `INTERNAL_API_TOKEN`

같은 `security_missing` 에 있다. 키 생성·등록 절차가 동일하므로 **같은 작업 세션에서 함께** 처리하면 된다.

> ✅ **정정(2026-07-29 조사 완료)**: 이 문서는 처음에 *"미설정이면 fail-open"* 이라고 적었다. **틀렸다.**
> 소비처 4곳이 전부 `if (!opsToken || opsToken !== reqToken) return 403` — **미설정이면 열리는 게 아니라
> 잠긴다.** 라이브 실측도 403. `env-readiness` 가 이 키를 `security`(그룹 설명 *"fail-open"*) 에 둬서
> 생긴 오독이었다.
>
> ⇒ 실제 리스크는 보안이 아니라 **가용성**이다 — 어드민 비밀번호 초기화·rate-limit 해제 같은 **복구 레버가
> 잠겨 있다.** 오픈을 막지는 않는다. 상세: `docs/design/operator-mall-open-blockers-2026-07.md` §3.

## 6. 이 트랙이 판정하지 못하는 것

- **이미 유출됐는지** — 작업트리 스캔으로는 알 수 없다. 평문 저장 기간 동안 D1 에 접근 가능한 경로가
  있었는지는 별도 조사다. (참고: 2026-07-28 `archive/` 시크릿 유출 사고(#798) 이후 회전이 있었다.)
- **`PII_ENCRYPTION_ENABLED`** — PII(전화·주소) 암호화는 **별개 마스터 스위치**이고 지금 OFF 다.
  키를 넣어도 자동으로 켜지지 않는다. 이 문서는 **토큰**만 다룬다.

---

## 구현 로그

- 2026-07-29 신설 — 대표 지시 *"별도 보안 트랙 · 이행 계획 따로 제시"*. 코드 변경 0.
