// 🧱 2026-06-29 TD: MyVouchersPage god 파일 분해 — 빈 상태/스켈레톤/티켓 일러스트(verbatim 추출). 동작 불변.
//   WalletSkeleton·EmptyVouchers 만 페이지가 사용.
// 🦦 2026-10-07 (대표 허가 "이용권 0장"): 스택 티켓 일러스트(TicketShape·WalletEmptyGlyph) → 유달이(졸린 얼굴).
import { Fragment } from 'react'
import { BagIcon, WalletIcon, GiftBoxIcon, StoreIcon } from '@/components/icons/urdeal-icons'
import { ArrowRight, QrCode, Smartphone, type LucideIcon } from 'lucide-react'
import Udal from '@/components/mascot/Udal'

// 🎨 2026-06-21 (개선 #2): 콜드 로드 스켈레톤 — 스피너 대신 패스 형태 placeholder (첫 페인트 표준).
export function WalletSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden>
      {/* 히어로 */}
      <div className="rounded-[20px] bg-gray-200 dark:bg-[#1D1F29] h-[120px] mb-4" />
      {/* 패스 카드 2장 */}
      {[0, 1].map(i => (
        <div key={i} className="rounded-[18px] bg-surface shadow-lift p-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-[10px] bg-gray-200 dark:bg-[#2C2F35]" />
            <div className="h-3 w-28 rounded bg-gray-200 dark:bg-[#2C2F35]" />
            <div className="ml-auto h-5 w-12 rounded-full bg-gray-200 dark:bg-[#2C2F35]" />
          </div>
          <div className="mt-3 h-5 w-3/5 rounded bg-gray-200 dark:bg-[#2C2F35]" />
          <div className="mt-3 flex items-center justify-between">
            <div className="h-6 w-24 rounded bg-gray-200 dark:bg-[#2C2F35]" />
            <div className="h-9 w-24 rounded-[13px] bg-gray-200 dark:bg-[#2C2F35]" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * 🎨 2026-06-20 흑백 iOS-클린 리디자인 (docs/design/my-vouchers-wallet-bw.md 화면5) →
 * 🎨 2026-07-20 브랜드 로즈 워밍 (대표 — "/my-vouchers 디자인 너무 투박해"):
 *   - 스텝: 검정 숫자 원(투박) → 로즈 틴트 아이콘 칩(bg-brand-tint/text-brand-text — §브랜드 지시서
 *     '강조'용, 라이트/다크 자동 보정) + 작은 스텝 번호. 구매→지갑→매장 흐름이 아이콘으로 즉독.
 *   - CTA: 블랙 필 → 브랜드 로즈(bg-brand, '행동'). 하단 네비 로즈 액센트와 정합.
 *   - 문구: 옛 멘탈모델("공구 참여") → 현행 즉시구매("이용권 구매 → 지갑 도착 → 매장 QR 사용").
 *   티켓 일러스트는 잉크 유지(로즈는 행동·강조 10% 이하 룰). 화이트 테마(다크 토글 지원).
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
    : t('voucher.emptyGbDesc', { defaultValue: '동네 이용권을 할인가로 구매하면\n여기에 담기고 매장에서 바로 써요' })
  const cta = isGift
    ? t('voucher.emptyGiftCta', { defaultValue: '교환권 보러가기' })
    : t('voucher.emptyGbCta', { defaultValue: '동네 이용권 보러가기' })

  // 🎨 2026-07-20 — 아이콘 스텝(구매 → 지갑 → 매장). 교환권은 구매 → MMS → 매장.
  const steps: { icon: LucideIcon; label: string }[] = isGift
    ? [
        { icon: GiftBoxIcon, label: t('voucher.stepGift1', { defaultValue: '교환권\n구매' }) },
        { icon: Smartphone, label: t('voucher.stepGift2', { defaultValue: 'MMS\n발송' }) },
        { icon: StoreIcon, label: t('voucher.stepGift3', { defaultValue: '매장에서\n제시' }) },
      ]
    : [
        { icon: BagIcon, label: t('voucher.stepGb1', { defaultValue: '이용권\n구매' }) },
        { icon: WalletIcon, label: t('voucher.stepGb2', { defaultValue: '지갑에\n도착' }) },
        { icon: QrCode, label: t('voucher.stepGb3', { defaultValue: '매장에서\nQR 사용' }) },
      ]

  return (
    <div className="py-12 flex flex-col items-center text-center">
      {/* 🦦 히어로 — 유달이(아직 아무것도 없음 = 졸린 얼굴). 교환권·이용권 공통. */}
      <Udal mood="empty" size={120} motion priority className="mb-6" />

      <h2 className="text-[24px] font-extrabold tracking-[-0.02em] text-gray-900 dark:text-white">{title}</h2>
      <p className="mt-2 max-w-[264px] text-[13px] leading-relaxed text-gray-500 dark:text-gray-400 whitespace-pre-line">{desc}</p>

      {/* 사용 흐름 — 로즈 틴트 아이콘 칩 + 연결 트랙(헤어라인) + 작은 스텝 번호 */}
      <div className="mt-9 w-full max-w-[312px] flex items-start">
        {steps.map(({ icon: Icon, label }, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <div className="flex-1 mt-[22px] h-px mx-1 rounded-full bg-gray-200 dark:bg-[#2C2F35]" aria-hidden />
            )}
            <div className="flex flex-col items-center gap-2 w-[66px] shrink-0">
              <div className="relative w-11 h-11 rounded-2xl flex items-center justify-center bg-brand-tint text-brand-text">
                <Icon className="w-[19px] h-[19px]" strokeWidth={2} />
                <span className="absolute -top-1 -right-1 w-[15px] h-[15px] rounded-full bg-surface border border-rule-strong text-[12px] font-extrabold text-gray-500 dark:text-gray-400 flex items-center justify-center tabular-nums">{i + 1}</span>
              </div>
              <span className="text-[12px] font-medium leading-tight text-gray-600 dark:text-gray-300 whitespace-pre-line">{label}</span>
            </div>
          </Fragment>
        ))}
      </div>

      <button
        onClick={onExplore}
        className="mt-9 w-full max-w-[300px] py-4 rounded-2xl text-[15px] font-extrabold bg-brand hover:bg-brand-dark text-white active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_8px_22px_rgba(28,105,239,0.32)] dark:shadow-[0_8px_22px_rgba(28,105,239,0.2)]"
      >
        {cta}
        <ArrowRight className="w-[17px] h-[17px]" strokeWidth={2.4} />
      </button>
    </div>
  )
}
