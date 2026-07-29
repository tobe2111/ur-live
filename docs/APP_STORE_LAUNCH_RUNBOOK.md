# 📱 앱 스토어 출시 런북 (Android + iOS) — SSOT

> 2026-07-18 대표 지시 "앱도 만들 걸 대비해서 할 수 있는 세팅 다" 의 결과물.
> **코드/CI 측 준비는 완료** — 이 문서는 남은 절차(대부분 대표 계정 작업)와 검증 순서.
> 선행 점검: `docs/design/app-ready-audit-2026-07.md` (TWA vs Capacitor 분석 — **Capacitor 채택**, 프로젝트 기존재).

## 0. 현재 상태 (코드 측 — 완료 ✅)

| 항목 | 상태 |
|---|---|
| Capacitor 8 + 플러그인(푸시/스플래시/상태바/딥링크/햅틱/공유/키보드/브라우저) | ✅ package.json + `capacitor.config.ts`(appId `com.urteam.yourdeal`) |
| `android/` 네이티브 프로젝트 | ✅ + **카드사 `intent://` 스킴 브릿지**(MainActivity, 2026-07-18) + `<queries>` 결제앱 가시성 + CAMERA/POST_NOTIFICATIONS 권한 |
| `ios/` 네이티브 프로젝트 (SPM) | ✅ + NSCameraUsageDescription + LSApplicationQueriesSchemes(카드사) + `yourdeal://` URL 스킴 |
| 네이티브 초기화 (`src/lib/native.ts`) | ✅ 스플래시/상태바/푸시토큰/딥링크(경로 검증)/뒤로가기 |
| 푸시: 웹 VAPID + 네이티브 FCM 팬아웃 | ✅ `sendSystemPush` → 웹+FCM 동시 (`native-push.ts`) |
| 오프라인 QR 지갑 | ✅ localStorage 캐시 + 클라 렌더 (SW 미사용 — OAuth 사고 정책 준수) |
| 계정 삭제 (애플 필수 요건) | ✅ `/account/settings` 탈퇴 → `AccountDeletedPage` |
| 개인정보처리방침 | ✅ `/privacy-policy` (스토어 등록 시 URL 사용) |
| **Apple IAP 리스크** | ✅ **소멸** — 딜 충전(저장형 가치) 서비스 종료(2026-07-18, PR #549). 이용권=실물 세계 사용 → 토스 결제 그대로 |
| 인앱브라우저 감지의 자사 래퍼 오인 방지 | ✅ `isOwnAppWebView()`(Capacitor 판별) — 앱 안에서 "외부 브라우저로 열기" 배너 안 뜸 |
| 딥링크 `.well-known` 서빙 + AASA 경로 현행화 | ✅ `_routes.json` exclude + `/u/*`·`/group-buy/*`·`/vouchers/*` 등 현행 경로 매핑 (지문/TEAMID 는 플레이스홀더 — §2) |
| CI 빌드 | ✅ `app-android.yml`(debug APK 상시 + 서명 AAB 시크릿 조건부) / `app-ios.yml`(무서명 컴파일 검증) |

## 1. 대표가 만들 계정 (선행 — 각 1회)

1. **Google Play Console** — $25 1회. https://play.google.com/console
2. **Apple Developer Program** — $99/년. https://developer.apple.com (사업자 등록이면 D-U-N-S 번호 필요 — 발급 1~2주 걸릴 수 있으니 먼저 신청)
3. (푸시용) **Firebase 프로젝트** — 무료. 기존 firebase 프로젝트 재사용 가능. Android 앱(`com.urteam.yourdeal`) 추가 → `google-services.json` 다운로드.

## 2. 계정 생성 후 절차 (개발 세션과 협업)

### Android (먼저 — 심사 빠르고 단순)
1. **서명 키 생성** (개발 세션이 명령 안내): `keytool -genkey -v -keystore release.keystore -alias yourdeal -keyalg RSA -keysize 2048 -validity 10000`
2. GitHub Secrets 등록: `ANDROID_KEYSTORE_BASE64`(base64 -w0 release.keystore), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`
3. `google-services.json` → `android/app/` 커밋(또는 시크릿 주입) — FCM 푸시 활성
4. Actions → **App Android Build** 실행 → `yourdeal-release-aab` 아티팩트 → Play Console 업로드
5. Play Console **App signing** 페이지의 SHA-256 지문 복사 → `public/.well-known/assetlinks.json` 의 플레이스홀더 교체 + 배포 (App Links 활성)
6. 스토어 등록정보: 스크린샷(폰 2~8장)·아이콘 512px·개인정보처리방침 URL(`https://urdeal.kr/privacy-policy`)·데이터 보안 설문
7. 내부 테스트 트랙 → 실기기 검증(§3) → 프로덕션 심사 제출 (보통 수 시간~1일)

### iOS
1. Apple Developer → Identifiers 에 `com.urteam.yourdeal` 등록 (capabilities: Push Notifications, Associated Domains)
2. **TEAMID 확인** → `public/.well-known/apple-app-site-association` 의 `TEAMID` 플레이스홀더 교체 + 배포
3. 인증서/프로비저닝: Xcode 자동 서명(개인 Mac) 또는 App Store Connect API 키를 GitHub Secrets 로 (CI 서명 배포는 이후 세션에서 fastlane 셋업)
4. APNs 키(.p8) 생성 → Firebase 프로젝트에 등록 (FCM 이 APNs 로 전달)
5. App Store Connect 앱 생성 → 스크린샷(6.7"/6.5"/5.5")·설명·개인정보 URL·**심사 노트에 테스트 계정**(카카오 테스트 계정 안내) 첨부
6. TestFlight → 실기기 검증(§3) → 심사 제출 (보통 1~3일)
7. ⚠️ 심사 리젝 대비 논리 (미리 준비): "이용권은 오프라인 매장에서 소비되는 실물 세계 서비스로 외부 결제(토스)가 허용됨(가이드라인 3.1.3(e) Goods and Services Outside of the App). 앱 내 저장형 디지털 재화 판매 없음(딜 충전 서비스 종료)."

## 3. 실기기 검증 체크리스트 (배포 전 필수 — 각 OS 1회)

| # | 시나리오 | 확인 |
|---|---|---|
| 1 | 콜드 시작 → 홈 로드 (스플래시 → 피드) | 흰화면/이중로더 없음 |
| 2 | **카카오 로그인** (앱 웹뷰 안) | 로그인 후 세션 유지·마이 표시. 실패 시(카카오가 WebView 차단) → 개발 세션에 보고: `@capacitor/browser` 시스템 브라우저 + `yourdeal://` 콜백 플랜 B 배선 |
| 3 | **토스 결제** — 이용권 1건 실결제 | 카드사 앱 호출(intent://) → 복귀 → 결제 완료. MainActivity 브릿지 검증 지점 |
| 4 | **QR 사용** — 내 이용권함 → QR 표시 → (매장) 스캔 사용 | 사용 완료 도장 표시. 오프라인(비행기모드)에서도 QR 표시 |
| 5 | **셀러 QR 스캔** — 카메라 권한 요청 → 스캔 | 권한 팝업 정상. 거부 시 수동 코드 입력 폴백 |
| 6 | **푸시** — 주문/알림 발생 → 기기 알림 도착 → 탭 → 해당 화면 | FCM 토큰 등록(native_push_tokens) + 딥링크 |
| 7 | 딥링크 — 카톡으로 `urdeal.kr/u/{handle}` 공유 → 링크 탭 | 앱 열림(App Links/Universal Links — 지문 등록 후) |
| 8 | 뒤로가기(Android) / 스와이프(제스처) | 앱 종료 아닌 히스토리 뒤로 |
| 9 | 계정 삭제 경로 진입 (`/account/settings`) | 애플 심사 요건 — 실제 삭제까지 1회 |

## 4. 이후 세션이 할 수 있는 후속 (요청 시)

- 카카오 로그인 플랜 B: 시스템 브라우저(@capacitor/browser) + `yourdeal://auth` 콜백 + 세션 티켓(`/session/establish` 기존 인프라 재사용) 배선 — **§3-2 실패 시에만**
- fastlane 기반 iOS CI 서명 배포 (인증서 시크릿 등록 후)
- 앱 아이콘/스플래시 브랜드 세트 재생성 (`npx @capacitor/assets generate` — 현재는 기본 생성분)
- 알림 채널 통합 오케스트레이션 (`dispatchNotification` 이관 — audit §4)
- 스토어 등록 텍스트/스크린샷 초안 작성

## 5. 주의 (재발 방지 룰과의 관계)

- **Service Worker 금지 정책 불변** — 앱이어도 오프라인 캐시를 SW 로 구현하지 않는다 (2026-04-27 OAuth 사고). 오프라인 QR 은 localStorage 방식 유지.
- 앱 웹뷰는 **`urdeal.kr` 라이브를 직접 로드**(`capacitor.config.ts` `server.url` — 2026-07-18 확정). 이유: API 가 same-origin + httpOnly 쿠키 세션이라 번들 모드는 cross-origin 으로 로그인/API 전부 깨짐. server.url 모드는 쿠키·OAuth·결제가 웹과 100% 동일 + **웹 배포가 곧 앱 업데이트**(스토어 재심사 없이 기능 배포). 심사 대비: 푸시·카메라·딥링크 등 네이티브 기능 보유로 "최소 기능성(4.2)" 방어.
- `IOS_HIDE_DIGITAL_TOPUP` 플래그는 존치하나 **딜 충전 자체가 종료**(TOPUP_DISABLED)라 사실상 무의미 — 충전 부활 시에만 재검토.
