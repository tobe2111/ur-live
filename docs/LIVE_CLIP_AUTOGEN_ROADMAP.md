# 라이브 클립 자동 생성 — 로드맵 (Phase 3-7)

> **상태: 보류** (외부 인프라 의존). 본 문서는 향후 구현 시 청사진.

## 왜 이번 PR 에서 보류했나

라이브 영상 → 하이라이트 클립 자동 추출은 **Cloudflare Workers 만으로 불가능** 합니다.

### 필수 외부 인프라
1. **영상 저장소** — Cloudflare Stream / AWS S3 + MediaConvert / Mux
2. **영상 인코딩 GPU** — FFmpeg + ML 추론 워크로드 (Workers 의 30s/CPU 제한 초과)
3. **하이라이트 추출 ML** — 시청자 반응(피크 시청자/채팅 폭발/리액션) 기반 시간 슬롯 감지
4. **자막/썸네일 자동 생성** — 추가 ML

### 비용 추정 (월간)
- Cloudflare Stream: $5/1000분 인코딩 + $1/1000분 시청
- 라이브 100건/월 평균 1시간 = 6,000분 인코딩 = $30
- 시청 트래픽 별도 (시청자 노출에 따라)

## 구현 시 청사진 (향후 PR)

### 단계 1: 영상 저장 통합
1. 라이브 종료 시 (Durable Object 의 onClose hook) 영상 파일 저장
2. Cloudflare Stream 에 upload (`@cloudflare/stream` SDK)
3. `live_streams` 에 `cf_stream_uid` 컬럼 추가
4. 마이그레이션: `ALTER TABLE live_streams ADD COLUMN cf_stream_uid TEXT;`

### 단계 2: 하이라이트 슬롯 감지 (서버사이드)
- 메트릭 기반 (이미 `live_stream_metrics` 있음 — peak 시점 추적):
  - 시청자 수 급증 구간 (5분 단위 윈도우)
  - 채팅 폭발 구간 (분당 채팅 수 1.5배 이상)
  - 리액션/후원 발생 구간
- 알고리즘:
  ```ts
  // pseudo-code
  const slots = analyzeMetricsTimeline(liveStreamId);
  const top3 = slots.sort((a,b) => b.score - a.score).slice(0, 3);
  // top3 = [{ start: 1200, end: 1290, type: 'viewer_peak' }, ...]
  ```

### 단계 3: 클립 추출 (FFmpeg via Cloudflare Stream API)
```ts
// Cloudflare Stream 의 'clips' API 사용
const clipUrls = await Promise.all(top3.map(slot =>
  fetch(`https://api.cloudflare.com/client/v4/accounts/${ACC_ID}/stream/clip`, {
    method: 'POST',
    body: JSON.stringify({
      video_uid: cf_stream_uid,
      start_time_seconds: slot.start,
      end_time_seconds: slot.end,
    }),
  })
));
```

### 단계 4: 쇼츠로 변환 + 게시
- 추출 클립 → 9:16 비율 자동 크롭 (Cloudflare Stream 변환 옵션)
- 셀러 대시보드 "라이브 하이라이트 → 쇼츠 발행" 버튼
- 또는 자동: TikTok / 인스타 릴스로 자동 업로드

## 우선순위 권장

운영 데이터 충분히 쌓일 때까지 (3~6개월):
1. **메트릭 기반 분석** 만 먼저 (`live_stream_metrics` 활용)
2. 셀러에게 **"이 시간대 하이라이트입니다 → 직접 편집해보세요"** 알림
3. 운영 안정화 후 영상 저장소 통합 → 자동화

## 현재 대체 가능한 것

- **`live_stream_metrics`** (이미 구현됨, Phase 2-4) — 메트릭 데이터는 이미 집계됨
- **Calendar 페이지** — 라이브별 KPI 카드 (피크 시점 추측 가능)
- **셀러가 수동으로** 라이브 종료 후 OBS 녹화/스마트폰 화면 녹화로 클립 만들기

## 결정

이 기능은 **별도 PR + 외부 서비스 계약** 필요. 본 세션 스코프 외.
참조: `TIKTOK_BACKSTAGE_LEARNING_v2.md` Phase 3 항목 #1.
