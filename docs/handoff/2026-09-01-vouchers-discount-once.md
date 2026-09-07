# 교환권 화면 — 같은 숫자를 두 번 말하던 할인율 · 앰버 · 이모지 (2026-09-01)

대표 *"모두 진행해"* — 앞선 턴에 낸 개선 후보 6건 중 **5건 승인 처리, 1건 의도적 제외**.

## 무엇을 했나

| # | 무엇 | 어디 |
|---|---|---|
| ① | 카테고리 칩·사이드바·브랜드 해제 pill **앰버 7곳 → 잉크/중립** | `VouchersPage.tsx` |
| ② | 브랜드 칩 이미지 폴백 `🎁` → **브랜드 앞 두 글자** | `vouchers/shared.tsx` |
| ③ | `VoucherCard` 사진 위 할인율 배지 제거(가격 줄에 이미 있음) | `vouchers/shared.tsx` |
| ④ | `VoucherRow` 썸네일 위 회색 배지 → 가격 줄 앞 로즈 | `vouchers/shared.tsx` |
| ⑤ | ~~이용권 지갑~~ — **하지 않았다**(아래 사유) | — |
| ⑥ | 셀러 이모지 12곳 제거 | `TierBadge` · `SellerTierPage` · `SellerPromoteBoostsPage` + 6개 언어 |

덤: PC 섹션 헤더의 선물 아이콘 제거(모바일은 8-31 에 같은 사유로 이미 뺐는데 PC 만 남아 있었다).

## 왜 — 실측이 먼저였다

PC `/vouchers` 를 **1440px 로 실제 렌더**해 보니 카드마다 할인율이 **두 곳**이었다:

```
shared.tsx:96   <span className="absolute top-2 left-2 … bg-brand …">{discountRate}%</span>   ← 사진 위
shared.tsx:108  <span className="text-[15px] font-extrabold text-brand …">{discountRate}%</span>  ← 가격 줄
shared.tsx:191  <span className="absolute top-1.5 left-1.5 … bg-[#d1d5db] …">{discountRate}%</span>  ← 행 썸네일 위
```

같은 변수라 **언제나 같은 값**이다. 정보가 아니라 소음이고, 사진을 가린다.
그리고 이건 **새 규칙이 아니라 8-31 대표 지시**(*"할인율이 사진 안으로 들어가면 안돼"*)**가
형제 컴포넌트에 안 미친 것**이다 — 그때 동네딜 카드(`GroupBuyFeedCard`)만 고쳤다.

## 이번에 틀렸던/위험했던 판단

🩸 **`audit-gate` 를 타임아웃으로 끊었더니 자식이 살아남았다.**
`timeout 500 bash scripts/audit-gate.sh` 가 죽은 뒤에도 `check-guard-mutations.mjs -s`
**두 개(09:23·09:25 시작)가 계속 돌면서** 소스를 주입/복원하고 있었다. 증상은
`git status` 를 부를 때마다 **모르는 파일이 하나씩 바뀌어 나타나는 것**이었다.

그 상태에서 `git stash push -u` 를 했더니 스태시가 **남의 주입분 3개**를 삼켰다:
`tail-bound.ts`(`Promise.race` → `Promise.all`) · `HomeHeroDefault.tsx`(eager→lazy) ·
`company-save.ts`(suspect 가드 제거). 그대로 pop 했으면 **내 커밋에 섞여 들어갔다.**

⇒ **교훈 두 개**
1. `timeout` 은 셸만 죽인다. `audit-gate` 를 끊었으면 **`pkill -f check-guard-mutations` 로 자식을 확인**하라
   (`pkill` 만으론 안 죽어서 `-9` 가 필요했다).
2. 주입 사고를 막는 `check-no-injection-in-progress.sh` 는 **커밋 시점**에만 본다.
   `git stash` 는 그 앞이라 안 걸린다.

## ⑤ 를 안 한 이유

이용권 지갑은 **다른 세션이 대표 승인 시안으로 막 손댄 자리**다(git 히스토리 확인).
같은 화면을 두 세션이 각자 고치면 다음 세션이 어느 쪽이 의도인지 못 고른다. 손대지 않았다.

## 남은 것

- 잔여 UI 이모지 **15곳은 전부 어드민** — 대표가 이번 디자인 과업 범위에서 명시적으로 뺐다.
- `check-design-slop` 이모지 래칫 27 → **15** 로 갱신. 어드민을 손대게 되면 그때 더 내린다.

## 다음 세션 첫 액션

없음(이 갈래는 닫혔다). 교환권/유어샵 카드를 또 만질 일이 생기면 **먼저**
`voucher-card-discount-once.test.ts` 와 `deal-card-price-block.test.ts` 를 읽어라 —
**이 자리는 이미 세 번 뒤집혔다.**
