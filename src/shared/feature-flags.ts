/**
 * 🏭 플랫폼 기능 플래그 (SSOT).
 *
 * LIVE_COMMERCE_SUSPENDED — 라이브커머스 **영구 중단** (2026-06-04 잠정 → 2026-06-17 사용자 확정 "안하기로 했어").
 *   true (고정): 셀러 대시보드에서 라이브 방송/송출/쇼츠/라이브분석/캐스팅/후원 등 라이브 메뉴·모드를
 *         전부 숨기고 공구·매장·소싱 경험으로 통일. 코드는 보존(전면 삭제 안 함 — 고위험·이득 0)이되
 *         **재활성 금지** (사용자 영구 결정 — false 로 되돌리려면 사용자 명시 허가 필요).
 *   ⚠️ 새 기능 설계 시 라이브를 "켜질 수 있는 능력 레이어"로 가정 금지 — 능력 모델은 큐레이터→매장(판매)까지.
 */
export const LIVE_COMMERCE_SUSPENDED = true

/**
 * SHOPPING_TAB_HIDDEN — 쇼핑 탭 잠정 숨김 (2026-06-10 사용자 결정, 동네딜 집중 전략).
 *   true: 하단바/PC 탭에서 쇼핑(/browse) 진입을 숨기고 그 자리에 ➕(공구 제안/만들기).
 *         라우트(/browse·/cart·/my-orders)와 모든 쇼핑 코드는 보존 — false 로 바꾸면 즉시 복원.
 */
export const SHOPPING_TAB_HIDDEN = true

/**
 * REFERRAL_GROUP_DISCOUNT_DISABLED — 친구초대 '동적 가격 할인'(referral_groups 티어) 종료
 *   (2026-06-17 사용자 결정 — 즉시판매 단일가로 통일).
 *   true: "친구 모을수록 더 싸진다"는 동적 티어 할인을 비활성 — 서버 재계산 0%(결제가 불변),
 *         상품상세 생성 UI(ReferralSection) 숨김, 그룹 페이지(/referral/:code)의 할인 문구 숨김.
 *         친구초대 '보너스 딜 적립'(affiliate_ref 기반)은 영향 없음. referral_groups 코드/데이터는
 *         보존 — false 로 바꾸면 즉시 복원.
 */
export const REFERRAL_GROUP_DISCOUNT_DISABLED = true

/**
 * HOSTING_HIDDEN — '공구 호스팅' 카탈로그(/host, /host/new) 진입 숨김 (2026-06-17 사용자 결정).
 *   배경: 링크샵 콘텐츠의 핵심은 '추천 핀'(addPin — 상품 상세/검색에서 1탭 핀). /host/new("공구 열기"
 *         어드민 큐레이션 이용권 호스팅)는 별개 시스템이고, 링크샵 버튼 폴백으로 떠서 혼란 + 동네공구
 *         (community-group-buy)와 중복.
 *   true: 큐레이터 콘솔의 '공구 호스팅' 카드 + 셀러 대시보드 '호스팅' nav + UMeRedirect 폴백을 숨김/우회.
 *         라우트(/host·/host/new)와 hosting API/코드는 보존 — false 로 바꾸면 즉시 복원. 직접 URL 진입은 가능.
 */
export const HOSTING_HIDDEN = true

/**
 * COMMUNITY_PROPOSAL_HIDDEN — '동네 공구 제안'(community-group-buy) 진입 숨김 (2026-06-18 사용자 결정).
 *   배경: 제안 기능은 (1) 확정 후 실제 결제·바우처 발급으로 가는 다리가 끊김(보증금 정책 미정),
 *         (2) 보증금 = 고객에게 진 부채, (3) 거의 미사용 + 유저 0 단계. 수요 발굴은 카카오/네이버
 *         공개데이터 + 에이전시 영입(어드민 동별 밀도 보드)이 더 싸고 확실 → 잠정 셸브.
 *   true: 소비자 진입(하단바 ➕ · PC 사이드바 '공구 제안' · 홈 동네딜 섹션 · 동네딜 '동네 공구' 탭/배너 ·
 *         마이 RoleCta)을 숨김. 라우트(/community-group-buy/*) · API · DB · 에이전시 뷰는 보존 — false 로 즉시 복원.
 */
