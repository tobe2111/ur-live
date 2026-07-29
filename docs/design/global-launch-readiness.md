# 🌏 해외판(GLOBAL) 실행 준비 상태 — "켜려면 실제로 뭐가 필요한가"

> **작성 2026-07-28** (대표 지시: "해외판 켜려면 실제로 뭐가 필요한가를 문서로 남겨줘")
> **성격**: 결정 지원 문서. 지금 구현하라는 뜻이 **아니다**. 나중에 글로벌을 켜기로 할 때 이 문서부터 읽는다.
> **모든 항목은 2026-07-28 시점 코드 실측** — 추측은 "미확인"으로 표시했다.

---

## 0. 요약 — 세 문장

1. **배포 구조는 이미 풀려 있다.** 지역 판정이 **런타임 hostname 기반**이라, 해외판은 별도 배포·별도 빌드가 필요 없다. 도메인 하나를 지금 서비스에 붙이면 된다(도매몰 `utongstart.com` 과 동일 방식).
2. **껍데기는 있고 알맹이가 없다.** 영어 번역·Stripe 라우트·구글 라우트가 *존재는* 하지만, 결제가 **주문을 확정만 하고 이행(재고·발급·정산·알림)을 하나도 안 한다**. 이게 가장 큰 구멍이다.
3. **진짜 난이도는 기술이 아니라 사업 설계다.** 통화·세금·정산·상품(무엇을 파는가)이 미정이면 코드를 아무리 고쳐도 못 켠다.

---

## 1. `ur-live-global` 은 왜 폐기됐나 (재발 방지)

| 사실 | 내용 |
|---|---|
| 정체 | 2026-03-03 생성된 **Worker**(Pages 아님). 내용은 대시보드 "Hello World" 템플릿 그대로 |
| 빌드 | **한 번도 성공한 적 없음**. 매 PR 마다 0초 즉시 실패(시작·완료 타임스탬프 동일) |
| 원인 | `wrangler.global.toml` 은 **Pages 설정**(`pages_build_output_dir` 있고 Workers 필수 `main` 없음) → 설정 검증에서 즉시 거부 |
| 도메인 | `world.ur-team.com` 이 이 워커에 붙어 있어 실제로 `"Hello world"` 를 서빙 중이었음 |
| 결론 | **없어도 되는 것을 만들다 실패했다.** 두 번째 배포의 존재 이유가 `VITE_REGION=GLOBAL` 이라는 빌드타임 변수 하나였는데, **코드는 그 변수를 안 쓴다**(§2 참조) |

> ⚠️ **다시 만들지 말 것.** 글로벌을 켤 때도 새 배포를 만들지 않는다. §2 의 구조를 쓴다.
> 대표 결정(2026-07-28): **무료 플랜 유지 · `ur-live-global` 삭제**.

### 레포 잔재 — ✅ 2026-07-28 삭제 완료
`wrangler.global.toml` · `scripts/deploy-global.sh` · `scripts/deploy-dual-sites.sh` 삭제.
삭제 전 전수조사: `package.json`·CI 워크플로(`.github/workflows`)·git hooks·가드 스크립트 참조 **0건**
(문서/`archive/` 의 역사 기록 언급뿐). `deploy-dual-sites.sh` 는 이름과 달리 도매몰이 아니라
**KR+GLOBAL** 용이었고, 존재하지 않는 프로젝트명(`ur-live-kr`)을 참조하는 이중 스테일 상태였다.

⚠️ **`src/shared/config/region.ts` 는 지우면 안 된다** — 이게 §2 의 핵심 자산이다(런타임 hostname 판정).
글로벌을 다시 켤 때 필요한 것은 이 파일이지 위 배포 스크립트가 아니다.

---

## 2. 올바른 구조 — 배포 1개, 도메인 N개

**이미 도매몰이 이 방식으로 돌고 있다.** 같은 워커가 접속 호스트를 보고 다른 얼굴을 낸다.

```
배포 1개 (ur-live)
 ├─ urdeal.kr          → 소비자 한국판 (한국어 · 카카오 · 토스 · KRW)
 ├─ utongstart.com     → 도매몰          ← 이미 이렇게 동작 중
 └─ world.ur-team.com  → 해외판          (영어 · 구글 · Stripe · USD)
```

### 왜 이게 가능한가 — 실측 근거

`src/shared/config/region.ts:88` `getRegion()` 이 **런타임에 `window.location.hostname` 으로** 지역을 판정한다:

