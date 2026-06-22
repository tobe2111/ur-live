import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Factory, ChevronRight, Lock } from 'lucide-react'
import { WT, won, discountRate } from '../wholesale/wholesale-theme'
import { cfImage } from '@/utils/cf-image'
import { WHOLESALE_HERO_IMG } from './HomeSections'
import Dashboard from './Dashboard'
import type { CatalogItem } from './types'

// ⏱️ 오늘의 마감임박 특가 — 자정까지 남은 시간 카운트다운(격리 컴포넌트 → 배지만 1초마다 갱신).
function CountdownBadge() {
  const msLeft = () => { const n = new Date(); const end = new Date(n); end.setHours(24, 0, 0, 0); return Math.max(0, end.getTime() - n.getTime()) }
  const [ms, setMs] = useState(msLeft)
  useEffect(() => { const id = setInterval(() => setMs(msLeft()), 1000); return () => clearInterval(id) }, [])
  const pad = (n: number) => String(n).padStart(2, '0')
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000)
  return <span className="text-[11.5px] font-extrabold rounded-md px-2 py-1 text-white tabular-nums" style={{ background: WT.ink }}>{pad(h)}:{pad(m)}:{pad(s)}</span>
}

// 히어로 + 대시보드 + OEM — 2026-06-15 시안 리디자인(유통스타트 도매몰.dc.html).
//   로그인 사입자 = 슬림 사입 대시보드(기존). 비로그인/카카오 = 2단 트러스트 히어로 + 추천 상품(가입 유도).
export default function HeroSection({ loggedIn, userSession, grade, me, monthSpend, orderCount, depositBalance, setGradeOpen, featured }: {
  loggedIn: boolean
  userSession: boolean
  grade: string
  me: { grade: string; margin_pct: number; special_active: boolean; special_discount_until: string | null } | null
  monthSpend: number
  orderCount: number
  depositBalance: number
  setGradeOpen: (v: boolean) => void
  featured?: CatalogItem | null
}) {
  const navigate = useNavigate()

  // ── 로그인 사입자 — 슬림 대시보드(기존 유지) ──
  if (loggedIn) {
    return (
      <div className="pt-4 pb-5 space-y-3">
        <Dashboard grade={grade} marginPct={me?.margin_pct ?? 0} company="회원님" monthSpend={monthSpend} orderCount={orderCount} depositBalance={depositBalance} onGrade={() => setGradeOpen(true)} onCharge={() => navigate('/wholesale/deposits')} />
        {me?.special_active && me.special_discount_until && (
          <div className="px-4 py-3 rounded-2xl text-[13px] font-semibold" style={{ background: WT.brandSoft, color: WT.brand }}>
            특별가 적용 중 — {new Date(me.special_discount_until).toLocaleDateString('ko-KR')}까지 최저 공급가로 구매할 수 있어요
          </div>
        )}
        <button onClick={() => navigate('/wholesale/oem')} className="w-full flex items-center gap-3.5 rounded-2xl p-4 text-left" style={{ border: '1px solid ' + WT.line2, background: '#fff' }}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ background: WT.fill }}><Factory className="w-5 h-5" style={{ color: WT.ink2 }} /></span>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold truncate" style={{ color: WT.ink }}>자사 브랜드 제품이 필요하세요?</div>
            <div className="text-[12px] mt-0.5 truncate" style={{ color: WT.ink3 }}>OEM/ODM 제조사 연결·컨설팅 신청</div>
          </div>
          <ChevronRight className="w-5 h-5 shrink-0" style={{ color: WT.ink4 }} />
        </button>
      </div>
    )
  }

  // ── 비로그인/카카오 — 2단 트러스트 히어로 (시안) ──
  const joinCta = userSession ? '카카오 계정으로 신청' : '유통사 신청'
  return (
    <div className="pt-4 pb-1">
      {/* 🧹 2026-06-17 (시안): 단일 배너(제품/플랫폼 공지용) — 2단 그리드·우측 마감임박 카드 삭제 */}
      <div className="relative rounded-2xl overflow-hidden min-h-[244px] lg:min-h-[290px] flex" style={{ background: '#0C2454' }}>
        <img src={WHOLESALE_HERO_IMG} alt="" aria-hidden fetchPriority="high" decoding="async" onError={(e) => { e.currentTarget.style.display = 'none' }} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg, rgba(21,23,28,0.92) 0%, rgba(21,23,28,0.72) 48%, rgba(21,23,28,0.20) 100%)' }} />
        <div className="relative p-6 lg:p-9 flex flex-col justify-center text-white lg:max-w-[560px]">
          <div className="inline-flex self-start items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold mb-4" style={{ background: 'rgba(255,255,255,0.14)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: WT.brand }} />사업자 인증 회원 전용
          </div>
          <h2 className="font-extrabold leading-[1.22]" style={{ fontSize: 'clamp(22px,3.2vw,33px)', letterSpacing: '-0.03em' }}>
            검증된 제조사 상품을<br /><span style={{ color: WT.inkPink }}>도매 공급가</span>로 사입하세요
          </h2>
          <p className="mt-3 text-[13.5px] lg:text-[14.5px] leading-relaxed" style={{ color: '#D4D7DC' }}>제조사는 가리고 가격은 투명하게. 재고·자금 0원으로 시작하는 무재고 B2B 사입.</p>
          {/* 🧹 2026-06-17 (시안): 히어로 CTA 버튼 삭제 — 배너는 제품/플랫폼 공지 용도 */}
        </div>
      </div>
    </div>
  )
}
