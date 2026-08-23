# 2026-08-22 — 심플 커미션 모델 + 제안 수락 다리 + 어드민 발송 큐 (셀러 V2 2단계)

## 대표 확정 (이 세션에서 받은 결정 — 전부 반영됨)
- **"어필리에이트 전략은 빼려고 해. 심플하게"** → 유저/큐레이터 링크 커미션(2%) 종료. 인플루언서 수익 = **매장 제안 딜 % 하나**.
- **정산 모델 승인** ("정산 모델은 승인할게") — 원천 분배(유어딜이 받아 매장·인플루언서에 각각 지급). 기존 레일이 이미 이 구조.
- **유효기간**: 매장 설정 시만 존재, 미설정 = 무기한 (발급 4경로 강제 기본값 90/90/180일 폐지 — PR #1181 에 포함).
- **수수료 재확인**: 중개사 경유 5% / 매장 직접 10% — 구현과 일치.
- 컨택 과금 단가: **대표 고민 중** — 기본 0(미청구) 유지.

## 완료분
- PR #1181 (V2 1차): CI 전 초록 확인 → main 충돌(다른 세션 #1180 이 같은 PIN 버그 수리) 해소(머지 커밋 `644244c`, PIN 은 main 판 채택·가드 매니페스트는 양측 합집합) → **머지 대기/완료 상태는 PR 페이지가 진실**.
- 2단계 (이 파일과 같은 커밋):
  - `affiliate-credit.ts` — `affiliate_program_enabled` 스위치(행 부재=OFF) → PROGRAM_DISABLED. 코드·의도저장 보존.
  - `commission-rates.ts` — DEFAULTS influencer_pct/user_referral_bonus_pct 0.5→0 · **딜 % 캡 미적용**(자동분만 캡).
  - `influencer-offer-invites.routes.ts` (신규) — /api/influencer-offers/:token (미리보기·공개) + /:token/accept (로그인, CAS 선점→seller_influencer_deals active 발효→전용 링크 반환).
  - `admin-influencer-outreach.routes.ts` (신규) + `AdminInfluencerOutreachPage` — /admin/influencer-outreach 발송 큐(타깃 연락처+수락 URL, 어드민 전용; 상태 submitted→sent/rejected).
  - `InfluencerOfferAcceptPage` — /i/offer/:token (noindex).
  - `seller-influencers.routes.ts` — 제안 접수 시 리드별 수락 토큰 생성(batch, fail-soft; 어드민 상세가 누락분 보충).
  - repair-schema: `influencer_offer_invites` 등록.
  - 문서: platform-model §행위자/커미션 표(어필리에이트 종료·딜 커미션 유일 축), business-plan 성장비용, seller-dashboard-v2 §4.5.
  - 테스트: `influencer-offer-bridge.test.ts` 8건(캡 미적용/스위치 기본 OFF/CAS 순서/연락처 비공개).

## 이번에 틀렸던 판단 (다음 세션 반복 금지)
1. **"국세청 키 미등록" 오판** — CF API 실측으로 `NTS_API_KEY` 가 라이브 env 에 이미 있었다. env 는 추정 말고 조회.
2. **`import()` 로 가드 스크립트 문법검사** — check-guard-mutations 를 import 하면 **러너가 실행돼 워크트리를 변조**한다. 문법검사는 `node --check`. 오염 2파일 복원함.
3. **audit-gate 백그라운드 실행 중 `git add -A`** — 러너가 주입한 결함이 커밋에 딸려 들어갔다(7a86043 → c4536db 원복). **가드 러너가 도는 동안 커밋 금지.**
4. 어필리에이트/인플루언서 커미션이 별개 축임을 늦게 파악 — **이용권 인플 커미션 레일(seller_influencer_deals→attribution→payout)은 이미 완비**였고, 진짜 갭은 "유어애즈 리드(비회원)→딜" 다리뿐이었다.

## 다음 세션 첫 액션
1. 이 브랜치 PR CI 확인 → 초록이면 머지.
2. **성숙 트리거 사용-확정 전환**(§4.5 ⏳): influencer_attributions 성숙을 available_at(시간) → 이용권 사용 시점으로 — 머니 경로, 게이트+staging.
3. E2E 판정(배포 후): 제안 접수 → 어드민 큐에서 수락 URL 복사 → 수락 → ?ref 구매 → 딜 % 적립 확인.

## 대표 대기
- 컨택 과금 단가(influencer_contact_fee_krw).
- 라이브 platform_settings 에 어필리에이트 관련 값이 이미 세팅돼 있으면(예: affiliate_commission_rate) 스위치 OFF 가 우선하므로 무관 — 단, **멀티티어 트리(10/3/1%)·초대 보상은 이번 결정 범위 밖**으로 남겨 둠. 함께 끌지 대표 확인.


## (같은 날 2차) 이메일 스팸 방어 + 락인 — 대표 "1,2번 모두 해줘"
- `outreach-email.ts` 드립 발송 파이프라인(7겹 방어, 위 design doc §4.6) + 어드민 "이메일 발송 시작" 버튼 + `outreach_auto_send` 게이트(기본 OFF) + 원클릭 수신거부 엔드포인트 + `outreach_email_queue`(repair-schema 등재) + scheduled 5분 tick `outreach-email-drain`.
- `SameStoreDeals` — QR 사용완료 화면 재구매 락인.
- 가드: `outreach-email-spam-guard.test.ts` 8건. R1(adsLeadsDb) 준수 — 새 파일 2개 전부 라우터 경유.
- ⚠️ 대표 확인 1건: **Resend 발신 도메인 SPF/DKIM/DMARC 인증 상태** (dashboard → Domains). 미인증이면 코드 방어 무관 스팸함.
- ⚠️ 배포 후 판정: 어드민 큐에서 발송 시작 → 5분 내 첫 메일 도착 + 수신거부 클릭 → 재발송 0.


## (2026-08-23 3차) 이메일 실측 판정 — "지금이 가장 이상적이야?" 후속
**🔴 결정적 실측: 라이브에 `RESEND_API_KEY` 가 없다** (`/api/version` secrets: `RESEND_API_KEY: false`).
→ 셀러 승인 메일·단체메일·제안 메일 **전부 지금껏 무음 스킵**되고 있었다 (sendEmail 이 warn 만 찍고 통과).
DNS 실측(UDP 53 직결 — DoH 는 프록시 차단): **ur-team.com 은 Resend 인증 완료**(send.ur-team.com SPF/MX + resend._domainkey DKIM 실재), **urdeal.kr 은 레코드 0**, **DMARC 는 양쪽 다 없음**.
수리(코드): ① 어드민 발송 API 가 키 미설정이면 503 명시 에러(무음 스킵 차단) ② outreach 발신 기본값을 인증 도메인 `유어딜 <noreply@ur-team.com>` 로 (onboarding@resend.dev 폴백 제거).
**대표 액션 2건**: ① Resend API 키를 CF Pages(ur-live) env `RESEND_API_KEY` 로 등록 (+발신주소 바꾸려면 `RESEND_FROM`) ② DNS TXT 1줄: `_dmarc.ur-team.com` = `"v=DMARC1; p=none;"` (Gmail 대량발송 요건). urdeal.kr 발신 전환은 Resend 에 도메인 추가+DKIM 등록 필요 — 선택(나중).
