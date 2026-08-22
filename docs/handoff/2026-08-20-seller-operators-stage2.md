# 2026-08-20 — 매장 운영 주체 모델 2단계 (`seller_operators`)

**브랜치**: `claude/agency-dashboard-review-iqbv5u` (1단계 PR #1179 머지 후 main 에서 재시작)
**대표 지시**: "머지 하고, 통지할 필요는 없어. 2단계 진행하자."
**설계 SSOT**: `docs/design/store-operator-model.md` §4

---

## 1. 다음 세션의 첫 액션 — 배포 후에만 판정 가능한 것

단위테스트는 **배선**만 본다. 아래는 라이브에서만 확인된다.

```bash
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
# ① 마운트 확인 — 401(인증 필요)이면 정상. 404 면 라우터가 안 붙은 것.
curl -sS -o /dev/null -w '%{http_code}\n' https://urdeal.kr/api/seller/my-stores -H "User-Agent: $UA"
# ② IDOR 방어 — 남의 매장 토큰 요청은 403 이어야 한다(유효한 seller_token 필요).
curl -sS -X POST https://urdeal.kr/api/seller/stores/99999/token \
  -H "Authorization: Bearer <유효한_seller_token>" -H "User-Agent: $UA" | head -c 200
# ③ 테이블 생성 확인 (어드민 토큰으로 D1 조회 — CLAUDE.md 절차)
#   SELECT COUNT(*) FROM seller_operators;
```

**⚠️ 아직 라이브에서 실제로 매장 전환을 해 본 적이 없다.** 운영자 행이 0건이라 시나리오를 만들려면
어드민이 `seller_operators` 에 행을 넣거나, 소유자가 `/seller/operators` 에서 누군가를 추가해야 한다.
**좌석 분리(운영자가 사장님을 튕기지 않는지)** 는 그 시나리오에서만 실증된다 — 순수함수 단위로는 통과.

---

## 2. 완료분

| 항목 | 내용 |
|---|---|
| 테이블 | `seller_operators(seller_id, user_id, role, granted_by_user_id, granted_at, revoked_at)` + UNIQUE(seller_id,user_id) |
| SSOT 유틸 | `src/worker/utils/seller-operators.ts` |
| API | `GET /api/seller/my-stores` · `POST /api/seller/stores/:id/token` · `GET/POST /api/seller/operators` · `POST /api/seller/operators/:userId/revoke` |
| 좌석 분리 | `dashboard-session.ts` 에 `seller_operator` 시트 |
| UI | `StoreSwitcher`(매장 2곳+ 일 때만) · `SellerOperatorsPage`(`/seller/operators`) + nav + i18n 6개 언어 |
| 가드 | `seller-operators-invariants.test.ts` **20건** + 주입 **3건** |

**되돌려-검증**: 권한검사 제거 / 좌석분리 제거 / 소유자게이트 제거 / 소유·위임 우선순위 뒤집기 —
4건 전부 빨강 확인 후 복원.

---

## 3. 이번에 틀렸던 판단

1. **"2단계는 머니 경로다" — 내가 1단계에서 쓴 설계 문서가 틀렸다.**
   구현해 보니 정산 목적지는 `sellers.bank_account` 그대로고 운영자는 그걸 못 바꾼다.
   **진짜 위험은 인가(IDOR)** 였다 — 잘못하면 남의 매장 주문·정산이 통째로 보인다.
   문서를 정정했다. 위험을 잘못 분류하면 **엉뚱한 곳에 가드를 만든다**(staging 실결제로는 IDOR 을 못 잡는다).

2. **좌석(seat)을 안 나눴으면 사장님이 튕겼다.**
   단일 세션 강제가 시트별로 도는데, 운영자 토큰을 그냥 발급하면 시트가 `('seller', 매장id)` 라
   **운영자가 들어가는 순간 소유자가 SESSION_SUPERSEDED**. 기능 테스트로는 절대 안 잡히고
   라이브에서 "갑자기 로그아웃돼요" 로만 나타났을 것이다. `dashboard-session.ts` 를 읽다가 발견했다.

3. **`createDashboardNotification` 은 소비자('user')를 안 받는다** — 타입이 잡아 줬다. `notifyUser`(`@/lib/notifications`)가 맞다.

4. **컨테이너가 `node_modules` 를 날렸다**(tsc 가 갑자기 65,864 에러). 검증 전에 `[ -d node_modules ]` 를 확인할 것.

---

## 4. 남은 결정 / 대기

| 항목 | 누가 | 비고 |
|---|---|---|
| 3단계(사업자번호 기반 owner 승계 + 영입 보상 분리) | 대표 | 착수 조건은 설계 §6 판정 쿼리 |
| 정산계좌·사업자정보 편집을 소유자 전용으로 좁히기 | — | **3단계에서**. 지금은 운영자도 편집 가능(기존 셀러 권한 그대로) ⚠️ |
| 라이브 매장 전환 실증 | 다음 세션 | §1 참조 |

> ⚠️ **지금 상태의 알려진 한계**: 운영자는 **기존 셀러 권한 전부**를 갖는다(정산계좌 편집 포함).
> 권한 세분화는 3단계 몫이고, 그때까지는 "신뢰하는 사람에게만 위임" 이 전제다.
> `/seller/operators` 화면 문구도 그 전제로 썼다.
