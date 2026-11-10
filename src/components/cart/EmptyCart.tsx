import React from 'react'
import { BagIcon } from '@/components/icons/urdeal-icons'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '@/lib/i18n-lite'
import { CART_EMPTY_CLS, CART_EMPTY_ICON, CART_COPY } from '@/shared/cart-page' // 🧺 2026-11-10 서버 첫 화면(비로그인)과 같은 클래스·문구

export const EmptyCart = React.memo(function EmptyCart() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <div className={CART_EMPTY_CLS.wrap}>
      <div className={CART_EMPTY_CLS.iconBox}>
        <BagIcon size={CART_EMPTY_ICON} className={CART_EMPTY_CLS.icon} />
      </div>

      <h2 className={CART_EMPTY_CLS.title}>
        {t('cart.empty', { defaultValue: CART_COPY.empty })}
      </h2>

      <p className={CART_EMPTY_CLS.desc}>
        {t('cart.emptySubtitle', { defaultValue: CART_COPY.emptySubtitle })}
      </p>

      <button
        onClick={() => navigate('/')}
        className={CART_EMPTY_CLS.btn}
      >
        {t('cart.continueShop', { defaultValue: CART_COPY.continueShop })}
      </button>
    </div>
  )
})
