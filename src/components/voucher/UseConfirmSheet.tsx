import { Loader2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n-lite'

export type PendingUse = { code: string; loading: boolean; productName?: string; restaurantName?: string; status?: string }

/**
 * ✅ 사용 처리 확인창. 사용 가능한 이용권만 [사용 처리] 를 낸다 — 이미 쓴/만료/환불은 이유만 말하고 닫게 한다
 *   (누를 수 없는 버튼을 띄우면 사장님은 눌러 보고서야 안다).
 */
export default function UseConfirmSheet({ pending, onCancel, onConfirm }: { pending: PendingUse; onCancel: () => void; onConfirm: () => void }) {
  const { t } = useTranslation()
  const st = pending.status
  const usable = !pending.loading && (st == null || st === 'unused')
  const blocked = st === 'used'
    ? t('seller.scan.alreadyUsed', { defaultValue: '이미 사용된 이용권이에요' })
    : st && st !== 'unused'
      ? t('seller.scan.notUsable', { defaultValue: '사용할 수 없는 이용권이에요 (만료·환불)' })
      : null
  return (
    <div className="fixed inset-0 z-[10500] flex items-end sm:items-center justify-center ur-veil p-4" role="presentation" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-labelledby="use-confirm-title" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-surface p-6 shadow-lift">
        {pending.loading ? (
          <p className="flex items-center justify-center gap-2 py-6 text-[15px] text-gray-500 dark:text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('seller.scan.checking', { defaultValue: '이용권 확인 중…' })}
          </p>
        ) : (
          <>
            <p className="text-[13px] text-gray-500 dark:text-gray-400">{pending.restaurantName || pending.code}</p>
            <p className="mt-1 text-[17px] font-bold text-gray-900 dark:text-white">{pending.productName || pending.code}</p>
            <h2 id="use-confirm-title" className={`mt-4 text-[15px] font-bold ${blocked ? 'text-tone-bad' : 'text-gray-900 dark:text-white'}`}>
              {blocked ?? t('seller.scan.confirmQ', { defaultValue: '사용 처리하시겠습니까?' })}
            </h2>
            {!blocked && (
              <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">{t('seller.scan.confirmNote', { defaultValue: '사용 처리하면 되돌릴 수 없어요.' })}</p>
            )}
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={onCancel}
                className="flex-1 rounded-full bg-gray-100 dark:bg-white/10 py-3 text-[15px] font-bold text-gray-700 dark:text-gray-200">
                {blocked ? t('common.close', { defaultValue: '닫기' }) : t('common.cancel', { defaultValue: '취소' })}
              </button>
              {usable && !blocked && (
                <button type="button" onClick={onConfirm} autoFocus
                  className="flex-1 rounded-full bg-brand py-3 text-[15px] font-bold text-white">
                  {t('seller.scan.useBtn', { defaultValue: '사용 처리' })}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
