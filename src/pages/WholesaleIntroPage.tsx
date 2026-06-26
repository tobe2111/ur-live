/**
 * 🏭 2026-06-03 유통스타트 도매몰 — 공개 소개 랜딩 (시중 노출용, 인덱싱 대상).
 *   utongstart.com 루트 + /wholesale/intro. 로그인 불필요 — 가치제안 + 듀얼 가입 CTA.
 *   제조사 → /supplier/register, 판매사 → /wholesale/join.
 */
import { useNavigate } from 'react-router-dom'
import SEO, { wholesaleStoreJsonLd, faqJsonLd, breadcrumbJsonLd } from '@/components/SEO'
import { Factory, Store, ArrowRight, PackageCheck, TrendingDown, FileSpreadsheet, ShieldCheck, Layers } from 'lucide-react'
import { WholesaleWordmark } from './wholesale-catalog/WholesaleLogo'

export default function WholesaleIntroPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-[100dvh] bg-white text-[#0C2454]">
      <SEO
        domain="wholesale"
        title="도매사이트 유통스타트 — 제조사 직거래 B2B 도매가 사입·무재고 위탁판매"
        description="제조사와 판매사를 직접 잇는 B2B 도매사이트. 등급별 도매가(공급가) 사입, OEM/ODM 제작, 무재고 위탁판매·대량 주문 엑셀까지. 제조사 입점·판매사 도매 회원가입 무료."
        url="/wholesale/intro"
        jsonLd={[
          wholesaleStoreJsonLd,
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: '유통스타트 B2B 도매몰',
            serviceType: 'B2B 도매 유통 플랫폼',
            description: '제조사와 판매사를 직접 잇는 B2B 도매사이트 — 등급별 도매가 사입, OEM/ODM 제작 매칭, 무재고 위탁판매·대량 주문 엑셀, 위탁배송.',
            areaServed: 'KR',
            provider: { '@type': 'Organization', name: '유통스타트', url: 'https://utongstart.com' },
          },
          breadcrumbJsonLd([
            { name: '유통스타트', url: 'https://utongstart.com/wholesale' },
            { name: '도매몰 소개', url: 'https://utongstart.com/wholesale/intro' },
          ]),
          faqJsonLd([
            { q: '유통스타트는 어떤 도매사이트인가요?', a: '제조사와 판매사를 직접 잇는 B2B 도매 플랫폼입니다. 판매사는 검증된 제조사 상품을 등급별 도매가(공급가)로 사입할 수 있고, 제조사는 영업 없이 전국 유통 채널에 상품을 공급할 수 있어요.' },
            { q: '가입비나 월 고정비가 있나요?', a: '없습니다. 가입비·월 고정비 0원으로, 실제 거래가 일어나는 만큼만 부담합니다. 판매사는 가입 즉시 C등급 도매가가 적용되고 거래 실적에 따라 A·B 등급으로 상향됩니다.' },
            { q: '무재고 위탁판매도 가능한가요?', a: '가능합니다. 제조사가 운송장을 입력해 직배송하므로 판매사는 재고를 보유하지 않고도 사입·판매할 수 있어요. 대량 주문은 주문서 엑셀 업로드로 한 번에 처리됩니다.' },
            { q: 'OEM/ODM 자사 브랜드 제작도 되나요?', a: '됩니다. 판매사가 OEM/ODM을 신청하면 유통스타트가 적합한 제조사를 매칭하고 생산까지 지원합니다.' },
            { q: '도매가(공급가)는 어떻게 확인하나요?', a: '도매가는 승인된 판매사 로그인 후에만 열람할 수 있습니다. 제조사 신원과 원가는 비공개로, 등급에 맞는 공급가만 표시돼요.' },
          ]),
        ]}
      />

      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-[#ECEEF1]">
        <div className="ur-content-wide mx-auto px-4 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WholesaleWordmark height={28} />
            <span className="text-xs text-[#B6BCC4] hidden sm:inline">B2B 도매몰</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <button onClick={() => navigate('/wholesale/login')} className="px-3 py-2 text-[#4E5560] hover:text-[#0C2454] font-medium">판매사 로그인</button>
            <button onClick={() => navigate('/supplier/login')} className="px-3 py-2 text-[#4E5560] hover:text-[#0C2454] font-medium hidden sm:inline">제조사 로그인</button>
          </div>
        </div>
      </header>

      {/* 히어로 */}
      <section className="ur-content-wide mx-auto px-4 lg:px-8 pt-14 pb-16 lg:pt-24 lg:pb-24 text-center">
        <span className="inline-block px-3 py-1 rounded-full bg-[#FC5424]/10 text-[#FC5424] text-xs font-bold mb-5">제조사 ↔ 판매사 직거래</span>
        <h1 className="text-3xl lg:text-5xl font-extrabold leading-tight tracking-tight">
          좋은 제품을 <span className="text-[#FC5424]">가장 좋은 공급가</span>로.<br />
          유통, 유통스타트에서 시작하세요.
        </h1>
        <p className="mt-5 text-base lg:text-lg text-[#4E5560] max-w-2xl mx-auto">
          제조사는 전국 유통 채널을, 판매사는 검증된 제품을 — 등급별 공급가·OEM 제작·위탁배송까지 한 곳에서.
          가입비·월 고정비 0원, 거래되는 만큼만.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button onClick={() => navigate('/wholesale/join')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[#FC5424] text-white font-bold text-[15px] hover:bg-[#E0461C] transition-colors">
            <Store className="w-5 h-5" /> 판매사로 가입하기 <ArrowRight className="w-4 h-4" />
          </button>
          <button onClick={() => navigate('/supplier/register')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[#0C2454] text-white font-bold text-[15px] hover:bg-[#2A2F37] transition-colors">
            <Factory className="w-5 h-5" /> 제조사로 입점하기 <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <p className="mt-4 text-xs text-[#B6BCC4]">가입 후 바로 카탈로그 열람 · 판매사는 가입 시 C등급 즉시 적용</p>
      </section>

      {/* 신뢰 지표 */}
      <section className="border-y border-[#ECEEF1] bg-[#F4F5F7]">
        <div className="ur-content-wide mx-auto px-4 lg:px-8 py-8 grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
          {[
            { n: '등급별', l: '공급가 (A·B·C·OEM)' },
            { n: 'OEM·ODM', l: '제조 매칭 지원' },
            { n: '엑셀', l: '대량 주문·송장 처리' },
            { n: '위탁배송', l: '제조사 직배송 연동' },
          ].map((s, i) => (
            <div key={i}>
              <div className="text-xl lg:text-2xl font-extrabold text-[#0C2454]">{s.n}</div>
              <div className="text-xs lg:text-sm text-[#4E5560] mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 작동 방식 */}
      <section className="ur-content-wide mx-auto px-4 lg:px-8 py-16 lg:py-20">
        <h2 className="text-2xl lg:text-3xl font-extrabold text-center mb-3">어떻게 작동하나요?</h2>
        <p className="text-center text-[#4E5560] mb-12">3단계면 충분합니다.</p>
        <div className="grid lg:grid-cols-3 gap-6">
          {[
            { icon: Layers, t: '1. 가입 & 등급 부여', d: '판매사는 가입 즉시 C등급으로 시작. 거래 실적에 따라 A·B 상향. 제조사는 상품을 등록(개별/엑셀 대량)합니다.' },
            { icon: TrendingDown, t: '2. 등급가로 주문', d: '판매사는 내 등급에 맞는 공급가만 보고 주문. 제조사 신원·원가는 비공개. 주문서 엑셀 업로드로 대량 주문도 간편.' },
            { icon: PackageCheck, t: '3. 직배송 & 정산', d: '제조사가 운송장 입력(엑셀 일괄 가능) → 직배송. 정산은 브랜드 익일 / 일반 7일. 세금계산서 자동.' },
          ].map((s, i) => (
            <div key={i} className="rounded-2xl border border-[#ECEEF1] p-6">
              <div className="w-11 h-11 rounded-xl bg-[#FC5424]/10 flex items-center justify-center mb-4">
                <s.icon className="w-6 h-6 text-[#FC5424]" />
              </div>
              <h3 className="font-bold text-lg mb-2">{s.t}</h3>
              <p className="text-sm text-[#4E5560] leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 제조사 vs 판매사 */}
      <section className="bg-[#F4F5F7] border-y border-[#ECEEF1]">
        <div className="ur-content-wide mx-auto px-4 lg:px-8 py-16 lg:py-20 grid lg:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-white border border-[#ECEEF1] p-7">
            <div className="flex items-center gap-2 mb-4"><Factory className="w-6 h-6 text-[#0C2454]" /><h3 className="text-xl font-extrabold">제조사라면</h3></div>
            <ul className="space-y-3 text-sm text-[#4E5560]">
              {['전국 판매사에게 한 번에 노출 — 영업 없이 판로 확대', '공급 범위 직접 설정 (전체공급 / 승인한 유통채널만)', '상품 대량등록·주문확인·송장 엑셀로 운영 간소화', '원가·신원은 판매사에 비공개 — 가격 교란 방지'].map((t, i) => (
                <li key={i} className="flex gap-2"><ShieldCheck className="w-4 h-4 text-[#FC5424] shrink-0 mt-0.5" />{t}</li>
              ))}
            </ul>
            <button onClick={() => navigate('/supplier/register')} className="mt-6 inline-flex items-center gap-1.5 text-[#FC5424] font-bold text-sm">제조사 입점 신청 <ArrowRight className="w-4 h-4" /></button>
          </div>
          <div className="rounded-2xl bg-white border border-[#ECEEF1] p-7">
            <div className="flex items-center gap-2 mb-4"><Store className="w-6 h-6 text-[#0C2454]" /><h3 className="text-xl font-extrabold">판매사라면</h3></div>
            <ul className="space-y-3 text-sm text-[#4E5560]">
              {['검증된 제조사 상품을 내 등급 공급가로 사입', '가입 즉시 C등급 — 실적 쌓이면 A·B 상향', 'OEM/ODM 신청 → 유통스타트가 제조사 매칭·생산 지원', '주문서·송장 엑셀로 대량 거래도 빠르게'].map((t, i) => (
                <li key={i} className="flex gap-2"><FileSpreadsheet className="w-4 h-4 text-[#FC5424] shrink-0 mt-0.5" />{t}</li>
              ))}
            </ul>
            <button onClick={() => navigate('/wholesale/join')} className="mt-6 inline-flex items-center gap-1.5 text-[#FC5424] font-bold text-sm">판매사 가입하기 <ArrowRight className="w-4 h-4" /></button>
          </div>
        </div>
      </section>

      {/* 마감 CTA */}
      <section className="ur-content-wide mx-auto px-4 lg:px-8 py-16 lg:py-24 text-center">
        <h2 className="text-2xl lg:text-3xl font-extrabold mb-4">지금 시작하세요</h2>
        <p className="text-[#4E5560] mb-8">가입비·월 고정비 없이, 오늘 바로 거래를 시작할 수 있습니다.</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button onClick={() => navigate('/wholesale/join')} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[#FC5424] text-white font-bold hover:bg-[#E0461C] transition-colors"><Store className="w-5 h-5" /> 판매사로 가입</button>
          <button onClick={() => navigate('/supplier/register')} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[#0C2454] text-white font-bold hover:bg-[#2A2F37] transition-colors"><Factory className="w-5 h-5" /> 제조사로 입점</button>
        </div>
      </section>

      <footer className="border-t border-[#ECEEF1] py-8 text-center text-xs text-[#B6BCC4]">
        © {new Date().getFullYear()} 유통스타트 (UtongStart) · B2B 도매 플랫폼
      </footer>
    </div>
  )
}