export const COMMUNITY_PROPOSAL_HIDDEN = true

/**
 * SELLER_PROMO_FIELD_ENABLED — 셀러 딜 등록 화면의 '소개비(promo)%' 입력 + 마진 계산기 노출
 *   (2026-07-05 인플루언서 이용권 공구 엔진 스프린트 §1).
 *   배경: 매장이 딜마다 "추천(핀) 판매 시 인플루언서에게 줄 소개비 N%"를 직접 설정하는 레버.
 *         resolveOrderFees(owner-funded promo 슬라이스)로 실수령 실시간 표시.
 *   ⚠️ **커플링(중요)**: 이 필드가 저장하는 products.referral_commission_rate 는 *라이브 어필리에이트
 *     적립*을 override 한다. 그런데 어필리에이트 재원이 아직 **플랫폼 부담**(promo_funding_source='platform',
 *     기본)이면 매장이 건 소개비를 **유어딜이 대신 문다**(재원 구조 설계의 −14% 누수). 따라서 이 필드는
 *     **owner-funding(promo_funding_source='owner') + 예산캡(commission_budget_enabled)이 스테이징에서
 *     검증돼 라이브로 켜진 뒤에만** 활성해야 안전하다. 그 전까지 기본 false(=미노출) + 서버도
 *     `platform_settings.seller_promo_field_enabled==='true'` 일 때만 referral_commission_rate 저장(이중 안전).
 *   활성 절차: docs/design/commission-funding-restructure.md 의 "§1 authoritative 활성 런북" 참조.
 */
export const SELLER_PROMO_FIELD_ENABLED = false

/**
 * GB_ENGINE_ENABLED — 공구 상태 엔진(상태형·양방향) 표면 노출 (2026-07-06 공구 엔진 완결 스펙).
 *   배경: 이용권은 상품이 아니라 "이용권에 얹는 상태"(gb_mode off|scheduled|live|ended). 매장이 공구를
 *         열면 기간·특가·promo 가 얹히고 끝나면 상시로 복귀. 양방향(매장→인플루언서 / 인플루언서 제안→매장).
 *   ⚠️ **커플링**: 공구 promo 재원은 owner-funding(promo_funding_source='owner') + 예산캡이 스테이징
 *     검증돼 켜진 뒤에만 안전(그 전엔 매장 소개비를 플랫폼이 부담 = 누수). 활성 순서 = SELLER_PROMO_FIELD
 *     와 동일 런북의 4단계(commission-funding-restructure.md §1 런북 + 공구 §5). 기본 false = 표면 미노출.
 *     서버도 `platform_settings.gb_engine_enabled==='true'` 게이트(이중 안전).
 */
export const GB_ENGINE_ENABLED = false

/**
 * TOPUP_DISABLED — '딜 충전'(현금→딜 유상 충전) **서비스 전체 종료** (2026-07-18 대표 확정
 *   "딜 포인트 충전 자체를 빼자 우리 서비스에서" — 앱 전환 시 Apple IAP 30% 이슈 원천 제거).
 *   딜 = **적립 전용 리워드 통화**로 전환: 친구초대·추천(핀)·커미션 등 무상 적립과 딜 *사용*
 *   (교환권 딜결제·혼합결제 차감)·환불 복원은 전부 불변 — 유상 충전 *진입*만 닫는다.
 *   true: 충전 진입점 전부 숨김/안내 전환(/points/charge 라우트 게이트 + 홈 딜모으는법 · 마이 ·
 *         교환권 잔액카드 · 딜내역 · 잔액부족 CTA) + 서버 /api/points/charge/init 403.
 *   보존: 충전 코드·라우트·성공/확인 페이지(/points/charge/success — 배포 시점 진행중 결제 완결용)·
 *         어드민 충전 모니터링(과거 데이터). false 로 바꾸면 즉시 복원(가역).
 */
