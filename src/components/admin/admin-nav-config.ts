/**
 * 🧱 2026-07-20 (AdminLayout god 파일 분해 + 즐겨찾기 기능 여유 확보): 어드민 좌측 nav 데이터/섹션/
 *   RBAC 경로 상수를 AdminLayout.tsx 에서 verbatim 추출. **데이터/배치/RBAC/collapse/active 전부 불변** —
 *   렌더 로직(AdminLayout)과 데이터(이 파일)를 분리했을 뿐. 아이콘/라벨/라우트/그룹 순서 byte-동일.
 */
import {
  LayoutDashboard, ShoppingBag, Package, DollarSign,
  Bell, Image, Monitor, Store, ClipboardList, Gift, Ticket, Play, BookOpen, Building2, UserCheck, Settings, Send,
  BarChart3, Shield, UserCog, Users, MessageSquare, Megaphone, Sparkles, AlertTriangle, TrendingUp, AlertOctagon, Wallet, Layers, Mail, Crown,
  Wrench, RotateCcw, Upload, History, MapPin, Scale, FileText, Rocket, Share2, LayoutList,
  type LucideIcon
} from 'lucide-react'
import { LIVE_COMMERCE_SUSPENDED } from '@/shared/feature-flags'
import { isUtongstart } from '@/utils/domain'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  exact?: boolean
  /** 🧭 탭으로 묶인 형제 라우트 — 이 경로들에서도 본 항목을 활성 표시. */
  also?: string[]
}

/**
 * 🧭 **서비스 밴드** — 이 그룹이 *어느 서비스의 것인가*. 렌더 시 같은 밴드끼리 헤더 아래 묶인다.
 *
 * 🔴 **필수 선언이다(폴백 없음)** 〔2026-08-16 대표 *"카테고리 페이지들 분류를 제대로"*〕.
 *   예전엔 `navSectionOf` 가 그룹 **제목을 문자열로 맞춰보고** 안 맞으면 조용히 `'common'` 으로
 *   떨어뜨렸다. 그래서 **유어애즈는 서비스인데도 '⚙️ 공통 · 회원·재무·검증·시스템' 밴드 아래**
 *   렌더되고 있었다 — 넷 중 하나가 공통 서랍에 세 들어 산 것이고, 이는 2026-08-14 주석이
 *   공구 서비스를 두고 지적한 바로 그 문제의 재발이다.
 *
 *   원인은 "추가한 사람이 밴드를 안 적었다"가 아니라 **아무것도 안 하면 공통으로 빨려 들어가는
 *   구조** 였다. 폴백을 없애고 타입으로 강제한다 — 새 그룹은 밴드를 *말해야만* 컴파일된다.
 *
 * ## 그럼 `common` 에는 무엇이 남는가 (2026-08-16 확정 — 이 판단을 매번 다시 하지 않으려고 적는다)
 *
 * **밴드 = 서비스**가 원칙이지만, **정산·CS·회원**처럼 어드민이 *서비스 구분 없이 한 큐로 처리하는
 * 데스크*는 `common` 에 둔다 — 그게 실제 작업 단위이기 때문이다(송금하는 사람은 유어딜 건과
 * 몰 건을 번갈아 처리하지, 서비스별로 화면을 옮겨 다니지 않는다).
 *
 * 대신 **그 데스크 안의 항목이 단일 서비스면 라벨에 서비스를 밝힌다.** 대표가 물었던 것은
 * *"이 메뉴가 어느 서비스냐"* 이지 *"메뉴를 어디로 옮겨 달라"* 가 아니었다.
 *
 * 실측으로 확인하고 **옮기지 않기로 한 것들**(다음 세션이 다시 파헤치지 않게):
 *   - `인플루언서 송금·분쟁` → 전부 유어딜(`influencer_attributions` = 매장영입+공구추천)이지만
 *     **머니 데스크**라 정산/CS 에 남기고 **라벨에 🎟️ 유어딜**을 붙였다(유어애즈 인플루언서 풀과 구분).
 *   - `영업 추적`·`에이전시` → 유어딜 매장 영입이지만 **사람·조직 관리 데스크**.
 *   - `매장 커미션` → 유어딜이지만 머니 데스크.
 *   - `소비자 퍼널` → **유어딜 전용이 아니다.** `funnel_events` 는 서비스 무관 계측이라
 *     전사 상황판('운영')이 맞다. ⚠️ 한때 "실제로는 유어딜"이라고 적었는데 **틀렸다.**
 *
 * ⚠️ `section`(보이는 밴드)과 `domain`(RBAC·철거 필터)은 **다른 축이다.** 도매 그룹은 둘 다
 *   갖지만, `domain` 을 밴드 판정에 재사용하면 "도매 역할에게 보인다"와 "도매 밴드에 그린다"가
 *   한 값에 묶여 한쪽만 바꾸는 게 불가능해진다.
 */
