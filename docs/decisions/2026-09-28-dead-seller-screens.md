# 죽은 셀러 화면 둘(consignment·youtube-growth)을 어떻게 할까

상태: approved
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

## 선택지

1. `consignment` 은퇴 + `youtube-growth` 를 전체 도구에 노출 — 깨진 건 치우고 파는 건 문을 낸다. 머니 접촉 없음(노출만)
2. 둘 다 은퇴 — 라우트는 리다이렉트로 남기고 화면 제거(`/my-store` 와 같은 방식). 머니 접촉 없음
3. `consignment` 을 살린다 — `repair-schema` 에 테이블 추가 + 진입점 신설. ⚠️ **위탁 정산은 머니 경로** → 단독 세션 + staging 실결제
4. 안 함 — 깨진 화면이 그대로 남는다

## 기본안 (답이 없을 때 권하는 것 — 자동 실행되지 않는다)

1. `consignment` 은 이미 깨져 있어 치우는 것이 현상 유지보다 안전하고, `youtube-growth` 는 팔 생각이면 문이 있어야 한다.

## 롤백

은퇴분은 라우트를 리다이렉트에서 페이지로 환원(커밋 revert). 노출분은 색인에서 항목 제거.

## 결정 (대표가 한 말 그대로)

2026-09-28 대표: **"3번은 모두 없애줘."** (선택지 2 — 둘 다 은퇴)

⇒ `consignment`·`youtube-growth` 둘 다 화면 제거, 라우트는 리다이렉트로 남긴다(`/my-store` 방식).
   ⚠️ `youtube-growth` 는 **결제가 붙은 유료 기능**이라 은퇴 = 파는 문을 닫는 것이다. 매출 0원이라
      잃는 돈은 없지만, 되살리려면 커밋 revert 로 돌아온다는 것을 기록해 둔다.

## 반영 커밋

<비워 둔다>