export const TOPUP_DISABLED = true

/**
 * IOS_HIDE_DIGITAL_TOPUP — iOS 네이티브 앱에서 '딜 충전'(순수 디지털 포인트)을 숨기고
 *   외부 브라우저로 유도 (Apple 인앱결제(IAP) 정책 대비). 2026-06-27 메커니즘 신설.
 *   배경: 애플은 앱 내 디지털 재화에 자사 IAP(30%) 강제 가능. 단, 유어딜 딜은 공구/숙소/교환권
 *         (대부분 실세계 상품·서비스) 결제용이라 외부결제 허용 여지도 있어 **거절 여부 미확정**.
 *   ⚠️ 기본 false (현행 유지) — 미리 켜면 매출/UX 손실. **애플 심사에서 IAP 사유로 거절되면 true 로**
 *     전환(딜충전 진입 `/points/charge` 만 게이트, `/pay/widget` 범용결제·실물·숙소는 영향 0).
 *   true: iOS 네이티브에서 `/points/charge` 진입 시 외부 브라우저(웹)로 충전 유도.
 */
export const IOS_HIDE_DIGITAL_TOPUP = false

/**
 * SELLER_STORE_ONLY_MODE — 셀러 대시보드 = 순수 '매장 운영 콘솔' (2026-07-19 대표 확정
 *   "온라인 판매·소싱은 필요없다 — 이용권 파는 매장 업주만을 위한 형태로. 상품은 링크샵에서만").
 *   true: 셀러 nav 에서 **온라인 상품 관리(/seller/products)·도매 소싱(/seller/supply)** 을 전 셀러
 *         타입에서 숨김(심플모드 여부 무관). 상품(물건) 판매는 링크샵(/u/{handle})으로 일원화 —
 *         nav 에 '내 링크샵' 진입 추가. 대납 검토(/seller/proxy-products)는 이용권 그룹으로 이동.
 *         라우트·API·데이터 전부 보존(직접 URL 진입 가능) — false 로 바꾸면 즉시 복원(가역).
 *   ⚠️ 도매몰(판매사/제조사)은 별도 서비스(/wholesale) — 이 플래그와 무관(서비스 분리).
 */
export const SELLER_STORE_ONLY_MODE = true

/**
 * MATCHING_ENABLED — 인플루언서↔업체 성과기반 매칭 **어드민 전용 내부 도구** 노출 (2026-07-14).
 *   배경: 팔로워가 아니라 **실제 전환**(유입→방문→재방문, inflow_clicks·voucher_visits)으로 매칭.
 *         유어애즈 인플루언서 발굴 패널 옆 `sec-matching` 섹션 — 직영 에이전시(운영자)가 매칭 판단.
 *         매장·인플루언서 공개 뷰는 데이터·법무 충분해지면(나중).
 *   ✅ 2026-07-18 true 전환(대표 "자동으로 켜둬") — **실질 게이트는 어드민 잠금**: 이 플래그가 true 여도
 *      **어드민 로그인(admin_token) + 서버 `requireAdmin`(비어드민 403)** 이라 소비자/광고주 노출 0.
 *      읽기 전용·머니 무접촉이라 상시 ON 이 안전 — 데이터 없으면 목업 미리보기, 쌓이면 실측 자동 전환.
 *      false 로 내리면 어드민에게도 즉시 숨김(가역).
 *      정산(머니)은 별도 스위치(env MATCHING_SETTLEMENT_ENABLED, 기본 OFF 유지) — 이 플래그와 독립.
 */
export const MATCHING_ENABLED = true


