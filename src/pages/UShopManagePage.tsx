/**
 * 🔧 2026-09-28 (대표 확정 **e3** — "E3로 하고 /u/me/manage 신설해줘"): 유어샵 관리 화면.
 *
 * 왜 별도 화면인가: 종전 [유어샵 편집]은 손님이 보는 화면 **위에 관리 chrome 다섯 덩어리**를 덧칠했다.
 * 그래서 ① 주인이 보는 화면과 손님이 보는 화면이 갈리고 ② 절제 규율(s3 — 색면 최소·볼륨 낮게)과
 * 정면으로 부딪쳤다. e3 는 둘을 나눈다:
 *   · `/u/{handle}` = **손님 화면 하나뿐**. 주인이 봐도 똑같고 버튼 한 자리만 `관리` 다.
 *   · `/u/me/manage` = 여기. 손님이 안 보므로 관리 기능을 좁은 칸에 욱여넣지 않아도 된다.
 *
 * 🔴 소유권 신호는 종전 그대로다 — 이 화면은 `ProtectedRoute requireUser` 뒤에 있고 본인 핸들만 연다.
 *    `seller_token` 은 보지 않는다(`check-linkshop-ownership` — 유어샵 소유권 = 로그인 소비자 유저).
 */

import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import BrandLoader from '@/components/brand/BrandLoader'
import { curatorApi, type CuratorPageResponse, type CuratorPin } from '@/features/curator/api/curator-api'
import { fetchCuratorPage, getCuratorCache } from '@/features/curator/curator-page-cache'
import OwnerEarningsStrip from './curator-page/OwnerEarningsStrip'
import PinManageList from './curator-page/PinManageList'
import ShopInfoCards from './ushop-manage/ShopInfoCards'

const EarnLadder = lazy(() => import('./curator-page/EarnLadder'))
const SellOwnProductsCTA = lazy(() => import('./curator-page/SellOwnProductsCTA'))

const secCls = 'px-4 pt-6 pb-2 text-[12px] font-bold text-gray-400 dark:text-gray-500'
const cardCls = 'mx-4 rounded-xl bg-surface shadow-lift overflow-hidden'
const rowCls = 'w-full flex items-center gap-2 px-4 py-3 border-t border-rule first:border-t-0 text-left'
const keyCls = 'text-[13px] font-semibold text-gray-900 dark:text-white'
const valCls = 'ml-auto min-w-0 truncate text-[12px] text-gray-400 dark:text-gray-500'
const chev = <span className="text-[12px] text-gray-400 dark:text-gray-500">›</span>

/** 로컬 캐시 핸들 — 유어샵에서 [관리]로 들어온 경우 즉시 페인트(왕복 0). 없으면 대시보드로 해석. */
function cachedHandle(): string | null {
  try { return localStorage.getItem('user_handle') } catch { return null }
}

