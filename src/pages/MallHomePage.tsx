/**
 * 🏬 운영자 몰 홈 — `urdeal.kr/{슬러그}` (세션 ③-a, O2·C2·C3 진입)
 *
 * 대표 UX 기준(2026-07-29):
 *   ① **1순위 검증 환경 = 카카오톡 인앱 브라우저** ⇒ 비로그인·저사양·좁은 폭에서 먼저 성립해야 한다.
 *   ③ **신뢰 + 마감·잔여 수량 강조** ⇒ 카드에서 제일 먼저 읽히는 건 남은 시간과 남은 수량이다.
 *   ⑤ **본진 입구 금지** ⇒ 이 화면에서 유어딜 홈·탭·추천으로 가는 링크를 만들지 않는다.
 *   ~~⑥ 디자인 개선 금지~~ ⇒ **2026-08-02 로 해제.** 대표가 디자인을 외부 의뢰했고
 *     (`docs/design/design-outsourcing-brief.md`) 시안이 도착했다. ⑥ 은 *시안이 없는 동안*의
 *     보호막이었으므로 시안이 그 자리를 대신한다. ①③⑤ 는 그대로 유효하다.
 *
 * 🔴 몰을 못 찾으면(없음·`consumer_path=0`) **404 를 그대로 보여준다.** 조용히 본진을 보여주지 않는다 —
 *   그러면 A몰 링크를 받은 사람이 유어딜 홈을 보게 되고, 그건 "몰이 열렸다"보다 나쁜 결과다.
 *
 * ---
 * ## 🎨 2026-08-02 시안 적용 〔`docs/design/operator-mall-pilot.md` 화면 A〕
 *
 * ### 색 역할 — 🔴 의뢰서 §5.1 을 따르지 않는다
 * 의뢰서는 *"주 버튼·강조 = 로즈 `#1C69EF`"* 라고 적었지만 **그건 코드를 안 보고 쓴 것이다.**
 * `shared/mall/branding.ts` 에 2026-07-29 대표 확정이 있다 — 몰 대표 색 `#2E7D5B`(딥그린),
 * *"유어딜 본진(로즈 #1C69EF)과 **구분**되되 결제 신뢰를 주는 톤"*.
 * **의뢰서와 코드가 어긋나면 코드에 박힌 대표 확정이 우선**이다. 그래서 세 역할로 나눈다:
 *
 * | 역할 | 색 | 근거 |
 * |---|---|---|
 * | 몰 정체성(로고 아바타·안전결제 띠) | `mall.colorLight` / `colorDark` | 운영자가 고른 값. 몰마다 다르다 |
 * | 급함(마감·잔여) | 기능 red | 브랜드색이 아니라 **기능 신호**다(`tailwind.config.js` 주석: *"유일 예외 = red(에러/마감임박)"*) |
 * | 본문·가격 | 잉크 뉴트럴 | 어떤 상품 사진 위에서도 안 죽는다 |
 *
 * 🔴 **몰 색 위 글자는 모드마다 반대다.** 라이트 `#2E7D5B` 는 어두운 색이라 **흰 글자**(5.0:1),
 * 다크 `#5FBF95` 는 **밝은 색**이라 흰 글자를 얹으면 **2.24:1 로 AA 미달**이다 —
 * 그래서 다크에서는 **잉크 글자**(7.9:1)를 얹는다. 이 결함은 `validateMallColor` 를 만들다가
 * 실제로 잡혔다(가드가 없으면 눈으로는 "초록 위 흰 글씨"라 안 보인다).
 *
 * 🔴 **다크에서는 운영자 색을 쓰지 않는다.** `resolveMallBranding` 이 `colorDark` 를 운영자 지정과
 * 무관하게 **항상 `MALL_COLOR_DARK`(#5FBF95)** 로 돌린다(임의 파생이 AA 를 깰까 봐 P0 보류,
 * branding.ts:86-89). 그래서 `--mall` 은 라이트/다크가 **서로 다른 변수**를 물게 배선했다 —
 * 다크에서 운영자 색으로 그리면 실물과 다른 시안이 된다.
 *
 * ⚠️ **미해결(코드 가드 필요)**: 운영자가 고른 색의 **대비 검사가 없다**. 옅은 색을 고르면 이 화면의
 *   흰 글자(아바타 이니셜·안전결제 띠)가 안 보인다. 파일럿은 몰 1개라 안 터지지만 몰이 늘면 터진다.
 *   디자인으로 못 막는다 — `validateMallColor`(AA 대비) 가 저장 시점에 필요하다.
 *
 * ⚠️ `text-gray-*` 대신 hex — `tailwind.config.js` 가 `gray-*` 를 INK(딥네이비)로 리맵한다.
 * ⚠️ 🔴 **`rose-*` 를 쓰면 안 된다.** 같은 파일이 `rose: MONO` 로 **브랜드 색조까지 잉크로 리맵**해서
 *   `bg-rose-600` 은 화면에 **네이비**로 나온다(2026-08-02 렌더 스모크 스크린샷으로 발견 —
 *   정적 검사는 전부 초록이었다). 살아남는 기능색은 **`red` 하나뿐**이다(그 파일 주석:
 *   *"유일 예외 = red(에러/삭제/마감임박/안읽음 = 기능 신호)"*). 그래서 마감·할인은 `red-*` 다.
 *   회귀 방지는 `scripts/smoke-mall-render.mjs` 의 "마감 배지가 빨강 계열" 검사가 맡는다.
 * ⚠️ 이모지(⏰📦🔒) 대신 선 아이콘 — 안드로이드·iOS 에서 모양이 달라진다〔시안 §3.4〕.
 */
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Clock, Package, Lock, Info } from 'lucide-react'
import SEO from '@/components/SEO'
import BrandLoader from '@/components/brand/BrandLoader'
import NotFoundPage from '@/pages/NotFoundPage'
import { POWERED_BY, PAYMENT_TRUST_NOTE } from '@/shared/mall/branding'
import { mallProductPath } from '@/shared/mall/resolve'
import { rememberMallOrigin } from '@/shared/mall/origin'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { parseUTCDate } from '@/utils/date'
import { formatNumber } from '@/utils/format'
import { STORAGE_LABEL, STORAGE_NOTICE, type StorageKind } from '@/shared/pickup'