```ts
export function getRegion(): Region {
  if (typeof window === 'undefined') return 'KR'   // SSR 기본값
  const hostname = window.location.hostname
  for (const pattern of REGION_CONFIG_MAP.GLOBAL.domainPatterns) {
    if (hostname.includes(pattern)) return 'GLOBAL'
  }
  return 'KR'
}
```

그리고 `REGION_CONFIG_MAP`(같은 파일 `:58`)에 해외판 프로필이 **이미 정의돼 있다**:

| | KR | GLOBAL |
|---|---|---|
| 언어 | ko | en |
| 통화 | KRW | USD |
| 결제 | toss | stripe |
| 로그인 | kakao, google | google |
| 도메인 패턴 | `urdeal.kr`, `kr.`, `localhost:5173` | `world.ur-team.com`, `global.`, `localhost:5174` |

⇒ **`world.ur-team.com` 을 본 서비스에 붙이는 순간 코드는 이미 GLOBAL 로 전환된다.** 빌드 변경 0.

### 워커(서버)측 선례
`src/worker/index.ts` 가 이미 호스트별 분기를 한다 — `utongstart.com` 의 robots.txt Sitemap 치환(`:1122`), 도매 surface 메타 rewrite(`:818`), `utongstart.com` 루트 → `/wholesale` 302. 같은 패턴을 GLOBAL 에 쓰면 된다.

---

## 3. 이미 되어 있는 것 (실측)

| 항목 | 상태 | 근거 |
|---|---|---|
| 런타임 지역 판정 | ✅ | `shared/config/region.ts:88` |
| 해외판 프로필(언어·통화·결제·로그인) | ✅ 정의됨 | 같은 파일 `:58` |
| 번역 파일 **6개 언어** | ✅ | `public/locales/{ko,en,ja,zh,es,fr}` |
| 브라우저 언어 자동 감지 | ✅ | `src/i18n.ts:27` `detectDefaultLanguage()` |
| Stripe 결제 라우트 | ⚠️ 부분 | `worker/routes/stripe.routes.ts` (222줄) — §4-A |
| Stripe webhook 서명 검증 | ✅ 품질 양호 | HMAC-SHA256 + 5분 replay tolerance |
| 구글 OAuth 라우트 | ⚠️ 부분 | `features/auth/api/google.routes.ts` (101줄) — §4-B |
| CSP 에 Stripe 허용 | ✅ | `worker/index.ts:467,485,495` |
| DB·KV 공유 | ✅ | 원래부터 한국판과 동일 리소스 |

---

## 4. 실제로 필요한 것 — 우선순위 순

### 🔴 A. Stripe 결제가 "이행"을 안 한다 (가장 큰 구멍)

**현상**: `stripe.routes.ts` webhook 은 결제 성공 시 이것만 한다.

```sql
UPDATE orders SET status='PAID', payment_status='approved', paid_at=... WHERE order_number=? AND status='PENDING'
```

**빠진 것** — 토스 경로(`payment.routes.ts /confirm`)가 하는 일과 대조하면:

| 토스가 하는 일 | Stripe 경로 |
|---|---|
| 재고 차감(`reduceStock`) | ❌ 없음 |
| 디지털 상품 발급(`digital_product_access`) | ❌ 없음 |
| 교환권 발송(KT-Alpha) | ❌ 없음 |
| 커미션 적립(`creditOrderCommissions`) | ❌ 없음 |
| 셀러 원장 크레딧(정산) | ❌ 없음 |
| 구매자·셀러 알림 | ❌ 없음(실패 시 어드민 알림만) |
| 딜 차감(혼합결제) | ❌ 없음 |

⇒ **해외 고객이 결제하면 돈은 빠져나가고 상품은 안 온다.** 이 상태로 켜면 사고다.

**해야 할 일**: 토스 `/confirm` 의 side-effect 묶음을 **공용 헬퍼로 추출**해 Stripe webhook 에서도 호출.
이미 `creditOrderCommissions`(order-commissions.ts) 같은 공용 멱등 헬퍼 선례가 있다 — 같은 방식.
⚠️ `payment.routes.ts` 는 **Toss V2 audit 잠금 파일**이라 대표 승인 필요(CLAUDE.md 참조).

