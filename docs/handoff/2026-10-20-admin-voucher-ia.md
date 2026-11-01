# 2026-10-20 어드민 이용권 화면 정리 (역할이 모호했던 4화면 → 3화면)

대표: *"어드민 대시보드 개선이 필요해. 이용권 관리 페이지 부분 특히 … 상품관리 + 이용권 공구 이런 페이지들 각 역할이 모호해"*
→ 제안 3안 중 **"제안대로 3개로 통합"** 승인. 이어서 *"유어딜과 상관없는 것도 지금 있어? 그런 것들 다 정리도 해야해."*

## 무엇이 문제였나 (라이브 실측)
- `상품 관리` 의 "쇼핑 상품(배송)" **430개 중 약 405개가 이용권**(식사 274 · 숙소 77 · 기타 33 · 뷰티 21).
- `이용권 공구` 200행 **전부 'active'** — 즉시판매(A2)라 진행중/달성/미달성 탭이 아무 일도 안 했다.
- `동네딜 상품 등록` 안에 목록(노출·수정·삭제)이 또 있었고, `공구 엔진 조종석` 에도 목록이 또 있었다.

## 바꾼 것
| 새 화면 | 주소 | 하는 일 |
|---|---|---|
| 이용권 관리 (신규 `AdminVouchersPage`) | `/admin/vouchers` | 목록(DealList 재사용) + 판매/사용 장수 + 줄마다 [판매 설정(옛 조종석) · 추첨 · 노출 · 수정 · 강제 환불 · 삭제] |
| 이용권 등록 | `/admin/dongnedeal-import` | 직접 입력·CSV·데모만(목록 제거) |
| 교환권·쇼핑 상품 | `/admin/products` | `?kind=goods` 로 이용권 카테고리 제외 · 샘플 신청 탭 제거 |

- 옛 주소: `/admin/gb-cockpit` → 이용권 관리로 리다이렉트(페이지 삭제, 편집기는 `components/admin/GbSessionEditor.tsx`로 추출 — 저장 로직 불변).
  `/admin/group-buy` → `?mall=mall|all` 일 때만 옛 화면(공구 서비스 '몰 상품·공구'), 아니면 이용권 관리로.
- 서버: `/api/admin/dongnedeal/list` 에 몰 스코프(기본 main — 운영자 몰 상품 제외) + `sold`/`used`(신규 `worker/utils/voucher-sales-counts.ts`, 환불 제외, 모르면 null).
  `/api/admin/products` 에 opt-in `kind=goods`(`goodsOnlySql`) — 상품 고르기(홈 섹션·리뷰·유어쇼츠)는 이용권이 필요해서 기본값 불변.
- 강제 환불은 **같은 엔드포인트**(`/api/group-buy/admin/force-refund/:id`)·같은 확인 절차 — 버튼 위치만 이동(머니 로직 무접촉).
- nav: '🏪 오프라인 공구' → '🎟️ 이용권', '🛒 온라인 쇼핑' → '🛒 교환권·쇼핑', '딜 모니터링' → '딜 충전 모니터링'.

## 유어딜과 무관한 잔재 정리 (이번 PR)
- **샘플 신청** 제거(어드민 메뉴·페이지·상품관리 탭·GET/PATCH `/api/admin/sample-requests`): 도매 잔재. 신청을 만드는 `/api/supply` 가 10-11 철거로 사라져 큐가 영원히 비어 있었다.

## 🩸 틀릴 뻔한 것
- 조사 에이전트가 `/admin/social`(소셜 홍보)을 **"API 미마운트 = 죽은 화면"** 으로 보고했다. 틀렸다 — `worker/index.ts` 의
  ADS 위임 미들웨어가 `/api/admin/social/*` 를 ur-ads 로 넘긴다(직접 마운트만 주석). 메뉴에서 뺐다가 되돌렸다. **마운트 주석만 보고 죽었다고 판정하지 말 것.**

## 남은 정리 후보 (대표 판단 필요 — 아직 안 함)
- `/admin/buyer-pool`(해외 바이어 — "[TEMP-TEST] ur-wholesale 배포 시 제거 예정" 마운트) · `/admin/maker-pool`(제조사·판매사 후보 — 도매 용도)
- `/admin/cafe24`(옛 상품 가져오기, 시크릿 필요) · `/admin/reviews`(리뷰 **자동 생성** — 표시광고 법적 위험)
- 도매 잔재 코드: `GET/PATCH /api/admin/supplier-products*`(화면 0) · nav 의 `wholesale` 밴드/RBAC 배선 · 상품관리 화면의 공급가 입력·'공급 상품' 배지 · 셀러 `/seller/supply`(API 없음)
- 숨겨진 라이브 잔재 화면(ad-slots·tiktok-discovery·replay·youtube-quota) 파일 삭제

## 다음 세션 첫 액션
배포 후 어드민 `/admin/vouchers` 를 열어 ① 목록에 판매/사용 장수가 뜨는지 ② [판매 설정] 모달이 저장되는지 ③ `/admin/products` 의 "쇼핑 상품" 이 25개 안팎인지.

## 🧨 2차 — 유어딜과 무관한 화면 셋 삭제 (대표 "1,2,3번은 지워줘")

| 지운 것 | 무엇이었나 |
|---|---|
| 해외 바이어 풀 `/admin/buyer-pool` | 해외 바이어 리드 수집·자동 수집 cron(buyer-autofetch)·`/api/buyer-ingest` |
| 제조사·판매사 후보 풀 `/admin/maker-pool` | 도매 공급자 리드 화면 + 유어애즈 `collect-maker` 레인 킥 |
| Cafe24 연동 `/admin/cafe24` | Cafe24 OAuth·상품 연동(`features/cafe24` 통째) |

- 화면·라우트·API 마운트·cron·레인 킥·nav 항목·역할 권한(`cafe24`)·업로드 한도 예외 전부 제거.
- 🔒 **DB 테이블은 안 지웠다**(데이터 삭제 = 결재 C). 노출과 코드만 끊었다.
- 시험은 "되살아나지 않는다" 방향으로 재조준(`supply-teardown-safety` · `wholesale-teardown-2026-10-11` · `admin-nav-*` · `upload-body-limit`).
- 주입 앵커 2건 정리: maker-pool 마운트를 앵커로 쓰던 도매 부활 주입은 `wholesale-malls` 마운트로 재조준, "maker-pool 잔류" 주입은 삭제(지킬 대상이 없다).
- 남은 후보(대표 판단 대기): ④ 리뷰 자동 생성 `/admin/reviews` ⑤ 도매 흔적 코드(supplier-products API·도매 RBAC·공급가 입력·`/seller/supply`).
- ⚠️ 유어애즈 하트비트에 `ads:collect-maker` 가 남아 있으면 은퇴 판정(`cron-beat-retirement`)이 디스패처 미호출로 곧 정리한다 — 침묵 경보로 오진하지 말 것.
