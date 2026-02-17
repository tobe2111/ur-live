import { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { ArrowRight, ShoppingBag, Heart, MessageCircle, Share2 } from 'lucide-react'

interface GripFrameLayoutProps {
  children: ReactNode
}

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-50">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-50" />
      LIVE
    </span>
  )
}

function ChatMessage({
  name,
  message,
  highlight,
}: {
  name: string
  message: string
  highlight?: boolean
}) {
  return (
    <div className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-[11px] ${highlight ? "bg-primary/20" : ""}`}>
      <span className="shrink-0 font-semibold" style={{ color: 'hsl(0, 85%, 55%)' }}>{name}</span>
      <span className="text-foreground/80">{message}</span>
    </div>
  )
}

export default function GripFrameLayout({ children }: GripFrameLayoutProps) {
  const location = useLocation()
  const isIntroducePage = location.pathname === '/introduce'
  
  return (
    <>
      {/* Desktop Only: New minimalist design */}
      <div className="hidden lg:block">
        <main className="relative flex min-h-screen flex-col overflow-hidden" style={{ backgroundColor: 'hsl(0, 0%, 0%)' }}>
          {/* Navigation - Ultra Minimal */}
          <nav className="relative z-30 flex items-center justify-between px-6 py-4 lg:px-16">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold uppercase tracking-[0.2em]" style={{ color: 'hsl(0, 0%, 96%)' }}>
                UR TEAM
              </span>
              <span className="text-[10px] font-light uppercase tracking-[0.15em]" style={{ color: 'hsl(0, 0%, 96%, 0.3)' }}>
                LIVE
              </span>
            </div>
            <div className="hidden items-center gap-10 md:flex">
              <a href="#" className="text-[11px] font-medium uppercase tracking-[0.15em] transition-colors" style={{ color: 'hsl(0, 0%, 96%, 0.3)' }}>
                서비스
              </a>
              <a href="#" className="text-[11px] font-medium uppercase tracking-[0.15em] transition-colors" style={{ color: 'hsl(0, 0%, 96%, 0.3)' }}>
                파트너
              </a>
              <a href="#" className="text-[11px] font-medium uppercase tracking-[0.15em] transition-colors" style={{ color: 'hsl(0, 0%, 96%, 0.3)' }}>
                회사소개
              </a>
              <a href="#" className="text-[11px] font-medium uppercase tracking-[0.15em] transition-colors" style={{ color: 'hsl(0, 0%, 96%, 0.3)' }}>
                문의하기
              </a>
            </div>
          </nav>

          {/* Hero Section - Full screen fill */}
          <section className="relative z-10 mx-auto flex flex-1 max-w-7xl flex-col items-center gap-4 px-6 lg:flex-row lg:items-center lg:gap-16 lg:px-16">
            {/* Left Side: Branding */}
            <div className="relative z-10 flex-1">
              <div className="flex flex-col justify-center gap-8 py-4 lg:py-0">
                {/* Micro-label */}
                <div className="flex items-center gap-3">
                  <span className="h-px w-8" style={{ backgroundColor: 'hsl(0, 85%, 55%)' }} />
                  <span className="text-[10px] font-medium uppercase tracking-[0.25em]" style={{ color: 'hsl(0, 85%, 55%)' }}>
                    LIVE COMMERCE
                  </span>
                </div>

                {/* Hero Headline - Oversized, High-Fashion */}
                <div className="flex flex-col gap-2">
                  <h1 className="text-balance text-5xl font-black uppercase leading-[0.95] tracking-wider md:text-6xl lg:text-7xl" style={{ color: 'hsl(0, 0%, 96%)' }}>
                    <span className="block">LIVE NOW:</span>
                    <span className="block" style={{ color: 'hsl(0, 0%, 96%, 0.2)' }}>쇼핑의</span>
                    <span className="block" style={{ color: 'hsl(0, 0%, 96%, 0.2)' }}>새로운 물결</span>
                  </h1>
                </div>

                {/* Subline */}
                <p className="max-w-md text-sm font-light leading-relaxed tracking-wide" style={{ color: 'hsl(0, 0%, 96%, 0.4)' }}>
                  실시간 소통으로 판매하고, 인터랙티브한 쇼핑 경험으로 구매하세요.
                  <br />
                  Sell faster. Buy smarter. All live.
                </p>

                {/* CTA - Single Electric Red button */}
                <div className="flex items-center gap-6">
                  <button className="group inline-flex animate-pulse-glow items-center gap-3 rounded-full px-8 py-3.5 text-xs font-bold uppercase tracking-[0.15em] transition-all hover:scale-[1.03]" style={{ backgroundColor: 'hsl(0, 85%, 55%)', color: 'hsl(0, 0%, 100%)' }}>
                    회사소개서 보기
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right Side: Mobile Frame */}
            <div className="relative flex flex-1 items-center justify-center">
              <div className="relative flex items-center justify-center">
                {/* Phone Frame - White border, larger size */}
                <div className="relative w-[330px] overflow-hidden rounded-[44px] border-[6px] border-white/90 bg-black md:w-[360px]">
                  {/* Notch / Dynamic Island */}
                  <div className="absolute left-1/2 top-3 z-30 h-[24px] w-[100px] -translate-x-1/2 rounded-full bg-black" />

                  {/* Screen Content */}
                  <div className="relative aspect-[9/19.5] w-full overflow-hidden" style={{ backgroundColor: 'hsl(0, 0%, 6%)' }}>
                    {isIntroducePage ? (
                      // introduce 페이지일 때는 메인 페이지를 iframe으로 표시
                      <iframe
                        src="/"
                        title="UR Live Main"
                        className="w-full h-full border-0"
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                      />
                    ) : (
                      // 다른 페이지는 live 시뮬레이션 표시
                      <>
                        {/* Video Area - Simulated live stream background */}
                        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(220,30%,12%)] via-[hsl(0,0%,8%)] to-[hsl(0,0%,4%)]">
                          {/* Simulated product showcase area */}
                          <div className="absolute inset-x-0 top-0 flex h-[55%] items-center justify-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <ShoppingBag className="h-10 w-10" style={{ color: 'hsl(0, 85%, 55%)' }} />
                              </div>
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-xs font-medium" style={{ color: 'hsl(0, 0%, 96%, 0.7)' }}>프리미엄 뷰티 세트</span>
                                <span className="text-lg font-bold" style={{ color: 'hsl(0, 0%, 96%)' }}>₩49,900</span>
                                <span className="text-[10px] line-through" style={{ color: 'hsl(0, 0%, 55%)' }}>₩89,000</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Top Overlay - Live info */}
                        <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between bg-gradient-to-b from-black/80 to-transparent px-4 pb-8 pt-12">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold" style={{ color: 'hsl(0, 85%, 55%)' }}>
                              UR
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-semibold" style={{ color: 'hsl(0, 0%, 96%, 0.9)' }}>UR Team 공식</span>
                              <span className="text-[9px]" style={{ color: 'hsl(0, 0%, 96%, 0.5)' }}>시청자 2,847명</span>
                            </div>
                          </div>
                          <LiveBadge />
                        </div>

                        {/* Right Side Actions */}
                        <div className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-5">
                          {[
                            { icon: Heart, label: "3.2K", active: true },
                            { icon: MessageCircle, label: "847" },
                            { icon: Share2, label: "Share" },
                          ].map((action) => (
                            <button
                              key={action.label}
                              className="flex flex-col items-center gap-1"
                            >
                              <div className={`flex h-9 w-9 items-center justify-center rounded-full ${action.active ? "bg-red-500/20 text-red-400" : "bg-foreground/10"}`} style={!action.active ? { color: 'hsl(0, 0%, 96%, 0.6)' } : {}}>
                                <action.icon className="h-4 w-4" />
                              </div>
                              <span className="text-[9px]" style={{ color: 'hsl(0, 0%, 96%, 0.5)' }}>
                                {action.label}
                              </span>
                            </button>
                          ))}
                        </div>

                        {/* Bottom Section - Chat & Product */}
                        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pb-4 pt-16">
                          {/* Chat messages */}
                          <div className="flex flex-col gap-1">
                            <ChatMessage name="민지" message="이거 색감 진짜 예뻐요!" />
                            <ChatMessage name="수현" message="할인 언제까지에요?" highlight />
                            <ChatMessage name="지우" message="배송 빠른가요?" />
                          </div>

                          {/* Product CTA */}
                          <div className="flex items-center gap-2 rounded-xl bg-foreground/10 p-2.5 backdrop-blur-sm">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/20">
                              <ShoppingBag className="h-5 w-5" style={{ color: 'hsl(0, 85%, 55%)' }} />
                            </div>
                            <div className="flex flex-1 flex-col gap-0.5">
                              <span className="text-[10px] font-medium" style={{ color: 'hsl(0, 0%, 96%, 0.8)' }}>프리미엄 뷰티 세트</span>
                              <span className="text-xs font-bold" style={{ color: 'hsl(0, 85%, 55%)' }}>₩49,900</span>
                            </div>
                            <button className="rounded-lg px-3 py-1.5 text-[10px] font-bold" style={{ backgroundColor: 'hsl(0, 85%, 55%)', color: 'hsl(0, 0%, 100%)' }}>
                              구매하기
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="relative z-10 border-t px-6 py-6 lg:px-16" style={{ borderColor: 'hsl(0, 0%, 96%, 0.04)' }}>
            <div className="mx-auto max-w-7xl">
              <div className="flex flex-col gap-2 text-center" style={{ fontSize: '7px', lineHeight: '1.6' }}>
                <p style={{ color: 'hsl(0, 0%, 96%, 0.3)' }}>
                  <a href="mailto:jiwon@ur-team.com" className="transition-colors" style={{ color: 'hsl(0, 0%, 96%, 0.4)' }}>
                    제휴 | 입점 문의 : jiwon@ur-team.com
                  </a>
                </p>
                <p style={{ color: 'hsl(0, 0%, 96%, 0.3)' }}>
                  <a href="/terms" className="transition-colors">서비스 이용약관</a>
                  <span style={{ color: 'hsl(0, 0%, 96%, 0.15)' }}> | </span>
                  <a href="/privacy" className="transition-colors">개인정보처리방침</a>
                  <span style={{ color: 'hsl(0, 0%, 96%, 0.15)' }}> | </span>
                  <a href="/refund" className="transition-colors">배송 및 환불 정책</a>
                </p>
                <p style={{ color: 'hsl(0, 0%, 96%, 0.2)' }}>
                  상호명: 리스터코퍼레이션 | 대표자: 정지원
                </p>
                <p style={{ color: 'hsl(0, 0%, 96%, 0.2)' }}>
                  사업자등록번호: 479-09-02930 | 통신판매업신고: 2025-부산금정-0540
                </p>
                <p style={{ color: 'hsl(0, 0%, 96%, 0.2)' }}>
                  사업장주소: 부산광역시 금정구 놀이마당로26 1402
                </p>
                <p style={{ color: 'hsl(0, 0%, 96%, 0.2)' }}>
                  대표전화: 0507-0177-0432 | 대표이메일: jiwon@ur-team.com
                </p>
                <p style={{ color: 'hsl(0, 0%, 96%, 0.2)' }}>
                  서비스 제공 기간: 상품 구매 후 평균 7일 이내 배송 완료
                </p>
                <p className="mt-1" style={{ color: 'hsl(0, 0%, 96%, 0.15)' }}>
                  © 2026 리스터코퍼레이션. All rights reserved.
                </p>
              </div>
            </div>
          </footer>
        </main>
      </div>

      {/* Mobile: Full Screen (No Frame) */}
      <div className="lg:hidden w-full min-h-screen">
        {children}
      </div>
    </>
  )
}
