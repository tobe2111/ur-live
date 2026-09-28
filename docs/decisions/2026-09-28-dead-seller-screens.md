# 죽은 셀러 화면 둘(consignment·youtube-growth)을 어떻게 할까

상태: open
등급: C
역할: dev
올린 날: 2026-09-28
기한: 2026-10-05

## 질문

라이브에서 죽어 있는 셀러 화면 둘을 **은퇴**시킬까, **살릴**까, **그대로 둘**까?

## 근거 (실측 — 2026-09-28 라이브 D1)

> 🩸 **먼저 정정.** 이전 보고의 *"죽은 화면 셋(`consignment`·`mini-shop`·`youtube-growth`)"* 에서
> **`mini-shop` 은 죽지 않았다** — 2026-09-16 에 업체 정보로 흡수되며
> `<Navigate to="/seller/store" replace />` 로 **이미 은퇴한 상태**다(라우트는 북마크 때문에 남겼다).
> 진입점이 0 인 이유가 *은퇴했기 때문*인데 그걸 죽은 것으로 분류했다. 남은 것은 **둘**이다.

| | 줄 | 라이브 상태 | 판정 |
|---|---:|---|---|
| `/seller/consignment` | 249 | 테이블 `consignment_partnerships` **없음** | 🔴 깨져 있다 |
| `/seller/youtube-growth` | 336 | 테이블 있음 · 주문 **0건** · 매출 **0원** | 🟡 팔린 적 없음 |

```sql
SELECT name FROM sqlite_master WHERE type='table'
  AND name IN ('consignment_partnerships','youtube_growth_requests','products','sellers');
-- → products, sellers, youtube_growth_requests      ← consignment_partnerships 없음
SELECT COUNT(*) n, COALESCE(SUM(price),0) won FROM youtube_growth_requests;   -- → 0, 0
```

- **`consignment` 이 왜 깨졌나**: 마이그레이션 `0236_consignment_partnerships.sql` 은 레포에 있는데
  **D1 마이그레이션이 CI 에서 안 돈다**(`TECHNICAL_DEBT.md` 의 알려진 부채). `repair-schema` 에도 없다.
  ⇒ 페이지를 열면 API 일곱 개가 전부 `no such table` 로 죽는다. **진입점이 없어 아무도 신고하지 않았을 뿐이다.**
- **`youtube-growth` 는 성격이 다르다**: 결제가 붙은 **유료 기능**이다 —
  `100명 20,000원 / 500명 45,000 / 1,000명 95,000 / 5,000명 450,000 / 10,000명 850,000`(Toss).
  코드는 멀쩡한데 들어갈 문이 **자기 성공 페이지뿐**이다. 주소를 아는 사람은 결제가 된다.

## 🔴 2026-09-28 재실측 — **위 근거 둘 다 전제가 틀렸다. 기본안을 철회한다.**

착수하려고 코드를 열었더니 두 항목 다 "죽은 화면" 이 아니었다.

### ⓐ `consignment` 은 화면 하나가 아니라 **잠든 서브시스템**이다

| 남아 있는 것 | 어디 |
|---|---|
| API 5개 | `features/seller/api/consignment.routes.ts` (`/request`·`/:id/approve`·`/:id/terminate`·목록·`/settlements`) |
| **결제 경로 훅** | `worker/utils/checkout.ts:257` — 주문 아이템에 `consignment_id` 자동 기록 |
| 정비 cron | `worker/cron/scheduled-cleanup-daily.ts` |
| 어드민 모니터링 | `features/admin/api/admin-business-monitoring.routes.ts` |
| **운영 가이드 두 절** | `guide-seed-seller.ts:422`(MD 위탁 판매) · `:597`(3자 분배 — **host 25% 등 분배율**) |

✅ **오늘 결제는 안전하다**(실측): `checkout.ts` 가 테이블 부재를 `catch` 로 허용하고
주석에도 *"consignment_partnerships 테이블 미존재 환경 허용"* 이라고 적혀 있다.

⇒ "은퇴" 는 한 줄이 아니라 **분배율을 약속한 가이드 두 절까지 건드리는 일**이다. 그건 제품 결정이다.

