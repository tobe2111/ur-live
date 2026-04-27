# TikTok Tier 1 통합 (T1)

> 작성: 2026-04-26
> 범위: TikTok 정책상 안전하게 가능한 통합만. 라이브 송출/Backstage API/정산 sync 는 불가.

## 가능한 것 / 안 되는 것 명확화

### ✅ Tier 1 (이번 PR)
- TikTok Login (공식 OAuth 2.0)
- Display API → 사용자 정보 (open_id, username, display_name, avatar)
- Display API → 비디오 목록 (녹화 영상, 라이브 X)
- 셀러 프로필에 TikTok 인증 뱃지 표시

### ❌ TikTok 정책상 불가
- 외부 RTMP 송출 (TikTok Live Studio / 모바일 앱만 허용)
- Live Backstage API (공개 API 없음)
- 다이아몬드 / 정산 데이터 sync (공개 API 없음)
- 라이브 채팅/기프트 이벤트 (공식 X — 비공식 lib 는 ToS 위반)
- 자동 영입 / IM 메시지 (Backstage 내부에서만)

## 사용자 작업 (TikTok 통합 활성화)

### 1. TikTok for Developers 앱 등록
1. https://developers.tiktok.com → My Apps → Create App
2. App name: "유어딜"
3. **Redirect URI**: `https://live.ur-team.com/seller/tiktok-callback`
4. **Scopes** 요청: `user.info.basic`, `user.info.profile`, `video.list`
5. **Login Kit** 활성화
6. **Display API** 활성화

### 2. Cloudflare Pages 환경변수
```
TIKTOK_CLIENT_KEY=<TikTok app client key>
TIKTOK_CLIENT_SECRET=<TikTok app client secret>
```

### 3. 마이그레이션 적용
```bash
wrangler d1 execute toss-live-commerce-db --remote --file=migrations/0220_seller_platform_links.sql
# 또는 /api/_internal/repair-schema 호출
```

## 동작 흐름

```
셀러 → /seller/profile 에서 [TikTok 연결] 버튼 클릭
  ↓
GET /api/seller/tiktok/auth-url
  → state 생성 (KV 5분 저장)
  → TikTok 로그인 URL 반환
  ↓
TikTok 로그인 페이지 → 권한 승인
  ↓
콜백 → /seller/tiktok-callback?code=xxx&state=xxx
  ↓
POST /api/seller/tiktok/callback (code, state)
  → state 검증 (KV)
  → code → access_token 교환
  → 사용자 정보 조회
  → seller_platform_links UPSERT
  ↓
프로필 페이지로 리다이렉트 → "TikTok @username" 뱃지 표시
```

## API 엔드포인트

| 메서드 | 경로 | 인증 | 동작 |
|---|---|---|---|
| GET | /api/seller/tiktok/auth-url | seller | OAuth URL 발급 |
| POST | /api/seller/tiktok/callback | seller | code 검증 + 토큰 교환 + 저장 |
| GET | /api/seller/tiktok/me | seller | 연동 상태 조회 |
| POST | /api/seller/tiktok/sync-videos | seller | 비디오 목록 동기화 |
| DELETE | /api/seller/tiktok/unlink | seller | 연동 해제 (soft) |

## 호환성

- TIKTOK_CLIENT_KEY 미설정 → 503 + `TIKTOK_NOT_CONFIGURED` 코드 (graceful)
- 마이그레이션 0220 미적용 → 500 + 명시 에러
- KV (RATE_LIMIT_KV) 없으면 state 검증 skip (보안 약화 — KV 설정 권장)

## 향후 (Tier 2)

- 비디오 자동 동기화 (cron) → 셀러 쇼츠 페이지에 자동 노출
- TikTok 인증된 셀러 = Q3 자동 평가 score +20 가산
- 셀러 프로필 카드에 TikTok 비디오 임베드 (TikTok SDK)
- Instagram / YouTube 같은 패턴으로 추가 (테이블 재사용)
