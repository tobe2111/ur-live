# 🚧 진행 중 작업 (Live Broadcast Option D + 부가 개선)

**최종 업데이트**: 2026-05-11
**브랜치**: `claude/add-theme-support-E6AwF`
**최근 커밋**: `211071d6` (Option D 완전 최적화)

새 세션 진입 시 이 문서를 먼저 읽고 이어서 작업할 것.
CLAUDE.md 가 자동 읽힘 → 이 파일 경로 명시되어 있음.

---

## ✅ 완료 (최근 5개 커밋)

| 커밋 | 내용 |
|---|---|
| `211071d6` | **Option D 완전 최적화** — 라이브 시작 25s → 3s, 화질 4.5→6Mbps, 음질 128→192kbps |
| `ef98ec2e` | **Option D 1차** — YouTube WHIP direct (browser→YouTube, OME 우회) |
| `b6e94cf8` | 자가 audit 14개 이슈 중 P0-P4 수정 (StepLive, webcam timeout, permission UX, video quality) |
| 이전 | OME push Duplicate ID race 수정, broadcast `ready→live` 직접 전환 |

### 핵심 아키텍처 (현재 상태)

```
셀러 브라우저 ──── WebRTC/WHIP ────→ YouTube
                  (rtmp_key 있으면 직접)

폴백 1: OME WHIP (rtmp_key 없을 때)
폴백 2: OBS/Larix RTMP 가이드
```

**YouTube broadcast 설정** (`youtube-api.service.ts:227`):
```
enableAutoStart: true      // ⭐ YouTube 가 자동 ready→live (수동 transition 불필요)
enableAutoStop: false      // 브라우저 일시 끊김에도 라이브 유지
enableMonitorStream: false // testing 단계 스킵
```

**WHIP 토큰 엔드포인트** (`/api/seller/youtube/streaming/whip-token`):
- `stream.rtmp_key` 있으면 → `https://a.upload.youtube.com/upload/streamer?streamKey=...` 반환 (`mode: 'youtube_whip'`)
- 없으면 → OME WHIP URL (`mode: 'ome_whip'`)

**탭 닫힘 정리** (커밋 진행 중):
- BrowserBroadcaster `beforeunload`/`pagehide` → `sendBeacon('/live/:id/end-beacon', { token, reason })`
- 백엔드: 토큰을 body 로 받아 검증 (Authorization 헤더 불가)

---

## 🔄 진행 중 / 다음 작업

사용자 요청: **기능 개선만, UI 복잡화 제거**.

| # | 항목 | 상태 | 위치 |
|---|---|---|---|
| #1 | 탭/브라우저 닫힘 자동 정리 (sendBeacon) | ✅ 완료 (`c06b9572`) | `BrowserBroadcaster.tsx`, `youtube-live.routes.ts` |
| #6 | 라이브 시작 5s 후 thumbnail 자동 캡처 | ✅ 완료 | `BrowserBroadcaster.tsx`, `seller-streams.routes.ts` |
| #7 | 라이브 종료 후 VOD 자동 임베드 | ✅ 이미 작동 | `recordFromStart: true` + 동일 video_id |
| #8 | YouTube 도메인 preconnect 확장 | ✅ 완료 | `index.html` (i.ytimg/s.ytimg/yt3.ggpht 추가) |
| #10 | YouTube API quota 추적 | ✅ 완료 | `youtube-quota.ts` + admin endpoint `/live/_quota?admin_token=...` |
| #11 | 채팅 spam filter (서버측) | ✅ 완료 | `durable-object.ts` moderateChat 통합 |

### 사용자가 제외 (UI 복잡화)
- #3 송출 품질 인디케이터 (제거됨)
- #4 라이브 전 테스트 모드 UI 강화 (skip)
- #5 화면 공유 토글 (skip — 기능 자체는 좋지만 UI 추가 필요)
- #12 상품 카드 스와이프 전환 (skip)
- #13 시청자 좋아요 애니메이션 (skip)

### 이미 처리됨
- #2 OAuth 토큰 refresh: `getValidAccessToken()` 이 5분 버퍼로 자동 갱신
- #9 어드민 모니터링 대시보드: 별도 결정 보류 (UI 추가됨 — 사용자 의도 확인 필요)

---

## 🎯 다음 우선순위 후보 (사용자 결정 필요)

기능 개선 추가 후보 (UI 안 건드림):
- **자동 quota 알림** — quota 80%/95% 도달 시 어드민에게 알림 (현재는 GET 으로 수동 조회만)
- **wakeLock 강화** — 모바일 백그라운드 진입 감지 + 셀러 알림
- **stream stuck 자동 감지** — 라이브 60분 + viewer 0 = 의심 → 어드민 대시보드 표시
- **재방송 자동 카탈로그** — ended 라이브의 VOD 를 별도 페이지 (`/live/recap/:id`) 로 노출
- **셀러 retry 자동화** — 라이브 시작 실패 (예: YouTube 403) 시 자동 1회 재시도

---

## ⚠️ 주의사항 / 컨텍스트

1. **OME 서버는 fallback 전용**: 셀러 90% 는 YouTube WHIP direct 사용 → OME 트래픽 미미. Hetzner 서버 유지 비용 거의 0.
2. **`enableAutoStart=true` 변경 이력**: 이전엔 `false` 였음 (수동 transition 필수). 변경 후 YouTube 가 자동 전환 → 모든 retry/delay 로직 제거됨. 기존 stream 은 옛 broadcast 설정 가질 수 있음.
3. **DIAGNOSE_TOKEN** = `Xk8m2P9qL3vR7nT5wY1bH4dF6jC0aZ` (Cloudflare env). 진단 endpoint admin bypass 용:
   - `GET /api/seller/youtube/live/:id/diagnose?admin_token=...`
   - `POST /api/seller/youtube/live/:id/_force-live?admin_token=...`
   - `POST /api/seller/youtube/live/_cleanup-pushes?admin_token=...`
4. **stream 62**: 마지막 검증 라이브 — 정상 작동 확인됨 (life_cycle_status=live, RTMP 14MB 전송).

---

## 📋 다음 세션 시작 시 체크리스트

1. 이 파일 (`docs/CURRENT_WORK.md`) 먼저 읽기
2. `git log --oneline -10` 으로 최근 커밋 확인
3. `git status` 로 미커밋 변경사항 확인
4. 위 "진행 중 / 다음 작업" 표의 다음 항목 진행
5. 완료 시 이 파일 업데이트 + commit + push
