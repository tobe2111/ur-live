# 소셜 자동화 — 유어딜 자체 홍보 (YouTube · Threads · Instagram)

> 2026-07-15 대표 "유튜브 컨텐츠 제작·업로드 자동화, 스레드 자동화, 인스타 자동화 모두 가능해? → 모두 가장 이상적으로 진행"

## 0. 정체성 — "유어딜 자체 홍보" (blog-ai 계열, 유어애즈 아님)

이 모듈은 **유어딜(소비자 서비스)을 홍보**하기 위한 자동화다. `blog-ai.ts`(블로그 자체홍보)의 형제이며,
**유어애즈(`content-studio.ts` — 광고주용 B2B 도구)와는 완전히 별개**다.

| | blog-ai (기존) | **social (이 모듈)** | content-studio (유어애즈) |
|---|---|---|---|
| 목적 | 유어딜 자체 홍보 | 유어딜 자체 홍보 | 광고주 대신 콘텐츠 생성 |
| 채널 | `/blog` | YouTube·Threads·Instagram | 광고주가 알아서 |
| grounding | `PROMO_BRIEF` | **`PROMO_BRIEF` 재사용** | 광고주 입력 |
| 게시 | 관리자 검토 후 발행 | 관리자 검토 후 발행 | 게시 안 함(초안만) |
| 소유 | main worker | main worker | ur-ads worker |

## 1. 절대 원칙 (기존 유어딜 룰 그대로 계승)

1. **초안 우선(draft-first)** — AI가 생성한 건 항상 `status='draft'`. **자동 발행 없음**. 관리자가 `/admin/social` 에서 검토 후 발행 버튼을 눌러야 실제 게시. (`blog-ai` 와 동일 · 2026-07-02 대표 "봇/가짜계정 금지, 정당 마케팅만" 룰 준수)
2. **킬스위치 기본 OFF** — 플랫폼별 게이트가 전부 꺼진 상태로 머지. 자격증명(토큰) 없으면 no-op. `SOCIAL_*_ENABLED` env 로만 켬.
3. **공식 API만** — Threads Graph API / Instagram Graph API / YouTube Data API v3. 헤드리스 브라우저 조작·스크래핑·자동팔로우·좋아요봇 **구현 안 함**(약관 위반·계정 정지).
4. **운영정보 유출 차단** — `PROMO_BRIEF` grounding + `OUTPUT_FORBIDDEN` 검증(수수료·정산·커미션·도매·폐기용어)을 blog-ai 와 동일하게 재사용. 위반 출력은 폐기.
5. **서비스 분리** — 소비자(유어딜) 홍보만. 도매(유통스타트/B2B) 유입 금지.
6. **토큰 at-rest 암호화** — `data-crypto.ts encryptAtRest/decryptAtRest`(KEK=`DATA_ENCRYPTION_KEY`). YouTube OAuth 가 이미 쓰는 방식.

## 2. 데이터 모델 (repair-schema 등록 + ensure 자동생성)

### `social_accounts` — 연결된 플랫폼 계정
| 컬럼 | 설명 |
|---|---|
| id | PK |
| platform | 'threads' \| 'instagram' \| 'youtube' |
| account_ref | 플랫폼 계정 식별자(Threads user id / IG business id / YT channel id) |
| display_name | 표시용 이름(@handle 등) |
| access_token_enc | 암호화된 액세스 토큰 |
| refresh_token_enc | 암호화된 리프레시 토큰(YouTube) |
| token_expires_at | 만료 시각(장기토큰 갱신용) |
| extra | JSON(예: IG 의 fb_page_id) |
| status | 'active' \| 'revoked' \| 'error' |
| created_at / updated_at | |

UNIQUE(platform) — 플랫폼당 유어딜 공식 계정 1개(단순화; 필요 시 확장).

### `social_posts` — 초안 → 예약/발행 상태머신
| 컬럼 | 설명 |
|---|---|
| id | PK |
| platform | 대상 플랫폼 |
| topic_slug | 생성 주제(중복 방지) |
| title | YouTube 제목 / 내부 라벨 |
| body | 본문(Threads 텍스트 / IG 캡션 / YT 설명) |
| hashtags | JSON 배열 |
| media_url | 이미지/영상 URL(IG 필수, YT 영상) |
| media_kind | 'none' \| 'image' \| 'video' |
| status | **'draft' → 'approved' → 'published' / 'failed' / 'archived'** |
| external_id | 게시 후 플랫폼 반환 id(멱등) |
| external_url | 게시물 URL |
| error | 실패 사유 |
| scheduled_at | (선택) 예약 시각 |
| published_at | 발행 시각 |
| ai_generated | 1=AI 초안 |
| created_at / updated_at | |

