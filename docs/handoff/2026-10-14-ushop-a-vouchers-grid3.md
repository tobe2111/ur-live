# 2026-10-14 · 유어샵 A 구현 · 교환권 3열 시안

대표 *"유어샵 a안으로 확정하고 그리고 교환권은 3개씩 시안 보여주고 사진처럼 각 이용권마다 위에 브랜드 보여주도록"*
(참고 사진: 카카오 선물하기 3열 — `docs/design/assets/consumer-pages-2026-10-14/kakao-gift-grid-ref.jpg`)

## 다음 세션의 첫 액션
1. **교환권 3열 — 대표가 A·B·C 중 고르면 구현**(시안 `docs/design/assets/consumer-pages-2026-10-14/vouchers-grid3.jpg`, 추천 A).
   구현 자리: `src/pages/VouchersPage.tsx`(잠금표 — `[UNLOCK_LOADING]` + 대표 승인) 의 모바일 목록 + `src/pages/vouchers/shared.tsx` 카드 +
   서버 첫 화면 미러 `src/worker/utils/vouchers-first-screen.ts`(줄 6개 → 3열 격자, 같은 클래스). 잠긴 이미지 속성(width/height/srcSet/lazy/dominant_color)은 그대로.
2. 유어샵 A 배포 뒤 폰 `/u/jiwon1228` — 얼굴(사진) · 이름 24px · `이용권 N · 누적 구매 M` · SNS 이름표, 서버 첫 화면과 마운트가 안 밀리는지.
   사진 없는 유어샵(`/u/user5`)은 유달이.

## 완료분
- 유어샵 A: `CuratorHeader` 얼굴(사진/유달이 `SHARE_MASCOT_SRC`) + 숫자 줄(`curatorSoldTotal` SSOT) + SNS 이름표(`snsHitCls` 36px 탭 / `snsPillCls`).
  서버 첫 화면(`curator-ssr-body.ts`) 같은 클래스·같은 URL·같은 숫자. 가드 5개·주입 10건 재조준(불변식 유지 — 9차 '아바타 금지'는 '이니셜 원 금지'로).

## 이번에 틀렸던 판단
- 얼굴 배경을 `bg-brand-tint` 로 두었다가 a3-p1 가드(헤더의 채운 색 면은 `관리` 하나)가 잡았다 → `bg-wash`.

## 남은 결정
- 교환권 3열 A/B/C.
- "누적 구매" 는 진열된 상품의 **전체 판매 수 합**이다(이 유어샵을 거친 구매 수가 아니다) — 시안 A 의 정의 그대로. 다르게 원하면 서버 집계가 필요.
