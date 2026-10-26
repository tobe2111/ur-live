/**
 * 🎟️ 교환권 페이지 머리 — 2026-10-14 대표 확정 **안 C "배너가 머리"** (모바일).
 *
 * 대표: *"위에 저렇게 교환권 이라고 적혀있는거 별로인 것 같아. 보관함, 검색 버튼 다른 곳으로 적재적소에
 *   옮겨주고, 배너 위치도 그렇고"* → 시안 넷(A·B·C·D) 중 *"교환권 C 배너가 머리 이거 좋다"*.
 *
 * 무엇이 바뀌었나:
 *   - 제목 "교환권" 줄을 없앴다 — 바로 아래 하단 탭이 같은 말을 한다.
 *   - 맨 위가 꽉 찬 배너. 검색·보관함은 그 위 오른쪽에 뜬다.
 *   - 잔액 카드가 배너 아래 끝(28px)에 걸쳐 올라온다.
 *
 * 📐 자리는 **응답 전부터** 잡는다 — 배너는 `/api/banners` 응답 뒤에 오는데, 그때 자리를 만들면 그 아래
 *   잔액·칩·목록이 통째로 196px 밀린다. 그래서 '아직 모름'(`settled=false`) 동안 같은 높이의 어두운 판을
 *   세워 두고 배너가 오면 그 안에 그린다. 서버 첫 화면(`worker/utils/vouchers-first-screen.ts`)도 같은
 *   판을 같은 클래스로 그린다(`VOUCHERS_HERO_CLS` — 시험이 대조).
 *   ⚠️ 응답이 왔는데 0장이면 그때 접는다(어드민이 교환권 배너를 전부 내린 경우 — 한 번 밀린다. 드물다).
 *
 * 🚫 보관함에 개수 배지를 달지 않는다 — 그 숫자 하나를 위해 첫 화면에 요청이 하나 늘어난다
 *   (`check-duplicate-fetch` 가 지키는 첫 화면 요청 수).
 */
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { WalletIcon } from '@/components/icons/urdeal-icons'
import { useTranslation } from '@/lib/i18n-lite'
import { useHomeBannersState } from '@/components/home/useHomeBanners'
import { BannerHeroRail } from '@/components/home/HomeBannerStrip'

export const VOUCHERS_HERO_CLS = {
  /** 배너 판 — 높이 196 = 아이콘 줄 + 제목 두 줄 + 잔액 카드가 걸칠 28. */
  hero: 'relative h-[196px] overflow-hidden bg-gray-900 dark:bg-surface',
  /** 잔액 카드가 배너 아래 끝에 걸친다. */
  overlap: 'relative z-10 -mt-7 px-5',
  /** 배너가 0장일 때 — 아이콘만 오른쪽에. */
  bareBar: 'flex items-center justify-end px-2 pt-2',
  bareBalance: 'px-5 pt-1',
  actions: 'absolute right-2 top-2 z-10 flex items-center gap-1',
} as const

function HeroActions({ onPhoto }: { onPhoto: boolean }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  // 사진 위에서는 흰 아이콘 + 반투명 원(어떤 사진이 올라와도 읽힌다). 사진이 없으면 잉크.
  const btn = onPhoto
    ? 'w-10 h-10 rounded-full flex items-center justify-center bg-black/30 text-white backdrop-blur-[6px] active:opacity-70'
    : 'w-11 h-11 rounded-full flex items-center justify-center text-gray-900 dark:text-white active:opacity-60'
  return (
    <>
      <button type="button" onClick={() => navigate('/search?scope=exchange')} aria-label={t('common.search', { defaultValue: '검색' })} className={btn}>
        <Search className="w-[22px] h-[22px]" strokeWidth={1.6} />
      </button>
      <button type="button" onClick={() => navigate('/my-gifticons')} aria-label={t('voucher.myBox', { defaultValue: '보관함' })} className={btn}>
        <WalletIcon className="w-[22px] h-[22px]" />
      </button>
    </>
  )
}

export default function VouchersHero({ children }: { children: ReactNode }) {
  const { banners, settled } = useHomeBannersState('vouchers')
  const C = VOUCHERS_HERO_CLS

  if (settled && banners.length === 0) {
    return (
      <>
        <div className={C.bareBar}><HeroActions onPhoto={false} /></div>
        <div className={C.bareBalance}>{children}</div>
      </>
    )
  }
  return (
    <>
      <div className={C.hero}>
        {banners.length > 0 && <BannerHeroRail banners={banners} />}
        <div className={C.actions}><HeroActions onPhoto /></div>
      </div>
      <div className={C.overlap}>{children}</div>
    </>
  )
}
