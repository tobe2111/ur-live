// 🧱 2026-06-29 TD: MyVouchersPage god 파일 분해 — 빈 상태/스켈레톤/티켓 일러스트(verbatim 추출). 동작 불변.
//   TicketShape·WalletEmptyGlyph 는 모듈 내부 전용, WalletSkeleton·EmptyVouchers 만 페이지가 사용.
import { Fragment } from 'react'
import { ArrowRight } from 'lucide-react'

function TicketShape({ className, strokeWidth = 2.2, variant, faded }: {
  className?: string
  strokeWidth?: number
  variant: 'gb' | 'gift'
  faded?: boolean
}) {
  return (
    <svg viewBox="0 0 140 96" fill="none" className={className} aria-hidden>
      {/* 티켓 본체: 상·하단 천공 노치 + 라운드 코너 */}
      <path
        d="M16 8 L87 8 A9 9 0 0 0 105 8 L124 8 A12 12 0 0 1 136 20 L136 76 A12 12 0 0 1 124 88 L105 88 A9 9 0 0 0 87 88 L16 88 A12 12 0 0 1 4 76 L4 20 A12 12 0 0 1 16 8 Z"
        stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" fill="none"
      />
      {/* 천공 점선 */}
      <line x1="96" y1="16" x2="96" y2="80" stroke="currentColor" strokeWidth={strokeWidth * 0.6} strokeDasharray="2.4 5" strokeLinecap="round" opacity={0.4} />
      {!faded && (
        variant === 'gift' ? (
          <>
            {/* 본문 패널 — 내용 라인 */}
            <rect x="18" y="34" width="52" height="6" rx="3" fill="currentColor" opacity="0.9" />
            <rect x="18" y="48" width="40" height="5" rx="2.5" fill="currentColor" opacity="0.32" />
            <rect x="18" y="60" width="28" height="5" rx="2.5" fill="currentColor" opacity="0.18" />
            {/* 스텁 — 바코드 */}
            <g stroke="currentColor" strokeLinecap="round">
              <line x1="108" y1="38" x2="108" y2="58" strokeWidth="2" opacity="0.85" />
              <line x1="113" y1="38" x2="113" y2="58" strokeWidth="1.1" opacity="0.5" />
              <line x1="117" y1="38" x2="117" y2="58" strokeWidth="2.4" opacity="0.85" />
              <line x1="122" y1="38" x2="122" y2="58" strokeWidth="1.1" opacity="0.5" />
              <line x1="126" y1="38" x2="126" y2="58" strokeWidth="2" opacity="0.85" />
            </g>
          </>
        ) : (
          <>
            {/* 본문 패널 — 이용권 모티프 (포크 + 스푼) */}
            <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9">
              {/* 포크: 3갈래 + 수렴 + 손잡이 */}
              <path d="M34 30 V38 M38 30 V38 M42 30 V38" />
              <path d="M34 38 Q38 44 38 48 Q38 44 42 38" />
              <path d="M38 48 V66" />
              {/* 스푼 */}
              <ellipse cx="56" cy="37" rx="5.5" ry="7.5" />
              <path d="M56 44 V66" />
            </g>
            {/* 스텁 — QR 닷 3×3 */}
            <g fill="currentColor">
              {[0, 1, 2].map(r => [0, 1, 2].map(cc => (
                <rect key={`${r}-${cc}`} x={108 + cc * 7} y={41 + r * 7} width="4.5" height="4.5" rx="1" opacity={(r + cc) % 2 === 0 ? 0.85 : 0.32} />
              )))}
            </g>
          </>
        )
      )}
    </svg>
  )
}

function WalletEmptyGlyph({ variant }: { variant: 'gb' | 'gift' }) {
  return (
    <div className="relative mb-7" style={{ width: 176, height: 132 }} aria-hidden>
      {/* 그라운드 섀도 */}
      <div className="absolute left-1/2 bottom-[12px] -translate-x-1/2 rounded-[50%]"
        style={{ width: 108, height: 16, background: 'radial-gradient(closest-side, rgba(10,10,10,0.13), rgba(10,10,10,0))' }} />
      {/* 뒤 티켓 (스택 깊이) */}
      <div className="absolute left-1/2 top-1/2 text-gray-200 dark:text-[#272727]"
        style={{ transform: 'translate(calc(-50% - 17px), calc(-50% - 9px)) rotate(-11deg)', width: 122 }}>
        <TicketShape variant={variant} strokeWidth={2.4} faded className="w-full" />
      </div>
      {/* 앞 티켓 */}
      <div className="absolute left-1/2 top-1/2 text-gray-900 dark:text-white"
        style={{ transform: 'translate(calc(-50% + 5px), -50%) rotate(3deg)', width: 134, filter: 'drop-shadow(0 8px 14px rgba(10,10,10,0.10))' }}>
        <TicketShape variant={variant} strokeWidth={2.4} className="w-full" />
      </div>
    </div>
  )
}

