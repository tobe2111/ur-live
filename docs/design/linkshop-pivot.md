# 유어딜 비즈니스 모델 Pivot — 링크샵·공구·어필리에이트

**제안 날짜**: 2026-05-25
**현 상태**: ⏳ 컨셉 / 🚨 **사용자 정책 결정 다수 대기**
**관련 docs**: [shipping-redesign.md](./shipping-redesign.md)

---

## 🚨 2026-05-25 audit 정정

초기 docs 작성 시 누락된 ground truth (사용자 catch + 코드 재확인):

1. **공구 = voucher (QR/교환권) 모델** — 실물 배송 불필요. 카테고리 7종 전부 `*_voucher`. 본 docs 의 "공구 호스팅" Phase 3 정의가 (a) voucher 공구 호스팅 vs (b) 실물 공구 신설 인지 결정 필요. shipping-redesign.md §0 참조.

2. **어필리에이트 부분 구현됨** — `affiliate_ref` 헤더 + `referral_bonus` 테이블 + 양방향 **0.5%** (`COMMISSION_DEFAULTS.REFERRAL_BONUS_BOTHSIDES_PCT`) 이미 동작. first-time-only dedup + self-refer 차단 있음. Phase 4 는 "신규" 가 아니라 **확장 + 큐레이터 단위 정산 + 출금 UI**. 본 docs 의 "1%" 는 잘못된 가정 → 아래 정책 표에서 정정.

---

## 1. 한 줄 요약

기존 "셀러 라이브커머스 플랫폼" → **"어드민 SSOT 카탈로그 + 모든 유저가 큐레이터(링크샵) + 누구나 공구 호스팅 + 1% 어필리에이트"** trinity 로 전환.

라이브는 **죽이지 않고** 큐레이터 페이지의 한 탭으로 강등 (= differentiator 로 retain).

---

## 2. 핵심 변경 사항

| 축 | 기존 | 신모델 |
|---|---|---|
| **상품 등록 주체** | 셀러 | 어드민 SSOT |
| **카탈로그** | 셀러별 분산 | 어드민이 큐레이트한 단일 카탈로그 |
| **유저 행동** | 시청 / 구매 | 시청 / 구매 / **큐레이션(핀)** / **공구 호스팅** / **공유로 정산** |
| **셀러 정의** | 상품 공급자 | **정산 받는 큐레이터** (= 매출 누적 시 자동 사업자 전환 안내) |
| **라이브** | 메인 | 큐레이터 페이지 한 탭 (옵션) |
| **수수료 구조** | 셀러 5% | 어드민 마진 25-40% (도매-소매 spread) + 큐레이터 1% 어필리에이트 |

### 사업성 (요약)

- **차별화**: 한국에 "공구 + 어필리에이트 + 큐레이션" 통합 플레이어 없음 (올웨이즈·핀터레스트·쿠팡파트너스 따로 존재)
- **Acquisition**: 셀러 모집 0 (어드민 직접) + 유저는 공유 viral loop
- **Unit economics**: 25-40% spread > 5% commission, 체급 다름
- **천장**: 카탈로그 폭 × 큐레이터 reach (지수형), 셀러 수 선형보다 큼

상세 비교는 채팅 history (2026-05-25) 참조.

---

## 3. 시스템 변경 영역

### Phase 0 — 사업 준비 (코드 외)
- [ ] **MD/sourcing 팀 확보** — 초기 카탈로그 100-300 SKU
- [ ] **상품 카테고리 정의** — 패션 / 뷰티 / 식품 / 생활 / 디지털 등
- [ ] **공급사 파트너십 계약** — 도매가 / MOQ / 합배송 가능 여부

### Phase 1 — 링크샵 + 큐레이션 (코드)

#### 1-A. 기본 인프라
- [ ] `/u/:handle` 링크샵 페이지 (모든 유저)
- [ ] 큐레이터 핸들 (`users.handle` UNIQUE)
- [ ] 상품 "핀" 모델 (`product_pins` 테이블: user_id, product_id, position, note, created_at)
- [ ] 어필리에이트 링크 (`/u/:handle/p/:product_id` → ref=user_id 쿠키 30일)
- [ ] 큐레이터 페이지 SEO (OG image — 큐레이터 이름 + 상품 이미지, 동적 생성)

