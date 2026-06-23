# 유캔싸인(UCanSign) 전자계약 자동발송 연동

> 대표 요청(2026-06-22): "가입 시 자동으로 계약서를 보내게". 처음 모두싸인으로 골격을 짰다가
> 대표 지시로 **유캔싸인**으로 교체. 상태: **구현 완료(코드) · 자원(API KEY/템플릿) 준비 대기**.

## 결정사항 (대표 확정)
- 대상 가입: **판매사(distributor) + 제조사(supplier)** 의 `register` 플로우
- 서명 방식: **카카오 알림톡**(signingMethodType: `kakao`, 연락처=휴대폰)
- 서명 필수성: **차단(hard)** — 미서명 시 발주 차단(단, 계약행 없는 기존/자격증명 전 계정은 통과 = 락아웃 방지)
- 자원: **아직 없음** → API KEY/템플릿 준비 전까지 전부 fail-soft inert

## 확정 API 스펙 (유캔싸인 공식 docs — 대표 공유)
- Base: `https://app.ucansign.com/openapi`
- **인증 2단계**:
  1. `POST /user/token`  body `{ "apiKey": "..." }` → `{ code:0, result:{ accessToken } }` (토큰 30분)
  2. 이후 호출 `Authorization: Bearer {accessToken}`
- **템플릿 발송**: `POST /templates/{templateId}`
  ```jsonc
  {
    "documentName": "유통스타트 판매사 거래계약서 - (주)홍길동상사",
    "participants": [
      { "name": "홍길동", "signingMethodType": "kakao",
        "signingContactInfo": "01012345678",  // kakao=휴대폰(하이픈X) / email=이메일
        "signingOrder": 1 }
    ],
    "customValue1": "distributor",            // webhook 에 그대로 에코 → 상관관계
    "customValue2": "42",                     // account_id
    "customValue3": "distributor_agreement",
    "customValue5": "<UCANSIGN_WEBHOOK_SECRET>" // webhook 검증용 공유시크릿
  }
  ```
  - 응답 `{ code:0, result:{ documentId } }` (성공 code===0). 첫 참여자에게 카톡/이메일 발송.
  - 테스트모드: 헤더 `x-ucansign-test: true`(포인트 차감 X, 효력 미보장 워터마크).
  - 포인트: 발송 1건당 1포인트 차감(부족 시 code 1039) — 운영 전 충전/자동충전 필요.
- **Webhook**(개발자 메뉴에서 URL 등록): 이벤트 발생 시 우리 URL 로 POST.
  - eventType: `sign_creating` / `signing_canceled` / `signing_completed`(중간) / `signing_completed_all`(완료)
  - payload: `{ documentId, documentIdStr, eventType, customValue1..5(에코), participantContactInfo, ... }`
  - **HMAC 시그니처 없음** → `customValue5` 에코값을 공유시크릿으로 검증 + documentId 가 우리 DB행과 매칭될 때만 상태변경(위조 무력화).
  - ⚠️ OAUTH 로그인 회원 문서 webhook 은 미전송 — 우리는 **API KEY 방식**이라 정상 수신.

## 구현 (코드 완료)
| 파일 | 역할 |
|---|---|
| `src/worker/utils/ucansign-gateway.ts` | `sendContractFromTemplate(env,input)` — 토큰발급(isolate 캐시 30분)+발송, withCircuitBreaker, 절대 throw X, 미설정 skip |
| `src/worker/utils/signup-contract.ts` | `dispatchSignupContract(c,input)` — 가입 후 fire-and-forget(waitUntil), 카카오, customValue 상관관계, 성공 시만 기록 |
| `src/worker/utils/contract-signatures.ts` | `contract_signatures` 테이블(lazy ensure) + 멱등기록(UNIQUE) + documentId 상태갱신 + `hasUnsignedContract`(차단판정) |
| `src/features/contracts/api/ucansign-webhook.routes.ts` | `POST /api/webhooks/ucansign` — eventType→status, customValue5 검증, documentId 매칭, 항상 200 ack |
| `wholesale.routes.ts` `/register` + `/orders` | 가입 트리거 + 미서명 발주차단(403 CONTRACT_REQUIRED) |
| `supplier-auth.routes.ts` `/register` | 가입 트리거 |
| `env.ts` | `UCANSIGN_API_KEY/TEMPLATE_ID/WEBHOOK_SECRET/TEST_MODE` |
| `src/tests/unit/ucansign-contract.test.ts` | 동작 9건(2단계 토큰·payload·하이픈제거·test모드·email·에러·no-throw) |

## 운영 준비 체크리스트 (대표/운영)
1. app.ucansign.com 개발자 등록 → **API KEY 발급** → `UCANSIGN_API_KEY` 시크릿 등록
2. 관리자 > 템플릿에서 **계약서 템플릿 생성**(판매사/제조사 — 참여자 1명, 카카오) → templateId → `UCANSIGN_TEMPLATE_ID`
3. 임의 시크릿 1개 → `UCANSIGN_WEBHOOK_SECRET`(코드가 customValue5 에 심음)
4. 개발자 > Webhook 에 URL `https://live.ur-team.com/api/webhooks/ucansign` 등록 + `signing_completed_all`(+원하면 canceled/creating) 구독
5. **포인트 충전**(또는 자동충전) — 발송 1건=1포인트
6. (초기) `UCANSIGN_TEST_MODE=true` 로 실호출 1회 검증(포인트 0) → 정상 확인 후 해제
7. 플로우별 템플릿 다르면 발송부에 templateId 분기(현재는 단일 기본 템플릿)

## 후속 (자원 준비 후)
- become 전환 플로우(카카오 유저→판매사/제조사)·제조사측 enforcement·어드민 계약상태 뱃지/재발송
- staging 실호출 1회로 webhook 실제 수신 확정
