# 유통스타트 도매몰 A/B 테스트 체크리스트 (전 대시보드)

> 도매몰 전 표면(판매사·제조사·admin 대시보드 포함)을 **철저히** 실험·검증하기 위한 surface별 체크리스트.
> 실험 1건 설계는 `docs/AB_TEST_TEMPLATE.md`(양식) 사용. 이 문서는 **무엇을 어디서 측정·실험·가드** 하는지의 지도.

---

## A. 전제 (먼저)

- 🔧 **실험 인프라 없음** — 글로벌 feature-flag만 존재(`src/shared/config/feature-flags.ts`), variant 버킷팅/측정 X.
  먼저 **결정적 해시 버킷팅 유틸**(`hash(accountId + 실험키) % 100`, 서버·클라 동일 순수함수 + 단위테스트) +
  **이벤트 로깅**(노출/전환) 필요. (없이는 어떤 도매 실험도 신뢰 불가 — 체크리스트 G.)
- 🎯 **배정 단위 = 계정**(seller_id / supplier_id). 세션 단위 금지(B2B 는 재방문·다계정).
- 🧪 **저트래픽 주의** — 도매몰은 소비자몰 대비 모수 작음 → MDE 크게, 기간 길게(최소 2~4주), 세그먼트 쪼개기 지양.
- 🚫 **결제·정산·등급가 로직은 실험 변수로 두지 말 것**(아래 E 가드레일). 실험은 **UI/카피/노출/플로우 순서**에 한정.

---

## B. 판매사(구매자측) 퍼널 — surface별

> 북극성: **가입→첫 발주→재발주(반복구매)**. 퍼널 전환을 단계별로 계측.

| 퍼널 단계 | surface (파일) | 핵심 KPI | 실험 아이디어 | 절대 가드레일 |
|---|---|---|---|---|
| 인입 | `WholesaleStartPage`·`WholesaleIntroPage` | 가입 클릭률 | 히어로 카피/CTA, 등급혜택 노출 | — |
| 가입 | `WholesaleJoinPage` → `POST /register`·`/become-distributor` | 가입 완료율, 단계 이탈 | 폼 단계수, 사업자정보 입력 안내, **전자계약 안내 문구** | 사업자번호/등록증 필수 검증 불변 |
| 첫 탐색 | `WholesaleCatalogPage` (+SSR) | 카탈로그→상세 CTR, 검색 사용률 | 정렬 기본값, 카드 정보(등급가/MOQ/재고 뱃지), 카테고리 칩 | **supply_price·제조사 신원 비노출**(E1), LCP |
| 대량주문 | `wholesale-catalog/BulkOrderPanel` | bulk-preview 호출율, 업로드→카트 전환 | **패널 진입 노출 승격**(현 토글), 양식 안내, 오류리포트 UX | bulk-preview 검증(MOQ/박스/재고) 불변 |
| 장바구니 | `useWholesaleCart`·`WholesaleCartPage` | 카트→체크아웃 진입율, 카트 포기율 | MOQ/박스단위 자동보정 안내, 합계/배송비 표시 | 수량/금액 서버 재계산 불변 |
| 결제 | `WholesaleCheckoutPage` → `POST /orders`·`/orders/confirm` | **발주 완료율(핵심)**, 결제수단(선결제/외상) 선택률 | 예치금 잔액 노출, 외상(credit) 안내, 단계 축약 | **reserve-before-charge·CAS·Toss 금액검증 불변**(E2) |
| 협의발주 | `WholesaleQuotesPage` → `/quotes` | 견적요청율, 수락→발주 전환 | 견적 진입 노출, 협의단가 안내 | 멱등·승인 흐름 불변 |
| 재발주 | `WholesaleDashboardPage`·`WholesaleWishlistPage` | 재발주율, 30일 반복구매 | 재발주 버튼, 찜/재입고 알림, 명세서 진입 | — |
| 부가 | `WholesaleChannelsPage`(쿠팡/네이버 export)·`WholesaleBoardPage`·`WholesaleProposalsPage` | 채널연동율, 게시판 참여 | export 온보딩, 제안 작성 유도 | 연동 토큰/권한 불변 |

**판매사 대시보드 자체 체크**: 진입 시 핵심행동(발주/재발주/명세서) 노출 우선순위 · 예치금/여신 잔액 가독성 · viewer 직원 권한 분기 정상.

