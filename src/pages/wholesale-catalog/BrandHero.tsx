import { Check } from 'lucide-react'
import { WT } from '../wholesale/wholesale-theme'

// ── 서비스 정체성 히어로 ── (비로그인 시 '내 등급' 표현 없이 중립 카피)
export default function BrandHero({ loggedIn }: { loggedIn: boolean }) {
  const props = ['검증 제조사 직공급', loggedIn ? '내 등급 전용 공급가' : '등급별 도매 공급가', '익일·7일 정산']
  return (
    <div className="rounded-2xl overflow-hidden p-5 lg:p-7" style={{ background: WT.ink, color: '#fff' }}>
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: WT.brand }} />
        <span className="text-[12px] font-bold" style={{ color: '#C2C7CE' }}>유통스타트 도매몰 · 제조사–판매사 B2B 플랫폼</span>
      </div>
      <h2 className="font-extrabold tracking-[-0.02em] leading-[1.28] text-[21px] lg:text-[28px]">
        검증된 제조사 상품을<br />
        <span style={{ color: '#FF4D66' }}>{loggedIn ? '내 등급 공급가' : '도매 공급가'}</span>로 사입하세요
      </h2>
      <p className="mt-2.5 leading-relaxed text-[13px] lg:text-[14px]" style={{ color: '#A7AEB6' }}>
        제조사는 숨기고 가격은 투명하게 — 대량 사입에 최적화된 도매 전용 가격.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {props.map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap" style={{ background: 'rgba(255,255,255,0.09)', color: '#E5E8EB' }}>
            <Check className="w-3.5 h-3.5" style={{ color: '#37D699' }} />{t}
          </span>
        ))}
      </div>
    </div>
  )
}
