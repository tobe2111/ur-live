/**
 * 🩸 "못 불러왔다"를 말하는 한 자리 (2026-09-15).
 *
 * 목록 화면이 실패했을 때 **빈 상태로 위장하지 않기** 위한 공용 조각. 같은 문장을 화면마다
 * 다시 쓰면 어디선가 빠지고, 빠진 자리는 다시 "없어요"가 된다.
 *
 * 문구는 이미 6개 언어에 있는 `common.loadFailed` / `common.retry` 를 쓴다(신규 키 0).
 */
import { useTranslation } from 'react-i18next'
import Udal from '@/components/mascot/Udal'

export function ListLoadError({ onRetry, className = '' }: { onRetry: () => void; className?: string }) {
  const { t } = useTranslation()
  return (
    <div className={`text-center ${className}`}>
      {/* 🦦 2026-10-07 유달이 — '못 불러왔다'는 미안한 얼굴로. 빈 상태(졸린 얼굴)와 얼굴부터 다르다. */}
      <Udal mood="oops" size={88} className="mx-auto mb-3" />
      <p className="mb-4 text-[15px] text-gray-900 dark:text-white">{t('common.loadFailed')}</p>
      <button
        onClick={onRetry}
        className="px-6 py-2 rounded-full bg-brand text-white text-[13px] font-bold active:opacity-90"
      >
        {t('common.retry')}
      </button>
    </div>
  )
}
