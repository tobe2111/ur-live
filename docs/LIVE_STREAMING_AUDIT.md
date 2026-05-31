# 라이브 송출 검토 (2026-05-31, 검증 기반)

서브에이전트 audit + **코드 직접 검증으로 과장 정정**. read-only 분석.

## 0. 결론
설계는 견고하고 **비용(유료전환)도 안전**(에이전트의 비용 폭발 주장 3건 모두 거짓). 실제 사용자 체감 화질/속도 이슈의 핵심은 **`latencyPreference: 'ultraLow'`** 트레이드오프 + (배포 안 된) SSR 로딩.

## 1. 💰 비용 — 안전 (에이전트 주장 정정)
| 에이전트 주장 | 검증 |
|---|---|
| YouTube 채팅 6s × 시청자 N → quota 폭발 | ❌ **거짓** — `GET /chat/:streamId`는 셀러 인증 전용(`youtube-chat.routes.ts:121` `WHERE seller_id`). 방송당 1명(방송자)만 폴링 → `live_chat_cache` 적재, 시청자 N명은 DO WebSocket/`/cached`. fan-in |
| 재고 폴링 시청자당 D1 폭발 | ❌ 과장 — `useProductStock.ts:56` `!document.hidden` 게이트 + 활성 카드만 |
| WS 실패 후 무한 폴링 | ❌ 대부분 거짓 — `useLiveStreamWebSocket.ts:239` `ws.onopen`이 폴링 interval clear |

## 2. 🔴 실제 화질/속도 원인
- **`youtube-live.routes.ts:1338` `latencyPreference: 'ultraLow'`** (2026-05-13 low→ultraLow). 지연 2-5s ↓ 이지만 YouTube 인코딩 사다리 축소 + 버퍼 작음 → **약한 네트워크에서 화질 저하·rebuffering**. = 화질/속도 체감 핵심. **지연 vs 화질 제품 트레이드오프.**
- **`ReelCard.tsx:455` `setPlaybackQuality('hd1080')`** — YouTube embed 에서 **무시됨(no-op)**. 화질은 YouTube ABR 자동. 이 코드는 효과 없음(해롭진 않음).
- 영상 자체 화질은 **방송자 업로드 비트레이트**(OBS/기기) 의존 — 플랫폼이 못 올림.

## 3. 🟡 유지보수/엣지 (비용·SPOF 아님)
- `youtube-live.routes.ts` **3368줄 God파일** — 분할 미완 + youtube_video_id backfill 중복(3곳). 유지보수 부채.
- 방송자 탭 닫힘 → status 'live' 가 cron(최대 12h)까지 유지. 단 중복 생성은 기존 가드 차단.
- OME 좀비 감지 = **의도적으로 자동 reset 제거**(false-positive 방지) → admin 알림만 = 안전한 선택(버그 아님).
- whip_url/vod_ready 컬럼 = repair-schema 의존 (WHIP/WebRTC ingestion 은 비활성 `webrtc_ingestion=false`).

## 4. 권장
1. **`latencyPreference` 결정** — 화질 우선이면 `'low'`(5-15s, 안정+화질↑), 실시간 우선이면 `'ultraLow'` 유지. **사용자 결정 필요** (커머스 실시간성 vs 화질).
2. SSR 배포(아래 로딩 항목) — 라이브 페이지 진입 속도.
3. (선택) `setPlaybackQuality` no-op 정리, God파일 분할.

## 5. 전반 느림과의 관계
라이브 페이지도 SSR/LCP 영향 받음. `docs/LOADING_ARCHITECTURE.md` + SSR 미배포(`docs/SSR_MIGRATION.md` TODO)가 전반 체감 속도의 핵심.
