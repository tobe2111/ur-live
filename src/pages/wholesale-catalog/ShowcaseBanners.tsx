import { useTranslation } from 'react-i18next'
import { Crown, Sparkles } from 'lucide-react'
import { WT } from '../wholesale/wholesale-theme'
import BrandShowcaseGrid from './BrandShowcaseGrid'
import type { BrandEntry } from './types'

// 프리미엄 전용관 헤더 + 브랜드 전시관 그리드 — WholesaleCatalogPage 분해 (순수 추출, 동작 변화 0).
export default function ShowcaseBanners({ premiumView, setPremiumView, brandView, setBrandView, selectedBrand, setSelectedBrand, brands, brandsLoading }: {
  premiumView: boolean
  setPremiumView: (v: boolean) => void
  brandView: boolean
  setBrandView: (v: boolean) => void
  selectedBrand: string
  setSelectedBrand: (v: string) => void
  brands: BrandEntry[]
  brandsLoading: boolean
}) {
  const { t } = useTranslation()
  return (
    <>
        {/* 🏭 Wave 2: 프리미엄 전용관 헤더 (premiumView 활성 시) */}
        {premiumView && (
          <section className="pt-6">
            <div className="rounded-2xl p-5 lg:p-6 flex items-center gap-4" style={{ background: WT.ink, color: '#fff' }}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <Crown className="w-6 h-6" style={{ color: '#FFD166' }} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-[18px] lg:text-[20px] font-extrabold">{t('wholesale.premium.title', { defaultValue: '프리미엄 전용관' })}</h2>
                  <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: WT.brand, color: '#fff' }}><Sparkles className="w-3 h-3" /> PREMIUM</span>
                </div>
                <p className="text-[13px] mt-1" style={{ color: 'rgba(255,255,255,0.72)' }}>{t('wholesale.premium.desc', { defaultValue: '엄선된 프리미엄 공급 상품만 모았어요' })}</p>
              </div>
              <button onClick={() => setPremiumView(false)} className="shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-bold" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>{t('wholesale.premium.exit', { defaultValue: '전체보기' })}</button>
            </div>
          </section>
        )}

        {/* 🏷️ 브랜드 전시관 — 브랜드 그리드(특정 브랜드 미선택 시). 헤더 + 그리드 + 빈 상태. */}
        {brandView && !selectedBrand && (
          <section className="pt-6 pb-10">
            <div className="rounded-2xl p-5 lg:p-6 flex items-center gap-4 mb-5" style={{ background: WT.ink, color: '#fff' }}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <Sparkles className="w-6 h-6" style={{ color: '#FFD166' }} />
              </span>
              <div className="flex-1 min-w-0">
                <h2 className="text-[18px] lg:text-[20px] font-extrabold">{t('wholesale.brand.title', { defaultValue: '브랜드 전시관' })}</h2>
                <p className="text-[13px] mt-1" style={{ color: 'rgba(255,255,255,0.72)' }}>{t('wholesale.brand.desc', { defaultValue: '브랜드별로 모아 둘러보세요. 브랜드를 누르면 해당 상품만 볼 수 있어요.' })}</p>
              </div>
              <button onClick={() => { setBrandView(false); setSelectedBrand('') }} className="shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-bold" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>{t('wholesale.brand.exit', { defaultValue: '전체보기' })}</button>
            </div>
            <BrandShowcaseGrid brands={brands} loading={brandsLoading} onPick={(name) => setSelectedBrand(name)} t={t} />
          </section>
        )}
    </>
  )
}
