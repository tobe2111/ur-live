# 카카오 알림톡 템플릿 등록 가이드 (콘솔 심사용)

최종 갱신: 2026-07-01 (라이브 전수조사 — 실제 코드 배선과 1:1 정합)

## 📋 이 문서의 목적

유어딜은 알리고(Aligo)를 통해 카카오 알림톡을 발송합니다. **카카오/KISA 승인 템플릿만 실제 발송**되며,
보내는 본문의 **고정 텍스트가 등록 템플릿과 글자 단위로 일치**해야 합니다(변수 `#{...}` 부분만 가변).
불일치하면 Aligo가 `result_code != 1`로 거부 → `alimtalk_failures`에 쌓이고 전달 0.

> 아래 본문은 **실제 코드가 보내는 메시지**에서 동적 부분만 `#{변수}`로 치환한 것입니다.
> **콘솔에 그대로(줄바꿈·기호·이모지 포함) 복사**하세요. 임의로 문구를 바꾸면 코드가 보내는
> 메시지와 어긋나 거부됩니다(문구를 바꾸려면 코드도 같이 바꿔야 함 — 담당자에게 요청).

## 🔑 환경변수 (Cloudflare → ur-live → Variables and Secrets)

알림톡은 아래 **3종이 모두** 있어야 발송됩니다(하나라도 없으면 `sendSystemAlimtalk`가 조용히 skip).

```
ALIGO_API_KEY      = Aligo 발급 API 키
ALIGO_USER_ID      = Aligo 계정 아이디
ALIGO_SENDER_KEY   = 카카오 발신프로필키(senderkey) — 채널+발신프로필 등록 후 발급
```

### ✅ 설정 확인 방법 (#3 — 대표 요청)

어드민 토큰으로 아래 엔드포인트를 호출하면 3종 존재 여부를 boolean으로 확인할 수 있습니다.

```bash
# 어드민 로그인 후 발급된 토큰으로 (관리자 전용 — 값 자체는 노출 안 됨, 존재여부만)
curl -s https://live.ur-team.com/api/health/env-readiness \
  -H "Authorization: Bearer <ADMIN_TOKEN>" | jq '.groups.optional[] | select(.key|startswith("ALIGO"))'
```

기대 출력(3종 모두 present:true 면 발송 준비 완료):
```json
{ "key": "ALIGO_API_KEY",    "present": true,  "note": "..." }
{ "key": "ALIGO_USER_ID",    "present": true,  "note": "..." }
{ "key": "ALIGO_SENDER_KEY", "present": true,  "note": "..." }
```

- 비인증/비관리자는 403. 인증 없이 존재여부만 빠르게 볼 땐 `GET /api/version`의 `secrets`에도
  `ALIGO_API_KEY`/`ALIGO_USER_ID`/`ALIGO_SENDER_KEY` boolean이 포함됩니다.
- 어드민 화면: `/admin/system-monitoring` 상단 "알림 채널 설정" 배지에서 알림톡 ✓/✕ 확인.

---

## 🎟️ 유어딜(소비자) 템플릿 — **live.ur-team.com 발신 프로필에 등록**

> 아래가 이번 콘솔 심사 대상입니다. 코드에 이미 배선돼 있어 **템플릿 등록·승인만 하면 즉시 발송**됩니다.

### 가입·승인

#### `seller_registered` — 셀러 가입 접수 (신청자에게)
발송: 셀러 가입 신청 시 (`seller-registration.routes.ts`)
```
[유어딜] 안녕하세요 #{name}님,
셀러 가입 신청이 접수되었어요.
1~3일 내 검토 후 결과를 안내드립니다.
```
변수: `#{name}` = 신청자 이름

#### `seller_approved` — 셀러 신규 승인 (셀러에게)
발송: 어드민 셀러 **신규 승인** 시.
```
[유어딜] #{name}님,
셀러 가입이 승인되었어요!
지금 바로 판매를 시작해보세요.
```

#### `seller_reactivated` — 셀러 계정 재활성화 (셀러에게)
발송: 정지(suspended) 셀러를 어드민이 다시 승인(재활성)할 때.
```
[유어딜] #{name}님,
계정이 다시 활성화되었어요.
판매를 이어가실 수 있습니다.
```

