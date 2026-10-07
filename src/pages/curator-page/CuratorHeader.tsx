/**
 * 유어샵 헤더 — `/u/:handle` (개인·사업자 공통. 헤더는 하나다).
 *
 * 🎫 2026-09-28 (대표 확정 **s3 + a3 + b2 + c2 + e3**): 11라운드 37안 끝에 닫힌 결정을 그대로 옮긴 것.
 *   ① **`urdeal` 브랜드 바**(a3) — 로고는 홈 링크(`<Link to="/">`).
 *      🩸 2026-09-30 두 가지를 고쳤다(대표 *"유어딜 로고 좌측 상단에 있는거 왜 제대로 적용이 안됐지?
 *      검색, 찜, 내 이용권은 없어도 되고"*):
 *        ⓐ **로고가 로고가 아니었다** — `urdeal` 을 그냥 텍스트로 적어 놓아서 라이브 실측이
 *           `font: Pretendard`(Poppins 아님) · `dot: false`(브랜드 원 마침표 없음)였다. 폰트는 이미
 *           로드돼 있었는데(`poppinsLoaded: true`) 이 자리만 안 쓰고 있었다 — **배선 누락**이다.
 *           ⇒ 워드마크 SSOT `<UrDealLogo/>` 로 교체. 손으로 다시 적으면 또 갈린다.
 *        ⓑ **GNB 세 개(검색·찜·내 이용권) 제거** — 하단 탭이 같은 곳을 이미 담고, 남의 가게에 와서
 *           가장 눈에 띄는 자리에 **유어딜로 나가는 링크 셋**을 두면 손님을 밖으로 내보내는 셈이다.
 *   ② **면으로 구분**(b2) — 헤더 안 가로선 **0개**.
 *      ⚠️ 2026-09-30 로 그 전제가 **바뀌었다**: 대표가 한 톤을 확정해(*"아예 모두 똑같이 배경색을
 *      카드 색상이랑 같게"*) 헤더와 본문이 같은 `bg-surface` 다. 이제 맞닿는 자리가 안 보이므로
 *      chrome 과 목록을 나누는 일은 **본문 탭 줄의 실선 하나**가 한다(`CuratorPage`). 헤더는 여전히 선 0개.
 *   ③ **주소 텍스트 없음**(대표: *"링크를 적지 말고 그냥 공유하기 버튼 하나로 둬줘"*) — 주소는
 *      읽으라고 있는 게 아니라 **보내라고** 있는 것이라 [공유] 버튼이 대신한다.
 *   ④ **버튼 두 자리**(c2) — `[⤴ 공유]`(항상) + `[관리]`(주인만, `/u/me/manage`).
 *      공유는 방문자에게도 보인다 — 손님이 친구에게 넘기는 것이 유어샵의 확산 경로다.
 *      ⇒ "주인/방문자 차이는 버튼 한 자리" 의 **그 한 자리는 `관리`** 다.
 *   ⑤ **아바타 제거**(9차) — 라이브 대부분이 프로필 사진이 없어 그 자리는 사실상 항상 이니셜 원이었다.
 *      사람을 보여주는 게 아니라 **사람이 없다는 걸 보여주는** 자리였다.
 *   ⑥ 🩸 **흐르는 문구(마퀴) 제거**(2026-09-29 대표 *"배고프다 뭐먹지?는 아예 빼기"*) —
 *      맨 위 30px 풀블리드 띠였고, 라이브 실측에서 그 띠가 **순수 검정 `#000000`** 이었다.
 *      우리 팔레트에 없는 값이고(다크 바탕은 `#11141C`), 화면 첫인상을 그 띠가 전부 먹었다.
 *      같은 문구가 세 번 반복해 흐르는 모양이라 정보가 아니라 **소음**이었다.
 *      ⚠️ 표시 자리가 0이 되므로 `/u/me/manage` 의 '흐르는 문구' 편집 칸도 **같은 커밋에서** 뺐다 —
 *      안 그러면 주인이 아무도 못 보는 값을 계속 입력한다(이 레포가 반복해 당한 "조용한 부재").
 *      `curator.accent`(액센트 색)는 이 띠가 **유일한 소비처**였어서 파생값도 함께 사라졌다.
 *      서버 필드(`headline`/`accent`)는 그대로 둔다 — 되살릴 때 값이 남아 있어야 한다.
 *
 * 🔧 **인라인 편집은 여기 없다**(e3). 이름·소개·주소·SNS·흐르는 문구는 전부 `/u/me/manage` 로 나갔다 —
 *    종전엔 이 헤더가 손님 화면 위에 편집 어포던스를 덧칠해 주인/손님 화면이 갈렸다.
 *    🔴 소유권은 종전 그대로 **prop 으로만** 받는다(`check-linkshop-ownership` ③ — seller_token 미참조).
 */

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Share2 } from 'lucide-react'
import VerifiedSeal from '@/components/VerifiedSeal'
import UrDealLogo from '@/components/brand/UrDealLogo'
import { EditIcon } from '@/components/icons/urdeal-icons'
import { snsUrl } from '@/utils/sns-url'

