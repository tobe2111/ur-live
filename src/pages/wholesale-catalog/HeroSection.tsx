import { useNavigate } from 'react-router-dom'
import { Factory, ChevronRight, Lock } from 'lucide-react'
import { WT } from '../wholesale/wholesale-theme'
import BrandHero from './BrandHero'
import Dashboard from './Dashboard'

// 히어로 + 대시보드 + OEM — WholesaleCatalogPage 분해 (순수 추출, 동작 변화 0).
export default function HeroSection({ loggedIn, userSession, grade, me, monthSpend, orderCount, depositBalance, setGradeOpen }: {
  loggedIn: boolean
  userSession: boolean
  grade: string
  me: { grade: string; margin_pct: number; special_active: boolean; special_discount_until: string | null } | null
  monthSpend: number
  orderCount: number
  depositBalance: number
  setGradeOpen: (v: boolean) => void
}) {
  const navigate = useNavigate()
  return (
        <div className="pt-4 pb-5 space-y-3">
          <BrandHero loggedIn={loggedIn} />
          {loggedIn ? (
            <>
              <Dashboard grade={grade} marginPct={me?.margin_pct ?? 0} company="회원님" monthSpend={monthSpend} orderCount={orderCount} depositBalance={depositBalance} onGrade={() => setGradeOpen(true)} onCharge={() => navigate('/wholesale/deposits')} />
              {me?.special_active && me.special_discount_until && (
                <div className="px-4 py-3 rounded-2xl text-[13px] font-semibold" style={{ background: WT.brandSoft, color: WT.brand }}>
                  특별가 적용 중 — {new Date(me.special_discount_until).toLocaleDateString('ko-KR')}까지 최저 공급가로 구매할 수 있어요
                </div>
              )}
              <button onClick={() => navigate('/wholesale/oem')} className="w-full flex items-center gap-3.5 rounded-2xl p-4 text-left" style={{ border: '1px solid ' + WT.line, background: '#fff' }}>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ background: WT.fill }}><Factory className="w-5 h-5" style={{ color: WT.ink2 }} /></span>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-bold truncate" style={{ color: WT.ink }}>자사 브랜드 제품이 필요하세요?</div>
                  <div className="text-[12px] mt-0.5 truncate" style={{ color: WT.ink3 }}>OEM/ODM 제조사 연결·컨설팅 신청</div>
                </div>
                <ChevronRight className="w-5 h-5 shrink-0" style={{ color: WT.ink4 }} />
              </button>
            </>
          ) : userSession ? (
            // 카카오 로그인됨(일반 유저)이지만 아직 유통회원 아님 — 1탭 전환.
            <div className="flex items-center gap-3.5 rounded-2xl p-4" style={{ background: WT.ink }}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ background: 'rgba(255,255,255,0.12)' }}><Lock className="w-5 h-5 text-white" /></span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-bold text-white">카카오 계정으로 유통회원 신청하기</div>
                <div className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>사업자 정보만 입력하면 관리자 승인 후 등급 공급가로 사입 — 카카오 계정 그대로</div>
              </div>
              <button onClick={() => navigate('/wholesale/join')} className="shrink-0 rounded-xl px-4 py-2.5 text-[13px] font-bold" style={{ background: WT.brand, color: '#fff' }}>
                유통회원 신청
              </button>
            </div>
          ) : (
            // 비로그인: 가입 유도 배너 (도매가는 가입/로그인 후 노출)
            <div className="flex items-center gap-3.5 rounded-2xl p-4" style={{ background: WT.ink }}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ background: 'rgba(255,255,255,0.12)' }}><Lock className="w-5 h-5 text-white" /></span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-bold text-white">가입하면 등급 공급가가 보여요</div>
                <div className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>유통사 가입 즉시 C등급 공급가로 사입 시작 · 실적 쌓이면 A·B 상향</div>
              </div>
              <button onClick={() => navigate('/wholesale/join')} className="shrink-0 rounded-xl px-4 py-2.5 text-[13px] font-bold" style={{ background: WT.brand, color: '#fff' }}>가입하기</button>
            </div>
          )}
        </div>
  )
}
