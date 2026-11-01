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
 *   ⑤ ~~**아바타 제거**(9차)~~ → 🔄 **2026-10-14 대표 확정 A 로 되살렸다**(아래 `avatarCls` 주석).
 *      9차의 이유(사진 없는 유어샵은 이니셜 원뿐)는 **유달이**로 채워 해소한다 — 이니셜 원은 쓰지 않는다.
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
import { useTranslation } from '@/lib/i18n-lite'
import { Share2 } from 'lucide-react'
import VerifiedSeal from '@/components/VerifiedSeal'
import UrDealLogo from '@/components/brand/UrDealLogo'
import { EditIcon } from '@/components/icons/urdeal-icons'
import { snsUrl } from '@/utils/sns-url'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { formatNumber } from '@/utils/format'
import { SHARE_MASCOT_SRC } from '@/shared/ushop-share-card'
import { ushopNameSizePx } from '@/shared/ushop-name-size'

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
  /** 누적 구매 — 이 유어샵에 진열된 이용권들이 팔린 횟수의 합(상품 `sold_count` 합). 0 이면 안 그린다. */
  soldTotal?: number
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

/**
 * 👤 2026-10-14 (대표 확정 **유어샵 A · 얼굴 있는 머리** — 시안 `docs/design/consumer-pages-2026-10-14.md` §5).
 *   9차(2026-09-28)에 아바타를 뺀 이유는 *"라이브 대부분이 사진이 없어 이니셜 원만 떴다"* 였다.
 *   A 는 그 빈자리를 **유달이**로 채운다 — 공유 카드(`ushopShareImage`)가 사진 없는 유어샵에 쓰는
 *   **같은 그림**(`SHARE_MASCOT_SRC`)이라 카톡방에서 본 얼굴과 들어와서 본 얼굴이 같다.
 *   SNS 는 이름 줄 오른쪽 아이콘 → **이름 아래 줄의 작은 이름표**로 내려간다(그 줄 왼쪽은 숫자 한 줄).
 */
const avatarCls = 'w-10 h-10 rounded-full overflow-hidden bg-wash shrink-0'
/** 이름표 하나의 탭 영역(36px — 2026-09-16 의 하한 34px 를 지킨다). 보이는 알약은 안쪽 `snsPillCls`. */
const snsHitCls = 'h-9 inline-flex items-center active:opacity-70'
const snsPillCls = 'h-8 px-3 rounded-full bg-wash inline-flex items-center gap-1 text-[13px] font-medium text-gray-600 dark:text-gray-300'

