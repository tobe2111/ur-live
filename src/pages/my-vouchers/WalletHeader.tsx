// 🎨 2026-08-31 (대표 시안 확정 — "시안 4로 하는데 위에 바 글자가 너무 커"):
//   지갑 상단 = [제목 · 보유 금액] 한 줄 + 헤어라인 + 지표 한 줄. 검은 히어로 카드를 대체한다.
//   ① 카드가 차지하던 화면 3분의 1이 두 줄로 줄어 이용권 카드가 먼저 보인다
//   ② 금액은 그대로 크게 남아 '자산' 느낌을 잃지 않는다
//   ③ 지표(만료 임박·아낀 돈)는 얇은 줄로 — 지표가 적은 교환권 지갑에서 빈 칸이 생기지 않는다
//   글자 크기: 제목 20 / 금액 21 (직전 24·26 은 대표 지적대로 컸다). 지표 줄은 12.
import { ArrowLeft } from 'lucide-react'
import { formatNumber } from '@/utils/format'

export interface WalletStat {
  label: string
  value: string
  /** 숫자 강조색(만료 임박 빨강 · 아낀 돈 초록). 없으면 잉크. */
  tone?: 'danger' | 'success'
  mono?: boolean
}

export default function WalletHeader({ title, hideTitle = false, amount, unit, stats = [], onBack, backLabel }: {
  title: string
  /** 🎫 2026-09-03 (대표 "내 이용권 문장 삭제"): 제목을 화면에서 지운다. 페이지가 제목 없는 문서가
   *  되지 않도록 `sr-only` h1 로만 남긴다(보조기술·SEO 구조 유지). 제목이 빠지면 금액이 그 줄의
   *  유일한 요소라 왼쪽으로 붙는다 — 오른쪽에 홀로 떠 있지 않게. */
  hideTitle?: boolean
  /** 보유 금액. null 이면 금액 자리를 비운다(빈 지갑). */
  amount: number | null
  /** '원'(이용권) 또는 '딜'(교환권) */
  unit: string
  /** 헤어라인 아래 한 줄. 없으면 그 줄을 그리지 않는다. */
  stats?: WalletStat[]
  /** 있으면 제목 좌측 뒤로가기(하단 탭이 아닌 페이지 — 교환권 보관함). */
  onBack?: () => void
  backLabel?: string
}) {
  return (
    <div className="ur-content-narrow px-4 lg:px-8 pt-2">
      {hideTitle && <h1 className="sr-only">{title}</h1>}
      <div className="flex items-end justify-between gap-3">
        {(!hideTitle || onBack) && (
          <div className="flex items-center gap-1 min-w-0">
            {onBack && (
              <button type="button" onClick={onBack} aria-label={backLabel || '뒤로가기'}
                className="-ml-2 w-9 h-9 shrink-0 flex items-center justify-center rounded-full text-gray-900 dark:text-white active:bg-gray-100 dark:active:bg-white/10">
                <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={2} />
              </button>
            )}
            {!hideTitle && (
              <h1 className="text-[20px] font-extrabold tracking-[-0.02em] text-gray-900 dark:text-white leading-none truncate">{title}</h1>
            )}
          </div>
        )}
        {amount !== null && (
          <span className="shrink-0 text-[21px] font-extrabold font-mono tracking-tight text-gray-900 dark:text-white leading-none">
            {formatNumber(amount)}<span className="font-sans text-[12px] font-bold text-gray-400 dark:text-gray-500 ml-0.5">{unit}</span>
          </span>
        )}
      </div>

      {stats.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-gray-200 dark:border-[#2C2F35] flex items-center gap-4 text-[12px]">
          {stats.map((s) => (
            <span key={s.label} className="text-gray-500 dark:text-gray-400">
              {s.label}{' '}
              <b className={`font-extrabold ${s.mono ? 'font-mono' : ''} ${
                s.tone === 'danger' ? 'text-[#DC2626]' : s.tone === 'success' ? 'text-[#16A34A]' : 'text-gray-900 dark:text-white'
              }`}>{s.value}</b>
            </span>
          ))}
        </div>
      )}
      <div className="mt-4" />
    </div>
  )
}