---

## C. 제조사(공급자측) 대시보드 — 탭별 (`SupplierDashboardPage` + tabs)

> 북극성: **상품등록→노출→판매→정산 인출**. 공급자 활성도(상품수·재고최신성·출고속도).

| 탭 (파일) | 핵심 KPI | 실험 아이디어 | 가드레일 |
|---|---|---|---|
| Overview (`OverviewTab`) | 7일 재방문, 핵심 액션 도달 | 대시보드 상단 위젯 순서(미출고/정산/재고부족) | 숫자 정확성(₩NaN 금지, `formatWon`) |
| Catalog (`CatalogTab`·`AddProductModal`·`bulk-upload`) | 상품등록 완료율, **대량등록 사용률**(`/products/bulk-template`) | 등록 폼 단계, 대량 템플릿 안내, 이미지 다중업로드 | 매직바이트/타입 검증, 공급가 입력 정합 |
| Orders (`OrdersTab`·`ShipModal`) | **출고 처리 속도**(주문→송장), 일괄출고 사용률 | 미출고 강조, `ship-all`/`tracking/bulk` 노출 | 주문 상태 CAS·IDOR(본인 주문만) |
| Pricing (`PriceChangeModal`·`BulkPriceModal`) | 단가변경 신청율, 승인 리드타임 | 가격변경 UX, 네이버 최저가 대조(`NaverPriceCheck`) 노출 | 승인 흐름·공급가 재계산 불변 |
| Analytics (`AnalyticsTab`·`DemandSignal`) | 수요신호 열람율 | 수요신호 카드 노출/정렬 | 데이터 정확성 |
| Settlements (`SettlementsTab`·`WithdrawModal`) | **정산 인출 완료율**, 인출 포기 | 잔액/예정정산 가독성, 인출 단계 | **원천징수율 hardcode 금지**(E3), 금액 정합 |
| Tax (`SupplierTaxInvoicesTab`) | 세금계산서 발급율 | 발급 안내/리마인드 | 법정 양식(공급자/공급받는자) 불변 |
| Channels (`ChannelModal`·`StoreImportModal`) | 채널연동율 | 연동 온보딩 | 외부 토큰 보안 |

---

## D. admin 도매 운영 — 화면별 (운영 효율 = 내부 KPI)

> admin 은 전환보다 **처리 속도·오류율·SLA**. 라이트테마 고정(dark: 금지).

| 화면 | 운영 KPI | 실험/개선 | 가드레일 |
|---|---|---|---|
| `AdminWholesaleOverviewPage` | 핵심지표 도달 시간 | 위젯 구성/정렬 | 숫자 정확성 |
| `AdminSellerApproval`·승인큐 | **승인 리드타임**, 반려율 | 승인 화면 정보밀도, 국세청/계약상태 뱃지 | 승인 권한·감사로그 |
| `AdminWholesaleOrdersPage` | 주문 처리/환불 SLA | 필터/일괄처리 | **환불=refundOrderFully 경유**(E2), 멱등 |
| `AdminWholesaleDepositsPage`·`Withdrawals` | 입금확인/인출 SLA | 대기열 우선순위 | 금액 CAS·이중처리 차단 |
| `AdminWholesaleProposalsPage`·`QuotesPage` | 응답 리드타임 | 답변 템플릿 | — |
| `AdminDistributorGradesPage`(등급/여신/세금/공급) | 등급 운영 정확성 | 4탭 정보배치 | **등급가 영향 — 신중**(E1) |
| `AdminWholesaleClaimsPage`·`Activity`·`Integrity` | 처리 이력 추적성 | 이력 가독성 | 감사로그 불변 |
| `AdminWholesaleImportPage`·`Products`·`Banners`·`Board`·`Malls`·`Tax` | 등록/노출 처리량 | 일괄도구 UX | products 컬럼예산·노출등급 |

---

## E. 도매 절대 가드레일 (모든 실험 공통 — 회귀 시 즉시 롤백·실험 무효)