interface CuratorHeaderProps {
  curator: {
    id: number
    handle: string
    name: string
    bio: string | null
    profile_image: string | null
    banner_url?: string | null
    headline?: string | null
    accent?: string | null
    youtube_url?: string | null
    instagram_url?: string | null
    tiktok_url?: string | null
  }
  /** 주인 여부. true 면 `[관리]` 버튼 한 자리가 늘어난다(그게 유일한 차이). */
  canEdit?: boolean
  /** 숫자 한 줄 — 담은 이용권 / 내 상품. 0 은 그리지 않는다. */
  counts?: { pins?: number; products?: number }
  accountType?: 'user' | 'business'
  /** 공유 — `navigator.share` 있으면 시트, 없으면 링크 복사(호출부가 정한다). */
  onCopyLink: () => void
}

/**
 * 🔵 2026-10-07 (대표 *"여기 관리, 공유 버튼이 촌스럽네.."* → 시안 셋 중 **안 C 확정**) — **위계**.
 *
 * ■ 무엇이 촌스러웠나 (390px 렌더 실측)
 *   한 줄에 **모양 2종 · 높이 2종**이 섞여 있었다 — SNS 는 테두리 없는 36px 원,
 *   공유·관리는 **테두리 친 31px 알약**. 게다가 둘이 같은 무게라, 주인에게 유일하게
 *   중요한 `관리` 가 누구나 보는 `공유` 와 구분되지 않았다(c2 가 *"그 한 자리"* 라고
 *   정해 둔 바로 그 버튼인데 눈으로는 한 자리가 아니었다).
 *
 * ■ 안 C
 *   - **공유는 SNS 와 같은 모양**(`iconBtnCls` — 같은 상수를 쓴다. 따로 적으면 반드시 갈린다).
 *   - **관리만 채운다** — 이 줄에서 유일하게 색이 있는 면. 🎫 규칙 ②(강조색 하나) 그대로이고,
 *     주 버튼 색 규칙(`bg-brand text-white`)을 손으로 검정 적지 않고 지킨다.
 *   ⚠️ 테두리를 뗀 것은 규칙 ①(카드 테두리 0)과 같은 방향이다 — 여기선 `shadow-lift` 도 안 준다
 *     (떠 있는 면이 아니라 **줄 안의 버튼**이다).
 */
const iconBtnCls = 'w-9 h-9 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-wash active:opacity-70 transition-colors'
const manageBtnCls = 'h-9 px-3 rounded-full bg-brand text-white text-[15px] font-bold inline-flex items-center gap-1 shrink-0 active:opacity-70'