export type NavSectionKey = 'home' | 'urdeal' | 'mall' | 'ads' | 'wholesale' | 'common'

export interface NavGroup {
  title: string
  /** 🧭 어느 서비스의 그룹인가 — 렌더 밴드. **폴백 없음**(위 주석). */
  section: NavSectionKey
  items: NavItem[]
  /** 🆕 도메인 태그 — 도메인-한정 역할(wholesale)에게 이 도메인 그룹만 노출. */
  domain?: 'wholesale'
  /** 🔧 진단성 그룹 등 평소 접어둘 그룹 (사용자 토글이 항상 우선). */
  defaultCollapsed?: boolean
}

// 🏭 2026-06-04 (사용자 결정): 3개 사업라인 중심 IA — 도매몰 / 오프라인 공구 / 온라인 쇼핑 + 공통.
//   ⚠️ 라우트/아이콘/라벨 전부 보존 — 그룹 배치만 변경(데이터 reorder, 로직 불변). 라이브 항목은
//   VISIBLE_NAV_GROUPS 필터에서 별도 숨김(잠정 중단).
// ⚠️ **이 배열의 순서 ≠ 화면 순서.** 렌더는 `NAV_SECTIONS`(밴드) 순서로 재편성된다
//   (`AdminLayout` 이 밴드별로 `navSectionOf` 필터). 그래서 여기서는 **기존 순서를 보존**해
//   diff 가 "무엇이 서비스를 옮겼나"만 보여주게 둔다 — 대량 재정렬을 섞으면 실제 재분류가 묻힌다.
export const NAV_GROUPS: NavGroup[] = [
  {
    // 🏠 전-서비스 공통 상황판 — 특정 서비스 전용 화면은 여기 두지 않는다(각 서비스 밴드로).
    title: '운영',
    section: 'home',
    items: [
      { path: '/admin',                  label: '대시보드',      icon: LayoutDashboard, exact: true },
      { path: '/admin/insights',         label: '운영 인사이트', icon: AlertTriangle },
      { path: '/admin/funnel',           label: '소비자 퍼널',   icon: TrendingUp },
      { path: '/admin/business-metrics', label: '비즈니스 지표', icon: BarChart3 },
      { path: '/admin/revenue',          label: '매출 분석',     icon: BarChart3 },
      { path: '/admin/operations-guide', label: '운영 가이드',   icon: BookOpen },
      { path: '/admin/platform-model',   label: '플랫폼 모델',   icon: FileText },
      // 🗺️ 2026-08-16: 상권 3종(동네별 딜 밀도·상권 성과·방문 리워드)은 **유어딜 전용**이라
      //   전사 상황판에서 유어딜 밴드의 '상권/매장' 그룹으로 이동.
      { path: '/admin/abuse',            label: '어뷰징 탐지',   icon: AlertOctagon },
      { path: '/admin/env-readiness',    label: '환경 준비상태', icon: Wrench },
    ],
  },
  {
    // 🎯 유어애즈(UR Ads) — 마케팅 서비스 운영
    // 🧭 2026-08-16: 밴드를 **명시**. 그전까지 제목 매칭에 안 걸려 '⚙️ 공통' 아래 렌더됐다.
    title: '🎯 유어애즈 · 운영',
    section: 'ads',
    items: [
      { path: '/admin/ads-accounts',     label: '유어애즈 가입자', icon: Megaphone },
      { path: '/admin/ads-services',     label: '서비스몰 주문', icon: Megaphone },
      { path: '/admin/influencer-pool',  label: '인플루언서 풀', icon: Megaphone },
      { path: '/admin/campaign-applications', label: '📣 캠페인 신청자', icon: Megaphone }, // 캠페인 모집(/campaign/:code) 접수분 — 코드 필터+CSV
      { path: '/admin/buyer-pool',       label: '🌐 해외 바이어 풀', icon: Megaphone }, // 도매 RBAC 스코프 밖 → 여기(전-어드민)
      { path: '/admin/partner-pool',     label: '🤝 파트너 풀', icon: Megaphone }, // B2B 파트너(업체) 수집 — 매장 입점 영업
      { path: '/admin/store-prospects',  label: '🏪 매장 후보', icon: Megaphone }, // 인허가 발굴 — 유어딜 입점 대상 매장(store_prospects)
      { path: '/admin/gov-notices',      label: '📢 공고 스캐너', icon: Megaphone }, // 나라장터+기업마당 공고(gov_notices)
    ],
  },
  {
    // 🏭 도매몰 (유통스타트 B2B) — 운영: 카탈로그·주문·회원·설정
    title: '🏭 도매몰 · 운영',
    section: 'wholesale',
    domain: 'wholesale',
    items: [
      { path: '/admin/wholesale-overview', label: '도매 통합 현황', icon: LayoutDashboard },
      // 🏭 2026-06-29 (대표 — 판매사 승인 통합): '판매사 승인' 별도 항목 제거 → '판매사 관리'(아래) 의 '승인' 탭으로 통합.
      // 🗂️ 2026-07-02 (IA 통합): '제조사 출금'(/admin/wholesale-withdrawals)은 이 페이지의 '출금 처리' 탭으로
      //   통합 — also 로 딥링크/RBAC 허용 + 활성 표시.
      { path: '/admin/suppliers',          label: '제조사 관리', icon: Store, also: ['/admin/wholesale-withdrawals'] },
      // 🧭 2026-08-16 (고아 라우트 등재): `/admin/maker-pool` 은 nav 어디에도 없어 **URL 직접 입력으로만**
      //   도달 가능했다. 페이지 헤더가 *"도매몰(유통스타트) 전용 — 유어애즈 파트너 풀과 격리된 테이블"*
      //   이라고 스스로 선언한다 ⇒ 이웃한 buyer/partner-pool(유어애즈)이 아니라 **도매 밴드**가 맞다.
      //   ⚠️ 위치로 추측했으면 유어애즈로 잘못 넣었을 자리다.
      { path: '/admin/maker-pool',         label: '제조사·판매사 후보 풀', icon: Layers },
      // 🗂️ 2026-06-26 (대표 요청): 4개 탭이 한 페이지(AdminDistributorGradesPage)라 nav 1개 통합.
      //   딥링크 라우트(/admin/distributor-credit 등)는 그대로 — 페이지 탭이 사용.
      // 🗂️ 2026-07-02 (대표 요청): 판매사 관리를 제조사 관리 바로 아래로 이동(회원 관리 짝 배치).
      // 🗂️ 2026-07-02 (IA 통합): '도매 예치금'(/admin/wholesale-deposits)도 '예치금' 탭으로 통합 — also 에 추가.
      { path: '/admin/distributor-grades', label: '판매사 관리', icon: Layers, also: ['/admin/distributor-approval', '/admin/distributor-credit', '/admin/distributor-tax', '/admin/distributor-supply', '/admin/wholesale-deposits'] },
      { path: '/admin/wholesale-import',   label: '상품 일괄 등록', icon: Upload },
      { path: '/admin/wholesale-products', label: '도매 프리미엄관', icon: Crown },
      { path: '/admin/wholesale-orders',   label: '도매 주문',     icon: ShoppingBag },
      { path: '/admin/wholesale-quotes',   label: '도매 견적',     icon: ClipboardList },
      { path: '/admin/wholesale-activity', label: '처리 이력 (누가 처리?)', icon: History },
    ],
  },
  {
    // 🏭 도매몰 — 정산/머니
    title: '💰 도매몰 · 정산',
    section: 'wholesale',
    domain: 'wholesale',
    items: [
      // 🗂️ 2026-07-02 (IA 통합): '도매 예치금'은 '판매사 관리'의 '예치금' 탭, '제조사 출금'은 '제조사 관리'의
      //   '출금 처리' 탭으로 이동 — 중복 nav 항목 제거(딥링크 라우트는 각 컨테이너 페이지의 탭으로 열림).
      { path: '/admin/wholesale-tax',      label: '도매 세무/정산', icon: Wallet },
      // 🗂️ 2026-06-17: '도매 무결성'(진단 전용)은 상단 nav에서 강등 — '통합 현황' 카드 링크로 접근(/admin/wholesale-integrity 라우트 유지).
    ],
  },
  {
    // 🏭 도매몰 — CS / 콘텐츠
    title: '🛟 도매몰 · CS·콘텐츠',
    section: 'wholesale',
    domain: 'wholesale',
    items: [
      { path: '/admin/wholesale-claims',   label: '도매 클레임',   icon: AlertTriangle },
      { path: '/admin/wholesale-proposals', label: '도매 제안/신고', icon: MessageSquare },
      { path: '/admin/partnership',        label: '광고·제휴 문의', icon: Mail },
      { path: '/admin/wholesale-board',    label: '도매 게시판',   icon: Megaphone },
      { path: '/admin/wholesale-banners',  label: '도매 배너',     icon: Image },
      { path: '/admin/wholesale-guide',    label: '도매몰 운영 가이드', icon: BookOpen },
    ],
  },
  {
    // 🏪 오프라인 공구 (매장 공구 / 교환권 / 숙소)
    title: '🏪 오프라인 공구',
    section: 'urdeal',
    items: [
      // 🏷️ 2026-08-14 (대표 "이미 공동구매로 되어있는 것들이 있던데 · 페이지 구분을 잘 해야겠어"):
      //   라벨이 '공동구매' 였는데 이 화면은 **유어딜 이용권 공구**다. 같은 이름의 별개 서비스
      //   (🏪 공구 서비스 = 운영자 몰)가 아래 자기 섹션에 따로 있다. 이름이 겹치면 대표가 매번
      //   "이건 어느 쪽이야?" 를 물어야 한다 ⇒ 명칭 SSOT 대로 **이용권**을 쓴다.
      { path: '/admin/group-buy',        label: '이용권 공구',   icon: Ticket },
      { path: '/admin/gb-cockpit',       label: '공구 엔진 조종석', icon: Rocket },
      { path: '/admin/dongnedeal-import', label: '동네딜 상품 등록', icon: Upload },
      { path: '/admin/fcfs',             label: '추첨 응모 관리', icon: Gift },
      { path: '/admin/experience-campaigns', label: '체험 캠페인',   icon: Gift },
      { path: '/admin/voucher-disputes', label: '사용처리 분쟁',  icon: AlertOctagon },
      { path: '/admin/stays',            label: '숙소 운영',     icon: Building2 },
      { path: '/admin/pending-sellers',  label: '매장 검수',     icon: UserCheck },
      { path: '/admin/coupons',          label: '쿠폰 관리',     icon: Ticket },
      { path: '/admin/deals',            label: '딜 모니터링',   icon: Gift },
      { path: '/admin/restaurant-demand', label: '맛집 수요 신호', icon: TrendingUp },
    ],
  },
  {
    /**
     * 🗺️ **유어딜 · 상권/매장** — 2026-08-16 신설 (대표 *"카테고리 페이지들 분류를 제대로"*)
     *
     * 다섯 화면 모두 **유어딜 전용**인데 두 개의 남의 서랍에 흩어져 있었다:
     *   - 전사 상황판('운영', 밴드 없음) — 동네별 딜 밀도 · 상권 성과 리포트 · 상권 방문 리워드
     *   - 공통 CS('검증/CS') — 상권 쿠폰(영수증 페이백) · 카카오맵 후기 검증
     *
     * 흩어져 있으면 "상권 캠페인이 지금 어떻게 돌고 있나"를 한 화면에서 못 본다 — 발굴(밀도)
     * → 리워드(방문·후기) → 페이백(쿠폰) → 성과(리포트)가 **하나의 루프**인데 메뉴가 그 루프를
     * 세 조각으로 잘라 놨다.
     *
     * 🔎 카카오맵 후기 검증이 왜 CS 가 아니라 여기인가: API 가 `/api/admin-review-bonus/*` 로,
     *   리뷰 *모더레이션*이 아니라 **후기 보상 지급 검증**이다(방문 리워드와 같은 성격).
     *   `/admin/review-moderation`(진짜 리뷰 관리)은 검증/CS 에 그대로 둔다.
     */
    title: '🗺️ 유어딜 · 상권/매장',
    section: 'urdeal',
    items: [
      { path: '/admin/region-density',   label: '동네별 딜 밀도', icon: MapPin },
      { path: '/admin/visit-rewards',    label: '상권 방문 리워드', icon: MapPin },
      { path: '/admin/kakao-reviews',    label: '카카오맵 후기 검증', icon: MessageSquare },
      { path: '/admin/district-coupons', label: '상권 쿠폰(영수증 페이백)', icon: Ticket },
      { path: '/admin/district-report',  label: '상권 성과 리포트', icon: BarChart3 },
    ],
  },
  {
    /**
     * 🏪 **공구 서비스 (운영자 몰 SaaS)** — 2026-08-14 신설 (대표 "페이지 구분을 잘 해야겠어")
     *
     * 그전까지 이 서비스의 어드민은 **페이지 1개**(`운영자 몰 관리`)였고, 그것이 유어딜 그룹
     * (`🏪 오프라인 공구`) 안에 섞여 있었다. 같은 그룹의 첫 항목 라벨이 하필 **'공동구매'**(유어딜
     * 이용권)라, 대표가 화면만 보고는 **어느 서비스의 공동구매인지 알 수 없었다.**
     *
     * 🔴 서비스가 넷이면 밴드도 넷이어야 한다(`navSectionOf`). 한 서비스가 다른 서비스의 서랍에
     *   세 들어 살면, 그 서비스의 할 일이 남의 목록에 섞이고 보고도 섞인다 — 이 레포가 8/3 에
     *   실제로 겪은 사고다(CLAUDE.md §서비스 철저 분리 도입 배경).
     */
    title: '🏪 공구 서비스 (운영자 몰)',
    section: 'mall',
    items: [
      { path: '/admin/wholesale-malls',  label: '운영자 몰 관리', icon: Building2 },
      // 같은 '이용권 공구' 화면을 **몰 스코프로** 연다 — 유어딜 본진 목록과 섞이지 않게.
      //   (쿼리 파라미터 하나로 갈린다: 유어딜=본진 기본값 / 여기=몰 전용)
      { path: '/admin/group-buy?mall=all', label: '몰 상품·공구',  icon: Ticket },
    ],
  },
  {
    // 🛒 온라인 쇼핑 (일반 상품 / 주문 / 교환권 발행)
    title: '🛒 온라인 쇼핑',
    section: 'urdeal',
    items: [
      { path: '/admin/products',         label: '상품 관리',     icon: Package },
      { path: '/admin/orders',           label: '주문 관리',     icon: ShoppingBag },
      // 🧭 2026-06-09 IA 정리: nav 미노출 고아 라우트 등재 — 반품/교환권 추적은 주문 운영 실무 페이지.
      { path: '/admin/returns',          label: '반품 검수',     icon: RotateCcw },
      // 🧭 2026-08-16 (고아 라우트 등재): 송장 일괄 등록도 주문 운영 실무인데 nav 에 없어 URL 전용이었다.
      { path: '/admin/shipping/bulk-tracking', label: '송장 일괄 등록', icon: Upload },
      { path: '/admin/kt-alpha',         label: 'KT Alpha (교환권)', icon: Gift },
      { path: '/admin/voucher-orders',   label: 'KT 발송 추적',  icon: Send },
      { path: '/admin/voucher-transactions', label: '교환권 거래', icon: Ticket },
      { path: '/admin/banners',          label: '배너 관리',     icon: Image },
      { path: '/admin/home-sections',    label: '홈 섹션',       icon: LayoutList },
    ],
  },
  {
    title: '회원/파트너',
    section: 'common',
    items: [
      { path: '/admin/users',           label: '유저 관리',     icon: Users },
      { path: '/admin/seller-approval', label: '셀러 관리',     icon: UserCheck },
      { path: '/admin/agency-creator-approval', label: '에이전시 셀러 심사', icon: UserCheck },
      { path: '/admin/prospects',       label: '영업 추적',     icon: UserCheck },
      { path: '/admin/agencies',        label: '에이전시',      icon: Building2 },
    ],
  },
  {
    title: '💰 정산/재무',
    section: 'common',
    items: [
      // 🧭 2026-06-09 IA 정리: 정산 4페이지(개별/일괄/Ledger/추천출금)는 페이지 상단 AdminFinanceTabs 로
      //   상호 이동 — nav 는 진입점 1개만. 라우트는 전부 보존(북마크 안전).
      { path: '/admin/settlement',       label: '정산 센터',     icon: DollarSign, also: ['/admin/settlements-bulk', '/admin/payouts', '/admin/commission-withdrawals', '/admin/payout-center'] },
      // 돈 관련 고아 라우트를 재무 그룹으로 — URL 직접 입력 없이 도달 가능하게.
      // 🏷️ 2026-08-16: 라벨에 **서비스를 밝힌다.** `influencer_attributions` 는 전부 유어딜에서
      //   생긴다(매장 영입 `store_intro` + 공구 추천)인데, 이름이 📣 유어애즈의 '인플루언서 풀'
      //   (외부 수집 DB)과 겹쳐 대표가 "어느 쪽이야?" 를 묻게 만들던 자리다.
      { path: '/admin/influencer-payouts', label: '🎟️ 유어딜 추천 커미션 송금', icon: Wallet },
      { path: '/admin/withholding',      label: '원천징수/지급조서', icon: Shield },
      { path: '/admin/commission-settings', label: '정산 마진 설정', icon: Settings },
      { path: '/admin/merchant-commissions', label: '매장 커미션', icon: Store },
      // 🧾 2026-07-10: 불변식 #44 콕핏 — promo 재원/원장 platform:revenue 대칭 감사 (read-only, 8월 flip 검증 표면).
      { path: '/admin/promo-ledger',     label: 'promo 재원 원장', icon: FileText },
      // 🔧 2026-07-01 (대표 "무슨 말인지 모르겠어"): '수수료 규칙 비교'(fee-resolver 그림자검증 — 개발/검증 전용,
      //   기본 OFF·돈 안 움직임)는 재무 실무 메뉴에서 오해 소지 → 아래 '개발자 도구' 그룹으로 이동.
    ],
  },
  {
    // 🛟 전-서비스 공통 CS 데스크 — 어드민이 서비스 구분 없이 한 큐로 처리하는 것만 남긴다.
    //   🗺️ 2026-08-16: 카카오맵 후기 검증·상권 쿠폰은 **유어딜 전용 캠페인 운영**이라 '유어딜 · 상권/매장' 으로 이동.
    title: '검증/CS',
    section: 'common',
    items: [
      { path: '/admin/disputes',         label: '분쟁 큐',       icon: AlertOctagon },
      { path: '/admin/influencer-disputes', label: '🎟️ 유어딜 추천 커미션 분쟁', icon: AlertOctagon },
      { path: '/admin/business-verification', label: '사업자 검증', icon: Shield },
      { path: '/admin/review-moderation', label: '리뷰 관리',     icon: MessageSquare },
      { path: '/admin/policy',           label: '정책 대시보드', icon: Shield },
    ],
  },
  {
    title: '콘텐츠',
    section: 'common',
    items: [
      { path: '/admin/blog',              label: '블로그 관리',   icon: BookOpen },
      // 🥗 2026-07-15 소셜 자동화는 ur-ads 워커로 이전(메인 슬림 유지). ur-ads 컷오버 완료 후 메뉴 재노출.
      { path: '/admin/social',            label: '소셜 홍보',     icon: Share2 },
      { path: '/admin/notices',           label: '공지사항',      icon: Send },
      { path: '/admin/bulk-email',        label: '단체메일',      icon: Mail },
      { path: '/admin/reviews',           label: '리뷰 자동 생성', icon: Sparkles },
    ],
  },
  {
    // 📺 라이브커머스 — 잠정 중단(LIVE_COMMERCE_SUSPENDED). 그룹째 숨김, 재개 시 플래그만 false → 복원.
    // 🧭 2026-08-16 (죽은 링크 제거): `/admin/live-monitor`·`/admin/castings` 는 **라우트도 페이지 파일도
    //   이미 없다**(중단 정리 때 화면만 지우고 이 표는 안 고쳤다). 그룹이 숨겨져 있어 사용자 피해는
    //   없었지만, 재개하겠다고 플래그를 false 로 돌리면 **곧장 깨진 링크 2개**가 뜬다 — 그때가
    //   가장 확인이 안 될 때다. 복원하려면 화면부터 되살려야 한다.
    title: '📺 라이브커머스',
    section: 'common',
    items: [
      { path: '/admin/ad-slots',         label: '광고 슬롯',     icon: Megaphone },
      { path: '/admin/tiktok-discovery', label: 'TikTok 발굴',   icon: Sparkles },
      { path: '/admin/replay',           label: '다시보기 관리', icon: Play },
    ],
  },
  {
    title: '시스템',
    section: 'common',
    items: [
      { path: '/admin/accounts',          label: '관리자 계정',   icon: UserCog },
      { path: '/admin/login-history',     label: '로그인 이력(IP)', icon: History },
      { path: '/admin/audit-log',         label: '감사 로그',     icon: Shield },
      { path: '/admin/set-pin',           label: '로그인 PIN',    icon: Shield },
      { path: '/admin/platform-settings',      label: '플랫폼 설정',   icon: Settings },
      { path: '/admin/notification-settings',  label: '알림 채널 설정', icon: Bell },
      { path: '/admin/alimtalk',               label: '브랜드메시지',  icon: Bell },
      { path: '/admin/sample-requests',   label: '샘플 신청',     icon: ClipboardList },
      { path: '/admin/cafe24',            label: 'Cafe24 연동',   icon: Store },
    ],
  },
  {
    // 🔧 2026-06-09 IA 정리: 진단/디버그성 고아 라우트 — 평소엔 접어두는 개발자 도구 그룹.
    title: '🔧 개발자 도구',
    section: 'common',
    defaultCollapsed: true,
    items: [
      { path: '/admin/system-monitoring', label: '시스템 모니터링', icon: Monitor },
      { path: '/admin/kv-monitoring',     label: 'KV 모니터링',   icon: Monitor },
      { path: '/admin/health',            label: '헬스 체크',     icon: Shield },
      { path: '/admin/errors',            label: '에러 로그',     icon: AlertTriangle },
      { path: '/admin/env-check',         label: 'ENV 점검',      icon: Settings },
      { path: '/admin/kakao-test',        label: '카카오 연동 테스트', icon: Wrench },
      // 🧭 2026-08-16 (고아 라우트 등재): 카카오 로그인 진단(브라우저별 success/error)도 URL 전용이었다.
      { path: '/admin/kakao-login-diag',  label: '카카오 로그인 진단', icon: Wrench },
      { path: '/admin/youtube-quota',     label: 'YouTube 쿼터',  icon: Play },
      { path: '/admin/fee-breakdown',     label: '수수료 규칙 검증(개발)', icon: Scale },
    ],
  },
]