#### `agency_registered` — 에이전시 가입 접수 (신청자에게)
```
[유어딜] #{contact_name}님,
에이전시 가입 신청이 접수되었어요.
1~3일 내 검토 후 결과를 안내드립니다.
```
변수: `#{contact_name}` = 담당자명

#### `agency_approved` — 에이전시 승인 (에이전시에게)
```
[유어딜] #{contact_name}님,
에이전시 승인이 완료되었어요!
대시보드에 접속해 셀러 관리를 시작하세요.
```

#### `business_registration_verified` — 사업자등록 승인 (셀러에게)
발송: 어드민 사업자등록증 **승인** 시.
```
[유어딜] 사업자등록증 검증 완료

회원님의 사업자등록증이 승인되었습니다.

· 상호: #{business_name}
· 사업자번호: #{business_number}

이제 현금 정산 + 딜 환급이 가능합니다.
```

#### `business_registration_rejected` — 사업자등록 반려 (셀러에게)
발송: 어드민 사업자등록증 **반려** 시.
```
[유어딜] 사업자등록증 반려

· 사유: #{reason}

다시 제출해주세요. 검증 완료 후 현금 정산이 가능합니다.
```

### 주문·선물·환불

#### `new_order` — 새 주문 (셀러에게)
```
[유어딜] #{seller_name}님,
새 주문이 들어왔어요.
주문번호: #{order_number}
대시보드에서 확인 후 빠르게 발송 처리해주세요.
```

#### `gift_received` — 선물 도착 (수신자에게)
발송: 선물 결제 완료 시 (`gifts.routes.ts`). **한 줄 + 링크** — 카카오는 링크만 있는 짧은 본문은
심사에서 광고성/부족으로 반려될 수 있어, 버튼(웹링크)으로 빼는 것을 권장.
```
[유어딜] 선물이 도착했어요! 받기 → #{claim_url}
```
변수: `#{claim_url}` = 선물 수령 링크

#### `gift_refunded` — 선물 미수령 환불 (보낸 사람에게)
```
[유어딜] 보내신 선물 (#{amount}원) 이 30일 미수령으로 자동 환불됐어요.
```

#### `voucher_refunded` — 환불 완료 (구매자에게)
```
[유어딜] 환불 완료 — #{product_name}
#{amount}원이 환불 처리되었습니다.
(딜 결제건은 즉시 잔액 반영, 카드 결제건은 영업일 기준 3~5일 소요)
```

### 정산·송금

#### `seller_settlement_completed` — 셀러 정산 완료 (셀러에게)
```
[유어딜] #{business_name} 정산이 완료되었습니다.
정산 금액: #{amount}원
자세한 내역: live.ur-team.com/seller/settlements
```

#### `settlement_completed` — 매장 정산 완료 (매장 사장에게)
```
[유어딜] 정산 완료 — #{restaurant_name}
정산액 #{amount}원이 등록하신 계좌로 입금 처리되었습니다.
```

#### `payout_completed` — 정산 송금 완료 (수령자에게)
```
[유어딜] 정산 송금 완료
#{name} 님 #{amount}원이 #{bank_name} #{masked_account} 계좌로 입금되었습니다.
TX: #{tx_id}
```

#### `commission_withdrawal_approved` — 추천 커미션 출금 승인 (수혜자에게)
```
[유어딜] 추천 commission #{amount}원이 #{bank_name} #{masked_account} 계좌로 송금되었습니다. 입금 확인 후 영수증 확인 부탁드립니다.
```

#### `commission_withdrawal_rejected` — 추천 커미션 출금 거절 (수혜자에게)
```
[유어딜] 추천 commission 출금 신청 #{amount}원이 거절되었습니다.
사유: #{reason}
잔액은 원상 복원되어 다시 신청 가능합니다.
```

### 예약(appointment)

#### `appointment_seller_new` — 신규 예약 (매장에게)
```
[유어딜] 신규 예약 — #{product_name}
#{booking_date} #{start_time}~#{end_time}
고객: #{user_name} #{user_phone}
```

#### `appointment_user_confirmed` — 예약 확정 (유저에게)
```
[유어딜] 예약 확정 — #{product_name}
일시: #{booking_date} #{start_time}~#{end_time}
예약 확인 / 변경: live.ur-team.com/my-appointments
```

