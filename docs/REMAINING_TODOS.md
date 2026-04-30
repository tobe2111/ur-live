# 남은 작업 (2026-04-30 세션 종료 시점)

## 🔴 P0 — 즉시 권장 (사용자 액션, 보안)

### 1. 바로빌 API 키 회전 (5분)
**왜**: `src/services/barobill.ts` 의 키 2종이 git history 에 영구 노출됨.
- TEST: `03148F80-9525-4A00-83B4-1AE55DFFA2DF`
- PROD: `DFCC6BDD-BF1E-4AA9-B12D-9CBE3DFC8068`

**할 것**:
1. Barobill 대시보드 로그인 → API 키 재발급
2. Cloudflare Pages → Settings → Variables and Secrets → 추가:
   - `BAROBILL_TEST_API_KEY` (Plaintext or Secret)
   - `BAROBILL_PROD_API_KEY`
3. 옛 키 폐기 확인

> ⚠️ 현재 `barobill.ts` 는 어디서도 import 안 됨 (tree-shake) → 실제 영향 0. 그러나 history 노출이라 회전 필수.

### 2. TD-001 — Cloudflare D1 Edit 권한 추가 (30분)
**왜**: D1 schema migration CI 차단 → migration 0233 등 적용 못 함.

**할 것**:
1. Cloudflare Dashboard → My Profile → API Tokens
2. 기존 token 편집 → Permissions → **Account > D1 > Edit** 추가
3. 저장
4. GitHub Actions → `migrate.yml` 워크플로우 수동 실행

해결 시 자동 후속 가능:
- ✅ Migration 0233 적용 → `stock_quantity` / `base_shipping_fee` legacy 컬럼 drop → TD-005 마무리

---

## 🟡 P1 — 권장 (1주 이내)

### 3. TD-008 — INTERNAL_CRON_TOKEN 등록 (5분)
```bash
openssl rand -base64 32
```
출력값을 Cloudflare Pages → Variables 에 `INTERNAL_CRON_TOKEN` 등록 (Secret).

### 4. TD-003 — 유령 Cloudflare 프로젝트 정리 (1시간)
**왜**: `ur-live-global`, `ur-live-cleanup-cron` 등 사용 안 하는 Workers 가 매 push 마다 빌드 시도 → false-positive CI 실패 알림.

**할 것**: Dashboard → Workers & Pages → 사용 안 하는 프로젝트 GitHub integration 해제 또는 삭제.

### 5. PWA 아이콘 다양화 (30분, 코드 작업)
**왜**: 현재 `favicon.svg` 만 있어 PWA 설치 시 일부 OS에서 깨짐.

**할 것**:
- `/public/icon-192.png` (192x192)
- `/public/icon-512.png` (512x512)
- `/public/icon-maskable-192.png` (Android adaptive)
- `manifest.webmanifest` 의 `icons` 배열 업데이트

---

## 🟢 P2 — Tier 1 UX 도달 (앱 출시 — 1~2주 + Apple/Google 심사)

자세한 내용: `docs/UNIVERSAL_LINK_DEPLOYMENT.md`

### 6. iOS Universal Link 활성화
1. **Apple Developer 등록** ($99/yr)
2. Team ID 발급 → `public/.well-known/apple-app-site-association` 의 `TEAMID` 교체
3. `npx cap sync ios && npx cap open ios`
4. Xcode 에서 Signing & Capabilities → Associated Domains 확인 (entitlements 파일 이미 생성됨)
5. Archive → App Store Connect → 심사 (1-3일)
6. 심사 통과 시 자동 활성

### 7. Android App Link 활성화
1. **Google Play Console** ($25 1회)
2. Keystore 생성 → SHA256 추출:
   ```bash
   keytool -list -v -keystore your-keystore.jks -alias your-alias
   ```
3. `public/.well-known/assetlinks.json` 의 `sha256_cert_fingerprints` 교체
4. `npx cap sync android && npx cap open android`
5. Signed Bundle 생성 → Play Console 업로드 → 심사 (1-3일)
6. 심사 통과 시 자동 활성

