# 2026-10-14 · 교환권 C · 이용권 지갑 B · PC 마이 B 구현

대표 *"교환권 C 배너가 머리 이거 좋다. 이용권은 B. PC 마이는 B."* (시안: `docs/design/consumer-pages-2026-10-14.md`)

## 다음 세션의 첫 액션
1. PR 머지·배포 뒤 라이브 판정(E4):
   - 폰 `urdeal.kr/vouchers` — 맨 위가 196px 배너이고 검색·보관함 아이콘이 그 위 오른쪽, 잔액 카드가 배너 아래 끝에 걸쳐 있는지. 배너 응답 전후로 잔액·칩이 **안 밀리는지**(`node scripts/check-layout-shift.mjs` 또는 프레임 캡처).
   - 폰 `/my-vouchers`(로그인) — 요약 카드(장수·합계) · 사용 가능 전부 같은 줄 + [사용] · 아래 추천 2장(가진 것 제외).
   - PC `/user/profile`(1440) — 머리·내 가게·설정·곧 쓸 이용권·내가 산 것이 전부 카드이고 왼쪽 선이 맞는지(렌더: `docs/design/assets/consumer-pages-2026-10-14/myB-impl*.jpg`).
2. 대표 판단 대기 두 건: **유어샵 시안 A~E**(추천 C) · **교환권 1줄 2개**(추천: 1줄 유지).

## 완료분
- c0938a068 교환권 C (`VouchersHero` · `HomeBannerStrip hero` · 서버 첫 화면 미러) `[UNLOCK_LOADING]`
- 141a44235 지갑 B (`WalletSummaryCard` · `WalletRow` 전부 · `WalletRecommend`) `[UNLOCK_LOADING]`
- (다음 커밋) PC 마이 B — `.ur-account-pc .ur-pc-card`(lg 전용) + 머리 카드 + 곧 쓸 이용권 = 지갑과 같은 `WalletRow`. 잠금 파일 무접촉.

## 이번에 틀렸던 판단
- HomeBannerStrip 에 hero 모드를 **삼항으로 끼웠다가** 테스트 정규식·주입 앵커 10곳 넘게를 깨뜨렸다 → 되돌리고 **덧붙이는 클래스**(`HERO_*_CLS`, tailwind `!`)로 다시 넣었다. 앵커가 많은 파일은 기존 문자열을 바꾸지 말고 더할 것.
- 히어로 카운터가 배너 한가운데 떴다 — `top`·`bottom` 둘 다 걸려 있었다(`!bottom-auto`). 렌더로만 보였다.
- PC 마이 렌더에서 아바타 자리가 비어 보이는 것은 하네스가 외부 아바타(ui-avatars)를 막아서다 — 결함 아님.

## 남은 결정
- 유어샵 A~E · 교환권 2열 여부(위).
- "판은 파는 쪽에만"의 **PC 예외**를 CLAUDE.md ⑦ 에 적었다 — 폰은 그대로.