// 🏭 2026-06-04 라이브커머스 잠정 중단 — 어드민 nav 에서 라이브 전용 항목 숨김 (플래그 재사용, 복원 가능).
//   라이브 모니터 / 광고 슬롯(입찰) / 캐스팅 / TikTok 발굴 / 다시보기(라이브 replay).
const LIVE_ADMIN_PATHS = new Set<string>([
  '/admin/live-monitor', '/admin/ad-slots', '/admin/castings', '/admin/tiktok-discovery', '/admin/replay',
  // 🏭 2026-07-01 (대표 "라이브 관련 내용 다 빼줘") YouTube 쿼터는 YouTube-라이브 전용 진단 → 라이브 중단 시 숨김.
  '/admin/youtube-quota',
])
/**
 * 🧨 **도매 철거 — 소비자 도메인에서 도매 밴드를 숨긴다** 〔2026-08-03 대표 "도매몰은 잔재도 없애는거야"〕
 *
 * 릴리즈 체크리스트 **A6**(*"도매 잔재가 안 보인다 — 어드민 메뉴에 도매 항목 0"*)의 안전한 절반이다.
 *
 * 🔴 **숨겨도 잃는 게 없다**: 도매 어드민 API 는 `mount-wholesale.ts` 안에 있어 소비자 배포(ur-live)에는
 *   **애초에 없다**(`__INCLUDE_WHOLESALE__=false` → DCE). urdeal.kr 에서 이 메뉴들은 **이미 죽은 링크**였다.
 *   즉 이 필터는 기능을 끄는 게 아니라 *없는 기능을 안 보이게* 한다.
 *
 * 🔴 **왜 화면 삭제가 아니라 숨김인가**: 철거 계획 §4 가 *"머니 게이트 4항목(예치금·미확인 충전요청·
 *   미지급 정산금·plus)이 0 임을 확인한 뒤에 삭제"* 로 못박았고, 그 **확인 경로가 `/admin/wholesale-overview`**
 *   다. 도매 도메인에서 그 화면이 살아 있어야 대표가 잔액을 확인하고 환급할 수 있다.
 *   ⇒ 소비자 도메인에서만 숨기고, 삭제는 게이트 통과 후 **별도 PR**(계획 §5-3, 대표 확정 "삭제는 고립").
 *
 * 탈출구: `?wholesale=1`(`isUtongstart` 가 이미 지원) · 호스트에 `wholesale` 포함(`ur-wholesale.pages.dev`).
 */