export default function UShopManagePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [handle, setHandle] = useState<string | null>(cachedHandle)
  const [data, setData] = useState<CuratorPageResponse | null>(() => {
    const h = cachedHandle()
    return h ? getCuratorCache(h) : null
  })
  const [loading, setLoading] = useState(!data)
  const [reorder, setReorder] = useState(false)

  // 핸들이 없으면 대시보드가 알려 준다(UMeRedirectPage 와 같은 해석 경로).
  useEffect(() => {
    if (handle) return
    let alive = true
    curatorApi.getDashboard()
      .then((res) => { if (alive) setHandle((res as unknown as { handle?: string })?.handle ?? null) })
      .catch(() => { if (alive) navigate('/creator', { replace: true }) })
    return () => { alive = false }
  }, [handle, navigate])

  useEffect(() => {
    if (!handle) return
    let alive = true
    if (data?.curator?.handle !== handle) setLoading(true)
    fetchCuratorPage(handle)
      .then((res) => { if (alive && res?.success) setData(res) })
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [handle])

  if (loading || !data?.curator) return <BrandLoader fullScreen />

  const { curator, pins } = data
  const dealCount = pins.filter(p => Number(p.deal_pct) > 0).length
  const onCuratorUpdate = (next: Partial<typeof curator>) =>
    setData(prev => prev ? { ...prev, curator: { ...prev.curator, ...next } } : prev)
  const onPinDeleted = (id: number) =>
    setData(prev => prev ? { ...prev, pins: prev.pins.filter(p => p.id !== id) } : prev)
  const onReorder = (next: CuratorPin[]) =>
    setData(prev => prev ? { ...prev, pins: next } : prev)

  return (
    <div className="min-h-[100dvh] bg-warm text-gray-900 dark:text-white pb-16">
      {/* 상단 — 뒤로는 내 유어샵. 주소는 바뀔 수 있으니 항상 현재 handle 로 간다. */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-rule">
        <Link to={`/u/${curator.handle}`} aria-label={t('common.back', { defaultValue: '뒤로' })} className="text-[17px] leading-none text-gray-500 dark:text-gray-400 active:opacity-60">‹</Link>
        <h1 className="text-[15px] font-semibold tracking-[-0.028em]">{t('ushop.manageTitle', { defaultValue: '유어샵 관리' })}</h1>
      </div>

      {/* 적립 — 이 화면의 첫 숫자다(손님 화면에서는 뺐다). 기간은 카드가 스스로 말한다(최근 30일). */}
      <div className={secCls}>{t('ushop.manageEarnings', { defaultValue: '적립' })}</div>
      <div className="px-4"><OwnerEarningsStrip /></div>

      <div className={secCls}>{t('ushop.manageMyShop', { defaultValue: '내 샵' })}</div>
      <ShopInfoCards curator={curator} onCuratorUpdate={onCuratorUpdate} />

      <div className={secCls}>{t('ushop.manageVouchers', { defaultValue: '이용권' })} {pins.length}</div>
      {reorder ? (
        <div className="px-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-bold">{t('curator.reorderTitle', { defaultValue: '핀 순서 바꾸기' })}</span>
            <button onClick={() => setReorder(false)} className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-white text-warm text-[12px] font-bold active:opacity-80">
              {t('curator.done', { defaultValue: '완료' })}
            </button>
          </div>
          <PinManageList pins={pins} onReorder={onReorder} onDeleted={onPinDeleted} />
        </div>
      ) : (
        <div className={cardCls}>
          <Link to="/u/me/add" className={rowCls}>
            <span className={keyCls}>{t('ushop.manageAdd', { defaultValue: '이용권 담기' })}</span>
            <span className={valCls}>{t('ushop.manageAddMore', { defaultValue: '더 담기' })}</span>{chev}
          </Link>
          {pins.length > 1 && (
            <button type="button" onClick={() => setReorder(true)} className={rowCls}>
              <span className={keyCls}>{t('ushop.manageReorder', { defaultValue: '순서 바꾸기' })}</span>{chev}
            </button>
          )}
          {pins.length > 0 && (
            <button type="button" onClick={() => setReorder(true)} className={rowCls}>
              <span className={keyCls}>{t('ushop.managePins', { defaultValue: '담은 이용권 관리' })}</span>
              <span className={valCls}>{t('ushop.managePinsHint', { defaultValue: '삭제 · 순서' })}</span>{chev}
            </button>
          )}
        </div>
      )}

      {/* 돈 버는 길 — 빈 샵일수록 필요하다(2026-08-27 대표 확정). pins 로 막지 않는다.
          섹션 라벨은 안 붙인다 — 이 블록이 자체 제목("내 유어샵으로 버는 법")을 갖고 있어 같은 말이 두 번 된다. */}
      <div className="pt-6" />
      <Suspense fallback={null}><EarnLadder dealCount={dealCount} pinCount={pins.length} /></Suspense>

      <div className={secCls}>{t('ushop.manageMyStore', { defaultValue: '내 가게' })}</div>
      <div className="px-4"><Suspense fallback={null}><SellOwnProductsCTA /></Suspense></div>
      <div className={`${cardCls} mt-3`}>
        <Link to="/u/me/earnings" className={rowCls}>
          <span className={keyCls}>{t('curator.dashboardBtn', { defaultValue: '수익 대시보드' })}</span>{chev}
        </Link>
      </div>

      <p className="px-4 pt-6 text-[12px] text-gray-400 dark:text-gray-500 leading-[1.7]">
        {t('ushop.manageFoot', { defaultValue: '담은 이용권이 팔리면 소개비가 자동으로 쌓입니다.' })}
      </p>
    </div>
  )
}
