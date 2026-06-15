// ──────────────────────────────────────────────────────────────
// 🏭 2026-06-15 도매몰 리디자인 (Claude Design 핸드오프 — 유통스타트 도매몰.dc.html)
//   신뢰 신호 바(4종) + 제조사 입점 CTA 배너. "AI 티"의 핵심(의미없는 통계 슬롭)을
//   검증 가능한 신뢰 신호(사업자 인증·에스크로·세금계산서·무재고)로 대체.
// ──────────────────────────────────────────────────────────────
import { ShieldCheck, Lock, ReceiptText, Truck } from 'lucide-react'
import { WT } from '../wholesale/wholesale-theme'

// 시안(유통스타트 도매몰.dc.html) 히어로/CTA 배경 사진 — 창고 직거래.
//   CSP img-src https: 허용. 로드 실패 시 onError 로 숨겨 다크 베이스(#15171C)로 폴백 → 절대 깨짐 0.
export const WHOLESALE_HERO_IMG = 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=1280&q=72&auto=format&fit=crop'

const SIGNALS = [
  { Icon: ShieldCheck, title: '사업자 인증 회원제', short: '사업자 인증제', sub: '관리자 승인 후 거래' },
  { Icon: Lock, title: 'KCP 에스크로 안전거래', short: '에스크로 안전', sub: '예치금 충전·차감 결제' },
  { Icon: ReceiptText, title: '전자세금계산서 자동', short: '세금계산서 자동', sub: '거래명세서 즉시 발행' },
  { Icon: Truck, title: '무재고 위탁배송', short: '무재고 배송', sub: '제조사가 소비자에 직배송' },
] as const

// ── 신뢰 신호 바 ── (시안: 4셀 보더 스트립, 모바일은 아이콘+짧은 라벨)
export function TrustBar() {
  return (
    <div className="flex items-stretch rounded-xl overflow-hidden" style={{ border: '1px solid ' + WT.line2, background: WT.trustBg }}>
      {SIGNALS.map((s, i) => (
        <div key={s.title}
          className="flex-1 flex flex-col lg:flex-row items-center gap-1.5 lg:gap-3 px-2 lg:px-4 py-3 lg:py-[15px] text-center lg:text-left"
          style={i ? { borderLeft: '1px solid ' + WT.line } : {}}>
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] shrink-0" style={{ background: '#fff', border: '1px solid ' + WT.line2, color: WT.ink }}>
            <s.Icon className="w-[18px] h-[18px]" strokeWidth={1.7} />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] lg:text-[13px] font-bold leading-tight" style={{ color: WT.ink }}>
              <span className="lg:hidden">{s.short}</span><span className="hidden lg:inline">{s.title}</span>
            </div>
            <div className="hidden lg:block text-[11.5px] mt-[3px]" style={{ color: WT.ink3 }}>{s.sub}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── 제조사 입점 CTA 배너 ── (시안: 다크 그라데이션 + 흰 버튼)
export function SupplierCTA({ onApply }: { onApply: () => void }) {
  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ background: '#15171C' }}>
      <img src={WHOLESALE_HERO_IMG} alt="" aria-hidden onError={(e) => { e.currentTarget.style.display = 'none' }} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(21,23,28,0.93) 30%, rgba(21,23,28,0.55) 100%)' }} />
      <div className="relative px-6 lg:px-9 py-6 lg:py-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-white">
        <div>
          <div className="text-[12px] font-bold mb-2" style={{ color: WT.inkPink }}>제조사이신가요?</div>
          <div className="text-[18px] lg:text-[21px] font-extrabold leading-snug" style={{ letterSpacing: '-0.02em' }}>
            재고·영업 부담 없이 새 판로를 — <span style={{ color: WT.inkPink }}>무재고 드랍쉽</span>으로 시작하세요
          </div>
          <div className="text-[13px] lg:text-[13.5px] mt-2" style={{ color: '#C9CCD2' }}>신원·거래처는 비공개. 주문은 송장만 입력, 정산은 안전·빠르게.</div>
        </div>
        <button onClick={onApply} className="shrink-0 self-start sm:self-auto rounded-[10px] px-5 lg:px-6 py-3 lg:py-3.5 text-[14px] lg:text-[14.5px] font-extrabold whitespace-nowrap" style={{ background: '#fff', color: WT.ink }}>
          제조사 입점 신청 ›
        </button>
      </div>
    </div>
  )
}