/**
 * ADS_AI_HIDDEN — 유어애즈 **AI 기능 노출 숨김** (2026-07-28 대표 결정 "AI 기능 안 쓸 거야").
 *   배경: 라이브 점검에서 `/api/ads/ai-marketer`·`/content/generate` 가 전 계정 503 `NOT_CONFIGURED`
 *         (ur-ads 워커에 ANTHROPIC_API_KEY 미설정). 대표가 **키를 넣지 않기로 확정** → 화면에만 남은
 *         AI 메뉴가 광고주에겐 '눌러도 안 되는 버튼' + 내부 문구("Anthropic API 키 설정 후 사용") 노출.
 *   true: 대시보드 'AI 스튜디오' 탭(콘텐츠 생성·AI 마케터)과 소개 페이지(/ads)의 AI 홍보(기능 섹션·
 *         요금제 문구·푸터 링크·메타 description)를 숨김. 옛 딥링크(?tab=ai·#sec-ai)는 홈 탭으로 폴백.
 *   ⚠️ 서버 라우트(/api/ads/ai-marketer·/content/*)·컴포넌트·엔타이틀먼트는 **전부 보존** — 키를 넣고
 *      이 플래그만 false 로 되돌리면 즉시 복원(가역). 어드민 매칭 AI 근거(admin-matching)는 별개(무관).
 */
export const ADS_AI_HIDDEN = true


/**
 * REGION_PAGES_ENABLED — 도시별 색인 페이지 `/region/*` 노출 (2026-08-03 대표 지시 —
 *   "도시별로도 보이게" + "이전으로 돌아갈 수도 있게끔 해두자").
 *
 *   배경: 지금까지 지역 필터는 URL 이 아니라 localStorage(`ur_home_region_v1`)에만 있었다.
 *         **URL 이 없으면 검색엔진에 그 페이지는 존재하지 않는다** — "강남 이용권"으로 우리가 뜰
 *         방법이 0 이었다. 2026-08-03 실측(활성 딜 329건)에서 45개 시군구 중 31곳이 딜 3개 이상이라,
 *         지금 당장 색인 가치가 있는 페이지가 40개 넘게 만들어진다.
 *
 *   true: `/region`·`/region/:sido`·`/region/:sido/:sigungu` 라우트 + 홈 하단 지역 링크 그리드 +
 *         sitemap 지역 URL 발행.
 *   false: **즉시 전면 롤백** — 홈 그리드 미노출 · sitemap 지역 URL 0 · 지역 페이지는 `noindex`.
 *         라우트/컴포넌트/API(`/api/regions`)는 보존하므로 이미 나간 링크가 404 로 죽지 않는다
 *         (색인된 URL 을 404 로 만드는 건 되돌리기 가장 비싼 실수다 — 회수에 수 주가 걸린다).
 *
 *   ⚠️ 홈 상단·피드·모바일 지도 홈은 이 기능과 **무관하게 무변경**이다. 플래그를 내려도 홈은
 *      2026-07-19 확정 구조 그대로 남는다.
 */
export const REGION_PAGES_ENABLED = true


/**
 * REGION_COUNT_INCLUDE_DEMO — 지역 집계에 **데모 딜 포함** (2026-08-03 대표 결정 "포함시키자").
 *
 *   배경(실측): `/region/*` 배포 직후 라이브 판정에서 지역 페이지가 사실상 비어 있었다.
 *   활성 딜 329건 중 **328건이 데모 시드**(`slug` 가 `demo-`)이고 실제 상품은 1건뿐이라,
 *   데모를 빼면 색인 문턱(딜 3개)을 넘는 지역이 0개였다.
 *
 *   true(현재): 데모를 집계에 넣는다 → 지역 페이지 40여 개가 채워지고 sitemap 에 실린다.
 *   false: 실제 상품만 센다.
 *
 *   ⚠️ **알고 택한 트레이드오프다.** 세션이 반대 의견을 냈고(검색 유입자가 못 쓰는 데모 상품
 *   페이지에 착지 · 품질 낮은 페이지 대량 색인은 배포로 되돌아오지 않음) 대표가 포함으로 확정했다.
 *   되돌릴 때는 이 플래그만 false 로 — 다만 **이미 색인된 URL 은 즉시 사라지지 않는다**(재크롤링
 *   대기). 그래서 이 값은 "언제든 되돌릴 수 있는 스위치"가 아니라 **한 방향으로 비용이 붙는 결정**이다.
 *
 *   데모 딜은 소비자 홈 피드에도 이미 노출된다(후순위 정렬) — 지역 페이지만 다르게 세면 홈은
 *   가득한데 지역은 비는 불일치가 생긴다는 점도 이 결정의 근거였다.
 */
