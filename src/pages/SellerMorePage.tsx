/**
 * 📱 **전체 메뉴** — 셀러 대시보드의 유일한 메뉴 화면 (2026-09-14 신설 · 2026-10-12 4단계로 허브가 됐다).
 *
 *   2026-10-12 셀러 대시보드 제거 4단계에서 사이드바(PC)·하단 탭(폰)을 걷어냈다. 그 둘이 하던 이동은
 *   틀 머리줄의 '전체 메뉴' 한 버튼 → 이 화면이 받는다: **이용권 등록(주 행동) · 다섯 대분류 · 나머지 · 계정**.
 *   목록은 전부 `useSellerNavModel` — 마이의 '전체 도구'·⌘K 와 **같은 계산**이라 갈릴 수 없다.
 *   ⚠️ 카카오 사장님·에이전시 직원은 여기 안 온다(3단계 리다이렉트가 마이·콘솔로 보낸다). 이 화면은
 *      마이가 없는 옛 계정과 콘솔 로그인이 없는 좌석의 길이다 — 지우면 그들이 갈 곳이 없어진다.
 */
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Globe, Home, LogOut, Settings } from 'lucide-react'
import SellerLayout from '@/components/SellerLayout'
import SellerSupportContact from '@/components/seller/SellerSupportContact'
import { useSellerNavModel } from '@/components/seller-layout/useSellerNavModel'
import { logoutSeller } from '@/lib/seller-auth'

const ROW = 'flex items-center gap-3 px-4 py-3.5 text-[14px] font-semibold text-gray-900 border-b border-rule last:border-b-0 active:bg-gray-50'

export default function SellerMorePage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { primary, moreGroups, ctaItem } = useSellerNavModel()
  const mainTabs = primary.filter((p) => p.key !== 'more')

  const handle = localStorage.getItem('user_handle')
  const goodHandle = !!handle && handle.length >= 3 && !['user', 'me', 'admin', 'seller', 'api', 'host', 'new'].includes(handle.toLowerCase())
  const sellerSlug = localStorage.getItem('seller_username') || localStorage.getItem('seller_id')
  const publicTarget = goodHandle ? `/u/${handle}` : (sellerSlug ? `/profile/${sellerSlug}` : null)

  const languages = [{ code: 'ko', label: '한국어' }, { code: 'en', label: 'English' }, { code: 'ja', label: '日本語' }, { code: 'zh', label: '中文' }, { code: 'es', label: 'Español' }, { code: 'fr', label: 'Français' }]

  return (
    <SellerLayout title={t('seller.layout.menu', { defaultValue: '전체 메뉴' })}>
      <div className="mx-auto max-w-5xl space-y-4">
        {/* 🎟️ 주 행동 — '이용권 등록'은 메뉴가 아니라 할 일이라 파란 버튼 한 자리(종전 사이드바 상단 CTA 를 옮겼다).
            역할별 노출 규칙 승계 — 그 역할에게 항목이 없으면 ctaItem 이 없어 버튼도 안 뜬다. */}
        {ctaItem && (
          <Link to={ctaItem.path} className="ur-btn ur-btn-primary ur-btn-md flex w-full items-center justify-center gap-1.5">
            <ctaItem.icon size={16} strokeWidth={2.4} />
            {t(ctaItem.labelKey)}
          </Link>
        )}

        {/* 🧭 다섯 대분류 중 넷 — 종전 하단 탭(폰)·사이드바 위쪽(PC). 더보기는 이 화면 자신이다. */}
        <section>
          <div className="overflow-hidden rounded-[var(--dash-radius,16px)] border border-rule bg-white">
            {mainTabs.map(({ key, path, label, icon: Icon }) => (
              <Link key={key} to={path} className={ROW}>
                <Icon size={18} className="shrink-0 text-gray-400" />
                <span className="flex-1 truncate">{label}</span>
                <ChevronRight size={16} className="shrink-0 text-gray-300" />
              </Link>
            ))}
          </div>
        </section>

        {moreGroups.map((group, gi) => (
          <section key={gi}>
            {group.labelKey && (
              <h2 className="mb-1.5 px-1 text-[12px] font-bold text-gray-400">{t(group.labelKey, { defaultValue: '' })}</h2>
            )}
            <div className="overflow-hidden rounded-[var(--dash-radius,16px)] border border-rule bg-white">
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
          <div className="overflow-hidden rounded-[var(--dash-radius,16px)] border border-rule bg-white">
            {/* 🏠 2026-07-16 (대표): 대시보드에서 유어딜 소비자 홈(/)으로 — 종전 머리줄 링크를 옮겼다. */}
            <Link to="/" className={ROW}>
              <Home size={18} strokeWidth={1.8} className="shrink-0 text-gray-400" />
              <span className="flex-1">{t('seller.mainService', { defaultValue: '유어딜 홈' })}</span>
              <ChevronRight size={16} className="shrink-0 text-gray-300" />
            </Link>
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
