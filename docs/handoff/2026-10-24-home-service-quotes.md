# 2026-10-24 — 생활 견적 매칭(숨고식) 신설

결재: `docs/decisions/2026-10-24-home-service-quotes.md` (대표 "좋아 그대로 진행해줘").
서비스: **유어딜(소비자)**. 머니 경로: **있음** — 참여권 카드 충전(Toss). 롤백: 게이트 `home_service_quotes_disabled=true` / `git revert`.

## 무엇이 생겼나
- 손님 `/life` → 카테고리(이사·입주청소·에어컨 청소)별 요청서 `/life/request/:category` → 받은 견적 비교 `/life/requests/:id` → 한 곳 고르면 서로 연락처 공개.
- 사장님 `/life/pro` — 하는 일·지역 등록(처음 무료 참여권 3장) · 참여권 잔액/충전 · 요청함 → `/life/pro/requests/:id` 에서 참여권 1장으로 견적(금액 선택).
- 홈 피드에서 '생활' 칩을 고르면 위에 "이사·청소는 무료 견적으로" 한 줄(`LifeQuoteBanner`).
- 서버 `src/features/home-service/api/*` · 규칙 SSOT `src/shared/home-service.ts` · cron `home-service-sweep`(매시 :50 — 48시간 미열람·날짜 지남 → 만료/반환).
- 알림톡 3종(`home_request_new`·`home_quote_arrived`·`home_quote_chosen`) — `docs/alimtalk-register-list.md` 20~22번. **등록·승인 전엔 안 나간다**(요청함·내 요청 화면에서는 보인다).
- `sendSystemAlimtalk` 에 `dedupKey` 옵션 — 한 사장님에게 한 시간에 요청 둘이 와도 둘째가 막히지 않게.

## 돈이 지나는 자리(머니 룰)
- 참여권 원장 `home_service_credit_tx` UNIQUE(kind, ref) + 잔액 갱신을 `WHERE changes() > 0` 로 같은 batch 에 — 같은 결제·반환이 두 번 와도 한 번만.
- 견적 보내기 = 차감 CAS + 선착순 자리 + 견적 줄 + 원장을 **한 batch** — 자리가 없거나 참여권이 없으면 아무것도 안 빠진다.
- 충전 승인은 `confirmTossPayment` 만. 주문번호 `HSC-<매장>-<묶음>-<시각>` 의 매장 = 요청자, 금액 = 서버 묶음 가격.
- 충전 게이트 `home_service_charge_enabled` — **2026-10-25 11:4x KST 대표 지시("일단 유료 충전 가능하게끔 해주고")로 라이브 ON**(어드민 설정 API, 읽어서 `true` 확인). ⚠️ S-HOME 실결제 검증 **전에** 켰다 — 첫 실제 충전 1건의 원장(`home_service_credit_tx` charge)·잔액을 바로 확인할 것. 끄기: 같은 키를 `false`.

## 대리 접수 · 유어딜 직영 견적 (2026-10-24 대표 "실제 손님 있어. 두 기능 모두 만들어줘")
- 어드민 `/admin/home-service`(메뉴 '생활 견적'): 직영 견적 매장 지정(`platform_settings.home_service_house_seller_id`) · 대리 접수(동의 기록 필수, `source='admin'`) · 요청별 견적 보기 · 직영 견적 보내기 · 손님이 고른 견적 대신 누르기 · 손님 취소.
- 서버 `home-service-admin.routes.ts`(`requireAdmin`). DB: `sendHouseQuoteAtomic`(자리 1개 · 참여권 0) · `chooseQuoteAtomic(byAdmin)` · 반환은 `is_house=0` 만.
- 운영팀이 대리 접수 건을 열면 `customer_viewed_at` 을 찍는다(48시간 미열람 반환이 거짓으로 돌지 않게).
- 가드 3 + 주입 3 추가(직영 반환 금지 · 대리 선택은 admin 건만 · 직영도 선착순 자리를 본다).
- ⚠️ 직영 견적을 내려면 먼저 그 매장 번호(sellers.id)를 어드민에서 지정해야 한다.