- **E1 영업비밀**: 어떤 variant도 `supply_price`(제조사 원가)·`supplier_id`(제조사 신원)를 판매사/게스트 응답에 노출 금지. `supplier_group` 비식별 유지.
- **E2 결제 정합**: reserve-before-charge · 발주 CAS(멱등) · Toss 금액검증(`totalAmount===amount`) · 환불은 `refundOrderFully` 경유 — 실험으로 절대 우회 금지.
- **E3 정산/세무**: 원천징수율 `withholdAndLog` helper만(3.3%/8.8% hardcode 금지) · 세금계산서 법정양식 불변.
- **E4 성능/비용**: SSR 0-RTT(카탈로그)·`useKv:false`·Cache-Control 분리(로딩 잠금) — variant 가 LCP/KV비용 악화 금지.
- **E5 권한**: viewer 직원 주문차단 · IDOR(본인 데이터만) · admin 가드 — 실험으로 약화 금지.
- **E6 전자계약 차단(hard)**: 미서명 계약 있는 판매사 발주차단 enforcement를 실험으로 우회 금지(단, 행 없으면 통과=정상).

---

## F. 실험 실행 프로세스 체크리스트 (매 실험)

**설계**
- [ ] `docs/AB_TEST_TEMPLATE.md` 양식 작성 — 1차 KPI 1개 + 가드레일(E1~E6 중 관련) 명시
- [ ] 대상 페르소나·세그먼트(판매사 등급별? 신규/기존? 제조사 활성도?) + 제외(어드민·viewer·내부계정)
- [ ] 저트래픽 표본/기간 산정(최소 2~4주, 온전한 주)

**구현**
- [ ] 결정적 버킷 함수 배선(계정 단위) + 롤백 1줄 경로
- [ ] 노출/전환 이벤트 발화(체크리스트 G)
- [ ] tsc 0 · build 0(`npm run build` — vite 단독 금지) · 테마(대시보드 dark: 금지)·i18n(6언어)
- [ ] 잠금영역(로딩/결제 SSOT) 건드리면 AskUserQuestion

**QA(런치 전, 변형별 수동 1건)**
- [ ] A/B 둘 다 실제 렌더 확인(판매사·제조사·admin 해당 계정)
- [ ] 가드레일 수동검증: 응답에 supply_price/supplier_id 없나 · 등급가 정확 · 예치금/금액 정합 · 권한분기
- [ ] 모바일/PC(액자) 양쪽 · 6언어 깨짐 없나

**런치·모니터링**
- [ ] 배정 균형(SRM) · 첫 24h 에러율·LCP·KV write·결제실패율
- [ ] 즉시 회귀(E1~E6) 발견 시 롤백

**분석·결정**
- [ ] 사전 기간/표본 충족(조기종료 금지) · 1차 KPI±신뢰구간 · 가드레일 무회귀
- [ ] 결정(채택/기각/보류) → 채택 시 플래그 100%→코드정리, 기각 시 변형제거
- [ ] 결과를 `docs/experiments/` 보관

---

## G. 계측(instrumentation) 체크리스트 — 도매 이벤트 정의

> 실험 전 아래 이벤트가 **변형 라벨과 함께** 기록돼야 비교 가능. (없으면 먼저 구축.)

- [ ] `exposure` — 변형 본 시점(surface + variant + account_id + account_type)
- [ ] 판매사 퍼널: `catalog_view` · `product_view` · `bulk_preview` · `cart_add` · `checkout_start` · `order_complete`(+금액) · `reorder`
- [ ] 제조사: `product_create` · `bulk_upload` · `order_ship` · `settlement_withdraw` · `tax_invoice_issue`
- [ ] admin: `approval_done`(+리드타임) · `order_refund` · `deposit_confirm`
- [ ] 공통: 계정 등급/몰(mall_id)/신규여부 디멘전 — 세그먼트 분석용(탐색만, 확정결론 X)
- [ ] PII·영업비밀을 이벤트 페이로드에 넣지 말 것(supply_price/이메일 등)

---

### 빠른 시작 추천
1. 체크리스트 A·G 먼저(버킷 유틸 + exposure/order_complete 이벤트) — 1회 인프라.
2. 첫 실험: **B 퍼널의 "대량주문 패널 노출 승격"**(가드레일 적고 효과 측정 쉬움 — `docs/AB_TEST_TEMPLATE.md` worked example).
3. 안정화 후 제조사(C)·admin(D) 로 확장.
