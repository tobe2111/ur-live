# 2026-11-11 — 키보드가 가린 가게 검색 · 등록 2단계 계좌 PIN 막다른 길

## 대표 신고 (원문)
1. *"이렇게 검색창 때문에 화면이 제대로 안보이는 문제 해결해줘. 다른 페이지들도 전체 다 검수"* — `/store/new` 에서 키보드가 올라오자 결과 칸이 한 줄도 안 남음(카카오톡 안 브라우저).
2. *"이 에러는 뭐지?"* — `/store/bank`(등록 2/2 정산 계좌)에서 '저장하고 끝내기' → *"계좌 변경은 PIN 인증이 필요합니다"* 토스트에서 멈춤.

## 원인
1. `/store/new` 는 `h-dvh`(화면 높이 고정). 키보드가 열리면 그만큼 줄어드는데 입력칸 위 **초대 배너·안내·큰 제목**이 그대로라 결과 칸이 0 에 가까워졌다.
2. 서버(`seller-profile.routes` PUT)는 계좌 필드가 오면 15분 안 PIN 확인을 요구(412 `PIN_REQUIRED`). 마이의 `BankSheet` 는 2026-09-26 에
   그 자리에서 PIN 을 걸게 고쳤는데, 11-03 에 만든 등록 2단계 화면(`StoreBankPage`)은 같은 저장을 부르면서 그 분기가 없었다.

## 수리
- `index.css` `.ur-kb-scope:has(input:focus, textarea:focus) .ur-kb-hide { display:none }` — 폰(lg 미만)만. 입력 중엔 장식을 접는다.
  적용: `StoreClaimPage`(초대 배너·영입 안내·라벨+제목) · `NaverPhotoSheet`(제목 줄).
- `StoreBankPage` — 412 `PIN_REQUIRED` 면 `PinSheet`(없으면 걸고 → 확인)를 열고, 끝나면 **저장을 다시 한다**.
- 가드 `keyboard-squeeze-and-bank-pin-2026-11-11.test.ts` + 주입 2건(빨간불 확인).

## 다른 페이지 검수 (정적)
- 화면 높이 고정(`h-dvh`/`h-[100dvh]`/`<Screen fixed>`) + 입력이 있는 손님 화면: `/store/new`(수리) · `StoreStepShell`(`/store/bank` — 폼이 스크롤 칸 안이라 입력칸이 키보드 위로 올라온다, 문제 없음)
  · `FirstVoucherPage`(같은 구조, 문제 없음) · `StoreOwnerClaimPage`(`min-h` 라 페이지가 스크롤, 문제 없음).
- 바닥 시트 + 검색: `NaverPhotoSheet`(85dvh — 제목 접기 적용) · `life/request/AddressSheet`(11-03 에 같은 신고로 이미 수리 — 남은 자리만큼 채움).
- 가운데 뜨는 작은 확인창(코멘트·전화번호·확인 대화상자 등)은 키보드가 올라와도 창 자체가 작아 결과 목록이 없다 — 대상 아님.
- ⚠️ **실기기 렌더 검수는 안 했다**(이 환경에서 모바일 키보드를 띄울 수 없다). 신고가 더 오면 그 화면에 `.ur-kb-scope`/`.ur-kb-hide` 를 같은 방식으로.

## 남은 결정
- 첫 계좌 등록(계좌가 아직 없는 새 매장)까지 PIN 을 요구할지 — 지금은 요구한다(그래서 새 사장님은 등록 중에 PIN 을 만든다).
  "처음 넣을 땐 PIN 없이, **바꿀 때만** PIN" 으로 바꾸면 등록이 한 단계 짧아지지만 정산 목적지 보안 정책 변경이라 결재 사항.

## 2차 — 대표 *"유사하게 더 개선할 것들 확인해줘"*
- **같은 막다른 길 하나 더**: 셀러 대시보드 사업자 정보(`SellerBusinessInfoPage`)도 같은 계좌 저장(`PUT /api/seller/profile`)을 부르면서
  412 `PIN_REQUIRED` 를 *"계좌 정보 저장에 실패했습니다"* 로만 보였다 → `SellerPinPrompt`(대시보드의 기존 PIN 확인창) 띄우고 확인 뒤 다시 저장.
  (계좌 저장 화면 셋 — 마이 `BankSheet` · 등록 `StoreBankPage` · 대시보드 — 이제 모두 PIN 을 그 자리에서 푼다.)
- **입력 있는 바닥 시트 4개**(예약 후기 · 숙소 후기 · 숙소 검색 필터 · 리뷰 보너스) `max-h-[90vh]` → `90dvh`(보이는 높이 기준).
- 확인만 하고 손대지 않은 것: iOS 입력 확대는 `index.css` 전역 16px 규칙이 이미 막는다 · 이용권 상세 딜 직접 입력칸은 하단 결제 바 **안**에 있어 키보드와 함께 올라온다(가림 없음)
  · 동네공구 제안(`/community-group-buy/new`)의 하단 고정 버튼은 기능이 꺼져 있다(`COMMUNITY_PROPOSAL_HIDDEN`) · 지도 검색은 실기기 확인 필요(이 환경에서 못 봄).
