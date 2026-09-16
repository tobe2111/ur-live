# 소개 커미션 사용 확인 게이트 (2026-09-16)

## 다음 세션의 첫 액션
1. PR 이 초록인지 확인하고 머지.
2. **게이트를 켜지 말 것.** 등급 C 다 — `docs/STAGING_CHECKLIST.md` S-USEGATE 8건을 staging 에서
   돌린 뒤 **대표가** `platform_settings.payout_requires_voucher_use = 'true'` 로 켠다.
   판정: 어드민 `/admin/platform-settings` 또는
   `SELECT * FROM platform_settings WHERE key LIKE 'payout_%'` (D1 읽기).
3. 남은 사기 방어 ②③④⑤ 는 `docs/decisions/2026-09-16-store-fraud-defense-order.md`.

## 완료분
- `692d5bb9d` (PR #1467) — 매장 영입 2% 폐지(화면 4곳 + **약관 조항**).
- 이 브랜치 — 사용 확인 게이트. `src/worker/utils/payout-use-gate.ts` 신설 + `influencer-payout` cron
  성숙 UPDATE 에 조건 1개 + `/api/influencer-settlement/me` 가 게이트 상태를 함께 반환 +
  정산 화면 보류 라벨이 그 상태를 따른다. 가드 15건 + 주입 7건(전부 빨간불 확인).

## 이번에 틀렸던 판단 — **이게 제일 값지다**
1. **"안 쓰인 것 → 유효기간 만료 후 소개자에게 정산" 이라고 대표에게 말했는데 틀렸다.**
   실제 정책은 2026-05-30 확정으로 **만료 시 고객에게 100% 환불**이고(공정위 신유형 상품권
   표준약관의 90% 기준을 상회 — `voucher-expire.ts` 주석), 소개비는 `clawbackVoucherCommission`
   이 **회수**한다. 즉 미사용분의 소개비는 결국 **0** 이다. 게이트는 "만료를 지급 사유로 만드는 것"이
   아니라 **그 정리가 끝날 때까지 돈이 먼저 나가지 않게** 막는 것이다.
2. **첫 판 SQL 에 레이스가 있었다.** "만료일이 지났으면 통과" 로 짰는데, `auto-settlement` 가
   [expired → 환불 → clawback] 을 돌리기 **전** 창에서 소개비를 익혀 "송금 대기"로 올렸다.
   ⇒ 날짜가 아니라 **처리 결과(`status`)** 를 본다.
3. **`Number(x) || DEFAULT` 가 0 을 삼켰다** — 내 시험이 잡았다. 어드민이 천장 0 을 넣으면 조용히
   180 이 됐다. CLAUDE.md 가 경고하는 그 함정을 그대로 밟았다.
4. **주입이 내 시험의 구멍을 잡았다** — "기본 OFF" 픽스처의 `platform_settings` 가 **비어 있어서**
   읽기 루프가 아예 안 돌았다. 루프 안에서 `enabled = true` 로 바꿔 놔도 초록이었다.
   ⇒ 행이 **있는데 값이 'true' 가 아닌** 경우를 반드시 같이 넣을 것.

## 실측 (라이브, 2026-09-16)
- `vouchers` 전체 **1행**(expired) · `influencer_attributions` **0행** ⇒ 게이트를 켜도 **오늘 영향 0**.
  이건 사고 수습이 아니라 **선제 방어**다.
- 만료 cron 은 `WHERE v.expires_at < datetime('now')` 라 **무기한 이용권을 아예 안 집는다.**
  그래서 무기한 천장(`payout_unused_max_wait_days`)이 그런 주문의 **유일한 출구**다. 지우면 갇힌다.

## 남은 결정 / 대기
- **게이트 ON** — 대표 판단(등급 C).
- **만료 낙전을 유어딜이 갖는 안** — 대표 질문. 현 정책(100% 환불)의 반전이고 5년 환급 의무가 걸려
  있어 결재 없이는 건드리지 않는다. 판단이 필요하면 결재 문서로 올릴 것.

---

## 🪪 후속 — 가입 앞문에 등록증 사본 (대표 *"그게 가장 이상적이면 그렇게 해줘"*)

### 🔴 ② 의 원래 형태는 **불가능**하다 (실측)
결재 문서가 ② 를 *"매장 이름·주소 == 사업자등록증"* 으로 적었는데, **국세청 API 로는 못 한다**:
```
보내는 것: b_no · start_dt · p_nm      받는 것: valid · b_stt
```
**상호도 주소도 오가지 않는다.** 제안할 때 이 API 가 무엇을 주는지 확인하지 않은 것이 오류다.

### 그래서 바꾼 형태 — 앞뒤가 뒤집혀 있던 것을 맞춘다
| | 등록증 사본 | 심사 |
|---|---|---|
| 뒷문 `/store/find` | **필수**(원래) | 어드민 |
| 앞문 `/seller/register/supplier` | **없음 → 필수**(이번) | 어드민 |

가짜 매장은 **앞문으로** 들어온다(자기 진짜 등록증으로 국세청을 통과한 뒤 상호·주소만 남의 가게로).
컬럼(`sellers.business_registration_image_url`)과 어드민 승인 화면은 **이미 있었다** — 채우는 쪽만 없었다.

### 한 일
- `SellerRegisterSupplierPage` — `BusinessCertUpload` + 제출 게이트 + 진행 표시 5 → 6
- `/register-from-user` — `business_cert_url` 수신, `BIZ_CERT_PATH`(뒷문과 **같은** 패턴) 통과분만
  `business_registration_image_url` 에 저장 + `business_registration_status='pending'`
- 가드 `register-front-door-cert-2026-09-16.test.ts` 6건 + 주입 6건(전부 빨간불 확인)

### 🩸 이번에 가드가 두 번 헛돌았다 (같은 클래스)
1. `toContain('BIZ_CERT_PATH')` — 그 이름이 **import 줄**에 이미 있어 저장 줄을 망가뜨려도 통과.
2. 구간을 INSERT bind 로 좁혔더니 이번엔 **다음 줄**(`… ? 'pending' : null`)에 같은 이름이 있어 또 통과.
⇒ **가드를 통과한 표현식만 걷어내고 남은 자리에 날 변수가 있는지** 보는 방식으로 교정.

### ⚠️ 이 변경이 못 막는 것
- 사진이 **진짜 그 가게의 등록증인지** — 사람이 본다.
- 어드민이 실제로 대조하는지 — 운영이다. (화면엔 이미 승인/반려 버튼이 있다.)
- 전환율 영향 — 앞문에 필수 칸이 하나 늘었다. 가입이 줄면 대표 판단으로 완화할 수 있다
  (예: 제출은 허용하고 승인 전까지 '사본 대기' 로 표시).

### 별건 — 대표가 준 링크에서 발견
`/seller/register/supplier?from=kakao&userName=정지원` 의 **두 파라미터를 페이지가 안 읽는다.**
인사말은 `localStorage.getItem('user_name')` 만 보고, `from` 은 `'curator'` 만 분기한다.
⇒ localStorage 가 빈 브라우저에서 그 링크를 열면 인사말이 **조용히 안 뜬다**. 미수리(별건).