## 다음 세션의 첫 액션
1. 머지·배포 뒤 라이브: `curl -sS https://urdeal.kr/api/home-service/config` → `open:true` · `https://urdeal.kr/life` 200.
2. 대표에게: 알림톡 3종 SENS 등록 + 승인 목록(`alimtalk_approved_templates`)에 `home_request_new=homerequestnew, home_quote_arrived=homequotearrived, home_quote_chosen=homequotechosen` 추가.
3. 테스트 매장으로 S-HOME-1~4(무료 참여권만, 돈 0) → 충전 게이트를 켤지 대표 판단 → S-HOME-5 실결제.

## 이번에 틀렸던 판단
- `ur-btn ur-btn-primary` 만 쓰면 **높이·모서리가 없다**(크기 수식어 `ur-btn-lg/md/sm` 필수). 렌더해 보고서야 납작한 파란 띠를 잡았다.
- 반환 함수 시험을 목록 반환(`refundAllQuotes`)으로만 했더니, 그 SELECT 가 'sent' 만 고르는 덕에 반환 함수 자체가 '고른 견적'을 돌려줘도 통과했다(주입이 잡았다) → 직접 호출 단언 추가.
- cron 을 `safeCron` 으로 슬롯 블록 안에 걸면 오탐 — 슬롯은 `slotCron('<식>')`, 분은 다른 그룹과 겹치면 안 된다(:25 → :50).

## 남은 결정/대기
- 보안 경보: dompurify 3.4.17 · follow-redirects 1.16.1 · undici 7.30.1 로 올렸다. vite·zod 는 대표 '1번 승인' 으로 예외 등록(zod 는 2026-11-07 까지 4 이행 판단) — `docs/decisions/2026-10-24-npm-audit-vite-zod.md`.
- 대표가 '실제 사장님에게 가는 가짜 요청'을 다시 요청했다(2026-10-24). 만들지 않았다. 팀 시뮬레이션 기능은 대표 지시로 지웠다.
- 대표가 말한 영업 방안 중 **"이사 수요건 있는 척 하면서" 사장님이 비딩하게 하는 것은 만들지 않았다** — 가짜 요청으로 돈을 받으면 기만이다(결재 문서 "하지 않는 것"). 대신 실제 쌓인 요청 수 + 무료 참여권 3장.
- 참여권 1,000~1,500원 단가는 어드민 `home_service_packages`(JSON)로 조정.
- 본인인증은 카카오 인증 번호로 대신했다(라이브 카카오 회원 12명 전원 번호 보유). PASS 등 별도 인증은 미도입.
- Notion 미기록(이 세션 MCP 확인 안 함 — 머지 후 기록).

## 2026-10-25 — 오늘의집 흐름 + 사장님 항목 (대표 "모두 진행해줘")

- 사장님 항목 4종(방역·소독 / 주방 후드·덕트 / 가게 시설 수리 / 숙소 청소·침구)을 생활 페이지 맨 위에.
- 요청서: 요약 카드 + 질문당 시트, 이사 달력 손 없는 날, 주소 검색 → 상세 주소(고른 업체만 본다), 큰 짐 여러 개 고르기, 신청 후 함께 신청.
- 로그인은 [견적 신청] 때(답은 localStorage 하루). 접수 API 는 그대로 로그인 + 카카오 번호.
- 새 컬럼 `home_service_requests.private_details`(ALTER, ensureHomeServiceTables).
- ⚠️ 업체 쪽: 사장님 항목을 받을 업체(방역·후드·수리·숙소 청소)가 아직 0곳 — `/life/pro` 에서 카테고리를 고른 업체가 생겨야 알림이 간다. 그 전 요청은 보관된다.
- 다음 세션 첫 액션: 배포 후 폰으로 `/life/request/move` 를 로그아웃 상태로 끝까지 → 로그인 → 돌아와 답이 남았는지, 주소 검색 시트가 뜨는지.
- 틀렸던 판단: 처음에 "로그인 없이 이름·전화 + SMS 인증" 을 제안했는데, 카카오 로그인이 이미 번호 확인을 해 주므로 로그인을 끝으로 미루는 것으로 충분했다(문자 비용·템플릿 0).