export const REGION_COUNT_INCLUDE_DEMO = true


/**
 * HOME_SHOWCASE_ENABLED — 홈 쇼케이스(④히어로 · ①카테고리 섹션 · ③중간 배너) 노출
 *   (2026-08-04 대표 시안 승인 "좋다 이렇게 가자" — 여기어때 메인 참고, 쓸만한 것만 차용).
 *
 *   시안: `docs/design/home-showcase-2026-08.md` · 아티팩트로 먼저 보시고 확정.
 *
 *   true: PC 홈 최상단에 히어로 배너(배경 이미지/영상 + 검색바), 딜 그리드 위아래로
 *         주제별 섹션(+더보기)과 중간 배너.
 *   false: **즉시 전면 롤백** — 셋 다 미노출. PC 홈이 2026-07-19 확정 구조(단일 그리드)로 복귀.
 *
 *   ⚠️ **모바일 홈은 이 플래그와 무관하게 무변경**이다. 모바일은 풀스크린 지도
 *   (`RestaurantMapPage`)이고 2026-07-15 대표 결정("홈=지도")이 그대로 살아 있다.
 *   모바일까지 섹션형으로 바꾸는 건 그 결정을 되돌리는 별도 판단이다 — 여기 섞지 말 것.
 *
 *   🚫 데이터가 없으면 각 블록이 **스스로 사라진다**(플래그와 별개): 배너 0건 → 미노출,
 *   상품 0건인 섹션 → 서버가 목록에서 제외. 대표가 배너에 정한 원칙
 *   ("올리지 않으면 아예 보이지 않도록")을 셋 모두에 적용했다.
 */
export const HOME_SHOWCASE_ENABLED = true


/**
 * CAMPAIGN_SIGNUP_ENABLED — 캠페인 인플루언서 모집 신청 페이지(/campaign/:code) 노출 (2026-08-09).
 *   배경: 방배 상권 캠페인 인플루언서 모집 — 신청 = 유어딜 인플루언서 파트너 등록(카카오 계정 +
 *   프로필 + 동의 2종 + ref 링크 즉시 발급). 캠페인 목록은 `shared/campaign-signup.ts` 레지스트리.
 *   true: /campaign/{code}(예: bangbae) 라우트 노출. 링크로만 진입(홈/네비 미노출·sitemap 미제출).
 *   false: 라우트만 숨김(가역) — **기존 가입·/creators 신청과 게이트 분리**라 그쪽엔 영향 0.
 *   개별 캠페인의 접수 종료는 이 플래그가 아니라 레지스트리의 `active: false` 로(페이지가 종료 안내 렌더).
 */
export const CAMPAIGN_SIGNUP_ENABLED = true

