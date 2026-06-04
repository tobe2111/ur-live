# 유통스타트 도매몰 — 사용자 할 일 (TODO)

> 코드(Phase 1~5)는 전부 완성·푸시됨. 아래는 **사용자(운영자)가 직접 해야 하는** 작업.
> 코드로 못 하는 것(권한·외부 콘솔·실데이터 입력)만 모았습니다.

## 🔴 필수 (이거 안 하면 도매몰 안 뜸)

- [ ] **1. 배포 확인** — `git push` 후 GitHub Actions 녹색 확인 → `live.ur-team.com` 반영
- [ ] **2. DB 스키마 반영** — 배포 후 `/admin/health` 의 "스키마 복구" 버튼 1회 클릭
      (또는 `POST /api/_internal/repair-schema`). 새 테이블 `distributor_grades`,
      `wholesale_orders`, `wholesale_order_items`, `wholesale_proposals` + sellers 새 컬럼 생성.
      ※ 안 해도 첫 API 호출 시 자동 생성되게 방어코드 넣었지만, 명시적 1회 권장.
- [ ] **3. utongstart.com 도메인 연결** — Cloudflare → Workers&Pages → `ur-live`
      → Custom domains → `utongstart.com` 추가 (DNS CNAME 자동 안내).
      이거 하면 utongstart.com 접속 시 자동으로 도매몰 입구(`/wholesale`)가 뜸.

## 🟡 도메인 연결했다면 추가로

- [ ] **4. 카카오 OAuth 콜백 추가** — utongstart.com 에서도 카카오 로그인 쓰려면
      카카오 개발자콘솔 → 내 앱 → Redirect URI 에 `https://utongstart.com/...` 콜백 등록.
      (안 하면 utongstart 도메인에서만 카카오 로그인 막힘)

## 🟢 운영 데이터 입력 (도매몰 실제 가동용)

- [ ] **5. 등급 마진율 확정** — `/admin/distributor-grades` 에서 A/B/C/D/OEM/특별할인
      마진율을 실제 정책값으로 조정 (현재 기본값 A10/B15/C20/D25/OEM8/특별0%).
- [ ] **6. 제조사(공급자) 입점** — 제조사가 `/supplier/register` 가입 → 어드민 `/admin/suppliers`
      승인 → 제조사가 도매 상품 등록(공급가 입력).
- [ ] **7. 유통사 등급 배정** — 가입한 유통사(셀러)를 `/admin/distributor-grades` 에서
      검색 → 등급 매기기 (미배정 시 기본 D등급 = 최고마진).
- [ ] **8. (선택) 상품 제안** — `/admin/distributor-grades` 하단에서 특정 유통사에게
      추천 상품 등록 → 유통사 카탈로그 상단에 노출.
- [ ] **9. (선택) 세금계산서** — 월말 `/admin/distributor-grades` 세금집계로 유통사별 매출/
      제조사별 매입 확인 후 **수동 발행** (1차 정책).

## 🧾 전자세금계산서(국세청) 발행 — 2026-06-04 추가

내부 발행/인쇄(거래명세서·세금계산서)는 코드로 완료(유통사는 `/wholesale/documents` 에서 조회·인쇄).
**국세청 정식 전자세금계산서(바로빌)** 발행만 아래 2개 설정이 필요:

- [ ] **A. 플랫폼 사업자정보 입력** — `/admin/distributor-grades` → "플랫폼 사업자정보" 폼에
      상호·사업자번호·대표자·주소·업태·종목·이메일·전화 입력 후 저장. (**코드 UI 완료 — 입력만**)
- [ ] **B. 바로빌 API 키 등록** — Cloudflare → Workers&Pages → `ur-live` → Settings → Variables
      → `BAROBILL_PROD_API_KEY` (운영) 또는 `BAROBILL_TEST_API_KEY` (테스트) + `BAROBILL_ENV=production`.
      (**Cloudflare 콘솔 작업 — 코드 불가**)

→ A + B 완료 시 세금계산서 행의 "국세청발행" 버튼 활성화. 미설정 시 내부 발행/인쇄는 그대로 동작.

## ⚙️ 새 스키마(자동 self-heal) — 별도 마이그레이션 불필요

2026-06-04 추가 컬럼/테이블(`products.min_order_qty`·`supply_margin_override_pct`,
`product_qty_tiers`, `tax_documents`)은 **lazy ensure** 로 첫 도매 API 호출 시 자동 생성됨
(TD-001 마이그레이션 CI 무관). 명시적 1회 원하면 `/admin/health` 스키마 복구 클릭.

## 🧪 가동 전 테스트 (권장)

- [ ] 유통사 계정으로 `/wholesale` → 상품 주문 → Toss 결제 → 주문내역 확인
- [ ] 제조사 계정으로 `/supplier/wholesale-orders` → 송장 입력 → 유통사 주문 SHIPPED 확인
- [ ] 반품 1건 테스트 → Toss 환불 + 재고 복원 확인

---

_담당: 운영자 / 코드측 완료: Phase 1~5 (docs/design/wholesale-utongstart.md 참조)_
