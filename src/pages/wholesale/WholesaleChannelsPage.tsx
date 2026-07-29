/**
 * 🏭 2026-06-16 (판매자·계정 시안 03 위탁·무재고 연동): /wholesale/channels
 *   무재고 위탁판매 허브 — 플로우 안내 + 채널(스마트스토어/쿠팡) 연결 상태 카드 + 카탈로그 CTA.
 *   실제 연결/내보내기는 기존 흐름 재사용: 스마트스토어=/wholesale/naver, 쿠팡=상품 상세 내보내기 모달.
 *   라이트 고정(WT) — dark: 없음.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ArrowRight, CheckCircle2, ShoppingBag, PackageCheck, Truck, Store } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { WT, comma } from './wholesale-theme'
import { WholesaleWordmark } from '@/pages/wholesale-catalog/WholesaleLogo'

interface ChannelStatus { connected: boolean; export_count?: number; last_export_at?: string | null }

const sellerAuth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('seller_token')}` } })

const FLOW = [
  { icon: ShoppingBag, title: '도매 상품 선택', sub: '카탈로그에서 사입' },
  { icon: Store, title: '마진 얹어 등록', sub: '내 스토어에 자동 등록' },
  { icon: PackageCheck, title: '주문 자동 발주', sub: '판매되면 도매몰 발주' },
  { icon: Truck, title: '제조사 직배송', sub: '소비자에게 바로' },
]

export default function WholesaleChannelsPage() {
  const navigate = useNavigate()
  const [naver, setNaver] = useState<ChannelStatus | null>(null)
  const [coupang, setCoupang] = useState<ChannelStatus | null>(null)

  useEffect(() => {
    if (!localStorage.getItem('seller_token')) { navigate('/wholesale/login'); return }
    api.get('/api/wholesale/naver/status', sellerAuth()).then(r => { if (r.data?.success) setNaver(r.data) }).catch(() => setNaver({ connected: false }))
    api.get('/api/wholesale/coupang/status', sellerAuth()).then(r => { if (r.data?.success) setCoupang(r.data) }).catch(() => setCoupang({ connected: false }))
  }, [navigate])

  const channels = [
    {
      key: 'naver', name: '스마트스토어', sub: '네이버 커머스API 연동', initial: 'N', accent: '#03C75A',
      status: naver, onConnect: () => navigate('/wholesale/naver'),
      connectLabel: '연결 관리', notConnectLabel: '연결하기',
    },
    {
      key: 'coupang', name: '쿠팡', sub: '윙 오픈마켓 내보내기', initial: 'C', accent: '#FF6F2C',
      status: coupang, onConnect: () => navigate('/wholesale'),
      connectLabel: '내보내기', notConnectLabel: '상품에서 연결',
    },
    {
      key: 'gmarket', name: '지마켓·11번가', sub: '곧 지원 예정', initial: 'G', accent: WT.ink3,
      status: { connected: false } as ChannelStatus, onConnect: () => {}, soon: true,
      connectLabel: '준비 중', notConnectLabel: '준비 중',
    },
  ]

  return (
    <div className="min-h-[100dvh] pb-20" style={{ background: WT.fill }}>
      <SEO title="채널 연동 — 유통스타트" description="무재고 위탁판매로 도매 상품을 내 스마트스토어·쿠팡에 등록하세요" url="/wholesale/channels" noindex />

      {/* 로고 브레드크럼 헤더 */}
      <header className="sticky top-0 z-30" style={{ background: '#fff', borderBottom: '1px solid ' + WT.line }}>
        <div className="ur-content-wide px-5 lg:px-8 flex items-center gap-3 h-14">
          <button onClick={() => navigate('/wholesale')} aria-label="도매몰 홈" className="shrink-0">
            <WholesaleWordmark height={26} />
          </button>
          <ChevronRight className="w-4 h-4 shrink-0" style={{ color: WT.ink4 }} />
          <span className="text-[14px] font-bold" style={{ color: WT.ink }}>채널 연동</span>
        </div>
      </header>

      <main className="ur-content-wide px-5 lg:px-8 pt-6 space-y-6">
        {/* 타이틀 */}
        <div>
          <h1 className="text-[22px] lg:text-[24px] font-extrabold tracking-[-0.02em]" style={{ color: WT.ink }}>무재고 위탁판매 연동</h1>
          <p className="text-[13.5px] mt-1.5 leading-relaxed max-w-2xl" style={{ color: WT.ink3 }}>
            도매몰 상품을 내 스마트스토어·쿠팡에 <b style={{ color: WT.ink }}>마진만 얹어 등록</b>하세요. 주문이 들어오면 도매몰에 발주되고, 제조사가 소비자에게 직배송합니다.
          </p>
        </div>

        {/* 플로우 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-3">
          {FLOW.map((f, i) => (
            <div key={f.title} className="relative rounded-xl bg-white p-4" style={{ border: '1px solid ' + WT.line2 }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0" style={{ background: WT.brandSoft }}>
                  <f.icon className="w-4 h-4" style={{ color: WT.brand }} />
                </span>
                <span className="text-[11px] font-bold" style={{ color: WT.brand }}>STEP {i + 1}</span>
              </div>
              <div className="text-[13.5px] font-bold" style={{ color: WT.ink }}>{f.title}</div>
              <div className="text-[11.5px] mt-0.5" style={{ color: WT.ink4 }}>{f.sub}</div>
              {i < FLOW.length - 1 && (
                <ArrowRight className="hidden lg:block absolute -right-[11px] top-1/2 -translate-y-1/2 w-4 h-4 z-10" style={{ color: WT.ink4 }} />
              )}
            </div>
          ))}
        </div>

        {/* 채널 카드 */}
        <section>
          <h2 className="text-[16px] font-extrabold mb-3" style={{ color: WT.ink }}>판매 채널</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {channels.map((ch) => {
              const connected = !!ch.status?.connected
              return (
                <div key={ch.key} className="rounded-2xl bg-white p-4" style={{ border: '1px solid ' + WT.line2 }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl text-white text-[15px] font-extrabold shrink-0" style={{ background: ch.accent }}>{ch.initial}</span>
                    {ch.soon ? (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: WT.fill, color: WT.ink3 }}>준비 중</span>
                    ) : connected ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: '#E3F6EC', color: WT.pos }}>
                        <CheckCircle2 className="w-3 h-3" /> 연결됨
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: WT.brandSoft, color: WT.brand }}>미연결</span>
                    )}
                  </div>
                  <div className="text-[15px] font-bold" style={{ color: WT.ink }}>{ch.name}</div>
                  <div className="text-[12px] mt-0.5" style={{ color: WT.ink3 }}>
                    {connected && ch.status?.export_count != null ? `내보낸 상품 ${comma(ch.status.export_count)}개` : ch.sub}
                  </div>
                  <button
                    onClick={ch.onConnect}
                    disabled={ch.soon}
                    className="mt-3.5 w-full h-10 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50"
                    style={connected
                      ? { background: '#fff', color: WT.ink, border: '1px solid ' + WT.line2 }
                      : { background: ch.soon ? WT.fill : WT.brand, color: ch.soon ? WT.ink3 : '#fff' }}
                  >
                    {connected ? ch.connectLabel : ch.notConnectLabel}
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        {/* 카탈로그 CTA */}
        <section className="rounded-2xl p-5 lg:p-6 flex flex-col sm:flex-row sm:items-center gap-4" style={{ background: WT.ink }}>
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] font-extrabold text-white">어떤 상품을 등록할까요?</h3>
            <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
              카탈로그에서 상품을 고르고 상세 페이지의 <b className="text-white">"스마트스토어/쿠팡으로 내보내기"</b> 버튼으로 판매가·재고만 정하면 끝.
            </p>
          </div>
          <button onClick={() => navigate('/wholesale')} className="shrink-0 inline-flex items-center justify-center gap-1.5 h-11 px-5 rounded-xl text-[13.5px] font-bold text-white" style={{ background: WT.brand }}>
            카탈로그에서 상품 고르기 <ArrowRight className="w-4 h-4" />
          </button>
        </section>
      </main>
    </div>
  )
}
