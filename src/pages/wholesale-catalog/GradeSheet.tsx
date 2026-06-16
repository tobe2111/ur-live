import { X, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { WT, GRADE_NAME } from '../wholesale/wholesale-theme'

// ── 등급 안내 시트 ── (2026-06-15 대표 모델: 일반 / 플러스 / 프리미엄)
//   가입 형태로 구분 — 일반=승인 가입 / 플러스=연 구독 / 프리미엄=일정 매출 달성. 등급↑ = 더 낮은 공급가.
const GRADE_SHEET = [
  { name: '프리미엄', desc: '일정 매출 달성 회원 · 최저 공급가', margin: '마진 +10%' },
  { name: '플러스', desc: '연 구독제 회원 · 우대 공급가', margin: '마진 +15%' },
  { name: '일반', desc: '승인 후 가입한 회원 · 기본 공급가', margin: '마진 +20%' },
]
export default function GradeSheet({ current, onClose }: { current: string; onClose: () => void }) {
  const navigate = useNavigate()
  const currentName = GRADE_NAME[current] || current
  const code = (current || '').toUpperCase()
  const loggedIn = typeof window !== 'undefined' && !!localStorage.getItem('seller_token')
  // 플러스 자가 구독 동선 — 프리미엄(A) 이면 이미 최상위라 CTA 숨김.
  const go = () => { onClose(); navigate(loggedIn ? '/wholesale/dashboard' : '/wholesale/login') }
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center" style={{ background: 'rgba(20,22,28,0.4)' }} onClick={onClose}>
      <div className="w-full lg:max-w-md bg-white rounded-t-3xl lg:rounded-3xl p-5 pb-7" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[18px] font-extrabold" style={{ color: WT.ink }}>회원 등급별 공급가 안내</h3>
          <button onClick={onClose} aria-label="닫기"><X className="w-5 h-5" style={{ color: WT.ink3 }} /></button>
        </div>
        <div className="space-y-2">
          {GRADE_SHEET.map((g) => {
            const cur = currentName === g.name
            return (
              <div key={g.name} className="flex items-center gap-3 rounded-2xl p-3.5" style={cur ? { background: WT.brandSoft } : { background: WT.fill }}>
                <span className="inline-flex items-center justify-center rounded-full px-3 h-7 text-[12.5px] font-extrabold shrink-0 whitespace-nowrap"
                  style={cur ? { background: WT.brand, color: '#fff' } : { background: '#fff', color: WT.ink2, border: '1px solid ' + WT.line2 }}>{g.name}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-bold" style={{ color: cur ? WT.brand : WT.ink }}>{g.name} 회원{cur && ' · 현재'}</div>
                  <div className="text-[12px] mt-0.5" style={{ color: WT.ink3 }}>{g.desc}</div>
                </div>
                <span className="text-[12px] font-bold shrink-0" style={{ color: WT.ink2 }}>{g.margin}</span>
              </div>
            )
          })}
        </div>
        <p className="mt-4 text-[12px] leading-relaxed" style={{ color: WT.ink3 }}>
          <b style={{ color: WT.ink2 }}>플러스</b>는 예치금에서 연 구독료를 결제하면 바로 적용되고, <b style={{ color: WT.ink2 }}>프리미엄</b>은 일정 매출 달성 시 자동 전환됩니다.
        </p>
        {code !== 'A' && (
          <button onClick={go}
            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 h-12 rounded-xl text-white text-[14px] font-bold"
            style={{ background: WT.brand }}>
            <Sparkles className="w-4 h-4" /> {code === 'B' ? '플러스 연장하기' : loggedIn ? '플러스 구독하기' : '로그인하고 시작하기'}
          </button>
        )}
      </div>
    </div>
  )
}