interface MallInfo {
  id: number; slug: string; name: string; initial: string
  logoUrl: string | null; colorLight: string; colorDark: string; intro: string; contactUrl: string | null
  // 📣 2026-08-09 과업①(상인회 SaaS) — 몰별 GA4 · 방문자 고지문 · 공지(팝업/배너). 전부 optional(구 캐시 응답 호환).
  ga_id?: string | null
  privacy_md?: string | null
  notices?: MallNotice[]
}
interface MallNotice { id: number; type: string; title: string; body: string | null; link_url: string | null }

/** 팝업 "다시 안 보기" — 공지 id 별 영구(localStorage). 새 공지는 새 id 라 다시 뜬다. */
const popupSeenKey = (id: number) => `mall_popup_seen_${id}`
interface MallItem {
  product_id: number; name: string; image_url: string | null
  list_price: number; gb_price: number; discount_pct: number
  deadline: string | null; stock: number | null
  /** 📦 픽업 — 없으면 `null`(빈 껍데기를 그리지 않는다). */
  pickup: { date: string | null; place: string | null; storage: StorageKind | null } | null
}

/** 남은 시간 — "2일 3시간" / "5시간 12분" / "곧 마감". 분 단위 미만은 굳이 안 센다(재렌더 비용). */
function remainLabel(iso: string | null): string | null {
  if (!iso) return null
  const d = parseUTCDate(iso)
  if (!d || Number.isNaN(d.getTime())) return null
  const ms = d.getTime() - Date.now()
  if (ms <= 0) return null
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${min}분 남음`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 ${min % 60}분 남음`
  return `${Math.floor(hr / 24)}일 ${hr % 24}시간 남음`
}

