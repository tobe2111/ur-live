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
- 충전 게이트 `home_service_charge_enabled` **기본 OFF**. 켜기 전 `docs/STAGING_CHECKLIST.md` **S-HOME** 실결제.

## 다음 세션의 첫 액션
1. 머지·배포 뒤 라이브: `curl -sS https://urdeal.kr/api/home-service/config` → `open:true` · `https://urdeal.kr/life` 200.
2. 대표에게: 알림톡 3종 SENS 등록 + 승인 목록(`alimtalk_approved_templates`)에 `home_request_new=homerequestnew, home_quote_arrived=homequotearrived, home_quote_chosen=homequotechosen` 추가.
3. 테스트 매장으로 S-HOME-1~4(무료 참여권만, 돈 0) → 충전 게이트를 켤지 대표 판단 → S-HOME-5 실결제.

## 이번에 틀렸던 판단
- `ur-btn ur-btn-primary` 만 쓰면 **높이·모서리가 없다**(크기 수식어 `ur-btn-lg/md/sm` 필수). 렌더해 보고서야 납작한 파란 띠를 잡았다.
- 반환 함수 시험을 목록 반환(`refundAllQuotes`)으로만 했더니, 그 SELECT 가 'sent' 만 고르는 덕에 반환 함수 자체가 '고른 견적'을 돌려줘도 통과했다(주입이 잡았다) → 직접 호출 단언 추가.
- cron 을 `safeCron` 으로 슬롯 블록 안에 걸면 오탐 — 슬롯은 `slotCron('<식>')`, 분은 다른 그룹과 겹치면 안 된다(:25 → :50).

## 남은 결정/대기
- 대표가 말한 영업 방안 중 **"이사 수요건 있는 척 하면서" 사장님이 비딩하게 하는 것은 만들지 않았다** — 가짜 요청으로 돈을 받으면 기만이다(결재 문서 "하지 않는 것"). 대신 실제 쌓인 요청 수 + 무료 참여권 3장.
- 참여권 1,000~1,500원 단가는 어드민 `home_service_packages`(JSON)로 조정.
- 본인인증은 카카오 인증 번호로 대신했다(라이브 카카오 회원 12명 전원 번호 보유). PASS 등 별도 인증은 미도입.
- Notion 미기록(이 세션 MCP 확인 안 함 — 머지 후 기록).
