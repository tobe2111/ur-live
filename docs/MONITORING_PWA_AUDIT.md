# 모니터링 + PWA 운영 감사 — 2026-04-27

## 1. Sentry 통합 상태

### ✅ 구성 완료
- `@sentry/react` 통합: `src/sentry.ts`
- DSN 환경변수: `VITE_SENTRY_DSN` (Cloudflare Pages Variables)
- 비용 최적화 적용:
  - `tracesSampleRate: 0.1` (10% 성능 추적)
  - `sampleRate: 0.5` (50% 에러 샘플링)
  - `replaysSessionSampleRate: 0.05` (5% 세션 리플레이)
  - `replaysOnErrorSampleRate: 0.5` (에러 시 50%)
- PII 마스킹: `maskAllText`, `maskAllInputs`, `blockAllMedia`
- 에러 필터: 네트워크 에러 / 봇 / 광고 차단 등 무시
- Worker (백엔드) 도 별도 통합: `error-handler.ts:89`

### 🔴 운영 미적용 가능성 (사용자 액션)
1. **Cloudflare Pages 에 `VITE_SENTRY_DSN` 등록 확인**
   ```powershell
   curl.exe https://live.ur-team.com/api/version
   ```
   응답에 `secrets` 객체 없으면 진짜 등록 안 됨.

2. **Sentry 대시보드 → 프로젝트 설정 → DSN 복사** → Cloudflare 등록.

3. (선택) 백엔드 `SENTRY_DSN` 도 등록 — Worker 에러도 Sentry 로 전송.

### 검증 방법
```js
// 브라우저 콘솔에서 강제 에러 발생 (DSN 등록됐으면 1분 내 Sentry 대시보드에 표시)
import('@sentry/react').then(s => s.captureException(new Error('TEST_SENTRY_INTEGRATION')))
```

### 비용 예상
- 100,000 MAU 기준 약 $299~399/월 (위 샘플링 적용)
- DSN 미등록이면 0원 (Mock 모드)

---

## 2. PWA / Service Worker 충돌 점검

### 🔴 이전 상태 (버그)
1. `main.tsx:24-26` — 모든 SW 를 `unregister()` (sw.js 배포 누락 사고 후 비활성화)
2. `PushNotificationSetup` 컴포넌트가 `navigator.serviceWorker.ready` 를 await
3. SW 등록 안 된 상태에서 ready 는 영원히 resolve 안 됨 → **메모리 누수 + 푸시 알림 작동 X**

### ✅ 수정 적용 (2026-04-27)
- `PushNotificationSetup.tsx`: `getRegistration()` → null 이면 즉시 종료
- 푸시 알림 자체는 작동 안 하지만 메모리 누수는 차단

### 🟡 PWA 활성화하려면 (선택, 별도 PR)
1. **sw.js 빌드 결과물에 포함**:
   - 현재 `public/static/sw.js` 가 있지만 `_routes.json` 에서 제외 가능
   - Vite PWA 플러그인 (`vite-plugin-pwa`) 도입 권장
2. **VAPID 키 생성**:
   ```bash
   npx web-push generate-vapid-keys
   ```
   - Public key → Cloudflare `VITE_VAPID_PUBLIC_KEY`
   - Private key → Cloudflare `VAPID_PRIVATE_KEY` (Worker)
3. **manifest.webmanifest** 검증:
   - `public/manifest.webmanifest` 또는 동적 생성 (`public-utility.routes.ts`)
4. **iOS Add to Home Screen** 지원 확인

### 권장 우선순위
- 🟢 **현재**: 푸시 알림 비활성화 (수정됨) — 사용자에게 알림 권한 요청 안 함
- 🟡 **단기**: PWA 가이드 페이지 추가 (사용자가 수동으로 홈 화면 추가)
- 🟢 **장기**: 진짜 PWA + 푸시 알림 통합 — 별도 PR (1주 작업)

---

## 3. Discord 알림 통합 강화

### ✅ 새로 추가 (2026-04-27)
- **Reconciliation cron 알림**: `reconciliation.ts` 마지막에 `alertOnReconciliationAnomaly()`
- 트리거 조건:
  - `stuck_with_payment_key > 5` — 토스 결제됐으나 DB PENDING 주문 5건 초과
  - `auto_reconciled_paid > 10` — 평소보다 많은 웹훅 누락
  - `negative_stock_fixed > 0` — 음수 재고 발견 (코드 버그)

### 기존 알림 채널
- Cron 실패: `scheduled.ts` 의 `safeCron` 래퍼 → Discord
- Webhook 시크릿 미등록: `webhook.routes.ts:178` → Discord
- Toss 결제 confirm 회로 차단: `payment.routes.ts` → Discord

### 사용자 액션 필요
**Cloudflare 에 `DISCORD_WEBHOOK_URL` 등록 확인**:
- Discord 채널 → Integrations → Webhooks → Copy URL
- Cloudflare → Variables and Secrets → Add (Type: Secret) → `DISCORD_WEBHOOK_URL`

미등록이면 모든 알림 silent skip (정상 작동, 단순 알림 누락).

---

## 4. 테스트 커버리지 — 신규 추가 (2026-04-27)

이번 추가:
- `viewer-loyalty.test.ts` — 충성도 4단계 분류 (10 tests)
- `chat-moderation.test.ts` — 욕설/스팸/URL 검출 (17 tests, **버그 1개 발견 + 수정**)
- `agency-tier-label.test.ts` — 등급 라벨 매핑 (10 tests)
- `faq-bot-search.test.ts` — 검색 토큰화/스코어 (9 tests)

총 **46개 신규 테스트**. 주요 발견:
- **chat-moderation: `normalizeForMatching` 한글 전체 제거 버그** → 모든 한국어 메시지 block 처리됐던 심각한 버그 수정.

---

## 5. 다음 권장 (별도 PR)

1. **거대 파일 분할** (TD-006): SellerLiveBroadcastPage (2510줄), seller-management.routes.ts (2101줄)
2. **PWA 진짜 통합** — Vite PWA 플러그인 + 진짜 SW 등록
3. **Sentry Source Map 업로드** — Cloudflare Pages 빌드 후 `sentry-cli` 로 업로드
4. **e2e 테스트 확대** — Playwright 로 PK/캐스팅/이전 흐름

---

## 검증 명령

```bash
# 모든 단위 테스트
npm test

# 품질 검증 (스키마/인증/i18n/번들)
bash scripts/quality-check.sh

# 번들 크기 budget
npm run check:bundle:budget

# i18n 6개 언어 동기
npm run check:i18n
```
