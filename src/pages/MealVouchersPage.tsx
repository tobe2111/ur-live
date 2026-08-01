import BrowsePage from './BrowsePage'
import SEO from '@/components/SEO'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'

export default function MealVouchersPage() {
  return (
    <>
      <SEO
        title={CONSUMER_SURFACE_SEO['/meal-vouchers'].title} description={CONSUMER_SURFACE_SEO['/meal-vouchers'].description}
        url="/meal-vouchers"
      />
      <BrowsePage defaultCategory="meal_voucher" />
    </>
  )
}
