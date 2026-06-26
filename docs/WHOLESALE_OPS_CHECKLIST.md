# 유통스타트 도매몰 — 운영 체크리스트 (코드 아님, 대표/운영 작업)

> 2026-06-26 전수조사 라운드 5~6 후속. **코드로 못 끝내는 항목**(외부 콘솔 등록·인프라 바인딩·실결제 검증)과
> **의도적으로 미적용한 코드 꼬리**를 한 곳에 모았다. 코드 수정이 끝나도 아래가 안 되면 일부 기능은 동작 안 함.

## 1. 🔔 알림톡 템플릿 등록 (안 하면 이번에 깐 알림이 안 나감)

이번 라운드에 알림 **배선**은 전부 완료했지만, Aligo 콘솔 + `docs/kakao-alimtalk-templates.md` 에 아래 템플릿 코드가
**미등록**이라 현재 전부 fail-soft 스킵(재시도 큐로 감) 중. 운영이 Aligo 콘솔에 템플릿을 등록하고 실제 코드(`TC_...`)를
환경변수로 매핑해야 발송된다.

| 템플릿 코드(리터럴) | 발송 시점 | 코드 위치 |
|---|---|---|
| `supplier_approved` / `supplier_rejected` | 제조사 가입 승인/반려 | `admin-suppliers.routes.ts` |
| `distributor_approved` / `distributor_rejected` | 판매사 가입 승인/반려 | `distributor-admin/distributors.ts` |
| `wholesale_shipped`(벨) | 발송 시작 → 판매사 | `wholesale-supplier.routes.ts` |
| `distributor_grade_changed`(벨) | 등급 변경 → 판매사 | `distributor-admin/distributors.ts` |

- 벨(대시보드 알림)은 템플릿 없이 이미 동작. **알림톡(문자)만** 템플릿 등록이 필요.
- 등록 시 **본문을 등록 템플릿과 글자 단위로 일치**시켜야 Aligo 가 발송함(`sendSystemAlimtalk` 은 완성 문자열 전달).
- 권장: 리터럴 코드를 env-우선(`env.ALIGO_SUPPLIER_APPROVE_TEMPLATE || 'supplier_approved'`)으로 바꾸면 운영이
  코드 수정 없이 실코드를 가리킬 수 있음(셀러 경로 `admin-sellers.routes.ts` 가 이미 이 패턴).

## 2. ☁️ Cloudflare 바인딩 확인 (미설정 시 조용히 fail-open / 성능 저하)

| 바인딩 | 미설정 시 영향 | 확인법 |
|---|---|---|
| `CACHE_KV` | SSR self-fetch 콜드 D1 → 도매 카탈로그 스켈레톤 고착 | 대시보드 Variables and Secrets |
| `RATE_LIMIT_KV` | 민감 엔드포인트 rate-limit **fail-open**(무제한) | `curl -I .../api/products` → `X-RateLimit-Limit` 헤더 존재 |
| `TURNSTILE_SECRET` | 봇 챌린지 fail-open | 후원/가입 경로 |
| `DATA_ENCRYPTION_KEY` | 토큰/시크릿 암호화 저장 | 카카오·네이버 연동 토큰 |

## 3. 🧪 staging 실결제 검증 (라이브 반영 전 1회씩)

CLAUDE.md 에 "재오픈/반영 전 staging 필수"로 남은 것들:
- **쇼핑탭 할인결제**: 쿠폰 + 딜 동시 결제 → `/confirm` 통과 + 잔액 차감 + 환불 시 복원.
- **숙소 오버부킹**: reserve-before-charge → 방 못 잡으면 청구 안 됨(E2E 1회).
- **도매 결제 흐름**: 예치금 충전 → 주문 → 발송 알림 → (부분)환불 복원.

## 4. 🧩 의도적으로 미적용한 코드 꼬리 (가치/위험 판단상 보류 — 결정 필요)

### 🟠 P1 — 클레임 승인 환불이 "전액·전 라인" 고정 (다제조사 주문에서 과다환불)
- **현상**: 판매사가 단일 라인(한 제조사 상품)만 하자 신고해도, 승인 시 제공되는 환불 경로가 **전액 환불 +
  멀쩡한 제조사들 정산까지 전부 clawback**. (단일 제조사 주문에선 정상 동작.)
- **추가**: 승인 핸들러가 환불을 **서버에서 집행하지 않고** 어드민의 2차 클라이언트 클릭에 의존 → 그 클릭이
  누락/실패하면 **바이어 미환불 + 제조사 정산 영구 HOLD**(공급자 미지급) 가능.
- **위치**: `wholesale-claims.routes.ts`(approve 분기) → `distributor-admin/orders.ts` 전액 환불 엔드포인트.
  헬퍼(`reverseSupplierOnWholesaleRefund`)는 `supplierId`/`productIds` 부분 스코프를 이미 지원함.
- **왜 보류**: 환불 머니패스를 바꾸는 민감 변경 + 현재 트래픽 초기·다제조사 주문 거의 없어 **라이브 노출 위험 낮음**.
  다제조사 주문이 늘기 전 선제 수정 권장. **대표 승인 시 즉시 구현 가능**(라인 스코프 환불 라우팅 + 승인 시 서버 집행).

### 🟡 P2 — 부분환불 재시도 idempotency-key
- `toss-refund-retry.ts` 재시도가 원래 취소 시도와 **다른** idempotency-key 사용 → 부분환불에서만 좁은 이중환불 위험
  (전액환불은 토스가 "이미취소"로 거부해 안전). 정식 수정은 원래 키를 실패행에 저장해야 하는데 그 저장 지점이
  **잠긴 Toss 게이트웨이 인접**이라 보류. 위험 narrow.

### 🟡 P2 — `naver_product_exports` UNIQUE 에 owner_type 누락
- export 이력 테이블 UNIQUE 가 `(seller_id, product_id)` 라 제조사/판매사 id 충돌 시 이력 카운트 오염 가능
  (자금 무관, 이력성). 수정 = 컬럼 추가 + UNIQUE 재구축(self-heal 패턴). 우선순위 낮음.

### 🟢 P2 — a11y / i18n 잔여
- 일부 input `aria-label` 누락, 모달 ESC/focus-trap 미구현, `t(...).replace('{{n}}')` dead-code(ko 정상).
  기능 영향 없음 — 접근성/다국어 품질 개선 항목.

---

## 변경 이력
- 2026-06-26 초안 — 전수조사 라운드 5~6(정산/알림/뷰포트/보안/authz/에러상태) 후 운영 잔여 정리.