export function isWholesaleAdminSurface(): boolean {
  if (isUtongstart()) return true                      // utongstart.com · ?wholesale=1 — 호스트 SSOT
  if (typeof window === 'undefined' || !window.location) return false
  return window.location.hostname.toLowerCase().includes('wholesale')  // ur-wholesale.pages.dev 등
}

/** 도매 밴드 제거 — 도매 배포에서는 그대로 둔다. `domain: 'wholesale'` 그룹만 대상. */
export const withoutWholesaleOnConsumer = (groups: NavGroup[]): NavGroup[] =>
  isWholesaleAdminSurface() ? groups : groups.filter((g) => g.domain !== 'wholesale')

export const VISIBLE_NAV_GROUPS: NavGroup[] = LIVE_COMMERCE_SUSPENDED
  ? NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((it) => !LIVE_ADMIN_PATHS.has(it.path)) })).filter((g) => g.items.length > 0)
  : NAV_GROUPS

// 🎟️🏭 2026-07-01 (대표 "유어딜·도매몰 철저히 UX/UI 분리 — 전체적으로"): 좌측 nav 를 서비스 밴드로 구획.
//   super 어드민은 전 그룹을 보는데 유어딜(소비자)·유통스타트(도매몰)·공통 그룹이 섞여 보였음(구분=이모지 뿐) →
//   섹션 헤더 밴드로 3분할(운영 '홈'은 최상단 무밴드). 그룹 정의/RBAC(도매 role=wholesale 그룹만)/collapse/active 전부 불변 — 렌더 구획만.
/**
 * 🧭 2026-08-16: **그룹이 선언한 밴드를 그대로 읽는다.** 제목 문자열 매칭 + `'common'` 폴백을
 *   제거했다(취약점 둘을 동시에 없앤다):
 *   ① 밴드를 안 적은 새 서비스 그룹이 **조용히 공통으로** 빨려 들어감 — 유어애즈가 실제로 그랬다.
 *   ② 그룹 **제목을 바꾸면 밴드가 말없이 이동** — 라벨은 자주 바뀐다(8/14 에도 바꿨다).
 *   `domain` 도 더는 밴드 판정에 쓰지 않는다(RBAC 축과 렌더 축의 분리 — 타입 주석 참조).
 */