#### `appointment_reminder_user` — 내일 예약 리마인드 (유저에게)
발송: 매일 예약 전날 cron. `#{location}` 은 주소 있으면 `\n📍 주소`, 없으면 빈 값(변수로 처리).
```
[유어딜] 내일 예약 알림 — #{product_name}
📅 #{booking_date} #{start_time}~#{end_time}#{location}
예약 확인 / 변경: live.ur-team.com/my-appointments
```

#### `appointment_reminder_seller` — 내일 예약 리마인드 (매장에게)
```
[유어딜] 내일 예약 — #{product_name}
📅 #{booking_date} #{start_time}~#{end_time}
고객: #{user_name} #{user_phone}
```

#### `appointment_noshow_alert` — 노쇼 의심 (매장에게)
```
[유어딜] 노쇼 의심 — #{product_name}
📅 #{booking_date} #{start_time}~#{end_time}
👤 #{user_name} #{user_phone}

실제 방문 안 했으면: live.ur-team.com/seller/appointments → 노쇼 처리
방문 완료했으면: → 완료 처리
```

### 경매

#### `auction_won` — 경매 낙찰 (낙찰자에게)
```
[유어딜] 경매 낙찰 안내
#{title}
낙찰가: #{price}원
결제를 진행해주세요.
```

#### `auction_promoted` — 경매 차순위 승격 (승격자에게)
```
[유어딜] 경매 차순위 승격
이전 낙찰자 결제 불이행으로
#{price}원에 승격됐어요.
결제를 진행해주세요.
```

### 숙소

#### `stay_dday` — 숙소 체크인 당일 (게스트에게)
```
[유어딜]
오늘 체크인 안내드립니다.

· 숙소: #{product_name}
· 객실: #{room_name}
· 체크인: #{check_in_time}
· 체크인 코드: #{check_in_code}

즐거운 여행 되세요.
```

#### `stay_d1` — 숙소 체크인 전날 (게스트에게)
```
[유어딜]
내일 체크인 예정입니다.

· 숙소: #{product_name}
· 객실: #{room_name}
· 체크인: #{check_in_time}

사전 안내문 확인 부탁드립니다.
```

#### `stay_voucher_expire_soon` — 숙소 이용권 만료 임박 (유저에게)
발송: 만료 D-30/D-7/D-1 공통(같은 코드).
```
[유어딜] 숙소 이용권 유효기간 안내

#{product_name} #{voucher_type}이 #{days_left}일 후 만료됩니다.

· voucher 코드: #{check_in_code}
· 만료일: #{expires_at}

매장에 연락하여 사용 일정을 잡아주세요.
```
변수: `#{voucher_type}` = "평일권" 또는 "주말권"

### 일반 이용권 만료 · 계정 보안 · 인플 적립

#### `voucher_expire_soon` — 일반 이용권 만료 임박 (구매자에게)
발송: 만료 D-30/7/3/1 (`voucher-expire.ts`). **숙소 이용권·KT 교환권은 제외**(각각 `stay_voucher_expire_soon`·쿠폰 유효기간 무관).
```
[유어딜] 이용권 유효기간 안내

#{product_name}#{where} 이용권이 #{days_left}일 후 만료됩니다.

· 코드: #{code}
· 만료일: #{expires_at}

앱 '내 지갑'에서 QR 을 제시하고 사용해 주세요.
```
변수: `#{where}` = 매장명 있으면 " (매장명)", 없으면 빈 값.

#### `seller_bank_changed` — 정산 계좌 변경 (셀러에게, 보안 알림)
발송: 셀러가 정산 계좌 정보를 변경할 때 (`seller-profile.routes.ts`). 본인확인·이상거래 방어용.
```
[유어딜] #{name}님, 정산 계좌 정보가 방금 변경되었습니다.
본인이 변경하지 않았다면 즉시 비밀번호를 변경하고 고객센터에 문의해주세요.
(보안: 관리자 재확인 전까지 출금이 일시 제한됩니다)
```