### 8. (선택) Smart App Banner — iOS Safari 상단
앱 출시 후 App Store ID 발급되면:
```html
<meta name="apple-itunes-app" content="app-id=APP_STORE_ID">
```
`index.html` `<head>` 에 추가 → Safari 상단에 "앱에서 열기" 배너 자동 표시.

---

## 🟢 P3 — 점진 개선 (코드, 별도 PR)

### 9. TD-014 i18n 462건 — 6언어 번역
**왜**: 결제·인증 흐름 한국어 하드코딩 多. 글로벌 배포 시 필수.

**할 것**:
- 번역가 review 후 우선순위:
  1. CheckoutPage / TossPaymentWidget (결제 — 가장 critical)
  2. SellerPinPrompt / Kakao 인증 (보안 메시지)
  3. NotificationsPage / LivePageV2 / ShortsPage
  4. Admin/Agency 운영자 영역

### 10. 알림톡 옵트인 모달 (대체 알림 채널)
**왜**: PWA / 외부 브라우저 못 가는 사용자에게 대안 필요.

**할 것**: `InAppFeatureBlockedModal` 의 `onAlternative` 콜백 활용 — `notification` feature 일 때 "카톡으로 받기" 버튼 추가 → 알림톡 구독 API 연결.

### 11. restaurant-map Phase 5 — 인플루언서 영상 thumbnail
**왜**: 매장 카드에 셀러의 라이브 영상 thumbnail 추가하면 발견성 ↑.

**할 것**: `/api/restaurants` 응답에 `live_streams.thumbnail_url` JOIN 추가, 프론트는 ReactCard 형태로 표시.

### 12. 코드 품질 잔여 (CLAUDE.md 규칙)
- `catch {}` 91건 → `swallow()` 헬퍼 변환 (별도 PR)
- `: any` 130건 → 점진적으로 proper type
- Toss 결제 환불 idempotency key 표준화

---

## 📊 현재 인프라 상태 (모두 ready, 활성화만 남음)

| 영역 | 상태 |
|---|---|
| Capacitor iOS/Android 디렉토리 | ✅ 존재 |
| `capacitor.config.ts` | ✅ appId, scheme, allowNavigation 모두 설정 |
| iOS `App.entitlements` | ✅ `applinks:live.ur-team.com` |
| Android `intent-filter android:autoVerify` | ✅ 추가됨 |
| `public/.well-known/apple-app-site-association` | ✅ 템플릿 (TEAMID 교체만 필요) |
| `public/.well-known/assetlinks.json` | ✅ 템플릿 (SHA256 교체만 필요) |
| `_headers` Content-Type 설정 | ✅ |
| PWAInstallPrompt 컴포넌트 | ✅ 전역 wired |
| `manifest.webmanifest` | ✅ 기본 (아이콘 다양화만 권장) |
| `in-app-warning.ts` (progressive enhancement) | ✅ PWA + permissions API + UA matrix |
| 13개 인앱 webview detect (KAKAO/NAVER/FB/IG/LINE/Google/TikTok/Twitter 등) | ✅ |

---

## 🎯 가장 빠른 ROI (제 추천 순서)

1. **P0-1 (5분)**: 바로빌 키 회전 — 보안 즉시
2. **P0-2 (30분)**: TD-001 D1 권한 — migration CI 잠금 해제
3. **P1-3 (5분)**: INTERNAL_CRON_TOKEN
4. **P1-4 (1시간)**: 유령 CF 프로젝트 정리 — CI 노이즈 제거
5. **P1-5 (30분)**: PWA 아이콘 다양화 — 즉시 PWA 설치 경험 ↑
6. **P2-6/7 (1주 + 심사)**: 앱 출시 — Tier 1 UX 완성
7. **P3-9 (장기)**: i18n — 글로벌 배포 시
