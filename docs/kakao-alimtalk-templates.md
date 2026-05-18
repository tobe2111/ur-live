# 카카오 알림톡 템플릿 등록 가이드

작성: 2026-05-18 (숙소 공구 출시 동반)

## 📋 개요

유어딜은 알리고 (Aligo) 를 통해 카카오 알림톡 발송. KISA 승인 받은 템플릿만 실제 발송 가능.

본 문서는 **신규 등록이 필요한 템플릿** 의 본문 + 변수 + 발송 시점을 정의.

## 🔑 환경변수 (Cloudflare Dashboard Workers 설정)

```
ALIGO_API_KEY          = Aligo 발급 API 키
ALIGO_USER_ID          = Aligo 계정 ID
ALIGO_SENDER_KEY       = 발신 프로필 SENDER_KEY (카카오 채널 + 발신자 등록 후)

# 본 문서의 템플릿 코드 (Aligo 콘솔 → 알림톡 → 템플릿 → 승인 완료 후 코드 복사):
ALIGO_STAY_REMINDER_TEMPLATE_D1     = stay_reminder_d1
ALIGO_STAY_REMINDER_TEMPLATE_DDAY   = stay_reminder_dday
ALIGO_STAY_VOUCHER_EXPIRE_SOON      = stay_voucher_expire_soon
ALIGO_REFERRAL_COMMISSION_EARNED    = referral_commission_earned
ALIGO_BUSINESS_REGISTRATION_RESULT  = business_registration_result
```

## 📝 신규 등록 필요 템플릿 (5개)

### 1. `stay_reminder_d1` — 숙소 D-1 (체크인 전날)

**사용 시점**: 매일 09:00 UTC cron (`src/worker/cron/stay-reminder.ts`)

**대상**: stay_bookings.status='confirmed' + check_in_date = tomorrow

**본문 (1000자 이하, KISA 규정 준수)**:
```
[유어딜] 내일 체크인 안내드립니다.

· 숙소: #{hotel_name}
· 객실: #{room_name}
· 체크인: #{check_in_time}

준비물 / 체크인 안내문을 사전 확인해주세요.
즐거운 여행 되세요!
```

**변수**:
- `#{hotel_name}` — products.name
- `#{room_name}` — product_stay_rooms.name
- `#{check_in_time}` — product_stay_info.check_in_time (예: "15:00")

**버튼 (옵션)**:
- "예약 상세 보기" → https://live.ur-team.com/my-stays

---

### 2. `stay_reminder_dday` — 숙소 D-day (체크인 당일)

**사용 시점**: 매일 09:00 UTC cron

**대상**: stay_bookings.status='confirmed' + check_in_date = today

**본문**:
```
[유어딜] 오늘 체크인 안내드립니다.

· 숙소: #{hotel_name}
· 객실: #{room_name}
· 체크인: #{check_in_time}
· 체크인 코드: #{check_in_code}

체크인 시 코드를 매장에 제시해주세요.
```

**변수**:
- `#{check_in_code}` — stay_bookings.check_in_code (8자리 예: "A3K7-9M2P")
- 그 외 위와 동일

---

### 3. `stay_voucher_expire_soon` — voucher 만료 임박 (D-30 / D-7)

**사용 시점**: 별도 cron (TODO — 본 PR 후 추가)

**대상**: stay_bookings.sale_mode='voucher' + status='confirmed' + voucher_used_at IS NULL + voucher_expires_at <= now + 30d

**본문**:
```
[유어딜] 숙소권 유효기간 안내

#{hotel_name} #{voucher_type}이 #{days_left}일 후 만료됩니다.

· voucher 코드: #{voucher_code}
· 만료일: #{expires_at}

매장에 연락하여 사용 일정을 잡아주세요.
```

**변수**:
- `#{voucher_type}` — "평일권" or "주말권"
- `#{days_left}` — 만료까지 남은 일수
- `#{voucher_code}` — stay_bookings.check_in_code
- `#{expires_at}` — voucher_expires_at (YYYY-MM-DD)

