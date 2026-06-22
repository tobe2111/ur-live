# 모두싸인(Modusign) 전자계약 자동발송 연동 설계

> 대표 요청(2026-06-22): "가입 시 자동으로 계약서를 보내게" — 모두싸인 API 연동.
> 상태: **설계 / 게이팅 질문 대기** (구현 전 대표 확정 필요 항목 있음 — 아래 ❓).

## 현황
- 기존 전자서명/계약 인프라 **전무**(가입 시 약관 체크박스만). → 그린필드.
- 가입 플로우 5종 존재 → 어디에 붙일지가 핵심 결정:
  | 플로우 | 엔드포인트 | 계약 적합성 |
  |---|---|---|
  | 판매사(유통, 구매자측 B2B) | `POST /api/wholesale/register`·`/become-distributor` | ⭐ 높음(거래/판매 계약) |
  | 제조사(공급자측 B2B) | `POST /api/supplier/register`·`/become` | ⭐ 높음(공급 계약) |
  | 셀러(사업자 유저) | `POST /api/seller/register`·`/register-from-user` | 중(판매자 이용 계약) |
  | 에이전시 | `POST /api/agency/register` | 중 |
  | 일반 유저(소비자) | `POST /api/auth/register` | 낮음(불요) |

## 확정 API 스펙 (모두싸인 docs + 실 예시)
- Base URL: `https://api.modusign.co.kr`
- 인증: `Authorization: Basic base64("{API_KEY}:")` (apiKey 를 username, 빈 password 로 basic 인코딩)
- 템플릿 서명요청: `POST /documents/request-with-template`
  ```jsonc
  {
    "templateId": "<MODUSIGN_TEMPLATE_ID>",
    "document": {
      "title": "유통스타트 판매사 거래계약서 - 홍길동",
      "participantMappings": [
        { "name": "홍길동",
          "signingMethod": { "type": "EMAIL", "value": "user@x.com" } }  // type: EMAIL | SMS | KAKAO
      ],
      "metadatas": [
        { "key": "doc_type", "value": "distributor_agreement" },
        { "key": "account_id", "value": "<sellers.id>" }   // 멱등/역추적 키
      ]
    }
  }
  ```
- Webhook: 문서 상태변경 시 우리 URL 로 POST(서명 시작/완료/거절 등). 응답에서 documentId 수령 → 상태추적.
  - 출처: developers.modusign.co.kr (docs 봇차단으로 일부 필드는 구현 시 실호출 1회로 최종검증 — 추측금지 룰)

## 아키텍처 (기존 패턴 재사용 — toss-gateway 스타일)
1. **시크릿/설정** (Cloudflare Dashboard → Variables & Secrets):
   - `MODUSIGN_API_KEY` (secret) · `MODUSIGN_TEMPLATE_ID`(또는 플로우별 복수) · `MODUSIGN_WEBHOOK_SECRET`
2. **게이트웨이 유틸** `src/worker/utils/modusign-gateway.ts`:
   - `sendContractFromTemplate({ templateId, title, participant, metadata })` — Basic 인증·타임아웃·에러표준화(safe-error)·**멱등키(account_id metadata)**. 직접 fetch 금지(Toss 교훈 — 단일 helper).
3. **DB 추적** `contract_signatures` (repair-schema 등록):
   - `id, account_type(seller/supplier/...), account_id, document_id(모두싸인), template_id, status(requested/viewed/signed/rejected/expired), signer_name, signer_email, requested_at, signed_at, raw_event` + UNIQUE(account_type, account_id, template_id) — **재발송 멱등**.
4. **가입 훅(fire-and-forget, fail-soft)**: 선택된 가입 플로우 성공 직후 `waitUntil` 로 발송(가입 응답을 막지 않음 — referral 알림과 동일 패턴). 발송 실패가 가입을 깨지 않음.
5. **Webhook 수신** `POST /api/webhooks/modusign` (`webhook.routes.ts` 패턴): 시그니처 검증(graceful) → `contract_signatures.status` 갱신 → 서명완료 시 셀러 `agreement_signed=1` 등 후속(알림/승인 게이트).
6. **관리/표시**: 어드민 가입승인 화면에 계약 상태 뱃지(requested/signed) + 재발송 버튼(멱등 helper 호출).

## 보안·정합 체크
- 시크릿은 env only(하드코딩 금지) · API key 미설정 시 fail-soft(가입은 통과, 계약 미발송 로그).
- participant 이메일/휴대폰은 가입자 본인 것만(IDOR 방지) · webhook 은 시그니처 + documentId 매칭으로만 상태변경.
- PII(서명자 이메일)는 `contract_signatures` 에만, 공개 응답 노출 X(보안감사 규칙).
- 멱등: 같은 account 재가입/재시도 시 UNIQUE + INSERT OR IGNORE(머니룰 3번 패턴).

## ❓ 구현 전 대표 확정 필요 (게이팅)
1. **어느 가입에 발송?** 판매사 / 제조사 / 셀러 / (복수) — 플로우별 다른 templateId 필요할 수 있음.
2. **모두싸인 계정·자원 준비됐나?** API Key 발급 + 계약서 **템플릿 등록(templateId)** 여부. (없으면 연동 코드는 깔아도 실발송 불가 → 준비 후 secret 입력 시 활성.)
3. **서명 요청 방식**: 이메일 / 문자(SMS) / 카카오 알림 — participant signingMethod.type.
4. **서명 필수성**: 서명 완료를 가입/판매승인의 **차단 조건**으로(미서명 시 거래 제한)? 아니면 안내만(soft)?

## 구현 순서 (확정 후)
1. `modusign-gateway.ts` + env 타입 + `contract_signatures` repair-schema.
2. webhook 라우트 + 상태 갱신.
3. 선택 가입 플로우에 waitUntil 발송 훅(fail-soft).
4. 어드민 계약상태 뱃지 + 재발송.
5. staging 실발송 1회 검증(템플릿/이메일 수신/webhook 수신) — 추측금지 룰.
