# Aligo 알림톡 템플릿 등록 가이드

운영자가 [Aligo 콘솔](https://www.aligo.in/) 에서 등록해야 하는 알림톡 템플릿 목록.

미등록 시: 코드는 정상 작동, 실제 알림톡 발송 silent skip (운영 영향 0).

## 등록 절차

1. [Aligo 콘솔](https://www.aligo.in/) → 알림톡 → 템플릿 관리 → 새 템플릿
2. 아래 표의 **템플릿 코드** (= AI 결과 받을 식별자) 와 **본문** 등록
3. 카카오 심사 통과 (1-3 영업일)
4. 활성화 후 자동 발송 시작 (env: `ALIGO_API_KEY` / `ALIGO_USER_ID` / `ALIGO_SENDER_KEY` 설정)

## 등록 필요 템플릿 (현재 시점, 총 9개)

| # | template code | 용도 | 변수 (#{}) | 본문 예시 |
|---|---|---|---|---|
| 1 | `commission_withdrawal_approved` | 추천 commission 출금 송금 완료 | (메시지 본문 변수 X) | `[유어딜] 추천 commission #{금액}원이 #{은행} #{계좌}로 송금되었습니다. 입금 확인 후 영수증 확인 부탁드립니다.` |
| 2 | `commission_withdrawal_rejected` | 추천 commission 출금 거절 | - | `[유어딜] commission 출금 신청 #{금액}원이 거절되었습니다. 사유: #{사유}. 잔액은 원상 복원되어 다시 신청 가능합니다.` |
| 3 | `seller_settlement_completed` | 셀러 정산 완료 | - | `[유어딜] #{매장명} 정산이 완료되었습니다. 정산 금액: #{금액}원. 자세한 내역: live.ur-team.com/seller/settlements` |
| 4 | `appointment_seller_new` | 신규 예약 (매장 사장님) | - | `[유어딜] 신규 예약 — #{상품명}. #{날짜} #{시간}. 고객: #{이름} #{전화}` |
| 5 | `appointment_user_confirmed` | 예약 확정 (유저) | - | `[유어딜] 예약 확정 — #{상품명}. 일시: #{날짜} #{시간}. 예약 확인 / 변경: live.ur-team.com/my-appointments` |
| 6 | `appointment_reminder_user` | 예약 D-1 알림 (유저) | - | `[유어딜] 내일 예약 알림 — #{상품명}. 📅 #{날짜} #{시간}. 📍 #{주소}` |
| 7 | `appointment_reminder_seller` | 예약 D-1 알림 (매장) | - | `[유어딜] 내일 예약 — #{상품명}. 📅 #{날짜} #{시간}. 고객: #{이름} #{전화}` |
| 8 | (기존) `UB_8350` | 라이브 시작 단골 알림 | - | (이미 등록됨) |
| 9 | (기존) `seller_registered` 외 다수 | 시스템 알림 | - | docs/INCIDENTS.md 참조 |

## env 설정 (Cloudflare Pages Dashboard)

```
ALIGO_API_KEY        — Aligo 콘솔에서 발급
ALIGO_USER_ID        — Aligo 로그인 ID
ALIGO_SENDER_KEY     — Aligo 발신프로필 KEY (= 우리 비즈니스 계정)
ALIMTALK_DAILY_CAP   — 일일 발송 한도 (default 50000)
```

## 검증

운영자가 등록 후 1회 직접 발송 테스트:

```js
// 어드민 콘솔에서
fetch('/api/admin/alimtalk-test', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + localStorage.admin_token, 'Content-Type': 'application/json' },
  body: JSON.stringify({ template_code: 'commission_withdrawal_approved', phone: '01012345678' })
}).then(r=>r.json()).then(console.log)
```

(테스트 endpoint 가 없으면 실제 트리거 — 예: commission 출금 승인 — 후 phone 으로 확인)
