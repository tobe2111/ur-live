# 🗺️ 카카오맵 리뷰 게이미피케이션 — 리뷰 점수·레벨 → 전용 자격

- **받은 날**: 2026-07-02 (대표 구두 컨셉 — 채팅)
- **상태**: 🟡 플로우 설계 제안 (대표 결정 4건 대기 — 아래 결정표)
- **원문 요지**: "어차피 카카오맵 기반으로 구현했잖아. 유저가 직접 카카오맵에 리뷰를 쓰고 매장에서 확인하면 유저의 점수를 높여주는 거지. 레벨이 올라가면서 그 사람들에게만 보이는 이용권 구매 및 홍보 자격이 주어지거나. 그 플로우를 결정하는 게 중요."

---

## 0. 핵심 발견 — 앞쪽 절반은 이미 구현돼 있음

| 이미 있는 것 | 위치 | 재사용 |
|---|---|---|
| 카카오맵 리뷰 제출→검증→보상 플로우 전체 | `kakao_review_submissions` (migration 0250) + `src/features/group-buy/api/review-bonus.routes.ts` | ✅ 그대로 확장 |
| 이용권 1건당 1회 멱등 | `UNIQUE(voucher_id)` | ✅ |
| 스크린샷 OCR 자동승인 (Workers AI llava) | review-bonus.routes.ts (`kakao_review_auto_approve` platform_setting) | ✅ |
| 어드민 검증 큐 | `src/pages/AdminKakaoReviewsPage.tsx` + `/api/admin-review-bonus/*` | ✅ |
| 매장↔카카오맵 연결 | `product_supply_meta.kakao_place_url` + `src/shared/kakao-place-url.ts` (URL 검증) | ✅ |
| 딜포인트 원장 | `src/worker/utils/point-ledger.ts` `adjustUserPoints` | ✅ |
| 스크린샷 업로드 | `POST /api/upload/image` (R2) | ✅ |
| 소비자 등급 뼈대 | `user_tiers` (bronze~diamond, `loyalty.routes.ts`) — 단 **지출 기반**이고 혜택 미강제(표시용) | ⚠️ 참고만 (아래 결정 2) |
| claim-before-credit 멱등 레퍼런스 | `src/worker/utils/invite-reward.ts` | ✅ 패턴 복사 |

**신규로 만들 것**: ① 리뷰 점수→레벨 축, ② 레벨 게이트(전용 이용권 구매), ③ (옵션) 매장측 승인 큐, ④ (v2) 홍보 자격.

## 1. 추천 플로우 (v1)

```
[1] 이용권 매장 사용 완료 (QR/PIN 확인 — 방문+결제가 이미 인증됨)
       ↓ 해당 건에 "카카오맵 리뷰 미션" 활성화 (내 지갑/사용완료 화면에 CTA)
[2] 앱이 매장 kakao_place_url 로 딥링크 → 유저가 카카오맵에 리뷰 작성
       ↓
[3] 앱에서 스크린샷 + 리뷰 URL 제출  (기존 POST /api/review-bonus/submit 그대로)
       ↓
[4] 검증 (결정 1 — 2026-07-02 대표 피드백 반영):
       결정론 자동 검증 (비용 0): 사용완료 이용권 본인 소유 + 카카오맵 URL 형식 + 멱등
       → 셀러 대시보드 승인 큐 (매장에서 확인 — 지급 판정의 주체)
       → 어드민은 샘플링 감사만
       (OCR 은 자동 지급 없이 큐에 "자동검증 통과" 참고 라벨만 — 아래 §3-3)
       ↓ 승인 시 (claim-before-credit CAS, UNIQUE(voucher_id) 멱등)
[5] 적립: 딜포인트 보너스(현행 kakao_review_bonus_amount) + 리뷰 점수(신규)
       ↓
[6] 점수 누적 → 레벨 산정 → 레벨 도달 알림(notifyUser)
       ↓
[7] 혜택 해금: min_review_level 달린 전용 이용권 구매 가능 (+ v2: 홍보 자격)
```

**왜 "사용 완료 이용권" 전제가 핵심인가**: 실제 방문·결제 없이는 미션이 안 열림 → 알바 리뷰/봇 어뷰징이 구조적으로 비쌈. 매장-유저 공모도 실매출이 발생해야 가능 → 자연 억제. (현행 review-bonus 도 이미 이 전제.)

