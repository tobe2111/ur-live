// 🧱 2026-08-31 (지갑 분리): MyVouchersPage 의 '보유 금액 히어로'를 추출 — 이용권/교환권 두 지갑이
//   같은 카드를 쓴다(문구·단위만 다름). 마크업은 2026-06-21 시안 A '프리미엄 패스' 그대로.
//   theme-dual: 라이트/다크 모두 항상 어두운 카드(신용카드처럼). 내부 text-white/gray 는 의도적.
import { formatNumber } from '@/utils/format'

export default function WalletHero({ label, total, unit, nearestExpiry, saved, t }: {
  /** 상단 작은 라벨 — '보유 이용권 금액' / '보유 교환권 금액' */
  label: string
  total: number
  /** '원'(이용권 액면) 또는 '딜'(교환권은 딜로만 결제) */
  unit: string
  /** 가장 가까운 만료까지 남은 일수. 없으면 미표시(교환권은 만료일 미보유). */
  nearestExpiry: number | null
  /** 정가 대비 아낀 금액. 0 이면 미표시. */
  saved: number
  t: (key: string, opts?: any) => string
}) {
  // 🎨 2026-08-31: '사용 가능 N장'은 헤더 서브라인이 이미 말한다 → 히어로에선 뺀다(같은 말을 두 번 하지 않는다).
  //   남는 지표가 없으면(교환권: 만료일·할인율이 없다) 구분선과 지표 행 자체를 그리지 않는다 — 빈 칸을 만들지 않기 위해서다.
  const stats: { label: string; value: string; mono?: boolean; tone?: string }[] = []
  if (nearestExpiry !== null) {
    stats.push({
      label: t('voucher.heroExpiry', { defaultValue: '만료 임박' }),
      value: nearestExpiry === 0 ? 'D-DAY' : `D-${nearestExpiry}`,
      mono: true,
      tone: nearestExpiry <= 2 ? 'text-[#FF6B6B]' : undefined,
    })
  }
  if (saved > 0) {
    stats.push({
      label: t('voucher.heroSaved', { defaultValue: '아낀 돈' }),
      value: `${formatNumber(saved)}${unit}`,
      mono: true,
      tone: 'text-[#34C759]',
    })
  }
  return (
    <div className="ur-content-narrow px-4 lg:px-8 mb-4">
      <div className="rounded-[20px] px-[18px] pt-[18px] pb-4 bg-gray-900 dark:bg-[#141414] text-white"
        style={{ boxShadow: '0 14px 32px -10px rgba(10,10,10,0.45)' }}>
        <p className="text-[12px] font-semibold text-gray-400">{label}</p>
        <p className="mt-1 text-[32px] font-extrabold font-mono tracking-tight leading-none">
          {formatNumber(total)}<span className="font-sans text-[16px] font-bold text-gray-300 ml-0.5">{unit}</span>
        </p>
        {/* 🎨 2026-08-31 (대표 "밋밋하다"): 지표를 `gap-6` 로 왼쪽에 몰아 두니 **2개짜리 교환권 지갑에서
            오른쪽 절반이 통째로 비어** 카드가 휑해 보였다. 개수만큼 균등 분할해 폭을 다 쓴다. */}
        {stats.length > 0 && (
        <div className="mt-3.5 pt-3 border-t border-white/10 grid gap-3"
          style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-[11px] text-gray-400">{s.label}</p>
              <p className={`mt-0.5 text-[15px] font-extrabold ${s.mono ? 'font-mono' : ''} ${s.tone ?? ''}`}>{s.value}</p>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  )
}
