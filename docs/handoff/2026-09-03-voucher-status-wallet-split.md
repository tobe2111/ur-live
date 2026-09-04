# 이용권 현황이 교환권까지 세던 것 — 마이페이지가 자기 자신과 모순

**대표 신고(2026-09-03)**: *"이용권 구매완료 사용가능 되어있는데 잘못됐어"*

## 증상

같은 화면 안에서 두 숫자가 어긋났다.

```
이용권 현황   구매완료 1 · 사용가능 1 · 사용완료 0 · 만료·환불 0
나의 이용 내역 → 내 이용권                                    0    ← 40px 아래
```

대표는 이용권을 산 적이 없다(직전 대화에서 확인 — *"물론 이용권을 구매하진 않았어"*).

## 실측한 그 1건의 정체 (라이브 D1)

```
users.id = 3 (정지원)
vouchers      id 1 · product 118 · status='expired'   ← API 가 제외한다(아래 ①)
voucher_orders id 1 · KT-알파 교환권 · status='failed' · sent_at = NULL   ← 화면에 뜬 그것
                       goods_name '아메리카노(Hot)(TAKE-OUT)'
```

products 118 은 `kt_alpha_gift_code='G00003421443'` 를 갖고 있어서, `/api/vouchers/my` 의
`AND (p.kt_alpha_gift_code IS NULL OR ...)` 조건이 내부 `vouchers` 행을 **중복으로 보고 제외**한다.
그래서 화면의 1건은 **문자조차 못 받은 교환권 하나**였다.

## 원인 둘

### ① 지갑을 안 나눴다

`/api/vouchers/my` 는 이용권(내부 `vouchers`)과 교환권(KT `voucher_orders`)을 **한 배열**로 준다.
아래 "내 이용권"/"내 교환권" 두 행은 `useMyCounts` 가 `shared/voucher-wallet` SSOT(`isStoreVoucher`)로
갈라 세는데, **이 바만 통째로 셌다.** 그래서 교환권 한 장이 '이용권'으로 둔갑했다.

### ② 모르는 상태를 '사용가능' 으로 셌다

분류가 `used`/`refunded`/`expired` 만 알고 나머지를 전부 `else → c.usable++` 로 떨어뜨렸다.
그런데 KT 병합은 **발송 실패**를 이렇게 실어 보낸다(2026-06-17 — 카드가 실패 UI 를 그리라고):

```ts
status: (vo.status === 'sent' || vo.status === 'failed') ? 'unused' : 'processing',
kt_status: vo.status,
```

⇒ `status:'unused'` 라 else 폴백이 **'지금 쓸 수 있음'** 으로 집계했다. `processing`(전송 중)도 같았다.

## 고친 것 (`OrderStatusBar.tsx` 한 파일)

1. `if (!isStoreVoucher(v)) continue` — 이 바는 **이용권만** 센다. 라벨도 목적지(`/my-vouchers`)도
   이용권이고, 아래 두 행과 **같은 SSOT** 를 쓰므로 이제 한 화면이 두 답을 말할 수 없다.
2. `else c.usable++` → **허용목록** `if (st === 'unused' || st === '')`. `''` 는 컬럼
   DEFAULT(`'unused'`)와 같은 뜻이라 함께 받는다. 그 밖은 어느 칸에도 안 넣는다 —
   구매완료는 총계라 나머지 셋의 합과 달라도 된다. **틀린 칸에 넣느니 안 세는 게 낫다.**

⇒ 대표 계정은 이용권 0장이므로 `counts.bought === 0` → 바가 아예 안 뜬다(기존 "산 적 없으면 숨긴다"
동작 그대로). "내 이용권 0" 과 답이 같아진다.

## 검증

`tsc 0` · 신규 **8건 pass**(jsdom 에 실제 컴포넌트 렌더 — 대표 계정의 실측 행을 픽스처로 씀) ·
관련 3파일 35건 pass · **주입 2건 각각 되돌려-검증 빨간불 확인** · guard-registry 124 · theme OK · file-size OK.

⚠️ **이 테스트가 못 잡는 것**: 서버가 지갑 판정 필드(`source`/`deal_only`)를 **안 보내는** 경우.
컬럼 누락 폴백 SELECT 는 `deal_only` 를 빼고 오고(`group-buy-public.routes.ts` 2단 폴백),
그때는 `source` 만으로 판정된다 — 그 경로는 재현하지 않았다.

## 남은 질문 (대표 판단)

- **발송 실패한 교환권을 "내 교환권 1" 로 세는 게 맞는가.** 지금은 센다 — 목록에 실패 카드가 떠서
  *"결제됐는데 안 왔다"* 를 사용자가 알 수 있게 하려는 2026-06-17 의 의도다. 그 의도는 살리되
  숫자에서 빼는 선택지도 있다. 이번 PR 범위 밖이라 건드리지 않았다.
- **대표 계정의 그 교환권은 실제로 발송 실패 상태로 남아 있다**(`voucher_orders` id 1,
  `sent_at` NULL). 재발송이 필요한지는 데이터 조치라 별건이다.

## 다음 세션 첫 액션

1. 배포 후 `/user/profile` 에서 "이용권 현황" 섹션이 **사라졌는지** 확인(이용권 0장이므로).
2. 이용권을 실제로 하나 사면 그때 `구매완료 1 · 사용가능 1` 이 뜨고 "내 이용권" 도 1 이어야 한다 —
   두 숫자가 같은지가 이 수정의 진짜 판정이다.

## 남은 것

- P13/P14 — 홍대돈가스 이용권으로 대표 검증 대기(A안).
- 낡은 주석 2건: `group-buy-voucher.routes.ts` "self_free 현행 기본", `SellerVoucherScanPage` "4자리".

**Notion**: 머지 후 기록.