// 🎨 2026-06-21 (개선 #2): 콜드 로드 스켈레톤 — 스피너 대신 패스 형태 placeholder (첫 페인트 표준).
export function WalletSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden>
      {/* 히어로 */}
      <div className="rounded-[20px] bg-gray-200 dark:bg-[#1A1A1A] h-[120px] mb-4" />
      {/* 패스 카드 2장 */}
      {[0, 1].map(i => (
        <div key={i} className="rounded-[18px] bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#1F1F1F] p-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[10px] bg-gray-200 dark:bg-[#1F1F1F]" />
            <div className="h-3 w-28 rounded bg-gray-200 dark:bg-[#1F1F1F]" />
            <div className="ml-auto h-5 w-12 rounded-full bg-gray-200 dark:bg-[#1F1F1F]" />
          </div>
          <div className="mt-3 h-5 w-3/5 rounded bg-gray-200 dark:bg-[#1F1F1F]" />
          <div className="mt-3 flex items-center justify-between">
            <div className="h-6 w-24 rounded bg-gray-200 dark:bg-[#1F1F1F]" />
            <div className="h-9 w-24 rounded-[13px] bg-gray-200 dark:bg-[#1F1F1F]" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * 🎨 2026-06-20 흑백 iOS-클린 리디자인 (docs/design/my-vouchers-wallet-bw.md 화면5):
 *   기존(핑크 그라데이션 일러스트 + CTA + 카드형 3스텝) → 잉크 톤 통일.
 *   뉴트럴 라운드 일러스트 + 1·2·3 원형 잉크 번호(셰브론) + 블랙 필 CTA.
 *   화이트 테마(다크 토글 지원) — 모든 라이트 토큰에 dark: variant 동반.
 *   🎨 2026-06-21 고급 마감: 일러스트 → WalletEmptyGlyph(스택 티켓), 스텝 셰브론 → 연결 트랙.
 */
export function EmptyVouchers({ mode, onExplore, t }: {
  mode: 'gb' | 'gift'
  onExplore: () => void
  t: (key: string, opts?: any) => string
}) {
  const isGift = mode === 'gift'
  const title = isGift
    ? t('voucher.emptyGiftTitle', { defaultValue: '받아둔 교환권이 없어요' })
    : t('voucher.emptyGbTitle', { defaultValue: '받아둔 이용권이 없어요' })
  const desc = isGift
    ? t('voucher.emptyGiftDesc', { defaultValue: '교환권을 구매하면 휴대폰으로 발송되고\n여기에서도 모아볼 수 있어요' })
    : t('voucher.emptyGbDesc', { defaultValue: '동네 맛집 공동구매에 참여하면\n선결제 이용권이 여기에 쌓여요' })
  const cta = isGift
    ? t('voucher.emptyGiftCta', { defaultValue: '교환권 보러가기' })
    : t('voucher.emptyGbCta', { defaultValue: '공구 보러가기' })

  // 🎨 흑백 리디자인 화면5 — 1·2·3 원형 스텝(2줄 라벨)
  const steps: string[] = isGift
    ? [
        t('voucher.stepGift1', { defaultValue: '교환권\n구매' }),
        t('voucher.stepGift2', { defaultValue: 'MMS\n발송' }),
        t('voucher.stepGift3', { defaultValue: '매장에서\n제시' }),
      ]
    : [
        t('voucher.stepGb1', { defaultValue: '공구\n참여' }),
        t('voucher.stepGb2', { defaultValue: '지갑에\n이용권' }),
        t('voucher.stepGb3', { defaultValue: '매장에서\nQR 제시' }),
      ]

  return (
    <div className="py-12 flex flex-col items-center text-center">
      {/* 히어로 일러스트 — 스택 티켓(천공·스텁·QR/바코드) */}
      <WalletEmptyGlyph variant={isGift ? 'gift' : 'gb'} />

      <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-gray-900 dark:text-white">{title}</h2>
      <p className="mt-2 max-w-[264px] text-[13.5px] leading-relaxed text-gray-500 dark:text-gray-400 whitespace-pre-line">{desc}</p>

      {/* 사용 흐름 1·2·3 — 잉크 원형 번호 + 연결 트랙(헤어라인) */}
      <div className="mt-9 w-full max-w-[300px] flex items-start">
        {steps.map((label, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <div className="flex-1 mt-[16px] h-px mx-1.5 rounded-full bg-gray-200 dark:bg-[#2A2A2A]" aria-hidden />
            )}
            <div className="flex flex-col items-center gap-2 w-[58px] shrink-0">
              <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[14px] font-bold font-mono bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-[0_2px_6px_rgba(10,10,10,0.18)] dark:shadow-none">{i + 1}</div>
              <span className="text-[11px] font-medium leading-tight text-gray-600 dark:text-gray-300 whitespace-pre-line">{label}</span>
            </div>
          </Fragment>
        ))}
      </div>

      <button
        onClick={onExplore}
        className="mt-9 w-full max-w-[300px] py-3.5 rounded-2xl text-[15px] font-extrabold bg-gray-900 dark:bg-white text-white dark:text-gray-900 active:scale-[0.98] transition-transform flex items-center justify-center gap-1.5 shadow-[0_8px_22px_rgba(10,10,10,0.20)] dark:shadow-none"
      >
        {cta}
        <ArrowRight className="w-[17px] h-[17px]" strokeWidth={2.4} />
      </button>
    </div>
  )
}
