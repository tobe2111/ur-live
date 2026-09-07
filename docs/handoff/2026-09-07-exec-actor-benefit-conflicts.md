# [E2] 승인 실행기 1회차 — 결재 `2026-09-07-actor-benefit-conflicts` 중 Q3-3 (채널 필수 선택)

> 실행기: 이 세션 바인딩 루틴 `trig_01BmSbMMZfpnC1TBF3xWfRGF`(fresh-session 은 푸시 불가로 21:16 KST 판정 후 교체).
> 결재 실행 계획의 순서 Q3-3 → Q2-1 → Q4-2 중 **첫 번째**. WIP 1 이라 나머지 둘은 이 PR 이 머지된 뒤 다음 회차가 집는다.

## 무엇을 했나 (dev 역할 · 머니 경로 무접촉)
- **이미 돼 있던 것**: 매장이 생기는 두 문은 2026-09-04/05 부터 채널을 찍는다(`/store/new` 필수 선택 · `/register-from-user`=direct). 서버 `POST /stores` 도 `isChannel` 필수. ⇒ 새 매장에 미지정은 없다.
- **비어 있던 것**: 그 전 매장(08-31 실측 11곳 중 10곳 미지정)을 `GET /fee-context` 가 `channel:'brokered'` 로 **보여 줬다** — 사실은 "미지정" 인데 화면은 "중개 운영".
- **수정**
  - `seller-store-channel.routes.ts`(신규): `pickStoreChannel`(미지정 → 화면용 null · 정산용 effective 는 종전 brokered 폴백 그대로) + `POST /fee-context/channel` **set-once**(이미 있으면 409, 변경은 어드민).
  - `GET /fee-context` 응답 `channel: null | 'direct' | 'brokered'` + `channel_set`.
  - 이용권 등록 위저드 1단계: `channel_set === false` 면 선택 카드(`StoreChannelRequired`, `StoreRegisterModal` ③ 과 같은 문구) + 고르기 전엔 다음 단계 차단(fail-open: 판정 실패는 안 막는다 — storeReady 와 같은 규칙).
  - `NetProceedsCard` 라벨: null 채널 = "운영 방식 미선택"(종전엔 "중개 운영").
  - 6개 언어 키 `seller.mealVoucher.channel*`.
- **하지 않은 것(결재 명시)**: D1 일괄 UPDATE 백필 없음 · 정산 폴백(`fee-resolver`·`ledger-commission-policy`·`influencer-store-intro-commission` "미지정=미지급") 무접촉.

## E2 증거
- tsc 0 · vitest 관련 6파일 56 pass(신규 `store-channel-required-2026-09-07.test.ts` 12) · guard-mutations 주입 1건 `--only` 빨간불 확인.
- 파일 크기: `seller-stores.routes.ts` 547 → 554(신규 엔드포인트는 별도 모듈).

## E4 판정(머지 후 dev 루틴)
- 라이브에서 미지정 좌석(예: 09-04 이전 매장)으로 `/seller/meal-voucher/new` 진입 → 카드가 뜨고, 고르면 `seller_meta.store_channel` 1행 생성 + 재진입 시 카드 없음. `GET /api/seller/fee-context` 가 `channel_set:false → true`.
- 09-04 이후 매장·이미 채널 있는 매장은 **아무 변화 없음**(카드 미노출).

## 다음 회차가 집을 것
- Q2-1 (finance · 머니): `max_influencer_commission_pct` clamp 제거/무효화 — PR 까지, 설정·배포는 staging 뒤 대표.
- Q4-2 (finance · 머니): `STAGING_CHECKLIST` 항목 + platform-model §5-3 원칙 문단 정리. 게이트 ON 은 대표.
