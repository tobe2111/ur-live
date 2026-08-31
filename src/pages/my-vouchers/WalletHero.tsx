// 🧱 2026-08-31 (지갑 분리): MyVouchersPage 의 '보유 금액 히어로'를 추출 — 이용권/교환권 두 지갑이
//   같은 카드를 쓴다(문구·단위만 다름). 마크업은 2026-06-21 시안 A '프리미엄 패스' 그대로.
//   theme-dual: 라이트/다크 모두 항상 어두운 카드(신용카드처럼). 내부 text-white/gray 는 의도적.
import { formatNumber } from '@/utils/format'

export default function WalletHero({ label, total, unit, usableCount, nearestExpiry, saved, t }: {
  /** 상단 작은 라벨 — '보유 이용권 금액' / '보유 교환권 금액' */
  label: string
  total: number
  /** '원'(이용권 액면) 또는 '딜'(교환권은 딜로만 결제) */
  unit: string
  usableCount: number
  /** 가장 가까운 만료까지 남은 일수. 없으면 미표시(교환권은 만료일 미보유). */
  nearestExpiry: number | null
  /** 정가 대비 아낀 금액. 0 이면 미표시. */
  saved: number
  t: (key: string, opts?: any) => string
}) {
  return (
    <div className="ur-content-narrow px-4 lg:px-8 mb-4">
      <div className="rounded-[20px] px-[18px] pt-[18px] pb-4 bg-gray-900 dark:bg-[#141414] text-white"
        style={{ boxShadow: '0 14px 32px -10px rgba(10,10,10,0.45)' }}>
        <p className="text-[12px] font-semibold text-gray-400">{label}</p>
        <p className="mt-1 text-[32px] font-extrabold font-mono tracking-tight leading-none">
          {formatNumber(total)}<span className="font-sans text-[16px] font-bold text-gray-300 ml-0.5">{unit}</span>
        </p>
        <div className="mt-3.5 pt-3 flex items-center gap-6 border-t border-white/10">
          <div>
            <p className="text-[11px] text-gray-400">{t('voucher.heroUsable', { defaultValue: '사용 가능' })}</p>
            <p className="mt-0.5 text-[15px] font-extrabold">{usableCount}{t('voucher.heroCountUnit', { defaultValue: '장' })}</p>
          </div>
          {nearestExpiry !== null && (
            <div>
              <p className="text-[11px] text-gray-400">{t('voucher.heroExpiry', { defaultValue: '만료 임박' })}</p>
              <p className={`mt-0.5 text-[15px] font-extrabold font-mono ${nearestExpiry <= 2 ? 'text-[#FF6B6B]' : ''}`}>{nearestExpiry === 0 ? 'D-DAY' : `D-${nearestExpiry}`}</p>
            </div>
          )}
          {saved > 0 && (
            <div>
              <p className="text-[11px] text-gray-400">{t('voucher.heroSaved', { defaultValue: '아낀 돈' })}</p>
              <p className="mt-0.5 text-[15px] font-extrabold font-mono text-[#34C759]">{formatNumber(saved)}{unit}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