#### 1-B. 🚨 핵심 UX — "핀 추가가 1탭" (사용자 강조 요구사항)
- [ ] **모든 상품 카드에 "+ 내 링크샵에 핀" 버튼** (홈/쇼핑/검색/상품상세 어디서나)
- [ ] 비로그인 사용자 → 카카오 로그인 1탭 후 자동 핀
- [ ] 핀 추가 시 즉시 toast: "₩{상품가}원짜리 상품 핀됨. 친구에게 공유하면 0.5% 적립!" + 공유 버튼
- [ ] 핸들 없는 유저 → 첫 핀 시 자동 핸들 생성 (kakao nickname 기반, 충돌 시 숫자 suffix)
- [ ] 인기 / 최근 본 / 카테고리별 "추천 핀 후보" 섹션 — 큐레이터 페이지 빈 상태 방지
- [ ] 핀 순서 드래그앤드롭 (모바일 long-press)
- [ ] 핀 카드에 큐레이터 한 줄 노트 (옵션, "왜 추천?")

#### 1-C. 🚨 핵심 UX — "수익 가시화" (사용자 강조 요구사항)
- [ ] **큐레이터 페이지 상단 dashboard**: 이번 달 적립 ₩X / 클릭 N / 구매 M / 인기 핀 top 3
- [ ] **각 핀 옆 stats**: "7일 클릭 N · 구매 M · 적립 ₩X" (큐레이터 본인만 보임)
- [ ] **구매 발생 즉시 push 알림**: "🎉 당신의 핀으로 ₩X 적립" (`sendSystemPush`)
- [ ] **공유 simulator**: "이 상품 5명 공유 시 예상 적립 ₩X" — 핀 추가 toast 에 박기
- [ ] `/u/me/earnings` 큐레이터 정산 대시보드 (일별 차트 + 출금 가능 잔액)

#### 1-D. 공유 마찰 0
- [ ] 핀 카드 / 큐레이터 페이지 / 상품 상세 모두에 **카톡 / 인스타 스토리 / 링크복사 1탭 공유 버튼**
- [ ] 카톡 공유는 카카오 sharing API (이미 SDK 있음) — OG image 동적
- [ ] 인스타 스토리: 상품 이미지 + 가격 + 큐레이터 핸들 sticker 자동 합성
- [ ] 공유 시 ref=user_id 자동 쿠키 (현 `affiliate_ref` 헤더 시스템 재활용)

### Phase 2 — 배송 재설계 🚨
**별도 docs**: [shipping-redesign.md](./shipping-redesign.md)

### Phase 3 — 공구 호스팅 (✅ A 채택: voucher 공구만)
- [ ] 누구나 voucher 공구 개설 가능 (현재는 셀러만)
- [ ] `group_buys.host_user_id` 추가 (어드민 상품을 호스트가 "발견" + 공구 모집)
- [ ] 호스트 인센티브 (마감 시 1-2% 추가 적립)
- [ ] 공구 진행 dashboard (모집 인원 / 남은 시간 / 공유 링크)
- [ ] 실물 공구는 도입 X (B 옵션 거부) — 실물은 일반 쇼핑 (1인 주문) only

### Phase 4 — 어필리에이트 정산
- [ ] `referral_earnings` 테이블 (referrer_id, order_id, amount, status)
- [ ] 1% 자동 적립 (결제 완료 webhook)
- [ ] 큐레이터 → 셀러 자동 승급 안내 (월 정산액 일정 threshold)
- [ ] 출금 UI / 사업자등록 안내

### Phase 5 — 셀러 흡수 (Migration)
- [ ] 기존 셀러 → 큐레이터 + 라이브권 보유자로 자동 변환
- [ ] 기존 셀러 상품 → 어드민 카탈로그 흡수 (검수 후)
- [ ] 셀러 가입 페이지 → "큐레이터 시작" UI 로 점진 교체
- [ ] 라이브는 큐레이터 페이지 한 탭으로 강등

### Phase 6 — 마케팅 / UX 강화
- [ ] 인스타·카톡 공유 UX 정교화 (OG / dynamic link)
- [ ] "이 상품 공유 시 예상 정산 simulator"
- [ ] 사기/봇 모니터링 (self-ref / 같은 IP 반복 구매)

---

## 4. 정책 결정 필요 (사용자 확인 항목)