export default function CuratorHeader({ curator, canEdit, counts, soldTotal, accountType, onCopyLink }: CuratorHeaderProps) {
  const { t } = useTranslation()
  // 🔒 그 플랫폼 주소가 아니면 이름표를 안 그린다(2026-10-26 — 서버 첫 화면도 같은 판정).
  const ytHref = snsUrl('youtube', curator.youtube_url), igHref = snsUrl('instagram', curator.instagram_url), tkHref = snsUrl('tiktok', curator.tiktok_url)
  const hasSns = !!(ytHref || igHref || tkHref)
  const pinsN = counts?.pins ?? 0
  const productsN = counts?.products ?? 0
  const sold = soldTotal ?? 0
  const showStats = pinsN > 0 || productsN > 0 || sold > 0
  const photo = curator.profile_image ? cfImage(curator.profile_image, { width: 80, height: 80, fit: 'cover' }) : null
  // 🏷️ 2026-11-01 (대표 확정 2안): 이름 글자 크기는 **글자만 보고** 정한다 — 워커 첫 화면이
  //   같은 함수를 쓰므로 마운트 때 크기가 안 바뀌고, 따라서 머리 높이도 안 튄다.
  const nameSize = ushopNameSizePx(curator.name)

  /** SNS 이름표 — 이름 아래 줄 오른쪽. 브랜드 이름은 번역하지 않는다. */
  const snsLinks = hasSns ? (
    <>
      {ytHref && (
        <a href={ytHref} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className={snsHitCls}>
          <span className={snsPillCls}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" /></svg>
            YouTube
          </span>
        </a>
      )}
      {igHref && (
        <a href={igHref} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={snsHitCls}>
          <span className={snsPillCls}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="3.7" /><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" /></svg>
            Instagram
          </span>
        </a>
      )}
      {tkHref && (
        <a href={tkHref} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className={snsHitCls}>
          <span className={snsPillCls}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.5 3c.3 2.2 1.6 3.9 3.8 4.1v2.6c-1.3.1-2.5-.3-3.8-1v5.7c0 4.4-3.4 6.9-6.9 5.8-3.2-1-4.1-5-1.7-7.2 1-.9 2.4-1.3 3.8-1.1v2.7c-.4-.1-.8-.1-1.2 0-1.2.3-1.7 1.4-1.3 2.5.4 1.1 1.8 1.5 2.7.7.5-.4.7-1 .7-1.7V3h3.9Z" /></svg>
            TikTok
          </span>
        </a>
      )}
    </>
  ) : null

  /**
   * ⤴️ 버튼 묶음 — 2026-11-01 (대표 확정 **2안**) 부터 **로고 줄 오른쪽**에 산다.
   *   종전엔 이름과 같은 줄이라 이름 칸을 132px 로 조였다(그게 두 줄의 원인이다).
   *   🪑 2026-10-09 의 **`관리` 자리 예약은 여기서 사라진다** — 그 예약이 지키던 것은
   *      *"이름 칸 폭이 주인/방문자에서 같다"* 였는데, 버튼이 이름 줄을 떠난 지금은 **구조적으로**
   *      같다(이름 칸 = 폭 − 얼굴 − gap, 버튼과 무관). 줄 높이도 공유(h-9)와 관리(h-9)가 같아
   *      안 바뀐다. 예약을 남기면 PC 프로필 열에서 공유 아이콘이 빈 알약만큼 **왼쪽으로 밀린다**(실측).
   *      ⚠️ 버튼을 이름 줄로 되돌리면 그 예약도 같이 되살려야 한다.
   */
  const cluster = (
    <div className="ml-auto flex items-center gap-2 shrink-0">
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
  )

  return (
    <header className="bg-surface dark:bg-warm">
      <div className="max-w-3xl mx-auto">
        {/* ① 맨 윗줄 — [로고(모바일만)] … [공유 · 관리].
            🖥️ **로고는 PC 에서 안 그린다**(2026-09-28 대표 *"둘 다 고치고"*): lg+ 에는 화면 맨 위에
            전역 네비(`DesktopTopNav` — `urdeal.` + 검색·찜·장바구니·알림)가 이미 있는데 이 줄이
            좌측 프로필 카드 **안에서** 같은 말을 또 해서, 1440px 실측에서 소비자 상단 바가
            화면에 **두 번** 있었다. ⚠️ `?embed=1` 도 마찬가지로 안 그린다(그 모드의 목적이
            "유어딜 chrome 을 안 보여 준다" 다).
            🔄 2026-11-01 (대표 확정 **2안**): 줄 **자체는 PC 에서도 그린다** — 버튼 묶음이 여기로
            올라왔기 때문이다. PC 에서는 로고 없이 버튼만 오른쪽에 선다. 로고 중복이라는 09-28 의
            불변식은 `lg:hidden` 이 그대로 지킨다(가드가 로고를 앵커로 본다). */}
        <div className="flex items-center px-5 pt-3">
          <Link to="/" aria-label={t('nav.homeAria', { defaultValue: '유어딜 홈' })} className="lg:hidden active:opacity-70">
            <UrDealLogo size={19} />
          </Link>
          {cluster}
        </div>

        {/* ③④ 상호명 줄 — [얼굴] [이름·소개]. 그 위 선 없음(면으로 나뉜다).
            🏷️ 2026-11-01 (대표 확정 **2안**, 신고 *"리스터코퍼레이션 이렇게 길게 하니까 두줄이 되네?"*):
            버튼 묶음이 윗줄로 올라가 이 줄은 **얼굴 + 이름**뿐이다. 390px 실측으로 이름 칸이
            **132 → 294px**(얼굴도 56 → 40). 그래서 두 줄의 원인 자체가 사라졌다.
            ⚠️ 2026-10-25 의 `lg:flex-wrap`+`lg:basis-full`(PC 에서만 버튼 줄을 아래로)은 **더 필요 없다** —
            버튼이 아예 다른 줄이라 PC 300px 열에서도 이름 칸이 244px 다. 그 장치를 되살리지 말 것. */}
        <div className="flex items-center gap-4 px-5 pt-3">
          {/* 👤 얼굴 — 사진이 없으면 유달이(공유 카드와 같은 그림). 장식이라 alt 는 비운다(옆에 이름이 있다). */}
          <div className={avatarCls}>
            {photo ? (
              <img src={photo} alt="" width={40} height={40} className="w-full h-full object-cover" onError={(e) => cfImageOnError(e.currentTarget, curator.profile_image)} />
            ) : (
              <img src={SHARE_MASCOT_SRC} alt="" width={40} height={40} className="w-full h-full object-contain" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              {/* 🏷️ 2026-11-01 (대표 *"아무리 길어도 1줄"*): 크기는 `ushopNameSizePx` 가 글자만 보고 정하고,
                  그 바닥(15px)으로도 안 들어가는 이름만 말줄임이 받는다. 2026-09-30 의 "두 줄까지 허용"을 대체한다 —
                  칸이 132 → 294px 로 넓어져 한글 17자까지 한 줄이므로, 두 줄을 허용할 이유가 사라졌다. */}
              <h1 style={{ fontSize: nameSize }} className="min-w-0 font-bold text-gray-900 dark:text-white leading-tight tracking-[-0.03em] truncate">{curator.name}</h1>
              {accountType === 'business' && <VerifiedSeal size={17} className="shrink-0" />}
            </div>
            {curator.bio && (
              <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400 leading-snug line-clamp-1">{curator.bio}</p>
            )}
          </div>
        </div>

        {/* 📊 이름 아래 한 줄 — 왼쪽 숫자(이용권 · 누적 구매), 오른쪽 SNS 이름표. 둘 다 없으면 줄 자체가 없다. */}
        {(showStats || hasSns) && (
          <div className="mt-3 px-5 flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-[13px] text-gray-500 dark:text-gray-400 tabular-nums">
              {pinsN > 0 && <span>{t('curator.countVouchers', { defaultValue: '이용권' })} <b className="font-medium text-gray-900 dark:text-white">{pinsN}</b></span>}
              {pinsN > 0 && productsN > 0 && <span> · </span>}
              {productsN > 0 && <span>{t('curator.countProducts', { defaultValue: '내 상품' })} <b className="font-medium text-gray-900 dark:text-white">{productsN}</b></span>}
              {(pinsN > 0 || productsN > 0) && sold > 0 && <span> · </span>}
              {sold > 0 && <span>{t('curator.countSold', { defaultValue: '누적 구매' })} <b className="font-medium text-gray-900 dark:text-white">{formatNumber(sold)}</b></span>}
            </p>
            {hasSns && <div className="flex items-center gap-1 shrink-0">{snsLinks}</div>}
          </div>
        )}
        <div className="h-3" />
      </div>
    </header>
  )
}
