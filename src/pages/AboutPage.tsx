import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Sparkles,
  Trophy,
  Users,
  Zap,
  ShoppingBag,
  Gift,
  Gavel,
  Tv,
  Bot,
  MapPin,
  Wallet,
  Download,
  Printer,
  ArrowRight,
  Rocket,
  TrendingUp,
  Globe,
  Star,
  CheckCircle2,
} from 'lucide-react'
import SEO from '@/components/SEO'

/**
 * 공개 서비스 소개 페이지
 * /about
 *
 * docs/SERVICE_INTRODUCTION.md 의 내용을 페이지화.
 * 인쇄 모드 (?print=1) 진입 시 자동으로 window.print() 트리거 → 사용자가 PDF 로 저장.
 */
export default function AboutPage() {
  const [searchParams] = useSearchParams()
  const isPrintMode = searchParams.get('print') === '1'

  useEffect(() => {
    if (isPrintMode) {
      // 렌더 후 약간의 딜레이를 두고 인쇄 다이얼로그 열기
      const timer = setTimeout(() => {
        window.print()
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [isPrintMode])

  const handleDownloadPdf = () => {
    // 새 탭에서 print 모드로 열고 자동 print
    window.open('/about?print=1', '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      <SEO
        title="서비스 소개 - 유어딜"
        description="라이브 커머스 + 식사권 공구의 새로운 표준. 셀러·에이전시·소비자 모두에게 최고의 가치를."
        url="/about"
      />

      <div className="bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-white min-h-screen">
        {/* ========== Hero ========== */}
        <section className="relative overflow-hidden bg-gradient-to-br from-pink-50 via-white to-purple-50 dark:from-[#1A0A14] dark:via-[#0A0A0A] dark:to-[#0F0A1A] border-b border-gray-100 dark:border-[#1A1A1A]">
          <div className="ur-content-wide px-4 lg:px-8 py-16 lg:py-24">
            <div className="text-center max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-300 text-xs font-semibold mb-6">
                <Sparkles className="w-3.5 h-3.5" />
                Korean Live Commerce, Reinvented
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight leading-tight mb-6">
                유어딜
                <span className="block text-pink-500 mt-2">라이브 커머스의 새로운 표준</span>
              </h1>
              <p className="text-base sm:text-lg lg:text-xl text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                라이브 방송 + 후원 + 경매 + 공구를 한 화면에서.
              </p>
              <p className="text-base sm:text-lg lg:text-xl text-gray-600 dark:text-gray-300 leading-relaxed mb-10">
                셀러는 5분 만에 시작, 소비자는 팬덤 경험으로 산다.
              </p>

              <div className="flex flex-wrap gap-3 justify-center">
                <Link
                  to="/seller/login"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-sm lg:text-base transition-colors shadow-lg shadow-pink-500/20"
                >
                  셀러로 시작하기
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/agency/login"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 font-bold text-sm lg:text-base transition-colors"
                >
                  에이전시 가입
                </Link>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#222] font-bold text-sm lg:text-base transition-colors"
                >
                  서비스 둘러보기
                </Link>
                <button
                  onClick={handleDownloadPdf}
                  className="no-print inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#222] font-bold text-sm lg:text-base transition-colors"
                >
                  <Download className="w-4 h-4" />
                  PDF 다운로드
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ========== TL;DR ========== */}
        <Section id="tldr" title="30초 요약" subtitle="대상별 핵심 가치">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <ValueCard
              icon={<Tv className="w-6 h-6" />}
              tag="셀러"
              title="5분 내 첫 방송"
              desc="카카오 로그인 한 번으로 상품·후원·경매·공구 4개 수익원. 정산 D+5일 (업계 최단)."
              color="pink"
            />
            <ValueCard
              icon={<Users className="w-6 h-6" />}
              tag="에이전시 (MCN)"
              title="멤버 셀러 통합 관리"
              desc="PK 배틀 트래픽 폭증, AI 셀러 매칭, 그룹 인센티브, 정산 자동 일괄."
              color="purple"
            />
            <ValueCard
              icon={<Sparkles className="w-6 h-6" />}
              tag="소비자"
              title="쇼핑이 게임이 된다"
              desc="라이브 경매 낙찰의 짜릿함, 식사권 공구 카카오 바이럴, 셀러에게 직접 후원·인사받기."
              color="amber"
            />
            <ValueCard
              icon={<TrendingUp className="w-6 h-6" />}
              tag="투자자"
              title="한국 시장 PMF"
              desc="카카오 OAuth + 토스 결제 네이티브 + 식당 O2O = Pinduoduo 가 못 한 한국 로컬 침투."
              color="emerald"
            />
          </div>
        </Section>

        {/* ========== 차별점 ========== */}
        <Section id="diff" title="우리는 무엇이 다른가" subtitle="경쟁 서비스와의 차별점">
          <div className="space-y-12">
            <ComparisonTable
              title="vs 그립 / 카카오쇼핑라이브 (라이브커머스 1세대)"
              caption="그립은 'TV홈쇼핑의 라이브화', 유어딜은 '트위치+쿠팡+카카오선물의 결합'."
              headers={['항목', '그립 / 카카오쇼핑라이브', '유어딜']}
              rows={[
                ['셀러 진입', '별도 앱 + 심사 + 보증금', '브라우저만 OBS 송출, 카카오 5분'],
                ['후원 시스템', '없음 (쇼핑만)', '딜 포인트 후원 내장 — 라이브 닉네임 노출'],
                ['경매', '없음', '실시간 경매 — 가격 하락 / 누군가 낚아챔'],
                ['식사권/오프라인', '없음', '그룹바이 식사권 카테고리 독자 운영'],
                ['정산', 'D+15~30', '상품 D+5, 후원 D+10'],
              ]}
            />
            <ComparisonTable
              title="vs YouTube Shopping"
              caption="YouTube Shopping 은 '콘텐츠 부가수익', 유어딜은 '커머스가 본업'."
              headers={['항목', 'YouTube Shopping', '유어딜']}
              rows={[
                ['정산', '월 단위, 채널 페이아웃 통합', '상품별 D+5일, 투명 즉시 가시화'],
                ['결제', '글로벌 카드 위주', '토스·카카오페이 네이티브 + 가상계좌'],
                ['오프라인 연계', '없음', '식당 O2O — 식사권 발급/사용까지 한 앱'],
                ['한국 셀러 진입', '채널 1000명 + 4000시간 + 심사', '카카오 로그인 즉시'],
                ['후원/도네이션', 'Super Chat (라이브 한정)', '모든 셀러 페이지 상시 후원'],
              ]}
            />
            <ComparisonTable
              title="vs 티몬 / 위메프 슈퍼딜"
              caption="슈퍼딜은 '싼 거 사러 가는 곳', 유어딜은 '좋아하는 셀러 보러 가서 사는 곳'."
              headers={['항목', '슈퍼딜', '유어딜']}
              rows={[
                ['본질', '가격 할인 게시판', '라이브 + 후원 + 경매 = 팬덤 경험'],
                ['셀러-소비자 관계', '익명 트랜잭션', '닉네임 후원, 셀러 직접 감사 인사'],
                ['시간 압박', '24시간 한정 할인', '방송 중 N분 한정 경매 — 즉시성'],
                ['충성도', '가격이 떠나면 떠남', '셀러 팬덤 락인'],
              ]}
            />
            <ComparisonTable
              title="vs Naver Smart Store / 쿠팡"
              caption="쿠팡은 '검색해서 사는 곳', 유어딜은 '재미있어서 들렀다 사는 곳'."
              headers={['항목', '스마트스토어 / 쿠팡', '유어딜']}
              rows={[
                ['디스커버리', 'SEO·광고 입찰 (CPC 부담)', '라이브 + 알고리즘 추천 + 셀러 팬덤'],
                ['셀러 차별화', '가격·리뷰 경쟁', '방송 콘텐츠 + 후원 + 경매로 차별화'],
                ['광고비', '매출의 5~15% 광고 의존', '방송 자체가 마케팅'],
              ]}
            />
            <ComparisonTable
              title="vs Pinduoduo (중국 공동구매)"
              caption="Pinduoduo 가 한국에서 못 한 '카카오 + 식당 O2O' 침투를 우리가 한다."
              headers={['항목', 'Pinduoduo', '유어딜']}
              rows={[
                ['바이럴 채널', 'WeChat', '카카오톡 공유 네이티브'],
                ['카테고리', '저가 일반 상품 위주', '식사권/오프라인 카테고리 독자'],
                ['라이브 결합', '별도 앱 분리', '공구 + 라이브 + 후원 통합'],
              ]}
            />
          </div>
        </Section>

        {/* ========== 셀러 기대효과 ========== */}
        <Section id="seller" title="셀러 기대효과" subtitle="왜 유어딜에서 시작해야 하는가" tone="pink">
          <div className="space-y-10">
            <SubBlock title="2-1. 진입장벽 ZERO" icon={<Zap className="w-5 h-5" />}>
              <ul className="space-y-2 text-gray-700 dark:text-gray-300 text-sm lg:text-base">
                <li>· 카카오 로그인 → 5분 내 첫 방송</li>
                <li>· YouTube 채널만 있으면 즉시 셀러 등록 (사업자 미요건, 매출 도달 시 통신판매업)</li>
                <li>· OBS / 모바일 카메라 송출 — 브라우저만 있으면 시작 (앱 설치 X)</li>
                <li>· 자체 쇼핑몰 구축 비용 0원 (Shopify 월 $29 + 도메인 + PG 부담 X)</li>
              </ul>
              <p className="mt-3 p-3 rounded-lg bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300 text-xs lg:text-sm">
                비교: 자체 YouTube 채널 + Shopify 시작 시 평균 2~3개월 + 200만원. 유어딜은 <strong>0원 / 5분</strong>.
              </p>
            </SubBlock>

            <SubBlock title="2-2. 다중 수익원 — 4가지 수익화" icon={<Wallet className="w-5 h-5" />}>
              <SimpleTable
                headers={['수익원', '플랫폼 수수료', '셀러 수령']}
                rows={[
                  ['상품 판매', '10%', '90%'],
                  ['라이브 후원', '15% (기본)', '85%'],
                  ['실시간 경매', '10%', '90%'],
                  ['그룹바이 (공구)', '5%', '95%'],
                ]}
              />
              <p className="mt-3 text-xs lg:text-sm text-gray-600 dark:text-gray-400">
                단일 셀러가 상품 + 후원 + 경매 + 공구 4개 채널로 동시 매출.
              </p>
            </SubBlock>

            <SubBlock title="2-3. 셀러 등급 시스템 — 성장형 보상" icon={<Trophy className="w-5 h-5" />}>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {['신규', '브론즈', '실버', '골드', '플래티넘'].map((tier, i) => (
                  <div key={tier} className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-[#1A1A1A] text-gray-900 dark:text-white text-xs lg:text-sm font-semibold">
                      {tier}
                    </span>
                    {i < 4 && <ArrowRight className="w-3.5 h-3.5 text-gray-400" />}
                  </div>
                ))}
              </div>
              <ul className="space-y-2 text-gray-700 dark:text-gray-300 text-sm lg:text-base">
                <li>· 등급 진급 시 <strong>수수료 차감</strong> (플래티넘 최저)</li>
                <li>· 알고리즘 노출 가중치 상승 — 상위 등급 셀러가 홈/카테고리 상단</li>
                <li>· 어드민 셀러별 commission_rate 개별 조정 — 협상 여지</li>
              </ul>
            </SubBlock>

            <SubBlock title="2-4. AI 매칭 — 영업 없이 협업" icon={<Bot className="w-5 h-5" />}>
              <ul className="space-y-2 text-gray-700 dark:text-gray-300 text-sm lg:text-base">
                <li>· 유어딜 에이전시 매칭 추천 (카테고리/규모/지역)</li>
                <li>· 셀러간 PK 배틀 매칭 — 비슷한 규모와 라이브 대결, 시청자 풀 합산</li>
              </ul>
            </SubBlock>

            <SubBlock title="2-5. 무료 CRM 인프라" icon={<Gift className="w-5 h-5" />}>
              <ul className="space-y-2 text-gray-700 dark:text-gray-300 text-sm lg:text-base">
                <li>· 알림톡 무료 크레딧 (가입 시 지급)</li>
                <li>· 카카오 공유 → 클릭 → 구매 풀 퍼널 분석</li>
                <li>· 단골 자동 태깅 + 리타겟팅 알림</li>
              </ul>
            </SubBlock>

            <SubBlock title="2-6. 업계 최단 정산" icon={<Wallet className="w-5 h-5" />}>
              <SimpleTable
                headers={['정산 항목', '유어딜', '업계 평균']}
                rows={[
                  ['상품 (배송 확정 후)', 'D+5일', 'D+15~30'],
                  ['라이브 후원', 'D+10일', '(지원 안 함)'],
                  ['그룹바이', 'D+7일', 'D+30'],
                ]}
              />
              <p className="mt-3 text-xs lg:text-sm text-gray-600 dark:text-gray-400">
                현금흐름 = 셀러 생존. <strong>D+5</strong> 는 업계 최단 클래스.
              </p>
            </SubBlock>
          </div>
        </Section>

        {/* ========== 에이전시 기대효과 ========== */}
        <Section id="agency" title="에이전시 (MCN) 기대효과" subtitle="왜 유어딜에서 셀러를 키우는가" tone="purple">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FeatureCard
              icon={<Users className="w-5 h-5" />}
              title="멤버 셀러 통합 대시보드"
              desc="모든 소속 셀러의 매출/방송/시청자/후원/정산 한 화면. KPI 비교 → 코칭 우선순위 자동 추출. 일/주/월 리포트 자동."
            />
            <FeatureCard
              icon={<Trophy className="w-5 h-5" />}
              title="PK 배틀 — 자체 토너먼트"
              desc="소속 셀러간 PK 매칭 → 트래픽 합산 + 응원 후원. 토너먼트 시즌 운영 → 우승자 노출 부스트 + 상금. 신인 데뷔 가속."
            />
            <FeatureCard
              icon={<Rocket className="w-5 h-5" />}
              title="프로모트 부스트 패키지"
              desc="멤버 셀러 노출 강화 패키지 구매. 홈/카테고리 상단/푸시 알림. 신인 데뷔 / 시즌 캠페인 / 신상품 런칭."
            />
            <FeatureCard
              icon={<Star className="w-5 h-5" />}
              title="그룹 인센티브"
              desc="에이전시 전체 목표 매출 달성 시 추가 수수료 환급. 멤버 동기부여 → 자연 그로스 룹."
            />
            <FeatureCard
              icon={<Bot className="w-5 h-5" />}
              title="AI 셀러 매칭 — 영입 자동화"
              desc="유어딜에 가입한 미소속 셀러 중 에이전시 카테고리/규모 적합 셀러 추천. 영업 자동화 → MCN 인력 비용 절감."
            />
            <FeatureCard
              icon={<Wallet className="w-5 h-5" />}
              title="정산 자동화"
              desc="멤버 셀러 정산 일괄 관리. 셀러별 수수료 차등. 세무 처리용 CSV / 세금계산서 자동 발급."
            />
          </div>
        </Section>

        {/* ========== 소비자 wow ========== */}
        <Section id="consumer" title='소비자 "wow" 모먼트' subtitle="왜 쿠팡 대신 유어딜인가" tone="amber">
          <div className="space-y-8">
            <WowMoment
              icon={<Gavel className="w-6 h-6" />}
              title="4-1. 경매 낙찰의 짜릿함"
              quote='"라이브 보다가 5만원 한정판이 3만원으로 떨어지는 순간 — 누가 먼저 클릭하느냐."'
              points={[
                '셀러가 라이브에서 경매 시작 버튼',
                '가격 실시간 하락 → 누군가 클릭하면 즉시 낙찰',
                '즉시 결제 → 1주일 후 받기',
                '채팅창에 "낙찰 축하합니다!" 표시',
              ]}
              tagline="쇼핑이 게임이 된다."
            />
            <WowMoment
              icon={<Users className="w-6 h-6" />}
              title="4-2. 식사권 공구 — 친구 모아 30% 할인"
              quote='"강남 한우 5만원 → 50명 모이면 3만 5천원. 카카오톡으로 친구 5명 초대하면 추가 5천원 할인."'
              points={[
                '식사권 그룹바이 50명 달성 시 자동 30% 할인',
                '친구 카카오 공유 → 인당 추가 할인',
                '식당 가서 앱 화면 보여주기만 (종이/플라스틱 X)',
                'QR 스캔 → 사용 처리 자동',
              ]}
            />
            <WowMoment
              icon={<Sparkles className="w-6 h-6" />}
              title="4-3. 셀러 후원 → 라이브 노출 → 직접 인사"
              quote='"좋아하는 셀러에게 1만 딜 후원 → 라이브 화면에 내 닉네임 큰 글씨 → 셀러가 마이크 잡고 ○○님 감사합니다!"'
              points={[
                '트위치 도네이션과 동일한 팬덤 메커니즘',
                '후원 메시지 라이브 자막',
                '단골 후원자 자동 VIP 태깅 → 신상품 우선 안내',
              ]}
            />
            <WowMoment
              icon={<MapPin className="w-6 h-6" />}
              title="4-4. 식사권 디지털 사용 — 종이 쿠폰 시대 종료"
              quote=""
              points={[
                '구매 즉시 앱에 디지털 식사권 발급',
                '식당 가서 앱 보여주기 → 점원 "사용 완료" 버튼',
                '사용 가능 매장 지도 (/restaurant-map) 한눈에',
                '쓰지 못하면 자동 환불',
              ]}
            />
            <WowMoment
              icon={<Zap className="w-6 h-6" />}
              title="4-5. 카카오 네이티브 경험"
              quote=""
              points={[
                '카카오 로그인 1초',
                '카카오페이 결제 1초',
                '카카오톡 공유 1초',
                '알림톡 배송 / 사용 안내',
              ]}
              tagline="한국 사람이 가장 익숙한 동선 그대로."
            />
          </div>
        </Section>

        {/* ========== 핵심 기능 그리드 ========== */}
        <Section id="features" title="핵심 기능 한눈에" subtitle="10가지 핵심 기능">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {[
              { icon: <Tv className="w-5 h-5" />, title: '라이브 방송', desc: 'WebRTC + HLS 듀얼. 9:16 풀스크린 모바일 우선, OBS RTMP 지원.' },
              { icon: <ShoppingBag className="w-5 h-5" />, title: '상품 / 주문', desc: '토스/가상계좌/카카오페이/딜 포인트. CJ 배송 추적. 자동 D+5 정산.' },
              { icon: <Users className="w-5 h-5" />, title: '그룹바이 (공동구매)', desc: '목표 인원 달성 자동 할인. 미달성 시 전액 자동 환불. 식사권 특화.' },
              { icon: <Gavel className="w-5 h-5" />, title: '라이브 경매', desc: 'Dutch auction. 시작가/최저가/시간. 첫 클릭 낙찰. 즉시 결제.' },
              { icon: <Gift className="w-5 h-5" />, title: '후원 (도네이션)', desc: '최소 500딜. 라이브 자막 + 채팅 강조. D+10 정산. Turnstile 봇 차단.' },
              { icon: <Wallet className="w-5 h-5" />, title: '딜 포인트', desc: '1원 = 1딜 (수수료 ZERO 충전). 후원/결제/경매 모두. 최소 500딜.' },
              { icon: <Trophy className="w-5 h-5" />, title: '셀러 등급 / 수수료', desc: '신규→브론즈→실버→골드→플래티넘. 진급 시 수수료 차감 + 노출 가중.' },
              { icon: <MapPin className="w-5 h-5" />, title: '식당 O2O', desc: '디지털 식사권. 매장 지도. 미사용 자동 환불. QR 없이 앱 화면만.' },
              { icon: <Trophy className="w-5 h-5" />, title: 'PK 배틀', desc: '셀러간/에이전시간 라이브 대결. 후원 합산 승부. 자체 토너먼트 시즌.' },
              { icon: <Bot className="w-5 h-5" />, title: 'AI 추천', desc: '셀러↔에이전시, 셀러↔셀러 PK, 사용자↔라이브 추천 피드.' },
            ].map((f, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#2A2A2A] hover:border-pink-200 dark:hover:border-pink-900 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-pink-50 dark:bg-pink-900/20 text-pink-500 flex items-center justify-center mb-3">
                  {f.icon}
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white text-sm lg:text-base mb-1">{f.title}</h3>
                <p className="text-xs lg:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ========== 기술 신뢰성 ========== */}
        <Section id="tech" title="기술 신뢰성" subtitle="엔터프라이즈급 인프라" tone="emerald">
          <SimpleTable
            headers={['항목', '내용']}
            rows={[
              ['인프라', 'Cloudflare Pages + Workers (글로벌 엣지, 99.99% SLA)'],
              ['DB', 'Cloudflare D1 (분산 SQLite, 자동 백업)'],
              ['결제', '토스페이먼츠 + 카카오페이 + 딜 포인트'],
              ['인증', '카카오 OAuth (KR), Firebase Auth (Global)'],
              ['봇 차단', 'Cloudflare Turnstile'],
              ['Rate Limit', 'KV 기반 IP/계정 limiter'],
              ['다국어', '한/영/일/중/스/프 6개 언어'],
              ['다크모드', '사용자 선택 (시스템/라이트/다크)'],
              ['PC/모바일', '반응형 + 9:16 라이브 액자 모드'],
            ]}
          />
        </Section>

        {/* ========== 로드맵 ========== */}
        <Section id="roadmap" title="로드맵" subtitle="우리가 어디로 가는가">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <RoadmapCard
              tag="단기 (Q2 2026)"
              icon={<Zap className="w-5 h-5" />}
              items={[
                '셀러 등급별 광고 인벤토리',
                '에이전시 PK 토너먼트 시즌 정식 런칭',
                '식사권 매장 1000개 확장',
              ]}
            />
            <RoadmapCard
              tag="중기 (Q3-Q4 2026)"
              icon={<Globe className="w-5 h-5" />}
              items={[
                '글로벌 진출 (일본/동남아) — Firebase Auth 베이스',
                'AI 자동 방송 요약 / 하이라이트 클립',
                '셀러 라이브 송출 자체 SDK (모바일 앱 임베드)',
              ]}
            />
            <RoadmapCard
              tag="장기 (2027+)"
              icon={<Rocket className="w-5 h-5" />}
              items={[
                'B2B 라이브커머스 SaaS — 화이트라벨',
                '오프라인 매장 디지털 사이니지 라이브 송출',
                'AR 가상 피팅 / 시연',
              ]}
            />
          </div>
        </Section>

        {/* ========== 누구에게 적합 ========== */}
        <Section id="fit" title="누구에게 가장 적합한가" subtitle="이런 분들께 추천드립니다">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FitCard
              title="셀러"
              icon={<Tv className="w-5 h-5" />}
              items={[
                'YouTube/인스타 1만+ 크리에이터',
                '자체 쇼핑몰 부담스러운 소상공인',
                '식당/카페/헬스장 등 오프라인 매장',
                '한정판/한정 수량 (경매 강점)',
                '시즌성 강한 카테고리',
              ]}
            />
            <FitCard
              title="에이전시 (MCN)"
              icon={<Users className="w-5 h-5" />}
              items={[
                '크리에이터 5명 이상 보유',
                '커머스 전환 본격 시도하는 기존 MCN',
                '신인 데뷔 채널 찾는 신생 에이전시',
              ]}
            />
            <FitCard
              title="소비자"
              icon={<Sparkles className="w-5 h-5" />}
              items={[
                '라이브쇼핑/트위치 도네이션 익숙한 20-40대',
                '"재미있게 사고 싶은" 사람',
                '식당/오프라인 경험 좋아하는 사람',
                '카카오 생태계 헤비 유저',
              ]}
            />
          </div>
        </Section>

        {/* ========== Final CTA ========== */}
        <section className="bg-gradient-to-br from-pink-500 to-purple-600 dark:from-pink-600 dark:to-purple-700 text-white py-16 lg:py-24">
          <div className="ur-content-wide px-4 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4">시작하기</h2>
            <p className="text-base lg:text-lg text-white/90 mb-10 max-w-2xl mx-auto">
              유어딜은 한국에서 라이브커머스의 새로운 표준을 만듭니다.
              <br />
              5분 만에 시작할 자유, 멤버를 키울 무대, 쇼핑 이상의 경험.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 max-w-4xl mx-auto mb-10">
              <CTACard to="/seller/login" title="셀러" subtitle="카카오 로그인 → 5분 후 방송" />
              <CTACard to="/agency/login" title="에이전시" subtitle="사업자 인증 → 멤버 초대" />
              <CTACard to="/login" title="소비자" subtitle="카카오/이메일 → 라이브 시청" />
              <CTACard to="/admin/login" title="어드민" subtitle="운영팀 전용" />
            </div>

            <button
              onClick={handleDownloadPdf}
              className="no-print inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-gray-900 hover:bg-gray-100 font-bold text-base transition-colors shadow-xl"
            >
              <Printer className="w-5 h-5" />
              PDF 로 다운로드 (인쇄 → PDF 저장)
            </button>
            <p className="text-xs text-white/70 mt-3">
              새 창이 열리고 자동으로 인쇄 다이얼로그가 뜹니다. "PDF 로 저장" 을 선택하세요.
            </p>
          </div>
        </section>
      </div>

      {/* Print 전용 스타일 */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          section { page-break-inside: avoid; }
        }
      `}</style>
    </>
  )
}

/* ============ helper components ============ */

function Section({
  id,
  title,
  subtitle,
  children,
  tone = 'gray',
}: {
  id: string
  title: string
  subtitle?: string
  children: React.ReactNode
  tone?: 'gray' | 'pink' | 'purple' | 'amber' | 'emerald'
}) {
  const toneBg: Record<string, string> = {
    gray: 'bg-white dark:bg-[#0A0A0A]',
    pink: 'bg-pink-50/40 dark:bg-[#150A10]',
    purple: 'bg-purple-50/40 dark:bg-[#100A18]',
    amber: 'bg-amber-50/40 dark:bg-[#181208]',
    emerald: 'bg-emerald-50/30 dark:bg-[#0A1410]',
  }
  return (
    <section id={id} className={`${toneBg[tone]} border-b border-gray-100 dark:border-[#1A1A1A]`}>
      <div className="ur-content-wide px-4 lg:px-8 py-12 lg:py-20">
        <div className="mb-8 lg:mb-12 text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-extrabold text-gray-900 dark:text-white mb-3">{title}</h2>
          {subtitle && <p className="text-sm lg:text-base text-gray-600 dark:text-gray-400">{subtitle}</p>}
        </div>
        {children}
      </div>
    </section>
  )
}

function ValueCard({
  icon,
  tag,
  title,
  desc,
  color,
}: {
  icon: React.ReactNode
  tag: string
  title: string
  desc: string
  color: 'pink' | 'purple' | 'amber' | 'emerald'
}) {
  const map: Record<string, string> = {
    pink: 'bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-300',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-300',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-300',
  }
  return (
    <div className="p-5 lg:p-6 rounded-2xl bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#2A2A2A]">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${map[color]}`}>{icon}</div>
      <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{tag}</div>
      <h3 className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{desc}</p>
    </div>
  )
}

function ComparisonTable({
  title,
  caption,
  headers,
  rows,
}: {
  title: string
  caption?: string
  headers: string[]
  rows: string[][]
}) {
  return (
    <div>
      <h3 className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white mb-4">{title}</h3>
      <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-[#2A2A2A]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-[#1A1A1A]">
              {headers.map((h, i) => (
                <th
                  key={i}
                  className={`px-4 py-3 text-left font-bold text-gray-900 dark:text-white ${
                    i === headers.length - 1 ? 'text-pink-600 dark:text-pink-400' : ''
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-t border-gray-100 dark:border-[#2A2A2A]">
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`px-4 py-3 align-top ${
                      ci === 0
                        ? 'font-semibold text-gray-900 dark:text-white whitespace-nowrap'
                        : ci === row.length - 1
                        ? 'text-pink-700 dark:text-pink-300 font-medium'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption && (
        <p className="mt-3 text-xs lg:text-sm text-gray-500 dark:text-gray-400 italic">{caption}</p>
      )}
    </div>
  )
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-[#2A2A2A]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-[#1A1A1A]">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3 text-left font-bold text-gray-900 dark:text-white">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-t border-gray-100 dark:border-[#2A2A2A]">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-4 py-3 ${
                    ci === 0
                      ? 'font-semibold text-gray-900 dark:text-white'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SubBlock({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="p-5 lg:p-6 rounded-2xl bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#2A2A2A]">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-pink-50 dark:bg-pink-900/20 text-pink-500 flex items-center justify-center">
          {icon}
        </div>
        <h3 className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <div className="p-5 lg:p-6 rounded-2xl bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#2A2A2A]">
      <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 flex items-center justify-center mb-3">
        {icon}
      </div>
      <h3 className="text-base lg:text-lg font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{desc}</p>
    </div>
  )
}

function WowMoment({
  icon,
  title,
  quote,
  points,
  tagline,
}: {
  icon: React.ReactNode
  title: string
  quote?: string
  points: string[]
  tagline?: string
}) {
  return (
    <div className="p-5 lg:p-8 rounded-2xl bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#2A2A2A]">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-300 flex items-center justify-center">
          {icon}
        </div>
        <h3 className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
      </div>
      {quote && (
        <blockquote className="border-l-4 border-amber-300 dark:border-amber-700 pl-4 py-2 mb-4 text-gray-700 dark:text-gray-300 text-sm lg:text-base italic">
          {quote}
        </blockquote>
      )}
      <ul className="space-y-2 mb-3">
        {points.map((p, i) => (
          <li key={i} className="flex items-start gap-2 text-sm lg:text-base text-gray-700 dark:text-gray-300">
            <CheckCircle2 className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
      {tagline && (
        <p className="text-sm lg:text-base font-bold text-amber-600 dark:text-amber-300 mt-3">{tagline}</p>
      )}
    </div>
  )
}

function RoadmapCard({
  tag,
  icon,
  items,
}: {
  tag: string
  icon: React.ReactNode
  items: string[]
}) {
  return (
    <div className="p-5 lg:p-6 rounded-2xl bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#2A2A2A]">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
          {icon}
        </div>
        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">{tag}</span>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm lg:text-base text-gray-700 dark:text-gray-300">
            <ArrowRight className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FitCard({
  title,
  icon,
  items,
}: {
  title: string
  icon: React.ReactNode
  items: string[]
}) {
  return (
    <div className="p-5 lg:p-6 rounded-2xl bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#2A2A2A]">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-pink-50 dark:bg-pink-900/20 text-pink-500 flex items-center justify-center">
          {icon}
        </div>
        <h3 className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
            <CheckCircle2 className="w-4 h-4 text-pink-500 mt-0.5 shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CTACard({ to, title, subtitle }: { to: string; title: string; subtitle: string }) {
  return (
    <Link
      to={to}
      className="block p-5 rounded-2xl bg-white/15 hover:bg-white/25 backdrop-blur border border-white/30 transition-colors text-left"
    >
      <div className="text-base lg:text-lg font-bold text-white mb-1">{title}</div>
      <div className="text-xs lg:text-sm text-white/85">{subtitle}</div>
      <ArrowRight className="w-4 h-4 text-white mt-3" />
    </Link>
  )
}