멱등: `external_id` 있으면 재발행 skip. 발행은 `status='approved' AND external_id IS NULL` CAS 선점 후 side-effect (머니룰 #1 동일 철학).

## 3. 모듈 구성 (`src/features/social/api/`)

- `social-brief.ts` — `PROMO_BRIEF` 재수출 + 플랫폼별 포맷 스펙 + `OUTPUT_FORBIDDEN`/`findForbidden` 검증(blog-ai SSOT 재사용).
- `social-content.ts` — `generateSocialDraft(apiKey, platform, topic)` → 검증된 `{title, body, hashtags}`. 1회 재시도.
- `social-store.ts` — `ensureSocialTables` + 계정/포스트 CRUD.
- `threads-client.ts` — Threads Graph API: 컨테이너 생성 → publish.
- `instagram-client.ts` — Instagram Graph API: 미디어 컨테이너 → publish(이미지/릴스).
- `youtube-upload.ts` — YouTube Data API v3 `videos.insert`(resumable). OAuth 토큰은 기존 `YouTubeAPIService` 재사용(+ 자동 리프레시).
- `social-publish.ts` — 오케스트레이터: 게이트 확인 → CAS 선점 → 플랫폼 디스패치 → external_id 기록. 전부 fail-soft.
- `social.routes.ts` — 어드민 라우트(adminApp 하위, `requireAdmin`).

## 4. 어드민 라우트 (`/api/admin/social/*`, requireAdmin + IP allowlist + audit)

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/accounts` | 연결 계정 목록(토큰 비노출) + 각 플랫폼 게이트 상태 |
| POST | `/accounts` | 계정 수동 등록(platform, account_ref, token…) — 토큰 암호화 저장 |
| DELETE | `/accounts/:id` | 계정 연결 해제 |
| GET | `/posts` | 초안/발행 목록(status 필터) |
| POST | `/posts/generate` | AI 초안 생성(platform, topicSlug?) → draft |
| PATCH | `/posts/:id` | 초안 편집(body/hashtags/media_url/scheduled_at) |
| POST | `/posts/:id/approve` | draft → approved |
| POST | `/posts/:id/publish` | approved → 실제 게시(게이트 ON + 계정 필요) |
| DELETE | `/posts/:id` | 초안 삭제/보관 |

## 5. Cron (`social-draft` — 주간, 게이트 OFF 기본)

`SOCIAL_AUTO_DRAFT_ENABLED==='true'` 일 때만 주간(월요일 배치)에 플랫폼별 미작성 주제로 **비공개 초안** 생성.
미검토 초안 과다(플랫폼별 ≥8)면 자동 중단(검토 유도). 발행은 절대 자동으로 안 함(대표가 검토 후 수동).

## 6. env (전부 기본 OFF / 미설정 시 no-op)

```
SOCIAL_THREADS_ENABLED     'true' 면 Threads 발행 허용
SOCIAL_INSTAGRAM_ENABLED   'true' 면 Instagram 발행 허용
SOCIAL_YOUTUBE_ENABLED     'true' 면 YouTube 업로드 허용
SOCIAL_AUTO_DRAFT_ENABLED  'true' 면 주간 초안 cron 동작
# 자격증명 (Cloudflare Secrets)
THREADS_APP_ID / THREADS_APP_SECRET        (선택 — OAuth 편의; 수동 토큰 등록도 가능)
META_APP_ID / META_APP_SECRET              (Instagram Graph — 공용 가능)
YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET  (기존 youtube 기능과 공유)
```

## 7. 플랫폼별 현실 & 대표 액션 (활성 전 필수)

### 🟢 Threads (가장 쉬움)
- Meta Threads API(정식). 텍스트/이미지/카루셀. 한도 게시 ~250/일.
- **대표 액션**: Meta 앱 생성 → Threads 권한 → 유어딜 공식 Threads 계정 장기토큰 발급 → `/admin/social` 에서 계정 등록 → `SOCIAL_THREADS_ENABLED=true`.

### 🟡 Instagram (앱 심사 필요)
- Instagram Graph API "콘텐츠 게시". **비즈니스/크리에이터 계정 + 페이스북 페이지 연결** 필수 + Meta 앱 심사(`instagram_content_publish`). 한도 50/24h. 텍스트-only 불가(미디어 필수).
- 미디어는 **공개 URL** 이어야 함(유어딜 R2/`media.ur-team.com` 사용 가능).
- **대표 액션**: 인스타 비즈니스 전환 → FB 페이지 연결 → Meta 앱 심사 → 계정 등록 → `SOCIAL_INSTAGRAM_ENABLED=true`.

### 🔴 YouTube (업로드는 자동, 영상 제작은 외부)
- Data API v3 `videos.insert` — 제목/설명/태그/공개범위 자동. 쿼터 10,000/일, 업로드 1600 → 하루 ~6개.
- **영상 렌더링은 Worker 에서 불가**(ffmpeg 없음). 이상적 경로:
  1. **메타데이터·대본·태그·썸네일 문구는 AI 자동 생성**(이 모듈).
  2. **영상 파일(mp4)** 은 (a) 외부 렌더 서비스(유어애즈 `media-gateway` 의 video provider 재사용) 또는 (b) 대표가 업로드한 소재를 `media_url` 로 지정.
  3. `youtube-upload.ts` 가 그 URL 을 받아 resumable 업로드.
- **대표 액션**: YouTube 채널 OAuth(기존 youtube 기능의 `YOUTUBE_CLIENT_*` 공유) → 계정 등록 → 영상 소재 준비 경로 확정 → `SOCIAL_YOUTUBE_ENABLED=true`.

## 8. 안전성 요약 (머지 시점)

- 전 게이트 OFF + 자격증명 미설정 → **라이브 영향 0**(라우트만 추가, cron no-op).
- 발행은 관리자 수동 + 게이트 ON + 계정 존재 3중 조건.
- 운영정보 유출은 grounding + 출력검증으로 원천 차단.
- ⚠️ 이 원격환경 npm 403 → build/vitest 는 CI. 실제 게시는 자격증명 세팅 후 staging 1회 검증 필수.

## 구현 로그
- (진행중) 2026-07-15 초안 — 설계 + 게이트드 foundation (Threads/Instagram/YouTube 커넥터 + 초안-우선 오케스트레이터 + 어드민 라우트 + 주간 cron). 전 게이트 OFF.