/**
 * CONSUMER_LANGUAGE_SWITCH_HIDDEN — 소비자 **언어 전환 UI 숨김** (2026-08-11 대표 "모두 진행해").
 *
 * ## 왜
 * 마이 페이지(`LanguageSection`)에 6개 언어 전환이 노출돼 있는데, **번역이 반쯤 비어 있다** —
 * 라이브 실측 `[TODO:xx]` 채움 항목이 언어당 **289개**(`introduce` 65 · `register` 37 · `faq` 36 ·
 * `orderDetail` 35 · `groupbuy` 28 · `referral` 18 …). 눌러 보면 일부만 번역되고 나머지는 한국어인
 * **어중간한 화면**이 된다. 게다가 이 서비스는 `urdeal.kr` **한국 전용**이고 글로벌은 폐기(#804)라
 * 그 문을 열어 둘 이유가 없다.
 *
 * ## 무엇을 하나
 * true: ① 마이의 언어 카드 미노출 ② `detectInitialLanguage()` 가 **항상 ko** 를 반환.
 *   ②가 없으면 **이미 en 으로 바꿔 둔 사용자가 되돌릴 문이 사라져 갇힌다**(스위치는 숨겼는데
 *   저장된 선택은 남아 있으므로). 그래서 숨김과 고정은 **한 쌍**이다.
 *
 * ## 되살리려면
 * `false` 로 바꾸면 즉시 복원(가역). 번역 파일·6개 언어 동기 가드(`check-i18n-sync`)·
 * `LanguageSection` 컴포넌트·셀러 대시보드 언어 전환은 **전부 그대로 둔다** — 지운 게 아니라 닫은 것이다.
 * (`[TODO:xx]` 표식이 화면에 나가는 것 자체는 `src/i18n.ts` 의 `stripTodoMarker` 가 별도로 막는다.)
 */
export const CONSUMER_LANGUAGE_SWITCH_HIDDEN = true


/**
 * AGENCY_DASHBOARD_SUNSET — 에이전시 대시보드 **일몰**(신규 가입 차단 + 표면 축소)
 *   (2026-08-19 대표 확정 "모두 하자" — 에이전시 대시보드 가치 재검토 후).
 *
 * ## 왜 (라이브 실측이 근거다)
 * 에이전시 대시보드는 페이지 9,349줄 + API 7,025줄 · 라우트 39개인데 **관계가 0건**이었다:
 *   `agencies` 4개(1개는 '유어딜 본사') · `agency_sellers` **0행** · `store_agency_delegation` **0행**
 *   · `introduced_by_agency_id` 매장 **0명**.
 * 게다가 `agency_invites`/`coupons`/`incentives`/`messages`/`notices`/`targets` 는 **테이블조차 없다** —
 * 이 레포는 지연 생성(`CREATE TABLE IF NOT EXISTS`) 패턴이라 **그 코드가 프로덕션에서 한 번도 실행된
 * 적 없다**는 뜻이다. 남은 상당수(`pk`·`schedule`·`calendar`·`ranking`)는 `LIVE_COMMERCE_SUSPENDED`
 * (영구 중단) 의존이라 이미 죽은 기능의 대시보드다.
 *
 * ## 방향 (없애는 건 껍데기, 남기는 건 뼈대)
 * "누가 이 매장을 운영하는가"는 **계정 소유권이 아니라 관계**로 둔다 — 그래야 중개자가 올린 매장을
 * 사장님이 직접 이어받을 때 데이터 수술이 아니라 권한 한 줄 변경이 된다.
 * 설계 SSOT: `docs/design/store-operator-model.md`. 축은 그대로 유지되는 것:
 *   `store_agency_delegation`(위임) · `introduced_by_agency_id`(영입 보상) · seller transfer(승계 동의).
 *
 * ## 무엇을 하나
 * true: ① 에이전시 **신규 가입 차단**(`/agency/register`·`register/business` 안내 화면 + 서버
 *   `POST /api/agency/register`·`/register-from-user` 403 — 클라만 막으면 우회된다)
 *   ② `/agency-partner` 랜딩의 가입 CTA 를 안내로 전환.
 * false: 즉시 복원(가역) — 가입 페이지·API 코드는 **전부 보존**했다.
 *
 * ⚠️ **기존 4개 계정의 로그인·정산·위임은 막지 않는다.** 일몰은 "새로 안 받는다"이지
 *   "쓰던 사람을 끊는다"가 아니다. 정산 채무가 남아 있는 상대의 접근을 끊는 건 별개 판단이다.
 */
export const AGENCY_DASHBOARD_SUNSET = true
