import { X } from 'lucide-react'
import { WT, GRADE_LABEL } from '../wholesale/wholesale-theme'

// ── 등급 안내 시트 ──
const GRADE_SHEET = [
  { g: '특별가', mark: '★', desc: '임박·덤핑 전용 · 관리자 선정 회원만', margin: '개별 책정', special: true },
  { g: 'A', mark: 'A', desc: '최저 공급가 · 월 5,000만원↑', margin: '마진 +10%' },
  { g: 'B', mark: 'B', desc: '우대 공급가 · 월 1,500만원↑', margin: '마진 +15%' },
  { g: 'C', mark: 'C', desc: '기본 공급가 · 신규/일반 회원', margin: '마진 +20%' },
]
export default function GradeSheet({ current, onClose }: { current: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center" style={{ background: 'rgba(20,22,28,0.4)' }} onClick={onClose}>
      <div className="w-full lg:max-w-md bg-white rounded-t-3xl lg:rounded-3xl p-5 pb-7" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[18px] font-extrabold" style={{ color: WT.ink }}>등급별 공급가 안내</h3>
          <button onClick={onClose} aria-label="닫기"><X className="w-5 h-5" style={{ color: WT.ink3 }} /></button>
        </div>
        <div className="space-y-2">
          {GRADE_SHEET.map((g) => {
            const cur = (GRADE_LABEL[current] || current) === g.g
            return (
              <div key={g.g} className="flex items-center gap-3 rounded-2xl p-3.5" style={cur ? { background: WT.brandSoft } : { background: WT.fill }}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-extrabold shrink-0"
                  style={g.special ? { background: WT.ink, color: '#fff' } : cur ? { background: WT.brand, color: '#fff' } : { background: '#fff', color: WT.ink2 }}>{g.mark}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-bold" style={{ color: cur ? WT.brand : WT.ink }}>{g.g}등급{cur && ' · 현재'}</div>
                  <div className="text-[12px] mt-0.5" style={{ color: WT.ink3 }}>{g.desc}</div>
                </div>
                <span className="text-[12px] font-bold shrink-0" style={{ color: WT.ink2 }}>{g.margin}</span>
              </div>
            )
          })}
        </div>
        <p className="mt-4 text-[12px] leading-relaxed" style={{ color: WT.ink3 }}>
          더 좋은 공급가가 필요하면 관리자에게 등급 상향을 문의하세요. 월 사입액 기준으로 자동 검토됩니다.
        </p>
      </div>
    </div>
  )
}