#### `referral_commission_earned` — 추천(숙소) 커미션 적립 (인플루언서에게)
발송: **숙소 예약**이 인플루언서 추천 링크로 결제될 때 (`payment.routes.ts` 숙소 경로).
일반 쇼핑/공구 어필리에이트 적립은 웹푸시로만 통보(이 알림톡은 숙소 경로 전용).
```
[유어딜] referral 적립 안내

회원님의 추천 링크로 결제가 발생했습니다.

· 상품: #{product_name}
· 결제: ₩#{order_amount}
· 적립: ₩#{commission}

누적 ₩#{total_earned} — 정산 페이지에서 환급 가능합니다.
```

#### `affiliate_sale_credited` — 추천 링크 판매 실시간 적립 (크리에이터에게) · 2026-07-21 신규
발송: 크리에이터 추천 링크로 결제가 귀속돼 적립될 때 (`affiliate-credit.ts` `creditAffiliateForOrder`,
쇼핑/공구 일반 어필리에이트 — 위 `referral_commission_earned` 숙소 경로와 별개). **게이트 뒤**:
`AFFILIATE_SALE_ALIMTALK_ENABLED=true` (기본 OFF — 콘솔 등록·승인 후 활성). `#{deal_name}` = 상품명
(없으면 "내 추천 상품"), `#{amount}` = 적립 예정 딜(천단위 콤마). 인앱/웹푸시 "적립 예정"은 게이트 무관 상시.
```
[유어딜] 💰 추천 링크 실시간 적립

회원님의 추천 링크로 '#{deal_name}' 1건이 판매되어 #{amount}딜이 적립 예정입니다.

▶ 내 성과 보기: urdeal.kr/u/me/earnings
```

### 이용권 사용 · 체험단 (2026-07 신규 — 콘솔 등록 필요)

#### `voucher_used` — 이용권 사용 완료 (구매자에게)
발송: 매장에서 이용권 사용 처리 시 (`group-buy/helpers.ts` `sendBuyerVoucherUsedAlimtalk`).
`#{label}` = 카테고리 라벨(예: "식사 이용권"·"미용 이용권", 기본 "이용권"). `#{used_time}` 줄은
사용 시각 있을 때만("사용 시각: HH:MM") — **변수가 빈 값이 될 수 있는 줄**이라 콘솔 등록 시 유의.
```
[유어딜] ✅ #{label} 사용 완료

#{restaurant_name}
"#{product_name}"
#{used_time}

맛있게 드세요! 🍱

후기 작성하면 보너스 딜 지급:
https://live.ur-team.com/my-vouchers

문의: 유어딜 고객센터
```

#### `fcfs_selected` — 체험단 선정 (당첨자에게)
```
[유어딜] #{deal_name} 체험단에 선정되셨습니다! 🎉

기한 내 결제하시면 참여가 확정됩니다. (미결제 시 예비 선정자에게 기회가 넘어갈 수 있어요)

확정하기: https://live.ur-team.com#{buy_path}
```

#### `fcfs_replacement` — 체험단 예비순번 승계 (승계자에게)
```
[유어딜] #{deal_name} 체험단 참여 기회가 회원님께 넘어왔어요!

앞선 선정자의 미결제로 예비 순번이 승계되었습니다. 기한 내 결제하시면 참여가 확정됩니다.

확정하기: https://live.ur-team.com#{buy_path}
```

#### `district_coupon_issued` / `district_coupon_rejected` / `district_coupon_expiring` — 상권 쿠폰 페이백
> 상권 쿠폰(district coupon)은 **게이트 뒤 신규 기능**(`DISTRICT_ALIMTALK_ENABLED` + 채널설정).
> tpl_code는 위 3개(지급/반려/만료임박)로 배선돼 있으나 **본문은 `src/features/district/` 발송부에서
> 확정** — 등록 전 담당자에게 최종 문안 확인 요청. (일반 소비자 대상은 아니고 상권 캠페인 참여자 한정.)

### 운영 자동화 (2026-07-19 신규 — 게이트 뒤, 콘솔 등록 필요)

> 시퀀스 2종은 env `OPS_SEQUENCES_ENABLED='true'` 일 때만 발송(기본 OFF, 인앱 알림 포함 전체 게이트).
> 다이제스트는 env `OPS_DIGEST_ALIMTALK_ENABLED='true'` + platform_settings `ops_digest_phone` 필요.
> 콘솔이 tpl_code 자동부여 시 env override: `ALIGO_DROP_D1_REMINDER` / `ALIGO_EXPERIENCE_POST_REMINDER` / `ALIGO_OPS_DAILY_DIGEST`.

