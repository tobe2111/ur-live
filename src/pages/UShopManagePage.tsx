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
import { useTranslation } from '@/lib/i18n-lite'
import BrandLoader from '@/components/brand/BrandLoader'
import { curatorApi, type CuratorPageResponse, type CuratorPin } from '@/features/curator/api/curator-api'
import { fetchCuratorPage, getCuratorCache } from '@/features/curator/curator-page-cache'
import OwnerEarningsStrip from './curator-page/OwnerEarningsStrip'
import PinManageList from './curator-page/PinManageList'
import { openEmbedCode } from '@/shared/embed-code-link'
import { SectionTitle, ListPlate, ListRow } from './user-profile/list-grammar'
import { EditIcon, TicketStubIcon, ReceiptIcon, GridIcon } from '@/components/icons/urdeal-icons'

const EarnLadder = lazy(() => import('./curator-page/EarnLadder'))
const SellOwnProductsCTA = lazy(() => import('./curator-page/SellOwnProductsCTA'))
// 👤 프로필 편집은 **마이와 같은 시트**를 그 자리에서 띄운다(2026-10-13 대표 — 아래에서 올라오게, 이름은 "편집").
//   시트는 한 벌이다 — 편집 화면이 두 곳이 되면 한쪽에서 바꾼 이름이 다른 쪽에 옛 이름으로 남는다(A-2 결정의 이유).
const ProfileEditSheet = lazy(() => import('./user-profile/profile-edit/ProfileEditSheet'))

