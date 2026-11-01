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
import { InstagramLogo, TikTokLogo, YouTubeLogo } from '@/components/icons/sns-logos'
import { snsUrl } from '@/utils/sns-url'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { formatNumber } from '@/utils/format'
import { SHARE_MASCOT_SRC } from '@/shared/ushop-share-card'

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
const avatarCls = 'w-14 h-14 rounded-full overflow-hidden bg-wash shrink-0'
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
  const photo = curator.profile_image ? cfImage(curator.profile_image, { width: 112, height: 112, fit: 'cover' }) : null

  /** SNS 이름표 — 이름 아래 줄 오른쪽. 브랜드 이름은 번역하지 않는다.
   *  🔗 글리프는 `icons/sns-logos` 공용 부품(2026-11-01 — 체험 연동 목록이 같은 로고를 쓴다. path 를
   *     두 벌로 두면 한쪽만 고치는 날이 온다). 단색(`currentColor`)은 그 파일이 지킨다. */
  const snsLinks = hasSns ? (
    <>
      {ytHref && (
        <a href={ytHref} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className={snsHitCls}>
          <span className={snsPillCls}>
            <YouTubeLogo />
            YouTube
          </span>
        </a>
      )}
      {igHref && (
        <a href={igHref} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={snsHitCls}>
          <span className={snsPillCls}>
            <InstagramLogo />
            Instagram
          </span>
        </a>
      )}
      {tkHref && (
        <a href={tkHref} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className={snsHitCls}>
          <span className={snsPillCls}>
            <TikTokLogo />
            TikTok
          </span>
        </a>
      )}
    </>
  ) : null

  return (
    <header className="bg-surface dark:bg-warm">
      <div className="max-w-3xl mx-auto">
        {/* ① 브랜드 바 — 로고 = 홈. 표시로 꾸미지 않는다(로고=홈은 웹 관례라 밑줄·화살표가 군더더기다).
            🖥️ 2026-09-28 (대표 *"둘 다 고치고"*): **PC 에서는 안 그린다.** lg+ 에서는 화면 맨 위에
            전역 네비(`DesktopTopNav` — `urdeal.` + 검색·찜·장바구니·알림)가 이미 있는데 이 줄이
            좌측 프로필 카드 **안에서** 같은 말을 또 해서, 1440px 실측에서 소비자 상단 바가
            화면에 **두 번** 있었다. 이 줄은 a3 의 **모바일용** 브랜드 바다.
            ⚠️ `?embed=1`(깨끗한 매장 링크)은 PC 에서도 전역 네비가 없지만, 그 모드의 목적 자체가
               "유어딜 chrome 을 안 보여 준다" 라 여기서도 안 그리는 쪽이 맞다. */}
        <div className="lg:hidden flex items-center px-5 pt-3">
          <Link to="/" aria-label={t('nav.homeAria', { defaultValue: '유어딜 홈' })} className="active:opacity-70">
            <UrDealLogo size={19} />
          </Link>
        </div>

        {/* ③④ 상호명 줄 — [얼굴] [이름·소개] [공유 · 관리]. 그 위 선 없음(면으로 나뉜다). */}
        {/* 🖥️ 2026-10-25 (대표 *"왜 정지원 이름이 1줄로 안되고 2줄이지?"*): PC 프로필 열은 300px 이라 [얼굴 56 · 공유 · 관리]가
            한 줄에 서면 이름 칸이 ~60px 만 남아 '정지/원' 으로 끊겼다 → lg 에서만 버튼 줄을 이름 아래로 내린다(폰 불변). */}
        <div className="flex items-center gap-4 px-5 pt-4 lg:flex-wrap lg:gap-y-3">
          {/* 👤 얼굴 — 사진이 없으면 유달이(공유 카드와 같은 그림). 장식이라 alt 는 비운다(옆에 이름이 있다). */}
          <div className={avatarCls}>
            {photo ? (
              <img src={photo} alt="" width={56} height={56} className="w-full h-full object-cover" onError={(e) => cfImageOnError(e.currentTarget, curator.profile_image)} />
            ) : (
              <img src={SHARE_MASCOT_SRC} alt="" width={56} height={56} className="w-full h-full object-contain" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              {/* 이름은 이 화면의 정체 자체라 자르지 않고 두 줄까지 허용한다(2026-09-30 실측 — 잘린 이름 사고). */}
              <h1 className="text-[24px] font-bold text-gray-900 dark:text-white leading-tight tracking-[-0.03em] line-clamp-2 break-keep">{curator.name}</h1>
              {accountType === 'business' && <VerifiedSeal size={17} className="shrink-0" />}
            </div>
            {curator.bio && (
              <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400 leading-snug line-clamp-2">{curator.bio}</p>
            )}
          </div>
          <div className="ml-3 flex items-center gap-2 shrink-0 lg:ml-[72px] lg:basis-full">
            <button
              type="button"
              onClick={onCopyLink}
              className={iconBtnCls}
              aria-label={t('curator.share', { defaultValue: '공유' })}
            >
              <Share2 className="w-[18px] h-[18px]" strokeWidth={1.6} aria-hidden="true" />
            </button>
            {canEdit ? (
              <Link to="/u/me/manage" className={manageBtnCls}>
                <EditIcon size={17} aria-hidden="true" />
                {t('curator.manage', { defaultValue: '관리' })}
              </Link>
            ) : (
              /*
               * 🪑 2026-10-09 — **방문자에게도 이 자리를 비워 둔다**(보이지 않는 같은 버튼).
               *   서버가 첫 화면을 그리려면(`worker/utils/curator-ssr-body.ts`) 이름 칸의 폭이 **누가 보든
               *   같아야** 한다 — 폭이 갈리면 `line-clamp-2` 가 1줄↔2줄로 갈려 마운트 때 아래가 밀린다.
               *   `<span>` + `invisible` + `aria-hidden` — 탭 순서에도 스크린리더에도 안 잡힌다.
               */
              <span aria-hidden="true" className={`${manageBtnCls} invisible pointer-events-none`}>
                <EditIcon size={17} aria-hidden="true" />
                {t('curator.manage', { defaultValue: '관리' })}
              </span>
            )}
          </div>
        </div>

        {/* 📊 이름 아래 한 줄 — 왼쪽 숫자(이용권 · 누적 구매), 오른쪽 SNS 이름표. 둘 다 없으면 줄 자체가 없다. */}
        {(showStats || hasSns) && (
          <div className="mt-4 px-5 flex items-center justify-between gap-2">
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
        <div className="h-4" />
      </div>
    </header>
  )
}