export const navSectionOf = (g: NavGroup): NavSectionKey => g.section
export const NAV_SECTIONS: Array<{ key: NavSectionKey; label?: string; accent?: string }> = [
  { key: 'home' },
  { key: 'urdeal', label: '🎟️ 유어딜 · 소비자', accent: '#a5b4fc' },
  { key: 'mall', label: '🏪 공구 서비스 · 운영자 몰 (SaaS)', accent: '#6ee7b7' },
  // 📣 2026-08-16: 유어애즈는 **네 서비스 중 하나**인데 밴드가 없어 '공통' 아래 렌더되고 있었다.
  { key: 'ads', label: '📣 유어애즈 · 마케팅 (인플루언서 DB)', accent: '#f0abfc' },
  { key: 'wholesale', label: '🏭 유통스타트 · 도매몰 (B2B)', accent: '#fbbf24' },
  { key: 'common', label: '⚙️ 공통 · 회원·재무·검증·시스템', accent: '#94a3b8' },
]

// 🛡️ 2026-06-17 (대표 신고 — 로그인 시 화면이 미친듯이 깜빡): 강제 보안 설정/계정 보안 페이지는
//   역할과 무관하게 항상 도달 가능해야 한다. 도매 RBAC 리다이렉트가 강제 PIN 게이트와 충돌하면 무한 루프.
export const ALWAYS_ALLOWED_ADMIN_PATHS = ['/admin/set-pin', '/admin/2fa']
// 🆕 2026-06-24: '도매 통합 현황'의 승인 큐 카드가 가리키는 비-도매-nav 경로 — 도매 파트너도 도달 허용.
// 🗂️ 2026-07-02 (1페이지화): 예치금/출금 nav 항목이 판매사·제조사 관리의 탭으로 흡수되며 딥링크
//   경로가 nav 주항목에서 사라짐 → wholesale role 도달성 명시 허용(탭으로 열림).
export const WHOLESALE_EXTRA_ALLOWED_PATHS = ['/admin/products', '/admin/wholesale-integrity', '/admin/wholesale-deposits', '/admin/wholesale-withdrawals']
