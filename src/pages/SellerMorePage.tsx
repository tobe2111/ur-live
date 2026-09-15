/**
 * 📱 **더보기** — 다섯 번째 탭 (2026-09-14 대표 승인, `docs/design/seller-dashboard-mobile-first-2026-09.md`).
 *
 *   폰에는 사이드바가 없다. 홈·주문·이용권·정산 넷이 덮지 않는 나머지 화면(매장·할인·파트너·알림·설정…)과
 *   계정 행동(설정·공개 프로필·언어·로그아웃)이 여기로 온다. 목록은 `useSellerNavModel().moreGroups` —
 *   PC 사이드바 헤어라인 아래와 **같은 계산**이라 두 화면이 갈릴 수 없다.
 *   PC 에서 이 주소로 오면 같은 목록을 본문에 그린다(사이드바와 중복이지만 딥링크가 404 가 되는 것보다 낫다).
 */
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Globe, LogOut, Settings } from 'lucide-react'
import SellerLayout from '@/components/SellerLayout'
import SellerSupportContact from '@/components/seller/SellerSupportContact'
import { useSellerNavModel } from '@/components/seller-layout/useSellerNavModel'
import { logoutSeller } from '@/lib/seller-auth'

const ROW = 'flex items-center gap-3 px-4 py-3.5 text-[14px] font-semibold text-gray-900 border-b border-rule last:border-b-0 active:bg-gray-50'

export default function SellerMorePage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { moreGroups } = useSellerNavModel()

  const handle = localStorage.getItem('user_handle')
  const goodHandle = !!handle && handle.length >= 3 && !['user', 'me', 'admin', 'seller', 'api', 'host', 'new'].includes(handle.toLowerCase())
  const sellerSlug = localStorage.getItem('seller_username') || localStorage.getItem('seller_id')
  const publicTarget = goodHandle ? `/u/${handle}` : (sellerSlug ? `/profile/${sellerSlug}` : null)

  const languages = [{ code: 'ko', label: '한국어' }, { code: 'en', label: 'English' }, { code: 'ja', label: '日本語' }, { code: 'zh', label: '中文' }, { code: 'es', label: 'Español' }, { code: 'fr', label: 'Français' }]

  return (
    <SellerLayout title={t('seller.tab.more', { defaultValue: '더보기' })}>
      <div className="mx-auto max-w-5xl space-y-4">
        {moreGroups.map((group, gi) => (
          <section key={gi}>
            {group.labelKey && (
              <h2 className="mb-1.5 px-1 text-[12px] font-bold text-gray-400">{t(group.labelKey, { defaultValue: '' })}</h2>
            )}
            <div className="overflow-hidden rounded-2xl border border-rule bg-white">
              {group.items.map(({ path, labelKey, icon: Icon }) => (
                <Link key={path} to={path} className={ROW}>
                  <Icon size={18} strokeWidth={1.8} className="shrink-0 text-gray-400" />
                  <span className="flex-1 truncate">{t(labelKey)}</span>
                  <ChevronRight size={16} className="shrink-0 text-gray-300" />
                </Link>
              ))}
            </div>
          </section>
        ))}

        <section>
          <h2 className="mb-1.5 px-1 text-[12px] font-bold text-gray-400">{t('seller.more.account', { defaultValue: '계정' })}</h2>
          <div className="overflow-hidden rounded-2xl border border-rule bg-white">
            <Link to="/seller/profile?tab=business" className={ROW}>
              <Settings size={18} strokeWidth={1.8} className="shrink-0 text-gray-400" />
              <span className="flex-1">{t('seller.settings')}</span>
              <ChevronRight size={16} className="shrink-0 text-gray-300" />
            </Link>
            {publicTarget && (
              <Link to={publicTarget} className={ROW}>
                <Globe size={18} strokeWidth={1.8} className="shrink-0 text-gray-400" />
                <span className="flex-1">{t('seller.viewPublicProfile', { defaultValue: '공개 프로필 보기' })}</span>
                <ChevronRight size={16} className="shrink-0 text-gray-300" />
              </Link>
            )}
            <label className={`${ROW} cursor-pointer`}>
              <Globe size={18} strokeWidth={1.8} className="shrink-0 text-gray-400" />
              <span className="flex-1">{t('seller.more.language', { defaultValue: '언어' })}</span>
              <select
                value={i18n.language}
                onChange={(e) => { i18n.changeLanguage(e.target.value); localStorage.setItem('i18nextLng', e.target.value); document.documentElement.lang = e.target.value }}
                className="rounded-lg border border-rule bg-white px-2 py-1 text-[13px] font-semibold text-gray-900"
              >
                {languages.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => logoutSeller(navigate)} className={`${ROW} w-full text-left`}>
              <LogOut size={18} strokeWidth={1.8} className="shrink-0 text-gray-400" />
              <span className="flex-1">{t('common.logout')}</span>
            </button>
          </div>
        </section>

        <SellerSupportContact />
      </div>
    </SellerLayout>
  )
}