| 항목 | 권장 default | 결정 필요 |
|---|---|---|
| **어필리에이트 비율** | **현행 0.5% 양방향 유지** (큐레이터 단독 비율로 분리할지 결정) | ⏳ 사용자 확정 |
| **공구 호스팅 정의 (Phase 3)** | (A) 기존 voucher 공구를 누구나 호스팅 가능 / (B) 실물 공구 신설 | ⏳ shipping-redesign §0 와 연동 |
| **공구 호스트 인센티브** | 마감 성공 시 거래액 1% 추가 | ⏳ |
| **큐레이터 → 셀러 승급 threshold** | 누적 정산 50만원 (사업자등록 자동 안내) | ⏳ |
| **사기 방지**: 자기 ref 자기 구매 처리 | 정산 제외 (탐지 시 적립 회수) | ⏳ |
| **기존 셀러 retention** | 라이브권 + 큐레이터 흡수 + 기존 매출 commission 유지 | ⏳ |
| **카탈로그 검색 노출**: 큐레이션 vs 인기순 vs 어드민 추천 | 하이브리드 (메인 = 어드민 큐레이션, 검색 = 인기순) | ⏳ |
| **상품 등록 권한**: 100% 어드민 only vs 일부 셀러 셀프 등록 허용 | 100% 어드민 (검수 마찰 0) | ⏳ |

---

## 5. 위험 요소

- 🔴 **카탈로그 콜드스타트** — 초기 SKU thin 하면 큐레이션할 게 없음. MD 선행 필수
- 🔴 **공구 UX 진입 장벽** — 친구 모집 자체가 일. 인스타/카톡 공유 매끄럽지 않으면 사망
- 🟡 **수익 가시화** — "1% 적립" 모호. "이 상품 5명 공유 시 예상 1만 딜" simulator 필요
- 🟡 **사기/스팸** — 자기 ref / 봇 공유. 어드민 모니터링 + 출금 검증
- 🟡 **셀러 이탈 sentiment** — "라이브 강등" 인식되지 않게 communication 정교
- 🟡 **MD 인력 cost** — 어드민이 카탈로그 알파라 인력 의존

---

## 6. 진행 순서

```
Phase 0 (MD/sourcing 사업 준비)  ← 사업
   ↓
Phase 1 (링크샵 + 핀)           ← 코드 시작점
   ↓
Phase 2 (배송 재설계 — 별도 docs) ← 🚨 신모델 핵심
   ↓
Phase 3 (공구 호스팅)
   ↓
Phase 4 (어필리에이트 정산)
   ↓
Phase 5 (셀러 흡수)             ← 가장 마지막, 기존 사용자 보호
   ↓
Phase 6 (마케팅 UX)
```

---

## ⏳ 구현 todo

전체 구현은 위 Phase 별로 별도 commit. 각 Phase 완료 시 본 docs 하단에 `## ✅ 구현 완료` 섹션 추가.

---

## ✅ Phase 1 구현 완료 (2026-05-25)

| Commit | 영역 | hash |
|---|---|---|
| 1/5 | DB schema + 정책 SSOT | `97cd54b2` |
| 2/5 | Worker API (13 endpoints) + push 알림 + OG image | `060e0249` |
| 3/5 | Frontend 1-A 인프라 (CuratorPage / EarningsPage / 라우팅 / i18n 6언어) | `82ddc4a9` |
| 4/5 | Phase 1-B 핀 1탭 UX (PinButton + 자동 핸들 + 자동 핀) | `0f4824cd` |
| 5/5 | Phase 1-C+D 공유 (KakaoShareButton 통합) + 가이드 동기화 | (이 commit) |

### 새 라우트
- `GET /u/:handle` (public, 다크 테마)
- `GET /u/me/earnings` (requireUser, 라이트/다크 toggle)
- `GET /u/:handle/p/:productId` (SPA fallback → 서버 302)
- 13 worker endpoints under `/api/curator/*`

### 다음 phase
- **Phase 2 (배송 재설계)** — shipping-redesign.md §0 A 채택 반영. 공구 voucher 모델 유지, 일반 쇼핑 배송만 재설계.
- **Phase 3 (공구 호스팅 확장)** — voucher 공구를 누구나 호스팅 (`group_buys.host_user_id` 추가).
- **Phase 4 (어필리에이트 정산 확장)** — 큐레이터 출금 UI + 큐레이터 → 셀러 자동 승급 안내.
- **Phase 5 (셀러 흡수)** — 기존 셀러 → 큐레이터 + 라이브권 자동 변환.

### 알려진 한계 (후속 PR)
- ReelProductCard / ProductDetailPage 의 PinButton inject (좁은 UI 영역 정교화 필요)
- 인스타 스토리 공유 (canvas 합성 필요 — Cloudflare Workers 미지원 클라이언트 단)
- ja/zh/es/fr i18n 번역 (현재 한국어 stub)
- 핀 stats client cache (현재 매 페이지 fetch — react-query 도입 후 최적화)
- 동적 OG image 의 한글 폰트 (현재 system font — 카카오 크롤러 환경 따라 fallback)