#### `drop_d1_reminder` — 드랍 마감 전날 예고 (응모자에게, cron `drop-d1-reminder` KST 18:00)
```
[유어딜] 드랍 마감 전날 안내

응모하신 #{product_name} 이(가) 내일 마감됩니다.

· 마감일: #{deadline}

마감 후 추첨 결과를 알려드릴게요.
```

#### `experience_post_reminder` — 체험단 게시 리마인드 (당첨 48시간 경과, 평생 1회)
```
[유어딜] 체험단 미션 안내

#{campaign_name} 체험단에 당첨되신 지 48시간이 지났습니다.

· 미션: #{mission}

방문·이용 후 콘텐츠 게시를 부탁드려요. 이용권은 앱 '내 지갑'에서 확인하실 수 있습니다.
```
> `#{mission}` 줄은 캠페인에 미션이 있을 때만 — **변수가 빈 값이 될 수 있는 줄**이라 콘솔 등록 시 유의.

#### `ops_daily_digest` — 어드민 일일 다이제스트 (운영자 번호 1개, cron `ops-daily-digest` KST 07:00)
> 수신자 = platform_settings `ops_digest_phone`(운영자 본인) 1명. 본문은 일자별 집계 숫자라
> 가변 — 콘솔 등록 시 전체를 `#{digest}` 변수 1개로 등록 권장. 이메일(`ops_digest_email`)이
> 더 유연하므로 알림톡은 선택 채널.

---

## 🏭 유통스타트(도매) 템플릿 — **utongstart.com 발신 프로필에 별도 등록**

> ⚠️ **서비스 분리**: 도매몰은 소비자와 **다른 카카오 채널/발신 프로필**입니다. 아래는 유통스타트
> 채널에 등록하세요(유어딜 채널에 섞지 말 것). 코드상 같은 `ALIGO_SENDER_KEY`를 쓰면 발신 채널이
> 유어딜로 나가므로, 도매 발신을 분리하려면 별도 sender key 배선이 필요(현재는 단일 sender key).

#### `supplier_approved` — 제조사 승인
```
[유통스타트] 제조사 승인 완료

· 상호: #{business_name}

이제 로그인해 공급상품을 등록할 수 있습니다.
https://utongstart.com/supplier/login
```

#### `supplier_rejected` — 제조사 반려
```
[유통스타트] 제조사 가입이 반려되었습니다

· 상호: #{business_name}

자세한 내용은 jiwon@ur-team.com 으로 문의해주세요.
```

#### `distributor_approved` — 판매사 승인
```
[유통스타트] 판매사 승인 완료

· 상호: #{business_name}

이제 로그인해 도매가로 사입할 수 있습니다.
https://utongstart.com/wholesale/login
```

#### `distributor_rejected` — 판매사 반려
```
[유통스타트] 판매사 가입이 반려되었습니다

· 상호: #{business_name}

#{reason}
```
변수: `#{reason}` = 반려 사유(없으면 코드가 "자세한 내용은 고객센터로 문의해주세요." 로 채움 — 등록 시 변수가 빈 값이 될 수 있음에 유의)

#### `sample_approved` — 샘플 신청 승인 ⚠️ **tpl_code 미확정(`TBD`)**
발송: 제조사 샘플 신청 승인 시 (`admin-products.routes.ts:608`). 현재 코드가 `env.ALIGO_TPL_SAMPLE_APPROVED ?? 'TBD'`
로 **플레이스홀더 `'TBD'`** 를 씀 → 실제 tpl_code 확정 + 본문 정의 필요. (도매 트랙 — 유통스타트 채널, 현재 보류)

---

## ℹ️ 참고: 콘솔 심사 대상이 **아닌** 것

- **셀러 자체 계정 발송** (`order_confirm`, `shipping_start`, `delivery_completed`, `low_stock_alert`):
  `alimtalk-auto.ts`가 **각 셀러의 Aligo 계정**으로 보내는 브랜드메시지. 플랫폼 발신 프로필과 무관 —
  셀러가 자기 채널에 등록. 여기 등록 대상 아님.
