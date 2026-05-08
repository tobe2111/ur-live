# Phase 2 — 멀티 플랫폼 동시 송출 (Future)

> 🛡️ 2026-05-08 작성. 현 시점 미구현. Phase 1 (브라우저 → YouTube) 검증 + 안정화 후 착수.

## 배경

OvenMediaEngine 의 `RTMPPush` 는 한 stream 에 대해 **여러 push target** 을 동시에 등록 가능.
즉 셀러 1회 송출로 YouTube + Twitch + Facebook 모두에 fan-out 가능.

송출 비용 ₩0 (모든 플랫폼 RTMP 인입 무료).

## 미구현 사유 (현 시점)

| 항목 | Twitch | Facebook Live |
|---|---|---|
| OAuth 통합 | 약 3-4일 | 5-7일 (Meta Business 검증) |
| DB 스키마 (플랫폼별 토큰/키 저장) | 추가 필요 | 추가 필요 |
| 어드민 UI | 추가 필요 | 추가 필요 |
| 한국 셀러 가치 | ⭐⭐ (게임 중심) | ⭐⭐ (사용자 감소) |

→ 현재 셀러 수 / 라이브 검증 단계에서 ROI 약함.

## 트리거 조건

다음 중 하나 만족 시 착수:
1. 셀러 30명 이상 정기 라이브 (주 1회 이상)
2. 셀러 직접 요청 ("Twitch 도 같이 송출하고 싶다") 5건 이상
3. YouTube 라이브 정책 변경 등으로 다중 플랫폼 의존 필요성 발생

## 구현 스케치 (참고용)

### DB 스키마 추가

```sql
CREATE TABLE seller_streaming_destinations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL REFERENCES sellers(id),
  platform TEXT NOT NULL CHECK(platform IN ('youtube','twitch','facebook')),
  oauth_token TEXT,
  refresh_token TEXT,
  rtmp_url TEXT NOT NULL,
  rtmp_key TEXT NOT NULL,
  display_name TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(seller_id, platform)
);
```

### Worker admission webhook 확장

`omeAdmissionHandler` 에서 stream 의 `seller_id` 로 `seller_streaming_destinations` 전체 조회 →
각 플랫폼별로 OME `:startPush` API 호출 (반복).

기존 단일 YouTube push 로직을 loop 으로 변경.

### 프론트

`/seller/streaming-setup` 에 플랫폼 카드 추가:
- YouTube (현재 있음)
- Twitch (OAuth 연결 버튼)
- Facebook Live (OAuth 연결 버튼)

각 플랫폼 연결 시 RTMP URL/Key 자동 발급/저장.

### Cost

- 송출 트래픽: Oracle Free 10TB/월 한도 안 (3 플랫폼 fan-out = 셀러 1명 송출 시 outbound 3배)
- 100 셀러 × 30 라이브 × 1시간 × 2.5Mbps = ~3.4TB/월. 안전 마진 풍부.

## 예상 개발 기간

- Twitch only: 4-5일
- Twitch + Facebook: 7-10일

---

→ 트리거 조건 만족 시 별도 PR 로 착수.