### ⓑ `youtube-growth` 는 "문이 없는 기능" 이 아니라 **구독자를 사는 서비스**다

화면 문구 그대로다:

> **YouTube 구독자 늘리기 서비스** — *"YouTube 라이브 방송을 위해 구독자 1,000명 이상이 필요합니다.
> 원하시는 패키지를 선택하고 결제하시면 관리자가 확인 후 처리해드립니다."*
> `구독자 +1,000명 95,000원` · **"결제 완료 후 환불이 불가합니다."**

세 가지가 걸린다:

1. **플랫폼 정책** — 구독자 구매는 YouTube 의 가짜 참여(fake engagement) 정책 위반이다.
   대가를 치르는 쪽은 유어딜만이 아니라 **그 채널의 사장님**이다(제재·해지).
2. **존재 이유가 이미 사라졌다** — 문구가 스스로 *"라이브 방송을 위해"* 라고 말하는데
   **라이브커머스는 영구 중단**(`LIVE_COMMERCE_SUSPENDED`)이다.
3. **환불 불가 + 관리자 수작업** — 팔리면 되돌릴 수 없고, 이행은 사람이 한다.

⇒ **문을 내지 않았다.** 원래 기본안(선택지 1)이 *"파는 거니 문을 내자"* 였는데, 무엇을 파는지
확인하지 않고 쓴 것이다. 그 권고를 **철회한다.**

## 선택지 (재작성)

1. **지금 한 것** — `consignment` 은 **문만 닫는다**(`/seller/consignment` → `/seller` 리다이렉트).
   기능·API·가이드는 그대로. `youtube-growth` 는 **그대로 둔다**(문 없음 = 새 노출 0). 머니 접촉 없음
2. `youtube-growth` 를 **접는다** — 라우트를 리다이렉트로, 결제 진입을 막는다.
   주소를 아는 사람이 85만원까지 결제할 수 있는 상태를 끝낸다. ⚠️ 유료 기능 종료 = 대표 판단
3. `youtube-growth` 를 **판다** — 전체 도구에 문을 낸다. ⚠️ 위 1·2·3 을 감수하는 결정
4. `consignment` 을 **살린다** — `repair-schema` 에 테이블 + 진입점. ⚠️ 위탁 정산은 **머니 경로** → 단독 세션 + staging 실결제
5. `consignment` 을 **통째로 없앤다** — API·checkout 훅·cron·가이드 두 절까지. ⚠️ 분배율 약속을 지우는 일

## 기본안 (답이 없을 때 권하는 것 — 자동 실행되지 않는다)

> ⚠️ **옛 기본안(선택지 1 — `youtube-growth` 에 문을 내자)은 철회했다.** 아래가 새 기본안이다.

- **`consignment`**: 문만 닫아 둔 지금 상태가 현상 유지보다 안전하다(깨진 화면 대신 리다이렉트).
  살릴지 없앨지는 서두를 일이 아니다 — 아무도 못 들어가고 결제도 안전하다.
- **`youtube-growth`**: **선택지 2(접기)를 권한다.** 팔린 적이 없고(0건·0원), 존재 이유(라이브)가
  사라졌고, 남은 것은 *주소를 아는 사람이 환불 불가로 결제할 수 있는 상태*뿐이다.

## 롤백

은퇴분은 라우트를 리다이렉트에서 페이지로 환원(커밋 revert). 노출분은 색인에서 항목 제거.

## 결정 (대표가 한 말 그대로)

> **"모두 가장 이상적으로 순서대로"**

⚠️ 이 말은 **순서 목록 전체**에 대한 답이고 이 질문의 답은 아니다.
그래서 **되돌리기 쉬운 것 하나만** 했다 — 깨진 화면의 문을 닫았다(리다이렉트 한 줄).
**`youtube-growth` 는 손대지 않았다**: 문을 내는 것도(판매 개시), 접는 것도(유료 기능 종료)
등급 C 이고, 무엇보다 **무엇을 파는지 알고 나면 기본안이 달라진다**(위 ⓑ). 대표 판단이 필요하다.

## 반영 커밋

<비워 둔다>