export default function CuratorHeader({ curator, canEdit, counts, accountType, onCopyLink }: CuratorHeaderProps) {
  const { t } = useTranslation()
  const hasSns = !!(curator.youtube_url || curator.instagram_url || curator.tiktok_url)
  const showCounts = (counts?.pins ?? 0) > 0 || (counts?.products ?? 0) > 0

  /** SNS 링크 — 이름 줄의 버튼 그룹에 들어간다(전용 줄을 쓰지 않는다. 위 🔧 참조). */
  const snsLinks = hasSns ? (
    <>
      {curator.youtube_url && (
              <a href={snsUrl('youtube', curator.youtube_url)} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className={iconBtnCls}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" /></svg>
          </a>
      )}
      {curator.instagram_url && (
              <a href={snsUrl('instagram', curator.instagram_url)} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={iconBtnCls}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="3.7" /><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" /></svg>
          </a>
      )}
      {curator.tiktok_url && (
              <a href={snsUrl('tiktok', curator.tiktok_url)} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className={iconBtnCls}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 3c.3 2.2 1.6 3.9 3.8 4.1v2.6c-1.3.1-2.5-.3-3.8-1v5.7c0 4.4-3.4 6.9-6.9 5.8-3.2-1-4.1-5-1.7-7.2 1-.9 2.4-1.3 3.8-1.1v2.7c-.4-.1-.8-.1-1.2 0-1.2.3-1.7 1.4-1.3 2.5.4 1.1 1.8 1.5 2.7.7.5-.4.7-1 .7-1.7V3h3.9Z" /></svg>
          </a>
      )}
    </>
  ) : null

  return (
    <header className="bg-surface">
      <div className="max-w-3xl mx-auto">
        {/* ① 브랜드 바 — 로고 = 홈. 표시로 꾸미지 않는다(로고=홈은 웹 관례라 밑줄·화살표가 군더더기다).
            🖥️ 2026-09-28 (대표 *"둘 다 고치고"*): **PC 에서는 안 그린다.** lg+ 에서는 화면 맨 위에
            전역 네비(`DesktopTopNav` — `urdeal.` + 검색·찜·장바구니·알림)가 이미 있는데 이 줄이
            좌측 프로필 카드 **안에서** 같은 말을 또 해서, 1440px 실측에서 소비자 상단 바가
            화면에 **두 번** 있었다. 이 줄은 a3 의 **모바일용** 브랜드 바다.
            ⚠️ `?embed=1`(깨끗한 매장 링크)은 PC 에서도 전역 네비가 없지만, 그 모드의 목적 자체가
               "유어딜 chrome 을 안 보여 준다" 라 여기서도 안 그리는 쪽이 맞다. */}
        <div className="lg:hidden flex items-center px-4 pt-3">
          <Link to="/" aria-label={t('nav.homeAria', { defaultValue: '유어딜 홈' })} className="active:opacity-70">
            <UrDealLogo size={19} />
          </Link>
        </div>

        {/* ③④ 상호명 줄 — 그 위 선 없음(면으로 나뉜다). 오른쪽이 버튼 자리. */}
        <div className="flex items-start px-4 pt-4 pb-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2 min-w-0">
              {/* 🩸 2026-09-30 렌더 실측: `truncate` 라 주인 화면(SNS 2 + 공유 + 관리)에서 왼쪽 칸이 156px 가 되고
                  "지원의 동네가게" 가 **"지원의 동네…"** 로 잘렸다. 가게 이름은 이 화면의 정체 자체다.
                  대표 제약은 *"이름 크기는 그대로"*(17px)·*"SNS 버튼들 위치도 그대로"* 라 둘 다 안 건드리고
                  **두 줄까지 허용**한다(`line-clamp-2`) — 크기도 자리도 안 옮기면서 이름이 다 보인다. */}
              <h1 className="text-[17px] font-bold text-gray-900 dark:text-white leading-tight tracking-[-0.03em] line-clamp-2">{curator.name}</h1>
              {accountType === 'business' && <VerifiedSeal size={17} className="shrink-0" />}
            </div>
            {curator.bio && (
              <p className="mt-1 text-[12px] text-gray-600 dark:text-gray-300 leading-snug line-clamp-2">{curator.bio}</p>
            )}
            {showCounts && (
              <p className="mt-1 text-[12px] text-gray-400 dark:text-gray-500 tabular-nums">
                {(counts?.pins ?? 0) > 0 && <span>{t('curator.countPins', { defaultValue: '담은 이용권' })} {counts!.pins}</span>}
                {(counts?.pins ?? 0) > 0 && (counts?.products ?? 0) > 0 && <span> · </span>}
                {(counts?.products ?? 0) > 0 && <span>{t('curator.countProducts', { defaultValue: '내 상품' })} {counts!.products}</span>}
              </p>
            )}
          </div>
          {/* 🔧 2026-09-28 (대표 확정 **상단 1안**): SNS 아이콘이 **자기 줄을 통째로** 쓰고 있었다
              (라이브 실측 36px + 여백 = 48px). 아이콘 두세 개를 위해 줄 하나를 쓰는 건 비싸서
              이름 줄의 버튼 자리로 올린다. 공유·관리 버튼은 **그대로 있다**(대표 확인 요청 사항).
              주인 화면 최악(이름 10자 + SNS 3 + 공유 + 관리)에서 오른쪽 끝 374/390px 로 안 잘린다
              (실측: 이름 칸이 `flex-1 truncate` 라 넘치는 대신 이름이 줄어든다 — 112px 남음). */}
          <div className="ml-3 flex items-center gap-2 shrink-0">
            {snsLinks}
            <button
              type="button"
              onClick={onCopyLink}
              className={iconBtnCls}
              aria-label={t('curator.share', { defaultValue: '공유' })}
            >
              <Share2 className="w-[18px] h-[18px]" strokeWidth={1.6} aria-hidden="true" />
            </button>
            {canEdit && (
              <Link to="/u/me/manage" className={manageBtnCls}>
                <EditIcon size={17} aria-hidden="true" />
                {t('curator.manage', { defaultValue: '관리' })}
              </Link>
            )}
          </div>
        </div>

      </div>
    </header>
  )
}