## 2. 데이터 모델 제안

- **점수/레벨**: 신규 테이블 `user_review_scores` (`user_id TEXT PK, score, approved_count, level, updated_at`) — 적립은 `kakao_review_submissions` 승인 트랜지션(CAS `submitted→approved`) 에서만. 레벨 임계값은 `platform_settings` (`review_level_thresholds` JSON, 예: Lv2=3건, Lv3=10건, Lv4=25건, Lv5=50건).
  - `user_tiers` 재사용 대신 신규로 하는 이유: user_tiers 는 지출축(VIP)이고 CHECK(bronze|silver|gold|diamond) 제약 — 의미 희석 + 스키마 충돌.
- **레벨 게이트**: products 컬럼 추가 금지(예산제) → `product_supply_meta` K-V 에 `min_review_level` 저장 (`product-supply-meta.ts` 재사용). 구매 라우트(`/api/group-buy/.../join` 및 confirm-toss 재검증 — 2026-07-01 per-person-limit 과 동일 이중 게이트 패턴)에서 레벨 미달 시 403 + 상세/목록에 "Lv N 전용" 배지.
- **매장 승인 큐(옵션)**: `kakao_review_submissions` 에 상태 추가 없이 — 셀러 라우트 `GET/POST /api/seller/review-verifications` 가 자기 `seller_id` 건만 조회/승인 (IDOR: seller_id 소유권 체크 필수). 어드민 큐는 그대로 상위 권한.

## 3. ⚠️ 리스크 (대표 인지 필수)

1. **카카오맵 리뷰 조회 API 없음** — "리뷰를 썼는지" 기계 검증 불가. 스크린샷/URL 검증이 최선(현행). **보상 후 리뷰 삭제 유저는 못 잡음** (잔존 리스크 수용).
2. **대가성 리뷰 정책 리스크** — 카카오맵 운영정책상 대가 제공 리뷰 유도는 조작으로 간주될 수 있음 → 매장 지도 노출 제재·리뷰 일괄 삭제 가능성. 표시광고법상 대가 표시 의무. 현행 1,000딜 보너스도 이미 이 영역. 완화: 보상을 별점·내용과 무관하게 "방문 인증"에 지급 + 제출 화면에 대가 표시 안내 문구.
3. **OCR 자동승인은 v1 축으로 부적합** (2026-07-02 대표 "OCR 너무 무거운 거 아니야?" 검토 결과) — 인프라 부담은 사실상 없음(Workers AI llava 서버리스 호출 1건/제출, 상시 서버 0, 건당 소액, 현재 기본 OFF `kakao_review_auto_approve=0`). **진짜 문제는 신뢰성**: ① 현행 코드가 OCR 통과 시 `status='paid'` **즉시 지급** — 퍼지 모델이 돈 판정 주체가 됨, ② 스크린샷은 위조/타인 리뷰 캡처 구분 불가 → 자동 지급과 결합 시 어뷰징 자동화 통로, ③ 제출 요청에 동기로 붙어 응답 지연(이미지 fetch 10s+추론). **결론: 지급 판정은 사람(매장→어드민 샘플링), OCR 은 자동 지급 제거 후 큐의 참고 라벨로 강등하거나 OFF 유지.**

## 4. 대표 결정표 (플로우 확정에 필요한 4건)

| # | 결정 | 옵션 | 추천 |
|---|---|---|---|
| 1 | 검증 주체 | (a) 매장 승인 + 어드민 샘플링 (OCR 은 참고 라벨/OFF) / (b) 매장 전담 / (c) 어드민 전담(현행) / ~~(d) OCR 자동 지급 하이브리드~~ | **(a)** — 지급 판정은 사람, 결정론 검증은 자동 (2026-07-02 OCR 강등 — §3-3) |
| 2 | 레벨 축 | (a) 리뷰 전용 레벨 신설 / (b) 기존 VIP(user_tiers) 통합 | **(a)** — "동네 리뷰어" 정체성 명확, 지출축과 분리 |
| 3 | 혜택 v1 범위 | (a) 전용 이용권 구매만 / (b) +홍보 자격(노출 부스트·배지)까지 | **(a)** — 게이트 1개로 빠른 검증, 홍보는 v2 |
| 4 | 정책 리스크 | (a) 안전장치(별점 무관 지급+대가 표시 안내) 넣고 진행 / (b) 그대로 진행 / (c) 자체 리뷰(product_reviews) 중심 전환 | **(a)** |