---

### 4. `referral_commission_earned` — 인플 커미션 적립

**사용 시점**: payment confirm 후 affiliate_earnings INSERT 시 (선택)

**대상**: 인플루언서 본인

**본문**:
```
[유어딜] referral 적립 안내

#{buyer_name}님이 회원님의 추천 링크로 결제했습니다.

· 상품: #{product_name}
· 결제: ₩#{order_amount}
· 적립: ₩#{commission}

누적 ₩#{total_earned} — 정산 페이지에서 환급 가능합니다.
```

**변수**:
- `#{buyer_name}` — 마스킹된 구매자 이름 (예: "김**")
- `#{product_name}` — 상품명
- `#{order_amount}` / `#{commission}` / `#{total_earned}` — 금액

---

### 5. `business_registration_result` — 사업자 검증 결과

**사용 시점**: 어드민이 PATCH /verify 호출 시 (verify or reject)

**본문 (verify)**:
```
[유어딜] 사업자등록증 검증 완료

회원님의 사업자등록증이 승인되었습니다.

· 상호: #{business_name}
· 사업자번호: #{business_number}

이제 현금 정산 + 딜 환급이 가능합니다.
```

**본문 (reject)**:
```
[유어딜] 사업자등록증 반려

· 사유: #{reason}

다시 제출해주세요. 검증 완료 후 현금 정산이 가능합니다.
```

---

## 🛠️ 등록 절차 (Aligo 콘솔)

1. https://smartsms.aligo.in 로그인
2. 카카오 알림톡 → 발신 프로필 등록 (사업자 등록증 필요)
3. 템플릿 추가:
   - 위 5개 본문 그대로 복사 (변수 `#{}` 포함)
   - 카테고리: '주문/예약' or '안내/공지' 적절히 선택
   - 버튼 (옵션): 'WL' (웹링크) — `https://live.ur-team.com/my-stays` 등
4. KISA 심사 신청 (보통 1-3 영업일)
5. 승인 완료 후 템플릿 코드 (예: 'TC_20260518_001') 복사
6. Cloudflare Dashboard → Workers → ur-live → Environment Variables 에 등록

## ⚙️ 코드 통합 위치

각 템플릿 발송 호출 위치 (이미 구현됨, 환경변수만 등록):

| 템플릿 | 위치 | 발송 함수 |
|---|---|---|
| stay_reminder_d1/dday | `src/worker/cron/stay-reminder.ts` | runStayReminderCron + sendAlimtalk |
| voucher_expire_soon | (TODO) `src/worker/cron/stay-voucher-expire.ts` | — |
| referral_commission_earned | (TODO) `payment.routes.ts` 의 affiliate INSERT 후 | — |
| business_registration_result | (TODO) `admin-sellers.routes.ts` verify endpoint | — |

→ 본 가이드는 **운영 측 준비 완료 후 코드 통합 PR 별도** 진행.

## 📊 발송 모니터링

- Aligo 콘솔 → 발송 내역
- DB `alimtalk_failures` 테이블 → 실패 row + 재시도 cron 자동 처리
- 어드민 → `/admin/operations-guide` 에 통합 표시 가능 (TODO)

## 💰 비용 (참고)

- 알림톡: 1건당 약 8-12원 (Aligo 정책)
- 친구톡 (이미지 포함): 11-15원
- 실패 시 SMS 자동 전환: 별도 차감

월 발송 예상 (1000 셀러 기준):
- stay reminders: ~2000건/일 (D-1 + D-day)
- 월 약 60,000건 × 10원 = 60만원

## ✅ Checklist (이 문서 기반)

- [ ] Aligo 발신 프로필 등록 (사업자등록증 필요)
- [ ] 5개 템플릿 본문 입력 + KISA 신청
- [ ] 승인 완료 후 템플릿 코드 6개 env 등록
- [ ] cron 동작 확인 (D-1 / D-day 알림 발송 테스트)
- [ ] alimtalk_failures 모니터링 대시보드 (어드민)
