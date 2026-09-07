// 🧱 2026-08-31 (지갑 분리): MyVouchersPage 의 '사용 완료 / 만료·환불' 접기 박스를 추출 —
//   이용권/교환권 두 지갑이 같은 박스를 쓴다. 마크업·기본 접힘 동작 그대로.
import { Fragment, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import VoucherTicket from './VoucherTicket'
import type { Voucher } from './types'

export default function WalletArchive({ used, archived, locale, t, onShowQr }: {
  used: Voucher[]
  archived: Voucher[]
  locale: string
  t: (key: string, opts?: any) => string
  /** 이용권 지갑만 사용(QR 모달). 교환권은 카드가 자체 바코드/문자 안내라 미전달. */
  onShowQr?: (v: Voucher) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const groups = ([
    { key: 'used', label: t('voucher.groupUsed', { defaultValue: '사용 완료' }), items: used },
    { key: 'archived', label: t('voucher.groupArchived', { defaultValue: '만료 · 환불' }), items: archived },
  ] as const).filter(g => g.items.length > 0)
  if (groups.length === 0) return null

  return (
    <div className="mt-4 rounded-2xl border border-gray-200 dark:border-[#2C2F35] overflow-hidden">
      {groups.map((g, idx) => {
        const open = expanded.has(g.key)
        return (
          <Fragment key={g.key}>
            {idx > 0 && <div className="h-px bg-gray-100 dark:bg-[#2C2F35] mx-[15px]" />}
            <button type="button"
              onClick={() => setExpanded(prev => { const n = new Set(prev); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n })}
              className="w-full flex items-center justify-between px-[15px] py-3.5 text-left">
              <span className="text-[14px] font-semibold text-gray-900 dark:text-white">{g.label} <span className="text-gray-400 dark:text-gray-500 font-medium">{g.items.length}</span></span>
              <ChevronRight className={`w-4 h-4 shrink-0 text-gray-300 dark:text-gray-600 transition-transform ${open ? 'rotate-90' : ''}`} />
            </button>
            {open && (
              <div className="px-[13px] pb-3 space-y-3">
                {g.items.map(v => <VoucherTicket key={v.id} v={v} muted locale={locale} t={t} onShowQr={() => onShowQr?.(v)} />)}
              </div>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