/** 픽업일 라벨 — "8월 10일". UTC-naive 오해석을 피해 `parseUTCDate` 를 쓴다(이 레포 반복 사고 클래스). */
function pickupDayLabel(iso: string): string {
  const d = parseUTCDate(iso)
  if (Number.isNaN(d.getTime())) return ''
  const kst = new Date(d.getTime() + 9 * 3600 * 1000)
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`
}

/**
 * 가격 표기 — **`7,000원`**. `formatWon` 은 `₩7,000` 을 내는데, 의뢰서 §4 화면 A 카드 ⑤ 와 시안이
 * 둘 다 **`원` 접미**로 적었다(`30% 7,000원 ~~10,000원~~`). 손님 화면이라 표기를 시안에 맞춘다.
 */
const won = (v: number) => `${formatNumber(v)}원`

/** 보관 배지 — 냉장·냉동은 파랑(주의 환기), 실온은 중립.〔시안 재사용 요소〕 */
const STORAGE_BADGE: Record<StorageKind, string> = {
  cold: 'text-[#3C6E8F] bg-[#E7F0F6] dark:text-[#8FBDDA] dark:bg-[#1B2A34]',
  room: 'text-[#6B6469] bg-[#F0EDEE] dark:text-[#A29A9F] dark:bg-[#242024]',
}

export default function MallHomePage() {
  const { mallSlug = '' } = useParams()
  const [mall, setMall] = useState<MallInfo | null>(null)
  const [items, setItems] = useState<MallItem[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading')
  const [popupOpen, setPopupOpen] = useState(false)
  const [policyOpen, setPolicyOpen] = useState(false)

  // 📊 몰별 GA4 — 전역 gtag 스텁(index.html)에 추가 config. 상인회가 자기 속성으로 몰 트래픽을 본다.
  //   GTM 스크립트 로드 전엔 dataLayer 큐잉이라 순서 무관. 잘못된 값은 저장 시점(어드민)에 걸러짐.
  useEffect(() => {
    const id = String(mall?.ga_id || '').trim()
    if (!/^G-[A-Z0-9]{4,20}$/i.test(id)) return
    try { (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.('config', id) } catch { /* noop */ }
  }, [mall?.ga_id])

  // 📣 팝업 공지 — 활성 팝업 중 아직 안 닫은 첫 건만. "다시 안 보기"는 공지 id 별 영구.
  const popup = (mall?.notices || []).find((n) => n.type === 'popup' && (() => {
    try { return !localStorage.getItem(popupSeenKey(n.id)) } catch { return true }
  })())
  useEffect(() => { if (popup) setPopupOpen(true) }, [popup?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const banners = (mall?.notices || []).filter((n) => n.type === 'banner')

  useEffect(() => {
    let alive = true
    setState('loading')
    // 몰 확정과 상품을 **병렬**로 — 카톡 인앱의 느린 회선에서 왕복 2회는 체감이 크다.
    //   상품 응답이 먼저 와도 몰이 404 면 버린다(아래 state 분기).
    type MallResp = { success?: boolean; mall?: MallInfo }
    type ListResp = { success?: boolean; data?: MallItem[] }
    const p1 = fetch(`/api/mall/${encodeURIComponent(mallSlug)}`)
      .then((r) => r.json() as Promise<MallResp>).catch(() => null)
    const p2 = fetch(`/api/mall/${encodeURIComponent(mallSlug)}/products`)
      .then((r) => r.json() as Promise<ListResp>).catch(() => null)
    Promise.all([p1, p2]).then(([m, list]) => {
      if (!alive) return
      if (!m?.success || !m?.mall) { setState('notfound'); return }
      // 🧭 2026-08-11 — 몰 흔적을 남긴다. `rememberMallOrigin` 은 2026-08-02 에 만들어졌는데
      //   **호출부가 0** 이라 흔적이 한 번도 안 남았고, 그래서 상품이 사라졌을 때의
      //   '가게로 돌아가기' 가 한 번도 뜬 적이 없다(항상 유어딜 홈으로 보냈다).
      rememberMallOrigin(m.mall.slug)
      setMall(m.mall)
      setItems(Array.isArray(list?.data) ? list.data : [])
      setState('ok')
    })
    return () => { alive = false }
  }, [mallSlug])

  if (state === 'loading') return <BrandLoader fullScreen />
  // 🔴 몰이 아니면 평소의 404. 본진으로 흘려보내지 않는다.
  if (state === 'notfound' || !mall) return <NotFoundPage />

  return (
    <div
      className="min-h-[100dvh] bg-white dark:bg-[#11141C] [--mall:var(--mall-l)] dark:[--mall:var(--mall-d)]"
      style={{ ['--mall-l' as string]: mall.colorLight, ['--mall-d' as string]: mall.colorDark }}
    >
      <SEO title={`${mall.name} - 공동구매`} description={mall.intro} url={`/${mall.slug}`} />

      {/* 헤더 — 로고(없으면 이니셜) · 이름 · 소개 1줄 */}
      <header className="px-5 pt-6 pb-4 ur-content-wide mx-auto">
        <div className="flex items-center gap-[13px]">
          {mall.logoUrl ? (
            <img src={cfImage(mall.logoUrl, { width: 112 })} alt="" width={56} height={56}
              className="w-[50px] h-[50px] rounded-[15px] object-cover border border-[#EFEBED] dark:border-[#2A2A2A] flex-none"
              onError={(e) => cfImageOnError(e.currentTarget, mall.logoUrl)}
            />
          ) : (
            <div className="w-[50px] h-[50px] rounded-[15px] flex items-center justify-center text-white dark:text-[#1A1719] text-[21px] font-extrabold tracking-[-0.02em] flex-none"
              style={{ backgroundColor: 'var(--mall)' }} aria-hidden>{mall.initial}</div>
          )}
          <div className="min-w-0">
            <h1 className="text-[18.5px] font-extrabold tracking-[-0.035em] leading-tight text-[#1A1719] dark:text-[#F3EFF1] truncate">{mall.name}</h1>
            <p className="mt-1 text-[13px] tracking-[-0.015em] text-[#776F74] dark:text-[#9C9398] truncate">{mall.intro}</p>
          </div>
        </div>
      </header>

      {/* 📣 공지 배너(운영자 작성) — 신뢰 띠 위, 상단 띠로. 링크 있으면 통째 링크. */}
      {banners.length > 0 && (
        <div className="px-5 ur-content-wide mx-auto space-y-2 mb-2">
          {banners.map((n) => {
            const inner = (
              <span className="flex items-start gap-[7px]">
                <Info className="w-[13px] h-[13px] flex-none mt-[2px]" strokeWidth={2.2} />
                <span className="min-w-0">
                  <span className="font-bold">{n.title}</span>
                  {n.body && <span className="ml-1.5 font-medium opacity-80">{n.body}</span>}
                </span>
              </span>
            )
            const cls = 'block rounded-xl px-3.5 py-2.5 text-[12.5px] tracking-[-0.02em] bg-[#F7F5F6] dark:bg-[#1C181B] border border-[#EDE9EB] dark:border-[#292327] text-[#3F383C] dark:text-[#DAD4D7]'
            return n.link_url ? (
              <a key={n.id} href={n.link_url} className={cls} target={n.link_url.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{inner}</a>
            ) : (
              <p key={n.id} className={cls}>{inner}</p>
            )
          })}
        </div>
      )}

      {/* 신뢰 — 대표 UX 기준 ③. 몰 색 띠로 올려 "처음 보는 가게" 불안을 첫 화면에서 받는다.
          ⚠️ 문구(PAYMENT_TRUST_NOTE)는 **법무 확인 대기**라 시안이 ~어요체로 그렸어도 바꾸지 않는다. */}
      <div className="px-5 ur-content-wide mx-auto">
        <p className="flex items-center gap-[7px] rounded-xl px-3.5 py-2.5 text-[12.5px] font-semibold tracking-[-0.02em] text-white dark:text-[#1A1719]"
          style={{ backgroundColor: 'var(--mall)' }}>
          <Lock className="w-[13px] h-[13px] flex-none" strokeWidth={2.2} />
          {PAYMENT_TRUST_NOTE}
        </p>
      </div>

      <main className="px-5 pb-4 ur-content-wide mx-auto">
        <div className="flex items-baseline justify-between pt-6 pb-3.5">
          <h2 className="text-[15.5px] font-extrabold tracking-[-0.03em] text-[#1A1719] dark:text-[#F3EFF1]">진행 중인 공동구매</h2>
          {items.length > 0 && <span className="text-[12px] font-semibold text-[#9A9298] dark:text-[#7C7479]">{items.length}</span>}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-10 py-24 text-center">
            <div className="w-[62px] h-[62px] rounded-[20px] bg-[#F5F2F3] dark:bg-[#1C181B] flex items-center justify-center mb-[18px]">
              <Package className="w-[26px] h-[26px] text-[#B7B0B4]" strokeWidth={1.8} />
            </div>
            {/* 빈 상태는 마침표를 뺀다〔시안 §3.3〕 */}
            <p className="text-[14.5px] font-bold tracking-[-0.03em] text-[#3F383C] dark:text-[#DAD4D7]">진행 중인 공동구매가 없어요</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3.5 gap-y-[22px]">
            {items.map((it) => {
              const remain = remainLabel(it.deadline)
              const lowStock = typeof it.stock === 'number' && it.stock > 0 && it.stock <= 10
              return (
                <li key={it.product_id}>
                  {/* 🏬 2026-08-11 — 본진 `/products/:id` 로 나가던 것을 **몰 상세**로 〔대표 "철저히 분리"〕.
                      그전까지 이 링크 하나가 손님을 유어딜 크롬 + 상시가 화면으로 내보냈다.
                      경로 조립은 `mallProductPath` 하나뿐이다(손으로 붙이면 판정과 갈린다). */}
                  <Link to={mallProductPath(mall.slug, it.product_id)} className="block group">
                    <div className="relative aspect-square rounded-[14px] overflow-hidden bg-[#F1EDEF] dark:bg-[#221D20]">
                      {it.image_url && (
                        <img src={cfImage(it.image_url, { width: 400 })} alt="" loading="lazy"
                          className="w-full h-full object-cover"
                          onError={(e) => cfImageOnError(e.currentTarget, it.image_url)}
                        />
                      )}
                      {/* 🔴 마감·잔여를 이미지 위에 — 카드에서 **제일 먼저 읽혀야 하는 정보**다(기준 ③).
                          마감이 채움 배지, 잔여가 검정 반투명 — 의뢰서가 먼저 읽히라 한 게 마감이라서다. */}
                      {remain && (
                        <span className="absolute left-2 top-2 flex items-center gap-1 px-2 py-[5px] rounded-full bg-red-600 text-white text-[11.5px] font-bold tracking-[-0.02em] pointer-events-none">
                          <Clock className="w-[11px] h-[11px]" strokeWidth={2.4} />
                          {remain}
                        </span>
                      )}
                      {lowStock && (
                        <span className="absolute right-2 top-2 px-2 py-[5px] rounded-full bg-[rgba(20,17,19,.74)] backdrop-blur-sm text-white text-[11.5px] font-bold tracking-[-0.02em] pointer-events-none">
                          {it.stock}개 남음
                        </span>
                      )}
                    </div>

                    <p className="mt-[11px] min-h-[38px] line-clamp-2 text-[13.5px] leading-[1.4] tracking-[-0.025em] text-[#251F22] dark:text-[#ECE7E9]">{it.name}</p>

                    <p className="mt-[5px] flex items-baseline gap-[5px] flex-wrap">
                      {it.discount_pct > 0 && (
                        <span className="text-[15px] font-extrabold tracking-[-0.03em] text-red-600 dark:text-red-400">{it.discount_pct}%</span>
                      )}
                      <span className="text-[15px] font-extrabold tracking-[-0.03em] text-[#1A1719] dark:text-[#F3EFF1]">{won(it.gb_price)}</span>
                      {it.list_price > it.gb_price && (
                        <span className="text-[11.5px] line-through text-[#A9A2A6] dark:text-[#7C7479]">{won(it.list_price)}</span>
                      )}
                    </p>

                    {/* 📦 픽업 — **언제 받는지**가 카드에서 보여야 "배송인가?" 문의가 안 쏟아진다.
                        옅은 판을 깔아 가격 줄과 분리한다(의뢰서가 가장 걱정한 문의). */}
                    {it.pickup && (it.pickup.date || it.pickup.storage) && (
                      <p className="mt-[9px] flex items-center gap-1.5 rounded-lg bg-[#F5F2F3] dark:bg-[#211C1F] px-2 py-1.5">
                        <Package className="w-[13px] h-[13px] flex-none text-[#5C5459] dark:text-[#A69EA3]" strokeWidth={1.9} />
                        {it.pickup.date && (
                          <span className="text-[11.5px] font-bold tracking-[-0.02em] text-[#3F383C] dark:text-[#DAD4D7]">{pickupDayLabel(it.pickup.date)} 픽업</span>
                        )}
                        {it.pickup.storage && (
                          <span className={`ml-auto flex-none px-[5px] py-[3px] rounded-[5px] text-[10.5px] font-bold tracking-[-0.02em] ${STORAGE_BADGE[it.pickup.storage]}`}>
                            {STORAGE_LABEL[it.pickup.storage]}
                          </span>
                        )}
                      </p>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>

      {/* 📦 보관 고지 — **카드마다 반복하지 않고** 목록에 한 번. 카드가 시끄러워지면 마감·가격이 묻힌다.
          ⚠️ 문구는 법무 확인 대기(체크리스트 X4c) 임시 표기다 — 말투를 바꾸지 않는다. */}
      {(() => {
        const kinds = Array.from(new Set(items.map((i) => i.pickup?.storage).filter(Boolean))) as StorageKind[]
        if (kinds.length === 0) return null
        return (
          <aside className="px-5 pb-6 ur-content-wide mx-auto">
            <div className="flex gap-2.5 rounded-xl bg-[#F7F5F6] dark:bg-[#1C181B] border border-[#EDE9EB] dark:border-[#292327] px-3.5 py-3.5">
              <Info className="w-[15px] h-[15px] flex-none mt-px text-[#8A8288]" strokeWidth={2} />
              <div className="space-y-1">
                {kinds.map((k) => (
                  <p key={k} className="text-[12px] leading-[1.6] tracking-[-0.02em] text-[#6B6469] dark:text-[#A29A9F]">{STORAGE_NOTICE[k]}</p>
                ))}
              </div>
            </div>
          </aside>
        )
      })()}

      {/* ⑤ 본진 입구 금지 — 링크가 아니라 **문자열**이다(클릭 안 됨). */}
      <footer className="ur-content-wide mx-auto px-5 pb-10 text-center border-t border-[#F1EDEF] dark:border-[#262023]">
        {/* 📣 몰 방문자 고지문(운영자 작성) — 있을 때만 열람 버튼. 전자 게시 = 과업① 전자동의 축의 고지 절반. */}
        {mall.privacy_md && (
          <button onClick={() => setPolicyOpen(true)}
            className="block mx-auto pt-5 text-[11px] font-semibold tracking-[-0.01em] text-[#8A8288] dark:text-[#7C7479] underline underline-offset-2">
            이용·개인정보 안내
          </button>
        )}
        <span className={`inline-block ${mall.privacy_md ? 'pt-3' : 'pt-5'} text-[10.5px] font-semibold tracking-[0.06em] text-[#BCB5B9] dark:text-[#5E5559] select-none cursor-default`}>{POWERED_BY}</span>
      </footer>

      {/* 📣 팝업 공지 — 표준 모달 z(10500, constants/z-index 스케일). "다시 안 보기"는 id 별 영구. */}
      {popup && popupOpen && (
        <div className="fixed inset-0 z-[10500] flex items-center justify-center bg-black/50 px-6" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#171317] p-5 shadow-xl">
            <p className="text-[15.5px] font-extrabold tracking-[-0.03em] text-[#1A1719] dark:text-[#F3EFF1]">{popup.title}</p>
            {popup.body && <p className="mt-2 text-[13px] leading-[1.6] tracking-[-0.02em] whitespace-pre-wrap text-[#524B4F] dark:text-[#BDB5BA]">{popup.body}</p>}
            {popup.link_url && (
              <a href={popup.link_url} target={popup.link_url.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
                className="mt-3 block w-full rounded-xl py-2.5 text-center text-[13px] font-bold text-white dark:text-[#1A1719]"
                style={{ backgroundColor: 'var(--mall)' }}>
                자세히 보기
              </a>
            )}
            <div className="mt-4 flex items-center gap-2">
              <button onClick={() => { try { localStorage.setItem(popupSeenKey(popup.id), '1') } catch { /* noop */ } setPopupOpen(false) }}
                className="flex-1 rounded-xl border border-[#EDE9EB] dark:border-[#292327] py-2.5 text-[13px] font-semibold text-[#6B6469] dark:text-[#A29A9F]">
                다시 안 보기
              </button>
              <button onClick={() => setPopupOpen(false)}
                className="flex-1 rounded-xl bg-[#1A1719] dark:bg-[#F3EFF1] py-2.5 text-[13px] font-bold text-white dark:text-[#1A1719]">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📣 이용·개인정보 안내 모달 — 운영자 privacy_md 원문 게시(줄바꿈 보존). */}
      {policyOpen && mall.privacy_md && (
        <div className="fixed inset-0 z-[10500] flex items-center justify-center bg-black/50 px-6" role="dialog" aria-modal="true"
          onClick={() => setPolicyOpen(false)}>
          <div className="w-full max-w-md max-h-[80dvh] flex flex-col rounded-2xl bg-white dark:bg-[#171317] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-[15.5px] font-extrabold tracking-[-0.03em] text-[#1A1719] dark:text-[#F3EFF1]">이용·개인정보 안내</p>
            <div className="mt-3 flex-1 min-h-0 overflow-y-auto">
              <p className="text-[13px] leading-[1.7] tracking-[-0.02em] whitespace-pre-wrap text-[#524B4F] dark:text-[#BDB5BA]">{mall.privacy_md}</p>
            </div>
            <button onClick={() => setPolicyOpen(false)}
              className="mt-4 w-full rounded-xl bg-[#1A1719] dark:bg-[#F3EFF1] py-2.5 text-[13px] font-bold text-white dark:text-[#1A1719]">
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
