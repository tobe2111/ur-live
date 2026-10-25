/**
 * 🏠 생활 업체 모집 랜딩 — 로그인 전 `/life/pro` (2026-10-25 대표 "1~3 다 하자" → "너무 복잡하지 않아? 글 밖에 없고" → **"A안으로 해줘"**).
 *
 * 글 목록 대신 [숫자 셋 · 받는 일 그림 · 버튼 하나]. 시안: `docs/design/assets/life-pro-landing-A-2026-10-25.png`.
 * 🔒 숫자는 규칙 SSOT(`home-service.ts`)에서 받는다. 참여권 가격은 어드민이 바꾸므로 **적지 않는다**.
 * 🔒 크롤러 본문(`surface-copy.ts` 의 `/life/pro`)은 이 파일의 문장을 그대로 쓴다 — 가드가 대조한다.
 */
import { Link, useLocation } from 'react-router-dom'
import { HOME_SERVICE_CATEGORIES, MAX_QUOTES_PER_REQUEST, SIGNUP_FREE_CREDITS, UNVIEWED_REFUND_HOURS } from '@/shared/home-service'
import { LIFE_TILES, LifeTileIcon } from '../life-tiles'
import { isShareToken } from '@/shared/home-service-share'
import { JOIN_KEY } from './join-params'

export default function ProLanding() {
  // 🔗 공유 링크(`?share=…`)로 왔으면 로그인 뒤 **그 요청 페이지**로 돌아간다 — 로그인 왕복은 쿼리를 지우지만
  //   (`safeInternalPath` 화이트리스트) 경로는 남는다. 거기서 다시 누르면 업종·지역이 채워진 등록으로 이어진다.
  const { search } = useLocation()
  const share = new URLSearchParams(search).get('share')
  // 🔗 2026-10-25: 로그인이 쿼리를 지워도 업종·지역 미리 채움이 살아남게 세션에 맡겨 두고 `/life/pro` 로 돌아온다
  //   — 종전엔 공유 페이지로 돌아가 버튼을 한 번 더 눌러야 했다. 읽는 쪽: `LifeProPage` 의 `joinParams()`.
  const keepJoin = () => { if (isShareToken(share)) { try { sessionStorage.setItem(JOIN_KEY, search) } catch { /* 막힌 저장소 — 공유 페이지로 돌아가면 된다 */ } } }
  const returnUrl = encodeURIComponent('/life/pro')
  const store = HOME_SERVICE_CATEGORIES.filter((d) => d.audience === 'store')
  const others = HOME_SERVICE_CATEGORIES.length - store.length
  const stats = [
    [`${SIGNUP_FREE_CREDITS}장`, '처음 무료 참여권'],
    [`${MAX_QUOTES_PER_REQUEST}곳`, '요청당 견적 자리'],
    [`${UNVIEWED_REFUND_HOURS}시간`, '안 열어 보면 반환'],
  ] as const
  return (
    <div className="space-y-8 pt-2">
      <section>
        <h2 className="text-[24px] font-bold leading-snug tracking-tight">근처 가게 일 견적 요청,<br />알림톡으로 받으세요</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">식당·카페·숙소 사장님이 올린 요청에 원하는 것만 골라 견적을 보내요.</p>
      </section>
      <div className="grid grid-cols-3 gap-2">
        {stats.map(([big, small]) => (
          <div key={small} className="rounded-2xl bg-surface px-2 py-4 text-center shadow-lift">
            <p className="text-[24px] font-bold tabular-nums">{big}</p>
            <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">{small}</p>
          </div>
        ))}
      </div>
      <section>
        <h3 className="text-[17px] font-bold">이런 일을 받아요</h3>
        <ul className="mt-4 grid grid-cols-4 gap-x-1 gap-y-5">
          {store.map((d) => (
            <li key={d.key} className="flex flex-col items-center gap-2">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface shadow-lift"><LifeTileIcon category={d.key} /></span>
              <span className="whitespace-pre-line text-center text-[12px] font-medium leading-tight">{LIFE_TILES[d.key][0]}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-center text-[13px] text-gray-500 dark:text-gray-400">숙소·집 일 {others}가지도 함께 받을 수 있어요</p>
      </section>
      <div className="space-y-1 pt-2">
        <Link to={`/login?returnUrl=${returnUrl}`} onClick={keepJoin} className="ur-btn ur-btn-lg ur-btn-primary flex w-full justify-center">카카오로 시작하기</Link>
        <p className="py-2 text-center text-[13px] text-gray-500 dark:text-gray-400">로그인 후 한 화면이면 가입 끝 · 사업자등록증은 나중에</p>
        <p className="pt-2 text-center text-[12px] text-gray-500 dark:text-gray-400">유어딜은 연결만 해요. 계약과 대금은 사장님과 직접 주고받아요.</p>
      </div>
    </div>
  )
}