## 5. 구현 todo (결정 후)

- [x] `user_review_scores` 테이블 (`review-level.ts` ensure 패턴 — redemption-settings 선례) + 승인 CAS 에 점수 적립 배선 (멱등: CAS 승자 + UNIQUE(voucher_id))
- [x] 레벨 산정 + `platform_settings` 임계값(`review_level_thresholds`/`review_score_per_approval`) + 레벨업 notifyUser
- [x] `product_supply_meta.min_review_level` + 이용권 구매 라우트 이중 게이트 (join 사전검증 + confirm-toss 재검증, `REVIEW_LEVEL_REQUIRED`) + 상세 API/배지(공구 상세·교환권 상세) + 어드민 동네딜 폼(등록/수정/목록)
- [x] 셀러 대시보드 리뷰 확인 큐 (`/seller/review-verifications` — requireSeller + seller_id 소유권, i18n 6언어)
- [x] OCR 자동 지급 경로 강등 (라벨만 — 어드민 명시 `kakao_review_auto_approve` 설정은 유지)
- [x] 어드민 승인 경로 CAS 교정 (기존: pre-check 후 지급→UPDATE 순서라 동시 승인 이중지급 레이스 → claim-before-credit + 지급실패 보상 원복)
- [x] 제출 모달 대가 표시 안내 + 별점 무관 문구 + 내 레벨 표시 (`ReviewBonusButton`)
- [x] 가이드(셀러/어드민) + 블로그 시드 갱신 (`BLOG_SEED_VERSION` 4→5)
- [ ] (v2) 홍보 자격 — 레벨 배지 노출·핀 부스트 (대표 결정 3 범위 밖)
- [ ] (v2) 사용 완료 이용권 카드에 kakao_place_url 딥링크 CTA (현재는 제출 버튼만 — 매장 후기 페이지 바로 열기)
- [ ] (v2) 셀러 상품 등록 폼에도 min_review_level (v1 은 어드민 동네딜 도구만 — 큐레이션 통제)

## ✅ 구현 완료 (2026-07-02 — 대표 "추천대로 진행해줘. 가장 이상적으로")

**확정된 결정**: 1=(a) 매장 승인+어드민 샘플링(OCR 라벨 강등) · 2=(a) 리뷰 전용 레벨 신설 · 3=(a) 전용 이용권 구매 게이트만 · 4=(a) 별점 무관 지급+대가 표시 안내.

**구현 요약**:
- 신규 SSOT: `src/worker/utils/review-level.ts` (user_review_scores + 레벨 산정 + 적립 + 레벨업 알림)
- `review-bonus.routes.ts`: OCR 지급 강등 · 공용 approve/reject 헬퍼(CAS) · 셀러 큐 3 endpoint · `GET /my-level`
- 게이트: `group-buy.routes.ts` join+confirm-toss (per-person-limit 과 동일 이중 게이트 패턴, 기존 metaMap 재사용 = 추가 조회 0)
- UI: `SellerReviewVerificationsPage`(신규) · 공구/교환권 상세 Lv 배지 · 어드민 동네딜 폼 레벨 셀렉트 · 제출 모달 안전장치
- 매장 현지 사용 3모드(2026-07-02 타 세션, `redemption-settings.ts`)와 결합: 모드 ①②는 "사용 완료" 신뢰 앵커를 강화 → 리뷰 미션 전제(used 이용권)의 위조가 더 어려워짐
- ⚠️ 이 원격환경 npm 403 으로 전체 tsc/build 미실행 — 변경 파일 개별 구문검사 + 가드 스크립트(sql/theme/blog/pagination 등) 전부 GREEN. staging 검증 항목: 제출→매장 승인→보너스+점수→레벨업 알림→레벨 전용 이용권 구매 게이트 E2E 1회.
