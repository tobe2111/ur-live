# 앱-레디 점검 (TWA/Capacitor 전환 대비) — 2026-07-12

> **목적**: 지금 앱을 만드는 게 아니라, 나중에 TWA(Play 스토어)/Capacitor 래핑으로 전환할 때 막히는 지점을 사전 점검. **네이티브 코드 0** — 이 문서는 점검 결과 + PWA 실작업 요약. 전환 트리거는 별도(서초 재방문·직접 유입 데이터).
>
> 결론 한 줄: **웹뷰에서 깨지는 지점(iOS 쿠키·인앱 결제 팝업·카메라 폴백)을 이미 웹 레벨에서 상당 부분 방어해 둔 성숙한 코드베이스.** 하나의 래퍼로 세 기능을 모두 만족시키긴 어려움 — **카카오·결제는 TWA 유리, 카메라 스캔은 Capacitor 유리**. 웹푸시/FCM·딥링크 인프라는 이미 풍부하게 존재.

---

## 1. PWA 완성도 — 실작업 (이번 커밋)

대부분 이미 높은 수준으로 구비되어 있었음. 이번에 고친 **실제 결함/갭**만:

| 항목 | 상태(점검) | 이번 조치 |
|---|---|---|
| manifest(이름·아이콘 풀세트·테마·shortcuts) | ✅ 이미 완비(`manifest.webmanifest` — any+maskable 아이콘, display_override, 3 shortcuts) | 무변경 |
| 이용권 지갑 오프라인 데이터 | ✅ 이미 됨 — `useMyVouchers`/`useMyOrders`가 localStorage 캐시 + 실패 시 last-known 폴백(`useMyData.ts`) | 무변경 |
| QR 티켓 오프라인 렌더 | ✅ 이미 됨 — `qrcode.react` 로컬 SVG, `voucher.code`(캐시됨)에서 클라 생성. 상태폴링/redemption-info fetch는 실패해도 graceful | **오프라인 안심 문구 추가**(QRModal): 오프라인 시 "📶 오프라인에서도 이 화면으로 사용할 수 있어요"(지하·약신호 매장 불안 제거) |
| "홈 화면에 추가" 유도 | ⚠️ 전역 팝업(`PWAInstallPrompt`)은 대표 요청(2026-06-17)으로 App.tsx 에서 제거됨 | **컨텍스트형 인라인 카드 신설**(`AddToHomeHint`) — 지갑 상단에만, standalone/인앱/30일dismiss 자가게이트. 전역 팝업 부활 아님 |
| index.html 메타 | ⚠️ apple-mobile-web-app 메타 3줄 중복 | 중복 제거 |
| push 알림 아이콘 | ⚠️ `push-sw.js` 기본 아이콘이 `/icons/icon-192.png`(404 — 실제 경로는 `/icon-192.png`) | 경로 수정 |

> **SW 정책 준수**: 오프라인 캐시를 **Service Worker fetch 핸들러로 구현하지 않음**. `main.tsx`가 캐싱 SW(pwa-sw/sw.js)를 매 로드 강제 unregister + 모든 Cache Storage 삭제(2026-04-27 카카오 OAuth 사고 + 2026-05-16 stale 청크 사고 방지). 유일 허용 SW = `push-sw.js`(fetch 핸들러 없음). → 오프라인 QR은 **localStorage 캐시 + 클라 렌더**로만 달성(SW 무관).

---

## 2. 앱 래퍼 3대 의존 — 호환성 표 (점검만)

TWA = Chrome Custom Tabs(풀 Chrome 엔진) / Capacitor = 순수 WebView. 이 차이가 결론을 가름.

| 요소 | TWA(Chrome) | Capacitor(WebView) | 우회 / 메모 |
|---|---|---|---|
| **① 카카오 OAuth** | ✅ 가능 (Custom Tabs = 정상 브라우저로 취급) | ⚠️ 조건부 — 카카오가 순수 WebView OAuth 차단 가능 | 로그인은 100% 서버사이드 리다이렉트(`/auth/kakao/start`)라 SDK 웹뷰 제약 회피. iOS 쿠키 미영속은 이미 fragment 티켓(`#st=`)+`POST /session/establish`(first-party 200)로 해결. **최대 리스크**: `in-app-browser.ts` 웹뷰 감지가 자사 래퍼 WebView(`; wv)`/Capacitor UA)를 못 잡아 "일반 브라우저"로 오인 → 카카오 거부 시 무안내 실패. **우회: Capacitor면 카카오 로그인만 `@capacitor/browser`(시스템 브라우저)로 위임 + 콜백 앱 딥링크. TWA면 그대로 OK.** |
| **② 토스 결제** | ✅ 대체로 가능 | ⚠️ 조건부 — 카드사 앱 `intent://` 딥링크 처리 필요 | successUrl/failUrl이 same-origin 웹 경로(`${origin}/payment/success`)라 복귀는 앱스킴 무의존(유리). 하지만 실결제 단계 카드사 앱(ISP/페이북) `intent://` 호출은 순수 WebView가 처리 못 함. 팝업 차단은 이미 감지(`in-app-warning.ts` popup feature). **우회: TWA는 OS가 스킴 처리(안전). Capacitor면 `shouldOverrideUrlLoading`에서 `intent://`·카드사 스킴 → `startActivity` 브릿지 설정 필요.** |
| **③ 카메라 QR 스캔(셀러)** | ⚠️ 거의 불가 (Custom Tabs `getUserMedia` 제약) | ⚠️ 조건부 — 권한 브릿지 설정 시 가능 | `VoucherScanner`가 듀얼 엔진(`BarcodeDetector` + `qr-scanner` wasm 폴백) + **수동 코드 입력 폴백** 보유(카메라 실패해도 사용 가능). `playsInline`/wakeLock 대응됨. **우회: 카메라 중시=Capacitor 유리(매니페스트 CAMERA 권한 + `onPermissionRequest` grant / iOS `NSCameraUsageDescription`). TWA면 수동 입력 폴백으로 버팀.** |

