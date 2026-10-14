# 카페 수집 끄기 + 어드민 카페 토글이 저장 안 되던 결함 (2026-10-14)

서비스: 📣 유어애즈 · 머니 경로 없음

## 대표 지시
*"일단 이제 카페는 꺼줘."* (같은 메시지: *"딜 사용 기록 이제는 영구적으로 계속 남아?"*)

## 한 것
- **카페 수집 OFF (라이브, 16:2x KST)** — `platform_settings.ads_collect_cafe = 'off'`.
  어드민 PUT `/api/admin/tools/settings` 로 썼다(원클릭 토글이 아래 결함으로 막혀 있어서). 확인: `GET /api/admin/ads/influencer-pool/collect-gates` → `enabled:false, setting:"off"`.
  env `ADS_COLLECT_CAFE_ENABLED` 는 안 건드렸다(세션은 플랫폼 쓰기 금지). 설정이 env 를 이긴다(`cafeCollectEnabled`).
- **결함 수리**: `PATCH /influencer-pool/:id` 가 먼저 등록돼 `PATCH /influencer-pool/collect-gates` 를 id 로 받아 "잘못된 ID" 로 거절했다
  ⇒ 어드민 카페 원클릭 토글(`CafeTrackToggle`)이 **만들어진 날부터 한 번도 저장되지 않았다**(GET 은 멀쩡해 정상처럼 보였다).
  `:id{[0-9]+}` 로 PATCH·DELETE 를 숫자 전용으로.
- 가드: `admin-ads-route-shadow-2026-10-14.test.ts` 4건(마운트 순서대로 펼쳐 고정 경로가 앞의 동적 경로에 먹히는지 전수) + 주입 2건 빨간불 확인.

## 딜 사용 기록 (실측)
- `point_transactions` 에 옛 CHECK 가 **아직 있다**(`type IN ('charge','donate','refund')`, 26행, 마지막 기록 10-12).
- 정비 도구 미리보기(`POST /api/admin/tools/point-ledger-unlock` 기본 dry-run): `had_check:true, applied:false, rows_before:26`. 실행은 대표(DDL, 되돌릴 수 없음).

## 다음 세션의 첫 액션
- 다음 수집 회차 뒤 `ad_influencer_leads` 의 `platform='naver_cafe'` 행 수가 17,870 에서 **안 늘었는지**(카페 OFF E4).
- 대표가 딜 정비를 눌렀다면: `SELECT sql FROM sqlite_master WHERE name='point_transactions'` 에 CHECK 가 없는지 + 26행 그대로인지.
