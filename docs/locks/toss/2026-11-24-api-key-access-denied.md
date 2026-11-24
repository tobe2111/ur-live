# 2026-11-24 [UNLOCK] 에러 안내표에 `API_KEY_ACCESS_DENIED` 추가 (토스 API 키 접근 정책)

- **잠금 파일**: `src/worker/utils/toss-error-messages.ts` (항목 1개 **추가**, 기존 항목 무변경)
- **대표 승인**: 세션이 *"에러 안내표에 `API_KEY_ACCESS_DENIED` 추가 (Toss 잠금 파일이라 대표님 허가 필요) … 둘 다 진행할까요?"* 라고 묻자 **"둘 다 진행해"** (2026-11-24).
- **docs**: https://docs.tosspayments.com/reference/using-api/api-key-access-policy

## 무엇을 왜

토스가 2026-11-09 부터 시크릿 키 호출을 **등록된 IP·국가**에서만 받는다. 밖에서 부르면 403 +
`{"code":"API_KEY_ACCESS_DENIED","message":"… 요청 IP: x.x.x.x"}`. 우리 서버는 Cloudflare 라 고정 IP 가 없다.

실측(2026-11-24):
- 대표가 토스 화면에서 확인한 우리 키 4개의 허용 범위 = **"국내(대한민국) IP 주소 전체 허용"**(토스 일괄 등록).
- 새벽 자가진단의 토스 조회 1회는 통과(`toss=valid`). 정책 적용 뒤 실결제는 0건(마지막 토스 결제 10-06).
- 안내표에 이 코드가 없었다 → 막히면 분류 없는 오류로 나간다.

바꾼 것:
1. (잠금) 안내표에 `API_KEY_ACCESS_DENIED` → *"결제 시스템 설정 오류 — 관리자에게 문의해주세요."* · `merchant_config`.
   손님 문구에 IP 를 넣지 않는다.
2. (잠금 아님) `daily-self-diagnostic.ts` — 프로브 응답의 **코드**가 `API_KEY_ACCESS_DENIED` 면 `blocked` 로 판정해
   🔴 이슈(디스코드)로 올리고 토스가 준 "요청 IP" 를 남긴다. 종전엔 403 이 '판정 불가' 로 조용히 넘어갔다.

## 불변으로 지킨 잠금 항목

- 기존 에러코드 항목·`getTossErrorMessage`/`getTossErrorInfo` 무변경
- `toss-gateway.ts`(승인·취소) · `payment.routes.ts` · `webhook.routes.ts` 무변경

## 가드·주입

- `src/tests/unit/toss-key-probe.test.ts` — blocked 판정 · 코드 없는 403 은 단정 안 함 · 안내표 분류 (11건 통과)
- 주입 `scripts/mutations/toss-access-policy-2026-11-24.mjs` 2건 빨간불 확인

## 이 변경이 못 막는 것

- **감지일 뿐 예방이 아니다.** 프로브는 하루 1회·cron 워커의 그 순간 IP 하나만 본다. 결제 승인은 메인 워커에서
  나가고 Cloudflare 출구 IP 는 매번 다르다 — 그 IP 가 한국으로 분류되지 않으면 프로브가 초록이어도 승인이 막힐 수 있다.
- 판정은 실결제 1건 + 취소 1건으로만 된다.

## E4 판정 · 롤백

- 배포 뒤 다음 새벽 하트비트 `cron_hb:daily-self-diagnostic` 의 `toss=` 값(valid 유지)을 본다.
- 롤백: revert 한 커밋(동작 변화는 알림 추가와 안내 문구 1개뿐).