- **알림톡 미발송 항목**: `seller_rejected`(대시보드 알림만), `auction_outbid`(입찰 갱신 — 웹푸시만).

## ⚠️ 요청하신 "이용권 구매완료·사용" 배선 현황

- **이용권 사용(매장 사용처리 시)** — ✅ **배선됨** = 위 `voucher_used`. 콘솔 등록만 하면 됩니다.
- **이용권/공구 구매완료(구매자에게)** — ❌ **배선 없음**. 구매자 대상 "구매완료" 알림톡 트리거는 아직
  없습니다(구매자는 인앱+웹푸시로만 통보되고, `new_order`는 셀러에게 감). 원하시면 신규 배선 필요
  (문안 확정 + 코드) — 말씀 주시면 설계·구현.

## 🛠️ 등록 절차 (Aligo 콘솔)

1. https://smartsms.aligo.in 로그인
2. 카카오 알림톡 → **발신 프로필 등록**(사업자등록증 필요). 유어딜/유통스타트 **채널별로**.
3. 템플릿 추가: 위 본문을 **그대로 복사**(변수 `#{}`·줄바꿈·기호·이모지 포함). 코드는 위 소제목의 tpl_code 그대로.
   - 카테고리: 가입/승인·정산 = "회원", 예약·주문 = "주문/예약", 숙소 리마인드 = "안내" 등 적절히.
   - 인라인 URL(`live.ur-team.com/...`, `https://utongstart.com/...`)은 심사에서 **버튼(웹링크)** 권장.
4. KISA/카카오 심사 신청(보통 1~3영업일).
5. 승인 후: 등록한 `tpl_code`가 위 문서 코드와 **동일**하면 추가 env 불필요(코드가 그 코드로 발송).
   - 단, 콘솔이 코드를 자동 부여(`TC_2026...`)하는 경우 → 해당 env override 등록:
     `ALIGO_STAY_REMINDER_TEMPLATE_DDAY`(stay_dday), `..._D1`(stay_d1),
     `ALIGO_STAY_VOUCHER_EXPIRE_SOON`,
     `ALIGO_BUSINESS_REGISTRATION_VERIFIED`(business_registration_verified) /
     `ALIGO_BUSINESS_REGISTRATION_REJECTED`(business_registration_rejected).
     <!-- ⚠️ 2026-08-09 정정: 구 `ALIGO_BUSINESS_REGISTRATION_RESULT` 는 2026-07-01 1코드2문안
          분리 때 폐기된 이름 — 코드가 읽지 않으므로(env.ts:81-82) 그 이름으로 설정하면 override 가
          안 먹는다. 반드시 action 별 VERIFIED/REJECTED 두 개로 등록할 것. -->.

## 📊 발송/실패 모니터링

- 어드민 `/admin/system-monitoring`:
  - "알림톡 실패" 탭 → **template별 진단**(미등록 배지가 뜨면 그 tpl_code를 콘솔에 등록해야 함).
  - "푸시·이메일 실패" 탭 → 웹푸시/이메일 dead-letter.
- DB `alimtalk_failures` → 실패 row + 5분 재시도 cron.
- Aligo 콘솔 → 발송 내역.

## ⚠️ 등록 전 반드시 확인 (요약)

1. **문안 글자 일치** — 위 본문 그대로. 임의 수정 시 코드 발송과 불일치 → 거부.
2. **1코드=1본문 정합 완료** — 승인/반려(신규/재활성)가 갈리던 2건은 **각각 별도 tpl_code 로 분리**됨
   (`seller_approved`+`seller_reactivated`, `business_registration_verified`+`business_registration_rejected`).
   각 코드에 위 본문 그대로 등록하면 됩니다.
3. **서비스 분리** — 유통스타트(도매) 4종은 유어딜 채널이 아닌 **유통스타트 채널**에.
4. **ALIGO 3종 env** — API키·userid·발신프로필키 모두 세팅(위 확인 방법). ⚠️ 현재 **발신프로필키
   (`ALIGO_SENDER_KEY`) 미설정** — 콘솔 발신프로필 등록 후 발급되는 senderkey 를 env 에 넣어야 발송됨.