**선결 과제(전환 전 1건)**: `in-app-browser.ts`의 `PATTERNS`에 Android WebView(`; wv)`)·Capacitor UA 추가 → 래퍼 WebView를 감지해 외부 브라우저 유도 배너를 띄우도록. (이번 스코프 밖 — 전환 착수 시 첫 작업으로.)

---

## 3. 딥링크 준비 자리 (점검 + 서빙 위치 확보)

| 항목 | 상태 | 조치 |
|---|---|---|
| `.well-known` 파일 존재 | ✅ `assetlinks.json`(Android)·`apple-app-site-association`(iOS) + `_headers` content-type 규칙 존재 | 내용의 지문(SHA256)·TEAMID는 **플레이스홀더**(전환 시점 채움 — 의도됨) |
| **`.well-known` 실제 서빙** | ❌→✅ **결함 발견·수정** | `_routes.json` exclude에 `/.well-known/*`가 없어 워커 catch-all이 가로챔 → `assetlinks.json`=404, AASA=HTML(JSON 아님) = App/Universal Link 검증 실패. **두 경로를 exclude에 명시 추가**(정적 직접 서빙)로 "서빙 위치 확보" 완료 |
| URL 구조의 딥링크 적합성 | ✅ 준비됨 | `BrowserRouter` path 파라미터 기반(해시 라우팅 없음) → intent-filter/AASA 매핑에 이상적. `capacitor.config.ts`도 딥링크 지향(`appendUrlPath`, `scheme:'yourdeal'`) |
| AASA 매핑 목록 정비 | 📝 전환 시 | 현재 AASA는 `/products/*`·`/live/*`(중단)·`/profile/*` 위주 — 현행 주력 경로(`/u/:handle`·`/group-buy/:id`·`/vouchers/:id`·`/my-vouchers`)와 갭. 경로 형태는 매핑 쉬움. **어떤 경로를 앱으로 보낼지 목록은 전환 시점 확정**(내용 = 전환 시점 원칙) |
| SSR/OG 메타(링크 프리뷰) | ✅ 있음 | 미들웨어 SSR inject(상품/공구/큐레이터/블로그) + 봇 UA용 동적 OG(`KakaoTalk-Scrap` 포함) |

---

## 4. 알림 채널 추상화 (점검만 — 구현 금지)

| 항목 | 결론 | 근거 |
|---|---|---|
| 웹푸시(VAPID) | ✅ **완전 구현** | `push-notification.ts`(RFC8291 aes128gcm + RFC8292 VAPID JWT + 410 정리), `push_subscriptions`, `PushNotificationSetup.tsx`가 `push-sw.js` 등록/구독 |
| 네이티브 FCM(HTTP v1) | ✅ **구현됨** | `native-push.ts`(서비스계정 OAuth `messages:send`, `native_push_tokens`) + Capacitor `@capacitor/push-notifications` |
| 웹+FCM 팬아웃 | ✅ **한 곳에 모임** | `sendSystemPush`가 웹 VAPID + `sendNativePush`(FCM) 동시 호출 → **"웹푸시/FCM 채널 추가"는 이 레이어에 이미 자리 있음(확장 용이)** |
| 알림톡+SMS failover | ✅ 준비됨 | `sendSellerAlimtalk`(`send.ts`)에 SMS failover 단일 choke point 배선(env 게이트). 단 `system-alimtalk` 경로는 retry 큐 방식으로 전략 상이 |
| **통합 채널 오케스트레이션** | ⚠️ **리팩토링 필요(구조 확인)** | `dispatchNotification`(4채널: dashboard/email/alimtalk/push, `notification_channel_settings` 조회) 설계는 존재하나 **실사용 call site 0**(정의+테스트뿐). 실태는 `notifyUser`/`sendSystemAlimtalk`/`sendSystemPush` 개별 직접 호출. → 새 채널을 켜도 자동 전파 안 됨 |

**판정(웹푸시/FCM 추가 용이성)**: **발송 계층은 이미 확장 용이**(`sendSystemPush`가 웹+FCM 통합). **채널 선택/우선순위/failover를 통합 관장하려면** 각 call site를 `dispatchNotification`으로 이관하는 리팩토링 필요(지금 구현 금지 — 전환 시점에 결정). SW 금지 정책과 웹푸시는 이미 공존 설계됨(`push-sw.js`만 보호).

---

## 부록 — 전환 착수 시 To-Do (지금 아님)

1. `in-app-browser.ts` 웹뷰 감지에 Android WebView/Capacitor UA 추가(래퍼 오인 방지) — **①의 선결 과제**.
2. `.well-known` 내용 확정: assetlinks SHA256(Play Console 업로드 후) + AASA TEAMID + 매핑 경로 목록 현행화.
3. 래퍼 선택: 카카오·결제 우선 = TWA / 카메라 스캔 우선 = Capacitor. (혼합이면 카메라만 Capacitor 플러그인.)
4. 알림 통합이 필요하면 call site → `dispatchNotification` 이관(채널 오케스트레이션 채택).
5. 네이티브 코드 착수 전 e2e: 카카오 로그인 / 토스 결제 / 카메라 스캔 각 1회(래퍼 환경).