## 2026-10-25 (3) — 카테고리 15종 + 간판 제휴 업체

대표: "카테고리는 어떻게 두는 게 좋아?" → 추천안 → **"일단 다 하자. 간판은 특히 잘 해야 해. 이미 제휴사가 있거든"**.

- 묶음: **가게 8 / 숙소 2 / 집 5** (`audience: 'store' | 'lodging' | 'home'`, 종전 `'biz'` 폐기).
  - 가게: 간판 제작·교체(맨 앞) · 방역·소독 · 주방 후드·덕트 · 가게 시설 수리 · 냉장·냉동 설비 · 가게 에어컨 · 매장 정기 청소 · 배수구·정화조
  - 숙소: 청소·침구 · 수영장·온수 설비 / 집: 이사 · 입주청소 · 에어컨 청소 · 줄눈·탄성 · 해충 방역
  - **인테리어·리모델링은 넣지 않았다**(추천안에서 "하지 않음" — 금액이 커 분쟁, 숨고·오늘의집과 정면 경쟁).
  - 가게 시설 수리에서 간판·냉장 설비·에어컨을 뺐다 — 섞이면 그 전문 업체에게 요청이 안 간다.
  - 함께 신청 추가: 후드 → 배수구, 입주청소 → 줄눈.
- **간판 요청서**: 일(새로/교체/수리/철거) · 종류 7 · 가로 길이 · 다는 곳 · 디자인 · 옥외광고물 신고 · 예산. 사진은 연결 뒤(업로드 칸 없음).
- **제휴 업체**: 어드민 `/admin/home-service` "제휴 업체"에서 카테고리마다 매장 번호 지정(`platform_settings.home_service_partners`, JSON). 그 매장은
  ① 새 요청 알림을 **지역 무관**으로 먼저 받고 ② 요청함·상세에 그 카테고리가 전부 뜨고 ③ **참여권 없이** 견적(`sendHouseQuoteAtomic(..., partner=true)` → `quotes.partner=1`, 반환 대상 아님), 손님 화면 "유어딜 제휴".
  참여권 면제는 2026-10-24 승인된 "직영(또는 협력 업체) — 참여권을 쓰지 않는다" 규칙을 따른 것.
- 파일: 칸 정의를 `src/shared/home-service-categories.ts` 로 분리(`home-service.ts` 600줄 초과), `home-service.ts` 가 재수출.
- 가드: `home-service-partner-2026-10-25.test.ts`(실제 SQLite) + 주입 7(전부 빨간불 확인). 첫 판의 쉼표 경계 시험이 헛돌았다 —
  `aircon_clean`/`store_aircon` 은 서로 부분 문자열이 아니라 결함을 심어도 통과했다. **`move` ⊂ `move_in_clean`** 으로 바꿔 잡았다.

### 다음 세션의 첫 액션
1. 대표에게 **간판 제휴사 매장 번호(sellers.id)** 를 받아 어드민에서 지정. 그 업체가 유어딜 사장님 계정(판매 승인)이 없으면 먼저 `/store/new` 가입·승인.
2. 지정 뒤 테스트 요청(간판, 아무 지역) → 제휴사 요청함에 뜨는지 · 견적 버튼이 "참여권 없이" 인지 · 손님 화면 "유어딜 제휴".
3. 업체 없는 카테고리 표시(숨김 / "모집 중") — 대표 결정 대기.
