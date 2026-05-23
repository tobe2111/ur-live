# 🗂️ Known Errors 사전 (Quick Match)

> **사용법**: 에러 신고 받자마자 본 표에서 정확한 한국어/영어 메시지 grep. 매칭되면 5분 fix.
> **갱신**: 새 사고 해결할 때마다 표에 1줄 추가 필수.

## 결제 (Toss / Stripe)

| 에러 메시지 (단어 그대로) | 발생 SDK / 함수 | 진짜 원인 | 해결 |
|---|---|---|---|
| `API 개별 연동 키의 클라이언트 키로 SDK를 연동해주세요. 결제위젯 연동 키는 지원하지 않습니다.` | `tossPayments.payment()` V2 | widget 키 (`_ck_`/`_wt_`) + payment() V2 호출 미스매치 | TossPaymentWidget v6 dual-mode (commit `28cbfa39`). gck → payment(), ck → widgets() |
| `API 개별 연동 키를 clientKey로 사용한 경우` | `tossPayments.widgets()` | gck 키 + widgets() 호출 미스매치 | dual-mode 분기로 gck → payment() 라우팅 |
| `결제 위젯 설정 누락 — Toss 콘솔 variantKey 등록 필요` (우리 코드 가공 메시지) | `widgets.renderPaymentMethods({variantKey})` | variantKey 'DEFAULT' 가 Toss 콘솔에 미등록 | `VITE_TOSS_VARIANT_PAYMENT` env 로 실제 등록 이름 매칭 |
| `결제 시스템 로딩 중...` 무한 hang | `widgets.renderPaymentMethods` silent fail | gck 키에 widgets() 호출 시 silent fail. variantKey 미등록도 동일 | dual-mode + 8초 timeout (commit `1824c6a6`) |
| `Idempotency-Key required` | Toss confirm `POST /v1/payments/confirm` | confirmTossPayment 헬퍼 미사용 | `confirmTossPayment()` 헬퍼 호출 강제 (CLAUDE.md 룰) |

## DB / SQL

| 에러 메시지 | 발생 위치 | 진짜 원인 | 해결 |
|---|---|---|---|
| `no such column: orders.commission_rate` | order.repository createOrder | repair-schema 미적용 / 새 컬럼 ALTER 안 됨 | dual-path INSERT (with/without column) + repair-schema 등록 (commit `f69b5e2c`) |
| `no such column: address at offset NN` | OrderRepository.findByIdempotencyKey | SELECT 가 존재하지 않는 컬럼 (`address`, `address_detail`, `notes`) 참조 — production 스키마 컬럼은 `shipping_address` (JSON), `shipping_name`, `shipping_phone`, `shipping_memo` | SELECT 컬럼을 production-schema 기준 정합 (commit `cc60adce`) |
| `UNIQUE constraint failed: users.email` | KakaoAuthService.upsertUser | 같은 이메일로 가입된 다른 인증 방식 존재 | `EMAIL_ALREADY_LINKED_TO_OTHER_METHOD` 코드 + 한국어 메시지 |
| `wrong number of bindings supplied` | D1 prepare/bind | SQL `?` 개수 ≠ bind 인자 개수 | `check-sql-bind-params.mjs` pre-commit hook |
| `CHECK constraint failed: status` | orders / streams INSERT | status 값이 enum 밖 (대소문자 / 오타) | orders: 대문자 (`PAID` 등) / payment_status: 소문자 (`approved`) — `docs/SCHEMA.md` |

## 인증 / OAuth

| 에러 메시지 | 발생 위치 | 진짜 원인 | 해결 |
|---|---|---|---|
| OAuth state mismatch | kakao callback | cookie state 불일치 | `kakao_oauth_state` 쿠키 + URL state 검증 (`safeRedirect`) |
| webview 무한 reload | kakaotalk:// scheme | scheme redirect 가드 없음 | `sessionStorage` 가드 (inline + module script 동시) |

## UI / 빌드

| 증상 | 원인 | 해결 |
|---|---|---|
| 모바일 narrow 화면 버튼 viewport 밖 | flex children `min-width: auto` 기본값 | flex container `min-w-0` + input `min-w-0` + button `shrink-0` (commit `b8254733`) |
| `_worker.js` 갱신 안 됨 / worker 코드 변경 안 반영 | `vite build` 단독 사용 | `npm run build` (= client + worker + prepare) 필수 |
| 글로벌 CSS invert 적용 후 UI 깨짐 | 다크모드 invert hack | 사용 금지 (`docs/INCIDENTS.md`) |
| CSP nonce 적용 후 화면 깨짐 | `style-src` 에 `'nonce-XXX'` | 사용 금지. `'unsafe-inline'` 유지 |

## 환경변수 / 배포

| 증상 | 원인 | 해결 |
|---|---|---|
| `VITE_TOSS_CLIENT_KEY` 와 `TOSS_CLIENT_KEY` 불일치 | Production / Preview tab 분리 설정 누락 | `/api/_healthcheck/payments` 로 사전 감지 |
| Cloudflare Pages deploy 실패 (`Invalid commit message`) | commit message 에 한글 / em-dash / 이모지 | ASCII only 로 변경 |
| `_headers` 2000자 초과 줄 | 한 줄에 너무 많은 CSP directive | 줄 나눔 |

## 결제 server 측 500 에러

| 증상 | 원인 | 해결 |
|---|---|---|
| `/api/orders` 500 — 어느 단계인지 모름 | 단일 catch 만 있어 stage 불명 | stage 변수 추적 (`auth`/`parse-body`/`db-insert` 등) + `safeError` `_debug` (commit `b7f2749b`) |
| Toss confirm 후 wallet/order 이중 처리 | CAS 가드 없음 | 옵션 B 헬퍼 (`confirmTossPayment` + caller CAS) |

---

## 새 사고 추가 템플릿

```
| `<에러 메시지 단어 그대로>` | <발생 SDK/함수> | <진짜 원인 한 문장> | <해결 방법 + commit hash> |
```

**갱신 룰**: 사고 해결 후 같은 commit 에 본 파일에 1줄 추가 (CLAUDE.md 강제).
