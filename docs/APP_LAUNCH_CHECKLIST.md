# 📱 유어딜 앱 출시 준비 체크리스트 (2026-06-27 갱신)

> 기존 `CAPACITOR_RECONNAISSANCE.md`(2026-04-26 상태 정찰) + `REMAINING_TODOS.md` 의 앱 항목을
> 현재 상태로 갱신 + 출시 전 필수 검증/결정 정리. **재개발 아님 — 코드/인프라는 ~90% 준비됨.**

## 0. 결론
유어딜은 **이미 Capacitor 하이브리드 앱**(android/·ios/ 네이티브 프로젝트 + `native.ts` 추상화 + 13 플러그인 + 유니버설링크). 새로 만들 필요 없음. 남은 건 **계정/서명 + 검증 + 4개 결정.**

## 1. ✅ 이미 된 것 (코드/설정)
- `capacitor.config.ts`: appId `com.urteam.yourdeal`, 보안(HTTPS강제·mixed content차단·도메인 화이트리스트·app-bound domains), 스플래시·키보드·딥링크
- `android/` + `ios/` 네이티브 프로젝트, 빌드 스크립트 `npm run app:ios|android|sync`
- `src/lib/native.ts`: 푸시(토큰→서버)·딥링크(보안검증)·뒤로가기·상태바·공유·햅틱·키보드 — 웹 fallback + `initNativeFeatures()` main.tsx 연결
- 유니버설/앱 링크: `apple-app-site-association`(템플릿) + iOS `App.entitlements`(applinks:live.ur-team.com) + Android autoVerify intent-filter
- 인앱브라우저(카톡/네이버 등) 외부열기 안내(`in-app-browser.ts`, 13패턴) — 성숙
- 푸시 플러그인 + AdMob 리워드 통합

## 2. 🔧 이번에 고친 것 (2026-06-27)
- **딥링크 스킴 불일치 수정**: `native.ts` 가 실제 등록값 `yourdeal://` 인식(기존 `urlive:`/`urdeal:`만 봐서 커스텀 스킴 딥링크가 핸들러 미발동이었음). 구 스킴은 호환 유지.
- **iOS 커스텀 스킴 등록**: `ios/App/App/Info.plist` 에 `CFBundleURLTypes`(yourdeal) 추가 — Android와 parity(기존 iOS엔 없어서 `yourdeal://` 콜백이 iOS에서 안 먹었음).

## 3. 🔴 출시 전 필수 결정 4개 (코드 아님 — 정책/검증)

### 결정 1 — 카카오 로그인 (앱 WebView) ⚠️ 최우선 검증
- **현재 동작**: 카카오 OAuth가 앱 WebView 안에서 웹 흐름으로 진행(allowNavigation 에 kauth.kakao.com). **이메일/계정 로그인은 동작 예상.**
- **갭**: "카카오톡 앱으로 로그인"(kakaotalk:// 앱전환)은 네이티브 미설정(iOS LSApplicationQueriesSchemes / Android queries 에 kakao 없음) → WebView 계정 로그인으로 폴백.
- **이상적 옵션 (택1)**:
  - (A·권장 MVP) 그대로 — WebView 계정 로그인. **실기기 1회 검증 필수**(로그인→콜백→세션 유지, iOS 쿠키 영속).
  - (B) 카카오 네이티브 SDK 플러그인 추가 → "카톡으로 로그인" 앱전환 지원. 추가 작업(네이티브 앱키·플러그인).
- **검증 체크**: iOS/Android 실기기에서 카카오 로그인 → 세션 유지 → 앱 재시작 후 로그인 유지.
- ⚠️ 잠긴 인증 흐름(kakao.routes/KakaoCallbackPage) — 변경 시 AskUserQuestion + CLAUDE.md 카카오 룰 준수.

### 결정 2 — 결제 / 애플 인앱결제(IAP) 정책 ⚠️ 심사 거절 리스크
- 애플: **디지털 재화/서비스(앱 내 소비)는 자사 IAP(30%) 강제**, 실물/실세계 서비스는 외부결제(토스) OK.
- 유어딜: **딜 충전(디지털 포인트)** = IAP 강제 대상 위험. 공구/식당/실물 = 외부결제 OK. 교환권(기프티콘, 실세계 교환) = 대체로 OK.
- **이상적 옵션 (택1)**:
  - (A·권장) iOS 앱에서 **딜 충전 숨김/외부브라우저 유도**(`isNative()&&isIOS()` 게이트 + 기존 `openExternalUrl`/`InAppFeatureBlockedModal` 재활용). 충전은 웹에서.
  - (B) 애플 IAP 연동(StoreKit 플러그인) — 수수료 30% + 구현부담.
- ⚠️ 충전 화면(PointsChargePage/TossWidgetPayPage)은 **결제 잠금파일** → 게이트 추가 시 AskUserQuestion.

### 결정 3 — 앱 업데이트 전략 (번들 stale)
- 현재 production 은 `dist/client` 를 **앱에 통째로 패키징** → 웹 고쳐도 앱은 그대로(스토어 재제출 필요). 소비자 앱은 자주 바뀜.
- **이상적 옵션 (택1)**:
  - (A) `capacitor.config server.url` 을 `https://live.ur-team.com` 로 → 앱이 라이브 웹 로드(즉시 반영, 단 네트워크 의존·애플 "앱이 웹래퍼일 뿐" 심사 주의).
  - (B·권장 균형) 번들 유지 + `version-check.ts`(이미 존재) 로 신버전 감지 시 강제 새로고침 + 중요 변경만 스토어 업데이트.
  - (C) OTA 핫업데이트(@capacitor/live-updates·Capgo) 도입 — 추가 인프라.

### 결정 4 — 스토어 등록/서명 (대표 계정 필요)
- [ ] Apple Developer 등록($99/yr) → Team ID → `public/.well-known/apple-app-site-association` 의 `TEAMID` 교체
- [ ] Android: Play Console($25) + keystore 생성 → SHA256 → Android App Link 등록
- [ ] 푸시 인증서: APNs 키(iOS) + FCM(Android, Firebase 이미 보유) 등록
- [ ] 앱 아이콘/스플래시 최종 + 스크린샷/설명 + 개인정보 처리방침 URL

## 4. 출시 절차 (요약)
```
npm run build && npx cap sync     # 웹 빌드 → 네이티브 동기화
npx cap open ios / android        # Xcode / Android Studio 에서 Archive
→ App Store Connect / Play Console 업로드 → 심사(1~3일)
```
- ⚠️ iOS Archive 는 **Mac + Xcode 필요**, Android 는 Android Studio 필요(이 작업환경 불가 — 대표 로컬).

## 5. 실기기 테스트 매트릭스 (출시 전)
- [ ] 카카오 로그인 → 세션 유지 → 앱 재시작 후 유지 (iOS·Android)
- [ ] 푸시 수신 → 탭 → 딥링크 정확 경로 이동
- [ ] 결제 1건(실물/공구) 정상 + (정책에 따라) 딜충전 동작/숨김
- [ ] 딥링크(yourdeal:// + https://live.ur-team.com/...) 앱 진입
- [ ] 하단 네비/키보드/스플래시/상태바 정상

## 참고 문서
- `docs/CAPACITOR_RECONNAISSANCE.md` (2026-04-26 정찰)
- `docs/UNIVERSAL_LINK_DEPLOYMENT.md` (유니버설 링크)
- `docs/REMAINING_TODOS.md` (P2 앱 출시 항목)