**환불 대칭도 필요**: `refundOrderFully` 가 Stripe 환불을 모른다. 적립-역전 대칭(CLAUDE.md 머니 룰 #2) 위반 상태.

---

### 🔴 B. 구글 로그인이 소비자 세션을 안 만든다

`google.routes.ts` 는 `POST /api/auth/google/register` **1개뿐**이고(101줄), 카카오 경로가 하는
`createSessionCookie` / `ur_session` / `user_type` 설정이 **없다**(grep 0건).

카카오 로그인은 iOS 쿠키 미영속 대응까지 포함한 정교한 흐름(fragment `#st=` → `POST /api/auth/session/establish`)을 갖췄는데, 구글은 그 절반도 없다.

**해야 할 일**: 카카오 흐름(`kakao.routes.ts`)을 참조해 구글에도 동일한 세션 발급·역할 토큰·iOS 대응을 구현.
⚠️ CLAUDE.md 의 **auth-cookie 가드**(`check-auth-cookie-pattern.sh`)를 반드시 통과해야 한다.

---

### 🟡 C. 통화 — 원화가 코드 전반에 하드코딩

- `₩` 또는 `원` 이 하드코딩된 파일 **108개**(`src/pages`, `src/components`)
- 헬퍼 `formatWon()`(`src/utils/format.ts:70`)이 원화 전용
- DB 의 모든 금액 컬럼이 **KRW 정수**

**결정이 먼저 필요하다**:
1. **표시만 환산**할 것인가(결제는 KRW) — 쉬움. 환율 소스·갱신 주기 필요
2. **USD 로 실제 청구**할 것인가 — 어려움. 정산·환불·원장 전부 다통화가 됨

⇒ 1번이면 `formatWon` → `formatMoney(value, currency)` 로 바꾸고 108파일 점진 교체.
2번이면 원장·정산 설계부터 다시 봐야 한다. **1번을 강력 권장.**

---

### 🟡 D. 무엇을 파는가 — 상품 적합성

현재 소비자 상품은 대부분 **한국 오프라인 전제**다:
- **이용권**(식사·미용·숙박) — 한국 매장에서 QR/PIN 으로 사용. 해외 고객에게 무의미
- **교환권**(KT-Alpha 기프티콘) — 한국 통신사 발송. 해외 번호로 못 보냄
- **동네딜** — 한국 지역 기반

⇒ 해외판에서 **무엇을 팔 것인지**가 정해지지 않으면 켤 이유가 없다.
후보: 배송 가능한 실물 상품 / 디지털 상품 / 한국 여행객 대상 이용권(역발상).

---

### 🟡 E. 정산·세금

- 원천징수 **3.3% / 8.8%** 는 한국 제도(`tax-withholding.ts`). 해외 판매자에 적용 불가
- 사업자등록번호 검증(국세청 연동)도 한국 전용
- 해외 판매자를 받을 거면 **별도 정산 트랙**이 필요

---

### 🟢 F. 인프라 — 무료 플랜 천장 공유

대표 확정(2026-07-28) **무료 플랜 유지**. 인보케이션당 서브리퀘스트 **50**(D1 포함), 계정 cron **5개(현재 5/5 만석)**.
해외 트래픽이 늘면 **같은 천장을 한국판과 나눠 쓴다**. 글로벌을 진지하게 켤 시점엔 유료 전환($5/월, 한도 20배)이 사실상 전제.

---

## 5. 켜기 위한 최소 순서 (제안)

> 각 단계는 **앞 단계가 끝나야** 의미가 있다. 순서를 바꾸면 헛돈다.

| # | 단계 | 성격 |
|---|---|---|
| 1 | **무엇을 팔지 결정** (§4-D) | 사업 결정 — 이게 없으면 나머지가 무의미 |
| 2 | **통화 정책 결정** (§4-C, 표시환산 권장) | 사업 결정 |
| 3 | Stripe 이행 배선 (§4-A) + 환불 대칭 | 개발 — 머니 경로, staging 실결제 필수 |
| 4 | 구글 로그인 세션 완성 (§4-B) | 개발 — auth 가드 통과 필수 |
| 5 | 통화 표시 교체 (`formatMoney`) | 개발 — 점진 가능 |
| 6 | `world.ur-team.com` 을 본 배포에 연결 | **대시보드 5분** |
| 7 | staging 전수 검증 → 공개 | — |

**6번이 마지막이라는 점이 핵심이다.** 도메인 연결은 가장 쉬운 일이고, 그래서 `ur-live-global` 같은 배포를 미리 만들 이유가 전혀 없었다.

---

## 6. 지금 당장 할 일 — 없음

이 문서는 **결정 시점에 꺼내 보는 용도**다. 현재 상태에서 켜면 §4-A(결제했는데 상품 안 옴) 때문에 사고가 난다.

**대표 결정 대기 항목**: §4-D(무엇을 팔까) · §4-C(통화 정책) · §4-F(유료 전환 시점).

---

## 구현 로그

| 날짜 | 내용 | commit |
|---|---|---|
| 2026-07-28 | 문서 신설 — `ur-live-global` 폐기 결정 + 해외판 준비 상태 실측 | (이 커밋) |
