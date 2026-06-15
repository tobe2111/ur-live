import { useNavigate } from 'react-router-dom'
import { Factory, ChevronRight, Lock } from 'lucide-react'
import { WT, won } from '../wholesale/wholesale-theme'
import { cfImage } from '@/utils/cf-image'
import Dashboard from './Dashboard'
import type { CatalogItem } from './types'

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
  const joinCta = userSession ? '카카오 계정으로 신청' : '유통회원 신청'
  return (
    <div className="pt-4 pb-1 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
      {/* 좌 — 트러스트 히어로 (다크 그라데이션, 깨질 이미지 없음) */}
      <div className="relative rounded-2xl overflow-hidden min-h-[244px] lg:min-h-[290px] flex" style={{ background: 'linear-gradient(105deg,#15171C 0%,#1E222B 52%,#2C3340 100%)' }}>
        <div className="relative p-6 lg:p-9 flex flex-col justify-center text-white lg:max-w-[560px]">
          <div className="inline-flex self-start items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold mb-4" style={{ background: 'rgba(255,255,255,0.14)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: WT.brand }} />사업자 인증 회원 전용
          </div>
          <h2 className="font-extrabold leading-[1.22]" style={{ fontSize: 'clamp(22px,3.2vw,33px)', letterSpacing: '-0.03em' }}>
            검증된 제조사 상품을<br /><span style={{ color: WT.inkPink }}>도매 공급가</span>로 사입하세요
          </h2>
          <p className="mt-3 text-[13.5px] lg:text-[14.5px] leading-relaxed" style={{ color: '#D4D7DC' }}>공급사는 가리고 가격은 투명하게. 재고·자금 0원으로 시작하는 무재고 B2B 사입.</p>
          <div className="flex flex-wrap gap-2.5 mt-5">
            <button onClick={() => navigate('/wholesale/join')} className="rounded-[10px] px-5 py-3 text-[14px] lg:text-[14.5px] font-bold text-white" style={{ background: WT.brand }}>{joinCta}</button>
            <button onClick={() => navigate('/wholesale/best')} className="rounded-[10px] px-5 py-3 text-[14px] lg:text-[14.5px] font-bold text-white" style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.28)' }}>공급가 둘러보기</button>
          </div>
        </div>
      </div>

      {/* 우 — 추천 상품(가입 유도). 공급가는 비노출(도메인 규칙) → '가입하면 공개'. */}
      {featured ? (
        <button onClick={() => navigate(`/wholesale/product/${featured.id}`)} className="text-left rounded-2xl p-4 flex flex-col bg-white" style={{ border: '1px solid ' + WT.line2 }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] font-extrabold" style={{ color: WT.ink }}>⚡ 오늘의 추천</span>
            <span className="text-[11px] font-bold rounded-md px-2 py-1 text-white" style={{ background: WT.ink }}>가입 혜택</span>
          </div>
          <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '16/11', background: WT.fill }}>
            {featured.image_url && <img src={cfImage(featured.image_url, { width: 500, format: 'auto' }) || featured.image_url} alt={featured.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />}
          </div>
          <div className="text-[14px] font-medium mt-3 leading-snug line-clamp-2" style={{ color: WT.ink }}>{featured.name}</div>
          {featured.retail_price ? (
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-[12px] line-through tabular-nums" style={{ color: WT.ink4 }}>{won(featured.retail_price)}</span>
              <span className="text-[11px]" style={{ color: WT.ink3 }}>권장소비자가</span>
            </div>
          ) : null}
          <div className="mt-2 inline-flex items-center gap-1 self-start rounded-md px-2.5 py-1 text-[12px] font-bold" style={{ background: WT.brandSoft, color: WT.brand }}><Lock className="w-3 h-3" />가입하면 도매 공급가 공개</div>
          <div className="mt-3 rounded-[10px] py-2.5 text-center text-[14px] font-bold text-white" style={{ background: WT.brand }}>공급가 보러가기</div>
        </button>
      ) : (
        <div className="rounded-2xl p-6 flex flex-col justify-center gap-2 bg-white" style={{ border: '1px solid ' + WT.line2 }}>
          <span className="text-[12px] font-extrabold" style={{ color: WT.brand }}>가입 혜택</span>
          <div className="text-[17px] font-extrabold leading-snug" style={{ color: WT.ink }}>가입 즉시 C등급<br />도매 공급가 공개</div>
          <p className="text-[12.5px] leading-relaxed" style={{ color: WT.ink3 }}>실적이 쌓이면 B·A등급으로 더 낮은 공급가. 재고·자금 0원으로 시작하세요.</p>
          <button onClick={() => navigate('/wholesale/join')} className="mt-2 rounded-[10px] py-2.5 text-center text-[14px] font-bold text-white" style={{ background: WT.brand }}>{joinCta}</button>
        </div>
      )}
    </div>
  )
}
