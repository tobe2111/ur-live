# [LOADING_ADDITIVE] 목록 카드 'SNS 후기 N' — 2026-11-09

- **대표 지시(그대로)**: 개선 제안 5번(*"목록 카드에 '후기 N' 표시 — 잠긴 파일이라 허가가 필요합니다"*)을 포함한 목록에 *"모두 진행"*.
- **잠금 파일 1 — `src/pages/main-home/GroupBuyFeedCard.tsx`**: 별점 줄 **안에** `<span>` 하나(`creator_count > 0` 일 때만).
  새 줄을 만들지 않는다 → 카드 높이 불변(밀림 0). 잠긴 항목(hover/touch/viewport prefetch · `React.memo` · rootMargin 100px · 사진 fade-in · aboveFold eager) **한 줄도 안 바꿨다.**
  문구 함수는 `src/shared/home-creator-count.ts`(3줄 — 홈 청크 무게 사실상 0) — 서버 첫 화면(`home-first-screen.ts`)이 같은 함수로 미러한다.
- **잠금 파일 2 — `src/features/group-buy/api/group-buy-public.routes.ts`**: 응답 **body enrich 한 줄**(`attachCreatorCounts`, fail-soft).
  `Cache-Control` / `CDN-Cache-Control` 분리 · `group_buy_tiers` 서버 parse · 캐시 키 **불변**. 2026-05-30 current_price · 2026-07-02 fcfs enrich 와 같은 additive 패턴.
  비용: 캐시 miss 때 D1 읽기 1회(가게 키 IN … GROUP BY — 인덱스 `idx_scc_store_status`). 엣지 900s 캐시 뒤라 적중 시 0.
- 같은 커밋: cron `group-buy-feed-cache.ts` 도 같은 헬퍼로 숫자를 싣는다(지문 게이트 불변 — 콘텐츠 수만 바뀐 경우는 강제 갱신 주기에 따라간다).

## 롤백
카드의 `creator_count` span 1줄 · 라우트의 `let withFcfs = ...attachCreatorCounts(...)` 를 `let withFcfs = mapped` 로 · cron 의 `attachCreatorCounts(` 감싸기 제거.