const rowIco = (I: typeof EditIcon) => <I className="w-[18px] h-[18px]" aria-hidden="true" />

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
  const [editOpen, setEditOpen] = useState(false)

  // 핸들이 없으면 대시보드가 알려 준다(UMeRedirectPage 와 같은 해석 경로).
  useEffect(() => {
    if (handle) return
    let alive = true
    curatorApi.getDashboard()
      .then((res) => { if (alive) setHandle((res as unknown as { handle?: string })?.handle ?? null) })
      .catch(() => { if (alive) navigate('/creator', { replace: true }) })
    return () => { alive = false }
  }, [handle, navigate])

  /** 시트를 닫으면 다시 읽는다 — 주소(핸들)를 바꿨으면 새 핸들로. */
  const closeEdit = () => {
    setEditOpen(false)
    const next = cachedHandle()
    if (next && next !== handle) { setHandle(next); return }
    if (handle) fetchCuratorPage(handle).then((res) => { if (res?.success) setData(res) }).catch(() => {})
  }

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
  const onPinDeleted = (id: number) =>
    setData(prev => prev ? { ...prev, pins: prev.pins.filter(p => p.id !== id) } : prev)
  const onReorder = (next: CuratorPin[]) =>
    setData(prev => prev ? { ...prev, pins: next } : prev)

  return (
    <div className="min-h-[100dvh] bg-warm text-gray-900 dark:text-white pb-16">
      {/* 상단 — 뒤로는 내 유어샵. 주소는 바뀔 수 있으니 항상 현재 handle 로 간다. */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-rule">
        <Link to={`/u/${curator.handle}`} aria-label={t('common.back', { defaultValue: '뒤로' })} className="text-[17px] leading-none text-gray-500 dark:text-gray-400 active:opacity-60">‹</Link>
        <h1 className="text-[15px] font-medium tracking-[-0.028em]">{t('ushop.manageTitle', { defaultValue: '유어샵 관리' })}</h1>
      </div>

      <div className="px-4">
        {/* 🧭 2026-10-13 (대표 *"유어샵에 관리페이지 들어가면 플로우가 복잡하게 되어있네"*):
            종전엔 같은 일이 두 줄씩이었다 — '순서 바꾸기'·'담은 이용권 관리'가 **같은 모드**를 열었고,
            수익 화면은 위 카드('콘솔 ›')와 아래 '대시보드' 줄로 **두 번** 링크됐고, 그 '대시보드'는
            '내 가게' 제목 밑에 있어 가게 관리처럼 읽혔다. 프로필 줄은 마이로 **화면을 통째로 이동**했다.
            ⇒ 세 묶음(내 유어샵 · 수익과 정산 · 내 가게), 줄마다 할 일 하나, 마이와 같은 목록 문법. */}
        <div className="mt-6"><SectionTitle>{t('ushop.manageMyShop', { defaultValue: '내 유어샵' })}</SectionTitle></div>
        {reorder ? (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[15px] font-medium">{t('ushop.manageReorderTitle', { defaultValue: '담은 이용권 정리' })}</span>
              <button onClick={() => setReorder(false)} className="px-4 h-9 rounded-full bg-brand text-white text-[13px] font-medium active:opacity-80">
                {t('curator.done', { defaultValue: '완료' })}
              </button>
            </div>
            <PinManageList pins={pins} onReorder={onReorder} onDeleted={onPinDeleted} />
          </div>
        ) : (
          <ListPlate className="mt-3">
            {/* 👤 대표 *"프로필 편집에서 가 아니라 그냥 편집 이라고 해두면 되지"* — 누르면 그 자리에서 시트가 올라온다. */}
            <ListRow icon={rowIco(EditIcon)} label={t('ushop.manageProfile', { defaultValue: '이름, 소개, 주소, SNS' })} hint={t('ushop.manageEdit', { defaultValue: '편집' })} onClick={() => setEditOpen(true)} />
            <ListRow icon={rowIco(TicketStubIcon)} label={t('ushop.manageAdd', { defaultValue: '이용권 담기' })} hint={pins.length > 0 ? t('ushop.manageAddCount', { defaultValue: '{{n}}개 담음', n: pins.length }) : undefined} to="/u/me/add" />
            {pins.length > 0 && (
              <ListRow icon={rowIco(TicketStubIcon)} label={t('ushop.managePins', { defaultValue: '담은 이용권 정리' })} hint={t('ushop.managePinsHint', { defaultValue: '순서·삭제' })} onClick={() => setReorder(true)} />
            )}
            {/* 🧩 2026-11-01 — 내 블로그·홈페이지에 유어샵을 띄우는 코드. 담은 게 없어도 보여준다
                (내 가게 이용권이 대신 뜬다). 종전엔 `/embed` 에 들어가 아이디를 타이핑해야 했다. */}
            <ListRow icon={rowIco(GridIcon)} label={t('ushop.manageEmbed', { defaultValue: '홈페이지에 넣기' })}
              hint={t('ushop.manageEmbedHint', { defaultValue: '코드 받기' })}
              onClick={() => openEmbedCode('ushop', curator.handle)} />
          </ListPlate>
        )}

        {/* 💰 돈은 한 묶음 — 두 화면이 각각 무엇인지 이름으로 말한다(장부가 둘이라 화면도 둘이다). */}
        <div className="mt-8"><SectionTitle>{t('ushop.manageMoney', { defaultValue: '수익과 정산' })}</SectionTitle></div>
        {/* 적립 카드(최근 30일)가 담은 이용권 수익 화면의 입구다 — 같은 화면으로 가는 줄을 따로 두지 않는다. */}
        <div className="mt-3"><OwnerEarningsStrip /></div>
        <ListPlate className="mt-3">
          <ListRow icon={rowIco(ReceiptIcon)} label={t('ushop.manageSettleRow', { defaultValue: '매장 소개 정산' })} hint={t('ushop.manageSettleHint', { defaultValue: '계좌·세금' })} to="/influencer/settlement" />
        </ListPlate>

        {/* 돈 버는 길 — 빈 샵일수록 필요하다(2026-08-27 대표 확정). pins 로 막지 않는다. */}
        <div className="mt-8" />
      </div>
      <Suspense fallback={null}><EarnLadder dealCount={dealCount} pinCount={pins.length} /></Suspense>

      <div className="px-4">
        <div className="mt-8"><SectionTitle>{t('ushop.manageMyStore', { defaultValue: '내 가게' })}</SectionTitle></div>
        <div className="mt-3"><Suspense fallback={null}><SellOwnProductsCTA /></Suspense></div>

        <p className="pt-8 text-[12px] text-gray-400 dark:text-gray-500 leading-[1.7]">
          {t('ushop.manageFoot', { defaultValue: '담은 이용권이 팔리면 소개비가 자동으로 쌓입니다.' })}
        </p>
      </div>

      {editOpen && (
        <Suspense fallback={null}>
          <ProfileEditSheet onClose={closeEdit} initialName={curator.name || ''} onNameChange={(name) => setData(prev => prev ? { ...prev, curator: { ...prev.curator, name } } : prev)} />
        </Suspense>
      )}
    </div>
  )
}
