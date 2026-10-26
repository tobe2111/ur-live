import type { ComponentType } from 'react'
import { AllIcon, MealIcon, BeautyIcon, StayIcon, HomeLifeIcon, GiftIcon } from '@/components/icons/category-icons'
import type { DealCategory } from '@/shared/deal-cats'

/** 🏠 모바일 홈 카테고리 원의 그림(2026-10-26 안 A). 라벨은 `DEAL_CAT_LABELS` 가 SSOT 이고 여기는 그림만 붙인다. */
export const HOME_CAT_ICON: Record<DealCategory, ComponentType<{ size?: number | string }>> = {
  all: AllIcon,
  meal_voucher: MealIcon,
  beauty_voucher: BeautyIcon,
  stay_voucher: StayIcon,
  home_voucher: HomeLifeIcon,
  etc_voucher: GiftIcon,
}
