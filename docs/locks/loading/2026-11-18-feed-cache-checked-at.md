# [UNLOCK_LOADING] 2026-11-18 — 공구 피드 캐시: 목록이 그대로인 회차는 '확인 시각' 한 줄만

- **승인**: 대표 *"응 두개 다 해줘"* (2026-11-18).
- **파일**: `src/features/group-buy/api/group-buy-public.routes.ts`(잠금표 — Cache-Control 분리·tiers 서버 parse 는 **그대로**) · `src/worker/cron/group-buy-feed-cache.ts`.
- **실측(전)**: 지문이 같은 회차마다 `UPDATE group_buy_feed_cache SET computed_at = datetime('now')` — 24행 + 색인, 하루 10,800줄(메인 쓰기의 13%).
- **바꾼 것**(판정은 `feed-cache-age.ts` — 잠금 파일 줄 상한 때문에 분리): 지문이 같으면 `platform_settings.gb_feed_cache_checked_at` 한 줄만. 소비자는 `computed_at` 이 10분을 넘었을 때만 그 시각을 읽어 신선도를 본다(신선하면 추가 읽기 0).
- **같은 것**: 10분 신선도 규칙 · 60분 강제 전체 갱신 · 무효화(`DELETE FROM group_buy_feed_cache`) 뒤 행이 없으면 실시간 쿼리로 가는 것.
- **판정(배포 뒤)**: 메인 D1 쿼리 통계에서 `UPDATE group_buy_feed_cache SET computed_at` 0회 · 홈 피드 `X-Cache`·응답 시간 종전과 같음.
- 가드 `d1-read-diet.test.ts` ②(2건) · 주입 2.
