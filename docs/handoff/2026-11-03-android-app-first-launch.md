# 안드로이드 앱 첫 내부 테스트 — 시작 크래시 수리 (2026-11-03)

## 이번 세션에서 된 것
- 업로드 서명 키 생성 → 대표가 GitHub Secrets 4개 등록(`ANDROID_KEYSTORE_BASE64` 등) → `App Android Build`
  수동 실행(run 41469090686) 성공 → 서명된 `yourdeal-release-aab` 생성.
- 플레이 콘솔: 처음 만든 앱의 패키지가 `urdeal.kr` 이라 업로드 거부 → 대표가 `com.urteam.yourdeal` 로 앱을 새로 만들고
  내부 테스트 트랙에 1 (1.0) 게시, 테스터 등록·설치까지 완료. (옛 `urdeal.kr` 앱은 미출시로 남아 있음 — 정리는 대표 판단)

## 틀렸던 판단 / 사고
- **설치한 앱이 켜자마자 1초 만에 꺼졌다.** 원인: Firebase 설정(`google-services.json`) 없이 빌드한 앱에서
  웹(`src/lib/native.ts`)이 `PushNotifications.register()` 를 부름 → 네이티브 "FirebaseApp 미초기화" 크래시.
  JS try/catch 로 못 잡는다. 앞서 "푸시만 안 될 뿐 앱은 돌아간다"고 대표에게 말했는데 **틀렸다.**
- 처방: `capacitor.config.ts` 가 **빌드 시점에** 설정 파일이 있을 때만 User-Agent 에 `UrDealPush` 표식을 붙이고,
  `native.ts` 는 표식이 있을 때만 푸시를 켠다. 앱은 라이브 웹을 띄우므로(server.url) **웹 배포만으로 이미 설치된 앱이 고쳐진다**
  (앱 재빌드 불필요). 가드 `native-push-firebase-gate-2026-11-03.test.ts`(주입 3건 빨간불 확인).
- ⚠️ 이 판정은 크래시 기제의 알려진 동작에 근거한 것이다 — 기기 로그(logcat)로 확인하지는 못했다.
  배포 후에도 꺼지면 원인은 다른 곳이다(그때는 `MainActivity` 또는 스플래시 쪽을 의심).

## 이어서 할 때의 첫 액션 (대표가 이 작업을 이어서 하라고 했을 때만)
1. 이 PR 이 배포된 뒤 대표 폰에서 앱 실행 → 켜지는지 확인. 이어서 카카오 로그인 · 이용권 결제 · QR 3가지.
2. 푸시를 켜려면 Firebase 프로젝트에 안드로이드 앱(`com.urteam.yourdeal`) 추가 → `google-services.json` 을
   `android/app/` 에 넣고 앱 재빌드(표식이 자동으로 붙는다).

## 남은 결정
- 애플: 리스터코퍼레이션이 법인인지 개인사업자인지(사업자번호 479-09 = 개인 형태) — 조직 가입 가능 여부가 갈린다.
- 사업자등록번호(479-09-02930 / 783-87-03224)·통신판매업 신고번호 이중 표기 정리 — 스토어 등록정보에도 들어간다.
