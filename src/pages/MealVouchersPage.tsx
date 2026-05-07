import BrowsePage from './BrowsePage'
import SEO from '@/components/SEO'

export default function MealVouchersPage() {
  return (
    <>
      <SEO
        title="식사권 - 유어딜"
        description="맛집 식사권을 라이브로 만나보세요. 치킨·피자·한식·카페 등 다양한 식사권 특가."
        url="/meal-vouchers"
      />
      <BrowsePage defaultCategory="meal_voucher" />
    </>
  )
}
