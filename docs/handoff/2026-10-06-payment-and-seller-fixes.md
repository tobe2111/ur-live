# 2026-10-06 결제 화면 · 완료 화면 · 사장님 화면 수리 묶음

서비스: 🎟️ 유어딜(소비자 결제 + 사장님 도구). PR [#1631](https://github.com/tobe2111/ur-live/pull/1631).

## 다음 세션의 첫 액션
1. **PR #1631 CI 확인 → 초록이면 대표 지시("머지까지")대로 머지**. head sha 대조 필수.
2. **대표 선택 대기 2건** — 시안 캔버스 https://claude.ai/artifact/N8ivG9DooQMmhHW9hiMgEz
   - 결제 완료 화면 A/B/C/D (권장 B · 바로 쓰는 티켓 — 착수 시 지갑 `VoucherTicket` 과 QR SSOT 공유가 선행)
   - 숫자 글꼴 지금(Pretendard)/A Poppins/B Outfit/C Manrope — 고르면 **숫자만 `unicode-range`** 로 교체 +
     `.dash-num`(고정폭 = 타자기처럼 보이는 원인, 38파일 78곳) 제거
3. **PR B(딜 100% 결제) — 머니 경로, 아직 미착수.** #1631 머지 후 지정 브랜치를 main 에서 다시 시작해 진행.
4. 결재 `docs/decisions/2026-10-06-broker-business-cert.md`(중개사 사업자등록증 주체) 답 대기.

## 완료분 (전부 #1631)
- **카드 미선택 → 막다른 화면**: `TossWidgetPayPage` [UNLOCK, 대표 승인] — requestPayment 거부를 치명 상태로 보내 위젯을 숨기던 것 → ready 유지 + 인라인 안내. 잠긴 계약 byte-불변.
- **완료 화면 숫자**: 토스 `?amount=`(카드 청구액)를 상품값으로 띄우던 것 → `confirm-toss` 응답 `deal_used` additive, 서버 상품 총액 + "딜 N · 카드 M".
- **'참여 완료!' 모달 삭제**: 거짓 보상(라이브 `user_referral_bonus_pct = 0`인데 0.5% 약속). `affiliate.routes` 하드코딩도 설정값으로.
- **탭 라벨 2줄 접힘**: 공용 `SegmentedTabs`(nowrap · `flex:1 0 auto` · 넘치면 가로 스크롤), 세 화면 교체 + 재발 가드(저장소 전수 스캔).
- **이용권 등록 임시저장 전체 제거**(배너·자동저장·버튼) — 대표 "그냥 없애줘".
- **QR 스캔 확인 팝업**: 스캔 → `/verify/`(조회만) → "사용 처리하시겠습니까?" → 확인 시에만 `use-by-seller`. 이미 쓴/만료·환불은 이유만.
- **승인 전 매장 이용권 등록 허용**: `MyStoresPanel` 이 승인 전을 막던 잔재 제거(정지만 막음) — 등록 화면 약속·서버·09-16 당근 모델과 일치.
- **마이 매장 추가 문**: 가게 시트 맨 아래 [+ 매장 추가], 1곳이어도 시트가 열림.

## 이번에 틀렸던 판단 / 잡힌 헛도는 가드
- `segmented-tabs` 가드가 처음엔 **부품 주석**의 `whitespace-nowrap` 때문에 클래스를 지워도 통과 — `stripComments` 로 교정.
- pre-commit 훅은 커밋 메시지를 못 본다 → `[SKIP_AUDIT]` 무효, `SKIP_NPM_AUDIT=1` 이 맞다.
- 옛 시험 셋이 바뀐 마크업/문구를 고정하고 있었다(기간 탭 `role="group"` · 계산대 "바로 사용 완료" · 임시저장 R4) — 끄지 않고 같은 불변식으로 재조준.

## 남은 결정/대기
- 주문 탭(처리 대기·준비 중·완료)은 **택배용**이라 이용권 주문이 영원히 "처리 대기"에 쌓인다 → 이용권은 사용 전/사용 완료/환불 로 나누자고 제안(대표 답 대기).
- 승인~완료 화면 지연(대표 "결제 끝나고 완료 화면까지"): `confirm-toss` 가 응답 전 D1 왕복 ~20회 + 토스 HTTP 1회, 그중 마지막 ~6회는 바우처 발급 뒤의 장부 기록(추천 적립·중개사 몫·수수료·원장). **머니 경로라 미변경** — waitUntil 이전은 단독 세션 + staging 실결제 + 누락 스위퍼 필요.
- npm audit high/critical 14건 선재(axios·capacitor·undici 등) — 별건.

## Notion
미기록 — 머지 후 기록.
